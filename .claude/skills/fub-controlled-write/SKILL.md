---
name: fub-controlled-write
description: The mandatory 17-step controlled-write sequence for any Follow Up Boss write - note, task, or interaction closeout. Use before and during every FUB write. Enforces exact-target resolution with corroboration, duplicate and stale-state checks, preview, independent read-back, exactly-once verification, and the dated-next-action rule. Never claim success from the write response alone.
---

# FUB Controlled Write

**Follow Up Boss is the source of truth.** A write here changes a real client record. This sequence is
mandatory and ordered — no step is optional, and none may be inferred from another.

## Canonical authority

Certified bounded reversible write classes on the **FUB MCP/API lane** (Execution Operator SOP v4.28,
FOLLOW UP BOSS — MCP/API LANE):

- `create_contact_note` (hardened)
- `create_contact_task` (hardened)
- `close_out_contact_interaction` (combined factual note + dated future task)

**All 10 other write tools are uncertified** and require action-specific certification.

> ### AUTHORITY GATE — read before every write
> Exec SOP v4.28 §1B-1: *"No code build, unit/integration test, scheduler smoke, multi-agent
> completion, repository merge, or deployment grants FUB write authority … unless a separate canonical
> control explicitly grants it and the required authorization exists."*
>
> **A Claude Code package does not currently hold that grant.** Until a canonical control explicitly
> authorizes a Claude Code agent to execute these write classes, this skill runs **through step 11 and
> stops**, emitting a `CRM WRITE REQUEST` packet for Blaise or a certified lane to execute.
> See `docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md`, patch **CGQ-001**.

## The 17-step sequence

**Steps 1–11 are preparation and are always permitted.**

1. **Connector preflight** — `connector-preflight`. FUB required. Missing → HOLD.
2. **Exact personId resolution** — resolve to one candidate.
3. **Corroboration** — `find_contact` `total: 1` is **not** proof of uniqueness; it excludes
   Trash-stage records (IF-010). Corroborate through a second independent path: the personId on the
   triggering task/appointment, an exact email/phone match, a known record ID, or specific
   relationship facts. **Ambiguous → STOP. Never guess.**
4. **Ownership / state check** — `assignedUserId`, stage, timeframe, agreement status. Do not write to
   a record owned by someone else without explicit authorization.
5. **Recent note retrieval** — `get_contact_notes`. Dedup scan covers the most recent 50; **disclose
   truncation** when the total exceeds that.
6. **Open task retrieval** — `get_open_tasks` (always complete, reports `_completeness`).
7. **Sensitive-data check** — reject credentials, SSN, full financial account data, and PII outside
   task scope. Never write sensitive data into a note.
8. **Stale-state check** — is the intended write still correct given current state? A newer note or a
   completed task may have superseded it.
9. **Duplicate check** — exact and **semantic** equivalence, not just string match. "Call Dallas
   Friday" and "Follow up with Dallas on Friday" are the same task.
10. **Preview** — `execute=false` where the tool contract offers it. Verify preview returns
    preview-only/no-write status.
11. **Action-class authority check** — is this exact class certified **for this actor**? See the
    AUTHORITY GATE above.

**Steps 12–17 execute only when the authority gate is satisfied.**

12. **Smallest required write** — one object, minimum fields. Never batch. Never write a stage, tag,
    profile, appointment, deal, channel, or external log through this skill.
13. **Independent read-back** — re-read through a *separate* read tool. Never trust the write response.
14. **Exactly-once verification** — confirm the object appears exactly once; before/after counts.
15. **Unintended-change check** — no unrelated field, object, automation, or stage changed.
16. **Dated-next-action verification** — every viable lead/client leaves FUB with **one** clear dated
    next action when the task scope calls for relationship follow-up.
17. **Controlled-write certification report** — exact target · before state · authorization · write
    result with identifiers · independent read-back · after state · duplicate/unintended-change check ·
    exactly-once result · anything unfinished.

## Idempotency

Client-side protection only. Applies to steps 9, 13 and 14.

| Case | Required behavior |
|---|---|
| Same closeout twice | Match existing → report `matched_existing_no_write`. Never a second object. |
| Same note twice | Exact-duplicate suppression within the disclosed 50-note scan scope |
| Same task twice | Match on name + due date + personId |
| Semantically equivalent tasks | Treat as duplicate; prefer the existing one |
| Response lost after write | **Read back before retrying.** The write may have succeeded. |
| Connector disconnect after write | Same — verify by read, never blind-retry |
| Retry | Sequential identical retries are certified idempotent |
| Stale preview | Re-run preview if state changed since; never execute against a stale preview |
| Existing better next action | Keep the existing one. Do not stack a second dated next action. |

> **Concurrency limit — state it, never paper over it.** The FUB API has **no server-side idempotency
> key**. Sequential retries are safe; **truly concurrent same-contact writes can still race** between
> the duplicate check and the create. Never claim server-side concurrency safety.

## Never

- Claim success from the write response alone — read-back is the proof.
- Report a logging tool as a communication. `log_external_call_record` / `log_external_text_record`
  **record**; no connected tool sends SMS, email, or places a call.
- Infer that no communication occurred because an endpoint returned zero. API visibility is not the
  whole FUB UI.
- Create or edit shared stages, Smart Lists, tag definitions, action plans, automations, lead-flow
  rules, or team templates — **those require Brent's approval** (BOM §16, FUB 06 §1).

## CRM WRITE REQUEST packet (emitted when the authority gate blocks execution)

```
CRM WRITE REQUEST
  TARGET          personId · name · corroboration path used
  ACTION CLASS    create_contact_note | create_contact_task | close_out_contact_interaction
  PROPOSED CONTENT exact note body and/or exact task name + due date (America/Chicago)
  WHY             the interaction or trigger this records
  PRECHECKS       steps 1-10 results: ownership · duplicates · stale state · sensitive data
  DUPLICATE RISK  what already exists that is close
  DATED NEXT ACTION  what the record will carry afterward
  BLOCKED BY      authority gate - Exec SOP v4.28 §1B-1 · CGQ-001
  READY           yes/no - is this safe to execute exactly as written
```
