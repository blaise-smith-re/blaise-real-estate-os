'use strict';
const {randomUUID}=require('node:crypto');
const {requestDefaults,buildBoard}=require('./engine');
const {requireThat,cleanInput,instant,normalized,sha,Evidence}=require('./evidence');
const {normalizeCandidate}=require('./model');
const {assertZeroEffects,ZERO_EFFECTS}=require('../../runtime/contract');
const chicagoDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
function startSession(request={},governance=[],now=new Date().toISOString()) {
  instant(now);cleanInput({request,governance}); const r=requestDefaults(request),queries=[];
  requireThat(typeof (request.property_type||'Single Family')==='string'&&(request.property_type||'Single Family').length<=100,'Bounded property type required');
  const lookback=request.seller_lookback_days??90;
  requireThat(Number.isInteger(lookback)&&lookback>=1&&lookback<=180,'Seller lookback must be 1–180 days');
  const add=(id,lane,statuses,route)=>queries.push({id,lane,statuses,route,state:'PENDING',geography:r.geography,
    date_from:lane==='seller'&&route==='matrix-browser'?chicagoDate(Date.parse(now)-lookback*86400000):null,date_to:chicagoDate(now),
    property_type:request.property_type||'Single Family',max_candidates:10,position:null,observations:[]});
  if(r.lanes.includes('seller')) {for(const status of ['expired','canceled','withdrawn'])add('seller-'+status,'seller',[status],'matrix-browser');add('seller-fsbo','seller',['fsbo'],'permitted-public-or-professional');}
  if(r.lanes.includes('open-house'))add('host-active','open-house',['active'],'matrix-browser');
  if(r.lanes.includes('professional'))add('professional-public','professional',['operating'],'permitted-public');
  return {schema:'blaise.lead-engine.session.v1',run_id:randomUUID(),created_at:now,updated_at:now,revision:0,mode:'live-research',request:r,governance,queries,browser:null,effects:{...ZERO_EFFECTS}};
}
function validateSession(s) {
  cleanInput(s);requireThat(s.schema==='blaise.lead-engine.session.v1'&&s.run_id&&Number.isInteger(s.revision),'Valid task-local research session required');
  requireThat(Array.isArray(s.queries)&&s.queries.length<=6&&new Set(s.queries.map(q=>q.id)).size===s.queries.length,'Bounded unique research queries required');
  assertZeroEffects(s.effects);return s;
}
function next(s) {validateSession(s);return structuredClone(s);}
function query(s,id){const q=s.queries.find(q=>q.id===id);requireThat(q,'Exact pending query required');return q;}
function touch(s,now){instant(now);s.updated_at=now;s.revision++;return s;}
function pauseForAuthentication(session,{browser_id,tab_id,title,query_ids},now=new Date().toISOString()) {
  const s=next(session);requireThat(browser_id&&tab_id&&title,'Observed browser tab reference required');
  const ids=query_ids||s.queries.filter(q=>q.route==='matrix-browser'&&!['COMPLETE','BLOCKED'].includes(q.state)).map(q=>q.id);
  for(const id of ids){const q=query(s,id);requireThat(q.route==='matrix-browser','Authentication pause is scoped to Matrix searches');if(!['COMPLETE','BLOCKED'].includes(q.state))q.state='WAITING-AUTH';}
  // Do not store OAuth query parameters, cookies, session IDs or credentials.
  s.browser={browser_id,tab_id,title,entry_url:'https://member.northstarmls.com/',state:'WAITING-AUTH',observed_at:now};
  s.resume_instruction='In Chrome, complete Northstar/REcore sign-in and MFA yourself. Reply “Resume my lead engine” with this run ID. The operator reselects this tab, verifies the authenticated Matrix search screen and resumes only incomplete queries; completed research stays intact.';
  return touch(s,now);
}
function confirmAuthenticated(session,observation,now=new Date().toISOString()) {
  const s=next(session);requireThat(s.browser&&observation?.browser_id===s.browser.browser_id&&observation.tab_id&&observation.verified_by&&observation.authenticated_search_visible===true&&observation.screen_summary,'Observe authenticated Matrix search UI before resuming; user sign-in report alone is insufficient');
  s.browser={...s.browser,tab_id:observation.tab_id,state:'AUTHENTICATED',observed_at:now,screen_summary:observation.screen_summary,verified_by:observation.verified_by};
  for(const q of s.queries)if(q.state==='WAITING-AUTH')q.state='PENDING';
  return touch(s,now);
}
function acceptObservation(session,id,result,now=new Date().toISOString()) {
  const s=next(session),q=query(s,id);
  cleanInput(result);assertZeroEffects(result.effects);requireThat(result.observation_id&&Array.isArray(result.sources)&&Array.isArray(result.candidates)&&result.candidates.length<=10,'Bounded uniquely identified observation required');
  const duplicate=q.observations.find(o=>o.observation_id===result.observation_id);
  if(duplicate){requireThat(sha(duplicate)===sha(result),'Observation ID conflicts with retained evidence');return s;}
  requireThat(q.state!=='COMPLETE','Completed query cannot be silently rerun');
  requireThat(result.candidates.every(c=>c.lane===q.lane),'Observation belongs to another lane');
  const evidence=new Evidence(result.sources,now,s.mode==='synthetic');
  for(const candidate of result.candidates)normalizeCandidate(candidate,evidence);
  if(q.route==='matrix-browser') {
    requireThat(s.browser?.state==='AUTHENTICATED'&&q.state!=='WAITING-AUTH','Matrix authentication must be observed before accepting research');
    const c=result.criteria;
    requireThat(c?.summary&&c.verified_by&&c.verified_at&&Array.isArray(c.statuses)&&Array.isArray(c.geography),'Read the actual displayed criteria summary');
    requireThat(instant(now)-instant(c.verified_at)>=0&&instant(now)-instant(c.verified_at)<=3600000,'Current displayed criteria required');
    const canonical=a=>a.map(x=>typeof x==='string'?normalized(x):JSON.stringify(x)).sort().join('|');
    requireThat(canonical(c.statuses)===canonical(q.statuses)&&canonical(c.geography)===canonical(q.geography),'Displayed status/geography differs from intended search');
    requireThat(c.property_type===q.property_type&&c.date_from===q.date_from&&c.date_to===q.date_to,'Displayed property/date criteria differ from intended search');
    requireThat(result.sources.every(x=>x.access==='browser'&&x.permission?.state==='allowed'),'Supervised permitted browser observations required');
    requireThat(result.candidates.every(x=>q.statuses.includes(x.current_status.value)),'Result status differs from displayed query; inspect relist/history conflict');
  }
  requireThat(q.observations.reduce((n,o)=>n+o.candidates.length,0)+result.candidates.length<=10,'Per-query retained candidate bound reached');
  q.observations.push(structuredClone(result));q.position=result.position||q.position;
  q.state=result.complete===true?'COMPLETE':'IN-PROGRESS';q.limitation=result.limitation||null;
  const total=s.queries.flatMap(x=>x.observations).reduce((n,o)=>n+o.candidates.length,0);
  requireThat(total<=30,'Run candidate bound reached; finish ranking before expanding research');
  return touch(s,now);
}
function recordLimitation(session,id,reason,now=new Date().toISOString()) {
  const s=next(session),q=query(s,id);requireThat(reason&&q.state!=='COMPLETE','Reason and unfinished query required');q.state='BLOCKED';q.limitation=reason;return touch(s,now);
}
function packFromSession(s) {
  validateSession(s);const sources=new Map(),candidates=[];
  for(const q of s.queries)for(const o of q.observations){for(const source of o.sources){requireThat(!sources.has(source.id)||sha(sources.get(source.id))===sha(source),'Changed source needs a new capture ID');sources.set(source.id,source);}candidates.push(...o.candidates);}
  return {mode:s.mode,request:s.request,governance:s.governance,sources:[...sources.values()],candidates,coverage:s.request.lanes.map(lane=>{const qs=s.queries.filter(q=>q.lane===lane);return {lane,attempt_status:qs.every(q=>q.state==='COMPLETE')?'RESEARCHED':qs.some(q=>q.state==='WAITING-AUTH')?'WAITING-AUTH':'INCOMPLETE',limitation:qs.filter(q=>q.state!=='COMPLETE').map(q=>q.id+': '+(q.limitation||q.state)).join('; '),query_status:qs.map(q=>({id:q.id,state:q.state,position:q.position}))};})};
}
function sessionBoard(session,now=new Date().toISOString()){return buildBoard(packFromSession(session),{now,synthetic:session.mode==='synthetic'});}
module.exports={startSession,validateSession,pauseForAuthentication,confirmAuthenticated,acceptObservation,recordLimitation,packFromSession,sessionBoard};
