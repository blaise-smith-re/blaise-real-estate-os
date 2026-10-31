// Synthetic acceptance ONLY on local Worker. No configurable live destination.
import test from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
test('hosted routing, actual D1 resume, skip/revise/sent, uncertain recovery and MCP auth',async()=>{
 const read=async()=> (await(await fetch(base+'/api/daily-follow-up')).json()).state;
 const at=new Date().toISOString(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const sourceKey='synthetic'+Date.now();
 const c={id:`fub:1:${sourceKey}`,sourceKey,personId:1,assignedUserId:33,name:'Synthetic only',phone:'5550101234',phoneSource:'https://example.test/1',recordUrl:'https://example.test/1',reason:'Synthetic fixture',draft:'Synthetic draft',channel:'sms',recipient:'5550101234',readiness:'ready',permission:'Fixture only',coverage:'No real clients',materialGap:false,nextAction:'Synthetic',checkedAt:at,references:[]};
 const command=async p=>{const s=await read();const r=await fetch(base+'/api/daily-follow-up',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:s.revision,...p})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;};
 await command({action:'refresh',items:[c],discovery:{assignedUserId:33,checkedAt:at,discovered:1,complete:true,sourceRunId:'local-synthetic',coverage:'Synthetic local fixture only'}});
 await command({action:'present',itemId:c.id,item:c});
 assert.equal((await read()).currentId,c.id);
 const before=(await read()).events.length;
 await command({action:'skip',itemId:c.id,reason:'Synthetic skip'});assert.equal((await read()).events.length,before);
 await command({action:'present',itemId:c.id,item:c});await command({action:'revise',itemId:c.id,draft:'Revised synthetic'});
 await command({action:'present',itemId:c.id,item:{...c,draft:'Revised synthetic'}});
 const version=(await read()).queue[0].draftVersion;
 const confirm={action:'confirm',itemId:c.id,direction:'outgoing',confirmedBy:'Blaise',channel:'sms',recipient:c.phone,message:'Revised synthetic',occurredOn:day,provenance:'Synthetic fixture, no real send',draftVersion:version};
 const e=(await command(confirm)).event;assert.equal((await command(confirm)).duplicate,true);
 const effect={action:'begin_effect',eventId:e.id,kind:'fub_note',personId:1,assignedUserId:33,checkedAt:new Date().toISOString(),intent:'Synthetic no-op adapter; never call FUB'};
 assert.equal((await command(effect)).mayExecute,true);assert.equal((await command(effect)).mayExecute,false);
 assert.equal((await read()).effects.find(x=>x.eventId===e.id).status,'uncertain');
 const rpc=async(method,params={},identity=false)=>(await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',...(identity?{'oai-authenticated-user-id':'synthetic-local-owner'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
 const listed=await(await rpc('tools/list')).json();assert(listed.result.tools.some(x=>x.name==='daily_follow_up_command'));
 assert.equal((await rpc('tools/call',{name:'daily_follow_up_read'})).status,401);
 const contract=await(await rpc('tools/call',{name:'morning_desk_get_contract'},true)).json();assert.equal(contract.result.structuredContent.dailyFollowUp.revision,'2026-10-31.1');
 const resumed=await(await rpc('tools/call',{name:'daily_follow_up_read'},true)).json();assert.equal(resumed.result.structuredContent.state.currentId,c.id);
});
