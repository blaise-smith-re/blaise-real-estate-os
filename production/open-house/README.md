# Open House Experience production system
Repository source of truth for production templates and generator. The business Playbook sits under Growth & Brand; this is not a new SOP. Lever Street is a separate regression/reference implementation, never a case default.

## Quick trigger for Blaise / Work
**Prepare my open house for [ADDRESS], MLS [MLS]. Listing agent: [NAME]. Proposed date/time: [YYYY-MM-DD, START–END America/Chicago]. Use production/open-house.**

Codex follows CODEX-WORKFLOW.md, researches through authenticated browser tools, fills the evidence case, chooses media/portraits, builds, checks and returns the prep package. Blaise does not operate the JSON or rendering tools.

## Operator commands
Use the bundled Python/Node returned by Codex's dependency loader; Python needs Pillow, pypdf, pypdfium2. Node uses Playwright and Chrome. Override PLAYWRIGHT_MODULE and CHROME_PATH when paths differ.

```powershell
& $Python production/open-house/engine.py init --address 'PROPERTY ADDRESS' --mls 'MLS' --agent 'AGENT NAME' --date '2026-09-13' --start '13:00' --end '15:00' --case 'C:/Private/OpenHouses/CASE'
# Codex completes authenticated research and case inputs; Blaise does not retype MLS facts.
& $Python production/open-house/engine.py build --input 'C:/Private/OpenHouses/CASE/case.json' --out 'C:/Private/OpenHouses/CASE/run-01' --node $Node
```

Every build uses a fresh output directory. `init` creates a valid blank intake and explicit research state; it does not fabricate a completed event package from four fields. Continue with the agent workflow automatically within the task. The build performs validation, image selection/crops, portrait rotation, two print PDFs, eight individual social assets, digital Host Brief and seven operational documents, provenance/release state and filing manifest. No board by default. No live connector mutation is implemented.

## Output separation
- `output/print`: exactly handout + sign-in PDFs/HTML; only these are custom print pieces.
- `output/social`: eight individual digital assets; their PNG exports are in previews. Still-image Reel cover plus separate shot plan, not a rendered video.
- `output/internal`: phone Host Brief, route, day-of sequence, shot plan, attendee/recap/filing templates.
- `internal`: evidence, normalized production inputs, selection/usage and release state. Never send this directory as consumer collateral.
- `source-media`: untouched downloaded originals; derivatives live separately in assets.
- `output/masters`: generic sign-in master, not event print stack.

`CASE-SCHEMA.md` explains field ownership. `governance.json` caches stable pointers; verify current sources each invocation. Tests exercise conditional HOA, current-only receipts, leakage, price/identity, media hashes, unique portraits and five-sign route shape. The preserved Pilot 01 source pack supplies historical regression facts, not fresh release evidence.

## Limits / decisions
Authenticated browser research, semantic media classification, live map verification and business copy remain Codex-assisted. They are not an unattended Python scraper or browser connector. Missing authentication/source access may need Blaise. Blaise owns hosting/media authorization, on-site sign/access judgment, exact public release, meaningful post-event facts and communications. No publish/send/schedule/MLS/FUB/Calendar/spend action occurs here.

## Durable promotion
Prepare Playbook, master source bundle, production-pointer README and separately labeled Pilot 01 QA/reference record for Work's canonical Drive filing. Do not alter Growth or the Source Map as part of this build. Repository source changes are uncommitted until reviewed; no GitHub push is implied.

## QA and packaging commands
```powershell
& $Python -m unittest discover -s production/open-house/tests -v
& $Python production/open-house/tests/regression.py CASE/case.json RUN PRESERVED_PILOT
& $Node production/open-house/tests/mobile-qa.cjs RUN
& $Python production/open-house/prepare_promotion.py --qa-run RUN --pilot PRESERVED_PILOT --case CASE/case.json --out NEW_PROMOTION_FOLDER
```
The package builder verifies archives and writes a SHA-256 manifest. It performs no Drive upload. Regression artifacts and real cases stay outside the repository.
