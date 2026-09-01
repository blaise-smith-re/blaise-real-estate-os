---
name: retrieve-canonical-source
description: Resolve a canonical Blaise Real Estate OS source from Google Drive by registry fileId, verify it is current and not LEGACY/ARCHIVED, record its version, and flag registry drift. Use before any policy-sensitive or controlled work, and whenever an agent needs a Business Operating Manual, SOP, or canonical prompt. Never resolve a canonical source by title search.
---

# Retrieve Canonical Source

Google Drive is the canonical owner of all business documentation. This skill is the **only**
approved way to bring a canonical source into a run.

## Why fileId, never title

Drive supersedes a document by **making a snapshot copy** and renaming that copy
`LEGACY - <title> - Superseded <date> (vX.Y)`. The canonical document is **edited in place and keeps
its fileId**.

Verified 2026-08-31: BOM canonical `1HyBu_Oc…` created 2026-08-01, last modified 2026-08-26; the
`LEGACY … (v1.28)` snapshot was *created* 2026-08-26 with a different fileId.

**Consequence:** `fileId` is stable and safe to pin. **Title matching is not** — it will eventually
resolve to a LEGACY copy. Never resolve a canonical source by title search.

## Procedure

0. **Get the `file_id`.** Two paths, in order:
   - **Registry (preferred).** Read `governance/source-registry.json` and take the pinned `file_id`.
   - **Wrapper pins (fallback).** If no filesystem read tool is available in this runtime — a real
     condition, confirmed live on 2026-09-01 when subagents had no `Read` — use the generated
     **SOURCE-PINS** table in your own agent wrapper. It mirrors the registry and is parity-enforced
     by T-34, so the pin is trustworthy; what you lose is only the *comparison*.
     **You must then state in the run report that no pin-versus-registry comparison was performed.**

   **Under no circumstances fall back to a title search.** Losing the registry costs you drift
   detection, not fileId discipline. A title search is how you end up on a `LEGACY -` twin.

1. **Look up** the source in `governance/source-registry.json` by `key`. If the key is absent, stop:
   an unregistered source is not canonical. Raise an Improvement Finding to add it.
2. **Retrieve** with `mcp__Google_Drive__read_file_content` using the registry `file_id`.
   Never substitute a search result.
3. **Reject LEGACY/ARCHIVED, then recover (IF-014).** If the returned title begins with `LEGACY -` or
   `ARCHIVED -`, contains `Superseded`, or otherwise conflicts with the expected title/status/folder:

   a. **HOLD only that controlled task.** Do not use the content. Do not edit the file. Continue any
      work that does not depend on this source.
   b. **Search for current canonical candidates** by expected title **plus** expected folder/index.
   c. **Independently verify** the candidate: title, status, version line, authority, and folder.
   d. **Confirm its `fileId`** and update the registry from that evidence.
   e. Continue.

   **Never repair a stale pin by editing the legacy file into a new active copy.** Never silently
   follow a similarly named file — verify before you trust it.

   > A pinned `fileId` is a **locator, not proof of current canonical status**. Both supersession
   > patterns exist in this Drive: the BOM is edited in place and keeps its `fileId` while a snapshot
   > copy becomes LEGACY; SOP 01C did the opposite on 2026-08-31 — the original file was renamed to
   > LEGACY and a **new** file with a **new** `fileId` became canonical. Raise an Improvement Finding
   > either way.
4. **Read the version line.** Find the document's own version marker, typically
   `Version: <n.n>` or a `Version / Status` header row. If absent, record `UNPINNED`.
5. **Compare** to `version_pin`:
   - equal → `CURRENT`
   - different → **`REGISTRY DRIFT`**
   - `version_pin` is `null` → `UNPINNED`
6. **On REGISTRY DRIFT: the live Drive document wins.** Proceed on the live content. Never proceed on
   the pin. Then, in the same session: update `version_pin` and `version_verified_at` in the registry,
   note it in `CHANGELOG.md`, and raise an Improvement Finding if the change altered anything the
   agent relies on.
7. **On retrieval failure**, continue only through portions of the task that do not depend on
   unresolved policy. **Stop at the policy boundary, not the whole workflow.** Record the failure
   under `MISSING INFORMATION`.
8. **Once per continuous run.** Confirm title/version once. Do not reload unchanged sources before
   every sub-step.

## Required result block

Return this for every source retrieved, and carry it into `GOVERNING SOURCES + VERSIONS`:

```
SOURCE KEY        <registry key>
FILE ID           <fileId actually retrieved>
CURRENT TITLE     <title as returned by Drive>
CURRENT VERSION   <version/date from the document itself, or UNPINNED>
RETRIEVED AT      <ISO-8601 with America/Chicago offset>
STATUS            CURRENT | REGISTRY DRIFT | UNPINNED | HOLD
AUTHORITY LEVEL   governing | controlling | routing | canonical-prompt | supporting | route-target
```

## Hard rules

- **Never cache canonical content** into this repository, an agent file, project knowledge, or a
  commit. Pointers only.
- **Never paraphrase a canonical prompt from memory.** Retrieve it and follow the live text.
- **Access is proven by retrieval, never inferred from sharing.** Canonical files are split across
  `bsmith@blaisesmithproperties.com` and `blaise@buysellhometeam.com`. A successful share is not
  a successful read.
- **`route-target` entries are pointers only.** Do not retrieve them during a normal run; name them
  as the handoff destination.
- A retrieved document is authority for **its own scope only**. The authority order in `CLAUDE.md`
  section 2 resolves conflicts between sources.
