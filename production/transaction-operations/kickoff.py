"""Active-task kickoff extension. Produces review drafts and reconciles real receipts.

No mailbox poller, sender, booking service, CRM database or Calendar writer. Context
is a fresh task-local read of existing records, never reusable client defaults.
Contract facts enter only through the existing executed-document engine.
"""
import copy
import hashlib
import json
from pathlib import Path
from sources import require, normalized, timestamp
from deadlines import readable_due


def key(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def prepare(case, result, sources):
    cfg = case["kickoff"]
    require(cfg.get("purpose") in ("active_task", "historical_replay"), "Explicit kickoff purpose required")
    require(case["side"] == "buyer", "Buyer kickoff requires buyer-side context")
    records = {x["id"]: x for x in cfg.get("records", [])}
    require(len(records) == len(cfg.get("records", [])), "Duplicate context evidence ID")
    gaps = []

    def proof(ref):
        require(isinstance(ref, dict), "Context evidence required")
        record = records.get(ref.get("record"))
        require(record is not None, "Unknown context evidence")
        require(record.get("case_id") == case["id"] and record.get("property_id") == case["property"]["id"], "Context evidence belongs to another transaction")
        require(record.get("locator") and record.get("actor") and record.get("kind") in ("email", "system_record", "owner_instruction", "original_confirmation"), "Context evidence needs actual source and actor")
        require(timestamp(record["observed_at"]) <= timestamp(case["as_of"]), "Future context evidence")
        require(normalized(ref.get("quote", "")) and normalized(ref["quote"]) in normalized(record["text"]), "Context quote missing from read source")
        return record

    accepted = result["acceptance"]["valid"]
    transaction_key = key([case["client"]["id"], case["property"]["id"], case["id"]])
    # Executed chronology, not a notification ID or file name, defines a revision.
    package_key = key({"documents": sorted(result.get("executed_document_inventory", []), key=lambda d: d["id"]),
                       "terms": sorted([(x["obligation"], x["document"], x["evidence"]["sha256"], x["evidence"]["version"])
                                        for x in result["chronology"] if x["applied"]])})
    obligations = result["obligations"]
    tc = next((p for p in result["people"] if p["role"] == "tc" and p["assignment_status"] == "assigned"), None)
    if not tc or not tc.get("email"):
        gaps.append("Confirm current TC assignment and recipient; prior use of Laura is not a new assignment.")

    # Recipient-specific factual details require both a source and an explicit
    # relevance decision. No private strategy, raw lender file or portal tokens.
    details = []
    allowed = {"lead_source", "buyer_contact", "listing_agent", "lender", "title", "seller_title", "compensation", "special_circumstance", "price", "financing", "seller_credit", "parties"}
    contractual = {"compensation", "price", "financing", "seller_credit", "parties"}
    for item in cfg.get("details", []):
        require(item["field"] in allowed and item.get("needed_by_tc") is True, "Detail is not approved for TC scope")
        if item["field"] in contractual:
            ref = sources.cite(item["evidence"])
            if not accepted:
                gaps.append(item["field"] + ": dependent on complete executed-package verification")
                continue
            controlling_sources = {o["evidence"]["source"] for o in obligations if o["controlling"]}
            controlling_sources.update(cfg.get("reviewed_supporting_sources", []))
            require(ref["source"] in controlling_sources, "Term is not from reviewed controlling or supporting original")
        else:
            ref = {"quote": item["evidence"]["quote"]}
            proof(item["evidence"])
        require(normalized(item["value"]) in normalized(ref["quote"]), "Detail value differs from cited text")
        details.append(item["field"].replace("_", " ").title() + ": " + item["value"])

    required_details = {"lead_source", "buyer_contact", "listing_agent", "lender", "title", "compensation", "price", "financing"}
    supplied = {item["field"] for item in cfg.get("details", [])}
    for missing in sorted(required_details - supplied):
        gaps.append(missing.replace("_", " ") + ": verify value or explicit transaction-specific not-applicable reason")
    manifest = []
    for item in cfg.get("attachments", []):
        require(item.get("purpose") and item.get("recipient_role") == "tc", "Attachment needs recipient-specific purpose")
        source = sources.records.get(item.get("source"))
        ready = bool(source and source.get("file") and item.get("reviewed_for_recipient") is True
                     and item.get("reviewed_sha256") == source.get("sha256"))
        # A source link must have current access evidence for the actual recipient.
        linked = False
        if not ready and item.get("access_evidence") and source and tc:
            rec = proof(item["access_evidence"])
            linked = (tc["email"].lower() in rec["text"].lower()
                      and source["locator"] in rec["text"] and item.get("reviewed_for_recipient") is True)
        gathered = bool(source and source.get("file") and item.get("reviewed_for_recipient") is not True)
        row = {"source": item.get("source"), "name": item["name"], "purpose": item["purpose"],
               "status": "READY TO ATTACH" if ready else "ACCESSIBLE SOURCE LINK" if linked else "GATHERED — RECIPIENT REVIEW PENDING" if gathered else "MISSING OR UNVERIFIED",
               "locator": source.get("locator") if source else None,
               "sha256": source.get("sha256") if source else None,
               "file": source.get("file") if ready else None}
        manifest.append(row)
        if item.get("required", True) and not (ready or linked):
            gaps.append("Attachment: " + item["name"] + " — retrieve/review the exact original or verify recipient access.")
    if not manifest:
        gaps.append("Executed attachment package has not been gathered.")
    included = {m["source"] for m in manifest if m["status"] in ("READY TO ATTACH", "ACCESSIBLE SOURCE LINK")}
    for required in sorted(set(result.get("executed_document_sources", [])) - included):
        gaps.append("Executed document missing from recipient package: " + required)
    tc_blockers = list(gaps)

    history = cfg.get("handoff_history", [])
    for h in history:
        require(h.get("state") in ("prepared", "sent", "acknowledged"), "Handoff is not an obligation-completion state")
        rec = proof(h["evidence"])
        require(h.get("transaction_key") == transaction_key, "Wrong handoff identity")
        require(h.get("recipient", "").lower() == (tc or {}).get("email", "").lower() and tc, "Wrong handoff recipient")
        require(h.get("package_key"), "Handoff revision binding required")
        if h["state"] == "acknowledged":
            require(rec["actor"].lower() == tc["email"].lower(), "Acknowledgment must come from assigned TC")
        elif h["state"] == "sent":
            require(h.get("sent_message_id") and rec["kind"] in ("email", "system_record"), "Sent receipt required")
    same = [h for h in history if h["package_key"] == package_key]
    rank = {"prepared": 0, "sent": 1, "acknowledged": 2}
    latest = max(same, key=lambda h: rank[h["state"]]) if same else None
    disposition = "SUPPRESS INITIAL HANDOFF" if latest and latest["state"] in ("sent", "acknowledged") else "UPDATE EXISTING DRAFT" if latest else "PREPARE AMENDMENT UPDATE" if history else "PREPARE INITIAL HANDOFF"

    owners = []
    for o in obligations:
        if not o["controlling"]:
            continue
        follow = cfg.get("follow_through", {}).get(o["id"], {})
        owner = o.get("owner")
        assigned = o.get("owner_status") == "assigned"
        if follow.get("owner"):
            proof(follow["evidence"])
            require(follow["owner"] in follow["evidence"]["quote"], "Owner missing from assignment evidence")
            owner, assigned = follow["owner"], True
        path = follow.get("path")
        # Delegation does not prove that the obligation is complete or no longer risky.
        done = o["progress"] in ("Completed", "Received")
        if not done and (not assigned or not path):
            gaps.append(o["title"] + ": confirm owner and source-system/human recheck path")
        if path:
            proof(follow["evidence"])
        owners.append({"id": o["id"], "action": o["title"], "contractual_party": o["responsible_party"],
                       "owner": owner, "owner_confirmed": assigned, "due": o["due"], "state": o["progress"],
                       "source": o["evidence"], "path": path, "next_action": None if done else o["next_action"],
                       "completed": done})

    inspection = copy.deepcopy(cfg.get("inspection", {"state": "unknown"}))
    state = inspection["state"]
    require(state in ("contingent", "waived", "informational", "unknown"), "Inspection election must be explicit")
    if not accepted:
        state = "unknown"
    inspection_ob = next((o for o in obligations if o["kind"] == "inspection" and o["controlling"]), None)
    if state != "unknown":
        election = sources.cite(inspection["evidence"])
        # Only a reviewed controlling election can select a branch.
        controlling = [x for x in result["chronology"] if x["applied"] and x["document"] == inspection.get("document")]
        require(controlling and any(x["evidence"]["source"] == election["source"] for x in controlling), "Inspection election is not controlling")
        require(not (state == "waived" and inspection_ob), "Waived election conflicts with a controlling inspection obligation; reconcile the originals")
    buyer_lines = ["Hi " + case["client"]["name"].split()[0] + ",",
                   "Congratulations on your accepted offer for " + case["property"]["address"] + "." if accepted else
                   "I’m checking the complete signed package for " + case["property"]["address"] + " before confirming the contract and its deadlines."]
    booking_state = "NOT APPLICABLE" if state == "waived" else "NOT CONFIRMED"
    if state == "waived":
        buyer_lines.append("The inspection contingency is waived in the controlling agreement. I’ll help with the remaining next steps; any request for an informational inspection would need its access and scope confirmed first.")
    elif state in ("contingent", "informational"):
        booking = inspection.get("booking")
        if booking:
            proof(booking["evidence"])
            require(booking.get("provider") and booking.get("when") and booking.get("status") in ("requested", "confirmed", "completed"), "Booking needs provider, timing and actual status")
            require(booking["provider"] in booking["evidence"]["quote"] and booking["when"] in booking["evidence"]["quote"], "Booking details not in confirmation")
            booking_state = booking["status"].upper()
            buyer_lines.append("Your inspection with " + booking["provider"] + " is " + booking["status"] + " for " + booking["when"] + ".")
        else:
            chosen = inspection.get("chosen_inspector")
            if chosen:
                proof(chosen["evidence"])
                require(chosen["name"] in chosen["evidence"]["quote"], "Buyer choice not supported")
                buyer_lines.append("We’ll keep your choice of " + chosen["name"] + ". Please confirm availability and the booking details.")
            else:
                options = inspection.get("approved_options", [])
                for option in options:
                    proof(option["approval_evidence"])
                    require(option["name"] in option["approval_evidence"]["quote"], "Inspector approval not supported")
                if options:
                    buyer_lines.append("Inspector options: " + "; ".join(o["name"] + (" — " + o["contact"] if o.get("contact") else "") for o in options) + ". You may choose another qualified inspector.")
                else:
                    gaps.append("Current approved inspector recommendations are missing; do not substitute a vendor merely used before.")
                buyer_lines.append("Please choose your inspector and confirm their availability, services, price, and report turnaround before booking. Send me the confirmation so we can coordinate access.")
            if inspection.get("booking_choices"):
                choice = inspection["booking_choices"]
                proof(choice["evidence"])
                if choice.get("agent_can_help") is True:
                    buyer_lines.append("I can help arrange the inspection, or you can choose and book your own inspector. Tell me which path you prefer so we can confirm the appointment in time.")
        if state == "contingent":
            if inspection_ob:
                buyer_lines.append("The inspection and response deadline is " + readable_due(inspection_ob["due"]) + ". We need time for the report, our review, your decision and any response before that deadline.")
            else:
                gaps.append("Inspection response deadline is not verified.")
        plan = inspection.get("review_plan", {})
        if not plan.get("owner") or not plan.get("recheck_at") or not plan.get("path"):
            gaps.append("Inspection: establish who follows through, when to recheck booking/report, and time for the buyer decision and response.")
        else:
            proof(plan["evidence"])
            require(plan["owner"] in plan["evidence"]["quote"], "Inspection follow-through owner is unsupported")
            recheck = timestamp(plan["recheck_at"])
            if inspection_ob and inspection_ob["due"].get("at"):
                require(recheck < timestamp(inspection_ob["due"]["at"]), "Inspection recheck must precede response deadline")
            if not plan.get("report_expected_at") or not plan.get("decision_review_at"):
                gaps.append("Inspection: confirm report turnaround and reserve decision/response time; booking alone is not completion.")
            else:
                report_at, decision_at = timestamp(plan["report_expected_at"]), timestamp(plan["decision_review_at"])
                require(report_at <= decision_at, "Report must precede decision review")
                if inspection_ob and inspection_ob["due"].get("at"):
                    require(decision_at < timestamp(inspection_ob["due"]["at"]), "No time left for inspection decision/response")
            buyer_lines.append(plan["owner"] + " will follow through on confirmation and report review. I’ll help you decide how to respond.")
    else:
        gaps.append("Verify inspection election and the applicable executed terms before booking guidance.")
    # Reuse the existing engine's role-checked client actions, excluding inspection
    # because this extension has the booking/waiver-aware version above.
    for o in obligations:
        if o["controlling"] and o["kind"] != "inspection" and o["progress"] not in ("Completed", "Received"):
            buyer_lines.extend(a["text"] for a in o.get("audience_actions", []))
    buyer_lines.append("I’m here for questions and the decisions along the way. — Blaise")
    client_disposition = "PREPARE FOR REVIEW"
    if cfg.get("buyer_notice"):
        proof(cfg["buyer_notice"]["evidence"])
        client_disposition = "REVIEW EXISTING NOTICE; SEND ONLY A USEFUL NEW DELTA"

    lines = ["Hi " + ((tc or {}).get("name", "[TC assignment to confirm]").split()[0]) + ",",
             ("Please open the buyer file for " if not history else "Transaction update for ") + case["property"]["address"] + "." if accepted else
             "I’m preparing the file for " + case["property"]["address"] + "; execution evidence is still being verified. Please do not rely on unverified terms.",
             "Buyer: " + case["client"]["name"]]
    lines.extend(details)
    if accepted:
        lines.append("Verified milestones\n" + "\n".join(o["title"] + ": " + readable_due(o["due"]) + ("; amount " + o["amount"] if o.get("amount") is not None else "") for o in obligations if o["controlling"]))
    tc_ids = {o["id"] for o in obligations if "tc" in o.get("handoff_roles", [])}
    if tc_ids:
        lines.append("Ownership and immediate actions\n" + "\n".join(o["action"] + ": " + (o["owner"] or "owner to confirm") + "; " + ("completed per source" if o["completed"] else o["state"] + ". Confirm the next step and evidence within your assigned coordination scope.") for o in owners if o["id"] in tc_ids))
    if not latest or latest["state"] == "prepared":
        lines.append("Please confirm receipt and the file-specific items you are taking on. I’ll retain client advice, decisions, negotiation and exceptions.")
    else:
        lines.append("Your existing receipt/acknowledgment is recorded. This review does not treat every coordination task as completed.")
    lines.append("Documents prepared for review\n" + "\n".join(m["name"] + " — " + m["status"] + (": " + m["locator"] if m["status"] == "ACCESSIBLE SOURCE LINK" else "") for m in manifest))
    lines.append("Blaise")
    if not accepted:
        gaps.extend(result["acceptance"]["issues"])

    # Existing systems retain the state. This plan does not claim it was saved.
    crm = cfg.get("crm", {})
    require(crm.get("client_id") == case["client"]["id"], "Kickoff CRM target mismatch")
    deals = [d for d in crm.get("deals", []) if d.get("property_id") == case["property"]["id"] and d.get("client_id") == case["client"]["id"]]
    if len(deals) > 1:
        deal_action = "RESOLVE MULTIPLE MATCHING DEALS"
        gaps.append("More than one matching deal; resolve before writing.")
    elif deals:
        deal_action = "RECONCILE EXISTING DEAL; NEVER REGRESS A LATER STAGE"
    elif crm.get("all_relevant_statuses_read") is True and crm.get("pipeline_read") is True:
        deal_action = "CREATE ONCE AFTER FRESH DUPLICATE CHECK" if accepted else "HOLD ACCEPTANCE TRANSITION"
    else:
        deal_action = "READ DEALS ACROSS STATUSES AND LIVE PIPELINE BEFORE DECIDING"
        gaps.append("Deal/pipeline discovery incomplete; do not create a second deal.")
    deal_ready = accepted and (len(deals) == 1 or (not deals and crm.get("all_relevant_statuses_read") is True and crm.get("pipeline_read") is True))
    operations = [
        {"id": "file_originals", "action": "Reuse existing transaction folder; compare original hashes; file only missing unchanged originals and read back", "target": case.get("filing", {}).get("transaction"), "state": "PENDING"},
        {"id": "deal", "action": deal_action, "target": deals[0]["id"] if len(deals) == 1 else None, "state": "PENDING" if deal_ready else "HELD"},
        {"id": "deal_files", "action": "Reuse matching Files attachments; attach missing executed Drive originals through supported FUB action and read back", "state": "PENDING" if deal_ready else "HELD"},
        {"id": "relationship", "action": "Reconcile exact contact separately, considering concurrent transactions; preserve truthful later state", "state": "PENDING" if accepted else "HELD"},
        {"id": "follow_through", "action": "Retain owner, deadline, evidence and next recheck in existing workbench/source record; only useful personal commitments become Blaise tasks", "state": "PENDING"},
    ]
    return {"schema": "accepted-contract-kickoff.v1", "purpose": cfg["purpose"], "transaction_key": transaction_key,
            "package_key": package_key, "accepted": accepted, "handoff_state": latest["state"] if latest else "prepared",
            "handoff_disposition": disposition, "tc_draft": {"to": (tc or {}).get("email"), "subject": ("Transaction update" if history else "New Under Contract" if accepted else "File preparation — verification pending") + " — " + case["client"]["name"] + " | " + case["property"]["address"], "body": "\n\n".join(lines), "status": "DRAFT — NOT SENT", "ready_for_send_review": accepted and bool(tc) and not tc_blockers, "blocking_items": tc_blockers},
            "buyer_draft": {"body": "\n\n".join(buyer_lines), "status": "DRAFT — NOT SENT", "disposition": client_disposition},
            "inspection": {"state": state, "booking_state": booking_state, "review_plan": inspection.get("review_plan")},
            "attachments": manifest, "owners": owners, "unresolved": list(dict.fromkeys(gaps)), "operations": operations,
            "external_effects": {"send": 0, "crm": 0, "filing": 0, "calendar": 0, "booking": 0, "schedule": 0}}


def reconcile_receipts(plan, receipts):
    """Check independent post-action reads; an API success alone is insufficient."""
    out = copy.deepcopy(plan)
    by_id = {o["id"]: o for o in out["operations"]}
    require(len({r["operation"] for r in receipts}) == len(receipts), "Duplicate operation receipt")
    for receipt in receipts:
        require(receipt["transaction_key"] == plan["transaction_key"] and receipt["package_key"] == plan["package_key"], "Receipt transaction/revision mismatch")
        op = by_id.get(receipt["operation"])
        require(op is not None and op["state"] != "HELD", "Receipt does not match an executable step")
        require(receipt.get("state") in ("VERIFIED SAVED", "ALREADY REPRESENTED", "PENDING", "BLOCKED"), "Invalid save result")
        if plan["purpose"] == "historical_replay":
            require(receipt.get("replay_only") is True, "Historical replay cannot record live client writes")
        if receipt["state"] in ("VERIFIED SAVED", "ALREADY REPRESENTED"):
            require(receipt.get("readback_locator") and receipt.get("readback_at") and receipt.get("matched_fields"), "Independent readback and matched fields required")
            timestamp(receipt["readback_at"])
            require(receipt.get("target_id"), "Exact affected record required")
            if op.get("target"):
                require(str(receipt["target_id"]) == str(op["target"]), "Readback target mismatch")
        else:
            require(receipt.get("next_owner") and receipt.get("resume_condition"), "Unresolved step needs owner and resume condition")
        op.update(receipt=receipt, state=receipt["state"])
    out["source_system_closeout"] = "VERIFIED" if all(o["state"] in ("VERIFIED SAVED", "ALREADY REPRESENTED") for o in out["operations"]) else "PENDING"
    if plan["purpose"] == "historical_replay":
        out["source_system_closeout"] = "REPLAY ONLY — NO HISTORICAL STATE CHANGED"
    return out


def save_review(plan, out, source_dir):
    """Keep review drafts and original attachment bytes together; never send."""
    out = Path(out)
    root = out / "kickoff"
    root.mkdir()
    (root / "attachments").mkdir()
    for item in plan["attachments"]:
        if item["status"] == "READY TO ATTACH":
            raw = (Path(source_dir) / item["file"]).read_bytes()
            require(hashlib.sha256(raw).hexdigest() == item["sha256"], "Attachment changed after review")
            safe = Path(item["name"]).name
            require(safe == item["name"] and not (root / "attachments" / safe).exists(), "Unsafe or duplicate attachment filename")
            (root / "attachments" / safe).write_bytes(raw)
    (root / "review.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for label, field in (("Laura-or-assigned-TC", "tc_draft"), ("Buyer-next-steps", "buyer_draft")):
        draft = plan[field]
        prefix = "HISTORICAL REPLAY — DO NOT SEND\n" if plan["purpose"] == "historical_replay" else "REVIEW DRAFT — NOT SENT\n"
        (root / (label + ".txt")).write_text(prefix + "Disposition: " + plan["handoff_disposition"] + "\n" +
            ("To: " + (draft.get("to") or "Confirm recipient") + "\nSubject: " + draft["subject"] + "\n" if field == "tc_draft" else "") + "\n" + draft["body"] + "\n", encoding="utf-8")
