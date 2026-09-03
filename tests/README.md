# Tests

The test layers are separate because they prove different things.

## Full local gate

```bash
node tests/run-static-tests.js
node --test tests/runtime/*.test.js
node runtime/cli.js check
```

Or run `npm test` followed by `npm run runtime:check`.

Run the staged FUB adapter harness separately:

```bash
npm run certify:fub-read:synthetic
```

Every automated test is offline and synthetic. It makes zero network calls and zero writes to a
business system.

## Static invariants

The static suite checks source-registry structure and cutover locators, retired-source rejection,
tool-permission containment, agent guardrails, skill validity, bootstrap safety, runtime component
presence, sensitive-field rejection, and the no-cached-canonical-content rule.

These checks prove structural containment. They cannot prove agent judgment or connector behavior.

## Runtime behavior

`tests/runtime/` exercises the provider-neutral core:

- manual-only and read-only contract enforcement;
- zero external-effect budgets and adapter results;
- credential and registry-PII rejection;
- exact authority and entity resolution;
- eligible certified-provider fallback;
- HOLD on an unavailable/unverified FUB lane;
- prompt-like record text kept behind the untrusted-data boundary;
- source-evidence requirements;
- Command Center completeness and priority order; and
- Decision Queue non-persistence.

The FUB adapter tests additionally prove:

- exact stable-ID binding and mismatch refusal;
- an exact six-operation pilot allowlist;
- write-tool exposure detection;
- forced complete task pagination in `America/Chicago`;
- owner/contact and calendar-date bounds on task queries;
- reported-only contact discovery; and
- synthetic FUB adapter integration through `os.execution.v1`.

The FUB harness proves adapter behavior offline. It does not certify live connector availability,
OAuth scope separation, Drive/Calendar preflight, or a production record.

## Source-drift check

```bash
node scripts/check-sources.js plan
node scripts/check-sources.js verify --results <file.json>
```

The first command emits the active Drive retrieval manifest. The second deterministically classifies
CURRENT, REGISTRY DRIFT, UNPINNED, or HOLD from real retrieval results. Historical 2026-08-31 result
files are retained as pre-cutover evidence and must not be reused as current results.

## Behavioral scenarios

`tests/adversarial/scenarios.md` contains the pre-cutover agent scenarios. They remain useful as
failure-mode evidence but do not certify the provider-neutral runtime. New live certification begins
only after the exact FUB read lane is available and recorded in the active Capability Registry.

## Data rule

No real client data belongs in this repository. Fixtures contain stable synthetic identifiers only;
runtime registry fixtures reject direct PII and credential fields.
