# Accepted-contract Operations Bus

The first hosted lane attaches preparation to the **existing Morning Desk daily
08:30 America/Chicago task**. It is a daily poll, not instant inbox monitoring.
The generic `runtime/operations-bus.js` stays manual. Its scoped hosted companion
is `runtime/kickoff-bus.mjs`; do not loosen the generic trigger boundary.

## Owning systems and execution

Current Drive Source Map, AI Execution Runbook and Transaction Operations Runbook
own procedure and authority. The live `morning_desk_get_contract` returns the
minimum runner instructions and command shapes from `kickoff-contract.mjs`.
The existing ChatGPT cloud task supplies model execution and its own authorized
Gmail, Drive and BLAISE FUB connectors. The Site cannot itself access those apps,
execute the local Python generator, or spend an API key. No standalone model key
or source-system credential is provisioned in the Site (environment revision 0).

The owner-private Site's existing Cloudflare Worker/D1 stores only candidate
pointers, exact transaction keys, package hashes, progress/owners, source-effect
intents and readback receipts. It is not a CRM or document store. Source history,
originals, recipient drafts and decisions stay in their existing Drive home;
material client state and useful actual commitments stay in FUB. Never commit
client inputs, outputs, provider tokens or source document bodies here.

Reuse `production/transaction-operations` version 1.2.0, including its existing
kickoff/attachment/reconciliation logic. A cloud task without a Python executor
follows the same current Runbook directly; it must not claim local code ran.

## Review, pause and recovery

Open the existing Morning Desk and its **Transaction kickoff** section. Its
Pause kickoff / Resume kickoff control affects only this lane and retains saved
work. Pause the whole daily task at `https://chatgpt.com/scheduled` when needed.
No second scheduler, webhook service, local desktop cron or new OAuth app is used.

Every command uses the current state revision. Atomic D1 compare-and-swap rejects
overlaps. A per-case 30-minute renewable lease and fencing number prevent an old
run from updating a reclaimed or paused case. This is an engineering lease, not
a business SLA. Resume refreshes authoritative sources before further effects.

`begin_effect` records a stable business-action key and intended-payload hash
**before** the separate connector call. It grants permission only once. A lost
response, interrupted run or duplicate delivery leaves the effect UNCERTAIN;
read the original destination and adopt a matching committed result through a
receipt. Do not automatically retry a create because a timed-out write is absent
on one read. If it cannot be resolved conclusively, Blaise/operator owns that
exception. Independent preparation continues. A pause cannot undo an already
in-flight external request. No claim of distributed exactly-once execution is made.

New emails bind to the same exact FUB person/deal/property case. Current complete
executed chronology supplies the package hash; a later executed amendment revises
affected work, not a second initial handoff. The agent must also perform semantic
duplicate checks in Drive/FUB; storage keys alone cannot recognize an incorrectly
chosen business key. Wrong-target, shared-team, signature, Calendar, spending and
external-send boundaries remain unchanged. Replay cases cannot get source-write
permits. Closing-to-past-client is **not attached** by this lane.

## Implementation and deployment

Source owner: `blaise-smith-re/blaise-real-estate-os`.
Host: `appgprj_6ad170600b348191953b52130d86a98f`.
Task: `Automation_85c2cba764948191b37cb4b90a395b28`.
Review: https://blaise-morning-desk.bsmith863084.chatgpt.site

Open the existing Site source with the supported Sites helper before editing.
Run `node production/operations-bus/install-site.mjs <site-checkout>` to copy the
reviewed modules and integrate its API/MCP/UI. Generate/inspect the additive D1
migration with the existing Drizzle tooling. Applied migrations are immutable.
Build, package, push and deploy the exact Site source through the Sites workflow;
preserve its owner-only audience and existing tables. Publication refreshes the
connected plugin's tools. A new cloud invocation must discover the two Bus tools;
an older chat may need a new session. Supported owner-private service access can
exercise `/api/operations-bus` without impersonating a visitor, but does not grant
Gmail/Drive/FUB access or prove the scheduled agent's capability.

Checks: `node --test tests/runtime/kickoff-bus.test.mjs`, existing runtime/static
checks, Site TypeScript/build and existing local Worker API checks. The latter
require the local Worker; do not aim synthetic API tests at production. The
`replay.py <new-private-output>` helper reuses the TC fictional originals and
generator; its output is explicitly synthetic and contains real readiness holds.

Deployed Site source: `48f913fd1044530e439ef9d5c7be3f44ee3d1a7c`.
Deployment: `appgdep_6ae3bfee913c8191bc1802e01bf04c0d`, succeeded October 29, 2026.
Contract: Morning Desk `2026-10-29.2`, kickoff `2026-10-29.1`.
Runtime acceptance details and current limitations belong in `RELEASE.md` and the
existing Drive audit/status record. A saved schedule or replay is not timer proof.

## Next attachment

Reuse the existing `production/transaction-operations/postclose.py` and
`POSTCLOSE.md` for verified actual closing/funding and relationship continuation.
Add a separately scoped handler, event identity and effect keys to this same
store/runner after its live source gate and ownership are established. Keep actual
closing date separate from confirmation date. Do not enable it merely because
this accepted-contract lane is active.
