import type { DecimalValue, RoundingMode } from './types.ts';
import { exponentOf } from './exponentOf.ts';
import { add } from './add.ts';
import { mul } from './mul.ts';
import { divToDecimalPlaces } from './divToDecimalPlaces.ts';
import { roundToSignificantDigits } from './roundToSignificantDigits.ts';
import { toString } from './toString.ts';
import { parse } from './parse.ts';
import { nan, infinity, zero } from './make.ts';
import { isFinite, isNaN, isZero } from './predicates.ts';

const HALF: DecimalValue = { sign: 1, coefficient: 5n, scale: -1 };

/**
 * Computes the square root to `decimalPlaces` decimal places of precision
 * (the big.js model: iterate with `decimalPlaces + 4` guard digits, then round
 * to `decimalPlaces + e + 1` significant digits).
 *
 * Uses Newton–Raphson iteration `r ← ½(r + x/r)`, seeded from a float
 * estimate; convergence is detected when two successive iterates agree on
 * their guard-digit prefix. An iteration cap guarantees termination on inputs
 * where the true root's exponent sits far below `−decimalPlaces` — upstream
 * big.js hangs forever on those (see README, intentional divergence).
 *
 * Specials: `NaN → NaN` · `+∞ → +∞` · `−∞ → NaN` · the square root of a
 * negative value is NaN (big.js's facade throws before reaching the core) ·
 * `±0 → ±0`.
 *
 * @param x - The value to take the square root of.
 * @param decimalPlaces - Decimal places of precision for the result (≥ 0).
 * @param roundingMode - Rounding mode for the iteration divisions and the final rounding.
 * @returns The rounded square root as a new normalized value.
 *
 * @example
 * const result = sqrtToDecimalPlaces(parse('2'), 20, 4);
 * toString(result); // '1.4142135623730950488'
 */
export function sqrtToDecimalPlaces(x: DecimalValue, decimalPlaces: number, roundingMode: RoundingMode): DecimalValue {
  if (!isFinite(x)) {
    if (isNaN(x)) {
      return nan();
    }
    return x.sign > 0 ? infinity(1) : nan(); // +∞ → +∞ · −∞ → NaN
  }
  if (isZero(x)) {
    return zero(x.sign as 1 | -1);
  } // ±0 → ±0
  if (x.sign < 0) {
    return nan();
  }

  // Initial estimate via float sqrt (same strategy as big.js)
  let estimate = Math.sqrt(Number(toString(x)));
  let result: DecimalValue;
  if (estimate === 0 || estimate === Infinity) {
    // Value out of float range: estimate from the digits and halve the exponent
    let digits = x.coefficient.toString();
    const exponent = exponentOf(x);
    if (!((digits.length + exponent) & 1)) {
      digits += '0';
    }
    estimate = Math.sqrt(Number(digits));
    const halfExp = (((exponent + 1) / 2) | 0) - (exponent < 0 || exponent & 1 ? 1 : 0);
    let mantissa: string;
    if (estimate === Infinity) {
      mantissa = '5e';
    } else {
      const text = estimate.toExponential();
      mantissa = text.slice(0, text.indexOf('e') + 1);
    }
    result = parse(mantissa + halfExp);
  } else {
    result = parse(String(estimate));
  }

  const guardDigits = decimalPlaces + 4;
  const cmpDigits = exponentOf(result) + guardDigits;
  let prev: DecimalValue;
  // Iteration cap: when the true root's exponent is far below −decimalPlaces, the
  // dp-limited division makes the iteration oscillate forever — upstream big.js
  // hangs on such inputs (found by differential fuzzing). Normal convergence is
  // quadratic and takes well under 20 iterations, so a generous cap only fires
  // where upstream would never return; we terminate with the current estimate.
  let iterations = 0;
  do {
    prev = result;
    result = mul(HALF, add(prev, divToDecimalPlaces(x, prev, guardDigits, roundingMode)));
  } while (
    ++iterations < 100 &&
    (prev.coefficient as bigint).toString().slice(0, cmpDigits) !==
      (result.coefficient as bigint).toString().slice(0, cmpDigits)
  );
  return roundToSignificantDigits(result, decimalPlaces + exponentOf(result) + 1, roundingMode);
}
