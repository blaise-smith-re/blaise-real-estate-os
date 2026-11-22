// Private workflow receipts only. Gmail/FUB/ShowingTime remain authoritative.
// No provider credentials, outbound messages, booking or calendar adapters.
const fail = message => { throw new Error(message); };
const str = (v, max = 2000) => typeof v === 'string' && v.trim() && v.length <= max ? v : fail('Bounded nonblank text required');
const url = v => { const u = new URL(str(v, 1500)); if (u.protocol !== 'https:') fail('HTTPS source required'); return v; };
const time = (v, now) => { if (!Number.isFinite(Date.parse(v)) || Date.parse(v) > now + 60000) fail('Invalid or future evidence'); return v; };
const fresh = (v, now) => { time(v, now); if (now - Date.parse(v) > 120000) fail('Recheck sources within two minutes'); return v; };
const positive = v => Number.isSafeInteger(v) && v > 0 ? v : fail('Exact positive ID required');
const accounts = ['blaise@buysellhometeam.com', 'bsmith@blaisesmithproperties.com'];
const kinds = ['request', 'reschedule', 'confirmed', 'cancelled', 'outgoing', 'incoming', 'feedback'];
const sources = ['zillow', 'showingtime', 'fub', 'gmail', 'owner_report'];
export const initialTours = () => ({schemaVersion: 1, revision: 0, paused: false, tours: [], deliveries: [], cursors: {}, lastRun: null, runs: [], activation: null,
  coverage: {arrivalHook: 'not_connected', agentWakeup: 'not_connected', privateAlert: 'not_connected', phoneDelivery: 'unverified', preAcceptance: 'not_available'}});
export const propertyKey = v => str(v, 250).toLowerCase().replace(/\blane\b/g,'ln').replace(/\bavenue\b/g,'ave').replace(/\bstreet\b/g,'st').replace(/[^a-z0-9]/g,'');
function source(v, now) {
  if (!sources.includes(v.provider)) fail('Unknown source');
  if (v.account != null && !accounts.includes(v.account)) fail('Business mailbox required');
  return {provider:v.provider, account:v.account??null, messageId:str(v.messageId,300), originalMessageId:v.originalMessageId?str(v.originalMessageId,500):null,
    url:url(v.url), occurredAt:time(v.occurredAt,now), receivedAt:time(v.receivedAt,now)};
}
function identity(v) {
  const personId = v.personId == null ? null : positive(v.personId);
  if (personId && v.assignedUserId !== 33) fail('Contact is not assigned to Blaise');
  if (!personId && v.addressedToBlaise !== true) fail('Unassigned shared lead excluded');
  const c = {personId,assignedUserId:personId?33:null, buyerKey:str(v.buyerKey,300).toLowerCase(), name:str(v.name,160), addressedToBlaise:v.addressedToBlaise===true, recordUrl:personId?url(v.recordUrl):null};
  if (personId && !c.recordUrl.endsWith('/'+personId)) fail('Wrong FUB record link');
  return c;
}
const find = (s,p) => s.tours.find(t=>t.id===p.tourId) ?? fail('Unknown tour');
const latest = (events, type) => events.filter(type).sort((a,b)=>Date.parse(b.source.occurredAt)-Date.parse(a.source.occurredAt)||b.sequence-a.sequence)[0];
function derive(t) {
  const meaningful=t.events.filter(e=>e.kind!=='feedback');
  const booking=latest(meaningful,e=>['request','reschedule','confirmed','cancelled'].includes(e.kind));
  t.status=booking?.kind??'request';
  t.start=booking?.start??t.start;
  const req=latest(meaningful,e=>['request','reschedule','incoming'].includes(e.kind));
  const reply=latest(meaningful,e=>e.kind==='outgoing'&&e.contentVerified);
  const newMove=latest(meaningful,e=>e.kind==='reschedule'||e.kind==='incoming'&&e.contentVerified);
  // Copies of the same initial request have different message IDs and wording.
  // They enrich one action; only a new buyer move creates a new alert episode.
  t.requestEventId=newMove?(newMove.kind==='reschedule'?'reschedule:'+newMove.start:newMove.id):'request:'+t.episode;
  t.latestReply=reply?{at:reply.source.occurredAt,summary:reply.summary,url:reply.source.url}:null;
  t.response=t.status==='cancelled'?'retired':reply&&(!req||Date.parse(reply.source.occurredAt)>=Date.parse(req.source.occurredAt))?'waiting':'needs_review';
  const initial=t.events.filter(e=>['request','reschedule'].includes(e.kind)).sort((a,b)=>Date.parse(a.source.receivedAt)-Date.parse(b.source.receivedAt))[0];
  const firstReply=t.events.filter(e=>e.kind==='outgoing'&&(!initial||Date.parse(e.source.occurredAt)>=Date.parse(initial.source.receivedAt))).sort((a,b)=>Date.parse(a.source.occurredAt)-Date.parse(b.source.occurredAt))[0];
  t.metrics={firstSignalAt:initial?.source.receivedAt??null,firstVisibleReplyAt:firstReply?.source.occurredAt??null,
    firstVisibleReplySeconds:initial&&firstReply?Math.round((Date.parse(firstReply.source.occurredAt)-Date.parse(initial.source.receivedAt))/1000):null,
    firstReplyCoverage:'API-visible evidence only; earlier personal/app-only contact may exist',confirmedAt:latest(t.events,e=>e.kind==='confirmed')?.source.occurredAt??null};
  if(t.status==='cancelled'){t.review=null;if(t.handoff)t.handoff.status='retired';}
}
export function tourTransition(current,p,at=new Date().toISOString()) {
  const now=Date.parse(at); if(!Number.isFinite(now))fail('Invalid clock');
  if(p.mode!=null&&!['live','replay'].includes(p.mode))fail('Unknown tour mode');
  if(p.expectedRevision!==current.revision)fail('State changed; read and reconcile');
  const s=structuredClone(current);let result={ok:true,mayNotify:false,mayHandoff:false};
  if(p.action==='observe') {
    if(s.paused)fail('Tour lane paused');
    if(!kinds.includes(p.kind))fail('Unknown event kind');
    const src=source(p.source,now),who=identity(p.buyer),property=propertyKey(p.property),episode=str(p.episode,180);
    const aliases=(p.aliases??[]).map(a=>str(a,300));if(aliases.length>12)fail('Too many aliases');
    const deliveryKey=src.provider+':'+(src.account??'')+':'+src.messageId;
    const existingDelivery=s.deliveries.find(d=>d.key===deliveryKey);
    if(existingDelivery){result.duplicate=true;result.tourId=existingDelivery.tourId;}
    else {
      const candidates=s.tours.filter(t=>t.buyer.buyerKey===who.buyerKey&&t.propertyKey===property&&
        (t.id===p.tourId||t.episode===episode||aliases.some(a=>t.aliases.includes(a))));
      if(candidates.length>1)fail('Ambiguous tour; reconcile before merging');
      let t=candidates[0];
      if(p.tourId&&(!t||t.id!==p.tourId))fail('Tour identity mismatch');
      if(t?.buyer.personId&&who.personId&&t.buyer.personId!==who.personId)fail('Buyer identity changed');
      if(!t){
        if(['outgoing','incoming','feedback','cancelled'].includes(p.kind))fail('Resolve existing tour for conversation/feedback/cancellation');
        if(s.tours.length>=500)fail('Retention review required');
        t={id:'tour:'+String(s.revision+1),episode,buyer:who,property:str(p.property,250),propertyKey:property,aliases:[],start:null,events:[],version:0,review:null,handoff:null,notified:[],createdAt:at};s.tours.push(t);
      }
      if(who.personId)t.buyer=who;
      t.aliases=[...new Set([...t.aliases,...aliases])];
      // RFC Message-ID joins forwarded copies. Distinct sources are evidence on the same tour.
      const eventKey=src.originalMessageId??src.provider+':'+src.messageId;
      const duplicate=t.events.find(e=>e.id===eventKey);
      if(!duplicate){
        if(p.kind==='confirmed'&&(!['zillow','showingtime'].includes(src.provider)||p.appointmentVerified!==true))fail('Listing-side/Zillow booking source required');
        if(['confirmed','request','reschedule'].includes(p.kind)&&!p.start)fail('Exact requested/confirmed time required');
        if(p.start&&(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(p.start)||!Number.isFinite(Date.parse(p.start))))fail('Timezone-bearing start required');
        const e={id:eventKey,kind:p.kind,source:src,summary:str(p.summary),start:p.start??null,contentVerified:p.contentVerified===true,sequence:t.events.length+1};
        t.events.push(e);
        if(p.kind!=='feedback'){t.version++;t.review=null;if(t.handoff&&p.kind==='reschedule')t.handoff.status='retired';}
        derive(t);t.updatedAt=at;
      }
      s.deliveries.push({key:deliveryKey,tourId:t.id,eventKey});result={...result,tourId:t.id,duplicate:!!duplicate,status:t.status};
    }
  } else if(p.action==='reconcile') {
    const t=find(s,p); if(p.tourVersion!==t.version)fail('Tour changed during preparation');
    fresh(p.checkedAt,now);time(p.preparedAt,now);if(Date.parse(p.checkedAt)<Date.parse(p.preparedAt))fail('Final source recheck must follow draft preparation');
    if(!['owed','waiting','review','retired'].includes(p.response))fail('Invalid response state');
    if(t.status==='cancelled'&&p.response!=='retired')fail('Cancelled action stays retired');
    if(t.response==='waiting'&&p.response==='owed')fail('Later reply exists; observe a new inbound before reopening');
    if(p.response==='owed'&&(p.conversationComplete!==true||p.materialGap||!p.reply))fail('Resolve material conversation gap before ready reply');
    if(p.offersTime===true&&(!p.availability||p.availability.calendarChecked!==true||p.availability.amazonChecked!==true||p.availability.travelChecked!==true||!p.availability.evidenceUrls?.length))fail('Verify calendar, Amazon and travel before offering a time');
    t.response=p.response;
    t.review={version:t.version,checkedAt:p.checkedAt,preparedAt:p.preparedAt,response:p.response,summary:str(p.summary),reply:p.reply?str(p.reply,4000):null,channel:str(p.channel,100),conversationUrl:url(p.conversationUrl),materialGap:p.materialGap?str(p.materialGap,1500):null,
      evidenceUrls:(p.evidenceUrls??[]).map(url),actionKey:t.requestEventId??t.events[0].id,labelReceipt:p.labelReceipt??null};
    result.tourId=t.id;
  } else if(p.action==='claim_alert') {
    if(s.paused)fail('Tour lane paused');const t=find(s,p),r=t.review;
    if(!r||r.version!==t.version)fail('Fresh reconciliation required');fresh(r.checkedAt,now);
    if(!['owed','review'].includes(t.response)||t.status==='cancelled')fail('No action owed');
    if(p.mode!=='replay'&&!['configured','connected'].includes(s.coverage.privateAlert))fail('Private alert delivery not connected');
    const key=(p.mode==='replay'?'replay:':'live:')+r.actionKey;
    if(!t.notified.some(n=>n.key===key)){t.notified.push({key,at,status:'claimed',deliveryReceipt:null});result.mayNotify=true;}
    result.alert={tourId:t.id,key,buyer:t.buyer.name,property:t.property,start:t.start,summary:r.summary,reply:r.reply,channel:r.channel,conversationUrl:r.conversationUrl,recordUrl:t.buyer.recordUrl};
  } else if(p.action==='alert_receipt') {
    const t=find(s,p),n=t.notified.find(n=>n.key===p.key);if(!n)fail('Claim required');
    n.deliveryReceipt={url:url(p.url),checkedAt:time(p.checkedAt,now),detail:str(p.detail)};n.status='verified_surface';
    // Surface readback is not proof of phone push delivery.
  } else if(p.action==='handoff') {
    if(s.paused)fail('Tour lane paused');
    const t=find(s,p);fresh(p.checkedAt,now);
    if(p.tourVersion!==t.version||t.status!=='confirmed'||t.response!=='waiting'||!t.buyer.personId)fail('Confirmed appointment and contacted exact buyer required');
    const key=t.id+':'+t.start;
    if(!t.handoff||t.handoff.key!==key){t.handoff={key,status:'prepared',buyer:t.buyer,property:t.property,start:t.start,sourceUrls:t.events.filter(e=>e.kind==='confirmed').map(e=>e.source.url),workbenchUrl:p.workbenchUrl?url(p.workbenchUrl):null,preparedAt:at,receipt:null};result.mayHandoff=true;}
    result.handoff=t.handoff;
  } else if(p.action==='handoff_receipt') {
    const t=find(s,p);if(!t.handoff||t.handoff.status==='retired')fail('No active handoff');
    t.handoff.receipt={url:url(p.url),checkedAt:time(p.checkedAt,now),detail:str(p.detail)};t.handoff.status='delivered';
  } else if(p.action==='checkpoint') {
    if(!accounts.includes(p.account)||p.complete!==true)fail('Complete business mailbox interval required');
    time(p.through,now);if(s.cursors[p.account]&&Date.parse(p.through)<Date.parse(s.cursors[p.account].through))fail('Cursor regression');
    s.cursors[p.account]={through:p.through,historyId:p.historyId??null};
  } else if(p.action==='activation_receipt') {
    if(p.mode==='replay')fail('Activation requires actual saved task evidence');
    if(p.trigger!=='gmail.message_added'||p.account!==accounts[0])fail('Gmail message added in the team mailbox required');
    fresh(p.checkedAt,now);
    s.activation={taskId:str(p.taskId,250),taskUrl:url(p.taskUrl),trigger:p.trigger,account:p.account,filter:str(p.filter,2000),privateAlertUrl:url(p.privateAlertUrl),checkedAt:p.checkedAt};
    s.coverage.arrivalHook='configured';s.coverage.agentWakeup='configured';s.coverage.privateAlert='configured';
  } else if(p.action==='run_receipt') {
    if(!['manual','replay','gmail_push'].includes(p.execution))fail('Actual execution provenance required');
    if(p.execution==='gmail_push'){
      if(p.mode==='replay'||!s.activation||!p.triggerEventId)fail('Live arrival and wakeup receipts required');
      const event=s.tours.flatMap(t=>t.events).find(e=>e.id===p.triggerEventId||e.source.messageId===p.triggerEventId);
      if(!event||event.source.account!==s.activation.account)fail('Exact incoming team-mailbox event required');
      fresh(p.checkedAt,now);time(p.startedAt,now);
      if(Date.parse(p.startedAt)<Date.parse(event.source.receivedAt))fail('Arrival must precede task wakeup');
      s.coverage.arrivalHook='connected';s.coverage.agentWakeup='connected';
    }
    s.lastRun={execution:p.execution,triggerEventId:p.triggerEventId??null,startedAt:p.startedAt??null,at,summary:str(p.summary),evidenceUrl:url(p.evidenceUrl)};
    s.runs=[...(s.runs??[]),s.lastRun].slice(-100);
  } else if(p.action==='pause') {s.paused=p.paused===true;
  } else fail('Unknown tour command');
  s.revision++;return {state:s,result:{...result,revision:s.revision}};
}
export function morningTourActions(s){return s.tours.filter(t=>['owed','review','needs_review'].includes(t.response)&&t.status!=='cancelled').map(t=>({tourId:t.id,personId:t.buyer.personId,name:t.buyer.name,property:t.property,start:t.start,response:t.response,summary:t.review?.summary??'Reconcile latest conversation',eventIds:t.events.map(e=>e.id)}));}
export async function readTours(db,mode='live'){const row=await db.prepare('SELECT payload FROM zillow_tours WHERE id=?').bind(mode==='replay'?2:1).first();return row?JSON.parse(row.payload):initialTours();}
export async function commandTours(db,p,at=new Date().toISOString()){
  const rowId=p.mode==='replay'?2:1,current=await readTours(db,p.mode),{state,result}=tourTransition(current,p,at);
  const q=current.revision===0?db.prepare('INSERT OR IGNORE INTO zillow_tours(id,revision,payload) VALUES(?,?,?)').bind(rowId,state.revision,JSON.stringify(state)):db.prepare('UPDATE zillow_tours SET revision=?,payload=? WHERE id=? AND revision=?').bind(state.revision,JSON.stringify(state),rowId,current.revision);
  const saved=await q.run();if(saved.meta.changes!==1)fail('Concurrent change; reread before retry');return result;
}
