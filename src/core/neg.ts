import type { DecimalValue } from './types.ts';
import { isNaN } from './predicates.ts';

/**
 * Negates a decimal value: flips the sign, sharing the coefficient (no BigInt
 * allocation). `−(+0)` is `−0` and vice versa; `−(±∞)` flips the infinity;
 * `−NaN` stays NaN.
 *
 * @param x - The value to negate.
 * @returns A new value with the opposite sign.
 *
 * @example
 * const result = neg(parse('1.5'));
 * toString(result); // '-1.5'
 */
export function neg(x: DecimalValue): DecimalValue {
  return { sign: isNaN(x) ? 0 : (-x.sign as 1 | -1), coefficient: x.coefficient, scale: x.scale };
}
