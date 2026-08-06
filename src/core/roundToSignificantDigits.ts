import type { DecimalValue, RoundingMode } from './types.ts';
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
  x: DecimalValue,
  significantDigits: number,
  roundingMode: RoundingMode
): DecimalValue {
  if (x.coefficient === null || x.coefficient === 0n)
    return { sign: x.sign, coefficient: x.coefficient, scale: x.coefficient === null ? 0 : x.scale };
  return roundToDecimalPlaces(x, significantDigits - exponentOf(x) - 1, roundingMode);
}
