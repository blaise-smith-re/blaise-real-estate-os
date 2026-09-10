'use strict';
const { FubReadAdapter } = require('../../runtime/adapters/fub-read');
const { requireThat } = require('./evidence');
const { assertZeroEffects } = require('../../runtime/contract');

function lookupRequest(board,candidateId,identity) {
  const c=board.candidates.find(c=>c.candidate_id===candidateId);
  requireThat(c,'Only a board shortlist target may receive FUB context');
  requireThat(identity?.name && identity.fact_id && c.facts.some(f=>f.id===identity.fact_id&&f.state!=='inferred'&&f.text.includes(identity.name)), 'Exact source-backed person/business identity required; never guess property owner');
  return {operation:'FIND_CONTACT',args:{name:identity.name,limit:3},context:{},candidate_id:candidateId,
    reason:'Shortlisted opportunity; bounded existing relationship discovery. A name hit is not identity proof.'};
}
async function boundedLookup(board,candidateId,identity,toolConfig) {
  const req=lookupRequest(board,candidateId,identity);
  const config=scopedReadConfig(toolConfig);
  const adapter=new FubReadAdapter({...config,allowedOperations:['FIND_CONTACT','GET_CONTACT']});
  const response=await adapter.performRead({capability:{operation:req.operation},untrusted_data:req.args,execution_constraints:{mode:'READ_ONLY'}});
  assertZeroEffects(response.effects);
  return {state:'DISCOVERY-REQUIRES-IDENTITY-REVIEW',candidate_id:candidateId,...response};
}
function scopedReadConfig({availableTools,invokeTool,clock}={}) {
  requireThat(Array.isArray(availableTools)&&typeof invokeTool==='function','Enumerated live FUB tool inventory and invoker required');
  const prefix=['mcp__blaise_fub_read_only__','mcp__blaise_fub_full__'].find(p=>availableTools.includes(p+'find_contact'));
  requireThat(prefix,'FUB find_contact unavailable: authenticate the existing FUB MCP connection and refresh its tool inventory; no broader discovery fallback');
  const allowed=['find_contact','get_contact'].map(n=>prefix+n).filter(n=>availableTools.includes(n));
  // This facade exposes only exact reads even when the underlying server has writers.
  // The runtime adapter still sees and enforces its original read-only surface.
  return {availableTools:allowed,toolPrefix:prefix,clock,invokeTool:async(name,args)=>{requireThat(allowed.includes(name),'Lead Engine read facade rejects this tool');return invokeTool(name,args);}};
}
function handoff(candidate, selection) {
  requireThat(selection?.selected_by==='Blaise' && selection.candidate_id===candidate.candidate_id && selection.selected_at,'Explicit exact pursuit selection required');
  return {route:'lead-conversion-crm',candidate_id:candidate.candidate_id,target:candidate.display_name,
    relationship_check:candidate.relationship_check,contact_status:candidate.contact_eligibility,
    sources:candidate.source_locator,requested_effect:'NONE — proposal only',
    instructions:'Resolve exact existing identity with bounded lookup. Reuse the existing record. Contact creation or any later internal maintenance belongs to lead-conversion-crm with exact targeting, duplicate checks and independent read-back. Selection is not send authorization.'};
}
module.exports={lookupRequest,boundedLookup,handoff,scopedReadConfig};
