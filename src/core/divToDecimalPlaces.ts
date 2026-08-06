import type { DecimalValue, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { roundUp } from './_internal/roundUp.ts';
import { nan, infinity, zero } from './make.ts';
import { isFinite, isNaN, isInfinite, isZero } from './predicates.ts';

/**
 * Divides one decimal value by another, rounding the quotient to
 * `decimalPlaces` decimal places (the big.js/bignumber.js precision model).
 *
 * Division by zero never throws: `x ÷ 0` is `±∞` (sign product) and `0 ÷ 0`
 * is NaN, per IEEE 754. Other specials: `NaN ÷ anything = NaN`, `∞ ÷ ∞ = NaN`,
 * `∞ ÷ x = ±∞`, `x ÷ ∞ = ±0`. Facades that throw on division by zero
 * (big.js) validate before calling.
 *
 * @param x - The dividend.
 * @param y - The divisor.
 * @param decimalPlaces - Number of decimal places the quotient is rounded to (≥ 0).
 * @param roundingMode - How to round the dropped digits (0–8, see {@link RoundingMode}).
 * @returns The rounded quotient as a new normalized value.
 *
 * @example
 * const result = divToDecimalPlaces(parse('1'), parse('3'), 5, 4); // HALF_UP
 * toString(result); // '0.33333'
 */
export function divToDecimalPlaces(
  x: DecimalValue,
  y: DecimalValue,
  decimalPlaces: number,
  roundingMode: RoundingMode
): DecimalValue {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) return nan();
    if (isInfinite(x) && isInfinite(y)) return nan(); // ∞ ÷ ∞
    if (isInfinite(x)) return infinity((x.sign * y.sign) as 1 | -1);
    return zero((x.sign * y.sign) as 1 | -1); // finite ÷ ∞
  }
  const sign = (x.sign * y.sign) as 1 | -1;
  if (isZero(y)) return isZero(x) ? nan() : infinity(sign); // x ÷ 0 · 0 ÷ 0
  if (isZero(x)) return zero(sign);

  // Scale the integer division so the quotient carries exactly decimalPlaces decimal places
  const shift = x.scale - y.scale + decimalPlaces;
  let numerator = x.coefficient,
    denominator = y.coefficient;
  if (shift > 0) numerator *= pow10(shift);
  else if (shift < 0) denominator *= pow10(-shift);
  let truncated = numerator / denominator;
  if (roundUp(truncated, numerator - truncated * denominator, denominator, sign, roundingMode)) truncated += 1n;
  if (truncated === 0n) return zero(sign);
  const coefficient = stripTrailingZeros(truncated, -decimalPlaces);
  return { sign, coefficient, scale: stripResult.scale };
}
