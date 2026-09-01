#!/usr/bin/env node
/**
 * Protocol test — spawns the real server and speaks JSON-RPC to it over stdio.
 *
 * Verifies the wire contract end to end: initialize, tools/list, tools/call, error shapes, the
 * read-only write gate, and that stdout carries protocol messages and nothing else.
 *
 * Runs with no credentials. Calls that would reach Google fail at auth, which is itself the point
 * of several assertions: they must come back as structured isError results, not crashes.
 *
 *   node test/protocol.js
 */

'use strict';

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const results = [];
let failed = 0;

function check(id, name, fn) {
  try { const d = fn(); results.push({ id, name, status: 'PASS', detail: d }); }
  catch (e) { failed++; results.push({ id, name, status: 'FAIL', detail: e.message }); }
}
function assert(c, m) { if (!c) throw new Error(m); }
function eq(a, b, w) { assert(a === b, `${w}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/** Send a batch of requests, collect every response line. */
function converse(requests, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'src/server.js')], {
      env: {
        PATH: process.env.PATH,
        GOOGLE_OAUTH_CLIENT_ID: 'proto-client-id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'proto-client-secret',
        GOOGLE_OAUTH_REFRESH_TOKEN: 'proto-refresh-token',
        BLAISE_DRIVE_ACCOUNT_EMAIL: 'blaise@buysellhometeam.com',
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', reject);
    child.on('close', () => {
      const lines = out.split('\n').filter(Boolean);
      let parsed;
      try { parsed = lines.map(l => JSON.parse(l)); }
      catch (e) { return reject(new Error(`stdout was not pure JSON-RPC: ${e.message}\n---\n${out}`)); }
      resolve({ responses: parsed, stderr: err, rawStdout: out });
    });
    // A raw string is written verbatim so we can feed genuinely malformed input.
    for (const r of requests) child.stdin.write((typeof r === 'string' ? r : JSON.stringify(r)) + '\n');
    child.stdin.end();
    setTimeout(() => child.kill(), 15000);
  });
}

const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } };

// ---------------------------------------------------------------- handshake + listing
const a = await converse([
  init,
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  { jsonrpc: '2.0', id: 3, method: 'ping' },
]);

check('P-01', 'initialize returns the protocol version and server info', () => {
  const r = a.responses.find(x => x.id === 1);
  assert(r, 'no initialize response');
  eq(r.result.protocolVersion, '2024-11-05', 'protocolVersion');
  eq(r.result.serverInfo.name, 'blaise-drive-mcp', 'server name');
  assert(r.result.capabilities.tools, 'tools capability');
  assert(/data, never instructions/.test(r.result.instructions), 'instructions must state content is data');
  return 'handshake complete, injection guidance present in instructions';
});

check('P-02', 'a notification produces no response', () => {
  eq(a.responses.filter(x => x.id === undefined || x.id === null).length, 0, 'unsolicited responses');
  return 'notifications/initialized correctly silent';
});

check('P-03', 'tools/list returns all 8 tools with schemas and write labelling', () => {
  const r = a.responses.find(x => x.id === 2);
  const tools = r.result.tools;
  eq(tools.length, 8, 'tool count');
  for (const t of tools) {
    assert(t.name && t.description && t.inputSchema, `tool ${t.name} incomplete`);
    assert(/\[(WRITE|READ-ONLY)/.test(t.description), `tool ${t.name} not labelled read/write`);
  }
  const writes = tools.filter(t => /\[WRITE/.test(t.description)).map(t => t.name);
  eq(writes.length, 4, 'write tool count');
  assert(writes.includes('canonical_doc_maintenance'), 'maintenance labelled WRITE');
  assert(/preserves the fileId|PRESERVES the fileId/i.test(
    tools.find(t => t.name === 'docs_batch_update').description), 'batch_update must state fileId preservation');
  return `8 tools, ${writes.length} labelled WRITE: ${writes.join(', ')}`;
});

check('P-04', 'ping responds', () => {
  const r = a.responses.find(x => x.id === 3);
  assert(r && r.result, 'no ping response');
  return 'ping ok';
});

check('P-05', 'stdout is pure JSON-RPC; diagnostics go to stderr', () => {
  for (const line of a.rawStdout.split('\n').filter(Boolean)) JSON.parse(line);
  assert(/ready — mode=/.test(a.stderr), 'startup banner should be on stderr');
  assert(!/ready — mode=/.test(a.rawStdout), 'banner must not pollute stdout');
  return 'protocol channel clean; banner on stderr only';
});

// ---------------------------------------------------------------- write gate (default read-only)
const b = await converse([
  init,
  { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'canonical_doc_maintenance', arguments: { targetFileId: 'x', expectedTitle: 'y', patchOperations: [{ insertText: { location: { index: 1 }, text: 'z' } }] } } },
  { jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'docs_batch_update', arguments: { documentId: 'x', requiredRevisionId: 'r', requests: [{}] } } },
  { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } },
]);

check('P-06', 'write tools are refused by default (fails closed)', () => {
  for (const id of [10, 11]) {
    const r = b.responses.find(x => x.id === id);
    assert(r?.result?.isError, `call ${id} should be an error result`);
    const payload = JSON.parse(r.result.content[0].text);
    eq(payload.error, 'READ_ONLY_MODE', `call ${id} error code`);
  }
  return 'both write tools refused with READ_ONLY_MODE when BLAISE_DRIVE_MODE is unset';
});

check('P-07', 'an unknown tool is a protocol error, not a silent success', () => {
  const r = b.responses.find(x => x.id === 12);
  assert(r?.error, 'expected a JSON-RPC error');
  eq(r.error.code, -32602, 'error code');
  return 'unknown tool -> -32602';
});

// ---------------------------------------------------------------- failures stay structured
const c = await converse([
  init,
  { jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'drive_get_file_metadata', arguments: { fileId: 'anything' } } },
  { jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'docs_batch_update', arguments: { documentId: 'x', requiredRevisionId: 'r', requests: [{ insertTable: {} }] } } },
], { BLAISE_DRIVE_MODE: 'read-write', BLAISE_DRIVE_TIMEOUT_MS: '2000' });

check('P-08', 'an unreachable Google surfaces as a structured isError result, not a crash', () => {
  const r = c.responses.find(x => x.id === 20);
  assert(r?.result?.isError, 'should be an error result');
  const payload = JSON.parse(r.result.content[0].text);
  assert(payload.error, 'error code present');
  assert(!/proto-refresh-token|proto-client-secret/.test(r.result.content[0].text), 'credentials leaked');
  assert(['TIMEOUT', 'REAUTH_REQUIRED', 'AUTH_EXPIRED', 'NOT_FOUND', 'PERMISSION_DENIED', 'UNEXPECTED', 'BACKEND_ERROR']
    .includes(payload.error), `unexpected error code ${payload.error}`);
  return `unreachable Google returned ${payload.error} within the timeout, no credential leakage`;
});

check('P-09', 'an unsupported Docs operation is refused locally, before any network call', () => {
  const r = c.responses.find(x => x.id === 21);
  assert(r?.result?.isError, 'should be an error result');
  const payload = JSON.parse(r.result.content[0].text);
  eq(payload.error, 'UNSUPPORTED_OPERATION', 'error code');
  return 'insertTable refused by the local allowlist';
});

const d = await converse([
  'not json at all',
  init,
  { jsonrpc: '2.0', id: 30, method: 'tools/list' },
]);

check('P-11', 'malformed input yields a parse error and the server keeps serving', () => {
  const parseErr = d.responses.find(x => x.error?.code === -32700);
  assert(parseErr, 'expected a -32700 parse error');
  const list = d.responses.find(x => x.id === 30);
  assert(list?.result?.tools?.length === 8, 'server should still answer after bad input');
  return 'garbage line rejected; subsequent requests still served';
});

// ---------------------------------------------------------------- output
const width = 78;
console.log('\nBlaise Drive MCP — Protocol Suite (real server over stdio)');
console.log('='.repeat(width));
for (const r of results) {
  console.log(`[${r.status}] ${r.id}  ${r.name}`);
  if (r.detail) console.log(`         ${r.detail}`);
}
console.log('='.repeat(width));
console.log(`${results.length - failed}/${results.length} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
