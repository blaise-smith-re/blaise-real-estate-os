"""Private print/phone companion using the unchanged approved showing/tour visual utilities."""
from pathlib import Path
import html,json,shutil
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal
from deadlines import readable_due
from engine import ROOT,write
from presentation import brokerage,owner_label
def e(value):return html.escape(str(value))
def p(text,cls=""):return '<p class="'+cls+'">'+e(text)+'</p>'
def section(title,body,cls=""):return '<section class="'+cls+'"><h2>'+e(title)+'</h2>'+body+'</section>'
def source(o):
    x=o["evidence"]
    label=x["version"]+", p. "+str(x["page"])+" · "+x["section"]+" · "+o["label"]
    if o["due"].get("label")=="Derived":label+=" · Derived date"
    if o.get("progress_evidence"):
        proof=o["progress_evidence"]
        label+=". Progress: "+proof["version"]+", p. "+str(proof["page"])+" · "+proof["section"]+" · "+proof["label"]
    return label
def shell(body,phone,title):
    # Pagination moves complete sections only; overflow fails the shared renderer rather than hiding content.
    script="""
<script>
if(document.body.classList.contains('print')){
document.fonts.ready.then(()=>{
 const original=document.querySelector('main'), items=[...original.querySelector('.content').children];
 const template=original.cloneNode(true); template.querySelector('.content').innerHTML='';
 original.querySelector('.content').innerHTML=''; let page=original;
 for(const item of items){
   page.querySelector('.content').appendChild(item);
   if(page.querySelector('.content').getBoundingClientRect().bottom > page.querySelector('footer').getBoundingClientRect().top-8 && page.querySelector('.content').children.length>1){
     item.remove(); const next=template.cloneNode(true); next.querySelector('h1').textContent='Transaction brief · continued'; document.body.appendChild(next);page=next;page.querySelector('.content').appendChild(item);
   }
 }
 document.querySelectorAll('main').forEach((m,i)=>m.querySelector('[data-page]').textContent='Private · '+(i+1)+' / '+document.querySelectorAll('main').length);
 window.transactionReady=true;
});
}else{window.transactionReady=true;}
</script>"""
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(title)+'</title><link rel="stylesheet" href="experience.css"><link rel="stylesheet" href="transaction.css"></head><body class="'+("phone" if phone else "print")+'">'+body+script+'</body></html>'
def generate(r,out):
    out=Path(out);(out/"assets").mkdir()
    assets=ROOT/"assets" if (ROOT/"assets").is_dir() else ROOT.parent/"open-house/templates/assets"
    for name in ("blaise-wordmark.svg","LibreBaskerville.ttf","SourceSans3.ttf"):shutil.copy2(assets/name,out/"assets"/name)
    shared=ROOT/"shared" if (ROOT/"shared").is_dir() else ROOT.parent/"showing-tour"
    shutil.copy2(shared/"experience.css",out/"experience.css");shutil.copy2(ROOT/"transaction.css",out/"transaction.css")
    synthetic=r["mode"]=="synthetic"
    banner="SYNTHETIC DEMONSTRATION · PRIVATE" if synthetic else "PRIVATE TRANSACTION PREPARATION"
    title="Transaction update" if r["changes"] else "Transaction start"
    header='<header><img src="assets/blaise-wordmark.svg" alt="Blaise Smith"><div class="kicker">'+banner+'</div></header>'
    asof=datetime.fromisoformat(r["as_of"]).astimezone(ZoneInfo("America/Chicago"))
    heading='<div class="title"><div><p class="kicker">'+e(r["side"].title()+" side · "+r["client_name"])+'</p><h1>'+title+'</h1>'+p(r["property"]["address"],"subtitle")+p("As of "+asof.strftime("%b %d, %Y · %I:%M %p %Z").replace(" 0"," "),"subtitle")+'</div></div>'
    rec=r["recommendation"]
    body=section("Blaise’s next move",p(rec["text"],"lead")+p(rec["reason"]),"decision")
    state=("Illustrative execution coverage complete" if synthetic else "Executed-source coverage verified") if r["acceptance"]["valid"] else "Executed-source coverage incomplete"
    at=r["acceptance"].get("at")
    acceptance=p(state+" · "+r["acceptance"]["method"])
    if at and r["acceptance"]["valid"]:acceptance+=p("Final acceptance: "+datetime.fromisoformat(at).astimezone(ZoneInfo("America/Chicago")).strftime("%b %d, %Y · %I:%M %p %Z").replace(" 0"," "))
    if not r["acceptance"]["valid"]:acceptance+=p("; ".join(r["acceptance"]["issues"]))
    body+=section("Controlling package",acceptance)
    if r["changes"]:
        lines=[]
        for c in r["changes"]:
            if not c["before"]:
                lines.append(c["title"]+": newly identified obligation; see the source and next step below.")
                continue
            if "due" in c["fields"]:lines.append(c["title"]+": "+readable_due(c["before"]["due"])+" → "+readable_due(c["after"]["due"]))
            if "progress" in c["fields"]:lines.append(c["title"]+": "+str(c["before"]["progress"])+" → "+str(c["after"]["progress"]))
            if not any(k in c["fields"] for k in ("due","progress")):lines.append(c["title"]+": owner or controlling evidence updated; details in private provenance.")
        body+=section("What changed",''.join(p(x) for x in lines))
    for o in r["obligations"]:
        value=Decimal(o["amount"]) if o.get("amount") is not None else None
        amount=(" · $"+format(value,",.0f" if value==value.to_integral_value() else ",.2f")) if value is not None else ""
        detail=p(readable_due(o["due"])+amount,"factline")
        detail+=p("Contract responsibility: "+(o["responsible_party"] if o["controlling"] else "To verify from executed evidence")+" · Follow-through: "+owner_label(o,r)+" ("+o["owner_status"]+")")
        detail+=p(o["progress"]+(" · "+o["next_action"] if o["progress"] not in ("Completed","Received","Delegated") else " · No duplicate Blaise task"))
        detail+=p(source(o),"source")
        body+=section(o["title"],detail,"obligation")
    if r["holds"]:body+=section("Resolve before relying on it",''.join(p(x) for x in r["holds"]),"control")
    if r["updates"]:body+=section("Latest source updates",''.join(p(x["summary"]+" · "+x["label"]) for x in r["updates"]))
    people=[]
    for person in r["people"]:
        role={"tc":"Transaction coordinator","client":r["side"].title()+" client","lender":"Lender","title":"Title / closing"}[person["role"]]
        people.append(p(role+": "+(person.get("name") if person["assignment_status"]=="assigned" else "To confirm")+" · "+person["assignment_status"]))
    body+=section("People and handoffs",''.join(people)+p("Recipient drafts are separate and unsent. Confirm missing routing before use."))
    calendar="SYNTHETIC — DO NOT ADD TO CALENDAR" if synthetic else ("ADD TO CALENDAR" if r["calendar_advisories"] else "No verified Calendar advisory")
    body+=section(calendar,p("Use the dates, sources and owners shown above; confirm any missing time. No event, reminder or monitoring has been created.") if r["calendar_advisories"] else p("Dependent terms remain unresolved. No Calendar event or reminder was created."))
    footer='<footer><div>'+e(brokerage(r['business_identity'],'public_footer'))+'<br>Blaise Smith · 870-692-2205</div><div data-page>Private · for Blaise’s review</div></footer>'
    contents='<main class="padfolio transaction">'+header+heading+'<div class="content">'+body+'</div>'+footer+'</main>'
    manifest=[]
    for mode in ("Print","Phone"):
        file="Transaction-Brief-"+mode+".html";(out/file).write_text(shell(contents,mode=="Phone",title),encoding="utf-8");manifest.append({"file":file,"kind":mode.lower()})
    write(out/"render-manifest.json",manifest)
