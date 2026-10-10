'use strict';

// Existing public native OAuth application; no Codex credential-store access,
// registration, client secret, API key, proxy or browser token extraction.
const { randomBytes, createHash } = require('node:crypto');
const { TOOLS } = require('./core');
const CONFIG = Object.freeze({
  endpoint: 'https://blaise-fub-mcp.onrender.com/mcp',
  issuer: 'https://dev-46mx1synzdk7ancf.us.auth0.com/',
  clientId: 'zVnhfzFBR7aX6np3JSAXf0Cnohu8fWuH',
  callback: 'http://127.0.0.1:57185/callback/Msr2-imGFcgW',
  scopes: 'fub:read fub:write offline_access',
});
const random = () => randomBytes(32).toString('base64url');
const safeFetch = (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) });

class FubConnection {
  constructor({ fetcher = safeFetch, config = CONFIG, checkpoint = () => {}, verifyAccess = null } = {}) {
    this.fetcher = fetcher;
    this.config = config;
    this.checkpoint = checkpoint;
    this.verifyAccess = verifyAccess;
    this.renewalPending = false;
    this.retryAfter = 0;
    this.tokens = null;
    this.pending = null;
    this.session = null;
    this.version = '2025-06-18';
    this.counter = 0;
    this.available = [];
    this.refreshing = null;
    this.initialized = false;
    this.initializing = null;
  }
  async start(browserId) {
    const CONFIG = this.config;
    const r = await this.fetcher(`${CONFIG.issuer}.well-known/oauth-authorization-server`);
    if (!r.ok) throw new Error('The existing sign-in provider is unavailable.');
    const m = await r.json();
    if (m.issuer !== CONFIG.issuer || m.authorization_endpoint !== `${CONFIG.issuer}authorize` || m.token_endpoint !== `${CONFIG.issuer}oauth/token` || !m.code_challenge_methods_supported?.includes('S256')) throw new Error('Sign-in metadata does not match the existing approved provider.');
    this.metadata = m;
    const state = random(), verifier = random();
    this.pending = { state, verifier, browserId, expires: Date.now() + 10 * 60 * 1000 };
    await this.checkpoint();
    const url = new URL(m.authorization_endpoint);
    url.search = new URLSearchParams({ response_type: 'code', client_id: CONFIG.clientId, redirect_uri: CONFIG.callback, resource: CONFIG.endpoint, scope: CONFIG.scopes, state, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
    return url.href;
  }
  async finish(url, browserId) {
    const CONFIG = this.config;
    const p = this.pending;
    this.pending = null;
    if (!p || p.expires < Date.now() || p.state !== url.searchParams.get('state') || p.browserId !== browserId || url.searchParams.has('error') || !url.searchParams.get('code') || (url.searchParams.has('iss') && url.searchParams.get('iss') !== CONFIG.issuer)) throw new Error('Sign-in expired or was not completed in this browser. Start again.');
    await this.tokenRequest({ grant_type: 'authorization_code', code: url.searchParams.get('code'), code_verifier: p.verifier, redirect_uri: CONFIG.callback });
    await this.initialize();
  }
  async tokenRequest(fields) {
    const CONFIG = this.config;
    if (fields.grant_type === 'refresh_token' && this.renewalPending) throw new Error('A prior renewal was interrupted. Sign in again to avoid reusing a rotated credential.');
    this.renewalPending = true;
    await this.checkpoint();
    let r, t;
    try {
      r = await this.fetcher(`${CONFIG.issuer}oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CONFIG.clientId, resource: CONFIG.endpoint, ...fields }) });
      t = await r.json();
    } catch { throw new Error('Sign-in renewal was interrupted. The stored connection was preserved, but sign-in may be required to avoid repeating an uncertain rotation.'); }
    if (!r.ok) {
      this.renewalPending = false;
      if (t.error === 'invalid_grant') { this.clear(); await this.checkpoint(); throw new Error('The sign-in provider expired or revoked this authorization. Sign in again.'); }
      this.retryAfter = Date.now() + 30000;
      await this.checkpoint();
      throw new Error('The sign-in provider is temporarily unavailable or its configuration needs attention. Your stored connection was preserved.');
    }
    if (!t.access_token || String(t.token_type).toLowerCase() !== 'bearer' || !Number.isFinite(t.expires_in) || t.expires_in <= 0) throw new Error('The provider did not return a usable session. Sign in again.');
    if (this.verifyAccess) await this.verifyAccess(t.access_token);
    this.tokens = { access: t.access_token, refresh: t.refresh_token || this.tokens?.refresh, expires: Date.now() + t.expires_in * 1000 };
    this.renewalPending = false;
    this.retryAfter = 0;
    // Rotation replacement is committed before any downstream CRM call.
    await this.checkpoint();
  }
  async access({ renew = false } = {}) {
    if (!this.tokens) throw new Error('Connect FUB first.');
    if (renew || this.tokens.expires - Date.now() < 60000) {
      if (this.retryAfter > Date.now()) throw new Error('The sign-in provider is recovering. Wait a moment and try again; no new login is needed yet.');
      if (!this.tokens.refresh) { this.clear(); throw new Error('Reconnect FUB to renew access.'); }
      // Rotation is serialized; never race the same refresh token.
      this.refreshing ||= this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.tokens.refresh }).finally(() => { this.refreshing = null; });
      await this.refreshing;
    }
    return this.tokens.access;
  }
  async check() {
    await this.access({ renew: true });
    const result = await this.call('get_stages', {});
    if (result?.isError) throw new Error('Sign-in renewed, but FUB did not confirm read access.');
    return { verifiedAt: new Date().toISOString() };
  }
  async rpc(method, params, notification = false) {
    const CONFIG = this.config;
    const id = notification ? undefined : ++this.counter;
    const headers = { Authorization: `Bearer ${await this.access()}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': this.version };
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    const r = await this.fetcher(CONFIG.endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', ...(id ? { id } : {}), method, params }) });
    if (r.status === 401) {
      // Do not discard a durable refresh credential because one access token was
      // rejected. Never replay a CRM call automatically after a failure.
      this.tokens.expires = 0; await this.checkpoint();
      throw new Error('FUB rejected the current access token. Refresh the brief to renew access; check any attempted save before continuing.');
    }
    if (r.status === 403) throw new Error('FUB denied this action. The connection is preserved; check the granted permissions.');
    if (!r.ok) throw new Error('FUB did not confirm the request. A write may still have occurred; use read-back before retrying.');
    if (r.headers.get('mcp-session-id')) this.session = r.headers.get('mcp-session-id');
    if (notification) { await r.body?.cancel(); return; }
    const check = m => { if (m.error) throw new Error('FUB rejected the request. Check access and review current state.'); return m.result; };
    if (r.headers.get('content-type')?.includes('application/json')) {
      const m = await r.json();
      if (m.id !== id) throw new Error('FUB response identity did not match.');
      return check(m);
    }
    if (!r.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Unsupported FUB response.');
    const reader = r.body.getReader(), decoder = new TextDecoder();
    let buffer = '', bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 2 * 1024 * 1024) throw new Error('FUB response exceeded the bounded read limit.');
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        let split;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, split); buffer = buffer.slice(split + 2);
          const data = event.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
          if (!data) continue;
          const m = JSON.parse(data);
          if (m.id === id) return check(m);
        }
      }
    } finally { await reader.cancel().catch(() => {}); }
    throw new Error('FUB response ended without confirmation. Read back before retrying any write.');
  }
  async initialize() {
    this.session = null;
    const r = await this.rpc('initialize', { protocolVersion: this.version, capabilities: {}, clientInfo: { name: 'blaise-buyer-workspace', version: '0.1.0' } });
    if (!['2025-03-26', '2025-06-18', '2025-11-25'].includes(r?.protocolVersion)) throw new Error('The FUB protocol version is not supported by this workspace.');
    this.version = r.protocolVersion;
    await this.rpc('notifications/initialized', {}, true);
    const list = await this.rpc('tools/list', {});
    this.available = (list.tools || []).map(t => t.name).filter(t => TOOLS.includes(t));
    this.initialized = true;
  }
  async call(tool, args) {
    if (!this.initialized) { this.initializing ||= this.initialize().finally(() => { this.initializing = null; }); await this.initializing; }
    if (!TOOLS.includes(tool) || !this.available.includes(tool)) throw new Error('That action is outside the buyer workspace connection.');
    return this.rpc('tools/call', { name: tool, arguments: args });
  }
  exportState() { return { tokens: this.tokens, pending: this.pending, version: this.version, available: this.available, renewalPending: this.renewalPending, retryAfter: this.retryAfter }; }
  restoreState(state) { for (const key of ['tokens', 'pending', 'version', 'available', 'renewalPending', 'retryAfter']) if (state?.[key] !== undefined) this[key] = state[key]; this.session = null; this.initialized = false; }
  clear() { this.tokens = null; this.pending = null; this.session = null; this.available = []; this.renewalPending = false; this.retryAfter = 0; this.initialized = false; }
}
module.exports = { FubConnection, CONFIG, random };
