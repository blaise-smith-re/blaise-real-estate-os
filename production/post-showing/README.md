# Post-showing follow-through

The existing Buyer Workbench is the phone entry point: dictate “Here's how the showing went…” in the buyer's chat under Blaise RE — Buyers. The agent resolves current sources through Source Map, interprets the recap, applies minimal internal FUB changes and leaves messages for approval. This extension supplies durable source/side-effect receipts and edited drafts; it is not another CRM, recorder, sender or scheduler.

Current business procedure remains Buyer Lifecycle Stage 5, FUB Runbook and AI Execution Runbook. Source Map: `1UU8eQOElu388w2FA2gPJCMOKP7_EvQRNoPUthxc1_wg`. The deployed `morning_desk_get_contract.postShowing` exposes exact command schemas and execution instructions for existing Workbench and scheduled agents.

## Execution

- `post_showing_read` returns live open actions separately from the isolated private replay.
- `post_showing_command` handles recap, answer, draft edit, actual question sent, buyer received, internal-effect claim/readback and run receipt.
- Every write uses current revision. Identical recap and message events are no-ops. Semantic repeats require the agent to reconcile existing observations and stable promise topic/scope before calling.
- One promise task stays open through lender answer and buyer draft. An actual buyer receipt or explicit owner report fulfills it. Exact task owner33 and independent object readback are required for closeout.
- Claimed but unverified writes remain uncertain. Reconcile them through original systems; never retry a create blindly. Replay never grants external execution.
- Current stored reply edits survive newer lender answers as a proposed update. Existing Gmail drafts use Email GPS claims and actual-body comparison; no email is sent here.
- Existing inbox passes and Morning Desk retrieve open promises and reconcile actual source bodies. Saving this contract does not prove a scheduled invocation or phone entry succeeded.

## Validate and deploy

`node --test tests/post-showing.test.mjs`

Open the existing owner-private Morning Desk source using the Sites helper, then run `node production/post-showing/install-site.mjs <site-checkout>`. Generate an additive Drizzle migration, build and type-check. Apply local migrations and start the local Worker on 127.0.0.1:5173. Run `node --test production/post-showing/site-api.test.mjs` against that local Worker only. Publish exact source with Sites helper and private deployment, preserving access and all existing lanes. Read back private API and contract. The receipt page is `/showing-follow-up`.

Use `replay.mjs` only with mode=replay. Its people, homes and figures are explicitly fictional. Private replay can simulate FUB receipts but must never invoke FUB/Gmail writes. Actual Workbench tool invocation, physical phone dictation, natural lender answer detection and timer execution are separate acceptance steps. See RELEASE.md for observed evidence and exact remaining steps.
