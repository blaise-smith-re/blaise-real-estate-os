'use strict';

// Dedicated single-instance web process on a persistent host. No local Codex,
// desktop/browser process or desktop credential store is involved.
const { ProtectedStore } = require('./protected-store');
const { createServer } = require('./server');
const { createInterpreter } = require('./interpretation');

function storageKey(env) {
  const key = env.WORKSPACE_ENCRYPTION_KEY, second = env.WORKSPACE_ENCRYPTION_KEY_PART_2;
  if (second === undefined) return key;
  // Render's dashboard generates 16 random bytes per value. Two independent
  // values preserve the required 256 bits without exposing them to the operator.
  if (!/^[a-f0-9]{32}$/i.test(key || '') || !/^[a-f0-9]{32}$/i.test(second) || key.toLowerCase() === second.toLowerCase()) {
    throw new Error('Protected storage needs two independently generated 32-character hexadecimal secrets.');
  }
  return key + second;
}

function start(env = process.env) {
  // Render supplies its assigned HTTPS URL before the first process starts.
  // Never infer this security boundary from untrusted request headers.
  const origin = env.WORKSPACE_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw new Error('Deployment is incomplete: configure an exact HTTPS origin or use Render’s assigned service URL.');
  for (const key of ['WORKSPACE_DATA_DIR', 'WORKSPACE_ENCRYPTION_KEY', 'WORKSPACE_OWNER_SUB', 'OPENAI_API_KEY', 'OPENAI_MODEL']) {
    if (!env[key]) throw new Error(`Deployment is incomplete: set ${key} in the hosting service, never in source control.`);
  }
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The listening port is invalid.');
  const store = new ProtectedStore({ directory: env.WORKSPACE_DATA_DIR, key: storageKey(env) });
  const interpreter = createInterpreter({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
  const server = createServer({ port, store, interpreter, hosting: { origin, subject: env.WORKSPACE_OWNER_SUB } });
  server.requestTimeout = 90000;
  server.headersTimeout = 10000;
  server.on('error', () => { console.error('The hosted workspace could not bind its configured port.'); store.close(); process.exitCode = 1; });
  server.listen(port, '0.0.0.0', () => console.log('Buyer workspace listening; private session and owner verification enabled.'));
  let stopping = false;
  const shutdown = () => { if (stopping) return; stopping = true; server.close(() => { store.close(); process.exit(0); }); setTimeout(() => process.exit(1), 95000).unref(); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  return server;
}
if (require.main === module) {
  try { start(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { start, storageKey };
