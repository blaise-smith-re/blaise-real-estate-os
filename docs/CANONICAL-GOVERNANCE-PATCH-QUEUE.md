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

## Application order

1. **CGQ-001** — unblocks the CRM department. Highest value.
1b. **CGQ-012** — removes a false pre-tour blocker hit on day one of live use.
2. **CGQ-002** — records the five read-only departments.
3. **CGQ-006, CGQ-003, CGQ-004, CGQ-005** — reference and routing integrity.
4. **CGQ-008, CGQ-007, CGQ-009, CGQ-010** — controls and hygiene.

5. **CGQ-011** — unattended read-only scheduling, after a runtime smoke.

1c. **CGQ-013** — unblocks the Buyer Property Snapshot. **CGQ-014** — corrects live client-facing
   representation language; high-stakes, Blaise approves. **CGQ-015** — headshot designation.

## CGQ-013 — Adopt Buyer Property Tour & Value Guide v2.0 (Snapshot Mode) · **BLOCKING (operational)**

- **TARGET** `Buyer Property Tour & Value Guide – Master Template`
- **FILE ID** `18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU` · **CURRENT VERSION** none (unversioned)
- **TRIGGER** SOP 02 v1.12 §15 now requires client-facing deliverables to pass a visual-PDF QC gate,
  hold to 3–5 pages for one or two properties, and present only the strongest 3–5 comps. §18 requires
  fact classifications to survive into the downstream snapshot. The current Doc master satisfies none
  of these, and two competing masters exist (IF-2026-09-01-018).
- **EXACT PATCH**
  1. Add a version line to the Doc master: `Version: 2.0 | Updated: <adoption date>`.
  2. Adopt the content architecture, source-rail classification system, conditional property modes
     (residential / condo-townhome / land / investment), single and tour formats, and the QC
     checklist specified in `assets/buyer-property-snapshot/SNAPSHOT-SPEC.md`.
     Rendered reference: https://claude.ai/code/artifact/092863e8-d403-49ce-88fb-d9ac7576721b
  3. Absorb the scorecard from `Buyer Property Tour Notes & Rating Sheet – Master Template`
     (`1WGBDQMXBhI4pVO8DvezIthQEoOPaNmEs9ZEBHsPxkhM`) and the stat band, comparison and decision
     pages from `CLIENT-FACING MASTER - ...pdf` (`1RdATxPLoQJx7B3eWRy_v_-FJZs-IbU2G`).
  4. Retitle both absorbed assets `LEGACY - <title> - Superseded <date> (v2.0)`.
  5. Change note: consolidation of three masters into one versioned master; adds fact-classification
     rail, conditional property modes, and the §15 page budget.
- **CROSS-LINK CHECK** SOP 02 §3 (physical showing kit → now the snapshot scorecard), §15, §19.
- **BLOCKING BECAUSE** the `buyer-property-snapshot` skill is built and cannot name one unambiguous
  canonical master until this lands.
- **DO NOT** overwrite the master in place without archive-first, and do not retire the PDF master
  before the Doc master actually carries the design system.

## CGQ-014 — Remove superseded pre-tour representation language from the client-facing master · **BLOCKING (high-stakes)**

- **TARGET** `CLIENT-FACING MASTER - Buyer Property Tour & Value Guide.pdf`
- **FILE ID** `1RdATxPLoQJx7B3eWRy_v_-FJZs-IbU2G` · page 10, "Important notes"
- **TRIGGER** IF-2026-09-01-019. The master prints: *"Buyer representation and agency documents are
  reviewed using brokerage-approved forms before private touring."* SOP 02 v1.11 (August 31, 2026)
  established that full buyer representation is **not** a first-tour prerequisite.
- **EXACT PATCH** replace that bullet with:
  > Any written acknowledgment required before a private showing is handled personally by Blaise.
  > Full buyer representation is established when you are ready to move forward — typically after a
  > productive tour, or before we prepare an offer.
- **CLASSIFICATION** HIGH-STAKES — client-facing representation language. Blaise + applicable
  authority approve before it is applied. Confirm against current brokerage and MLS requirements at
  the time of application; SOP 02 §10A deliberately does not own form selection.
- **BLOCKING BECAUSE** the sentence is on an asset in active client-facing use and is now incorrect.
- **ALSO** sweep every other client-facing buyer asset for the same sentence before closing.

## CGQ-015 — Designate the current approved headshot · **NON-BLOCKING**

- **TARGET** `INTERNAL - Canva Brand Rules & Master Links for Property, Tour & Seller Assets`
- **FILE ID** `1esSVR8kCVQKvGdmr6KFUSpOJGkErOTwEQMPIkDxDz4A`
- **TRIGGER** IF-2026-09-01-020. Eleven images in the headshot folder; exactly one is designated;
  six undesignated files (five raw camera names) were added 2026-08-31.
- **EXACT PATCH** add under **Approved brand rules**:
  > Current approved headshot: `Blaise - Charcoal Blazer - Primary Headshot - Vertical.jpg`
  > (fileId `1VmUojFEXSauNDt91TryoO8o5QWzRBN-P`). Resolve by fileId. Superseded images are retitled
  > `LEGACY - ...`. A newer upload is not an approval.
- **DECISION NEEDED FROM BLAISE** whether any 2026-08-31 image supersedes the Primary. Claude will
  not infer it from an upload date.


**CGQ-001, CGQ-012, CGQ-013 and CGQ-014 block a built capability or correct live client-facing
language.** Everything else is correctness and hygiene; the system
operates correctly without them.
