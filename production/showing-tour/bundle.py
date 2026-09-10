"""Bundle exact committed production source plus approved assets; no case outputs."""
from pathlib import Path
import argparse, hashlib, json, subprocess, zipfile
from engine import ROOT, require
ASSETS=("blaise-wordmark.svg","LibreBaskerville.ttf","librebaskerville-OFL.txt","SourceSans3.ttf","sourcesans3-OFL.txt")
def build(revision,out,git="git"):
    repo=ROOT.parents[1];out=Path(out).resolve()
    require(not out.is_relative_to(repo),"Bundle outside repository")
    def run(*args):return subprocess.check_output([git,"-C",str(repo),*args])
    commit=run("rev-parse",revision).decode().strip()
    paths=run("ls-tree","-r","--name-only",commit,"production/showing-tour").decode().splitlines()
    require(paths,"Committed showing source not found")
    entries={}
    for path in paths:
        require(not path.endswith((".pdf",".png",".zip",".pyc")),"Generated output unexpectedly tracked")
        entries[path.removeprefix("production/showing-tour/")]=run("show",commit+":"+path)
    for name in ASSETS:entries["assets/"+name]=run("show",commit+":production/open-house/templates/assets/"+name)
    manifest={"status":"PROPOSED REUSABLE SOURCE — review before promotion","repository":"blaise-smith-re/blaise-real-estate-os","revision":commit,
        "tree":run("rev-parse",commit+"^{tree}").decode().strip(),"files":{p:hashlib.sha256(b).hexdigest() for p,b in entries.items()}}
    entries["SOURCE-REVISION.json"]=(json.dumps(manifest,indent=2)+"\n").encode()
    out.parent.mkdir(parents=True,exist_ok=True)
    require(not out.exists(),"Preserve prior bundle")
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
        for path,data in entries.items():z.writestr(path,data)
    with zipfile.ZipFile(out) as z:
        require(z.testzip() is None,"Corrupt ZIP")
        require(all(hashlib.sha256(z.read(p)).hexdigest()==h for p,h in manifest["files"].items()),"Bundle byte mismatch")
    print(json.dumps({"path":str(out),"revision":commit,"sha256":hashlib.sha256(out.read_bytes()).hexdigest(),"bytes":out.stat().st_size}))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--revision",required=True);p.add_argument("--out",required=True);p.add_argument("--git",default="git")
    a=p.parse_args();build(a.revision,a.out,a.git)
