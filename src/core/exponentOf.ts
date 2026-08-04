import type { DecimalValue } from './types.ts';

/**
 * Base-10 exponent of the most significant digit (the `e` of big.js /
 * bignumber.js / decimal.js): exponentOf(parse('123.45')) === 2.
 *
 * Zero returns 0 (matching the target libraries); NaN and ±Infinity return NaN.
 *
 * Derived on demand — it needs a BigInt→string conversion, so callers on
 * arithmetic hot paths should avoid calling it per operation.
 */
export function exponentOf(x: DecimalValue): number {
  if (x.coefficient === null) return NaN;
  if (x.coefficient === 0n) return 0;
  return x.coefficient.toString().length - 1 + x.scale;
}
