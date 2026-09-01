#!/usr/bin/env node
/** Single gate: every offline suite. Exit 0 only if all pass. */
'use strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [['adversarial', 'adversarial.js'], ['protocol', 'protocol.js']];

let failed = 0;
const summary = [];
for (const [name, file] of SUITES) {
  const r = spawnSync(process.execPath, [path.join(HERE, file)], { stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  summary.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}
console.log('='.repeat(78));
console.log('ALL SUITES');
for (const l of summary) console.log('  ' + l);
console.log(`${SUITES.length - failed}/${SUITES.length} suites passed`);
console.log('='.repeat(78) + '\n');
process.exit(failed === 0 ? 0 : 1);
