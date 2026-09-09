# Case field ownership
No previous property's facts are defaults. Null means missing, never zero/false/no HOA.

| Field group | Owner / purpose | Public use |
|---|---|---|
| identity.address, mls, listing_agent; event date/start/end | Required trigger; Codex resolves spelling and exact identity | Address; confirmed or explicitly requested draft event copy |
| identity.city; property; internal.sources | Browser-retrieved MLS facts, exact source address/MLS/price/time | Verified price and essential specs only |
| property.hoa | Conditional: yes + numeric amount/frequency; no + optional show_no_hoa; unknown must resolve backstage | Applicable verified dues; optional No HOA |
| marketing | Codex/Work editorial synthesis from verified evidence | Positioning and benefit hierarchy; never source/QA notes |
| marketing.required_disclaimer + disclaimer_source | Conditional current controlling requirement for exact asset | Only exact approved necessary wording |
| internal | Agent remarks/access/history, source conflicts, disclosures, host knowledge, alternatives and conversational prompts | Never automatically rendered on public assets |
| media | Downloaded original path, hash, observed source URL, MLS, role tags, visual fit, exclusions and focal point | Selected actual property images only |
| portraits | Current approved library candidates, source/hash, composition scores and recent IDs | Selected approved portraits; sign-in/internal remain portrait-free |
| sign_route | Browser/maps evidence, checked_at, exactly five stops with location/arrow/approach/reason/order/onsite_check | Internal only |
| governance_receipt | Current-only ID/title/status/retrieved_at/content_sha256; Source Map plus five owners | Internal only |
| event.confirmed / media.rights / recordkeeping | Conditional operational authority, not design or source truth | Not printed as public status labels |
| run/internal/production.json | Calculated currency formatting, weekday/time, HOA display, selected photos/crops/portrait roles | Approved values only, not the normalized file itself |

Media candidates: `{id,file,sha256,source_url,roles:["exterior"],fit:{exterior:100},quality:90,focal:[0.5,0.5],excluded:false}`. File paths are relative to case or absolute, never URLs posing as local files. Role tags/scores are Codex visual judgments, not factual room recognition by Python.

Portrait candidates: `{id,file,sha256,source_url,approved:true,fit:{handout:100,social_06:60,social_08:60}}`. Use different roles and recent_ids to avoid mechanically repeating a portrait.

Alternatives: `{address,price,specs,difference,status:"Active",source,checked_at}`. Price/specs here are concise display strings; primary property price is numeric.

Sign stops: `{location,arrow,approach,reason,order:1,onsite_check}`. Exactly five unique locations and order values 1–5. Map source/time mandatory. An empty route produces an explicit internal research-pending output, not a fictional plan or complete research claim.
