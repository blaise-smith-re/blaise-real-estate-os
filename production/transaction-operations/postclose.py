"""Closing-to-relationship preparation within the existing transaction companion.

Agent-supplied evidence is validated for identity, chronology and cited text. This
does not independently read mail, establish legal closing, send, or mutate CRM.
All actual connector work remains with the current authorized operating lane.
"""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

CHICAGO = ZoneInfo("America/Chicago")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    parsed = datetime.fromisoformat(value)
    require(parsed.utcoffset() is not None, "Use explicit-offset timestamps")
    return parsed


def prepare(case):
    """Return a deterministic preparation plan; never an execution receipt."""
    require(case.get("mode") in {"live", "historical_replay", "synthetic"}, "Explicit mode required")
    require(case.get("side") in {"buyer", "seller"}, "Represented side required")
    require(case.get("id") and case.get("property_id"), "Exact transaction/property required")
    client = case["client"]
    require(client.get("id") and client.get("name") and client.get("assigned_user_id") == 33,
            "Bind the exact user-33 client")
    as_of = instant(case["as_of"])
    records = {r["id"]: r for r in case["records"]}
    require(len(records) == len(case["records"]), "Duplicate evidence ID")

    def proof(ref):
        require(isinstance(ref, dict), "Cited evidence required")
        record = records.get(ref.get("record"))
        require(record is not None, "Unknown evidence")
        require((record.get("case_id"), record.get("person_id"), record.get("property_id")) ==
                (case["id"], client["id"], case["property_id"]), "Evidence targets another transaction")
        require(record.get("locator") and record.get("actor") and record.get("kind") and record.get("text"),
                "Preserve original source, actor and readable content")
        require(instant(record["occurred_at"]) <= instant(record["observed_at"]) <= as_of, "Future or inconsistent evidence")
        quote = " ".join(ref.get("quote", "").split())
        require(quote and quote in " ".join(record["text"].split()), "Quote missing from source")
        require(case["mode"] != "live" or not record.get("synthetic"), "Synthetic evidence cannot support a live case")
        return record

    closing = []
    for event in case.get("closing_events", []):
        require(event["state"] in {"scheduled", "signed", "confirmed", "disputed"}, "Unknown closing state")
        record = proof(event["evidence"])
        if event["state"] == "confirmed":
            require(record.get("actor_role") == "closing_party" and record.get("kind") in
                    {"original_confirmation", "email", "human_verification"},
                    "Completed closing needs the authorized closing party; a CRM label/calendar date is insufficient")
        closing.append((instant(record["occurred_at"]), event, record))
    closing.sort(key=lambda x: x[0])
    state = closing[-1][1]["state"] if closing else "unknown"
    if closing and len({e[1]["state"] for e in closing if e[0] == closing[-1][0]}) > 1:
        state = "disputed"
    confirmed = state == "confirmed"
    result = {"case_id": case["id"], "person_id": client["id"], "as_of": case["as_of"],
              "mode": case["mode"], "closing_state": state, "closing_source": closing[-1][2]["locator"] if closing else None,
              "close_date": closing[-1][0].astimezone(CHICAGO).date().isoformat() if confirmed else None,
              "wrap_up": [], "relationship_context": [], "drafts": [], "review": {},
              "proposed_internal_changes": [], "gaps": list(case.get("coverage", {}).get("gaps", [])),
              "mutation_eligible": case["mode"] == "live", "executed_changes": [],
              "runtime": "active-task preparation; no writer, sender, schedule or background monitor"}
    touches, seen = [], set()
    allowed_touches = {"congratulations", "check_in", "review_request", "review_reminder", "review_agreed",
                       "review_declined", "review_submission", "review_verified", "referral_request"}
    for touch in case.get("touches", []):
        require(touch["kind"] in allowed_touches, "Unknown touch kind")
        record = proof(touch["evidence"])
        require(touch["status"] in {"draft", "sent", "received", "verified"}, "Unknown delivery status")
        if touch["kind"].startswith("review_"):
            require(touch.get("platforms"), "Review evidence must name affected platforms")
        if touch["kind"] in {"review_agreed", "review_declined", "review_submission"}:
            require(touch["status"] == "received", "Client review outcome needs an actual received response")
        if touch["kind"] in {"congratulations", "check_in", "review_request", "review_reminder", "referral_request"}:
            require(touch["status"] in {"draft", "sent"}, "Outgoing touch needs actual draft/sent state")
        if touch["status"] == "sent":
            require(record.get("delivery") == "sent", "Draft/quoted mail cannot establish a sent touch")
        if touch["status"] == "received":
            require(record.get("delivery") == "received", "Client response needs received evidence")
        if touch["kind"] == "review_verified":
            require(touch["status"] == "verified" and record.get("kind") == "public_review",
                    "Public review status needs the actual review")
        identity = (touch["kind"], record["locator"], tuple(sorted(touch.get("platforms", []))))
        if identity not in seen:
            touches.append((touch, record))
            seen.add(identity)
    touches.sort(key=lambda x: instant(x[1]["occurred_at"]))
    service_concern = False
    for item in case.get("wrap_up", []):
        proof(item["evidence"])
        require(item.get("owner") and item.get("next_action") and item.get("status") in
                {"open", "waiting", "complete", "unknown"}, "Wrap-up needs actual owner, action and status")
        if item["status"] != "complete":
            require(item.get("resume_when"), "Unfinished work needs a resume condition")
            service_concern |= item.get("client_concern") is True
        result["wrap_up"].append(item)
    for item in case.get("relationship_context", []):
        proof(item["evidence"])
        require(item.get("text") and item.get("status") in {"confirmed", "reported", "offer", "commitment"},
                "Distinguish client facts, agent offers and actual commitments")
        result["relationship_context"].append(item)

    coverage = case.get("coverage", {})
    channel = case.get("channel", {})
    channel_ok = channel.get("eligibility") == "verified" and bool(channel.get("evidence"))
    if channel.get("evidence"):
        proof(channel["evidence"])
    base_holds = []
    if case["mode"] != "live":
        base_holds.append(case["mode"].upper() + " — DO NOT SEND OR CHANGE LIVE RECORDS")
    if not confirmed:
        base_holds.append("Confirm completed closing with the authorized closing party")
    if not channel_ok:
        base_holds.append("Resolve contact/channel eligibility under current instructions")
    if coverage.get("outreach_checked") is not True:
        base_holds.append("Check the material communication gap before another touch")
    if channel.get("no_contact"):
        base_holds.append("Honor the client's no-contact instruction")

    def draft(kind, holds, platforms=None):
        authored = case.get("draft_copy", {}).get(kind)
        if not authored:
            return
        require(authored.get("text") and authored.get("context_evidence"), "Draft needs specific grounded context")
        for ref in authored["context_evidence"]:
            proof(ref)
        result["drafts"].append({"kind": kind, "text": authored["text"], "channel": channel.get("name"),
                                 "platforms": platforms or [], "status": "HOLD" if holds else "READY FOR REVIEW",
                                 "holds": list(dict.fromkeys(holds)), "sent": False})

    congrats_sent = any(t["kind"] == "congratulations" and t["status"] == "sent" for t, _ in touches)
    result["congratulations"] = "already_sent" if congrats_sent else "not_observed"
    if not congrats_sent:
        draft("congratulations", base_holds)
    # A new check-in requires a real reason; elapsed time alone is not a cadence.
    if case.get("check_in_reason"):
        proof(case["check_in_reason"])
        draft("check_in", base_holds)

    request_platforms, reminder_platforms, link_holds = [], [], []
    policy = case.get("review_policy", {})
    require(policy.get("source") and policy.get("read_at"), "Load current Outreach review guidance")
    require(instant(policy["read_at"]) <= as_of, "Future policy read")
    minimum, maximum = policy.get("reminder_days", [None, None])
    require(isinstance(minimum, int) and isinstance(maximum, int) and 0 <= minimum <= maximum,
            "Reminder window comes from current guidance")
    links = policy.get("links", {})
    require(links, "Resolve current approved review links")
    for platform, link in links.items():
        relevant = [(t, r) for t, r in touches if platform in t.get("platforms", []) and t["status"] != "draft"]
        kinds = {t["kind"] for t, _ in relevant}
        if "review_declined" in kinds:
            status = "declined"
        elif "review_verified" in kinds:
            status = "publicly_verified"
        elif "review_submission" in kinds:
            status = "client_reported_submission"
        elif "review_reminder" in kinds:
            status = "reminder_already_sent"
        elif "review_request" in kinds:
            status = "requested_wait"
            requests = [(t, r) for t, r in relevant if t["kind"] == "review_request" and t["status"] == "sent"]
            agreements = [(t, r) for t, r in relevant if t["kind"] == "review_agreed" and t["status"] == "received"]
            if requests and agreements:
                anchor = max(instant(requests[-1][1]["occurred_at"]), instant(agreements[-1][1]["occurred_at"]))
                days = (as_of.astimezone(CHICAGO).date() - anchor.astimezone(CHICAGO).date()).days
                if minimum <= days <= maximum:
                    status = "one_reminder_candidate"
                    reminder_platforms.append(platform)
                elif days > maximum:
                    status = "past_reminder_window_no_automatic_chase"
        else:
            status = "initial_request_candidate"
            request_platforms.append(platform)
        result["review"][platform] = status
        if platform in request_platforms + reminder_platforms:
            require(link.get("url", "").startswith("https://") and link.get("authority"), "Approved exact review URL required")
            if not link.get("destination_verified"):
                link_holds.append("Verify " + platform + " review form identifies Blaise before use")
    ask_holds = base_holds + link_holds
    if service_concern:
        ask_holds.append("Address the unresolved service concern first; never screen for favorable ratings")
    for kind, platforms in (("review_request", request_platforms), ("review_reminder", reminder_platforms)):
        if platforms and kind in case.get("draft_copy", {}):
            text = case["draft_copy"][kind]["text"]
            require(all(links[p]["url"] in text for p in platforms), "Draft is missing an approved review link")
            require(all(v["url"] not in text for p, v in links.items() if p not in platforms),
                    "Do not re-request a platform already handled")
            draft(kind, ask_holds, platforms)
    if case.get("referral_reason") and not any(t["kind"] == "referral_request" and t["status"] == "sent" for t, _ in touches):
        proof(case["referral_reason"])
        draft("referral", base_holds + (["Address the unresolved service concern first"] if service_concern else []))

    crm = case.get("crm", {})
    if confirmed:
        if crm.get("contact_stage_is_closed") is not True:
            if crm.get("other_active_transaction") is False:
                result["proposed_internal_changes"].append({"action": "reconcile_contact_stage", "person_id": client["id"]})
            else:
                result["gaps"].append("Reconcile other active transactions before changing the relationship stage")
        if crm.get("deal_id") and crm.get("deal_stage_is_closed") is not True:
            require(crm.get("deal_person_id") == client["id"] and crm.get("deal_user_ids") == [33],
                    "Exact owned deal required")
            result["proposed_internal_changes"].append({"action": "reconcile_deal_closed", "deal_id": crm["deal_id"]})
        elif not crm.get("deal_id"):
            result["gaps"].append("Resolve the exact existing deal before CRM deal maintenance")
    # Closing never completes all tasks. Only explicit, supported dispositions qualify.
    for task in case.get("task_dispositions", []):
        proof(task["evidence"])
        require(task.get("person_id") == client["id"] and task.get("user_id") == 33,
                "Task itself must belong to user 33 and this contact")
        require(task.get("reason") and task.get("disposition") in {"complete", "obsolete"}, "Supported task outcome required")
        result["proposed_internal_changes"].append({"action": "reconcile_task", **task})
    if case["mode"] != "live":
        result["proposed_internal_changes"] = []
    result["plan_key"] = hashlib.sha256(json.dumps(case, sort_keys=True).encode()).hexdigest()
    return result


def run(case_path, output):
    case_path, output = Path(case_path).resolve(), Path(output).resolve()
    module_root = Path(__file__).resolve().parent
    source_root = module_root.parents[1] if module_root.parent.name == "production" else module_root
    require(not case_path.is_relative_to(source_root) and not output.is_relative_to(source_root),
            "Keep client inputs and outputs outside repository source")
    result = prepare(json.loads(case_path.read_text(encoding="utf-8")))
    output.mkdir(parents=True, exist_ok=False)
    (output / "postclose.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    lines = ["# Closing-to-relationship preparation", "", "Closing: " + result["closing_state"],
             "Mode: " + result["mode"], "No external messages or source-system writes performed.", ""]
    for item in result["wrap_up"]:
        lines.append(f"- {item['title']}: {item['status']} — {item['owner']}. {item['next_action']}")
    for draft in result["drafts"]:
        lines.extend(["", "## " + draft["kind"] + " — " + draft["status"], "", draft["text"], ""])
        lines.extend("- " + hold for hold in draft["holds"])
    (output / "review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    result = run(args.case, args.out)
    print(json.dumps({"closing_state": result["closing_state"], "drafts": len(result["drafts"]),
                      "proposed_changes": len(result["proposed_internal_changes"]), "executed_changes": 0}))
