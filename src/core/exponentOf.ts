import type { PlainDecimal } from './types.ts';
import { digitCount } from './_internal/digitCount.ts';
import { isFinite, isZero } from './predicates.ts';

/**
 * Returns the base-10 exponent of the most significant digit — the `e`
 * property of big.js / bignumber.js / decimal.js.
 *
 * Zero returns `0` (matching the target libraries); NaN and ±Infinity return
 * `NaN`. The digit count is computed on first demand (linear-time, via hex
 * length) and memoized in the value's `digits` cache field, so repeated calls
 * on the same value are O(1).
 *
 * @param x - The value to inspect.
 * @returns The exponent as a number, or `NaN` for specials.
 *
 * @example
 * exponentOf(parse('123.45'));  // 2
 * exponentOf(parse('0.00012')); // -4
 */
export function exponentOf(x: PlainDecimal): number {
  if (!isFinite(x)) {
    return NaN;
  }
  if (isZero(x)) {
    return 0;
  }
  let digits = x.digits;
  if (digits === 0) {
    digits = digitCount(x.coefficient);
    x.digits = digits;
  }
  return digits - 1 + x.scale;
}
