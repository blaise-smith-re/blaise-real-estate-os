"""Five-section private Padfolio, using approved open-house fonts/wordmark/tokens."""
from pathlib import Path
import html, json, shutil
from engine import ROOT, facts_for, showing_for, time_line, advisories, write, require

def esc(v): return html.escape(str(v))
def money(v): return "Unknown" if v is None else "$" + f"{v:,.0f}"
def line(label, value): return "<p><b>" + esc(label) + "</b> " + esc(value) + "</p>"
def bullets(items): return "<ul>" + "".join("<li>" + esc(v) + "</li>" for v in items) + "</ul>"
def source_label(label): return {"verified MLS":"MLS", "public record":"Public record", "listing-reported":"Listing-reported", "unknown":"To verify"}.get(label, label)
def fact(facts, key, currency=False):
    f = facts.get(key, {"value":None,"label":"unknown"})
    value = money(f["value"]) if currency else ("Unknown" if f["value"] is None else str(f["value"]))
    return value + (" · CONFLICT" if f.get("reason","").startswith("CONFLICT") else "") + " [" + source_label(f["label"]) + "]"
def section(n, title, content, cls=""):
    return '<section class="' + cls + '"><h2><span>' + n + "</span>" + title + "</h2>" + content + "</section>"
def shell(title, content, mobile=False):
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title><link rel="stylesheet" href="experience.css"></head><body class="' + ("phone" if mobile else "print") + '">' + content + "</body></html>"

def page(c,p,sources,result=None):
    buyer=c["buyer"]; facts=facts_for(p,sources); ev=showing_for(p)
    feedback=next((x for x in result["feedback"] if x["property_id"]==p["id"]),None) if result else None
    tag="SYNTHETIC DEMONSTRATION · PRIVATE" if c["mode"]=="synthetic" else "PRIVATE · BLAISE ONLY"
    body='<main class="padfolio"><header><img src="assets/blaise-wordmark.svg" alt="Blaise Smith"><p class="kicker">'+tag+'</p></header>'
    body+='<div class="title"><div><p class="kicker">Showing & Tour · '+("After the tour" if result else "Before the tour")+'</p><h1>'+esc(p["address"])+'</h1><p class="subtitle">'+esc(p["city"])+' · MLS '+esc(p["mls"])+'</p></div><div class="price">'+esc(fact(facts,"price",True))+'</div></div>'
    controls=line("Buyer",buyer["name"]+" · "+buyer["id"])+line("Showing",ev["status"].upper()+" · "+time_line(ev))
    controls+=line("Documents",c["document_check"]["display"])+line("Representation",buyer.get("representation","Unknown — verify current originals."))+line("Contact",buyer["preferred_channel"]+" · "+buyer["channel_note"])
    body+=section("01","Buyer & tour control",controls,"control two-col")
    relationship=line("Why now",buyer["why_now"])+line("Priorities", "; ".join(buyer["priorities"]))
    relationship+=line("Tradeoffs",buyer["tradeoffs"])+line("People",buyer["decision_makers"])
    relationship+=line("Financing",buyer["financing"])+line("Budget",buyer["comfortable_budget"]+" · "+buyer["lender_approval"])
    relationship+=line("Latest",buyer["latest_event"])
    body+=section("02","Relationship at a glance",relationship,"two-col")
    property_copy='<div class="factline">'+esc(fact(facts,"beds")+" beds · "+fact(facts,"bath_detail")+" · "+fact(facts,"sqft")+" sq ft")+'</div>'
    property_copy+=line("Home",fact(facts,"home"))+line("History",fact(facts,"history"))
    property_copy+=line("Costs", "HOA: "+fact(facts,"hoa")+" · Taxes: "+fact(facts,"taxes")+" · Assessments: "+fact(facts,"assessments"))
    property_copy+=line("Updates",fact(facts,"updates"))+line("Disclosures",fact(facts,"disclosures"))
    property_copy+=line("Fit",p["fit"])+line("Agent insight",p["agent_intel"])
    property_copy+='<div class="concerns">'+line("Do not overlook", " ".join(x["text"]+" ["+x["label"]+"]" for x in p["concerns"]))+'</div>'
    body+=section("03","Property quick read",property_copy)
    walk=line("Observe","; ".join(p["walk"]))+line("Ask"," ".join(p["questions"]))+line("Open",p["opening"])
    if p.get("alternative"):walk+=line("Useful comparison",p["alternative"])
    body+=section("04","Walk-in plan",walk)
    if feedback:
        decision=line("Buyer’s response",feedback["summary"])
        decision+="".join(line(claim["label"].capitalize(),claim["text"]) for claim in feedback["claims"] if claim["label"]!="buyer-confirmed")
        learned=[x["field"]+": "+str(x["value"])+" ("+x["treatment"]+", proposed)" for x in result["criteria_changes"] if x["treatment"]=="filter"]
        if learned:decision+=line("Criteria learned","; ".join(learned))
        decision+=line("Next move",result["recommendation"]["text"])
        commitments=[x["text"]+" — "+x["owner"]+(" · "+x["due"] if x.get("due") else " · no date agreed") for x in result["commitments"]]
        decision+=line("Commitment","; ".join(commitments) if commitments else "None agreed; no automatic follow-up task.")
    else:
        decision=line("Listen for",p["decision_prompt"])+line("Next move",p["pre_recommendation"])+line("Commitment","Capture only what is actually agreed, with owner and date if agreed.")
    body+=section("05","Leave with a decision",decision,"decision")
    body+='<footer><div>Private evidence: private-working.json.<br>Access: authorized showing source only.</div><div>Blaise Smith · 870-692-2205<br>Buy Sell Home Team · RE/MAX Results</div></footer></main>'
    return body

def debrief_html(c,r):
    tag="SYNTHETIC DEMONSTRATION · PRIVATE" if c["mode"]=="synthetic" else "PRIVATE"
    body='<main class="notes"><p class="kicker">'+tag+'</p><h1>After the showing</h1><p class="lead">'+esc(r["recommendation"]["text"])+'</p>'
    for f in r["feedback"]:
        p=next(x for x in c["properties"] if x["id"]==f["property_id"])
        body+='<section><h2>'+esc(p["address"])+'</h2>'+line("Buyer response",f["summary"])
        for claim in f["claims"]:body+=line(claim["label"].capitalize(),claim["text"])
        body+='</section>'
    body+='<section><h2>Search changes to review</h2>'
    for x in r["criteria_changes"]:
        body+=line(x["field"]+" · "+x["treatment"],str(x["before"])+" → "+str(x["value"]))+line("Why",x["reason"])
    if not r["criteria_changes"]:body+='<p>No useful search changes supported by these notes.</p>'
    body+='<p class="status">Proposals only. Existing alert: '+esc(c["search"]["alert_status"]+" · "+c["search"]["frequency"])+'</p></section>'
    body+='<section><h2>Personal follow-up</h2>'
    if r["followup"]:
        body+=line("Status",r["followup"]["status"])
        if r["followup"]["text"]:body+='<blockquote>'+esc(r["followup"]["text"])+'</blockquote>'
    else:body+='<p>No follow-up draft is useful yet.</p>'
    body+=line("Automation",r["automation_overlap"])+'</section>'
    body+='<section><h2>Internal next steps</h2>'+line("FUB",r["fub"]["status"]+" · "+str(len(r["fub"]["tasks"]))+" proposed tasks")
    if r["offer_handoffs"]:body+='<p>Serious interest: start the existing <a href="'+esc(c["links"]["offer_strategy"])+'">Property & Offer Strategy</a> before discussing an offer price.</p>'
    body+=bullets(r["ylopo"]["handoff"])+'</section>'
    body+='<p class="status">No CRM, alert, Calendar, message or booking action has occurred. Evidence quotations and exact proposed fields are in debrief-proposals.json.</p></main>'
    return shell("Private showing debrief",body,True)

def generate(c,sources,selected,output,result=None):
    output=Path(output).resolve()
    require(not output.exists(),"Use a fresh output directory; preserve the prior case")
    checkout=next((p for p in (ROOT,*ROOT.parents) if (p/".git").exists()),None)
    require(not output.is_relative_to(checkout or ROOT),"Case outputs must stay outside the repository or portable source directory")
    output.mkdir(parents=True); (output/"assets").mkdir()
    assets=ROOT/"assets" if (ROOT/"assets").is_dir() else ROOT.parent/"open-house/templates/assets"
    for name in ("blaise-wordmark.svg","LibreBaskerville.ttf","SourceSans3.ttf"):
        shutil.copy2(assets/name,output/"assets"/name)
    shutil.copy2(ROOT/"experience.css",output/"experience.css")
    props=[next(p for p in c["properties"] if p["id"]==pid) for pid in c["tour_order"] if pid in selected]
    print_pages=[]; manifest=[]
    for n,p in enumerate(props,1):
        body=page(c,p,sources,result)
        name=f"{n:02d}-Private-Padfolio"
        for mode in ("Print","Phone"):
            filename=name+"-"+mode+".html"
            (output/filename).write_text(shell(p["address"]+" · Private",body,mode=="Phone"),encoding="utf-8")
            manifest.append({"file":filename,"kind":mode.lower(),"property_id":p["id"]})
        print_pages.append(body)
    (output/"Private-Padfolio-Print.html").write_text(shell("Private tour briefs","".join(print_pages)),encoding="utf-8")
    manifest.append({"file":"Private-Padfolio-Print.html","kind":"combined"})
    if result:
        write(output/"debrief-proposals.json",result)
        (output/"Private-Debrief.html").write_text(debrief_html(c,result),encoding="utf-8")
        manifest.append({"file":"Private-Debrief.html","kind":"recap"})
        followup=result["followup"]
        (output/"Personal-Followup-DRAFT.txt").write_text(("SYNTHETIC DEMONSTRATION · PRIVATE\n" if c["mode"]=="synthetic" else "")+(followup["status"]+"\n"+(followup["text"] or "") if followup else "No draft.")+"\nNo message sent.",encoding="utf-8")
    index='<main class="notes"><p class="kicker">'+("SYNTHETIC DEMONSTRATION · " if c["mode"]=="synthetic" else "")+'PRIVATE</p><h1>Your tour, at a glance</h1>'
    index+=line("Buyer",c["buyer"]["name"])+line("Order",c["route_note"])+line("Calendar",c["calendar"]["coverage_note"])
    for n,p in enumerate(props,1):
        ev=showing_for(p)
        index+='<section><h2>'+str(n)+". "+esc(p["address"])+'</h2><p>'+esc(ev["status"].upper()+" · "+time_line(ev))+'</p><p><a href="'+f"{n:02d}-Private-Padfolio-Phone.html"+'">Open phone brief</a></p></section>'
    if c["first_showing"]:
        index+='<section><h2>Existing Buyer Roadmap</h2><p>Offer this when useful; it is not homework or proof of representation.</p><p><a href="'+esc(c["links"]["roadmap_print"])+'">Approved print Roadmap</a> · <a href="'+esc(c["links"]["roadmap_mobile"])+'">Approved mobile Roadmap</a></p></section>'
    if result:index+='<section><a href="Private-Debrief.html">Read the debrief and draft</a></section>'
    index+='</main>'
    (output/"START-HERE-Private.html").write_text(shell("Private tour order",index,True),encoding="utf-8")
    manifest.append({"file":"START-HERE-Private.html","kind":"index"})
    write(output/"render-manifest.json",manifest)
    write(output/"private-working.json",{"case":c,"selected":selected,"resolved_facts":{p["id"]:facts_for(p,sources) for p in props},
        "calendar_advisories":advisories(c,selected),"scope":"PRIVATE — links/evidence, no access credentials; synthetic when labeled",
        "document_gate":c["document_check"],"external_effects":False})
    return {"output":str(output),"properties":len(props),"phase":"debrief" if result else "prepare","external_actions":0}
