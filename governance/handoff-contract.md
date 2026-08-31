# Handoff Contract — Claude Execution Task Packet & Operator Execution Report

**Canonical owner:** `02 - ChatGPT Workflow Channels, Routing & Starter Scripts` v4.2 (`fileId`
`12Pg3pAXpPWfEf6_U6rFYrOM7WQSDVkM90CwJjujqiLE`) and `SOP - Claude Execution Operator` v4.27.

**This repository does not own the packet format.** It stores a working copy for lint/test purposes
only. If the canonical documents change, the canonical documents win and this file is updated to
match — never the reverse. Any structural change to the packet is an **OPERATIONAL CHANGE** routed
through ChatGPT / 04.

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

These are the units certification is granted and verified in. A packet missing any of them cannot be
executed as a controlled task. For **Phase 2** they resolve to fixed values:

| Field | Phase 2 value |
|---|---|
| `ACTION CLASS` | `read-only` — always |
| `PERMITTED WRITES` | `NONE` |
| `REQUIRED READ-BACK` | `N/A - no write attempted` |

---

## 2. Outbound — Operator Execution Report

Every agent run closes with this structure, produced by the `operator-execution-report` skill. The
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
Execute this under the current Claude Execution Operator SOP.
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
