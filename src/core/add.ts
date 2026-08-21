import type { PlainDecimal } from './types.ts';
import { pow10 } from './_internal/pow10.ts';
import { nan, infinity, zero, fromParts } from './make.ts';
import { isFinite, isNaN, isInfinite, isZero } from './predicates.ts';

/**
 * Adds two decimal values exactly, with no rounding and no precision limit.
 *
 * Special values propagate by IEEE 754 rules: `NaN + anything = NaN`,
 * `∞ + (−∞) = NaN`, `∞ + finite = ∞`. Zero signs follow IEEE as well:
 * `(−0) + (−0) = −0`, and exact cancellation of nonzero operands yields `+0`.
 *
 * Implementation note: magnitudes are compared and the smaller subtracted from
 * the larger instead of negating BigInts — avoids up to two negation
 * allocations per call (a measured win on small operands).
 *
 * @param x - The first addend.
 * @param y - The second addend.
 * @returns The exact sum as a new normalized value.
 *
 * @example
 * const result = add(parse('0.1'), parse('0.2'));
 * toString(result); // '0.3' — exact, no binary float error
 */
export function add(x: PlainDecimal, y: PlainDecimal): PlainDecimal {
  if (!isFinite(x) || !isFinite(y)) {
    if (isNaN(x) || isNaN(y)) {
      return nan();
    }
    if (isInfinite(x) && isInfinite(y)) {
      return x.sign === y.sign ? infinity(x.sign) : nan();
    } // ∞ + (−∞)
    return isInfinite(x) ? infinity(x.sign) : infinity(y.sign as 1 | -1); // ∞ + finite
  }
  if (isZero(x) || isZero(y)) {
    return addZeroOperand(x, y);
  }

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
  } else if (xMag === yMag) {
    return zero(1);
  } // exact cancellation → +0
  else if (xMag > yMag) {
    sign = x.sign as 1 | -1;
    magnitude = xMag - yMag;
  } else {
    sign = y.sign as 1 | -1;
    magnitude = yMag - xMag;
  }

  return fromParts(sign, magnitude, scale);
}

/**
 * At least one operand is zero — outlined so add's common-case body stays
 * within the JIT inlining budget. `0 + y` returns y's value without aligning:
 * the alignment path would materialize 10^|scaleDiff|, which for
 * `0 + 1e1000000` is a million-digit multiply (and past ~1e9 digits, a
 * RangeError) big.js answers in O(1).
 */
function addZeroOperand(x: PlainDecimal, y: PlainDecimal): PlainDecimal {
  if (isZero(x)) {
    if (isZero(y)) {
      return zero(x.sign < 0 && y.sign < 0 ? -1 : 1);
    }
    return { sign: y.sign, coefficient: y.coefficient, scale: y.scale };
  }
  return { sign: x.sign, coefficient: x.coefficient, scale: x.scale };
}
