# Blaise Real Estate OS

Provider-neutral execution foundation for Blaise Smith's real estate business — Buy Sell Home Team,
RE/MAX Results.

## Current state

The **knowledge layer is complete and consolidated in Google Drive**. This repository now implements
the next phase: a bounded runtime foundation that can consume those authorities without becoming a
second CRM, task list, calendar, document system, or SOP library.

| Layer | Status |
|---|---|
| Canonical Business Operating Manual, lifecycle SOPs, system runbooks, and templates | **COMPLETE — Drive is authoritative** |
| Source cutover from the retired pre-2026-09-03 OS | **COMPLETE** |
| `os.execution.v1` event/report contract | **IMPLEMENTED** |
| Authority, Capability, and Entity Registry enforcement | **IMPLEMENTED — fixture-tested** |
| Provider-neutral Operations Bus core | **IMPLEMENTED — read-only foundation** |
| Command Center ranking and Decision Queue presentation | **IMPLEMENTED — memory-only** |
| Follow Up Boss read adapter | **IMPLEMENTED — synthetic PASS; live lane pending** |
| Combined production pilot and orchestrator certification | **NEXT** |
| Full department organization and controlled FUB-write flow | **BUILT — activation gated** |
| Scheduler and unattended internal orchestration | **DESIGNED TARGET — certification HOLD** |
| Independent relationship outreach | **HUMAN-ONLY — Blaise owns conversations** |

`FOUNDATION_READ_ONLY_NOT_LIVE` is an intentional status. The core is real and tested; it does not
claim a connector exists until the exact lane is available and certified.

Read-only is the current activation gate, not the target intelligence depth. The target operating
model remains the complete OS: proactive opportunity discovery, daily prioritization, client prep,
department routing, controlled CRM maintenance, exception handling, browser-operator handoffs, and
continuous improvement. `docs/AUTOMATION-ACTIVATION-PLAN.md` shows what is built and what evidence
unlocks each effect class.

## Runtime guarantees

- Manual trigger only; scheduled or unattended execution is rejected.
- Read-only action class only; every external-effect counter must remain zero.
- Exact active authority rule required; ambiguity fails closed.
- Exact stable entity ID required; ambiguous or missing targets stop before an adapter call.
- Only active, certified, Phase 2-enabled capabilities may run.
- Provider fallback is allowed only to another eligible certified lane; otherwise the result is HOLD.
- Source metadata is mandatory on every completed execution report.
- Registry snapshots reject credentials and direct PII fields.
- Source control accepts synthetic examples only; live client/contact records and raw pilot evidence
  stay in restricted operating systems.
- Decision Queue is presentation-only and memory-only; source systems remain authoritative.

## Repository layout

```text
runtime/
  bootstrap.json       Phase mode, canonical pointers, zero-effect budget, active holds
  contract.js          os.execution.v1 validation and source-evidence rules
  registries.js        Authority, Capability, and Entity resolution
  operations-bus.js    State transitions, adapter selection, fail-closed execution
  presentation.js      Command Center ranking and in-memory Decision Queue
  adapters/fub-read.js Exact read-tool allowlist, entity binding, completeness controls
  certification/       Offline adapter certification harnesses

governance/
  source-registry.json Current Drive fileId pointers after the 2026-09-03 cutover
  tool-policy.md       Local tool containment and historical connector evidence
  *.md                 Ownership, handoff, holds, findings, and certification records

.claude/
  agents/              Read-only compatibility wrappers for the department model
  skills/              Retrieval, date, report, preflight, and handoff procedures
  settings.json        Structural deny rules for writes and scheduling

tests/
  runtime/             Executable runtime behavior and failure-mode tests
  fixtures/            Synthetic data only
  adversarial/         Historical and current behavioral scenarios
```

## Run locally

```bash
node tests/run-static-tests.js
node --test tests/runtime/*.test.js
node runtime/cli.js check
```

Or, where package scripts are available:

```bash
npm test
npm run runtime:check
npm run certify:fub-read:synthetic
```

These checks make no network calls and perform no business-system writes.

## Canonical-source rule

Google Drive owns business policy and procedure. This repository stores pointers and runtime code,
never copied SOP bodies. Resolve current authority by `file_id` from
`governance/source-registry.json`. A title beginning `RETIRED -`, `LEGACY -`, or `ARCHIVED -`, or
containing `Superseded`, is evidence only and must never control a live workflow.

## What clears the next gate

1. Expose the six-operation Follow Up Boss pilot surface in the target runtime with no reachable
   write tools and a read-only OAuth scope.
2. Record those operations in the Capability Registry and certify them against the active FUB System
   Runbook.
3. Run one bounded combined manual pilot through `os.execution.v1` with complete source metadata and
   zero external effects.
4. Certify orchestrator/router behavior from that evidence.

Then activate the next effect class rather than stopping at read-only: scheduled internal cadence,
controlled FUB maintenance, and event-driven orchestration each have their own bounded gate.
