# Exact shortlist relationship lookup

`relationship.boundedLookup` continues to use the existing `runtime/adapters/fub-read.js`. It accepts one source-backed shortlisted name and a limit of three. It does not discover leads in FUB. A name hit requires independent identity adjudication before it can supply relationship facts. No hit, unavailable tool, failed authentication and incomplete response are different states; none proves no relationship.

## Diagnosed live capability gap

This section records the earlier failure, not the current authentication state. The accepted recovery below supersedes the pending-login instructions for the saved September 10 checkpoint.

The original review host did not expose FUB tools. The clone's read-only configuration omitted `find_contact`, while the existing full-server configuration included it. The clone was not in the local trusted-project list, so its project configuration was not loaded by the CLI. The existing trusted workspace's configured full MCP server reported **Not logged in**. Configuration text is not evidence of a callable authenticated tool.

The engine now discovers exact read capability from the host's enumerated inventory. It can use the existing read-only server or an existing full server through a structurally restricted facade exposing only `find_contact` and `get_contact`. Other tool names are rejected before invocation; the runtime adapter and its write guard remain unchanged. This fixes the read-only-prefix assumption without expanding discovery or effect authority. An OAuth scope containing write permission never authorizes a write in this engine.

## Historical recovery investigation

Preserve the working MCP configuration and registered app. Inspect the task host's actual enabled tool inventory, project trust/configuration and authentication status. Use the existing MCP connection's supported login/reconnect flow. Do not create another FUB app, copy credentials into the repository, mark an unrelated clone trusted automatically, or fetch tokens from browser storage.

After the reported Google 401 malformed-request failure, the operator checked the server's advertised protected-resource metadata and authorization-server discovery, and regenerated the **existing** connection's OAuth flow. The resource matched the configured MCP URL; issuer and authorization/token endpoints matched Auth0; PKCE S256 was supported; the generated redirect matched the configured loopback callback. Blaise completed sign-in in the Google profile used to create the connection. These checks do not independently inspect the private Auth0 application callback allowlist or Google upstream configuration.

The first successful login used a `fub:read` override. A subsequent real MCP initialization failed with `insufficient_scope` and `Required scope: fub:write`. The existing full server requires its configured read/write scopes even to initialize. Recovery must therefore use the existing connection's configured scopes, explaining the reason to Blaise, while the engine's read facade continues to prohibit writes. Do not repeatedly attempt a known-insufficient scope or describe a successful OAuth callback as a successful relationship lookup.

Discard any expired/failed authorization URL. Generate a new flow only when the user is ready to complete it, keep the callback listener running and open that new URL. Authentication requires Blaise. Record only non-secret diagnosis/status in review evidence, never OAuth state, PKCE values, authorization codes or tokens. The existing app's registered callback may require owner-side verification if the fresh flow still fails; preserve configuration until a concrete mismatch is demonstrated.

After successful authentication, reconnect/refresh the existing MCP tools in the host and enumerate them again. If this task still has no callable exact read tool, state that capability gap and preserve the shortlist. Do not substitute a broad FUB scan, direct unapproved API client, a fake callback result or a new connection. A fresh authenticated host can resume the same board/checkpoint and perform the one exact lookup. A public event's attendance prerequisites remain separate from cold outreach and FUB readiness.

## Accepted recovery and saved-checkpoint reconciliation — September 10

Work/owner approved durable authentication. MCP PR #5 was squash merged at `a1dfa3791ab72d19d2b3c206f8c0eaefecee67b1`, then OS PR #7 was merged at `6d186ed948696994dcb7cb0166fac1b38b447b47`. The active project has one full connection with the existing pinned public native client and configured `fub:read`, `fub:write`, `offline_access` scopes. The separate read-only OAuth lane is retired; compatibility code is not an instruction to restore it. See [the OS connection record](../../docs/FUB-OAUTH-CONNECTION.md).

One fresh Codex 0.154.0 process from trusted `C:/GitHub/blaise-real-estate-os` after these merges initialized `blaise_fub_full` with OAuth authentication and all 38 configured tools. No login or CRM query was repeated for this integration.

The owner-authorized infrastructure acceptance already completed the saved shortlist's exact `find_contact` request with limit 3. The private request/result evidence records **BOUNDED-NO-MATCH: zero returned people**, without a tool error. Reconcile that completed result against the saved board/candidate identity; do not invoke a fake adapter callback or rerun the lookup just to fill a result field. A name lookup does not prove global nonexistence, no relationship, identity resolution or contact eligibility.

Keep the research checkpoint and source capture times unchanged. Add the dated relationship reconciliation to the existing private board and selected prep, retaining the original numerical ranking as a historical snapshot. Source freshness must remain explicit; this reconciliation is not a new Matrix read. Any future pursuit still requires the applicable source/identity/channel checks. No FUB write, outreach or registration is authorized.

Historical Google 401 cause remains **OPEN / UNVERIFIED**. Auth0 Google development keys remain a non-blocking production-hardening item. Do not reopen OAuth investigation unless current authentication fails.
