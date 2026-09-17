# Buyer workspace — private hosted preview

**Deployed; final real-phone acceptance remains open.** Open the
[private hosted workspace](https://blaise-buyer-workspace.onrender.com).
The hosted backend has
encrypted persistent sessions, exact-owner token verification, serialized renewal,
restart-safe save receipts and a structured AI interpreter. Read the
[deployment proposal and remaining acceptance checks](DEPLOYMENT.md).
The owner approved the separate Render service and exact hosted callback. Live
owner login, buyer retrieval, AI drafting, hosted renewal and server-restart recovery
passed. The owner's Google credentials replaced Auth0's development keys, and
Auth0's Google connection test succeeded. A separate browser session retrieved buyers.

A narrow, responsive local application for one buyer showing debrief. It reuses the
existing full FUB service, public native OAuth registration, brand fonts/wordmark,
`runtime/adapters/fub-write.js`, and the Showing & Tour Experience's attribution
and proposed-versus-applied distinction. It creates no parallel CRM.

## Run

Node 20+ for local/demo; Node 24 for hosted mode. Local/demo requires no package
installation, database or API key. Hosted mode requires private environment
settings and a persistent disk, as described in the deployment proposal.

```powershell
npm run buyer:start
# Open http://127.0.0.1:4317 and connect the existing FUB account.

npm run buyer:demo
# Separate synthetic-only mode; never accesses FUB. Stop the live server first.

npm run test:buyer
```

Select a buyer across any FUB stage, read the brief, type/paste feedback (or use the phone
keyboard's dictation), check speaker labels and preference changes, and review the
note, next action and client text together. The explicit approval button is the
only route to writes. A task is optional: update an existing assigned task or
create one with an explicit date. No offer or appointment date is inferred.

The complete original feedback stays in memory, not in the repository. Selected
useful statements form the note; excluded material is not saved. Nothing sends,
logs a draft as sent, changes a stage or search, books an appointment or places an
offer. Client text is copy-only.

## Supported lanes and honest limits

| Capability | Implementation / limit |
|---|---|
| Buyer selection | Contacts assigned to Blaise across all stages. Buyer tags and showing/offer stages identify buyers; unclassified contacts are grouped separately. Seller-only, renter and Trash records are excluded. Name search uses the same assignment. The provider's bounded page and unknown/incomplete coverage are disclosed; there is no unsupported pagination claim. |
| Brief | Current contact, latest 10 notes and complete open tasks. Latest meaningful note excerpt is attributed CRM context, not a newly verified client fact. |
| Feedback preparation | Local/demo uses a conservative rules-based parser. Hosted mode uses OpenAI Responses with exact-excerpt validation, editable attribution/preferences/action/text and no tools. Real model access and drafting were verified. |
| CRM note | Existing controlled write adapter plus independent exact-content read-back. |
| Preferences | Specific, cited proposals recorded in the note. No new custom fields or shared tags; saved-search state stays unverified. |
| Task | Optional create or exact existing-task update; old name/date/type/assignment rechecked; date is America/Chicago. |
| Property facts | No MLS API attached. Reported details never receive a verified-MLS label. |
| Other source enrichment | Gmail/Drive are available to the operating agent, not connected to this app. The live pilot's email research does not claim an app email integration. |
| Browser authentication | Local: existing loopback callback. Hosted: registered approved HTTPS callback, same scopes, PKCE, signed token verification and exact-owner restriction. Live owner login and restart recovery passed. No Codex token-store extraction. |
| Phone access | Hosted HTTPS is independent of the computer. The live review passed the 390-pixel layout check; actual phone keyboard/dictation and computer-off acceptance remain open. Local mode still requires this computer. |

See [existing authentication record](../../docs/FUB-OAUTH-CONNECTION.md). No Auth0
client was created for hosting. The approved exact hosted callback was added to
the retained registration; its scopes and token lifetimes were unchanged.
The callback listener uses the existing port 57185; a conflict is reported rather
than killing another process or choosing a new callback. The local server does not
persist tokens; a restart requires login. Hosted mode encrypts tokens and session
state on the configured persistent disk and commits rotation before CRM calls.

The [September 16 diagnosis](../../docs/FUB-AUTH-DIAGNOSIS-2026-09-16.md) repaired
the computer's separate native Codex connection and verified real renewal. That
does not supply this application's independent session. The hosted app now has
its own durable session and passed an actual server-restart check. Phone/computer-off
acceptance remains open.

## Controls

- Local mode binds only to `127.0.0.1`; exact Host/Origin checks, CSRF token, HttpOnly SameSite
  session cookie, CSP, no-store responses, no remote assets, no analytics, no audio
  API, browser storage or service worker. Do not expose it with a public tunnel.
- Local session expires after 30 minutes; ending the session clears server data and
  tokens. Closing a tab alone does not immediately destroy the server session.
- Hosted mode uses an opaque Secure cookie, exact owner verification and encrypted
  disk sessions. Working context expires after 30 minutes; approved receipts remain
  up to 24 hours for recovery. Sign-in has a seven-day idle/thirty-day maximum,
  subject to the provider's stricter expiration and revocation rules.
- Approval binds to the exact immutable server-held proposal. Refreshing or
  editing supersedes older unattempted proposals; expiry requires a new review.
- Re-read identity, assignment, stage, contact update marker, latest note and any
  task being changed before writing. Ambiguity and incomplete tasks fail closed.
- Maximum two internal write calls per proposal. Notes exclude retrieval timestamps
  from their duplicate key; source retrieval times remain in the displayed receipt.
- Timeout/partial-save outcomes keep per-object read-back status. Reconciliation
  is reads only. No automatic replay of an uncertain consequential write.
- Sensitive input checks are defense in depth, not comprehensive DLP. Do not input
  credentials, lockbox/access instructions, SSNs or private financial documents.
- Source bodies remain in Drive. The footer holds stable pointers and the last
  build review timestamp; it does not pretend that Drive was refreshed on page load.

## Verification and live pilot

The first real buyer workflow was completed through the authenticated connected
FUB tools after the owner reviewed and explicitly approved the exact note and
existing-task update. The agent retrieved the related sent email, preserved the
unverified rental condition and unknown offer date, wrote one note, updated the
existing task without changing its due date, and independently read both back.
No communication was sent. Live names, property details, IDs, note/task bodies and
mail evidence remain in FUB/Gmail and the authorized task, not in this repository.

**That live connector pilot is distinct from browser end-to-end acceptance.**
The browser's complete capture/review/simulated-save path was tested with fictional
data. The hosted app separately passed live owner login, real buyer retrieval,
real AI preparation, combined phone-width review and actual server-restart recovery.
The prior pilot's records were read, not duplicated. Hosted renewal and an independent
browser session passed. Hosted write/read-back and actual-phone acceptance remain open.

33 tests cover buyer discovery across stages, unclassified contacts, bounded name
search, assignment/classification checks, provenance, no pre-approval writes, immutable/replaced approval,
wrong-target/stale-state failures, completeness, duplicate avoidance, task reuse,
partial writes, read-only recovery, sensitive inputs, dates, HTTP protections,
OAuth state/PKCE, streamed MCP responses, signed owner identity, encrypted storage,
fresh-process recovery, restart-safe receipts and refresh rotation.

The existing runtime/lead-engine suites pass. The full repository static gate
still has eight previously documented failures (T-10/11/12/19/23/25/28/38), matching
the baseline described in `docs/FUB-OAUTH-CONNECTION.md`; this change does not
weaken or suppress those checks.

Protocol implementation references: [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
and [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).
