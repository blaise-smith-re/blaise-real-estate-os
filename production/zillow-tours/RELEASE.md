# Zillow tour integration release — 2026-11-21

The existing owner-private Morning Desk Site is deployed with tour state and tools.
This release does not claim an activated Gmail listener or changed cloud schedule.

- Site source: `76ace3cc5e8b1f85cfdd9d7b75721e6ecd887995`.
- Site version: 21, `appgprj_6ad170600b348191953b52130d86a98f~appgver_c8c40037531881918c122db8c17a738a`.
- Successful deployment: `appgdep_6b026624a7348191af37af75918f148f`.
- Existing owner-only audience preserved; no permission or credential scope changes.
- Connected get-contract and authenticated private HTTP reads confirmed publication,
  new tool schemas, requested 07:15 handoff and durable state after redeployment.

Validation passed: 73 runtime tests (18 tour tests), 43 Lead Engine tests,
Site production build, TypeScript, 17 existing API/briefing checks and the local
D1/MCP tour integration test. The tour HTTP test handles one known local Worker
restart with the identical command; revision conflicts still fail rather than retry.
The static suite remains 32/39: the same seven failures were reproduced from an
independent origin/main export (T10/11/12/19/25/28 frontmatter; T38 old architecture).

Source-backed private historical replay: one tour, one review-alert claim,
duplicate request suppression, confirmation plus actual sent content qualifying
prep, cancellation retiring that handoff, and later feedback not reopening it.
Separate manual reconciliation preserved the actual canceled tour with no live
alert. Real client details and original evidence remain in private source systems
and the Site, not Git. No live client record was changed as a test. Material new
source outcomes were independently reconciled through the existing FUB lane.

Still pending: ChatGPT Gmail message-added subscription, genuine unattended wakeup,
private alert/phone delivery, actual Buyer Workbench destination delivery on a
qualifying current tour, and the existing Morning Desk schedule edit from 08:30
to 07:15 America/Chicago. Browser control timed out; exposed Codex automation tools
manage local jobs, while Sites can read but cannot update that existing cloud task.
Saved task configuration, observed execution and phone receipt are distinct states.
See [ACTIVATION.md](ACTIVATION.md). Existing natural 08:30 execution evidence remains
historical; it cannot prove the requested 07:15 timing or the new arrival lane.

Coverage begins at qualifying Gmail arrival in the team mailbox. The case's earliest
verified email was post-acceptance. Native FUB mobile offer notifications are a
separate documented path; no unclaimed Zillow offer API event was verified. FUB-only
and personal-message changes without Gmail delivery have no immediate wakeup here.
