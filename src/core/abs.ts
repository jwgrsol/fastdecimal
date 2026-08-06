import type { DecimalValue } from './types.ts';

/**
 * Returns the absolute value: the sign becomes positive, the coefficient is
 * shared (no BigInt allocation). `|−0|` is `+0`; `|−∞|` is `+∞`; `|NaN|`
 * stays NaN.
 *
 * @param x - The value to take the absolute value of.
 * @returns A new value with a non-negative sign.
 *
 * @example
 * const result = abs(parse('-1.5'));
 * toString(result); // '1.5'
 */
export function abs(x: DecimalValue): DecimalValue {
  return { sign: x.sign === 0 ? 0 : 1, coefficient: x.coefficient, scale: x.scale };
}
