import type { Dec } from './types.ts';

/** Exact negation. NaN stays NaN (sign 0 is preserved by 0 × −1 = −0 → normalize to 0). */
export function neg(x: Dec): Dec {
  return { sign: x.sign === 0 ? 0 : (-x.sign as 1 | -1), coef: x.coef, scale: x.scale };
}
