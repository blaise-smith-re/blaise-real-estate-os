import copy,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import reconcile,run,write
from sources import Sources,EvidenceError,digest,source_instant
from deadlines import calculate
from fixture_pack import make_pack,fixture
class TransactionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.folder=make_pack(Path(cls.temp.name)/"sources")
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def setUp(self):self.c,self.a,self.request=fixture(self.folder)
    def resolve(self,previous=None):return reconcile(self.c,self.a,self.folder,previous)
    def obligations(self,r):return {x["id"]:x for x in r["obligations"]}
    def test_pdf_reading_and_quote_mapping(self):
        s=Sources(self.folder,self.c["sources"],True)
        self.assertEqual(s.records["pa"]["page_count"],2)
        self.assertIn("SYNTHETIC",s.records["pa"]["pages"][0])
        self.assertEqual(s.cite(self.a["obligations"][0]["evidence"])["sha256"],s.records["pa"]["sha256"])
    def test_complete_accepted_package(self):
        r=self.resolve();o=self.obligations(r)
        self.assertTrue(r["acceptance"]["valid"])
        self.assertEqual(o["em"]["amount"],"7500")
        self.assertEqual(o["em"]["due"]["at"],"2026-09-17T17:00:00-05:00")
        self.assertEqual(o["inspection"]["due"]["date"],"2026-09-21")
        self.assertIsNone(o["closing"]["due"]["at"])
        self.assertEqual(o["closing"]["due"]["date"],"2026-10-16")
    def test_missing_signatures_hold_only_dependents(self):
        self.a["documents"][0]["completion"]["signatures"]["confirmed"]=False
        r=self.resolve()
        self.assertFalse(r["acceptance"]["valid"])
        self.assertTrue(all(x["due"]["date"] is None for x in r["obligations"]))
        self.assertEqual(r["proposals"]["fields"],[])
        self.assertTrue(r["filing_plan"]["existing_transaction_folder"])
        self.assertTrue(r["handoffs"])
    def test_missing_incorporated_record(self):
        self.a["documents"].pop()
        r=self.resolve();self.assertFalse(r["acceptance"]["valid"]);self.assertIn("terms"," ".join(r["holds"]))
    def test_delivered_label_or_draft_is_not_execution(self):
        self.a["documents"][0]["status"]="draft"
        self.assertFalse(self.resolve()["acceptance"]["valid"])
    def test_missing_acceptance_evidence(self):
        self.a["documents"][0]["completion"]["acceptance"]["evidence"]=None
        self.assertFalse(self.resolve()["acceptance"]["valid"])
    def test_wrong_parties_rejected(self):
        self.a["documents"][0]["party_ids"]=["another"]
        with self.assertRaises(EvidenceError):self.resolve()
    def test_wrong_property_rejected(self):
        self.a["documents"][0]["property_id"]="wrong"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_changed_original_bytes_rejected(self):
        self.a["documents"][0]["review"]["sha256"]="bad"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_unread_page_cannot_be_claimed_reviewed(self):
        self.a["documents"][0]["review"]["pages"]=[1]
        r=self.resolve();self.assertFalse(r["acceptance"]["valid"]);self.assertTrue(r["filing_plan"])
    def test_overdue_without_receipt_surfaces_exception(self):
        self.c["as_of"]="2026-09-18T10:00:00-05:00"
        self.assertTrue(any("due time has passed" in x for x in self.resolve()["holds"]))
    def test_cross_document_term_reference_rejected(self):
        self.a["obligations"][0]["document"]="terms"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_fabricated_quote_rejected(self):
        self.a["obligations"][0]["evidence"]["quote"]="invented operative terms"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_wrong_citation_page_rejected(self):
        self.a["obligations"][0]["evidence"]["page"]=1
        with self.assertRaises(EvidenceError):self.resolve()
    def test_unknown_money_does_not_become_zero(self):
        self.a["obligations"][0]["amount"]=None
        self.assertIsNone(self.obligations(self.resolve())["em"]["amount"])
    def test_amount_mismatch_rejected(self):
        self.a["obligations"][0]["amount"]=100
        with self.assertRaises(EvidenceError):self.resolve()
    def test_date_mismatch_rejected(self):
        self.a["obligations"][2]["due"]["date"]="2026-10-19"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_count_mismatch_rejected(self):
        self.a["obligations"][0]["due"]["days"]=5
        with self.assertRaises(EvidenceError):self.resolve()
    def test_time_mismatch_rejected(self):
        self.a["obligations"][0]["due"]["time"]="16:00"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_source_unit_mismatch_rejected(self):
        self.a["obligations"][0]["due"]["unit"]="business"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_source_trigger_count_mismatch_rejected(self):
        self.a["obligations"][0]["due"]["include_anchor"]=True
        with self.assertRaises(EvidenceError):self.resolve()
    def test_future_acceptance_not_active(self):
        self.c["as_of"]="2026-09-14T13:00:00-05:00"
        self.assertFalse(self.resolve()["acceptance"]["valid"])
    def test_new_executed_amendment_beats_newer_draft(self):
        before=self.resolve();self.c,self.a,_=fixture(self.folder,phase="update");r=self.resolve(before);o=self.obligations(r)
        self.assertEqual(o["inspection"]["document"],"amend")
        self.assertEqual(o["inspection"]["due"]["date"],"2026-09-24")
        self.assertEqual(o["closing"]["due"],self.obligations(before)["closing"]["due"])
        self.assertEqual(o["em"]["progress"],"Received")
        self.assertEqual({x["id"] for x in r["changes"]},{"inspection","em"})
        self.assertTrue(any("reported date differs" in x for x in r["holds"]))
        self.assertFalse(next(x for x in r["chronology"] if x["document"]=="draft")["applied"])
    def test_amendment_requires_predecessor(self):
        self.c,self.a,_=fixture(self.folder,phase="update")
        self.a["obligations"][4]["supersedes"]="wrong"
        r=self.resolve();o=self.obligations(r)
        self.assertFalse(o["inspection"]["controlling"]);self.assertIsNone(o["inspection"]["due"]["date"])
        self.assertTrue(o["closing"]["controlling"])
    def test_later_report_never_changes_terms(self):
        self.c,self.a,_=fixture(self.folder,phase="update")
        self.a["obligations"]=self.a["obligations"][:4]
        self.assertEqual(self.obligations(self.resolve())["inspection"]["due"]["date"],"2026-09-21")
    def test_draft_cannot_confirm_receipt(self):
        self.c,self.a,_=fixture(self.folder,phase="update");self.a["updates"][0]["source_kind"]="draft"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_future_completion_rejected(self):
        self.c,self.a,_=fixture(self.folder,phase="update");self.a["updates"][0]["at"]="2026-10-16T09:00:00-05:00"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_completed_tc_work_not_recreated_for_blaise(self):
        self.c,self.a,_=fixture(self.folder,phase="update");r=self.resolve()
        self.assertNotIn("Earnest money",[p["title"] for p in r["priorities"]])
        self.assertEqual(r["proposals"]["tasks"],[])
        self.assertNotIn("Earnest money",next(d["body"] for d in r["handoffs"] if d["role"]=="tc"))
    def test_missing_specialist_assignment(self):
        self.c,self.a,_=fixture(self.folder,side="seller");r=self.resolve()
        tc=next(d for d in r["handoffs"] if d["role"]=="tc")
        self.assertIsNone(tc["recipient"]);self.assertIsNone(tc["routing"]);self.assertTrue(any("assignment" in x for x in r["holds"]))
    def test_confidential_strategy_never_in_recipient_drafts(self):
        self.a["obligations"][0]["next_action"]=self.c["private_strategy"]+" private budget"
        r=self.resolve()
        for d in r["handoffs"]:
            self.assertNotIn(self.c["private_strategy"],d["body"]);self.assertNotIn("private budget",d["body"]);self.assertNotIn("synthetic://",d["body"])
    def test_repeat_is_stable_and_fresh_crm_suppresses_duplicate(self):
        first=self.resolve();self.assertEqual(first,self.resolve())
        self.c["crm_snapshot"]["stage"]="Under Contract"
        self.c["crm_snapshot"]["note_fingerprints"]=[first["proposals"]["note"]["fingerprint"]]
        p=self.resolve()["proposals"];self.assertEqual(p["fields"],[]);self.assertIsNone(p["note"]);self.assertEqual(p["tasks"],[])
    def test_wrong_crm_identity_rejected(self):
        self.c["crm_snapshot"]["client_id"]="wrong"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_update_cannot_erase_old_obligation(self):
        before=self.resolve();self.a["obligations"].pop()
        with self.assertRaises(EvidenceError):self.resolve(before)
    def test_synthetic_is_not_live_evidence(self):
        self.c["mode"]="live"
        with self.assertRaises(EvidenceError):self.resolve()
    def test_calendar_advisories_remain_synthetic(self):
        r=self.resolve();self.assertTrue(all(x["label"]=="SYNTHETIC — DO NOT ADD TO CALENDAR" and not x["created"] for x in r["calendar_advisories"]))
    def test_no_business_effects(self):self.assertFalse(any(self.resolve()["external_effects"].values()))
    def human(self):
        from pypdf import PdfReader
        for s in self.c["sources"]:
            path=self.folder/s.pop("file");s["page_count"]=len(PdfReader(path).pages)
            s["human_verification"]={"verifier_name":"Fictional verifier","verifier_role":"Assigned professional","verified_at":"2026-09-14T15:00:00-05:00","source_locator":s["locator"],"source_version":s["version"],"coverage_statement":"Explicit original verification including completion/signatures/initials/dates, acceptance/delivery and all incorporated/amendment records.","covered_sections":["Identity","Required coverage","Completion illustration","Acceptance / delivery","Incorporated records","Amendment inventory","Earnest money","Inspection","Closing","Possession","Assignments"]}
    def test_explicit_human_verification_is_distinct(self):
        self.human();r=self.resolve();self.assertTrue(r["acceptance"]["valid"]);self.assertEqual(r["acceptance"]["method"],"Human-verified")
    def test_vague_human_approval_is_insufficient(self):
        self.human();self.c["sources"][0]["human_verification"].pop("verifier_role")
        with self.assertRaises(EvidenceError):self.resolve()
    def test_human_coverage_must_include_term(self):
        self.human();self.c["sources"][0]["human_verification"]["covered_sections"].remove("Inspection")
        with self.assertRaises(EvidenceError):self.resolve()
    def test_request_bound_generation_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp);write(tmp/"c.json",self.c);write(tmp/"a.json",self.a);(tmp/"r.txt").write_text(self.request)
            run(tmp/"c.json",tmp/"a.json",self.folder,tmp/"out",tmp/"r.txt")
            self.assertTrue((tmp/"out/Transaction-Brief-Phone.html").exists())
            with self.assertRaises(EvidenceError):run(tmp/"c.json",tmp/"a.json",self.folder,tmp/"out",tmp/"r.txt")
    def test_another_request_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp);write(tmp/"c.json",self.c);write(tmp/"a.json",self.a);(tmp/"r.txt").write_text(self.request+" silently changed")
            with self.assertRaises(EvidenceError):run(tmp/"c.json",tmp/"a.json",self.folder,tmp/"out",tmp/"r.txt")
    def test_generic_workbench_request_uses_bound_context(self):
        request="Get this transaction organized from the executed agreement."
        self.c["workbench_context"]={"client_id":self.c["client"]["id"],"property_id":self.c["property"]["id"],"source":"client_workbench"}
        self.a["request_sha256"]=digest(request.encode())
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp);write(tmp/"c.json",self.c);write(tmp/"a.json",self.a);(tmp/"r.txt").write_text(request)
            r=run(tmp/"c.json",tmp/"a.json",self.folder,tmp/"out",tmp/"r.txt")
            self.assertTrue(r["acceptance"]["valid"])

    def test_new_obligation_is_readable_in_update(self):
        from documents import generate
        r=self.resolve();r['changes']=[{'id':'new','title':'New evidenced obligation','fields':['due'],'before':None,'after':{}}]
        with tempfile.TemporaryDirectory() as tmp:
            generate(r,Path(tmp))
            text=(Path(tmp)/'Transaction-Brief-Print.html').read_text(encoding='utf-8')
            self.assertIn('newly identified obligation',text)
    def test_reading_view_preserves_cents(self):
        from documents import generate
        r=self.resolve();r['obligations'][0]['amount']='7500.50'
        with tempfile.TemporaryDirectory() as tmp:
            generate(r,Path(tmp))
            self.assertIn('$7,500.50',(Path(tmp)/'Transaction-Brief-Phone.html').read_text(encoding='utf-8'))
    def test_unknown_seller_coordinator_does_not_become_assigned_in_action(self):
        self.c,self.a,self.request=fixture(self.folder,'seller')
        em=self.obligations(self.resolve())['em']
        self.assertEqual(em['owner_status'],'unknown')
        self.assertNotIn('assigned coordinator',em['next_action'])
    def test_seller_lender_handoff_keeps_borrower_identity_clear(self):
        self.c,self.a,self.request=fixture(self.folder,'seller')
        draft=next(x for x in self.resolve()['handoffs'] if x['role']=='lender')
        self.assertIn('buyer’s next financing milestone',draft['body'])
        self.assertNotIn('needed from our client',draft['body'])

class DateTests(unittest.TestCase):
    def test_readable_due_preserves_unicode_separator(self):
        from deadlines import readable_due
        self.assertEqual(readable_due({'date':'2026-10-16','at':None}),'Oct 16, 2026 \u00b7 time to verify')
    def setUp(self):
        self.anchors={"acceptance":{"at":"2026-09-04T15:00:00-05:00","verified":True}}
        self.rule={"type":"relative","days":3,"unit":"calendar","include_anchor":False,"anchor":"acceptance","time":"17:00","timezone":"America/Chicago","adjustment":"none"}
    def test_calendar_counts_weekend_without_legal_adjustment(self):
        self.assertEqual(calculate(self.rule,self.anchors)["date"],"2026-09-07")
    def test_explicit_business_holiday_calendar(self):
        self.rule.update(unit="business",weekdays=[0,1,2,3,4],holidays=["2026-09-07"])
        self.assertEqual(calculate(self.rule,self.anchors)["date"],"2026-09-10")
    def test_unknown_holidays_are_not_zero(self):
        self.rule.update(unit="business",weekdays=[0,1,2,3,4])
        self.assertIsNone(calculate(self.rule,self.anchors)["date"])
    def test_include_trigger_day(self):
        self.rule["include_anchor"]=True;self.assertEqual(calculate(self.rule,self.anchors)["date"],"2026-09-06")
    def test_no_counting_default(self):
        del self.rule["include_anchor"];self.assertIsNone(calculate(self.rule,self.anchors)["date"])
    def test_unknown_anchor(self):
        self.assertIsNone(calculate(self.rule,{})["date"])
    def test_no_midnight_default(self):
        self.rule["time"]=None;r=calculate(self.rule,self.anchors);self.assertIsNotNone(r["date"]);self.assertIsNone(r["at"])
    def test_unknown_roll_convention(self):
        self.rule["adjustment"]="next_business_day";self.assertIsNone(calculate(self.rule,self.anchors)["date"])
    def test_dst_nonexistent_and_ambiguous(self):
        for day in ("2026-03-08","2026-11-01"):
            clock="02:30" if "03-08" in day else "01:30"
            r=calculate({"type":"fixed","date":day,"time":clock,"timezone":"America/Chicago"},{})
            self.assertIsNone(r["at"]);self.assertTrue(r["hold"])
    def test_dst_offset_reconciles(self):
        self.rule["days"]=3;self.anchors["acceptance"]["at"]="2026-10-30T14:00:00-05:00"
        self.assertEqual(calculate(self.rule,self.anchors)["at"],"2026-11-02T17:00:00-06:00")
    def test_negative_duration_rejected(self):
        self.rule["days"]=-3;self.assertIsNone(calculate(self.rule,self.anchors)["date"])
    def test_source_human_date_format(self):
        self.assertEqual(source_instant("September 14, 2026 2:30 PM","America/Chicago").isoformat(),"2026-09-14T14:30:00-05:00")
if __name__=="__main__":unittest.main()
