/**
 * Strip trailing zeros into the scale (requires coefficient > 0n).
 *
 * Returns the stripped coefficient; the adjusted scale is left in `stripResult.scale`.
 * The out-parameter avoids a [coefficient, scale] tuple allocation — this runs on every
 * arithmetic result and the allocation was a measured cost (contract §0.2).
 */
const TEN_16 = 10n ** 16n,
  TEN_8 = 10n ** 8n,
  TEN_4 = 10000n,
  TEN_2 = 100n,
  TEN_1 = 10n;
const TEN_32 = TEN_16 * TEN_16;

export const stripResult = { scale: 0 };

export function stripTrailingZeros(coefficient: bigint, scale: number): bigint {
  stripResult.scale = scale;
  if (coefficient & 1n) {
    return coefficient;
  } // odd numbers cannot be multiples of 10 — O(1) early exit
  if (coefficient % TEN_1 !== 0n) {
    return coefficient;
  }
  if (coefficient % TEN_16 === 0n) {
    // ≥16 trailing zeros — rare; outlined so this function stays small enough
    // for the JIT to keep inlining the common path.
    return stripLongRun(coefficient, scale);
  }
  if (coefficient % TEN_8 === 0n) {
    coefficient /= TEN_8;
    scale += 8;
  }
  if (coefficient % TEN_4 === 0n) {
    coefficient /= TEN_4;
    scale += 4;
  }
  if (coefficient % TEN_2 === 0n) {
    coefficient /= TEN_2;
    scale += 2;
  }
  if (coefficient % TEN_1 === 0n) {
    coefficient /= TEN_1;
    scale += 1;
  }
  stripResult.scale = scale;
  return coefficient;
}

/**
 * ≥16 trailing zeros (precondition: coefficient % 10^16 === 0n): climb a
 * squaring ladder (10^32, 10^64, 10^128, …) while divisible, then
 * binary-descend the same ladder. Removing k zeros costs O(log k) full-width
 * divisions instead of k/16 — a fixed-chunk loop is quadratic on results like
 * 10^1000000 (e.g. 999…9 + 1). The ladder array is only allocated past 48
 * zeros and is per-call, so no large powers are retained.
 */
function stripLongRun(coefficient: bigint, scale: number): bigint {
  coefficient /= TEN_16;
  scale += 16;
  if (coefficient % TEN_32 === 0n) {
    coefficient /= TEN_32;
    scale += 32;
    const ladder: bigint[] = [TEN_32];
    let step = TEN_32 * TEN_32,
      shift = 64;
    while (coefficient % step === 0n) {
      coefficient /= step;
      scale += shift;
      ladder.push(step);
      step *= step;
      shift *= 2;
    }
    for (let i = ladder.length - 1; i >= 0; i--) {
      shift /= 2;
      if (coefficient % ladder[i] === 0n) {
        coefficient /= ladder[i];
        scale += shift;
      }
    }
  }
  if (coefficient % TEN_16 === 0n) {
    coefficient /= TEN_16;
    scale += 16;
  }
  if (coefficient % TEN_8 === 0n) {
    coefficient /= TEN_8;
    scale += 8;
  }
  if (coefficient % TEN_4 === 0n) {
    coefficient /= TEN_4;
    scale += 4;
  }
  if (coefficient % TEN_2 === 0n) {
    coefficient /= TEN_2;
    scale += 2;
  }
  if (coefficient % TEN_1 === 0n) {
    coefficient /= TEN_1;
    scale += 1;
  }
  stripResult.scale = scale;
  return coefficient;
}
