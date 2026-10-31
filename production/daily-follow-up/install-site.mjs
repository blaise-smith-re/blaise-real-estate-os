import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=process.argv[2];
if(!site)throw Error('Pass opened existing Morning Desk source checkout');
const manifest=JSON.parse(fs.readFileSync(path.join(site,'.openai/hosting.json'),'utf8'));
if(manifest.project_id!=='appgprj_6ad170600b348191953b52130d86a98f')throw Error('Wrong Site');
const write=(name,s)=>{const p=path.join(site,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s.replace(/\r\n/g,'\n'));};
for(const [src,dest] of [['runtime/daily-follow-up.mjs','lib/daily-follow-up.mjs'],['runtime/daily-follow-up-contract.mjs','lib/daily-follow-up-contract.mjs'],['production/daily-follow-up/site-route.ts','app/api/daily-follow-up/route.ts'],['production/daily-follow-up/site-api.test.mjs','tests/daily-follow-up-api.test.mjs']])write(dest,fs.readFileSync(path.join(root,src),'utf8'));
const edit=(name,fn)=>write(name,fn(fs.readFileSync(path.join(site,name),'utf8').replace(/\r\n/g,'\n')));
edit('db/schema.ts',s=>s.includes('daily_follow_up')?s:s+'\nexport const dailyFollowUp=sqliteTable("daily_follow_up",{id:integer("id").primaryKey(),revision:integer("revision").notNull(),payload:text("payload").notNull()});\n');
edit('lib/updater-contract.ts',s=>{
 if(!s.includes('import {dailyFollowUpContract}'))s='import {dailyFollowUpContract} from "./daily-follow-up-contract.mjs";\n'+s;
 if(!s.includes('dailyFollowUp:dailyFollowUpContract'))s=s.replace(/export const updaterContract\s*=\s*\{/,'export const updaterContract = {\n  dailyFollowUp:dailyFollowUpContract,');
 if(!s.includes('dailyFollowUp:dailyFollowUpContract'))throw Error('Contract insertion target missing');
 return s;
});
edit('app/mcp/route.ts',s=>{
 if(s.includes('readFollowUp'))return s;
 s='import {GET as readFollowUp,POST as commandFollowUp} from "@/app/api/daily-follow-up/route";\n'+s;
 s=s.replace('const toolDefinitions=[','const toolDefinitions=[\n  {name:"daily_follow_up_read",description:"Resume Blaise user33 private chat follow-up queue, drafts, explicit confirmations and uncertain FUB effects. Read morning_desk_get_contract dailyFollowUp first; refresh FUB before recommending outreach. Does not retrieve live FUB history.",inputSchema:empty,annotations:annotations(true)},\n  {name:"daily_follow_up_command",description:"Persist chat follow-up progress: refresh, present, revise, next, skip, confirm, begin_effect, receipt. Requires current contract and expectedRevision. Next/skip never mean sent. Only a newly granted internal effect may be executed through separate FUB tools. This tool sends nothing and writes no CRM records.",inputSchema:payload,annotations:annotations(false)},');
 s=s.replace('if(name==="operations_bus_read"','if(name==="daily_follow_up_read"||name==="operations_bus_read"');
 s=s.replace('const data=name==="operations_bus_read"?','const data=name==="daily_follow_up_read"?await (await readFollowUp()).json():name==="operations_bus_read"?');
 s=s.replace('const operation=name==="operations_bus_command"?','const operation=name==="daily_follow_up_command"?commandFollowUp:name==="operations_bus_command"?');
 s=s.replace('version:"1.1.1"','version:"1.2.0"');
 return s;
});
console.log('Installed chat-only follow-up tools in existing private Site; generate additive migration and validate before publishing.');
