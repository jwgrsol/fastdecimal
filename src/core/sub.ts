import type { Dec } from './types.ts';
import { add } from './add.ts';
import { neg } from './neg.ts';

/** Exact subtraction: x − y = x + (−y). neg allocates only a small wrapper (coef is shared). */
export function sub(x: Dec, y: Dec): Dec {
  return add(x, neg(y));
}
