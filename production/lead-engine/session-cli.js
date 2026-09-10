#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const session=require('./research-session');const {outputDir}=require('./cli');
const read=f=>{if(fs.statSync(f).size>2000000)throw Error('Oversized checkpoint');return JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));};
function save(file,s,revision){outputDir(path.dirname(path.resolve(file)));if(fs.existsSync(file)&&read(file).revision!==revision)throw Error('Checkpoint changed; reread before updating');const temp=file+'.next';fs.writeFileSync(temp,JSON.stringify(s,null,2),{flag:'wx'});fs.renameSync(temp,file);}
function main([command,file,...args]) {
  if(command==='start'){if(fs.existsSync(file))throw Error('Existing run; resume instead');const s=session.startSession(args[0]?read(args[0]):{},read(args[1]));save(file,s,undefined);console.log(JSON.stringify({run_id:s.run_id,queries:s.queries}));return;}
  const s=read(file);let result;
  if(command==='status'){console.log(JSON.stringify({run_id:s.run_id,revision:s.revision,browser:s.browser,queries:s.queries.map(({observations,...q})=>({...q,retained:observations.reduce((n,o)=>n+o.candidates.length,0)})),resume:s.resume_instruction},null,2));return;}
  if(command==='pause-auth')result=session.pauseForAuthentication(s,read(args[0]));
  else if(command==='resume-auth')result=session.confirmAuthenticated(s,read(args[0]));
  else if(command==='observe')result=session.acceptObservation(s,args[0],read(args[1]));
  else if(command==='block')result=session.recordLimitation(s,args[0],args[1]);
  else if(command==='pack'){outputDir(path.dirname(path.resolve(args[0])));fs.writeFileSync(args[0],JSON.stringify(session.packFromSession(s),null,2),{flag:'wx'});return;}
  else throw Error('Use start/status/pause-auth/resume-auth/observe/block/pack; see BROWSER-RESUME.md');
  save(file,result,s.revision);console.log(JSON.stringify({run_id:result.run_id,revision:result.revision,states:result.queries.map(q=>({id:q.id,state:q.state}))}));
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={main};
