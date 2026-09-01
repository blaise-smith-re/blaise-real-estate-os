#!/usr/bin/env node
/**
 * Timezone edge-case suite for `chicago-date-anchor` Rule 3.
 *
 * Covers the failure that produced IF-2026-09-01-019 (a one-hour error on a live client
 * showing) plus the DST boundaries around it. Expected values were verified against IANA
 * tzdata via Intl before being asserted here.
 *
 *   node tests/run-timezone-tests.js
 */

'use strict';

const path = require('path');
const {
  reconcile, disclosureLine, renderedOffsetOf,
} = require(path.resolve(__dirname, '..', 'scripts', 'reconcile-appointment-time.js'));

const results = [];
let failed = 0;

function check(id, name, fn) {
  try {
    const detail = fn();
    results.push({ id, name, status: 'PASS', detail });
  } catch (e) {
    failed++;
    results.push({ id, name, status: 'FAIL', detail: e.message });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(actual, expected, what) {
  assert(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const codes = r => r.findings.map(f => f.code);

// ------------------------------------------------- the live defect

check('TZ-01', 'IF-019 live defect: -04:00 labeled America/Chicago is discarded, not presented', () => {
  const r = reconcile({
    absoluteInstant: '2026-09-01T14:00:00Z',
    ianaZone: 'America/Chicago',
    renderedLocal: '2026-09-01T10:00:00-04:00',  // what get_event actually returned
    confirmingRead: true,
  });
  eq(r.presentable, '9:00 AM CDT', 'reconciled time');
  eq(r.businessDate, '2026-09-01', 'business date');
  assert(r.renderedDefective, 'rendered time was not flagged defective');
  assert(codes(r).includes('RENDERED_OFFSET_INVALID'), 'no RENDERED_OFFSET_INVALID finding');
  assert(!r.safeToPresent, 'a defective rendering must not be safeToPresent');
  assert(/DEFECTIVE/.test(disclosureLine(r, 'nf84u6dstooi4scqosmr42i7io')), 'disclosure omits the defect');
  return 'get_event 10:00-04:00 -> reconciled 9:00 AM CDT, rendering discarded';
});

check('TZ-02', 'the one-hour error is exactly the harm: naive read differs from reconciled', () => {
  const r = reconcile({ absoluteInstant: '2026-09-01T14:00:00Z', confirmingRead: true });
  const naiveHour = 10;                       // from the defective rendering
  const reconciledHour = 9;                   // from the absolute instant
  eq(r.presentable, '9:00 AM CDT', 'reconciled time');
  eq(naiveHour - reconciledHour, 1, 'error magnitude');
  return 'naive 10:00 vs reconciled 9:00 - one hour, one lost client';
});

// ------------------------------------------------- both DST states

check('TZ-03', 'CST winter instant resolves to -06:00', () => {
  const r = reconcile({ absoluteInstant: '2026-01-15T14:00:00Z', confirmingRead: true });
  eq(r.presentable, '8:00 AM CST', 'winter time');
  eq(r.offset, '-06:00', 'winter offset');
  assert(r.safeToPresent, 'clean winter case should be presentable');
  return '2026-01-15T14:00Z -> 8:00 AM CST';
});

check('TZ-04', 'CDT summer instant resolves to -05:00', () => {
  const r = reconcile({ absoluteInstant: '2026-07-15T14:00:00Z', confirmingRead: true });
  eq(r.offset, '-05:00', 'summer offset');
  eq(r.abbreviation, 'CDT', 'summer abbreviation');
  return '2026-07-15T14:00Z -> CDT -05:00';
});

// ------------------------------------------------- DST transitions

check('TZ-05', 'spring forward: the 2 AM local hour does not exist', () => {
  const before = reconcile({ absoluteInstant: '2026-03-08T07:59:00Z', confirmingRead: true });
  const after  = reconcile({ absoluteInstant: '2026-03-08T08:00:00Z', confirmingRead: true });
  eq(before.presentable, '1:59 AM CST', 'instant before transition');
  eq(after.presentable, '3:00 AM CDT', 'instant after transition');
  assert(before.offset === '-06:00' && after.offset === '-05:00', 'offset did not shift across the transition');
  return '2026-03-08 01:59 CST -> 03:00 CDT, 2 AM skipped';
});

check('TZ-06', 'fall back: the 1 AM local hour occurs twice and stays distinguishable', () => {
  const first  = reconcile({ absoluteInstant: '2026-11-01T06:00:00Z', confirmingRead: true });
  const second = reconcile({ absoluteInstant: '2026-11-01T07:00:00Z', confirmingRead: true });
  eq(first.presentable, '1:00 AM CDT', 'first 1 AM');
  eq(second.presentable, '1:00 AM CST', 'second 1 AM');
  assert(first.localTime === second.localTime, 'the ambiguous hour should share a wall-clock time');
  assert(first.offset !== second.offset, 'the ambiguous hour must remain distinguishable by offset');
  assert(first.absoluteInstant !== second.absoluteInstant, 'distinct instants must not collapse');
  return 'both 1:00 AM occurrences resolved and distinguished by offset';
});

check('TZ-07', 'midnight either side of the fall-back transition', () => {
  const r = reconcile({ absoluteInstant: '2026-11-01T05:59:00Z', confirmingRead: true });
  eq(r.presentable, '12:59 AM CDT', 'pre-transition midnight hour');
  return '2026-11-01T05:59Z -> 12:59 AM CDT';
});

// ------------------------------------------------- Rule 3c, date boundaries

check('TZ-08', 'business date is the Chicago date, not the UTC date (CDT)', () => {
  const r = reconcile({ absoluteInstant: '2026-09-02T04:00:00Z', confirmingRead: true });
  eq(r.businessDate, '2026-09-01', 'business date');
  eq(r.presentable, '11:00 PM CDT', 'local time');
  assert(r.absoluteInstant.startsWith('2026-09-02'), 'UTC date should still read as the 2nd');
  return 'UTC 2026-09-02 04:00Z is business date 2026-09-01';
});

check('TZ-09', 'business date is the Chicago date, not the UTC date (CST, year boundary)', () => {
  const r = reconcile({ absoluteInstant: '2026-01-02T05:30:00Z', confirmingRead: true });
  eq(r.businessDate, '2026-01-01', 'business date across a calendar-day boundary');
  eq(r.presentable, '11:30 PM CST', 'local time');
  return 'UTC 2026-01-02 05:30Z is business date 2026-01-01';
});

check('TZ-10', '12-hour formatting is correct at noon and midnight', () => {
  eq(reconcile({ absoluteInstant: '2026-09-01T17:00:00Z', confirmingRead: true }).presentable,
     '12:00 PM CDT', 'noon');
  eq(reconcile({ absoluteInstant: '2026-09-01T05:00:00Z', confirmingRead: true }).presentable,
     '12:00 AM CDT', 'midnight');
  return 'noon renders 12:00 PM, midnight renders 12:00 AM - never 0:00 or 24:00';
});

// ------------------------------------------------- Rule 3b, defect classification

check('TZ-11', 'valid-shaped offset in the wrong DST state is still defective', () => {
  const r = reconcile({
    absoluteInstant: '2026-09-01T14:00:00Z',
    renderedLocal: '2026-09-01T08:00:00-06:00',   // legal Chicago offset, wrong for September
    confirmingRead: true,
  });
  assert(r.renderedDefective, 'wrong-DST rendering was not flagged');
  assert(codes(r).includes('RENDERED_OFFSET_WRONG_DST'), 'no RENDERED_OFFSET_WRONG_DST finding');
  eq(r.presentable, '9:00 AM CDT', 'reconciled time must ignore the bad rendering');
  return '-06:00 in September flagged as wrong DST state, not accepted';
});

check('TZ-12', 'a UTC-rendered local time is rejected for Chicago', () => {
  const r = reconcile({
    absoluteInstant: '2026-09-01T14:00:00Z',
    renderedLocal: '2026-09-01T14:00:00Z',
    confirmingRead: true,
  });
  eq(renderedOffsetOf('2026-09-01T14:00:00Z'), '+00:00', 'Z parses as +00:00');
  assert(r.renderedDefective, '+00:00 must not be accepted as a Chicago local time');
  return 'Z / +00:00 rendering rejected';
});

check('TZ-13', 'a correct rendering with a confirming read is clean', () => {
  const r = reconcile({
    absoluteInstant: '2026-09-01T14:00:00Z',
    renderedLocal: '2026-09-01T09:00:00-05:00',
    confirmingRead: true,
  });
  assert(!r.renderedDefective, 'correct rendering was wrongly flagged');
  eq(r.findings.length, 0, 'clean case should raise no findings');
  assert(r.safeToPresent, 'clean case should be safeToPresent');
  return 'correct -05:00 rendering + confirming read = no findings';
});

// ------------------------------------------------- Rule 3a and 3d

check('TZ-14', 'a missing confirming read blocks safeToPresent', () => {
  const r = reconcile({ absoluteInstant: '2026-09-01T14:00:00Z', confirmingRead: false });
  assert(codes(r).includes('CONFIRMING_READ_MISSING'), 'missing confirming read not reported');
  assert(!r.safeToPresent, 'unconfirmed time must not be safeToPresent');
  eq(r.presentable, '9:00 AM CDT', 'time still derived from the absolute instant');
  return 'confirming list_events read is mandatory, not optional';
});

check('TZ-15', 'a New_York lane zone is flagged, never silently applied', () => {
  const r = reconcile({
    absoluteInstant: '2026-09-01T14:00:00Z',
    ianaZone: 'America/New_York',
    confirmingRead: true,
  });
  assert(r.zoneMismatch, 'zone mismatch not detected');
  assert(codes(r).includes('LANE_ZONE_MISMATCH'), 'no LANE_ZONE_MISMATCH finding');
  eq(r.presentable, '9:00 AM CDT', 'business time must stay anchored to Chicago');
  return 'America/New_York flagged as a lane defect; Chicago anchor held';
});

check('TZ-16', 'an unparseable instant throws rather than guessing', () => {
  let threw = false;
  try { reconcile({ absoluteInstant: 'not-a-date' }); } catch { threw = true; }
  assert(threw, 'a bad instant must throw, never default to now');
  return 'no silent fallback to the current time';
});

// ------------------------------------------------- output

const width = 62;
console.log('\nBlaise Real Estate OS - Timezone Edge Case Suite (chicago-date-anchor Rule 3)');
console.log('='.repeat(width));
for (const r of results) {
  console.log(`[${r.status}] ${r.id}  ${r.name}`);
  if (r.detail) console.log(`         ${r.detail.replace(/\n/g, '\n         ')}`);
}
console.log('='.repeat(width));
console.log(`${results.length - failed}/${results.length} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
