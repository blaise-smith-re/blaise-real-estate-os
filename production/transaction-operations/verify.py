"""Independent checks of known fictional evidence, generated PDFs and zero-effect claims.

This verifies the five-scenario demo, not live contract facts or legal execution.
Optional --render produces actual-PDF page images for human visual inspection.
"""
from pathlib import Path
import argparse,hashlib,json
from pypdf import PdfReader
SCENARIOS=('buyer-start','buyer-update','seller-start','missing-execution','human-verification')
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def check(out,render=False):
    out=Path(out);results=[];checks=0
    def require(value,message):
        nonlocal checks
        checks+=1
        if not value:raise AssertionError(message)
    for name in SCENARIOS:
        root=out/name;r=read(root/'private-provenance.json');o={x['id']:x for x in r['obligations']}
        require(r['mode']=='synthetic',name+' synthetic label')
        require(all(v==0 for v in r['external_effects'].values()),name+' no effects')
        require(all(x['created'] is False and x['label']=='SYNTHETIC — DO NOT ADD TO CALENDAR' for x in r['calendar_advisories']),name+' no event')
        require(r['proposals']['tasks']==[],name+' no compulsory task')
        if name!='missing-execution':
            require(o['em']['amount']=='7500',name+' amount from fictional source')
            require(o['em']['due']['at']=='2026-09-17T17:00:00-05:00',name+' three calendar days excludes anchor')
            require(o['inspection']['due']['date']==('2026-09-24' if name=='buyer-update' else '2026-09-21'),name+' executed date')
            require(o['closing']['due']['date']=='2026-10-16' and o['closing']['due']['at'] is None,name+' missing closing time')
        else:
            require(not r['acceptance']['valid'] and all(x['due']['date'] is None for x in o.values()),'missing execution holds dependent dates')
            require(r['handoffs'] and r['filing_plan'],'useful incomplete preparation')
        if name=='buyer-update':
            require(o['em']['progress']=='Received','verified receipt applied')
            require(o['inspection']['document']=='amend','newer draft ignored')
            require(any('reported date differs' in x for x in r['holds']),'conflicting report visible')
            require({x['id'] for x in r['changes']}=={'em','inspection'},'only actual changes')
        if name=='human-verification':require(r['acceptance']['method']=='Human-verified','human verification distinct')
        if name=='seller-start':require(any(p['role']=='tc' and p['assignment_status']=='unknown' for p in r['people']),'no default seller TC')
        for p in (root/'drafts').glob('*.txt'):
            text=p.read_text(encoding='utf-8');require('DRAFT — NOT SENT' in text and 'SYNTHETIC' in text,'draft label')
            require('CONFIDENTIAL-CASH-RESERVE-42817' not in text and 'private-provenance' not in text,'private isolation')
        for q in read(root/'render-qa.json'):
            require(not q['horizontal'] and not q['bounds'] and not q['overlap'] and q['fonts'] and q['images'],'render bounds/fonts/images')
            require(q['bodyFontMin'] >= (15 if q['kind']=='phone' else 12),'body/source legibility')
            if q['kind']=='phone':require(q['singleColumn'],'phone column')
        for p in sorted(root.glob('*.pdf')):
            reader=PdfReader(p);phone='Phone' in p.name
            require(len(reader.pages)==(1 if phone else 2),'expected final page count '+str(p))
            for index,page in enumerate(reader.pages):
                text=page.extract_text();require('SYNTHETIC' in text and '870-692-2205' in text,'page label/contact')
                require('\u00c2' not in text and '\u00c3' not in text,'PDF text encoding')
                require('garage_min' not in text and 'owner_status' not in text,'human labels')
                require(abs(float(page.mediabox.width)-(292.5 if phone else 612))<1,'actual PDF width')
                if not phone:require(float(page.mediabox.height)==792,'actual Letter page')
            results.append({'file':p.relative_to(out).as_posix(),'pages':len(reader.pages),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    for p in sorted((out/'source-pack').glob('*.pdf')):
        reader=PdfReader(p)
        require(all('SYNTHETIC' in x.extract_text() and 'NO LEGAL EFFECT' in x.extract_text() for x in reader.pages),'fictional source label')
        results.append({'file':p.relative_to(out).as_posix(),'pages':len(reader.pages),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    record={'status':'PASS','checks':checks,'pdf_files':len(results),'pdf_pages':sum(x['pages'] for x in results),'files':results,'visual_review':'Separate human inspection required; images alone do not assert completion','live_end_to_end_demonstrated':False}
    (out/'verification.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    if render:
        import pypdfium2 as pdfium
        dest=out/'page-inspection';dest.mkdir(exist_ok=True)
        for r in results:
            doc=pdfium.PdfDocument(out/r['file']);stem=r['file'].replace('/','--').replace('.pdf','')
            for i in range(len(doc)):
                page=doc[i];im=page.render(scale=1.6).to_pil();im.save(dest/(stem+f'-p{i+1}.png'));page.close()
            doc.close()
    print(json.dumps({k:v for k,v in record.items() if k!='files'},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('out');p.add_argument('--render',action='store_true');a=p.parse_args();check(a.out,a.render)
