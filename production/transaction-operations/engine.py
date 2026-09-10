"""Agent-operated accepted-contract preparation; no writer, database or background process."""
from pathlib import Path
import argparse, copy, hashlib, json, re
from datetime import datetime
from decimal import Decimal
from dateutil.parser import parse as parse_date
from sources import Sources, EvidenceError, require, normalized, timestamp, digest, source_date, source_instant
from deadlines import calculate, readable_due
from presentation import resolve_identity,brokerage,party_bindings,client_actions,MILESTONES,SPECIALIST_KINDS
ROOT=Path(__file__).resolve().parent
def read(p):return json.loads(Path(p).read_text(encoding="utf-8"))
def write(p,obj):Path(p).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
def fingerprint(obj):return digest(json.dumps(obj,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode())
def evidence(ref,src):return src.cite(ref) if ref else None

def assess_document(doc,case,src):
    s=src.review(doc); issues=[]
    if not s["review_complete"]:issues.append("All pages have not been reviewed; verify remaining pages")
    require(doc.get("kind") in ("agreement","amendment","attachment"),"Unsupported controlling-document kind")
    require(doc.get("status") in ("executed","draft","unknown"),"Unknown execution state")
    require(doc["property_id"]==case["property"]["id"] and set(doc["party_ids"])==set(case["party_ids"]),"Wrong property or parties")
    identity=src.cite(doc["identity"])
    require(case["property"]["address"] in identity["quote"],"Property identity not in cited original")
    for party in case["party_names"]:require(party in identity["quote"],"Party identity not in cited original")
    refs=[identity,src.cite(doc["execution_requirements"])]
    if doc["status"]!="executed":issues.append("Execution is "+doc["status"]+"; not controlling")
    checks=doc.get("completion",{})
    for name in ("signatures","initials","dates","acceptance","delivery","amendment_coverage"):
        check=checks.get(name)
        if not check or check.get("confirmed") is not True or not check.get("evidence"):
            issues.append(name.replace("_"," ")+" coverage missing")
        else:refs.append(src.cite(check["evidence"]))
    if set(doc.get("signer_ids",[]))!=set(case["party_ids"]):issues.append("Required signer coverage incomplete")
    at=doc.get("accepted_at")
    if at:
        timestamp(at)
        acc=checks.get("acceptance",{}).get("evidence")
        source_text=doc.get("accepted_text",at)
        if not acc or source_text not in acc["quote"] or source_instant(source_text,doc.get("acceptance_timezone",case["timezone"]))!=timestamp(at):issues.append("Final acceptance instant not supported by cited acceptance evidence")
        if timestamp(at)>timestamp(case["as_of"]):issues.append("Acceptance is later than the review as-of time")
    else:issues.append("Final acceptance instant unknown")
    for incorporated in doc.get("incorporates",[]):refs.append(src.cite(incorporated["evidence"]))
    method="Human-verified" if s["pages"] is None else "Source-read"
    return {"id":doc["id"],"valid":not issues,"issues":issues,"at":at,"method":method,"evidence":refs}

def safe_amount(item,src):
    if item.get("amount") is None:return None
    value=Decimal(str(item["amount"]));require(value>=0,"Negative obligation amount")
    ref=src.cite(item["amount_evidence"])
    text=item["amount_text"];require(text in ref["quote"],"Amount text missing from cited evidence")
    require(Decimal(re.sub(r"[$,\s]","",text))==value,"Amount differs from cited source text")
    return str(value)

def reconcile(case,analysis,source_dir,previous=None):
    require(case["id"]==analysis["case_id"],"Analysis belongs to another transaction")
    require(case.get("side") in ("buyer","seller"),"Side required")
    require(case.get("mode") in ("synthetic","live"),"Explicit synthetic/live mode required")
    require(case.get("client",{}).get("id") and case["client"].get("name"),"Exact client identity required")
    identity=resolve_identity(case);parties=party_bindings(case)
    timestamp(case["as_of"])
    require(case.get("timezone")=="America/Chicago","Resolve Minnesota business timezone explicitly")
    src=Sources(source_dir,case["sources"],case["mode"]=="synthetic")
    docs={d["id"]:d for d in analysis["documents"]}
    require(len(docs)==len(analysis["documents"]),"Duplicate document ID")
    assessment={did:assess_document(d,case,src) for did,d in docs.items()}
    base=docs.get(analysis["base_document"])
    require(base and base["kind"]=="agreement","Exact base agreement required")
    base_status=assessment[base["id"]]
    missing=[i["id"] for i in base.get("incorporates",[]) if i["id"] not in docs or not assessment[i["id"]]["valid"]]
    base_status=copy.deepcopy(base_status)
    if missing:base_status["valid"]=False;base_status["issues"].append("Incorporated documents incomplete: "+", ".join(missing))
    holds=list(base_status["issues"]); anchors={}
    if base_status["valid"]:anchors["acceptance"]={"at":base["accepted_at"],"verified":True,"label":base_status["method"]}
    for a in analysis.get("anchors",[]):
        cited=src.cite(a["evidence"])
        require(a["at"] in cited["quote"],"Anchor instant not in evidence")
        require(a["id"]!="acceptance","Do not overwrite final acceptance anchor")
        anchors[a["id"]]={"at":a["at"],"verified":a["status"]=="verified","label":cited["label"]}
    current={}; chronology=[]; conflicts=set()
    for item in sorted(analysis["obligations"],key=lambda x:timestamp(docs[x["document"]]["accepted_at"]) if docs[x["document"]].get("accepted_at") else timestamp("1900-01-01T00:00:00+00:00")):
        doc=docs[item["document"]]; check=assessment[doc["id"]]
        require(item["evidence"]["source"]==doc["source"] and item["due"]["evidence"]["source"]==doc["source"],"Term evidence must belong to its controlling document")
        ref=src.cite(item["evidence"])
        amount=safe_amount(item,src)
        require(item.get("responsible_party") and item.get("next_action") and item.get("title"),"Obligation responsibility and next action required")
        require(item.get("kind") in ("earnest_money","inspection","closing","possession","financing","title","other"),"Obligation kind required")
        src.cite(item["due"]["evidence"])
        rule=item["due"]; rule_quote=rule["evidence"]["quote"]
        if rule.get("type")=="fixed":
            date_text=rule.get("date_text",rule["date"])
            require(date_text in rule_quote and source_date(date_text).isoformat()==rule["date"],"Due date differs from cited source text")
        if rule.get("type")=="relative":
            number=rule.get("days_text",str(rule.get("days")))
            require(re.search(r"(?<!\d)"+re.escape(number)+r"(?!\d)",rule_quote) and int(number)==rule.get("days"),"Day count differs from cited source text")
            for unit in ("calendar","business"):
                if unit+" days" in rule_quote.lower():require(rule.get("unit")==unit,"Day-count basis contradicts the source")
            if "exclude acceptance date" in rule_quote.lower():require(rule.get("include_anchor") is False,"Trigger-date counting contradicts source")
        if rule.get("time"):
            time_text=rule.get("time_text",rule["time"])
            require(time_text in rule_quote and parse_date(time_text).time().isoformat(timespec="minutes")==rule["time"],"Due time differs from cited source text")
        require(item.get("owner_status") in ("assigned","proposed","unknown"),"Assignment state must be explicit")
        valid=base_status["valid"] and check["valid"]
        supersedes=item.get("supersedes")
        old=current.get(item["id"])
        if doc["kind"]=="amendment" and (not old or supersedes!=old["document"]):
            valid=False
            if check["valid"]:conflicts.add(item["id"]);holds.append(item["title"]+": amendment predecessor is unresolved")
        event={"obligation":item["id"],"document":doc["id"],"accepted_at":doc.get("accepted_at"),"applied":valid,"evidence":ref,"reason":None if valid else "Unverified execution, package coverage or amendment chain"}
        chronology.append(event)
        if not valid:
            if old:continue
            if doc["kind"]=="amendment":continue
        elif old and doc["kind"]!="amendment":
            conflicts.add(item["id"]);holds.append(item["title"]+": conflicting controlling obligations")
            continue
        entry=copy.deepcopy(item)
        entry["audience_actions"]=client_actions(item,case,src)
        due=calculate(item["due"],anchors) if valid else {"date":None,"at":None,"timezone":item["due"].get("timezone"),"label":"Unknown","hold":"Verify controlling executed package","explanation":None}
        if valid and item["due"].get("evidence"):src.cite(item["due"]["evidence"])
        entry.update(amount=amount if valid else None,label=check["method"] if valid else "Unknown",due=due,evidence=ref,controlling=valid,progress="Open",progress_evidence=None)
        if not valid:entry["next_action"]="Verify the controlling original before acting on this term"
        current[item["id"]]=entry
    for oid in conflicts:
        if oid in current:current[oid].update(controlling=False,label="Unknown",due={"date":None,"at":None,"timezone":case["timezone"],"label":"Unknown","hold":"Conflicting controlling terms","explanation":None})
    updates=[]
    for update in sorted(analysis.get("updates",[]),key=lambda x:timestamp(x["at"])):
        require(timestamp(update["at"])<=timestamp(case["as_of"]),"Future update cannot be completed as of this review")
        require(update["obligation"] in current,"Update targets an unknown obligation")
        entry=current[update["obligation"]];ref=src.cite(update["evidence"])
        require(update["status"] in ("reported","completed","delegated","sent","received"),"Unsupported progress status")
        require(update.get("source_role") and update.get("summary"),"Update source role and summary required")
        require(case["property"]["id"]==update["property_id"],"Update belongs to another property")
        # Progress evidence never changes an executed term or supplies a deadline.
        if update["status"]!="reported":
            require(update.get("verified_source") is True and update.get("source_kind") in ("system_record","original_confirmation","human_original"),"Draft or unverified update cannot establish completion")
            entry["progress"]=update["status"].capitalize();entry["progress_evidence"]=ref
            if update["status"]=="delegated":
                require(update.get("owner"),"Delegation needs an actual owner");entry["owner"]=update["owner"];entry["owner_status"]="assigned"
        else:
            updates.append({"title":entry["title"],"summary":update["summary"],"label":"Reported","evidence":ref})
        if update.get("claimed_due") and update["claimed_due"]!=entry["due"].get("date"):
            holds.append(entry["title"]+": reported date differs from controlling evidence; verify the executed change")
        if update.get("claimed_due") is None and update["status"]!="reported":
            updates.append({"title":entry["title"],"summary":update["summary"],"label":ref["label"],"evidence":ref})
    obligations=list(current.values())
    obligations.sort(key=lambda x:(x["progress"] in ("Completed","Received"),x["due"].get("date") or "9999",x["id"]))
    for o in obligations:
        if o["controlling"] and o["due"].get("hold"):holds.append(o["title"]+": "+o["due"]["hold"])
        if o["owner_status"]!="assigned" and o["progress"] not in ("Completed","Received"):holds.append(o["title"]+": confirm follow-through owner and role")
        if o["controlling"] and o["progress"] not in ("Completed","Received") and o["due"].get("at") and timestamp(o["due"]["at"])<timestamp(case["as_of"]):holds.append(o["title"]+": due time has passed without verified completion; contact the responsible owner")
    changes=[]
    if previous:
        require(previous["case_id"]==case["id"] and previous["client_id"]==case["client"]["id"],"Previous output is a different case/client")
        old={o["id"]:o for o in previous["obligations"]}
        for o in obligations:
            prior=old.get(o["id"])
            fields=("document","amount","due","progress","owner","owner_status","controlling")
            changed=[f for f in fields if not prior or o.get(f)!=prior.get(f)]
            if changed:changes.append({"id":o["id"],"title":o["title"],"fields":changed,"before":{f:prior.get(f) for f in changed} if prior else None,"after":{f:o.get(f) for f in changed}})
        removed=set(old)-set(current)
        require(not removed,"Prior obligations disappeared; carry originals forward and explicitly reconcile termination")
    assigned=case.get("people",[])
    for person in assigned:
        require(person["assignment_status"] in ("assigned","proposed","unknown"),"Person assignment status required")
        if person["assignment_status"]=="assigned":src.cite(person["evidence"])
    unresolved=[p for p in assigned if p["assignment_status"]!="assigned"]
    for p in unresolved:holds.append(p["role"].replace("_"," ").title()+": assignment or routing to confirm")
    holds=list(dict.fromkeys(holds))
    priorities=[]
    for o in obligations:
        if o["progress"] in ("Completed","Received","Delegated"):continue
        if o["controlling"]:
            priorities.append({"title":o["title"],"action":o["next_action"],"owner":o.get("owner") or "To confirm","owner_status":o["owner_status"],"due":readable_due(o["due"])})
    recommendation=analysis["recommendation"]
    for ref in recommendation.get("evidence",[]):src.cite(ref)
    require(recommendation.get("text") and recommendation.get("reason"),"Blaise recommendation and reason required")
    if not base_status["valid"]:
        recommendation={"text":"Obtain the missing original-source verification before confirming contract deadlines.","reason":"Continue useful file and handoff preparation while dependent terms remain unresolved."}
    advisories=[]
    for o in obligations:
        if o["controlling"] and o["due"].get("date") and o["progress"] not in ("Completed","Received"):
            advisories.append({"label":"SYNTHETIC — DO NOT ADD TO CALENDAR" if case["mode"]=="synthetic" else "ADD TO CALENDAR","title":o["title"],"date":o["due"]["date"],"at":o["due"]["at"],"timezone":o["due"]["timezone"],"missing":o["due"].get("hold"),"owner":o.get("owner"),"client":case["client"]["name"],"property":case["property"]["address"],"source":o["evidence"],"created":False})
    result={"schema":"transaction-preparation.v1","mode":case["mode"],"case_id":case["id"],"client_id":case["client"]["id"],"client_name":case["client"]["name"],"property":case["property"],"side":case["side"],"as_of":case["as_of"],"acceptance":base_status,"obligations":obligations,"people":assigned,"holds":holds,"priorities":priorities,"recommendation":recommendation,"changes":changes,"updates":updates,"calendar_advisories":advisories,"chronology":chronology,"external_effects":{"crm":0,"send":0,"calendar":0,"submission":0,"payment":0,"schedule":0}}
    result["business_identity"]=identity
    result["formal_transaction_identity"]={"blaise_brokerage":brokerage(identity,"formal_transaction"),"scope":"Current business identity; verify the executed record independently. This field does not establish the broker named in an original."}
    result["parties"]=parties
    result["handoffs"]=handoffs(case,result)
    result["proposals"]=proposals(case,result)
    folder=case.get("filing",{})
    result["filing_plan"]={"status":"PROPOSED — NO FOLDERS OR FILES CREATED","existing_lifetime_folder":folder.get("lifetime"),"existing_transaction_folder":folder.get("transaction"),"action":"Reuse the existing offer-stage property folder" if folder.get("transaction") else "Locate the existing offer-stage folder before proposing a new transaction folder","originals":[{"source":s["id"],"version":s["version"],"sha256":s["sha256"],"locator":s["locator"]} for s in src.records.values()],"private_separation":"Restrict representation, financial support and strategy records to appropriate access; share only reviewed recipient-appropriate records."}
    result["source_inventory"]=[{k:v for k,v in s.items() if k!="pages"} for s in src.records.values()]
    return result

def handoffs(case,r):
    output=[]
    for role in ("client","tc","lender","title"):
        person=next((p for p in case.get("people",[]) if p["role"]==role),None)
        known=person and person["assignment_status"]=="assigned"
        recipient=person.get("name") if known else None
        eligible=[o for o in r["obligations"] if o["controlling"] and o["progress"] not in ("Completed","Received") and (role in o.get("handoff_roles",[]) or (role=="client" and o.get("audience_actions"))) and (role=="client" or o["kind"] in SPECIALIST_KINDS[role])]
        if not eligible and role!="client" and not (role=="tc" and known and not r["acceptance"]["valid"]):continue
        lines=[]
        if not r["acceptance"]["valid"]:lines=["I’m verifying the complete executed package before confirming the transaction deadlines. I’ll update you when the missing evidence is resolved."]
        elif role=="client":
            lines=["Here is your transaction update for "+case["property"]["address"]+"."]
            actions=list(dict.fromkeys(a["text"] for o in eligible for a in o.get("audience_actions",[])))
            if actions:lines.append("Your next steps\n"+"\n".join(actions))
            else:lines.append("I have no confirmed action to request from you in this update. I’ll let you know when your input is needed.")
            if eligible:
                lines.append("Transaction milestones — for awareness\n"+"\n".join(MILESTONES[o["kind"]]+": "+readable_due(o["due"])+"." for o in eligible))
        else:
            lines=["Please review these milestones within your role for "+case["property"]["address"]+"."]
            for o in eligible:lines.append(MILESTONES[o["kind"]]+": "+readable_due(o["due"])+".")
            if role=="tc":lines.append("Please confirm the items within your assignment and any status still needed from the other party’s team; completed work is excluded.")
            if role=="title":lines.append("Please confirm the assigned closer and the appropriate next file step, consistent with the client’s provider choice.")
            if role=="lender":lines.append("Please confirm the next financing milestone and any item needed from our client." if case["side"]=="buyer" else "Please confirm the buyer’s next financing milestone and any timing issue affecting closing.")
        lines.append("Blaise Smith | Call or text 870-692-2205")
        output.append({"role":role,"recipient":recipient,"routing":person.get("email") if known else None,"routing_status":"READY FOR REVIEW" if known and person.get("email") else "CONFIRM RECIPIENT/ROUTING","status":"DRAFT — NOT SENT","body":"\n\n".join(lines),"attachments":"Review the controlling agreement/amendments appropriate for this recipient; no strategy or financial-support files attached by the generator."})
    return output

def proposals(case,r):
    snap=case.get("crm_snapshot",{})
    require(snap.get("client_id")==case["client"]["id"],"CRM snapshot must bind exact client")
    require(snap.get("coverage") in ("bounded_read","unavailable"),"CRM snapshot coverage required")
    fields=[]
    if r["acceptance"]["valid"] and snap.get("stage")!="Under Contract":
        fields.append({"field":"existing_stage_name","before":snap.get("stage"),"proposed":"Under Contract","operation":"UPDATE_CONTACT_PROFILE","condition":"Resolve the exact current existing stage and contact through lead-conversion-crm before applying"})
    note="Accepted-contract preparation: "+("execution verified" if r["acceptance"]["valid"] else "execution evidence incomplete")+". "+r["recommendation"]["text"]
    key=fingerprint({"client":case["client"]["id"],"property":case["property"]["id"],"note":note})
    note_proposal=None if key in snap.get("note_fingerprints",[]) else {"subject":"Transaction next step","body":note,"fingerprint":key}
    return {"route":"lead-conversion-crm","status":"PROPOSED — NOT APPLIED","client_id":case["client"]["id"],"expected_contact_name":case["client"]["name"],"synthetic_non_executable":case["mode"]=="synthetic","fresh_read_required":True,"snapshot_coverage":snap["coverage"],"fields":fields,"note":note_proposal,"tasks":[],"duplicate_rule":"Compare fresh exact CRM fields and semantically equivalent notes/tasks before any later authorized write. Repeated generation is not another event and is not proof that a proposal was applied."}

def run(case_path,analysis_path,source_dir,out,request_path,previous=None):
    case=read(case_path);analysis=read(analysis_path)
    request=Path(request_path).read_text(encoding="utf-8").strip()
    context=case.get("workbench_context",{})
    bound=context.get("client_id")==case["client"]["id"] and context.get("property_id")==case["property"]["id"] and context.get("source")=="client_workbench"
    require(request and (case["client"]["name"] in request or case["property"]["address"] in request or bound),"Resolve the exact client/property from request or current Workbench context")
    require(analysis.get("request_sha256")==digest(request.encode()),"Agent interpretation must bind exact request")
    out=Path(out).resolve()
    require(not out.is_relative_to(ROOT.parents[1]) if (ROOT.parents[1]/".git").exists() else out!=ROOT and not out.is_relative_to(ROOT),"Case outputs belong outside repository/source")
    require(not out.exists(),"Use a fresh run directory; preserve prior outputs")
    result=reconcile(case,analysis,source_dir,read(previous) if previous else None)
    out.mkdir(parents=True);write(out/"private-provenance.json",result)
    write(out/"Field-and-Filing-PROPOSALS.json",{"crm":result["proposals"],"filing":result["filing_plan"],"external_effects":result["external_effects"]})
    (out/"drafts").mkdir()
    for d in result["handoffs"]:
        prefix="SYNTHETIC DEMONSTRATION — PRIVATE REVIEW\n" if case["mode"]=="synthetic" else ""
        (out/"drafts"/(d["role"]+"-DRAFT.txt")).write_text(prefix+d["status"]+"\nRecipient: "+(d["recipient"] or "To confirm")+" | "+(d["routing"] or "Routing to confirm")+"\n\n"+d["body"]+"\n",encoding="utf-8")
    from documents import generate
    generate(result,out)
    return result
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--case",required=True);p.add_argument("--analysis",required=True);p.add_argument("--sources",required=True);p.add_argument("--out",required=True);p.add_argument("--request",required=True);p.add_argument("--previous")
    a=p.parse_args();r=run(a.case,a.analysis,a.sources,a.out,a.request,a.previous);print(json.dumps({"case":r["case_id"],"obligations":len(r["obligations"]),"execution":r["acceptance"]["valid"],"external_effects":r["external_effects"]}))
