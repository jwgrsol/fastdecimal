import type { DecimalValue } from './types.ts';
import { pow10 } from './_internal/pow10.ts';

/**
 * Comparison: −1, 0, or 1 — or NaN when either operand is NaN.
 * (decimal.js's cmp returns NaN; the bignumber.js facade maps NaN → null.)
 * −0 and +0 compare equal. ±∞ compare as expected; ∞ === ∞.
 */
export function cmp(x: DecimalValue, y: DecimalValue): number {
  if (x.coefficient === null || y.coefficient === null) {
    if (x.sign === 0 || y.sign === 0) return NaN;         // NaN operand
    if (x.coefficient === null && y.coefficient === null) return x.sign === y.sign ? 0 : x.sign;
    if (x.coefficient === null) return x.sign;                    // ±∞ vs finite
    return -y.sign;                                        // finite vs ±∞
  }
  if (x.coefficient === 0n) return y.coefficient === 0n ? 0 : -y.sign;
  if (y.coefficient === 0n) return x.sign;
  if (x.sign !== y.sign) return x.sign;
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient, yMag = y.coefficient;
  if (scaleDiff > 0) xMag *= pow10(scaleDiff); else if (scaleDiff < 0) yMag *= pow10(-scaleDiff);
  return xMag === yMag ? 0 : (xMag > yMag ? 1 : -1) * x.sign;
}
