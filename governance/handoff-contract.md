# Handoff Contract — compatibility audit schema
Current authority: live AI Execution Runbook via source-registry.json. The minimum useful handoff
is objective, exact target, source pointers, delta, completed work, next owner, boundary and resume
condition. Expanded historical fields below are optional audit detail, not a routine business
ritual. Only the read-only worker's own writes must be NONE; another lane's verified CRM result is
reported separately. Old provider/channel and Phase 2 packet rules do not override current sources.

---

## 1. Inbound — Claude Execution Task Packet

The canonical 16-field packet (routing doc v4.2) plus the six additions recommended by the Phase 1
audit and adopted for Phase 2. Additions are marked with a plus sign.

```
+ JOB ID
  OBJECTIVE
+ ASSIGNED DEPARTMENT / AGENT
  SYSTEM / EXECUTION LANE
  EXACT TARGET RECORD
  TRIGGER / CURRENT STAGE
  CONTROLLING SOURCE(S)
+   ... VERSION AS RETRIEVED
+   ... RETRIEVED AT (America/Chicago)
  VERIFIED INPUTS
+ REPORTED INFORMATION
+ ASSUMPTIONS
  MISSING INFORMATION / DECISION BOUNDARY
  ACTION CLASS: read-only | preparation/draft | reversible write | external/consequential
  PERMITTED WRITES
  PROHIBITED ACTIONS
  SENSITIVE-DATA SCOPE
  DUPLICATE / CONFLICT / STALE-STATE CHECK
  REQUIRED READ-BACK
  SYSTEM-OF-RECORD CLOSEOUT
  EXPECTED REPORT
  OWNER / TIMING
```

### The four fields that must never be dropped

`ACTION CLASS` · `SENSITIVE-DATA SCOPE` · `DUPLICATE / CONFLICT / STALE-STATE CHECK` ·
`REQUIRED READ-BACK`

These preserve effect controls in an expanded audit; a useful ordinary handoff need not be a full packet. For **Phase 2** they resolve to fixed values:

| Field | Phase 2 value |
|---|---|
| `ACTION CLASS` | `read-only` — always |
| `PERMITTED WRITES` | `NONE` |
| `REQUIRED READ-BACK` | `N/A - no write attempted` |

---

## 2. Outbound — Operator Execution Report

When expanded engineering evidence is useful, use this structure from the `operator-execution-report` skill. The
canonical section list is defined in that skill's `SKILL.md`.

Sections, in order: OBJECTIVE · TARGET · GOVERNING SOURCES + VERSIONS · VERIFIED FACTS · REPORTED
INFORMATION · ASSUMPTIONS · MISSING INFORMATION · WORK COMPLETED · TOOLS / RECORDS USED · WRITES
ATTEMPTED · QC RESULT · SYSTEM UPDATE REQUIRED · SYSTEM OF RECORD · NEXT ACTION · OWNER · TIMING ·
HANDOFF · ESCALATION / HOLD.

**Phase 2 invariant: the WRITES ATTEMPTED section must read exactly `NONE`.** Any other value is a
certification failure and must be reported as one.

### Report honesty rules

No report may imply that a client was contacted, a document sent, a record changed, a download
completed, a background job scheduled, or an OS source updated unless the corresponding real action
occurred **and was independently verified**.

---

## 3. Quick handoff prompt (canonical, routing doc v4.2)

```
Execute under the current AI Execution Runbook and task-relevant authority.
Objective:
System and exact target:
Current governing source:
Verified facts/inputs:
Authorized action:
Do not:
Required read-back:
Required source-system closeout:
Return an Operator Execution Report and identify anything still unfinished.
```

---

## 4. Fact discipline

Every report must keep these separate and never blend them:

| Category | Meaning |
|---|---|
| **VERIFIED FACTS** | Directly retrieved from an authoritative system this run |
| **REPORTED INFORMATION** | Stated by the client or a third party; not independently verified |
| **ASSUMPTIONS** | Claude's working inference, explicitly labeled |
| **MISSING INFORMATION** | Known gap, including any source that was unreachable |

A missing field is **not** a negative fact. "Not returned" never means "did not happen."
