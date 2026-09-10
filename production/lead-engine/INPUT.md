# Operator input contract

The supported agent researches and assembles this task-local JSON. Blaise supplies the business request, not JSON. Use fresh private paths outside Git. All times are ISO 8601 with offsets; business dates are America/Chicago. Unknown dates remain unknown. `tests/fixtures.js` is an executable, completely fictional example; never relabel it live.

## Pack

`{mode, governance, request, sources, candidates, coverage}`. Mode is `live-research` or explicitly `synthetic`. A live run requires current canonical retrieval metadata from `governance.json`: key, exact file_id, returned title, status `ACTIVE — GOVERNING`, modified_at and retrieved_at within 24 hours. Record returned version or `UNPINNED`. This validates the operator's retrieval record; the engine cannot authenticate a manually asserted retrieval. Current governing content and task authorization control.

Request accepts `geography: [{city, state, postal_code?}]`, `lanes: ['seller','open-house','professional']`, `limit` (1–10, default 5), `minimum_score` (40–100, default 55), and optional `weights` for exactly the seven components in SCORING.md totaling 100. Postal-only requests may omit city. No demographic criteria. Up to 20 requested geographies, 30 total candidates, 80 source records, ten candidates per adapter observation.

Each coverage record identifies lane, attempt_status and a concise limitation with the real capability/source condition. The engine computes the surfaced count; a zero count never means no market opportunities exist.

## Sources and facts

A source carries unique `id`, `name`, exact reopenable HTTPS `locator`, `retrieval_tool`, `access` (`browser`, `public-web`, `authorized-export`, `public-api`; `synthetic` only in test mode), `observed_at`, `retrieved_at`, `permission: {state, basis}` and `excerpts`. Permission states are allowed/restricted/unverified; only allowed supports a candidate. Include permission-source URL when relevant. Use short necessary excerpts, not full pages. An old crawl date stays old even if returned today. Unknown crawl date requires reopening before asserting freshness. Authorized exports remain under their licensing/storage conditions.

A fact carries `id`, `field`, `text`, `source` ID, exact `quote` from captured excerpts, and `state` (reported/verified/inferred). Status facts also carry a normalized `value`; event facts carry the exact timestamp `value` supporting an event. Verified requires `verification_scope` direct-observation or authorized-record. Seeing a publisher's claim does not independently verify the underlying property/business assertion. The engine checks excerpt membership, references and status consistency; the operator must verify that the excerpt actually supports the interpretation. It is not a semantic truth detector.

Use distinct source IDs for changed captures. Conflicting signals must remain visible, including rejected observations; never remove an adverse observation to improve ranking. Hashes detect later changes to captured evidence; they do not prove publisher authenticity.

## Candidate

Required fields:

- `lane`, `display_name`, exact `target_key`; optional `property_key` preserves unit identity. Optional source-backed `pursuit_key` identifies a shared professional counterpart across lanes.
- `geography: {city,state,postal_code?,refs}`, `identity_refs`, `facts`.
- `signal_type`: seller expired/canceled/withdrawn/fsbo; open-house active-listing; professional professional-service/business-event/new-project.
- `current_status: {value,refs}` supported by matching status facts. Qualifying statuses: seller expired/canceled/withdrawn/fsbo, host active, professional operating. Sold, pending, unknown and off-market do not qualify.
- `latest_meaningful_event: {description,kind,at?,refs}`. Kind dated-event/current-observation/undated. Future dates require a professional business-event. A current observation gets reduced recency; it is not a newly occurring business event. Record date-only precision explicitly and explain any normalized calendar-date timestamp.
- `review: {reviewer,legitimate_service_only:true,no_sensitive_targeting:true}`.
- `assessments`: intent/conversation/value/business_value, each `{value:0..4,reason,refs}`. `why_blaise` and `value_angle` each `{text,refs}`. Assessments are reviewable judgments, not source facts.
- `unknowns`: array of `{text,blocks_contact?}`; `conflicts` when unresolved.
- `prep: {opener,discovery:[2..4 strings],next_commitment}`. Use current Playbook, conditional while held. No invented public identity, buyer demand or reciprocal/paid referral promise.

Contact review is optional and defaults to HOLD-VERIFY. `gates.js` defines seven required checks: each must have current, exact target/channel-bound, verified source evidence. Review includes target_key, reviewer, channel, identity, reviewed_at, expires_at and checks. `do_not_contact:true` suppresses a target. Public contact details never satisfy a check merely by existing. Even a fully supported ELIGIBLE review has `executable:false`.

For selected detail, pass a freshly researched pack and optional exact relationship adjudication: candidate_id, reviewed_by, reviewed_at, source_locator, state (EXISTING-EXACT/BOUNDED-NO-MATCH/AMBIGUOUS/DO-NOT-CONTACT), plus fub_person_id for an exact existing record. The one-hour detail freshness check requires actual reopening, not changing timestamps. An unavailable FUB lane remains NOT-CHECKED; an empty bounded lookup is not proof of global absence. See relationship.js for read-only lookup and selected-person handoff proposal.

## Outcome evidence

`outcomes` reads a private array of evidence events with stage, candidate_id, lane, geography, signal_type, value_angle, source_name, occurred_at, and `evidence: {locator,record_id,system,verified_by,verified_at,classification:'verified'}`. Stages are exported in outcomes.js. Only a separately authorized financial source may support GCI amount/currency. A board artifact supports surfaced; it cannot support attempted, appointment, signed client or closing. Do not invent intermediate funnel steps. The output aggregates pointers and counts only; actual relationship, transaction and financial records remain in their owning systems.
