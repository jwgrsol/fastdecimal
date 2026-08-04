/**
 * Strip trailing zeros into the scale (requires coef > 0n).
 *
 * Returns the stripped coefficient; the adjusted scale is left in `stripResult.scale`.
 * The out-parameter avoids a [coef, scale] tuple allocation — this runs on every
 * arithmetic result and the allocation was a measured cost (contract §0.2).
 */
const TEN_16 = 10n ** 16n, TEN_8 = 10n ** 8n, TEN_4 = 10000n, TEN_2 = 100n, TEN_1 = 10n;

export const stripResult = { scale: 0 };

export function stripTrailingZeros(coef: bigint, scale: number): bigint {
  stripResult.scale = scale;
  if (coef & 1n) return coef; // odd numbers cannot be multiples of 10 — O(1) early exit
  if (coef % TEN_1 !== 0n) return coef;
  while (coef % TEN_16 === 0n) { coef /= TEN_16; scale += 16; }
  if (coef % TEN_8 === 0n) { coef /= TEN_8; scale += 8; }
  if (coef % TEN_4 === 0n) { coef /= TEN_4; scale += 4; }
  if (coef % TEN_2 === 0n) { coef /= TEN_2; scale += 2; }
  if (coef % TEN_1 === 0n) { coef /= TEN_1; scale += 1; }
  stripResult.scale = scale;
  return coef;
}
