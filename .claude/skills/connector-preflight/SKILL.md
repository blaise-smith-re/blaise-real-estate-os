---
name: connector-preflight
description: Verify every required connector lane is available before any agent run, retrieval, certification claim, or write. Use at the start of every agent run. A missing required connector is an immediate HOLD for that lane only - never a substitution of reported data for retrieved data, and never a silent partial run.
---

# Connector Preflight

**Run this first. Before retrieval, before analysis, before any certification claim.**

Required and optional lanes per agent are declared in `governance/required-connectors.json`.

## Procedure

1. **Read the manifest** for the invoking agent: `required` and `optional` connector lists.
2. **Verify each required lane** is present in the current tool surface (tool prefix from the
   manifest's `connectors` table).
3. **If a required lane is missing:** retry once — connectors reconnect between turns. If still
   missing, **HOLD that lane's work only.**
4. **If an optional lane is missing:** mark it unavailable, continue, and disclose the gap under
   `MISSING INFORMATION`.
5. **Report the preflight result** in every Operator Execution Report.

## The HOLD rule

A missing **required** connector means:

- name the exact missing lane(s);
- make **no** certification claim that depends on it;
- retrieve nothing from it and **update no registry version**;
- **never substitute a reported value for one you could not retrieve**;
- continue any work that genuinely does not depend on that lane.

**Partial certification is never a permitted outcome.** A run either had what it needed or says it
did not.

## Why this exists

A certification run on 2026-08-31 began with all three required connectors disconnected while four
canonical version numbers had been supplied in conversation. Accepting them would have recorded
unverified data as verified — the same failure mode that produced the withdrawn IF-2026-08-31-007.
The hazard is not the outage. It is the pressure to keep a gate moving by treating reported data as
retrieved data. See IF-2026-08-31-016.

## Required block

```
CONNECTOR PREFLIGHT
  required : <lane> AVAILABLE | MISSING · ...
  optional : <lane> AVAILABLE | MISSING · ...
  result   : PASS | HOLD (<lanes>) | DEGRADED (optional <lanes> unavailable)
```
