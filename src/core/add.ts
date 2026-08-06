import type { DecimalValue } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';
import { isFinite, isNaN, isInfinite, isZero } from './predicates.ts';

/**
 * Adds two decimal values exactly, with no rounding and no precision limit.
 *
 * Special values propagate by IEEE 754 rules: `NaN + anything = NaN`,
 * `∞ + (−∞) = NaN`, `∞ + finite = ∞`. Zero signs follow IEEE as well:
 * `(−0) + (−0) = −0`, and exact cancellation of nonzero operands yields `+0`.
 *
 * Implementation note: magnitudes are compared and the smaller subtracted from
 * the larger instead of negating BigInts — avoids up to two negation
 * allocations per call (a measured win on small operands).
 *
 * @param x - The first addend.
 * @param y - The second addend.
 * @returns The exact sum as a new normalized value.
 *
 * @example
 * const result = add(parse('0.1'), parse('0.2'));
 * toString(result); // '0.3' — exact, no binary float error
 */
export function add(x: DecimalValue, y: DecimalValue): DecimalValue {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) return nan();
    if (isInfinite(x) && isInfinite(y)) return x.sign === y.sign ? infinity(x.sign) : nan(); // ∞ + (−∞)
    return isInfinite(x) ? infinity(x.sign) : infinity(y.sign as 1 | -1); // ∞ + finite
  }
  if (isZero(x) && isZero(y)) return zero(x.sign < 0 && y.sign < 0 ? -1 : 1);

  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient,
    yMag = y.coefficient,
    scale = x.scale;
  if (scaleDiff > 0) {
    xMag *= pow10(scaleDiff);
    scale = y.scale;
  } else if (scaleDiff < 0) {
    yMag *= pow10(-scaleDiff);
  }

  let sign: 1 | -1, magnitude: bigint;
  if (x.sign === y.sign) {
    sign = x.sign as 1 | -1;
    magnitude = xMag + yMag;
  } else if (xMag === yMag)
    return zero(1); // exact cancellation → +0
  else if (xMag > yMag) {
    sign = x.sign as 1 | -1;
    magnitude = xMag - yMag;
  } else {
    sign = y.sign as 1 | -1;
    magnitude = yMag - xMag;
  }

  const coefficient = stripTrailingZeros(magnitude, scale);
  return { sign, coefficient, scale: stripResult.scale };
}
