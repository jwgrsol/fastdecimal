import type { Dec, RoundingMode } from './types.ts';
import { exponentOf } from './_internal/exponentOf.ts';
import { roundToDp } from './roundToDp.ts';

/**
 * Round to `sd` significant digits (contract §2, SD model — decimal.js).
 * Specials and zero pass through unchanged (zero has no significant digits).
 */
export function roundToSd(x: Dec, sd: number, rm: RoundingMode): Dec {
  if (x.coef === null || x.coef === 0n) return { sign: x.sign, coef: x.coef, scale: x.coef === null ? 0 : x.scale };
  return roundToDp(x, sd - exponentOf(x) - 1, rm);
}
