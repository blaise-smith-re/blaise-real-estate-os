---
name: buyer-property-snapshot
description: Build the client-facing Buyer Property Snapshot / Tour & Value Guide for a named buyer and one or more properties. Use when Blaise says "build the showing snapshot for <address> for <buyer>", prepares a tour packet, or needs a printable property handout before a showing. Enforces the source-mark discipline, the conditional property modes, and the SOP 02 visual QC gate. Produces a deliverable; makes zero writes to any business system.
---

# Buyer Property Snapshot

The client-facing showing packet. One content model, four property modes, two tour formats.

**Controlling source:** `SOP 02 - Buyer Property Search, Showing & Value Analysis`, resolved by
fileId from `governance/source-registry.json` (`sop_02_buyer_search_showing_value`). Retrieve it and read
its version line before building. §15 Step 12 owns client-facing production quality; §18 owns the
Matrix research operator, the ACTUAL PHOTO HANDOFF requirement and the Workbench handoff standard;
§20 owns the QC gate. **Current pin: v1.13 (September 1, 2026).**

**Canonical asset:** `Buyer Property Tour & Value Guide - Master Template`
(`18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU`). **Never overwrite it.** SOP 02 §15 permits — and
requires — improving the *client-specific copy*. Reusable improvements are surfaced for master
adoption, never applied silently.

**Data model:** `assets/buyer-property-snapshot/snapshot-schema.json`.
**Design system + rendered master:** `assets/buyer-property-snapshot/SNAPSHOT-SPEC.md`.

---

## 1. Invocation contract

Blaise says one of:

```
Build the showing snapshot for 123 Main St for Dallas.
Build the tour packet for Myranetta - Thursday, 3 homes.
```

**Required inputs — exactly three.** Everything else is retrieved.

| Input | Required | Resolved from |
|---|---|---|
| Buyer | yes | FUB — exact-target resolution with corroboration |
| Property or properties | yes | address or MLS number as spoken |
| Showing date/time | yes, or "not yet scheduled" | Google Calendar, else stated |

**Never ask Blaise for a field that exists in a system.** Pull, in this order:

1. **`connector-preflight`** — FUB, Calendar, Drive. A missing required lane is a HOLD for that
   lane only, and the packet says which section could not be built. Never substitute a remembered
   value for one that could not be retrieved.
2. **`chicago-date-anchor`** — the showing date and every deadline are America/Chicago.
3. **`retrieve-canonical-source`** — SOP 02 by fileId. Record its live version.
4. **FUB** — buyer priorities, stated financing, lender contact, prior showing feedback, stage.
   `find_contact` excludes Trash-stage records (IF-010): corroborate before accepting a match.
5. **Calendar** — the confirmed showing window and meeting location.
6. **MLS — not reachable from this repository.** Issue the research request in §3 and wait for the
   returned packet. Do not proceed to a value section without it.

---

## 2. Build order

1. Resolve buyer and confirm exact target.
2. Retrieve SOP 02, record version.
3. Assemble `buyer.priorities[]` from FUB. **An empty array stays empty** — the fit rows render as
   "Tell me today". Never infer a priority from behavior, listing history, or a prior client.
4. Issue the Matrix research request (§3). Ingest the returned packet.
5. Ingest the `IMAGE HANDOFF` block (§3A). Actual image assets are the normal expectation; photo
   numbers alone are a fallback and are never recorded as COMPLETE.
6. Populate the schema. Every fact-bearing field takes a value **and** a mark. A value without a
   mark is a build error, not a formatting choice.
7. Select the mode: `RESIDENTIAL`, `CONDO_TOWNHOME`, `LAND`, `INVESTMENT`; `SINGLE` or `TOUR`.
8. Drop every section whose data is absent. See the conditional table in `SNAPSHOT-SPEC.md`.
9. Write `standouts[]` — 3 to 5, each grounded in a marked fact already on the page. No adjectives
   that are not doing work.
10. Score `fit[]` against stated priorities only.
11. Write `watch_verify[]`. Phrase every unknown as an unknown. **An unverified condition item is
    never presented as a defect.**
12. Market section: comps or the pending line. Never both, never neither.
13. Render, QC (§5), deliver.

---

## 3. MLS research handoff

Claude Code has no browser lane. Northstar/Matrix is reachable only through the Chrome operator.

Use the `chrome-operator-handoff` skill and the request format in
`docs/MATRIX-PROPERTY-RESEARCH-HANDOFF.md`, which implements the operator prompt published in
**SOP 02 §18**. Do not compose a different prompt — §18 is canonical and the returned packet's
section order is the contract this skill ingests.

**Ingestion rules:**

- Preserve every classification from the packet. `VERIFIED MLS FACT` stays `MLS`; a listing remark
  stays `REP` and never becomes `MLS`. "Listing remarks state the roof was replaced in 2024" is not
  "roof replaced in 2024".
- `AGENT-ONLY - DO NOT CLIENT-PUBLISH` items load into `agent_only[]` and are **hard-blocked from
  every client render**. The renderer fails closed.
- `COMP SET WEAK - FULL CMA RECOMMENDED` sets `comp_set_weak: true` and prints that conclusion.
- `READY FOR BUYER PROPERTY SNAPSHOT: PARTIAL | NO` means the packet says what is missing. It does
  not mean fill the gap.
- Access instructions never carry a lockbox code or credential into a client-facing document.

---

## 3A. Images — SOP 02 v1.13

Actual usable listing imagery is the **normal required handoff**, not an extra. The operator selects
the images itself and transfers the files; routine photo selection is not pushed back to Blaise.

- `IMAGE HANDOFF STATUS: COMPLETE` requires actual transferred files. **Photo numbers, filenames or
  descriptions alone are `PARTIAL` or `BLOCKED`** — recording them as COMPLETE is a reporting
  failure. A photo number cannot render.
- `BLOCKED` → the packet must carry the exact manual retrieval step. Use it; do not improvise one.
- **Manual supply is a first-class path.** Blaise hands over the hero and supporting images
  directly; they ingest as `mark: MANUAL` and render identically. The build never stalls on images.
- `CLIENT-PUBLISHABLE: NO` → the image is held internally and never rendered.
- No image asset present → the hero frame is **omitted** and the address block expands. Never an
  empty frame, a grey box, or a placeholder in a client PDF.
- The rendered snapshot also carries a screen-only photo control so Blaise can drop images in at
  print time. Files stay in his browser.

---

## 4. Conditional modes

| Condition | Effect |
|---|---|
| `property_type = LAND` | `facts_residential` omitted entirely. `facts_land` renders. No bed/bath/sqft row of N/A. |
| `association.fee` null | Association module omitted. No empty HOA box. |
| `buy_box_on_file` false | Investment module omitted. Investor metrics are never inferred. |
| `comps[]` empty | Market section collapses to `Value analysis pending verified MLS/comparable review.` |
| `mode = SINGLE` | No tour cover, no route, no comparison page. |
| No permitted photography | Hero frame omitted; the address block expands. Never an empty image frame. |
| `priorities[]` empty | Fit rows render `Tell me today`. Never invented priorities. |
| Any `CALC` metric | Its `assumptions[]` print on the same page, or the metric does not render. |

---

## 5. QC gate — SOP 02 §20

Render to PDF and inspect **every page** before this is complete.

- [ ] Single property or two: **3 to 5 pages**. A tour of 3–6 homes stays inside 12.
- [ ] No page is primarily uninterrupted body text. No paragraph over ~75 words. Never more than
      two narrative paragraphs consecutively without a visual break.
- [ ] Only the strongest 3–5 comps appear. Exhaustive comp detail stays in the internal file.
- [ ] Every fact carries a mark. The legend appears once.
- [ ] No `AGENT_ONLY` content anywhere in the client render.
- [ ] No empty section, no orphan heading, no split table, no clipped text, no tiny type.
- [ ] Enough white space to actually write on the printed scorecard.
- [ ] A reconstructed MLS summary is labeled "Not Native Matrix Export" — never presented as a
      native 360 Property View.
- [ ] Image handoff status recorded truthfully. Photo numbers alone were not called COMPLETE.
- [ ] Every rendered image is an actual asset and is permitted for client use.
- [ ] **Completion test:** Blaise would hand this exact PDF to a serious buyer in person.

Fail any box → reformat and re-render. A packet that reads as a Google Doc is not complete.

---

## 6. Filing and honest reporting

- File name: `[Buyer Last Name] - Property Tour & Value Guide - [YYYY-MM-DD]` (SOP 02 §19).
- Store the client PDF and the internal research file in the buyer's Drive location.
- FUB update is a **write** — it routes to `lead-conversion-crm` under `fub-controlled-write`.
  This skill never writes to FUB.
- Close with `operator-execution-report`. `WRITES ATTEMPTED: NONE`.
- Never report a packet as delivered, filed, or printed unless that actually happened and was
  verified.
