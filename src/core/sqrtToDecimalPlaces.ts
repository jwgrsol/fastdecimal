import type { DecimalValue, RoundingMode } from './types.ts';
import { exponentOf } from './_internal/exponentOf.ts';
import { add } from './add.ts';
import { mul } from './mul.ts';
import { divToDecimalPlaces } from './divToDecimalPlaces.ts';
import { roundToSignificantDigits } from './roundToSignificantDigits.ts';
import { toString } from './toString.ts';
import { parse } from './parse.ts';
import { nan, infinity, zero } from './make.ts';

const HALF: DecimalValue = { sign: 1, coefficient: 5n, scale: -1 };

/**
 * Square root to `decimalPlaces` decimal places of precision (the big.js model: iterate
 * with decimalPlaces+4 guard digits, then round to decimalPlaces + e + 1 significant digits).
 *
 * Newton–Raphson: r ← ½(r + x/r), seeded from a float estimate. Convergence is
 * detected when two successive iterates agree on their guard-digit prefix.
 *
 * Specials (contract §4): NaN → NaN · +∞ → +∞ · −∞ → NaN · sqrt of a negative
 * is NaN (big.js's facade throws before reaching the core) · ±0 → ±0.
 */
export function sqrtToDecimalPlaces(x: DecimalValue, decimalPlaces: number, roundingMode: RoundingMode): DecimalValue {
  if (x.coefficient === null) {
    if (x.sign === 0) return nan();
    return x.sign > 0 ? infinity(1) : nan();
  }
  if (x.coefficient === 0n) return zero(x.sign as 1 | -1); // ±0 → ±0
  if (x.sign < 0) return nan();

  // Initial estimate via float sqrt (same strategy as big.js)
  let estimate = Math.sqrt(Number(toString(x)));
  let result: DecimalValue;
  if (estimate === 0 || estimate === Infinity) {
    // Value out of float range: estimate from the digits and halve the exponent
    let digits = x.coefficient.toString();
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

  const guardDigits = decimalPlaces + 4;
  const cmpDigits = exponentOf(result) + guardDigits;
  let prev: DecimalValue;
  do {
    prev = result;
    result = mul(HALF, add(prev, divToDecimalPlaces(x, prev, guardDigits, roundingMode)));
  } while (
    (prev.coefficient as bigint).toString().slice(0, cmpDigits) !==
    (result.coefficient as bigint).toString().slice(0, cmpDigits)
  );
  return roundToSignificantDigits(result, decimalPlaces + exponentOf(result) + 1, roundingMode);
}
