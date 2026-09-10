'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildBoard}=require('../engine'); const {fixture,NOW}=require('./fixtures');
const {Evidence}=require('../evidence'); const {CHECKS,contactGate}=require('../gates');
const {opportunityDetail}=require('../detail'); const {boundedLookup,lookupRequest,handoff}=require('../relationship');
const {research,publicObservation,mlsObservation}=require('../adapters'); const {summarizeOutcomes}=require('../outcomes');
const {outputDir}=require('../cli'); const {boardHtml}=require('../presentation');
const {ZERO_EFFECTS}=require('../../../runtime/contract');
function board(p=fixture(),opts={}){return buildBoard(p,{now:NOW,synthetic:true,...opts});}
test('all three lanes yield attributed, transparent, held opportunities',()=>{for(const l of ['seller','open-house','professional']){const b=board(fixture(l));assert.equal(b.candidates.length,1);assert.ok(b.candidates[0].reason_for_priority.length>=7);assert.equal(b.candidates[0].contact_eligibility.state,'HOLD-VERIFY');assert.deepEqual(b.effects,ZERO_EFFECTS);}});
test('synthetic data cannot enter live board',()=>{const p=fixture();p.mode='live-research';assert.throws(()=>buildBoard(p,{now:NOW}),/Synthetic/);});
test('unpermitted and nonexistent claim sources cannot surface',()=>{for(const s of ['restricted','unverified']){const p=fixture();p.sources[0].permission.state=s;assert.equal(board(p).candidates.length,0);}const p=fixture();p.candidates[0].facts[0].source='missing';assert.equal(board(p).candidates.length,0);});
test('inferred evidence cannot silently become verified',()=>{const p=fixture();p.candidates[0].facts[0].state='verified';assert.equal(board(p).candidates.length,0);p.candidates[0].facts[0].state='inferred';assert.equal(board(p).candidates.length,0);});
test('invented quotes and future observations fail',()=>{let p=fixture();p.candidates[0].facts[0].quote='fabricated';assert.equal(board(p).candidates.length,0);p=fixture();p.sources[0].observed_at='2027-01-01T00:00:00Z';assert.throws(()=>board(p),/timestamp/);});
test('old crawl time cannot be laundered through new retrieval time',()=>{const p=fixture();p.sources[0].observed_at='2026-08-01T00:00:00Z';const b=board(p);assert.equal(b.candidates.length,0);assert.match(b.rejected[0].reason,/Stale/);});
test('meaningful-event age changes ranking; reading today does not refresh intent',()=>{const p=fixture();const high=board(p).candidates[0].final_priority;p.candidates[0].latest_meaningful_event.kind='current-observation';assert.ok(board(p).candidates[0].final_priority<high);p.candidates[0].latest_meaningful_event={description:'Undated',kind:'undated',refs:['event']};assert.equal(board(p).candidates[0].score_components.recency.value,0);});
test('exact duplicates collapse, punctuation normalizes, units remain distinct',()=>{const p=fixture();p.candidates.push(structuredClone(p.candidates[0]));p.candidates[1].target_key=p.candidates[0].target_key.toUpperCase()+'!';assert.equal(board(p).candidates.length,1);p.candidates[1].target_key+=' Unit B';assert.equal(board(p).candidates.length,2);});
test('adverse duplicate is considered before filtering and suppresses original',()=>{for(const adverse of ['sold','active']){const p=fixture();const x=structuredClone(p.candidates[0]);x.current_status.value=adverse;x.facts.find(f=>f.id==='status').value=adverse;p.candidates.push(x);const b=board(p);assert.equal(b.candidates.length,0);assert.match(b.rejected[0].reason,/Conflicting/);}});
test('relisted seller, source conflict, and do-not-contact never rank',()=>{for(const mutate of [c=>c.current_status.value='active',c=>c.conflicts=['relist'],c=>c.contact_review={do_not_contact:true}]){const p=fixture();mutate(p.candidates[0]);assert.equal(board(p).candidates.length,0);}});
test('weak candidates do not fill five slots; off-market geography excluded',()=>{const p=fixture();for(const a of Object.values(p.candidates[0].assessments))a.value=0;assert.equal(board(p).candidates.length,0);const q=fixture();q.request.geography=[{city:'Madison',state:'WI'}];assert.equal(board(q).candidates.length,0);});
test('caller geography overrides default and weighted score remains explainable',()=>{const p=fixture();p.request.geography=[{city:'Woodbury',state:'MN'}];const c=board(p).candidates[0];assert.equal(c.final_priority,Object.values(c.score_components).reduce((s,x)=>s+x.points,0)-c.penalties.reduce((s,x)=>s+x.points,0));p.request.weights={unknown:1};assert.equal(board(p).candidates.length,0);});
test('sensitive fields rejected, no protected weighting component accepted',()=>{const p=fixture();p.candidates[0].race='x';assert.throws(()=>board(p),/sensitive/);});
test('contact eligibility needs exact current full review; public contact does not suffice',()=>{const p=fixture();const c=p.candidates[0];c.unknowns=[];c.contact_review={target_key:c.target_key,reviewer:'Test',channel:'email',identity:'Fictional Approved Identity',reviewed_at:NOW,expires_at:'2026-09-10T18:00:00Z',checks:Object.fromEntries(CHECKS.map(k=>[k,{state:'pass',reason:'Fictional approved check',evidence:{...c.facts[0],field:'contact_gate.'+k,target_key:c.target_key,channel:'email',state:'verified',verification_scope:'authorized-record'}}]))};const e=new Evidence(p.sources,NOW,true);assert.equal(contactGate(c,e).state,'ELIGIBLE');assert.equal(contactGate(c,e).executable,false);for(const key of CHECKS){const x=structuredClone(c);delete x.contact_review.checks[key];assert.equal(contactGate(x,e).state,'HOLD-VERIFY');}c.contact_review.target_key='other';assert.equal(contactGate(c,e).state,'HOLD-VERIFY');});
test('detail pins target to original board and withdraws changed status',()=>{const p=fixture(),b=board(p);assert.equal(opportunityDetail(b,1,{now:NOW}).freshness,'REQUIRED');p.candidates[0].current_status.value='sold';const d=opportunityDetail(b,1,{now:NOW,freshPack:p});assert.match(d.state,/no longer qualifies/);assert.equal(d.opener,null);});
test('selected detail returns opener and only 2–4 discovery points, no external effect',()=>{const p=fixture(),d=opportunityDetail(board(p),1,{now:NOW,freshPack:p});assert.ok(d.opener);assert.equal(d.discovery.length,2);assert.equal(d.external_effects,false);assert.match(d.state,/HOLD/);});
test('bounded FUB lookup uses existing read adapter with exact shortlist name',async()=>{const b=board(),c=b.candidates[0],calls=[];const r=await boundedLookup(b,c.candidate_id,{name:c.display_name,fact_id:'identity'},{availableTools:['mcp__blaise_fub_read_only__find_contact'],invokeTool:async(name,args)=>{calls.push({name,args});return {contacts:[]};}});assert.equal(calls.length,1);assert.equal(calls[0].args.limit,3);assert.equal(calls[0].args.name,c.display_name);assert.match(r.state,/REQUIRES-IDENTITY/);assert.throws(()=>lookupRequest(b,'other',{name:'x',fact_id:'identity'}),/shortlist/);});
test('selection creates only a handoff proposal; no automatic FUB contact',()=>{const c=board().candidates[0];assert.throws(()=>handoff(c,{}),/selection/);assert.equal(handoff(c,{selected_by:'Blaise',candidate_id:c.candidate_id,selected_at:NOW}).requested_effect,'NONE — proposal only');});
test('source callbacks isolate unavailable lanes and reject write effects',async()=>{const r=await research({}, {governance:fixture().governance,now:()=>NOW,researchLane:async plan=>{if(plan.lane==='seller')throw new Error('MLS authentication required');if(plan.lane==='open-house')return {effects:{...ZERO_EFFECTS,external_messages:1},sources:[],candidates:[]};const p=fixture('professional');p.sources[0].access='public-web';return {...p,effects:ZERO_EFFECTS};}});assert.equal(r.board.candidates.length,1);assert.equal(r.board.coverage.filter(c=>c.attempt_status==='BLOCKED').length,2);});
test('MLS adapter requires observed criteria and never accepts direct API',()=>{const p=fixture();assert.throws(()=>mlsObservation({source:p.sources[0],candidates:p.candidates}),/criteria/);assert.throws(()=>mlsObservation({source:{...p.sources[0],access:'public-api'},candidates:p.candidates,criteria:{}}),/Direct MLS/);p.sources[0].permission.state='unverified';assert.throws(()=>publicObservation({source:p.sources[0],candidates:p.candidates}),/permission/);});
test('outcomes deduplicate actual events without fabricating funnel steps',()=>{const e={stage:'closing',candidate_id:'c',lane:'seller',geography:'Woodbury MN',signal_type:'fsbo',value_angle:'launch',source_name:'test',occurred_at:NOW,evidence:{locator:'https://example.com/closing',record_id:'1',system:'transaction-original',verified_by:'Test',verified_at:NOW,classification:'verified'}};const r=summarizeOutcomes([e,e]);assert.deepEqual(r.groups[0].counts,{closing:1});e.evidence.classification='reported';assert.throws(()=>summarizeOutcomes([e]),/assumed/);});
test('HTML escapes untrusted content, has no executable scripts or contact forms',()=>{const p=fixture();p.candidates[0].prep.opener='<script>alert(1)</script>';const html=boardHtml(board(p));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<form'));});
test('live outputs cannot be written to repository',()=>assert.throws(()=>outputDir(require('node:path').resolve(__dirname,'..')),/outside/));
test('repeat input produces stable ranking and candidate IDs',()=>assert.deepEqual(board(),board()));

test('cross-lane contact overlap collapses pursuit without inventing property status conflict',()=>{
  const p=fixture('professional',1),q=fixture('open-house',2);
  p.sources.push(...q.sources);p.candidates.push(...q.candidates);
  for(const c of p.candidates)c.pursuit_key='Fictional shared professional';
  const b=board(p);assert.equal(b.candidates.length,1);assert.match(b.rejected[0].reason,/Shared professional pursuit/);
  p.candidates[0].contact_review={do_not_contact:true};assert.equal(board(p).candidates.length,0);
});

test('malformed adverse identity cannot be discarded to rescue the good duplicate',()=>{
  const p=fixture();const bad=structuredClone(p.candidates[0]);bad.current_status.value='sold';p.candidates.push(bad);
  assert.equal(board(p).candidates.length,0);assert.ok(board(p).rejected.some(r=>/Matching source record/.test(r.reason)));
});

test('governing retrieval rejects wrong identity, retirement and stale attestations',()=>{
  const {verifyGovernance}=require('../governance');
  for(const edit of [s=>s.file_id='other',s=>s.title='RETIRED old source',s=>s.retrieved_at='2026-09-08T17:00:00Z']){
    const p=fixture();edit(p.governance[0]);assert.throws(()=>verifyGovernance(p.governance,NOW));
  }
});

test('past networking event cannot remain current and caller postal geography works',()=>{
  const p=fixture('professional');p.candidates[0].signal_type='business-event';assert.equal(board(p).candidates.length,0);
  const q=fixture();q.request.geography=[{postal_code:'55129',state:'MN'}];assert.equal(board(q).candidates.length,1);
});

test('inconsistent status facts within one candidate require resolution',()=>{
  const p=fixture();p.candidates[0].facts.push({...p.candidates[0].facts.find(f=>f.id==='status'),id:'new-status',value:'sold'});
  assert.equal(board(p).candidates.length,0);assert.match(board(p).rejected[0].reason,/Conflicting status/);
});
