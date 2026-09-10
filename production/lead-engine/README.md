# Blaise Lead Engine v1

An agent-operated research and preparation companion. Start in **Blaise RE — Growth & Marketing** with “Run my lead engine. Give me today's highest-value opportunities.” Work supplies business context and judgment; a supported agent researches current sources and runs this production code. Direct Codex use remains available. The repository skill routes the request to [CODEX-WORKFLOW.md](CODEX-WORKFLOW.md). No Work project setting has been installed by this build.

The engine returns a small ranked Opportunity Board, factual provenance, unknowns, value angles, contact holds, conditional prep and reasons for inclusion/exclusion. Five is a ceiling by default, not a quota. A source limitation or weak candidate reduces the slate.

**Not approved for release.** Human cards distinguish **MONEY NOW** (plausible near-term seller/hosting business), **PIPELINE** (timely professional business context), and **NETWORK / KNOWLEDGE** (service readiness without a demand signal). Each retains the numerical score and evidence. Counts never present five service relationships as five sales opportunities.

Authenticated property research now has a task-local checkpoint and explicit login/resume path: [BROWSER-RESUME.md](BROWSER-RESUME.md). Preserve completed research while Blaise authenticates. Exact shortlist-only CRM recovery uses the existing connection and adapter: [FUB-READ-RECOVERY.md](FUB-READ-RECOVERY.md).

## Run

Requires Node.js 20+; no npm dependencies, database, API keys or daemon.

```powershell
node production/lead-engine/cli.js plan
node production/lead-engine/cli.js run C:/private/run/pack.json C:/private/run/output
node production/lead-engine/cli.js detail C:/private/run/output/board.json 2 C:/private/run/detail C:/private/run/refreshed-pack.json
node production/lead-engine/cli.js outcomes C:/private/run/outcome-evidence.json
node --test production/lead-engine/tests/*.test.js
node production/lead-engine/bundle.js C:/private/lead-engine-source
```

The `plan` command is an acquisition aid, not a completed lead-engine run. The agent executes that research through current host tools, records observations and runs `run`; Blaise does not manually assemble JSON. There is deliberately no hidden HTTP crawler. `adapters.research(request, {researchLane, governance})` provides a bounded orchestration interface when the host offers a callable operator. It attempts each requested lane, isolates failures and rejects reported nonzero effects. Tool implementations and source permission remain the host's responsibility; a callback assertion is not proof that an arbitrary external function was harmless.

Outputs are UTF-8 Markdown, responsive self-contained HTML, JSON board and evidence record. CLI refuses output inside this repository and refuses to overwrite an existing file. Use a fresh private run directory. Delete/retain private run artifacts according to the governing workflow; the engine maintains no growing opportunity store. Archive only the review package explicitly authorized by Blaise.

## Sources and model

- `adapters.js`: public observations and supervised MLS/export observations. MLS requires observed criteria summary. No direct MLS API integration.
- `evidence.js`, `model.js`: source permission, timestamps, bounded excerpts, evidence categories, normalized identity and source-backed decisions.
- `ranking.js`: adjustable explicit weights and penalties. See [SCORING.md](SCORING.md).
- `gates.js`: current per-target/per-channel eligibility adjudication. Public details never establish consent.
- `readiness.js`: opportunity classes and action-specific readiness. Public in-person events require registration, guest/membership eligibility, Blaise availability and spending review; attendance is not mislabeled as cold outreach. No action is executed.
- `research-session.js`, `session-cli.js`: bounded pause/resume, displayed-criteria checks, retained result position and idempotent observations. No persistent service or scheduler.
- `relationship.js`: reuses `runtime/adapters/fub-read.js` for a single exact shortlist-name lookup capped at three. Discovery is not identity proof. No FUB writes are exposed.
- `detail.js`: binds rank to a saved board ID, rechecks eligibility after refresh and returns opener, 2–4 questions, one next commitment. Old prep is withdrawn when the refreshed candidate no longer qualifies.
- `outcomes.js`: pure aggregation of evidence pointers; no transaction/financial ledger and no inferred funnel transitions.

See [INPUT.md](INPUT.md) for the pack contract and fictional test fixture generator. Live source bodies and candidate data stay outside Git. The portable bundle includes this family, the thin skill and only the existing runtime helpers actually used. Tests are explicitly fictional.

## Boundaries and review status

Research is not contact authorization. ELIGIBLE means the documented gate has current support for that exact target and channel; it still authorizes no send. Personal outreach, hosting commitments, spending and FUB actions retain their separate controls. No automated outreach, contact creation, schedules, Operations Bus or live client-system writer is introduced.

This family is implemented for Work/owner review. Governing pointers in [WORK-REVIEW-PATCH.md](WORK-REVIEW-PATCH.md) remain proposed. Existing released production families and governing sources are preserved. Live demonstration coverage, exact Git/Drive status and known gaps live in the private review package and [VALIDATION.md](VALIDATION.md).
