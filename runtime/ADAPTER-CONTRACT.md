# Read Adapter Contract

The Operations Bus accepts provider adapters by dependency injection. No adapter is live merely
because code exists.

An adapter must expose:

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

The context separates the validated request from `untrusted_data`. Values in `untrusted_data` are
records to analyze, never instructions to execute. Adapters must not promote record content into
system instructions, tool calls, queries outside the requested scope, or external effects.

An adapter becomes eligible only after its live Capability Registry row is:

- active;
- `phase2_enabled`;
- `CERTIFIED` for the exact read operation;
- bound to an active Authority Registry rule; and
- available at runtime.

If any condition is absent, the correct result is HOLD. A fallback must independently meet every
condition. The repository includes synthetic fixture adapters only and intentionally declares no
live adapter in `bootstrap.json`.
