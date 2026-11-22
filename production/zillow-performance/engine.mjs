export const milestones=['conversation','booked','held','next_step','offer','contract','closing'];
const fail=m=>{throw Error(m)};
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const safe=v=>{try{return new URL(v).protocol==='https:'}catch{return false}};
const dateOnly=v=>/^\d{4}-\d{2}-\d{2}$/.test(v);
const localDay=v=>dateOnly(v)?v:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
export function monthKey(v){return localDay(v).slice(0,7);}
function inWindow(e,p,days){
 if(dateOnly(e.at)||dateOnly(p.connectedAt)){const age=(Date.parse(localDay(e.at))-Date.parse(localDay(p.connectedAt)))/86400000;return age>=0&&age<days;}
 return Date.parse(e.at)>=Date.parse(p.connectedAt)&&Date.parse(e.at)<=Date.parse(p.connectedAt)+days*86400000;
}
export function validateReport(input,now=new Date().toISOString()){
 const r=structuredClone(input);
 if(r.schemaVersion!==1||r.assignedUserId!==33||!/^[-\w]{8,100}$/.test(r.runId)||!iso(r.asOf)||Date.parse(r.asOf)>Date.parse(now)+60000)fail('Invalid identity, cutoff or run');
 if(!['interactive','unattended'].includes(r.execution)||!Array.isArray(r.records)||r.records.length>500)fail('Invalid execution or roster');
 if(!r.coverage?.detail||!r.standing?.detail||!r.recommendation?.action||!Array.isArray(r.targets)||!Array.isArray(r.sources))fail('Missing assessment');
 if(r.recommendation.url&&!safe(r.recommendation.url)||[...r.targets,...r.sources].some(x=>!safe(x.url)))fail('Invalid assessment source URL');
 const ids=new Set();
 for(const p of r.records){
  if(!Number.isInteger(p.personId)||ids.has(p.personId)||p.assignedUserId!==33)fail('Duplicate or wrong owner');ids.add(p.personId);
  if(!safe(p.url)||!p.url.endsWith('/'+p.personId)||!p.name||!iso(p.crmCreatedAt))fail('Invalid person reference');
  if(p.connectedAt!==null&&(!iso(p.connectedAt)||Date.parse(p.connectedAt)>Date.parse(r.asOf)||!safe(p.connectionSource)||!['original_delivery','dated_owner_record'].includes(p.connectionBasis)))fail('Connection needs dated owner evidence');
  if(!['residential','land','unknown'].includes(p.segment)||!p.connectionType||!Array.isArray(p.events))fail('Invalid segment/events');
  const seen=new Map();
  for(const e of p.events){
   if(!milestones.includes(e.kind)||!iso(e.at)||Date.parse(e.at)>Date.parse(r.asOf)||!safe(e.url)||!e.id||!e.detail||!['original','owner_report','sourced_record'].includes(e.proof))fail('Milestone needs actual event, date and evidence');
   if(seen.has(e.id)&&JSON.stringify(seen.get(e.id))!==JSON.stringify(e))fail('Conflicting evidence id');seen.set(e.id,e);
  }
  p.events=[...seen.values()];
  if(p.commission&&(!Number.isSafeInteger(p.commission.dealId)||!Number.isSafeInteger(p.commission.netCents)||p.commission.netCents<0||!iso(p.commission.paidAt)||Date.parse(p.commission.paidAt)>Date.parse(r.asOf)||!safe(p.commission.statementUrl)||!safe(p.commission.paymentUrl)||p.commission.dealMatched!==true||p.commission.splitsAndReferralVerified!==true))fail('Retained commission requires matched final statement and payment');
 }
 return r;
}
export function cohort(report,{from,to,days=30,segment='residential',connectionType=null}={}){
 const cutoff=Date.parse(report.asOf), rows=report.records.filter(p=>p.connectedAt&&p.segment===segment&&localDay(p.connectedAt)>=from&&localDay(p.connectedAt)<to&&(!connectionType||p.connectionType===connectionType));
 const eligible=rows.filter(p=>Date.parse(p.connectedAt)+(days+(dateOnly(p.connectedAt)?1:0))*86400000<=cutoff);
 const counts=Object.fromEntries(milestones.map(k=>[k,eligible.filter(p=>p.events.some(e=>e.kind===k&&inWindow(e,p,days))).length]));
 return {from,to,days,segment,denominator:eligible.length,stillMaturing:rows.length-eligible.length,counts,unknown:Object.fromEntries(milestones.map(k=>[k,eligible.length-counts[k]])),people:eligible.map(p=>p.personId)};
}
export function monthly(report){
 const months=new Set(report.records.flatMap(p=>[monthKey(p.crmCreatedAt),...(p.connectedAt?[monthKey(p.connectedAt)]:[]),...p.events.filter(e=>['contract','closing'].includes(e.kind)).map(e=>monthKey(e.at))]));
 for(const p of report.records)if(p.commission)months.add(monthKey(p.commission.paidAt));
 return [...months].sort().map(m=>{const paid=[...new Map(report.records.filter(p=>p.commission&&monthKey(p.commission.paidAt)===m).map(p=>[p.commission.dealId,p.commission])).values()];const production=k=>new Set(report.records.flatMap(p=>p.events.filter(e=>e.kind===k&&monthKey(e.at)===m).map(e=>e.id))).size;return {month:m,observedReceipts:report.records.filter(p=>p.connectedAt&&monthKey(p.connectedAt)===m).length,crmCreated:report.records.filter(p=>monthKey(p.crmCreatedAt)===m).length,contracts:production('contract'),closings:production('closing'),verifiedRetained:paid.length?paid.reduce((sum,c)=>sum+c.netCents,0)/100:null,matchedPayouts:paid.length};});
}
export function reviewDue(report,at=new Date().toISOString()){
 const d=new Date(at),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d),get=t=>parts.find(x=>x.type===t)?.value;
 const day=get('year')+'-'+get('month')+'-'+get('day');const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'));const monday=new Date(day+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-((weekday+6)%7));
 const weekly=monday.toISOString().slice(0,10),prev=new Date(day.slice(0,7)+'-01T12:00:00Z');prev.setUTCMonth(prev.getUTCMonth()-1);const monthly=prev.toISOString().slice(0,7);
 return {weeklyKey:weekly,monthlyKey:monthly,weekly:report?.reviewedWeek!==weekly,monthly:report?.reviewedMonth!==monthly};
}
export function projection(r){const current=monthKey(r.asOf)+'-01',offset=n=>{const d=new Date(current+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)};const earlier={from:offset(-3),to:offset(-1)},recent={from:offset(-1),to:current};return {monthly:monthly(r),earlier:cohort(r,earlier),recent:cohort(r,recent),current:cohort(r,{from:current,to:offset(1)}),byType:[...new Set(r.records.map(p=>p.connectionType))].sort().map(connectionType=>({connectionType,earlier:cohort(r,{...earlier,connectionType}),recent:cohort(r,{...recent,connectionType})})),land:{earlier:cohort(r,{...earlier,segment:'land'}),recent:cohort(r,{...recent,segment:'land'})},due:reviewDue(r)};}
export async function readPerformance(db){await db.prepare('CREATE TABLE IF NOT EXISTS zillow_performance (run_id TEXT PRIMARY KEY, as_of TEXT NOT NULL, payload TEXT NOT NULL)').run();const row=await db.prepare('SELECT payload FROM zillow_performance ORDER BY as_of DESC,run_id DESC LIMIT 1').first();const report=row?JSON.parse(row.payload):null;return {report,summary:report?projection(report):null,due:reviewDue(report),serverTime:new Date().toISOString()};}
export async function savePerformance(db,input){const r=validateReport(input);await readPerformance(db);const body=JSON.stringify(r);await db.prepare('INSERT OR IGNORE INTO zillow_performance (run_id,as_of,payload) VALUES (?,?,?)').bind(r.runId,r.asOf,body).run();const saved=await db.prepare('SELECT payload FROM zillow_performance WHERE run_id=?').bind(r.runId).first();if(saved?.payload!==body)fail('Run id already has different content; read back before retry');return {runId:r.runId,saved:true,summary:projection(r)};}
