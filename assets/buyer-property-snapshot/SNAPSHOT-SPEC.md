# Buyer Property Snapshot — content architecture, design system, rendering

**Status:** proposed for canonical adoption as **Buyer Property Tour & Value Guide v2.0**.
**Canonical target:** `18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU` — do not overwrite; see CGQ-013.
**Rendered master:** https://claude.ai/code/artifact/092863e8-d403-49ce-88fb-d9ac7576721b
**Controlling SOP:** SOP 02 v1.12 §15 (production quality), §18 (research handoff), §19 (naming),
§20 (QC gate).

---

## 1. Why this is a revision, not a new asset

An approved master already exists. Three do, in fact:

| Asset | fileId | Role |
|---|---|---|
| Buyer Property Tour & Value Guide – Master Template | `18OIKz5AqJrRYG0g54vhqRFNbzPV-y_oJhpT1zj_ANQU` | Google Doc content master, named in SOP 02 §19 |
| CLIENT-FACING MASTER – Buyer Property Tour & Value Guide.pdf | `1RdATxPLoQJx7B3eWRy_v_-FJZs-IbU2G` | 10-page designed PDF master |
| Buyer Property Tour Notes & Rating Sheet – Master Template | `1WGBDQMXBhI4pVO8DvezIthQEoOPaNmEs9ZEBHsPxkhM` | Print-only scorecard |

Only the first is named in the SOP. The other two are stronger in their own dimension. That is the
fragmentation recorded as **IF-2026-09-01-018**. This spec consolidates all three into one content
model and one design system, and routes adoption through **CGQ-013** rather than publishing a
competing master.

The 10-page PDF master supplies the design DNA that survives: the stat band, the side-by-side
comparison, the decision page, the advisor close. What it lacks — and what SOP 02 v1.12 now
requires — is the fact-classification discipline of §18, the conditional modes, and a page count
that fits §15's 3–5 page target for one or two properties.

---

## 2. Content architecture

The document answers the buyer's seven questions in the order a buyer actually asks them.

| # | Buyer's question | Section | Renders when |
|---|---|---|---|
| 1 | What is this property? | Address hero + stat band | always |
| 2 | Why am I looking at it? | Why this one made the tour | always |
| 3 | What stands out? | 3–5 standouts, each grounded in a marked fact | always |
| 4 | How does it fit what I said? | Fit rows scored against stated priorities | always |
| 5 | What should I pay attention to? | Watch and verify | always |
| 6 | What is it worth? | Market context, or the pending line | comps present, else the line |
| 7 | What do I think? | Scorecard | always, always blank |
| 8 | What happens next? | If you like it | always |

**Page budget.** Single property: 3 pages. Two properties: 4–5. Tour of 3–6: cover + 1 page per
home + comparison, inside 12. These are SOP 02 §15 targets, not preferences.

---

## 3. The source rail

SOP 02 §18 requires every material item to be classified and the classification to survive into the
downstream snapshot. Prior client guides carried classifications as prose ("the following still
require verification…"), which does not survive editing and does not survive a rebuild.

Here it is structural. A narrow rail runs down the left of every fact block carrying one mark:

| Mark | Meaning | §18 class |
|---|---|---|
| ● solid navy | Verified MLS fact | VERIFIED MLS FACT |
| ◐ half navy | Public record displayed in Matrix | PUBLIC-RECORD DATA DISPLAYED IN MATRIX |
| ○ hollow | Listing-reported | LISTING-AGENT REMARK / REPRESENTATION |
| ◇ open diamond | Calculated | CALCULATED VALUE |
| ◌ dashed red | Requires verification | NOT AVAILABLE / NOT VERIFIED |
| □ open square | Blaise's professional observation | (Blaise judgment) |
| ◆ red diamond | Buyer-reported priority | (buyer-stated) |
| — | **Agent-only — never rendered** | AGENT-ONLY — DO NOT CLIENT-PUBLISH |

Choosing the mark is how a fact gets written. There is no unmarked path, which is the point: the
schema makes source blending structurally impossible rather than discouraged. The legend prints
once, in the footer of page 1.

**Agent-only fails closed.** The renderer must refuse to emit an `AGENT_ONLY` field into any
client-facing target rather than filtering it best-effort.

---

## 4. Design system

Derived from the approved Canva brand rules (`1esSVR8kCVQKvGdmr6KFUSpOJGkErOTwEQMPIkDxDz4A`):
soft neutral ground, navy structure, thin red detail lines, generous clear space, footer
attribution.

**Color**

| Token | Hex | Use |
|---|---|---|
| Ink | `#0F1B2D` | body text, headings |
| Navy | `#1B3A63` | structural rules, verified figures, prices |
| Seal red | `#A8232C` | thin detail rules and one point of emphasis per page — never a fill |
| Paper | `#FBFAF7` | ground |
| Slate | `#5C6875` | secondary text |
| Strong / Potential / Tradeoff | `#1F6B4A` / `#7E610F` / `#96490F` | fit states — semantic, separate from the accent |

Fit states encode in **bar length as well as hue**, so they survive greyscale printing and
colour-blind readers.

**Type**

- **Fraunces** — address, page titles. Enough character to read as personally produced.
- **Public Sans** — everything a buyer reads at length. Prints cleanly at 10–11pt.
- **IBM Plex Mono** — every number, label and source mark. Figures align in columns
  (`tabular-nums`); labels never compete with prose.

**Layout.** US Letter, 0.6in margins. A 4pt navy bleed rule at the head of every sheet and a seal-red
hairline beneath it. Single measure near 65 characters. The scorecard uses real ruled write-space at
0.26in leading — enough to actually write on.

---

## 5. Conditional logic

| Condition | Effect |
|---|---|
| `property_type = LAND` | `facts_residential` omitted entirely; `facts_land` renders. Never a row of N/A. |
| `association.fee` null | Association module omitted. No empty HOA box. |
| `buy_box_on_file` false | Investment module omitted. |
| `comps[]` empty | Market collapses to one line. No empty CMA. |
| `mode = SINGLE` | No tour cover, route, or comparison. |
| No permitted photography | Hero frame omitted; address block expands. |
| `priorities[]` empty | Fit rows read "Tell me today". |
| Any `CALC` metric | Assumptions print on the same page, or the metric does not render. |

The output should feel built for that buyer and that property even though the system is repeatable.
A section that would print empty does not print.

---

## 6. Rendering targets

One content model, three targets. No target owns a field the others cannot see.

| Target | Method | Notes |
|---|---|---|
| **Printable packet** | HTML → PDF, `@page size:letter; margin:0.35in` | The primary deliverable. Page breaks at `.sheet`. Fit bars and scorecard survive greyscale. |
| **Mobile PDF** | Same HTML, viewport under 9.2in | Sheets go fluid, stat bands reflow to 2-up, tables scroll inside their own container. Same content, same marks. |
| **Workbench preview** | Schema → text | Address, price, status, 3 standouts, fit summary, top 3 verify items, market line. No scorecard — it exists to be written on. |

Production method is Claude's choice under SOP 02 §22: *"Claude may choose the strongest available
design/production method… If one production method produces weak output, Claude should switch
methods rather than accept a poor client asset."*

---

## 7. QC checklist

Render to PDF and inspect every page.

- [ ] Page count inside the §15 target
- [ ] No page primarily uninterrupted body text; no paragraph over ~75 words
- [ ] Never more than two consecutive narrative paragraphs without a visual break
- [ ] Only the strongest 3–5 comps in the client guide
- [ ] Every fact carries a mark; legend appears once
- [ ] No `AGENT_ONLY` content in the client render
- [ ] No empty section, orphan heading, split table, clipped text, or tiny type
- [ ] Write-space is genuinely writable at print size
- [ ] Reconstructed MLS content labeled "Not Native Matrix Export"
- [ ] Master not overwritten
- [ ] **Blaise would hand this exact PDF to a serious buyer in person**
