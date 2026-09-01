# Matrix / Northstar Property Research Handoff

**Purpose.** Claude Code has no browser lane. Northstar MLS / Matrix is reachable only through the
Claude-in-Chrome operator. This document is the repo-side contract for requesting verified MLS
evidence and ingesting it into a Buyer Property Snapshot.

**The operator prompt is canonical and lives in SOP 02 §18** (`SOP 02 – Buyer Property Search,
Showing & Value Analysis`, fileId `1xxYjWwspET-gR5gYYtOb6uHh7eYXiM0r0YxRubjlB28`, v1.13,
change note dated September 1, 2026). **Do not compose a different prompt.** Retrieve §18 and send it
verbatim. This file specifies only the request envelope and the ingestion rules — the parts that
live on the Claude Code side.

---

## 1. Request envelope

Issued through the `chrome-operator-handoff` skill. One request per tour, not per property.

```
MATRIX PROPERTY RESEARCH REQUEST
RESEARCH REQUEST ID:  MPR-YYYY-MM-DD-NN
REQUESTED AT:         <ISO-8601, America/Chicago>
REQUESTED BY:         Claude Code / buyer-property-snapshot
CONTROLLING SOURCE:   SOP 02 v<live version> §18

BUYER:                <display name>
PROPERTY / PROPERTIES: <address or MLS number, one per line, in tour order>
SHOWING DATE:         <date, or NOT YET SCHEDULED>
MODE:                 SINGLE | TOUR
PROPERTY TYPE HINT:   RESIDENTIAL | CONDO_TOWNHOME | LAND | INVESTMENT | UNKNOWN
VALUE CONTEXT:        REQUESTED | NOT REQUESTED
BUYER PRIORITIES:     <only those actually on file; omit the line entirely if none>

OPERATOR PROMPT:      SOP 02 §18, sent verbatim below.
<-- §18 body, retrieved live -->
```

**Rules for the envelope**

- `BUYER PRIORITIES` is omitted entirely when FUB holds none. An empty priorities line invites the
  operator to infer them. SOP 02 §18: *"Do not rank unless buyer priorities were supplied."*
- `PROPERTY TYPE HINT` selects the operator's LAND / CONDO-TOWNHOME mode. `UNKNOWN` is a valid and
  honest value.
- Never include a lockbox code, access credential, or buyer financial detail in the envelope.

---

## 2. Returned packet

The operator returns `MATRIX PROPERTY RESEARCH PACKET` in the exact section order fixed by §18:

```
IDENTITY · PRICING & MARKET TIME · PROPERTY FACTS · SYSTEMS / FEATURES · HOA / ASSOCIATION
LISTING-REPORTED HIGHLIGHTS · AGENT-ONLY INFORMATION · DISCLOSURES / SUPPLEMENTS
LISTING / SALE HISTORY · VALUE CONTEXT · VERIFY / ASK ABOUT · IMAGE HANDOFF · SOURCE LIMITATIONS
[repeat per property] · TOUR COMPARISON · FACT CLASSIFICATION SUMMARY · HANDOFF
```

That order is the ingestion contract. A packet returned in a different shape is not ingested — it is
returned to the operator.

---

## 3. Ingestion rules

Map `FACT CLASSIFICATION SUMMARY` onto `snapshot-schema.json` marks:

| Packet class | Schema mark |
|---|---|
| VERIFIED MLS FACT | `MLS` |
| PUBLIC-RECORD DATA DISPLAYED IN MATRIX | `PUB` |
| LISTING-AGENT REMARK / REPRESENTATION | `REP` |
| CALCULATED VALUE | `CALC` |
| NOT AVAILABLE / NOT VERIFIED | `VER` |
| AGENT-ONLY — DO NOT CLIENT-PUBLISH | `AGENT_ONLY` |

**Non-negotiable:**

1. **No promotion.** A `REP` item never becomes `MLS` because it sounds factual. "Listing remarks
   state the roof was replaced in 2024" is not "roof replaced in 2024".
2. **Agent-only fails closed.** `AGENT_ONLY` loads into `agent_only[]` and the renderer refuses to
   emit it into any client-facing target. Not filtered — refused.
3. **`AVAILABLE — NOT REVIEWED` is not `REVIEWED`.** A disclosure that exists and was not opened
   renders as existing and not opened.
4. **`COMP SET WEAK — FULL CMA RECOMMENDED`** sets `comp_set_weak: true` and prints that conclusion.
   It never becomes a range.
5. **`READY FOR BUYER PROPERTY SNAPSHOT: PARTIAL | NO`** means the packet names what is missing. It
   is not permission to fill the gap. The snapshot says what remains unverified.
6. **`SOURCE LIMITATIONS` carries through verbatim** into `packet.source_limitations[]`.
7. **Images are assets, not numbers.** See §3A. No image is redistributed outside the permitted
   workflow without separate authorization, and `client_publishable: NO` blocks it entirely.

---

## 3A. Image handoff — SOP 02 v1.13

v1.13 made **actual usable listing imagery the normal required handoff** for client Snapshot
production, when technically available and permitted under current MLS, brokerage and photo-use
rules. The operator visually inspects the gallery, makes its own professional selection — normally
one hero exterior plus two to four supporting photos and any useful floor plans — and transfers the
files. Deterministic filenames: `01-hero-exterior`, `02-kitchen`, `03-living-area`,
`04-primary-bedroom`, `floorplan-01`.

The packet returns an `IMAGE HANDOFF` block:

```
IMAGE HANDOFF STATUS: COMPLETE / PARTIAL / BLOCKED
ATTACHED / EXPORTED IMAGE FILES:
SOURCE PHOTO NUMBERS:
HERO IMAGE:
SUPPORTING IMAGES:
FLOOR PLANS:
CLIENT-PUBLISHABLE: YES / NO / VERIFY
IMAGE LIMITATIONS:
```

**Ingestion rules**

| Returned | Ingested as | Renders? |
|---|---|---|
| `COMPLETE` with actual files attached | `images.assets[]` with `data`, mark `MLS` | yes |
| `PARTIAL` | the assets that arrived render; the rest stay as `source_photo_numbers[]` | partially |
| `BLOCKED` | `source_photo_numbers[]` + `manual_retrieval_step` only | no |
| Photo numbers or descriptions **only** | `PARTIAL`/`BLOCKED` — **never `COMPLETE`** | no |
| `CLIENT-PUBLISHABLE: NO` | held internally | never |

**A photo number is not a photo.** SOP 02 v1.13 QC: *"do not call the image handoff COMPLETE when
only photo references/descriptions were returned."* A packet that lists gallery numbers has not
delivered images, however well it describes them. Recording it as COMPLETE is a reporting failure,
not a formatting choice.

**Manual fallback — a first-class path, not a degraded one.** When status is `PARTIAL` or `BLOCKED`,
Blaise supplies the selected images directly. They ingest into the same `images.assets[]` array with
mark `MANUAL` and render identically. The workflow does not stall, and the packet is not re-run
merely to obtain pictures. Two supported routes:

1. **Files to the builder** — dropped into the snapshot build and embedded as data URIs.
2. **In-page ingestion** — the rendered snapshot carries a screen-only photo control. Blaise selects
   or drags the images; the page places the first as hero and the rest as supporting, and prints
   with them. Files never leave his browser.

Neither route may be used to insert an image the MLS rules do not permit for this use.

---

## 4. What this lane is not

- It is **read-only research**. The operator does not change Matrix, build the client asset, write
  marketing copy, send communication, or make an offer decision. SOP 02 §18 states this directly.
- It does not replace Matrix as the source of truth.
- It does not authorize browser writes. Browser automation of any kind remains HOLD (CLAUDE.md §6).
- A returned packet is evidence, not a deliverable. The Buyer Workbench builds the deliverable.

---

## 5. Honest reporting

If the research request is issued and no packet returns, the snapshot is built **without** the value
section, which prints:

> Value analysis pending verified MLS/comparable review.

That is the correct output. It is never replaced by remembered MLS data, portal data, or an estimate.
CLAUDE.md §8: a disconnect creates a resume checkpoint, not a background job; "not returned" never
means "did not happen".
