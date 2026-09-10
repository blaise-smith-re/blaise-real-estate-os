"""Showing prep/debrief validation and generation. Local files only; no external writes."""
from pathlib import Path
from datetime import datetime, date
from zoneinfo import ZoneInfo
import argparse, hashlib, json, re

ROOT = Path(__file__).resolve().parent
LABELS = {"buyer-confirmed", "Blaise observation", "hypothesis", "verified MLS", "listing-reported", "public record", "unknown"}
STATES = {"planned", "requested", "confirmed", "cancelled", "completed"}
ACTIONS = {"pursue", "compare", "verify", "refine_search", "lender", "move_on"}

def read(p): return json.loads(Path(p).read_text(encoding="utf-8-sig"))
def write(p, value):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
def require(ok, message):
    if not ok: raise ValueError(message)
def digest(value): return hashlib.sha256(value.encode("utf-8")).hexdigest()
def instant(value):
    d = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(d.tzinfo is not None, "Evidence timestamps require a timezone")
    return d
def private_check(value):
    """Reject access secrets before any output. Errors never repeat the secret."""
    if isinstance(value, dict):
        for k, v in value.items():
            require(not re.search(r"(password|credential|lockbox|door_code|alarm_code|access_code|access_instructions)", k, re.I), "Access secrets belong only in the authorized source")
            private_check(v)
    elif isinstance(value, list):
        for x in value: private_check(x)
    elif isinstance(value, str):
        require(not re.search(r"\b(?:lockbox|alarm code|door code|access code)\b", value, re.I), "Keep access information in its authorized source")
        require(not re.search(r"(?:door|alarm|lockbox|access)\s*(?:code|pin|combination)?\s*[:=]\s*\S+", value, re.I), "Remove access instructions from inputs")
        require(not re.search(r"\b(?:bearer\s+[A-Za-z0-9._-]{15,}|password\s*[:=])", value, re.I), "Remove credentials from inputs")

def facts_for(prop, sources):
    """Current record beats historical record; equal-time contradictions stay unresolved."""
    result = {}
    for field in {x["field"] for x in prop["facts"]}:
        rows = [x for x in prop["facts"] if x["field"] == field and sources[x["source"]].get("record") in (None, prop["mls"])]
        if not rows:
            result[field] = {"value": None, "label": "unknown", "reason": "No current-record evidence"}
            continue
        owned = [x for x in rows if x["label"] in ("verified MLS", "public record")]
        rows = owned or rows
        newest = max(instant(x["as_of"]) for x in rows)
        latest = [x for x in rows if instant(x["as_of"]) == newest]
        if len({json.dumps(x["value"], sort_keys=True) for x in latest}) != 1:
            result[field] = {"value": None, "label": "unknown", "reason": "CONFLICT — resolve current sources"}
        else: result[field] = dict(latest[0])
    return result

def latest_showing(rows):
    if not rows: return None
    newest = max(instant(x["as_of"]) for x in rows)
    latest = [x for x in rows if instant(x["as_of"]) == newest]
    require(len({json.dumps(x, sort_keys=True) for x in latest}) == 1, "Conflicting showing state needs resolution")
    return latest[0]

def appointment_history(prop):
    """Booking slots and reported attendance are independent evidence, never fallback times."""
    return {"booking": latest_showing([x for x in prop["showings"] if x["status"] != "completed"]),
        "attendance": latest_showing([x for x in prop["showings"] if x["status"] == "completed"]),
        "history": sorted(prop["showings"], key=lambda x: instant(x["as_of"]))}

def showing_for(prop):
    return latest_showing(prop["showings"]) or {"status": "planned", "date": None, "start": None, "end": None, "source": None}

def validate_case(c):
    private_check(c)
    require(c["schema"] == "1.0" and c["mode"] in ("synthetic", "live"), "Unsupported case schema/mode")
    require(c["case_id"] and c["buyer"]["id"] and c["buyer"]["name"], "Exact buyer and case identity required")
    sources = {s["id"]: s for s in c["sources"]}
    require(len(sources) == len(c["sources"]) and sources, "Unique source identities required")
    for s in sources.values():
        instant(s["as_of"])
        require(s["title"] and s["locator"] and s["kind"], "Source locator and owner required")
        if c["mode"] == "synthetic": require(s.get("synthetic") is True, "Synthetic evidence must be labeled")
    require(c["buyer"]["identity_source"] in sources, "Buyer identity evidence required")
    require(c["buyer"]["identity_source"] == c["crm_snapshot"]["source"], "CRM snapshot must use the resolved relationship source")
    require(c["crm_snapshot"]["buyer_id"] == c["buyer"]["id"], "Wrong CRM target")
    require(c["search"]["buyer_id"] == c["buyer"]["id"], "Wrong saved-search target")
    require(1 <= len(c["properties"]) <= 5, "Use one to five properties")
    ids = [p["id"] for p in c["properties"]]
    require(len(ids) == len(set(ids)) and set(c["tour_order"]) == set(ids) and len(c["tour_order"]) == len(ids), "Tour order must contain each property exactly once")
    for p in c["properties"]:
        require(p["address"] and p["mls"], "Exact property identity required")
        for f in p["facts"]:
            require(f["source"] in sources and f["label"] in LABELS, "Fact provenance required")
            require(sources[f["source"]].get("property_id") == p["id"], "Cross-property fact source")
            if f["label"] == "verified MLS": require(sources[f["source"]]["kind"] == "Matrix", "Verified MLS label needs Matrix evidence")
            instant(f["as_of"])
        require(2 <= len(p["walk"]) <= 4 and 1 <= len(p["questions"]) <= 2, "Walk-in plan needs 2–4 observations and 1–2 natural questions")
        for concern in p["concerns"]:
            require(concern["label"] in LABELS and concern["source"] in sources, "Material concern needs a label and source")
        for event in p["showings"]:
            require(event["status"] in STATES, "Unsupported showing state")
            instant(event["as_of"])
            if event["date"]: date.fromisoformat(event["date"])
            for field in ("start", "end"):
                if event[field]: datetime.strptime(event[field], "%H:%M")
            if event["start"] and event["end"]: require(event["end"] > event["start"], "End must follow start")
            if event["status"] == "confirmed":
                require(all(event.get(x) for x in ("date", "start", "end", "source")), "Confirmation needs exact date, start, end and source")
                require(sources[event["source"]]["kind"] == "ShowingTime", "ShowingTime owns booking confirmation")
            if event["status"] == "completed":
                require(event.get("attendance_evidence") in sources, "Booking is not attendance")
                attended=sources[event["attendance_evidence"]]
                require(attended["kind"] in ("Blaise notes", "Communication") and p["id"] in attended.get("attended_properties",[]) and attended.get("quote"), "Attendance needs property-specific notes or communication evidence")
        showing_for(p); appointment_history(p)
    dc = c["document_check"]
    require(dc["status"] in ("verified", "unknown", "missing", "conflict"), "Invalid pre-tour document check")
    if dc["status"] == "verified":
        require(dc.get("requirements_source") in sources and dc.get("original_source") in sources, "Current requirements and original-source evidence required")
        require(dc.get("verification") in ("complete_original", "human_original_verified"), "Draft or summary cannot prove executed terms")
    return sources

def time_line(ev):
    if not ev["date"]: return "Date and time not confirmed"
    when = date.fromisoformat(ev["date"]).strftime("%a, %b %d, %Y")
    if not ev["start"] or not ev["end"]: return when + " · time not confirmed"
    def fmt(v): return datetime.strptime(v, "%H:%M").strftime("%I:%M %p").lstrip("0").replace(":00", "")
    return when + " · " + fmt(ev["start"]) + "–" + fmt(ev["end"]) + " CT"

def advisories(c, selected):
    rows = []
    for p in c["properties"]:
        ev = showing_for(p)
        if p["id"] in selected and ev["status"] == "confirmed":
            rows.append({"action": "ADD TO CALENDAR advisory", "synthetic_demonstration": c["mode"] == "synthetic",
                "title": "Showing — " + p["address"] + " — " + c["buyer"]["name"], "location": p["address"],
                "date": ev["date"], "start": ev["start"], "end": ev["end"], "timezone": "America/Chicago",
                "source": ev["source"], "missing": [], "created": False})
    return rows

def route_request(c, request):
    request = request.strip()
    if re.match(r"prepare me to show\b", request, re.I):
        def mentioned(value):return bool(re.search(r"(?<!\w)"+re.escape(value)+r"(?!\w)",request,re.I))
        require(mentioned(c["buyer"]["name"]), "Resolve the buyer before generation")
        selected = [p["id"] for p in c["properties"] if mentioned(p["address"]) or mentioned(p["mls"])]
        require(selected, "Resolve address or MLS before generation")
        return "prepare", selected
    if re.match(r"here[’']?s how (?:the showing|the tour) went\s*:", request, re.I):
        return "debrief", list(c["tour_order"])
    raise ValueError("Use the preparation or showing-debrief trigger")

def validate_debrief(c, notes, interpretation):
    private_check(notes); private_check(interpretation)
    d = interpretation
    require(d["buyer_id"] == c["buyer"]["id"] and d["case_id"] == c["case_id"], "Debrief identity mismatch")
    require(d["transcript_sha256"] == digest(notes), "Interpretation must match the actual supplied notes")
    props = {p["id"] for p in c["properties"]}
    evidence = {e["id"]: e for e in d["evidence"]}
    require(len(evidence) == len(d["evidence"]) and evidence, "Unique transcript evidence required")
    for e in evidence.values():
        require(e["quote"] and e["quote"] in notes, "Evidence quote not present in notes")
        require(e["basis"] in ("buyer-confirmed", "Blaise observation", "hypothesis"), "Label buyer feedback, observation or hypothesis")
        require(e["property_id"] in props or e["property_id"] is None, "Unknown feedback property")
    def support(item, prop=None, confirmed=False):
        require(item.get("evidence") and set(item["evidence"]) <= set(evidence), "Every debrief conclusion needs evidence")
        ev = [evidence[x] for x in item["evidence"]]
        if prop: require(all(x["property_id"] in (None, prop) for x in ev), "Cross-property debrief evidence")
        if confirmed: require(all(x["basis"] == "buyer-confirmed" for x in ev), "Buyer confirmation required")
        return ev
    seen = set()
    for feedback in d["feedback"]:
        pid = feedback["property_id"]
        require(pid in props and pid not in seen, "One debrief entry per property")
        seen.add(pid); require(feedback["interest"] in ("serious", "considering", "low", "unknown"), "Invalid interest")
        require(feedback.get("fit") and feedback.get("disposition"), "Property feedback needs its own fit and disposition")
        support(feedback, pid, feedback["interest"] == "serious")
        for claim in feedback["claims"]:
            ev = support(claim, pid)
            require(claim["label"] in ("buyer-confirmed", "Blaise observation", "hypothesis"), "Invalid claim label")
            require(all(x["basis"] == claim["label"] for x in ev), "Claim label must match its supporting evidence")
    require(seen, "Debrief needs actual property feedback")
    for change in d["criteria_changes"]:
        require(change["field"] in c["search"]["criteria"], "Unknown search field; resolve the exact saved-alert control")
        require(change["treatment"] in ("filter", "ranking", "question"), "Invalid criteria treatment")
        support(change, confirmed=change["treatment"] == "filter")
        require(change["reason"], "Explain each proposed change")
    recommendation = d["recommendation"]
    require(recommendation["action"] in ACTIONS and recommendation["text"], "Exactly one useful next recommendation required")
    def scoped_support(item, confirmed=False):
        require(item.get("scope") in ("property", "tour"), "Explicit property or whole-tour scope required")
        if item["scope"] == "property":
            require(item.get("property_id") in props, "Wrong scoped property")
            support(item, item["property_id"], confirmed)
        else:
            require(item.get("property_id") is None, "Whole-tour scope cannot imply one property")
            support(item, confirmed=confirmed)
    scoped_support(recommendation)
    for commitment in d["commitments"]:
        scoped_support(commitment, confirmed=True)
        require(commitment["owner"] and commitment["text"], "Commitment needs owner and action")
        if commitment.get("due"): date.fromisoformat(commitment["due"])
    if d.get("followup"):
        require(d["followup"]["channel"] in ("sms", "email"), "Use the currently permitted channel")
        support(d["followup"])
    return evidence

def debrief(c, notes, d):
    evidence = validate_debrief(c, notes, d)
    source_index = {s["id"]: s for s in c["sources"]}
    changes = [dict(x, before=c["search"]["criteria"][x["field"]], status="PROPOSED — NOT APPLIED") for x in d["criteria_changes"]]
    recap = {"buyer_id": c["buyer"]["id"], "case_id": c["case_id"], "feedback": d["feedback"], "recommendation": d["recommendation"], "commitments": d["commitments"]}
    note_hash = digest(json.dumps(recap, sort_keys=True))
    duplicate = note_hash in c["crm_snapshot"]["note_hashes"]
    tasks = []
    for item in d["commitments"]:
        if item.get("due") and item.get("task_useful"):
            key = digest(json.dumps(item, sort_keys=True))
            if key not in c["crm_snapshot"]["task_hashes"]:
                tasks.append(dict(item, fingerprint=key, status="PROPOSED — NOT CREATED"))
    followup = d.get("followup")
    if followup:
        channel = followup["channel"]
        allowed = channel in c["buyer"]["allowed_channels"] and channel not in c["buyer"]["opted_out"]
        followup = dict(followup, status="DRAFT — NOT SENT" if allowed else "SUPPRESSED — channel restricted", text=followup["text"] if allowed else None)
    handoffs = []
    for f in d["feedback"]:
        if f["interest"] == "serious":
            p = next(x for x in c["properties"] if x["id"] == f["property_id"])
            handoffs.append({"property_id": p["id"], "address": p["address"], "workflow": c["links"]["offer_strategy"],
                "status": "PROPOSED — start existing Property & Offer Strategy before offer-price advice",
                "current_facts": facts_for(p, source_index), "gaps": p["gaps"], "financing": c["buyer"]["financing"]})
    return {"status": "PRIVATE PROPOSALS — no external actions", "feedback": d["feedback"], "evidence": list(evidence.values()),
        "criteria_changes": changes, "recommendation": d["recommendation"], "commitments": d["commitments"],
        "fub": {"buyer_id": c["buyer"]["id"], "note": None if duplicate else recap, "note_fingerprint": note_hash,
            "status": "DUPLICATE SUPPRESSED" if duplicate else "PROPOSED — NOT SAVED", "tasks": tasks,
            "readback_required": True, "snapshot_source": c["crm_snapshot"]["source"]},
        "ylopo": {"buyer_id": c["buyer"]["id"], "search_id": c["search"]["id"], "changes": changes,
            "existing_alert_status": c["search"]["alert_status"], "existing_alert_frequency": c["search"]["frequency"],
            "status": "PROPOSED — NOT APPLIED", "client_link": c["search"].get("client_link"), "buyer_link_opened": False,
            "handoff": ["Open the exact relationship in Stars using the vendor-permitted/manual route.",
                "Open saved alert " + c["search"]["id"] + "; preserve other useful criteria and alert settings.",
                "Apply only accepted filter changes. Ranking preferences and questions are not filters.",
                "Check relevant results in the agent view, then save and independently read back the exact alert.",
                "Copy that saved alert’s client-specific link if needed. Do not open it or assume FUB refreshed."]},
        "offer_handoffs": handoffs, "followup": followup,
        "automation_overlap": c["buyer"]["automation_overlap"],
        "external_effects": {"crm_writes": 0, "ylopo_writes": 0, "calendar_writes": 0, "sends": 0, "bookings": 0}}

def process(c, request, output, notes=None, interpretation=None):
    sources = validate_case(c)
    mode, selected = route_request(c, request)
    result = None
    if mode == "debrief":
        supplied = request.split(":", 1)[1].strip()
        require(notes is not None and supplied == notes.strip(), "Debrief trigger must contain the supplied notes")
        require(interpretation is not None, "Codex must interpret the actual notes using CODEX-WORKFLOW.md")
        result = debrief(c, notes, interpretation)
    from documents import generate
    return generate(c, sources, selected, output, result)

def main():
    p = argparse.ArgumentParser(description="Codex-operated Showing & Tour Experience")
    p.add_argument("--case", required=True); p.add_argument("--request", required=True); p.add_argument("--out", required=True)
    p.add_argument("--notes"); p.add_argument("--interpretation")
    a = p.parse_args()
    result = process(read(a.case), Path(a.request).read_text(encoding="utf-8"),
        a.out, Path(a.notes).read_text(encoding="utf-8") if a.notes else None, read(a.interpretation) if a.interpretation else None)
    print(json.dumps(result, indent=2))
if __name__ == "__main__": main()
