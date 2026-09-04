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

// Canonical FUB internal-maintenance tools. Only the CRM service may hold these.
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

check('T-04', 'registry declares live-Drive-wins and retired-source rejection', () => {
  const raw = read('governance/source-registry.json');
  assert(/LIVE DRIVE DOCUMENT WINS/i.test(raw), 'missing live-wins rule');
  for (const marker of ['RETIRED', 'LEGACY', 'ARCHIVED'])
    assert(raw.includes(marker), `missing ${marker} rejection rule`);
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

check('T-06', 'settings.json allows all 13 FUB maintenance tools', () => {
  const p = json('.claude/settings.json').permissions;
  const missing = FUB_WRITE_TOOLS.filter(t => !p.allow.includes(t));
  const denied = FUB_WRITE_TOOLS.filter(t => p.deny.includes(t));
  assert(missing.length === 0, `not allowed: ${missing.join(', ')}`);
  assert(denied.length === 0, `still denied: ${denied.join(', ')}`);
  return '13/13 FUB maintenance tools allowed';
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

check('T-10', 'only the CRM service holds FUB maintenance tools', () => {
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    const fubWrites = tools.filter(t => FUB_WRITE_TOOLS.includes(t));
    if (a === 'lead-conversion-crm') {
      const missing = FUB_WRITE_TOOLS.filter(t => !tools.includes(t));
      assert(missing.length === 0, `CRM service is missing: ${missing.join(', ')}`);
    } else {
      assert(fubWrites.length === 0, `agent "${a}" grants FUB writes: ${fubWrites.join(', ')}`);
    }
    const forbidden = tools.filter(t => OTHER_WRITE_TOOLS.includes(t) || SCHEDULING_TOOLS.includes(t));
    assert(forbidden.length === 0, `agent "${a}" grants out-of-scope writes: ${forbidden.join(', ')}`);
  }
  return 'all 13 FUB writes belong to lead-conversion-crm; no parallel write service';
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
    assert(/read-only|No writes|zero writes|NOT granted|write authority|internal update|maintenance/i.test(md),
      `agent "${a}" does not state its write posture`);
  }
  for (const a of PHASE2) {
    const md = read(`.claude/agents/${a}.md`);
    assert(/\bNONE\b/.test(md), `Phase 2 agent "${a}" does not declare NONE writes`);
  }
  const crm = read('.claude/agents/lead-conversion-crm.md');
  assert(/maintains Blaise's individual FUB records autonomously/i.test(crm),
    'CRM service does not declare active internal-maintenance authority');
  return `${AGENTS.length} agents declare write posture; CRM maintenance active; ${PHASE2.length} read agents declare NONE`;
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

check('T-28', 'FUB write authority is structurally isolated to the CRM service', () => {
  for (const a of AGENTS) {
    const tools = frontmatter(read(`.claude/agents/${a}.md`)).tools.split(',').map(t => t.trim());
    const granted = tools.filter(t => FUB_WRITE_TOOLS.includes(t));
    if (a === 'lead-conversion-crm') {
      assert(granted.length === FUB_WRITE_TOOLS.length, `CRM service holds ${granted.length}/13 FUB writes`);
    } else {
      assert(granted.length === 0, `agent "${a}" grants FUB write tool(s): ${granted.join(', ')}`);
    }
  }
  const crm = read('.claude/agents/lead-conversion-crm.md');
  assert(/AI maintains Blaise's individual FUB records autonomously/i.test(crm),
    'CRM service does not state active maintenance authority');
  assert(/Sending anything/i.test(crm), 'CRM service does not preserve the external-send boundary');
  for (const a of AGENTS.filter(x => x !== 'lead-conversion-crm')) {
    const md = read(`.claude/agents/${a}.md`);
    assert(!/create_contact_note|close_out_contact_interaction/.test(md),
      `non-CRM agent "${a}" names a certified write class`);
  }
  return 'all 13 internal writes isolated to lead-conversion-crm; external-send boundary preserved';
});

check('T-29', 'pre-cutover governance patch queue is explicitly historical', () => {
  const md = read('docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md');
  const ids = [...md.matchAll(/^## (CGQ-\d{3})/gm)].map(m => m[1]);
  assert(ids.length > 0, 'no patches queued');
  assert(new Set(ids).size === ids.length, 'duplicate CGQ id');
  for (const id of ids) {
    const body = md.split(`## ${id}`)[1].split('\n## ')[0];
    for (const f of ['TARGET', 'EXACT PATCH'])
      assert(body.includes(f), `${id} missing required field: ${f}`);
  }
  assert(/HISTORICAL/.test(md) && /SUPERSEDED/.test(md) && /DO NOT EXECUTE/.test(md),
    'historical queue is not clearly superseded');
  return `${ids.length} historical patches retained as evidence; queue is non-executable`;
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

check('T-31', 'active source registry contains the consolidated cutover set, not retired locators', () => {
  const r = json('governance/source-registry.json');
  const ids = new Set(r.sources.map(s => s.file_id));
  const required = [
    '1YxG991_SXW8QTQvK_G1tOsd6il1mWzqdmVcnLwFFcX8',
    '1UU8eQOElu388w2FA2gPJCMOKP7_EvQRNoPUthxc1_wg',
    '1pFUdBNfbPLBYSkyKj0_25wC6RuP6VKO1WnkOZ1EudJw',
    '1QQlyz8YIosmqquO18cTOpZwaskpg7tH8rgDp_ZqoRDA',
    '1Cr3SxGD00XFpck_f15oJL_wJPwWdE53W9kFiA0mdtO8',
  ];
  const retired = [
    '1HyBu_OcwTm8-_Aqh0hDcfIFGoor399gR8NHUMRJKAVc',
    '1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU',
    '12Pg3pAXpPWfEf6_U6rFYrOM7WQSDVkM90CwJjujqiLE',
  ];
  for (const id of required) assert(ids.has(id), `missing active cutover locator ${id}`);
  for (const id of retired) assert(!ids.has(id), `retired locator remains active: ${id}`);
  assert(r.cutover && r.cutover.completed === '2026-09-03', 'cutover metadata missing');
  return 'active BOM, Source Map, AI Runbook, control record, and registry sheet present; retired roots absent';
});

check('T-32', 'runtime bootstrap enables manual reads and bounded internal writes', () => {
  const b = json('runtime/bootstrap.json');
  assert(b.status === 'READ_WRITE_RUNTIME_READY_FOR_LIVE_ATTACHMENT', 'runtime status is stale or overclaims live operation');
  assert(b.mode === 'READ_AND_INTERNAL_WRITE', 'runtime mode does not include read and internal write');
  assert(b.trigger_policy === 'MANUAL_ONLY', 'runtime trigger is not manual-only');
  assert(b.persistence === 'NONE', 'runtime unexpectedly declares persistence');
  assert(Array.isArray(b.live_adapters) && b.live_adapters.length === 0, 'runtime claims a live adapter');
  assert(b.effect_budget.external_writes === 2, 'combined note/task write budget must equal 2');
  assert(b.effect_budget.schedules_created === 1, 'appointment-record budget must equal 1');
  assert(b.effect_budget.external_messages === 0 && b.effect_budget.money_moved === 0,
    'external sends and money must remain outside internal-write authority');
  return 'manual reads + internal writes ready; messages/money remain zero; live smoke pending';
});

check('T-33', 'runtime implementation exposes the required foundation components', () => {
  const files = ['contract.js', 'registries.js', 'operations-bus.js', 'presentation.js', 'cli.js'];
  for (const file of files) assert(fs.existsSync(path.join(ROOT, 'runtime', file)), `missing runtime/${file}`);
  const bus = read('runtime/operations-bus.js');
  for (const state of ['READY', 'EXECUTING', 'COMPLETED', 'FAILED/EXCEPTION'])
    assert(bus.includes(state), `Operations Bus missing state ${state}`);
  return `${files.length} runtime components present with explicit state transitions`;
});

check('T-34', 'runtime registries reject credential and direct-PII fields', () => {
  const registry = read('runtime/registries.js');
  const contract = read('runtime/contract.js');
  assert(/PII_IN_REGISTRY/.test(registry), 'no registry PII rejection');
  assert(/CREDENTIAL_MATERIAL_REJECTED/.test(contract), 'no credential rejection');
  return 'registry PII and credential rejection paths present';
});

check('T-35', 'runtime test suite is wired into the package test gate', () => {
  const p = json('package.json');
  assert(/run-static-tests/.test(p.scripts.test), 'package test omits static suite');
  assert(/tests\/runtime/.test(p.scripts.test), 'package test omits runtime suite');
  return 'static and runtime suites share one test gate';
});

check('T-36', 'repository contains no non-placeholder email or phone data', () => {
  const skip = new Set(['.git', 'node_modules']);
  const hits = [];
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phone = /(?:\+?1[-. ]?)?\(?[2-9][0-9]{2}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}/g;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(md|json|js)$/.test(e.name)) continue;
      if (p.endsWith(path.join('tests', 'run-static-tests.js'))) continue;
      const body = fs.readFileSync(p, 'utf8');
      for (const match of body.matchAll(email)) {
        if (!match[0].toLowerCase().endsWith('@example.invalid'))
          hits.push(`${path.relative(ROOT, p)} :: non-placeholder email`);
      }
      for (const match of body.matchAll(phone)) {
        const digits = match[0].replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
        if (!/^55501\d{5}$/.test(digits))
          hits.push(`${path.relative(ROOT, p)} :: non-placeholder phone`);
      }
    }
  })(ROOT);
  assert(hits.length === 0, `possible live contact data found:\n    ${hits.join('\n    ')}`);
  return 'all repository email and phone examples use reserved placeholders';
});

check('T-37', 'FUB read and write adapters enforce their separate effect boundaries', () => {
  const adapter = read('runtime/adapters/fub-read.js');
  const writeAdapter = read('runtime/adapters/fub-write.js');
  const bootstrap = json('runtime/bootstrap.json');
  const p = json('package.json');
  for (const operation of ['GET_CONTACT', 'GET_CONTACT_EVENTS', 'GET_CONTACT_NOTES',
    'GET_CONTACT_APPOINTMENTS', 'SEARCH_TASKS', 'GET_OPEN_TASKS']) {
    assert(adapter.includes(operation), `FUB adapter missing pilot operation ${operation}`);
  }
  assert(/PILOT_OPERATIONS/.test(adapter), 'FUB adapter has no bounded pilot surface');
  assert(/WRITE_TOOL_SUFFIXES/.test(adapter) && /FUB_WRITE_TOOL_REJECTED/.test(adapter),
    'FUB adapter has no structural write-tool rejection');
  assert(/America\/Chicago/.test(adapter) && /INCOMPLETE_RETRIEVAL/.test(adapter),
    'FUB adapter lacks timezone/completeness controls');
  assert(bootstrap.live_adapters.length === 0, 'synthetic adapter is incorrectly declared live');
  assert(bootstrap.staged_adapters.length === 2 &&
    bootstrap.staged_adapters.every(item => item.status === 'RUNTIME_READY_LIVE_SMOKE_PENDING'),
    'both adapters must be ready with practical live smoke pending');
  for (const operation of ['CREATE_CONTACT_NOTE', 'UPDATE_CONTACT_PROFILE',
    'CREATE_CONTACT_APPOINTMENT', 'UPDATE_CONTACT_DEAL', 'CLOSE_OUT_CONTACT_INTERACTION']) {
    assert(writeAdapter.includes(operation), `FUB write adapter missing ${operation}`);
  }
  assert(/execute = true/.test(writeAdapter), 'write adapter does not force execution');
  assert(/external_communication_disabled/.test(writeAdapter), 'write adapter does not preserve send boundary');
  assert(/assertEffectsWithinBudget/.test(writeAdapter), 'write adapter does not enforce effect budgets');
  assert(/runtime\/cli\.js certify:fub-read --synthetic/.test(p.scripts['certify:fub-read:synthetic']),
    'synthetic FUB certification command is not wired');
  return 'six-tool read lane and all-13 write lane ready; exact boundaries enforced';
});

check('T-38', 'automation target preserves depth and the human relationship boundary', () => {
  const md = read('docs/AUTOMATION-ACTIVATION-PLAN.md');
  for (const capability of ['Daily Desk / Command Center', 'Lead Conversion & FUB Desk',
    'Marketing & Relationship Engine', 'Client Deliverables', 'Event-driven orchestration',
    'Continuous improvement']) {
    assert(md.includes(capability), `automation plan missing ${capability}`);
  }
  assert(/not a permanently read-only assistant/i.test(md), 'automation plan mistakes the gate for the target');
  assert(/SEND \/ SUBMIT \/ PUBLISH \/ SIGN \/ SPEND/i.test(md),
    'automation plan does not preserve Blaise external-action review boundary');
  assert(/No parallel CRM, task list,\ncalendar, or SOP library/.test(md),
    'automation plan permits a parallel operating system');
  return 'full operating-partner target is explicit; internal maintenance active; external review preserved';
});

check('T-39', 'project Codex config enables separate read and full FUB operators', () => {
  const config = read('.codex/config.toml');
  assert(/mcp_optional_startup_grace_ms\s*=\s*0/.test(config),
    'Codex config does not wait through optional-server cold starts');
  assert(/\[mcp_servers\.blaise_fub_read_only\][\s\S]*?enabled\s*=\s*true/.test(config),
    'read-only FUB MCP is not enabled');
  assert(/\[mcp_servers\.blaise_fub_full\][\s\S]*?enabled\s*=\s*true/.test(config),
    'full FUB operator is not enabled');
  const readSection = config.match(
    /\[mcp_servers\.blaise_fub_read_only\]([\s\S]*?)\[mcp_servers\.blaise_fub_full\]/,
  );
  assert(readSection, 'bounded read-only FUB config section is missing');
  for (const tool of ['get_contact', 'get_contact_events', 'get_contact_notes',
    'get_contact_appointments', 'search_tasks', 'get_open_tasks']) {
    assert(readSection[1].includes(`"${tool}"`), `read-only FUB config missing ${tool}`);
  }
  for (const writeTool of ['create_contact_note', 'create_contact_task', 'update_contact_task',
    'update_contact_profile', 'merge_contact_tags']) {
    assert(!readSection[1].includes(writeTool), `read-only FUB config exposes ${writeTool}`);
  }
  const fullSection = config.match(/\[mcp_servers\.blaise_fub_full\]([\s\S]*)$/);
  assert(fullSection, 'full FUB config section is missing');
  for (const fullName of FUB_WRITE_TOOLS.map(t => t.split('__').pop())) {
    assert(fullSection[1].includes(`"${fullName}"`), `full FUB config missing ${fullName}`);
  }
  assert(/default_tools_approval_mode\s*=\s*"auto"/.test(fullSection[1]),
    'full FUB internal maintenance is not configured for standing auto approval');
  return 'cold-start wait enabled; six-tool read lane and all-13 write lane enabled';
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
