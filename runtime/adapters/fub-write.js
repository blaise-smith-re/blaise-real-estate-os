'use strict';

const crypto = require('crypto');
const {
  ZERO_EFFECTS,
  assertEffectsWithinBudget,
  scanForCredentialMaterial,
} = require('../contract');
const { RuntimeHoldError, ContractError } = require('../errors');
const { unwrapToolResult } = require('./fub-read');

const DEFAULT_WRITE_TOOL_PREFIX = 'mcp__blaise_fub_full__';

const WRITE_OPERATIONS = Object.freeze({
  CREATE_CONTACT_NOTE: {
    tool: 'create_contact_note', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'subject', 'body'],
  },
  CREATE_CONTACT_TASK: {
    tool: 'create_contact_task', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'assigned_user_id', 'name', 'task_type', 'due_date', 'due_date_time', 'remind_seconds_before'],
  },
  UPDATE_CONTACT_TASK: {
    tool: 'update_contact_task', personField: 'expected_person_id', maxWrites: 1,
    args: ['task_id', 'expected_person_id', 'expected_task_name', 'new_name', 'new_task_type', 'new_due_date', 'new_due_date_time', 'mark_completed'],
  },
  UPDATE_CONTACT_PROFILE: {
    tool: 'update_contact_profile', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'new_first_name', 'new_last_name', 'existing_stage_name', 'price', 'timeframe_id', 'assigned_user_id', 'assigned_lender_id', 'assigned_lender_name', 'background', 'custom_fields'],
  },
  REPLACE_CONTACT_CHANNELS: {
    tool: 'replace_contact_channels', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'expected_current_emails', 'expected_current_phones', 'new_emails', 'new_phones', 'confirm_full_replacement'],
  },
  MERGE_CONTACT_TAGS: {
    tool: 'merge_contact_tags', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'tags_to_add', 'brent_approval_confirmed'],
  },
  CREATE_CONTACT_APPOINTMENT: {
    tool: 'create_contact_appointment', personField: 'person_id', maxWrites: 1, maxSchedules: 1,
    args: ['person_id', 'expected_contact_name', 'assigned_user_id', 'title', 'start', 'end', 'location', 'description', 'type_id', 'send_invitation', 'explicit_send_authorization'],
  },
  UPDATE_CONTACT_APPOINTMENT: {
    tool: 'update_contact_appointment', personField: 'expected_person_id', maxWrites: 1,
    args: ['appointment_id', 'expected_person_id', 'expected_title', 'new_title', 'new_start', 'new_end', 'new_location', 'new_description', 'new_type_id', 'new_outcome_id', 'send_invitation', 'explicit_send_authorization'],
  },
  CREATE_CONTACT_DEAL: {
    tool: 'create_contact_deal', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'user_ids', 'deal_name', 'stage_id', 'description', 'price', 'projected_close_date', 'mutual_acceptance_date', 'earnest_money_due_date', 'due_diligence_date', 'final_walk_through_date', 'possession_date', 'custom_fields'],
  },
  UPDATE_CONTACT_DEAL: {
    tool: 'update_contact_deal', personField: 'expected_person_id', maxWrites: 1,
    args: ['deal_id', 'expected_deal_name', 'expected_person_id', 'new_name', 'stage_id', 'description', 'price', 'projected_close_date', 'mutual_acceptance_date', 'earnest_money_due_date', 'due_diligence_date', 'final_walk_through_date', 'possession_date', 'custom_fields'],
  },
  LOG_EXTERNAL_CALL_RECORD: {
    tool: 'log_external_call_record', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'phone', 'is_incoming', 'duration_seconds', 'outcome', 'note'],
  },
  LOG_EXTERNAL_TEXT_RECORD: {
    tool: 'log_external_text_record', personField: 'person_id', maxWrites: 1,
    args: ['person_id', 'expected_contact_name', 'message', 'to_number', 'from_number', 'is_incoming', 'external_label'],
  },
  CLOSE_OUT_CONTACT_INTERACTION: {
    tool: 'close_out_contact_interaction', personField: 'person_id', maxWrites: 2,
    args: ['person_id', 'expected_contact_name', 'expected_assigned_user_id', 'note_subject', 'note_body', 'create_next_task', 'next_task_name', 'next_task_type', 'next_task_due_date', 'next_task_due_date_time', 'next_task_remind_seconds_before'],
  },
});

const ALL_WRITE_OPERATIONS = Object.freeze(Object.keys(WRITE_OPERATIONS));

function positiveInteger(value, field) {
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

function fingerprint(tool, args) {
  return crypto.createHash('sha256').update(`${tool}:${canonicalJson(args)}`).digest('hex').slice(0, 16);
}

function availabilityChecker(availableTools) {
  if (typeof availableTools === 'function') return availableTools;
  const names = new Set(availableTools || []);
  return async (toolName) => names.has(toolName);
}

function toolNameFor(spec, prefix, names) {
  return (names && names[spec.tool]) || `${prefix}${spec.tool}`;
}

function bindContact(args, context, spec) {
  const externalId = context.entity && context.entity.external_ids && context.entity.external_ids.fub;
  if (externalId === undefined || externalId === null) {
    throw new RuntimeHoldError(
      'FUB_ENTITY_ID_REQUIRED',
      'An internal FUB write requires one registry-resolved contact identifier',
      {},
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  const personId = positiveInteger(externalId, 'entity.external_ids.fub');
  if (args[spec.personField] !== undefined && positiveInteger(args[spec.personField], spec.personField) !== personId) {
    throw new RuntimeHoldError(
      'FUB_ENTITY_ID_MISMATCH',
      `Requested ${spec.personField} does not match the resolved contact`,
      {},
      { status: 'READY FOR BLAISE', interruptionLevel: 'ATTENTION' },
    );
  }
  return { ...args, [spec.personField]: personId };
}

function validateArgs(spec, args) {
  const allowed = new Set(spec.args);
  const rejected = Object.keys(args).filter((key) => !allowed.has(key));
  if (rejected.length) {
    throw new ContractError('FUB_ARGUMENT_REJECTED', `Unsupported argument(s) for ${spec.tool}: ${rejected.join(', ')}`);
  }
  if (args.send_invitation === true || args.explicit_send_authorization === true) {
    throw new ContractError(
      'EXTERNAL_APPROVAL_BOUNDARY',
      'INTERNAL_WRITE cannot send an appointment invitation; review and authorize that outward action separately',
    );
  }
}

function effectsFor(spec, raw) {
  let writes = 0;
  if (spec.tool === 'close_out_contact_interaction') {
    const ids = raw && raw.created_object_ids;
    if (ids && ids.note_outcome === 'created') writes += 1;
    if (ids && ids.task_outcome === 'created') writes += 1;
  } else {
    const status = String((raw && raw.status) || '');
    if (status.startsWith('WRITE_COMPLETED')) writes = 1;
  }
  return {
    ...ZERO_EFFECTS,
    external_writes: writes,
    schedules_created: spec.maxSchedules && writes > 0 ? 1 : 0,
  };
}

function responseNeedsAttention(raw) {
  const status = String((raw && raw.status) || '');
  return status.includes('UNVERIFIED') ||
    status.includes('MISMATCH') ||
    status.includes('WITH_HOLD') ||
    status === 'WRITE_FAILED' ||
    (Array.isArray(raw && raw.unresolved) && raw.unresolved.length > 0);
}

function resultRecordId(spec, raw, args) {
  const candidates = [
    raw && raw.created && raw.created.id,
    raw && raw.verified && raw.verified.id,
    raw && raw.after && raw.after.id,
    raw && raw.created_object_ids && raw.created_object_ids.note_id,
    raw && raw.created_object_ids && raw.created_object_ids.task_id,
  ];
  const id = candidates.find((value) => value !== undefined && value !== null);
  return id === undefined
    ? `${spec.tool}:request:${fingerprint(spec.tool, args)}`
    : `${spec.tool}:${id}`;
}

class FubWriteAdapter {
  constructor({
    invokeTool,
    availableTools = [],
    toolPrefix = DEFAULT_WRITE_TOOL_PREFIX,
    toolNames = {},
    allowedOperations = ALL_WRITE_OPERATIONS,
    clock = () => new Date().toISOString(),
  } = {}) {
    if (typeof invokeTool !== 'function') {
      throw new ContractError('FUB_TOOL_INVOKER_REQUIRED', 'FubWriteAdapter requires an injected invokeTool function');
    }
    this.invokeTool = invokeTool;
    this.isToolAvailable = availabilityChecker(availableTools);
    this.toolPrefix = toolPrefix;
    this.toolNames = { ...toolNames };
    this.allowedOperations = new Set(allowedOperations);
    this.clock = clock;
  }

  async isAvailable(capability) {
    const spec = WRITE_OPERATIONS[capability.operation];
    return Boolean(spec && this.allowedOperations.has(capability.operation) &&
      await this.isToolAvailable(toolNameFor(spec, this.toolPrefix, this.toolNames)));
  }

  async performWrite(context) {
    const operation = context && context.capability && context.capability.operation;
    const spec = WRITE_OPERATIONS[operation];
    if (!spec || !this.allowedOperations.has(operation)) {
      throw new ContractError('FUB_OPERATION_NOT_ALLOWED', `Operation is not in the FUB internal-write allowlist: ${operation || 'missing'}`);
    }
    if (!context.execution_constraints || context.execution_constraints.mode !== 'INTERNAL_WRITE') {
      throw new ContractError('INTERNAL_WRITE_ONLY', 'FUB write adapter accepts INTERNAL_WRITE constraints only');
    }

    const rawArgs = context.untrusted_data && typeof context.untrusted_data === 'object'
      ? structuredClone(context.untrusted_data)
      : {};
    scanForCredentialMaterial(rawArgs);
    validateArgs(spec, rawArgs);
    const args = bindContact(rawArgs, context, spec);
    if (spec.tool.includes('appointment')) {
      args.send_invitation = false;
      args.explicit_send_authorization = false;
    }
    args.execute = true;

    assertEffectsWithinBudget({
      ...ZERO_EFFECTS,
      external_writes: spec.maxWrites || 1,
      schedules_created: spec.maxSchedules || 0,
    }, context.execution_constraints.effect_budget, 'maximum operation effects');

    const toolName = toolNameFor(spec, this.toolPrefix, this.toolNames);
    if (!(await this.isToolAvailable(toolName))) {
      throw new RuntimeHoldError('FUB_WRITE_TOOL_UNAVAILABLE', `Required FUB write tool is unavailable: ${spec.tool}`);
    }

    const response = await this.invokeTool(toolName, structuredClone(args));
    const raw = unwrapToolResult(response);
    if (!raw || typeof raw !== 'object') {
      throw new RuntimeHoldError('FUB_INVALID_RESPONSE', 'FUB write tool returned no structured result');
    }
    scanForCredentialMaterial(raw);
    const effects = effectsFor(spec, raw);
    assertEffectsWithinBudget(effects, context.execution_constraints.effect_budget);
    const needsAttention = responseNeedsAttention(raw);

    return {
      output: {
        data: raw,
        adapter_evidence: {
          provider: 'Follow Up Boss',
          tool: spec.tool,
          operation,
          internal_write: true,
          exact_contact_binding: true,
          execute_forced: true,
          external_communication_disabled: true,
        },
      },
      effects,
      source_metadata: [{
        system: 'Follow Up Boss',
        record_id: resultRecordId(spec, raw, args),
        retrieved_at: this.clock(),
        classification: String(raw.status || '').includes('AND_RE_READ') && !needsAttention ? 'VERIFIED' : 'REPORTED',
      }],
      report_status: needsAttention ? 'READY FOR BLAISE' : 'COMPLETED',
      interruption_level: needsAttention ? 'ATTENTION' : 'BACKGROUND',
      decision_required: needsAttention ? {
        code: 'FUB_WRITE_RECONCILIATION_REQUIRED',
        question: 'FUB reports that the internal update needs reconciliation',
        details: { status: raw.status, unresolved: raw.unresolved || [] },
      } : null,
    };
  }
}

module.exports = {
  FubWriteAdapter,
  WRITE_OPERATIONS,
  ALL_WRITE_OPERATIONS,
  DEFAULT_WRITE_TOOL_PREFIX,
  effectsFor,
};
