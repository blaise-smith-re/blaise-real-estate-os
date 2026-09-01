# Known Limitations

Written plainly. A limitation named is manageable; a limitation implied away is a future incident.

## L-001 — Nothing here is live-certified

No live Google API call has been made. Every guarantee that depends on Google's behavior is
**assumed from documentation, not observed**. See [CERTIFICATION.md](CERTIFICATION.md).

## L-002 — The archive step cannot be revision-guarded

Docs `batchUpdate` supports `writeControl.requiredRevisionId`. Drive `files.copy` and `files.update`
support **no equivalent precondition**.

So in `canonical_doc_maintenance` there is a window between the archive copy and the body patch. If
someone edits the document inside that window:

- the body patch **fails safely** (the revision moved) — the canonical document is never corrupted;
- but the archive is one revision stale, and a spurious `LEGACY - …` file now exists.

The run reports `ARCHIVE_ONLY_PARTIAL` and names the archive so a retry reuses it rather than
creating a second one. **This is the honest shape of the guarantee**: the canonical document is
protected; the archive is best-effort. Google offers nothing stronger.

## L-003 — `drive` scope is broader than this connector needs

Google publishes no "write to existing files only" scope. See
[OAUTH-SETUP.md](OAUTH-SETUP.md#why-drive-and-not-drivefile). Compensated by the read-only default,
account binding, exact-target gates and the operation allowlist — but the OAuth grant itself is
full Drive access, and that is worth knowing before granting it.

## L-004 — Index-based edits are fragile across concurrent structural change

`insertText` and `deleteContentRange` use absolute character indices. Indices computed from one read
are only valid for that revision. The revision guard makes a stale-index write *fail* rather than
land in the wrong place — but it means index-based patches are more retry-prone than
`replaceAllText`. **Prefer `replaceAllText` for canonical maintenance**; it is anchored to content
rather than position.

## L-005 — Version parsing is heuristic

`extractVersion` matches `Version: 1.4`, `Version 1.4`, `v1.4` and tolerates smart punctuation and
non-breaking spaces. A document that states its version in an unanticipated format returns `null`,
and a maintenance run with `expectedCurrentVersion` set will refuse rather than guess. That is the
safe direction, but it will occasionally refuse a legitimate document until its format is added.

## L-006 — Uniqueness checking depends on Drive search consistency

Exactly-one-current-canonical is verified with a `name =` query. Drive search is eventually
consistent: a very recently created duplicate might not appear. The connector surfaces
`incompleteSearch` and treats it as a failed uniqueness check rather than a pass, but a
freshly-created duplicate outside the index window is a genuine blind spot.

## L-007 — Formatting operations are accepted but not verified

`updateTextStyle` and `updateParagraphStyle` are allowed and forwarded. Read-back verification
checks **text**, not formatting — so a formatting-only patch cannot be verified by this connector
beyond "the API accepted it". Do not rely on it for formatting-critical changes.

## L-008 — No rollback primitive

If verification fails after a successful write, the connector reports the exact difference and names
the archive as the rollback source. **It does not automatically restore.** Restoring means deciding
between the archive and whatever else changed, which is a judgment call, not an API call. That
decision stays with a human.

## L-009 — No cross-document transaction

Maintaining one document is atomic-ish; maintaining a document *and* its cross-references is not.
If an SOP and its index both need updating, those are two runs, and the first can succeed while the
second fails. The OS-side workflow must treat multi-asset changes as a checklist, not a transaction.

## L-010 — The fake models the contract, not Google

`test/fake-google.js` encodes documented behavior. Where Google's real behavior differs — error
message wording, index semantics at boundaries, search consistency — the suites will pass and
production will not. This is the specific reason live rehearsal (certification stage 3) is
mandatory before any real canonical document is touched.
