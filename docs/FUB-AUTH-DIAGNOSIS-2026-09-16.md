# FUB reconnection diagnosis and verified local repair

Observed September 16, 2026, America/Chicago. This is an engineering record, with
no credential values, client records, raw login URLs or canonical source bodies.

## Cause established on this computer

The user-level settings and original checkout still selected an obsolete local
configuration. They requested `fub:read fub:write` without `offline_access`, used
the plaintext-file storage override, enabled the owner-retired read-only server,
and omitted the full server's exact registered callback and listener override.
The newer repository already contained the native-client renewal configuration;
that did not automatically repair this machine's older checkout or user settings.

The exact full-server credential expired on September 9, 2026 at 15:19:15 UTC.
It contained no refresh token. A fresh Codex process returned zero tools and
authentication required. A second read-only probe of protected storage also
failed authentication. Persistence of an expired access token alone cannot renew
access. No credential was deleted to diagnose this failure.

The separate connected FUB app was working. Its successful read did not establish
that the local Codex connection was working. These are independent OAuth sessions.

## Applied repair

- Preserve the existing full MCP endpoint, public native client, 38-tool allowlist,
  identity, permissions and approved internal-write boundaries.
- Align user and original project settings with the existing approved three scopes:
  `fub:read`, `fub:write`, `offline_access`.
- Pin the existing full callback and matching listener port from the authentication
  record. No new application, callback allowlist or provider setting was created.
- Select protected persistent credential storage (`keyring`), verified on this
  installation as encrypted MCP storage backed by the Windows credential store.
- Explicitly disable the retired server. Simply omitting it in a project does not
  override an enabled entry inherited from user configuration.
- Complete one authorization through Codex itself after correcting configuration.
  Codex persisted the replacement encrypted and removed its obsolete plaintext entry.
  No credentials were copied to the buyer app or another service.

The original checkout's unrelated uncommitted changes remain intact. Its connection
repair is local configuration; no merge of the older checkout was performed.

## Verification

| Check | Observed result |
|---|---|
| Hosted resource metadata | HTTP 200, correct full MCP resource and Auth0 issuer |
| Unauthenticated MCP | HTTP 401 promptly, expected access enforcement |
| Auth0 discovery | HTTP 200; authorization-code and refresh grants advertised |
| Existing connected app | Bounded read succeeded; connection preserved |
| New credential metadata | Correct client and issuer; refresh present; all three scopes; future expiry |
| New desktop-binary process | 38 tools and authorized exact bounded buyer read, no login |
| Real renewal | Access token renewed; refresh token rotated; same client, issuer and scopes; future expiry persisted encrypted |
| Fresh process after renewal | 38 tools and exact bounded read, no login |
| Separately installed CLI 0.153.4 | Fresh process also loaded 38 tools and completed the bounded read |

The desktop binary tested was 0.154.0-alpha.6.2. Its installed path differed from
the earlier machine-specific recovery example; diagnostics resolved the actual
running executable. No binary upgrade was necessary to repair this incident.

Renewal was tested by making only this credential's local cached expiry due under
the matching credential and encrypted-store locks. Codex performed the actual
provider exchange and persisted the rotated credential. System time, token contents,
provider lifetime, other credentials and CRM records were unchanged. This verifies
real renewal, not a claim that a full access-token lifetime elapsed. Diagnostics
emitted only presence flags, scope names, expiry validity and change booleans.

The connection regression gate now checks protected storage and an explicit
disabled override for the retired server. It passes; the same eight previously
documented unrelated static failures remain (31/39 overall).

## Remaining provider sign-in and availability limits

The retained application's Auth0 dashboard was inspected directly: refresh rotation
is enabled, idle lifetime is 604800 seconds (seven days), maximum lifetime is
2592000 seconds (thirty days), and overlap is five seconds. Both existing loopback
callbacks remain registered. This repair did not change those provider settings.
The earlier recovery record documents a 24-hour access-token lifetime. Real refresh
issuance and rotation were verified on this computer and in Auth0's successful
refresh log at 2026-09-17T01:06:40.667Z.
Provider expiry, revocation, reuse detection, account/security changes or required
MFA can still require human sign-in. Do not promise permanent login.

The live Auth0 log at 2026-09-17T00:55:09Z explicitly warns that the Google connection
uses development keys and must use its own credentials for production. This is a
confirmed production-readiness gap, not an established cause of the missing local
refresh token or this run's browser error.
The in-app browser separately showed `invalid_request` with a lost provider login
session. The repaired native connection completed through the normal browser.

Render responded promptly during the bounded checks, and authenticated calls
worked. The signed-in Render dashboard showed the existing full FUB service deployed
on Starter in Oregon; the separate read-only service was also deployed. No service
or environment value was changed. Historical uptime was not audited. An
unauthenticated 401 is not evidence of server downtime.

## Approved obsolete registration cleanup

Auth0 dynamically registered two old Generic applications named Codex with callback
ports 51616 and 54273 (client ID suffixes WgKXU4 and sApQjU). Neither matched this
computer's current configuration or appeared in the available bounded log search.
That absence is limited by retention and does not prove that no other device used
them. After exact owner approval, only these two entries were permanently deleted.
Full page reload verified their absence and the four retained applications:
Blaise Codex FUB MCP, Blaise FUB MCP (Test Application), ChatGPT, and Default App.

The connected app's stage read passed. A separately started native Codex process
then loaded all 38 FUB tools and completed a stage read with protected existing
credentials, without OAuth login or dynamic registration. Current machine and
both checkout configurations pin the named native client. This prevents that
configured connection from creating fresh generic entries during reconnection;
unconfigured devices or other clients can still register their own applications.
The dashboard's ten-application/SSO-limit tooltip persisted after cleanup, so no
claim is made about the tenant's complete remaining quota.

## Computer-off mobile requirement

| Component | Depends on this computer? |
|---|---|
| Full FUB MCP and its FUB API credentials on Render | No; remote service |
| Auth0 token issuance and renewal | No; remote service |
| Local Codex client and its encrypted credential store | Yes, to run that local client |
| Local buyer workspace at `127.0.0.1:4317` | Yes; Node process and computer must remain running |
| Local buyer workspace OAuth session | Yes; separate in-memory session, cleared by restart or 30-minute expiry |
| Hosted buyer preview at `blaise-buyer-workspace.onrender.com` | No; separate Render Node service and persistent encrypted disk |

**The local buyer app is not accepted for computer-off mobile use.** Repairing
Codex's credentials does not repair or persist the app's independent session.
The existing hosted FUB MCP was retained. A separate hosted buyer preview is now
deployed with private authenticated HTTPS, an exact web callback, encrypted
persistent refresh storage, serialized rotation and exact owner verification.
Final phone acceptance remains open. Do not copy the native credential store, publish client
records as static files, use a local tunnel, or lengthen provider limits to mask this.

Deployment acceptance requires sign-in and a bounded read from an actual phone,
backend-restart recovery, real refresh rotation, and access with this computer off.
The owner approved the additional $7.25/month hosting and separately approved
`https://blaise-buyer-workspace.onrender.com/auth/callback`. The exact URL was added
to the retained native application and read back after reload; both original
loopback callbacks and token limits remained unchanged. The owner entered the AI
key through Render. The deployed app authenticated the owner, retrieved real buyers,
generated a real AI draft and displayed its combined review at phone width. Its
actual server restart resumed the browser session and fresh FUB reads without login.
This does not yet verify hosted token renewal or an actual independent phone session.

## References

- [Existing connection record](FUB-OAUTH-CONNECTION.md)
- [Codex MCP settings and callbacks](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Codex credential-storage setting](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Auth0 refresh expiration](https://auth0.com/docs/secure/tokens/refresh-tokens/configure-refresh-token-expiration)
- [Auth0 development-key limitations](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/devkeys)
