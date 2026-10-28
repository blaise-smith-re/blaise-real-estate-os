# Accepted-contract kickoff extension

Active-task implementation added October 28, 2026. Current Drive Transaction Operations Runbook owns business rules; Buyer Lifecycle SOP owns buyer communication. Fetch both through `governance.json`. Their kickoff sections were updated in place. This extension is included in version 1.1.0. The existing Drive delivery record identifies the published source and portable ZIP revision.

## Everyday use

From the exact buyer Workbench: **“Process this accepted agreement: organize the transaction, prepare Laura's handoff and my buyer's next steps, and show anything that needs me.”** Supply the original or point to the relevant email. The agent resolves existing context and prepares inputs; Blaise does not maintain JSON files.

The agent first retrieves current authority and source records, binds the actual client/property/transaction and reviews the complete original package. It then uses the existing `engine.py` command with `case.kickoff` enabled. The engine remains an evidence validator and artifact generator, not an automatic signature reader or business-system writer.

## Task-local input contract

All client inputs and outputs stay outside this repository. `tests/test_kickoff.py` illustrates fictional inputs only.

- `purpose`: `active_task` or `historical_replay`.
- `records`: exact transaction/property-bound evidence read during the task. Each has `id`, `kind`, actual `actor`, stable `locator`, explicit-offset `observed_at` and the minimal relevant `text`. Evidence references use `record` plus an exact `quote`. No credentials or unnecessary financial support.
- `details`: recipient-reviewed field/value/evidence objects with `needed_by_tc: true`. Contract facts use original citations; routing/lead-source context uses source-record citations. A legitimately inapplicable item needs its supported case-specific reason; unknown is not zero or waived.
- `reviewed_supporting_sources`: original IDs actually reviewed for supporting facts such as representation/compensation. This is not permission to treat an unsigned proposal as controlling.
- `attachments`: source ID, exact safe filename, purpose, `recipient_role: tc`, `reviewed_for_recipient`, `reviewed_sha256` and whether required. A link alternative requires current actual-recipient access evidence. All executed source documents must be represented. The generator copies unchanged reviewed bytes into the review packet and checks their hashes again.
- `inspection`: explicit reviewed election, original `document`/`evidence`, approved options with approval evidence, optional buyer choice, actual booking/provider/time/status evidence and a `review_plan`. The plan binds owner/evidence, real recheck path/time, expected report and decision-review time. `booking_choices.agent_can_help` with owner evidence enables the offer to help arrange or let the buyer book. Read the current approved provider choice from Drive; no provider is hardcoded into the engine.
- `follow_through`: obligation ID mapped to actual owner if reassigned, assignment evidence and real source-system/human recheck path. Delegation is not completion.
- `handoff_history`: prepared/sent/acknowledged, exact transaction/package keys, recipient and evidence. Sent requires a message ID; acknowledgment must come from the assigned TC. Reuse the prior fingerprint, not a newly invented package association. Bind forwarded mail to the original message/document set.
- `buyer_notice`: actual prior-notice evidence for duplicate-outreach review.
- `crm`: exact client ID, fresh deal matches by client/property, coverage across relevant statuses and actual pipeline-read status. Multiple matching deals or incomplete discovery hold the affected deal mutation. Reconcile concurrent transactions and later stages before changing the separate contact.

Original citations, execution review, chronology and deadlines continue to use the existing `case.json` / `analysis.json` contract. The kickoff extension cannot bypass that execution gate. Do not populate booleans from filenames or email summaries.

## Run through completion

1. Generate with the existing `engine.py` CLI. With kickoff enabled, use `kickoff/Laura-or-assigned-TC.txt`, `kickoff/Buyer-next-steps.txt`, `kickoff/review.json` and its actual `attachments/`. Generic older client/TC files are removed so two inconsistent drafts are not delivered.
2. Inspect each recipient draft and all unresolved items. A draft may be prepared while acceptance or attachment-dependent sending remains held. No generated output establishes sending, booking, assignment of a new TC, legal effect or completion.
3. In an active live task, perform the currently authorized supported internal operations through the existing owners/connectors: locate/reuse the transaction folder, file only missing unchanged originals, reconcile the exact FUB deal and separate contact, attach missing originals through the supported Files action, and retain genuine follow-through. Fresh duplicate checks immediately precede mutations. The generator's operation list alone is not completion.
4. Independently read back each material effect. Pass receipts to `kickoff.reconcile_receipts(plan, receipts)` and save the reconciled result privately. A receipt binds operation, transaction/package keys, actual target, state, readback locator/time and matched fields. `PENDING`/`BLOCKED` needs `next_owner` and `resume_condition`. Do not manufacture receipts. A held operation cannot become saved through this function. Historical replay receipts must be explicitly replay-only and cannot claim live closeout.
5. Return actual saved paths/record IDs, draft dispositions, owner/deadline/source/next action and the precise remaining decision. Communications remain review drafts under current sending rules. No Calendar mutation or paid booking is implied.

The current FUB `update_contact_deal` tool exposes `attachment_uri`, `attachment_file_name` and optional `attachment_file_size` for a standalone Files operation. This links a durable hosted original; it does not upload bytes or change Drive sharing. Its exact-deal read may omit existing Files, and the registered attachment reader has limited visibility. Do not interpret an omitted field as an empty list. Use a supported visible Files read/UI to check duplicates and verify the result; otherwise hold only that attachment step with an owner/resume path. Never blindly retry a failed attachment POST.

`transaction_key` binds the same client/property/case; `package_key` binds the executed obligation chronology. Changed original hashes/versions generate an amendment-specific revision. Preserve the stable case ID. Repeated notification of the same package suppresses an initial handoff already sent/acknowledged; a prepared version updates the existing draft. Source-system duplicate checks are still mandatory and independent of a local hash.

## Verification and deployment limits

Run `python -m unittest discover -s production/transaction-operations/tests -v` from the repository root. Tests cover attachment bytes and omitted package members, execution holds, inspection choices/booking/waiver, chronological review windows, duplicate/acknowledged/amendment states, ambiguous deal targets, independent receipts and private-recipient separation. Fictional originals carry explicit synthetic markings; historical observations belong only in the private delivery evidence.

The local generator has no connector credentials or transport. Live end-to-end closeout remains unproven until an actual authorized transaction completes and its effects are independently read back. No inbox listener or recurring kickoff is installed. Unattended processing would require an explicitly configured supported trigger/runner, durable message and revision checkpoints, connector access, retries/failure reporting and verified notifications. Do not describe an unrelated existing schedule as this workflow.
