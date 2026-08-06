// Runs the complete big.js test suite (17 method files) against fastdecimal.
// Reimplements the helpers from big.js's test/test.js with the same API and
// substitutes the global Big with fastdecimal.
import { createRequire } from 'node:module';
import Big from '../src/big.ts';
const require = createRequire(import.meta.url);

const METHODS = [
  'abs',
  'cmp',
  'div',
  'minus',
  'mod',
  'neg',
  'plus',
  'pow',
  'prec',
  'round',
  'sqrt',
  'times',
  'toExponential',
  'toFixed',
  'toNumber',
  'toPrecision',
  'toString',
];

let passed = 0,
  count = 0,
  failures = [];

function isBigZero(n) {
  return n && n.c && n.c.length === 1 && n.c[0] === 0 && n.e === 0 && (n.s === 1 || n.s === -1);
}
function fail(expected, actual) {
  failures.push({ n: count, expected: String(expected), actual: String(actual) });
}
const test = function (name, func) {
  passed = count = 0;
  failures = [];
  func();
  test.result = [passed, count];
  console.log(`${passed === count ? 'PASS' : 'FAIL'} ${name}: ${passed}/${count}`);
  for (const f of failures.slice(0, 5)) console.log(`   #${f.n} expected=${f.expected} actual=${f.actual}`);
  if (failures.length > 5) console.log(`   ... and ${failures.length - 5} more`);
};
test.areEqual = (expected, actual) => {
  ++count;
  if (expected === actual || (expected !== expected && actual !== actual)) ++passed;
  else fail(expected, actual);
};
test.isNegativeZero = a => {
  ++count;
  if (isBigZero(a) && a.s === -1) ++passed;
  else fail('negative zero', a);
};
test.isPositiveZero = a => {
  ++count;
  if (isBigZero(a) && a.s === 1) ++passed;
  else fail('positive zero', a);
};
test.isTrue = a => {
  ++count;
  if (a === true) ++passed;
  else fail('true', a);
};
test.isFalse = a => {
  ++count;
  if (a === false) ++passed;
  else fail('false', a);
};
test.isException = (func, msg) => {
  ++count;
  let actual;
  try {
    func();
  } catch (e) {
    actual = e;
  }
  if (actual instanceof Error && /\[big\.js\]/.test(actual.message)) ++passed;
  else fail(msg + ' (expected an exception)', actual || 'no exception');
};
test.write = () => {};

globalThis.test = test;
globalThis.Big = Big;

let totalPassed = 0,
  totalCount = 0,
  fileFails = 0;
for (const m of METHODS) {
  // Reset settings before each file (test files mutate DP/RM/NE/PE)
  Big.DP = 20;
  Big.RM = 1;
  Big.NE = -7;
  Big.PE = 21;
  Big.strict = false;
  try {
    require(`./vendored/methods/${m}.js`);
    totalPassed += test.result[0];
    totalCount += test.result[1];
    if (test.result[0] !== test.result[1]) fileFails++;
  } catch (e) {
    console.log(`ERROR ${m}: ${e.message}`);
    fileFails++;
  }
}
console.log(`\nTotal: ${totalPassed}/${totalCount} (${((totalPassed / totalCount) * 100).toFixed(2)}%)`);
process.exit(fileFails === 0 && totalPassed === totalCount ? 0 : 1);
