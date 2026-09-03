'use strict';

const crypto = require('crypto');
const { ZERO_EFFECTS, scanForCredentialMaterial } = require('../contract');
const { RuntimeHoldError, ContractError } = require('../errors');

const DEFAULT_TOOL_PREFIX = 'mcp__Blaise_FUB__';
const CHICAGO_TIMEZONE = 'America/Chicago';

const READ_OPERATIONS = Object.freeze({
  FIND_CONTACT: { tool: 'find_contact', classification: 'REPORTED' },
  GET_CONTACT: { tool: 'get_contact', entityKey: 'fub', idField: 'person_id', resultId: 'id' },
  GET_CONTACT_EVENTS: { tool: 'get_contact_events', entityKey: 'fub', idField: 'person_id' },
  GET_CONTACT_NOTES: { tool: 'get_contact_notes', entityKey: 'fub', idField: 'person_id' },
  GET_CONTACT_CALLS: { tool: 'get_contact_calls', entityKey: 'fub', idField: 'person_id' },
  GET_CONTACT_TEXT_MESSAGES: { tool: 'get_contact_text_messages', entityKey: 'fub', idField: 'person_id' },
  SEARCH_TASKS: { tool: 'search_tasks', complete: true },
  GET_OPEN_TASKS: { tool: 'get_open_tasks', entityKey: 'fub', idField: 'person_id', complete: true },
  GET_TASK: { tool: 'get_task', entityKey: 'fub_task', idField: 'task_id', resultId: 'id' },
  GET_CONTACT_APPOINTMENTS: { tool: 'get_contact_appointments', entityKey: 'fub', idField: 'person_id' },
  GET_APPOINTMENT: { tool: 'get_appointment', entityKey: 'fub_appointment', idField: 'appointment_id', resultId: 'id' },
  GET_ACTIVE_DEALS: { tool: 'get_active_deals', entityKey: 'fub', idField: 'person_id' },
  SEARCH_DEALS: { tool: 'search_deals' },
  GET_DEAL: { tool: 'get_deal', entityKey: 'fub_deal', idField: 'deal_id', resultId: 'id' },
  GET_STAGES: { tool: 'get_stages' },
  GET_USERS: { tool: 'get_users' },
  GET_USER: { tool: 'get_user', entityKey: 'fub_user', idField: 'user_id', resultId: 'id' },
  GET_TIMEFRAMES: { tool: 'get_timeframes' },
  GET_CUSTOM_FIELDS: { tool: 'get_custom_fields' },
  GET_DEAL_CUSTOM_FIELDS: { tool: 'get_deal_custom_fields' },
  GET_PIPELINES: { tool: 'get_pipelines' },
  GET_APPOINTMENT_TYPES: { tool: 'get_appointment_types' },
  GET_APPOINTMENT_OUTCOMES: { tool: 'get_appointment_outcomes' },
  AUDIT_CONTACT_DAILY_CONTROL: { tool: 'audit_contact_daily_control', entityKey: 'fub', idField: 'person_id' },
  AUDIT_CONTACTS_DAILY_CONTROL_BATCH: { tool: 'audit_contacts_daily_control_batch' },
});

const PILOT_OPERATIONS = Object.freeze([
  'GET_CONTACT',
  'GET_CONTACT_EVENTS',
  'GET_CONTACT_NOTES',
  'GET_CONTACT_APPOINTMENTS',
  'SEARCH_TASKS',
  'GET_OPEN_TASKS',
]);

const WRITE_TOOL_SUFFIXES = Object.freeze([
  'create_contact_note',
  'create_contact_task',
  'close_out_contact_interaction',
  'create_contact_appointment',
  'update_contact_appointment',
  'create_contact_deal',
  'update_contact_deal',
  'update_contact_profile',
  'update_contact_task',
  'replace_contact_channels',
  'merge_contact_tags',
  'log_external_call_record',
  'log_external_text_record',
]);

const ALLOWED_ARGUMENTS = Object.freeze({
  find_contact: ['email', 'phone', 'name', 'stage', 'assigned_user_id', 'limit'],
  get_contact: ['person_id'],
  get_contact_events: ['person_id', 'limit', 'next_token'],
  get_contact_notes: ['person_id', 'limit', 'offset'],
  get_contact_calls: ['person_id', 'limit', 'offset'],
  get_contact_text_messages: ['person_id'],
  search_tasks: [
    'person_id', 'assigned_user_id', 'task_type', 'is_completed',
    'due', 'due_on', 'due_from', 'due_to', 'due_timezone', 'limit', 'offset', 'fetch_all',
  ],
  get_open_tasks: ['person_id'],
  get_task: ['task_id'],
  get_contact_appointments: ['person_id', 'limit', 'offset'],
  get_appointment: ['appointment_id'],
  get_active_deals: ['person_id'],
  search_deals: ['person_id', 'user_id', 'status'],
  get_deal: ['deal_id'],
  get_stages: [],
  get_users: [],
  get_user: ['user_id'],
  get_timeframes: [],
  get_custom_fields: [],
  get_deal_custom_fields: [],
  get_pipelines: [],
  get_appointment_types: [],
  get_appointment_outcomes: [],
  audit_contact_daily_control: [
    'person_id', 'expected_contact_name', 'expected_assigned_user_id', 'stale_note_days',
  ],
  audit_contacts_daily_control_batch: ['contacts', 'stale_note_days'],
});

function asPositiveInteger(value, field) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ContractError('FUB_EXACT_ID_REQUIRED', `${field} must be a positive integer`);
  }
  return parsed;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function queryFingerprint(tool, args) {
  return crypto.createHash('sha256').update(`${tool}:${canonicalJson(args)}`).digest('hex').slice(0, 16);
}

function unwrapToolResult(response) {
  if (response && response.isError === true) {
    throw new RuntimeHoldError('FUB_TOOL_ERROR', 'The FUB read tool returned an error', {}, {
      status: 'WAITING', interruptionLevel: 'QUEUE',
    });
  }
  if (response && response.structuredContent) {
    return response.structuredContent.result ?? response.structuredContent;
  }
  if (response && response.result !== undefined && Array.isArray(response.content)) return response.result;
  return response;
}

function validateAllowedArguments(tool, args) {
  const allowed = new Set(ALLOWED_ARGUMENTS[tool] || []);
  const rejected = Object.keys(args).filter((key) => !allowed.has(key));
  if (rejected.length) {
    throw new ContractError('FUB_ARGUMENT_REJECTED', `Unsupported argument(s) for ${tool}: ${rejected.join(', ')}`);
  }
}

function bindExactEntity(args, context, spec) {
  if (!spec.entityKey) return { ...args };
  const externalId = context.entity && context.entity.external_ids && context.entity.external_ids[spec.entityKey];
  if (externalId === undefined || externalId === null) {
    throw new RuntimeHoldError(
      'FUB_ENTITY_ID_REQUIRED',
      `The resolved entity must carry an exact ${spec.entityKey} stable identifier`,
      { entity_type: context.entity && context.entity.entity_type, external_id_key: spec.entityKey },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  const entityId = asPositiveInteger(externalId, `entity.external_ids.${spec.entityKey}`);
  if (args[spec.idField] !== undefined && asPositiveInteger(args[spec.idField], spec.idField) !== entityId) {
    throw new RuntimeHoldError(
      'FUB_ENTITY_ID_MISMATCH',
      `Requested ${spec.idField} does not match the resolved entity`,
      { id_field: spec.idField },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  return { ...args, [spec.idField]: entityId };
}

function normalizeCompleteness(raw, args) {
  const source = raw && raw._completeness;
  if (!source || typeof source !== 'object') {
    throw new RuntimeHoldError('INCOMPLETE_RETRIEVAL_METADATA', 'FUB did not return completeness metadata');
  }
  const normalized = {
    returned_count: source.returned_count,
    total_count: source.total_count,
    has_more: source.has_more,
    capped: source.capped,
    pages_fetched: source.pages_fetched,
    fetch_all: args.fetch_all === true,
    due_timezone: args.due_timezone || CHICAGO_TIMEZONE,
  };
  const complete = normalized.fetch_all === true &&
    normalized.due_timezone === CHICAGO_TIMEZONE &&
    normalized.has_more === false &&
    normalized.capped === false &&
    Number.isInteger(normalized.returned_count) &&
    Number.isInteger(normalized.total_count) &&
    normalized.returned_count === normalized.total_count;
  if (!complete) {
    throw new RuntimeHoldError(
      'INCOMPLETE_RETRIEVAL',
      'FUB task retrieval is not complete and cannot feed an OS decision',
      { completeness: normalized },
    );
  }
  return normalized;
}

function validateFindContact(args) {
  const selectors = ['email', 'phone', 'name'].filter((field) => typeof args[field] === 'string' && args[field].trim());
  if (selectors.length !== 1) {
    throw new ContractError('FUB_DISCOVERY_SELECTOR_REQUIRED', 'find_contact requires exactly one of email, phone, or name');
  }
}

function validateSearchTasks(args) {
  if (args.due !== undefined) {
    throw new ContractError('FUB_LEGACY_DUE_REJECTED', 'The unreliable legacy due parameter is prohibited');
  }
  if (args.person_id === undefined && args.assigned_user_id === undefined) {
    throw new ContractError('FUB_TASK_OWNER_REQUIRED', 'search_tasks requires an exact person_id or assigned_user_id');
  }
  if (args.due_on === undefined && args.due_from === undefined && args.due_to === undefined) {
    throw new ContractError('FUB_TASK_DATE_BOUND_REQUIRED', 'search_tasks requires an exact or bounded calendar-date filter');
  }
  for (const field of ['due_on', 'due_from', 'due_to']) {
    if (args[field] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args[field])) {
      throw new ContractError('FUB_TASK_DATE_INVALID', `${field} must use YYYY-MM-DD`);
    }
  }
  if (args.due_from && args.due_to && args.due_from > args.due_to) {
    throw new ContractError('FUB_TASK_DATE_RANGE_INVALID', 'due_from cannot be after due_to');
  }
}

function bindTaskSearchIdentity(args, context) {
  const bound = { ...args };
  if (bound.person_id !== undefined) {
    const externalId = context.entity && context.entity.external_ids && context.entity.external_ids.fub;
    if (externalId === undefined || externalId === null) {
      throw new RuntimeHoldError(
        'FUB_ENTITY_ID_REQUIRED',
        'A person-scoped task search requires a registry-resolved FUB contact identifier',
        {},
        { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
      );
    }
    const entityId = asPositiveInteger(externalId, 'entity.external_ids.fub');
    if (asPositiveInteger(bound.person_id, 'person_id') !== entityId) {
      throw new RuntimeHoldError(
        'FUB_ENTITY_ID_MISMATCH',
        'Requested person_id does not match the resolved entity',
        {},
        { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
      );
    }
    bound.person_id = entityId;
  }
  if (bound.assigned_user_id !== undefined) {
    bound.assigned_user_id = asPositiveInteger(bound.assigned_user_id, 'assigned_user_id');
  }
  return bound;
}

function pageScope(raw) {
  const collections = ['events', 'notes', 'calls', 'texts', 'appointments', 'deals', 'people'];
  const key = collections.find((candidate) => Array.isArray(raw[candidate]));
  if (!key) return null;
  const returned = raw[key].length;
  const metadata = raw._metadata || {};
  const total = Number.isInteger(metadata.total) ? metadata.total : null;
  const tokenPresent = Boolean(raw.next_token || metadata.next_token || metadata.next);
  return {
    collection: key,
    returned_count: returned,
    total_count: total,
    has_more: tokenPresent || (total !== null && returned < total),
    scope: 'BOUNDED_SOURCE_WINDOW',
  };
}

function validateStableResultId(raw, spec, args) {
  if (!spec.resultId) return;
  const resultId = raw && raw[spec.resultId];
  if (resultId === undefined || asPositiveInteger(resultId, `result.${spec.resultId}`) !== args[spec.idField]) {
    throw new RuntimeHoldError(
      'FUB_STABLE_ID_MISMATCH',
      'FUB returned a record that does not match the requested stable identifier',
      { id_field: spec.idField },
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
}

function sourceRecordId(spec, args) {
  if (spec.idField && args[spec.idField] !== undefined) return `${spec.tool}:${args[spec.idField]}`;
  return `${spec.tool}:query:${queryFingerprint(spec.tool, args)}`;
}

function resolveToolName(spec, toolPrefix, toolNames) {
  const configured = toolNames && toolNames[spec.tool];
  if (configured) return configured;
  return `${toolPrefix}${spec.tool}`;
}

function makeAvailabilityChecker(availableTools) {
  if (typeof availableTools === 'function') return availableTools;
  const names = new Set(availableTools || []);
  return async (toolName) => names.has(toolName);
}

class FubReadAdapter {
  constructor({
    invokeTool,
    availableTools = [],
    toolPrefix = DEFAULT_TOOL_PREFIX,
    toolNames = {},
    allowedOperations = PILOT_OPERATIONS,
    writeSurfaceVerified = false,
    clock = () => new Date().toISOString(),
  } = {}) {
    if (typeof invokeTool !== 'function') {
      throw new ContractError('FUB_TOOL_INVOKER_REQUIRED', 'FubReadAdapter requires an injected invokeTool function');
    }
    this.invokeTool = invokeTool;
    this.isToolAvailable = makeAvailabilityChecker(availableTools);
    this.toolPrefix = toolPrefix;
    this.toolNames = { ...toolNames };
    this.allowedOperations = new Set(allowedOperations);
    if (typeof availableTools === 'function') {
      this.writeSurfaceVerified = writeSurfaceVerified === true;
      this.writeToolsExposed = [];
    } else {
      const names = [...availableTools];
      this.writeToolsExposed = names.filter((name) => WRITE_TOOL_SUFFIXES.some((suffix) => name.endsWith(suffix)));
      this.writeSurfaceVerified = this.writeToolsExposed.length === 0;
    }
    this.clock = clock;
  }

  async isAvailable(capability) {
    const spec = READ_OPERATIONS[capability.operation];
    if (!spec || !this.allowedOperations.has(capability.operation) || !this.writeSurfaceVerified) return false;
    return Boolean(await this.isToolAvailable(resolveToolName(spec, this.toolPrefix, this.toolNames)));
  }

  async performRead(context) {
    const operation = context && context.capability && context.capability.operation;
    const spec = READ_OPERATIONS[operation];
    if (!spec || !this.allowedOperations.has(operation)) {
      throw new ContractError('FUB_OPERATION_NOT_ALLOWED', `Operation is not in the FUB read allowlist: ${operation || 'missing'}`);
    }
    if (!context.execution_constraints || context.execution_constraints.mode !== 'READ_ONLY') {
      throw new ContractError('READ_ONLY_ONLY', 'FUB adapter accepts READ_ONLY execution constraints only');
    }
    if (!this.writeSurfaceVerified) {
      throw new RuntimeHoldError(
        'FUB_WRITE_SURFACE_EXPOSED',
        'The FUB client surface is not proven read-only',
        { write_tool_count: this.writeToolsExposed.length },
        { status: 'WAITING', interruptionLevel: 'ATTENTION' },
      );
    }

    const rawArgs = context.untrusted_data && typeof context.untrusted_data === 'object'
      ? structuredClone(context.untrusted_data)
      : {};
    scanForCredentialMaterial(rawArgs);
    validateAllowedArguments(spec.tool, rawArgs);
    if (spec.tool === 'find_contact') validateFindContact(rawArgs);
    if (spec.tool === 'search_tasks') validateSearchTasks(rawArgs);

    let args = bindExactEntity(rawArgs, context, spec);
    if (spec.tool === 'search_tasks') {
      args = { ...bindTaskSearchIdentity(args, context), due_timezone: CHICAGO_TIMEZONE, fetch_all: true };
    }
    if (spec.tool === 'get_open_tasks') {
      args = { ...args, due_timezone: CHICAGO_TIMEZONE, fetch_all: true };
    }
    validateAllowedArguments(spec.tool, Object.fromEntries(Object.entries(args).filter(([key]) =>
      !['due_timezone', 'fetch_all'].includes(key) || spec.tool === 'search_tasks')));

    const toolName = resolveToolName(spec, this.toolPrefix, this.toolNames);
    if (WRITE_TOOL_SUFFIXES.some((suffix) => toolName.endsWith(suffix))) {
      throw new ContractError('FUB_WRITE_TOOL_REJECTED', 'A write-capable FUB tool can never be invoked by this adapter');
    }
    if (!(await this.isToolAvailable(toolName))) {
      throw new RuntimeHoldError('FUB_READ_TOOL_UNAVAILABLE', `Required FUB read tool is unavailable: ${spec.tool}`);
    }

    const toolArgs = spec.tool === 'get_open_tasks'
      ? Object.fromEntries(Object.entries(args).filter(([key]) => key === 'person_id'))
      : args;
    const response = await this.invokeTool(toolName, structuredClone(toolArgs));
    const raw = unwrapToolResult(response);
    if (!raw || typeof raw !== 'object') {
      throw new RuntimeHoldError('FUB_INVALID_RESPONSE', 'FUB read tool returned no structured data');
    }
    scanForCredentialMaterial(raw);
    validateStableResultId(raw, spec, args);
    const completeness = spec.complete ? normalizeCompleteness(raw, args) : null;

    return {
      output: {
        data: raw,
        adapter_evidence: {
          provider: 'Follow Up Boss',
          tool: spec.tool,
          operation,
          read_only: true,
          exact_entity_binding: Boolean(spec.entityKey),
          discovery_is_not_identity_proof: spec.tool === 'find_contact',
          completeness,
          page_scope: pageScope(raw),
        },
      },
      effects: { ...ZERO_EFFECTS },
      source_metadata: [{
        system: 'Follow Up Boss',
        record_id: sourceRecordId(spec, args),
        retrieved_at: this.clock(),
        classification: spec.classification || 'VERIFIED',
      }],
    };
  }
}

function inspectFubToolSurface({ availableTools = [], toolPrefix = DEFAULT_TOOL_PREFIX, operations = PILOT_OPERATIONS } = {}) {
  const names = new Set(availableTools);
  const required = operations.map((operation) => {
    const spec = READ_OPERATIONS[operation];
    if (!spec) throw new ContractError('FUB_OPERATION_NOT_ALLOWED', `Unknown certification operation: ${operation}`);
    return `${toolPrefix}${spec.tool}`;
  });
  const writesExposed = WRITE_TOOL_SUFFIXES
    .map((suffix) => `${toolPrefix}${suffix}`)
    .filter((name) => names.has(name));
  return {
    operations: [...operations],
    required_tools: required,
    missing_tools: required.filter((name) => !names.has(name)),
    write_tools_exposed: writesExposed,
    ready: required.every((name) => names.has(name)) && writesExposed.length === 0,
  };
}

module.exports = {
  FubReadAdapter,
  READ_OPERATIONS,
  PILOT_OPERATIONS,
  WRITE_TOOL_SUFFIXES,
  DEFAULT_TOOL_PREFIX,
  CHICAGO_TIMEZONE,
  inspectFubToolSurface,
  normalizeCompleteness,
  unwrapToolResult,
};
