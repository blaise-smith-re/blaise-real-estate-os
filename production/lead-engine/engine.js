'use strict';
const { ZERO_EFFECTS, assertZeroEffects } = require('../../runtime/contract');
const { Evidence, requireThat, cleanInput, sha, normalized } = require('./evidence');
const { LANES, normalizeCandidate, identityKeys } = require('./model');
const { contactGate, firstMove } = require('./gates');
const { rank } = require('./ranking');
const { verifyGovernance } = require('./governance');
const {CLASSES,classify,actionReadiness}=require('./readiness');
const DEFAULT_GEOGRAPHY=[{city:'Woodbury',state:'MN'},{city:'Cottage Grove',state:'MN'},{city:'Lake Elmo',state:'MN'},{city:'Oakdale',state:'MN'},{city:'Maplewood',state:'MN'},{city:'Stillwater',state:'MN'},{city:'Afton',state:'MN'},{city:'Newport',state:'MN'},{city:'Saint Paul Park',state:'MN'}];
function requestDefaults(r={}) {
  const result={geography:DEFAULT_GEOGRAPHY,lanes:LANES,limit:5,minimum_score:55,...r};
  requireThat(Array.isArray(result.geography)&&result.geography.length>0&&result.geography.length<=20&&result.geography.every(g=>g.state&&(g.city||g.postal_code)), 'Explicit bounded geography required');
  requireThat(Array.isArray(result.lanes)&&result.lanes.length>0&&result.lanes.every(l=>LANES.includes(l)), 'Supported lanes required');
  requireThat(Number.isInteger(result.limit)&&result.limit>=1&&result.limit<=10,'Board limit must be 1–10');
  requireThat(Number.isFinite(result.minimum_score)&&result.minimum_score>=40&&result.minimum_score<=100,'Quality floor must be 40–100');
  return result;
}
function buildBoard(pack, {now=new Date().toISOString(),synthetic=false}={}) {
  cleanInput(pack);
  requireThat(pack.mode === (synthetic?'synthetic':'live-research'), 'Run mode mismatch');
  if(!synthetic) verifyGovernance(pack.governance,now);
  const request=requestDefaults(pack.request); const evidence=new Evidence(pack.sources,now,synthetic);
  requireThat(Array.isArray(pack.candidates)&&pack.candidates.length<=30,'Bounded candidate pack required (maximum 30)');
  const rejected=[]; const eligible=[]; const unresolvedKeys=new Set();
  for (const raw of pack.candidates) {
    try {
      let c=normalizeCandidate(raw,evidence);
      if(!request.lanes.includes(c.lane)) continue;
      c.contact_eligibility=contactGate(c,evidence); c.opportunity_class=classify(c,evidence.now);
      c.action_readiness=actionReadiness(c,evidence); c.recommended_first_move=firstMove(c); c=rank(c,evidence,request);
      eligible.push(c);
    } catch(e) { rejected.push({target:raw.display_name||'Unnamed',reason:e.message}); if(raw.target_key) for(const key of identityKeys(raw)) unresolvedKeys.add(key); }
  }
  // Group before filtering: adverse evidence from a duplicate must not disappear.
  const groups=[];
  for(const c of eligible) {
    const keys=identityKeys(c); const matches=groups.filter(g=>g.keys.some(k=>keys.includes(k)));
    if(!matches.length) groups.push({keys,items:[c]});
    else { const g=matches[0]; g.keys=[...new Set([...g.keys,...keys,...matches.flatMap(x=>x.keys)])]; g.items.push(c,...matches.slice(1).flatMap(x=>x.items)); for(const x of matches.slice(1)) groups.splice(groups.indexOf(x),1); }
  }
  const shortlist=[];
  for(const group of groups) {
    const items=group.items.sort((a,b)=>b.final_priority-a.final_priority||a.candidate_id.localeCompare(b.candidate_id));
    const c=items[0]; const statuses=new Set(items.map(x=>x.current_status.value));
    let reason;
    if(group.keys.some(k=>unresolvedKeys.has(k))) reason='Matching source record failed validation; resolve before ranking';
    else if(items.some(x=>x.contact_eligibility.state==='DO-NOT-CONTACT')) reason='DO-NOT-CONTACT evidence suppresses all matching candidates';
    else if(items.some(x=>x.conflicts?.length) || statuses.size>1) reason='Conflicting source status/identity; resolve before ranking';
    else if(['sold','pending','unknown','off-market'].includes(c.current_status.value)) reason='No current qualifying opportunity status';
    else if(c.lane==='seller' && !['expired','canceled','withdrawn','fsbo'].includes(c.current_status.value)) reason='Seller signal does not match current status (possible relist)';
    else if(c.lane==='open-house'&&c.current_status.value!=='active') reason='Host opportunity requires active listing';
    else if(c.lane==='open-house'&&!c.host_business_case?.refs?.some(id=>c.facts.some(f=>f.id===id&&['hosting_need','buyer_fit','market_position'].includes(f.field)&&f.state!=='inferred'))) reason='Host needs source-backed buyer fit, hosting need or market-position business case';
    else if(c.lane==='professional'&&c.current_status.value!=='operating') reason='Professional opportunity requires current operation';
    else if(!c.market_match) reason='Outside requested geography';
    else if(c.status_age_days>(c.lane==='professional'?30:7)) reason='Stale current-status evidence; reopen source';
    else if(c.lane==='professional'&&c.signal_type==='business-event'&&Date.parse(c.latest_meaningful_event.at)<evidence.now) reason='Professional event has passed';
    else if(c.final_priority<request.minimum_score) reason=`Below quality floor ${request.minimum_score} (${c.final_priority})`;
    if(reason) rejected.push({target:c.display_name,reason,candidate_id:c.candidate_id});
    else shortlist.push({...c,corroborating_sources:[...new Set(items.flatMap(x=>x.source_locator))]});
    for(const other of items.slice(1)) rejected.push({target:other.display_name,reason:'Duplicate exact target/property; evidence considered with primary',candidate_id:other.candidate_id});
  }
  shortlist.sort((a,b)=>b.final_priority-a.final_priority||a.candidate_id.localeCompare(b.candidate_id));
  // A business relationship and its listing have different status vocabularies.
  // Collapse shared pursuit only after exact-identity conflicts are adjudicated.
  const blockedPursuits=new Set(eligible.filter(c=>c.pursuit_key&&c.contact_eligibility.state==='DO-NOT-CONTACT').map(c=>normalized(c.pursuit_key)));
  const pursuits=new Set(), distinct=[];
  for(const c of shortlist) {
    const key=c.pursuit_key&&normalized(c.pursuit_key);
    if(key&&blockedPursuits.has(key)) rejected.push({target:c.display_name,reason:'DO-NOT-CONTACT on shared professional pursuit',candidate_id:c.candidate_id});
    else if(key&&pursuits.has(key)) rejected.push({target:c.display_name,reason:'Shared professional pursuit already represented by higher-ranked opportunity',candidate_id:c.candidate_id});
    else {if(key)pursuits.add(key);distinct.push(c);}
  }
  const candidates=distinct.slice(0,request.limit).map((c,i)=>({...c,rank:i+1}));
  for(const c of distinct.slice(request.limit)) rejected.push({target:c.display_name,reason:'Below selected slate; no quota filling',candidate_id:c.candidate_id});
  const coverage=request.lanes.map(lane=>({lane,...pack.coverage?.find(c=>c.lane===lane),surfaced:candidates.filter(c=>c.lane===lane).length,
    attempt_status:pack.coverage?.find(c=>c.lane===lane)?.attempt_status||'NOT-ATTEMPTED'}));
  const effects={...ZERO_EFFECTS}; assertZeroEffects(effects);
  return {schema_version:'blaise.lead-engine.v1',board_id:'board-'+sha({now,request,candidates}).slice(0,12),mode:pack.mode,
    generated_at:now,business_date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)),timezone:'America/Chicago',
    request,coverage,candidates,rejected,class_counts:Object.fromEntries(CLASSES.map(k=>[k,candidates.filter(c=>c.opportunity_class.label===k).length])),release_status:'Lead Engine v1 released for agent-operated research/prep; pursuit and contact require separate review',sources:[...evidence.records.values()],governance:pack.governance||[],effects,
    limitations:['Agent-operated research; no background acquisition or monitoring.','Source observations are scoped, not a complete market census.','Rank weights are reviewable implementation defaults; Work owns business judgment.']};
}
module.exports={buildBoard,requestDefaults,DEFAULT_GEOGRAPHY};
