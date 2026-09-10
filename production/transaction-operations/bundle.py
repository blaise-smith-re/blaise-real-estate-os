"""Package only reusable sources and approved shared assets; never include cases."""
from pathlib import Path
import argparse,hashlib,json,subprocess,zipfile
ROOT=Path(__file__).resolve().parent
ASSETS=('blaise-wordmark.svg','LibreBaskerville.ttf','librebaskerville-OFL.txt','SourceSans3.ttf','sourcesans3-OFL.txt')
def bundle(out):
    out=Path(out).resolve()
    boundary=ROOT.parents[1] if (ROOT.parents[1]/'.git').exists() else ROOT
    if out.is_relative_to(boundary):raise ValueError('Bundle output belongs outside repository/source')
    if out.exists():raise ValueError('Preserve existing bundles; choose a fresh name')
    files={}
    for p in ROOT.iterdir():
        if p.suffix in ('.py','.cjs','.css','.md','.json','.txt') and p.name!='BUNDLE-MANIFEST.json':files[p.name]=p
    for p in (ROOT/'tests').glob('test_*.py'):files['tests/'+p.name]=p
    shared=ROOT/'shared' if (ROOT/'shared').exists() else ROOT.parent/'showing-tour'
    assets=ROOT/'assets' if (ROOT/'assets').exists() else ROOT.parent/'open-house/templates/assets'
    for name in ('experience.css','render.cjs'):files['shared/'+name]=shared/name
    for name in ASSETS:files['assets/'+name]=assets/name
    repo=ROOT.parents[1]
    if (repo/'.git').exists():
        status=subprocess.check_output(['git','status','--porcelain'],cwd=repo,text=True)
        if status.strip():raise ValueError('Commit reviewed source first; do not label uncommitted work as a revision')
        revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    else:
        revision=json.loads((ROOT/'BUNDLE-MANIFEST.json').read_text())['git_revision']
    manifest={'git_revision':revision,'status':'PRIVATE REVIEW — NOT RELEASED','files':{n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in sorted(files.items())}}
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for n,p in sorted(files.items()):z.writestr('transaction-operations/'+n,p.read_bytes())
        z.writestr('transaction-operations/BUNDLE-MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'file':str(out),'git_revision':revision,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(files)+1}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);bundle(p.parse_args().out)
