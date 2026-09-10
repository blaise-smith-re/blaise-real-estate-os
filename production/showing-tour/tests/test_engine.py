import copy, json, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import engine
import documents, demo
from engine import ROOT

class ShowingRules(unittest.TestCase):
    def setUp(self):
        self.c=engine.read(ROOT/"fixtures/synthetic-case.json")
        self.d=engine.read(ROOT/"fixtures/synthetic-interpretation.json")
        self.notes=(ROOT/"fixtures/synthetic-notes.txt").read_text(encoding="utf-8")
    def prep(self,c=None): return engine.validate_case(c or self.c)
    def run_debrief(self): return engine.debrief(self.c,self.notes,self.d)
    def test_missing_times_stay_unknown(self):
        self.c["properties"][0]["showings"]=[]
        self.prep()
        self.assertIsNone(engine.showing_for(self.c["properties"][0])["start"])
        self.assertEqual(engine.advisories(self.c,["p1"]),[])
    def test_confirmed_requires_both_times(self):
        for key in ("date","start","end","source"):
            c=copy.deepcopy(self.c);c["properties"][0]["showings"][0][key]=None
            with self.subTest(key=key),self.assertRaises(ValueError):self.prep(c)
    def test_requested_is_not_confirmed(self):
        self.assertEqual(engine.advisories(self.c,["p2"]),[])
    def test_cancellation_supersedes_booking(self):
        p=self.c["properties"][0];event=copy.deepcopy(p["showings"][0])
        event.update(status="cancelled",as_of="2032-04-17T12:00:00-05:00");p["showings"].append(event)
        self.prep();self.assertEqual(engine.showing_for(p)["status"],"cancelled")
        self.assertEqual(engine.advisories(self.c,["p1"]),[])
    def test_booking_not_attendance(self):
        self.c["properties"][0]["showings"][0]["status"]="completed"
        with self.assertRaises(ValueError):self.prep()
    def test_booking_source_cannot_be_attendance_evidence(self):
        self.c["properties"][0]["showings"][0].update(status="completed",attendance_evidence="booking")
        with self.assertRaises(ValueError):self.prep()
    def test_conflicting_showing_status_blocks_only_target(self):
        p=self.c["properties"][0];e=copy.deepcopy(p["showings"][0]);e["status"]="cancelled";p["showings"].append(e)
        with self.assertRaises(ValueError):self.prep()
    def test_unknown_financing_hoa_and_documents_allow_prep(self):
        self.c["buyer"]["financing"]="Unknown — no lender evidence."
        self.prep()
        self.assertIsNone(engine.facts_for(self.c["properties"][1],self.prep())["hoa"]["value"])
    def test_calendar_incomplete_does_not_block_or_create(self):
        self.prep();rows=engine.advisories(self.c,["p1"])
        self.assertEqual(len(rows),1);self.assertFalse(rows[0]["created"]);self.assertTrue(rows[0]["synthetic_demonstration"])
    def test_advisories_limited_to_selected_property(self):
        self.assertEqual(engine.advisories(self.c,["p2"]),[])
    def test_missing_timezone_rejected(self):
        self.c["sources"][0]["as_of"]="2032-04-16T15:00:00"
        with self.assertRaises(ValueError):self.prep()
    def test_draft_does_not_prove_executed_terms(self):
        self.c["document_check"].update(status="verified",original_source="requirements",verification="draft_summary")
        with self.assertRaises(ValueError):self.prep()
    def test_original_source_human_check_supported(self):
        self.c["document_check"].update(status="verified",original_source="requirements",verification="human_original_verified")
        self.prep()
    def test_historical_cancelled_listing_not_current(self):
        facts=engine.facts_for(self.c["properties"][0],self.prep())
        self.assertIn("Active",facts["history"]["value"])
    def test_newer_current_price_wins(self):
        p=self.c["properties"][0];p["facts"].append(dict(field="price",value=580000,source="matrixp1",as_of="2032-04-17T15:00:00-05:00",label="verified MLS"))
        self.assertEqual(engine.facts_for(p,self.prep())["price"]["value"],580000)
    def test_same_time_fact_conflict_remains_unknown(self):
        p=self.c["properties"][0];f=copy.deepcopy(next(x for x in p["facts"] if x["field"]=="price"));f["value"]=1;p["facts"].append(f)
        facts=engine.facts_for(p,self.prep())
        self.assertIsNone(facts["price"]["value"]);self.assertIn("CONFLICT",facts["price"]["reason"])
    def test_cross_property_facts_rejected(self):
        self.c["properties"][0]["facts"][-1]["source"]="matrixp2"
        with self.assertRaises(ValueError):self.prep()
    def test_false_verified_mls_label_rejected(self):
        self.c["sources"][4]["kind"]="Communication"
        with self.assertRaises(ValueError):self.prep()
    def test_exact_buyer_resolution(self):
        with self.assertRaises(ValueError):engine.route_request(self.c,"Prepare me to show 100 Example Ridge to Wrong Buyer.")
    def test_both_triggers(self):
        self.assertEqual(engine.route_request(self.c,(ROOT/"fixtures/prepare-request.txt").read_text())[0],"prepare")
        self.assertEqual(engine.route_request(self.c,(ROOT/"fixtures/debrief-request.txt").read_text(encoding="utf-8"))[0],"debrief")
    def test_single_property_resolution(self):
        self.assertEqual(engine.route_request(self.c,"Prepare me to show SYN-201 to Morgan Ellis.")[1],["p2"])
    def test_transcript_change_requires_new_interpretation(self):
        with self.assertRaises(ValueError):engine.debrief(self.c,self.notes+" New fact.",self.d)
    def test_invented_evidence_rejected(self):
        self.d["evidence"][0]["quote"]="Buyer approved an offer."
        with self.assertRaises(ValueError):self.run_debrief()
    def test_cross_property_feedback_rejected(self):
        self.d["feedback"][1]["claims"][0]["evidence"]=["e1"]
        with self.assertRaises(ValueError):self.run_debrief()
    def test_multi_property_feedback_preserves_preference(self):
        r=self.run_debrief();self.assertEqual(len(r["feedback"]),2)
        self.assertEqual([f["interest"] for f in r["feedback"]],["serious","low"])
    def test_observation_cannot_be_buyer_confirmation(self):
        self.d["feedback"][0]["claims"][1]["label"]="buyer-confirmed"
        with self.assertRaises(ValueError):self.run_debrief()
    def test_hypothesis_never_silently_changes_filter(self):
        self.d["criteria_changes"][1]["treatment"]="filter"
        with self.assertRaises(ValueError):self.run_debrief()
    def test_serious_interest_needs_buyer_evidence(self):
        self.d["feedback"][0]["evidence"]=["e4"]
        with self.assertRaises(ValueError):self.run_debrief()
    def test_serious_interest_handoff_existing_workflow(self):
        r=self.run_debrief();self.assertEqual(len(r["offer_handoffs"]),1)
        self.assertEqual(r["offer_handoffs"][0]["workflow"],self.c["links"]["offer_strategy"])
        self.assertTrue(r["offer_handoffs"][0]["gaps"])
    def test_ordinary_tour_does_not_start_cma(self):
        self.d["feedback"][0]["interest"]="considering"
        self.assertEqual(self.run_debrief()["offer_handoffs"],[])
    def test_criteria_are_field_level_proposals(self):
        r=self.run_debrief();self.assertEqual(r["criteria_changes"][0]["before"],1)
        self.assertEqual(r["criteria_changes"][0]["value"],2)
        self.assertEqual(self.c["search"]["criteria"]["garage_min"],1)
        self.assertFalse(r["ylopo"]["buyer_link_opened"])
    def test_no_compulsory_task(self):self.assertEqual(self.run_debrief()["fub"]["tasks"],[])
    def test_duplicate_note_suppressed_from_fresh_snapshot(self):
        first=self.run_debrief();self.c["crm_snapshot"]["note_hashes"].append(first["fub"]["note_fingerprint"])
        second=self.run_debrief();self.assertIsNone(second["fub"]["note"]);self.assertEqual(second["fub"]["status"],"DUPLICATE SUPPRESSED")
    def test_duplicate_task_suppressed(self):
        self.d["commitments"][0].update(due="2032-04-19",task_useful=True)
        first=self.run_debrief();self.c["crm_snapshot"]["task_hashes"].append(first["fub"]["tasks"][0]["fingerprint"])
        self.assertEqual(self.run_debrief()["fub"]["tasks"],[])
    def test_optout_suppresses_draft_without_switching_channel(self):
        self.c["buyer"]["opted_out"]=["sms"];r=self.run_debrief()
        self.assertIsNone(r["followup"]["text"]);self.assertIn("SUPPRESSED",r["followup"]["status"])
    def test_all_effects_zero(self):
        self.assertEqual(set(self.run_debrief()["external_effects"].values()),{0})
    def test_exact_crm_and_search_targets(self):
        for key in ("crm_snapshot","search"):
            c=copy.deepcopy(self.c);c[key]["buyer_id"]="wrong"
            with self.subTest(key=key),self.assertRaises(ValueError):self.prep(c)
    def test_access_secrets_rejected_before_generation(self):
        for v in ({"door_code":"1234"},"Lockbox code: 1234","Door code 1234"):
            with self.subTest(v=type(v).__name__),self.assertRaises(ValueError):engine.private_check(v)
    def test_recommendation_and_commitment_require_explicit_scope(self):
        for item in ("recommendation", "commitment"):
            d=copy.deepcopy(self.d)
            target=d["recommendation"] if item=="recommendation" else d["commitments"][0]
            target.pop("scope")
            with self.subTest(item=item),self.assertRaisesRegex(ValueError,"scope"):
                engine.debrief(self.c,self.notes,d)
    def test_scoped_actions_reject_other_property_evidence(self):
        for item in ("recommendation", "commitment"):
            d=copy.deepcopy(self.d)
            target=d["recommendation"] if item=="recommendation" else d["commitments"][0]
            target["property_id"]="p2"
            with self.subTest(item=item),self.assertRaisesRegex(ValueError,"Cross-property"):
                engine.debrief(self.c,self.notes,d)
    def test_each_property_keeps_its_response_fit_and_disposition(self):
        r=self.run_debrief();sources=self.prep()
        first=documents.page(self.c,self.c["properties"][0],sources,r)
        second=documents.page(self.c,self.c["properties"][1],sources,r)
        self.assertIn("Request seepage and repair records",first)
        self.assertNotIn("Request seepage and repair records",second)
        self.assertIn("Set aside based on the confirmed garage requirement",second)
        self.assertIn("Garage falls short of the confirmed minimum",second)
        self.assertNotIn("garage may be a tradeoff",second)
        self.assertIn("Property commitment</b> None agreed",second)
    def test_whole_tour_actions_are_explicit_in_each_reading_view(self):
        for target in (self.d["recommendation"],self.d["commitments"][0]):
            target.update(scope="tour",property_id=None,text="Review the confirmed garage requirement across the tour.",evidence=["e2"])
        self.d["commitments"][0]["text"]="Keep the search at two or more garage spaces."
        r=self.run_debrief()
        for p in self.c["properties"]:
            body=documents.page(self.c,p,self.prep(),r)
            self.assertIn("Whole-tour next move",body);self.assertIn("Whole-tour commitment",body)
        recap=documents.debrief_html(self.c,r)
        self.assertIn("Whole-tour next move",recap);self.assertIn("Whole-tour commitment",recap)
    def test_feedback_requires_property_fit_and_disposition(self):
        for field in ("fit","disposition"):
            d=copy.deepcopy(self.d);d["feedback"][1].pop(field)
            with self.subTest(field=field),self.assertRaises(ValueError):engine.debrief(self.c,self.notes,d)
    def test_identical_agreed_next_move_is_not_repeated(self):
        r=self.run_debrief();p=self.c["properties"][0]
        body=documents.page(self.c,p,self.prep(),r)
        self.assertEqual(body.count("Request seepage and repair records."),1)
        self.assertIn("Agreed: Blaise · no date agreed",body)
        self.assertEqual(r["commitments"][0]["text"],"Request seepage and repair records.")
    def test_plain_english_reading_views_keep_technical_proposals_exact(self):
        r=self.run_debrief();self.assertEqual(r["criteria_changes"][0]["field"],"garage_min")
        views=[documents.debrief_html(self.c,r)]+[documents.page(self.c,p,self.prep(),r) for p in self.c["properties"]]
        for view in views:
            self.assertNotIn("garage_min",view)
            self.assertIn("Minimum garage spaces",view)
            self.assertIn("proposed, not applied",view)
        recap=views[0]
        self.assertIn("Applied search changes: none",recap)
        self.assertIn("Question to confirm",recap)
        self.assertEqual(recap.count(self.d["feedback"][0]["summary"]),1)
        self.assertNotIn(self.d["feedback"][0]["claims"][0]["text"],recap)
    def test_unconfirmed_feedback_is_not_labeled_buyer_confirmed(self):
        self.d["feedback"][0].update(interest="unknown",evidence=["e4"])
        r=self.run_debrief()
        body=documents.page(self.c,self.c["properties"][0],self.prep(),r)
        self.assertIn("Response to verify",body)
        self.assertNotIn("Buyer-confirmed response",body)
    def test_appointment_history_survives_full_before_after_generation(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/"sample";demo.run(out,"unused",render=False)
            before=engine.read(out/"before/private-working.json")
            after=engine.read(out/"after/private-working.json")
            self.assertEqual(after["calendar_advisories"],[])
            for pid,slot,status in (("p1","10:00","confirmed"),("p2","11:00","requested")):
                record=after["appointments"][pid]
                self.assertEqual(record["booking"],before["appointments"][pid]["booking"])
                self.assertEqual(record["booking"]["start"],slot);self.assertEqual(record["booking"]["status"],status)
                self.assertEqual(len(record["history"]),2)
                self.assertIsNone(record["attendance"]["start"]);self.assertIsNone(record["attendance"]["end"])
            for mode in ("Print","Phone"):
                first=(out/"after"/f"01-Private-Padfolio-{mode}.html").read_text(encoding="utf-8")
                second=(out/"after"/f"02-Private-Padfolio-{mode}.html").read_text(encoding="utf-8")
                self.assertIn("Confirmed slot",first);self.assertIn("10 AM–10:30 AM CT",first)
                self.assertIn("Requested (unconfirmed)",second);self.assertIn("11 AM–11:30 AM CT",second)
                self.assertIn("Reported toured",second);self.assertIn("actual times not reported",second)
                self.assertNotIn("seepage",second.lower())
                self.assertNotIn("garage_min",first+second)
            index=(out/"after/START-HERE-Private.html").read_text(encoding="utf-8")
            self.assertIn("Requested (unconfirmed)",index);self.assertIn("actual times not reported",index)
    def test_actual_times_are_separate_and_partial_times_remain_partial(self):
        p=self.c["properties"][1]
        p["showings"].append(dict(status="completed",date="2032-04-18",start="11:07",end=None,source="notes",as_of="2032-04-18T13:00:00-05:00"))
        text=documents.appointment_lines(p)
        self.assertIn("11 AM–11:30 AM CT",text)
        self.assertIn("actual start 11:07 AM CT; end not reported",text)
        p["showings"][-1]["end"]="11:42"
        self.assertIn("end 11:42 AM CT",documents.appointment_lines(p))
        self.assertEqual(engine.appointment_history(p)["booking"]["status"],"requested")
    def test_source_badges_consolidate_without_hiding_uncertainty(self):
        sources=self.prep();p=self.c["properties"][1]
        price=copy.deepcopy(p["facts"][0]);price["value"]=580000;p["facts"].append(price)
        body=documents.page(self.c,p,sources)
        self.assertIn("MLS unless noted otherwise",body)
        self.assertNotIn("[MLS]",body)
        self.assertIn("CONFLICT",body)
        self.assertIn("Unknown [To verify]",body)
        self.assertIn("[Listing-reported]",body)
    def test_outputs_reuse_five_sections_and_stay_private(self):
        with tempfile.TemporaryDirectory() as t:
            out=Path(t)/"prep"
            engine.process(self.c,"Prepare me to show 100 Example Ridge to Morgan Ellis.",out)
            content=(out/"01-Private-Padfolio-Print.html").read_text(encoding="utf-8")
            for title in ("Buyer & tour control","Relationship at a glance","Property quick read","Walk-in plan","Leave with a decision"):
                self.assertIn(title,content)
            self.assertIn("SYNTHETIC DEMONSTRATION",content)
            self.assertTrue((out/"private-working.json").is_file())
            self.assertNotIn("synthetic://",content)
            self.assertEqual(len(json.loads((out/"private-working.json").read_text())["selected"]),1)

if __name__=="__main__":unittest.main()
