"""Exercise both plain-language requests with explicit synthetic evidence."""
from pathlib import Path
import argparse, copy, json, subprocess, sys
from engine import ROOT, read, process, write
def run(out,node,render=True):
    out=Path(out).resolve()
    c=read(ROOT/"fixtures/synthetic-case.json")
    prepare=(ROOT/"fixtures/prepare-request.txt").read_text(encoding="utf-8")
    before=process(c,prepare,out/"before")
    d=read(ROOT/"fixtures/synthetic-interpretation.json")
    notes=(ROOT/"fixtures/synthetic-notes.txt").read_text(encoding="utf-8")
    after=copy.deepcopy(c)
    after["sources"].append({"id":"attendance","kind":"Blaise notes","title":"Synthetic after-tour notes",
        "locator":"synthetic://transcript/after","as_of":"2032-04-18T13:00:00-05:00","synthetic":True,
        "attended_properties":["p1","p2"],"quote":"We toured both homes."})
    after["buyer"]["latest_event"]="Apr 18: both homes toured; property responses below."
    for p in after["properties"]:
        p["showings"].append({"status":"completed","date":"2032-04-18","start":None,"end":None,
            "source":"attendance","attendance_evidence":"attendance","as_of":"2032-04-18T13:00:00-05:00"})
    result=process(after,(ROOT/"fixtures/debrief-request.txt").read_text(encoding="utf-8"),out/"after",notes,d)
    if render:
        for folder in ("before","after"):
            subprocess.run([node,str(ROOT/"render.cjs"),str(out/folder)],check=True)
        from pypdf import PdfWriter
        for folder in ("before","after"):
            writer=PdfWriter()
            for p in sorted((out/folder).glob("[0-9][0-9]-Private-Padfolio-Phone.pdf")):writer.append(p)
            writer.write(out/folder/"Private-Padfolio-Phone.pdf")
    write(out/"demo-run.json",{"status":"SYNTHETIC DEMONSTRATION","before":before,"after":result,
        "live_execution":False,"rendered":render})
    return out
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--out",required=True);p.add_argument("--node",default="node");p.add_argument("--no-render",action="store_true")
    a=p.parse_args();print(run(a.out,a.node,not a.no_render))
