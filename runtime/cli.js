#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateRegistryBundle } = require('./registries');
const { normalizeEffects, SCHEMA_VERSION } = require('./contract');
const { runSyntheticFubReadCertification } = require('./certification/fub-read');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function check() {
  const bootstrap = readJson('runtime/bootstrap.json');
  const fixture = readJson('tests/fixtures/runtime-foundation.json');
  if (bootstrap.contract !== SCHEMA_VERSION) throw new Error('bootstrap contract version mismatch');
  if (bootstrap.mode !== 'READ_AND_INTERNAL_WRITE' || bootstrap.trigger_policy !== 'MANUAL_ONLY') {
    throw new Error('bootstrap must declare READ_AND_INTERNAL_WRITE and MANUAL_ONLY');
  }
  const budget = normalizeEffects(bootstrap.effect_budget);
  if (budget.external_writes > 2 || budget.schedules_created > 1 ||
      budget.external_messages !== 0 || budget.money_moved !== 0) {
    throw new Error('bootstrap exceeds internal-maintenance effect limits');
  }
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
