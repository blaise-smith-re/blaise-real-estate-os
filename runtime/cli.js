#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateRegistryBundle } = require('./registries');
const { assertZeroEffects, SCHEMA_VERSION } = require('./contract');
const { runSyntheticFubReadCertification } = require('./certification/fub-read');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function check() {
  const bootstrap = readJson('runtime/bootstrap.json');
  const fixture = readJson('tests/fixtures/runtime-foundation.json');
  if (bootstrap.contract !== SCHEMA_VERSION) throw new Error('bootstrap contract version mismatch');
  if (bootstrap.mode !== 'READ_ONLY' || bootstrap.trigger_policy !== 'MANUAL_ONLY') {
    throw new Error('bootstrap must remain READ_ONLY and MANUAL_ONLY');
  }
  assertZeroEffects(bootstrap.effect_budget, 'bootstrap effect_budget');
  validateRegistryBundle(fixture);
  console.log('RUNTIME FOUNDATION CHECK: PASS');
  console.log(`contract=${bootstrap.contract} mode=${bootstrap.mode} trigger=${bootstrap.trigger_policy}`);
  console.log(`live_adapters=${bootstrap.live_adapters.length} persistence=${bootstrap.persistence}`);
}

async function main() {
  const command = process.argv[2] || 'check';
  if (command === 'check') {
    check();
    return;
  }
  if (command === 'certify:fub-read' && process.argv.includes('--synthetic')) {
    const report = await runSyntheticFubReadCertification();
    console.log('FUB READ ADAPTER SYNTHETIC CERTIFICATION: PASS');
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.error(`Unknown command: ${command}. Use: check | certify:fub-read --synthetic`);
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(`${error.code || error.name}: ${error.message}`);
  process.exitCode = 1;
});
