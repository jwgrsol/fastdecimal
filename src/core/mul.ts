import type { DecimalValue } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';
import { isFinite, isNaN, isZero } from './predicates.ts';

/**
 * Multiplies two decimal values exactly, with no rounding and no precision
 * limit — the result may carry up to the sum of both operands' digit counts.
 *
 * Special values propagate by IEEE 754 rules: `NaN × anything = NaN`,
 * `∞ × 0 = NaN`, `∞ × x = ±∞` with the sign product. Zero results keep the
 * sign product too: `0 × −5` is `−0`.
 *
 * @param x - The first factor.
 * @param y - The second factor.
 * @returns The exact product as a new normalized value.
 *
 * @example
 * const result = mul(parse('1.5'), parse('-2'));
 * toString(result); // '-3'
 */
export function mul(x: DecimalValue, y: DecimalValue): DecimalValue {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) {
      return nan();
    }
    if (isZero(x) || isZero(y)) {
      return nan();
    } // ∞ × 0
    return infinity((x.sign * y.sign) as 1 | -1);
  }
  const sign = (x.sign * y.sign) as 1 | -1;
  if (isZero(x) || isZero(y)) {
    return zero(sign);
  }
  const coefficient = stripTrailingZeros(x.coefficient * y.coefficient, x.scale + y.scale);
  return { sign, coefficient, scale: stripResult.scale };
}
