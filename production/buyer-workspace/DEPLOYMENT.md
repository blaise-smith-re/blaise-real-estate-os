# Hosted buyer workspace deployment proposal

Status: private hosted preview deployed September 16, 2026 at 9:37 PM CDT;
final real-phone acceptance remains open. The existing FUB service was unchanged.

## Live deployment evidence

- URL: https://blaise-buyer-workspace.onrender.com
- Render service: `srv-dall4cqjnfac739ur6h0`; deployed commit:
  `cd8921ecfe2d2af203f0ce4c3c9bb2590eb72da2` (updated at 10:14 PM CDT).
- The owner approved $7.25/month base hosting and owner-only access, then separately
  approved the exact `/auth/callback` URL. Auth0 read-back after reload confirmed
  that URL plus both original loopback callbacks; token limits were unchanged.
- All 33 workspace tests passed locally and in Render's build. A fresh unauthenticated
  process confirmed healthy HTTPS, secure session cookies, denied buyer reads and
  saves, and rejection of a foreign origin.
- The live browser authenticated the configured owner, retrieved three active
  buyers and the prior pilot's saved note/task, generated a real AI interpretation,
  and displayed the combined review at 390 pixels without horizontal overflow.
  The test draft was discarded; the prior pilot's writes were not duplicated.
- A real Render restart started a new process at 9:40 PM CDT. The existing browser
  session retrieved buyers and a fresh brief after reload without another login.
- The owner entered and saved the new Google credentials in Auth0. Reload confirmed
  the intended client and removal of the development-key warning; Auth0's Google
  connection test returned Successful transaction. Profile-only permissions stayed
  unchanged. No additional Auth0 application was created.
- A separate Chrome session authenticated and retrieved three buyers. The live
  connection check performed a real refresh exchange and bounded FUB read at
  9:56 PM CDT. An actual server restart created a fresh process at 9:57 PM; both
  browser sessions retrieved buyers again at 9:58 PM without another login. A
  second real renewal after restart also passed, exercising the persisted rotated
  credential. Brief 502 responses during the single-instance restart cleared after
  routing recovered; planned restarts/deployments have a short availability gap.
- A newly approved hosted write/read-back and actual phone/computer-off use remain
  acceptance checks. The existing connector pilot was not duplicated.
- The buyer list was corrected to cover assigned contacts across all stages,
  with separate buyer/unclassified groups and bounded name search. Live search and
  briefs for previously excluded Nurture contacts passed; the unclassified warning
  appeared for a contact without buyer tags. The updated picker was inspected at
  390 pixels with no horizontal overflow. No contact stages or tags were changed.

## Existing infrastructure inspected

The authenticated Render project contains the deployed `blaise-fub-mcp` Python
Starter service and the separate read-only service. Its linked GitHub integration
already has access to `blaise-real-estate-os`. FUB credentials remain on the
existing service. No OpenAI API key, shared environment group or buyer app exists
there. Only environment variable names were inspected; secrets remained hidden.

## Concrete deployment

Use the existing Render account and project, with a separate **Starter Node web
service**, one instance, Oregon, named `blaise-buyer-workspace`. Reuse this repository
and the `codex/buyer-workspace` branch. Keep automatic deployment **off**. The
build/start/health commands and 1 GB persistent disk are in `render.yaml`. The
repository root is required because the app reuses the existing controlled FUB
write adapter, source pointers and brand assets.

The live creation form showed **$7/month** for Starter plus **$0.25/GB/month**
for disk on September 16, 2026. This proposal adds **$7.25/month base hosting**;
taxes, usage overages and OpenAI API usage are additional. The owner approved the
charge and the service was created. OpenAI billing was configured by the owner;
the saved automatic refill purchase limit was $20/month, separate from hosting.

The app uses Render's documented `RENDER_EXTERNAL_URL` as its exact HTTPS origin.
For a future custom domain, explicitly set `WORKSPACE_ORIGIN` instead. Register
only `<that-origin>/auth/callback` as an additional callback on the existing
approved Auth0 public native client, retaining its existing callback and scopes.
Do not replace any current registration, modify token lifetimes or use wildcard
callbacks. Scope remains `fub:read fub:write offline_access`; PKCE is mandatory.
An owner-approved Auth0 identity (`WORKSPACE_OWNER_SUB`) must match the signed
RS256 access token exactly. A new login from another account cannot access client
records even if that account can authenticate to the Auth0 tenant.

The callback and owner identity must be inspected and approved before changing
the security-sensitive provider registration. This is separate from the native
Codex connection, which was already repaired and verified.

Generate `WORKSPACE_ENCRYPTION_KEY` in Render, and keep it stable across deploys.
It must contain at least 43 random, non-whitespace characters. The dashboard's
Generate button currently creates only 32 hexadecimal characters (16 random
bytes). For that route, generate a second independent value in
`WORKSPACE_ENCRYPTION_KEY_PART_2`; the app requires two distinct 32-character hex
values and combines them before key derivation. Preserve both across deploys;
never inspect or copy either value. A single longer generated secret remains
supported without the second variable. Enter the OpenAI API
key directly into Render's secret environment input; never paste it into a task,
source file or browser client. The proposed model is pinned to
`gpt-5.4-mini-2026-03-17`, whose official model page lists Responses and structured
output support. Actual account access and AI drafting have been verified.

## Persistence and renewal

The persistent disk contains AES-256-GCM encrypted session envelopes with random
nonces and authenticated record identity/expiry. It contains no plaintext tokens,
buyer records or draft bodies. The key remains in the host environment, outside
the disk and repository. Browser cookies are opaque, `Secure`, `HttpOnly`,
`SameSite=Lax`, host-only cookies. Client requests must also pass exact origin and
CSRF checks. No browser token storage or audio capture is used.

One SQLite process lock prevents two workers from using the same rotating token.
Refresh is serialized and replacement credentials are committed before CRM calls.
Known transient token failures preserve the credential. A rejected access token
does not delete the refresh credential. Denied permissions are reported separately
from expired authorization. A fresh process initializes a new MCP session.

Provider-required sign-in still occurs when Auth0 expires/revokes the grant, a
refresh response is lost during rotation, the user logs out, or the app's session
reaches seven days idle or thirty days absolute. An interrupted rotation is not
blindly replayed, because reuse can invalidate the token family. The app does not
weaken or lengthen the provider's existing limits. Disk loss or a changed encryption
key also requires fresh authorization. Persistent disks have deployment downtime
and provider-managed backups; backups may retain encrypted envelopes beyond the
app's logical expiry. Restoring an old disk backup must invalidate old sign-in
sessions before use, so stale refresh credentials are never reused.

Working CRM context and unapproved reviews expire after 30 minutes. Approved save
receipts remain for up to 24 hours to support read-only reconciliation; their
persisted form excludes the raw brief snapshot. A pre-write checkpoint blocks
side effects if storage fails. An attempted save is never replayed after restart.
Logout deletes this browser's active session. FUB remains the record of truth.

## AI boundary

The Responses request contains only the buyer's first name, property/tour label and
the supplied showing feedback. It uses `store: false`, no tools, and a strict output
schema. It does not receive CRM IDs, full contact records, retrieved note/task
history or canonical document bodies. `store: false` is not a claim of zero
provider retention; the account's OpenAI data controls still apply.

Every proposed source excerpt must be an exact substring of the feedback. A
preference must cite a client statement. The model cannot assert a verified
property fact or set a task date. Speaker classification and paraphrased proposals
remain reviewable judgments, not verified facts. The same immutable review and
single CRM write adapter govern AI-assisted and manual preparation.

## Release acceptance still required

- Done: retained native client and exact owner inspected; approved hosted callback
  registered and verified without removing either current loopback callback.
- Done: the owner saved the owned Google OAuth credentials in Auth0; persisted
  configuration and the Google connection test passed. The existing Google project
  remains in Testing; this profile-only login does not change the Drive integration.
- Done: concrete hosting cost and callback separately approved.
- Done: owner entered the API key through Render; real model drafting succeeded.
- Done: reviewed commit deployed; anonymous access denied and owner login verified.
- Done: real buyer retrieved with source times and copy-only text in the review.
- Complete an approved real app workflow with read-back, without duplicating the
  prior connector pilot's note or task.
- Done: actual service restart, hosted renewal and independent browser access.
- Confirm use from the owner's actual phone with the local process stopped.

References: [Render disks](https://render.com/docs/disks),
[Render assigned URL](https://render.com/docs/environment-variables),
[Auth0 rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
