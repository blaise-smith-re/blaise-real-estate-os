"""Run against an explicit preserved case; no property-specific fixture in repository."""
from pathlib import Path
import copy,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine
from pypdf import PdfReader

case_path=Path(sys.argv[1]);run=Path(sys.argv[2]);pilot=Path(sys.argv[3]);c=engine.read(case_path)
engine.verify(c,run,engine.read(run/'internal/production.json'))
checks=[]
for name,mutate in [
 ('wrong price',lambda x:x['property'].update(price=1)),
 ('wrong address',lambda x:x['identity'].update(address='WRONG TARGET')),
 ('wrong media MLS',lambda x:x['media'].update(mls='WRONG')),
 ('unknown HOA',lambda x:x['property']['hoa'].update(status='unknown')),
 ('internal leak',lambda x:x['marketing'].update(positioning='Source: internal risk controls')),
 ('stale governance authority',lambda x:x['governance_receipt'][0].update(status='RETIRED')),
 ('too many disclosure items',lambda x:x['internal'].update(disclosed=['item']*6)),
 ('nonactive alternative',lambda x:x['internal']['alternatives'][0].update(status='Sold'))]:
    bad=copy.deepcopy(c);mutate(bad)
    try:engine.validate_case(bad)
    except ValueError:checks.append(name)
    else:raise AssertionError('Expected rejection: '+name)
normalized=lambda f:' '.join(PdfReader(f).pages[0].extract_text().split())
handout=next((run/'output/print').glob('*Handout*.pdf'))
sign=next((run/'output/print').glob('*Sign-In*.pdf'))
assert normalized(handout)==normalized(pilot/'output/print/12309-lever-Property-Handout-DRAFT.pdf'),'Approved handout text changed'
assert normalized(sign)==normalized(pilot/'output/print/12309-lever-Sign-In-DRAFT.pdf'),'Approved sign-in text changed'
host=(run/'output/internal/Host-Brief.html').read_text(encoding='utf-8')
assert host.count('<section>')==6 and '<img' not in host
assert len(c['sign_route']['stops'])==5
assert len(engine.read(run/'internal/media-provenance.json')['originals'])==55
assert not engine.read(run/'internal/release-state.json')['publication_authorized']
engine.write(run/'REGRESSION.json',{'pass':True,'rejected_invalid_cases':checks,'approved_handout_text':'identical','approved_sign_in_text':'identical','host_sections':6,'signs':5,'source_images':55,'external_actions':False,'meaningful_changes':['Eight purposeful social assets replace nine pilot layouts; optional board only.','Host Brief has six requested sections with disclosure awareness.','Generated map-researched five-sign route added.','Event date/time derives from case; post-event relationship asset is not labeled as an invitation.']})
print('PASS: Lever regression; 8 invalid-case rejections; approved print text identical.')
