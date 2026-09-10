'use strict';
const { requireThat, instant, httpUrl, sha } = require('./evidence');
const STAGES=['surfaced','selected','attempted','meaningful-conversation','appointment-consultation','signed-client-listing','offer-mutual','closing','gci'];
// Pure task-local aggregation of evidence pointers. No persistence, CRM or financial ledger.
function summarizeOutcomes(events) {
  requireThat(Array.isArray(events)&&events.length<=500,'Bounded outcome evidence required');
  const seen=new Set(),groups={};
  for(const e of events) {
    requireThat(STAGES.includes(e.stage)&&e.candidate_id&&e.lane&&e.geography&&e.signal_type&&e.value_angle&&e.source_name,'Outcome dimensions required');
    instant(e.occurred_at); httpUrl(e.evidence?.locator);
    requireThat(e.evidence.record_id&&e.evidence.verified_by&&e.evidence.verified_at&&e.evidence.system,'Actual downstream evidence required');
    instant(e.evidence.verified_at);
    requireThat(e.evidence.classification==='verified','Reported/assumed outcomes cannot enter outcome counts');
    if(e.stage==='gci') requireThat(e.evidence.system==='approved-financial-source' && Number.isFinite(e.amount)&&e.amount>=0&&e.currency==='USD','GCI requires separately verified authorized financial evidence');
    const key=sha([e.candidate_id,e.stage,e.evidence.system,e.evidence.record_id]); if(seen.has(key)) continue; seen.add(key);
    const group=JSON.stringify([e.lane,e.geography,e.signal_type,e.value_angle,e.source_name]);
    groups[group]??={lane:e.lane,geography:e.geography,signal_type:e.signal_type,value_angle:e.value_angle,source_name:e.source_name,counts:{},evidence:[]};
    groups[group].counts[e.stage]=(groups[group].counts[e.stage]||0)+1;
    groups[group].evidence.push(e.evidence.locator);
    if(e.stage==='gci') groups[group].verified_gci_usd=(groups[group].verified_gci_usd||0)+e.amount;
  }
  return {groups:Object.values(groups),allocation:'Work may recommend CORE / TEST / CUT from sufficient outcomes; no automatic weights or allocation changes.',limitations:'Counts are evidence events, not inferred funnel transitions. No missing stage is manufactured. Economics remain in the financial source.'};
}
module.exports={STAGES,summarizeOutcomes};
