import type { Dec } from './types.ts';
import { pow10 } from './_internal/pow10.ts';

/**
 * Comparison: −1, 0, or 1 — or NaN when either operand is NaN.
 * (decimal.js's cmp returns NaN; the bignumber.js facade maps NaN → null.)
 * −0 and +0 compare equal. ±∞ compare as expected; ∞ === ∞.
 */
export function cmp(x: Dec, y: Dec): number {
  if (x.coef === null || y.coef === null) {
    if (x.sign === 0 || y.sign === 0) return NaN;         // NaN operand
    if (x.coef === null && y.coef === null) return x.sign === y.sign ? 0 : x.sign;
    if (x.coef === null) return x.sign;                    // ±∞ vs finite
    return -y.sign;                                        // finite vs ±∞
  }
  if (x.coef === 0n) return y.coef === 0n ? 0 : -y.sign;
  if (y.coef === 0n) return x.sign;
  if (x.sign !== y.sign) return x.sign;
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coef, yMag = y.coef;
  if (scaleDiff > 0) xMag *= pow10(scaleDiff); else if (scaleDiff < 0) yMag *= pow10(-scaleDiff);
  return xMag === yMag ? 0 : (xMag > yMag ? 1 : -1) * x.sign;
}
