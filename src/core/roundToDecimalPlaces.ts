import type { PlainDecimal, RoundingMode } from './types.ts';
import { isFinite, isZero } from './predicates.ts';
import { pow10 } from './_internal/pow10.ts';
import { roundUp } from './_internal/roundUp.ts';
import { fromParts } from './make.ts';

/**
 * Rounds a decimal value to `decimalPlaces` decimal places. A negative
 * `decimalPlaces` rounds at a power of ten above the decimal point:
 * `roundToDecimalPlaces(parse('12345'), -2, 4)` is `12300`.
 *
 * Specials pass through unchanged. A result that rounds to zero keeps the
 * input's sign — `−0.4` rounded with CEIL is `−0`, matching IEEE ceil/floor
 * behavior and all three target libraries.
 *
 * @param x - The value to round.
 * @param decimalPlaces - Decimal places to keep (may be negative).
 * @param roundingMode - How to round the dropped digits (0–8, see {@link RoundingMode}).
 * @returns The rounded value as a new normalized value.
 *
 * @example
 * toString(roundToDecimalPlaces(parse('2.5'), 0, 4)); // '3'  (HALF_UP)
 * toString(roundToDecimalPlaces(parse('2.5'), 0, 6)); // '2'  (HALF_EVEN)
 */
export function roundToDecimalPlaces(x: PlainDecimal, decimalPlaces: number, roundingMode: RoundingMode): PlainDecimal {
  if (!isFinite(x)) {
    return { sign: x.sign, coefficient: null, scale: 0, digits: 0 };
  }
  const shift = -decimalPlaces - x.scale; // how many digits to drop
  if (shift <= 0 || isZero(x)) {
    return { sign: x.sign, coefficient: x.coefficient, scale: x.scale, digits: x.digits };
  }
  const divisor = pow10(shift);
  let truncated = x.coefficient / divisor;
  if (roundUp(truncated, x.coefficient - truncated * divisor, divisor, x.sign, roundingMode)) {
    truncated += 1n;
  }
  if (truncated === 0n) {
    return { sign: x.sign, coefficient: 0n, scale: 0, digits: 0 };
  }
  return fromParts(x.sign as 1 | -1, truncated, -decimalPlaces);
}
