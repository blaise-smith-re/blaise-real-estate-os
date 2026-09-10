const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const out=path.resolve(process.argv[2]);
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'render-manifest.json'),'utf8'));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const qa=[];fs.mkdirSync(path.join(out,'previews'),{recursive:true});
 for(const item of manifest){
  const isPrint=['print','combined'].includes(item.kind);
  const page=await browser.newPage({viewport:{width:isPrint?816:390,height:1056},deviceScaleFactor:2});
  // Only local resources are needed. Do not follow any buyer/CRM/Calendar link.
  await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await page.goto(pathToFileURL(path.join(out,item.file)).href);
  await page.evaluate(()=>document.fonts.ready);
  const checks=await page.evaluate(()=>{
   const pages=[...document.querySelectorAll('main')];
   const bounds=[],overlap=[];
   for(const m of pages){
    const r=m.getBoundingClientRect(),footer=m.querySelector('footer');
    for(const el of m.querySelectorAll('section,p,h1,h2,img,footer')){
     const b=el.getBoundingClientRect();
     if(b.left<r.left-1||b.right>r.right+1||b.bottom>r.bottom+1)bounds.push(el.textContent.slice(0,80));
     if(footer&&el.tagName==='SECTION'&&b.bottom>footer.getBoundingClientRect().top-3)overlap.push(el.textContent.slice(0,80));
    }
   }
   const ps=[...document.querySelectorAll('section p')];
   return {horizontal:document.documentElement.scrollWidth>innerWidth,
    bounds,overlap,bodyFontMin:Math.min(...ps.map(x=>parseFloat(getComputedStyle(x).fontSize))),
    fonts:document.fonts.check('15px Source')&&document.fonts.check('30px Libre'),
    images:[...document.images].every(x=>x.complete&&x.naturalWidth>0),
    links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')),
    singleColumn:[...document.querySelectorAll('.two-col')].every(x=>getComputedStyle(x).display==='block'),
    height:Math.ceil(document.documentElement.scrollHeight)};
  });
  const base=item.file.replace(/\.html$/,'');
  if(isPrint)await page.pdf({path:path.join(out,base+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});
  else {
   // Override the Letter @page rule too: PDF dimensions alone scale a Letter layout.
   await page.addStyleTag({content:'@page{size:390px '+(checks.height+4)+'px;margin:0}.phone .padfolio,.phone .notes{min-height:0}'});
   await page.emulateMedia({media:'screen'});
   await page.pdf({path:path.join(out,base+'.pdf'),printBackground:true,preferCSSPageSize:true});
  }
  if(item.kind!=='combined')await page.screenshot({path:path.join(out,'previews',base+'.png'),fullPage:true});
  qa.push({file:item.file,kind:item.kind,...checks});
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'render-qa.json'),JSON.stringify(qa,null,2));
 const failures=qa.filter(x=>x.horizontal||x.bounds.length||x.overlap.length||!x.fonts||!x.images||(!['print','combined'].includes(x.kind)&&!x.singleColumn));
 console.log(JSON.stringify({pages:qa.length,failures},null,2));
 if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
