import type { DecimalValue } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';

// Value constructors. Every DecimalValue in the system is created here (or by
// parse), so the three-field shape and creation order stay identical for the
// JIT and the normal-form invariant holds by construction. Each call returns a
// fresh object — callers never share mutable state.

/**
 * Creates a NaN value: `{ sign: 0, coefficient: null, scale: 0 }`.
 *
 * @returns A fresh NaN value.
 *
 * @example
 * isNaN(nan()); // true
 */
export function nan(): DecimalValue {
  return { sign: 0, coefficient: null, scale: 0 };
}

/**
 * Creates a signed infinity: `{ sign, coefficient: null, scale: 0 }`.
 *
 * @param sign - `1` for `+Infinity`, `-1` for `-Infinity`.
 * @returns A fresh infinite value.
 *
 * @example
 * toString(infinity(-1)); // '-Infinity'
 */
export function infinity(sign: 1 | -1): DecimalValue {
  return { sign, coefficient: null, scale: 0 };
}

/**
 * Creates a signed zero: `{ sign, coefficient: 0n, scale: 0 }`.
 *
 * @param sign - `1` for `+0`, `-1` for `-0`.
 * @returns A fresh zero value.
 *
 * @example
 * cmp(zero(-1), zero(1)); // 0 — −0 and +0 compare equal
 */
export function zero(sign: 1 | -1): DecimalValue {
  return { sign, coefficient: 0n, scale: 0 };
}

/**
 * Creates a finite value from parts that are already in normal form — a fast
 * path that skips re-normalization. The caller must guarantee the invariant:
 * `coefficient` is not a multiple of 10, and a zero coefficient has scale 0.
 * Use {@link fromParts} when the input is not known to be normalized.
 *
 * @param sign - The sign, `1` or `-1`.
 * @param coefficient - The non-negative coefficient, already stripped of trailing zeros.
 * @param scale - The base-10 exponent of the least significant digit.
 * @returns A fresh finite value using the parts as given.
 */
export function fromNormalized(sign: 1 | -1, coefficient: bigint, scale: number): DecimalValue {
  return { sign, coefficient, scale };
}

/**
 * Creates a finite value from arbitrary parts, normalizing on the way in:
 * trailing zeros move from the coefficient into the scale, and a zero
 * coefficient forces scale 0.
 *
 * @param sign - The sign, `1` or `-1`.
 * @param coefficient - The non-negative coefficient (may carry trailing zeros).
 * @param scale - The base-10 exponent of the least significant digit.
 * @returns A fresh finite value in normal form.
 *
 * @example
 * fromParts(1, 12300n, -2); // { sign: 1, coefficient: 123n, scale: 0 } — i.e. 123
 */
export function fromParts(sign: 1 | -1, coefficient: bigint, scale: number): DecimalValue {
  if (coefficient === 0n) {
    return { sign, coefficient: 0n, scale: 0 };
  }
  const stripped = stripTrailingZeros(coefficient, scale);
  return { sign, coefficient: stripped, scale: stripResult.scale };
}
