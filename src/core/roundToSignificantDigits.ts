import type { DecimalValue, RoundingMode } from './types.ts';
import { exponentOf } from './exponentOf.ts';
import { roundToDecimalPlaces } from './roundToDecimalPlaces.ts';

/**
 * Round to `significantDigits` significant digits (contract §2, SD model — decimal.js).
 * Specials and zero pass through unchanged (zero has no significant digits).
 */
export function roundToSignificantDigits(x: DecimalValue, significantDigits: number, roundingMode: RoundingMode): DecimalValue {
  if (x.coefficient === null || x.coefficient === 0n) return { sign: x.sign, coefficient: x.coefficient, scale: x.coefficient === null ? 0 : x.scale };
  return roundToDecimalPlaces(x, significantDigits - exponentOf(x) - 1, roundingMode);
}
