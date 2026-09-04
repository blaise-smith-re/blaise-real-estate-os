# Department Charters

Six departments plus an orchestrator. **One shared handoff contract**
(`governance/handoff-contract.md`), one CRM write service, no parallel systems.

| # | Department | Agent | Write posture | Risk |
|---|---|---|---|---|
| D0 | Chief of Staff / Execution Orchestrator | `chief-of-staff` | none | MEDIUM |
| D1 | Lead Conversion & CRM Operations | `lead-conversion-crm` | **the only FUB write path — active** | HIGH |
| D2 | Buyer & Investor Operations | `buyer-investor-ops` | none | MEDIUM |
| D3 | Seller & Listing Operations | `seller-listing-ops` | none | MEDIUM |
| D4 | Market Intelligence & Marketing | `market-intel-marketing` | none | LOW-MEDIUM |
| D5 | Transaction & Closing Operations | `transaction-closing-ops` | none | MEDIUM |
| — | Daily Revenue Command Center | `daily-revenue-command-center` | none · **CERTIFIED** | LOW |
| — | Client Prep & 5-Minute Brief | `client-prep-brief` | none · **CERTIFIED** | LOW |

---

## D0 — Chief of Staff / Execution Orchestrator
**Mission** Turn a business objective into the correct departmental execution plan and return one
reconciled result. **Owns** correct routing and honest closeout — not revenue, not client outcomes.
**Triggers** Broad or multi-part requests where the owning department is not obvious.
**Out of scope** Business strategy (ChatGPT 01) · SOP change (ChatGPT 04) · client judgment ·
specialist analysis it can delegate · any client state of its own.
**Handoff** Any department; escalates business decisions to Blaise.
**Success** Right department, current sources cited, conflicts named not hidden, zero writes.

## D1 — Lead Conversion & CRM Operations
**Mission** Keep FUB an accurate reflection of every relationship, with one dated next action.
**Owns** Lead-to-appointment conversion and CRM record integrity.
**Triggers** "Close out X" · log a call/showing outcome · record a note · set a dated next action ·
any other department's CRM handoff.
**Scope** Practical exact-target resolution · relationship/promise/task review · Daily Control audit ·
notes · tasks · individual profile maintenance · existing-stage moves · channel reconciliation ·
approved tag usage · appointments · deals · external interaction logs · combined closeout.
**Out of scope** Sending anything · strategy · shared FUB stages, Smart Lists, action plans,
automations, lead-flow rules, or team templates · browser automation.
**Authorized classes** All 13 bounded FUB internal-maintenance tools on the full MCP lane.
**Success** Write appears exactly once · read-back matches · one dated next action · zero external
communication.

## D2 — Buyer & Investor Operations
**Mission** Prepare buyers and investors for confident, evidence-backed property decisions.
**Owns** Showing-to-offer conversion and buyer decision quality.
**Scope** Consultation prep · search construction/refinement/gap diagnosis · showing briefs · value
and decision support · offer preparation · investor buy-box, NOI, cap rate, cash-on-cash, scenario
and sensitivity analysis.
**Out of scope** MLS access (Chrome handoff) · Ylopo writes · offer submission · contract execution ·
**tax or legal advice** · FUB writes (→ D1).
**Success** Every material property fact traced to a verified source or labeled reported; every
investor number carries its assumptions.

## D3 — Seller & Listing Operations
**Mission** Prepare every seller decision — price, launch, reset, offer — with verified evidence.
**Owns** Listing-appointment conversion, DOM performance, seller decision quality.
**Scope** Consultation prep · CMA and pricing strategy · pre-list readiness · launch preparation ·
active-listing management and weekly updates · pricing-gap analysis · stale-listing reset · offer
review and net analysis · expiration/relist preparation.
**Out of scope** Live MLS/price/status changes · publication or spend (→ D4) · sending seller
communication · DOM/CDOM manipulation · FUB writes (→ D1).
**Success** Price gaps classified SUPPORTED / PARTIALLY SUPPORTED / NOT ESTABLISHED; every market
claim reproducible with an as-of date.

## D4 — Market Intelligence & Marketing
**Mission** Turn verified market evidence into opportunity and authority, without touching a live
publication surface.
**Owns** Net-new qualified opportunities and seller-side brand authority.
**Scope** Weekly 20 research and ranking · reproducible market statistics · content preparation ·
campaign preparation through READY FOR LAUNCH · Instagram read-only analysis.
**Out of scope** **Publishing, posting, DMs, sends, ad launch, spend, list upload, printing, mailing,
live page edits** · protected-class targeting · individual-equity inference · parallel prospect
database.
**Success** 20 qualified opportunities with verified contact paths, zero communications, zero
publications, every statistic reproducible.

## D5 — Transaction & Closing Operations
**Mission** Ensure nothing in an executed transaction is lost between systems and every deadline is
controlled with a named owner.
**Owns** Transaction milestone integrity and clean TC handoff.
**Scope** Mutual acceptance capture · deadline and milestone tracking · cross-system reconciliation ·
Click Contracts preparation support · title and earnest money tracking · TC handoff packages.
**Out of scope** Click Contracts and SkySlope execution (Chrome handoff) · Send/Sign/Deliver/Accept/
Reject/Counter · MLS or SkySlope submission · legal interpretation · duplicating TC ownership ·
FUB and Calendar writes.
**Success** Every deadline verified and on the Calendar with an owner; Delivered / Signed / Completed
never collapsed; system disagreements named rather than silently resolved.

---

## Handoff map

```
chief-of-staff ──routes──> any department
daily-revenue-command-center ──CRM work──> lead-conversion-crm
                             ──appointment prep──> client-prep-brief
client-prep-brief ──after the interaction──> lead-conversion-crm
buyer-investor-ops ─┐
seller-listing-ops ─┼──all FUB outcomes──> lead-conversion-crm
market-intel-marketing ─┤   (identifiable lead → FUB becomes source of truth)
transaction-closing-ops ┘
seller-listing-ops ──public distribution──> market-intel-marketing
seller-listing-ops ──accepted offer──> transaction-closing-ops
buyer-investor-ops ──accepted offer──> transaction-closing-ops
ALL ──MLS / Click / SkySlope / Ylopo / ShowingTime──> Chrome operator handoff
ALL ──strategy · SOP change · legal · compensation · shared config──> Blaise / ChatGPT
```

**Invariants.** FUB owns leads, tasks, and the dated next action. Drive owns canonical documents.
Calendar owns deadlines. **No department creates a parallel CRM, task list, calendar, transaction
database, or document system.** One department writes to FUB. Every department preflights its
connectors, resolves sources by fileId, and anchors dates to America/Chicago.
