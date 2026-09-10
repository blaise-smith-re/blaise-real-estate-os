# Supervised property research and resume

This is an operator workflow using the existing authenticated Chrome capability. It is not a browser daemon or an MLS API. Read the current Matrix/Northstar Runbook by its registry ID before each continuous live run. Blaise completes login/MFA himself. Never extract sessions, bypass provider controls, or change MLS data.

Start a task-local checkpoint outside Git, with the same request and current governance metadata used for the board:

```powershell
node production/lead-engine/session-cli.js start C:/private/run/research-session.json C:/private/run/request.json C:/private/run/governance.json
node production/lead-engine/session-cli.js pause-auth C:/private/run/research-session.json C:/private/run/browser-reference.json
node production/lead-engine/session-cli.js status C:/private/run/research-session.json
```

`browser-reference.json` contains the observed `browser_id`, `tab_id` and `title`, optionally `query_ids`. It must not contain a signed URL, OAuth state, credentials, cookies or tokens. The checkpoint retains geography, status/date/property criteria, completed observations, query state and last inspected position. It is one research run, not a growing lead database. Continue public FSBO/professional queries while property queries wait.

Tell Blaise to complete Northstar/REcore sign-in in the identified Chrome tab, including MFA, and reply **Resume my lead engine** with the run ID. On return, reselect the actual tab, inspect the authenticated screen and confirm it is Matrix search. A user report alone is insufficient. The portal's inner Matrix image may launch a separate Matrix tab; inventory tabs and bind the new observed ID. Do not repeatedly click the tile or create a second workflow.

```powershell
node production/lead-engine/session-cli.js resume-auth C:/private/run/research-session.json C:/private/run/authenticated-screen.json
node production/lead-engine/session-cli.js observe C:/private/run/research-session.json seller-expired C:/private/run/expired-observation.json
node production/lead-engine/session-cli.js pack C:/private/run/research-session.json C:/private/run/pack.json
node production/lead-engine/cli.js run C:/private/run/pack.json C:/private/run/board
```

The authenticated-screen observation requires `browser_id`, newly observed `tab_id`, `verified_by`, `authenticated_search_visible: true` and a concise `screen_summary`. It stores no authentication material. Resume only incomplete queries; preserve completed public work and exact previously retained observations. Identical observation IDs are idempotent; changed captures require new IDs. If authentication expires mid-search, checkpoint the last inspected record and repeat pause/resume. Reopen and verify the criteria before continuing; do not assume the browser preserved them.

## Verified classic Matrix path

In the September 10, 2026 live correction: Northstar portal → Matrix image → Navigation Menu → Search → Single Family. This search includes residential styles such as detached homes and townhomes; do not claim a detached-only filter unless selected. The default checkpoint property type is `Single Family`; callers may supply another supported type.

Use Select None before selecting a status. Expired and Cancelled expose date inputs; set the explicit lookback range (90 days by default). Matrix spells the latter **Cancelled**; normalize it to `canceled`. Read the selected municipality values, not just the autocomplete textbox or placeholder. An empty textbox can coexist with selected municipalities. A checked status's `0-180` placeholder is not the actual entered date value. Confirm the results' displayed criteria summary before accepting observations.

The observed form exposes Coming Soon, Active, TNAFS, Pending, Closed, Comp Sold, Cancelled and Expired. **TNAFS is not Withdrawn.** If a requested status is unavailable, record that exact subquery limitation and complete the supported queries. Do not map provider statuses by guesswork.

For sellers, sort by expiration/recent status date, inspect a small resale shortlist and read the **MLS listing-history section** for later active/pending/closed records. Do not retain incidental public-record parties or mortgage information. Builder inventory expirations and long TNAFS histories do not establish new owner demand. Record exclusions for active relists. MLS status is verified only within the authorized record; seller willingness, current representation and contact eligibility remain separate unknowns.

For hosts, evaluate a useful bounded slate of active listings in the requested market. Inspect price/DOM/history, property fit, named listing agent and published open-house coverage. A host business case must cite observed buyer fit, hosting need or market position. No automatic inference that every active home needs an outside host. Existing coverage, builder staffing and unknown permission reduce or eliminate value. Never contact the owner of an active listing to solicit it.

An observation has `observation_id`, `sources`, `candidates`, `effects`, `complete`, optional `position` and `limitation`, plus displayed `criteria`: summary, verified_by, verified_at, normalized statuses, geography, property_type, date_from and date_to. Property observations must match the retained query, be recent and use permitted browser evidence. Maximum ten retained candidates per query and thirty per run. Large result counts are context, not permission for bulk collection. Retain only minimal evidence excerpts and an HTTPS Matrix locator plus exact MLS number/reopen instructions; exclude session-bearing URLs and images.

Use `block CHECKPOINT QUERY_ID REASON` for a genuine unavailable subquery. This does not erase any previously accepted observations or prevent unaffected work. No scheduler, monitoring, cart/contact save, registration, export of bulk MLS content or live writer is introduced.
