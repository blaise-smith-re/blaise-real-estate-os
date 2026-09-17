# Build checkpoint — September 16, 2026

**BUILD RESULT** — Local buyer workspace implemented and synthetic browser flow
verified. One separately authorized real connector workflow saved and independently
verified a note and existing-task update. Client text remains unsent. Native Codex
reconnection root cause repaired; hosted mobile app is not accepted or deployed.

**FILES CHANGED** — `production/buyer-workspace/` implementation and tests; package
scripts; project MCP persistence/retired-lane override; connection regression gate;
root README, changelog, decisions, improvement findings and authentication diagnosis.
Machine and original-checkout auth settings were repaired without discarding
unrelated user edits. Those local settings are distinct from this worktree.

**TESTS RUN / RESULT** — 28 buyer-workspace tests and 83 existing runtime/lead-engine
tests passed. Runtime configuration check passed. Synthetic browser flow verified
at desktop and 390-pixel phone width. Connection gate passed; static suite remains
31/39 with eight documented baseline failures. Live native login, protected
persistence, actual renewal/rotation and fresh-process bounded reads passed.
Hosted-mode tests cover encrypted persistence, process restart, owner verification,
uncertain rotation, interrupted-save recovery and anonymous access denial. The
390-pixel browser flow also recovered a verified synthetic receipt after reload.
After the two specifically approved obsolete Auth0 applications were deleted,
a fresh native process loaded 38 tools and completed a stage read without login.

**CERTIFICATION IMPACT** — Narrow connector pilot and local prototype evidence only.
No deployed app, release family, new tool authority or scheduled operation certified.

**DRIVE/SOP IMPACT** — Current canonical sources retrieved; no source bodies cached
or canonical files modified. Source pointers remain separate from client records.

**DOCUMENTATION UPDATED** — README, changelog, decisions, findings and
`docs/FUB-AUTH-DIAGNOSIS-2026-09-16.md` describe the evidence and access boundaries.

**OPEN HOLDS** — Hosted implementation and encrypted durable renewal are prepared,
not deployed. Hosting cost approval, exact web callback, protected API-key entry,
production Google OAuth credentials, real AI availability, real-phone/computer-off
acceptance, MLS and Ylopo controls, and automatic Drive/Gmail enrichment remain open.
The live Render account and retained Auth0 registration were inspected. The local
app uses its own session-only credentials; native Codex repair does not deploy it.

**NEXT BUILD ACTION** — Deploy the reviewed isolated branch through the existing
Render account after the concrete cost and callback approvals. Enter secrets only
through the hosting/provider UI. Validate backend restart, renewal, actual phone
access and computer-off access before expansion. See `DEPLOYMENT.md`.
