# Technical resume

Owner scope: Showing & Tour Experience v1 review build. Open-house source and all Lever deliverables remain unchanged.

Entry points: engine.py for Codex-normalized preparation/debrief; demo.py for the two synthetic plain-language triggers; render.cjs for print/phone PDFs and measured QA. documents.py preserves the Padfolio's five sections. README.md is the human/operator guide; CODEX-WORKFLOW.md is the thin execution wrapper. governance.json holds pointers only.

Use the actual Git checkout, verify remote/branch/status, and inspect PR/Drive state before resuming. Intended remote is blaise-smith-re/blaise-real-estate-os; build branch codex/showing-tour-experience-v1. Check the delivery record in the separately filed review folder for the actual source revision and file IDs. Do not recreate the Drive folder or assume this branch merged.

Tests: python -m unittest discover -s production/showing-tour/tests -v, plus existing production/open-house tests. Run the synthetic demo in a fresh output directory outside the repository. If a Windows sandbox prevents Python temp-folder access or headless browser startup, request the bounded execution capability; do not change production logic to mask that environment error.

Visual QA: every before/after print page, phone brief, tour-order view and debrief view; confirm one Letter page per property, real mobile reflow, readable text, all material concerns, local links, and private separation. render-qa.json is measured evidence, not a substitute for looking. Do not keep redesigning after acceptance passes.

Remaining review boundary: Blaise reviews this new workflow/design; Work reviews WORK-REVIEW-PATCH.md. No existing canonical master is modified during this proposal build. A later exact live buyer/showing pilot is separate; no missing live pilot blocks this reusable synthetic review delivery.
