---
name: chicago-date-anchor
description: Anchor all business date and time interpretation to America/Chicago for Minnesota real estate work. Use whenever a run interprets today/tomorrow, filters by due date, presents a client appointment time, or reconciles a Calendar event. Prevents connector default timezones from silently shifting a business day or a client appointment.
---

# America/Chicago Date Anchor

Buy Sell Home Team operates in Minnesota. **America/Chicago is the expected local business
timezone.** A connector default must never silently shift a business day or a client appointment.

This is not a formatting concern. **Three** documented incidents drive it:

- The Client Prep Dallas pilot reported the Claude Calendar lane as **America/New_York**.
- A Phase 1 Calendar event verified as correct by absolute instant rendered a **wrong offset/label
  pairing** in `get_event`, while `list_events` with an explicit America/Chicago timezone rendered the
  correct interval.
- **2026-09-01, live client appointment (IF-2026-09-01-019).** `get_event` returned
  `2026-09-01T10:00:00-04:00` labeled `timeZone: America/Chicago`. `-04:00` is never a valid Chicago
  offset. The true time was **9:00 AM CDT**. A naive read would have sent Blaise to a first showing
  with a brand-new lead **one hour late**.

The third incident is why Rule 3 below is now **mandatory on every run** rather than conditional on
an interval looking disputed. A single read never looks disputed. That is exactly how the defect
hides.

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

## Rule 3 — Mandatory three-way reconciliation before presenting any time — **REQUIRED**

**`get_event` and `search_events` rendered local times are not client-facing.** They are a starting
point, never an answer. Before presenting any appointment, showing, deadline or closing time — to
Blaise or to a client — reconcile all three:

1. the stored **absolute instant** (UTC),
2. the event's **IANA timezone**,
3. the **expected America/Chicago local offset** for that date (CST `UTC-06:00`, CDT `UTC-05:00`).

### 3a — The confirming read is mandatory, not preferred

Confirm the interval with a **`list_events` read passing an explicit `America/Chicago` timezone.**
Run it **on every run that presents a time**, not only when something looks wrong. A lone `get_event`
result carries no signal that it is defective.

If the confirming read cannot be performed, **say so in the output and present the time derived from
the absolute instant** — never the raw rendered string.

### 3b — An invalid offset is defective, not merely suspect

America/Chicago has exactly two valid offsets: **`-06:00` (CST)** and **`-05:00` (CDT)**. Anything
else paired with a Chicago label — `-04:00`, `-07:00`, `+00:00` — is a **connector defect**.

- **Discard the rendered local time.** Do not average it, adjust it, or present it with a caveat.
- Recompute from the absolute instant plus the IANA zone.
- **Disclose the discrepancy in the run output**, naming both the defective rendering and the
  reconciled time.

A valid-looking offset can still be wrong for the date: `-06:00` in July or `-05:00` in January is
the right shape in the wrong DST state. Check the offset against **the date**, not just the format.

### 3c — Derive the business date from Chicago, not UTC

The UTC date and the Chicago business date differ for any instant between `00:00Z` and `06:00Z`
(`05:00Z` in CDT). `2026-09-02T04:00:00Z` is **September 1** in Chicago. Never read a business date
off a UTC timestamp.

### 3d — Zone mismatch is a lane defect, not a conversion

If a connected Calendar reports a conflicting zone such as `America/New_York`, **flag it as a
lane/configuration mismatch** and normalize only from verified event timing.
**Never silently shift a client appointment because of a connector default.**

### Reference implementation

`scripts/reconcile-appointment-time.js` implements this rule exactly and is covered by
`tests/run-timezone-tests.js` (DST boundaries, both ambiguous and skipped local hours, the live
IF-019 defect, and UTC/Chicago date-boundary cases). When a reconciliation result is disputed, that
script is the tie-breaker — not a rendered connector string.

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

**Every run that presents a time also states the reconciliation result:**

```
TIME RECONCILIATION   <event/appointment id> | absolute <…Z> | zone <IANA> |
                      reconciled <h:mm AM/PM TZ> | confirming list_events read: YES/NO
                      [RENDERED TIME DEFECTIVE: <raw> — discarded, offset invalid for Chicago]
```

If the line is absent from a report that presented a time, the reconciliation did not happen and the
time is unverified.
