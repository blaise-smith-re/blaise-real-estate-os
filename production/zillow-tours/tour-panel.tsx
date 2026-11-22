"use client";
import {useEffect,useState} from 'react';
type Row=Record<string,any>;
const stamp=(v:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(v));
export default function TourPanel(){
 const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState('');
 async function reload(){try{const r=await fetch('/api/zillow-tours',{cache:'no-store'}),v=await r.json() as Row;if(!r.ok)throw Error();setData(v);setError('');}catch{setError('Tour state could not be refreshed. Retained actions may be stale.');}}
 useEffect(()=>{reload();},[]);
 const s=data?.state,items=s?.tours??[],replay=data?.replay;
 const copy=async(t:Row)=>{try{await navigator.clipboard.writeText(t.review.reply);setCopied(t.id);}catch{setError('Select the reply text to copy it.');}};
 return <section className="panel" id="zillow-tours" style={{marginBottom:24,padding:24}} aria-label="Zillow tour actions">
  <div style={{display:'flex',justifyContent:'space-between',gap:16}}><div><div className="eyebrow">ZILLOW TOURS</div><h2>One tour. One next move.</h2></div><button className="button secondary" onClick={reload}>Refresh tours</button></div>
  <p>{s?.coverage.arrivalHook==='connected'?'A Gmail arrival and task wakeup have been observed.':s?.coverage.arrivalHook==='configured'?'Arrival trigger configured; first delivery is not yet verified.':'Arrival-triggered triage is not connected yet.'} Morning Desk is requested for 7:15 a.m. Central; check its schedule receipt for the saved time.</p>
  {error&&<p role="alert">{error}</p>}
  {!items.length&&<p className="subtle">No live tour action has been saved. This does not mean no request has arrived.</p>}
  {s?.lastRun&&<p>Last work: {s.lastRun.execution} · {stamp(s.lastRun.at)} · {s.lastRun.summary} <a href={s.lastRun.evidenceUrl}>Run evidence ↗</a></p>}
  {items.map((t:Row)=><article key={t.id} style={{borderTop:'1px solid #ddd',padding:'18px 0'}}>
   <strong>{t.buyer.name} · {t.property} · {t.start?stamp(t.start):'Time needs verification'}</strong>
   <p>{t.status==='cancelled'?'Cancelled · action retired':t.review?.summary??`${t.status} · ${t.response.replaceAll('_',' ')}`}</p>
   {t.review?.reply&&t.status!=='cancelled'&&<><blockquote style={{whiteSpace:'pre-wrap'}}>{t.review.reply}</blockquote><button className="button secondary" onClick={()=>copy(t)} disabled={Date.now()-Date.parse(t.review.checkedAt)>120000}>{copied===t.id?'Copied':'Copy reply'}</button><small> {t.review.channel} · Recheck the conversation before sending.</small></>}
   <p><a href={t.review?.conversationUrl??t.events[0].source.url} target="_blank" rel="noreferrer">Original conversation ↗</a>{t.buyer.recordUrl&&<> · <a href={t.buyer.recordUrl} target="_blank" rel="noreferrer">Exact FUB buyer ↗</a></>}</p>
   {t.handoff&&<p>Showing prep: {t.handoff.status}{t.handoff.workbenchUrl&&<> · <a href={t.handoff.workbenchUrl} target="_blank" rel="noreferrer">Buyer Workbench ↗</a></>}</p>}
   <details><summary>What started this work</summary>{t.events.map((e:Row)=><p key={e.id}><a href={e.source.url} target="_blank" rel="noreferrer">{stamp(e.source.receivedAt)} · {e.kind}</a> — {e.summary}</p>)}<p>First visible reply: {t.metrics.firstVisibleReplySeconds===null?'Unknown':`${t.metrics.firstVisibleReplySeconds} seconds after the first visible signal`}. Earlier personal/app-only contact may exist.</p></details>
  </article>)}
  {replay?.lastRun&&<details><summary>Private replay evidence</summary><p>{replay.lastRun.summary}</p><p>Replay only. No mailbox arrival, phone notification or live prep execution is implied.</p>{replay.tours.map((t:Row)=><p key={t.id}>{t.buyer.name} · {t.property} · {t.status} · {t.notified.length} alert claim(s) · prep {t.handoff?.status??'not started'} · first visible reply {t.metrics.firstVisibleReplySeconds??'unknown'} seconds.</p>)}</details>}
 </section>;
}
