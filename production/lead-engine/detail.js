'use strict';
const { requireThat, instant, sha } = require('./evidence');
const { buildBoard } = require('./engine');
function opportunityDetail(board, rank, {freshPack,now=new Date().toISOString(),relationshipReview}={}) {
  requireThat(Number.isInteger(rank),'Exact board rank required');
  const original=board.candidates.find(c=>c.rank===rank); requireThat(original,'Rank not on this board');
  instant(now);
  let c=original; let refresh='REQUIRED';
  if(freshPack) {
    const refreshed=buildBoard(freshPack,{now,synthetic:board.mode==='synthetic'});
    const match=refreshed.candidates.find(x=>x.candidate_id===original.candidate_id);
    if(!match) return {board_id:board.board_id,candidate_id:original.candidate_id,target:original.display_name,state:'HOLD — no longer qualifies after refresh',opener:null,reasons:refreshed.rejected};
    c=match;
    const newest=Math.min(...c.source_timestamp.map(Date.parse));
    if(Date.parse(now)-newest<=3600000) refresh='RECHECKED';
  }
  let relationship={state:'NOT-CHECKED',reason:'Bounded FUB identity review required; unavailable is not absent.'};
  if(relationshipReview) {
    requireThat(relationshipReview.candidate_id===c.candidate_id && relationshipReview.reviewed_by && relationshipReview.source_locator && relationshipReview.reviewed_at,'Exact relationship evidence required');
    instant(relationshipReview.reviewed_at);
    requireThat(Date.parse(relationshipReview.reviewed_at)<=Date.parse(now)&&Date.parse(now)-Date.parse(relationshipReview.reviewed_at)<=3600000,'Relationship review stale');
    requireThat(['EXISTING-EXACT','BOUNDED-NO-MATCH','AMBIGUOUS','DO-NOT-CONTACT'].includes(relationshipReview.state),'Relationship state invalid');
    if(relationshipReview.state==='EXISTING-EXACT') requireThat(Number.isSafeInteger(relationshipReview.fub_person_id)&&relationshipReview.fub_person_id>0,'Exact FUB person ID required');
    relationship=relationshipReview;
  }
  const dnc=c.contact_eligibility.state==='DO-NOT-CONTACT'||relationship.state==='DO-NOT-CONTACT';
  const ready=!dnc&&refresh==='RECHECKED'&&['EXISTING-EXACT','BOUNDED-NO-MATCH'].includes(relationship.state)&&c.contact_eligibility.state==='ELIGIBLE';
  return {board_id:board.board_id,candidate_id:c.candidate_id,target:c.display_name,
    opener:dnc?null:c.prep.opener,state:dnc?'DO-NOT-CONTACT':ready?'PREPARED FOR BLAISE REVIEW':'HOLD — research/prep only; not executable outreach',
    freshness:refresh,relationship_check:relationship,contact_eligibility:c.contact_eligibility,
    discovery:dnc?[]:c.prep.discovery,next_commitment:dnc?null:c.prep.next_commitment,
    prep_label:ready?'Review wording and exact action before any contact':'Conditional coaching only. Resolve source freshness, relationship, public identity and contact gate before use.',
    to_verify:c.unknowns,source_locator:c.source_locator,evidence_digest:sha(c.facts),external_effects:false};
}
module.exports={opportunityDetail};
