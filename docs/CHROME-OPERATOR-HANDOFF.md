# What This Repository Cannot Do — Chrome Operator Handoff

**Claude Code has no browser lane.** This is the single most important operational limit of this
repository, and it does not change with certification status.

Several of the Real Estate OS's most valuable certified lanes are **Claude-in-Chrome** lanes. They are
certified — and they are unreachable from here.

## Reachable from this repository

| Connector | Status |
|---|---|
| Blaise FUB MCP (38 tools) | Reachable · reads granted · **all 13 writes denied in Phase 2** |
| Google Drive | Reachable · reads granted · writes denied |
| Google Calendar | Reachable · reads granted · writes denied |
| Gmail | Reachable but **withheld entirely** in Phase 2 (D-010) |
| Composio / Instagram | Reachable but not granted — not required by either Phase 2 agent |
| GitHub | Reachable for repo development |

## NOT reachable — route to the Chrome operator

| System | Certified status in the Chrome lane | Why unreachable here |
|---|---|---|
| **Northstar MLS / Matrix** | Production read/search/market-intelligence — **CERTIFIED, repeatable** | Browser-only |
| **Click Contracts** | Sanitized preparation through Review — **CERTIFIED** | Browser-only |
| **SkySlope** | Sanitized test-record read-only mapping | Browser-only |
| **Ylopo** | No certified lane; vendor terms prohibit automated access | Browser-only + vendor terms |
| **ShowingTime** | No certified lane | Browser-only |

## The rule

When a run needs data from an unreachable system:

1. **Disclose the gap** under `MISSING INFORMATION` in the Operator Execution Report. Name the system.
2. **Route it** — name the Chrome operator lane or the canonical workflow that owns it.
3. **Never simulate, infer, or substitute remembered data.** A property fact that did not come from a
   live verified source this run does not go in the output. Not as an estimate, not as "approximately",
   not as context.
4. **Do not stop the whole run.** Complete everything that does not depend on the missing source, and
   state precisely what is missing and why.

## Why this matters more than it looks

Both Phase 2 agents' canonical prompts list Matrix and ShowingTime as available sources — because
those prompts were written for the Chrome operator, where they *are* available. Running the same
prompt here silently narrows the source set.

That narrowing is safe **only if it is disclosed.** An undisclosed narrowing produces a brief that
looks complete and is not. This is the most likely way a Phase 2 agent produces a plausible wrong
answer.

## Handoff phrasing

> "Current MLS status and comparable analysis for [property] require the Northstar/Matrix lane, which
> is not reachable from Claude Code. Run this through the Claude-in-Chrome operator using
> [canonical workflow]. Everything below is from FUB and Calendar only."

Short, specific, and it tells Blaise exactly what he is and is not looking at.
