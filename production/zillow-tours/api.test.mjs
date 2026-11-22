// Isolated LOCAL Worker only; never replace origin with a production Site.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
const read=async()=>await(await fetch(origin+'/api/zillow-tours')).json();
const post=async(p,headers={})=>{for(let i=0;i<2;i++){const r=await fetch(origin+'/api/zillow-tours',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(p)});if(i===0&&r.status===503&&(await r.clone().text()).includes('worker restarted'))continue;return r;}};
test('D1 tour command persists one replay, fences concurrent writers, isolates live state and origin',async()=>{
 const before=await read(),at=new Date().toISOString();
 const p={mode:'replay',action:'observe',expectedRevision:before.replay.revision,kind:'request',episode:'synthetic-api',buyer:{personId:1,assignedUserId:33,buyerKey:'local@example.invalid',name:'Synthetic API Buyer',recordUrl:'https://example.test/1'},property:'100 Example Ln',start:'2026-11-23T14:00:00-06:00',source:{provider:'zillow',account:'blaise@buysellhometeam.com',messageId:'local-request',url:'https://example.test/email/1',occurredAt:at,receivedAt:at},summary:'Synthetic local API request'};
 assert.equal((await post(p,{Origin:'https://untrusted.example'})).status,403);
 assert.equal((await post(p)).status,200);
 assert.equal((await post(p)).status,409);
 const saved=await read();assert.deepEqual(saved.state,before.state);assert.equal(saved.replay.tours.length,1);
 const dup=await post({...p,expectedRevision:saved.replay.revision});assert.equal((await dup.json()).duplicate,true);
 const unauth=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'zillow_tours_read'}})});assert.equal(unauth.status,401);
 const auth=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'synthetic-local-owner'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'zillow_tours_read'}})});assert.equal(auth.status,200);assert.equal((await auth.json()).result.structuredContent.replay.tours.length,1);
});
