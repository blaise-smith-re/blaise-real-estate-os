'use strict';

const { RuntimeHoldError, ContractError } = require('./errors');
const { validateSourceMetadata } = require('./contract');

const PRIORITY_ORDER = Object.freeze({
  RISK: 1,
  REVENUE: 2,
  PROMISE: 3,
  PREP: 4,
  PIPELINE: 5,
});
const INTERRUPTION_ORDER = Object.freeze({ URGENT: 1, ATTENTION: 2, QUEUE: 3, BACKGROUND: 4 });

function assertCompleteRetrieval(completeness) {
  const required = ['returned_count', 'total_count', 'has_more', 'capped', 'fetch_all', 'due_timezone'];
  const missing = required.filter((field) => completeness == null || completeness[field] === undefined);
  if (missing.length) {
    throw new RuntimeHoldError('INCOMPLETE_RETRIEVAL_METADATA', 'Completeness metadata is missing', { missing });
  }
  const complete = completeness.fetch_all === true &&
    completeness.has_more === false &&
    completeness.capped === false &&
    completeness.returned_count === completeness.total_count;
  if (!complete) {
    throw new RuntimeHoldError(
      'INCOMPLETE_RETRIEVAL',
      'Command Center ranking is blocked until the complete source set is retrieved',
      { completeness },
    );
  }
}

function buildCommandCenter(records, completeness, limit = 8) {
  assertCompleteRetrieval(completeness);
  if (!Array.isArray(records)) throw new ContractError('INVALID_RECORDS', 'records must be an array');
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) {
    throw new ContractError('INVALID_LIMIT', 'limit must be an integer from 1 through 8');
  }

  const eligible = records.filter((record) => {
    if (!(record.category in PRIORITY_ORDER)) {
      throw new ContractError('INVALID_PRIORITY_CATEGORY', `unknown priority category: ${record.category}`);
    }
    validateSourceMetadata(record.source_metadata);
    return !record.source_metadata.some((source) => source.classification === 'SYNTHETIC');
  });

  return eligible
    .sort((a, b) =>
      PRIORITY_ORDER[a.category] - PRIORITY_ORDER[b.category] ||
      Date.parse(a.due_at || '9999-12-31') - Date.parse(b.due_at || '9999-12-31') ||
      String(a.item_id).localeCompare(String(b.item_id)))
    .slice(0, limit)
    .map((record, index) => ({ ...record, rank: index + 1 }));
}

class DecisionQueue {
  constructor() {
    this.items = [];
  }

  add(report) {
    if (!report || report.record_type !== 'EXECUTION_REPORT') {
      throw new ContractError('INVALID_REPORT', 'Decision Queue accepts execution reports only');
    }
    if (!report.decision_required || report.status === 'COMPLETED') return false;
    this.items.push(immutableQueueItem(report));
    return true;
  }

  list() {
    return this.items
      .slice()
      .sort((a, b) => INTERRUPTION_ORDER[a.interruption_level] - INTERRUPTION_ORDER[b.interruption_level]);
  }

  clear(executionId) {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.execution_id !== executionId);
    return before !== this.items.length;
  }
}

function immutableQueueItem(report) {
  return Object.freeze({
    execution_id: report.execution_id,
    status: report.status,
    interruption_level: report.interruption_level,
    decision_required: structuredClone(report.decision_required),
    source_report: 'presentation-only; execution report remains authoritative',
  });
}

module.exports = { PRIORITY_ORDER, assertCompleteRetrieval, buildCommandCenter, DecisionQueue };
