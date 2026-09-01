/**
 * Google API client: OAuth token management + HTTP transport.
 *
 * Zero dependencies. Node's global fetch does the HTTP; the OAuth refresh-token exchange is a
 * single form POST. See docs/DECISIONS.md D-001 for why there is no googleapis SDK here.
 *
 * Security invariants enforced in this file:
 *   - No token, client secret, or refresh token is ever returned, logged, or thrown.
 *   - Every error is scrubbed through `redact()` before it can escape.
 *   - Writes fail closed: read-only mode is the default and is checked at dispatch, not here.
 */

'use strict';

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
export const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
export const DOCS_BASE = 'https://docs.googleapis.com/v1';

/**
 * Least-privilege scope set. See docs/OAUTH-SETUP.md for why `drive` (not `drive.file`) is
 * unavoidable: `drive.file` only grants access to files the app itself created, and every
 * canonical Blaise document predates this server.
 */
export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive',          // metadata read, copy, rename, move
  'https://www.googleapis.com/auth/documents',      // Docs read + batchUpdate
  'https://www.googleapis.com/auth/userinfo.email', // account-binding check only
];

/** Values that must never appear in any message that leaves this process. */
const SECRET_ENV = [
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_OAUTH_CLIENT_ID',
];

/**
 * Live secret values, registered by every GoogleClient at construction.
 *
 * `redact()` is called from `GoogleApiError`'s constructor, which has no access to an injected
 * env — so defaulting to `process.env` silently fails to redact whenever credentials come from
 * anywhere else (a test harness, a secrets manager, a multi-tenant host). Registering the values
 * makes redaction independent of where they came from. Adversarial A-36 caught exactly this.
 */
const REGISTERED_SECRETS = new Set();

export function registerSecrets(env = {}) {
  for (const key of SECRET_ENV) {
    const v = env[key];
    if (typeof v === 'string' && v.length >= 8) REGISTERED_SECRETS.add(v);
  }
}

/** Strip anything credential-shaped out of a string. Belt and braces. */
export function redact(text, env = process.env) {
  let out = String(text ?? '');
  for (const key of SECRET_ENV) {
    const v = env[key];
    if (v && v.length >= 8) out = out.split(v).join(`<${key}:redacted>`);
  }
  for (const v of REGISTERED_SECRETS) {
    if (out.includes(v)) out = out.split(v).join('<credential:redacted>');
  }
  // Bearer tokens and Google-shaped tokens, even ones we never held.
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer <redacted>');
  out = out.replace(/ya29\.[A-Za-z0-9._~+/-]+/g, '<access-token:redacted>');
  out = out.replace(/1\/\/[A-Za-z0-9._~+/-]{20,}/g, '<refresh-token:redacted>');
  out = out.replace(/"(access_token|refresh_token|id_token|client_secret)"\s*:\s*"[^"]*"/g,
    '"$1":"<redacted>"');
  return out;
}

/** A Google API error with a stable, testable `code`. */
export class GoogleApiError extends Error {
  constructor(code, message, { status = null, reason = null, retryable = false } = {}) {
    super(redact(message));
    this.name = 'GoogleApiError';
    this.code = code;
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
  }
}

/**
 * Map an HTTP failure onto a stable error code. These codes are what the adversarial suite
 * asserts on, so they are part of the contract — do not rename them casually.
 */
export function classifyHttpError(status, body) {
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || null;
  const message = body?.error?.message || `HTTP ${status}`;
  switch (status) {
    case 400:
      // Docs returns 400 for a failed requiredRevisionId precondition.
      if (/revision/i.test(message)) {
        return new GoogleApiError('STALE_REVISION', message, { status, reason });
      }
      return new GoogleApiError('BAD_REQUEST', message, { status, reason });
    case 401:
      return new GoogleApiError('AUTH_EXPIRED', message, { status, reason, retryable: true });
    case 403:
      if (/rateLimit|userRateLimitExceeded|quota/i.test(reason || message)) {
        return new GoogleApiError('RATE_LIMITED', message, { status, reason, retryable: true });
      }
      return new GoogleApiError('PERMISSION_DENIED', message, { status, reason });
    case 404:
      return new GoogleApiError('NOT_FOUND', message, { status, reason });
    case 409:
      return new GoogleApiError('CONFLICT', message, { status, reason });
    case 429:
      return new GoogleApiError('RATE_LIMITED', message, { status, reason, retryable: true });
    default:
      if (status >= 500) {
        return new GoogleApiError('BACKEND_ERROR', message, { status, reason, retryable: true });
      }
      return new GoogleApiError('UNKNOWN', message, { status, reason });
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Wrap a fetch so a stalled connection fails instead of hanging forever.
 *
 * Without this, a Google endpoint that accepts the connection and then goes quiet leaves the MCP
 * tool call pending indefinitely and the calling agent waiting on it. Protocol test P-08 caught
 * exactly that against a blocked network. `AbortSignal.timeout` is built in on Node 20+.
 */
async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return fetchImpl(url, options);
  try {
    return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new GoogleApiError('TIMEOUT',
        `request to Google timed out after ${timeoutMs}ms`, { retryable: true });
    }
    throw e;
  }
}

/**
 * Google API client.
 *
 * `fetchImpl` is injectable so the adversarial suite can drive a faithful in-memory fake of the
 * Drive/Docs REST surface without any network. That injection point is the reason the whole suite
 * can run offline — see test/fake-google.js.
 */
export class GoogleClient {
  constructor({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(),
                timeoutMs = Number(env.BLAISE_DRIVE_TIMEOUT_MS || 30000) } = {}) {
    this.timeoutMs = timeoutMs;
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.now = now;
    // Redaction must know these regardless of where they came from — see registerSecrets().
    registerSecrets(env);
    this._token = null;
    this._tokenExpiresAt = 0;
    this._verifiedAccount = null;
  }

  /** Config errors surface as a clear, credential-free message. */
  assertConfigured() {
    const missing = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN']
      .filter(k => !this.env[k]);
    if (missing.length) {
      throw new GoogleApiError('NOT_CONFIGURED',
        `missing environment variable(s): ${missing.join(', ')} — see .env.example`);
    }
  }

  get mode() {
    return this.env.BLAISE_DRIVE_MODE === 'read-write' ? 'read-write' : 'read-only';
  }

  /** Exchange the refresh token for an access token. Cached until 60s before expiry. */
  async accessToken({ force = false } = {}) {
    this.assertConfigured();
    if (!force && this._token && this.now() < this._tokenExpiresAt - 60_000) return this._token;

    const body = new URLSearchParams({
      client_id: this.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: this.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: this.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    });

    const res = await fetchWithTimeout(this.fetchImpl, TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }, this.timeoutMs);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // invalid_grant means the refresh token was revoked or expired — Blaise must re-consent.
      const code = json?.error === 'invalid_grant' ? 'REAUTH_REQUIRED' : 'AUTH_EXPIRED';
      throw new GoogleApiError(code,
        `token refresh failed: ${json?.error || res.status} ${json?.error_description || ''}`.trim(),
        { status: res.status });
    }
    this._token = json.access_token;
    this._tokenExpiresAt = this.now() + (Number(json.expires_in || 3600) * 1000);
    return this._token;
  }

  /**
   * Verify the credential belongs to the account this server is bound to.
   *
   * This is the wrong-account guard. A certified server pointed at the wrong Drive is exactly the
   * failure mode that produces a confident, verified-looking edit to somebody else's document.
   */
  async assertBoundAccount() {
    const expected = this.env.BLAISE_DRIVE_ACCOUNT_EMAIL;
    if (!expected) {
      throw new GoogleApiError('NOT_CONFIGURED',
        'BLAISE_DRIVE_ACCOUNT_EMAIL is not set — refusing to act against an unverified account');
    }
    if (this._verifiedAccount === expected) return expected;
    const info = await this.request('GET', USERINFO_ENDPOINT, { absolute: true });
    const actual = (info?.email || '').toLowerCase();
    if (actual !== expected.toLowerCase()) {
      throw new GoogleApiError('WRONG_ACCOUNT',
        `credential belongs to "${actual || 'unknown'}" but this server is bound to "${expected}"`);
    }
    this._verifiedAccount = expected;
    return expected;
  }

  /**
   * Authenticated request with bounded retry.
   *
   * Retries only genuinely transient classes (429, 5xx) plus a single forced token refresh on 401.
   * A 400/403/404 is never retried — repeating a rejected write is how duplicates get created.
   */
  async request(method, url, { body = null, query = null, absolute = false, maxRetries = 3 } = {}) {
    let target = absolute ? url : url;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null),
      ).toString();
      if (qs) target += (target.includes('?') ? '&' : '?') + qs;
    }

    let attempt = 0;
    let refreshed = false;
    for (;;) {
      const token = await this.accessToken({ force: refreshed });
      const res = await fetchWithTimeout(this.fetchImpl, target, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }, this.timeoutMs);

      if (res.status === 204) return null;
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;

      const err = classifyHttpError(res.status, json);

      // One forced re-auth, then treat 401 as terminal.
      if (err.code === 'AUTH_EXPIRED' && !refreshed) {
        refreshed = true;
        continue;
      }
      if (!err.retryable || attempt >= maxRetries) throw err;
      attempt++;
      await sleep(Math.min(2 ** attempt * 250, 4000));
    }
  }
}
