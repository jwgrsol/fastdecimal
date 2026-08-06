import type { DecimalValue } from './types.ts';
import { add } from './add.ts';
import { neg } from './neg.ts';

/**
 * Subtracts one decimal value from another exactly, with no rounding.
 *
 * Implemented as `x + (−y)`; the negation allocates only a small wrapper object
 * (the BigInt coefficient is shared, not copied). Special values follow the
 * same IEEE 754 rules as {@link add}; `x − x` is `+0`.
 *
 * @param x - The minuend.
 * @param y - The subtrahend.
 * @returns The exact difference as a new normalized value.
 *
 * @example
 * const result = sub(parse('1'), parse('0.999'));
 * toString(result); // '0.001'
 */
export function sub(x: DecimalValue, y: DecimalValue): DecimalValue {
  return add(x, neg(y));
}
