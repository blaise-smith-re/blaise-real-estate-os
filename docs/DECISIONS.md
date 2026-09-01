# Architecture Decision Record

Append-only. Never edit a decision in place — supersede it with a new entry and mark the old one
`SUPERSEDED BY D-nnn`. Decisions here govern **repo-native engineering only**. Business policy,
authority, and certification gates are owned by Google Drive and ChatGPT / 04.

---

## D-001 — This repository is an execution layer, not an operating system
**Date** 2026-08-31 · **Status** ACCEPTED · **Phase** 2

**Context.** The Blaise Real Estate OS already has a governing manual (BOM v1.29), a controlling
execution SOP (v4.27), a routing authority (v4.2), 30+ SOPs and 14 canonical prompts — all in Drive.

**Decision.** GitHub owns only agent definitions, skills, tests, source pointers, tool policy, and
engineering documentation. Google Drive remains canonical for all business documentation. No BOM, SOP,
canonical prompt body, client asset, or client record is copied here.

**Consequence.** Agents must retrieve their business logic at runtime. Enforced by test T-22 (no
cached canonical content) and T-16 (no embedded prompt bodies).

## D-002 — Claude remains the execution operator; ChatGPT remains the business orchestrator
**Date** 2026-08-31 · **Status** ACCEPTED (Blaise, Phase 2 decision 1)

**Context.** The Phase 1 audit found the proposed "Chief of Staff / Real Estate COO" conflicted with
BOM §4.12, which assigns orchestration, source control and SOP change control to ChatGPT.

**Decision.** Claude executes. ChatGPT orchestrates. A future Claude Chief of Staff may orchestrate
**execution lanes** only. **The Business Operating Manual is not amended to change this.**

**Consequence.** No orchestrator agent in Phase 2. `CLAUDE.md` §1 states the boundary and forbids
amending it from this repository.

## D-003 — Agent definitions are wrappers; canonical prompts are retrieved at runtime
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Two requirements collide: "build the agent from the current canonical Drive prompt" and
"do not copy canonical prompt bodies into GitHub."

**Decision.** The agent `.md` file holds only the wrapper — certification basis, tool surface, run
sequence, guardrails, refusals, routing. The **business logic stays in Drive** and is retrieved by
`fileId` at the start of every run.

**Consequence.** A canonical prompt update takes effect on the next run with no repo change. There is
exactly one copy of the business logic and it lives where it is owned. Enforced by T-16.

**Rejected alternative.** Embedding a snapshot of each prompt. Faster at runtime, but guarantees the
exact drift this architecture exists to prevent.

## D-004 — Resolve canonical sources by fileId, never by title
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Drive supersedes a document by copying it to a new file renamed
`LEGACY - <title> - Superseded <date> (vX.Y)`. Verified: the canonical BOM (`1HyBu_Oc…`) was created
2026-08-01 and edited in place through 2026-08-26; the `v1.28` LEGACY snapshot is a *different*
fileId created 2026-08-26.

**Decision.** `fileId` is stable and is the only approved resolution method. Title matching is banned —
it will eventually resolve to a LEGACY copy.

**Consequence.** `governance/source-registry.json` is the keystone artifact. Enforced by the
`retrieve-canonical-source` skill, test T-04, and `check-sources.js` (which HOLDs on a LEGACY title or
a fileId mismatch — both paths verified against fixtures).

## D-005 — Live Drive always wins over the registry pin
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** On any mismatch between `version_pin` and the retrieved document, **proceed on the live
document**, flag `REGISTRY DRIFT`, update the pin, and record it. Never proceed on the pin. Never halt
the run solely because of a version mismatch.

**Consequence.** The registry can go stale without becoming dangerous — the worst case is a flagged
drift, not a wrong-policy execution. Verified by the negative fixture in
`tests/adversarial/drift-negative-fixture.json`.

## D-006 — `.claude/agents/` and `.claude/skills/`, not top-level `/agents` and `/skills`
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** Use the paths Claude Code actually loads.

**Consequence.** A top-level `/agents` directory would be inert. The Phase 1 diagram is adapted, as
Step 1 permits.

## D-007 — No `/templates` directory
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** BOM §14 makes Drive the owner of all approved templates.

**Decision.** Rejected. The only template-shaped artifact this repo owns is the handoff packet, which
lives in `governance/handoff-contract.md` as a lint/test reference, not as authority.

## D-008 — Tool permissions enforced structurally, not by prose
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** Defense in depth. Every write tool is (a) absent from each agent's `tools:` frontmatter
allowlist **and** (b) denied in `.claude/settings.json` at project level.

**Consequence.** For scope-escape (A-4), scheduling (A-6) and canonical-edit (A-12), an agent
*judgment* failure alone cannot produce the prohibited effect. Enforced by T-06 … T-12.

**Note.** The deny list applies to the whole project, including interactive build sessions. That is
intentional: Phase 2 permits no business-system writes from anywhere in this repository.

## D-009 — `Skill` is granted to both agents; no other non-MCP tool is
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Skills are loaded through the `Skill` tool. Without it the three shared skills are
unreachable.

**Decision.** Grant `Skill`. **A skill cannot grant a tool** — it is instructions only — so this
cannot widen the tool surface. `Bash`, `Write`, `Edit`, `Task`/`Agent` are all withheld.

**Consequence.** Agents can load procedure but cannot mutate anything. Enforced by T-11, T-12.

## D-010 — Gmail is withheld entirely in Phase 2
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Both canonical prompts permit narrow Gmail reads *when materially relevant*. But the only
Gmail certification is synthetic draft creation **without read-back**, and the Client Prep pilot passed
*because* it skipped Gmail.

**Decision.** Withhold the connector completely rather than grant a tool the agents are told to almost
never use. Where Gmail would help, the agent discloses the gap under `MISSING INFORMATION`.

**Consequence.** A narrower surface than the canonical prompts allow. This is deliberate: Phase 2
narrows, never widens. Revisit with IF-2026-08-31-004.

## D-011 — `check-sources.js` is a two-part tool, because Node cannot reach Drive
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Drive is reachable only through Claude's MCP connector. A script that claimed to fetch
sources would be dishonest tooling.

**Decision.** `plan` validates the registry and emits the retrieval manifest; `verify --results`
computes drift deterministically from what Claude actually retrieved, and exits non-zero on HOLD.

**Consequence.** Retrieval stays with the only actor that can do it; adjudication is deterministic and
CI-safe. Real evidence: `tests/read-only/source-drift-run-2026-08-31.json`.

## D-012 — Certification is claimed only with evidence; both agents ship PROVISIONAL
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** A markdown file existing is not certification. Both agents are
`PROVISIONAL — STATIC PASS, LIVE PILOT PENDING`. Static invariants are proven (24/24); the nine
judgment-dependent adversarial scenarios require live invocation against a Blaise-authorized target.

**Consequence.** Neither agent is production-certified at the end of Phase 2. This is the honest
status, not a shortfall to paper over.

## D-013 — Test failures are fixed at the source, not by relaxing the test
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Two failures occurred during the build. T-05 flagged that the registry claimed both agents
required the routing document, which neither retrieves at runtime — **the registry was wrong**, and
`required_by` became `["execution-layer"]`. T-23 flagged that withdrawn finding IF-007 lacked an
`EXACT PROPOSED CHANGE` — **the test was wrong**, because a withdrawn finding has no change to
propose; it now requires `ORIGINAL CLAIM` + `CORRECTION` instead.

**Decision.** Diagnose which side is actually wrong before changing either. Record the reasoning.

**Consequence.** Both failures are documented here rather than silently absorbed.

## D-014 — A unique-match count is not proof of identity
**Date** 2026-08-31 · **Status** ACCEPTED · **Supersedes part of** the original D-012 assumption

**Context.** Live adversarial scenario A-1 proved that `find_contact` **silently excludes Trash-stage
records**. `find_contact("Dallas")` returns `total: 1` — but `find_contact("Bernard Johnson")` returns
`total: 0` for a contact that demonstrably exists, is assigned to Blaise, has four open tasks and
browsed the IDX the previous night. Last-name matching is not the cause: `"Petersen"` returns 1.

**Decision.** The exactly-one rule is necessary but **not sufficient**. Identity must be corroborated
through a second independent path — the `personId` on the triggering task or appointment, an exact
email/phone match, or matching relationship facts in the notes. A zero result never establishes that
a contact does not exist.

**Consequence.** `client-prep-brief.md` and `tool-policy.md` patched (repo-native, within Phase 2
authority). Canonical SOP note routed as IF-2026-08-31-010. The Dallas pilot identity was accepted
only because tasks 30509 and 30536 independently carry personId 18476.

**Why this matters beyond the bug.** The one control protecting against a wrong-person brief was
resting on an unverified assumption about connector behavior. It took a live adversarial probe to
find it — a static test could not have.

## D-015 — Certification is granted only for the scope actually exercised
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** Both agents are promoted to production certified for **manual, read-only, FUB +
Calendar + Drive-source-retrieval** — the exact scope tested. Not for scheduling, not for writes, not
for Gmail, not for any system not exercised in the pilot.

**Consequence.** The promotion is recorded in this repo's mirror register. It is **not** canonical
until ChatGPT / 04 amends Execution Operator SOP section 5B, which still lacks a Claude Code
multi-agent lane (IF-2026-08-31-008). The mirror says so explicitly rather than implying more
authority than it has.

## D-016 — Connector preflight precedes every certification claim
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** A scheduled merge gate began with all three required connectors disconnected. The loss was
discovered at the first tool call, not at the start — and four canonical version numbers had been
supplied in conversation while Drive was unreachable.

**Decision.** Required connectors are declared in `governance/required-connectors.json` and verified
**before** any other work. A missing required connector is an immediate HOLD: name the lane, claim
nothing, retrieve nothing, update no pin. **Never substitute a reported value for one not retrieved.**

**Consequence.** `Step 0 — Connector preflight` in both agents; `escalation-and-hold.md` §2A; static
test T-25. The behavioral proof already exists — the blocked run returned HOLD and left pins stale
rather than accepting the reported versions.

**Why it matters.** The hazard was never the outage. It was the pressure to keep a gate moving by
treating reported data as retrieved data.

## D-017 — Corroboration establishes the right record, not global uniqueness
**Date** 2026-08-31 · **Status** ACCEPTED · **Refines** D-014

**Context.** A-1 recertification reached `find_contact("Dallas") → total: 1` and, per the hardened
rule, declined to accept it. Identity was then established from Blaise's own dated task (30509)
carrying personId 18476, plus a stable-ID read-back.

**Decision.** Corroboration proves *this is the record the work is about* — it does not prove no other
same-named record exists. A same-named Trash-stage record may remain invisible (IF-010) and does not
need to be ruled out when the triggering task points at a specific ID.

**Consequence.** The standard is met by an independent binding to a stable ID, not by an exhaustive
search. Agents must state the residual limit rather than implying uniqueness was proven.

## D-018 — Build the CRM department fully; gate only the last-mile tool grant
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Phase 3 mandate: build the write-capable CRM department. Exec SOP v4.28 §1B-1, retrieved
live: no build, test, merge or deployment grants FUB write authority without a separate canonical
control. The three write classes are certified on the **FUB MCP/API lane** but no control names a
**Claude Code actor**.

**Decision.** Build the department, the 17-step controlled-write sequence, the idempotency matrix, the
handoffs and the tests in full — and grant **zero** write tools. The agent runs through step 11 and
emits a `CRM WRITE REQUEST` packet. CGQ-001 queues the canonical grant.

**Consequence.** One canonical patch away from live. All judgment work is done; Blaise executes a
prepared, pre-checked write. Structurally contained: tools absent from the grant **and** denied
project-wide, so a judgment failure cannot produce the prohibited effect.

**Why not just grant them.** Blaise authorized the build, but the SOP requires action-specific
certification *and* a canonical change record. Granting on chat authorization alone would be exactly
the "code build grants write authority" inversion §1B-1 was written to prevent.

## D-019 — Departments are read-only by default; one service owns writes
**Date** 2026-08-31 · **Status** ACCEPTED

**Decision.** Only `lead-conversion-crm` may ever write to FUB. Every other department produces
analysis and routes the outcome. Least privilege by construction, not by instruction.

**Consequence.** Write risk is concentrated in one auditable path that re-verifies identity rather
than inheriting an upstream claim (A-19). Costs a handoff; buys a single place to certify, test and
audit. Enforced by T-28 and T-30.

## D-020 — Browser-only systems are a boundary with a contract, not a gap
**Date** 2026-08-31 · **Status** ACCEPTED

**Context.** Northstar/Matrix, Click Contracts, SkySlope, Ylopo and ShowingTime carry real
certifications in the Chrome lane and are permanently unreachable from Claude Code.

**Decision.** `chrome-operator-handoff` emits structured packets — MLS research request, browser
execution request, post-action verification. Departments build around the boundary rather than
stopping at it, and **never** simulate, infer, or substitute remembered data.

**Consequence.** Seller, buyer, market and transaction departments are all fully useful without MLS
access. The failure mode this prevents — an undisclosed narrowing that looks complete — is the most
likely way an agent here produces a plausible wrong answer.

## 2026-09-01 — Buyer Property Snapshot is a revision of the existing master, not a new asset

**Decision.** Build the showing packet as **v2.0 of `Buyer Property Tour & Value Guide – Master
Template`** (`18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU`), routed for adoption through CGQ-013 —
rather than publishing a new "Buyer Property Snapshot" master.

**Why.** An approved master already exists and is named in SOP 02 §19. Three assets already compete
for the role (IF-018); a fourth would deepen the problem the build was meant to solve. Renaming
would force an SOP §19 change for no operational gain. "Snapshot" is the single-property mode of the
existing asset, which is exactly how SOP 02 §18 already refers to it.

**Rejected alternative.** A standalone snapshot master would have been faster to ship and easier to
design without constraint. It would also have been a fourth competing canonical asset, which BOM
§14/§16 prohibits and which the canonical-asset-control instruction explicitly forbade.

---

## 2026-09-01 — Fact provenance is structural, not prose

**Decision.** Make the source classification a required sibling of every fact value in the schema,
and render it as a dedicated left rail in the design.

**Why.** SOP 02 §18 spends more words on fact classification than on any other subject, and the
WORKBENCH HANDOFF STANDARD requires classifications to survive into the client packet. In four
delivered guides, classification survived only as a prose paragraph ("the following still require
verification…"). Prose does not survive an edit, a rebuild, or a moved section, and a buyer cannot
tell which specific line three pages later is verified. A required field is enforceable; a paragraph
is a convention. Recorded as IF-021.

**Consequence.** A fact cannot be written without choosing its provenance. Source blending becomes
structurally impossible rather than discouraged — and the buyer can see, at a glance, how much of
what they are holding is confirmed.

---

## 2026-09-01 — Superseded client-facing language was dropped and routed, never reworded in place

**Decision.** The client-facing master's page-10 line — *"Buyer representation and agency documents
are reviewed using brokerage-approved forms before private touring"* — was **removed from the v2.0
layout** and routed as CGQ-014 (high-stakes). Claude did not write replacement language into a
canonical asset, and did not quietly paraphrase it into the new design either.

**Why.** SOP 02 v1.11 established the opposite (Tour-First). Correcting client-facing representation
language is a HIGH-STAKES change under the three-tier model: Blaise plus the applicable authority
approve it, and it must be confirmed against current brokerage and MLS requirements at the time of
application. Silently rewording it in the new design would have made the implementation correct and
the canonical asset wrong — the exact divergence CLAUDE.md §10 forbids.
