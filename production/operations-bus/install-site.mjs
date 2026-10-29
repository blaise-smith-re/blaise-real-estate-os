// Run against an already opened, owner-private Morning Desk source checkout.
// This copies reviewed Bus code; it never authenticates, publishes or seeds clients.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),site=process.argv[2];
if(!site)throw Error('Pass the existing Site checkout');
const manifest=JSON.parse(fs.readFileSync(path.join(site,'.openai/hosting.json'),'utf8'));
if(manifest.project_id!=='appgprj_6ad170600b348191953b52130d86a98f')throw Error('Wrong Site');
const write=(name,text)=>{const p=path.join(site,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text.replace(/\r\n/g,'\n'));};
for(const [src,dest] of [['runtime/kickoff-bus.mjs','lib/kickoff-bus.mjs'],['runtime/kickoff-contract.mjs','lib/kickoff-contract.mjs'],['production/operations-bus/site-route.ts','app/api/operations-bus/route.ts'],['production/operations-bus/site-panel.tsx','app/kickoff-panel.tsx']])write(dest,fs.readFileSync(path.join(root,src),'utf8'));
const edit=(name,fn)=>write(name,fn(fs.readFileSync(path.join(site,name),'utf8').replace(/\r\n/g,'\n')));
edit('db/schema.ts',s=>s.includes('operations_bus')?s:s+'\nexport const operationsBus=sqliteTable("operations_bus",{id:integer("id").primaryKey(),revision:integer("revision").notNull(),payload:text("payload").notNull()});\n');
edit('lib/updater-contract.ts',s=>{
 if(s.includes('kickoffContract'))return s;
 return 'import {kickoffContract} from "./kickoff-contract.mjs";\n'+s.replace('revision:"2026-10-29.1"','revision:"2026-10-29.2", operationsBus:kickoffContract').replace('  instructions:[','  instructions:[\n    "Run the attached operationsBus accepted-contract lane using operations_bus_read/command before completing this briefing. It extends internal authority only for verified owner33 transaction kickoff under the current Transaction Operations Runbook; the normal closeout limits below otherwise remain. Keep its progress, uncertainty and pause state in the existing private store, actual documents in Drive and material client state in FUB.",');
});
edit('app/mcp/route.ts',s=>{
 if(s.includes('readBus'))return s;
 s='import {GET as readBus,POST as commandBus} from "@/app/api/operations-bus/route";\n'+s;
 s=s.replace('const toolDefinitions=[','const toolDefinitions=[\n  {name:"operations_bus_read",description:"Read persistent accepted-contract kickoff progress, pause state and uncertain effects. Source systems remain authoritative. Read morning_desk_get_contract for the procedure and command schemas.",inputSchema:empty,annotations:annotations(true)},\n  {name:"operations_bus_command",description:"Checkpoint the preparation-only accepted-contract workflow. Requires expectedRevision and the current contract. Grants one internal-effect intent once; does not itself write FUB/Drive or send messages. Read back after writes and reconcile uncertain responses.",inputSchema:payload,annotations:annotations(false)},');
 s=s.replace('name==="morning_desk_get_contract"||name==="morning_desk_read"','name==="operations_bus_read"||name==="morning_desk_get_contract"||name==="morning_desk_read"');
 s=s.replace('const data=name==="morning_desk_get_contract"?','const data=name==="operations_bus_read"?await (await readBus()).json():name==="morning_desk_get_contract"?');
 s=s.replace('const operation=name==="morning_desk_save_briefing"?','const operation=name==="operations_bus_command"?commandBus:name==="morning_desk_save_briefing"?');
 s=s.replace('const versions=[','const versions=["2026-07-28",');
 s=s.replace('  if(message.method==="ping")','  if(message.method==="server/discover")return rpc(id,{supportedVersions:versions,capabilities:{tools:{}}});\n  if(message.method==="ping")');
 return s;
});
edit('app/desk.tsx',s=>s.includes('KickoffPanel')?s:'import KickoffPanel from "./kickoff-panel";\n'+s.replace('        {view==="health"?','        <KickoffPanel/>\n        {view==="health"?').replace('"use client";\n',''));
// Keep the React client directive first after adding the import.
edit('app/desk.tsx',s=>s.startsWith('"use client";')?s:'"use client";\n'+s);
console.log('Copied scoped Bus integration. Generate the additive D1 migration, validate, then publish through the existing Sites workflow.');
