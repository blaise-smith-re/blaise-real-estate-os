"""Behavior tests use fictional originals; no historical client state is mutated."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fixture_pack
from engine import reconcile
from fixture_pack import make_pack, fixture, pdf
from kickoff import key, prepare, reconcile_receipts, save_review
from sources import Sources, EvidenceError, digest


def context(case, analysis, folder):
    source = Sources(folder, case["sources"], True)
    text = "Taylor Coordinator owns deposit follow-through. Blaise Smith owns inspection booking follow-through. Buyer chooses Example Inspector. Example Inspector confirmed September 17 at 9 a.m. Taylor Coordinator: I have taken this file."
    ref = {"record": "mail", "quote": text}
    cfg = {"purpose": "historical_replay", "records": [{"id": "mail", "case_id": case["id"], "property_id": case["property"]["id"], "kind": "email", "actor": next(p["email"] for p in case["people"] if p["role"] == "tc"), "locator": "synthetic://mail/1", "observed_at": case["as_of"], "text": text}],
           "details": [], "attachments": [{"source": "pa", "name": "Agreement.pdf", "purpose": "Controlling original", "recipient_role": "tc", "reviewed_for_recipient": True, "reviewed_sha256": source.records["pa"]["sha256"]}],
           "inspection": {"state": "contingent", "document": "pa", "evidence": analysis["obligations"][1]["evidence"],
                          "approved_options": [{"name": "Example Inspector", "contact": "example.invalid", "approval_evidence": ref}],
                          "review_plan": {"owner": "Blaise Smith", "path": "Existing workbench and assigned follow-up", "recheck_at": "2026-09-15T10:00:00-05:00", "report_expected_at": "2026-09-18T12:00:00-05:00", "decision_review_at": "2026-09-18T16:00:00-05:00", "evidence": ref}},
           "follow_through": {o["id"]: {"path": "Existing transaction workbench; assigned owner recheck", "evidence": ref} for o in analysis["obligations"]},
           "crm": {"client_id": case["client"]["id"], "all_relevant_statuses_read": True, "pipeline_read": True, "deals": [{"id": "deal-1", "client_id": case["client"]["id"], "property_id": case["property"]["id"], "stage": "Pending"}]}}
    return cfg


class KickoffTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.folder = make_pack(Path(cls.temp.name) / "originals")

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.c, self.a, _ = fixture(self.folder)
        self.c["kickoff"] = context(self.c, self.a, self.folder)

    def plan(self):
        return reconcile(self.c, self.a, self.folder)["kickoff"]

    def history(self, state):
        plan = self.plan()
        return {"state": state, "transaction_key": plan["transaction_key"], "package_key": plan["package_key"], "recipient": next(p["email"] for p in self.c["people"] if p["role"] == "tc"), "sent_message_id": "message-1", "evidence": {"record": "mail", "quote": "I have taken this file."}}

    def test_inspection_options_not_scheduled(self):
        p = self.plan()
        self.assertEqual(p["inspection"]["booking_state"], "NOT CONFIRMED")
        self.assertIn("report, our review, your decision", p["buyer_draft"]["body"])
        self.assertIn("Example Inspector", p["buyer_draft"]["body"])

    def test_existing_booking_preserved(self):
        self.c["kickoff"]["inspection"]["booking"] = {"provider": "Example Inspector", "when": "September 17 at 9 a.m.", "status": "confirmed", "evidence": {"record": "mail", "quote": "Example Inspector confirmed September 17 at 9 a.m."}}
        p = self.plan()
        self.assertEqual(p["inspection"]["booking_state"], "CONFIRMED")
        self.assertNotIn("Please choose your inspector", p["buyer_draft"]["body"])

    def test_chosen_inspector_preserved(self):
        self.c["kickoff"]["inspection"]["chosen_inspector"] = {"name": "Example Inspector", "evidence": {"record": "mail", "quote": "Buyer chooses Example Inspector."}}
        self.assertIn("keep your choice", self.plan()["buyer_draft"]["body"])

    def test_arranging_help_offered_without_booking_claim(self):
        self.c["kickoff"]["inspection"]["booking_choices"] = {"agent_can_help": True, "evidence": {"record": "mail", "quote": "Blaise Smith owns inspection booking follow-through."}}
        p = self.plan()
        self.assertIn("choose and book your own inspector", p["buyer_draft"]["body"])
        self.assertEqual(p["inspection"]["booking_state"], "NOT CONFIRMED")

    def test_waived_inspection_never_requests_booking(self):
        # Read an actual fictional waiver original, not a contingent source relabeled waived.
        waiver = "Inspection election illustration: inspection contingency waived; no contractual inspection response deadline."
        terms = list(fixture_pack.TERMS)
        terms[1] = ("Inspection", waiver)
        with tempfile.TemporaryDirectory() as tmp, patch.object(fixture_pack, "TERMS", terms):
            folder = make_pack(Path(tmp) / "waived")
            c, a, _ = fixture(folder)
            c["kickoff"] = context(c, a, folder)
            c["kickoff"]["inspection"].update(state="waived", evidence=fixture_pack.cite(folder, "pa", 2, "Inspection", waiver))
            a["obligations"] = [o for o in a["obligations"] if o["kind"] != "inspection"]
            a["recommendation"] = {"text": "Confirm deposit receipt.", "reason": "Inspection is waived in this fictional original.", "evidence": [a["obligations"][0]["evidence"]]}
            p = reconcile(c, a, folder)["kickoff"]
        self.assertEqual(p["inspection"]["booking_state"], "NOT APPLICABLE")
        self.assertNotIn("Inspector options:", p["buyer_draft"]["body"])
        self.assertNotIn("Please choose your inspector", p["buyer_draft"]["body"])

    def test_waiver_cannot_silently_hide_contingent_deadline(self):
        self.c["kickoff"]["inspection"]["state"] = "waived"
        with self.assertRaises(EvidenceError):
            self.plan()

    def test_incomplete_execution_continues_preparation(self):
        self.a["documents"][0]["completion"]["signatures"]["confirmed"] = False
        p = self.plan()
        self.assertFalse(p["accepted"])
        self.assertEqual(p["inspection"]["state"], "unknown")
        self.assertNotIn("Congratulations", p["buyer_draft"]["body"])
        self.assertEqual(p["attachments"][0]["status"], "READY TO ATTACH")
        self.assertEqual(next(o for o in p["operations"] if o["id"] == "deal")["state"], "HELD")

    def test_missing_attachment_blocks_send_review_not_other_work(self):
        self.c["kickoff"]["attachments"][0]["source"] = "absent"
        p = self.plan()
        self.assertIn("MISSING OR UNVERIFIED", p["tc_draft"]["body"])
        self.assertFalse(p["tc_draft"]["ready_for_send_review"])
        self.assertTrue(p["buyer_draft"]["body"])

    def test_review_hash_must_match_attachment(self):
        self.c["kickoff"]["attachments"][0]["reviewed_sha256"] = "changed"
        self.assertEqual(self.plan()["attachments"][0]["status"], "MISSING OR UNVERIFIED")

    def test_incorporated_package_member_cannot_be_omitted(self):
        p = self.plan()
        self.assertIn("Executed document missing from recipient package: terms", p["tc_draft"]["blocking_items"])

    def test_private_next_action_not_leaked_to_tc(self):
        self.a["obligations"][0]["next_action"] = "PRIVATE STRATEGY DO NOT SHARE"
        p = self.plan()
        self.assertNotIn("PRIVATE STRATEGY", p["tc_draft"]["body"])
        self.assertIn("PRIVATE STRATEGY", p["owners"][0]["next_action"])

    def test_repeated_notification_is_not_new_handoff(self):
        self.c["kickoff"]["handoff_history"] = [self.history("sent")]
        p = self.plan()
        self.assertEqual(p["handoff_disposition"], "SUPPRESS INITIAL HANDOFF")
        self.assertEqual(p, self.plan())
        self.assertEqual(p["operations"][1]["target"], "deal-1")

    def test_acknowledged_is_not_all_completed(self):
        self.c["kickoff"]["handoff_history"] = [self.history("acknowledged")]
        p = self.plan()
        self.assertEqual(p["handoff_state"], "acknowledged")
        self.assertTrue(any(not o["completed"] for o in p["owners"]))
        self.assertNotIn("Please confirm receipt", p["tc_draft"]["body"])

    def test_acknowledgment_wrong_actor_rejected(self):
        self.c["kickoff"]["handoff_history"] = [self.history("acknowledged")]
        self.c["kickoff"]["records"][0]["actor"] = "someone-else@example.invalid"
        with self.assertRaises(EvidenceError):
            self.plan()

    def test_amendment_updates_same_transaction(self):
        before = self.plan()
        hist = self.history("acknowledged")
        self.c, self.a, _ = fixture(self.folder, phase="update")
        self.c["kickoff"] = context(self.c, self.a, self.folder)
        self.c["kickoff"]["handoff_history"] = [hist]
        after = self.plan()
        self.assertEqual(before["transaction_key"], after["transaction_key"])
        self.assertNotEqual(before["package_key"], after["package_key"])
        self.assertEqual(after["handoff_disposition"], "PREPARE AMENDMENT UPDATE")
        self.assertEqual(after["operations"][1]["target"], "deal-1")

    def test_delegated_overdue_item_still_visible(self):
        self.c["as_of"] = "2026-09-22T10:00:00-05:00"
        p = self.plan()
        self.assertTrue(any(o["next_action"] for o in p["owners"] if not o["completed"]))

    def test_unknown_tc_not_defaulted(self):
        next(p for p in self.c["people"] if p["role"] == "tc")["assignment_status"] = "unknown"
        self.assertIsNone(self.plan()["tc_draft"]["to"])

    def test_multiple_matching_deals_hold_creation(self):
        self.c["kickoff"]["crm"]["deals"].append({**self.c["kickoff"]["crm"]["deals"][0], "id": "deal-2"})
        self.assertEqual(self.plan()["operations"][1]["action"], "RESOLVE MULTIPLE MATCHING DEALS")
        self.assertEqual(self.plan()["operations"][1]["state"], "HELD")

    def test_future_and_wrong_transaction_context_rejected(self):
        for field, value in (("case_id", "wrong"), ("observed_at", "2030-01-01T00:00:00-06:00")):
            c = copy.deepcopy(self.c)
            c["kickoff"]["records"][0][field] = value
            with self.assertRaises(EvidenceError):
                reconcile(c, self.a, self.folder)

    def test_no_assumed_source_system_save(self):
        p = self.plan()
        self.assertTrue(all(o["state"] == "PENDING" for o in p["operations"]))
        self.assertFalse(any(p["external_effects"].values()))

    def test_receipt_requires_independent_readback(self):
        p = self.plan()
        r = {"operation": "deal", "transaction_key": p["transaction_key"], "package_key": p["package_key"], "state": "VERIFIED SAVED", "replay_only": True}
        with self.assertRaises(EvidenceError):
            reconcile_receipts(p, [r])
        r.update(target_id="deal-1", readback_locator="synthetic://deal/1", readback_at=self.c["as_of"], matched_fields=["stage"])
        out = reconcile_receipts(p, [r])
        self.assertEqual(out["source_system_closeout"], "REPLAY ONLY — NO HISTORICAL STATE CHANGED")
        r["target_id"] = "deal-wrong"
        with self.assertRaises(EvidenceError):
            reconcile_receipts(p, [r])

    def test_replay_rejects_live_receipt(self):
        p = self.plan()
        with self.assertRaises(EvidenceError):
            reconcile_receipts(p, [{"operation": "deal", "transaction_key": p["transaction_key"], "package_key": p["package_key"], "state": "PENDING", "next_owner": "Blaise", "resume_condition": "Read live deal"}])

    def test_unsafe_attachment_filename_rejected(self):
        p = self.plan()
        p["attachments"][0]["name"] = "../escape.pdf"
        with tempfile.TemporaryDirectory() as d, self.assertRaises(EvidenceError):
            save_review(p, d, self.folder)

    def test_review_packet_copies_exact_original_and_no_send_claim(self):
        p = self.plan()
        with tempfile.TemporaryDirectory() as d:
            save_review(p, d, self.folder)
            out = Path(d) / "kickoff"
            self.assertEqual(digest((out / "attachments/Agreement.pdf").read_bytes()), p["attachments"][0]["sha256"])
            self.assertIn("DO NOT SEND", (out / "Laura-or-assigned-TC.txt").read_text(encoding="utf-8"))

    def test_late_inspection_review_rejected(self):
        self.c["kickoff"]["inspection"]["review_plan"]["decision_review_at"] = "2026-09-22T16:00:00-05:00"
        with self.assertRaises(EvidenceError):
            self.plan()


if __name__ == "__main__":
    unittest.main()
