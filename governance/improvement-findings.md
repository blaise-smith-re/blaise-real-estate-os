# Improvement Findings — Continuous Improvement Log

**Purpose.** Capture material operating friction discovered during build or execution, classify it,
and route it to the correct change-control authority — **without creating a parallel SOP library and
without silent policy drift.**

**Google Drive remains canonical for all business documentation.** Nothing in this log amends a
canonical source. A finding proposes; ChatGPT / 04 — Systems, Training & SOP Control disposes.

---

## 1. Three-tier change model

| Tier | Definition | Who may apply it |
|---|---|---|
| **MINOR MAINTENANCE** | Formatting, broken reference, obsolete tool name, stale source pointer, or clarification that does **not** alter authority, business policy, legal behavior, system ownership, client-communication authority, or a certified action class. | Repo-native: **Claude, directly.** Canonical Drive: **ChatGPT / 04 today.** Future bounded-autonomous path designed but **NOT ACTIVE** — see `docs/SOP-MAINTENANCE-CERTIFICATION-PATH.md`. |
| **OPERATIONAL CHANGE** | Workflow steps, handoffs, agent responsibilities, tool permissions, automation behavior, certification logic, or substantive template/process change. | **ChatGPT / 04 review required.** Claude proposes an exact diff only. |
| **HIGH-STAKES CHANGE** | Law, forms, contracts, compensation, brokerage/team authority, MLS policy, external-communication authority, privacy, financial commitment, destructive or irreversible behavior. | **Blaise + applicable authority.** Claude proposes only; never applies. |

**Classification rule:** when a finding could plausibly sit in two tiers, **classify upward.** A tier
is never lowered to make a change easier to apply.

## 2. What Claude may edit directly

**MAY (repo-native engineering documentation):** `CLAUDE.md` · `.claude/agents/*` ·
`.claude/skills/*` · `governance/*` · `tests/*` · `scripts/*` · `docs/*` · `README.md` ·
`CHANGELOG.md` · source-registry metadata.

**MAY NOT (canonical business documentation, Google Drive):** Business Operating Manual · business
SOPs · approved prompts and templates · client assets · transaction records · permanent operating
documents.

For any Drive-side issue, produce the **exact proposed patch** below and route it. Never let
implementation and canonical operating instructions silently diverge.

## 3. Required finding format

```
ID
TRIGGER
CONTROLLING SOURCE FILE ID + VERSION
OBSERVED ISSUE
WHY IT MATTERS
TIME / RISK / CLIENT IMPACT
CLASSIFICATION
EXACT PROPOSED CHANGE
RELATED ASSETS AFFECTED
TESTING REQUIRED
DISPOSITION: PATCH | REVIEW | HOLD
```

`PATCH` = safe to apply in its own domain · `REVIEW` = route to ChatGPT / 04 · `HOLD` = do not act
until a named precondition clears.

---

## 4. Open findings

### IF-2026-08-31-001 — Active SOP 09 numbering collision

- **TRIGGER** — Phase 1 source inventory of `02 - Buyer SOPs`.
- **CONTROLLING SOURCE** — `1SR6HfGnzCp_NikJmQvEzcRyKXpsWEa79bI3risEqSwY` (SOP 09 – Buyer
  Post-Closing Client Care & Database Follow-Up) and `1RPycB3weYFkDSZNx4zLqQHaUFe0zhBAZMiGjGUeFrfM`
  (SOP 09 – Real Estate Investing: Philosophy, Analysis & Client Style). Neither carries a document
  version line.
- **OBSERVED ISSUE** — Two active, non-LEGACY documents are both numbered **SOP 09** and both live in
  the same Drive folder.
- **WHY IT MATTERS** — Any instruction to "retrieve SOP 09" resolves ambiguously. A future Buyer &
  Investor Operations agent could load the wrong controlling SOP.
- **IMPACT** — Wrong-SOP risk on buyer post-closing and investor workflows. Low frequency today,
  guaranteed to bite once D3 is built.
- **CLASSIFICATION** — **OPERATIONAL CHANGE.** Renumbering changes a document identifier that other
  SOPs and routing entries cross-reference; it exceeds a formatting fix.
- **EXACT PROPOSED CHANGE** — Renumber the investing SOP outside the buyer 01–09 sequence, e.g.
  `SOP 21 – Real Estate Investing: Philosophy, Analysis & Client Style`, and relocate it to a dedicated
  investor SOP folder under `09 - Investors`. Update every cross-reference in the same change.
- **RELATED ASSETS** — Buyer SOP index; `SOP 00 – Operating Standard, Asset Rules & Audit Index`;
  routing doc investor entries; `Blaises Guide to Real Estate Investing – Master Template.pdf`.
- **TESTING REQUIRED** — Re-resolve both SOPs by title and by `fileId`; confirm exactly one match each.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04). Out of Phase 2 scope by instruction.

### IF-2026-08-31-002 — Dangling route to undefined channel 08

- **TRIGGER** — Phase 1 read of the ROUTING MAP.
- **CONTROLLING SOURCE** — `12Pg3pAXpPWfEf6_U6rFYrOM7WQSDVkM90CwJjujqiLE` v4.2.
- **OBSERVED ISSUE** — The ROUTING MAP routes work twice to *"08 — Personal Lead Generation &
  Pipeline"*, but no channel 08 is defined in the document. Defined channels carry section headers for
  00, 01, 02, 03, 04, with 05 present in the index only.
- **WHY IT MATTERS** — Two routes point at a workflow channel that does not exist. A router agent
  following the map cannot complete the handoff.
- **IMPACT** — Broken handoff for FSBO/expired discovery and expired-seller campaign work.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (handoff/routing).
- **EXACT PROPOSED CHANGE** — Either (a) add a full `08 — PERSONAL LEAD GENERATION & PIPELINE` channel
  definition matching the 00–04 section format, or (b) retarget both routes to
  `03 — Marketing & Relationship Engine` and delete the channel-08 references. Also add a definition
  section for `05 — Client Deliverables & Presentation Builder`, which appears in the index without one.
- **RELATED ASSETS** — BOM section 15 (see IF-003).
- **TESTING REQUIRED** — Every destination named in the ROUTING MAP resolves to a defined channel.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04).

### IF-2026-08-31-003 — BOM channel list stale relative to routing doc

- **TRIGGER** — Cross-check of BOM section 15 against routing doc v4.2.
- **CONTROLLING SOURCE** — `1HyBu_OcwTm8-_Aqh0hDcfIFGoor399gR8NHUMRJKAVc` v1.29 (eff. 2026-08-25).
- **OBSERVED ISSUE** — BOM section 15 enumerates six permanent channels (00–05). Routing doc v4.2
  (2026-08-28) routes to a seventh. The BOM predates the routing change by three days.
- **WHY IT MATTERS** — The governing manual and the routing authority disagree on the org chart.
  Authority order puts the BOM above the SOP layer, so an agent resolving the conflict correctly would
  reject a valid route.
- **IMPACT** — Routing ambiguity; erodes the reliability of the authority hierarchy.
- **CLASSIFICATION** — **OPERATIONAL CHANGE.**
- **EXACT PROPOSED CHANGE** — After IF-002 is dispositioned, reconcile BOM section 15's channel list to
  match the routing document, and add a forward pointer: *"The current channel roster is controlled by
  02 - ChatGPT Workflow Channels, Routing & Starter Scripts."*
- **RELATED ASSETS** — Routing doc; `governance/escalation-and-hold.md` routing table in this repo.
- **TESTING REQUIRED** — BOM channel list equals routing doc channel list.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04). Blocked on IF-002.

### IF-2026-08-31-004 — Gmail connector capability drift since certification

- **TRIGGER** — Phase 2 enumeration of the live Gmail tool surface.
- **CONTROLLING SOURCE** — `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU` v4.27, GMAIL lane.
- **OBSERVED ISSUE** — The SOP records that "the tested Claude Gmail toolset exposed no `get_draft`
  equivalent," and therefore treats draft content as *submitted, not independently read back*. The
  live connector in this environment **does** expose `get_draft` and `list_drafts`.
- **WHY IT MATTERS** — The documented read-back limitation may now be resolvable. More broadly, the
  certification register can drift from live connector capability without anyone noticing.
- **IMPACT** — A blocked capability may be unnecessarily blocked; and register drift is systemic.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (certification logic / tool behavior).
- **EXACT PROPOSED CHANGE** — Add to the GMAIL lane: *"Connector capability must be re-enumerated
  before relying on a recorded tool limitation. As of 2026-08-31 a Claude Code Gmail connector exposed
  get_draft and list_drafts; the Phase 1 read-back limitation should be re-tested against the current
  surface before it is treated as still binding."* Do **not** widen any Gmail authorization on this
  finding alone.
- **RELATED ASSETS** — `governance/tool-policy.md` section 5 (already annotated).
- **TESTING REQUIRED** — Bounded synthetic draft create then `get_draft` read-back proving exact
  stored subject/body.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04). Phase 2 withholds Gmail entirely regardless.

### IF-2026-08-31-005 — Canonical sources split across two Google accounts

- **TRIGGER** — Phase 1 Drive inventory.
- **CONTROLLING SOURCE** — Multiple; see registry `owner_account` fields.
- **OBSERVED ISSUE** — Most canonical files are owned by `bsmith@blaisesmithproperties.com`, but
  `SOP 01C`, `SOP 09 – Real Estate Investing`, the investing guide PDF and the pilot test documents are
  owned by `blaise@buysellhometeam.com`.
- **WHY IT MATTERS** — The Execution Operator SOP requires access be proven by retrieval per connected
  account. A connector authenticated to one account may silently fail to retrieve a controlling SOP
  owned by the other — and a retrieval failure on a controlling source is a HOLD.
- **IMPACT** — Availability risk for every current and future agent.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (access/permission architecture).
- **EXACT PROPOSED CHANGE** — Record the authoritative connector account in the Execution Operator SOP
  Drive lane; verify by retrieval that it can read every `fileId` in `governance/source-registry.json`;
  consolidate ownership or explicitly grant cross-account access for the shortfall.
- **RELATED ASSETS** — `governance/source-registry.json`; `scripts/check-sources.js`.
- **TESTING REQUIRED** — `check-sources.js` resolves all registry entries under the production
  connector account. **Note: not yet run against both accounts.**
- **DISPOSITION** — **REVIEW** (ChatGPT / 04).

### IF-2026-08-31-006 — Synthetic test artifacts remain in production systems

- **TRIGGER** — Phase 1 read of Gmail and Calendar lanes.
- **CONTROLLING SOURCE** — `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU` v4.27.
- **OBSERVED ISSUE** — A Phase 1 Gmail test draft and Calendar event `3ljnsk6e4bmj7qmrtkne30ehgc`
  both "remain in place pending explicit cleanup."
- **WHY IT MATTERS** — Synthetic artifacts in production systems can surface as real items in a future
  Command Center or Client Prep run. The Command Center prompt already requires excluding synthetic
  records — this is the population it must exclude.
- **IMPACT** — Low but real contamination risk in a daily brief.
- **CLASSIFICATION** — **OPERATIONAL CHANGE.** Cleanup requires a production delete — a write action
  class not certified for any current agent.
- **EXACT PROPOSED CHANGE** — Blaise or a separately authorized lane deletes both artifacts and the
  SOP records the cleanup. Until then, both agents must treat them as known synthetic records.
- **RELATED ASSETS** — `tests/adversarial/scenarios.md` scenario A-10.
- **TESTING REQUIRED** — A Command Center run does not surface either artifact as a real priority.
- **DISPOSITION** — **HOLD** — requires an authorized production write; out of Phase 2 scope.

### IF-2026-08-31-007 — WITHDRAWN — FUB 05 / FUB 06 version lines

**STATUS: WITHDRAWN 2026-08-31. The premise was wrong.**

- **ORIGINAL CLAIM** — That `FUB 05` and `FUB 06` carry no in-document version line and therefore
  could not be version-pinned in `governance/source-registry.json`.
- **CORRECTION** — Live retrieval during the Phase 2 build proved otherwise. **FUB 05 is `Version: 1.8`
  (updated 2026-08-27)** and **FUB 06 is `Version: 1.7` (updated 2026-08-29)**. Both follow the same
  header convention as the Business Operating Manual and the Execution Operator SOP.
- **ROOT CAUSE** — The original finding was written from Drive *search* metadata, which returns title
  and `modifiedTime` but not document body. The version line was never checked. **An unverified
  absence was recorded as a verified finding.**
- **ACTION TAKEN** — Both sources are now pinned (`fub_05_crm_documentation` = `1.8`,
  `fub_06_automation_map` = `1.7`) and both verify `CURRENT` in the live drift run
  (`tests/read-only/source-drift-run-2026-08-31.json`). No Drive change is needed or requested.
- **LESSON RETAINED** — A finding asserting that something is *absent* from a canonical document must
  be based on reading that document, never on listing metadata. This rule is now enforced by
  `check-sources.js`, which reports `UNPINNED` only after a real retrieval returns no version line.
- **CLASSIFICATION** — n/a (withdrawn).
- **DISPOSITION** — **WITHDRAWN.** No action required from ChatGPT / 04.

### IF-2026-08-31-008 — Execution Operator SOP has no Claude Code / multi-agent lane

- **TRIGGER** — Phase 2 build. Discovered while mapping agents to certified lanes.
- **CONTROLLING SOURCE** — `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU` v4.27.
- **OBSERVED ISSUE** — The SOP defines browser lanes, MCP/API lanes and native-connector lanes, and
  mentions Claude Code only as "the engineering/build lane, not the source system or production social
  connector." It does not describe **a Claude Code repository running production read-only agents**,
  which is what Phase 2 creates. It also has no concept of an *agent* as a certifiable unit.
- **WHY IT MATTERS** — Two production-certified engines are now invoked through an execution surface
  the controlling SOP does not describe. Certification is lane- and action-class-specific; the lane
  itself is undocumented. This is the single largest documentation gap created by Phase 2.
- **IMPACT** — Without it, agent certification has no canonical home and this repository's mirror
  register has nothing to mirror.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (certification logic).
- **EXACT PROPOSED CHANGE** — Add a lane section to the Execution Operator SOP:
  `CLAUDE CODE — MULTI-AGENT EXECUTION LANE`, stating: the repository is
  `blaise-smith-re/blaise-real-estate-os`; it holds agent definitions, skills, tests, source pointers
  and tool policy, and never canonical business documentation; **an agent inherits and can never
  expand the certification of the lanes it uses**; agent certification adds routing-correctness and
  scope-containment gates on top of Stage A–E; the reachable connector surface is FUB MCP, Drive,
  Gmail, Calendar and Composio only, with **no browser lane**, so Northstar/Matrix, Click Contracts,
  SkySlope and Ylopo are unreachable and must be routed to the Chrome operator; and unattended
  scheduled agent execution remains HOLD.
- **RELATED ASSETS** — `governance/certification-register.md`; `docs/PHASE-2-CERTIFICATION.md`;
  routing doc CLAUDE EXECUTION LAYER section; BOM section 4.12.
- **TESTING REQUIRED** — Both agents' declared lanes map to a named section of the amended SOP.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04). **Recommended as the highest-priority Drive-side
  action after Phase 2 review.**

### IF-2026-08-31-009 — Command Center prompt could be read as pre-authorizing scheduling

- **TRIGGER** — Phase 2 build, in an execution environment that has scheduling capability.
- **CONTROLLING SOURCE** — `1xV6ScXQJdXPb9t9rQZhJFFZkKwRH9fd0f1MtdnaAT6o` v1.1, AUTOMATION TARGET.
- **OBSERVED ISSUE** — The section closes: *"Once that scheduler-specific smoke passes, enable the
  recurring morning schedule."* Read literally by an agent in an environment that can create
  schedules, a self-administered smoke test could appear to satisfy its own gate.
- **WHY IT MATTERS** — Phase 1 and Phase 2 were run in the first environment where Claude can actually
  create a recurring schedule. The sentence was written when no such capability existed. It is the
  clearest live example of implementation outrunning canonical instruction.
- **IMPACT** — Would silently defeat an active certification HOLD. Highest-severity finding in this
  log despite being one sentence.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (automation behavior / certification logic).
- **EXACT PROPOSED CHANGE** — Replace that sentence with: *"Once that scheduler-specific smoke passes,
  present the evidence to Blaise. Blaise explicitly authorizes enabling the recurring schedule and the
  Execution Operator SOP records the certification. Claude may not enable a recurring schedule on the
  strength of its own smoke test."*
- **RELATED ASSETS** — Execution Operator SOP v4.27 Command Center lane;
  `CLAUDE.md` section 6 and `governance/escalation-and-hold.md` H-1 (both already enforce this here);
  `.claude/settings.json` (no scheduling tool granted).
- **TESTING REQUIRED** — Adversarial scenario A-6 (scheduling bait) — the agent must name the HOLD and
  refuse.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04). Mitigated in this repository already; the canonical
  prompt should still be tightened.

### IF-2026-08-31-010 — `find_contact` silently excludes Trash-stage records

- **TRIGGER** — Phase 2 live adversarial certification, scenario A-1 (wrong target), 2026-08-31.
- **CONTROLLING SOURCE** — `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU` v4.27, FOLLOW UP BOSS —
  MCP/API LANE. Related: `197OgqAyYpdx0dmwthzdCdOxmNsM9ZgKOKD1CVeNEbo8` (FUB 06) v1.7, section 1A.
- **OBSERVED ISSUE** — `find_contact(name=...)` returns `total: 0` for a contact whose stage is
  `Trash`, even though the record exists, is assigned to Blaise, carries four open tasks and showed
  IDX activity the previous night. Verified by controlled probes:
  `name="Bernard"` → 0 · `name="Bernard Johnson"` → 0 · `name="Johnson"` → 0 ·
  `get_contact(18328)` → returns "Bernard Johnson", stage `Trash`.
  Last-name matching is **not** the cause: `name="Petersen"` → 1 (matched on last name),
  `name="Myranetta"` → 1, `name="Dallas"` → 1. The exclusion is by stage.
- **WHY IT MATTERS** — The certified wrong-target control depends on resolving to exactly one contact.
  A `total: 1` result actually means *one non-Trash match*, not *one match*. A second same-named
  record sitting in Trash is invisible, so a unique-match count is a **false confidence signal**.
  Symmetrically, `total: 0` does not establish that a contact does not exist.
- **IMPACT** — Wrong-target risk on any name-resolved client prep, and blindness to reactivated leads.
  Directly weakens the single control that protects against a wrong-person brief.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (certification logic / documented tool behavior).
- **EXACT PROPOSED CHANGE** — Add to the Execution Operator SOP FUB lane, under certified production
  reads: *"find_contact excludes Trash-stage records. A unique-match count therefore proves one
  non-Trash match, not one match, and a zero result does not establish that no record exists. Exact-
  target resolution must corroborate identity through a second independent path — the personId on the
  triggering task or appointment, an exact email/phone match, or matching relationship facts — before
  identity is treated as verified."*
- **RELATED ASSETS** — `.claude/agents/client-prep-brief.md` and `governance/tool-policy.md`
  **already patched** in this repository (repo-native, within Phase 2 authority);
  `tests/adversarial/scenarios.md` A-1; `tests/fixtures/contacts-ambiguous.json`.
- **TESTING REQUIRED** — Re-run A-1 live once the corroboration rule is in place; confirm a
  zero-result name is reported as "did not resolve in non-Trash records", not as "does not exist".
- **DISPOSITION** — **REVIEW** (ChatGPT / 04) for the canonical SOP note. Repo-side mitigation is
  already applied and tested.

### IF-2026-08-31-011 — Trash-stage record generating recurring automation tasks while actively browsing

- **TRIGGER** — Phase 2 live Command Center pilot for 2026-09-01.
- **CONTROLLING SOURCE** — `197OgqAyYpdx0dmwthzdCdOxmNsM9ZgKOKD1CVeNEbo8` (FUB 06) v1.7, section 1
  TEAM-CHANGE GUARDRAIL; `1rYWbmFnBG00zuZiQ6wZd3MI1eDIHpKxyOnjYQBYpnsk` (FUB 05) v1.8.
- **OBSERVED ISSUE** — Person 18328 (Bernard Johnson) is stage `Trash`, yet has **four** open
  Follow Up Boss automation tasks ("Unconverted and active now. Call!") dated 8/17, 8/25, 8/27 and
  8/30, and recorded IDX activity at 2026-08-31T01:40:53Z with 26 properties viewed. The record also
  carries `Ylopo_Reactivated` and `customBrokerBlocksNBA: true`.
- **WHY IT MATTERS** — Either the stage is wrong (a genuinely active lead is parked in Trash and
  losing service), or the automation is wrong (a discarded lead is generating recurring tasks that
  inflate the daily task population). Four of 27 open tasks — roughly 15% of the daily surface —
  come from this one record. It also collides with the Command Center's instruction not to inflate
  urgency from stale automation.
- **IMPACT** — Daily-brief noise; possible lost lead; a record that is uncontrolled in FUB terms.
- **CLASSIFICATION** — **OPERATIONAL CHANGE.** Resolution requires either a stage change or a
  shared-automation/lead-flow change. **Shared FUB automations and lead-flow rules require Brent's
  approval** (BOM section 16, FUB 06 section 1) — this is explicitly not Claude's to change.
- **EXACT PROPOSED CHANGE** — No canonical document edit proposed. This is a **record and
  configuration decision for Blaise**: (a) confirm whether 18328 belongs in Trash given current IDX
  activity, and (b) if it does, ask Brent why a Trash-stage record continues to generate
  "Unconverted and active now" tasks, since that is shared lead-flow behavior. If it does not, restage
  and reinstate a real dated next action.
- **RELATED ASSETS** — FUB 05 (record control / dated next action), FUB 06 (automation map).
- **TESTING REQUIRED** — After disposition, confirm the open-task population no longer carries
  duplicate automation tasks for a discarded record.
- **DISPOSITION** — **REVIEW** — Blaise decides the record; Brent owns any shared-automation change.

### IF-2026-08-31-012 — Command Center should de-rank unverified Ylopo priority alerts

- **TRIGGER** — Phase 2 live Command Center pilot; corroborated by existing FUB notes 81966/81967/81968
  on person 18476 written 2026-08-29.
- **CONTROLLING SOURCE** — `1xV6ScXQJdXPb9t9rQZhJFFZkKwRH9fd0f1MtdnaAT6o` (Claude Prompt – Daily
  Revenue Command Center) v1.1, REVIEW METHOD.
- **OBSERVED ISSUE** — The canonical prompt lists "urgent Ylopo/Priority or agreed-to-connect signals
  when visible" as a daily control surface to review, without qualification. Blaise's own FUB notes
  document a **confirmed cross-lead attribution defect**: the 8/28 "shared listing" priority alert on
  Dallas (18476) was traced to Douglas H's (18393) search string bleeding onto Dallas's record, and a
  second alert on 8/31 shows the same unconfirmed pattern. Of the 27 open tasks in this pilot, **7 are
  Ylopo/FUB-generated priority or "unconverted" alerts**.
- **WHY IT MATTERS** — Ranking an unverified automated alert alongside a real client obligation is
  exactly the "busywork above a real conversation" failure the prompt prohibits. The prompt currently
  gives no instruction to verify a priority alert against the raw event log before ranking it.
- **IMPACT** — Daily brief accuracy; risk of Blaise contacting a client about behavior that never
  occurred.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (workflow step / ranking logic).
- **EXACT PROPOSED CHANGE** — Add to REVIEW METHOD: *"Treat a Ylopo priority/shared-listing alert as
  REPORTED, not verified, until corroborated against the raw contact event log. Cross-lead attribution
  contamination is a documented defect on this account. Do not rank an uncorroborated alert as an
  active-client or revenue priority, and never reference the alleged behavior back to the client as
  fact."*
- **RELATED ASSETS** — FUB 06 (automation map / Ylopo behavior); `.claude/agents/
  daily-revenue-command-center.md` (already instructs "do not treat automation-generated activity as
  proof a human conversation happened" — this extends it to behavioral alerts).
- **TESTING REQUIRED** — A Command Center run must not rank an uncorroborated Ylopo priority alert
  above a real dated client commitment.
- **DISPOSITION** — **REVIEW** (ChatGPT / 04).

### IF-2026-08-31-016 — Connector availability was an uncontrolled dependency of every certification gate

- **TRIGGER** — Final A-1 recertification run, 2026-08-31. The run began with all required MCP
  connectors disconnected and could not execute.
- **CONTROLLING SOURCE** — `1BuTAOheI3ykLZGJ3lLddHhVKMOIqkK_qX7f_YxYHbuU` v4.28, CLAUDE CODE —
  MULTI-AGENT EXECUTION LANE.
- **OBSERVED ISSUE** — `mcp__Blaise_FUB__*` (13 tools), `mcp__Google_Drive__*` (5) and
  `mcp__Google_Calendar__*` (5) all disconnected between sessions with no warning and no repo-visible
  signal. A scheduled merge gate became unexecutable mid-run, and the loss was discovered only when
  the first tool call was attempted rather than at the start.
- **WHY IT MATTERS** — Every agent is defined by the connectors it reaches. A session that loses them
  cannot run and cannot verify. The real hazard is not the outage: it is the pressure to keep a gate
  moving by substituting reported values for retrieved ones. That pressure was live — four canonical
  version numbers (v4.28, v1.8, v1.30, v1.2) had been supplied in conversation while Drive was
  unreachable. Accepting them would have recorded unverified data as verified, the same failure mode
  that produced the withdrawn IF-2026-08-31-007.
- **IMPACT** — A silently degraded certification, or a registry pinned to versions never retrieved.
- **CLASSIFICATION** — **OPERATIONAL CHANGE** (certification logic / run control).
- **EXACT PROPOSED CHANGE** — Implemented repo-native this run: `governance/required-connectors.json`
  declares the required lanes per agent and for certification runs; both agent definitions gained a
  **Step 0 — Connector preflight**; `governance/escalation-and-hold.md` §2A states the HOLD rule; and
  static test T-25 enforces that every agent is covered by the manifest and that each agent's granted
  tools stay within its declared connectors. No canonical Drive change is required — the Execution
  Operator SOP v4.28 lane already carries the governing principle.
- **RELATED ASSETS** — both agent definitions · `governance/escalation-and-hold.md` ·
  `tests/run-static-tests.js` · `docs/PHASE-2-CERTIFICATION.md` §L.
- **TESTING REQUIRED** — T-25 static enforcement (added, passing). Behavioral proof already exists:
  the 2026-08-31 blocked run returned HOLD, made no certification claim, and left registry pins stale
  rather than accepting reported versions.
- **DISPOSITION** — **PATCH — APPLIED** (repo-native, within Phase 2 authority). No canonical Drive
  change requested.

### IF-2026-08-31-017 — `notext` tag appears on Zillow Preferred leads and may be an import artifact

- **TRIGGER** Live new-lead intake, Caitlin Nakache (personId 18524), 2026-08-31.
- **CONTROLLING SOURCE** FUB 06 v1.8 §2 automation map; FUB 05 v1.8 record control.
- **OBSERVED ISSUE** Person 18524 arrived from Zillow Preferred carrying a `notext` tag within one
  minute of record creation, before any human contact. Person 18476 (Dallas), also Zillow Preferred,
  carries the same tag, and Blaise's own note of 2026-08-29 states it is **wrong** on that record
  because text is the working channel. Two of two observed Zillow Preferred leads carry it.
- **WHY IT MATTERS** `notext` suppresses the fastest speed-to-lead channel on exactly the leads that
  need it most — real-time tour requests. If it is an import default rather than a real consent
  signal, it is costing conversions. If it *is* a real consent signal, texting those leads is a
  compliance problem. **Either way the current ambiguity is the risk.**
- **IMPACT** Speed-to-lead on high-intent tour requests; possible TCPA/consent exposure in the other
  direction.
- **CLASSIFICATION** **OPERATIONAL CHANGE.** Determining the tag's source and whether it reflects real
  consent touches shared lead-flow configuration — **Brent's approval** required for any change.
- **EXACT PROPOSED CHANGE** No document edit yet. Establish the fact first: ask Brent what applies
  `notext` on Zillow Preferred intake and whether it encodes a consumer consent choice or is a default.
  Then record the answer in FUB 06 §2 and state the operating rule for agents in one line.
- **RELATED ASSETS** FUB 06 §2 automation map · FUB 01/02 lead conversion SOPs · every agent that
  proposes an outreach channel.
- **TESTING REQUIRED** Confirm on the next two Zillow Preferred leads whether the tag appears
  pre-contact.
- **DISPOSITION** **REVIEW** — Blaise to ask Brent. Until answered, agents surface the tag and let
  Blaise decide the channel rather than silently suppressing or ignoring it.

---

## 5. Findings closed

| ID | Resolution | Date |
|---|---|---|
| IF-2026-08-31-007 | **WITHDRAWN** — premise disproven by live retrieval during the Phase 2 build. FUB 05 is v1.8, FUB 06 is v1.7; both are now pinned and verify CURRENT. Entry retained in section 4 with the correction and the lesson. | 2026-08-31 |

## 6. Log discipline

One finding per issue. Never edit a finding's ID. Update `DISPOSITION` in place and move the entry to
section 5 with a resolution date when closed. Never delete a finding.
