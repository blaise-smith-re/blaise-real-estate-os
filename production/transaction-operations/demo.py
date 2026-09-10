"""Generate complete fictional source packs, interpret their evidence, then run the production path."""
from pathlib import Path
import argparse,copy,json,subprocess
from fixture_pack import make_pack,fixture
from engine import ROOT,run,write
from sources import digest
def demo(out,node="node"):
    out=Path(out).resolve();assert not out.exists(),"Preserve prior review runs"
    boundary=ROOT.parents[1] if (ROOT.parents[1]/".git").exists() else ROOT
    assert not out.is_relative_to(boundary),"Review output must stay outside repository/source"
    out.mkdir(parents=True);sources=make_pack(out/"source-pack")
    variants=[("buyer-start","buyer","start"),("buyer-update","buyer","update"),("seller-start","seller","start"),("missing-execution","buyer","start"),("human-verification","buyer","start")]
    reports=[]
    for name,side,phase in variants:
        case,analysis,request=fixture(sources,side,phase)
        if name=="missing-execution":
            analysis["documents"][0]["completion"]["signatures"]={"confirmed":False,"evidence":None}
            analysis["documents"]=analysis["documents"][:1]
        if name=="human-verification":
            for s in case["sources"]:
                file=s.pop("file")
                from pypdf import PdfReader
                s["page_count"]=len(PdfReader(sources/file).pages)
                s["human_verification"]={"verifier_name":"Jordan Verifier (fictional)","verifier_role":"Assigned transaction professional (fictional)","verified_at":"2026-09-14T14:50:00-05:00","source_locator":s["locator"],"source_version":s["version"],"coverage_statement":"Explicit original-source verification of all required signatures, initials, dates, acceptance/delivery, final acceptance anchor and incorporated/amendment coverage for the cited sections; source is not machine-readable in this scenario.","covered_sections":["Identity","Required coverage","Completion illustration","Acceptance / delivery","Incorporated records","Amendment inventory","Earnest money","Inspection","Closing","Possession","Assignments"]}
        inputs=out/"inputs"/name;inputs.mkdir(parents=True)
        write(inputs/"case.json",case);write(inputs/"analysis.json",analysis);(inputs/"request.txt").write_text(request,encoding="utf-8")
        target=out/name;previous=out/"buyer-start/private-provenance.json" if phase=="update" else None
        result=run(inputs/"case.json",inputs/"analysis.json",sources,target,inputs/"request.txt",previous)
        subprocess.run([node,str(ROOT/"render.cjs"),str(target)],check=True)
        reports.append({"scenario":name,"path":str(target),"execution":result["acceptance"]["valid"],"label":result["acceptance"]["method"],"changes":len(result["changes"])})
    write(out/"demo-results.json",reports);print(json.dumps(reports,indent=2))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--out",required=True);p.add_argument("--node",default="node");a=p.parse_args();demo(a.out,a.node)
