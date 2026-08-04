import type { DecimalValue } from './types.ts';

/** Exact negation. NaN stays NaN (sign 0 is preserved by 0 × −1 = −0 → normalize to 0). */
export function neg(x: DecimalValue): DecimalValue {
  return { sign: x.sign === 0 ? 0 : (-x.sign as 1 | -1), coefficient: x.coefficient, scale: x.scale };
}
