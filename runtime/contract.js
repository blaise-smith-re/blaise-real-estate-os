'use strict';

const { ContractError } = require('./errors');

const SCHEMA_VERSION = 'os.execution.v1';
const STATES = Object.freeze([
  'READY',
  'EXECUTING',
  'WAITING',
  'READY FOR BLAISE',
  'COMPLETED',
  'FAILED/EXCEPTION',
]);
const INTERRUPTION_LEVELS = Object.freeze(['BACKGROUND', 'QUEUE', 'ATTENTION', 'URGENT']);
const SOURCE_CLASSIFICATIONS = Object.freeze(['VERIFIED', 'REPORTED', 'INFERRED', 'SYNTHETIC']);
const ZERO_EFFECTS = Object.freeze({
  external_writes: 0,
  external_messages: 0,
  schedules_created: 0,
  money_moved: 0,
});
const CREDENTIAL_KEYS = /^(password|passcode|secret|token|access_token|refresh_token|api_?key|private_?key|credential)$/i;

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractError('INVALID_CONTRACT', `${field} must be a non-empty string`);
  }
}

function validateIsoDate(value, field) {
  requireString(value, field);
  if (Number.isNaN(Date.parse(value))) {
    throw new ContractError('INVALID_CONTRACT', `${field} must be ISO-8601 compatible`);
  }
}

function scanForCredentialMaterial(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (CREDENTIAL_KEYS.test(key)) {
      throw new ContractError('CREDENTIAL_MATERIAL_REJECTED', `credential field is not allowed at ${childPath}`);
    }
    scanForCredentialMaterial(child, childPath);
  }
}

function normalizeEffects(effects = {}) {
  const normalized = Object.fromEntries(Object.keys(ZERO_EFFECTS).map((key) => [key, Number(effects[key] || 0)]));
  const invalid = Object.entries(normalized).filter(([, value]) =>
    !Number.isSafeInteger(value) || value < 0);
  if (invalid.length) {
    throw new ContractError(
      'INVALID_EFFECT_COUNTER',
      'effect values must be non-negative safe integers',
      { invalid: Object.fromEntries(invalid) },
    );
  }
  return normalized;
}

function assertZeroEffects(effects, field = 'effect_budget') {
  const normalized = normalizeEffects(effects);
  const nonzero = Object.entries(normalized).filter(([, value]) => value !== 0);
  if (nonzero.length) {
    throw new ContractError(
      'READ_ONLY_EFFECT_VIOLATION',
      `${field} must be zero for every external-effect class`,
      { nonzero: Object.fromEntries(nonzero) },
    );
  }
  return normalized;
}

function assertEffectsWithinBudget(effects, budget, field = 'adapter effects') {
  const normalizedEffects = normalizeEffects(effects);
  const normalizedBudget = normalizeEffects(budget);
  const exceeded = Object.keys(ZERO_EFFECTS)
    .filter((key) => normalizedEffects[key] > normalizedBudget[key])
    .map((key) => [key, { actual: normalizedEffects[key], budget: normalizedBudget[key] }]);
  if (exceeded.length) {
    throw new ContractError(
      'EFFECT_BUDGET_EXCEEDED',
      `${field} exceeded the validated event budget`,
      { exceeded: Object.fromEntries(exceeded) },
    );
  }
  return normalizedEffects;
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new ContractError('INVALID_CONTRACT', 'event must be an object');
  }
  if (event.schema_version !== SCHEMA_VERSION) {
    throw new ContractError('INVALID_CONTRACT', `schema_version must equal ${SCHEMA_VERSION}`);
  }
  if (event.record_type !== 'EVENT') {
    throw new ContractError('INVALID_CONTRACT', 'record_type must equal EVENT');
  }
  requireString(event.event_id, 'event_id');
  validateIsoDate(event.requested_at, 'requested_at');
  requireString(event.objective, 'objective');
  requireString(event.authority_key, 'authority_key');
  requireString(event.capability_key, 'capability_key');
  requireString(event.operation, 'operation');
  requireString(event.scope, 'scope');
  if (event.trigger !== 'MANUAL') {
    throw new ContractError('UNATTENDED_EXECUTION_PROHIBITED', 'trigger must equal MANUAL');
  }
  const isRead = event.mode === 'READ_ONLY' && event.action_class === 'READ';
  const isInternalWrite = event.mode === 'INTERNAL_WRITE' && event.action_class === 'WRITE_INTERNAL';
  if (!isRead && !isInternalWrite) {
    throw new ContractError(
      'UNSUPPORTED_EXECUTION_MODE',
      'supported mode/action_class pairs are READ_ONLY/READ and INTERNAL_WRITE/WRITE_INTERNAL',
    );
  }
  if (isRead) {
    assertZeroEffects(event.effect_budget);
  } else {
    const budget = normalizeEffects(event.effect_budget);
    if (budget.external_messages !== 0 || budget.money_moved !== 0) {
      throw new ContractError(
        'EXTERNAL_APPROVAL_BOUNDARY',
        'INTERNAL_WRITE cannot authorize external messages or money movement',
      );
    }
    if (budget.external_writes > 2 || budget.schedules_created > 1) {
      throw new ContractError(
        'INTERNAL_WRITE_BUDGET_TOO_LARGE',
        'one internal-write event may authorize at most two FUB writes and one appointment record',
      );
    }
  }
  scanForCredentialMaterial(event);
  return event;
}

function validateSourceMetadata(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ContractError('SOURCE_EVIDENCE_REQUIRED', 'at least one source_metadata item is required');
  }
  for (const [index, item] of items.entries()) {
    requireString(item.system, `source_metadata[${index}].system`);
    requireString(item.record_id, `source_metadata[${index}].record_id`);
    validateIsoDate(item.retrieved_at, `source_metadata[${index}].retrieved_at`);
    if (!SOURCE_CLASSIFICATIONS.includes(item.classification)) {
      throw new ContractError(
        'INVALID_SOURCE_CLASSIFICATION',
        `source_metadata[${index}].classification must be one of ${SOURCE_CLASSIFICATIONS.join(', ')}`,
      );
    }
  }
  return items;
}

module.exports = {
  SCHEMA_VERSION,
  STATES,
  INTERRUPTION_LEVELS,
  SOURCE_CLASSIFICATIONS,
  ZERO_EFFECTS,
  assertEffectsWithinBudget,
  assertZeroEffects,
  normalizeEffects,
  scanForCredentialMaterial,
  validateEvent,
  validateSourceMetadata,
};
