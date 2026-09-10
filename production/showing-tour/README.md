# Showing & Tour Experience v1

Private, Codex-operated preparation and debrief, ready for owner review. This is a production companion to the existing Buyer Showing Padfolio Prep Brief, not a replacement business SOP, CMA, app or CRM. Existing Roadmaps and Property & Offer Strategy remain unchanged.

## Blaise's two requests

Start in the buyer's Workbench under **Blaise RE — Buyers**. Work uses the buyer context and involves Codex for production when needed; Blaise does not manage technical files. Direct Codex use remains available with the exact buyer and property context.

**Before:** “Prepare me to show [address/MLS] to [buyer].” List each address for a small tour. Codex resolves the exact relationship, current facts and showing state, then produces one Letter page per property and the same content reflowed for a phone. Unknown financing or intake fields stay unknown; no default hours or assumed bookings. Review the private brief on your phone or print it. Use the current document check before touring. The evergreen Buyer Roadmap is offered when useful at the first showing, not as homework.

**After:** “Here's how the showing went: [notes or dictated transcript].” Say what the buyer actually said, what you noticed, any ranking or serious interest, and anything you agreed to do. No new questionnaire or recorder is needed. Codex returns the updated brief, one recommendation, a personal draft and useful field-level search/CRM proposals. Review them before any separate live execution. Serious interest leads to the existing Property & Offer Strategy before offer-price advice.

## What works and where judgment stays

The two requests are agent-operated. Codex interprets the actual request and notes and prepares normalized inputs; Blaise does not fill JSON. The local command validates identity, provenance, exact transcript quotations and evidence labels, then generates files. It is not an NLP service: transcript hashing/quote checks prove attribution and consistency, not the semantic truth of an interpretation. Codex must review the wording against the full notes.

FUB, Matrix, ShowingTime, Click and Ylopo remain their own sources. There is no network/API writer, scraper, scheduler or new CRM here. Current FUB availability must be checked at live execution; the build did not have callable FUB tools and certifies no live connector operation. Ylopo uses the vendor-permitted/manual route, exact saved-alert targeting, agent-side QA, save/readback and copy-only client-link handling. A synthetic pass is not a live pilot.

## Generate on another computer

Requires Python 3.11+ with Pillow and pypdf, Node.js 20+ with Playwright, and an installed Chrome/Chromium browser. For visual PDF inspection install pypdfium2. Use already supplied runtimes where available; the code installs nothing. Fonts and wordmark are reused from ../open-house/templates/assets in this repository; the portable bundle includes an assets directory with those exact files and licenses.

Set PLAYWRIGHT_MODULE to the installed Playwright module if Node cannot resolve it. Set CHROME_PATH to the local Chrome executable if not using Playwright's installed browser. No computer-specific paths are committed.

From this directory:

    python -m unittest discover -s tests -v
    python demo.py --out /absolute/private/showing-demo --node /path/to/node

Use a fresh output directory outside the repository. The demo uses both complete requests and a clearly fictional two-home case. Its dated showings and attendance are synthetic, not real commitments. To generate a real preparation after Codex resolves the inputs:

    python engine.py --case /private/case.json --request /private/request.txt --out /private/run-01
    node render.cjs /private/run-01

For debrief, also pass --notes /private/notes.txt --interpretation /private/interpretation.json. The request's text after the colon must contain those exact notes. Use the SHA-256 of the notes' UTF-8 text in the interpretation. Keep every output and real input outside source control.

## Output and review

Each run contains combined print PDF/HTML, one print page and phone HTML/PDF per property, START-HERE-Private with tour order and existing guide links, plus restricted private-working.json with sources and Calendar advisories. The demo combines the phone PDFs too. After-tour output adds Private-Debrief, debrief-proposals.json and Personal-Followup-DRAFT.txt. All are private; only the reviewed text draft is a potential buyer communication. Never forward the private pack to a buyer or listing agent.

The master has exactly five sections. Routine summaries may be concise; material concerns must remain. Print body text is 15px (11.25pt), phone body text 18px. The renderer fails on overflow; do not solve failure by hiding/clipping concerns or shrinking the phone page. Shorten repetitive routine content, preserve evidence privately and render again. Review every final PDF page and phone screenshot, not just the JSON checks.

render.cjs blocks network resources and never follows document links. Verify canonical guide/master IDs through current metadata. Check relative links locally and copy saved-alert client links without opening them. Generated PDFs are review artifacts, not proof of source permissions or legal compliance.

## Evidence contracts

- Every property fact has field, value, label, source and timezone-aware as_of. Its source binds the property and current MLS record. Current-record evidence wins over an old listing, even if the historical export was retrieved later. Equal-time contradictions remain unknown/CONFLICT.
- Showing states are planned, requested, confirmed, cancelled or completed. Confirmation requires date, both times and ShowingTime evidence. Completion requires separate attendance evidence. Nulls never become example hours. Calendar coverage is independent.
- Preserve scheduled/requested slots separately from reported attendance and actual attendance times. The reading views show both; completion does not confirm a requested slot or copy its hours into actual attendance.
- Each property's response, fit and disposition stays bound to that property. Recommendations and commitments require explicit property or whole-tour scope. A recommendation for one property never becomes another property's next action.
- Human reading views use plain-English field labels and distinguish confirmed preferences from proposed updates. Exact field names remain in technical proposals; this generator applies no search changes. Repeated MLS badges are consolidated while unknown, reported and conflicting facts remain labeled.
- Identity and CRM/search snapshots bind the same exact buyer. No broad relationship sweep. Source links belong in private-working.json.
- Notes interpretations bind case, buyer, full transcript hash, exact quoted evidence and property. Claims distinguish buyer-confirmed, Blaise observation and hypothesis. The short buyer-response summary must preserve every material buyer-confirmed conclusion; the full claim/evidence record stays in the private debrief.
- Only explicit buyer-confirmed changes may become proposed filters. Provisional ideas remain ranking guidance or questions. Preserve other saved-alert criteria, frequency and status.
- FUB proposals carry deterministic fingerprints for comparison against a fresh bounded CRM read. They are not a persistent local activity ledger. No compulsory task: a useful task needs an actual commitment, owner and real agreed date. Accepted writes use lead-conversion-crm, duplicate check and independent readback.
- Required pre-tour documents depend on current law, MLS, brokerage and executed terms. A verified gate needs current requirements and complete original or explicit original-source human verification. Unknown does not block drafting useful prep; it remains unresolved before the real tour.
- Access credentials and instructions are rejected. Retrieve them only in the authorized source at the appropriate moment.

See CODEX-WORKFLOW.md for execution, governance.json for stable pointers, WORK-REVIEW-PATCH.md for the proposed minimal governing edits, and RESUME.md for technical continuation.
