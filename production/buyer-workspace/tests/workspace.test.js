'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BuyerWorkspace, parseFeedback, preferenceCandidates, validateDate, privateCheck } = require('../core');
const { createDemo } = require('../demo');
const { createServer } = require('../server');
const { FubConnection, CONFIG } = require('../connection');

async function setup(intercept) {
  const demo = createDemo(), calls = [];
  const invoke = async (tool, args) => { calls.push({ tool, args }); const r = await demo(tool, args); return intercept ? intercept(tool, args, r) : r; };
  const e = new BuyerWorkspace({ invoke }); await e.buyers(); const b = await e.brief(900001);
  const draft = () => e.draft({ briefToken: b.token, property: 'Fictional Example House', feedback: 'The buyer said they need at least three bedrooms. I noticed worn flooring.' });
  return { e, b, calls, draft };
}
const writes = calls => calls.filter(c => /^(create|update)/.test(c.tool));
const save = (e, p) => e.save({ id: p.id, digest: p.digest, approved: true });

test('buyer selection covers all assigned stages and separates unclassified contacts without changing CRM labels', async () => {
  const contacts = [
    { id: 900101, firstName: 'Avery', stage: 'Nurture', tags: ['Buyer'] },
    { id: 900102, firstName: 'Blair', stage: 'Under contract', tags: ['Buyer'] },
    { id: 900103, firstName: 'Casey', stage: 'Spoke with customer', tags: ['Buyer'] },
    { id: 900104, firstName: 'Devon', stage: 'Showing homes', tags: [] },
    { id: 900105, firstName: 'Emery', stage: 'Custom buyer stage', tags: ['Buyer'] },
    { id: 900106, firstName: 'Finley', stage: 'Under contract', tags: [] },
    { id: 900107, firstName: 'Gray', stage: 'Lead', tags: ['Seller'] },
    { id: 900108, firstName: 'Harper', stage: 'Trash', tags: ['Buyer'] },
  ].map(p => ({ assignedUserId: 900010, ...p }));
  contacts.push({ id: 900109, firstName: 'Indigo', stage: 'Nurture', tags: ['Buyer'], assignedUserId: 900011 });
  const demo = createDemo(), calls = [];
  const e = new BuyerWorkspace({ invoke: async (tool, args) => {
    calls.push({ tool, args });
    if (tool === 'find_contact') return { structuredContent: { people: contacts, _metadata: { total: contacts.length, next: null } } };
    if (tool === 'get_contact') return { structuredContent: contacts.find(p => p.id === args.person_id) };
    return demo(tool, args);
  } });
  const list = await e.buyers();
  assert.deepEqual(list.buyers.map(p => p.id), [900101, 900102, 900103, 900104, 900105]);
  assert.deepEqual(list.otherContacts.map(p => p.id), [900106]); assert.equal(list.partial, false);
  assert.equal(calls.find(c => c.tool === 'find_contact').args.stage, undefined);
  assert.equal((await e.brief(900102)).buyer.stage, 'Under contract');
  const unclassified = await e.brief(900106);
  assert.equal(unclassified.buyer.classification, 'unclassified'); assert.match(unclassified.gaps[0], /not marked/);
  for (const id of [900107, 900108, 900109]) await assert.rejects(e.brief(id), /classification changed/);
  assert.equal(writes(calls).length, 0);
});

test('bounded buyer search discloses incomplete coverage and searches FUB by name within the same assignment', async () => {
  const demo = createDemo(), calls = []; let metadata = { total: 60, next: '/more' };
  const e = new BuyerWorkspace({ invoke: async (tool, args) => {
    calls.push({ tool, args }); const r = await demo(tool, args);
    if (tool === 'find_contact') r.structuredContent._metadata = metadata;
    return r;
  } });
  assert.equal((await e.buyers()).partial, true);
  metadata = undefined; assert.equal((await e.buyers()).partial, true);
  metadata = { total: 1, next: null };
  const result = await e.buyers({ query: ' Alex ' }); assert.equal(result.partial, false); assert.equal(result.buyers.length, 1);
  assert.deepEqual(calls.at(-1), { tool: 'find_contact', args: { assigned_user_id: 900010, name: 'Alex', limit: 100 } });
  await assert.rejects(e.buyers({ query: 123 }), /Search by a name/);
  assert.equal(writes(calls).length, 0);
});

test('a contact newly marked seller-only cannot use an earlier buyer approval', async () => {
  let changed = false;
  const { e, calls, draft } = await setup((tool, args, r) => {
    if (tool === 'get_contact') { r.structuredContent.stage = 'Nurture'; if (changed) r.structuredContent.tags = ['Seller']; }
    return r;
  });
  const proposal = e.review(draft()); changed = true;
  assert.equal((await save(e, proposal)).state, 'REFRESH_REQUIRED'); assert.equal(writes(calls).length, 0);
});

test('feedback preserves exact attribution; unclassified claims cannot be silently written', async () => {
  const { e, draft } = await setup(); const d = draft();
  assert.deepEqual(d.claims.map(c => c.basis), ['Client statement', 'Blaise observation']);
  d.claims[0].quote = 'Fabricated quotation'; assert.throws(() => e.review(d), /original quotation/);
  d.claims[0].quote = d.feedback.split('. ')[0] + '.'; d.claims[0].basis = 'Unclassified'; assert.throws(() => e.review(d), /Label unclear/);
});
test('observations and conditional interest never become confirmed requirements', () => {
  assert.equal(preferenceCandidates(parseFeedback('I noticed three bedrooms. The buyer said maybe they want a garage.')).length, 0);
  assert.equal(preferenceCandidates(parseFeedback('The buyer said they liked this kitchen.')).length, 0);
  assert.equal(preferenceCandidates(parseFeedback('The buyer said they need three bedrooms.'))[0].treatment, 'Preference to confirm');
});
test('named-buyer rental question becomes a proposed condition, not a verified property fact', async () => {
  const { e, b } = await setup(); const d = e.draft({ briefToken: b.token, property: 'Fictional condo', feedback: 'Alex liked the unit and wants to make an offer, but first needs confirmation that the HOA permits short-term rentals. No offer date is confirmed. Next step: retrieve the management contact and follow up for written restrictions.' });
  assert.equal(d.claims[0].basis, 'Client statement'); assert.equal(d.preferences[0].field, 'Rental-use condition');
  assert.match(d.nextAction, /retrieve the management/); assert.equal(d.createTask, false); assert.equal(d.dueDate, '');
  assert.match(e.review(d).note.body, /not independently retrieved or verified/);
});
test('no writes before exact approval, and a complete save is independently read back', async () => {
  const { e, calls, draft } = await setup(); const p = e.review(draft()); assert.equal(writes(calls).length, 0);
  await assert.rejects(e.save({ id: p.id, digest: 'wrong', approved: true }), /exact current/);
  await assert.rejects(e.save({ id: p.id, digest: p.digest, approved: false }), /Approve/);
  const r = await save(e, p); assert.equal(r.state, 'VERIFIED'); assert.equal(writes(calls).length, 1); assert.equal(calls.at(-1).tool, 'get_contact_notes');
  assert.equal(r.results[0].body, p.note.body); assert.ok(!('snapshot' in r));
  await save(e, p); assert.equal(writes(calls).length, 1);
});
test('refreshing or editing supersedes approval of the old proposal', async () => {
  const { e, draft } = await setup(); let p = e.review(draft()); e.review(draft()); await assert.rejects(save(e, p), /already been attempted/);
  p = e.review(draft()); await e.brief(900001); await assert.rejects(save(e, p), /already been attempted/);
});
test('a changed buyer or new note blocks writes before approval is applied', async () => {
  let change = false;
  const { e, calls, draft } = await setup((t, a, r) => { if (change && t === 'get_contact') r.structuredContent.assignedUserId = 900011; return r; });
  const p = e.review(draft()); change = true; assert.equal((await save(e, p)).state, 'REFRESH_REQUIRED'); assert.equal(writes(calls).length, 0);
});
test('new source notes require refresh', async () => {
  let change = false;
  const { e, calls, draft } = await setup((t, a, r) => { if (change && t === 'get_contact_notes') r.structuredContent.notes.unshift({ id: 900099, subject: 'Changed context', body: 'Synthetic' }); return r; });
  const p = e.review(draft()); change = true; assert.equal((await save(e, p)).state, 'REFRESH_REQUIRED'); assert.equal(writes(calls).length, 0);
});
test('source task incompleteness blocks task creation', async () => {
  const { e, draft } = await setup((t, a, r) => { if (t === 'get_open_tasks') r.structuredContent._completeness.has_more = true; return r; });
  const d = draft(); d.createTask = true; d.dueDate = '2026-09-18'; assert.throws(() => e.review(d), /incomplete/);
});
test('note and dated task use at most two writes; no communication tool exists', async () => {
  const { e, calls, draft } = await setup(); const d = draft(); d.createTask = true; d.dueDate = '2026-09-18'; d.nextAction = 'Confirm the three-bedroom requirement with the buyer';
  const p = e.review(d); const r = await save(e, p); assert.equal(r.state, 'VERIFIED'); assert.equal(r.results.length, 2); assert.equal(writes(calls).length, 2);
  assert.ok(calls.every(c => !/send|log_external/.test(c.tool))); assert.equal(writes(calls)[1].args.due_date, '2026-09-18');
});
test('existing task is updated in place and read back', async () => {
  const { e, calls, draft } = await setup(); const d = draft(); d.createTask = true; d.dueDate = '2026-09-18';
  const first = await save(e, e.review(d)); const taskId = first.results.find(r => r.kind === 'task').recordId;
  const b = await e.brief(900001); const d2 = e.draft({ briefToken: b.token, property: 'Fictional home', feedback: 'The buyer said they want to verify the garage dimensions.' });
  d2.createTask = true; d2.existingTaskId = taskId; d2.dueDate = '2026-09-18'; d2.nextAction = 'Verify the garage dimensions from the property source';
  const result = await save(e, e.review(d2)); assert.equal(result.state, 'VERIFIED'); assert.equal(result.results.find(r => r.kind === 'task').recordId, taskId); assert.equal(writes(calls).at(-1).tool, 'update_contact_task');
});
test('same feedback after refresh reuses the existing note instead of timestamp-driven duplicates', async () => {
  const { e, calls, draft } = await setup(); const d = draft(); await save(e, e.review(d)); const b = await e.brief(900001); d.briefToken = b.token;
  assert.equal((await save(e, e.review(d))).state, 'VERIFIED'); assert.equal(writes(calls).length, 1);
});
test('uncertain writes are never blindly retried; reconciliation only reads', async () => {
  let fail = true;
  const { e, calls, draft } = await setup((t, a, r) => { if (t === 'create_contact_note' && fail) { fail = false; throw new Error('Disconnected after commit'); } return r; });
  const p = e.review(draft()); assert.equal((await save(e, p)).state, 'NEEDS_RECONCILIATION');
  await assert.rejects(save(e, p), /already been attempted/); assert.equal((await e.reconcile(p.id)).state, 'VERIFIED'); assert.equal(writes(calls).length, 1);
});
test('a partial note/task save keeps verified work and never reports full success', async () => {
  const demo = createDemo(), calls = [];
  const e = new BuyerWorkspace({ invoke: async (t, a) => { calls.push({ tool: t }); if (t === 'create_contact_task') throw new Error('Unavailable'); return demo(t, a); } });
  await e.buyers(); const b = await e.brief(900001); const d = e.draft({ briefToken: b.token, property: 'Synthetic', feedback: 'The buyer said they need three bedrooms.' }); d.createTask = true; d.dueDate = '2026-09-18';
  const p = e.review(d), r = await save(e, p); assert.equal(r.state, 'NEEDS_RECONCILIATION'); assert.equal(r.results.length, 1); assert.equal(r.results[0].kind, 'note');
  const count = writes(calls).length; assert.equal((await e.reconcile(p.id)).state, 'NEEDS_RECONCILIATION'); assert.equal(writes(calls).length, count);
});
test('sensitive inputs and impossible dates are rejected', () => {
  for (const s of ['lockbox: 1234', 'password: something', '123-45-6789', 'account number: 12345']) assert.throws(() => privateCheck(s));
  assert.throws(() => validateDate('2026-02-30')); assert.throws(() => validateDate('tomorrow')); validateDate('2028-02-29');
});
test('HTTP gates enforce session/CSRF, origin, host and no-store without public client data', async () => {
  const port = 4392, server = createServer({ port }); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${port}`, r = await fetch(`${base}/api/status`), cookie = r.headers.get('set-cookie').split(';')[0], s = await r.json();
    assert.equal(s.connected, false); assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('set-cookie'), /HttpOnly/);
    let q = await fetch(`${base}/api/buyers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' }); assert.equal(q.status, 403);
    q = await fetch(`${base}/api/buyers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base, 'X-Workspace-CSRF': s.csrf }, body: '{}' }); assert.equal(q.status, 401);
    q = await fetch(`${base}/api/status`, { headers: { Origin: 'https://example.invalid' } }); assert.equal(q.status, 403);
    const code = await new Promise(resolve => { require('node:http').get(`${base}/api/status`, { headers: { Host: 'attacker.invalid' } }, r => { r.resume(); resolve(r.statusCode); }); }); assert.equal(code, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('OAuth reuses the exact client/callback with PKCE and binds state to the initiating browser', async () => {
  let exchanges = 0;
  const c = new FubConnection({ fetcher: async url => { exchanges++; return new Response(JSON.stringify({ issuer: CONFIG.issuer, authorization_endpoint: `${CONFIG.issuer}authorize`, token_endpoint: `${CONFIG.issuer}oauth/token`, code_challenge_methods_supported: ['S256'] }), { status: 200 }); } });
  const url = new URL(await c.start('browser-a'));
  assert.equal(url.searchParams.get('client_id'), CONFIG.clientId); assert.equal(url.searchParams.get('redirect_uri'), CONFIG.callback); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(!url.searchParams.has('client_secret'));
  const callback = new URL(CONFIG.callback); callback.search = new URLSearchParams({ code: 'fictional-code', state: url.searchParams.get('state') });
  await assert.rejects(c.finish(callback, 'browser-b'), /this browser/); assert.equal(exchanges, 1); assert.equal(c.tokens, null);
});
test('SSE parser returns the matching RPC result and ignores unrelated events', async () => {
  const c = new FubConnection({ fetcher: async () => new Response('event: message\ndata: {"jsonrpc":"2.0","method":"notice"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }) });
  c.tokens = { access: 'fictional-token', expires: Date.now() + 120000 }; assert.deepEqual(await c.rpc('tools/list', {}), { ok: true });
});
test('rotating refresh is serialized and credentials never enter application responses', async () => {
  let count = 0;
  const c = new FubConnection({ fetcher: async () => { count++; await new Promise(r => setTimeout(r, 10)); return new Response(JSON.stringify({ access_token: 'fictional-new', refresh_token: 'fictional-rotated', token_type: 'Bearer', expires_in: 3600 })); } });
  c.tokens = { access: 'fictional-old', refresh: 'fictional-refresh', expires: 0 }; await Promise.all([c.access(), c.access()]); assert.equal(count, 1); assert.equal(c.tokens.refresh, 'fictional-rotated'); c.clear(); assert.equal(c.tokens, null);
});
