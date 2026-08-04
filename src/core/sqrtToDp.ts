import type { Dec, RoundingMode } from './types.ts';
import { exponentOf } from './_internal/exponentOf.ts';
import { add } from './add.ts';
import { mul } from './mul.ts';
import { divToDp } from './divToDp.ts';
import { roundToSd } from './roundToSd.ts';
import { toString } from './toString.ts';
import { parse } from './parse.ts';
import { nan, infinity, zero } from './make.ts';

const HALF: Dec = { sign: 1, coef: 5n, scale: -1 };

/**
 * Square root to `dp` decimal places of precision (the big.js model: iterate
 * with dp+4 guard digits, then round to dp + e + 1 significant digits).
 *
 * Newton–Raphson: r ← ½(r + x/r), seeded from a float estimate. Convergence is
 * detected when two successive iterates agree on their guard-digit prefix.
 *
 * Specials (contract §4): NaN → NaN · +∞ → +∞ · −∞ → NaN · sqrt of a negative
 * is NaN (big.js's facade throws before reaching the core) · ±0 → ±0.
 */
export function sqrtToDp(x: Dec, dp: number, rm: RoundingMode): Dec {
  if (x.coef === null) {
    if (x.sign === 0) return nan();
    return x.sign > 0 ? infinity(1) : nan();
  }
  if (x.coef === 0n) return zero(x.sign as 1 | -1); // ±0 → ±0
  if (x.sign < 0) return nan();

  // Initial estimate via float sqrt (same strategy as big.js)
  let estimate = Math.sqrt(Number(toString(x)));
  let result: Dec;
  if (estimate === 0 || estimate === Infinity) {
    // Value out of float range: estimate from the digits and halve the exponent
    let digits = x.coef.toString();
    const exponent = exponentOf(x);
    if (!((digits.length + exponent) & 1)) digits += '0';
    estimate = Math.sqrt(Number(digits));
    const halfExp = (((exponent + 1) / 2) | 0) - (exponent < 0 || exponent & 1 ? 1 : 0);
    let mantissa: string;
    if (estimate === Infinity) mantissa = '5e';
    else {
      const text = estimate.toExponential();
      mantissa = text.slice(0, text.indexOf('e') + 1);
    }
    result = parse(mantissa + halfExp);
  } else {
    result = parse(String(estimate));
  }

  const guardDp = dp + 4;
  const cmpDigits = exponentOf(result) + guardDp;
  let prev: Dec;
  do {
    prev = result;
    result = mul(HALF, add(prev, divToDp(x, prev, guardDp, rm)));
  } while (
    (prev.coef as bigint).toString().slice(0, cmpDigits) !==
    (result.coef as bigint).toString().slice(0, cmpDigits)
  );
  return roundToSd(result, dp + exponentOf(result) + 1, rm);
}
