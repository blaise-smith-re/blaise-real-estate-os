'use strict';

const { createPublicKey, verify } = require('node:crypto');
const { CONFIG } = require('./connection');

// Verify the same Auth0 API access token the existing MCP accepts. No browser
// token storage, new OIDC scopes, user-info scraping or email guessing is needed.
function createIdentityVerifier({ subject, fetcher = fetch, now = Date.now }) {
  if (!subject || typeof subject !== 'string') throw new Error('An exact approved Auth0 owner identity is required.');
  let cached;
  return async token => {
    let header, claims, parts;
    try { parts = token.split('.'); header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
    catch { throw new Error('The sign-in token could not be verified.'); }
    if (parts.length !== 3 || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.jku || header.x5u) throw new Error('The sign-in token uses an unsupported verification method.');
    if (!cached || cached.expires < now() || !cached.keys.some(k => k.kid === header.kid)) {
      const r = await fetcher(`${CONFIG.issuer}.well-known/jwks.json`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('The sign-in provider’s verification keys are unavailable.');
      const data = await r.json();
      if (!Array.isArray(data.keys)) throw new Error('The sign-in provider’s keys are invalid.');
      cached = { keys: data.keys.filter(k => k.kty === 'RSA' && k.use === 'sig' && (!k.alg || k.alg === 'RS256')), expires: now() + 3600000 };
    }
    const key = cached.keys.find(k => k.kid === header.kid);
    if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('The sign-in token signature is invalid.');
    const seconds = now() / 1000, audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== CONFIG.issuer || !audience.includes(CONFIG.endpoint) || claims.sub !== subject || !Number.isFinite(claims.exp) || claims.exp <= seconds || (claims.nbf != null && claims.nbf > seconds + 30)) throw new Error('This workspace is restricted to its approved business owner.');
    const scopes = String(claims.scope || '').split(' ');
    if (!['fub:read', 'fub:write'].every(s => scopes.includes(s))) throw new Error('The required FUB read and internal-write permissions were not granted.');
    return { subject: claims.sub };
  };
}
module.exports = { createIdentityVerifier };
