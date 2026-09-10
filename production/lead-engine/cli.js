#!/usr/bin/env node
'use strict';
const fs=require('node:fs'); const path=require('node:path');
const { buildBoard }=require('./engine');
const { researchPlan }=require('./adapters');
const { opportunityDetail }=require('./detail');
const { summarizeOutcomes }=require('./outcomes');
const { boardMarkdown,boardHtml }=require('./presentation');
const { requireThat }=require('./evidence');
const root=path.resolve(__dirname,'../..');
function read(file) { const p=path.resolve(file); requireThat(fs.statSync(p).size<=2000000,'Evidence pack exceeds 2 MB; minimize task-local evidence');return JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')); }
function outputDir(dir) {
  requireThat(dir,'Explicit private output directory required'); const p=path.resolve(dir);
  requireThat(p!==root&&!p.startsWith(root+path.sep),'Live and review outputs must remain outside the repository');
  fs.mkdirSync(p,{recursive:true}); return p;
}
function main(argv=process.argv.slice(2)) {
  const [cmd,...args]=argv;
  if(cmd==='plan'||cmd==='Run my lead engine') { process.stdout.write(JSON.stringify(researchPlan(args[0]?read(args[0]):{}),null,2)+'\n');return; }
  if(cmd==='run') {
    const [input,out,...flags]=args;const p=read(input); const b=buildBoard(p,{synthetic:flags.includes('--synthetic')}); const dir=outputDir(out);
    for(const [name,body] of Object.entries({'board.json':JSON.stringify(b,null,2),'Opportunity-Board.md':boardMarkdown(b),'Opportunity-Board.html':boardHtml(b),'evidence.json':JSON.stringify({generated_at:b.generated_at,sources:b.sources,coverage:b.coverage,rejected:b.rejected},null,2)})) fs.writeFileSync(path.join(dir,name),body,{encoding:'utf8',flag:'wx'});
    process.stdout.write(JSON.stringify({board_id:b.board_id,surfaced:b.candidates.length,coverage:b.coverage,output:dir,effects:b.effects},null,2)+'\n');return;
  }
  if(cmd==='detail') {
    const [board,rank,out,fresh,relationship]=args;const d=opportunityDetail(read(board),Number(rank),{freshPack:fresh?read(fresh):undefined,relationshipReview:relationship?read(relationship):undefined});
    const dir=outputDir(out);fs.writeFileSync(path.join(dir,'detail-'+rank+'.json'),JSON.stringify(d,null,2),{encoding:'utf8',flag:'wx'});process.stdout.write(JSON.stringify(d,null,2)+'\n');return;
  }
  if(cmd==='outcomes') {process.stdout.write(JSON.stringify(summarizeOutcomes(read(args[0])),null,2)+'\n');return;}
  throw new Error('Usage: node production/lead-engine/cli.js plan [request.json] | run pack.json PRIVATE_OUTPUT [--synthetic] | detail board.json RANK PRIVATE_OUTPUT [fresh-pack.json] [relationship.json] | outcomes evidence-events.json');
}
if(require.main===module) {try{main();}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}}
module.exports={main,outputDir};
