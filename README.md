# blaise-real-estate-os

**Claude Code execution and multi-agent operating layer for Blaise Smith's real estate business.**
Buy Sell Home Team | RE/MAX Results.

---

## What this repository is

The **execution layer**. It holds agent definitions, reusable skills, tests, source pointers, tool
policy, and engineering documentation.

## What this repository is NOT

A CRM · a task manager · a document system of record · a calendar · a transaction database · a client
record · a parallel SOP library.

**Google Drive is canonical for all business documentation** — the Business Operating Manual, SOPs,
approved prompts and templates, client assets, transaction records. None of it is copied here. Agents
retrieve it live, by `fileId`, at runtime.

## Authority model

| Role | Owns |
|---|---|
| **Blaise Smith** | Principal. Final business decision-maker. Approves all consequential actions. |
| **ChatGPT** (Real Estate OS project) | Business orchestration, strategy, source control, SOP change control, cross-system QC |
| **Claude** | **Execution operator** — analysis, preparation, routing, certified execution, QC |
| **Source systems** | Always authoritative |

Set by Business Operating Manual §4.12. **Not amendable from this repository.**

## Layout

```
CLAUDE.md                    Operating contract for every session in this repo
CHANGELOG.md                 What changed, when, why

governance/
  source-registry.json       ★ fileId pointers + version pins. THE keystone artifact.
  system-ownership.md        Which system owns what (pointer to BOM §4)
  tool-policy.md             READ / CERTIFIED WRITE / APPROVAL / HOLD, per connector
  certification-register.md  Agent certification status (mirror of Execution SOP §5B)
  handoff-contract.md        Task Packet + Operator Execution Report
  escalation-and-hold.md     Hard stops and the standing HOLD list
  improvement-findings.md    Continuous improvement log, three-tier change model

.claude/
  agents/                    daily-revenue-command-center · client-prep-brief
  skills/                    retrieve-canonical-source · chicago-date-anchor · operator-execution-report
  settings.json              Permission enforcement (allow / deny)

tests/                       Static suite, adversarial scenarios, synthetic fixtures
scripts/check-sources.js     Source-drift checker
docs/                        DECISIONS · PHASE-2-CERTIFICATION · CHROME-OPERATOR-HANDOFF ·
                             SOP-MAINTENANCE-CERTIFICATION-PATH
```

## Agents — Phase 2

Both are **manual invocation only** and **read-only**. `WRITES ATTEMPTED` is always `NONE`.

| Agent | Purpose | Sources | Status |
|---|---|---|---|
| `daily-revenue-command-center` | Ranked daily priority brief, 5–8 items | FUB + Calendar (read) | PROVISIONAL — static PASS, live pilot pending |
| `client-prep-brief` | ~5-minute pre-conversation brief for one named client | FUB + Calendar (read) | PROVISIONAL — static PASS, live pilot pending |

Business logic for both lives in Drive and is retrieved at runtime. The agent files are wrappers.

## Quick start

```bash
node tests/run-static-tests.js                 # 24 static checks, exit 0 = pass
node scripts/check-sources.js plan             # what to retrieve from Drive
node scripts/check-sources.js verify --results tests/read-only/source-drift-run-2026-08-31.json
```

## Standing HOLDs

**Unattended / scheduled agent execution · all FUB writes · all Gmail · all Calendar writes · all Drive
business-record writes · all external communication · browser automation · merge to `main`.**

Full list with basis: `governance/escalation-and-hold.md`.

> This repository *has* scheduling capability. It must not be used for agent execution — that would
> silently defeat an active certification gate. See HOLD H-1.

## Not reachable from here

Claude Code has **no browser lane**. Northstar/Matrix, Click Contracts, SkySlope, Ylopo and
ShowingTime are Claude-in-Chrome lanes — certified there, unreachable here. Agents must disclose the
gap and route it, never simulate the data. See `docs/CHROME-OPERATOR-HANDOFF.md`.

## Contributing

Repo-native engineering documentation may be maintained directly. Canonical Drive business
documentation may not — produce an exact proposed diff as an Improvement Finding and route it to
ChatGPT / 04 — Systems, Training & SOP Control.

Update `CHANGELOG.md` and `docs/DECISIONS.md` in the same session as the change. Never change business
policy, authority, or a certification gate in a commit.
