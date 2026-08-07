import type { PlainDecimal } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';
import { isFinite, isNaN, isZero } from './predicates.ts';

/**
 * Raises a decimal value to an integer power `n ≥ 1`, exactly — the result may
 * carry `n` times the operand's digit count, with no rounding.
 *
 * Exponent `0` and negative exponents are deliberately not handled here: they
 * are facade policy (big.js returns `1` for `x^0` unconditionally, and computes
 * `x^−n` as `1 ÷ x^n` at its configured precision). The sign follows exponent
 * parity for negative bases: `(−2)^3 = −8`, `(−2)^4 = 16`.
 *
 * @param x - The base.
 * @param n - The integer exponent, `n ≥ 1`.
 * @returns The exact power as a new normalized value.
 *
 * @example
 * toString(powInt(parse('2'), 10));  // '1024'
 * toString(powInt(parse('0.5'), 3)); // '0.125'
 */
export function powInt(x: PlainDecimal, n: number): PlainDecimal {
  if (!isFinite(x)) {
    if (isNaN(x)) {
      return nan();
    }
    return infinity(x.sign < 0 && n & 1 ? -1 : 1); // (±∞)^n
  }
  const sign: 1 | -1 = x.sign < 0 && n & 1 ? -1 : 1;
  if (isZero(x)) {
    return zero(sign);
  }
  const coefficient = stripTrailingZeros(x.coefficient ** BigInt(n), x.scale * n);
  return { sign, coefficient, scale: stripResult.scale };
}
