import type { DecimalValue } from '../types.ts';

/**
 * Base-10 exponent of the most significant digit of a finite, non-zero value
 * (the `e` of big.js/bignumber.js/decimal.js). Derived on demand — it requires
 * a BigInt→string conversion, so it must stay off arithmetic hot paths.
 */
export function exponentOf(x: DecimalValue): number {
  return (x.coefficient as bigint).toString().length - 1 + x.scale;
}
