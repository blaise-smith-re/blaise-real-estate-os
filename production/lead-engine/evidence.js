'use strict';

const { createHash } = require('node:crypto');
const { validateSourceMetadata, scanForCredentialMaterial } = require('../../runtime/contract');
const DAY = 86400000;
function requireThat(ok, message) { if (!ok) throw new Error(message); }
function instant(value) {
  requireThat(typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)), 'Explicit ISO timestamp/offset required');
  return Date.parse(value);
}
function normalized(value) { return String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function sha(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function httpUrl(value) {
  let u; try { u = new URL(value); } catch { throw new Error('Reopenable HTTPS source required'); }
  requireThat(u.protocol === 'https:' && !u.username && !u.password, 'Reopenable HTTPS source required');
  requireThat(!/localhost|^127\.|^10\.|^192\.168\.|^169\.254\./i.test(u.hostname), 'Private network locators rejected');
  return value;
}
function cleanInput(input) {
  scanForCredentialMaterial(input);
  // Defense in depth, not a semantic privacy classifier. The operator also reviews every retained field.
  const forbiddenKeys = /^(race|ethnicity|religion|disability|medical|domestic_abuse|minors|sexual_orientation|gender_identity|citizenship|ssn|birth_date|income|wealth|vulnerability|protected_characteristics)$/i;
  function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k,v] of Object.entries(o)) { requireThat(!forbiddenKeys.test(k), 'Protected/sensitive targeting field rejected'); walk(v); }
  }
  walk(input);
}
class Evidence {
  constructor(records, now, synthetic = false) {
    this.now = instant(now); this.records = new Map();
    requireThat(Array.isArray(records) && records.length <= 80, 'Bounded source list required (maximum 80)');
    for (const s of records) {
      requireThat(s.id && !this.records.has(s.id), 'Unique source IDs required');
      httpUrl(s.locator);
      requireThat(s.name && s.retrieval_tool && s.retrieved_at && s.observed_at, 'Source name, tool, retrieval and observation times required');
      requireThat(instant(s.observed_at) <= instant(s.retrieved_at) && instant(s.retrieved_at) <= this.now, 'Future or inconsistent source timestamp');
      requireThat(['browser','public-web','authorized-export','public-api','synthetic'].includes(s.access), 'Unsupported source access route');
      requireThat(synthetic || s.access !== 'synthetic', 'Synthetic source in live run');
      requireThat(['allowed','restricted','unverified'].includes(s.permission?.state) && s.permission?.basis, 'Source-use decision with basis required');
      requireThat(Array.isArray(s.excerpts) && s.excerpts.length <= 30 && s.excerpts.every(x => typeof x === 'string' && x.length <= 1500), 'Use bounded excerpts, not source bodies');
      requireThat(!/^(RETIRED|LEGACY|ARCHIVED)\b|Superseded/i.test(s.name), 'Retired source rejected');
      validateSourceMetadata([{system:s.name,record_id:s.locator,retrieved_at:s.retrieved_at,classification:s.access === 'synthetic' ? 'SYNTHETIC' : 'REPORTED'}]);
      this.records.set(s.id, {...s, evidence_hash:sha(s)});
    }
  }
  claim(c) {
    const s = this.records.get(c?.source);
    requireThat(s && s.permission.state === 'allowed', 'Claim source unavailable or not permitted');
    requireThat(['verified','reported','inferred'].includes(c.state), 'Explicit evidence state required');
    requireThat(c.id && c.field && typeof c.text === 'string' && c.text.length > 0, 'Named fact required');
    requireThat(c.quote && s.excerpts.some(e => normalized(e).includes(normalized(c.quote))), 'Quote not in captured excerpt');
    requireThat(c.state !== 'verified' || (c.verification_scope && ['direct-observation','authorized-record'].includes(c.verification_scope)), 'Verification scope required; publisher claims are reported');
    return {...c, locator:s.locator, observed_at:s.observed_at};
  }
  age(source) { return (this.now - instant(this.records.get(source).observed_at)) / DAY; }
}
module.exports = { DAY, requireThat, instant, normalized, sha, httpUrl, cleanInput, Evidence };
