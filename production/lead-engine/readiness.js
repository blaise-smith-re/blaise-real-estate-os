'use strict';
const {requireThat,DAY}=require('./evidence');
const CLASSES=['MONEY NOW','PIPELINE','NETWORK / KNOWLEDGE'];
const PARTICIPATION=['registration','membership_guest_eligibility','blaise_availability','spending_approval'];
function classify(c,now) {
  if(c.lane==='seller')return {label:'MONEY NOW',reason:'Current source-backed seller signal; plausible listing conversation, not verified willingness to hire.'};
  if(c.lane==='open-house')return {label:'MONEY NOW',reason:'Active listing with a supported hosting business case; actual agent agreement remains separate.'};
  const event=c.latest_meaningful_event;
  const distance=event.at?Math.abs(Date.parse(event.at)-now)/DAY:Infinity;
  return event.kind==='dated-event'&&distance<=30&&['business-event','new-project'].includes(c.signal_type)
    ?{label:'PIPELINE',reason:'Concrete dated professional business context within 30 days; no immediate client or listing demand established.'}
    :{label:'NETWORK / KNOWLEDGE',reason:'Service/resource relationship without a current source-backed demand signal; not counted as a sales opportunity.'};
}
function actionReadiness(c,evidence) {
  const action=c.proposed_action||'cold-outreach';
  requireThat(['cold-outreach','public-event'].includes(action),'Unsupported proposed action');
  if(action==='cold-outreach')return {action,state:c.contact_eligibility.state,label:c.contact_eligibility.label,missing:c.contact_eligibility.missing,executable:false,contact_gate_applies:true};
  requireThat(c.lane==='professional'&&c.signal_type==='business-event','Public participation requires a professional event');
  requireThat(c.event_participation?.refs?.some(id=>c.facts.some(f=>f.id===id&&f.field==='public_in_person_event'&&f.value===true&&f.state!=='inferred')),'Source-backed public in-person event required');
  const checks={},missing=[];
  for(const key of PARTICIPATION) {
    const check=c.participation_review?.[key];
    let resolved=false;
    if(check&&['verified','not-required'].includes(check.state)) {
      try {
        requireThat(check.reason&&check.evidence?.field==='participation.'+key&&check.evidence.target_key===c.target_key&&check.evidence.state==='verified','Exact participation evidence required');
        evidence.claim(check.evidence);requireThat(evidence.age(check.evidence.source)<=1,'Stale participation evidence');resolved=true;
      }catch {resolved=false;}
    }
    checks[key]={state:resolved?check.state:check?.state==='blocked'?'blocked':'unknown',reason:check?.reason||'Confirm before deciding to participate'};
    if(!resolved)missing.push(key);
  }
  return {action,state:missing.length?'CHECK-PARTICIPATION':'READY-FOR-OWNER-DECISION',label:missing.length?'CHECK EVENT PARTICIPATION':'PARTICIPATION PREREQUISITES VERIFIED — Blaise decides',checks,missing,executable:false,contact_gate_applies:false,
    note:'Normal in-person networking is separate from cold outreach. No registration, spending or Calendar action is authorized. Any later cold follow-up needs its own contact gate.'};
}
module.exports={CLASSES,PARTICIPATION,classify,actionReadiness};
