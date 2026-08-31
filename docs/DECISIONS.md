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
