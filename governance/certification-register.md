# Certification Register — Repo Mirror

**Canonical register:** `SOP - Claude Execution Operator, Browser & API-MCP Integration Control`
v4.27 section 5B (`fileId` `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU`).

**This file is a POINTER MIRROR.** It records the state of Claude Code *agents* built in this
repository. It does not grant, extend, or modify any certification. Where it disagrees with the live
Execution Operator SOP, **the SOP controls**.

> An agent **inherits, and can never expand,** the certification of the lanes it uses.

---

## 1. Certification ladder (canonical, Execution SOP section 5A)

| Stage | Meaning |
|---|---|
| **A** | Source mastery — retrieve current Manual/SOP/checklist; identify system of record, trigger, inputs, outputs, stop conditions |
| **B** | Sanitized/synthetic mastery — full workflow on dummy/test data, reach the authorized boundary without leaving the intended record |
| **C** | Production read/research — scoped live reads without per-record re-approval |
| **D** | Production reversible execution — certified reversible write class on exact authorized targets |
| **E** | Repeatable operator — stable workflow recorded as a reusable procedure |

Site-specific and **action-class specific**. Once certified, a lane is usable for routine work without
re-certification. Re-test only after a material system change, a contradictory governing source, a new
consequential action class, or evidence prior behavior is unreliable.

## 2. Agent-specific gate — new in this repository

An agent is a unit the canonical model does not yet describe. Agent certification adds two checks on
top of the inherited lane certification:

1. **Routing correctness** — does it act within its declared scope and route the rest?
2. **Scope containment** — can it be induced to reach an uncertified action class?

Evidence lives in `docs/PHASE-2-CERTIFICATION.md`.

---

## 3. Phase 2 agent status

| Agent | Underlying lane (Drive-certified) | A | B synthetic | C live pilot | D | E |
|---|---|---|---|---|---|---|
| `daily-revenue-command-center` | Command Center manual/read-only PASS (Exec SOP v4.26/4.27); FUB task retrieval PASS (PR #2) | PASS | PASS static | **PASS** 2026-08-31, target date 2026-09-01, 27/27 tasks, zero writes | N/A read-only | not sought |
| `client-prep-brief` | Client Prep engine read-only PASS (Exec SOP v4.25, live Dallas pilot) | PASS | PASS static | **PASS** 2026-08-31, target "Dallas" personId 18476, zero writes | N/A read-only | not sought |

**Both agents are PRODUCTION CERTIFIED for manual, read-only operation** as of 2026-08-31, authorized
by Blaise. Evidence: `docs/PHASE-2-CERTIFICATION.md`.

**Scope of certification, exactly:** manual invocation · read-only · FUB reads + Calendar reads +
Drive canonical-source retrieval. Nothing else.

**Adversarial gates passed live: 12/12.** A-1 recertified 2026-08-31 against the hardened
corroboration rule (PASS) · A-5, A-7, A-8, A-9, A-10, A-11 live · A-2/A-3 by checker ·
A-4/A-6/A-12 structurally enforced.

**Canonical alignment complete.** Execution Operator SOP **v4.28** now carries the CLAUDE CODE —
MULTI-AGENT EXECUTION LANE and records both certifications (IF-008 closed). FUB 06 **v1.8** carries
the `find_contact` limitation (IF-010 closed). Command Center prompt **v1.2** carries the scheduling
and Ylopo-corroboration controls (IF-009, IF-012 closed). BOM **v1.30** references the Claude Code
layer.

**This mirror remains subordinate to the canonical Execution Operator SOP.**

## 3A. Phase 3–8 department packages

| Agent | Built | Static | Adversarial | Live pilot | Status |
|---|---|---|---|---|---|
| `lead-conversion-crm` | yes | PASS | specified A-13…A-19 | not run | **BUILT — WRITE AUTHORITY GATED (CGQ-001)** |
| `buyer-investor-ops` | yes | PASS | specified A-20 | not run | **BUILT — READ-ONLY, PENDING CGQ-002** |
| `seller-listing-ops` | yes | PASS | specified | not run | **BUILT — READ-ONLY, PENDING CGQ-002** |
| `market-intel-marketing` | yes | PASS | specified A-21…A-24 | not run | **BUILT — READ-ONLY, PENDING CGQ-002** |
| `transaction-closing-ops` | yes | PASS | specified A-25…A-27 | not run | **BUILT — READ-ONLY, PENDING CGQ-002** |
| `chief-of-staff` | yes | PASS | specified A-28 | not run | **BUILT — READ-ONLY, PENDING CGQ-002** |

**None of these six is production-certified.** All hold **zero write tools** and are structurally
contained: 13/13 FUB write tools denied project-wide, no scheduling tool, no Gmail, no Composio.
They are safe to use and honest about their limits — they are simply not yet recorded in the
canonical register. See `docs/CANONICAL-GOVERNANCE-PATCH-QUEUE.md`.

## 4. What Phase 2 explicitly did NOT certify

Writes of any class · scheduled or unattended execution · Gmail access · expanded system access ·
external communication · any change to a Drive-side certification.

## 5. Amending this file

Recording a new agent status here requires test evidence in `docs/PHASE-2-CERTIFICATION.md`. Changing
a *lane* certification is an OPERATIONAL or HIGH-STAKES change owned by ChatGPT / 04 and the Execution
Operator SOP — **never recorded here first**.
