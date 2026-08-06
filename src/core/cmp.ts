import type { DecimalValue } from './types.ts';
import { pow10 } from './_internal/pow10.ts';

/**
 * Compares two decimal values by mathematical value: `-1` if x < y, `0` if
 * equal, `1` if x > y — or `NaN` when either operand is NaN (which is
 * unordered; the bignumber.js facade maps this to `null`).
 *
 * `−0` and `+0` compare equal. Infinities order against everything, and
 * `∞ === ∞`. Values with different scales compare correctly: `1.20` equals
 * `1.2`.
 *
 * @param x - The first value.
 * @param y - The second value.
 * @returns `-1`, `0`, `1`, or `NaN`.
 *
 * @example
 * cmp(parse('1.20'), parse('1.2')); // 0
 * cmp(parse('-1'), parse('1'));     // -1
 */
export function cmp(x: DecimalValue, y: DecimalValue): number {
  if (x.coefficient === null || y.coefficient === null) {
    if (x.sign === 0 || y.sign === 0) return NaN; // NaN operand
    if (x.coefficient === null && y.coefficient === null) return x.sign === y.sign ? 0 : x.sign;
    if (x.coefficient === null) return x.sign; // ±∞ vs finite
    return -y.sign; // finite vs ±∞
  }
  if (x.coefficient === 0n) return y.coefficient === 0n ? 0 : -y.sign;
  if (y.coefficient === 0n) return x.sign;
  if (x.sign !== y.sign) return x.sign;
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient,
    yMag = y.coefficient;
  if (scaleDiff > 0) xMag *= pow10(scaleDiff);
  else if (scaleDiff < 0) yMag *= pow10(-scaleDiff);
  return xMag === yMag ? 0 : (xMag > yMag ? 1 : -1) * x.sign;
}
