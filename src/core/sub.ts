import type { DecimalValue } from './types.ts';
import { add } from './add.ts';
import { neg } from './neg.ts';

/** Exact subtraction: x − y = x + (−y). neg allocates only a small wrapper (coefficient is shared). */
export function sub(x: DecimalValue, y: DecimalValue): DecimalValue {
  return add(x, neg(y));
}
