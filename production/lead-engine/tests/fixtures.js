'use strict';
const NOW='2026-09-10T17:00:00Z';
const governance=Object.entries(require('../governance.json').sources).map(([key,file_id])=>({key,file_id,title:'Fictional active source '+key,status:'ACTIVE — GOVERNING',retrieved_at:NOW,modified_at:NOW}));
function fixture(lane='seller',n=1) {
  const name=`Fictional ${lane} opportunity ${n}`;
  const source={id:'s'+n,name:'SYNTHETIC TEST SOURCE '+n,locator:'https://example.com/fictional/'+n,retrieval_tool:'test-fixture',access:'synthetic',retrieved_at:NOW,observed_at:NOW,permission:{state:'allowed',basis:'Fictional test data'},excerpts:[`${name} Woodbury MN. Listed September 9, 2026. Status active. FSBO. Professional service operating.`]};
  const facts=[{id:'identity',field:'identity',text:name,quote:name,source:source.id,state:'reported'},{id:'geo',field:'geography',text:'Woodbury MN',quote:'Woodbury MN',source:source.id,state:'reported'},
    {id:'status',field:'status',text:lane==='seller'?'FSBO':lane==='open-house'?'Status active':'Professional service operating',quote:lane==='seller'?'FSBO':lane==='open-house'?'Status active':'Professional service operating',source:source.id,state:'reported'},
    {id:'event',field:'event',text:'Listed September 9, 2026',quote:'Listed September 9, 2026',source:source.id,state:'reported'}];
  const c={lane,display_name:name,target_key:name,geography:{city:'Woodbury',state:'MN',postal_code:'55129',refs:['geo']},signal_type:lane==='seller'?'fsbo':lane==='open-house'?'active-listing':'professional-service',facts,identity_refs:['identity'],current_status:{value:lane==='seller'?'fsbo':lane==='open-house'?'active':'operating',refs:['status']},
    latest_meaningful_event:{description:'A supported fictional decision point',kind:'dated-event',at:'2026-09-09T17:00:00Z',refs:['event']},
    review:{reviewer:'Fictional test operator',legitimate_service_only:true,no_sensitive_targeting:true},assessments:Object.fromEntries(['intent','conversation','value','business_value'].map(k=>[k,{value:4,reason:'Fictional useful service match',refs:['status']}])),
    why_blaise:{text:'Fictional local service fit',refs:['geo']},value_angle:{text:'Help compare launch options without pressure',refs:['status']},unknowns:[{text:'Verify actual needs',blocks_contact:true}],
    prep:{opener:'Conditional fictional coaching opener',discovery:['What outcome matters?','What would be useful?'],next_commitment:'Agree on one brief strategy discussion'}};
  facts.find(f=>f.id==='status').value=c.current_status.value;
  facts.find(f=>f.id==='event').value=c.latest_meaningful_event.at;
  if(lane==='open-house'){facts.push({id:'host-fit',field:'market_position',text:'Fictional current market position supports comparing a host proposal',quote:'Status active',source:source.id,state:'reported'});c.host_business_case={text:'Fictional supported host fit',refs:['host-fit']};}
  return {mode:'synthetic',governance,request:{},sources:[source],candidates:[c],coverage:[{lane,attempt_status:'SYNTHETIC-ONLY'}]};
}
module.exports={NOW,fixture,governance};
