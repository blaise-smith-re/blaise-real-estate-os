// Durable receipts for the existing Buyer Workbench. No CRM, mail or send adapter.
const fail = message => { throw Error(message); };
const copy = value => structuredClone(value);
const text = (value, max=12000) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail('Nonempty bounded text required');
const norm = value => text(value).normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const time = value => Number.isFinite(Date.parse(value)) ? value : fail('Source timestamp required');
const url = value => { const u = new URL(text(value)); return u.protocol === 'https:' && !u.username && !u.password ? u.href : fail('HTTPS source required'); };
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
function source(s) { return {id:text(s?.id,300),url:url(s?.url),at:time(s?.at),kind:text(s?.kind,50)}; }
function owner(b) { if(!Number.isSafeInteger(b?.personId)||b.personId<1||b.assignedUserId!==33)fail('Exact current FUB buyer assigned to user 33 required'); return {...b,name:text(b.name,200),checkedAt:time(b.checkedAt),recordUrl:url(b.recordUrl)}; }
function quoted(transcript,quote) { if(!transcript.includes(text(quote)))fail('Evidence must be an exact quote from the actual source'); return quote; }
function scope(c,ids) { if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!c.properties.some(p=>p.id===id)))fail('Resolve property scope against this tour first'); return [...ids].sort(); }
function effect(c,key,kind,payload) { c.effects[key] ??= {key,kind,payload,status:'pending',claim:null,receipt:null}; return c.effects[key]; }
function find(s,p) { const c=s.cases.find(c=>c.id===p.caseId); if(!c)fail('Read the existing case first'); return c; }
function promise(c,p) { const v=c.promises.find(v=>v.id===p.promiseId); if(!v)fail('Existing promise required'); return v; }
function taskUpdate(c,v) {
  const create=c.effects['task:'+v.id];
  if(!create||create.status!=='verified')return;
  // Supersede unclaimed updates; an uncertain claimed write must first be reconciled.
  for(const e of Object.values(c.effects))if(e.kind==='task_update'&&e.payload.promiseId===v.id&&e.status==='pending')e.status='superseded';
  effect(c,'task-update:'+v.id+':'+v.version,'task_update',{promiseId:v.id,taskId:create.receipt.objectId,name:v.status==='fulfilled'?'Buyer received: '+v.outcome:'Buyer answer owed: '+v.outcome,status:v.status,complete:v.status==='fulfilled',dueDate:v.dueDate});
}
export const initialPostShowing = () => ({schemaVersion:1,revision:0,cases:[],runs:[]});
export async function postShowingTransition(current,p,at=new Date().toISOString()) {
  if(!p||p.expectedRevision!==current.revision)fail('Revision changed; reread before retry');
  if(p.mode!==undefined&&!['live','replay'].includes(p.mode))fail('Unknown mode');
  const s=copy(current),result={mayExecute:false};
  if(p.action==='recap') {
    const b=owner(p.buyer),src=source(p.source),transcript=text(p.transcript);
    if(src.kind!=='owner_recap')fail('Owner recap establishes attendance');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.tourDate)||!p.episode)fail('Resolve original tour episode and local date');
    const id=await digest(b.personId+'|'+text(p.episode,300)),fingerprint=await digest(norm(transcript));
    let c=s.cases.find(c=>c.id===id);
    if(!c) {
      if(!Array.isArray(p.properties)||!p.properties.length)fail('Resolve the tour properties before saving');
      const properties=p.properties.map(v=>({id:text(v.id,200),address:text(v.address,500),order:v.order??null,sourceUrl:url(v.sourceUrl)}));
      if(new Set(properties.map(v=>v.id)).size!==properties.length)fail('Duplicate property identity');
      c={id,buyer:b,episode:p.episode,tourDate:p.tourDate,properties,attendance:{status:'completed',basis:src,actualTime:null},recaps:[],observations:[],promises:[],effects:{},version:0};s.cases.push(c);
    }
    c.buyer=b;result.caseId=c.id;
    if(c.recaps.some(r=>r.fingerprint===fingerprint||r.source.id===src.id)) {result.duplicate=true;result.promiseIds=c.promises.map(v=>v.id);return {state:s,result:{...result,revision:s.revision}};}
    const observations=(p.observations??[]).map(v=>{
      if(!['buyer_confirmed','owner_observation','hypothesis'].includes(v.label))fail('Observation label required');
      if(!v.propertyId)fail('Resolve the property before saving its observation');scope(c,[v.propertyId]);
      return {propertyId:v.propertyId,label:v.label,quote:quoted(transcript,v.quote),summary:text(v.summary),source:src};
    });
    let newFacts=[];
    for(const o of observations) {
      if(!c.observations.some(v=>v.propertyId===o.propertyId&&v.label===o.label&&norm(v.summary)===norm(o.summary))){c.observations.push(o);newFacts.push(o);}
    }
    const newPromises=[];
    for(const v of p.promises??[]) {
      quoted(transcript,v.quote);const propertyIds=scope(c,v.propertyIds??[]),outcome=text(v.outcome),topic=norm(v.topic);
      const promiseId=await digest(c.id+'|'+topic+'|'+propertyIds.join('|'));
      if(c.promises.some(v=>v.id===promiseId))continue;
      if(v.dueDate!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate))fail('Resolve due date in America/Chicago from recap date; null if not agreed');
      const pending={id:promiseId,topic,outcome,propertyIds,dueDate:v.dueDate,source:src,quote:v.quote,status:'question_ready',version:1,lender:v.lender?{name:text(v.lender.name,200),address:text(v.lender.address,300),sourceUrl:url(v.lender.sourceUrl)}:null,question:{body:text(v.question),version:1,edited:false},buyerDraft:null,answer:null,sent:null,delivery:null};
      c.promises.push(pending);newPromises.push(pending);
      effect(c,'task:'+promiseId,'task_create',{promiseId,name:'Buyer answer owed: '+outcome,dueDate:v.dueDate,assignedUserId:33});
    }
    c.recaps.push({fingerprint,source:src});c.version++;
    // One material note for this interaction; no task or draft for feedback alone.
    if(newFacts.length||newPromises.length)effect(c,'note:'+fingerprint,'note',{source:src,tourDate:c.tourDate,observations:newFacts,promises:newPromises.map(v=>({id:v.id,outcome:v.outcome,dueDate:v.dueDate,propertyIds:v.propertyIds})),attendance:'Completed, reported by Blaise; actual times unknown unless separately reported'});
    result.promiseIds=c.promises.map(v=>v.id);result.duplicate=!newFacts.length&&!newPromises.length;
  } else if(p.action==='answer') {
    const c=find(s,p),v=promise(c,p),src=source(p.source),body=text(p.body);
    if(v.status==='fulfilled')fail('Promise already fulfilled; a new material obligation needs explicit new scope');
    if(p.personId!==c.buyer.personId||!v.lender||norm(p.sender)!==norm(v.lender.address)||p.contentVerified!==true||p.scopeVerified!==true)fail('Read actual lender body and verify exact buyer, lender and promise scope');
    if(v.sent&&p.threadId!==v.sent.threadId)fail('Answer thread differs; reconcile rather than guessing');
    if(v.answer?.source.id===src.id){result.duplicate=true;return {state:s,result:{...result,revision:s.revision}};}
    const quote=quoted(body,p.quote);
    const proposed='Here is '+v.lender.name+"'s answer to what I owed you:\n\n"+quote;
    v.answer={source:src,quote,threadId:text(p.threadId,300)};v.status='buyer_reply_ready';v.version++;
    if(v.buyerDraft?.edited)v.buyerDraft.proposedUpdate={body:proposed,source:src};
    else v.buyerDraft={body:proposed,version:(v.buyerDraft?.version??0)+1,edited:false,source:src,proposedUpdate:null};
    taskUpdate(c,v);result.promiseId=v.id;
  } else if(p.action==='revise_draft') {
    const c=find(s,p),v=promise(c,p),draft=p.target==='question'?v.question:p.target==='buyer'?v.buyerDraft:null;
    if(!draft||v.status==='fulfilled'||p.expectedDraftVersion!==draft.version)fail('Draft changed or is no longer open');
    draft.body=text(p.body);draft.edited=true;draft.version++;result.draft=copy(draft);
  } else if(p.action==='question_sent') {
    const c=find(s,p),v=promise(c,p),src=source(p.source);
    if(!['sent_message','owner_report'].includes(src.kind)||p.actualSent!==true||p.personId!==c.buyer.personId)fail('Actual sent source or explicit owner report required');
    if(v.sent?.source.id===src.id){result.duplicate=true;return {state:s,result:{...result,revision:s.revision}};}
    if(v.status!=='question_ready')fail('Question is not awaiting delivery');
    v.sent={source:src,threadId:text(p.threadId,300)};v.status='waiting_lender';v.version++;taskUpdate(c,v);
  } else if(p.action==='buyer_received') {
    const c=find(s,p),v=promise(c,p),src=source(p.source);
    if(p.personId!==c.buyer.personId||p.fulfilledOutcome!==true||!['delivered_message','owner_report'].includes(src.kind))fail('Evidence must establish this buyer received the owed answer');
    const outcome=text(p.outcome);if(v.status==='fulfilled'){result.duplicate=true;return {state:s,result:{...result,revision:s.revision}};}
    // Explicit owner call report is sufficient even when the lender reply is outside connected sources.
    v.delivery={source:src,outcome};v.status='fulfilled';v.version++;
    effect(c,'outcome:'+v.id,'outcome_note',{promiseId:v.id,source:src,outcome});
    const creation=c.effects['task:'+v.id];
    if(creation?.status==='pending')creation.status='superseded';
    taskUpdate(c,v);
  } else if(p.action==='claim_effect') {
    const c=find(s,p),e=c.effects[p.key];if(!e)fail('Unknown internal effect');
    const b=owner(p.buyer);if(b.personId!==c.buyer.personId)fail('Wrong buyer');
    if(e.kind==='task_update'&&(p.task?.assignedUserId!==33||p.task?.personId!==b.personId||String(p.task.id)!==String(e.payload.taskId)))fail('Read exact task and its own user-33 assignment');
    if(p.reconciled!==true)fail('Read existing notes/tasks and reconcile semantic duplicates before claiming');
    if(e.kind==='task_update'&&Object.values(c.effects).some(v=>v.key!==e.key&&v.kind==='task_update'&&v.payload.promiseId===e.payload.promiseId&&v.status==='claimed'))fail('Reconcile uncertain task update first');
    if(e.status==='pending'){e.status='claimed';e.claim=await digest(c.id+'|'+e.key);result.mayExecute=p.mode!=='replay';result.replayGrant=p.mode==='replay';}
    result.effect=copy(e);
  } else if(p.action==='effect_receipt') {
    const c=find(s,p),e=c.effects[p.key];if(!e||!['pending','claimed','verified'].includes(e.status))fail('No reconcilable effect');
    if(p.personId!==c.buyer.personId||p.assignedUserId!==33||p.readBack!==true)fail('Independent exact-target readback required');
    const receipt={objectId:text(String(p.objectId),300),url:url(p.url),checkedAt:time(p.checkedAt),existing:p.existing===true};
    if(e.status==='verified'&&e.receipt.objectId!==receipt.objectId)fail('Cannot replace verified object identity');
    if(e.status==='pending'&&!p.existing)fail('A new write requires a prior effect claim');
    e.receipt=receipt;e.status='verified';
    if(e.kind==='task_create'){const v=promise(c,{promiseId:e.payload.promiseId});if(v.version>1)taskUpdate(c,v);}
  } else if(p.action==='run_receipt') {
    if(!['workbench','inbox_pass','morning_desk','private_replay'].includes(p.execution))fail('Execution source required');
    s.runs.push({at,execution:p.execution,source:source(p.source),summary:text(p.summary)});
  } else fail('Unknown post-showing action');
  s.revision++;return {state:s,result:{...result,revision:s.revision}};
}
export function openPostShowing(s) { return s.cases.map(c=>({caseId:c.id,personId:c.buyer.personId,name:c.buyer.name,recordUrl:c.buyer.recordUrl,tourDate:c.tourDate,properties:c.properties,promises:c.promises.filter(v=>v.status!=='fulfilled'),pendingEffects:Object.values(c.effects).filter(e=>['pending','claimed'].includes(e.status))})).filter(c=>c.promises.length||c.pendingEffects.length); }
export async function readPostShowing(db,mode='live') { const row=await db.prepare('SELECT payload FROM post_showing WHERE id=?').bind(mode==='replay'?2:1).first();return row?JSON.parse(row.payload):initialPostShowing(); }
export async function commandPostShowing(db,p,at=new Date().toISOString()) {
  const id=p.mode==='replay'?2:1,current=await readPostShowing(db,p.mode),{state,result}=await postShowingTransition(current,p,at);
  if(state.revision===current.revision)return result;
  const q=current.revision===0?db.prepare('INSERT OR IGNORE INTO post_showing(id,revision,payload) VALUES(?,?,?)').bind(id,state.revision,JSON.stringify(state)):db.prepare('UPDATE post_showing SET revision=?,payload=? WHERE id=? AND revision=?').bind(state.revision,JSON.stringify(state),id,current.revision);
  if((await q.run()).meta.changes!==1)fail('Concurrent change; reread before retry');return result;
}
