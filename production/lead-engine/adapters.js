'use strict';
const { requireThat, instant, cleanInput } = require('./evidence');
const { requestDefaults, buildBoard } = require('./engine');
const { ZERO_EFFECTS, assertZeroEffects } = require('../../runtime/contract');

// Tools remain in the authenticated host. This module accepts only their bounded observations;
// it never crawls, reads browser sessions, or creates an alternative MLS/API integration.
function publicObservation({source, candidates}) {
  requireThat(['browser','public-web','public-api','synthetic'].includes(source.access),'Public adapter access mismatch');
  requireThat(source.permission?.state === 'allowed','Source permission unresolved');
  requireThat(Array.isArray(candidates)&&candidates.length<=10,'Maximum ten candidates per observation');
  cleanInput({source,candidates});
  return {sources:[source],candidates:structuredClone(candidates)};
}
function mlsObservation({source,candidates,criteria}) {
  requireThat(['browser','authorized-export','synthetic'].includes(source.access),'Direct MLS/API route is unavailable in v1');
  requireThat(criteria?.summary && criteria?.verified_by && criteria?.verified_at && criteria?.geography && criteria?.statuses,'Observed MLS criteria summary required');
  instant(criteria.verified_at);
  requireThat(source.permission?.state==='allowed','Authorized MLS business-use evidence required');
  requireThat(candidates.length<=10 && candidates.every(c=>c.lane!=='professional'),'Bounded MLS property observation required');
  cleanInput({source,candidates,criteria});
  return {sources:[{...source,criteria}],candidates:structuredClone(candidates)};
}
function researchPlan(request={}) {
  const r=requestDefaults(request); const geo=r.geography.map(g=>[g.city,g.state,g.postal_code].filter(Boolean).join(' ')).join('; ');
  return r.lanes.map(lane=>({lane,geography:geo,max_candidates:10,
    source_order:lane==='professional'?['official business/project/event pages','permitted public directories']:['supervised authenticated Northstar/Matrix browser','permitted public owner/broker/property pages'],
    objective:lane==='seller'?'Verify current expired, canceled/withdrawn where permitted, or FSBO signals; check relist/sale conflicts.':lane==='open-house'?'Find active homes where a listing-agent host proposal may create seller and buyer value; check existing open-house coverage.':'Find a small set of professional relationships with a concrete local service or current business event.',
    instructions:['Verify source-use permission before extracting candidates; public visibility is not permission.','Do not bypass login, CAPTCHA, paywall, robots, terms or product restrictions.','Keep publisher status/price claims reported; only direct observation/authorized facts may be verified.','Record observation time separately from retrieval time and the meaningful event date.','Do not access contact forms, saved alerts, messaging or live writers.','Return a specific lane limitation if unavailable; never fill with invented candidates.']}));
}
async function research(request, {researchLane,governance,now=()=>new Date().toISOString()}={}) {
  requireThat(typeof researchLane==='function','An authenticated agent/operator research callback is required; CLI does not pretend to browse');
  const pack={mode:'live-research',governance,request:requestDefaults(request),sources:[],candidates:[],coverage:[]};
  for(const plan of researchPlan(request)) {
    try {
      const result=await researchLane(plan);
      requireThat(result && result.effects, 'Research callback must report effects'); assertZeroEffects(result.effects);
      requireThat(Array.isArray(result.sources)&&Array.isArray(result.candidates)&&result.candidates.length<=10,'Bounded observation result required');
      requireThat(result.candidates.every(c=>c.lane===plan.lane),'Research lane mismatch');
      pack.sources.push(...result.sources); pack.candidates.push(...result.candidates);
      pack.coverage.push({lane:plan.lane,attempt_status:result.candidates.length?'RESEARCHED':'NO-QUALIFYING-CANDIDATES',limitation:result.limitation||null});
    } catch(e) { pack.coverage.push({lane:plan.lane,attempt_status:'BLOCKED',limitation:e.message}); }
  }
  // Identical shared source IDs are safe; conflicting captures need explicit source versions.
  const sources=new Map();
  for(const s of pack.sources) { requireThat(!sources.has(s.id)||JSON.stringify(sources.get(s.id))===JSON.stringify(s),'Conflicting source ID across lanes'); sources.set(s.id,s); }
  pack.sources=[...sources.values()];
  return {pack,board:buildBoard(pack,{now:now()}),effects:{...ZERO_EFFECTS}};
}
module.exports={publicObservation,mlsObservation,researchPlan,research};
