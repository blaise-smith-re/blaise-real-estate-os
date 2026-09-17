'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { BuyerWorkspace, TOOLS } = require('./core');
const { FubConnection, CONFIG, random } = require('./connection');
const { createDemo } = require('./demo');
const { createIdentityVerifier } = require('./identity');
const ROOT = path.resolve(__dirname, '../..');
const SOURCE_KEYS = ['business_operating_manual', 'canonical_source_map', 'buyer_lifecycle_sop', 'fub_system_runbook', 'ai_execution_runbook', 'lead_conversion_sop'];
const registry = require('../../governance/source-registry.json');
const sources = registry.sources.filter(s => SOURCE_KEYS.includes(s.key)).map(s => ({ title: s.title, url: `https://docs.google.com/document/d/${s.file_id}/edit` }));

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Use JSON for workspace actions.');
  let bytes = 0, chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 40000) throw new Error('The request is too large.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createServer({ port = 4317, demo = false, connectionFactory, invoke, hosting = null, store = null, interpreter = null } = {}) {
  if (hosting && (demo || !store || !/^https:\/\/[^/]+$/.test(hosting.origin) || !hosting.subject)) throw new Error('Hosted mode requires an HTTPS origin, approved owner and protected persistent storage.');
  const sessions = new Map();
  let callbackServer;
  let saving = false;
  const origin = hosting?.origin || `http://127.0.0.1:${port}`;
  const host = new URL(origin).host;
  const cookieName = hosting ? '__Host-buyer_session' : 'buyer_session';
  const config = hosting ? { ...CONFIG, callback: `${origin}/auth/callback` } : CONFIG;
  const verifyAccess = hosting ? createIdentityVerifier({ subject: hosting.subject }) : null;
  const cookieHeader = (id, seconds) => `${cookieName}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${hosting ? '; Secure' : ''}`;
  function persist(s) {
    if (!store) return;
    store.put(s.id, { id: s.id, subject: hosting?.subject, csrf: s.csrf, expires: s.expires, absoluteExpiry: s.absoluteExpiry, authenticated: s.authenticated, connection: s.connection.exportState(), engine: s.engine?.exportState() }, s.expires);
  }
  function attach(s, state = null) {
    const savedConnection = state?.connection, savedEngine = state?.engine;
    s.connection = connectionFactory ? connectionFactory() : new FubConnection({ config, verifyAccess, checkpoint: () => persist(s) });
    if (savedConnection) s.connection.restoreState(savedConnection);
    s.engine = (demo || s.authenticated) ? new BuyerWorkspace({ invoke: invoke || (demo ? createDemo() : (t, a) => s.connection.call(t, a)), tools: demo ? TOOLS : s.connection.available, mode: demo ? 'demo' : 'live', checkpoint: () => persist(s) }) : null;
    if (savedEngine && s.engine) s.engine.restoreState(savedEngine);
    if (!s.running) s.engine?.pruneContext();
    return s;
  }
  const assets = {
    '/': ['public/index.html', 'text/html; charset=utf-8'],
    '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
    '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
    '/wordmark.svg': ['../open-house/templates/assets/blaise-wordmark.svg', 'image/svg+xml'],
    '/source.ttf': ['../open-house/templates/assets/SourceSans3.ttf', 'font/ttf'],
    '/libre.ttf': ['../open-house/templates/assets/LibreBaskerville.ttf', 'font/ttf'],
  };
  const headers = res => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Permissions-Policy', 'microphone=(), camera=(), geolocation=()');
    if (hosting) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  };
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
  const cookie = req => new RegExp(`(?:^|; )${cookieName}=([A-Za-z0-9_-]{40,80})(?:;|$)`).exec(req.headers.cookie || '')?.[1];
  const releaseCallback = () => { if (callbackServer && ![...sessions.values()].some(s => s.connection.pending)) { callbackServer.close(); callbackServer = null; } };
  const prune = () => { for (const [id, s] of sessions) { if (s.expires < Date.now() && !s.running) { s.connection.clear(); sessions.delete(id); store?.delete(id); } else if (!s.running) { if (s.connection.pending?.expires < Date.now()) s.connection.pending = null; s.engine?.pruneContext(); if (s.authenticated) persist(s); } } store?.prune(); releaseCallback(); };
  function getSession(req, res) {
    prune();
    let id = cookie(req), s = sessions.get(id);
    if (!s && id && store) { const old = store.get(id); if (old?.subject === hosting.subject) { s = attach(old, old); sessions.set(id, s); } }
    if (!s) {
      if (sessions.size >= (hosting ? 200 : 20)) throw new Error('The workspace is busy. Try again shortly.');
      id = random();
      s = attach({ id, csrf: random(), expires: Date.now() + (hosting ? 10 : 30) * 60 * 1000, authenticated: false });
      sessions.set(id, s);
      res.setHeader('Set-Cookie', cookieHeader(id, hosting ? 600 : 1800));
    } else if (hosting && s.authenticated) {
      s.expires = Math.min(s.absoluteExpiry, Date.now() + 7 * 24 * 60 * 60 * 1000);
      res.setHeader('Set-Cookie', cookieHeader(id, Math.floor((s.expires - Date.now()) / 1000)));
    }
    return s;
  }
  const callback = async (req, res) => {
    headers(res);
    if (req.headers.host !== (hosting ? host : '127.0.0.1:57185') || req.method !== 'GET') { res.writeHead(403); res.end(); return; }
    let s;
    let ownsLock = false;
    try {
      const url = new URL(req.url, config.callback), id = cookie(req);
      s = sessions.get(id);
      if (!s && id && store) { const old = store.get(id); if (old?.subject === hosting.subject) { s = attach(old, old); sessions.set(id, s); } }
      if (url.pathname !== new URL(config.callback).pathname || !s || s.running || s.expires < Date.now()) throw new Error('Sign-in session expired.');
      s.running = true;
      ownsLock = true;
      await s.connection.finish(url, s.id);
      s.authenticated = true;
      s.engine = new BuyerWorkspace({ invoke: (t, a) => s.connection.call(t, a), tools: s.connection.available, checkpoint: () => persist(s) });
      if (hosting) {
        sessions.delete(s.id); store.delete(s.id);
        s.id = random(); s.csrf = random(); s.absoluteExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; s.expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
        sessions.set(s.id, s); res.setHeader('Set-Cookie', cookieHeader(s.id, 7 * 24 * 60 * 60));
      }
      persist(s);
      res.writeHead(303, { Location: origin }); res.end();
    } catch { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Sign-in did not complete. Return to the buyer workspace and reconnect FUB.'); }
    finally { if (s && ownsLock) s.running = false; releaseCallback(); }
  };
  const ensureCallback = async () => {
    if (callbackServer) return;
    const listener = http.createServer(callback);
    await new Promise((resolve, reject) => {
      listener.once('error', () => reject(new Error('The existing FUB callback port is in use. Finish the other sign-in, then try again.')));
      listener.listen(57185, '127.0.0.1', resolve);
    });
    callbackServer = listener;
  };
  const server = http.createServer(async (req, res) => {
    headers(res);
    let url;
    try { url = new URL(req.url, origin); } catch { json(res, 400, { error: 'Invalid request address.' }); return; }
    if (hosting && url.pathname === '/auth/callback') { await callback(req, res); return; }
    // Public shell links can arrive from another site. Private API requests and
    // all mutations remain confined to this exact origin and secure session.
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] === 'cross-site' && url.pathname.startsWith('/api/'))) { json(res, 403, { error: 'This workspace accepts only its own browser origin.' }); return; }
    let s, ownsLock = false;
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') { json(res, 200, { ok: true }); return; }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname];
        res.writeHead(200, { 'Content-Type': type }); res.end(await fs.readFile(path.join(__dirname, file))); return;
      }
      s = getSession(req, res);
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const connected = !!s.engine && (demo || !!s.connection.tokens);
        const recovery = connected ? [...s.engine.proposals.values()].filter(p => p.attempted && Date.parse(p.createdAt) > Date.now() - 86400000).map(p => s.engine.publicProposal(p)) : [];
        persist(s);
        json(res, 200, { mode: demo ? 'demo' : 'live', connected, csrf: s.csrf, expiresAt: new Date(Math.min(s.expires, Date.now() + 1800000)).toISOString(), sources, recovery, aiEnabled: !!interpreter, governanceReviewedAt: '2026-09-17T00:44:13Z', governanceNote: 'Source content was retrieved through the connected Drive tool during this build. This app does not refresh Drive automatically.', connection: 'Existing full FUB MCP · OAuth with PKCE', privacy: hosting ? 'Sign-in is encrypted on the server, with a seven-day idle limit and a thirty-day maximum. Working context expires after 30 minutes; approved save receipts remain for up to 24 hours for recovery. End session clears this browser’s server session. No audio or browser drafts are stored.' : 'Session data and sign-in tokens remain in server memory and expire after 30 minutes or when you end the session.', mobileGap: hosting ? 'Hosted HTTPS workspace. FUB access uses the existing Render service; your computer is not needed.' : 'Phone layout is supported. This local URL opens only on this computer; a remote HTTPS deployment with an approved web login is not configured.' }); return;
      }
      if (req.method === 'POST') {
        if (req.headers.origin !== origin || req.headers['x-workspace-csrf'] !== s.csrf) { json(res, 403, { error: 'Refresh the workspace to restore its secure session.' }); return; }
        const input = await body(req);
        if (s.running) { json(res, 409, { error: 'Wait for the current workspace action to finish.' }); return; }
        s.running = true;
        ownsLock = true;
        if (url.pathname === '/api/connect') { const loginUrl = await s.connection.start(s.id); if (!hosting) await ensureCallback(); persist(s); json(res, 200, { url: loginUrl }); return; }
        if (url.pathname === '/api/logout') { s.connection.clear(); sessions.delete(s.id); store?.delete(s.id); res.setHeader('Set-Cookie', cookieHeader('', 0)); json(res, 200, { cleared: true }); s = null; return; }
        if (!s.engine || (!demo && !s.connection.tokens)) { json(res, 401, { error: 'Connect FUB to open the buyer workspace.' }); return; }
        let result;
        if (url.pathname === '/api/buyers') result = await s.engine.buyers({ query: input.query });
        else if (url.pathname === '/api/connection-check' && !demo) result = await s.connection.check();
        else if (url.pathname === '/api/brief') result = await s.engine.brief(Number(input.id));
        else if (url.pathname === '/api/draft') { result = s.engine.draft(input); if (interpreter) result = await interpreter(result); }
        else if (url.pathname === '/api/review') result = s.engine.review(input);
        else if (url.pathname === '/api/save') { if (saving) throw new Error('A save is active in another session. Check its result before continuing.'); saving = true; try { result = await s.engine.save(input); } finally { saving = false; } }
        else if (url.pathname === '/api/reconcile') result = await s.engine.reconcile(input.id);
        else { json(res, 404, { error: 'Unknown workspace action.' }); return; }
        persist(s); json(res, 200, result); return;
      }
      json(res, 404, { error: 'Not found.' });
    } catch (error) {
      // Errors from our validators contain no raw provider payloads, credentials or feedback.
      json(res, 400, { error: error.message.startsWith('Unexpected') ? 'Could not read the request.' : error.message });
    } finally { if (s && ownsLock) s.running = false; }
  });
  const timer = setInterval(prune, 60000); timer.unref();
  server.on('close', () => { clearInterval(timer); for (const s of sessions.values()) s.connection.clear(); sessions.clear(); callbackServer?.close(); });
  return server;
}

if (require.main === module) {
  const demo = process.argv.includes('--demo');
  const server = createServer({ demo });
  server.on('error', () => { console.error('Buyer workspace could not start. Check whether port 4317 is already in use.'); process.exitCode = 1; });
  server.listen(4317, '127.0.0.1', () => console.log(`Buyer workspace: http://127.0.0.1:4317 · ${demo ? 'SYNTHETIC DEMO — no FUB access' : 'Connect the existing FUB account in the browser'}`));
}
module.exports = { createServer, ROOT };
