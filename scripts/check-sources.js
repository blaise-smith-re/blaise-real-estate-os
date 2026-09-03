#!/usr/bin/env node
/**
 * Source-drift checker for governance/source-registry.json.
 *
 * WHY THIS IS TWO-PART:
 * Node cannot reach Google Drive. Drive is available only through Claude's MCP connector.
 * So this script cannot fetch anything itself, and pretending otherwise would be dishonest
 * tooling. Instead it does the two things it genuinely can:
 *
 *   1. `plan`   - validate registry integrity and emit the exact retrieval manifest Claude
 *                 must execute (fileId + what to read + what to compare).
 *   2. `verify` - given the retrieval results Claude produced, compute drift deterministically
 *                 and exit non-zero on any HOLD condition. CI-safe.
 *
 * USAGE
 *   node scripts/check-sources.js plan
 *   node scripts/check-sources.js plan --json > /tmp/manifest.json
 *   node scripts/check-sources.js verify --results /tmp/results.json
 *
 * RESULTS FILE SHAPE (produced by Claude after retrieving each source):
 *   { "retrieved_at": "2026-08-31T18:00:00-05:00",
 *     "sources": [ { "key": "...", "file_id": "...", "title": "...", "version": "1.29" } ] }
 *
 * STATUS VALUES
 *   CURRENT        version matches the pin
 *   REGISTRY DRIFT version differs -> live Drive wins; update the pin; raise a finding
 *   UNPINNED       registry has no pin (source exposes no version line)
 *   HOLD           LEGACY/ARCHIVED resolution, fileId mismatch, or retrieval failure
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'governance', 'source-registry.json');

const args = process.argv.slice(2);
const mode = args[0] || 'plan';
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const has = (n) => args.includes(n);

function loadRegistry() {
  const r = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const errs = [];
  const seenId = new Set(), seenKey = new Set();
  for (const s of r.sources) {
    for (const f of ['key', 'title', 'file_id', 'authority', 'verify'])
      if (s[f] === undefined) errs.push(`source "${s.key || '?'}" missing field "${f}"`);
    if (seenId.has(s.file_id)) errs.push(`duplicate file_id: ${s.file_id}`);
    if (seenKey.has(s.key)) errs.push(`duplicate key: ${s.key}`);
    seenId.add(s.file_id); seenKey.add(s.key);
    for (const b of ['content', 'body', 'fileContent', 'cached', 'snapshot'])
      if (b in s) errs.push(`source "${s.key}" caches canonical content via "${b}" - POINTERS ONLY`);
  }
  if (errs.length) { console.error('REGISTRY INVALID:\n  ' + errs.join('\n  ')); process.exit(2); }
  return r;
}

function isLegacyTitle(t) {
  return /^\s*(RETIRED|LEGACY|ARCHIVED)\s*-/i.test(t || '') || /\bSuperseded\b/i.test(t || '');
}

// ------------------------------------------------------------------ plan

function plan() {
  const r = loadRegistry();
  const retrievable = r.sources.filter(s => s.authority !== 'route-target');

  if (has('--json')) {
    console.log(JSON.stringify({
      registry_version: r.registry_version,
      instruction: 'Retrieve each file_id via mcp__Google_Drive__read_file_content. Do NOT resolve by title.',
      sources: retrievable.map(s => ({
        key: s.key, file_id: s.file_id, expected_title: s.title,
        version_pin: s.version_pin, authority: s.authority,
        owner_account: s.owner_account || null, verify: s.verify,
      })),
    }, null, 2));
    return;
  }

  console.log(`\nSOURCE RETRIEVAL PLAN  (registry v${r.registry_version}, updated ${r.updated})`);
  console.log('='.repeat(76));
  console.log('Retrieve each fileId with mcp__Google_Drive__read_file_content.');
  console.log('NEVER resolve a canonical source by title search.\n');

  for (const s of retrievable) {
    console.log(`  ${s.key}`);
    console.log(`    fileId    ${s.file_id}`);
    console.log(`    authority ${s.authority}`);
    console.log(`    pin       ${s.version_pin === null ? '(none - UNPINNED)' : s.version_pin}`);
    console.log(`    owner     ${s.owner_account || '(unrecorded)'}`);
    console.log(`    verify    ${s.verify}`);
    console.log('');
  }

  const skipped = r.sources.filter(s => s.authority === 'route-target');
  if (skipped.length) {
    console.log(`  Route-target pointers (do NOT retrieve during a normal run): ${skipped.map(s => s.key).join(', ')}\n`);
  }
  const unpinned = retrievable.filter(s => s.version_pin === null);
  if (unpinned.length) {
    console.log(`  WARNING  ${unpinned.length} source(s) are UNPINNED and cannot be drift-checked:`);
    for (const s of unpinned) console.log(`             - ${s.key}`);
    console.log('           See Improvement Finding IF-2026-08-31-007 (withdrawn).\n');
  }
  console.log(`  ${retrievable.length} source(s) to retrieve. Then:`);
  console.log('    node scripts/check-sources.js verify --results <results.json>\n');
}

// ------------------------------------------------------------------ verify

function verify() {
  const resultsPath = flag('--results');
  if (!resultsPath) { console.error('verify requires --results <file>'); process.exit(2); }

  const r = loadRegistry();
  const got = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const byKey = new Map((got.sources || []).map(s => [s.key, s]));
  const rows = [];
  let holds = 0, drifts = 0;

  for (const s of r.sources) {
    if (s.authority === 'route-target') continue;
    const g = byKey.get(s.key);

    if (!g) { rows.push([s.key, 'HOLD', 'not retrieved']); holds++; continue; }
    if (g.file_id && g.file_id !== s.file_id) {
      rows.push([s.key, 'HOLD', `fileId mismatch: got ${g.file_id}`]); holds++; continue;
    }
    if (isLegacyTitle(g.title)) {
      rows.push([s.key, 'HOLD', `RETIRED/LEGACY/ARCHIVED resolution: "${g.title}"`]); holds++; continue;
    }
    if (s.version_pin === null || s.version_pin === undefined) {
      rows.push([s.key, 'UNPINNED', `live "${g.version || 'no version line'}" - cannot drift-check`]); continue;
    }
    if (!g.version) { rows.push([s.key, 'HOLD', 'pinned source returned no version line']); holds++; continue; }

    if (String(g.version).trim() === String(s.version_pin).trim()) {
      rows.push([s.key, 'CURRENT', `v${g.version}`]);
    } else {
      rows.push([s.key, 'REGISTRY DRIFT', `pin v${s.version_pin} -> live v${g.version} (LIVE WINS)`]);
      drifts++;
    }
  }

  const w = Math.max(...rows.map(x => x[0].length)) + 2;
  console.log(`\nSOURCE DRIFT CHECK   retrieved_at ${got.retrieved_at || '(unstated)'}`);
  console.log('='.repeat(76));
  for (const [k, st, d] of rows) console.log(`  ${k.padEnd(w)}${st.padEnd(16)}${d}`);
  console.log('='.repeat(76));
  console.log(`  ${rows.filter(x => x[1] === 'CURRENT').length} current | ${drifts} drift | ` +
              `${rows.filter(x => x[1] === 'UNPINNED').length} unpinned | ${holds} hold`);

  if (drifts) {
    console.log('\n  ACTION REQUIRED (drift): the LIVE Drive document wins.');
    console.log('    1. Proceed on the live document - never on the pin.');
    console.log('    2. Update version_pin + version_verified_at in governance/source-registry.json.');
    console.log('    3. Note it in CHANGELOG.md.');
    console.log('    4. Raise an Improvement Finding if the change alters agent-relied-upon behavior.');
  }
  if (holds) {
    console.log('\n  HOLD: do not run policy-sensitive work against the affected source(s).');
    process.exit(1);
  }
  console.log('');
}

if (mode === 'plan') plan();
else if (mode === 'verify') verify();
else { console.error(`unknown mode "${mode}". Use: plan | verify`); process.exit(2); }
