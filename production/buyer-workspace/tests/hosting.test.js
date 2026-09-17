'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, generateKeyPairSync, sign } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { ProtectedStore } = require('../protected-store');
const { FubConnection, CONFIG, random } = require('../connection');
const { createIdentityVerifier } = require('../identity');
const { BuyerWorkspace, TOOLS } = require('../core');
const { createDemo } = require('../demo');
const { createInterpreter, validateInterpretation } = require('../interpretation');
const { createServer } = require('../server');
const { start } = require('../hosted');

function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'buyer-host-test-')), key = randomBytes(32).toString('hex');
  return { directory, key, cleanup: () => { const resolved = realpathSync(directory); assert.equal(resolved, path.resolve(directory)); assert.ok(resolved.startsWith(path.join(realpathSync(os.tmpdir()), 'buyer-host-test-'))); rmSync(resolved, { recursive: true }); } };
}

test('protected state survives a fresh process, contains no plaintext, and rejects a second writer', () => {
  const f = fixture(); let store = new ProtectedStore(f);
  try {
    store.put('synthetic-session', { tokens: { refresh: 'fictional-protected-refresh' }, receipt: 'fictional-client-context' }, Date.now() + 60000);
    assert.throws(() => new ProtectedStore(f), /Another workspace process/);
    for (const file of readdirSync(f.directory)) { const raw = readFileSync(path.join(f.directory, file)); assert.equal(raw.includes(Buffer.from('fictional-')), false); assert.equal(raw.includes(Buffer.from('synthetic-session')), false); }
    store.close(); store = null;
    const moduleFile = require.resolve('../protected-store');
    const script = `const {ProtectedStore}=require(process.env.TEST_MODULE); const s=new ProtectedStore({directory:process.env.TEST_DIR,key:process.env.TEST_KEY}); if(s.get('synthetic-session').tokens.refresh!=='fictional-protected-refresh')process.exitCode=1; s.close();`;
    const child = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TEST_MODULE: moduleFile, TEST_DIR: f.directory, TEST_KEY: f.key }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, '');
  } finally { store?.close(); f.cleanup(); }
});

test('wrong encryption key and expired storage fail closed; logout deletes the session', () => {
  const f = fixture(); let clock = Date.now(), store = new ProtectedStore({ ...f, now: () => clock });
  try {
    store.put('test', { value: 'synthetic' }, clock + 1000); store.close();
    store = new ProtectedStore({ ...f, key: randomBytes(32).toString('hex') }); assert.throws(() => store.get('test'), /could not be opened/); store.close();
    store = new ProtectedStore({ ...f, now: () => clock }); clock += 2000; assert.equal(store.get('test'), null);
    store.put('test2', { value: 'synthetic' }, clock + 1000); store.delete('test2'); assert.equal(store.get('test2'), null);
  } finally { store.close(); f.cleanup(); }
});

test('known transient renewal failure preserves credentials; uncertain renewal is not replayed after restart', async () => {
  let count = 0, persisted;
  const c = new FubConnection({ checkpoint: () => { persisted = structuredClone(c.exportState()); }, fetcher: async () => { count++; return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), { status: 503 }); } });
  c.tokens = { access: 'fictional-old', refresh: 'fictional-refresh', expires: 0 };
  await assert.rejects(c.access(), /preserved/); assert.equal(c.tokens.refresh, 'fictional-refresh'); assert.equal(c.renewalPending, false);
  c.retryAfter = 0; c.fetcher = async () => { count++; throw new Error('Interrupted response'); };
  await assert.rejects(c.access(), /interrupted/); assert.equal(persisted.renewalPending, true);
  const fresh = new FubConnection({ fetcher: c.fetcher }); fresh.restoreState(persisted);
  await assert.rejects(fresh.access(), /prior renewal was interrupted/); assert.equal(count, 2);
});

test('rotated credentials are persisted before use and restored without another login', async () => {
  let state, exchanges = 0;
  const c = new FubConnection({ checkpoint: () => { state = structuredClone(c.exportState()); }, fetcher: async () => { exchanges++; return Response.json({ access_token: 'fictional-new', refresh_token: 'fictional-next', token_type: 'Bearer', expires_in: 3600 }); } });
  c.tokens = { access: 'fictional-old', refresh: 'fictional-old-refresh', expires: 0 };
  assert.equal(await c.access(), 'fictional-new'); assert.equal(state.tokens.refresh, 'fictional-next');
  const fresh = new FubConnection({ fetcher: async () => { throw new Error('Unexpected login'); } }); fresh.restoreState(state);
  assert.equal(await fresh.access(), 'fictional-new'); assert.equal(exchanges, 1);
});

test('access rejection preserves refresh credentials; permission denial does not become repeated login', async () => {
  const c = new FubConnection({ fetcher: async () => new Response('', { status: 401 }) });
  c.tokens = { access: 'fictional-token', refresh: 'fictional-refresh', expires: Date.now() + 120000 };
  await assert.rejects(c.rpc('tools/list', {}), /rejected the current access/); assert.equal(c.tokens.refresh, 'fictional-refresh'); assert.equal(c.tokens.expires, 0);
  c.tokens.expires = Date.now() + 120000; c.fetcher = async () => new Response('', { status: 403 });
  await assert.rejects(c.rpc('tools/list', {}), /denied this action/); assert.ok(c.tokens);
});

test('owner verification checks signature, issuer, audience, expiration, subject and scopes', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-key', use: 'sig', alg: 'RS256' };
  const verifyOwner = createIdentityVerifier({ subject: 'synthetic-owner', fetcher: async () => Response.json({ keys: [jwk] }) });
  const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const jwt = changes => { const input = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: CONFIG.issuer, aud: CONFIG.endpoint, sub: 'synthetic-owner', exp: Math.floor(Date.now() / 1000) + 60, scope: 'fub:read fub:write', ...changes })}`; return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`; };
  assert.deepEqual(await verifyOwner(jwt({})), { subject: 'synthetic-owner' });
  for (const changes of [{ sub: 'another-owner' }, { aud: 'https://other.invalid' }, { iss: 'https://other.invalid/' }, { exp: 0 }, { scope: 'fub:read' }]) await assert.rejects(verifyOwner(jwt(changes)));
  const valid = jwt({}); await assert.rejects(verifyOwner(valid.slice(0, -20) + 'tampered'), /signature/);
});

test('restart after provider commit resumes read-back only; checkpoint failure prevents writes', async () => {
  const invoke = createDemo(); let snapshot, writes = 0;
  const e = new BuyerWorkspace({ invoke: async (tool, args) => { const r = await invoke(tool, args); if (tool === 'create_contact_note') { writes++; throw new Error('Simulated lost response'); } return r; }, checkpoint: () => { snapshot = structuredClone(e.exportState()); } });
  await e.buyers(); const b = await e.brief(900001);
  const p = e.review(e.draft({ briefToken: b.token, property: 'Fictional Home', feedback: 'The buyer said they need three bedrooms.' }));
  await e.save({ id: p.id, digest: p.digest, approved: true });
  const fresh = new BuyerWorkspace({ invoke: async (tool, args) => { assert.ok(!/^(create|update)/.test(tool)); return invoke(tool, args); } }); fresh.restoreState(snapshot);
  assert.equal(fresh.proposals.get(p.id).snapshot, undefined);
  await assert.rejects(fresh.save({ id: p.id, digest: p.digest, approved: true }), /already been attempted/);
  assert.equal((await fresh.reconcile(p.id)).state, 'VERIFIED'); assert.equal(writes, 1);
  const e2 = new BuyerWorkspace({ invoke, checkpoint: () => { throw new Error('Storage unavailable'); } }); await e2.buyers(); const b2 = await e2.brief(900001);
  const p2 = e2.review(e2.draft({ briefToken: b2.token, property: 'Another fictional home', feedback: 'The buyer said they want four bedrooms.' }));
  await assert.rejects(e2.save({ id: p2.id, digest: p2.digest, approved: true }), /Storage unavailable/);
  assert.equal(e2.proposals.get(p2.id).attempted, undefined);
});

test('feedback service receives only minimized input and validates exact evidence before review', async () => {
  const draft = { firstName: 'Alex', property: 'Fictional Home', feedback: 'The buyer said they prefer a yard. I noticed damaged flooring.', confidentialCRM: 'MUST NOT SEND' };
  const output = { claims: [{ id: 'c1', quote: 'The buyer said they prefer a yard.', basis: 'Client statement' }, { id: 'c2', quote: 'I noticed damaged flooring.', basis: 'Blaise observation' }], preferences: [{ field: 'Outdoor space', after: 'A yard is preferred', evidence: 'c1', treatment: 'Soft preference' }], nextAction: 'Confirm whether a yard should guide the next shortlist.', clientText: 'Hey Alex, I’ll keep a yard in mind for the next shortlist. Let’s confirm how important that is alongside the other priorities.' };
  const interpret = createInterpreter({ apiKey: 'fictional-key', model: 'test-model', fetcher: async (url, options) => { assert.equal(url, 'https://api.openai.com/v1/responses'); const b = JSON.parse(options.body); assert.equal(b.store, false); assert.equal(b.tools, undefined); assert.ok(!options.body.includes('MUST NOT SEND')); return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }); } });
  const d = await interpret(draft); assert.equal(d.createTask, false); assert.equal(d.claims[0].quote, output.claims[0].quote);
  const fabricated = structuredClone(output); fabricated.claims[0].quote = 'Invented buyer statement'; assert.throws(() => validateInterpretation(fabricated, draft), /original feedback/);
  const wrong = structuredClone(output); wrong.preferences[0].evidence = 'c2'; assert.throws(() => validateInterpretation(wrong, draft), /lacks a client statement/);
  const strong = structuredClone(output); strong.preferences[0].treatment = 'Confirmed requirement'; assert.throws(() => validateInterpretation(strong, draft));
});

test('hosted HTTP restores a protected session after restart, denies anonymous access and clears logout', async () => {
  const f = fixture(), store = new ProtectedStore(f), id = random(), csrf = random();
  const origin = 'https://workspace.example.invalid', hosting = { origin, subject: 'synthetic-owner' }, port = 4393;
  const connection = new FubConnection(); connection.tokens = { access: 'fictional-access', refresh: 'fictional-refresh', expires: Date.now() + 3600000 }; connection.available = TOOLS;
  store.put(id, { id, subject: hosting.subject, csrf, expires: Date.now() + 3600000, absoluteExpiry: Date.now() + 86400000, authenticated: true, connection: connection.exportState(), engine: { owner: null, briefs: [], proposals: [] } }, Date.now() + 3600000);
  const make = () => createServer({ port, hosting, store, invoke: createDemo() });
  let server = make(); await new Promise(r => server.listen(port, '127.0.0.1', r));
  const headers = { Host: new URL(origin).host, Origin: origin, Cookie: `__Host-buyer_session=${id}`, 'Content-Type': 'application/json', 'X-Workspace-CSRF': csrf };
  const request = (route, options = {}) => new Promise((resolve, reject) => {
    const req = require('node:http').request(`http://127.0.0.1:${port}${route}`, { agent: false, method: options.method || 'GET', headers: { ...headers, ...options.headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    }); req.on('error', reject); req.end(options.body);
  });
  try {
    let entry = await request('/', { headers: { Origin: '', Cookie: '', 'Sec-Fetch-Site': 'cross-site' } }); assert.equal(entry.status, 200); assert.match(await entry.text(), /Connect Follow Up Boss/);
    entry = await request('/api/status', { headers: { Origin: '', 'Sec-Fetch-Site': 'cross-site' } }); assert.equal(entry.status, 403);
    let r = await request('/api/status'); assert.match(r.headers.get('set-cookie'), /Secure/); assert.equal((await r.json()).connected, true);
    r = await request('/api/buyers', { method: 'POST', body: '{}' }); assert.equal(r.status, 200); assert.equal((await r.json()).buyers.length, 1);
    await new Promise(r => server.close(r)); server = make(); await new Promise(r => server.listen(port, '127.0.0.1', r));
    assert.equal((await (await request('/api/status')).json()).connected, true);
    r = await request('/api/buyers', { method: 'POST', body: '{}', headers: { Cookie: '', 'X-Workspace-CSRF': '' } }); assert.equal(r.status, 403);
    r = await request('/api/logout', { method: 'POST', body: '{}' }); assert.equal(r.status, 200); assert.equal(store.get(id), null);
    assert.equal((await (await request('/api/status')).json()).connected, false);
  } finally { await new Promise(r => server.close(r)); store.close(); f.cleanup(); }
});

test('incomplete production configuration cannot start an apparently usable deployment', () => {
  assert.throws(() => start({}), /Deployment is incomplete/);
  assert.throws(() => start({ RENDER_EXTERNAL_URL: 'https://workspace.example.invalid' }), /set WORKSPACE_DATA_DIR/);
  assert.throws(() => start({ RENDER_EXTERNAL_URL: 'http://workspace.example.invalid' }), /exact HTTPS origin/);
  assert.throws(() => createServer({ hosting: { origin: 'http://example.invalid', subject: 'test' } }), /requires an HTTPS origin/);
});
