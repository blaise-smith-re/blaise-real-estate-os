'use strict';
const { DAY, requireThat, normalized } = require('./evidence');
const DEFAULTS = Object.freeze({recency:15,intent:15,conversation:15,geography:15,value:20,confidence:10,business_value:10});
function rank(c, evidence, request) {
  const weights = {...DEFAULTS,...request.weights};
  requireThat(Object.keys(weights).every(k=>k in DEFAULTS && Number.isFinite(weights[k]) && weights[k]>=0) && Object.values(weights).reduce((a,b)=>a+b,0)===100, 'Known nonnegative ranking weights must total 100');
  const sourceAge = Math.max(...c.current_status.refs.map(id=>evidence.age(c.facts.find(f=>f.id===id).source)));
  const event = c.latest_meaningful_event;
  const age = event.at ? (evidence.now-Date.parse(event.at))/DAY : null;
  // Reading an undated page today cannot manufacture a fresh decision point.
  const recency = event.kind==='undated'?0:event.kind==='current-observation'?1:age<0?(age>=-14?4:2):age<=7?4:age<=30?3:age<=60?2:age<=120?1:0;
  const matches = request.geography.some(g=>normalized(g.state)===normalized(c.geography.state) && (!g.city || normalized(g.city)===normalized(c.geography.city)) && (!g.postal_code || g.postal_code===c.geography.postal_code));
  const confidence = sourceAge<=1?4:sourceAge<=7?3:sourceAge<=14?2:1;
  const components = {
    recency:{value:recency,reason:event.kind==='current-observation'?'Current page observation only; original event date unknown':event.kind==='undated'?'No dated meaningful event':`${Math.round(Math.abs(age))} days ${age<0?'until':'since'} source-backed event`,refs:event.refs},
    geography:{value:matches?4:0,reason:matches?'Matches caller-supplied market':'Outside requested market',refs:c.geography.refs},
    confidence:{value:confidence,reason:`Status evidence observed ${sourceAge.toFixed(1)} days ago; publisher claims remain reported`,refs:c.current_status.refs},
    ...c.assessments,
  };
  let score=0;
  for (const [k,w] of Object.entries(weights)) { components[k].weight=w; components[k].points=+(components[k].value*w/4).toFixed(2); score+=components[k].points; }
  const penalties=[];
  if(c.contact_eligibility.state==='HOLD-VERIFY') penalties.push({points:8,reason:'Contact gate unresolved'});
  if(c.latest_meaningful_event.kind!=='dated-event') penalties.push({points:5,reason:'No dated decision point'});
  if(c.unknowns.length) penalties.push({points:Math.min(c.unknowns.length*2,10),reason:`${c.unknowns.length} material unknowns`});
  if(c.relationship_check.state==='NOT-CHECKED') penalties.push({points:3,reason:'Existing relationship not checked'});
  const final=+Math.max(0,score-penalties.reduce((n,p)=>n+p.points,0)).toFixed(2);
  return {...c,score_components:components,penalties,final_priority:final,
    reason_for_priority:Object.entries(components).map(([k,v])=>`${k}: ${v.points}/${v.weight} — ${v.reason}`).concat(penalties.map(p=>`−${p.points}: ${p.reason}`)),
    market_match:matches,status_age_days:sourceAge};
}
module.exports={DEFAULTS,rank};
