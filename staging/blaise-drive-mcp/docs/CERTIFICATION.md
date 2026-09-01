# Certification Evidence

> **Certify exactly what was exercised. Nothing broader.**

## Headline

**No live Google API call has ever been made from this code.** No OAuth credential exists in any
environment this repo has run in. Every result below comes from suites running against
`test/fake-google.js`, an in-memory implementation of the *documented* Drive/Docs REST contract.

That distinction is the whole of this document. The connector's own logic is well tested. Its
agreement with Google is **assumed, not demonstrated.**

## Capability status

| Capability | Offline | Live | Notes |
|---|---|---|---|
| Drive read (search, metadata, MIME, parents, permissions) | ✅ | ❌ | 40-case suite |
| Docs read (structure, text, revisionId, version parse) | ✅ | ❌ | Table-nested text covered (A-27) |
| Drive copy / archive snapshot | ✅ | ❌ | Incl. failure, retry, duplicate-prevention |
| Drive rename / move | ✅ | ❌ | fileId preservation asserted |
| Docs body edit (batchUpdate, in place) | ✅ | ❌ | fileId preservation asserted |
| Revision-safe write (`requiredRevisionId`) | ✅ | ❌ | **Depends on Google honoring the precondition — unverified** |
| Canonical maintenance workflow (21 steps) | ✅ | ❌ | Happy path, 3 partial-failure modes, idempotency |
| Source-registry recovery | ✅ | ❌ | Recovery, ambiguity refusal, no auto-follow |
| Prompt-injection resistance | ✅ | n/a | Logic-level; not environment-dependent |
| Secret redaction | ✅ | n/a | Logic-level |

**Nothing in the "Live" column may be claimed until stage 3 below is executed.**

## Test evidence

```
node test/run-all.js
  adversarial   40/40
  protocol      10/10
  TOTAL         50/50
```

### The 35 required scenarios

All present, all passing. Mapping: 1→A-01, 2→A-02, 3→A-03, 4→A-04, 5→A-05, 6→A-06, 7→A-07, 8→A-08,
9→A-09, 10→A-10, 11→A-11, 12→A-12, 13→A-13, 14→A-14, 15→A-15, 16→A-16, 17→A-17, 18→A-18, 19→A-19,
20→A-20, 21→A-21, 22→A-22, 23→A-23, 24→A-24, 25→A-25, 26→A-26, 27→A-27, 28→A-28, 29→A-29, 30→A-30,
31→A-31, 32→A-32, 33→A-33, 34→A-34, 35→A-35.

Added beyond the required set: A-00 (baseline), A-09b (transient retry), A-36 (redaction),
A-37 (error-code stability), A-38 (archive naming + Chicago date anchor).

### Defects the suites found and fixed

Recorded because a test that never failed proved nothing.

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | A-36 | `redact()` defaulted to `process.env`, so credentials injected from anywhere else were **not redacted** from errors | Module-level `registerSecrets()`, called by every client at construction |
| 2 | A-09 | The test injected a *retryable* 500, so retry succeeded and the case passed for the wrong reason — archive failure was never exercised | Test now injects a permanent failure; added A-09b to cover the retry path deliberately |
| 3 | A-09/A-29 | Archive errors reported the HTTP cause (`BACKEND_ERROR`), losing the safety-critical fact that *the archive step* failed and no edit was attempted | Code names the step; cause carried in `cause`; deliberate validation codes preserved |
| 4 | P-08 | **No request timeout anywhere** — a stalled Google connection hung the tool call indefinitely | `AbortSignal.timeout` on both fetch paths, `TIMEOUT` error code |
| 5 | P-11 | `replyError` returned early on `id: null`, so **every JSON-RPC parse error was silently swallowed** | `allowNullId` for parse errors; added `-32600` for non-object JSON |
| 6 | P-08/P-11 | stdin closing exited the process while a tool call was in flight, **losing the response** | In-flight tracking; drain before exit |

Defects 4, 5 and 6 were live-protocol bugs that no amount of unit testing against the fake would
have found. They are the argument for keeping the protocol suite.

## What remains uncertified

Against the OS repo's own certification path
(`docs/SOP-MAINTENANCE-CERTIFICATION-PATH.md`), stages 1–2 are informed by this work; **stages 3–9
are untouched**:

| Stage | Status |
|---|---|
| 1. Architecture review | Not obtained (ChatGPT / 04) |
| 2. Tier-classification accuracy (≥30 findings, zero downward misclassification) | Not run |
| 3. Synthetic document rehearsal (real Drive) | **Blocked — no OAuth credential** |
| 4. Adversarial rehearsal (real Drive) | **Blocked — no OAuth credential** |
| 5. Shadow mode (≥10 real findings, no execution) | Not started |
| 6. Blaise approval of the action class | Not obtained |
| 7. Supervised live | Not started |
| 8. Production certification | Not granted |
| 9. Monitored operation | Not started |

**HOLD H-11 remains in force.** Nothing here authorizes an autonomous edit to a canonical Drive
document. The capability now exists; the authority does not.

## Write classes

| Class | Tools | Certified |
|---|---|---|
| Drive read | `drive_search_files`, `drive_get_file_metadata` | offline only |
| Docs read | `docs_get_document`, `canonical_source_recovery` | offline only |
| Drive archive/copy | `drive_copy_file` | offline only |
| Drive rename/move | `drive_rename_move_file` | offline only |
| Docs body edit | `docs_batch_update` | offline only |
| Canonical maintenance | `canonical_doc_maintenance` | offline only |

## Behavioral guarantees, with their basis

| Guarantee | Basis | Strength |
|---|---|---|
| Writes refused unless explicitly enabled | Local dispatch gate | **Strong** — no API dependency |
| Unsupported/destructive operations refused | Local allowlist | **Strong** — no API dependency |
| Secrets never leave the process | Local redaction | **Strong** — no API dependency |
| Document content cannot alter behavior | Local design | **Strong** — no API dependency |
| Archive precedes every edit | Local sequencing | **Strong** — no API dependency |
| Idempotent re-runs | Local state check | **Strong** — no API dependency |
| Concurrent edits never silently overwritten | Google `requiredRevisionId` | **Assumed** — needs live proof |
| Batches are all-or-nothing | Google batchUpdate semantics | **Assumed** — needs live proof |
| Copy/rename/move behave as modeled | Google Drive semantics | **Assumed** — needs live proof |

The four "Strong" rows hold regardless of what Google does. The three "Assumed" rows are the live
certification gap.
