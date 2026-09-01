#!/usr/bin/env node
/**
 * Single gate: runs every offline suite. Exit 0 only if all pass.
 *
 *   node tests/run-all.js
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['static', 'run-static-tests.js'],
  ['timezone', 'run-timezone-tests.js'],
];

let failed = 0;
const summary = [];
for (const [name, file] of SUITES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  summary.push(`${ok ? 'PASS' : 'FAIL'}  ${name} (${file})`);
}
console.log('='.repeat(62));
console.log('ALL SUITES');
for (const l of summary) console.log('  ' + l);
console.log(`${SUITES.length - failed}/${SUITES.length} suites passed`);
console.log('='.repeat(62) + '\n');
process.exit(failed === 0 ? 0 : 1);
