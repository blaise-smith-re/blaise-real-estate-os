# Hosted buyer workspace deployment proposal

Status: code prepared and synthetic reliability tests passed; not deployed or
accepted for real phone use. No production FUB service was changed.

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
taxes, usage overages and OpenAI API usage are additional. No charge has been
approved or incurred by this build. Request approval at the prepared deployment
step, including the additional recurring hosting cost.

Set `WORKSPACE_ORIGIN` to the exact HTTPS origin assigned by Render. Register
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
It must contain at least 43 random, non-whitespace characters. Enter the OpenAI API
key directly into Render's secret environment input; never paste it into a task,
source file or browser client. The proposed model is pinned to
`gpt-5.4-mini-2026-03-17`, whose official model page lists Responses and structured
output support. Actual account access is still unverified until the key is present.

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

- The retained native client and owner account were inspected. Register and verify
  the exact hosted callback without removing either current loopback callback.
- Replace the existing Google connection's Auth0 development keys with the owner's
  production Google OAuth credentials. The current Auth0 log explicitly flags this;
  credentials must be entered by the owner in the provider UI.
- Approve the concrete additional hosting cost and callback change.
- Provide the API key through Render's secret input, then test model availability.
- Deploy the exact reviewed commit, verify anonymous access denial and owner login.
- Retrieve a real buyer in the hosted app, verify source times and copy-only text.
- Complete an approved real app workflow with read-back, without duplicating the
  prior connector pilot's note or task.
- Restart the actual service and verify the same browser can resume; exercise
  safe renewal and an independent fresh browser session.
- Confirm use from the owner's actual phone with the local process stopped.

References: [Render disks](https://render.com/docs/disks),
[Auth0 rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
