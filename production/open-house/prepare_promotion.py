"""Prepare local artifacts for Work's canonical Drive filing; no upload occurs."""
from pathlib import Path
import argparse,hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parent
def main():
    p=argparse.ArgumentParser();p.add_argument('--qa-run',required=True);p.add_argument('--pilot',required=True);p.add_argument('--case',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    out=Path(a.out);out.mkdir(parents=True,exist_ok=False);run=Path(a.qa_run);pilot=Path(a.pilot)
    for name in ['QA.json','REGRESSION.json','MOBILE-QA.json','FUTURE-INTAKE-QA.json']:
        if not (run/name).is_file():raise ValueError('Missing QA evidence '+name)
    shutil.copy2(ROOT/'OPEN-HOUSE-EXPERIENCE-PLAYBOOK.md',out/'OPEN-HOUSE-EXPERIENCE-PLAYBOOK.md')
    (out/'README-FOR-CANONICAL-FILING.md').write_text('''# Open House Experience — prepared canonical filing package
Prepared for Work/Blaise business QC. No Drive upload, Source Map edit or Growth SOP edit has occurred.

Production source: C:/GitHub/blaise-real-estate-os/production/open-house (repository-relative production/open-house). Repository files are the reusable engine; Pilot 01 is QA/reference only. Review/commit/push through the existing repository workflow; no remote publication is implied.

Quick trigger: Prepare my open house for [ADDRESS], MLS [MLS]. Listing agent: [NAME]. Proposed date/time: [YYYY-MM-DD, START–END America/Chicago]. Use production/open-house.

File the business Playbook under the current Growth/Brand architecture, not as a duplicate SOP. File the source/master bundle in the appropriate production-master folder with the repository pointer. Preserve Pilot 01 as a separate restricted internal QA/reference record, not as a master or a confirmed event record. Work adds the final canonical pointer after business QC.

OPEN-HOUSE-PRODUCTION-MASTERS-v1.0.zip contains reusable engine, schema, templates, approved brand assets, workflow and tests. It contains no default property facts or case record.
PILOT-01-QA-REFERENCE.zip contains the preserved approved two print PDFs, regenerated case outputs, source-media originals/provenance, internal planning, case inputs and QA evidence. It is an internal bundle; never distribute the entire bundle as consumer collateral. Completed sign-in/attendance/publication evidence does not exist and is not fabricated.

Changes from pilot: conditional HOA handling; six-section phone Host Brief; eight purposeful individual socials; optional board only; event-derived date/time; property-specific five-sign plan; separate source/public/release state. Approved handout and sign-in PDF text reproduced exactly in regression.

Remaining operational limits: supervised authenticated browser/visual judgment, not unattended MLS API or image recognition; media/hosting/onsite permission requires owner judgment; original regression facts are dated September 8, 2026 and must be refreshed before release. Current Lead SOP conflicts with the owner-requested agent-status question; Work/Blaise should reconcile the narrow conflict without broadening it to other lead flows.
''',encoding='utf-8')
    with zipfile.ZipFile(out/'OPEN-HOUSE-PRODUCTION-MASTERS-v1.0.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in ROOT.rglob('*'):
            if f.is_file() and not any(x in ['__pycache__','promotion','cases','runs'] for x in f.relative_to(ROOT).parts) and f.suffix!='.pyc':z.write(f,f.relative_to(ROOT))
    with zipfile.ZipFile(out/'PILOT-01-QA-REFERENCE.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in run.rglob('*'):
            if f.is_file():z.write(f,Path('regenerated')/f.relative_to(run))
        z.write(a.case,'regression-case.json')
        for f in (pilot/'output/print').glob('*.pdf'):z.write(f,Path('preserved-approved-print')/f.name)
        for f in (pilot.parent/'open-house-12309-lever').glob('*'):
            if f.is_file():z.write(f,Path('preserved-source-pack')/f.name)
        route=pilot.parent/'lever-routing-map.png'
        if route.exists():z.write(route,'routing/map-browser-evidence.png')
        z.writestr('REFERENCE-ONLY.txt','Preserved historical QA case. Never use these property facts, photos, sign locations or proposed event time as a future case default. No event was created or publication performed.')
    files=[]
    for f in sorted(out.iterdir()):
        if f.suffix=='.zip':
            with zipfile.ZipFile(f) as z:
                if z.testzip():raise ValueError('Corrupt archive')
        files.append({'name':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
    (out/'PROMOTION-MANIFEST.json').write_text(json.dumps({'prepared':True,'filed_to_drive':False,'growth_sop_modified':False,'source_map_modified':False,'files':files},indent=2))
    print(out)
if __name__=='__main__':main()
