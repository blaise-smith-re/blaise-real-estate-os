'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FubWriteAdapter } = require('../../runtime/adapters/fub-write');

const NOW = '2026-09-03T12:00:00.000Z';
const PREFIX = 'mcp__blaise_fub_full__';

function entity(personId = 90001) {
  return { internal_id: 'contact:synthetic-001', entity_type: 'contact', external_ids: { fub: personId } };
}

function context(operation, payload = {}, effectBudget = { external_writes: 1 }, target = entity()) {
  return {
    untrusted_data: payload,
    execution_constraints: {
      mode: 'INTERNAL_WRITE', trigger: 'MANUAL',
      effect_budget: { external_writes: 0, external_messages: 0, schedules_created: 0, money_moved: 0, ...effectBudget },
    },
    capability: { provider: 'fub', operation },
    entity: target,
  };
}

function available(operation) {
  const names = {
    CREATE_CONTACT_NOTE: 'create_contact_note',
    CREATE_CONTACT_APPOINTMENT: 'create_contact_appointment',
    CLOSE_OUT_CONTACT_INTERACTION: 'close_out_contact_interaction',
  };
  return [`${PREFIX}${names[operation]}`];
}

test('write adapter binds the exact contact and forces live execution', async () => {
  const calls = [];
  const adapter = new FubWriteAdapter({
    availableTools: available('CREATE_CONTACT_NOTE'),
    invokeTool: async (name, args) => {
      calls.push({ name, args });
      return { status: 'WRITE_COMPLETED_AND_RE_READ', created: { id: 70001 }, verified: { id: 70001 } };
    },
    clock: () => NOW,
  });
  const result = await adapter.performWrite(context('CREATE_CONTACT_NOTE', {
    expected_contact_name: 'Synthetic Buyer', subject: 'Call summary', body: 'Discussed timing.',
  }));
  assert.deepEqual(calls, [{
    name: `${PREFIX}create_contact_note`,
    args: {
      person_id: 90001,
      expected_contact_name: 'Synthetic Buyer',
      subject: 'Call summary',
      body: 'Discussed timing.',
      execute: true,
    },
  }]);
  assert.equal(result.effects.external_writes, 1);
  assert.equal(result.source_metadata[0].classification, 'VERIFIED');
  assert.equal(result.report_status, 'COMPLETED');
});

test('write adapter rejects contact mismatches, credentials, and caller-controlled execute', async () => {
  let invoked = false;
  const adapter = new FubWriteAdapter({
    availableTools: available('CREATE_CONTACT_NOTE'),
    invokeTool: async () => { invoked = true; return {}; },
  });
  await assert.rejects(
    adapter.performWrite(context('CREATE_CONTACT_NOTE', {
      person_id: 90002, expected_contact_name: 'Wrong', subject: 'x', body: 'y',
    })),
    (error) => error.code === 'FUB_ENTITY_ID_MISMATCH',
  );
  await assert.rejects(
    adapter.performWrite(context('CREATE_CONTACT_NOTE', {
      expected_contact_name: 'Synthetic Buyer', subject: 'x', body: 'y', api_key: 'nope',
    })),
    (error) => error.code === 'CREDENTIAL_MATERIAL_REJECTED',
  );
  await assert.rejects(
    adapter.performWrite(context('CREATE_CONTACT_NOTE', {
      expected_contact_name: 'Synthetic Buyer', subject: 'x', body: 'y', execute: false,
    })),
    (error) => error.code === 'FUB_ARGUMENT_REJECTED',
  );
  assert.equal(invoked, false);
});

test('appointment records are created without sending invitations', async () => {
  const calls = [];
  const adapter = new FubWriteAdapter({
    availableTools: available('CREATE_CONTACT_APPOINTMENT'),
    invokeTool: async (_name, args) => {
      calls.push(args);
      return { status: 'WRITE_COMPLETED_AND_RE_READ', created: { id: 80001 }, verified: { id: 80001 } };
    },
    clock: () => NOW,
  });
  const payload = {
    expected_contact_name: 'Synthetic Buyer', assigned_user_id: 60001,
    title: 'Buyer consultation', start: '2026-09-04T10:00:00-05:00', end: '2026-09-04T11:00:00-05:00',
  };
  const result = await adapter.performWrite(context(
    'CREATE_CONTACT_APPOINTMENT', payload,
    { external_writes: 1, schedules_created: 1 },
  ));
  assert.equal(calls[0].send_invitation, false);
  assert.equal(calls[0].explicit_send_authorization, false);
  assert.equal(result.effects.schedules_created, 1);

  await assert.rejects(
    adapter.performWrite(context(
      'CREATE_CONTACT_APPOINTMENT', { ...payload, send_invitation: true },
      { external_writes: 1, schedules_created: 1 },
    )),
    (error) => error.code === 'EXTERNAL_APPROVAL_BOUNDARY',
  );
});

test('an idempotent duplicate reports no write', async () => {
  const adapter = new FubWriteAdapter({
    availableTools: available('CREATE_CONTACT_NOTE'),
    invokeTool: async () => ({ status: 'SKIPPED_EXACT_DUPLICATE_EXISTS', existing_note: { id: 70001 } }),
    clock: () => NOW,
  });
  const result = await adapter.performWrite(context('CREATE_CONTACT_NOTE', {
    expected_contact_name: 'Synthetic Buyer', subject: 'Call summary', body: 'Discussed timing.',
  }));
  assert.equal(result.effects.external_writes, 0);
  assert.equal(result.report_status, 'COMPLETED');
});

test('interaction closeout accurately counts note and task writes', async () => {
  const adapter = new FubWriteAdapter({
    availableTools: available('CLOSE_OUT_CONTACT_INTERACTION'),
    invokeTool: async () => ({
      status: 'CLOSEOUT_COMPLETED',
      created_object_ids: { note_id: 70001, note_outcome: 'created', task_id: 70002, task_outcome: 'created' },
      unresolved: [],
    }),
    clock: () => NOW,
  });
  const result = await adapter.performWrite(context('CLOSE_OUT_CONTACT_INTERACTION', {
    expected_contact_name: 'Synthetic Buyer', expected_assigned_user_id: 60001,
    note_subject: 'Showing', note_body: 'Liked the kitchen.', create_next_task: true,
    next_task_name: 'Call to review offer strategy', next_task_type: 'Call', next_task_due_date: '2026-09-05',
  }, { external_writes: 2 }));
  assert.equal(result.effects.external_writes, 2);
});

test('partial write reconciliation preserves effects and asks for attention', async () => {
  const adapter = new FubWriteAdapter({
    availableTools: available('CREATE_CONTACT_NOTE'),
    invokeTool: async () => ({ status: 'WRITE_COMPLETED_UNVERIFIED', created: { id: 70001 }, hold: 'Read-back failed' }),
    clock: () => NOW,
  });
  const result = await adapter.performWrite(context('CREATE_CONTACT_NOTE', {
    expected_contact_name: 'Synthetic Buyer', subject: 'Call summary', body: 'Discussed timing.',
  }));
  assert.equal(result.effects.external_writes, 1);
  assert.equal(result.report_status, 'READY FOR BLAISE');
  assert.equal(result.decision_required.code, 'FUB_WRITE_RECONCILIATION_REQUIRED');
});

test('unavailable write tool stops before invocation', async () => {
  let invoked = false;
  const adapter = new FubWriteAdapter({ availableTools: [], invokeTool: async () => { invoked = true; } });
  await assert.rejects(
    adapter.performWrite(context('CREATE_CONTACT_NOTE', {
      expected_contact_name: 'Synthetic Buyer', subject: 'x', body: 'y',
    })),
    (error) => error.code === 'FUB_WRITE_TOOL_UNAVAILABLE',
  );
  assert.equal(invoked, false);
});
