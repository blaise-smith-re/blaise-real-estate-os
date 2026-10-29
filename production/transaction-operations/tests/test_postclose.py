import copy
import json
import sys
import tempfile
import subprocess
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from postclose import prepare, run


def fixture():
    """Entirely fictional input; also documents the small operator input contract."""
    record = {"id": "close", "case_id": "example", "person_id": 99, "property_id": "lot-1",
              "locator": "synthetic://title/1", "actor": "Example Closer", "actor_role": "closing_party",
              "kind": "original_confirmation", "occurred_at": "2026-10-06T15:05:00-05:00",
              "observed_at": "2026-10-29T12:00:00-05:00", "text": "We are closed.", "synthetic": True}
    ref = {"record": "close", "quote": "We are closed."}
    return {"id": "example", "mode": "synthetic", "side": "buyer", "property_id": "lot-1",
            "as_of": "2026-10-29T13:00:00-05:00",
            "client": {"id": 99, "name": "Example Buyer", "assigned_user_id": 33},
            "records": [record], "closing_events": [{"state": "confirmed", "evidence": ref}],
            "touches": [], "coverage": {"outreach_checked": True, "gaps": []},
            "channel": {"name": "email", "eligibility": "verified", "evidence": ref},
            "crm": {"contact_stage_is_closed": True, "deal_id": 17, "deal_stage_is_closed": True},
            "review_policy": {"source": "synthetic://outreach", "read_at": "2026-10-29T12:00:00-05:00",
                              "reminder_days": [5, 7], "links": {
                                  "Google": {"url": "https://example.test/google", "authority": "fictional", "destination_verified": True},
                                  "Zillow": {"url": "https://example.test/zillow", "authority": "fictional", "destination_verified": True}}},
            "draft_copy": {"congratulations": {"text": "Congratulations on your purchase!", "context_evidence": [ref]},
                           "review_request": {"text": "Please share honest feedback: https://example.test/google https://example.test/zillow", "context_evidence": [ref]},
                           "review_reminder": {"text": "Here are the links you requested: https://example.test/google https://example.test/zillow", "context_evidence": [ref]}}}


def touch(case, kind, status="sent", date="2026-10-23T12:00:00-05:00", platforms=None):
    rid = "touch-" + str(len(case["records"]))
    rec = copy.deepcopy(case["records"][0])
    rec.update(id=rid, locator="synthetic://" + rid, actor="Example Client" if status == "received" else "Example Agent",
               actor_role="client" if status == "received" else "agent", kind="email", occurred_at=date,
               text=kind, delivery=status)
    case["records"].append(rec)
    event = {"kind": kind, "status": status, "platforms": platforms or ["Google", "Zillow"],
             "evidence": {"record": rid, "quote": kind}}
    case["touches"].append(event)
    return rec, event


class PostcloseTests(unittest.TestCase):
    def test_scheduled_and_signed_do_not_trigger_closed_changes(self):
        for state in ["scheduled", "signed"]:
            c = fixture(); c["closing_events"][0]["state"] = state
            r = prepare(c)
            self.assertIsNone(r["close_date"])
            self.assertTrue(all(d["status"] == "HOLD" for d in r["drafts"]))
            self.assertEqual(r["proposed_internal_changes"], [])

    def test_crm_label_is_not_closing_confirmation(self):
        c = fixture(); c["records"][0]["kind"] = "system_record"
        with self.assertRaisesRegex(ValueError, "authorized closing party"):
            prepare(c)

    def test_confirmation_uses_chicago_date(self):
        c = fixture(); c["records"][0]["occurred_at"] = "2026-10-07T01:00:00+00:00"
        self.assertEqual(prepare(c)["close_date"], "2026-10-06")

    def test_sent_congratulations_suppresses_draft_but_draft_does_not(self):
        c = fixture(); rec, event = touch(c, "congratulations", "draft")
        self.assertTrue(any(d["kind"] == "congratulations" for d in prepare(c)["drafts"]))
        rec["delivery"] = event["status"] = "sent"
        self.assertFalse(any(d["kind"] == "congratulations" for d in prepare(c)["drafts"]))

    def test_false_send_assertion_rejected(self):
        c = fixture(); rec, _ = touch(c, "review_request"); rec["delivery"] = "draft"
        with self.assertRaisesRegex(ValueError, "cannot establish"):
            prepare(c)

    def test_existing_request_without_agreement_is_not_chased(self):
        c = fixture(); touch(c, "review_request")
        self.assertEqual(prepare(c)["drafts"][0]["kind"], "congratulations")
        self.assertEqual(len(prepare(c)["drafts"]), 1)

    def test_one_reminder_in_sourced_window_then_stop(self):
        c = fixture(); touch(c, "review_request"); touch(c, "review_agreed", "received")
        self.assertIn("review_reminder", [d["kind"] for d in prepare(c)["drafts"]])
        touch(c, "review_reminder")
        self.assertNotIn("review_reminder", [d["kind"] for d in prepare(c)["drafts"]])

    def test_old_request_not_backfilled_into_reminder_schedule(self):
        c = fixture(); touch(c, "review_request", date="2026-10-10T12:00:00-05:00")
        touch(c, "review_agreed", "received", date="2026-10-10T13:00:00-05:00")
        self.assertEqual(prepare(c)["review"]["Google"], "past_reminder_window_no_automatic_chase")

    def test_reported_submission_is_not_public_verification_or_new_request(self):
        c = fixture(); touch(c, "review_submission", "received")
        r = prepare(c)
        self.assertEqual(r["review"]["Google"], "client_reported_submission")
        self.assertNotIn("review_request", [d["kind"] for d in r["drafts"]])

    def test_partial_platform_status_does_not_repeat_completed_platform(self):
        c = fixture(); touch(c, "review_submission", "received", platforms=["Google"])
        with self.assertRaisesRegex(ValueError, "already handled"):
            prepare(c)
        c["draft_copy"]["review_request"]["text"] = "If helpful: https://example.test/zillow"
        self.assertEqual(prepare(c)["drafts"][-1]["platforms"], ["Zillow"])

    def test_decline_and_no_contact(self):
        c = fixture(); touch(c, "review_declined", "received")
        self.assertNotIn("review_request", [d["kind"] for d in prepare(c)["drafts"]])
        c["channel"]["no_contact"] = True
        self.assertTrue(all(d["status"] == "HOLD" for d in prepare(c)["drafts"]))

    def test_missing_coverage_and_unverified_link_hold_only_outreach(self):
        c = fixture(); c["coverage"]["outreach_checked"] = False
        c["review_policy"]["links"]["Zillow"]["destination_verified"] = False
        r = prepare(c)
        self.assertEqual(r["closing_state"], "confirmed")
        self.assertEqual(r["drafts"][-1]["status"], "HOLD")
        self.assertEqual(len(r["drafts"][-1]["holds"]), 3)

    def test_agent_sent_message_cannot_be_a_client_agreement(self):
        c = fixture(); touch(c, "review_agreed", "sent")
        with self.assertRaisesRegex(ValueError, "actual received response"):
            prepare(c)

    def test_replay_copy_is_explicitly_not_sendable(self):
        c = fixture(); c["mode"] = "historical_replay"
        self.assertIn("DO NOT SEND", prepare(c)["drafts"][0]["holds"][0])

    def test_wrong_target_future_and_synthetic_live_rejected(self):
        for field, value in [("person_id", 100), ("occurred_at", "2027-10-29T12:00:00-05:00")]:
            c = fixture(); c["records"][0][field] = value
            with self.assertRaises(ValueError): prepare(c)
        c = fixture(); c["mode"] = "live"
        with self.assertRaisesRegex(ValueError, "Synthetic"):
            prepare(c)

    def test_replay_is_read_only_and_repeat_stable(self):
        c = fixture(); c["mode"] = "historical_replay"; c["crm"]["deal_stage_is_closed"] = False
        c["crm"].update(deal_person_id=99, deal_user_ids=[33])
        a, b = prepare(c), prepare(c)
        self.assertEqual(a, b)
        self.assertEqual(a["proposed_internal_changes"], [])
        self.assertFalse(a["mutation_eligible"])
        self.assertEqual(a["executed_changes"], [])

    def test_other_transaction_keeps_contact_stage_and_delegated_work(self):
        c = fixture(); c["mode"] = "live"; c["records"][0]["synthetic"] = False
        c["crm"].update(contact_stage_is_closed=False, other_active_transaction=True)
        c["wrap_up"] = [{"title": "Final documents", "status": "waiting", "owner": "Assigned coordinator",
                         "next_action": "Await final delivery", "resume_when": "Provider sends the final package",
                         "evidence": c["closing_events"][0]["evidence"]}]
        r = prepare(c)
        self.assertEqual(r["proposed_internal_changes"], [])
        self.assertEqual(r["wrap_up"][0]["owner"], "Assigned coordinator")

    def test_closing_does_not_complete_tasks_and_wrong_task_owner_rejected(self):
        c = fixture(); c["task_dispositions"] = [{"id": 8, "person_id": 99, "user_id": 1,
            "disposition": "complete", "reason": "Specific work complete", "evidence": c["closing_events"][0]["evidence"]}]
        with self.assertRaisesRegex(ValueError, "Task itself"):
            prepare(c)

    def test_cli_writes_review_and_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); source = root / "case.json"; source.write_text(json.dumps(fixture()))
            run(source, root / "output")
            self.assertIn("No external messages", (root / "output/review.md").read_text())
            with self.assertRaises(FileExistsError): run(source, root / "output")

    def test_portable_cli_accepts_private_sibling_directory(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); package = root / "transaction-operations"; package.mkdir()
            script = package / "postclose.py"
            script.write_text((Path(__file__).resolve().parents[1] / "postclose.py").read_text())
            source = root / "case.json"; source.write_text(json.dumps(fixture()))
            execution = subprocess.run([sys.executable, str(script), "--case", str(source), "--out", str(root / "output")],
                                       capture_output=True, text=True)
            self.assertEqual(execution.returncode, 0, execution.stderr)
            self.assertTrue((root / "output/postclose.json").is_file())


if __name__ == "__main__":
    unittest.main()
