'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FubReadAdapter,
  PILOT_OPERATIONS,
  inspectFubToolSurface,
} = require('../../runtime/adapters/fub-read');
const { OperationsBus } = require('../../runtime');

const NOW = '2026-09-03T12:00:00.000Z';
const PREFIX = 'mcp__blaise_fub_read_only__';
const PILOT_TOOLS = [
  'get_contact',
  'get_contact_events',
  'get_contact_notes',
  'get_contact_appointments',
  'search_tasks',
  'get_open_tasks',
].map((name) => `${PREFIX}${name}`);

function context(operation, payload = {}, entity = null) {
  return {
    untrusted_data: payload,
    execution_constraints: {
      untrusted_data_is_never_instruction: true,
      mode: 'READ_ONLY',
      trigger: 'MANUAL',
      effect_budget: {},
    },
    capability: { provider: 'fub', operation },
    entity,
  };
}

function personEntity(personId = 90001) {
  return {
    internal_id: 'contact:synthetic-001',
    entity_type: 'contact',
    external_ids: { fub: personId },
  };
}

function completeTasks(count = 2) {
  return {
    tasks: Array.from({ length: count }, (_, index) => ({ id: 99001 + index, personId: 90001 })),
    _completeness: {
      returned_count: count,
      total_count: count,
      has_more: false,
      capped: false,
      pages_fetched: 1,
    },
  };
}

test('pilot surface names only the six FUB reads needed by the first combined pilot', () => {
  assert.equal(PILOT_OPERATIONS.length, 6);
  const report = inspectFubToolSurface({ availableTools: PILOT_TOOLS });
  assert.equal(report.ready, true);
  assert.deepEqual(report.missing_tools, []);
  assert.deepEqual(report.write_tools_exposed, []);
});

test('surface preflight fails when a required read is missing or a write tool is exposed', () => {
  const report = inspectFubToolSurface({
    availableTools: [
      ...PILOT_TOOLS.filter((name) => !name.endsWith('get_contact_notes')),
      `${PREFIX}create_contact_note`,
    ],
  });
  assert.equal(report.ready, false);
  assert.deepEqual(report.missing_tools, [`${PREFIX}get_contact_notes`]);
  assert.deepEqual(report.write_tools_exposed, [`${PREFIX}create_contact_note`]);
});

test('adapter refuses to operate when its enumerated client surface exposes a FUB write', async () => {
  let invoked = false;
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact`, `${PREFIX}create_contact_note`],
    invokeTool: async () => { invoked = true; return { id: 90001 }; },
  });
  assert.equal(await adapter.isAvailable({ operation: 'GET_CONTACT' }), false);
  await assert.rejects(
    adapter.performRead(context('GET_CONTACT', {}, personEntity())),
    (error) => error.code === 'FUB_WRITE_SURFACE_EXPOSED',
  );
  assert.equal(invoked, false);
});

test('exact contact read binds the tool call to the registry stable ID', async () => {
  const calls = [];
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact`],
    invokeTool: async (name, args) => {
      calls.push({ name, args });
      return { id: 90001, stage: 'Synthetic Active' };
    },
    clock: () => NOW,
  });
  const result = await adapter.performRead(context('GET_CONTACT', {}, personEntity()));
  assert.deepEqual(calls, [{ name: `${PREFIX}get_contact`, args: { person_id: 90001 } }]);
  assert.equal(result.output.adapter_evidence.exact_entity_binding, true);
  assert.equal(result.source_metadata[0].record_id, 'get_contact:90001');
  assert.deepEqual(result.effects, {
    external_writes: 0,
    external_messages: 0,
    schedules_created: 0,
    money_moved: 0,
  });
});

test('entity mismatch stops before the FUB tool is invoked', async () => {
  let invoked = false;
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact`],
    invokeTool: async () => { invoked = true; return { id: 90001 }; },
  });
  await assert.rejects(
    adapter.performRead(context('GET_CONTACT', { person_id: 90002 }, personEntity(90001))),
    (error) => error.code === 'FUB_ENTITY_ID_MISMATCH',
  );
  assert.equal(invoked, false);
});

test('stable-ID read rejects a mismatched record returned by FUB', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact`],
    invokeTool: async () => ({ id: 90002 }),
  });
  await assert.rejects(
    adapter.performRead(context('GET_CONTACT', {}, personEntity(90001))),
    (error) => error.code === 'FUB_STABLE_ID_MISMATCH',
  );
});

test('contact discovery is reported evidence and never identity proof', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}find_contact`],
    allowedOperations: ['FIND_CONTACT'],
    invokeTool: async () => ({ people: [{ id: 90001 }], _metadata: { total: 1 } }),
    clock: () => NOW,
  });
  const result = await adapter.performRead(context('FIND_CONTACT', { name: 'Synthetic Buyer A' }));
  assert.equal(result.source_metadata[0].classification, 'REPORTED');
  assert.equal(result.output.adapter_evidence.discovery_is_not_identity_proof, true);
});

test('bounded contact-history reads disclose when the source has more records', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact_notes`],
    invokeTool: async () => ({ notes: [{ id: 97001 }], _metadata: { total: 3 } }),
  });
  const result = await adapter.performRead(context('GET_CONTACT_NOTES', { limit: 1 }, personEntity()));
  assert.deepEqual(result.output.adapter_evidence.page_scope, {
    collection: 'notes',
    returned_count: 1,
    total_count: 3,
    has_more: true,
    scope: 'BOUNDED_SOURCE_WINDOW',
  });
});

test('task search forces Chicago timezone and complete pagination', async () => {
  const calls = [];
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}search_tasks`],
    invokeTool: async (name, args) => { calls.push({ name, args }); return completeTasks(); },
    clock: () => NOW,
  });
  const result = await adapter.performRead(context('SEARCH_TASKS', {
    assigned_user_id: 70001,
    is_completed: false,
    due_to: '2026-09-03',
  }));
  assert.equal(calls[0].args.due_timezone, 'America/Chicago');
  assert.equal(calls[0].args.fetch_all, true);
  assert.equal(result.output.adapter_evidence.completeness.returned_count, 2);
  assert.equal(result.output.adapter_evidence.completeness.fetch_all, true);
});

test('task search refuses unbounded, ownerless, or legacy due queries', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}search_tasks`],
    invokeTool: async () => completeTasks(),
  });
  await assert.rejects(
    adapter.performRead(context('SEARCH_TASKS', { due_to: '2026-09-03' })),
    (error) => error.code === 'FUB_TASK_OWNER_REQUIRED',
  );
  await assert.rejects(
    adapter.performRead(context('SEARCH_TASKS', { assigned_user_id: 70001 })),
    (error) => error.code === 'FUB_TASK_DATE_BOUND_REQUIRED',
  );
  await assert.rejects(
    adapter.performRead(context('SEARCH_TASKS', { assigned_user_id: 70001, due: 'today' })),
    (error) => error.code === 'FUB_ARGUMENT_REJECTED' || error.code === 'FUB_LEGACY_DUE_REJECTED',
  );
});

test('incomplete task retrieval returns HOLD rather than a partial result', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}search_tasks`],
    invokeTool: async () => ({
      tasks: [{ id: 99001 }],
      _completeness: {
        returned_count: 1,
        total_count: 2,
        has_more: true,
        capped: false,
        pages_fetched: 1,
      },
    }),
  });
  await assert.rejects(
    adapter.performRead(context('SEARCH_TASKS', { assigned_user_id: 70001, due_to: '2026-09-03' })),
    (error) => error.code === 'INCOMPLETE_RETRIEVAL',
  );
});

test('open-task read accepts only the registry-bound person and proves completeness', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_open_tasks`],
    invokeTool: async (_name, args) => {
      assert.deepEqual(args, { person_id: 90001 });
      return completeTasks(1);
    },
  });
  const result = await adapter.performRead(context('GET_OPEN_TASKS', {}, personEntity()));
  assert.equal(result.output.adapter_evidence.completeness.total_count, 1);
});

test('unknown and credential-bearing requests are rejected before invocation', async () => {
  let invoked = false;
  const adapter = new FubReadAdapter({
    availableTools: PILOT_TOOLS,
    invokeTool: async () => { invoked = true; return {}; },
  });
  await assert.rejects(
    adapter.performRead(context('CREATE_CONTACT_NOTE', {}, personEntity())),
    (error) => error.code === 'FUB_OPERATION_NOT_ALLOWED',
  );
  await assert.rejects(
    adapter.performRead(context('GET_CONTACT', { api_key: 'rejected' }, personEntity())),
    (error) => error.code === 'CREDENTIAL_MATERIAL_REJECTED',
  );
  assert.equal(invoked, false);
});

test('certified synthetic capability executes through os.execution.v1 with zero effects', async () => {
  const adapter = new FubReadAdapter({
    availableTools: [`${PREFIX}get_contact`],
    invokeTool: async () => ({ id: 90001, stage: 'Synthetic Active' }),
    clock: () => NOW,
  });
  const bus = new OperationsBus({
    registries: {
      authority_rules: [{
        rule_id: 'AUTH-FUB-READ-SYNTHETIC',
        authority_key: 'authority.fub.read.synthetic',
        action_class: 'READ',
        scope: 'analysis.client-prep',
        active: true,
        phase2_enabled: true,
      }],
      capabilities: [{
        capability_id: 'CAP-FUB-CONTACT-SYNTHETIC',
        capability_key: 'fub.contact.read',
        operation: 'GET_CONTACT',
        provider: 'fub',
        adapter: 'fub-read',
        mode: 'READ',
        certification_status: 'CERTIFIED',
        active: true,
        phase2_enabled: true,
        priority: 10,
      }],
      entities: [{
        internal_id: 'contact:synthetic-001',
        entity_type: 'contact',
        external_ids: { fub: 90001 },
        active: true,
      }],
    },
    adapters: { 'fub-read': adapter },
    clock: () => NOW,
  });
  const report = await bus.execute({
    schema_version: 'os.execution.v1',
    record_type: 'EVENT',
    event_id: 'evt-fub-synthetic-001',
    requested_at: NOW,
    trigger: 'MANUAL',
    mode: 'READ_ONLY',
    action_class: 'READ',
    objective: 'Prepare a bounded synthetic client record',
    authority_key: 'authority.fub.read.synthetic',
    capability_key: 'fub.contact.read',
    operation: 'GET_CONTACT',
    scope: 'analysis.client-prep',
    entity_ref: { entity_type: 'contact', stable_id: 'contact:synthetic-001' },
    payload: {},
    effect_budget: {},
  });
  assert.equal(report.status, 'COMPLETED');
  assert.equal(report.writes_attempted, 'NONE');
  assert.equal(report.output.data.id, 90001);
  assert.deepEqual(report.effect_counters, {
    external_writes: 0,
    external_messages: 0,
    schedules_created: 0,
    money_moved: 0,
  });
});
