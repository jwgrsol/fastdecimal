import type { Dec } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Exact integer power for n ≥ 1. Exponent 0 and negative exponents are facade
 * policy (big.js: x^0 = 1 unconditionally; x^−n = 1 ÷ x^n at the facade's
 * precision) — the core only computes the exact part.
 */
export function powInt(x: Dec, n: number): Dec {
  if (x.coef === null) {
    if (x.sign === 0) return nan();                       // NaN^n
    return infinity(x.sign < 0 && (n & 1) ? -1 : 1);      // (±∞)^n
  }
  const sign: 1 | -1 = x.sign < 0 && (n & 1) ? -1 : 1;
  if (x.coef === 0n) return zero(sign);
  const coef = stripTrailingZeros(x.coef ** BigInt(n), x.scale * n);
  return { sign, coef, scale: stripResult.scale };
}
