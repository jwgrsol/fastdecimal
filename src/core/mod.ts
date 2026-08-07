import type { PlainDecimal, ModuloMode, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { roundUp } from './_internal/roundUp.ts';
import { nan, zero, fromParts } from './make.ts';
import { isFinite, isNaN, isInfinite, isZero } from './predicates.ts';

/**
 * Computes the remainder `r = x − y·q`, where `q` is `x ÷ y` rounded to an
 * integer according to `mode` (the bignumber.js MODULO_MODE family).
 *
 * The mode decides which of the possible remainders you get: mode `1` (DOWN,
 * truncated division) matches big.js and JavaScript's `%` — the remainder
 * takes the dividend's sign; mode `3` (FLOOR) matches Python's `%` — the
 * divisor's sign; mode `9` (EUCLID) always returns a non-negative remainder.
 *
 * Special values: NaN operand → NaN · `±∞ mod y = NaN` · `x mod ±∞ = x` ·
 * `x mod 0 = NaN` · `0 mod y = ±0` (dividend's sign). An exact zero remainder
 * is `+0`.
 *
 * @param x - The dividend.
 * @param y - The divisor.
 * @param mode - Quotient rounding mode 0–8, or 9 for Euclidean.
 * @returns The remainder as a new normalized value.
 *
 * @example
 * toString(mod(parse('-7'), parse('3'), 1)); // '-1' (truncated, like JS %)
 * toString(mod(parse('-7'), parse('3'), 9)); // '2'  (Euclidean, always ≥ 0)
 */
export function mod(x: PlainDecimal, y: PlainDecimal, mode: ModuloMode): PlainDecimal {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) {
      return nan();
    }
    if (isInfinite(x)) {
      return nan();
    } // ±∞ mod y
    return { sign: x.sign, coefficient: x.coefficient, scale: x.scale }; // finite mod ±∞ = x
  }
  if (isZero(y)) {
    return nan();
  } // x mod 0
  if (isZero(x)) {
    return zero(x.sign as 1 | -1);
  }

  // Align both operands to a common scale so the division is over integers
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient,
    yMag = y.coefficient,
    scale = x.scale;
  if (scaleDiff > 0) {
    xMag *= pow10(scaleDiff);
    scale = y.scale;
  } else if (scaleDiff < 0) {
    yMag *= pow10(-scaleDiff);
  }

  const truncated = xMag / yMag;
  const truncRemainder = xMag - truncated * yMag;
  // Does |q| move one past the truncated quotient?
  let quotientBump = 0n;
  if (truncRemainder !== 0n) {
    if (mode === 9) {
      // EUCLID: q = sign(y)·floor(x ÷ |y|) — for a negative dividend, floor sits one below trunc
      if (x.sign < 0) {
        quotientBump = 1n;
      }
    } else if (roundUp(truncated, truncRemainder, yMag, x.sign * y.sign, mode as RoundingMode)) {
      quotientBump = 1n;
    }
  }

  // r = sign(x) · (truncRemainder − bump·|y|)  [derived from r = x − y·q]
  let remainder = truncRemainder - quotientBump * yMag;
  let sign: 1 | -1 = x.sign as 1 | -1;
  if (remainder === 0n) {
    return zero(1);
  }
  if (remainder < 0n) {
    remainder = -remainder;
    sign = -sign as 1 | -1;
  }
  return fromParts(sign, remainder, scale);
}
