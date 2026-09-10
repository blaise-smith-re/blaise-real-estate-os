'use strict';
const pointers=require('./governance.json');
const {requireThat,instant,DAY}=require('./evidence');
function verifyGovernance(records,now) {
  requireThat(Array.isArray(records),'Current governing-source retrieval metadata required');
  const byKey=new Map(records.map(s=>[s.key,s]));
  for(const [key,id] of Object.entries(pointers.sources)) {
    const s=byKey.get(key);
    requireThat(s?.file_id===id && s.title && s.retrieved_at && s.modified_at && s.status==='ACTIVE — GOVERNING','Current canonical source identity/status missing: '+key);
    requireThat(!/^(RETIRED|LEGACY|ARCHIVED)\b|Superseded/i.test(s.title),'Retired governing source: '+key);
    const age=instant(now)-instant(s.retrieved_at);
    requireThat(age>=0&&age<=DAY,'Refresh governing source for current run: '+key);
  }
  return records;
}
module.exports={verifyGovernance};
