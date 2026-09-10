'use strict';
const { requireThat, normalized, sha, instant } = require('./evidence');
const LANES = ['seller','open-house','professional'];
const SIGNALS = {seller:['expired','canceled','withdrawn','fsbo'], 'open-house':['active-listing'], professional:['professional-service','business-event','new-project']};
const ASSESSMENTS = ['intent','conversation','value','business_value'];
const STATUSES = ['fsbo','expired','canceled','withdrawn','active','operating','sold','pending','off-market','unknown'];
function normalizeCandidate(raw, evidence) {
  requireThat(LANES.includes(raw.lane) && SIGNALS[raw.lane].includes(raw.signal_type), 'Invalid lane or signal');
  requireThat(raw.display_name && raw.target_key && raw.geography?.city && raw.geography?.state, 'Exact target and city/state required');
  requireThat(raw.review?.reviewer && raw.review?.legitimate_service_only === true && raw.review?.no_sensitive_targeting === true, 'Operator relevance/privacy review required');
  const facts = raw.facts.map(f => evidence.claim(f));
  requireThat(facts.length > 0 && new Set(facts.map(f=>f.id)).size === facts.length, 'Unique facts required');
  const byId = new Map(facts.map(f=>[f.id,f]));
  const refs = r => requireThat(Array.isArray(r) && r.length > 0 && r.every(id=>byId.has(id) && byId.get(id).state !== 'inferred'), 'Decision needs observed/reported evidence refs');
  refs(raw.identity_refs); refs(raw.geography.refs); refs(raw.current_status.refs);
  requireThat(STATUSES.includes(raw.current_status.value), 'Invalid status');
  requireThat(raw.current_status.refs.some(id => byId.get(id).field === 'status'), 'Status-specific evidence required');
  requireThat(raw.current_status.refs.every(id => byId.get(id).field === 'status' && byId.get(id).value === raw.current_status.value), 'Normalized status differs from source assertion');
  const statusValues = new Set(facts.filter(f=>f.field==='status').map(f=>f.value));
  requireThat(statusValues.size === 1, 'Conflicting status assertions within candidate');
  const event = raw.latest_meaningful_event;
  requireThat(event?.description && ['dated-event','current-observation','undated'].includes(event.kind), 'Meaningful event and date precision required');
  refs(event.refs);
  if (event.at) {
    instant(event.at);
    requireThat(event.refs.some(id=>byId.get(id).value===event.at), 'Event timestamp must be bound to a source assertion');
    requireThat(event.kind !== 'undated', 'Undated event cannot carry invented timestamp');
    requireThat(instant(event.at) <= evidence.now || (raw.lane === 'professional' && raw.signal_type === 'business-event'), 'Future market event rejected');
  } else requireThat(event.kind === 'undated', 'Dated event needs timestamp');
  for (const k of ASSESSMENTS) {
    const a = raw.assessments?.[k];
    requireThat(a && Number.isInteger(a.value) && a.value >= 0 && a.value <= 4 && a.reason, 'Scoring assessment missing or outside 0–4'); refs(a.refs);
  }
  requireThat(Object.keys(raw.assessments).every(k=>ASSESSMENTS.includes(k)), 'Only permitted service scoring dimensions accepted');
  for (const k of ['why_blaise','value_angle']) { requireThat(raw[k]?.text, k+' required'); refs(raw[k].refs); }
  requireThat(Array.isArray(raw.unknowns) && raw.unknowns.length <= 15, 'Material unknowns required');
  requireThat(raw.prep?.opener && Array.isArray(raw.prep.discovery) && raw.prep.discovery.length >= 2 && raw.prep.discovery.length <= 4 && raw.prep.next_commitment, 'Opener, 2–4 discovery points and one commitment required');
  const identity = normalized(raw.target_key);
  return {...structuredClone(raw),candidate_id:'le-'+sha(identity).slice(0,12),facts,
    verified_facts:facts.filter(f=>f.state==='verified'),reported_facts:facts.filter(f=>f.state==='reported'),inferences:facts.filter(f=>f.state==='inferred'),
    source_name:[...new Set(facts.map(f=>evidence.records.get(f.source).name))],source_locator:[...new Set(facts.map(f=>f.locator))],
    source_timestamp:[...new Set(facts.map(f=>f.observed_at))],relationship_check:{state:'NOT-CHECKED',reason:'Research is outside FUB; check exact shortlist target only.'}};
}
// Units are retained. Aliases require explicit exact identity, never fuzzy name matching.
function identityKeys(c) {
  const keys = [normalized(c.target_key)];
  if (c.property_key) keys.push('property:'+normalized(c.property_key));
  return keys;
}
module.exports = { LANES, SIGNALS, ASSESSMENTS, normalizeCandidate, identityKeys };
