# Zillow tour integration

Small owner-private state extension for the existing Morning Desk Site. Gmail/FUB
remain authoritative; Drive owns the current procedure and existing showing prep.
This code does not create a Gmail subscription or a ChatGPT automation.

`runtime/zillow-tours.mjs` validates source receipts and owns tour identity,
chronology, fresh reply review, alert claims, prep handoffs and revision fencing.
`runtime/zillow-tour-contract.mjs` is the deployed orchestration interface.
`install-site.mjs` installs the additive route, panel and MCP tool definitions into
the exact existing Site checkout. Generate its D1 migration, build and use the Sites
publication helper with the exact pushed source. Never deploy the generic local Bus.

Live state is D1 row 1; isolated historical replay is row 2. Client payloads stay in
that owner-private service, never this repository. Events retain source IDs and
timestamps. The UI shows the incoming event timeline, last run and coverage state.
The replay cannot prove alert delivery or a live wakeup. Reconciliation checks the
tour version and a final source read within two minutes; a hidden sent body only
affects the visible-response metric. Duplicate requests share an alert action key.
No message, booking, Calendar, permission or payment adapter is included.

Validation:

```powershell
node --test tests/runtime/*.test.js tests/runtime/*.test.mjs
```

After starting an isolated local Site Worker on port 5173 with its migrations:

```powershell
node --test production/zillow-tours/api.test.mjs
```

The HTTP test refuses production by using a fixed loopback origin. It exercises
durable storage, stale revision rejection, duplicate delivery, replay separation,
cross-origin protection and authenticated MCP dispatch.

See [ACTIVATION.md](ACTIVATION.md) for the remaining ChatGPT activation and schedule
edit. A saved receipt never performs those changes itself.
