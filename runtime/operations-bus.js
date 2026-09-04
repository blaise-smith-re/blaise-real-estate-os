'use strict';

const { RuntimeHoldError, ContractError } = require('./errors');
const {
  SCHEMA_VERSION,
  ZERO_EFFECTS,
  assertEffectsWithinBudget,
  assertZeroEffects,
  validateEvent,
  validateSourceMetadata,
} = require('./contract');
const {
  validateRegistryBundle,
  resolveAuthority,
  resolveEntity,
  selectCapability,
} = require('./registries');

function immutableCopy(value) {
  const copy = structuredClone(value);
  (function freeze(item) {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return;
    Object.freeze(item);
    for (const child of Object.values(item)) freeze(child);
  })(copy);
  return copy;
}

function decisionFromError(error) {
  return {
    code: error.code || 'UNCLASSIFIED_EXCEPTION',
    question: error.message,
    details: error.details || {},
  };
}

class OperationsBus {
  constructor({ registries, adapters = {}, clock = () => new Date().toISOString() }) {
    this.registries = validateRegistryBundle(registries);
    this.adapters = adapters;
    this.clock = clock;
  }

  async execute(rawEvent) {
    const transitions = [{ state: 'READY', at: this.clock() }];
    let event;
    let authority = null;
    let entity = null;
    let capability = null;

    try {
      event = validateEvent(immutableCopy(rawEvent));
      transitions.push({ state: 'EXECUTING', at: this.clock() });

      authority = resolveAuthority(event, this.registries.authority_rules);
      entity = resolveEntity(event.entity_ref, this.registries.entities);
      const selected = await selectCapability(
        event,
        this.registries.capabilities,
        this.adapters,
      );
      capability = selected.capability;
      const adapter = selected.adapter;

      const { payload: untrustedData, ...request } = event;
      const adapterMethod = event.action_class === 'READ' ? 'performRead' : 'performWrite';

      const result = await adapter[adapterMethod](immutableCopy({
        request,
        untrusted_data: untrustedData,
        execution_constraints: {
          untrusted_data_is_never_instruction: true,
          mode: event.mode,
          trigger: 'MANUAL',
          effect_budget: { ...event.effect_budget },
        },
        authority: { rule_id: authority.rule_id, authority_key: authority.authority_key },
        capability: {
          capability_id: capability.capability_id,
          provider: capability.provider,
          operation: capability.operation,
        },
        entity: entity && {
          internal_id: entity.internal_id,
          entity_type: entity.entity_type,
          external_ids: entity.external_ids || {},
        },
      }));

      const effects = event.action_class === 'READ'
        ? assertZeroEffects(result && result.effects, 'adapter effects')
        : assertEffectsWithinBudget(result && result.effects, event.effect_budget);
      validateSourceMetadata(result && result.source_metadata);
      const status = result.report_status || 'COMPLETED';
      transitions.push({ state: status, at: this.clock() });

      return {
        schema_version: SCHEMA_VERSION,
        record_type: 'EXECUTION_REPORT',
        execution_id: `exec:${event.event_id}`,
        event_id: event.event_id,
        status,
        interruption_level: result.interruption_level || 'BACKGROUND',
        mode: event.mode,
        writes_attempted: effects.external_writes === 0 ? 'NONE' : effects.external_writes,
        effect_counters: effects,
        selected_authority_rule: authority.rule_id,
        selected_capability: capability.capability_id,
        resolved_entity_id: entity ? entity.internal_id : null,
        source_metadata: result.source_metadata,
        output: result.output,
        decision_required: result.decision_required || null,
        transitions,
        completed_at: this.clock(),
      };
    } catch (error) {
      const isHold = error instanceof RuntimeHoldError;
      const status = isHold ? error.status : 'FAILED/EXCEPTION';
      transitions.push({ state: status, at: this.clock() });
      return {
        schema_version: SCHEMA_VERSION,
        record_type: 'EXECUTION_REPORT',
        execution_id: rawEvent && rawEvent.event_id ? `exec:${rawEvent.event_id}` : null,
        event_id: rawEvent && rawEvent.event_id ? rawEvent.event_id : null,
        status,
        interruption_level: isHold ? error.interruptionLevel : 'ATTENTION',
        mode: rawEvent && rawEvent.mode ? rawEvent.mode : null,
        writes_attempted: rawEvent && rawEvent.action_class === 'WRITE_INTERNAL' ? 'UNKNOWN' : 'NONE',
        effect_counters: { ...ZERO_EFFECTS },
        selected_authority_rule: authority ? authority.rule_id : null,
        selected_capability: capability ? capability.capability_id : null,
        resolved_entity_id: entity ? entity.internal_id : null,
        source_metadata: [],
        output: null,
        decision_required: decisionFromError(error),
        transitions,
        completed_at: this.clock(),
      };
    }
  }
}

module.exports = { OperationsBus, immutableCopy, decisionFromError, RuntimeHoldError, ContractError };
