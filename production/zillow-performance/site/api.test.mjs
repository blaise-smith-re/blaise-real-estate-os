// Fictional fixture, isolated localhost D1 only. Never point at the production Site.
import test from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
test('private assessment writer is repeatable, immutable, owner-scoped and preserves last good report',async()=>{
 const r={schemaVersion:1,assignedUserId:33,runId:'local_zillow_'+Date.now(),asOf:new Date().toISOString(),execution:'interactive',coverage:{detail:'Private fictional replay'},standing:{detail:'Unknown'},recommendation:{action:'Fixture'},targets:[],sources:[],records:[]};
 const send=(v,origin)=>fetch(base+'/api/zillow-performance',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(v)});
 assert.equal((await send(r)).status,200);
 assert.equal((await send(r)).status,200);
 assert.equal((await send({...r,standing:{detail:'Conflicting same id'}})).status,409);
 assert.equal((await send({...r,runId:r.runId+'_wrong',assignedUserId:34})).status,409);
 assert.equal((await send(r,'https://untrusted.example')).status,403);
 const saved=await(await fetch(base+'/api/zillow-performance')).json();assert.equal(saved.report.runId,r.runId);assert.equal(saved.report.standing.detail,'Unknown');
 const contract=await(await fetch(base+'/api/updater')).json();assert.equal(contract.zillowPerformance.assignedUserId,33);
 const rpc=(method,params={})=>fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const listed=await(await rpc('tools/list')).json();assert(listed.result.tools.some(t=>t.name==='zillow_performance_read'));assert(listed.result.tools.some(t=>t.name==='zillow_performance_save'));
 assert.equal((await rpc('tools/call',{name:'zillow_performance_read'})).status,401);
 assert.equal((await fetch(base+'/zillow-performance')).status,200);
 const home=await(await fetch(base+'/')).text();assert(home.includes('/zillow-performance'));
});
