import type { Dec, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { roundUp } from './_internal/roundUp.ts';

/**
 * Round to `dp` decimal places (negative dp allowed — rounds at a power of ten
 * above the decimal point). Specials pass through unchanged; a result that
 * rounds to zero keeps the input's sign (−0.4 → −0, matching IEEE ceil/floor
 * behavior and all three target libraries).
 */
export function roundToDp(x: Dec, dp: number, rm: RoundingMode): Dec {
  if (x.coef === null) return { sign: x.sign, coef: null, scale: 0 };
  const shift = -dp - x.scale; // how many digits to drop
  if (shift <= 0 || x.coef === 0n) return { sign: x.sign, coef: x.coef, scale: x.scale };
  const divisor = pow10(shift);
  let truncated = x.coef / divisor;
  if (roundUp(truncated, x.coef - truncated * divisor, divisor, x.sign, rm)) truncated += 1n;
  if (truncated === 0n) return { sign: x.sign, coef: 0n, scale: 0 };
  const coef = stripTrailingZeros(truncated, -dp);
  return { sign: x.sign, coef, scale: stripResult.scale };
}
