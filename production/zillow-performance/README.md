# Zillow Performance & Conversion

Private report: https://blaise-morning-desk.realestateblaise.chatgpt.site/zillow-performance

Current business authority is the Drive Source Map and the Zillow specialist section
in the existing Lead Conversion SOP. This directory contains implementation,
fictional tests and deployment provenance. No client payloads belong in Git.

- `engine.mjs`: evidence validation, equally aged cohorts, calendar production,
  due review periods and immutable D1 writes.
- `contract.mjs`: supported schema and runtime routing to current Drive owners.
- `site/page.tsx` / `site/route.ts`: phone report and private API.
- `engine.test.mjs`: fictional replay tests.
- `site/api.test.mjs`: localhost-only D1/API acceptance; never run on production.

Hosted source integrates the engine/contract in `lib`, the page at
`app/zillow-performance`, API at `app/api/zillow-performance`, tools in
`app/mcp/route.ts`, home link in `app/desk.tsx`, and lane in updater contract.
Do not replace the rest of the Site with this partial source directory.

The existing daily 07:15 America/Chicago task reads the deployed contract. Weekly
and prior-month keys make work due and allow recovery on the next run. No new
scheduler, arrival trigger or outreach adapter. Existing timer verification does
not prove this new lane has run unattended.

First verified arrival/assignment is distinct from CRM creation and may postdate
the actual first connection. Unknown dates stay outside age cohorts. Type/land
strata remain separate. Missing evidence is unknown, not zero. Date-only evidence
retains calendar precision; uncertain day30 boundary events are excluded.
Milestones are independent observations, not an automatically descending funnel.
Calendar production uses stable distinct deal event IDs. Final broker statements
matched to paid receipts are required for retained commission.

Run `node --test production/zillow-performance/engine.test.mjs` from this repo.
See `RELEASE.md` for actual deployment, readback and remaining verification gaps.
