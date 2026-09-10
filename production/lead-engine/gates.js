'use strict';
const { instant, DAY, requireThat } = require('./evidence');
const CHECKS = ['source_permission','suppression_dnc_optout','channel','timing','platform_brokerage','truthful_identity','representation'];
const HOLD = 'HOLD — VERIFY CONTACT ELIGIBILITY';
function contactGate(c, evidence) {
  const g = c.contact_review;
  if (g?.do_not_contact === true || g?.checks?.suppression_dnc_optout?.state === 'fail') return {state:'DO-NOT-CONTACT',label:'DO-NOT-CONTACT',missing:[],executable:false};
  const missing = [];
  if (!g || g.target_key !== c.target_key || !g.reviewer || !['call','text','email','agent-outreach','in-person'].includes(g.channel)) missing.push('exact target, reviewer and channel');
  if (!g?.reviewed_at || !g?.expires_at || !Number.isFinite(Date.parse(g.reviewed_at)) || !Number.isFinite(Date.parse(g.expires_at)) || Date.parse(g.reviewed_at) > evidence.now || Date.parse(g.expires_at) <= evidence.now || evidence.now-Date.parse(g.reviewed_at) > DAY) missing.push('current review (maximum 24 hours)');
  if (!g?.identity || /\[|\]/.test(g.identity)) missing.push('resolved public identity');
  for (const k of CHECKS) {
    const v = g?.checks?.[k];
    try {
      requireThat(v?.state === 'pass' && v.reason && v.evidence, 'Unresolved check');
      requireThat(v.evidence.field === 'contact_gate.'+k, 'Gate-specific evidence required');
      requireThat(v.evidence.target_key === c.target_key && v.evidence.channel === g.channel, 'Evidence target/channel mismatch');
      requireThat(v.evidence.state === 'verified', 'Gate adjudication must be verified');
      evidence.claim(v.evidence);
      requireThat(evidence.age(v.evidence.source) <= 1, 'Stale gate evidence');
    } catch { missing.push(k); }
  }
  if (c.unknowns.some(u=>u.blocks_contact)) missing.push('material contact unknowns');
  if (c.conflicts?.length) missing.push('unresolved source conflicts');
  return {state:missing.length?'HOLD-VERIFY':'ELIGIBLE',label:missing.length?HOLD:'ELIGIBLE — prepare for Blaise review; research never authorizes send',missing,executable:false};
}
function firstMove(c) {
  if(c.action_readiness?.action==='public-event') return 'Check registration, membership/guest eligibility, Blaise’s availability and any spending approval. If Blaise chooses to attend, prepare normal in-person introductions; no cold-call gate is required for attendance. Do not register, pay or add Calendar entries.';
  if (c.contact_eligibility.state === 'DO-NOT-CONTACT') return 'Do not contact. Suppress pursuit and retain only the minimal suppression evidence in the authorized system.';
  if (c.contact_eligibility.state !== 'ELIGIBLE') return (c.next_research?.text||'Recheck the current source and resolve the exact relationship.')+' Resolve the exact target/channel contact gate before any outreach. No cold outreach is executable.';
  return 'Prepare '+c.contact_review.channel+' for Blaise’s exact-action review; resolve current availability before making any promise.';
}
module.exports = { CHECKS, HOLD, contactGate, firstMove };
