# Build checkpoint — September 16, 2026

**BUILD RESULT** — Local buyer workspace implemented and synthetic browser flow
verified. One separately authorized real connector workflow saved and independently
verified a note and existing-task update. Client text remains unsent. Native Codex
reconnection root cause repaired. The private hosted preview is deployed, with
live owner login, buyer retrieval, AI drafting and actual server-restart recovery
verified. Final mobile acceptance remains open; see `DEPLOYMENT.md` for evidence.

**FILES CHANGED** — `production/buyer-workspace/` implementation and tests; package
scripts; project MCP persistence/retired-lane override; connection regression gate;
root README, changelog, decisions, improvement findings and authentication diagnosis.
Machine and original-checkout auth settings were repaired without discarding
unrelated user edits. Those local settings are distinct from this worktree.

**TESTS RUN / RESULT** — 29 buyer-workspace tests and 83 existing runtime/lead-engine
tests passed. Runtime configuration check passed. Synthetic browser flow verified
at desktop and 390-pixel phone width. Connection gate passed; static suite remains
31/39 with eight documented baseline failures. Live native login, protected
persistence, actual renewal/rotation and fresh-process bounded reads passed.
Hosted-mode tests cover encrypted persistence, process restart, owner verification,
uncertain rotation, interrupted-save recovery and anonymous access denial. The
390-pixel browser flow also recovered a verified synthetic receipt after reload.
After the two specifically approved obsolete Auth0 applications were deleted,
a fresh native process loaded 38 tools and completed a stage read without login.

**CERTIFICATION IMPACT** — Connector pilot, synthetic save/recovery and bounded live
hosted checks. No mobile release family or scheduled operation is certified.

**DRIVE/SOP IMPACT** — Current canonical sources retrieved; no source bodies cached
or canonical files modified. Source pointers remain separate from client records.

**DOCUMENTATION UPDATED** — README, changelog, decisions, findings and
`docs/FUB-AUTH-DIAGNOSIS-2026-09-16.md` describe the evidence and access boundaries.

**OPEN HOLDS** — Replacement of Auth0 Google development keys, hosted renewal and
write/read-back acceptance, independent browser and real-phone/computer-off tests.
MLS and Ylopo controls and automatic Drive/Gmail enrichment remain unsupported.
Hosting cost and callback approvals, protected key entry, deployment, real AI
availability, owner login and server-restart recovery are complete. Local mode
continues to have separate memory-only credentials.

**NEXT BUILD ACTION** — Finish Google credential handoff in the existing provider
UI, then verify fresh login, renewal and actual phone/computer-off access. Complete
the remaining hosted write/read-back acceptance without duplicating the already
saved real pilot. See `DEPLOYMENT.md`.
