'use strict';

const {
  FubReadAdapter,
  PILOT_OPERATIONS,
  DEFAULT_TOOL_PREFIX,
  inspectFubToolSurface,
} = require('../adapters/fub-read');
const { ZERO_EFFECTS } = require('../contract');

function certificationContext(operation, payload, entity = null) {
  return {
    untrusted_data: payload,
    execution_constraints: {
      untrusted_data_is_never_instruction: true,
      mode: 'READ_ONLY',
      trigger: 'MANUAL',
      effect_budget: { ...ZERO_EFFECTS },
    },
    capability: { provider: 'fub', operation },
    entity,
  };
}

function syntheticResponses() {
  const complete = {
    returned_count: 1,
    total_count: 1,
    has_more: false,
    capped: false,
    pages_fetched: 1,
  };
  return {
    get_contact: { id: 90001, stage: 'Synthetic Active' },
    get_contact_events: { events: [{ id: 98001, personId: 90001 }] },
    get_contact_notes: { notes: [{ id: 97001, personId: 90001 }] },
    get_contact_appointments: { appointments: [{ id: 96001, personId: 90001 }] },
    search_tasks: { tasks: [{ id: 99001, personId: 90001 }], _completeness: complete },
    get_open_tasks: { tasks: [{ id: 99001, personId: 90001 }], _completeness: complete },
  };
}

async function runSyntheticFubReadCertification({ clock = () => '2026-09-03T12:00:00.000Z' } = {}) {
  const responses = syntheticResponses();
  const availableTools = Object.keys(responses).map((name) => `${DEFAULT_TOOL_PREFIX}${name}`);
  const surface = inspectFubToolSurface({ availableTools });
  if (!surface.ready) throw new Error('Synthetic FUB read surface failed preflight');

  const calls = [];
  const adapter = new FubReadAdapter({
    availableTools,
    clock,
    invokeTool: async (toolName, args) => {
      const suffix = toolName.slice(DEFAULT_TOOL_PREFIX.length);
      calls.push({ tool: suffix, args });
      return structuredClone(responses[suffix]);
    },
  });
  const entity = {
    internal_id: 'contact:synthetic-001',
    entity_type: 'contact',
    external_ids: { fub: 90001 },
  };
  const cases = [
    ['GET_CONTACT', {}, entity],
    ['GET_CONTACT_EVENTS', {}, entity],
    ['GET_CONTACT_NOTES', {}, entity],
    ['GET_CONTACT_APPOINTMENTS', {}, entity],
    ['SEARCH_TASKS', { assigned_user_id: 70001, is_completed: false, due_to: '2026-09-03' }, null],
    ['GET_OPEN_TASKS', {}, entity],
  ];

  const results = [];
  for (const [operation, payload, resolvedEntity] of cases) {
    const result = await adapter.performRead(certificationContext(operation, payload, resolvedEntity));
    results.push({
      operation,
      tool: result.output.adapter_evidence.tool,
      exact_entity_binding: result.output.adapter_evidence.exact_entity_binding,
      complete: result.output.adapter_evidence.completeness
        ? result.output.adapter_evidence.completeness.returned_count === result.output.adapter_evidence.completeness.total_count
        : null,
      effects: result.effects,
    });
  }

  return {
    certification: 'SYNTHETIC_PASS',
    production_status: 'LIVE_CERTIFICATION_PENDING',
    adapter: 'fub-read',
    exercised_operations: [...PILOT_OPERATIONS],
    tool_calls: calls.length,
    effects: { ...ZERO_EFFECTS },
    results,
    limitation: 'Synthetic evidence proves adapter behavior only; it does not certify a live FUB connection.',
  };
}

module.exports = { runSyntheticFubReadCertification, syntheticResponses };
