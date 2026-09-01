#!/usr/bin/env node
/**
 * Appointment time reconciliation — reference implementation of `chicago-date-anchor` Rule 3.
 *
 * Exists because a connector-rendered local time has now been wrong three times on live data,
 * most recently by one hour on a real client showing (IF-2026-09-01-019). The absolute instant
 * plus the IANA zone is authoritative; the rendered string is not.
 *
 * Pure, dependency-free, no network, no clock reads. Safe to run in CI.
 *
 *   node scripts/reconcile-appointment-time.js 2026-09-01T14:00:00Z --rendered 2026-09-01T10:00:00-04:00
 */

'use strict';

const BUSINESS_ZONE = 'America/Chicago';
// America/Chicago has exactly two legal offsets. Anything else paired with a Chicago
// label is a connector defect, not a rounding difference.
const VALID_CHICAGO_OFFSETS = ['-06:00', '-05:00'];

/** Offset (in minutes, east-positive) of `zone` at absolute `date`. */
function zoneOffsetMinutes(date, zone) {
  // Format the instant in the target zone, reinterpret those wall-clock fields as UTC,
  // and difference against the true instant. Works on every Node with full-icu.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  // Intl renders midnight as hour 24 in some ICU versions.
  const hour = p.hour === '24' ? '00' : p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Wall-clock parts of `date` in `zone`. */
function partsIn(date, zone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: +hour, minute: +p.minute, second: +p.second,
  };
}

function to12Hour(hour, minute) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Parse the trailing offset of an ISO-8601 string. Returns "+HH:MM" / "-HH:MM", or null. */
function renderedOffsetOf(iso) {
  if (typeof iso !== 'string') return null;
  if (/(Z|z)$/.test(iso.trim())) return '+00:00';
  const m = iso.trim().match(/([+-])(\d{2}):?(\d{2})$/);
  return m ? `${m[1]}${m[2]}:${m[3]}` : null;
}

/**
 * Reconcile an appointment time per Rule 3.
 *
 * @param {object} input
 * @param {string} input.absoluteInstant  Authoritative UTC instant, ISO-8601.
 * @param {string} [input.ianaZone]       Zone the event claims. Defaults to America/Chicago.
 * @param {string} [input.renderedLocal]  Connector-rendered local time, ISO-8601. Never trusted.
 * @param {boolean} [input.confirmingRead] Whether an explicit-timezone list_events read was done.
 */
function reconcile(input) {
  const {
    absoluteInstant, ianaZone = BUSINESS_ZONE,
    renderedLocal = null, confirmingRead = false,
  } = input || {};

  const instant = new Date(absoluteInstant);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`unparseable absolute instant: ${absoluteInstant}`);
  }

  const offsetMin = zoneOffsetMinutes(instant, BUSINESS_ZONE);
  const trueOffset = formatOffset(offsetMin);
  const local = partsIn(instant, BUSINESS_ZONE);
  const abbrev = offsetMin === -300 ? 'CDT' : offsetMin === -360 ? 'CST' : 'UNKNOWN';

  const findings = [];

  // 3b — is the offset even legal for this zone?
  const offsetValidForZone = VALID_CHICAGO_OFFSETS.includes(trueOffset);
  if (!offsetValidForZone) {
    findings.push({
      code: 'ZONE_OFFSET_IMPOSSIBLE',
      detail: `computed offset ${trueOffset} is not a valid ${BUSINESS_ZONE} offset`,
    });
  }

  // 3d — the event claims a zone other than the business zone.
  const zoneMismatch = ianaZone !== BUSINESS_ZONE;
  if (zoneMismatch) {
    findings.push({
      code: 'LANE_ZONE_MISMATCH',
      detail: `event zone "${ianaZone}" is not ${BUSINESS_ZONE}; flagged, not applied`,
    });
  }

  // 3b — the rendered string. Defective if its offset is illegal for Chicago, or legal
  // but disagreeing with the true offset for this date (right shape, wrong DST state).
  let renderedDefective = false;
  const rOffset = renderedOffsetOf(renderedLocal);
  if (rOffset !== null) {
    if (!VALID_CHICAGO_OFFSETS.includes(rOffset)) {
      renderedDefective = true;
      findings.push({
        code: 'RENDERED_OFFSET_INVALID',
        detail: `rendered offset ${rOffset} is never valid for ${BUSINESS_ZONE}; rendered time discarded`,
      });
    } else if (rOffset !== trueOffset) {
      renderedDefective = true;
      findings.push({
        code: 'RENDERED_OFFSET_WRONG_DST',
        detail: `rendered offset ${rOffset} is a valid Chicago offset but wrong for ${local.date} (expected ${trueOffset}); rendered time discarded`,
      });
    }
  }

  // 3a — the confirming read is mandatory.
  if (!confirmingRead) {
    findings.push({
      code: 'CONFIRMING_READ_MISSING',
      detail: 'no explicit-timezone list_events confirmation; time is derived from the absolute instant and must be disclosed as unconfirmed',
    });
  }

  return {
    absoluteInstant: instant.toISOString(),
    businessZone: BUSINESS_ZONE,
    businessDate: local.date,          // 3c — Chicago date, never the UTC date
    localTime: to12Hour(local.hour, local.minute),
    offset: trueOffset,
    abbreviation: abbrev,
    presentable: `${to12Hour(local.hour, local.minute)} ${abbrev}`,
    renderedLocal,
    renderedDefective,
    confirmingRead: Boolean(confirmingRead),
    zoneMismatch,
    offsetValidForZone,
    findings,
    // Safe to present only when nothing is outstanding.
    safeToPresent: findings.length === 0,
  };
}

/** The `TIME RECONCILIATION` disclosure line required by the skill. */
function disclosureLine(r, ref = 'event') {
  const lines = [
    `TIME RECONCILIATION   ${ref} | absolute ${r.absoluteInstant} | zone ${r.businessZone} |`,
    `                      reconciled ${r.presentable} on ${r.businessDate} | ` +
    `confirming list_events read: ${r.confirmingRead ? 'YES' : 'NO'}`,
  ];
  if (r.renderedDefective) {
    lines.push(`                      [RENDERED TIME DEFECTIVE: ${r.renderedLocal} — discarded, offset invalid for Chicago]`);
  }
  for (const f of r.findings.filter(x => !x.code.startsWith('RENDERED_'))) {
    lines.push(`                      [${f.code}: ${f.detail}]`);
  }
  return lines.join('\n');
}

module.exports = {
  reconcile, disclosureLine, zoneOffsetMinutes, formatOffset,
  partsIn, renderedOffsetOf, BUSINESS_ZONE, VALID_CHICAGO_OFFSETS,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const instant = args[0];
  if (!instant) {
    console.error('usage: reconcile-appointment-time.js <absoluteInstantISO> [--zone <IANA>] [--rendered <ISO>] [--confirmed]');
    process.exit(2);
  }
  const zi = args.indexOf('--zone');
  const ri = args.indexOf('--rendered');
  const r = reconcile({
    absoluteInstant: instant,
    ianaZone: zi > -1 ? args[zi + 1] : BUSINESS_ZONE,
    renderedLocal: ri > -1 ? args[ri + 1] : null,
    confirmingRead: args.includes('--confirmed'),
  });
  console.log(disclosureLine(r));
  console.log(`\nsafeToPresent: ${r.safeToPresent}`);
  process.exit(r.safeToPresent ? 0 : 1);
}
