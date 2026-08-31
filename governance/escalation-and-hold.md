# Escalation, Hard Stops & Standing HOLD

**Authority:** Execution Operator SOP v4.27 (Workflow Method / HARD-STOP CONDITIONS) · BOM §3, §4.12.

---

## 1. Hard stops — ask Blaise

Stop and ask **only** when:

1. **Authentication** — MFA / CAPTCHA technically requires him.
2. **Wrong-target risk** — target identity is materially uncertain and continuing could affect the
   wrong real record.
3. **Unresolved decision** — a required legal, financing, contract, or genuine business decision is
   missing, or an applicable brokerage supervisory / form / compliance decision actually controls the
   next action.
4. **Consequential effect** — the next step would create an external communication, submission,
   signature, acceptance/rejection/counter, production-status change, money movement, publication,
   destructive/irreversible effect, or another consequential commitment not already authorized.
5. **Source conflict** — a current authoritative source materially conflicts with the requested action.

Plus, for this repository: **credentials, sensitive personal or financial data, or PII outside task
scope.**

### Not hard stops

Expected live business data inside an authorized target · routine tool errors · a long run or high
tool-call count · a recoverable retrieval failure · an empty API result · passive unavoidable
visibility of unrelated records (back out, re-verify the intended target, continue).

---

## 2. Standing HOLD — Phase 2

| # | Item | Basis |
|---|---|---|
| H-1 | **Unattended / scheduled agent execution** — no cron, Routine, scheduled task, background job, or `/loop` | Execution SOP v4.27; scheduler-runtime morning-smoke gate not met |
| H-2 | **All FUB writes** for Phase 2 agents (including the 3 certified elsewhere) | Phase 2 read-only decision |
| H-3 | **All Gmail tools** — connector not granted | No production client-draft certification; no read-back proof |
| H-4 | **All Calendar writes** | Only synthetic `create_event` passed Phase 1 |
| H-5 | **All Drive business-record writes** | ChatGPT / 04 owns canonical change control |
| H-6 | **All external communication** — text, call, email, DM, publication | No connected tool sends anything |
| H-7 | **Browser automation** | No browser lane here; FUB + Ylopo vendor terms prohibit it |
| H-8 | **Northstar/Matrix, Click, SkySlope, Ylopo, ShowingTime** access | Chrome lanes, unreachable from this repository |
| H-9 | **Composio / Instagram writes** | Read PASS does not certify any write |
| H-10 | **Merge to `main`** | Requires Blaise + ChatGPT review |
| H-11 | **Autonomous edit of any canonical Drive business document** | Certification path designed but NOT active — see `docs/SOP-MAINTENANCE-CERTIFICATION-PATH.md` |

**A HOLD is not a suggestion.** If a request would cross one, name the HOLD, explain what would clear
it, and stop. Do not partially comply.

---

## 2A. Connector preflight — required before any certification run

Every agent run and every certification run verifies its required connectors **first**, from
`governance/required-connectors.json`. Both Phase 2 agents and all certification runs require
**Blaise_FUB, Google_Drive and Google_Calendar** — all three.

A missing required connector is an **immediate HOLD**: name the exact missing lane(s), make no
certification claim, retrieve nothing, update no registry version, and do not merge.

**Never substitute a reported value for one that was not retrieved.** This control exists because a
certification run on 2026-08-31 began with all three connectors disconnected while four canonical
version numbers had been supplied in conversation. Accepting them would have recorded unverified data
as verified. See IF-2026-08-31-016.

---

## 3. Escalation routing

| Situation | Route to |
|---|---|
| Business strategy, prioritization, client judgment | ChatGPT 01 — Command Center & Execution Review |
| Lead conversion, FUB relationship decisions, dated next action | ChatGPT 02 — Lead Conversion & FUB Desk |
| Marketing, content, distribution decisions | ChatGPT 03 — Marketing & Relationship Engine |
| **SOP change, tool change, certification change, repeated gap** | **ChatGPT 04 — Systems, Training & SOP Control** |
| Client-facing asset production | ChatGPT 05 — Client Deliverables & Presentation Builder |
| MLS / Click / SkySlope / Ylopo execution | Claude-in-Chrome operator |
| Legal, form, compensation, brokerage policy | Blaise → managing broker as applicable |

Durable system findings always route to **ChatGPT / 04**, never applied unilaterally here.

---

## 4. What "HOLD" means in an agent report

`ESCALATION / HOLD` in the Operator Execution Report must state:
the exact item held · the HOLD reference (H-n) or hard-stop number · what would clear it · who owns
clearing it. Never report a held item as completed, deferred, or not applicable.
