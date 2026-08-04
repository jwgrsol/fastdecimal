import type { Dec } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Exact multiplication.
 *
 * Special-value propagation (contract §4):
 *   NaN × anything = NaN · ∞ × 0 = NaN · ∞ × x = ±∞ (sign product)
 */
export function mul(x: Dec, y: Dec): Dec {
  if (x.coef === null || y.coef === null) {
    if (x.sign === 0 || y.sign === 0) return nan();       // NaN operand
    if (x.coef === 0n || y.coef === 0n) return nan();     // ∞ × 0
    return infinity((x.sign * y.sign) as 1 | -1);
  }
  const sign = (x.sign * y.sign) as 1 | -1;
  if (x.coef === 0n || y.coef === 0n) return zero(sign);
  const coef = stripTrailingZeros(x.coef * y.coef, x.scale + y.scale);
  return { sign, coef, scale: stripResult.scale };
}
