import type { DecimalValue } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Exact addition (contract §2: exact operations take no precision arguments).
 *
 * Special-value propagation (IEEE 754, contract §4):
 *   NaN + anything = NaN · ∞ + (−∞) = NaN · ∞ + finite = ∞
 *
 * Magnitudes are compared and the smaller subtracted from the larger instead of
 * negating BigInts — avoids up to two negation allocations (measured win).
 *
 * Zero signs: (−0) + (−0) = −0; exact cancellation of nonzeros = +0 (IEEE, and
 * what big.js/bignumber.js/decimal.js all produce under default rounding).
 */
export function add(x: DecimalValue, y: DecimalValue): DecimalValue {
  if (x.coefficient === null || y.coefficient === null) {
    if (x.sign === 0 || y.sign === 0) return nan(); // NaN operand
    if (x.coefficient === null && y.coefficient === null) {
      return x.sign === y.sign ? infinity(x.sign as 1 | -1) : nan(); // ∞ + (−∞)
    }
    return infinity((x.coefficient === null ? x.sign : y.sign) as 1 | -1);
  }
  if (x.coefficient === 0n && y.coefficient === 0n) return zero(x.sign < 0 && y.sign < 0 ? -1 : 1);

  const scaleDiff = x.scale - y.scale;
  let xMag = x.coefficient,
    yMag = y.coefficient,
    scale = x.scale;
  if (scaleDiff > 0) {
    xMag *= pow10(scaleDiff);
    scale = y.scale;
  } else if (scaleDiff < 0) {
    yMag *= pow10(-scaleDiff);
  }

  let sign: 1 | -1, magnitude: bigint;
  if (x.sign === y.sign) {
    sign = x.sign as 1 | -1;
    magnitude = xMag + yMag;
  } else if (xMag === yMag)
    return zero(1); // exact cancellation → +0
  else if (xMag > yMag) {
    sign = x.sign as 1 | -1;
    magnitude = xMag - yMag;
  } else {
    sign = y.sign as 1 | -1;
    magnitude = yMag - xMag;
  }

  const coefficient = stripTrailingZeros(magnitude, scale);
  return { sign, coefficient, scale: stripResult.scale };
}
