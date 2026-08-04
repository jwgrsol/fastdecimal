import type { Dec, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { roundUp } from './_internal/roundUp.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Division rounded to `dp` decimal places (contract §2, DP model — big.js/bignumber.js).
 *
 * Special-value semantics (contract §4 — the core never throws on values):
 *   NaN ÷ anything = NaN · ∞ ÷ ∞ = NaN · ∞ ÷ x = ±∞ · x ÷ ∞ = ±0
 *   x ÷ 0 = ±∞ (sign product) · 0 ÷ 0 = NaN
 * Facades that throw on division by zero (big.js) must validate before calling.
 */
export function divToDp(x: Dec, y: Dec, dp: number, rm: RoundingMode): Dec {
  if (x.coef === null || y.coef === null) {
    if (x.sign === 0 || y.sign === 0) return nan();          // NaN operand
    if (x.coef === null && y.coef === null) return nan();    // ∞ ÷ ∞
    if (x.coef === null) return infinity((x.sign * y.sign) as 1 | -1);
    return zero((x.sign * y.sign) as 1 | -1);                // finite ÷ ∞
  }
  const sign = (x.sign * y.sign) as 1 | -1;
  if (y.coef === 0n) return x.coef === 0n ? nan() : infinity(sign);
  if (x.coef === 0n) return zero(sign);

  // Scale the integer division so the quotient carries exactly dp decimal places
  const shift = x.scale - y.scale + dp;
  let numerator = x.coef, denominator = y.coef;
  if (shift > 0) numerator *= pow10(shift); else if (shift < 0) denominator *= pow10(-shift);
  let truncated = numerator / denominator;
  if (roundUp(truncated, numerator - truncated * denominator, denominator, sign, rm)) truncated += 1n;
  if (truncated === 0n) return zero(sign);
  const coef = stripTrailingZeros(truncated, -dp);
  return { sign, coef, scale: stripResult.scale };
}
