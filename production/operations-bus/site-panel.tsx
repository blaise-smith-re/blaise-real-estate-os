'use client';
import {useEffect,useState} from 'react';
export default function KickoffPanel(){
 const [state,setState]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function read(){try{const r=await fetch('/api/operations-bus',{cache:'no-store'});const d=await r.json() as any;if(!r.ok)throw Error();setState(d.state);setError('');}catch{setError('Kickoff progress unavailable. Retained source records still control.');}}
 useEffect(()=>{read();},[]);
 async function toggle(){setBusy(true);try{const r=await fetch('/api/operations-bus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'control',paused:!state.paused,expectedRevision:state.revision})});if(!r.ok)throw Error();await read();}catch{setError('Control response uncertain. Reload progress before trying again.');await read();}finally{setBusy(false);}}
 const cases=Object.entries(state?.cases??{}) as [string,any][];
 const unbound=Object.values(state?.events??{}).filter((e:any)=>e.disposition==='REVIEW').length;
 return <section className="panel" aria-label="Transaction kickoff" style={{marginBottom:24}}>
  <div className="draft-heading"><h2>Transaction kickoff</h2><button className="button secondary" disabled={!state||busy} onClick={toggle}>{state?.paused?'Resume kickoff':'Pause kickoff'}</button></div>
  <p>{state?(state.paused?'Paused. Saved work is retained.':'Enabled for the existing daily Morning Desk run at 8:30 AM Central.'):'Loading saved progress…'} Outbound messages stay drafts.</p>
  <p className="subtle">New contracts are detected on the next daily run, not instantly. A pause stops new kickoff steps; an in-flight source request may still finish and need reconciliation.</p>
  {error&&<p role="alert">{error}</p>}
  {state?.lastRun?<p><b>Last kickoff result:</b> {state.lastRun.summary} <a href={state.lastRun.evidenceUrl} target="_blank" rel="noreferrer">Review evidence ↗</a> <span className="subtle">({state.lastRun.execution}; {state.lastRun.at})</span></p>:<p>No kickoff run verified yet. Enabling a workflow alone does not prove unattended delivery.</p>}
  {unbound>0&&<p><b>{unbound} candidate signal(s)</b> need identity or source verification.</p>}
  {Object.values(state?.effects??{}).some((e:any)=>e.status==='UNCERTAIN')&&<p role="alert"><b>Uncertain source write:</b> reconcile the original destination before any retry. Independent preparation can continue.</p>}
  {cases.map(([id,c])=><article key={id} style={{borderTop:'1px solid #e4e4e4',paddingTop:12,marginTop:12}}>
   <strong>{c.state}{c.execution==='replay'?' · SYNTHETIC REPLAY':''}</strong><p>{c.summary}</p>
   <p><b>{c.nextOwner}:</b> {c.nextAction}{c.nextCheck?` · Recheck ${c.nextCheck}`:''}</p>
   {c.contextUrl&&<a href={c.contextUrl} target="_blank" rel="noreferrer">Transaction context ↗</a>}{c.reviewUrl&&<> · <a href={c.reviewUrl} target="_blank" rel="noreferrer">Drafts & decisions ↗</a></>}
  </article>)}
  <button className="button secondary" onClick={read} style={{marginTop:12}}>Reload kickoff progress</button>
 </section>;
}
