const fs=require('fs'), path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Hanna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
(async()=>{
const root=path.resolve(__dirname,'..'), out=process.argv[2]||path.join(root,'output');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const manifest=JSON.parse(fs.readFileSync(path.join(out,process.argv[3]||'render-manifest.json'),'utf8'));
const previews=path.join(path.dirname(out),'previews');fs.mkdirSync(previews,{recursive:true});
let qa=[];
for(const item of manifest){
 const page=await browser.newPage({viewport:{width:item.width,height:item.height},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(out,item.type,item.name+'.html')).href);
 await page.evaluate(()=>document.fonts.ready);
 await page.emulateMedia({media:'print'});
 const checks=await page.evaluate(()=>{
 const m=document.querySelector('main'),r=m.getBoundingClientRect();
 const els=[...m.querySelectorAll('*')].filter(x=>x.children.length===0 && !x.closest('.presenter-photo'));
 const outside=els.filter(x=>{let b=x.getBoundingClientRect();return b.left<r.left-.5||b.right>r.right+.5||b.bottom>r.bottom+.5||b.top<r.top-.5}).map(x=>x.textContent.slice(0,100));
 const footer=m.querySelector('footer'),fr=footer.getBoundingClientRect();
 const overlapping=els.filter(x=>!footer.contains(x)&&x.getBoundingClientRect().bottom>fr.top-7).map(x=>x.textContent.slice(0,90));
 const collisions=[];
 function paintedRect(el){
  let b=el.getBoundingClientRect(),r={left:b.left,right:b.right,top:b.top,bottom:b.bottom};
  for(let p=el.parentElement;p&&p!==m;p=p.parentElement){
   const s=getComputedStyle(p),q=p.getBoundingClientRect();
   if(['hidden','clip'].includes(s.overflowX)){r.left=Math.max(r.left,q.left);r.right=Math.min(r.right,q.right);}
   if(['hidden','clip'].includes(s.overflowY)){r.top=Math.max(r.top,q.top);r.bottom=Math.min(r.bottom,q.bottom);}
  }return r;
 }
 const visible=els.filter(x=>x.getBoundingClientRect().width>1&&x.getBoundingClientRect().height>1);
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
  const a=visible[i],b=visible[j],ar=paintedRect(a),br=paintedRect(b);
  if(Math.min(ar.right,br.right)-Math.max(ar.left,br.left)>2&&Math.min(ar.bottom,br.bottom)-Math.max(ar.top,br.top)>2)
   collisions.push([a.tagName+':'+a.textContent.slice(0,45),b.tagName+':'+b.textContent.slice(0,45)]);
 }
 return {outside,overlapping,collisions,images:[...document.images].every(x=>x.complete&&x.naturalWidth>0),fonts:document.fonts.check('16px Libre')&&document.fonts.check('16px Source')};
 });
 if(item.type==='print')await page.pdf({path:path.join(out,'print',item.name+'.pdf'),width:'8.5in',height:'11in',printBackground:true,preferCSSPageSize:true});
 await page.locator('main').screenshot({path:path.join(previews,item.name+'.png')});
 qa.push({name:item.name,...checks});await page.close();
}
await browser.close();fs.writeFileSync(path.join(path.dirname(out),process.argv[3]?'final-render-qa.json':'render-qa.json'),JSON.stringify(qa,null,2));console.log(JSON.stringify(qa));
})().catch(e=>{console.error(e);process.exit(1)});

