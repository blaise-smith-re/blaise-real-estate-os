---
name: chrome-operator-handoff
description: Produce a formal execution request for a system Claude Code cannot reach - Northstar/Matrix, Click Contracts, SkySlope, Ylopo, ShowingTime - and ingest the verified result. Use whenever a run needs MLS facts, contract preparation, showing data, or any browser-lane action. Never simulate, infer, or substitute remembered data for an unreachable source.
---

# Chrome Operator Handoff

**Claude Code has no browser lane.** Northstar/Matrix, Click Contracts, SkySlope, Ylopo and
ShowingTime are Claude-in-Chrome lanes — certified there, unreachable here. This is permanent for
this execution surface, not a temporary outage.

## The rule

1. **Disclose the gap** under `MISSING INFORMATION`. Name the system.
2. **Emit a handoff packet** (below) so the Chrome operator can execute without re-deriving context.
3. **Never simulate, infer, or substitute remembered data.** A property fact that did not come from a
   live verified source this run does not appear in the output — not as an estimate, not as
   "approximately", not as background context.
4. **Do not stop the whole run.** Complete everything not dependent on the missing source.

An undisclosed narrowing produces output that looks complete and is not. That is the most likely way
an agent here produces a plausible wrong answer.

## MLS research request

```
MLS RESEARCH REQUEST
  TARGET PROPERTY / GEOGRAPHY
  REQUIRED FACTS          exactly what the decision needs, nothing more
  REQUIRED QUERY          property type · status set · date window · geography boundary
  METRIC DEFINITIONS      how each number is computed, if statistics are requested
  AS-OF DATE              the date the result must be true as of
  RETURN FORMAT           fields expected back, one row per record
  WHY                     the decision this unblocks
  CONTROLLING SOP         the SOP governing the downstream work
```

## Browser execution request (Click Contracts / SkySlope)

```
PRE-ACTION CHECKLIST     what must be true before the operator acts
BROWSER EXECUTION REQUEST exact system · exact record · exact action class
POST-ACTION VERIFICATION  what the operator must confirm afterward
REQUIRED READ-BACK        the exact fields to re-read and report
FILING HANDOFF            where the artifact must end up
UNRESOLVED HOLD           anything still blocked, and what would clear it
```

## Ingesting the result

When verified results come back: label every fact **VERIFIED (Chrome operator, <as-of date>)**,
carry the as-of date into the output, and keep it separate from professional judgment. If the
returned data does not answer the required facts, say so rather than filling the gap.

## Consequential boundary

The handoff **requests**; it never authorizes. MLS Add/Edit, listing/status changes, submissions,
sends, portal creation, access-code disclosure, Click Send/Sign/Deliver/Accept/Reject/Counter and
SkySlope submission all remain separately controlled human actions.
