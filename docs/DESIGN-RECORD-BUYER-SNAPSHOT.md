# Design record — Buyer Property Snapshot

**Date:** 2026-09-01 · **Decision owner for adoption:** Blaise + ChatGPT / 04 (see CGQ-013)
**Rendered master:** https://claude.ai/code/artifact/092863e8-d403-49ce-88fb-d9ac7576721b

---

## Sources studied

| Asset | fileId | What it contributed |
|---|---|---|
| SOP 02 v1.12 | `1xxYjWwspET-gR5gYYtOb6uHh7eYXiM0r0YxRubjlB28` | §15 production standard, §18 research packet, §20 QC gate |
| CLIENT-FACING MASTER PDF (10 pages) | `1RdATxPLoQJx7B3eWRy_v_-FJZs-IbU2G` | stat band, comparison page, decision page, advisor close |
| Master Template (Doc) | `18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU` | canonical field list, naming, "never overwrite" rule |
| Notes & Rating Sheet master | `1WGBDQMXBhI4pVO8DvezIthQEoOPaNmEs9ZEBHsPxkhM` | print-first scorecard, write-space leading |
| Hughes guide (condo) | `1fMR0z70YrzwrdqzN1B-p4j21FyPxr88WrgkN80fQFQ8` | best prior personalization; the HOA-includes-utilities insight |
| Dallas guide (thin data) | `1C6WauSCdAbGmPTkD4hAkNQ-3vFM7G-b050UfmgWFTWE` | the hard case: ShowingTime-only, no MLS verification |
| Petersen land snapshot | `1x6e-14-yshueiblaGuzI4dfGEhEZLGcP` | land field set, weak-comp honesty, parcel exhibit disclaimer |
| Stillwater working example | `1W6fjGdr6PTmcgralJjFai1Xj0oGD0wC0Wg1t2_VnUxQ` | multi-property comparison, shared comp pool |
| Canva brand rules | `1esSVR8kCVQKvGdmr6KFUSpOJGkErOTwEQMPIkDxDz4A` | navy/white/thin-red, clear space, footer attribution |

---

## Three directions explored

**A — Premium editorial.** Hero image dominant, magazine typography, restrained data.
Strong premium feel. **Rejected as the spine:** depends on photography that is frequently
unavailable or not permitted for client redistribution, and it is the weakest of the three to write
on during a showing. Its typographic restraint and the full-bleed address opening were kept.

**B — Modern advisor.** Decision-oriented, buyer-fit as the organizing spine, cards over prose.
Strongest on the actual job — helping the buyer decide — and the only direction that naturally
accommodates §18's classification requirement. **Chosen as the spine.**

**C — Tour field guide.** Scorecard-forward, print-first, maximum usability.
Best in the field, but reads as a worksheet rather than something a premium advisor produced.
Its write-space discipline and greyscale-safe encoding were kept.

**Decision: B as the architecture, A's opening and typographic restraint, C's write-space rules.**

Evaluated against premium feel, buyer usefulness, print usability, mobile readability, repeatability,
generation speed, property-type flexibility, and brand fit. B won on six of eight; C won print
usability; A won premium feel alone.

---

## The one distinctive move

**The source rail.** Every fact block carries a mark in a narrow left column — verified MLS, public
record, listing-reported, calculated, requires verification, Blaise's observation, buyer's priority.

This came out of the subject's own world rather than a visual reference. SOP 02 §18 spends more
words on fact classification than on any other topic, and every prior client guide handled it as
prose that does not survive an edit. Making it a structural column means a fact cannot be written
without choosing its provenance — source blending becomes impossible rather than discouraged.

It also does something for the buyer that no amount of polish would: it shows, at a glance, exactly
how much of what they are reading is confirmed. That is the difference between a packet that looks
prepared and one that is.

---

## What was deliberately not carried forward

- **The 10-page default.** SOP 02 §15 targets 3–5 pages for one or two properties. Pages 3
  ("Client voice first") and 10 ("Your advocate" + notes) are agent philosophy; the useful content
  of both compresses into the cover callout and the advisor card.
- **"Buyer representation and agency documents are reviewed using brokerage-approved forms before
  private touring"** (PDF master p.10). This contradicts SOP 02 v1.11's Tour-First boundary and is
  raised as **IF-2026-09-01-019 / CGQ-014**, not silently reworded.
- **A new asset name.** SOP 02 §19 fixes the master's name. Renaming would require an SOP change for
  no operational gain, so Snapshot Mode lives inside the existing asset. Recommended name:
  **Buyer Property Tour & Value Guide — Master Template (v2.0, Snapshot Mode)**.
