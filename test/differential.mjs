// Differential verification against upstream big.js (docs/core-contract.md §8.3):
// the same calls through the public API must produce identical observable results —
// return strings, s/c/e values, and thrown error messages.
//
// Layer 1: fixed cases covering surfaces the vendored suite exercises thinly
//          (interop, -0 rendering, clone isolation, strict mode).
// Layer 2: seeded random fuzzing across operations, DP, and RM. The seed is fixed
//          so failures reproduce; change FUZZ_SEED to explore a different region.
import { createRequire } from 'node:module';
import Fast from '../src/big.ts';
const require = createRequire(import.meta.url);
const Orig = require('big.js');

let passed = 0,
  failed = 0;
const failures = [];
function record(label, expected, actual) {
  if (String(expected) === String(actual)) {
    passed++;
  } else {
    failed++;
    failures.push({ label, expected: String(expected), actual: String(actual) });
  }
}
// Run fn against both constructors; observable outcome = return value or error message
function both(label, fn) {
  let expected, actual;
  try {
    expected = fn(Orig);
  } catch (e) {
    expected = 'throws: ' + e.message;
  }
  try {
    actual = fn(Fast);
  } catch (e) {
    actual = 'throws: ' + e.message;
  }
  record(label, expected, actual);
}

// ---- Layer 1: fixed cases ----
both('0.1 + 0.2', B => new B('0.1').plus('0.2').toString());
both('1 / 3 default DP', B => new B(1).div(3).toString());
both('sqrt 2', B => new B(2).sqrt().toString());
both('-7 mod 3', B => new B(-7).mod(3).toString());
both('2 ^ -3', B => new B(2).pow(-3).toString());
both('half-even 2.5', B => new B('2.5').round(0, 2).toString());
both('s of -123.45', B => new B('-123.45').s);
both('e of -123.45', B => new B('-123.45').e);
both('c of -123.45', B => JSON.stringify(new B('-123.45').c));
both('write e', B => {
  const x = new B('123.45');
  x.e = 5;
  return x.toString();
});
both('write c', B => {
  const x = new B('123.45');
  x.c = [9, 8, 7];
  return x.toString();
});
both('write s', B => {
  const x = new B('123.45');
  x.s = -1;
  return x.toString();
});
both('-0 s', B => new B('-0').s);
both('-0 valueOf', B => new B('-0').valueOf());
both('-0 toString', B => new B('-0').toString());
both('div by zero throws', B => new B(1).div(0).toString());
both('invalid string throws', B => new B('12.34.5').toString());
both('invalid rm throws', B => new B(1).round(0, 4).toString());
both('pow limit throws', B => new B(2).pow(1e6 + 1).toString());
both('sqrt negative throws', B => new B(-4).sqrt().toString());
both('strict number throws', B => {
  const C = B();
  C.strict = true;
  return new C(1.5).toString();
});
both('strict bigint ok', B => {
  const C = B();
  C.strict = true;
  return new C(10n).toString();
});
both('strict valueOf throws', B => {
  const C = B();
  C.strict = true;
  return new C('1').valueOf();
});
both('clone DP isolation', B => {
  const C = B();
  C.DP = 3;
  return [new C(1).div(3).toString(), new B(1).div(3).toString()].join('|');
});
both('NE/PE thresholds', B => {
  const C = B();
  C.PE = 3;
  return new C('1234').toString();
});
both('toFixed pads', B => new B('1.5').toFixed(5));
both('toExponential pads', B => new B('1.5').toExponential(4));
both('toPrecision', B => new B('12345.6789').toPrecision(5));
both('bigint input', B => new B(123456789012345678901234567890n).toString());
// a foreign object that merely carries a `coefficient`-like field must NOT be
// treated as an instance — both libraries reject it through the string path
both('foreign object throws', B => new B({ coefficient: 0.95 }).toString());
both('cross-clone instance accepted', B => {
  const C = B();
  return new B(new C('1.5')).plus('0.5').toString();
});
record(
  'interop: fastdecimal accepts big.js instance',
  '124',
  new Fast(new Orig('123.456')).plus(new Orig('0.544')).toString()
);

// ---- Layer 2: seeded fuzzing ----
const FUZZ_SEED = 0xfa57dec1;
const FUZZ_ITERATIONS = 3000;
let rndState = FUZZ_SEED;
const rnd = () => {
  rndState |= 0;
  rndState = (rndState + 0x6d2b79f5) | 0;
  let t = Math.imul(rndState ^ (rndState >>> 15), 1 | rndState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function randomDecimal() {
  // biased toward edge shapes: zeros, trailing zeros, long digits, exponents
  const roll = rnd();
  if (roll < 0.05) {
    return rnd() < 0.5 ? '0' : '-0';
  }
  const intDigits = 1 + Math.floor(rnd() * (roll < 0.5 ? 8 : 40));
  const fracDigits = Math.floor(rnd() * (roll < 0.5 ? 8 : 40));
  let s = rnd() < 0.5 ? '-' : '';
  for (let i = 0; i < intDigits; i++) {
    s += Math.floor(rnd() * 10);
  }
  if (rnd() < 0.2 && !fracDigits) {
    s += '0'.repeat(1 + Math.floor(rnd() * 4));
  } // trailing zeros
  if (fracDigits) {
    s += '.';
    for (let i = 0; i < fracDigits; i++) {
      s += Math.floor(rnd() * 10);
    }
  }
  if (rnd() < 0.15) {
    s += 'e' + (rnd() < 0.5 ? '-' : '+') + Math.floor(rnd() * 30);
  }
  return s;
}
const OPS = [
  (B, a, b) => new B(a).plus(b).valueOf(),
  (B, a, b) => new B(a).minus(b).valueOf(),
  (B, a, b) => new B(a).times(b).valueOf(),
  (B, a, b) => new B(a).div(b).valueOf(),
  (B, a, b) => new B(a).mod(b).valueOf(),
  (B, a, b) => new B(a).cmp(b),
  (B, a) => new B(a).pow(1 + Math.floor(Math.abs(Number(a.charCodeAt(1) ?? 3)) % 7)),
  (B, a) => new B(a).abs().sqrt().valueOf(),
  (B, a) => new B(a).round(Math.floor(a.length % 10)).valueOf(),
  (B, a) => new B(a).prec(1 + (a.length % 20)).valueOf(),
  (B, a) => new B(a).toFixed(a.length % 15),
  (B, a) => new B(a).toExponential(a.length % 15),
  (B, a) => new B(a).toPrecision(1 + (a.length % 15)),
  (B, a) => JSON.stringify([new B(a).s, new B(a).e, new B(a).c]),
];
const SQRT_OP = 7; // index into OPS
for (let i = 0; i < FUZZ_ITERATIONS; i++) {
  const a = randomDecimal(),
    b = randomDecimal();
  const dp = Math.floor(rnd() * 30),
    rm = Math.floor(rnd() * 4);
  let op = OPS[Math.floor(rnd() * OPS.length)];
  // Upstream big.js hangs (infinite Newton oscillation) when sqrt's result
  // exponent sits far below -DP, so those inputs cannot be compared — skip.
  // fastdecimal itself terminates there (iteration cap in core sqrt).
  if (OPS.indexOf(op) === SQRT_OP && new Orig(a).abs().e < -(dp + 2) * 2) {
    op = OPS[0];
  }
  Orig.DP = Fast.DP = dp;
  Orig.RM = Fast.RM = rm;
  let expected, actual;
  try {
    expected = op(Orig, a, b);
  } catch (e) {
    expected = 'throws: ' + e.message;
  }
  try {
    actual = op(Fast, a, b);
  } catch (e) {
    actual = 'throws: ' + e.message;
  }
  record(`fuzz#${i} dp=${dp} rm=${rm} a=${a} b=${b}`, expected, actual);
}
Orig.DP = Fast.DP = 20;
Orig.RM = Fast.RM = 1;

for (const f of failures.slice(0, 5)) {
  console.log(`DIFF ${f.label}\n  big.js      = ${f.expected}\n  fastdecimal = ${f.actual}`);
}
if (failures.length > 5) {
  console.log(`... and ${failures.length - 5} more`);
}
console.log(`differential vs upstream big.js: ${passed} passed, ${failed} failed (seed ${FUZZ_SEED.toString(16)})`);
process.exit(failed === 0 ? 0 : 1);
