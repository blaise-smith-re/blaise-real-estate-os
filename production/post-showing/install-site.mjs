import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),site=process.argv[2];
if(!site)throw Error('Pass existing private Site checkout');
if(JSON.parse(fs.readFileSync(path.join(site,'.openai/hosting.json'))).project_id!=='appgprj_6ad170600b348191953b52130d86a98f')throw Error('Wrong Site');
const write=(name,s)=>{const p=path.join(site,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s.replace(/\r\n/g,'\n'));};
for(const [a,b] of [['runtime/post-showing.mjs','lib/post-showing.mjs'],['runtime/post-showing-contract.mjs','lib/post-showing-contract.mjs'],['production/post-showing/site-route.ts','app/api/post-showing/route.ts'],['production/post-showing/site-page.tsx','app/showing-follow-up/page.tsx']])write(b,fs.readFileSync(path.join(root,a),'utf8'));
const edit=(name,fn)=>write(name,fn(fs.readFileSync(path.join(site,name),'utf8').replace(/\r\n/g,'\n')));
edit('db/schema.ts',s=>s.includes('post_showing')?s:s+'\nexport const postShowing=sqliteTable("post_showing",{id:integer("id").primaryKey(),revision:integer("revision").notNull(),payload:text("payload").notNull()});\n');
edit('lib/updater-contract.ts',s=>{
  if(!s.includes('import {postShowingContract}'))s='import {postShowingContract} from "./post-showing-contract.mjs";\n'+s;
  if(!s.includes('postShowing:postShowingContract'))s=s.replace(/export const updaterContract\s*=\s*\{/,'export const updaterContract = {\n  postShowing:postShowingContract,');
  if(!s.includes('Post-showing continuation:'))s=s.replace('instructions:[','instructions:[\n    "Post-showing continuation: read post_showing_read and follow postShowing. Merge open promises and pending internal effects into each exact buyer card, keeping one task until the buyer receives the answer. Reconcile lender answers and explicit owner call outcomes from actual source bodies. Follow the saved 07:15 America/Chicago Morning Desk timing; existing Business Inbox Triage passes are 07:00,12:00,17:00 CT. This instruction does not change or certify those timers.",');
  if(!s.includes('postShowing:postShowingContract'))throw Error('Missing contract insertion');return s;
});
edit('app/mcp/route.ts',s=>{
  if(s.includes('readPostShowing'))return s;
  s='import {GET as readPostShowing,POST as commandPostShowing} from "@/app/api/post-showing/route";\n'+s;
  s=s.replace('const toolDefinitions=[','const toolDefinitions=[\n  {name:"post_showing_read",description:"Read private post-showing promises, drafts, write receipts and open actions. Follow morning_desk_get_contract postShowing. Does not read FUB or Gmail.",inputSchema:empty,annotations:annotations(true)},\n  {name:"post_showing_command",description:"Save owner recap, sourced lender answer, edited draft, buyer receipt or fenced internal-effect receipt. Read contract first. No client/lender sends or direct CRM writer. Replay cannot grant external execution.",inputSchema:payload,annotations:annotations(false)},');
  s=s.replace('if(name==="zillow_tours_read"','if(name==="post_showing_read"||name==="zillow_tours_read"');
  s=s.replace('const data=name==="zillow_tours_read"?','const data=name==="post_showing_read"?await (await readPostShowing()).json():name==="zillow_tours_read"?');
  s=s.replace('const operation=name==="zillow_tours_command"?','const operation=name==="post_showing_command"?commandPostShowing:name==="zillow_tours_command"?');return s;
});
edit('tests/api.test.mjs',s=>s.replace('assert.equal(listed.result.tools.length,13);','assert.ok(["post_showing_read","post_showing_command","zillow_tours_read","morning_desk_get_contract"].every(name=>listed.result.tools.some(t=>t.name===name)));'));
console.log('Post-showing receipts installed; generate additive migration, validate and publish existing owner-private Site.');
