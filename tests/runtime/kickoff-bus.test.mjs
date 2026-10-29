import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initialState,transition,commandBus,readBus} from '../../runtime/kickoff-bus.mjs';
const at='2026-10-29T22:00:00Z',sha='a'.repeat(64);
function start(execution='interactive'){
 let s=initialState();const go=p=>{const r=transition(s,p,at);s=r.state;return r.result;};
 go({action:'control',paused:false});go({action:'observe',eventKey:'gmail:synthetic:123',sourceUrl:'https://example.test/event',observedAt:at});
 const claim={action:'claim',caseKey:'fub:1:deal:2',personId:1,dealId:2,assignedUserId:33,propertyKey:'synthetic-property',runId:'run-one',eventKey:'gmail:synthetic:123',execution};
 const c=go(claim).case;const lease={caseKey:claim.caseKey,runId:claim.runId,fence:c.fence};
 const verify={action:'verify',...lease,packageKey:sha,method:'source_read',verifier:'Synthetic test only',checkedAt:at,documents:[{url:'https://example.test/synthetic',sha256:sha,version:'synthetic-v1',coverage:'Synthetic complete execution evidence'}],partiesAndProperty:true,completeChronology:true,signaturesInitialsDates:true,acceptanceDelivery:true,controllingTerms:true};
 return {go,state:()=>s,claim,lease,verify};
}
test('duplicate delivery, restart, and lost response cannot grant a second source write',()=>{
 const x=start();x.go(x.verify);const p={action:'begin_effect',...x.lease,kind:'drive_packet',semanticKey:'initial-packet',target:'existing-private-folder',intentHash:sha};
 assert.equal(x.go(p).mayExecute,true);
 const restored=JSON.parse(JSON.stringify(x.state()));
 assert.equal(transition(restored,p,at).result.mayExecute,false);
 const first=x.state().effects;x.go({action:'observe',eventKey:'gmail:synthetic:forward',sourceUrl:'https://example.test/forward',observedAt:at});x.go({...x.claim,eventKey:'gmail:synthetic:forward'});
 assert.equal(Object.keys(x.state().cases).length,1);assert.deepEqual(x.state().effects,first);
 assert.throws(()=>x.go({...p,intentHash:'b'.repeat(64),fence:2}),/differs/);
 assert.throws(()=>x.go({action:'progress',...x.lease,fence:2,state:'COMPLETED',summary:'done',nextOwner:'Blaise',nextAction:'review',nextCheck:null,contextUrl:'https://example.test/context',reviewUrl:null}),/Uncertain/);
});
test('readback adopts an uncertain committed result; unsigned updates cannot replace source',()=>{
 const x=start();x.go(x.verify);const effect=x.go({action:'begin_effect',...x.lease,kind:'fub_note',semanticKey:'acceptance-source',target:'person:1',intentHash:sha});
 x.go({action:'receipt',...x.lease,effectKey:effect.effectKey,intentHash:sha,recordId:'note-123',sourceUrl:'https://example.test/note-123',checkedAt:at,matchedFields:'Exact intended source link and material outcome reread'});
 assert.equal(x.state().effects[effect.effectKey].status,'VERIFIED');
 assert.throws(()=>x.go({...x.verify,packageKey:'b'.repeat(64),signaturesInitialsDates:false}),/Unverified/);
 assert.equal(x.state().cases[x.lease.caseKey].packageKey,sha);
 x.go({...x.verify,packageKey:'b'.repeat(64)});assert.equal(Object.keys(x.state().cases).length,1);
});
test('expired fencing, pause, wrong owner, replay and outbound effects are blocked',()=>{
 const x=start();assert.throws(()=>x.go({...x.claim,assignedUserId:5}),/owner33/);x.go(x.verify);
 assert.throws(()=>x.go({action:'begin_effect',...x.lease,kind:'send_email'}),/outside/);
 assert.throws(()=>transition(x.state(),x.verify,'2026-10-29T22:31:00Z'),/Lease/);
 x.go({action:'control',paused:true});assert.throws(()=>x.go(x.verify),/paused/);
 x.go({action:'control',paused:false});assert.throws(()=>x.go(x.verify),/Lease/);
 const r=start('replay');r.go(r.verify);assert.throws(()=>r.go({action:'begin_effect',...r.lease,kind:'drive_packet'}),/Replay/);
});
test('persistent CAS rejects concurrent changes and survives a fresh adapter instance',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE operations_bus(id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)');
 const adapter=()=>({prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return sqlite.prepare(sql).get(...values);},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};}});
 await commandBus(adapter(),{action:'control',paused:false,expectedRevision:0},at);
 await assert.rejects(commandBus(adapter(),{action:'control',paused:true,expectedRevision:0},at),/State changed/);
 assert.equal((await readBus(adapter())).paused,false);assert.equal((await readBus(adapter())).revision,1);sqlite.close();
});
