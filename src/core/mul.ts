import type { DecimalValue } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Exact multiplication.
 *
 * Special-value propagation (contract §4):
 *   NaN × anything = NaN · ∞ × 0 = NaN · ∞ × x = ±∞ (sign product)
 */
export function mul(x: DecimalValue, y: DecimalValue): DecimalValue {
  if (x.coefficient === null || y.coefficient === null) {
    if (x.sign === 0 || y.sign === 0) return nan(); // NaN operand
    if (x.coefficient === 0n || y.coefficient === 0n) return nan(); // ∞ × 0
    return infinity((x.sign * y.sign) as 1 | -1);
  }
  const sign = (x.sign * y.sign) as 1 | -1;
  if (x.coefficient === 0n || y.coefficient === 0n) return zero(sign);
  const coefficient = stripTrailingZeros(x.coefficient * y.coefficient, x.scale + y.scale);
  return { sign, coefficient, scale: stripResult.scale };
}
