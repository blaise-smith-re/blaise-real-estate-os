// Persistent, preparation-only workflow attached to the existing Morning Desk.
// The generic OperationsBus remains manual; this is its first scoped hosted lane.
export const revision = '2026-10-29.1';
export const initialState = () => ({revision:0,paused:true,cursors:{},cases:{},events:{},effects:{},lastRun:null});
const states=['WAITING','READY FOR BLAISE','COMPLETED','FAILED/EXCEPTION'];
const kinds=['drive_packet','drive_original','fub_note','fub_task','fub_profile','fub_deal'];
const fail = message => { throw new Error(message); };
const str = (s,n=2000) => typeof s==='string'&&s.trim()&&s.length<=n || fail('Invalid bounded text');
const date = s => { str(s,40); if(!/^\d{4}-\d\d-\d\dT/.test(s)||!Number.isFinite(Date.parse(s)))fail('ISO timestamp required'); };
const url = s => { str(s);const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.search.match(/token|secret|password|key=/i))fail('Safe source URL required'); };
const key = s => {str(s,200);if(!/^[A-Za-z0-9_.:-]+$/.test(s)||['__proto__','constructor','prototype'].includes(s))fail('Invalid stable key');};
const hash = s => {if(typeof s!=='string'||!/^[a-f0-9]{64}$/.test(s))fail('SHA-256 required');};
const own = (obj,k) => Object.hasOwn(obj,k);
function clean(value){
  if(!value||typeof value!=='object')return;
  for(const [k,v] of Object.entries(value)){if(/^(password|secret|token|access_token|refresh_token|api_?key|credential|ssn)$/i.test(k))fail('Credential/sensitive field prohibited');clean(v);}
}
function held(s,p,now){
  key(p.caseKey);const c=s.cases[p.caseKey];if(!c)fail('Unknown case');
  if(s.paused)fail('Kickoff lane paused');
  if(c.lease?.runId!==p.runId||c.lease?.fence!==p.fence||Date.parse(c.lease.until)<=now)fail('Lease expired or replaced; reread and reclaim');
  return c;
}
export function transition(current,p,at){
  clean(p);date(at);const now=Date.parse(at);if(!p||typeof p!=='object')fail('Command required');
  const s=structuredClone(current);let result={ok:true};
  if(p.action==='control'){
    if(typeof p.paused!=='boolean')fail('paused must be boolean');s.paused=p.paused;
    if(p.paused)for(const c of Object.values(s.cases))c.lease=null;
  } else if(p.action==='observe'){
    if(s.paused)fail('Kickoff lane paused');key(p.eventKey);url(p.sourceUrl);date(p.observedAt);
    if(Date.parse(p.observedAt)>now+60000)fail('Future source event');
    if(!own(s.events,p.eventKey))s.events[p.eventKey]={sourceUrl:p.sourceUrl,observedAt:p.observedAt,caseKey:null,disposition:'REVIEW'};
    result.event=s.events[p.eventKey];
  } else if(p.action==='dismiss'){
    key(p.eventKey);if(!own(s.events,p.eventKey))fail('Observe first');str(p.reason,400);
    if(s.events[p.eventKey].caseKey)fail('Bound event cannot be dismissed');
    s.events[p.eventKey].disposition='NOT_ACCEPTED_CONTRACT';s.events[p.eventKey].reason=p.reason;
  } else if(p.action==='claim'){
    if(s.paused)fail('Kickoff lane paused');key(p.caseKey);key(p.eventKey);key(p.runId);key(p.propertyKey);
    if(!Number.isSafeInteger(p.personId)||p.personId<1||!Number.isSafeInteger(p.dealId)||p.dealId<1||p.assignedUserId!==33)fail('Exact owner33 contact and existing deal required');
    if(p.caseKey!==`fub:${p.personId}:deal:${p.dealId}`)fail('Use canonical transaction key');
    if(!['interactive','cloud_task','replay'].includes(p.execution))fail('Explicit execution provenance required');
    if(!own(s.events,p.eventKey))fail('Observe source event first');
    const event=s.events[p.eventKey];if(event.caseKey&&event.caseKey!==p.caseKey)fail('Event already belongs to another transaction');
    let c=s.cases[p.caseKey];
    if(c&&(c.personId!==p.personId||c.dealId!==p.dealId||c.propertyKey!==p.propertyKey||c.execution==='replay'&&p.execution!=='replay'))fail('Identity or replay/live conflict');
    if(!c)c=s.cases[p.caseKey]={personId:p.personId,dealId:p.dealId,propertyKey:p.propertyKey,execution:p.execution,state:'WAITING',packageKey:null,contextUrl:null,reviewUrl:null,nextOwner:'Blaise',nextAction:'Verify executed source and existing work',nextCheck:null,summary:'Candidate; acceptance not verified',fence:0,lease:null,verification:null};
    if(c.lease&&Date.parse(c.lease.until)>now&&c.lease.runId!==p.runId)fail('Another run owns this case');
    c.fence++;c.lease={runId:p.runId,fence:c.fence,until:new Date(now+30*60000).toISOString()};c.execution=p.execution;
    event.caseKey=p.caseKey;event.disposition='BOUND';result.case=c;
  } else if(p.action==='verify'){
    const c=held(s,p,now);hash(p.packageKey);str(p.verifier,100);date(p.checkedAt);
    if(Date.parse(p.checkedAt)>now+60000)fail('Future verification');
    if(!['source_read','human_verified_original'].includes(p.method))fail('Original-source verification required');
    if(!Array.isArray(p.documents)||!p.documents.length)fail('Controlling document inventory required');
    for(const d of p.documents){url(d.url);hash(d.sha256);str(d.version,200);str(d.coverage,2000);}
    for(const field of ['partiesAndProperty','completeChronology','signaturesInitialsDates','acceptanceDelivery','controllingTerms'])if(p[field]!==true)fail(`Unverified ${field}; save a scoped hold instead`);
    if(c.packageKey!==p.packageKey){c.state='WAITING';c.summary='Executed package verified; reconcile existing handoff and obligations';}
    c.packageKey=p.packageKey;c.verification={method:p.method,verifier:p.verifier,checkedAt:p.checkedAt,documents:p.documents.map(({url,sha256,version,coverage})=>({url,sha256,version,coverage}))};
  } else if(p.action==='begin_effect'){
    const c=held(s,p,now);if(c.execution==='replay')fail('Replay prohibits source writes');
    const independent=p.phase==='preverification'&&['drive_packet','drive_original'].includes(p.kind);
    if((!c.verification||!c.packageKey)&&!independent)fail('Executed original gate not verified; only independent Drive gathering/verification drafts may use preverification phase');
    if(!kinds.includes(p.kind))fail('Effect outside internal kickoff scope');key(p.semanticKey);str(p.target,300);hash(p.intentHash);
    // Stable semantic key must identify the business effect, not a delivery or run ID.
    const effectKey=`${p.caseKey}:${p.kind}:${p.semanticKey}`;
    if(own(s.effects,effectKey)){
      const e=s.effects[effectKey];if(e.intentHash!==p.intentHash||e.target!==p.target)fail('Existing effect differs; reconcile its receipt before planning a genuinely changed version');
      result={ok:true,effectKey,mayExecute:false,status:e.status,receipt:e.receipt??null};
    }else{
      s.effects[effectKey]={caseKey:p.caseKey,kind:p.kind,target:p.target,intentHash:p.intentHash,packageKey:c.packageKey,status:'UNCERTAIN',startedAt:at,runId:p.runId,receipt:null};
      result={ok:true,effectKey,mayExecute:true,status:'UNCERTAIN'};
    }
  } else if(p.action==='receipt'){
    held(s,p,now);str(p.effectKey,600);const e=s.effects[p.effectKey];if(!e||e.caseKey!==p.caseKey)fail('Unknown effect');
    if(e.intentHash!==p.intentHash)fail('Receipt does not match intended effect');url(p.sourceUrl);date(p.checkedAt);str(p.recordId,300);str(p.matchedFields,2000);
    if(Date.parse(p.checkedAt)<Date.parse(e.startedAt)||Date.parse(p.checkedAt)>now+60000)fail('Receipt time invalid');
    e.status='VERIFIED';e.receipt={sourceUrl:p.sourceUrl,recordId:p.recordId,checkedAt:p.checkedAt,matchedFields:p.matchedFields};
  } else if(p.action==='progress'){
    const c=held(s,p,now);if(!states.includes(p.state))fail('Invalid workflow state');
    str(p.summary,700);str(p.nextOwner,100);str(p.nextAction,700);if(p.nextCheck!==null)date(p.nextCheck);
    if(p.contextUrl!==null)url(p.contextUrl);if(p.reviewUrl!==null)url(p.reviewUrl);
    if(['READY FOR BLAISE','COMPLETED'].includes(p.state)&&(!c.verification||!p.contextUrl))fail('Verified source and saved Drive context required');
    if(p.state==='COMPLETED'&&Object.values(s.effects).some(e=>e.caseKey===p.caseKey&&e.status!=='VERIFIED'))fail('Uncertain effects remain open');
    Object.assign(c,{state:p.state,summary:p.summary,nextOwner:p.nextOwner,nextAction:p.nextAction,nextCheck:p.nextCheck,contextUrl:p.contextUrl,reviewUrl:p.reviewUrl,updatedAt:at});
    c.lease=null;
  } else if(p.action==='checkpoint'){
    if(s.paused)fail('Kickoff lane paused');key(p.lane);date(p.through);str(p.coverage,1500);
    if(p.complete!==true||Date.parse(p.through)>now+60000)fail('Complete observed interval required');
    if(s.cursors[p.lane]&&Date.parse(p.through)<Date.parse(s.cursors[p.lane].through))fail('Cursor regression');
    s.cursors[p.lane]={through:p.through,coverage:p.coverage};
  } else if(p.action==='run_receipt'){
    key(p.runId);str(p.summary,1500);url(p.evidenceUrl);if(!['interactive','cloud_task','replay'].includes(p.execution))fail('Explicit execution provenance required');
    s.lastRun={runId:p.runId,at,execution:p.execution,summary:p.summary,evidenceUrl:p.evidenceUrl};
  } else fail('Unknown command');
  s.revision=current.revision+1;return {state:s,result:{...result,revision:s.revision,paused:s.paused}};
}

// One compare-and-swap provides fencing across concurrent cloud invocations.
// A lost response never grants a second write permit: the effect stays UNCERTAIN.
export async function readBus(db){
  const row=await db.prepare('SELECT payload FROM operations_bus WHERE id=1').first();
  return row?JSON.parse(row.payload):initialState();
}
export async function commandBus(db,p,at=new Date().toISOString()){
  const current=await readBus(db);
  if(p.expectedRevision!==current.revision)throw new Error('State changed; read operations_bus_read and reconcile before retry');
  const {state,result}=transition(current,p,at);
  const q=current.revision===0
    ?db.prepare('INSERT OR IGNORE INTO operations_bus(id,revision,payload) VALUES(1,?,?)').bind(state.revision,JSON.stringify(state))
    :db.prepare('UPDATE operations_bus SET revision=?,payload=? WHERE id=1 AND revision=?').bind(state.revision,JSON.stringify(state),current.revision);
  const saved=await q.run();if(saved.meta.changes!==1)throw new Error('Concurrent change; reread before retry');
  return result;
}
