# Daily Lead Follow-Up

Chat entry: **Who needs a touch today?**

Current business guidance belongs in Drive: resolve the Source Map
`1UU8eQOElu388w2FA2gPJCMOKP7_EvQRNoPUthxc1_wg`, then Lead Conversion,
Outreach, FUB and AI Execution. This directory owns technical implementation,
not a cached copy of those documents or client records.

## Existing runtime

The existing owner-private Morning Desk Site
`appgprj_6ad170600b348191953b52130d86a98f` exposes
`daily_follow_up_read` and `daily_follow_up_command` through its existing plugin.
`morning_desk_get_contract.dailyFollowUp` supplies the live protocol.
The existing D1 binding has one additional revision-fenced progress row.
FUB remains authoritative; the row holds a working queue, drafts, explicit
confirmations, unresolved write intents and source receipts. This is not a CRM
mirror. Discovery/drafting and actual FUB operations use the chat's connected
FUB/Drive tools. No standalone API key or model service is required.

The interactive queue does not create or change an automation. It reuses the
latest Morning Desk evidence, then refreshes changed sources and each candidate
before presentation. The accepted-contract Bus and morning timing are preserved.

## Chat setup

Use one chat named **REOS - Daily Lead Follow-Up**, with the existing
**Blaise - Morning Desk** private plugin, **blaise_fub_full**, and Google Drive.
Gmail is useful for original email context. A title alone does not enable tools.
Verify the two follow-up tools are actually exposed in that chat. Sites refreshes
the plugin on publication; if a previously open chat lacks the tools, open a fresh
chat or reconnect the existing plugin, not a new server or automation.

Starter: "Run Daily Lead Follow-Up for my assigned FUB contacts (user 33).
Read morning_desk_get_contract and daily_follow_up_read, use current Drive
guidance, reconcile new activity, and show one useful person at a time.
Who needs a touch today?"

The runtime saves resume/skip/revise/confirmed-event state. Natural-language
interpretation and source reconciliation run in the connected agent, not in an
unattended classifier. A lost external-write response remains uncertain until
independent FUB evidence resolves it. This intentionally favors no duplicate
over blindly retrying a possibly successful create. No time-based regrant exists.

## Build and checks

Run `node --test tests/runtime/daily-follow-up.test.mjs` from the repo. Run the
documented repo static/runtime checks after technical changes.
Open the existing Site through the Sites source helper, then run:

```text
node production/daily-follow-up/install-site.mjs <existing-site-checkout>
```

In that Site checkout, generate an additive migration with the existing
Drizzle CLI, inspect SQL and metadata, type-check, and build through the Sites
helper. `site-api.test.mjs` / installed `tests/daily-follow-up-api.test.mjs`
only targets the local built Worker at 127.0.0.1:5173 with synthetic records.
It exercises real local D1, MCP auth, resume, skip, revision, repeated send and
uncertain-write recovery. Never redirect it to production or use real clients.

Publish only through the existing owner-private Sites workflow and verify the
connected contract/read tools plus a real preparation-only queue. Keep release
identifiers in RELEASE.md, client outcomes in FUB, and durable procedure in Drive.
