"""Conspicuously fictional PDF source packs and explicit example-only interpretation.
No real forms, people, signatures, rules of law or payment instructions are generated.
The fixture reader below understands only these labeled test pages; production uses agent review.
"""
from pathlib import Path
from datetime import datetime,timedelta
import copy, json, re
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from pypdf import PdfReader
from engine import write
from sources import digest

AT="2026-09-14T14:30:00-05:00"
IDENTITY="Property: 840 Example Cedar Way, Example City, MN. Parties: Morgan Example (buyer) and Avery Sample (seller)."
SIGN="Execution illustration: buyer and seller synthetic completion markers, initials and dates covered. These are NOT signatures."
ACCEPT="Acceptance and delivery illustration: final acceptance 2026-09-14T14:30:00-05:00; delivered to both parties at that instant."
REQ="Required execution coverage in this test: buyer and seller; signatures, initials, dates, acceptance, delivery and incorporated records."
INC="Incorporated records in this test: Terms attachment v1. Amendment inventory checked through the source review time."
TERMS=[
("Earnest money","Earnest money illustration: $7,500; due 3 calendar days after final acceptance; exclude acceptance date; 17:00 America/Chicago; no weekend or holiday adjustment."),
("Inspection","Inspection illustration: due 7 calendar days after final acceptance; exclude acceptance date; 17:00 America/Chicago; no weekend or holiday adjustment."),
("Closing","Closing illustration: 2026-10-16; time not established; America/Chicago."),
("Possession","Possession illustration: 2026-10-16 at 17:00 America/Chicago.")
]
ASSIGN="Assignment illustration: Morgan Example is the buyer client; Avery Sample is the seller client. Taylor Coordinator is assigned buyer-side TC. Seller-side TC is not confirmed. Lane Lender is assigned lender. Cedar Title Desk is the client-selected title provider. Blaise Smith leads the client relationship."
REC="Strategy illustration for PRIVATE evidence only: CONFIDENTIAL-CASH-RESERVE-42817. Do not include in any recipient draft."
def pdf(path,title,pages):
    styles=getSampleStyleSheet();styles["BodyText"].fontSize=11;styles["BodyText"].leading=16
    styles["Title"].fontSize=22;styles["Title"].leading=27
    doc=SimpleDocTemplate(str(path),pagesize=(612,792),rightMargin=48,leftMargin=48,topMargin=48,bottomMargin=46)
    flow=[]
    for n,blocks in enumerate(pages):
        if n:flow.append(PageBreak())
        flow.extend([Paragraph("SYNTHETIC - NO LEGAL EFFECT",styles["Heading2"]),Paragraph(title,styles["Title"]),Spacer(1,12)])
        for heading,text in blocks:
            flow.extend([Paragraph(heading,styles["Heading3"]),Paragraph(text,styles["BodyText"]),Spacer(1,9)])
    def footer(c,d):
        c.setFont("Helvetica",8);c.setFillColor(colors.HexColor("#62615c"))
        c.drawString(48,27,"Fictional evidence for software review. Not an executed agreement.")
        c.drawRightString(564,27,"Page "+str(d.page))
    doc.build(flow,onFirstPage=footer,onLaterPages=footer)
def make_pack(folder):
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    pdf(folder/"Agreement-v1.pdf","Illustrative accepted package",[
        [("Identity",IDENTITY),("Required coverage",REQ),("Completion illustration",SIGN),("Acceptance / delivery",ACCEPT),("Incorporated records",INC)],
        TERMS])
    pdf(folder/"Terms-v1.pdf","Illustrative terms attachment",[
        [("Identity",IDENTITY),("Required coverage",REQ),("Completion illustration",SIGN),("Acceptance / delivery",ACCEPT),("Amendment inventory","No further incorporated record in this test attachment.")]])
    amend_accept="Acceptance and delivery illustration: final acceptance 2026-09-16T11:00:00-05:00; delivered to both parties at that instant."
    amend="Inspection replacement illustration: replaces Agreement v1 inspection date with 2026-09-24 at 17:00 America/Chicago. All other obligations unchanged."
    pdf(folder/"Amendment-v2.pdf","Illustrative accepted amendment",[
        [("Identity",IDENTITY),("Required coverage",REQ),("Completion illustration",SIGN),("Acceptance / delivery",amend_accept),("Amendment inventory","Amendment inventory: this test amendment follows Agreement v1; no further incorporated record."),("Inspection replacement",amend)]])
    draft="Newer DRAFT illustration: proposed inspection date 2026-09-28 at 17:00 America/Chicago. No acceptance, signatures or delivery established."
    pdf(folder/"Draft-v3.pdf","Newer unexecuted proposal",[
        [("Identity",IDENTITY),("Required coverage",REQ),("Draft only",draft)]])
    pdf(folder/"Specialist-Updates.pdf","Illustrative specialist records",[
        [("Identity",IDENTITY),("Assignments",ASSIGN),("Earnest-money record","System-record illustration: earnest money $7,500 received on 2026-09-16T09:00:00-05:00; source owner Taylor Coordinator, verified receipt record. No payment instructions."),
        ("Reported date","Email-report illustration: someone says inspection moved to 2026-09-28. This is reported only; no executed evidence accompanies this message."),
        ("Title delegation","Original-confirmation illustration: Cedar Title Desk accepted the title file and owns file setup on 2026-09-16T10:00:00-05:00."),
        ("Private strategy",REC)]])
    return folder

def source_records(folder):
    names={"pa":("Agreement-v1.pdf","Agreement v1"),"terms":("Terms-v1.pdf","Terms v1"),"amend":("Amendment-v2.pdf","Amendment v2"),"draft":("Draft-v3.pdf","Draft v3"),"updates":("Specialist-Updates.pdf","Specialist updates v1")}
    return [{"id":key,"file":name,"version":version,"locator":"synthetic://source-pack/"+name} for key,(name,version) in names.items()]
def cite(folder,source,page,section,quote):
    record=next(r for r in source_records(folder) if r["id"]==source)
    text=PdfReader(Path(folder)/record["file"]).pages[page-1].extract_text()
    assert " ".join(quote.split()) in " ".join(text.split()),"Fixture mapping must read real generated source text"
    return {"source":source,"page":page,"section":section,"quote":quote}
def interpreted_document(folder,source,id,kind,status,accepted,inventory):
    records=source_records(folder);record=next(r for r in records if r["id"]==source);raw=(Path(folder)/record["file"]).read_bytes()
    ref=lambda section,q:cite(folder,source,1,section,q)
    done=ref("Completion illustration",SIGN) if status=="executed" else None
    accept=ref("Acceptance / delivery",accepted) if accepted else None
    coverage=ref("Incorporated records" if source=="pa" else "Amendment inventory",inventory) if inventory else None
    return {"id":id,"source":source,"kind":kind,"status":status,"property_id":"synthetic-property-1","party_ids":["synthetic-buyer","synthetic-seller"],"signer_ids":["synthetic-buyer","synthetic-seller"] if done else [],
        "identity":ref("Identity",IDENTITY),"execution_requirements":ref("Required coverage",REQ),
        "review":{"reviewer_name":"Synthetic review harness","reviewer_role":"Example-only interpreter","reviewed_at":"2026-09-14T14:50:00-05:00" if source in ("pa","terms") else "2026-09-16T13:00:00-05:00","sha256":digest(raw),"pages":list(range(1,len(PdfReader(Path(folder)/record["file"]).pages)+1))},
        "completion":{key:{"confirmed":value is not None,"evidence":value} for key,value in {"signatures":done,"initials":done,"dates":done,"acceptance":accept,"delivery":accept,"amendment_coverage":coverage}.items()},
        "accepted_at":re.search(r"\d{4}-\d\d-\d\dT[\d:]+-\d\d:\d\d",accepted).group() if accepted else None,"incorporates":[]}
def fixture(folder,side="buyer",phase="start"):
    folder=Path(folder);records=source_records(folder)
    ref=lambda section,quote:cite(folder,"updates",1,section,quote)
    assign=ref("Assignments",ASSIGN)
    client="Morgan Example" if side=="buyer" else "Avery Sample"
    case={"id":"synthetic-"+side+"-transaction","mode":"synthetic","side":side,"as_of":"2026-09-16T13:00:00-05:00" if phase=="update" else "2026-09-14T15:00:00-05:00","timezone":"America/Chicago","client":{"id":"synthetic-"+side,"name":client},"property":{"id":"synthetic-property-1","address":"840 Example Cedar Way, Example City, MN"},"party_ids":["synthetic-buyer","synthetic-seller"],"party_names":["Morgan Example","Avery Sample"],"sources":records,
        "people":[{"role":"client","name":client,"email":"client@example.invalid","assignment_status":"assigned","evidence":assign},{"role":"tc","name":"Taylor Coordinator" if side=="buyer" else None,"email":"tc@example.invalid" if side=="buyer" else None,"assignment_status":"assigned" if side=="buyer" else "unknown","evidence":assign if side=="buyer" else None},
        {"role":"lender","name":"Lane Lender","email":"lender@example.invalid","assignment_status":"assigned","evidence":assign},{"role":"title","name":"Cedar Title Desk","email":"title@example.invalid","assignment_status":"assigned","evidence":assign}],
        "private_strategy":"CONFIDENTIAL-CASH-RESERVE-42817",
        "filing":{"lifetime":"synthetic://client-lifetime","transaction":"synthetic://existing-offer-folder"},
        "crm_snapshot":{"coverage":"bounded_read","client_id":"synthetic-"+side,"stage":"Active","note_fingerprints":[]}}
    pa=interpreted_document(folder,"pa","pa","agreement","executed",ACCEPT,INC)
    pa["incorporates"]=[{"id":"terms","evidence":cite(folder,"pa",1,"Incorporated records",INC)}]
    att=interpreted_document(folder,"terms","terms","attachment","executed",ACCEPT,"No further incorporated record in this test attachment.")
    obligations=[]
    for index,(heading,quote) in enumerate(TERMS):
        e=cite(folder,"pa",2,heading,quote);oid=("em","inspection","closing","possession")[index];kind=("earnest_money","inspection","closing","possession")[index]
        due={"type":"relative","days":3 if oid=="em" else 7,"unit":"calendar","include_anchor":False,"anchor":"acceptance","time":"17:00","timezone":"America/Chicago","adjustment":"none","evidence":e} if index<2 else {"type":"fixed","date":"2026-10-16","time":None if oid=="closing" else "17:00","timezone":"America/Chicago","evidence":e}
        obligations.append({"id":oid,"kind":kind,"title":heading,"document":"pa","evidence":e,"amount":7500 if index==0 else None,"amount_text":"$7,500" if index==0 else None,"amount_evidence":e if index==0 else None,"due":due,
            "responsible_party":"Buyer" if index<2 else "Buyer and seller","owner":"Taylor Coordinator" if index==0 and side=="buyer" else None if index==0 else "Blaise Smith" if index==1 else "Cedar Title Desk" if index==2 else "Avery Sample",
            "owner_status":"unknown" if index==0 and side=="seller" else "assigned",
            "next_action":("Confirm the actual receipt through the assigned coordinator","Confirm the inspection plan and protect the response deadline","Confirm the closing appointment time with the closer","Confirm the agreed possession arrangements")[index],
            "handoff_roles":(["client","tc"],["client","tc"],["tc","lender","title"],["client","title"])[index]})
    # A useful title setup item is an obligation only when evidenced in the actual source;
    # here that evidence is not present until the update, so no generic checklist entry is manufactured.
    analysis={"case_id":case["id"],"base_document":"pa","documents":[pa,att],"obligations":obligations,"updates":[],
        "recommendation":{"text":"Confirm the inspection plan with "+client+".","reason":"The response deadline is the next buyer decision; the assigned coordinator can handle deposit follow-through." if side=="buyer" else "Confirm the inspection arrangements and who will handle deposit follow-through; the TC assignment is still open.","evidence":[obligations[1]["evidence"]]} }
    if side=="seller":
        analysis["recommendation"]["text"]="Confirm the coordinator assignment and inspection arrangements."
        obligations[0]["next_action"]="Confirm who owns deposit follow-through and obtain receipt evidence"
    if phase=="update":
        am=interpreted_document(folder,"amend","amend","amendment","executed","Acceptance and delivery illustration: final acceptance 2026-09-16T11:00:00-05:00; delivered to both parties at that instant.","Amendment inventory: this test amendment follows Agreement v1; no further incorporated record.")
        dr=interpreted_document(folder,"draft","draft","amendment","draft",None,None)
        analysis["documents"] += [am,dr]
        q="Inspection replacement illustration: replaces Agreement v1 inspection date with 2026-09-24 at 17:00 America/Chicago. All other obligations unchanged."
        ae=cite(folder,"amend",1,"Inspection replacement",q)
        new=copy.deepcopy(obligations[1]);new.update(document="amend",supersedes="pa",evidence=ae,due={"type":"fixed","date":"2026-09-24","time":"17:00","timezone":"America/Chicago","evidence":ae});analysis["obligations"].append(new)
        dq="Newer DRAFT illustration: proposed inspection date 2026-09-28 at 17:00 America/Chicago. No acceptance, signatures or delivery established."
        de=cite(folder,"draft",1,"Draft only",dq);draft=copy.deepcopy(new);draft.update(document="draft",supersedes="amend",evidence=de,due={**new["due"],"date":"2026-09-28","evidence":de});analysis["obligations"].append(draft)
        analysis["updates"]=[{"obligation":"em","property_id":case["property"]["id"],"at":"2026-09-16T09:00:00-05:00","status":"received","source_kind":"system_record","source_role":"Assigned TC","verified_source":True,"summary":"The assigned coordinator verified the earnest-money receipt; do not recreate a deposit task for Blaise.","evidence":ref("Earnest-money record","System-record illustration: earnest money $7,500 received on 2026-09-16T09:00:00-05:00; source owner Taylor Coordinator, verified receipt record. No payment instructions.")},
        {"obligation":"inspection","property_id":case["property"]["id"],"at":"2026-09-16T12:00:00-05:00","status":"reported","source_kind":"email_report","source_role":"Correspondence","summary":"A later email mentions September 28; the executed amendment supports September 24.","claimed_due":"2026-09-28","evidence":ref("Reported date","Email-report illustration: someone says inspection moved to 2026-09-28. This is reported only; no executed evidence accompanies this message.")}]
        analysis["recommendation"]={"text":"Use September 24 for the inspection response and reconcile the conflicting email.","reason":"The accepted amendment changes only inspection; the newer draft does not control. Earnest money is already received.","evidence":[ae]}
    request=("Here is the latest amendment or transaction update for " if phase=="update" else "Get ")+client+(" at 840 Example Cedar Way, Example City, MN. Reconcile what changed and tell me what happens next." if phase=="update" else " at 840 Example Cedar Way, Example City, MN organized from the executed agreement. Show the immediate priorities, deadlines, responsible parties and decisions.")
    analysis["request_sha256"]=digest(request.encode())
    return case,analysis,request
