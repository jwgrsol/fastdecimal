import type { DecimalValue } from './types.ts';

/** Exact absolute value. NaN stays NaN. */
export function abs(x: DecimalValue): DecimalValue {
  return { sign: x.sign === 0 ? 0 : 1, coefficient: x.coefficient, scale: x.scale };
}
