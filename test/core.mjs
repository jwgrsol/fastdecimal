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
eq('parse 123.4500', p('123.4500'), { sign: 1, coefficient: 12345n, scale: -2 });
eq('parse -0', p('-0'), { sign: -1, coefficient: 0n, scale: 0 });
eq('parse 1e3 normal form', p('1000'), { sign: 1, coefficient: 1n, scale: 3 });
eq('parse exp', p('-1.2e-5'), { sign: -1, coefficient: 12n, scale: -6 });
eq('parse +1.5', p('+1.5'), { sign: 1, coefficient: 15n, scale: -1 });
eq('parse NaN', D.isNaN(p('NaN')), true);
eq('parse -Infinity', p('-Infinity'), { sign: -1, coefficient: null, scale: 0 });
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

// ---- divToDecimalPlaces (incl. special semantics, contract §4) ----
eq('1/3 dp20 HALF_UP', str(D.divToDecimalPlaces(p('1'), p('3'), 20, 4)), '0.33333333333333333333');
eq('2/3 dp2 DOWN', str(D.divToDecimalPlaces(p('2'), p('3'), 2, 1)), '0.66');
eq('2/3 dp2 UP', str(D.divToDecimalPlaces(p('2'), p('3'), 2, 0)), '0.67');
eq('1/0 = ∞', str(D.divToDecimalPlaces(p('1'), p('0'), 20, 4)), 'Infinity');
eq('-1/0 = −∞', str(D.divToDecimalPlaces(p('-1'), p('0'), 20, 4)), '-Infinity');
eq('0/0 = NaN', D.isNaN(D.divToDecimalPlaces(p('0'), p('0'), 20, 4)), true);
eq('1/∞ = 0', str(D.divToDecimalPlaces(p('1'), D.infinity(1), 20, 4)), '0');
eq('-1/∞ = -0', D.divToDecimalPlaces(p('-1'), D.infinity(1), 20, 4).sign, -1);
eq('∞/∞ = NaN', D.isNaN(D.divToDecimalPlaces(D.infinity(1), D.infinity(1), 20, 4)), true);

// ---- roundToDecimalPlaces: all 9 modes, sign-aware (contract §3) ----
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
    eq(`round(${value}, 0, rm${rm})`, str(D.roundToDecimalPlaces(p(value), 0, rm)), expected[rm]);
  }
}
eq('round −0.4 CEIL keeps sign', D.roundToDecimalPlaces(p('-0.4'), 0, 2).sign, -1);
eq('round −0.4 CEIL is zero', D.roundToDecimalPlaces(p('-0.4'), 0, 2).coefficient, 0n);
eq('negative dp', str(D.roundToDecimalPlaces(p('12345'), -2, 4)), '12300');
eq('round NaN', D.isNaN(D.roundToDecimalPlaces(D.nan(), 0, 4)), true);

// ---- roundToSignificantDigits ----
eq('999 sd1 → 1000', str(D.roundToSignificantDigits(p('999'), 1, 4)), '1000');
eq('0.0001234 sd2', str(D.roundToSignificantDigits(p('0.0001234'), 2, 4)), '0.00012');
eq('sd on zero', str(D.roundToSignificantDigits(p('0'), 3, 4)), '0');

// ---- mod: modulo modes (bignumber MODULO_MODE semantics) ----
eq('mod -7,3 DOWN (trunc, big.js)', str(D.mod(p('-7'), p('3'), 1)), '-1');
eq('mod 7,3 DOWN', str(D.mod(p('7'), p('3'), 1)), '1');
eq('mod -7,3 FLOOR (divisor sign)', str(D.mod(p('-7'), p('3'), 3)), '2');
eq('mod 7,-3 FLOOR', str(D.mod(p('7'), p('-3'), 3)), '-2');
eq('mod -7,3 EUCLID ≥ 0', str(D.mod(p('-7'), p('3'), 9)), '2');
eq('mod 7,-3 EUCLID ≥ 0', str(D.mod(p('7'), p('-3'), 9)), '1');
eq('mod -7,3 HALF_EVEN', str(D.mod(p('-7'), p('3'), 6)), '-1');
eq('mod exact → +0', str(D.mod(p('6'), p('3'), 1)), '0');
eq('mod 0,y keeps sign', D.mod(p('-0'), p('3'), 1).sign, -1);
eq('mod x,0 = NaN', D.isNaN(D.mod(p('1'), p('0'), 1)), true);
eq('mod ∞,y = NaN', D.isNaN(D.mod(D.infinity(1), p('3'), 1)), true);
eq('mod x,∞ = x', str(D.mod(p('-7.5'), D.infinity(1), 1)), '-7.5');
eq('mod fractional', str(D.mod(p('5.5'), p('1.2'), 1)), '0.7');

// ---- powInt ----
eq('2^10', str(D.powInt(p('2'), 10)), '1024');
eq('(-2)^3', str(D.powInt(p('-2'), 3)), '-8');
eq('(-2)^4', str(D.powInt(p('-2'), 4)), '16');
eq('0^5 keeps sign rule', str(D.powInt(p('-0'), 5))[0], '-');
eq('(0.5)^3', str(D.powInt(p('0.5'), 3)), '0.125');
eq('∞^2', str(D.powInt(D.infinity(1), 2)), 'Infinity');
eq('(−∞)^3', str(D.powInt(D.infinity(-1), 3)), '-Infinity');
eq('NaN^2', D.isNaN(D.powInt(D.nan(), 2)), true);

// ---- sqrtToDecimalPlaces ----
eq('sqrt 2 dp20', str(D.sqrtToDecimalPlaces(p('2'), 20, 4)), '1.4142135623730950488');
eq('sqrt 16', str(D.sqrtToDecimalPlaces(p('16'), 20, 4)), '4');
// DP model: sqrt(1e-300) = 1e-150 is not representable within 20 decimal places → 0 (matches upstream big.js)
eq('sqrt 1e-300 underflows to 0 at dp20', str(D.sqrtToDecimalPlaces(p('1e-300'), 20, 4)), '0');
eq('sqrt 1e400 (float overflow estimate path)', str(D.sqrtToDecimalPlaces(p('1e400'), 20, 4)), '1e+200');
eq('sqrt ±0', D.sqrtToDecimalPlaces(p('-0'), 20, 4).sign, -1);
eq('sqrt negative = NaN', D.isNaN(D.sqrtToDecimalPlaces(p('-4'), 20, 4)), true);
eq('sqrt +∞', str(D.sqrtToDecimalPlaces(D.infinity(1), 20, 4)), 'Infinity');

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
    ['round', strBig(D.roundToDecimalPlaces(da, dp, RM_MAP[bigRm])), ba.round(dp, bigRm).toString()],
  ];
  if (new Big(b).cmp(0) !== 0) {
    cases.push(['div', strBig(D.divToDecimalPlaces(da, db, dp, RM_MAP[bigRm])), ba.div(bb).toString()]);
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
