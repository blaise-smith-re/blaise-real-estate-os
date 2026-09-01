# Tests

Two kinds of test, deliberately kept separate because they prove different things.

## Everything offline — one command

```bash
node tests/run-all.js              # exit 0 = every suite passed
```

Runs the static suite and the timezone suite. This is the gate.

## Static tests — runnable now

```bash
node tests/run-static-tests.js     # exit 0 = pass
```

33 checks over registry integrity, tool-permission containment, agent guardrail presence, skill
validity, and the no-cached-canonical-content rule. **Zero network calls. Zero writes.** Safe in CI.

## Timezone edge cases — runnable now

```bash
node tests/run-timezone-tests.js   # exit 0 = pass
```

16 cases over `chicago-date-anchor` Rule 3, against the reference implementation in
`scripts/reconcile-appointment-time.js`. Covers the live IF-2026-09-01-019 defect (a rendered
`-04:00` labeled `America/Chicago` on a real client showing), both DST states, the skipped 2 AM hour
and the doubled 1 AM hour, UTC-vs-Chicago business-date boundaries, and refusal to guess on an
unparseable instant. Expected values were verified against IANA tzdata before being asserted.
**Pure, offline, no clock reads.**

These prove what can be proven from files: that a prohibited tool is not reachable, that no canonical
content was copied into the repo, that every agent tool is allowlisted. They cannot prove judgment.

## Source-drift check

```bash
node scripts/check-sources.js plan                         # what Claude must retrieve
node scripts/check-sources.js verify --results <file.json> # adjudicate drift, exit 1 on HOLD
```

Two-part by necessity — Node cannot reach Drive (D-011). Claude retrieves; the script adjudicates.

- Live evidence: `tests/read-only/source-drift-run-2026-08-31.json` → `7 current / 0 drift / 0 hold`
- Negative fixture: `tests/adversarial/drift-negative-fixture.json` → drift + LEGACY + mismatch all fire

## Adversarial scenarios — behavioral, require a live agent

`tests/adversarial/scenarios.md` — 12 scenarios. **Not covered by the static suite.**

Three (A-4 scope escape, A-6 scheduling, A-12 canonical edit) are additionally enforced structurally:
the tool is absent from the agent grant *and* denied in `.claude/settings.json`, so a judgment failure
alone cannot produce the prohibited effect. The other nine depend on agent judgment and must be
exercised live before either agent is production-certified.

## Data rule

**No real client data in this repository, ever.** Fixtures use `example.invalid` and the reserved
`555-01xx` phone range. See `tests/fixtures/README.md`.
