// Chat progress only. FUB remains authoritative; no network or outbound adapters.
const fail=m=>{throw Error(m);};
const text=(v,n=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>n)fail('Nonblank bounded text required');return v;};
const key=v=>{text(v,180);if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(v))fail('Invalid stable key');return v;};
const id=v=>{if(!Number.isSafeInteger(v)||v<1)fail('Exact positive FUB id required');return v;};
const url=v=>{text(v,1000);if(!/^https:\/\//.test(v))fail('HTTPS source link required');return v;};
const date=(v,now)=>{text(v,40);if(!Number.isFinite(Date.parse(v))||Date.parse(v)>now+60000)fail('Invalid or future evidence date');return v;};
const receipt=(v,now)=>{if(!v||typeof v!=='object')fail('Independent readback required');return {recordId:text(v.recordId,100),url:url(v.url),checkedAt:date(v.checkedAt,now),matchedFields:text(v.matchedFields,1500)};};
const statuses=['ready','review','wait','blocked'];
export const initialFollowUp=()=>({schemaVersion:1,revision:0,assignedUserId:33,queue:[],currentId:null,events:[],effects:[],discovery:null});
function card(v,now){
  if(v.assignedUserId!==33)fail('Only assigned user 33');
  if(!statuses.includes(v.readiness))fail('Invalid readiness');
  if(!['sms','email','call','internal'].includes(v.channel))fail('Invalid channel');
  const c={id:key(v.id),personId:id(v.personId),assignedUserId:33,name:text(v.name,160),phone:v.phone===null?null:text(v.phone,50),phoneSource:url(v.phoneSource),recordUrl:url(v.recordUrl),reason:text(v.reason),draft:v.draft===null?null:text(v.draft,6000),channel:v.channel,recipient:v.recipient===null?null:text(v.recipient,250),readiness:v.readiness,permission:text(v.permission,1000),coverage:text(v.coverage,1500),materialGap:v.materialGap===true,nextAction:text(v.nextAction,1500),sourceKey:key(v.sourceKey),checkedAt:date(v.checkedAt,now),references:(v.references??[]).map(url)};
  if(!c.recordUrl.endsWith('/'+c.personId))fail('Contact URL must match exact person');
  if(c.id!==`fub:${c.personId}:${c.sourceKey}`)fail('Use stable person and source-event key, not a run or date key');
  if(c.readiness==='ready'&&(!c.draft||!c.recipient||c.materialGap||c.channel==='internal'))fail('Ready requires usable draft, recipient, permission and no material gap');
  if(c.channel==='sms'&&c.readiness==='ready'&&(!c.phone||c.recipient!==c.phone))fail('SMS recipient must be the verified number');
  return c;
}
function item(s,p){const c=s.queue.find(c=>c.id===p.itemId);if(!c)fail('Unknown queue item');return c;}
function event(s,p){const e=s.events.find(e=>e.id===p.eventId);if(!e)fail('Unknown confirmed event');return e;}
function active(s,p){const c=item(s,p);if(s.currentId!==c.id)fail('Name the currently presented person; do not infer from chat position');return c;}
export function followUpTransition(current,p,at=new Date().toISOString()){
  const now=Date.parse(at);if(!Number.isFinite(now))fail('Invalid clock');
  if(p.expectedRevision!==current.revision)fail('State changed; read and reconcile');
  const s=structuredClone(current);let result={ok:true,mayExecute:false};
  if(p.action==='refresh'){
    if(!Array.isArray(p.items)||p.items.length>100)fail('Bounded candidate list required');
    const incoming=p.items.map(v=>card(v,now));
    if(new Set(incoming.map(c=>c.id)).size!==incoming.length||new Set(incoming.map(c=>c.personId)).size!==incoming.length)fail('One item per person');
    const d=p.discovery;if(!d||d.assignedUserId!==33||!Number.isSafeInteger(d.discovered)||d.discovered<0)fail('Discovery scope required');
    s.discovery={assignedUserId:33,checkedAt:date(d.checkedAt,now),discovered:d.discovered,complete:d.complete===true,sourceRunId:text(d.sourceRunId,150),coverage:text(d.coverage,3000)};
    // Keep event ledger across refreshes. Dropped cards are not completed work.
    s.queue=incoming.map(c=>{const old=s.queue.find(x=>x.id===c.id);if(old&&old.personId!==c.personId)fail('Stable identity changed');const confirmed=s.events.some(e=>e.itemId===c.id&&e.direction==='outgoing');return {...c,progress:confirmed?'confirmed':old?.progress??'pending',draftVersion:(old?.draftVersion??0)+(old?.draft===c.draft?0:1),presentedVersion:null};});
    if(!s.queue.some(c=>c.id===s.currentId))s.currentId=null;
  }else if(p.action==='present'){
    const c=item(s,p),fresh=card(p.item,now);
    if(fresh.id!==c.id||fresh.personId!==c.personId||Date.parse(fresh.checkedAt)<Date.parse(c.checkedAt))fail('Fresh exact contact reconciliation required');
    const changed=fresh.draft!==c.draft;Object.assign(c,fresh,{draftVersion:c.draftVersion+(changed?1:0)});
    c.presentedVersion=c.draftVersion;s.currentId=c.id;result.item=c;
  }else if(p.action==='revise'){
    const c=active(s,p);if(c.progress==='confirmed')fail('Already confirmed: preserve actual message');
    c.draft=text(p.draft,6000);c.draftVersion++;c.presentedVersion=null;result.item=c;
  }else if(p.action==='skip'||p.action==='next'){
    const c=active(s,p);if(p.action==='skip'&&c.progress!=='confirmed'){c.progress='skipped';c.skipReason=text(p.reason,500);}
    // next leaves the prior item pending; neither action creates a CRM effect.
    s.currentId=null;result.nextCandidates=s.queue.filter(x=>x.id!==c.id&&x.progress==='pending').map(x=>x.id);
  }else if(p.action==='confirm'){
    const c=active(s,p);if(!['outgoing','incoming'].includes(p.direction)||p.confirmedBy!=='Blaise')fail('Explicit Blaise report required');
    if(!['sms','email','call','owner_report'].includes(p.channel))fail('Actual channel required');
    const message=text(p.message,6000),occurredOn=text(p.occurredOn,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)||!Number.isFinite(Date.parse(occurredOn))||occurredOn>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at)))fail('Actual Chicago event date, not invented time, required');
    const existing=s.events.find(e=>e.itemId===c.id&&e.direction==='outgoing');
    if(p.direction==='outgoing'&&existing){
      if(existing.message!==message||existing.channel!==p.channel)fail('Confirmation differs from recorded event; reconcile rather than log again');
      result.event=existing;result.duplicate=true;
    }else{
      if(p.direction==='outgoing'&&(c.presentedVersion!==p.draftVersion||c.presentedVersion!==c.draftVersion))fail('Confirm the presented draft version');
      if(p.direction==='outgoing'&&(p.channel!==c.channel||p.recipient!==c.recipient))fail('Resolve actual changed channel/recipient before confirming');
      const recipient=p.recipient===null?null:text(p.recipient,250);
      const duplicate=s.events.find(e=>e.personId===c.personId&&e.direction===p.direction&&e.channel===p.channel&&e.message===message&&e.occurredOn===occurredOn);
      if(duplicate){result.event=duplicate;result.duplicate=true;}else{
        const e={id:`event:${s.revision+1}`,itemId:c.id,personId:c.personId,direction:p.direction,channel:p.channel,recipient,message,occurredOn,reportedAt:at,provenance:text(p.provenance,1200),status:'needs_reconciliation',receipt:null};
        s.events.push(e);result.event=e;
      }
    }
    if(p.direction==='outgoing')c.progress='confirmed';
    else{c.readiness='review';c.materialGap=true;c.nextAction='Reconcile the supplied reply and prepare the appropriate next move';}
  }else if(p.action==='begin_effect'){
    const e=event(s,p);if(!['fub_event','fub_note','fub_task_update','fub_profile_update'].includes(p.kind))fail('Only internal FUB recording and individual maintenance');
    if(p.assignedUserId!==33||p.personId!==e.personId)fail('Fresh exact owner33 record required');
    date(p.checkedAt,now);if(Date.parse(p.checkedAt)<Date.parse(e.reportedAt))fail('Read current FUB before write intent');
    const target=p.kind==='fub_task_update'?id(p.taskId):e.personId;
    if(p.kind==='fub_task_update'&&p.taskAssignedUserId!==33)fail('Task must also belong to 33');
    const purpose=p.kind==='fub_task_update'?`task:${target}`:p.kind==='fub_profile_update'?'profile':'event_log';
    const effectId=`${e.id}:${purpose}`,intent=text(p.intent,6000),old=s.effects.find(x=>x.id===effectId);
    if(old){if(old.intent!==intent||old.kind!==p.kind)fail('Existing intent differs; reconcile uncertain result');result.effect=old;}
    else if(e.receipt&&['fub_event','fub_note'].includes(p.kind)){result.alreadyLogged=true;result.receipt=e.receipt;}
    else{const effect={id:effectId,eventId:e.id,personId:e.personId,kind:p.kind,target,intent,status:'uncertain',startedAt:at,receipt:null};s.effects.push(effect);result.effect=effect;result.mayExecute=true;}
  }else if(p.action==='receipt'){
    const e=event(s,p),r=receipt(p.receipt,now);
    const effect=p.effectId?s.effects.find(x=>x.id===p.effectId&&x.eventId===e.id):null;
    if(p.effectId&&!effect)fail('Unknown effect');
    if(effect){if(Date.parse(r.checkedAt)<Date.parse(effect.startedAt))fail('Readback predates effect');effect.status='verified';effect.receipt=r;}
    else if(p.alreadyInFub!==true)fail('Already-existing source evidence required');
    if(!effect||['fub_event','fub_note'].includes(effect.kind)){e.receipt=r;e.status='verified';}
    result.event=e;
  }else fail('Unknown follow-up command');
  s.revision++;return {state:s,result:{...result,revision:s.revision,currentId:s.currentId}};
}
export async function readFollowUp(db){const row=await db.prepare('SELECT payload FROM daily_follow_up WHERE id=1').first();return row?JSON.parse(row.payload):initialFollowUp();}
export async function commandFollowUp(db,p,at=new Date().toISOString()){
  const current=await readFollowUp(db);const {state,result}=followUpTransition(current,p,at);
  const query=current.revision===0?db.prepare('INSERT OR IGNORE INTO daily_follow_up(id,revision,payload) VALUES(1,?,?)').bind(state.revision,JSON.stringify(state)):db.prepare('UPDATE daily_follow_up SET revision=?,payload=? WHERE id=1 AND revision=?').bind(state.revision,JSON.stringify(state),current.revision);
  const saved=await query.run();if(saved.meta.changes!==1)fail('Concurrent update; read state before retry');return result;
}
