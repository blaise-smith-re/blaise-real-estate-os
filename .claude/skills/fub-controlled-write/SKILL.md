---
name: fub-controlled-write
description: Maintain Blaise's individual Follow Up Boss records through a concise read-decide-write-readback workflow. Use for notes, tasks, contact fields, appointments, deals, channels, tags, and external interaction logs. Internal maintenance is owner-authorized; external communication is not.
---

# FUB Internal Maintenance

Follow Up Boss is the source of truth for contact identity, relationship state, communication
history, promises, tasks, and dated next actions. Keep it accurate without turning normal CRM work
into an approval exercise.

## Do this

1. Resolve the intended contact using the strongest available identifiers and surrounding context.
   Minor name variations, nicknames, formatting differences, or stale non-material fields do not
   block work. Stop only when there is a meaningful risk of updating the wrong person.
2. Read only the current FUB information needed to understand the requested change and avoid an
   obvious duplicate or conflict.
3. Decide the best internal update. Prefer the smallest change that makes the record accurately
   reflect reality and leaves one clear dated next action when follow-up is warranted.
4. Execute the write directly. Internal notes, tasks, task completion/rescheduling, individual
   profile fields, existing-stage moves, channels, approved tag usage, appointments, deals, and
   external interaction logs do not require Blaise to approve each step.
5. Read the affected record back. If it landed correctly, continue. If it did not, correct a safe
   obvious mismatch once; otherwise surface the exact remaining issue.
6. Report the outcome briefly: what changed, the important next action, and anything Blaise should
   understand. Do not produce a certification packet for ordinary maintenance.

## Approval boundary

Blaise reviews immediately before **SEND / SUBMIT / PUBLISH / SIGN / SPEND**. Creating or updating an
internal FUB record is not one of those actions. An FUB appointment invitation is external and must
remain off unless Blaise has reviewed and approved the send. Logging an externally completed call or
text records history; it does not place a call or send a message.

## Keep real controls

- Never guess when two plausible contacts remain materially indistinguishable.
- Do not store passwords, secret words, SSNs, full account numbers, wire instructions, or unrelated
  sensitive information in FUB.
- Do not create or modify shared stages, Smart Lists, action plans, automations, lead-flow rules,
  team templates, or other shared team infrastructure without the appropriate team authority.
- Do not blind-retry after a lost write response. Read back first because the write may have landed.
- Use `America/Chicago` for dated tasks and appointments unless the client situation clearly controls
  another timezone.

## Done when

FUB reflects the current relationship state, the requested update exists once, any stale superseded
task was handled appropriately, and the record carries the right dated next action.
