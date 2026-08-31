# Test Fixtures — SYNTHETIC ONLY

**No real client data may ever be placed in this directory.**

Every record here is fabricated for adversarial testing. Names, emails, phone numbers, addresses and
IDs are synthetic and must not collide with any live FUB, Ylopo, Gmail, or Calendar identifier.

Per the Execution Operator SOP Stage-B test-identity hygiene rule: a record is **not** sanitized
merely because its display name says "Test". A synthetic identifier must not be usable for real
client correspondence, live email/CRM matching, or any system-owned business-routing identity.

Fixtures use the reserved `example.invalid` domain and the `555-01xx` reserved phone range.

One deliberate exception: `calendar-synthetic-artifact` in `fub-synthetic-records.json` references
Calendar event `3ljnsk6e4bmj7qmrtkne30ehgc`, a **real outstanding Phase 1 test artifact** recorded in
Improvement Finding IF-2026-08-31-006. It is included because agents must learn to exclude it. It
contains no client data.
