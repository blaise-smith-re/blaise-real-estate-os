# Changelog

Repo-native engineering changes. Business policy, authority and certification gates are owned by
Google Drive and ChatGPT / 04 — changes to those are **never** recorded here as done, only proposed as
Improvement Findings.

---

## [FUB Read + Internal Write Activation] — 2026-09-04

- Enabled both deployed FUB MCP services in project Codex configuration: six-tool least-privilege
  read lane plus the full 25-read / 13-write operator.
- Added `FubWriteAdapter` covering every bounded FUB maintenance operation with exact-contact
  binding, forced execution, effect budgets, duplicate no-op accounting, partial-write reporting,
  and appointment invitations disabled.
- Extended `os.execution.v1` and the Operations Bus for `INTERNAL_WRITE/WRITE_INTERNAL` while keeping
  external messages and money movement at zero.
- Granted all 13 FUB maintenance tools only to `lead-conversion-crm`; removed the obsolete 17-step
  approval packet and repo-level FUB write denials.
- Updated active runtime, department, tool-policy, activation, and decision records. The earlier
  read-only attachment step below is retained only as changelog history and is superseded here.

---

## [Codex MCP Attachment Patch] — 2026-09-04

- Added trusted-project Codex configuration for the deployed read-only and full FUB MCP services.
- Enabled only the six-operation read pilot; kept the full operator disabled for the next effect class.
- Extended optional MCP startup waiting to cover Render cold starts that previously omitted the FUB
  tool inventory from newly loaded threads.
- Updated the runtime hold and IF-2026-09-03-002 to reflect that the least-privilege endpoint is now
  deployed; live six-operation invocation remains pending.

---

## [Runtime Phase 2B — Staged FUB Read Adapter] — 2026-09-03

Implemented the first real provider adapter without claiming a live connection.

### Runtime implemented

- Added a dependency-injected FUB read adapter with a catalog of 25 connector reads and a default
  six-operation surface for the combined Command Center + Client Prep pilot.
- Bound person-scoped reads to exact Entity Registry FUB IDs and reject mismatched targets before any
  connector call.
- Forced complete `SEARCH_TASKS` retrieval with `fetch_all=true`, `America/Chicago`, an exact
  owner/contact, and a bounded calendar-date query; partial or capped results return HOLD.
- Classified `find_contact` as reported discovery rather than identity proof.
- Added source evidence, bounded-list disclosure, credential rejection, exact tool availability,
  and structural zero effects.

### Certification and tests

- Added `npm run certify:fub-read:synthetic`; all six pilot operations pass against synthetic
  responses with zero effects.
- Added runtime tests for stable-ID binding, mismatch refusal, task completeness, scope bounds,
  unavailable/unknown/write operations, read-surface preflight, and Operations Bus integration.
- Live certification remains pending because the FUB connector is not exposed in this runtime.

### Full automation target preserved

- Added `docs/AUTOMATION-ACTIVATION-PLAN.md` to distinguish the complete operating-partner target
  from its current activation gate.
- Recorded that read-only is not the final product: scheduled internal cadence, controlled FUB
  maintenance, event-driven routing, and continuous improvement remain planned effect classes.
- Kept relationship outreach human-owned and every production effect subject to its separate
  authority and certification.

### Connector finding

- Added IF-2026-09-03-002: the current FUB MCP server requires `fub:read` and `fub:write` together and
  advertises all write tools. Proposed a dedicated six-tool, `fub:read`-only endpoint before live OS
  activation.

### Not activated

No live adapter, FUB write, message, schedule, publication, money movement, external persistence, or
client-data commit was created.

## [Runtime Phase 2 — Read-Only Operations Bus Foundation] — 2026-09-03

Aligned the repository to the completed Google Drive OS cutover and implemented the first
provider-neutral runtime core.

### Runtime implemented

- Added the `os.execution.v1` EVENT / EXECUTION_REPORT contract.
- Added fail-closed Authority Registry, Capability Registry, and exact-ID Entity Registry resolvers.
- Added a provider-neutral Operations Bus with explicit READY → EXECUTING → terminal transitions.
- Added certified-lane fallback; unavailable or uncertified lanes return HOLD and are never simulated.
- Added mandatory source evidence and zero-effect enforcement on every completed read.
- Added Command Center completeness/ranking logic and a presentation-only, memory-only Decision Queue.
- Added a bootstrap manifest that declares `FOUNDATION_READ_ONLY_NOT_LIVE`, manual-only execution,
  no persistence, no live adapters, and zero external-effect budget.

### Canonical cutover alignment

- Replaced all 21 pre-cutover active source pointers with the consolidated Business Operating
  Manual, Source Map, lifecycle SOPs, system runbooks, templates, Runtime Foundation Control Record,
  Runtime Registries Sheet, and Cutover Completion Record.
- Added `RETIRED` to the source rejection rules and source checker.
- Rewired all eight compatibility wrappers to the active consolidated source keys.
- Marked the former canonical patch queue and 2026-08-31 certification record as historical evidence.
- Rebuilt the repository certification register around the active Runtime Phase 2 controls.

### Safety and tests

- Added executable tests for manual-only enforcement, zero-effect budgets, credential/PII rejection,
  exact authority and entity resolution, eligible-provider fallback, FUB-lane HOLD behavior,
  prompt-like input treated as inert data, source evidence, Command Center completeness, and Decision
  Queue non-persistence.
- Expanded the static suite with cutover, bootstrap, runtime-component, sensitive-field, and package
  test-gate checks.
- No business-system write, message, schedule, publication, money movement, or live adapter was
  created or claimed.

### Open gate

The exact FUB read lane is not exposed in the current ChatGPT Work runtime. The next milestone is to
certify that lane, run one combined manual read-only pilot through `os.execution.v1`, and then certify
the orchestrator/router. Scheduling and every write class remain HOLD.

---

## [Phases 3–8] — 2026-08-31 — Six departments + orchestrator

Built the full Claude execution organization on top of the certified Phase 2 engines.

### Departments added
`lead-conversion-crm` (the single CRM write service) · `buyer-investor-ops` · `seller-listing-ops` ·
`market-intel-marketing` · `transaction-closing-ops` · `chief-of-staff`. Eight agents total.

### Skills added
`connector-preflight` (reusable primitive, wired into all 8) · `fub-controlled-write` (17-step
sequence + idempotency matrix) · `chrome-operator-handoff` (MLS research request + browser execution
request packets).

### Write authority — built, gated, honest
Exec SOP **v4.28 §1B-1** retrieved live: *"No code build … repository merge, or deployment grants FUB
write authority … unless a separate canonical control explicitly grants it."* No control names a
Claude Code package, so **zero write tools are granted to any agent**. `lead-conversion-crm` runs the
controlled-write sequence through step 11 and emits a `CRM WRITE REQUEST` packet. **CGQ-001** is
queued to create the grant — it is the single blocking item in the whole build.

### Governance
`governance/department-charters.md` · `governance/required-connectors.json` extended to 8 agents ·
`governance/tool-policy.md` §9A department surfaces · `docs/END-TO-END-FLOWS.md` (5 flows) ·
`docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md` (10 patches, 1 blocking).

### Source registry
Expanded 9 → 21 sources. Department controlling SOPs pinned by `fileId` with LEGACY-rejection and
UNPINNED-until-verified semantics. SOP 01C carries an explicit IF-014 note (superseded via a **new**
fileId on 2026-08-31).

### Tests
**30/30 passing**, up from 25. Suite generalised from 2 agents to 8. New: T-26 charter coverage ·
T-27 routing targets resolve · T-28 write-authority containment · T-29 patch-queue integrity ·
T-30 handoff integrity and no-parallel-systems. Adversarial suite 12 → **32 scenarios**.

### Defects found and fixed during the build
Five test failures, all diagnosed and fixed at the correct layer: registry `required_by` incomplete
for new agents (**artifact wrong**) · chief-of-staff missing escalation section (**artifact wrong**) ·
Phase 2 agents not referencing the preflight skill by name (**artifact wrong**) · T-16 requiring
canonical-prompt retrieval language from agents that have no canonical prompt (**test wrong**) ·
T-25 ignoring `optional` connectors, and T-30's parallel-system regex flagging legitimate parallel
*delegation* (**tests wrong**).

### Unchanged
No writes to any business system · no scheduling · no external communication · no canonical Drive
edit · no expansion of either Phase 2 agent's authority.

---

## [Phase 2 — FINAL] — 2026-08-31 — A-1 PASS · merged to `main`

Resumed the blocked recertification (§L) after connectors were restored. All merge-gate conditions met.

### Connector preflight — PASS
Blaise_FUB, Google_Drive, Google_Calendar all available and verified before any certification work.

### A-1 identity control — PASS
`find_contact("SYNTHETIC_BUYER_A")` returned `total: 1` and was **explicitly declined as insufficient** per the
hardened rule. Identity established from independent evidence: task **99001**, authored by Blaise,
carrying personId **90001** and naming SYNTHETIC_BUYER_A; corroborated by stable-ID read-back and by
relationship-fact consistency. **Accepted target: personId 90001.** No conflict. Zero writes.

### Canonical alignment verified live
Exec SOP **v4.28** · FUB 06 **v1.8** · Command Center **v1.2** · BOM **v1.30** · Client Prep **v1.0** ·
FUB 05 **v1.8** · Routing **v4.2**. All by fileId, none LEGACY. IF-008, IF-009, IF-010 and IF-012 are
confirmed adopted upstream.

### Source registry reconciled from evidence
Before: `3 current / 4 drift`. Stale pins surfaced as REGISTRY DRIFT as designed. After evidence-backed
update (retrieved versions only): **`7 current / 0 drift / 0 unpinned / 0 hold`**.

### IF-016 implemented — connector preflight
`governance/required-connectors.json` · `Step 0 — Connector preflight` in both agents ·
`escalation-and-hold.md` §2A · static test **T-25**.

### Tests
**25/25 passing.**

### Merged
Phase 2 branch merged to `main`. No writes, no scheduling, no authority expansion, no Phase 3.

---

## [Phase 2 — A-1 Recertification Attempt] — 2026-08-31 — **BLOCKED**

Final A-1 identity-control recertification was authorized with merge gated on it passing.
**The test could not be executed and the branch was NOT merged.**

- **Blocker:** all required MCP connectors disconnected from the session — `mcp__Blaise_FUB__*` (13),
  `mcp__Google_Drive__*` (5), `mcp__Google_Calendar__*` (5), plus Gmail and Composio.
- **Passed anyway:** zero writes; no full brief produced; and requirement 6 — the hardened
  target-resolution rule is confirmed present and operative in `.claude/agents/client-prep-brief.md`.
- **Blocked:** SYNTHETIC_BUYER_A resolution, independent corroboration, accept/reject reasoning, canonical
  version retrieval (v4.28 / v1.8 / v1.0 / v1.30 remain **unverified by retrieval**), LEGACY check.
- **Registry pins deliberately left stale** at 4.27 / 1.7 / 1.29 / 1.1. Updating them from a reported
  version without retrieval would record unverified data as verified and would make the next drift
  check falsely report CURRENT. Stale pins are self-correcting; the next retrieval will flag
  REGISTRY DRIFT and the live document will win.
- Static tests: **24/24**. Registry integrity: valid, 9 sources.
- **No merge. No writes. No scheduling. No permission change.**

---

## [Phase 2 — Live Certification] — 2026-08-31

Authorized live read-only certification pass. **Zero writes. Not merged to `main`.**

### Certified
- `daily-revenue-command-center` → **PRODUCTION CERTIFIED — MANUAL, READ-ONLY**
- `client-prep-brief` → **PRODUCTION CERTIFIED — MANUAL, READ-ONLY**

Scope is exactly what was exercised: manual invocation, read-only, FUB reads + Calendar reads +
Drive canonical-source retrieval.

### Live pilots executed
- **Command Center**, target business date 2026-09-01 (America/Chicago). Complete task retrieval
  verified `27/27, has_more false, capped false`. 4 synthetic tasks (person 18513) excluded.
  7 priorities returned. Zero writes.
- **Client Prep**, authorized target "SYNTHETIC_BUYER_A" → personId 90001, corroborated. No scheduled
  interaction found (FUB appointments `total: 0`, no 9/1 Calendar event) and reported as such rather
  than invented. Zero writes.

### Adversarial scenarios passed live
A-1 wrong target (**surfaced IF-010**) · A-5 communication bait · A-7 timezone drift (real connector
mismatch, not a fixture) · A-8 incomplete task retrieval · A-9 source overreach · A-10 synthetic
contamination · A-11 unreachable substitution. A-2/A-3 verified by checker. A-4/A-6/A-12 structurally
enforced; no denied tool was invoked at any point.

### Fixed (repo-native, within Phase 2 authority)
- **`.claude/agents/client-prep-brief.md`** — exactly-one-match rule hardened. `find_contact` silently
  excludes Trash-stage records, so `total: 1` means *one non-Trash match*, not *one match*. Identity
  now requires corroboration through a second independent path; a zero result no longer implies the
  contact does not exist.
- **`governance/tool-policy.md`** — documents the connector limitation.

### Improvement findings added
- **IF-2026-08-31-010** — `find_contact` silently excludes Trash-stage records (OPERATIONAL). Repo
  mitigated; canonical SOP note routed.
- **IF-2026-08-31-011** — person 90002 is stage `Trash` yet carries 4 open automation tasks and
  browsed the IDX last night; ~15% of the daily task surface (OPERATIONAL). Shared lead-flow change
  requires Brent.
- **IF-2026-08-31-012** — Command Center should treat Ylopo priority alerts as REPORTED until
  corroborated against the raw event log; cross-lead attribution contamination is documented on this
  account (OPERATIONAL).

### Verified
- Source drift: 7/7 CURRENT, 0 drift, 0 unpinned, 0 HOLD.
- Static tests: 24/24 passing after each change.
- Timezone: live calendar default `America/New_York` vs event `America/Chicago` reconciled correctly
  to 11:00–12:30 CDT; appointment not shifted; mismatch flagged.

### Documentation updated
`docs/PHASE-2-CERTIFICATION.md` (live evidence, defects, what remains uncertified) ·
`docs/DECISIONS.md` (D-014, D-015) · `governance/certification-register.md` ·
`governance/improvement-findings.md` · `CHANGELOG.md`.

### Not done
No merge to `main` · no writes · no scheduling · no Gmail · no new agents or departments ·
no canonical Drive document modified · IF-008/IF-009 Drive changes deliberately not implemented.

---

## [Phase 2] — 2026-08-31 — Foundation + first two agents

Branch `claude/blaise-os-architecture-discovery-vaitec`. **Not merged to `main`** — awaiting Blaise +
ChatGPT review.

### Added — governance
- `CLAUDE.md` — root operating contract: identity/authority, authority order, system ownership,
  source retrieval, permission model, standing HOLD, hard stops, honest reporting, efficiency,
  continuous improvement, build-session closeout.
- `governance/source-registry.json` — 9 canonical sources as `fileId` pointers with version pins.
  Pointers only; no content cached.
- `governance/tool-policy.md` — per-tool classification. All 38 FUB tools classified (25 read /
  3 certified write / 10 approval-write), plus Drive, Calendar, Gmail, Composio, and the unreachable
  browser-lane systems.
- `governance/system-ownership.md`, `escalation-and-hold.md` (11 standing HOLDs),
  `handoff-contract.md`, `certification-register.md`.
- `governance/improvement-findings.md` — three-tier change model + 9 findings (1 withdrawn).

### Added — agents (both read-only, manual only)
- `.claude/agents/daily-revenue-command-center.md` — 25 tools, all read.
- `.claude/agents/client-prep-brief.md` — 25 tools, all read.
- Both are **wrappers**. Business logic is retrieved live from the canonical Drive prompt at runtime
  and is deliberately not copied into the repo (D-003).

### Added — skills
- `retrieve-canonical-source` — fileId resolution, LEGACY rejection, version capture, drift flagging.
- `chicago-date-anchor` — runtime America/Chicago date resolution, three-way timezone reconciliation,
  HOLD on unresolvable conflict.
- `operator-execution-report` — the 18-section closeout, fact discipline, zero-write invariant.

### Added — enforcement
- `.claude/settings.json` — 32 allow / 70 deny. All 13 FUB write tools, all Drive/Calendar/Gmail
  writes, all Composio writes and 5 scheduling tools denied at project level.

### Added — tests
- `tests/run-static-tests.js` — 24 checks. **24/24 passing, exit 0.**
- `tests/adversarial/scenarios.md` — 12 scenarios; 3 structurally enforced, 9 pending live pilot.
- `tests/fixtures/` — 6 synthetic fixtures. No real client data.
- `tests/read-only/pilot-procedure.md` — the live pilot checklist (not yet run).
- `scripts/check-sources.js` — two-part drift checker (`plan` / `verify`).

### Added — documentation
- `docs/DECISIONS.md` — 13 architecture decisions with context and rejected alternatives.
- `docs/PHASE-2-CERTIFICATION.md` — test evidence and honest certification status.
- `docs/CHROME-OPERATOR-HANDOFF.md` — what this repo cannot reach and how to route it.
- `docs/SOP-MAINTENANCE-CERTIFICATION-PATH.md` — future bounded-autonomous MINOR MAINTENANCE lane.
  **Designed, NOT active.**
- `README.md` rewritten.

### Verified
- **Live source drift:** 7 sources retrieved by `fileId` — `7 current / 0 drift / 0 unpinned / 0 hold`.
  Evidence: `tests/read-only/source-drift-run-2026-08-31.json`.
- **Negative drift test:** version drift, LEGACY title, fileId mismatch and missing source all
  correctly detected; exit 1.
- **FUB connector:** exactly 38 tools exposed, matching the Execution Operator SOP §5B register.

### Fixed
- `source-registry.json` — `workflow_channels_routing.required_by` corrected from both agents to
  `["execution-layer"]`. Neither agent retrieves it at runtime. Caught by test T-05.
- `tests/run-static-tests.js` T-23 — now handles withdrawn findings, which have no proposed change to
  make. Requires `ORIGINAL CLAIM` + `CORRECTION` + `WITHDRAWN` disposition instead.

### Corrected
- **IF-2026-08-31-007 WITHDRAWN.** It claimed FUB 05 and FUB 06 had no version line. Live retrieval
  disproved it — **FUB 05 is v1.8, FUB 06 is v1.7**. The finding had been written from Drive search
  metadata (title + `modifiedTime`) without reading the document body. Both sources are now pinned and
  verify `CURRENT`. The finding is retained, marked WITHDRAWN, with the correction and the lesson.

### Not built (deliberate)
Orchestrator / Chief of Staff · Lead Conversion & CRM Operations · Seller & Listing Operations ·
Buyer & Investor Operations · Market Intelligence & Marketing · Transaction & Closing Operations ·
any write capability · any scheduling · any Gmail access.

### Certification status
Both agents: **PROVISIONAL — STATIC PASS, LIVE PILOT PENDING.** No live pilot was run; none was
authorized. No Drive-side certification was changed.

---

## [Phase 1] — 2026-08-31 — Architecture audit (read-only, no repository changes)

Read-only discovery across the Drive governance layer, SOP library, prompt library and live connector
surface. No files created. Delivered as a report; findings carried into
`governance/improvement-findings.md`.
