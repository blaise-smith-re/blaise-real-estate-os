# Full FUB MCP connection — focused infrastructure proposal

Owner direction, 2026-09-10: retire the separate read-only OAuth lane, preserve
historical evidence and use one healthy `blaise_fub_full` service. This technical
patch is separate from Lead Engine PR #6 and does not merge or modify it.

The primary implementation and recovery record is
[blaise-fub-mcp OAuth recovery](https://github.com/blaise-smith-re/blaise-fub-mcp/blob/codex/fub-oauth-recovery/docs/OAUTH-RECOVERY.md).

## Proposed configuration

- Keep the full MCP endpoint, existing 38-tool allowlist and all workflow authority.
- Remove the active retired `blaise_fub_read_only` config entry, not its history.
- Pin the existing public native client ID `zVnhfzFBR7aX6np3JSAXf0Cnohu8fWuH`.
  Codex skips registration for a configured client ID. The Auth0 dashboard
  verified this existing native application, Google connection and both delegated
  full-MCP permissions. No new application or tenant-wide registration change is needed.
- Set callback URL `http://127.0.0.1:57185/callback/Msr2-imGFcgW` and listener port
  `57185`, matching the existing allowed URI. Identify any port conflict before
  retrying; do not randomize the callback or kill an unrelated process.
- Set explicit server scopes `["fub:read", "fub:write", "offline_access"]`. A controlled 0.154 login
  without them selected generic OIDC scopes and omitted FUB permissions. The
  corrected request used both FUB scopes, one correct resource and PKCE S256.
  It reached Google's account chooser and completed after owner sign-in.
- The owner approved adding only `offline_access`. API offline access is now ON;
  access tokens retain the 86,400-second lifetime. The existing native client uses
  rotation, 7-day idle expiry, 30-day maximum expiry and 5-second overlap/reuse
  protection. No new FUB permission, client, secret or MRRT was introduced.

The tenant supports DCR but has CIMD registration disabled and an application
quota warning. Reusing this native client avoids a new import and tenant-wide
changes. CIMD is a possible future migration, not a dependency. No wildcard,
browser token extraction, client secret, FUB credential or new proxy is introduced.

The exact callback ID is derived from the complete full-MCP URL, so it remains
stable across machines connecting to that URL. A future endpoint change requires
rechecking registration and callback identity, not creating disposable clients.

The operator handles executable discovery, tenant inspection, commands and tests.
On the investigated Windows machine, 0.154.0 is at
`%LOCALAPPDATA%/Programs/OpenAI/Codex/bin/codex.exe`; the desktop task inherited an
older bundled executable. Invoke the verified path rather than overwriting it.
OAuth credentials stay in Codex's local credential store and are never checked in.

## Acceptance and boundaries

Require clean relevant login, new-process initialization, expected tools, exactly
one approved `find_contact` read, and unchanged Auth0 client count on repeat login.
`codex mcp list` alone is insufficient evidence. Do not broaden CRM discovery or
perform a write to test auth. A granted `fub:write` scope is a server capability,
not an instruction or workflow authorization. Lead Engine retains its existing
`find_contact` / `get_contact` facade; other writes retain their existing route.

Business SOP/governance pointer alignment is a separate Work proposal. No canonical
Drive body, source-registry status, tool-policy permission, schedule or production
family changes in this patch. No release certification is claimed.

The saved Lead Engine Matrix checkpoint does not need repeating after auth recovery.
Its exact Anthony Nguyen lookup succeeded during this infrastructure validation
with zero returned matches. This does not prove absence under another identity.
The checkpoint may resume using that result; this patch does not edit the
checkpoint, board or PR #6.

## Validation for this proposal

The existing 40 runtime tests pass. Static validation is 31/39; the same eight
failures (T-10/11/12/19/23/25/28/38) were independently reproduced in an untouched
worktree at `f9633c8`. T-39 now checks the owner-directed single connection,
reusable public client, exact callback and retained read/write tools. A TOML parse
and semantic comparison verified the full server's original settings and all 38
tools are retained alongside the added public OAuth identity and explicit scopes.
Live login and repeat login succeeded using the same existing client. Separate
Codex processes enumerated all 38 tools; one exact read succeeded. The dashboard
still showed the same five application rows, with no new registration.
After owner approval, fresh login issued a refresh token with exactly the three
configured scopes. A controlled local cache-expiry trigger caused Codex's own
client to renew and rotate it; Auth0 logged the exchange at 23:08:58.874 UTC.
The store stayed encrypted, no credential values were printed, and provider
lifetime/system time remained unchanged. This was a real renewal, not a claim
that 24 hours elapsed. A subsequent new process loaded all 38 tools and its one
authorized bounded read succeeded. The application inventory stayed unchanged.
Fresh sign-in remains expected at refresh idle/maximum expiry or revocation.
The durable-authentication change is ready for Work review; PRs remain unmerged.
The old Google 401 still lacks parameter-specific evidence; the verified scope
defect and development-key warnings do not establish that error's precise cause.
