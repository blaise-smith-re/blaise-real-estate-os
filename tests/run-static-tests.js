#!/usr/bin/env node
/**
 * Static test suite for the Blaise Real Estate OS execution layer.
 *
 * Verifies the invariants that can be proven WITHOUT invoking an agent or touching a
 * business system: registry integrity, tool-permission containment, agent guardrail
 * presence, and the no-cached-canonical-content rule.
 *
 * Behavioral adversarial scenarios (see tests/adversarial/scenarios.md) require a live
 * agent invocation and are NOT covered here. This suite makes zero network calls and
 * zero writes to any business system.
 *
 *   node tests/run-static-tests.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let failed = 0;

function check(id, name, fn) {
  try {
    const detail = fn();
    results.push({ id, name, status: 'PASS', detail: detail || '' });
  } catch (e) {
    results.push({ id, name, status: 'FAIL', detail: e.message });
    failed++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  assert(m, 'no YAML frontmatter');
  const out = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0 && !/^\s/.test(line)) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

// Canonical FUB write tools. Any of these reachable by a Phase 2 agent is a hard failure.
const FUB_WRITE_TOOLS = [
  'create_contact_note', 'create_contact_task', 'close_out_contact_interaction',
  'create_contact_appointment', 'update_contact_appointment', 'create_contact_deal',
  'update_contact_deal', 'update_contact_profile', 'update_contact_task',
  'replace_contact_channels', 'merge_contact_tags',
  'log_external_call_record', 'log_external_text_record',
].map(t => 'mcp__Blaise_FUB__' + t);

const OTHER_WRITE_TOOLS = [
  'mcp__Google_Calendar__create_event', 'mcp__Google_Calendar__update_event',
  'mcp__Google_Calendar__delete_event', 'mcp__Google_Calendar__respond_to_event',
  'mcp__Google_Drive__create_file', 'mcp__Google_Drive__update_file',
  'mcp__Google_Drive__copy_file', 'mcp__Google_Drive__trash_file',
  'mcp__Google_Drive__share_file',
  'mcp__Gmail__send_message', 'mcp__Gmail__reply', 'mcp__Gmail__forward',
  'mcp__Gmail__create_draft', 'mcp__Gmail__update_draft',
];

const SCHEDULING_TOOLS = [
  'CronCreate', 'CronDelete', 'ScheduleWakeup',
  'mcp__Claude_Code_Remote__create_trigger', 'mcp__Claude_Code_Remote__send_later',
];

const AGENTS = ['daily-revenue-command-center', 'client-prep-brief'];
const SKILLS = ['retrieve-canonical-source', 'chicago-date-anchor', 'operator-execution-report'];

// ---------------------------------------------------------------- registry

check('T-01', 'source-registry.json is valid and structurally complete', () => {
  const r = json('governance/source-registry.json');
  assert(Array.isArray(r.sources) && r.sources.length > 0, 'no sources');
  const required = ['key', 'title', 'file_id', 'authority', 'verify'];
  for (const s of r.sources) {
    for (const f of required) assert(s[f] !== undefined, `source "${s.key}" missing "${f}"`);
    assert(/^[A-Za-z0-9_-]{20,}$/.test(s.file_id), `source "${s.key}" has implausible file_id`);
  }
  return `${r.sources.length} sources, all required fields present`;
});

check('T-02', 'registry stores POINTERS ONLY - no canonical content cached', () => {
  const r = json('governance/source-registry.json');
  const banned = ['content', 'body', 'text', 'fileContent', 'cached', 'snapshot'];
  for (const s of r.sources) {
    for (const b of banned) assert(!(b in s), `source "${s.key}" caches canonical content via "${b}"`);
    // A verify instruction is guidance; anything very long suggests pasted source text.
    assert(String(s.verify).length < 400, `source "${s.key}" verify field is long enough to be cached content`);
  }
  return 'no cached canonical content in registry';
});

check('T-03', 'registry file_ids and keys are unique', () => {
  const r = json('governance/source-registry.json');
  const ids = r.sources.map(s => s.file_id), keys = r.sources.map(s => s.key);
  assert(new Set(ids).size === ids.length, 'duplicate file_id');
  assert(new Set(keys).size === keys.length, 'duplicate key');
  return `${keys.length} unique keys / file_ids`;
});

check('T-04', 'registry declares live-Drive-wins and LEGACY rejection', () => {
  const raw = read('governance/source-registry.json');
  assert(/LIVE DRIVE DOCUMENT WINS/i.test(raw), 'missing live-wins rule');
  assert(/LEGACY/.test(raw) && /ARCHIVED/.test(raw), 'missing LEGACY/ARCHIVED rejection rule');
  assert(/never resolve by title|Never resolve.*by title/i.test(raw), 'missing never-resolve-by-title rule');
  return 'drift and LEGACY rules present';
});

check('T-05', 'every source required by an agent exists in the registry', () => {
  const r = json('governance/source-registry.json');
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    const keys = r.sources.filter(s => (s.required_by || []).includes(a)).map(s => s.key);
    assert(keys.length > 0, `agent "${a}" has no registry sources`);
    for (const k of keys) {
      if (r.sources.find(s => s.key === k).authority === 'route-target') continue;
      assert(md.includes(k), `agent "${a}" does not reference required source key "${k}"`);
    }
  }
  return 'agent/registry source references consistent';
});

// ---------------------------------------------------------------- permissions

check('T-06', 'settings.json denies all 13 FUB write tools', () => {
  const d = json('.claude/settings.json').permissions.deny;
  const miss = FUB_WRITE_TOOLS.filter(t => !d.includes(t));
  assert(miss.length === 0, `not denied: ${miss.join(', ')}`);
  return '13/13 FUB write tools denied';
});

check('T-07', 'settings.json denies Calendar / Drive / Gmail writes', () => {
  const d = json('.claude/settings.json').permissions.deny;
  const miss = OTHER_WRITE_TOOLS.filter(t => !d.includes(t));
  assert(miss.length === 0, `not denied: ${miss.join(', ')}`);
  return `${OTHER_WRITE_TOOLS.length}/${OTHER_WRITE_TOOLS.length} non-FUB write tools denied`;
});

check('T-08', 'settings.json denies scheduling / unattended execution (HOLD H-1)', () => {
  const d = json('.claude/settings.json').permissions.deny;
  const miss = SCHEDULING_TOOLS.filter(t => !d.includes(t));
  assert(miss.length === 0, `not denied: ${miss.join(', ')}`);
  return `${SCHEDULING_TOOLS.length} scheduling tools denied`;
});

check('T-09', 'settings.json allow and deny lists do not overlap', () => {
  const p = json('.claude/settings.json').permissions;
  const overlap = p.allow.filter(a => p.deny.includes(a));
  assert(overlap.length === 0, `overlap: ${overlap.join(', ')}`);
  return 'no contradictory permission entries';
});

check('T-10', 'no agent grants a write tool in its frontmatter', () => {
  const banned = [...FUB_WRITE_TOOLS, ...OTHER_WRITE_TOOLS, ...SCHEDULING_TOOLS];
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    const bad = tools.filter(t => banned.includes(t));
    assert(bad.length === 0, `agent "${a}" grants: ${bad.join(', ')}`);
  }
  return 'both agents are write-free';
});

check('T-11', 'every agent tool is explicitly allowed in settings.json', () => {
  const allow = json('.claude/settings.json').permissions.allow;
  const nonMcpOk = ['Skill'];
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    for (const t of tools) {
      if (nonMcpOk.includes(t)) continue;
      assert(allow.includes(t), `agent "${a}" tool "${t}" is not in the settings allow list`);
    }
  }
  return 'agent tool grants are a subset of the project allow list';
});

check('T-12', 'no agent is granted Gmail, Composio, Bash, Write, or Edit', () => {
  const forbiddenPrefix = ['mcp__Gmail', 'mcp__Composio'];
  const forbiddenExact = ['Bash', 'Write', 'Edit', 'NotebookEdit', 'Task', 'Agent'];
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    for (const t of tools) {
      assert(!forbiddenPrefix.some(p => t.startsWith(p)), `agent "${a}" grants "${t}"`);
      assert(!forbiddenExact.includes(t), `agent "${a}" grants "${t}"`);
    }
  }
  return 'no out-of-scope connectors or mutation tools granted';
});

// ---------------------------------------------------------------- agent guardrails

check('T-13', 'agents declare read-only action class and zero writes', () => {
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/read-only/i.test(md), `agent "${a}" does not declare read-only`);
    assert(/\bNONE\b/.test(md), `agent "${a}" does not declare NONE writes`);
  }
  return 'read-only + zero-write declared';
});

check('T-14', 'agents carry required refusal guardrails', () => {
  const guards = [
    { re: /schedul/i, name: 'scheduling' },
    { re: /H-1/, name: 'HOLD H-1 reference' },
    { re: /text, call, email|no connected tool sends|does not send|never.{0,20}send/i, name: 'communication' },
    { re: /unreachable|Chrome operator/i, name: 'unreachable-system routing' },
    { re: /Refuse/i, name: 'explicit refusal language' },
  ];
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    for (const g of guards) assert(g.re.test(md), `agent "${a}" missing guardrail: ${g.name}`);
  }
  return 'scheduling / communication / unreachable / refusal guardrails present in both agents';
});

check('T-15', 'agents reference all three shared skills', () => {
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    for (const s of SKILLS) assert(md.includes(s), `agent "${a}" does not reference skill "${s}"`);
  }
  return 'all agents wired to all three skills';
});

check('T-16', 'agents do NOT embed canonical prompt bodies', () => {
  // Sentinel phrases that appear only inside the canonical Drive prompt bodies.
  const sentinels = [
    'QUICK INVOCATION', 'END OF PROMPT', 'PRODUCTION QUALITY STANDARD',
    'DAILY OUTPUT', 'FINAL OUTPUT — FIVE-MINUTE CLIENT BRIEF', 'PREP METHOD',
    'AUTOMATION TARGET', 'OPERATING CONTROL',
  ];
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    for (const s of sentinels) assert(!md.includes(s), `agent "${a}" appears to embed canonical prompt text: "${s}"`);
    assert(/retriev/i.test(md) && /runtime|at runtime|canonical Drive prompt/i.test(md),
      `agent "${a}" does not instruct runtime retrieval of its canonical prompt`);
  }
  return 'no canonical prompt bodies copied into the repository';
});

check('T-17', 'Command Center enforces the task-completeness gate', () => {
  const md = read('.claude/agents/daily-revenue-command-center.md');
  for (const t of ['_completeness', 'returned_count', 'total_count', 'has_more', 'capped', 'fetch_all', 'due_timezone'])
    assert(md.includes(t), `missing completeness control: ${t}`);
  return 'PR #2 completeness controls present';
});

check('T-18', 'Client Prep enforces exact-target resolution and source minimization', () => {
  const md = read('.claude/agents/client-prep-brief.md');
  assert(/exactly one/i.test(md), 'missing exactly-one-contact rule');
  assert(/Never guess|never guess/.test(md), 'missing never-guess rule');
  assert(/[Ss]ource [Mm]inimi/.test(md), 'missing source-minimization rule');
  return 'wrong-target and source-overreach controls present';
});

// ---------------------------------------------------------------- skills + docs

check('T-19', 'all three skills exist with valid frontmatter', () => {
  for (const s of SKILLS) {
    const fm = frontmatter(read(`.claude/skills/${s}/SKILL.md`));
    assert(fm.name === s, `skill "${s}" frontmatter name mismatch: ${fm.name}`);
    assert(fm.description && fm.description.length > 40, `skill "${s}" description too thin`);
  }
  return '3/3 skills valid';
});

check('T-20', 'operator-execution-report defines all 18 required sections', () => {
  const md = read('.claude/skills/operator-execution-report/SKILL.md');
  const sections = ['OBJECTIVE', 'TARGET', 'GOVERNING SOURCES + VERSIONS', 'VERIFIED FACTS',
    'REPORTED INFORMATION', 'ASSUMPTIONS', 'MISSING INFORMATION', 'WORK COMPLETED',
    'TOOLS / RECORDS USED', 'WRITES ATTEMPTED', 'QC RESULT', 'SYSTEM UPDATE REQUIRED',
    'SYSTEM OF RECORD', 'NEXT ACTION', 'OWNER', 'TIMING', 'HANDOFF', 'ESCALATION / HOLD'];
  const miss = sections.filter(s => !md.includes(s));
  assert(miss.length === 0, `missing sections: ${miss.join(', ')}`);
  assert(/WRITES ATTEMPTED.*NONE|must read exactly `NONE`/s.test(md), 'missing zero-write invariant');
  return `${sections.length}/18 report sections defined`;
});

check('T-21', 'CLAUDE.md carries every required governance section', () => {
  const md = read('CLAUDE.md');
  const required = ['IDENTITY / AUTHORITY', 'AUTHORITY ORDER', 'SYSTEM OWNERSHIP',
    'SOURCE RETRIEVAL', 'PERMISSION MODEL', 'STANDING HOLD', 'HARD STOPS',
    'HONEST REPORTING', 'EFFICIENCY', 'CONTINUOUS IMPROVEMENT'];
  const miss = required.filter(s => !md.includes(s));
  assert(miss.length === 0, `missing: ${miss.join(', ')}`);
  assert(/[Uu]nattended.{0,40}HOLD|HOLD.{0,60}[Uu]nattended/s.test(md), 'missing unattended-execution HOLD');
  return `${required.length}/10 sections present`;
});

check('T-22', 'no canonical Drive business content is cached anywhere in the repo', () => {
  // Long verbatim markers from the canonical sources read during Phase 1/2.
  const sentinels = [
    'Blaise Style Stack', 'END OF PROMPT', 'EXECUTION CONTROL CARD',
    'TIER 0 – PUBLIC / LOW RISK', 'UNIVERSAL WORKFLOW CLOSEOUT',
  ];
  const skip = new Set(['.git', 'node_modules']);
  const hits = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(md|json|js)$/.test(e.name)) continue;
      if (p.endsWith(path.join('tests', 'run-static-tests.js'))) continue; // this file names them
      const body = fs.readFileSync(p, 'utf8');
      for (const s of sentinels) if (body.includes(s)) hits.push(`${path.relative(ROOT, p)} :: ${s}`);
    }
  })(ROOT);
  assert(hits.length === 0, `cached canonical content found:\n    ${hits.join('\n    ')}`);
  return 'no canonical business content cached in repo';
});

check('T-23', 'improvement findings log is well formed', () => {
  const md = read('governance/improvement-findings.md');
  for (const tier of ['MINOR MAINTENANCE', 'OPERATIONAL CHANGE', 'HIGH-STAKES CHANGE'])
    assert(md.includes(tier), `missing tier: ${tier}`);
  const ids = [...md.matchAll(/^### (IF-\d{4}-\d{2}-\d{2}-\d{3})/gm)].map(m => m[1]);
  assert(ids.length > 0, 'no findings recorded');
  assert(new Set(ids).size === ids.length, 'duplicate finding IDs');
  let open_ = 0, withdrawn = 0;
  for (const id of ids) {
    const body = md.split(`### ${id}`)[1].split('\n### ')[0];
    if (/STATUS: WITHDRAWN/i.test(body)) {
      // A withdrawn finding has no proposed change to make. It must instead show its
      // original claim, the correction, and a WITHDRAWN disposition, so the record of
      // the error survives rather than being deleted.
      for (const f of ['ORIGINAL CLAIM', 'CORRECTION', 'DISPOSITION'])
        assert(body.includes(f), `${id} is WITHDRAWN but missing required field: ${f}`);
      assert(/WITHDRAWN/.test(body.split('DISPOSITION')[1] || ''), `${id} disposition is not WITHDRAWN`);
      withdrawn++;
    } else {
      for (const f of ['TRIGGER', 'OBSERVED ISSUE', 'CLASSIFICATION', 'EXACT PROPOSED CHANGE', 'DISPOSITION'])
        assert(body.includes(f), `${id} missing required field: ${f}`);
      open_++;
    }
  }
  assert(md.includes('## 5. Findings closed'), 'missing closed-findings section');
  return `${ids.length} findings (${open_} actionable, ${withdrawn} withdrawn), all well formed`;
});

check('T-24', 'adversarial scenarios are specified and enumerated', () => {
  const md = read('tests/adversarial/scenarios.md');
  const ids = [...md.matchAll(/^### (A-\d+)/gm)].map(m => m[1]);
  assert(ids.length >= 10, `expected >=10 scenarios, found ${ids.length}`);
  assert(new Set(ids).size === ids.length, 'duplicate scenario IDs');
  return `${ids.length} adversarial scenarios specified`;
});

check('T-25', 'connector preflight manifest covers every agent and matches granted tools', () => {
  const m = json('governance/required-connectors.json');
  assert(m.connectors && m.agents, 'manifest missing connectors/agents');
  assert(m.certification_runs && Array.isArray(m.certification_runs.required),
    'manifest does not declare certification-run requirements');

  for (const a of AGENTS) {
    const entry = m.agents[a];
    assert(entry, `agent "${a}" is not covered by the connector manifest`);
    assert(Array.isArray(entry.required) && entry.required.length > 0, `agent "${a}" declares no required connectors`);

    // Every declared connector must exist in the connector table.
    for (const c of entry.required) assert(m.connectors[c], `agent "${a}" requires unknown connector "${c}"`);

    // Every MCP tool the agent is granted must belong to a connector it declares.
    const declaredPrefixes = entry.required.map(c => m.connectors[c].tool_prefix);
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    for (const t of tools) {
      if (!t.startsWith('mcp__')) continue;
      assert(declaredPrefixes.some(p => t.startsWith(p)),
        `agent "${a}" grants "${t}" from a connector it does not declare`);
    }

    // The agent must actually carry the Step 0 preflight instruction.
    const md = read(`.claude/agents/${a}.md`);
    assert(/Step 0 — Connector preflight/.test(md), `agent "${a}" has no Step 0 connector preflight`);
    assert(/HOLD immediately/i.test(md), `agent "${a}" preflight does not require immediate HOLD`);
  }
  return `${AGENTS.length} agents covered; granted tools within declared connectors; preflight present`;
});

// ---------------------------------------------------------------- output

const width = 62;
console.log('\nBlaise Real Estate OS - Execution Layer Static Test Suite');
console.log('='.repeat(width));
for (const r of results) {
  const mark = r.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${r.id}  ${r.name}`);
  if (r.detail) console.log(`         ${r.detail.replace(/\n/g, '\n         ')}`);
}
console.log('='.repeat(width));
console.log(`${results.length - failed}/${results.length} passed, ${failed} failed`);
console.log('\nNOTE: behavioral adversarial scenarios require a live agent invocation');
console.log('and are NOT covered by this suite. See tests/adversarial/scenarios.md.\n');
process.exit(failed === 0 ? 0 : 1);
