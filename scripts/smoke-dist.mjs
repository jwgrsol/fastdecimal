// Smoke test for the built dist/ output on the engines range (node >= 18).
// The source test suites import .ts directly (needs modern node type-stripping),
// so older engines are verified against the actual artifacts instead.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let failed = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    return;
  }
  failed++;
  console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
}

// CJS big facade — must behave like require('big.js')
const BigCjs = require('../dist/big.js');
check('cjs big', new BigCjs('0.1').plus('0.2').toString(), '0.3');
check('cjs big callable', BigCjs(2).toString(), '2');
check('cjs big clone', BigCjs().DP, 20);

// CJS core
const core = require('../dist/index.js');
check('cjs core', core.toString(core.add(core.parse('0.1'), core.parse('0.2'))), '0.3');
check('cjs core div', core.toString(core.divToDecimalPlaces(core.parse('1'), core.parse('3'), 5, 4)), '0.33333');

// ESM big facade + core
const { default: BigEsm } = await import('../dist/big.mjs');
check('esm big', new BigEsm('0.1').plus('0.2').toString(), '0.3');
const coreEsm = await import('../dist/index.mjs');
check('esm core', coreEsm.toString(coreEsm.mul(coreEsm.parse('1.5'), coreEsm.parse('-2'))), '-3');

if (failed > 0) {
  process.exit(1);
}
console.log(`dist smoke: all checks passed on node ${process.version}`);
