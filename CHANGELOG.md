# Changelog

Repo-native engineering changes. Business policy, authority and certification gates are owned by
Google Drive and ChatGPT / 04 — changes to those are **never** recorded here as done, only proposed as
Improvement Findings.

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
- **Client Prep**, authorized target "Dallas" → personId 18476, corroborated. No scheduled
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
- **IF-2026-08-31-011** — person 18328 is stage `Trash` yet carries 4 open automation tasks and
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
