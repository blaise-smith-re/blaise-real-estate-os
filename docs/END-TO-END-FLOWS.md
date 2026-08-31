# End-to-End Business Flows

How the departments compose. Every arrow is a handoff under
`governance/handoff-contract.md`. **FUB is the source of truth at every step where a person exists.**

Legend: `[R]` read-only · `[W]` CRM write path (pending CGQ-001) · `[H]` Chrome-operator handoff ·
`[B]` Blaise acts.

---

## FLOW A — New buyer lead → closing

```
new inquiry
 → lead-conversion-crm [R]      resolve + corroborate target, relationship state
 → client-prep-brief [R]        5-minute pre-conversation brief
 → BLAISE [B]                   the actual conversation
 → lead-conversion-crm [W]      factual note + one dated next action
 → buyer-investor-ops [R]       search construction / refinement
      └─ MLS RESEARCH REQUEST [H]  Northstar/Matrix — browser lane
 → buyer-investor-ops [R]       showing brief
 → BLAISE [B]                   showing
 → lead-conversion-crm [W]      showing outcome + next action
 → buyer-investor-ops [R]       offer strategy preparation
      └─ Click Contracts [H]       offer preparation — browser lane
 → BLAISE [B]                   offer submitted, accepted
 → transaction-closing-ops [R]  mutual acceptance capture, deadlines, TC package
 → BLAISE / TC [B]              closing
 → market-intel-marketing [R]   case study + referral preparation
```
**Where time is saved:** brief, search diagnosis, showing prep, offer framing, deadline capture.
**Where Blaise stays in the loop:** every client conversation, the offer, the contract, the close.

## FLOW B — Seller lead → closing

```
seller inquiry
 → lead-conversion-crm [R] → client-prep-brief [R] → BLAISE [B] → lead-conversion-crm [W]
 → seller-listing-ops [R]       consultation prep · CMA/pricing (MLS via [H])
 → BLAISE [B]                   listing appointment, agreement signed
 → seller-listing-ops [R]       pre-list readiness · launch preparation
 → market-intel-marketing [R]   launch copy + campaign → READY FOR LAUNCH
 → BLAISE [B]                   publishes / spends
 → seller-listing-ops [R]       weekly active-listing update · pricing-gap analysis
 → seller-listing-ops [R]       offer review + net analysis
 → transaction-closing-ops [R]  accepted offer → close
 → market-intel-marketing [R]   just-sold story, case study, referral
```
**Branch — listing goes stale:** `seller-listing-ops` runs the three-path decision session
(stay / adjust / withdraw). Price gap must be **SUPPORTED** before any reduction recommendation.
**Branch — listing expires:** postmortem → relist proposal → SOP 12 agreement path → SOP 14 campaign
reset. Never a DOM reset framed as a fresh start.

## FLOW C — Investor

```
lead → lead-conversion-crm [R] → buyer-investor-ops [R] investor intake + buy-box construction
 → buyer-investor-ops [R]  property analysis: NOI · cap rate · cash-on-cash · financing assumptions
      └─ MLS + rent comps [H]
 → BLAISE [B] showing
 → lead-conversion-crm [W] outcome
 → buyer-investor-ops [R] scenario / sensitivity analysis → investment decision brief
 → offer → transaction-closing-ops [R]
```
**Guardrail:** every number states its assumptions. Vacancy, maintenance, capex and management are
never silently omitted. **No tax or legal advice** — route to the client's CPA or attorney.

## FLOW D — Personal lead generation

```
market-intel-marketing [R]   Weekly 20 research + ranking (MLS/public record via [H])
 → FUB dedupe [R]            existing active leads are never net-new
 → BLAISE [B]                outreach — Claude never contacts anyone
 → meaningful response
 → lead-conversion-crm [W]   the opportunity becomes a real FUB record
 → FLOW A or FLOW B
```
**Invariant:** research artifacts live in Drive. The moment a person is identifiable and engaged,
**FUB becomes the source of truth.** No parallel prospect database, ever.

## FLOW E — Morning command

```
chief-of-staff
 → daily-revenue-command-center [R]   ranked 5–8 priorities for the America/Chicago business date
 → parallel delegation:
      client-prep-brief [R]        for each confirmed interaction
      buyer-investor-ops [R]       property/offer questions
      seller-listing-ops [R]       listing decisions
      transaction-closing-ops [R]  deadline risk
 → chief-of-staff reconciles → executive output
```
**This is the highest-leverage loop.** One invocation replaces opening FUB, Calendar, and three
workflows, then re-deriving priority by hand.

---

## Cross-flow invariants

1. **One CRM write path.** Every FUB write goes through `lead-conversion-crm`, which re-verifies the
   target rather than inheriting an identity claim.
2. **Chrome operator is a boundary, not a gap.** MLS, Click, SkySlope, Ylopo, ShowingTime always route
   by formal packet. No department ever substitutes remembered data.
3. **One dated next action.** Every viable lead or client leaves a flow with exactly one.
4. **America/Chicago everywhere** a date, deadline or client-facing time appears.
5. **Blaise owns every client conversation**, every external communication, every signature, every
   dollar of spend. Claude prepares; Blaise decides and acts.
