import type { Dec, ModuloMode, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { roundUp } from './_internal/roundUp.ts';
import { nan, zero } from './make.ts';

/**
 * Remainder: r = x − y·q, where q is x ÷ y rounded to an integer per `mode`
 * (contract §3). Mode 1 (DOWN, truncated division) is big.js/JS `%` semantics;
 * mode 9 (EUCLID) always returns a non-negative remainder.
 *
 * Special values: NaN operand → NaN · ±∞ mod y = NaN · finite x mod ±∞ = x ·
 * x mod 0 = NaN · 0 mod y = ±0 (dividend's sign). An exact zero remainder is +0.
 */
export function mod(x: Dec, y: Dec, mode: ModuloMode): Dec {
  if (x.coef === null || y.coef === null) {
    if (x.sign === 0 || y.sign === 0) return nan();  // NaN operand
    if (x.coef === null) return nan();               // ±∞ mod y
    return { sign: x.sign, coef: x.coef, scale: x.scale }; // finite mod ±∞ = x
  }
  if (y.coef === 0n) return nan();
  if (x.coef === 0n) return zero(x.sign as 1 | -1);

  // Align both operands to a common scale so the division is over integers
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coef, yMag = y.coef, scale = x.scale;
  if (scaleDiff > 0) { xMag *= pow10(scaleDiff); scale = y.scale; }
  else if (scaleDiff < 0) { yMag *= pow10(-scaleDiff); }

  const truncated = xMag / yMag;
  const truncRemainder = xMag - truncated * yMag;
  // Does |q| move one past the truncated quotient?
  let quotientBump = 0n;
  if (truncRemainder !== 0n) {
    if (mode === 9) {
      // EUCLID: q = sign(y)·floor(x ÷ |y|) — for a negative dividend, floor sits one below trunc
      if (x.sign < 0) quotientBump = 1n;
    } else if (roundUp(truncated, truncRemainder, yMag, x.sign * y.sign, mode as RoundingMode)) {
      quotientBump = 1n;
    }
  }

  // r = sign(x) · (truncRemainder − bump·|y|)  [derived from r = x − y·q]
  let remainder = truncRemainder - quotientBump * yMag;
  let sign: 1 | -1 = x.sign as 1 | -1;
  if (remainder === 0n) return zero(1);
  if (remainder < 0n) { remainder = -remainder; sign = -sign as 1 | -1; }
  const coef = stripTrailingZeros(remainder, scale);
  return { sign, coef, scale: stripResult.scale };
}
