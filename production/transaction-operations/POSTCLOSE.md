# Closing to ongoing relationship

Everyday entry: **“Close out [client/property] and prepare the right personal follow-through.”**
Use the existing transaction Workbench or direct Codex. Read current Transaction Operations
→ Closing Confirmation and Closeout, the applicable Buyer/Seller lifecycle, Lead Conversion
and Outreach → Post-Closing Review Request. Their registered Drive sources own procedure;
this file describes the implementation. Reuse fresh reads.

## Operating path

1. Resolve the exact client, property, transaction, owner and existing Drive folder. Read the
   authorized closing party's actual confirmation. A projected date, signing, vendor review
   promotion, CRM label or passed appointment does not prove completed closing. No need to
   re-abstract the entire purchase agreement to act on an adequate closing confirmation;
   return to originals only for unresolved terms, possession, amendments or a conflict.
2. Read current FUB contact/deal/unfinished tasks, material sent/replied/draft correspondence,
   review state and relevant provider/TC updates. Use actual assignment; do not assign Laura
   by default. Preserve source dates, coverage gaps and missing personal-phone visibility.
3. Prepare task-local input below and run `postclose.py`. Author short, relationship-specific
   copy; classify actual messages rather than inferring delivery from their wording. Keep
   reported review submission distinct from a verified public review. Use current approved
   links and their actual destination-verification state. Never infer client satisfaction.
4. Apply useful missing internal deltas through the existing authorized FUB/Drive lane. Resolve
   the exact current pipeline stages and deal before a change. Keep a contact's other active
   transactions in view. Reconcile only tasks supported by specific completion/obsolescence
   evidence; an ended transaction does not fulfill an outstanding client promise. Reuse
   meaningful existing tasks; do not create one merely because a draft exists.
5. Keep durable transition context and material originals in the existing Drive home. FUB
   gets concise relationship state, actual promises and the Drive pointer. Deduplicate by
   source ID/date and meaning. Native sent mail is not a reason to create another interaction
   log. Confirm material saves independently; an uncertain response requires a read before
   retry. External messages stay drafts until the current send authority applies.

Return the best next move, actual saved changes, review drafts and any limitation affecting
action. Preserve owner/resume condition for unfinished title, possession, file or commission
work; do not turn every administrative wait into a Blaise task. Keep financial administration
out of client copy. Existing schedules remain unchanged.

## Small task-local input

The fictional `fixture()` in `tests/test_postclose.py` shows the required schema. Inputs and
outputs belong outside Git. `mode` is `live`, `historical_replay` or `synthetic`; replay emits
no internal change proposals. Current source reads populate:

- Exact case/property IDs, represented side, FUB person/name/user 33, explicit-offset as-of.
- `records`: source ID/locator, exact case/person/property binding, actor/role, kind, occurrence
  and observation times, readable text and actual delivery status. References are `{record, quote}`.
  The agent verifies source meaning/role; the code checks identity, chronology and cited text.
- `closing_events`: scheduled/signed/confirmed/disputed with evidence. Only the authorized
  closing party can confirm. Later conflicts hold dependent closed claims.
- `touches`: congratulations, check-in, request/reminder/agreement/decline/submission/verified
  review, or referral; actual status and affected review platforms. A saved draft is not sent.
- `wrap_up` and `relationship_context`: relevant evidence, real owner, outcome and resume
  condition. Separate client-confirmed facts, reported plans, agent offers and commitments.
- `coverage`, channel eligibility and restrictions; current `review_policy` source/read time,
  reminder window and approved exact links. Policy is supplied from Drive, not frozen in code.
- `draft_copy`: operator-authored text plus context evidence. Only supported kinds are emitted.
  A check-in/referral needs a sourced reason, not just a closing date. Missing history/eligibility
  or destination checks hold outreach while independent preparation continues.
- `crm`: current exact deal/contact state and other-transaction coverage; optional task
  dispositions include the task's own person/user IDs, supported outcome and reason.

```bash
python production/transaction-operations/postclose.py --case /private/case.json --out /private/new-run
python -m unittest discover -s production/transaction-operations/tests -p 'test_postclose.py'
```

Outputs: `postclose.json` (review plan with exact identity, evidence pointers and proposals)
and `review.md` (human-readable drafts). Re-running the same input is deterministic and
does not write to Gmail/FUB/Drive. The output directory must be new. Connector readback,
not a generated plan, establishes completed maintenance. No new tracker, database, listener,
scheduled job or automatic sender is included.
