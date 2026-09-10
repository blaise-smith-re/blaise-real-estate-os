import copy,hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine,media

class ProductionRules(unittest.TestCase):
    def test_hoa_yes(self):self.assertEqual(engine.hoa_text({'status':'yes','amount':250,'frequency':'annually'}),'$250 annually')
    def test_no_hoa_omitted(self):self.assertEqual(engine.hoa_text({'status':'no'}),'')
    def test_no_hoa_optional(self):self.assertEqual(engine.hoa_text({'status':'no','show_no_hoa':True}),'No HOA')
    def test_unknown_hoa_not_zero(self):
        with self.assertRaises(ValueError):engine.hoa_text({'status':'unknown'})
    def test_hoa_frequency_required(self):
        with self.assertRaises(ValueError):engine.hoa_text({'status':'yes','amount':250})
    def receipts(self):
        g=engine.read(engine.ROOT/'governance.json')
        return [dict(id=i,title='Current owner',status='ACTIVE — GOVERNING',retrieved_at='2026-09-08',content_sha256='a'*64) for i in [g['source_map'],*g['sources'].values()]]
    def test_current_receipts(self):engine.validate_governance(self.receipts())
    def test_retired_source_blocked(self):
        for marker in ['LEGACY','RETIRED','SUPERSEDED','ARCHIVED']:
            r=self.receipts();r[0]['title']=marker+' file'
            with self.assertRaises(ValueError):engine.validate_governance(r)
    def test_missing_governance(self):
        with self.assertRaises(ValueError):engine.validate_governance(self.receipts()[:-1])
    def test_fake_receipt_hash(self):
        r=self.receipts();r[0]['content_sha256']='PENDING'
        with self.assertRaises(ValueError):engine.validate_governance(r)
    def test_internal_leak_blocked(self):
        for s in ['Source: Northstar','per the listing','subject to verification','do not freestyle']:
            with self.assertRaises(ValueError):engine.validate_public(s,{})
    def test_verified_hoa_is_consumer_fact(self):engine.validate_public('HOA dues: $250 annually',{})
    def test_disclaimer_exception_requires_provenance(self):
        with self.assertRaises(ValueError):engine.validate_public('Source: MLS',{'approved_required_disclaimer':'Source: MLS'})
    def test_sourced_exception_is_bounded(self):
        engine.validate_public('Source: MLS',{'approved_required_disclaimer':'Source: MLS','disclaimer_source':'approved current exact-asset requirement'})
        with self.assertRaises(ValueError):engine.validate_public('Source: MLS do not freestyle',{'approved_required_disclaimer':'Source: MLS','disclaimer_source':'authority'})
    def test_media_role_excludes_bad_image(self):
        c=[dict(id='a',roles=['exterior'],fit={'exterior':100},source_url='observed',excluded=True),dict(id='b',roles=['exterior'],fit={'exterior':80},source_url='observed')]
        self.assertEqual(engine.select_media(c,'exterior')['id'],'b')
    def test_media_missing_role(self):
        with self.assertRaises(ValueError):engine.select_media([],'kitchen')
    def test_portrait_rotation(self):
        c=[dict(id='a',file='a',approved=True,fit={'handout':100,'social_06':90}),dict(id='b',file='b',approved=True,fit={'handout':95,'social_06':100})]
        self.assertEqual(engine.recommend(c,['handout','social_06'],['a']),{'handout':'b','social_06':'a'})
    def test_unapproved_portrait_not_selected(self):
        with self.assertRaises(ValueError):engine.recommend([dict(id='a',approved=False,fit={'handout':100})],['handout'])
    def route(self):return {'map_source':'observed map','checked_at':'2026-09-08','stops':[dict(location=f'Intersection {n}',arrow='Right',approach='Northbound',reason='Decision point',order=n,onsite_check='Check safe placement') for n in range(1,6)]}
    def test_exact_five_signs(self):self.assertIn('| 5 |',engine.route_text(self.route()))
    def test_redundant_or_missing_signs(self):
        r=self.route();r['stops'][1]['location']=r['stops'][0]['location']
        with self.assertRaises(ValueError):engine.route_text(r)
        r=self.route();r['stops'].pop()
        with self.assertRaises(ValueError):engine.route_text(r)
    def test_missing_map_not_fabricated(self):self.assertIn('PENDING',engine.route_text({'stops':[]}))
    def test_ingest_preserves_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);Image.new('RGB',(1000,700),'green').save(p/'test.jpg');before=engine.digest(p/'test.jpg')
            (p/'download.json').write_text(json.dumps({'mls':'SYNTHETIC','photos':[dict(number=n,url='browser-observed',downloaded_file='test.jpg') for n in [1,2]]}))
            results=media.ingest(p/'download.json',p/'case');self.assertEqual(len(results),1);self.assertEqual(results[0]['sha256'],before);self.assertEqual(engine.digest(p/'test.jpg'),before)
    def test_blank_case_has_no_pilot_facts(self):
        c=engine.read(engine.ROOT/'templates/case.blank.json');self.assertIsNone(c['property']['price']);self.assertIsNone(c['identity']['address']);self.assertFalse(c['event']['confirmed']);self.assertEqual(c['media']['candidates'],[])
        self.assertIsNone(c['event']['start']);self.assertIsNone(c['event']['end'])
    def test_init_requires_each_event_time_without_creating_case(self):
        for times in [[],['--start','11:15'],['--end','14:45']]:
            with self.subTest(times=times), tempfile.TemporaryDirectory() as d:
                target=Path(d)/'synthetic-case'
                result=subprocess.run([sys.executable,str(engine.ROOT/'engine.py'),'init','--address','100 Synthetic Way','--mls','SYNTHETIC','--agent','Example Agent','--date','2032-04-18','--case',str(target),*times],capture_output=True,text=True)
                self.assertEqual(result.returncode,2,result.stderr)
                for flag in ['--start','--end']:
                    if flag not in times:self.assertIn(flag,result.stderr)
                self.assertFalse(target.exists(),'Incomplete hours must not create a case')
    def test_init_preserves_explicit_hours_without_confirming_event(self):
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'synthetic-case'
            result=subprocess.run([sys.executable,str(engine.ROOT/'engine.py'),'init','--address','100 Synthetic Way','--mls','SYNTHETIC','--agent','Example Agent','--date','2032-04-18','--start','11:15','--end','14:45','--case',str(target)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            event=engine.read(target/'case.json')['event']
            self.assertEqual((event['start'],event['end']),('11:15','14:45'))
            self.assertFalse(event['confirmed']);self.assertFalse(event['preview_event_copy'])
    def test_invalid_blank_cannot_publish(self):
        with self.assertRaises(ValueError):engine.validate_case(engine.read(engine.ROOT/'templates/case.blank.json'))
if __name__=='__main__':unittest.main()
