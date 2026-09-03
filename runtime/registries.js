'use strict';

const { RuntimeHoldError, ContractError } = require('./errors');
const { scanForCredentialMaterial } = require('./contract');

const PII_KEYS = /^(name|first_?name|last_?name|email|phone|mobile|address|street|ssn|dob|birth_?date)$/i;

function assertNoRegistryPii(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (PII_KEYS.test(key)) {
      throw new ContractError('PII_IN_REGISTRY', `PII field is not allowed in runtime registries at ${childPath}`);
    }
    assertNoRegistryPii(child, childPath);
  }
}

function validateRegistryBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    throw new ContractError('INVALID_REGISTRY', 'registry bundle must be an object');
  }
  for (const field of ['authority_rules', 'capabilities', 'entities']) {
    if (!Array.isArray(bundle[field])) {
      throw new ContractError('INVALID_REGISTRY', `${field} must be an array`);
    }
  }
  scanForCredentialMaterial(bundle);
  assertNoRegistryPii(bundle);
  return bundle;
}

function scopeMatches(ruleScope, requestedScope) {
  if (ruleScope === '*') return true;
  if (Array.isArray(ruleScope)) return ruleScope.includes(requestedScope);
  return ruleScope === requestedScope;
}

function resolveAuthority(event, rules) {
  const matches = rules.filter((rule) =>
    rule.active === true &&
    rule.phase2_enabled === true &&
    rule.authority_key === event.authority_key &&
    rule.action_class === event.action_class &&
    scopeMatches(rule.scope, event.scope));

  if (matches.length !== 1) {
    throw new RuntimeHoldError(
      'AUTHORITY_NOT_EXACT',
      matches.length === 0
        ? 'No active Phase 2 authority rule permits this exact read'
        : 'More than one active authority rule matched; registry ambiguity must be resolved',
      { authority_key: event.authority_key, scope: event.scope, match_count: matches.length },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  return matches[0];
}

function resolveEntity(entityRef, entities) {
  if (!entityRef) return null;
  if (Array.isArray(entityRef.candidate_ids) && entityRef.candidate_ids.length !== 1) {
    throw new RuntimeHoldError(
      'ENTITY_AMBIGUOUS',
      'Entity resolution requires exactly one stable identifier',
      { candidate_count: entityRef.candidate_ids.length },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  const stableId = entityRef.stable_id || (entityRef.candidate_ids || [])[0];
  if (!stableId || !entityRef.entity_type) {
    throw new RuntimeHoldError('ENTITY_ID_REQUIRED', 'entity_type and one stable_id are required');
  }
  const matches = entities.filter((entity) => {
    const externalIds = Object.values(entity.external_ids || {});
    return entity.active === true &&
      entity.entity_type === entityRef.entity_type &&
      (entity.internal_id === stableId || externalIds.includes(stableId));
  });
  if (matches.length !== 1) {
    throw new RuntimeHoldError(
      matches.length ? 'ENTITY_AMBIGUOUS' : 'ENTITY_NOT_FOUND',
      matches.length ? 'Stable identifier resolves to multiple active entities' : 'Stable identifier was not found',
      { entity_type: entityRef.entity_type, stable_id: stableId, match_count: matches.length },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  return matches[0];
}

async function selectCapability(event, capabilities, adapters) {
  const eligible = capabilities
    .filter((capability) =>
      capability.active === true &&
      capability.phase2_enabled === true &&
      capability.certification_status === 'CERTIFIED' &&
      capability.mode === 'READ' &&
      capability.capability_key === event.capability_key &&
      capability.operation === event.operation)
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));

  for (const capability of eligible) {
    const adapter = adapters[capability.adapter];
    if (!adapter || typeof adapter.performRead !== 'function') continue;
    const available = typeof adapter.isAvailable === 'function'
      ? await adapter.isAvailable(capability)
      : true;
    if (available) return { capability, adapter };
  }

  throw new RuntimeHoldError(
    'CAPABILITY_UNAVAILABLE',
    'No certified, Phase 2-enabled, currently available read lane matched the request',
    { capability_key: event.capability_key, operation: event.operation, eligible_count: eligible.length },
    { status: 'WAITING', interruptionLevel: 'QUEUE' },
  );
}

module.exports = {
  assertNoRegistryPii,
  validateRegistryBundle,
  resolveAuthority,
  resolveEntity,
  selectCapability,
};
