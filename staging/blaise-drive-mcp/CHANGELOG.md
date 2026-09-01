# Changelog

## [0.1.0] — 2026-09-01 — Initial build

First implementation. Built, tested offline, **not live-certified** — no Google credential exists
yet, so no live API call has ever been made from this code.

### Added
- **Zero-dependency MCP stdio server** (`src/server.js`) — JSON-RPC 2.0 implemented directly.
- **Google client** (`src/google/client.js`) — OAuth refresh-token flow, bounded retry, request
  timeouts, layered secret redaction, stable error codes, account binding.
- **Drive v3** (`src/google/drive.js`) — search returning every candidate, metadata with a
  canonical-target verdict, copy, rename/move, permissions, exact-name lookup.
- **Docs v1** (`src/google/docs.js`) — document read with `revisionId`, mandatory revision-guarded
  `batchUpdate`, local operation allowlist, table-aware text extraction, version parsing, smart-
  punctuation normalization.
- **`canonical_doc_maintenance`** (`src/canonical/maintenance.js`) — the 21-step controlled sequence:
  preflight → exact target → MIME → LEGACY rejection → read → version check → revision capture →
  pre-write uniqueness → idempotency → archive → rename → place → verify archive → patch → read back →
  verify content/version/links → verify archive → verify exactly one current canonical → report.
- **`canonical_source_recovery`** (`src/canonical/recovery.js`) — the IF-014 model. Holds the write
  on a stale pin, nominates by exact title with evidence, never auto-follows, refuses ambiguity.
- **8 MCP tools** (`src/tools.js`) — 4 read, 4 write, centrally gated.
- **`scripts/authorize.js`** — one-time OAuth bootstrap; writes no credential file.
- **Tests — 50/50.** `test/adversarial.js` (40, incl. all 35 required scenarios) against a faithful
  in-memory fake; `test/protocol.js` (10) driving the real server over stdio.
- **Docs** — README, OAUTH-SETUP, CERTIFICATION, LIMITATIONS, SECURITY, DECISIONS.

### Defects found by the suites and fixed
1. Redaction defaulted to `process.env`, missing credentials injected from anywhere else (A-36).
2. An archive-failure test injected a *retryable* error and passed for the wrong reason (A-09).
3. Archive errors reported the HTTP cause, losing "the archive step failed, no edit attempted" (A-09/A-29).
4. **No request timeout** — a stalled connection hung the tool call forever (P-08).
5. **Parse errors were silently swallowed** — `replyError` returned early on `id: null` (P-11).
6. **Responses lost when stdin closed mid-call** — the process exited without draining (P-08/P-11).

Items 4–6 were live-protocol bugs invisible to the fake. They are why `test/protocol.js` exists.

### Known limitations
See [docs/LIMITATIONS.md](docs/LIMITATIONS.md). The two that matter most: the archive step cannot be
revision-guarded because Drive offers no such precondition (L-002), and the `drive` scope is broader
than this connector needs because Google publishes no write-to-existing-files-only scope (L-003).

### Not done
Live certification stages 3–9. **HOLD H-11 remains in force** — nothing here authorizes an
autonomous edit to a canonical Drive document. The capability exists; the authority does not.
