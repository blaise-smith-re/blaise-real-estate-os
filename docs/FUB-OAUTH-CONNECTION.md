# Full FUB MCP connection — focused infrastructure proposal

Owner direction, 2026-09-10: retire the separate read-only OAuth lane, preserve
historical evidence and use one healthy `blaise_fub_full` service. This technical
patch is separate from Lead Engine PR #6 and does not merge or modify it.

The primary implementation and recovery record is
[blaise-fub-mcp OAuth recovery](https://github.com/blaise-smith-re/blaise-fub-mcp/blob/codex/fub-oauth-recovery/docs/OAUTH-RECOVERY.md).

## Proposed configuration

- Keep the full MCP endpoint, existing 38-tool allowlist and all workflow authority.
- Remove the active retired `blaise_fub_read_only` config entry, not its history.
- Pin the public native client ID
  `https://chatgpt.com/oauth/codex/Msr2-imGFcgW/client.json` and its server-specific
  loopback path. Codex skips registration for a configured client ID. The client
  must first be imported and authorized in Auth0; until then this branch is not
  a working production configuration and login must not be represented as fixed.
- Leave the callback port ephemeral. The hosted native metadata omits the port;
  Auth0's variable-port acceptance remains part of live acceptance. No wildcard
  callback, token extraction, client secret, FUB credential or new proxy.

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
Its exact Anthony Nguyen relationship lookup remains pending until a successful
bounded response and identity adjudication are recorded. This patch does not edit
the checkpoint, board or PR #6.

## Validation for this proposal

The existing 40 runtime tests pass. Static validation is 31/39; the same eight
failures (T-10/11/12/19/23/25/28/38) were independently reproduced in an untouched
worktree at `f9633c8`. T-39 now checks the owner-directed single connection,
reusable public client, exact callback and retained read/write tools. A TOML parse
and semantic comparison verified the full server's original settings and all 38
tools are unchanged apart from the added public OAuth identity. Live login,
restart, exact read and client-count checks remain pending Auth0 dashboard access.
