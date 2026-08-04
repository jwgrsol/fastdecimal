// Unit tests for the v1 functional core (docs/core-contract.md §8.2)
// plus a differential check against the existing big.ts engine (§8.3).
import * as D from '../src/core/index.ts';
import Big from '../src/big.ts';

let passed = 0, failed = 0;
const show = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? `${x}n` : x));
function eq(label, actual, expected) {
  const ok = Object.is(actual, expected) || show(actual) === show(expected);
  if (ok) passed++;
  else { failed++; console.log(`FAIL ${label}\n  expected ${show(expected)}\n  actual   ${show(actual)}`); }
}
function throws(label, fn) {
  try { fn(); failed++; console.log(`FAIL ${label} (no exception)`); } catch { passed++; }
}
const str = (x) => D.toString(x);
const p = D.parse;

// ---- parse & normal form ----
eq('parse 123.4500', p('123.4500'), { sign: 1, coef: 12345n, scale: -2 });
eq('parse -0', p('-0'), { sign: -1, coef: 0n, scale: 0 });
eq('parse 1e3 normal form', p('1000'), { sign: 1, coef: 1n, scale: 3 });
eq('parse exp', p('-1.2e-5'), { sign: -1, coef: 12n, scale: -6 });
eq('parse +1.5', p('+1.5'), { sign: 1, coef: 15n, scale: -1 });
eq('parse NaN', D.isNaN(p('NaN')), true);
eq('parse -Infinity', p('-Infinity'), { sign: -1, coef: null, scale: 0 });
throws('parse abc', () => p('abc'));
throws('parse 1.2.3', () => p('1.2.3'));
throws('parse 1e', () => p('1e'));
throws('parse -NaN', () => p('-NaN'));

// ---- add / sub ----
eq('0.1 + 0.2', str(D.add(p('0.1'), p('0.2'))), '0.3');
eq('cancellation → +0', str(D.add(p('5'), p('-5'))), '0');
eq('(-0)+(-0) = -0', D.add(p('-0'), p('-0')).sign, -1);
eq('sub basic', str(D.sub(p('1'), p('0.999'))), '0.001');
eq('∞ + 1', str(D.add(D.infinity(1), p('1'))), 'Infinity');
eq('∞ + (−∞) = NaN', D.isNaN(D.add(D.infinity(1), D.infinity(-1))), true);
eq('NaN + 1 = NaN', D.isNaN(D.add(D.nan(), p('1'))), true);

// ---- mul ----
eq('1.5 × -2', str(D.mul(p('1.5'), p('-2'))), '-3');
eq('0 × -5 sign', D.mul(p('0'), p('-5')).sign, -1);
eq('∞ × 0 = NaN', D.isNaN(D.mul(D.infinity(1), p('0'))), true);
eq('−∞ × −2 = ∞', str(D.mul(D.infinity(-1), p('-2'))), 'Infinity');

// ---- divToDp (incl. special semantics, contract §4) ----
eq('1/3 dp20 HALF_UP', str(D.divToDp(p('1'), p('3'), 20, 4)), '0.33333333333333333333');
eq('2/3 dp2 DOWN', str(D.divToDp(p('2'), p('3'), 2, 1)), '0.66');
eq('2/3 dp2 UP', str(D.divToDp(p('2'), p('3'), 2, 0)), '0.67');
eq('1/0 = ∞', str(D.divToDp(p('1'), p('0'), 20, 4)), 'Infinity');
eq('-1/0 = −∞', str(D.divToDp(p('-1'), p('0'), 20, 4)), '-Infinity');
eq('0/0 = NaN', D.isNaN(D.divToDp(p('0'), p('0'), 20, 4)), true);
eq('1/∞ = 0', str(D.divToDp(p('1'), D.infinity(1), 20, 4)), '0');
eq('-1/∞ = -0', D.divToDp(p('-1'), D.infinity(1), 20, 4).sign, -1);
eq('∞/∞ = NaN', D.isNaN(D.divToDp(D.infinity(1), D.infinity(1), 20, 4)), true);

// ---- roundToDp: all 9 modes, sign-aware (contract §3) ----
// value 2.5 / -2.5 at dp 0
const modes = [
  //        UP   DOWN CEIL FLOOR H_UP H_DN H_EVEN H_CEIL H_FLOOR
  ['2.5',  ['3', '2', '3', '2',  '3', '2', '2',   '3',   '2']],
  ['-2.5', ['-3', '-2', '-2', '-3', '-3', '-2', '-2', '-2', '-3']],
  ['3.5',  ['4', '3', '4', '3',  '4', '3', '4',   '4',   '3']],
  ['2.4',  ['3', '2', '3', '2',  '2', '2', '2',   '2',   '2']],
  ['-2.4', ['-3', '-2', '-2', '-3', '-2', '-2', '-2', '-2', '-2']],
];
for (const [value, expected] of modes) {
  for (let rm = 0; rm <= 8; rm++) {
    eq(`round(${value}, 0, rm${rm})`, str(D.roundToDp(p(value), 0, rm)), expected[rm]);
  }
}
eq('round −0.4 CEIL keeps sign', D.roundToDp(p('-0.4'), 0, 2).sign, -1);
eq('round −0.4 CEIL is zero', D.roundToDp(p('-0.4'), 0, 2).coef, 0n);
eq('negative dp', str(D.roundToDp(p('12345'), -2, 4)), '12300');
eq('round NaN', D.isNaN(D.roundToDp(D.nan(), 0, 4)), true);

// ---- roundToSd ----
eq('999 sd1 → 1000', str(D.roundToSd(p('999'), 1, 4)), '1000');
eq('0.0001234 sd2', str(D.roundToSd(p('0.0001234'), 2, 4)), '0.00012');
eq('sd on zero', str(D.roundToSd(p('0'), 3, 4)), '0');

// ---- cmp ----
eq('cmp equal across scales', D.cmp(p('1.20'), p('1.2')), 0);
eq('cmp -0 vs 0', D.cmp(p('-0'), p('0')), 0);
eq('cmp NaN → NaN', Number.isNaN(D.cmp(D.nan(), p('1'))), true);
eq('cmp ∞ vs finite', D.cmp(D.infinity(1), p('1e100')), 1);
eq('cmp −∞ vs finite', D.cmp(D.infinity(-1), p('-1e100')), -1);
eq('cmp ∞ vs ∞', D.cmp(D.infinity(1), D.infinity(1)), 0);

// ---- toString ----
eq('toString exp threshold high', D.toString(p('1e21')), '1e+21');
eq('toString exp threshold low', D.toString(p('1e-7')), '1e-7');
eq('toString custom thresholds', D.toString(p('1234'), -7, 3), '1.234e+3');
eq('-0 signedZero=true', D.toString(p('-0')), '-0');
eq('-0 signedZero=false', D.toString(p('-0'), -7, 21, false), '0');

// ---- differential vs big.ts (§8.3): identical results on the overlapping surface ----
// big.js rm → core rm mapping (contract §3): {0→1, 1→4, 2→6, 3→0}
const RM_MAP = { 0: 1, 1: 4, 2: 6, 3: 0 };
let rndState = 0xdec1a1;
const rnd = () => {
  rndState |= 0; rndState = (rndState + 0x6d2b79f5) | 0;
  let t = Math.imul(rndState ^ (rndState >>> 15), 1 | rndState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randomDecimal = () => {
  const intDigits = 1 + Math.floor(rnd() * 25), fracDigits = Math.floor(rnd() * 25);
  let s = rnd() < 0.5 ? '-' : '';
  for (let i = 0; i < intDigits; i++) s += Math.floor(rnd() * 10);
  if (fracDigits) { s += '.'; for (let i = 0; i < fracDigits; i++) s += Math.floor(rnd() * 10); }
  return s;
};
// Render like big.js's toString: −0 prints as "0" (the signedZero facade parameter)
const strBig = (x) => D.toString(x, -7, 21, false);
let diffFails = 0;
for (let i = 0; i < 2000; i++) {
  const a = randomDecimal(), b = randomDecimal();
  const da = p(a), db = p(b), ba = new Big(a), bb = new Big(b);
  const bigRm = Math.floor(rnd() * 4);
  Big.RM = bigRm;
  const dp = Math.floor(rnd() * 30);
  Big.DP = dp;
  const cases = [
    ['add', strBig(D.add(da, db)), ba.plus(bb).toString()],
    ['sub', strBig(D.sub(da, db)), ba.minus(bb).toString()],
    ['mul', strBig(D.mul(da, db)), ba.times(bb).toString()],
    ['cmp', D.cmp(da, db), ba.cmp(bb)],
    ['round', strBig(D.roundToDp(da, dp, RM_MAP[bigRm])), ba.round(dp, bigRm).toString()],
  ];
  if (new Big(b).cmp(0) !== 0) {
    cases.push(['div', strBig(D.divToDp(da, db, dp, RM_MAP[bigRm])), ba.div(bb).toString()]);
  }
  for (const [op, core, legacy] of cases) {
    if (String(core) !== String(legacy)) {
      diffFails++; failed++;
      if (diffFails <= 5) console.log(`DIFF ${op}(${a}, ${b}) dp=${dp} rm=${bigRm}: core=${core} big.ts=${legacy}`);
    } else passed++;
  }
}
Big.DP = 20; Big.RM = 1;

console.log(`\ncore tests: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
