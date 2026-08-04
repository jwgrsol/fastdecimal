/**
 * Strip trailing zeros into the scale (requires coefficient > 0n).
 *
 * Returns the stripped coefficient; the adjusted scale is left in `stripResult.scale`.
 * The out-parameter avoids a [coefficient, scale] tuple allocation — this runs on every
 * arithmetic result and the allocation was a measured cost (contract §0.2).
 */
const TEN_16 = 10n ** 16n, TEN_8 = 10n ** 8n, TEN_4 = 10000n, TEN_2 = 100n, TEN_1 = 10n;

export const stripResult = { scale: 0 };

export function stripTrailingZeros(coefficient: bigint, scale: number): bigint {
  stripResult.scale = scale;
  if (coefficient & 1n) return coefficient; // odd numbers cannot be multiples of 10 — O(1) early exit
  if (coefficient % TEN_1 !== 0n) return coefficient;
  while (coefficient % TEN_16 === 0n) { coefficient /= TEN_16; scale += 16; }
  if (coefficient % TEN_8 === 0n) { coefficient /= TEN_8; scale += 8; }
  if (coefficient % TEN_4 === 0n) { coefficient /= TEN_4; scale += 4; }
  if (coefficient % TEN_2 === 0n) { coefficient /= TEN_2; scale += 2; }
  if (coefficient % TEN_1 === 0n) { coefficient /= TEN_1; scale += 1; }
  stripResult.scale = scale;
  return coefficient;
}
