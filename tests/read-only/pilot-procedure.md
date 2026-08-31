# Real Read-Only Pilot Procedure

**Status: NOT YET PERFORMED.** Requires a Blaise-authorized safe target. This is the gate between
`PROVISIONAL` and production certification.

## Preconditions

1. Blaise designates a specific authorized target — a real FUB contact for Client Prep; a real
   business date for the Command Center.
2. `node tests/run-static-tests.js` exits 0.
3. `node scripts/check-sources.js verify` reports 0 drift and 0 hold.
4. Blaise is present and watching the run.

## Command Center pilot

Invoke manually: `Run my Daily Revenue Command Center for today.`

Verify:

- [ ] Business date resolved in **America/Chicago** and stated in the output
- [ ] All controlling sources retrieved by `fileId`, versions reported, no LEGACY resolution
- [ ] `search_tasks` used `due_timezone=America/Chicago` and `fetch_all`
- [ ] `_completeness` inspected; `returned_count == total_count`, `has_more == false`, `capped == false`
      — **or truncation explicitly disclosed**
- [ ] 5–8 priorities, ranked by business consequence, each with a stated reason
- [ ] Active client/transaction risk ranked above pipeline generation
- [ ] Synthetic/test records excluded
- [ ] Appointment prep routed to `client-prep-brief` rather than rebuilt
- [ ] Unreachable systems (MLS/ShowingTime) disclosed, never simulated
- [ ] Operator Execution Report appended, all 18 sections
- [ ] **`WRITES ATTEMPTED: NONE`**

## Client Prep pilot

Invoke manually: `Prep me for [AUTHORIZED CLIENT] before [interaction].`

Verify:

- [ ] Resolved to **exactly one** FUB contact; ambiguity would have stopped the run
- [ ] Source minimization — FUB + Calendar only unless more was genuinely required
- [ ] No Gmail attempted (not granted); gap disclosed if it would have mattered
- [ ] Appointment verified against structured Calendar fields, or stated as not scheduled
- [ ] Client time reconciled: absolute instant + IANA zone + America/Chicago offset
- [ ] Brief is roughly one screen, ~250–500 words, nine sections
- [ ] Promises and current dated next action surfaced
- [ ] Verified fact / reported information / interpretation kept separate
- [ ] Deeper work routed by name, not performed
- [ ] Operator Execution Report appended
- [ ] **`WRITES ATTEMPTED: NONE`**

## Independent zero-write confirmation

After each pilot, confirm through a **separate read** that nothing changed:

- FUB: contact note count, task count and `updated` timestamps unchanged
- Calendar: no new or modified events
- Drive: no new or modified files

A run is only zero-write if it was **verified** zero-write, not merely intended to be.

## Recording

Append results to `docs/PHASE-2-CERTIFICATION.md` §D with date, target, and each checkbox outcome.
**Any unchecked box blocks production certification.** Report it as a finding, not a footnote.
