# Blaise Real Estate OS

## Buyer workspace

The [local buyer workspace](production/buyer-workspace/README.md) provides a
buyer brief, showing-feedback capture, a combined note/preferences/action/text
review and approval-gated FUB note/task maintenance with independent read-back.
Run `npm run buyer:start` or use `npm run buyer:demo` for fictional data only.
Phone layout is supported. The [hosted implementation](production/buyer-workspace/DEPLOYMENT.md)
adds encrypted persistent sign-in, restart recovery and AI preparation, with 33
focused tests. The [private hosted preview](https://blaise-buyer-workspace.onrender.com)
passed live sign-in, buyer retrieval, AI drafting, renewal and server-restart recovery;
final phone and hosted write acceptance remain open.
The existing agent-operated Showing & Tour workflow remains available.

Provider-neutral execution foundation for Blaise Smith's real estate business — Buy Sell Home Team,
RE/MAX Results.

## Current state

Google Drive owns current operating guidance; Follow Up Boss owns live client state. This repository
contains engineering tools and a bounded runtime foundation. Retrieve the current Source Map,
Business Operating Manual and AI Execution Runbook before maintenance; historical local status
claims do not establish current policy or prove that a component is deployed.

| Layer | Status |
|---|---|
| Canonical Business Operating Manual, lifecycle SOPs, system runbooks, and templates | **COMPLETE — Drive is authoritative** |
| Source cutover from the retired pre-2026-09-03 OS | **COMPLETE** |
| `os.execution.v1` event/report contract | **IMPLEMENTED** |
| Authority, Capability, and Entity Registry enforcement | **IMPLEMENTED — fixture-tested** |
| Provider-neutral Operations Bus core | **LOCAL FOUNDATION — fixture-tested read + internal write; no live adapters or persistence** |
| Command Center ranking and Decision Queue presentation | **IMPLEMENTED — memory-only** |
| Follow Up Boss read adapter | **IMPLEMENTED — six-tool least-privilege lane** |
| Follow Up Boss write adapter | **IMPLEMENTED — all 13 bounded maintenance operations** |
| Codex project attachment | **CONFIGURED — `blaise_fub_full`; verify initialization and a bounded authorized read in the current session** |
| This repository's runtime scheduler | **NOT IMPLEMENTED — runtime is manual-only; separately hosted tasks must be inspected in their actual provider** |
| External release | **BLAISE REVIEW — SEND / SUBMIT / PUBLISH / SIGN / SPEND** |

The runtime accepts both `READ_ONLY/READ` and `INTERNAL_WRITE/WRITE_INTERNAL`. AI can maintain
Blaise's individual FUB records without micro-approval; outward actions still stop for Blaise's
review. The trusted-project configuration uses the existing `blaise_fub_full` connection only.
The retired separate read-only connection must not be recreated.

## Runtime guarantees

- This local runtime accepts manual triggers only. This is not a claim about separately hosted schedules.
- Reads have zero effects. Internal-write events allow at most two FUB writes and one internal
  appointment record; messages and money movement remain zero.
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
  bootstrap.json       Runtime mode, canonical pointers, bounded effect budget, active holds
  contract.js          os.execution.v1 validation and source-evidence rules
  registries.js        Authority, Capability, and Entity resolution
  operations-bus.js    State transitions, adapter selection, fail-closed execution
  presentation.js      Command Center ranking and in-memory Decision Queue
  adapters/fub-read.js Exact read-tool allowlist, entity binding, completeness controls
  adapters/fub-write.js All 13 internal FUB maintenance operations and effect accounting
  certification/       Offline adapter certification harnesses

governance/
  source-registry.json Current Drive fileId pointers after the 2026-09-03 cutover
  tool-policy.md       Local tool containment and historical connector evidence
  *.md                 Ownership, handoff, holds, findings, and certification records

.claude/
  agents/              Department wrappers with one active CRM write service
  skills/              Retrieval, date, report, preflight, and handoff procedures
  settings.json        FUB maintenance allowlist; external-send and scheduling denials

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

## Codex desktop activation

This repository includes a trusted-project `.codex/config.toml` for the existing `blaise_fub_full`
operator, with 25 read tools and 13 bounded internal-write tools. The separate read-only connection
is retired. Preserve the existing OAuth identity, callback, scopes and tool allowlist.

The configuration sets `mcp_optional_startup_grace_ms = 0` and a 60-second server startup timeout.
This matters because the Render service can take longer than Codex's normal optional-server grace
period to wake after being idle; without the longer wait, a healthy authenticated service can be
missing from a thread's initial tool inventory.

In the Codex desktop app, trust/open this repository, restart Codex after configuration changes, and
use `/mcp` to confirm `blaise_fub_full` initializes, then perform an authorized bounded read. OAuth
success alone is insufficient. Credentials remain in Codex's credential store and must never be committed. The full lane can maintain internal
FUB records; it cannot independently send an email, text, call, publish, sign, or spend.

## Canonical-source rule

Google Drive owns business policy and procedure. This repository stores pointers and runtime code,
never copied SOP bodies. Resolve current authority by `file_id` from
`governance/source-registry.json`. A title beginning `RETIRED -`, `LEGACY -`, or `ARCHIVED -`, or
containing `Superseded`, is evidence only and must never control a live workflow.

## Maintenance entry point

Read `AGENTS.md` when present and retrieve the current Drive authorities. For connection recovery,
read `.codex/config.toml`, `docs/FUB-OAUTH-CONNECTION.md` and
`production/lead-engine/FUB-READ-RECOVERY.md`. Run the offline checks above before proposing changes.
Do not make a live write merely to smoke-test access. Inspect existing hosted schedules and their
outputs before proposing new background work, and check deployment triggers before pushing code.
