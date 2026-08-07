import type { PlainDecimal } from './types.ts';
import { isFinite, isZero } from './predicates.ts';

/**
 * Returns the base-10 exponent of the most significant digit — the `e`
 * property of big.js / bignumber.js / decimal.js.
 *
 * Zero returns `0` (matching the target libraries); NaN and ±Infinity return
 * `NaN`. Derived on demand — it needs a BigInt→string conversion, so callers
 * on arithmetic hot paths should avoid calling it per operation.
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
  return x.coefficient.toString().length - 1 + x.scale;
}
