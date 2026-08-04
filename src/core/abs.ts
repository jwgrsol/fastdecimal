import type { Dec } from './types.ts';

/** Exact absolute value. NaN stays NaN. */
export function abs(x: Dec): Dec {
  return { sign: x.sign === 0 ? 0 : 1, coef: x.coef, scale: x.scale };
}
