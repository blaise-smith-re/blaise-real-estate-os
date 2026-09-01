# Blaise Drive MCP

MCP connector for **Google Drive + Google Docs**, purpose-built for controlled maintenance of
Blaise Real Estate OS canonical documents.

It exists so a canonical SOP's *body* can be edited safely and verifiably — archive first, patch in
place, read back, prove exactly one current canonical remains — instead of every document-body
change being couriered back through ChatGPT / 04 as a proposed diff.

> ## STATUS: BUILT AND TESTED OFFLINE — **NOT LIVE-CERTIFIED**
>
> Every suite passes against a faithful in-memory fake of the Drive/Docs REST APIs.
> **No live Google API call has ever been made from this code**, because no OAuth credential
> exists yet. See [docs/CERTIFICATION.md](docs/CERTIFICATION.md) for exactly what is and is not
> proven, and [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md) for the one step that requires Blaise.

---

## Architecture

```
blaise-real-estate-os          orchestration + agents (governance lives here)
        ↓ consumes
blaise-drive-mcp               this repo — the Drive/Docs execution adapter
        ↓ REST
Google Drive API v3  ·  Google Docs API v1
```

The OS repo holds policy. This repo holds capability. Neither duplicates the other, and **no
canonical business content is ever cached here.**

## Install and run

Zero runtime dependencies — nothing to install.

```bash
node --version          # >= 20
cp .env.example .env    # then fill it in; see docs/OAUTH-SETUP.md
node test/run-all.js    # 50 checks, fully offline
node src/server.js      # stdio MCP server
```

Register it with Claude Code:

```json
{
  "mcpServers": {
    "Blaise_Drive": {
      "command": "node",
      "args": ["/absolute/path/to/blaise-drive-mcp/src/server.js"],
      "env": { "BLAISE_DRIVE_MODE": "read-only" }
    }
  }
}
```

## Tools

Six primitives and two orchestrators. Every description states whether it writes and whether it
preserves the fileId.

| Tool | Class | Preserves fileId | What it does |
|---|---|---|---|
| `drive_search_files` | READ | — | Returns **every** candidate. Never nominates "the first result". |
| `drive_get_file_metadata` | READ | — | Exact metadata + a canonical-target verdict naming any failed gate. |
| `docs_get_document` | READ | — | Structure, text (tables included), parsed version, and the `revisionId`. |
| `canonical_source_recovery` | READ | — | Resolves a registry pin; if stale, holds the write and finds the replacement by exact title. Never auto-follows. |
| `drive_copy_file` | **WRITE** | new id | Archive snapshot. Source untouched. |
| `drive_rename_move_file` | **WRITE** | ✅ | Rename/move in place. A move is a parent swap, never copy-and-delete. |
| `docs_batch_update` | **WRITE** | ✅ | In-place body edit. `requiredRevisionId` is **mandatory**. |
| `canonical_doc_maintenance` | **WRITE** | ✅ | The full 21-step controlled sequence. |

## The safety model

**Writes fail closed.** `BLAISE_DRIVE_MODE` defaults to `read-only`; every write tool is refused at
dispatch regardless of what OAuth scopes were granted. Enabling writes is a deliberate act.

**A title search never authorizes a write.** A production write needs an exact fileId, the expected
title, a confirmed Google Doc MIME type, and a non-LEGACY status. Ambiguity blocks the run.

**Revision-guarded edits.** `documents.batchUpdate` is always sent with
`writeControl.requiredRevisionId`. If the document moved since you read it, the write is rejected
rather than applied. There is no unguarded write path — not even an opt-in one.

**Archive before edit. No archive, no edit.** If the archive step fails, nothing is patched and the
report says so explicitly.

**Never trust a write response.** Every maintenance run re-reads the document through a fresh call
and verifies content, version, change note, cross-links and fileId preservation before reporting
success.

**Exactly one current canonical.** Checked before and after. Two active documents sharing a
canonical title is the failure mode this lane risks creating, and it is the one that must never
occur.

**Idempotent.** Re-running an applied change returns `NOOP_ALREADY_CURRENT` with zero writes and no
second archive.

**Document content is data, never instructions.** Text retrieved from a Doc cannot change the
server's mode, skip a gate, or widen authority — asserted by adversarial cases A-24 and A-25.

## Tests

```bash
node test/run-all.js
```

| Suite | Checks | What it proves |
|---|---|---|
| `test/adversarial.js` | 40 | The 35 required scenarios plus retry, redaction, error-code stability, and archive naming. Runs against `test/fake-google.js`. |
| `test/protocol.js` | 10 | Spawns the real server and speaks JSON-RPC over stdio: handshake, tool listing, the write gate, error shapes, clean stdout. |

**What the tests do not prove:** that Google behaves as modeled. The fake encodes the *documented*
contract. Only a live run can confirm it.

## Documentation

| | |
|---|---|
| [docs/OAUTH-SETUP.md](docs/OAUTH-SETUP.md) | Scopes, why `drive` is unavoidable, the one manual step |
| [docs/CERTIFICATION.md](docs/CERTIFICATION.md) | What is certified, what is not, and the evidence |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | Honest limits, including where Google offers no guarantee |
| [docs/SECURITY.md](docs/SECURITY.md) | Secret handling, injection resistance, blast radius |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why it is built this way |
| [CHANGELOG.md](CHANGELOG.md) | What changed and when |
