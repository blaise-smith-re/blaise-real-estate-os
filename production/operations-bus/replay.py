"""Use the existing TC fictional package to demonstrate preparation without client writes."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[1]/'transaction-operations'
sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from fixture_pack import make_pack,fixture
from test_kickoff import context
from engine import run,write
out=Path(sys.argv[1]).resolve()
repo=ROOT.parents[1]
if out.is_relative_to(repo) or out.exists(): raise SystemExit('Use a new private output outside the repository')
out.mkdir(parents=True)
sources=make_pack(out/'originals');case,analysis,request=fixture(sources)
case['kickoff']=context(case,analysis,sources)
write(out/'case.json',case);write(out/'analysis.json',analysis)
(out/'request.txt').write_text(request,encoding='utf-8')
result=run(out/'case.json',out/'analysis.json',sources,out/'prepared',out/'request.txt')
parts=['SYNTHETIC REPLAY ONLY — NOT A LIVE TRANSACTION\nOperations Bus accepted-contract preparation demonstration.\nNo FUB, client, Calendar or outbound communication changes.\nGenerated through the existing Transaction Operations engine.\n']
for path in sorted((out/'prepared'/'kickoff').glob('*.txt')):
 parts.append('\n'+path.name+'\n'+path.read_text(encoding='utf-8'))
parts.append('\nExecution verification: '+str(result['acceptance']['valid'])+' (fictional originals only).\n')
(out/'Synthetic-Kickoff-Replay.txt').write_text('\n'.join(parts),encoding='utf-8')
print(json.dumps({'out':str(out),'synthetic':True,'acceptance':result['acceptance']['valid'],'draft_files':[p.name for p in (out/'prepared'/'kickoff').glob('*.txt')]}))
