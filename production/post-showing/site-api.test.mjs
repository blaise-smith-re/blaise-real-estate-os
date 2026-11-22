// Local Worker only. Never use production origin for unauthenticated identity fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fictionalRecap,fictionalAnswer} from './replay.mjs';
const origin='http://127.0.0.1:5173';
const read=async()=>{const r=await fetch(origin+'/api/post-showing');assert.equal(r.status,200);return r.json();};
const post=async(p,headers={})=>fetch(origin+'/api/post-showing',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(p)});
test('deployed API persists isolated replay, rejects origin/conflicts, and exposes authenticated MCP',async()=>{
 const before=await read(),p={...fictionalRecap(),expectedRevision:before.replay.revision};
 assert.equal((await post(p,{Origin:'https://untrusted.example'})).status,403);
 const saved=await post(p);assert.equal(saved.status,200);const result=await saved.json();
 const after=await read();assert.deepEqual(after.state,before.state);assert.equal(after.replay.cases.length,1);
 const duplicate=await post({...p,expectedRevision:after.replay.revision});assert.equal((await duplicate.json()).duplicate,true);
 assert.equal((await post({...p,expectedRevision:-1})).status,409);
 const answer=fictionalAnswer(result.caseId,result.promiseIds[0]);const answerResponse=await post({...answer,expectedRevision:(await read()).replay.revision});assert.equal(answerResponse.status,200);
 const final=await read();assert.equal(final.replay.cases[0].promises[0].status,'buyer_reply_ready');assert.equal(final.replay.cases[0].promises.length,1);
 const rpc={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'post_showing_read'}};
 assert.equal((await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rpc)})).status,401);
 const auth=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'local-synthetic-owner'},body:JSON.stringify(rpc)});assert.equal(auth.status,200);assert.equal((await auth.json()).result.structuredContent.replay.cases.length,1);
 const page=await fetch(origin+'/showing-follow-up');assert.equal(page.status,200);assert.match(await page.text(),/After the showing/);
});
