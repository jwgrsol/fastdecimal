import type { PlainDecimal } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { isFinite, isNaN, isInfinite, isZero } from './predicates.ts';

// Above this gap, exponent-bound comparison beats alignment. Below it, the
// pow10 multiply is cheap (the factor stays inside pow10's cache) and avoids
// the two hex conversions of cmpFarScales.
const SCALE_GAP_LIMIT = 4096;

/**
 * Compares two decimal values by mathematical value: `-1` if x < y, `0` if
 * equal, `1` if x > y — or `NaN` when either operand is NaN (which is
 * unordered; the bignumber.js facade maps this to `null`).
 *
 * `−0` and `+0` compare equal. Infinities order against everything, and
 * `∞ === ∞`. Values with different scales compare correctly: `1.20` equals
 * `1.2`.
 *
 * @param x - The first value.
 * @param y - The second value.
 * @returns `-1`, `0`, `1`, or `NaN`.
 *
 * @example
 * cmp(parse('1.20'), parse('1.2')); // 0
 * cmp(parse('-1'), parse('1'));     // -1
 */
export function cmp(x: PlainDecimal, y: PlainDecimal): number {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) {
      return NaN;
    }
    if (isInfinite(x) && isInfinite(y)) {
      return x.sign === y.sign ? 0 : x.sign;
    }
    if (isInfinite(x)) {
      return x.sign;
    } // ±∞ vs finite
    return -y.sign; // finite vs ±∞
  }
  if (isZero(x)) {
    return isZero(y) ? 0 : -y.sign;
  }
  if (isZero(y)) {
    return x.sign;
  }
  if (x.sign !== y.sign) {
    return x.sign;
  }
  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient,
    yMag = y.coefficient;
  if (scaleDiff > SCALE_GAP_LIMIT || scaleDiff < -SCALE_GAP_LIMIT) {
    // Far-apart scales: decide by decimal-exponent bounds before materializing
    // 10^|scaleDiff| — aligning would cost memory and time proportional to the
    // scale gap (and overflows the BigInt size limit past ~1e9 digits) for
    // values whose order alone settles the comparison, e.g. 1e100000000 vs 1.
    const byExponent = cmpFarScales(xMag, x.scale, yMag, y.scale);
    if (byExponent !== 0) {
      return byExponent * x.sign;
    }
    // Bounds overlap: the exponents are within a few units, so |scaleDiff|
    // approximates the digit-count difference and the alignment below is
    // bounded by the longer coefficient, not the scale gap.
  }
  if (scaleDiff > 0) {
    xMag *= pow10(scaleDiff);
  } else if (scaleDiff < 0) {
    yMag *= pow10(-scaleDiff);
  }
  return xMag === yMag ? 0 : (xMag > yMag ? 1 : -1) * x.sign;
}

const LOG10_2 = Math.log10(2);

/**
 * Orders two far-apart magnitudes by decimal-exponent bounds: `1` if
 * |x| > |y|, `-1` if |x| < |y|, `0` if the bounds overlap and the caller must
 * align. The bounds come from the hex digit count — a power-of-two radix
 * conversion is linear in the coefficient size, unlike decimal `toString`,
 * which is superlinear and was a measured 40–100× regression on long
 * coefficients. Hex length h means bit length in (4h−4, 4h], so
 * floor(log10 c) lies in [floor((4h−4)·log10 2), floor(4h·log10 2)], widened
 * by ±1 against float rounding.
 */
function cmpFarScales(xMag: bigint, xScale: number, yMag: bigint, yScale: number): number {
  const hx = xMag.toString(16).length;
  const hy = yMag.toString(16).length;
  const xLo = Math.floor((4 * hx - 4) * LOG10_2) - 1 + xScale;
  const xHi = Math.floor(4 * hx * LOG10_2) + 1 + xScale;
  const yLo = Math.floor((4 * hy - 4) * LOG10_2) - 1 + yScale;
  const yHi = Math.floor(4 * hy * LOG10_2) + 1 + yScale;
  if (xLo > yHi) {
    return 1;
  }
  if (xHi < yLo) {
    return -1;
  }
  return 0;
}
