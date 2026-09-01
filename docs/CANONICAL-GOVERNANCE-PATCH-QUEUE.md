# Canonical Governance Patch Queue

Upstream changes to canonical **Google Drive** documents, batched for ChatGPT / 04 — Systems,
Training & SOP Control.

**Why a queue:** Claude Code cannot edit Google Doc bodies. `update_file` accepts only `fileId`,
`parentId` and `title` — there is no content parameter, and `create_file` would produce a competing
document (prohibited by BOM §14/§16). This is recorded canonically as **IF-013** in Exec SOP v4.28.
Development does not stop for it; patches accumulate here and apply in batches.

**Rules:** deduplicated · each entry standalone · **BLOCKING** = a built capability cannot go live
without it · apply with archive-before-edit, version bump, change note, cross-link check, independent
read-back, and exactly-one-current-canonical verification.

---

## CGQ-001 — Authorize Claude Code packages to execute certified FUB write classes · **BLOCKING**

- **TARGET** SOP - Claude Execution Operator, Browser & API-MCP Integration Control
- **CURRENT VERIFIED VERSION** 4.28 · **FILE ID** `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU`
- **TRIGGER** Phase 3 built the Lead Conversion & CRM Operations department and the full 17-step
  `fub-controlled-write` sequence. §1B-1 states: *"No code build, unit/integration test, scheduler
  smoke, multi-agent completion, repository merge, or deployment grants FUB write authority … unless a
  separate canonical control explicitly grants it and the required authorization exists."* No control
  names a Claude Code package. The three write classes are certified on the **FUB MCP/API lane** but
  not for a **Claude Code actor**.
- **EXACT PATCH** — add to *CLAUDE CODE MULTI-AGENT EXECUTION — CANONICAL PACKAGE CERTIFICATION*:

  > • **lead-conversion-crm — PRODUCTION CERTIFIED — MANUAL, BOUNDED REVERSIBLE WRITE.** This package
  > is explicitly authorized to execute the three certified FUB bounded reversible write classes —
  > `create_contact_note`, `create_contact_task`, `close_out_contact_interaction` — on an exact
  > authorized target, under the full controlled-write sequence: connector preflight; exact personId
  > resolution with independent corroboration; ownership/state check; recent-note and open-task
  > retrieval; sensitive-data rejection; stale-state and semantic-duplicate checks; preview where the
  > tool contract offers it; smallest required write; independent read-back through a separate read
  > tool; exactly-once verification; unintended-change review; and one dated next action where the
  > task scope calls for follow-up. Manual invocation only. **No other Claude Code package holds any
  > write authority.** The remaining 10 FUB write tools stay uncertified. Shared FUB stages, Smart
  > Lists, tag definitions, action plans, automations, lead-flow rules and team templates remain under
  > Brent's approval. Scheduling and external communication remain separately controlled.

- **PROPOSED VERSION** 4.29
- **CHANGE NOTE** "Authorized the lead-conversion-crm Claude Code package for the three certified FUB
  bounded reversible write classes under the full controlled-write sequence with independent
  read-back and exactly-once verification. Manual only. No other package gained write authority; the
  other 10 write tools, shared FUB configuration, scheduling and external communication are unchanged."
- **RELATED ASSETS** FUB 06 §1A · `governance/tool-policy.md` · `.claude/settings.json` ·
  `.claude/agents/lead-conversion-crm.md` · `.claude/skills/fub-controlled-write/SKILL.md`
- **REQUIRED READ-BACK** Re-retrieve v4.29; confirm the package name, the exact three tool names, the
  manual-only constraint, and that no other package is named.
- **WHY IT MATTERS** This is the single gate between a fully built CRM department and Blaise stopping
  manual FUB closeout. Everything else in Phase 3 is done and tested.
- **BLOCKING** — yes. Until applied, `lead-conversion-crm` prepares `CRM WRITE REQUEST` packets and
  Blaise executes.

## CGQ-002 — Record the five new Claude Code department packages · NON-BLOCKING

- **TARGET** Execution Operator SOP · **VERSION** 4.28 · **FILE ID** `1BuTAOhe…HbuU`
- **TRIGGER** Phases 4–8 built five read-only departments now running through the Claude Code lane.
- **EXACT PATCH** — add to the same certification section:

  > • **buyer-investor-ops · seller-listing-ops · market-intel-marketing · transaction-closing-ops ·
  > chief-of-staff — PRODUCTION CERTIFIED — MANUAL, READ-ONLY.** Zero source-system write authority.
  > Each may orchestrate only the reads, analysis, preparation and routing already authorized by its
  > controlling SOPs and current connector certifications. All FUB writes route to
  > `lead-conversion-crm`. Northstar/Matrix, Click Contracts, SkySlope, Ylopo and ShowingTime are not
  > reachable from Claude Code and route to the Claude-in-Chrome operator by formal handoff packet.
  > Publication, ad spend, external communication and scheduling remain separately controlled.

- **PROPOSED VERSION** 4.29 (same edit) · **BLOCKING** — no. They operate read-only today.

## CGQ-003 — SOP 09 number collision · NON-BLOCKING

- **TARGET** SOP 09 – Real Estate Investing (`1RPycB3w…FrfM`) and SOP 09 – Buyer Post-Closing
  (`1SR6HfGn…qSwY`), both active in `02 - Buyer SOPs`
- **EXACT PATCH** Renumber the investing SOP outside the buyer 01–09 sequence (e.g. **SOP 21**) and
  relocate it under `09 - Investors`. Update every cross-reference in the same change.
- **WHY** "Retrieve SOP 09" is ambiguous. `buyer-investor-ops` mitigates by resolving on `file_id`
  only, but the collision remains a live wrong-SOP risk. (IF-001)

## CGQ-004 — Dangling routing target: channel 08 · NON-BLOCKING

- **TARGET** 02 - ChatGPT Workflow Channels · **VERSION** 4.2 · **FILE ID** `12Pg3pAX…qiLE`
- **EXACT PATCH** Either define an `08 — PERSONAL LEAD GENERATION & PIPELINE` channel matching the
  00–04 section format, or retarget both routes to `03 — Marketing & Relationship Engine`. Also add a
  definition section for `05 — Client Deliverables`, present in the index without one.
- **WHY** The ROUTING MAP routes twice to a channel that is not defined. `chief-of-staff` cannot
  complete that handoff. (IF-002)

## CGQ-005 — BOM channel roster reconciliation · NON-BLOCKING

- **TARGET** Business Operating Manual · **VERSION** 1.30 · **FILE ID** `1HyBu_Oc…KAVc`
- **EXACT PATCH** After CGQ-004, reconcile §15's channel list to the routing document and add:
  *"The current channel roster is controlled by 02 - ChatGPT Workflow Channels, Routing & Starter
  Scripts."* (IF-003)

## CGQ-006 — SOP 00 broken cross-link and stale SOP 01C title · NON-BLOCKING

- **TARGET** SOP 00 – Operating Standard, Asset Rules & Audit Index · **FILE ID** `13Io4qyO…5W-YQ`
- **EXACT PATCH** §12 links `…/178kTdTfAPj_Hd3TrRZ1vtkGXvXcEHoh1uhSWVstNDvQ`, which is now the
  **LEGACY** SOP 01C. Repoint to `13GhbiAw2j1heeHPIs6sU3ZjURMq5gTtoRqXRC0LZjMw`. Update the title
  `SOP 01C – Ylopo Listing Strategy Presentation…` → `SOP 01C – Seller Listing Presentation,
  Consultation & Filing` in §6, §7 and §12 (3 occurrences).
- **ALSO FLAGGED, NOT DRAFTED** §12 still presents the Ylopo Listing Strategy Presentation as the
  official broad seller consultation guide; SOP 01C v1.7 replaced it with *Blaise's Guide to Selling
  Your Home*. That rewrite is a **business-asset decision for Blaise**, not a reference repair. (IF-015)

## CGQ-007 — Gmail connector capability re-test · NON-BLOCKING

- **TARGET** Execution Operator SOP, GMAIL lane · **VERSION** 4.28
- **EXACT PATCH** Add: *"Connector capability must be re-enumerated before relying on a recorded tool
  limitation. As of 2026-08-31 a Claude Code Gmail connector exposed `get_draft` and `list_drafts`;
  the Phase 1 read-back limitation should be re-tested against the current surface before it is
  treated as still binding."* Do **not** widen Gmail authorization on this finding alone. (IF-004)

## CGQ-008 — Ylopo priority-alert corroboration in FUB 06 · NON-BLOCKING

- **TARGET** FUB 06 · **VERSION** 1.8 · **FILE ID** `197OgqAy…Ebo8`
- **EXACT PATCH** §3 already says Priority alerts are engagement signals, not qualification decisions.
  Extend: *"Where a Priority or shared-listing alert materially affects a recommendation, corroborate
  it against the raw contact event log before acting. Cross-lead attribution contamination is
  documented on this account. An uncorroborated alert is labeled reported/unverified — it is not
  discarded, and it is never repeated to a client as fact."* (IF-012, now enforced in the Command
  Center prompt v1.2 and in `market-intel-marketing`.)

## CGQ-009 — Connector-account access verification · NON-BLOCKING

- **TARGET** Execution Operator SOP, GOOGLE DRIVE lane · **VERSION** 4.28
- **EXACT PATCH** Record the authoritative connector account and require a retrieval test across
  **both** owning accounts (`bsmith@blaisesmithproperties.com`, `blaise@buysellhometeam.com`) covering
  every fileId in the source registry. Canonical files are split across both; access must be proven by
  retrieval, never inferred from sharing. (IF-005)

## CGQ-010 — Synthetic artifact cleanup · NON-BLOCKING

- **TARGET** operational — no canonical document edit required
- **EXACT PATCH** None. This is an operational cleanup, not a document change; it is queued here so it
  is not lost. Record the cleanup in FUB 06 §9 once done.
- **ACTION** Blaise or a certified lane deletes the Phase 1 Gmail test draft and Calendar event
  `3ljnsk6e4bmj7qmrtkne30ehgc`. Until then both remain on the known-synthetic exclusion list used by
  `daily-revenue-command-center`. (IF-006)

## CGQ-011 — Unattended read-only scheduled operations · NON-BLOCKING

- **TARGET** Claude Prompt – Daily Revenue Command Center · **VERSION** 1.2 · **FILE ID** `1xV6ScXQ…AT6o`
  (and the Execution Operator SOP Claude Code lane)
- **TRIGGER** Blaise has given explicit authorization for **internal read-only** scheduled operations,
  conditional on the action class passing its canonical certification gates and the canonical change
  record being prepared. v1.2 requires all three: (1) scheduler gate passes; (2) canonical change-control
  record; (3) explicit Blaise authorization. **(3) is satisfied. (1) and (2) are not.**
- **EXACT PATCH** — after a scheduler/runtime morning smoke passes, record:

  > **Unattended read-only scheduled operations — AUTHORIZED SCOPE.** The following internal read-only
  > runs may be scheduled once the runtime has passed a bounded morning smoke proving the
  > America/Chicago date anchor, production FUB + Calendar reachability, complete task retrieval passing
  > `_completeness`, correct report generation, zero writes, and reliable delivery: Daily Revenue
  > Command Center morning run; source-drift preflight; connector-health check; read-only opportunity
  > radar; market-intelligence preparation. **No schedule may perform a write, send any communication,
  > or contact any consumer.** Enabling a schedule requires this record plus Blaise's explicit
  > authorization for that specific schedule.

- **PROPOSED VERSION** 1.3 · **WHY IT MATTERS** The morning Command Center run is the single highest-
  frequency time saving in the OS. Everything except the canonical record and the runtime smoke is ready.
- **BLOCKING** — no. Manual invocation works today; **scheduling remains HOLD H-1** and no scheduling
  tool is granted to any agent.

## CGQ-012 — No buyer agreement required before a tour · **BLOCKING (operational)**

- **TARGET** SOP 02 – Buyer Property Search, Showing & Value Analysis · **FILE ID**
  `1xxYjWwspET-gR5gYYtOb6uHh7eYXiM0r0YxRubjlB28` · also referenced by SOP 10 and the Execution
  Operator SOP ("A first-tour limited-agreement branch remains controlled by SOP 02").
- **CURRENT VERIFIED VERSION** to be read at apply time (registry entry is UNPINNED).
- **TRIGGER** Blaise directed on 2026-08-31, working the live Caitlin Nakache tour: **no buyer
  agreement is required before a tour.** The current first-tour limited-agreement branch caused a
  pre-tour blocker to be raised that does not reflect actual operating practice.
- **EXACT PATCH** — replace the first-tour limited-agreement branch with:

  > **Pre-tour representation.** A written buyer agreement is **not** required before showing a
  > property. Tour first; establish representation when the buyer is ready to move forward. The
  > representation conversation belongs at the point of genuine buyer intent — typically after a tour
  > that goes well, or before writing an offer — not as a gate on the first showing. Offer writing
  > remains controlled by SOP 04 and SOP 10/11.

- **PROPOSED VERSION** next minor · **CHANGE NOTE** "Removed the pre-tour written-agreement gate.
  Touring does not require a signed buyer agreement; representation is established at genuine buyer
  intent. Offer-writing controls under SOP 04 and SOP 10/11 are unchanged."
- **RELATED ASSETS** SOP 10 (buyer representation) · Execution Operator SOP first-tour branch
  reference · `.claude/agents/buyer-investor-ops.md` · `.claude/agents/client-prep-brief.md`
- **REQUIRED READ-BACK** Re-retrieve SOP 02; confirm the pre-tour gate is gone and the offer-writing
  controls are untouched.
- **WHY IT MATTERS** Until this is applied, agents will keep raising a pre-tour blocker on every new
  showing. It surfaced within the first hour of real-world use.
- **NOTE FOR APPLY** Written buyer-representation requirements are **brokerage, MLS and legal
  controlled** (BOM §2 authority order places law and brokerage guidance above the Manual and SOPs).
  Blaise has directed this as current operating practice; confirm it against current RE/MAX Results
  direction when applying so the SOP and brokerage policy do not diverge.
- **BLOCKING** — operationally yes: agents behave incorrectly until it is applied.

---

## CGQ-013 — Calendar time reconciliation is mandatory, not advisory · NON-BLOCKING

- **TARGET** Execution Operator SOP (Calendar lane / date-anchor language) · also any BOM or SOP
  passage that describes reading an appointment time from the Calendar connector.
- **CURRENT VERIFIED VERSION** to be read at apply time.
- **TRIGGER** IF-2026-09-01-019. The Google Calendar connector returned
  `2026-09-01T10:00:00-04:00` labeled `timeZone: America/Chicago` for a live client showing.
  `-04:00` is never a valid Chicago offset; the true time was **9:00 AM CDT**. Third reproduction on
  live data. The repo-side control has been hardened from "prefer a confirming read when disputed" to
  a mandatory reconciliation on every run — canonical language should match so the SOP and the
  execution layer do not diverge.
- **EXACT PATCH** — in the Calendar/date-anchor passage, replace advisory wording with:

  > **Appointment times are reconciled, never read.** A connector-rendered local time
  > (`get_event`, `search_events`) is not client-facing. Before any appointment, showing, deadline or
  > closing time is presented, reconcile the absolute UTC instant, the IANA timezone, and the expected
  > America/Chicago offset (CST `-06:00`, CDT `-05:00`), and confirm with a `list_events` read passing
  > an explicit America/Chicago timezone. This is required on every run, not only when a time looks
  > wrong — a single read never looks wrong. An offset that is not valid for America/Chicago on that
  > date makes the rendered time **defective**: discard it, present the reconciled time, and disclose
  > the discrepancy.

- **PROPOSED VERSION** next minor · **CHANGE NOTE** "Calendar appointment times must be reconciled
  against the absolute instant and confirmed with an explicit-timezone read on every run. Rendered
  connector times are not client-facing."
- **RELATED ASSETS** `.claude/skills/chicago-date-anchor/SKILL.md` (already hardened) ·
  `governance/tool-policy.md` §4 (already mirrored) · `scripts/reconcile-appointment-time.js` ·
  `tests/run-timezone-tests.js` · all eight agent definitions.
- **REQUIRED READ-BACK** Re-retrieve the SOP; confirm the advisory phrasing is gone.
- **WHY IT MATTERS** The failure mode is a missed client appointment. It has now occurred three
  times in rendering and was caught only by an agent independently noticing an impossible offset.
- **NON-BLOCKING** — the repo-side control is applied, tested (16/16 timezone cases) and inherited by
  all eight agents. This patch aligns canonical language; **the repo fix did not wait on it.**

---

## Application order

1. **CGQ-001** — unblocks the CRM department. Highest value.
1b. **CGQ-012** — removes a false pre-tour blocker hit on day one of live use.
2. **CGQ-002** — records the five read-only departments.
2b. **CGQ-013** — aligns canonical Calendar language with the applied repo control.
3. **CGQ-006, CGQ-003, CGQ-004, CGQ-005** — reference and routing integrity.
4. **CGQ-008, CGQ-007, CGQ-009, CGQ-010** — controls and hygiene.

5. **CGQ-011** — unattended read-only scheduling, after a runtime smoke.

**Only CGQ-001 blocks a built capability.** Everything else is correctness and hygiene; the system
operates correctly without them.
