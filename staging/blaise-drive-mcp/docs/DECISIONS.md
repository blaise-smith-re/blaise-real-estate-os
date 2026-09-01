# Decisions

## D-001 — Zero runtime dependencies
**2026-09-01 · ACCEPTED**

**Context.** The obvious build uses `@modelcontextprotocol/sdk` and `googleapis`. Neither was
installable in the build environment (npm blocked), which forced the question of whether they were
actually needed.

**Decision.** Implement both directly. MCP over stdio is JSON-RPC 2.0 with one JSON object per line;
Google Drive/Docs are plain REST over Node's built-in `fetch`. Neither contract is large.

**Consequence.** No install step, no supply chain, no SDK version drift, and the whole thing runs on
a stock Node 20+. It also matches `blaise-real-estate-os`, which is dependency-free with a
hand-rolled runner. The cost is roughly 150 lines of protocol handling we now own — and owning it is
what let us find and fix three real protocol bugs (timeout, parse-error, drain-on-exit) that an SDK
would have hidden.

## D-002 — Revision-guarded writes are mandatory, not optional
**2026-09-01 · ACCEPTED**

**Context.** `writeControl.requiredRevisionId` could reasonably be an opt-in parameter.

**Decision.** `batchUpdate` throws if `requiredRevisionId` is absent. There is no unguarded path.

**Consequence.** Every caller must read before writing, which is the correct sequence anyway. The
failure mode this removes — silently overwriting someone's concurrent edit — is invisible when it
happens, which is exactly why it cannot be left to caller discipline.

## D-003 — Writes fail closed
**2026-09-01 · ACCEPTED**

**Decision.** `BLAISE_DRIVE_MODE` defaults to `read-only`. Every write tool is refused at dispatch,
regardless of granted OAuth scopes. Gating lives in `dispatch`, not in individual tools.

**Consequence.** A misconfigured deployment is inert rather than dangerous, and a leaked credential
alone is not sufficient to write. Centralizing the gate means a future write tool cannot ship
without it — the failure mode is "new tool doesn't work" rather than "new tool has no gate".

## D-004 — Search returns every candidate and refuses to pick
**2026-09-01 · ACCEPTED**

**Context.** It would be convenient for `drive_search_files` to return the best match.

**Decision.** Return all candidates with a note that a title search does not authorize a write.
Ambiguity blocks a maintenance run rather than resolving to the newest or first result.

**Consequence.** More work for the caller, and the wrong-document edit becomes structurally hard
rather than merely discouraged. "The first search result" is how you edit somebody else's file.

## D-005 — Step names beat HTTP causes in error codes
**2026-09-01 · ACCEPTED · prompted by adversarial A-09/A-29**

**Context.** The archive failure path originally surfaced the HTTP cause (`BACKEND_ERROR`).

**Decision.** The code names the **step** (`ARCHIVE_FAILED`); the HTTP cause rides in `cause`.
Deliberate validation failures keep their own codes (`ARCHIVE_INVALID`, `DUPLICATE_ARCHIVE`).

**Consequence.** `ARCHIVE_FAILED` carries the safety-critical meaning — *the canonical document was
never touched* — which `BACKEND_ERROR` does not. "Couldn't create the archive" and "created a wrong
archive" are different problems with different remedies, so they keep different codes.

## D-006 — Idempotency is checked from document state, not from a ledger
**2026-09-01 · ACCEPTED**

**Context.** Detecting "already applied" could use a local record of past runs.

**Decision.** Read the document and check whether it is already at `newVersion` with the change note
present. No local state.

**Consequence.** Works across restarts, across machines, and after a lost response — the three cases
where a local ledger is least trustworthy (A-11, A-12). The document is the system of record; a
ledger would be a second one, and CLAUDE.md forbids parallel systems for good reason.

## D-007 — The fake models the contract; the protocol suite drives the real server
**2026-09-01 · ACCEPTED**

**Context.** With no credentials, all testing is necessarily offline. The temptation is to test only
against the fake.

**Decision.** Two suites. `adversarial.js` drives logic through the fake. `protocol.js` **spawns the
actual server** and speaks JSON-RPC to it.

**Consequence.** The protocol suite found three bugs the fake could never have surfaced: no request
timeout, swallowed parse errors, and responses lost when stdin closed mid-call. Testing your logic
against your own model of the world proves your logic, not your program.

## D-008 — Recovery nominates, never follows
**2026-09-01 · ACCEPTED**

**Decision.** When a registry pin resolves to a LEGACY/missing/wrong-typed document,
`canonical_source_recovery` holds the write, searches by **exact** title, and returns a candidate
plus evidence with `requiresApproval: true`. More than one candidate returns `AMBIGUOUS` with no
nomination.

**Consequence.** A superseded pin is recoverable without a human hunting for the new fileId, and
"a similarly named document" never becomes an edit target. Automating the *search* is safe;
automating the *decision* is not.
