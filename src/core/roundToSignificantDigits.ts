import type { PlainDecimal, RoundingMode } from './types.ts';
import { isFinite, isZero } from './predicates.ts';
import { exponentOf } from './exponentOf.ts';
import { roundToDecimalPlaces } from './roundToDecimalPlaces.ts';

/**
 * Rounds a decimal value to `significantDigits` significant digits, counted
 * from the most significant digit (the decimal.js precision model).
 *
 * Rounding can carry across a power of ten: `999` at 1 significant digit
 * becomes `1000`. Specials and zero pass through unchanged (zero has no
 * significant digits).
 *
 * @param x - The value to round.
 * @param significantDigits - Significant digits to keep (≥ 1).
 * @param roundingMode - How to round the dropped digits (0–8, see {@link RoundingMode}).
 * @returns The rounded value as a new normalized value.
 *
 * @example
 * toString(roundToSignificantDigits(parse('0.0001234'), 2, 4)); // '0.00012'
 * toString(roundToSignificantDigits(parse('999'), 1, 4));       // '1000'
 */
export function roundToSignificantDigits(
  x: PlainDecimal,
  significantDigits: number,
  roundingMode: RoundingMode
): PlainDecimal {
  if (!isFinite(x) || isZero(x)) {
    return { sign: x.sign, coefficient: x.coefficient, scale: isFinite(x) ? x.scale : 0, digits: x.digits };
  }
  return roundToDecimalPlaces(x, significantDigits - exponentOf(x) - 1, roundingMode);
}
