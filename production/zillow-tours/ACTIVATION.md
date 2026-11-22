# ChatGPT activation handoff

The private Morning Desk integration is deployed. The Gmail arrival subscription,
ChatGPT wakeup, actionable private notification and changed morning schedule still
need their actual saved settings and delivery receipts. Do not substitute polling.

## Email Triage

In ChatGPT Automations, create a separate automation named **Email Triage — Zillow tours**.
Select **Gmail / message added**, account **blaise@buysellhometeam.com**. Include all
Gmail categories, not only Inbox or unread mail. Process Zillow Premier Agent tour
requests/bookings, related ShowingTime updates, and incoming changes matching an
existing tour's exact buyer or thread. If the trigger cannot express the existing-tour
condition, use message-added for that one mailbox and perform this narrow relevance
check at the start of each event run. That is event screening, not periodic polling.
Exclude routine marketing and feedback-only mail from creating new actions.

Use the existing Gmail, FUB, Drive and private Morning Desk connections. Save this
task instruction (the deployed contract contains the complete command schemas):

> On this Gmail message-added event, read morning_desk_get_contract and follow its
> zillowTours contract using zillow_tours_read and zillow_tours_command. Read the actual
> arriving message, complete relevant thread and headers in the team account. Resolve
> the exact FUB buyer by email or phone and verify assignedUserId 33. Check the latest
> relevant FUB conversation, calls, notes, tasks and Gmail SENT before deciding what
> Blaise owes. Read the current Outreach Playbook through the Source Map for the reply.
> Merge request, forwarded copies, booking and later changes into the existing tour.
> Recheck source state after drafting. If Blaise owes a move, apply the existing
> ! Blaise label on the original message and prepare a genuine originating-account
> draft or exact FUB copy-ready reply. Claim one private alert before notifying; notify
> only when mayNotify is true and the latest source still supports the move. Preserve
> edited drafts. An uncertain delivery must be reconciled, never blindly repeated.
> Stay quiet for duplicates, already answered conversations and non-actionable mail.
> When Zillow/ShowingTime confirms and Blaise has already contacted the exact buyer,
> start the existing Buyer Workbench showing prep, reuse existing assets, and record
> actual destination readback. A prepared handoff is not delivered prep. Cancellation
> retires that tour's action and handoff; a new time updates the same tour. No client
> sends, booking, Calendar mutation or Showami spending. Apply existing FUB closeout
> only for a missing material outcome, with independent readback. Record the actual
> incoming Gmail event, task start, actions and source receipts before the next brief.
> Missing source bodies or unavailable workbench/notification delivery remain explicit.

Read the saved task settings, then persist `activation_receipt` with the actual task
ID, task URL, saved filter, private destination and fresh checkedAt. This records
**configured**, not verified delivery. For the first genuine incoming event, inspect
the unattended run, actual source reads and saved results, then use `run_receipt`
with execution `gmail_push`, the exact observed Gmail message ID, real startedAt,
fresh checkedAt and actual private run URL. Do not generate a test client email.
Read the notification surface independently; phone push remains unverified until
Blaise confirms receipt. The isolated historical replay does not satisfy this test.

If the new two tools are absent from the connected Morning Desk app, refresh its
tool discovery. The existing get-contract tool already exposes their names and
schemas. The supported owner-private HTTP equivalent is GET/POST
`https://blaise-morning-desk.realestateblaise.chatgpt.site/api/zillow-tours`, using
the Site's existing authorized access, never a credential in a prompt or URL.

## Morning Desk at 07:15

Edit the **existing** task `Automation_85c2cba764948191b37cb4b90a395b28`, titled
**Blaise Morning Desk**, in https://chatgpt.com/scheduled. Set daily **07:15**, timezone
**America/Chicago**, keeping enabled status, other duties and private destination.
Do not create another morning task. Its saved time was still **08:30** at the last
readback in this implementation session; the Codex tool controls local automations
and browser control failed with `Emulation.setFocusEmulationEnabled` timeout.

The deployed updater contract now instructs the morning run to read live tour
actions, merge them into the same exact buyer card, and retain open FUB closeout
tasks even when the outreach tour is retired. Preserve the existing pipeline,
Email GPS, behavior research and accepted-contract duties. Save an actual schedule
receipt only after reading back 07:15. A newly saved time remains unverified for
delivery until a natural 07:15 run completes source read, save and independent readback.

## Coverage

Coverage starts with a qualifying email available in the team Gmail account. It
does not include an unclaimed Zillow offer in the FUB mobile app, personal iMessage,
or instant FUB-only changes without a corresponding Gmail event. FUB and both
business Gmail accounts are rechecked when relevant to a tour run and the morning
brief. Never equate a restricted message body with silence.

The documented pre-claim mobile push/SMS path is separate:
https://help.followupboss.com/hc/en-us/articles/37045069908631-Zillow-connections-in-FUB
No accessible unclaimed-offer event was verified in this integration.
