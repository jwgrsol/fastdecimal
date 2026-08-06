import type { DecimalValue } from './types.ts';

/**
 * Checks whether a value is finite — an ordinary number or a signed zero,
 * as opposed to NaN or ±Infinity.
 *
 * @param x - The value to check.
 * @returns `true` for finite values (including ±0), `false` for NaN and ±Infinity.
 *
 * @example
 * isFinite(parse('1.5'));  // true
 * isFinite(infinity(1));   // false
 */
export function isFinite(x: DecimalValue): boolean {
  return x.coefficient !== null;
}

/**
 * Checks whether a value is NaN.
 *
 * @param x - The value to check.
 * @returns `true` only for NaN.
 *
 * @example
 * isNaN(nan());        // true
 * isNaN(parse('1.5')); // false
 */
export function isNaN(x: DecimalValue): boolean {
  return x.coefficient === null && x.sign === 0;
}

/**
 * Checks whether a value is `+Infinity` or `-Infinity`.
 *
 * @param x - The value to check.
 * @returns `true` for either infinity, `false` for finite values and NaN.
 *
 * @example
 * isInfinite(infinity(-1)); // true
 * isInfinite(nan());        // false
 */
export function isInfinite(x: DecimalValue): boolean {
  return x.coefficient === null && x.sign !== 0;
}

/**
 * Checks whether a value is zero, of either sign.
 *
 * @param x - The value to check.
 * @returns `true` for `+0` and `-0`, `false` otherwise (including NaN and ±Infinity).
 *
 * @example
 * isZero(parse('-0')); // true
 * isZero(parse('1'));  // false
 */
export function isZero(x: DecimalValue): boolean {
  return x.coefficient === 0n;
}
