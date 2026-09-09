from pathlib import Path
import json, html, shutil, argparse
from portrait_selection import recommend
from public_copy import validate_public
ROOT=Path(__file__).resolve().parents[1]
def e(x): return html.escape(str(x))
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--input',required=True); ap.add_argument('--output',required=True)
    args=ap.parse_args(); p=json.loads(Path(args.input).read_text(encoding='utf-8')); out=Path(args.output)
    selection=p.get("portrait_selection")
    if selection:
        choices=recommend(selection["candidates"],["handout","social_06","social_08"],selection.get("recent_ids",[]))
        p["portraits"]["handout"]=choices["handout"]
        for spec in p["social"]:
            if spec.get("blaise_forward"): spec["portrait"]=choices["social_"+spec["name"][:2]]
    # Rendering never publishes; event copy is conditional on recorded confirmation.
    assert len(p['features']) in range(5,8), 'Handout needs 5–7 verified highlights'

    for sub in ['print','social','internal','masters']: (out/sub).mkdir(parents=True,exist_ok=True)
    css=(ROOT/'templates/experience.css').read_text(encoding='utf-8')
    for sub in ['print','social','internal','masters']:
        shutil.copytree(ROOT/'templates/assets',out/sub/'assets',dirs_exist_ok=True,ignore=shutil.ignore_patterns('blaise-portrait.jpg','portrait-*','property-*') if sub in ['internal','masters'] else None)
        if sub in ['print','social']: shutil.copytree(p['_assets_dir'],out/sub/'assets',dirs_exist_ok=True)
        (out/sub/'experience.css').write_text(css,encoding='utf-8')
    name=e(p['brand']['name']); phone=e(p['brand']['phone']); address=e(p['address']); city=e(p['city']); L=p['listing']; ev=p['event']
    def brand(label): return f'<header class="brand"><img src="assets/blaise-wordmark.svg" alt="Blaise Smith Real Estate"><div class="eyebrow">{label}</div></header>'
    def foot(private=False,generic=False): return f'<footer class="footer"><div class="foot-top"><span>{"INTERNAL · DRAFT FOR REVIEW" if private else "Blaise Smith · Call or text "+phone}</span><span>{"MLS "+e(p["mls"])+" · "+e(p["sources"]["verified_on"]) if private and not generic else "Reusable template · Draft" if generic else ""}</span></div><div class="affiliation"><span>Buy Sell Home Team</span><img src="assets/remax-results.png" alt="RE/MAX Results"></div></footer>'
    def hold(): return ''
    def photo(label='HANDOUT'):
        if label=='HANDOUT':
            return '<div class="hero handout-photos">'+''.join(f'<img src="assets/{e(p['media']['selections'][key]['file'])}" alt="{key.title()} at {address}">' for key in ['EXTERIOR','KITCHEN'])+'</div>'
        asset=p['media']['selections'][label]['file']
        return f'<div class="hero"><img src="assets/{e(asset)}" alt="{e(label.title())} at {address}"></div>'
    manifest=[]
    def save(slug,body,cls='',social=False,folder_override=None):
        if social and 'class="event-line"' in body: cls+=' event-promotion'
        folder=folder_override or ('social' if social else 'print')
        if folder in ['print','social']:
            validate_public(body,p.get('public_handout',{}))
        s='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+e(slug)+'</title><link rel="stylesheet" href="experience.css"></head><body><main class="'+('social ' if social else 'digital ' if folder=='internal' else 'page ')+cls+'">'+body+'</main></body></html>'
        (out/folder/f'{slug}.html').write_text(s,encoding='utf-8')
        if folder in ['internal','masters']: return
        manifest.append({'name':slug,'type':folder,'width':1080 if social else 816,'height':1920 if 'story' in cls else 1350 if social else 1056})
    specs=[(L['beds'],'bedrooms'),(L['baths'],'bathrooms'),(L['sqft'],'finished sqft'),(L['garage'],'garage'),(L['lot'],'lot')]
    hoa_display=e(L['hoa']) if L.get('hoa') else ''
    hoa_line=f'<p class="hoa-dues">{hoa_display if hoa_display=="No HOA" else "HOA dues: "+hoa_display}</p>' if hoa_display else ''
    body=brand('A closer look · '+e(p['area_label']))
    body+=f'<div class="address-price"><div><h1>{address}</h1><p class="sub">{city}</p></div><div><div class="price">{e(L["price"])}</div>{hoa_line}</div></div>'
    body+=photo()+ '<div class="stats">'+''.join(f'<div><b>{e(a)}</b><span>{e(b)}</span></div>' for a,b in specs)+'</div>'
    body+=f'<p class="lede">{e(p["positioning"])}</p><div class="features">'
    body+=''.join(f'<section><h3>{e(a)}</h3><p>{e(b)}</p></section>' for a,b in p['features'])+'</div>'
    # Public handout never consumes internal source or caution fields.
    disclaimer=p.get('public_handout',{}).get('approved_required_disclaimer')
    if disclaimer:
        assert p['public_handout'].get('disclaimer_source'), 'Approved disclaimer needs current source provenance'
        body+=f'<p class="required-disclaimer">{e(disclaimer)}</p>'
    body+=foot()
    body=body.replace('Blaise Smith · Call or text '+phone,'Questions about this property?')
    body+=f'<div class="presenter"><div class="presenter-photo"><img src="assets/{e(p['portraits']['handout'])}" alt="Blaise Smith"></div><div><div class="eyebrow">Presented by</div><h2>Blaise Smith</h2><p>Let’s talk about what fits your search.</p></div><div class="presenter-contact"><span>Call or text Blaise</span><a href="tel:{phone}">{phone}</a></div></div>'
    save(p['slug']+'-Property-Handout-DRAFT',body,'handout')
    for generic in [False,True]:
        b=brand('Come in. Take your time.')
        b+=f'<h1>WELCOME</h1><p class="sub">{"Property: __________________________________" if generic else address}</p><p class="welcome-copy">Glad you stopped by. Share the contact details you are comfortable sharing.</p>'
        b+='<table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Working with<br>an agent?</th></tr></thead><tbody>'+''.join('<tr><td></td><td></td><td></td><td>Y / N</td></tr>' for _ in range(9))+'</tbody></table>'

        b+='' if not generic else '<p class="small" style="margin-top:18px">Reusable template · Staff: keep completed sheets discreet; use another page as needed.</p>'
        b+=foot(generic=generic)
        save('Generic-Sign-In-TEMPLATE' if generic else p['slug']+'-Sign-In-DRAFT',b,'signin',folder_override='masters' if generic else 'print')
    def hostcreative(spec,title,sub):
        treatment='Hosted by' if ev['authorized'] and spec.get('event',True) else 'Meet'
        b=brand('OPEN HOUSE' if ev['authorized'] and spec.get('event',True) else 'A personal point of view')+f'<h1>{e(title)}</h1>'
        b+=f'<div class="host-social"><div class="host-portrait"><img src="assets/{e(spec['portrait'])}" alt="Blaise Smith"></div><div class="host-message"><div class="eyebrow">{treatment}</div><h2>Blaise Smith</h2><p>{e(sub)}</p><p class="host-property">{address}<br>{city}</p></div></div>'
        b+=f'<div class="host-cta"><p>{e(spec.get("host_cta","Tell me what matters in your next home."))}</p><a href="tel:{phone}">Call or text {phone}</a></div>'
        if ev['authorized'] and spec.get('event',True):b+=f'<p class="event-line">{e(ev["date"])} · {e(ev["time"])}</p>'
        return b+socialfoot()
    def socialfoot(): return '<footer class="social-footer"><span>Blaise Smith · '+phone+'<br>Buy Sell Home Team</span><img src="assets/remax-results.png" alt="RE/MAX Results"></footer>'
    def social(title,sub,media=None,event=True,extra='',cls='',price=False):
        b=brand('OPEN HOUSE' if ev['authorized'] and event else 'A closer look')+f'<h1>{e(title)}</h1>'
        if media:b+=photo(media)
        b+=f'<p class="sub">{e(sub)}</p>'+extra
        if event and ev['authorized']:b+=f'<p class="event-line">{e(ev["date"])}<br>{e(ev["time"])} · {address}</p>'
        if price:b+=f'<p class="small">{e(L["price"])}</p>'
        return b+socialfoot()
    for spec in p['social']:
        extra=''
        if spec.get('poll'): extra+='<div class="poll">'+''.join('<span>'+e(x)+'</span>' for x in spec['poll'])+'</div>'
        if spec.get('quote'): extra+='<div class="paperquote"><p class="sub">'+e(spec['quote'])+'</p></div>'
        if spec.get('cta'): extra+='<p class="sub">'+e(spec['cta'])+'</p>'
        # Operational notes belong to the source file only.
        title=spec['title'] if ev['authorized'] else spec.get('neutral_title',spec['title'])
        sub=spec['sub'] if ev['authorized'] else spec.get('neutral_sub',spec['sub'])
        if spec.get('blaise_forward'):
            save(spec['name'].replace('-HOLD','-DRAFT'),hostcreative(spec,title,sub),'blaise-forward',True)
        else:
            save(spec['name'].replace('-HOLD','-DRAFT'),social(title,sub,spec.get('media'),spec.get('event',True),extra,price=spec.get('price',False)),spec['cls'],True)
    (out/'render-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(f'Built {len(manifest)} editable HTML drafts at {out}')
if __name__=='__main__':main()

