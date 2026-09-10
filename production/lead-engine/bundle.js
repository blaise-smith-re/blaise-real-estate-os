#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {outputDir}=require('./cli');
const repo=path.resolve(__dirname,'../..');
function bundle(destination) {
  const out=outputDir(destination); const files=[];
  function copy(rel) {
    const src=path.join(repo,rel); const stat=fs.lstatSync(src);
    if(stat.isSymbolicLink()) throw new Error('No symlinks in portable bundle');
    if(stat.isDirectory()) {for(const name of fs.readdirSync(src).sort())copy(path.join(rel,name));return;}
    if(!/\.(js|json|md)$/.test(rel)) return;
    const bytes=fs.readFileSync(src),target=path.join(out,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
    files.push({path:rel.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  for(const rel of ['production/lead-engine','.agents/skills/lead-engine','runtime/contract.js','runtime/errors.js','runtime/adapters/fub-read.js'])copy(rel);
  fs.writeFileSync(path.join(out,'BUNDLE-MANIFEST.json'),JSON.stringify({format:1,node:'>=20',files,test:'node --test production/lead-engine/tests/*.test.js',entry:'production/lead-engine/README.md',live_data_included:false},null,2),{flag:'wx'});
  return {path:out,file_count:files.length};
}
if(require.main===module){try{console.log(bundle(process.argv[2]));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={bundle};
