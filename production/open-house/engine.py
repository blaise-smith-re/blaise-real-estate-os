"""Local production engine. No source-system mutations or unattended browser access."""
from pathlib import Path
from datetime import date, datetime
from zoneinfo import ZoneInfo
import argparse, copy, hashlib, html, json, re, shutil, subprocess, sys
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT/'templates'))
from public_copy import validate_public
from portrait_selection import recommend

def read(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p, data):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
def require(ok, message):
    if not ok: raise ValueError(message)
def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def money(n): return f'${n:,.0f}' if float(n).is_integer() else f'${n:,.2f}'

def validate_governance(receipts):
    registry=read(ROOT/'governance.json');expected={registry['source_map'],*registry['sources'].values()}
    require(expected <= {r.get('id') for r in receipts},'Missing current Source Map/governing source receipt')
    for r in receipts:
        require(not re.search(r'\b(LEGACY|RETIRED|SUPERSEDED|ARCHIVED)\b',r.get('title','')+' '+r.get('status',''),re.I),'Excluded governance source')
        require(r.get('status')=='ACTIVE — GOVERNING' and r.get('retrieved_at') and re.fullmatch('[0-9a-f]{64}',r.get('content_sha256','')),'Unverified current governance receipt')

def hoa_text(hoa):
    require(hoa['status'] in ['yes','no','unknown'],'Invalid HOA state')
    require(hoa['status']!='unknown','Resolve HOA backstage before public handout generation')
    if hoa['status']=='no': return 'No HOA' if hoa.get('show_no_hoa') else ''
    require(isinstance(hoa.get('amount'),(int,float)) and hoa['amount']>=0,'Verified HOA amount required')
    require(hoa.get('frequency') in ['monthly','quarterly','annually'],'Verified HOA frequency required')
    return money(hoa['amount'])+' '+hoa['frequency']

def validate_case(c):
    for k in ['address','city','mls','listing_agent']: require(c['identity'].get(k),f'Missing identity.{k}')
    ev=c['event'];date.fromisoformat(ev['date']);ZoneInfo(ev['timezone'])
    require(datetime.strptime(ev['start'],'%H:%M')<datetime.strptime(ev['end'],'%H:%M'),'Event end must follow start')
    validate_governance(c['governance_receipt'])
    p=c['property'];require(isinstance(p['price'],(int,float)) and p['price']>0,'Positive numeric price required')
    for k in ['beds','baths','bath_detail','sqft','garage','lot']:require(p.get(k) is not None,f'Missing property.{k}')
    hoa_text(p['hoa'])
    require(c['marketing'].get('positioning') and 5<=len(c['marketing']['features'])<=7,'Positioning and 5–7 benefits required')
    i=c['internal'];require(len(i['talking_points'])==5 and len(i['conversation_starters'])==3,'Host needs 5 talking points and 3 starters')
    require(3<=len(i['alternatives'])<=5,'Host needs 3–5 alternatives')
    require(len(i['disclosed'])<=5,'Disclosure skim limited to 5 material host-level items')
    require(i['sources'],'Property provenance required')
    source=i['sources'][0]
    require(str(source.get('mls'))==str(c['identity']['mls']) and source.get('address')==c['identity']['address'],'Source/property identity conflict')
    require(source.get('price')==p['price'],'Source/public price conflict')
    require(source.get('url') and source.get('checked_at'),'Source locator and checked time required')
    require(str(c['media']['mls'])==str(c['identity']['mls']),'Media MLS mismatch')
    require(c['media']['rights'] in ['APPROVED / PERMITTED','NEEDS CONFIRMATION','DO NOT PUBLISH'],'Invalid media permission state')
    for a in i['alternatives']:require(a.get('status')=='Active' and a.get('source') and a.get('checked_at'),'Alternatives need active-source evidence')
    validate_public(' '.join([c['marketing']['positioning']]+[str(v) for pair in c['marketing']['features'] for v in pair]),{})

def select_media(candidates, role):
    viable=[x for x in candidates if role in x.get('roles',[]) and not x.get('excluded') and x.get('source_url')]
    require(viable,f'No usable source image for {role}; Codex should inspect the actual listing set')
    return max(viable,key=lambda x:(x.get('fit',{}).get(role,0),x.get('quality',0),str(x['id'])))

def stage_media(c, case_dir, run):
    assets=run/'assets';assets.mkdir(parents=True)
    originals=run/'source-media';originals.mkdir()
    seen={};records=[];candidates=[]
    for item in c['media']['candidates']:
        src=(case_dir/item['file']).resolve();require(src.is_file(),f'Missing original {src}')
        h=digest(src);require(h==item['sha256'],'Original image hash mismatch')
        im=Image.open(src);im.load()
        require(im.width>=600 and im.height>=400,'Use a practical full-size listing rendition, not a thumbnail')
        if h in seen:continue
        name=f"{slug(str(c['identity']['mls']))}-{slug(str(item['id']))}{src.suffix.lower()}"
        shutil.copy2(src,originals/name);seen[h]=name
        record=dict(item,width=im.width,height=im.height,original=name);records.append(record);candidates.append(record)
    selections={}
    role_map={'EXTERIOR':'exterior','KITCHEN':'kitchen','LIVING':'living','OUTDOOR':'outdoor','REEL':'exterior'}
    # If a room is not photographed, choose the best supported general property view, never a placeholder or invented room.
    for output_role,role in role_map.items():
        actual=role if any(role in x.get('roles',[]) and not x.get('excluded') for x in candidates) else 'exterior'
        item=select_media(candidates,actual);im=ImageOps.exif_transpose(Image.open(originals/item['original']))
        fname='property-'+output_role.lower()+'.jpg'
        ImageOps.fit(im,(1080,800),method=Image.Resampling.LANCZOS,centering=tuple(item.get('focal',[.5,.5]))).save(assets/fname,quality=95)
        selections[output_role]={'file':fname,'original':item['original'],'sha256':item['sha256'],'role':actual,'source_url':item['source_url'],'crop':[1080,800]}
    write(run/'internal/media-provenance.json',{'originals':records,'selections':selections,'rights':c['media']['rights']})
    return selections

def time_label(ev):
    a=datetime.strptime(ev['start'],'%H:%M');b=datetime.strptime(ev['end'],'%H:%M')
    def fmt(t):return t.strftime('%I:%M %p').lstrip('0').replace(':00','')
    return fmt(a)+'–'+fmt(b)

def social_specs(c):
    address=c['identity']['address'];features=c['marketing']['features'];d=date.fromisoformat(c['event']['date'])
    event_copy=c['event']['confirmed'] or c['event'].get('preview_event_copy',False)
    today=datetime.now(ZoneInfo(c['event']['timezone'])).date()==d and c['event']['confirmed']
    rows=[
      ('01-Feed-Announcement','A closer look.',address,'EXTERIOR','',True),
      ('02-Story-Announcement','Come see what fits.',address,'EXTERIOR','story',True),
      ('03-Property-Feature',features[0][0],features[0][1],'KITCHEN','story',True),
      ('04-Property-Poll','What catches your eye?',address,'OUTDOOR','story',False),
      ('05-Event-Reminder','Your next stop.',address,'LIVING','story',True),
      ('06-Day-Reminder','Today: come take a look.' if today else 'Let’s find your fit.','Tell me what matters in your next home.',None,'',True),
      ('07-Reel-Cover','A closer look.',address,'REEL','story reel',True),
      ('08-Relationship','Compare with confidence.','I can help you organize the differences, so you can focus on the home that fits.',None,'',False)]
    result=[]
    for name,title,sub,media,cls,event in rows:
        spec=dict(name=name+'-DRAFT',title=title,sub=sub,cls=cls,event=event)
        if media:spec['media']=media
        if name.startswith(('06','08')):spec.update(blaise_forward=True,host_cta='Tell me what you’re looking for.')
        if name.startswith('04'):spec['poll']=['The gathering spaces','The outdoor setting']
        result.append(spec)
    return result

def normalize(c,case_dir,run,selections):
    p=c['property'];ev=c['event'];ident=c['identity']
    portraits=copy.deepcopy(c['portraits'])
    for item in portraits['candidates']:
        src=Path(item['file']);src=src if src.is_absolute() else (case_dir/src).resolve()
        require(src.is_file() and item.get('source_url') and item.get('approved'),'Approved portrait with provenance required')
        if item.get('sha256'):require(item['sha256']==digest(src),'Portrait hash mismatch')
        filename='portrait-'+slug(item['id'])+src.suffix
        shutil.copy2(src,run/'assets'/filename);item['file']=filename
    choices=recommend(portraits['candidates'],['handout','social_06','social_08'],portraits['recent_ids'])
    write(run/'internal/portrait-usage.json',{'choices':choices,'candidates':portraits['candidates'],'recent_ids':portraits['recent_ids']})
    return dict(slug=slug(ident['address']),address=ident['address'],city=ident['city'],mls=ident['mls'],area_label=ident['city'].split(',')[0],
      brand={'name':'Blaise Smith','phone':'870-692-2205'},sources={'verified_on':c['internal']['sources'][0]['checked_at']},
      listing=dict(price=money(p['price']),beds=str(p['beds']),baths=str(p['baths']),sqft=f"{int(p['sqft']):,}",garage=p['garage'],lot=p['lot'],hoa=hoa_text(p['hoa'])),
      positioning=c['marketing']['positioning'],features=c['marketing']['features'],media={'selections':selections},_assets_dir=str(run/'assets'),
      portraits={'handout':choices['handout']},portrait_selection=portraits,
      public_handout={'approved_required_disclaimer':c['marketing'].get('required_disclaimer'),'disclaimer_source':c['marketing'].get('disclaimer_source')},
      event={'authorized':ev['confirmed'] or ev.get('preview_event_copy',False),'date':date.fromisoformat(ev['date']).strftime('%A, %B %d, %Y'),'time':time_label(ev)},social=social_specs(c))

def render_text_template(name,context):
    text=(ROOT/'templates'/name).read_text(encoding='utf-8')
    for key,value in context.items():text=text.replace('{{'+key+'}}',str(value))
    return text

def route_text(route):
    stops=route['stops']
    if not stops:return 'MAP RESEARCH PENDING — Codex must inspect the actual address and routes. No sign locations invented.'
    require(route.get('map_source') and route.get('checked_at'),'Map provenance required')
    require(len(stops)==5 and sorted(x['order'] for x in stops)==[1,2,3,4,5],'Exactly five unique placement-order stops required')
    require(len({x['location'].lower().strip() for x in stops})==5,'Redundant sign locations')
    for x in stops:
        for key in ['location','arrow','reason','approach','onsite_check']:require(x.get(key),f'Sign missing {key}')
    rows=['| Sign | Location | Arrow (approach) | Reason | Driving order | On-site check |','|---|---|---|---|---:|---|']
    for n,x in enumerate(stops,1):rows.append(f"| {n} | {x['location']} | {x['arrow']} ({x['approach']}) | {x['reason']} | {x['order']} | {x['onsite_check']} |")
    return '\n'.join(rows)+'\n\nMap: '+route['map_source']+'; checked '+route['checked_at']

def internal_outputs(c,run):
    i=c['internal'];ident=c['identity'];ev=c['event'];private=run/'output/internal';private.mkdir(parents=True,exist_ok=True)
    bullet=lambda xs:'\n'.join('- '+str(x) for x in xs) or 'None reported in the bounded source review.'
    alternatives='\n'.join(f"- {a['address']} — {a['price']} · {a['specs']}. {a['difference']} (MLS {a.get('mls','source in register')}; {a['checked_at']})" for a in i['alternatives'])
    context={'address':ident['address'],'mls':ident['mls'],'agent':ident['listing_agent'],'date':ev['date'],'time':time_label(ev),
      'glance':bullet(i['at_a_glance']),'talking':bullet(i['talking_points']),'cautions':bullet(i['do_not_freestyle']+i['source_conflicts']),
      'disclosed':bullet(i['disclosed']),'alternatives':alternatives,'starters':bullet(i['conversation_starters']),
      'access':bullet(i['access']),'route':route_text(c['sign_route'])}
    for name in ['HOST-BRIEF.md','FIVE-SIGN-ROUTE.md','DAY-OF-CHECKLIST.md','REEL-AND-SOCIAL-PLAN.md','LISTING-AGENT-RECAP.md','ATTENDEE-RECONCILIATION.md','DRIVE-FILING.md']:
        (private/name).write_text(render_text_template(name,context),encoding='utf-8')
    # A readable phone reference, not another print PDF.
    blocks=[]
    for title,key in [('Property at a glance','glance'),('5 best talking points','talking'),('Do not freestyle','cautions'),('Useful disclosed knowledge','disclosed'),('Nearby alternatives','alternatives'),('3 natural conversation starters','starters')]:
        blocks.append('<section><h2>'+title+'</h2>'+''.join('<p>'+html.escape(x.removeprefix('- '))+'</p>' for x in context[key].splitlines())+'</section>')
    (private/'Host-Brief.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Internal Host Brief</title><style>body{font:18px/1.5 system-ui;max-width:700px;margin:auto;padding:22px;color:#181816;overflow-wrap:anywhere}h1{font-size:28px}h2{font-size:21px}section{margin:28px 0}p{margin:10px 0}</style><h1>'+html.escape(ident['address'])+'</h1>'+''.join(blocks),encoding='utf-8')
    write(run/'internal/source-register.json',i)
    write(run/'internal/release-state.json',{'event_confirmed':ev['confirmed'],'media_permission':c['media']['rights'],'publication_authorized':False,'sent':False,'scheduled':False,'map_research_complete':bool(c['sign_route']['stops'])})
    write(private/'FILING-MANIFEST.json',{'destination_folder_id':c['recordkeeping']['drive_event_folder_id'],'filed':False,'now':['source-register','source-media','print handout','print blank sign-in'],'after_event':['completed sign-in (restricted)','social actually used','publication proof','listing-agent recap','meaningful learnings'],'never_file_as_event_evidence':['unused drafts','QA contact sheet','invented attendee outcomes']})

def verify(c,run,normalized):
    from pypdf import PdfReader
    import pypdfium2 as pdfium
    manifest=read(run/'output/render-manifest.json');qa=read(run/'render-qa.json')
    require(all(not x['outside'] and not x['overlapping'] and not x.get('collisions') and x['fonts'] and x['images'] for x in qa),'Layout QA failed; inspect render-qa.json')
    prints=list((run/'output/print').glob('*.pdf'));require(len(prints)==2,'Exactly two custom print PDFs')
    for f in prints:
        reader=PdfReader(f);require(len(reader.pages)==1,'Print must be one page')
        box=reader.pages[0].mediabox;require(abs(float(box.width)-612)<1 and abs(float(box.height)-792)<1,'Letter portrait required')
        text=' '.join(reader.pages[0].extract_text().split())
        require(c['identity']['address'] in text and '870-692-2205' in text and 'Buy Sell Home Team' in text,'Brand/property identity inconsistency')
        if 'Handout' in f.name:
            require(normalized['listing']['price'] in text,'Price mismatch')
            h=hoa_text(c['property']['hoa']);require((h in text) if h else 'HOA dues:' not in text,'Conditional HOA display failed')
        else:require('What brought' not in text,'Discovery prompt on sign-in')
        pdfium.PdfDocument(f)[0].render(scale=1.5).to_pil().save(run/'previews'/f'{f.stem}.png')
    for m in manifest:
        source=(run/'output'/m['type']/f"{m['name']}.html").read_text(encoding='utf-8')
        require(not re.search(r'PLACEHOLDER|\{\{|\bNone\b',source),'Unresolved public placeholder')
        validate_public(source,normalized['public_handout'])
        require('remax-results.png' in source,'Brokerage affiliation missing')
        if m['type']=='social':
            im=Image.open(run/'previews'/f"{m['name']}.png");require(im.size==(m['width'],m['height']),'Social dimension mismatch')
    provenance=read(run/'internal/media-provenance.json')
    for x in provenance['originals']:require(digest(run/'source-media'/x['original'])==x['sha256'],'Original altered')
    write(run/'QA.json',{'pass':True,'print_pages':2,'social_assets':len(manifest)-2,'host_sections':6,'originals':len(provenance['originals']),'internal_public_separation':True,'sign_route':'verified-input' if c['sign_route']['stops'] else 'pending map research','no_external_actions':True})

def prepare(path,out,node,render=True):
    path=Path(path).resolve();c=read(path);validate_case(c)
    run=Path(out).resolve();require(not run.exists(),'Use a fresh run directory; never overwrite event records')
    run.mkdir(parents=True);write(run/'internal/case.json',c)
    selections=stage_media(c,path.parent,run);n=normalize(c,path.parent,run,selections)
    write(run/'internal/production.json',n)
    subprocess.run([sys.executable,str(ROOT/'templates/build.py'),'--input',str(run/'internal/production.json'),'--output',str(run/'output')],check=True)
    internal_outputs(c,run)
    if render:
        subprocess.run([node,str(ROOT/'templates/render.cjs'),str(run/'output')],check=True)
        verify(c,run,n)
    return run

def main():
    p=argparse.ArgumentParser(description='Codex-operated Open House Experience production')
    sub=p.add_subparsers(dest='cmd',required=True)
    a=sub.add_parser('init');a.add_argument('--address',required=True);a.add_argument('--mls',required=True);a.add_argument('--agent',required=True);a.add_argument('--date',required=True);a.add_argument('--start',default='13:00');a.add_argument('--end',default='15:00');a.add_argument('--case',required=True)
    a=sub.add_parser('build');a.add_argument('--input',required=True);a.add_argument('--out',required=True);a.add_argument('--node',required=True)
    args=p.parse_args()
    if args.cmd=='init':
        target=Path(args.case);require(not target.exists(),'Case already exists; resume it')
        require(all(x.strip() for x in [args.address,args.mls,args.agent]),'Address, MLS and listing agent must not be blank')
        require(datetime.strptime(args.start,'%H:%M')<datetime.strptime(args.end,'%H:%M'),'Event end must follow start')
        date.fromisoformat(args.date);c=read(ROOT/'templates/case.blank.json')
        c['identity'].update(address=args.address,mls=args.mls,listing_agent=args.agent)
        c['event'].update(date=args.date,start=args.start,end=args.end)
        write(target/'case.json',c)
        shutil.copy2(ROOT/'CODEX-WORKFLOW.md',target/'NEXT-CODEX-STEPS.md')
        write(target/'workflow-state.json',{'stage':'RESEARCH','next_owner':'Codex','resume':'Read NEXT-CODEX-STEPS.md; fill case from current sources, then run build','input_complete':True,'prep_complete':False})
        print(target/'case.json')
    else:print(prepare(args.input,args.out,args.node))
if __name__=='__main__':main()

