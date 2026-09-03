# Certification Register — Runtime Mirror

**Active canonical controls:**

- Runtime foundation control: `1QQlyz8YIosmqquO18cTOpZwaskpg7tH8rgDp_ZqoRDA`
- Runtime registries: `1Cr3SxGD00XFpck_f15oJL_wJPwWdE53W9kFiA0mdtO8`
- AI Execution Runbook: `1pFUdBNfbPLBYSkyKj0_25wC6RuP6VKO1WnkOZ1EudJw`

This file is a repository mirror. It never grants authority. The live Runtime Foundation Control
Record and Runtime Registries Sheet control when they differ from this file.

## Current phase

`FOUNDATION — READ-ONLY — NOT LIVE`

| Component | Repository status | Live/certified status |
|---|---|---|
| `os.execution.v1` contract | implemented and tested | foundation only |
| Authority Registry resolver | implemented; exact-match/fail-closed | registry staged, not live |
| Capability Registry resolver | implemented; certified + Phase 2-enabled lanes only | registry staged, not live |
| Entity Registry resolver | implemented; exact stable ID only | registry staged, not live |
| Operations Bus | provider-neutral core implemented | **NOT LIVE** |
| FUB read adapter | six-operation pilot surface implemented; synthetic PASS | **LIVE CERTIFICATION PENDING** |
| Command Center | ranking/completeness gate implemented | presentation-only |
| Decision Queue | in-memory implementation | presentation-only; never source of record |
| Scheduler | no implementation enabled | **HOLD** |
| External writes/messages/money movement | structurally rejected | **PROHIBITED** |

## Capability evidence carried from the active registry

| Capability class | Status for this runtime |
|---|---|
| Local analyze / summarize / validate / render-report | certified and Phase 2-enabled where recorded |
| Google Calendar list/read lane | certified and Phase 2-enabled where recorded |
| Google Drive reads | observed/provisional; use only where the live registry enables the exact class |
| Follow Up Boss reads | staged adapter synthetic PASS; **HOLD — no FUB read lane exposed in current ChatGPT Work runtime** |
| Follow Up Boss writes | **PROHIBITED in Runtime Phase 2** |
| Calendar, Drive, Gmail, publication, browser, scheduling writes | **PROHIBITED in Runtime Phase 2** |

## Historical adapter evidence

The pre-cutover Command Center and Client Prep wrappers passed bounded manual, read-only pilots on
2026-08-31. That evidence remains in `docs/PHASE-2-CERTIFICATION.md`; it does not certify the new
provider-neutral Operations Bus or create a currently available FUB lane.

| Historical wrapper | Evidence | Current meaning |
|---|---|---|
| `daily-revenue-command-center` | manual read-only pilot PASS | useful adapter evidence; runtime recertification required |
| `client-prep-brief` | manual read-only pilot PASS | useful adapter evidence; runtime recertification required |

The other compatibility wrappers are built and read-only but are not production-certified as
provider-neutral runtime packages.

## Next certification gate

1. Provide a target-runtime FUB surface containing the six pilot reads and no reachable FUB writes.
2. Ensure the client can authenticate with `fub:read` without requiring `fub:write`.
3. Add the six exact operations to the live Capability Registry with evidence-backed states.
4. Preflight FUB, Drive, and Calendar, then run one combined manual pilot through
   `os.execution.v1`.
5. Confirm complete task retrieval, exact entity binding, bounded list scope, source metadata, and
   zero effects.
6. Certify the orchestrator/router only for the exercised scope.

This is an activation gate, not the final automation target. The full department organization,
controlled-write flow, handoffs, and future unattended cadence remain part of the build; each effect
class activates only after its own authority and certification. See
`docs/AUTOMATION-ACTIVATION-PLAN.md`.
