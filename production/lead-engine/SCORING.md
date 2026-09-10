# Transparent ranking — implementation defaults for Work review

Scores compare candidates inside one bounded research run. They are neither conversion probabilities nor proof of economic value. Work owns the business criteria and may change weights with a recorded reason; code never tunes itself.

| Component | Maximum | Evidence and interpretation |
|---|---:|---|
| Meaningful-event recency | 15 | Dated past event: 4/4 through 7 days, 3 through 30, 2 through 60, 1 through 120, then 0. Upcoming professional event: 4 within 14 days, 2 beyond. Undated event: 0. Current page observation: 1; it cannot become a fresh listing event. |
| Intent / decision point | 15 | Operator 0–4 assessment with fact IDs and explanation. Professional intent is a service/business opportunity, never an assumed desire for referrals. |
| Useful conversation | 15 | Operator 0–4; exact professional role or relevant decision point. Public phone/email alone does not increase this score. |
| Market fit | 15 | Exact city/state or caller postal code. Default focus includes Woodbury, Cottage Grove and named East Metro communities; it is not a service boundary. No demographic proxies. |
| Legitimate value angle | 20 | Operator 0–4 tied to evidence and a concrete useful contribution. No pressure, vulnerability or private-life inference. |
| Evidence confidence | 10 | Age of oldest current-status observation: 4 through 1 day, 3 through 7, 2 through 14, otherwise 1. Publisher claims stay reported regardless of score. |
| Expected business value | 10 | Operator 0–4 for repeatable service/qualified business potential. Do not estimate GCI from asking price, assume buyer availability or use wealth. |

Each component contributes `value × weight / 4`. All weights must be known, nonnegative and total 100. Each operator assessment requires a reason and observed/reported fact references. Scale anchors: 0 unsupported, 1 weak/indirect, 2 plausible, 3 strong specific fit, 4 unusually strong direct decision/service fit. An inference is never a fact.

Penalties: contact hold 8; no dated decision point 5; each material unknown 2 (cap 10); unreviewed relationship 3. These do not confer permission. Minimum score defaults to 55; caller changes must stay 40–100. A high price does not itself earn business-value points. Unknown pipeline/host demand is a material limitation, not a buyer-traffic promise.

Hard exclusions precede scoring selection: wrong geography, stale status (property >7 days; professional >30), no qualifying current status, known relist/sale, unresolved status conflict, failed exact-matching source record, or do-not-contact. Deduplication groups exact normalized target/property; units remain separate. A match with adverse evidence suppresses that identity group for resolution. After adjudication, optional source-backed pursuit keys keep only the higher-ranked opportunity for the same professional relationship across lanes. A professional's operating status and a home's active status are not a property-status conflict. Different units or people never merge merely because names are similar. Unrecognized fuzzy matches require operator review. The operator must apply any known person-level suppression to every affected candidate, including distinct property targets.

The board records every component, penalty, fact reference and exclusion. Ties use stable candidate ID. No lane quota displaces stronger opportunities. When two source captures disagree, keep both versioned pointers and hold rather than choose whichever produces the desired rank.

Outcome learning compares actual evidenced events by lane, geography, signal, value angle and source. Work can recommend CORE / TEST / CUT from adequate observations. No stage, closing or GCI is inferred from an attempt, appointment or property price.
