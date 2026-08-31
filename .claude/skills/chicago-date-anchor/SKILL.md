---
name: chicago-date-anchor
description: Anchor all business date and time interpretation to America/Chicago for Minnesota real estate work. Use whenever a run interprets today/tomorrow, filters by due date, presents a client appointment time, or reconciles a Calendar event. Prevents connector default timezones from silently shifting a business day or a client appointment.
---

# America/Chicago Date Anchor

Buy Sell Home Team operates in Minnesota. **America/Chicago is the expected local business
timezone.** A connector default must never silently shift a business day or a client appointment.

This is not a formatting concern. Two documented incidents drive it:

- The Client Prep Dallas pilot reported the Claude Calendar lane as **America/New_York**.
- A Phase 1 Calendar event verified as correct by absolute instant rendered a **wrong offset/label
  pairing** in `get_event`, while `list_events` with an explicit America/Chicago timezone rendered the
  correct interval.

## Rule 1 — Resolve the business date at runtime

At the start of every run, resolve the **current local business date in America/Chicago from the
execution environment** and state the target date being reviewed.

```bash
TZ=America/Chicago date +"%Y-%m-%d %H:%M:%S %Z (UTC%z)"
```

- "Today" and "tomorrow" derive from **that Chicago date** — never from a connector default, never
  from a UTC timestamp, never from assumption.
- If Blaise explicitly supplies a target date, use it and say so.
- **Always state the resolved date in the output.** A brief that does not name its target date cannot
  be audited.

## Rule 2 — Return HOLD rather than guess

If the execution environment and an authoritative scheduling source **materially disagree** about the
calendar date and the target cannot be resolved, **return HOLD**. Never silently pick one.

## Rule 3 — Three-way reconciliation before presenting any client time

Never present a client-facing time from a single field. Reconcile all three:

1. the stored **absolute instant** (UTC),
2. the event's **IANA timezone**,
3. the **expected America/Chicago local offset** for that date (CST `UTC-06:00`, CDT `UTC-05:00`).

- If a rendered human-readable offset conflicts with the IANA zone, **trust the IANA zone plus the
  absolute instant.** Do not trust `get_event`'s rendered offset alone.
- Prefer a `list_events` read with an **explicit** America/Chicago timezone to confirm a disputed
  interval.
- If a connected Calendar reports a conflicting zone such as `America/New_York`, **flag it as a
  lane/configuration mismatch** and normalize only from verified event timing.
- **Never silently shift a client appointment because of a connector default.**

## Rule 4 — Date filtering must be explicit

When filtering FUB tasks by date, pass `due_timezone=America/Chicago` with `due_on` / `due_from` /
`due_to`. Never rely on an implicit server default. See the `search_tasks` completeness control in
`governance/tool-policy.md` section 2.

## Rule 5 — Preserve absolute timestamps

Keep the underlying absolute instant alongside any local rendering. Never overwrite an absolute
timestamp with a locally formatted string; a re-render in another zone must remain possible.

## Required disclosure

Every run using this skill states, in the Operator Execution Report:

```
DATE ANCHOR   America/Chicago | business date <YYYY-MM-DD> | resolved from <source>
              [connector timezone mismatch: <zone> — flagged, not applied]
```
