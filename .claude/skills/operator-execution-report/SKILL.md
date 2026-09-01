---
name: operator-execution-report
description: Produce the standard Operator Execution Report that closes every Claude Real Estate OS agent run. Use at the end of any agent run, any controlled task, or any build session that touched a business system. Enforces fact discipline, honest reporting, and the Phase 2 zero-write invariant.
---

# Operator Execution Report

The required closeout for every agent run. Defined by the Execution Operator SOP v4.27 and the
routing document v4.2. This repository stores the shape, not the authority — see
`governance/handoff-contract.md`.

## Structure

Emit every section, in this order. If a section is genuinely empty, write `NONE` — never omit it and
never silently merge sections.

```
OBJECTIVE                   One sentence. What this run was for.
TARGET                      The exact record, person, date, or scope. Exact identifiers.
GOVERNING SOURCES + VERSIONS  Each source: key, fileId, version as retrieved, status.
VERIFIED FACTS              Directly retrieved from an authoritative system THIS RUN.
REPORTED INFORMATION        Stated by client or third party. Not independently verified.
ASSUMPTIONS                 Working inferences, explicitly labeled as such.
MISSING INFORMATION         Known gaps, including every source that was unreachable.
WORK COMPLETED              What was actually done.
TOOLS / RECORDS USED        Connectors and record identifiers touched.
WRITES ATTEMPTED            PHASE 2: must read exactly NONE.
QC RESULT                   PASS | PARTIAL | HOLD, plus what was checked.
SYSTEM UPDATE REQUIRED      What a system of record still needs. NONE if nothing.
SYSTEM OF RECORD            Which system owns the outcome.
NEXT ACTION                 The single specific next action.
OWNER                       Who performs it.
TIMING                      When. A real date, not "soon".
HANDOFF                     Which workflow, channel, or person receives this.
ESCALATION / HOLD           Held items with HOLD reference and what would clear each.
```

## Fact discipline

Keep these four separate. Never blend them.

| Category | Test |
|---|---|
| **VERIFIED FACTS** | Retrieved from an authoritative system in this run |
| **REPORTED INFORMATION** | Someone said it; nothing confirmed it |
| **ASSUMPTIONS** | Claude inferred it |
| **MISSING INFORMATION** | Known unknown, including unreachable sources |

**A missing field is not a negative fact.** "Not returned" never means "did not happen." API
visibility is not the whole FUB UI. Never infer that no communication occurred because an endpoint
returned zero records.

## Phase 2 zero-write invariant

`WRITES ATTEMPTED` must read exactly `NONE`.

Any other value on a Phase 2 agent is a **certification failure**. Report it as one — do not
rationalize it, and do not omit the section.

## Honest reporting

No report may imply that a client was contacted, a document sent, a record changed, a file saved, a
download completed, a background job scheduled, or an OS source updated **unless the corresponding
real action occurred and was independently verified.**

- A disconnect creates a **resume checkpoint**, not a background job.
- Never claim a schedule, automatic resume, or future action exists unless a real scheduling action
  was created and can be identified by ID. **Phase 2 agents may not create one at all.**
- `log_external_call_record` / `log_external_text_record` **record**; they do not send or call.
- Do not treat automation-generated activity as proof a human conversation occurred.
- Report unfinished work plainly. Never claim completion while a required verification is missing.

## QC RESULT

| Value | Meaning |
|---|---|
| `PASS` | Objective met; sources current; target verified; zero unauthorized writes |
| `PARTIAL` | Useful output produced, but a named gap remains. **State the gap.** |
| `HOLD` | Could not proceed safely. **Name the hard stop or HOLD reference.** |

Never report `PASS` when a controlling source was unreachable, the target was ambiguous, or a
required date could not be resolved.

## Unavailable systems

When a needed system is unreachable — Northstar/Matrix, Click Contracts, SkySlope, Ylopo, ShowingTime,
or a withheld connector — **disclose the gap under `MISSING INFORMATION` and route it.** Never
simulate, infer, or substitute remembered data. See `docs/CHROME-OPERATOR-HANDOFF.md`.

## Continuous Improvement Check

Before closing, ask: did this run reveal a stale instruction, conflicting SOP, missing operating step,
obsolete tool behavior, duplicate workflow, broken cross-reference, unnecessary manual work, missing
certification control, or a repeatable improvement?

If yes, write an Improvement Finding into `governance/improvement-findings.md` in the required format
and reference its ID under `SYSTEM UPDATE REQUIRED`. If no, no entry is needed — do not manufacture
findings.

### Surfacing rule — log quietly, escalate only what matters

**Logging a finding and surfacing it to Blaise are two different acts.** Every qualifying finding is
always written to the log. Almost none of them belong in his business output.

**Default: log quietly.** The finding goes into `governance/improvement-findings.md` and is named
under `SYSTEM UPDATE REQUIRED` in the report — which is the engineering audit trail, not the headline.
Blaise's brief, priority list, analysis or client-facing draft stays clean.

**Surface to Blaise in the business output only when the finding meets one of these:**

| Test | Example |
|---|---|
| **Changes the current decision** | A source is stale in a way that alters the recommendation he is about to act on |
| **Safety or correctness of what he is about to do** | A time, deadline, address, or client identity in *this* output is wrong or unverified |
| **Requires an action only he can take** | Ask Brent about a tag; clear an RSVP; grant an access he alone controls |
| **Legal, compliance, or consent exposure** | A message went out against a stated consumer preference |

**Everything else is quiet**: numbering collisions, broken cross-references, stale pointers, missing
test coverage, tool-surface gaps, formatting drift, duplicate workflows, process improvements.

When surfacing, lead with **what he must do**, not the finding ID. One or two sentences. The ID is a
reference, not the message. When not surfacing, say nothing in the business output — the log and
`SYSTEM UPDATE REQUIRED` already carry it.

**Never suppress a material finding to keep output tidy, and never pad output with routine ones.**
A run that surfaces nothing is the normal case.

## Placement

The report is **appended after** the agent's canonical business output. It never replaces, truncates,
or reorders the canonical output. Blaise reads the brief first; the report is the audit trail.
