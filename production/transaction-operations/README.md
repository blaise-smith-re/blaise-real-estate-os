# Transaction Operations v1 — accepted-contract preparation

**IMPLEMENTED FOR REVIEW.** Dedicated review branch; not a governing SOP or deployed service. Work starts in the client's transaction Workbench under **Blaise RE — Sellers & Transactions**. Blaise can say: “Get this transaction organized from the executed agreement.” Work keeps the relationship and transaction context; Codex reads the original evidence and produces the private brief when needed. Direct Codex use remains available. Blaise does not need to manage technical input files.

For a later change: “Reconcile this amendment and the latest transaction updates; show what changed and what needs me.” Retain the original source package, every intervening executed change and the previous generated result. Newer unsigned proposals never replace executed terms.

## What this produces

- Private Transaction Start/Update Brief: content-driven Letter pages and a genuinely single-column phone HTML/PDF. Recommendation first; obligations, contractual responsibility, follow-through owners with human roles, source labels, changes and missing evidence follow.
- Separate client, actual assigned TC, lender and title drafts, each unsent and with routing status. Client next steps require a supported action for that exact buyer/seller; remaining useful dates are milestones for awareness. Specialists receive only relevant lane items. The brief and source/provenance files are not client attachments.
- Minimal field/note and existing-folder filing **proposals**, using existing `lead-conversion-crm` routing. No compulsory task, deal, note, new folder or duplicate TC work.
- Per-run evidence output with exact source version, locator, page, section, quotation and SHA-256 where bytes are available. This is generated provenance, not another maintained contract abstract or transaction database.

This is an **agent-operated production tool**, not an automatic contract interpreter or signature verifier. The responsible agent reads the full originals, inspects completion and makes the evidence-bound interpretation. The code validates citations, arithmetic, chronology, targets and output boundaries. Extracted text and matching bytes alone do not prove signatures or legal effectiveness. Follow [CODEX-WORKFLOW.md](CODEX-WORKFLOW.md).

## Run on another computer

Use Python 3.11+ (with IANA timezone data), Node 20+, Playwright and Chromium. The source ZIP includes the unchanged approved renderer, CSS, fonts, wordmark and licenses. In a repository checkout those shared assets are resolved from the existing production directories. No account credential or business-system access is required for the fictional demonstration.

```text
python -m venv .venv
# Activate the environment with the command appropriate to your shell.
python -m pip install -r requirements.txt
npm install --no-save playwright@1.62.1
npx playwright install chromium
python -m unittest discover -s tests -v
python demo.py --out ../transaction-review
python verify.py ../transaction-review
```

Run these commands from the extracted source directory, or `production/transaction-operations` in a checkout. Use a fresh output directory **outside** the repository/source; prior runs are never overwritten. If using an existing Chrome installation, set `CHROME_PATH` to its executable. If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to that module directory. `--node` accepts an installed Node executable. On Windows, `tzdata` supplies the timezone database.

Public footers use the current **Buy Sell Home Team · RE/MAX Results** affiliation. Formal brokerage fields use **Collopy Real Estate, Inc. d/b/a RE/MAX Results**. Both are resolved and attributed in task-local inputs under the current Manual and explicit owner identity decision; neither silently substitutes for the other. Executed-source identities remain separately verified.

For an actual case, Codex creates task-local `case.json` and `analysis.json` after reading the originals and binding the exact request. The fictional interpreter in `fixture_pack.py` is only for the demonstration text layout; it is never the live interpretation route.

```text
python engine.py --case ../private-run/case.json --analysis ../private-run/analysis.json --sources ../private-run/originals --request ../private-run/request.txt --out ../private-run/output
node render.cjs ../private-run/output
# On an update add: --previous ../previous-run/output/private-provenance.json
```

Inspect every actual PDF page and the phone view, alongside renderer checks. Read the recipient drafts separately. `verify.py` is a **fictional demonstration check**, not a certification of live facts. Use current source, targeting and proportionate readback rules for ordinary work; no new certification gate is added.

## Synthetic demonstration

`demo.py` creates clearly marked fictional PDFs, reads their pages and quotations, then invokes the same production code. Five scenarios: buyer start, executed amendment with later unsigned draft and receipt evidence, seller start with unconfirmed TC, incomplete execution/package coverage, and explicit original-source human verification. It also creates the editable task-local inputs for inspection. Names, property, providers, dates and amounts are fictional; no fixture becomes a default.

The handwritten fixture completion statements are **not signatures and have no legal effect**. All sample Calendar entries read **SYNTHETIC — DO NOT ADD TO CALENDAR**. No writer, send, booking, Calendar, payment, scheduler or monitoring component is called. Live end-to-end use is not demonstrated by this review.

## Source and review records

- [Governing pointers](governance.json): current Runbook and related source IDs; proposed companion only.
- [Operator implementation](CODEX-WORKFLOW.md): intake, evidence, processing and readback.
- [Proposed governing wording](WORK-REVIEW-PATCH.md): preserve stable IDs and existing instructions; do not apply until owner review.
- [Review handoff](RESUME.md): actual source/status belongs in the accompanying delivery record, not a fabricated release claim.

`bundle.py` creates a portable ZIP and per-file hashes. The bundle carries its actual Git revision when run from a clean committed checkout. No live input, rendered case, secret, cached Drive body or `.git` directory is included.
