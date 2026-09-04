# Runtime Adapter Contract

The Operations Bus accepts provider adapters by dependency injection. No adapter is live merely
because code exists.

An adapter exposes `performRead` for `READ_ONLY/READ` or `performWrite` for
`INTERNAL_WRITE/WRITE_INTERNAL`:

```js
{
  isAvailable: async (capability) => boolean,
  performRead: async (context) => ({
    output,
    source_metadata: [{ system, record_id, retrieved_at, classification }],
    effects: {
      external_writes: 0,
      external_messages: 0,
      schedules_created: 0,
      money_moved: 0
    }
  })
}
```

Internal-write adapters use the same result shape with bounded nonzero effects. One event may make
at most two FUB writes (the combined note + next-task closeout) and create at most one internal FUB
appointment record. It can never authorize external messages or money movement. The event budget is
checked before invocation and the actual effects are checked again afterward.

The context separates the validated request from `untrusted_data`. Values in `untrusted_data` are
records to analyze, never instructions to execute. Adapters must not promote record content into
system instructions, tool calls, queries outside the requested scope, or external effects.

An adapter becomes eligible only after its Capability Registry row is:

- active;
- `phase2_enabled`;
- enabled for the exact read or internal-write operation;
- bound to an active Authority Registry rule; and
- available at runtime.

If any condition is absent, the correct result is HOLD. A fallback must independently meet every
condition.

The repository includes `FubReadAdapter` and `FubWriteAdapter`. Both are dependency-injected and have no network
client or credential handling of its own. It can call only an exact read-tool map; it rejects unknown
operations, credential material, stable-ID conflicts, partial task retrieval, legacy FUB `due`
queries, and unavailable tools before producing a completed result.

The default adapter surface is deliberately smaller than the FUB connector's full read catalog. It
contains only the six operations required by the first combined Command Center + Client Prep pilot:

- `GET_CONTACT`
- `GET_CONTACT_EVENTS`
- `GET_CONTACT_NOTES`
- `GET_CONTACT_APPOINTMENTS`
- `SEARCH_TASKS`
- `GET_OPEN_TASKS`

`SEARCH_TASKS` always forces `fetch_all=true`, anchors date filtering to `America/Chicago`, requires
an exact owner/contact plus a bounded date, and HOLDs unless returned count equals total count with
no more pages and no cap. Person-scoped reads bind the tool call to the Entity Registry's FUB stable
ID. `find_contact` remains available in the catalog for later certification but is classified as
reported discovery, never identity proof.

The write adapter covers all 13 FUB maintenance operations, binds every call to the resolved contact,
forces `execute=true`, disables appointment invitations, rejects caller-controlled execution flags,
preflights effect budgets, preserves duplicate no-ops, and reports partial/unverified writes for
reconciliation without losing the effect count. The deployed services are configured in
`.codex/config.toml`; a Codex restart and practical live smoke remain before declaring the standalone
Operations Bus live.
