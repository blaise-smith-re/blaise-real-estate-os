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

// All departments. Universal invariants apply to every one of these.
const AGENTS = ['daily-revenue-command-center', 'client-prep-brief', 'lead-conversion-crm',
  'buyer-investor-ops', 'seller-listing-ops', 'market-intel-marketing',
  'transaction-closing-ops', 'chief-of-staff'];
// Phase 2 read-only engines with their own agent-specific controls.
const PHASE2 = ['daily-revenue-command-center', 'client-prep-brief'];
// Agents whose work is date/appointment sensitive and must anchor to America/Chicago.
const DATE_SENSITIVE = ['daily-revenue-command-center', 'client-prep-brief', 'lead-conversion-crm',
  'buyer-investor-ops', 'seller-listing-ops', 'transaction-closing-ops'];
const SKILLS = ['retrieve-canonical-source', 'chicago-date-anchor', 'operator-execution-report',
  'connector-preflight', 'fub-controlled-write', 'chrome-operator-handoff'];
// Every agent must wire these three.
const UNIVERSAL_SKILLS = ['connector-preflight', 'retrieve-canonical-source', 'operator-execution-report'];

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

check('T-13', 'every agent declares an explicit write posture', () => {
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/read-only|No writes|zero writes|NOT granted|write authority/i.test(md),
      `agent "${a}" does not state its write posture`);
  }
  for (const a of PHASE2) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/\bNONE\b/.test(md), `Phase 2 agent "${a}" does not declare NONE writes`);
  }
  return `${AGENTS.length} agents declare write posture; ${PHASE2.length} Phase 2 agents declare NONE`;
});

check('T-14', 'agents carry required boundary guardrails', () => {
  // Universal: every department states an escalation boundary and a routing boundary.
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/Escalate|escalat/i.test(md), `agent "${a}" has no escalation section`);
    assert(/boundar|Out of scope|do not|never/i.test(md), `agent "${a}" states no boundaries`);
  }
  // Phase 2 engines keep their full refusal table.
  const p2 = [
    { re: /schedul/i, name: 'scheduling' },
    { re: /H-1/, name: 'HOLD H-1 reference' },
    { re: /no connected tool sends|does not send|never.{0,20}send|text, call, email/i, name: 'communication' },
    { re: /unreachable|Chrome operator/i, name: 'unreachable-system routing' },
    { re: /Refuse/i, name: 'explicit refusal language' },
  ];
  for (const a of PHASE2) {
    const md = read(`.claude/agents/${a}.md`);
    for (const g of p2) assert(g.re.test(md), `agent "${a}" missing guardrail: ${g.name}`);
  }
  return `${AGENTS.length} agents carry boundary + escalation; Phase 2 refusal tables intact`;
});

check('T-15', 'agents are wired to the universal skills', () => {
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    for (const s of UNIVERSAL_SKILLS) assert(md.includes(s), `agent "${a}" does not reference "${s}"`);
  }
  for (const a of DATE_SENSITIVE) {
    const md = read(`.claude/agents/${a}.md`);
    assert(md.includes('chicago-date-anchor'), `date-sensitive agent "${a}" not wired to chicago-date-anchor`);
  }
  return `${AGENTS.length} agents wired to universal skills; ${DATE_SENSITIVE.length} to date anchor`;
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
    // Runtime-retrieval language is required of agents that HAVE a canonical prompt.
    // Every agent must still resolve its controlling sources by fileId at runtime.
    assert(/retriev/i.test(md), `agent "${a}" gives no retrieval instruction`);
    if (PHASE2.includes(a)) {
      assert(/runtime|at runtime|canonical Drive prompt/i.test(md),
        `agent "${a}" does not instruct runtime retrieval of its canonical prompt`);
    }
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
  return `${SKILLS.length}/${SKILLS.length} skills valid`;
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
    const declared = [...(entry.required || []), ...(entry.optional || [])];
    for (const c of declared) assert(m.connectors[c], `agent "${a}" declares unknown connector "${c}"`);

    // Every MCP tool the agent is granted must belong to a connector it declares
    // as either required or optional. An optional lane still needs a grant to be usable.
    const declaredPrefixes = declared.map(c => m.connectors[c].tool_prefix);
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

check('T-26', 'department charters cover every agent', () => {
  const md = read('governance/department-charters.md');
  for (const a of AGENTS) assert(md.includes(a), `charter document does not cover agent "${a}"`);
  for (const inv of ['One department writes to FUB', 'parallel CRM'])
    assert(md.includes(inv), `charters missing invariant: ${inv}`);
  return `${AGENTS.length} agents chartered; no-parallel-system invariants present`;
});

check('T-27', 'chief-of-staff routes only to agents that exist', () => {
  const md = read('.claude/agents/chief-of-staff.md');
  const routed = [...md.matchAll(/`([a-z][a-z0-9-]{6,})`/g)].map(m => m[1])
    .filter(n => n.includes('-') && !SKILLS.includes(n) && !n.startsWith('governance'));
  const known = new Set([...AGENTS, ...SKILLS]);
  const unknown = routed.filter(n => !known.has(n) && /ops|crm|brief|center|staff|marketing/.test(n));
  assert(unknown.length === 0, `routes to non-existent agent(s): ${[...new Set(unknown)].join(', ')}`);
  // Must route to at least the six departments it orchestrates.
  for (const d of ['lead-conversion-crm', 'buyer-investor-ops', 'seller-listing-ops',
                   'market-intel-marketing', 'transaction-closing-ops', 'daily-revenue-command-center'])
    assert(md.includes(d), `chief-of-staff does not route to "${d}"`);
  return 'all routing targets resolve to real agents';
});

check('T-28', 'FUB write authority is contained to one department and gated', () => {
  // No agent may hold a write tool - the gate is structural, not editorial.
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    const bad = tools.filter(t => FUB_WRITE_TOOLS.includes(t));
    assert(bad.length === 0, `agent "${a}" grants FUB write tool(s): ${bad.join(', ')}`);
  }
  // Only the CRM department may describe itself as the write path.
  const crm = read('.claude/agents/lead-conversion-crm.md');
  assert(/create_contact_note/.test(crm), 'CRM agent does not name the certified write classes');
  assert(/NOT granted|not granted/i.test(crm), 'CRM agent does not state the authority gate');
  assert(/CGQ-001/.test(crm), 'CRM agent does not reference the blocking patch CGQ-001');
  for (const a of AGENTS.filter(x => x !== 'lead-conversion-crm')) {
    const md = read(`.claude/agents/${a}.md`);
    assert(!/create_contact_note|close_out_contact_interaction/.test(md),
      `non-CRM agent "${a}" names a certified write class`);
  }
  return 'zero write tools granted; write path named only by lead-conversion-crm; gate cited';
});

check('T-29', 'canonical governance patch queue is well formed', () => {
  const md = read('docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md');
  const ids = [...md.matchAll(/^## (CGQ-\d{3})/gm)].map(m => m[1]);
  assert(ids.length > 0, 'no patches queued');
  assert(new Set(ids).size === ids.length, 'duplicate CGQ id');
  for (const id of ids) {
    const body = md.split(`## ${id}`)[1].split('\n## ')[0];
    for (const f of ['TARGET', 'EXACT PATCH'])
      assert(body.includes(f), `${id} missing required field: ${f}`);
  }
  assert(/CGQ-001/.test(md) && /BLOCKING/.test(md), 'blocking status not recorded');
  return `${ids.length} patches queued, all with target and exact patch`;
});

check('T-30', 'handoff integrity: every non-CRM department routes FUB writes to the CRM service', () => {
  for (const a of AGENTS.filter(x => x !== 'lead-conversion-crm' && x !== 'chief-of-staff')) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/lead-conversion-crm|ChatGPT 02|Lead Conversion/.test(md),
      `agent "${a}" does not route CRM work to the CRM service`);
  }
  // Every mention of a parallel system must sit in a prohibitive context.
  // The invariant is "no parallel CRM/task list/calendar/database" - an agent may only
  // ever forbid one, never propose one.
  for (const a of AGENTS) {
    const md = read(`.claude/agents/${a}.md`);
    // Only parallel *systems* matter here - "delegate in parallel" is correct behavior.
    for (const m of md.matchAll(/parallel (CRM|task list|calendar|transaction|database|prospect|document|SOP)/gi)) {
      const before = md.slice(Math.max(0, m.index - 120), m.index);
      assert(/\b(no|not|never|avoid|without)\b/i.test(before),
        `agent "${a}" mentions a parallel system outside a prohibitive context`);
    }
  }
  return 'CRM write routing present in every specialist department; parallel systems only ever forbidden';
});

check('T-31', 'buyer snapshot: schema requires a provenance mark on every fact', () => {
  const raw = read('assets/buyer-property-snapshot/snapshot-schema.json');
  const j = JSON.parse(raw);
  const marks = j.provenance_marks;
  for (const m of ['MLS', 'PUB', 'REP', 'CALC', 'VER', 'OBS', 'BUYER', 'AGENT_ONLY']) {
    assert(marks[m], `provenance mark "${m}" not defined`);
  }
  assert(/never a bare scalar/i.test(j.field_shape.note),
    'field_shape does not forbid bare scalar facts');
  assert(j.render_rules.mark_AGENT_ONLY && /fail closed/i.test(j.render_rules.mark_AGENT_ONLY),
    'AGENT_ONLY render rule does not fail closed');
  assert(/OMITTED/.test(j.render_rules.null_value) && !/N\/A/.test(j.render_rules.null_value.replace('N/A.', '')),
    'null values are not specified as omitted');
  return `${Object.keys(marks).length} marks defined; agent-only fails closed`;
});

check('T-32', 'buyer snapshot: conditional modes remove sections rather than emptying them', () => {
  const j = JSON.parse(read('assets/buyer-property-snapshot/snapshot-schema.json'));
  const o = j.object.properties[0];
  assert(/OMITTED ENTIRELY when property_type = LAND/.test(o.facts_residential.note),
    'land mode does not drop residential facts');
  assert(/OMITTED when fee\.value is null/.test(o.association.note),
    'association module does not drop when no fee');
  assert(/OMITTED when buy_box_on_file is false/.test(o.investment.note),
    'investment module does not drop without a buy box');
  assert(/REQUIRES a populated assumptions/.test(o.investment.note),
    'calculated investor metrics do not require printed assumptions');
  assert(/NEVER fabricate a comp/i.test(o.market.note), 'comp fabrication not prohibited');
  const spec = read('assets/buyer-property-snapshot/SNAPSHOT-SPEC.md');
  for (const cond of ['LAND', 'association.fee', 'buy_box_on_file', 'comps[]', 'priorities[]']) {
    assert(spec.includes(cond), `spec does not document conditional "${cond}"`);
  }
  return 'land, HOA, investor, comps and priorities all documented as removals';
});

check('T-33', 'buyer snapshot: MLS facts route through the Chrome operator, never a connector', () => {
  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  assert(/no browser lane|not reachable from this repository/i.test(skill),
    'skill does not state that MLS is unreachable here');
  assert(/chrome-operator-handoff/.test(skill), 'skill does not use the Chrome operator handoff');
  const conn = JSON.parse(read('governance/required-connectors.json'));
  const entry = conn.agents['buyer-property-snapshot'];
  assert(entry, 'no connector manifest entry for buyer-property-snapshot');
  assert(!entry.required.some(c => /MLS|Matrix|Northstar/i.test(c)),
    'MLS declared as a connector lane');
  assert(/Chrome-operator handoff/i.test(entry.note), 'connector note does not name the handoff lane');
  const handoff = read('docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md');
  assert(/SOP 02 §18/.test(handoff), 'handoff does not cite the canonical operator prompt');
  assert(/Do not compose a different prompt/i.test(handoff),
    'handoff permits composing a competing operator prompt');
  return 'MLS is a handoff lane; operator prompt deferred to SOP 02 §18';
});

check('T-34', 'buyer snapshot: no promotion of listing-reported facts to verified', () => {
  const handoff = read('docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md');
  assert(/No promotion/i.test(handoff), 'ingestion rules do not forbid class promotion');
  assert(/is not "roof replaced in 2024"|not "roof replaced/i.test(handoff),
    'the concrete promotion example is missing');
  assert(/AVAILABLE — NOT REVIEWED. is not .REVIEWED|NOT REVIEWED/i.test(handoff),
    'disclosure review status rule missing');
  assert(/COMP SET WEAK/.test(handoff), 'weak comp set handling missing');
  return 'promotion, disclosure status and weak-comp rules all present';
});

check('T-35', 'buyer snapshot: canonical master is improved, never overwritten or competed with', () => {
  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  assert(/[Nn]ever overwrite/.test(skill), 'skill does not forbid overwriting the master');
  assert(/18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU/.test(skill),
    'skill does not pin the canonical master by fileId');
  const reg = JSON.parse(read('governance/source-registry.json'));
  const keys = reg.sources.map(s => s.key);
  for (const k of ['sop_02_buyer_search_showing_value', 'master_buyer_tour_value_guide',
                   'brand_rules_canva_master', 'brand_headshot_primary']) {
    assert(keys.includes(k), `registry missing source "${k}"`);
  }
  const head = reg.sources.find(s => s.key === 'brand_headshot_primary');
  assert(/never by newest-file-in-folder/i.test(head.verify),
    'headshot is not protected against newest-file resolution');
  const pq = read('docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md');
  for (const id of ['CGQ-013', 'CGQ-014', 'CGQ-015']) {
    assert(pq.includes(id), `patch queue missing ${id}`);
  }
  return 'master pinned and protected; v2.0 adoption routed through CGQ-013';
});

check('T-36', 'buyer snapshot: page budget and QC gate match SOP 02 §15/§20', () => {
  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  const spec = read('assets/buyer-property-snapshot/SNAPSHOT-SPEC.md');
  assert(/3 to 5 pages|3–5 pages/.test(skill + spec), 'page budget not stated');
  assert(/75 words/.test(skill) && /75 words/.test(spec), 'paragraph limit not carried');
  assert(/strongest 3.5 comps/i.test(skill), 'strongest-comps-only rule missing from the skill');
  assert(/Not Native Matrix Export/.test(skill), 'native-export labeling rule missing');
  assert(/hand this exact PDF to a serious buyer/i.test(skill), 'completion test missing');
  return 'page budget, prose limits, comp limit, export labeling and completion test all enforced';
});

check('T-37', 'buyer snapshot: zero writes, and buyer priorities are never invented', () => {
  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  assert(/zero writes|never writes to FUB/i.test(skill), 'skill does not declare zero writes');
  assert(/WRITES ATTEMPTED: NONE/.test(skill), 'skill does not close with the zero-write invariant');
  assert(/lead-conversion-crm/.test(skill), 'FUB writes not routed to the CRM service');
  assert(/[Nn]ever infer a priority|Never invented|never invented/.test(skill),
    'skill does not forbid inventing buyer priorities');
  const j = JSON.parse(read('assets/buyer-property-snapshot/snapshot-schema.json'));
  assert(/Never inferred, never invented/.test(j.provenance_marks.BUYER),
    'BUYER mark does not forbid inference');
  assert(/renders as .Tell me today./i.test(j.object.buyer.note),
    'empty priorities do not render honestly');
  return 'zero writes declared; priorities never inferred';
});

check('T-38', 'v1.13: image handoff is an asset transfer, and photo numbers are never COMPLETE', () => {
  const j = JSON.parse(read('assets/buyer-property-snapshot/snapshot-schema.json'));
  const img = j.object.properties[0].images;
  assert(img, 'schema has no images block');
  assert(/COMPLETE \| PARTIAL \| BLOCKED/.test(img.handoff_status), 'handoff_status states are not modeled');
  assert(/MUST NOT be recorded as COMPLETE/i.test(img.note),
    'schema does not forbid recording photo-number-only handoff as COMPLETE');
  assert(/An asset with no `data` is a reference, not an image/i.test(img.note),
    'schema does not distinguish an asset from a reference');
  assert(j.provenance_marks.MANUAL, 'MANUAL provenance mark for operator-supplied images is missing');
  assert(/photo NUMBER is not an image/i.test(j.render_rules.images),
    'render rule does not reject photo numbers as images');
  assert(/frame is omitted/i.test(j.render_rules.images), 'empty hero frame is not prohibited');

  const handoff = read('docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md');
  assert(/IMAGE HANDOFF/.test(handoff), 'handoff doc missing the IMAGE HANDOFF block');
  assert(/never `COMPLETE`|never .COMPLETE./.test(handoff), 'handoff doc allows a false COMPLETE');
  assert(/manual_retrieval_step|manual retrieval step/i.test(handoff), 'BLOCKED fallback step not required');
  assert(/first-class path/i.test(handoff), 'manual supply is not established as a supported path');

  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  assert(/v1\.13/.test(skill), 'skill does not pin v1.13');
  assert(/Photo numbers, filenames or\s*\n?\s*descriptions alone are `PARTIAL` or `BLOCKED`/.test(skill),
    'skill does not state the fallback classification');
  assert(/never called COMPLETE|not called COMPLETE/i.test(skill), 'QC gate lacks the image-handoff honesty check');
  return 'assets vs references separated; COMPLETE cannot be claimed from photo numbers';
});

check('T-39', 'v1.13 is the controlling pin and no stale version survives', () => {
  const reg = JSON.parse(read('governance/source-registry.json'));
  const sop = reg.sources.find(s => s.key === 'sop_02_buyer_search_showing_value');
  assert(sop.version_pin === '1.13', `registry pins SOP 02 at ${sop.version_pin}, expected 1.13`);
  assert(/ACTUAL PHOTO HANDOFF|IMAGE HANDOFF/.test(sop.verify), 'registry verify note omits the v1.13 change');
  for (const f of ['assets/buyer-property-snapshot/SNAPSHOT-SPEC.md',
                   'docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md',
                   '.claude/skills/buyer-property-snapshot/SKILL.md']) {
    assert(!/SOP 02 v1\.12/.test(read(f)), `${f} still cites SOP 02 v1.12 as controlling`);
  }
  return 'SOP 02 pinned at v1.13 across registry, spec, handoff and skill';
});

check('T-40', 'client render cannot leak agent-only content or unsupported facts', () => {
  const j = JSON.parse(read('assets/buyer-property-snapshot/snapshot-schema.json'));
  assert(/MUST NOT RENDER/.test(j.provenance_marks.AGENT_ONLY), 'AGENT_ONLY is not render-blocked');
  assert(/fail closed/i.test(j.render_rules.mark_AGENT_ONLY), 'AGENT_ONLY does not fail closed');
  assert(/[Nn]ever (phrased )?as a defect/.test(j.render_rules.mark_VER),
    'unverified items are not protected from reading as defects');
  const handoff = read('docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md');
  assert(/No promotion/.test(handoff), 'class promotion is not forbidden');
  assert(/Agent-only fails closed/i.test(handoff), 'agent-only ingestion does not fail closed');
  const skill = read('.claude/skills/buyer-property-snapshot/SKILL.md');
  assert(/hard-blocked from every client render|hard-blocked/i.test(skill),
    'skill does not hard-block agent-only content');
  return 'agent-only blocked at schema, ingestion and skill; no promotion path exists';
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
