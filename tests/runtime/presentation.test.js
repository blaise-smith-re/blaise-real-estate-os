'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommandCenter, DecisionQueue, RuntimeHoldError } = require('../../runtime');

const NOW = '2026-09-03T12:00:00.000Z';
const complete = {
  returned_count: 6,
  total_count: 6,
  has_more: false,
  capped: false,
  fetch_all: true,
  due_timezone: 'America/Chicago',
};

function item(item_id, category, classification = 'VERIFIED') {
  return {
    item_id,
    category,
    due_at: '2026-09-04T15:00:00-05:00',
    source_metadata: [{
      system: 'fixture',
      record_id: item_id,
      retrieved_at: NOW,
      classification,
    }],
  };
}

test('Command Center refuses incomplete retrieval', () => {
  assert.throws(
    () => buildCommandCenter([], { ...complete, has_more: true }),
    (error) => error instanceof RuntimeHoldError && error.code === 'INCOMPLETE_RETRIEVAL',
  );
});

test('Command Center applies priority order and excludes synthetic artifacts', () => {
  const records = [
    item('pipeline', 'PIPELINE'),
    item('prep', 'PREP'),
    item('promise', 'PROMISE'),
    item('revenue', 'REVENUE'),
    item('risk', 'RISK'),
    item('synthetic-risk', 'RISK', 'SYNTHETIC'),
  ];
  assert.deepEqual(
    buildCommandCenter(records, complete).map((record) => record.item_id),
    ['risk', 'revenue', 'promise', 'prep', 'pipeline'],
  );
});

test('Decision Queue accepts unresolved decisions only and ranks interruption level', () => {
  const queue = new DecisionQueue();
  assert.equal(queue.add({
    record_type: 'EXECUTION_REPORT',
    execution_id: 'exec:queue',
    status: 'WAITING',
    interruption_level: 'QUEUE',
    decision_required: { code: 'WAIT', question: 'Wait?' },
  }), true);
  assert.equal(queue.add({
    record_type: 'EXECUTION_REPORT',
    execution_id: 'exec:urgent',
    status: 'READY FOR BLAISE',
    interruption_level: 'URGENT',
    decision_required: { code: 'DECIDE', question: 'Choose?' },
  }), true);
  assert.equal(queue.add({
    record_type: 'EXECUTION_REPORT',
    execution_id: 'exec:done',
    status: 'COMPLETED',
    interruption_level: 'BACKGROUND',
    decision_required: null,
  }), false);
  assert.deepEqual(queue.list().map((entry) => entry.execution_id), ['exec:urgent', 'exec:queue']);
  assert.equal(queue.list()[0].source_report.includes('presentation-only'), true);
});

test('Decision Queue is memory-only and exposes no persistence method', () => {
  const queue = new DecisionQueue();
  assert.equal(typeof queue.save, 'undefined');
  assert.equal(typeof queue.persist, 'undefined');
});
