"""Inspect the complete synthetic artifact set after demo.py. No link navigation."""
from pathlib import Path
import argparse,json,hashlib
from statistics import median
from pypdf import PdfReader
from engine import ROOT,read,require

def verify(out):
    out=Path(out);report={"scope":"synthetic review artifacts only","pdfs":[],"links":[]}
    required=("Buyer & tour control","Relationship at a glance","Property quick read","Walk-in plan","Leave with a decision")
    for phase in ("before","after"):
        folder=out/phase
        checks=read(folder/"render-qa.json")
        for q in checks:
            require(not q["bounds"] and not q["overlap"] and not q["horizontal"] and q["fonts"] and q["images"],"Render QA failed")
            if q["kind"] not in ("print","combined"):
                require(q["singleColumn"] and q["bodyFontMin"]>=18,"Phone must genuinely reflow at readable size")
            for href in q["links"]:
                if not href.startswith("https:"):require((folder/href).is_file(),"Broken local review link")
                report["links"].append({"href":href,"navigated":False})
        for pdf in folder.glob("*.pdf"):
            reader=PdfReader(pdf)
            if "Padfolio" in pdf.name:
                expected=2 if pdf.name in ("Private-Padfolio-Print.pdf","Private-Padfolio-Phone.pdf") else 1
                require(len(reader.pages)==expected,"Wrong number of Padfolio pages")
                for page in reader.pages:
                    text=" ".join(page.extract_text().split())
                    for title in required:require(title in text,"Missing Padfolio section")
                    require("SYNTHETIC DEMONSTRATION" in text and "870-692-2205" in text,"Missing synthetic/private branding")
                    if "Print" in pdf.name:require(abs(float(page.mediabox.width)-612)<1 and abs(float(page.mediabox.height)-792)<1,"Print must be Letter")
                    if "Phone" in pdf.name:
                        require(float(page.mediabox.width)<320 and float(page.mediabox.height)>792,"Phone must not be a shrunken Letter page")
                        sizes=[]
                        page.extract_text(visitor_text=lambda text,cm,tm,font,size: sizes.append(abs(cm[0]*size)) if len(text.strip())>=25 else None)
                        require(sizes and median(sizes)>=13.4,"Phone PDF body text was scaled below its intended readable size")
            report["pdfs"].append({"path":phase+"/"+pdf.name,"pages":len(reader.pages),"sha256":hashlib.sha256(pdf.read_bytes()).hexdigest()})
        working=read(folder/"private-working.json")
        require(not working["external_effects"],"Unexpected external effect")
    r=read(out/"after/debrief-proposals.json")
    require(all(v==0 for v in r["external_effects"].values()),"Unexpected source-system action")
    require(r["fub"]["tasks"]==[],"Synthetic undated commitment must not create task")
    require(len(r["offer_handoffs"])==1 and len(r["criteria_changes"])==2,"Demonstration lost its meaningful handoffs")
    require(r["criteria_changes"][0]["treatment"]=="filter" and r["criteria_changes"][1]["treatment"]=="question","Evidence distinction lost")
    before=read(out/"before/private-working.json")
    require(before["resolved_facts"]["p2"]["hoa"]["value"] is None,"Unknown HOA became a fact")
    require(len(before["calendar_advisories"])==1 and before["calendar_advisories"][0]["synthetic_demonstration"],"Advisory scope changed")
    (out/"artifact-verification.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"pdf_files":len(report["pdfs"]),"pdf_pages":sum(x["pages"] for x in report["pdfs"]),"result":"PASS","live_certification":False}))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("out");verify(p.parse_args().out)
