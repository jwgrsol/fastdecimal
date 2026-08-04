import type { DecimalValue, RoundingMode } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { roundUp } from './_internal/roundUp.ts';

/**
 * Round to `decimalPlaces` decimal places (negative decimalPlaces allowed — rounds at a power of ten
 * above the decimal point). Specials pass through unchanged; a result that
 * rounds to zero keeps the input's sign (−0.4 → −0, matching IEEE ceil/floor
 * behavior and all three target libraries).
 */
export function roundToDecimalPlaces(x: DecimalValue, decimalPlaces: number, roundingMode: RoundingMode): DecimalValue {
  if (x.coefficient === null) return { sign: x.sign, coefficient: null, scale: 0 };
  const shift = -decimalPlaces - x.scale; // how many digits to drop
  if (shift <= 0 || x.coefficient === 0n) return { sign: x.sign, coefficient: x.coefficient, scale: x.scale };
  const divisor = pow10(shift);
  let truncated = x.coefficient / divisor;
  if (roundUp(truncated, x.coefficient - truncated * divisor, divisor, x.sign, roundingMode)) truncated += 1n;
  if (truncated === 0n) return { sign: x.sign, coefficient: 0n, scale: 0 };
  const coefficient = stripTrailingZeros(truncated, -decimalPlaces);
  return { sign: x.sign, coefficient, scale: stripResult.scale };
}
