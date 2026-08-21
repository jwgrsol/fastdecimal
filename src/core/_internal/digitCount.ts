import { pow10 } from './pow10.ts';

const LOG10_2 = Math.log10(2);

/**
 * Exact decimal digit count of a positive coefficient in linear time.
 *
 * Decimal `toString` is superlinear (division-based); hex is a power-of-two
 * radix, so conversion is a linear bit-slicing pass. The leading hex digit
 * gives the exact bit length, which pins the digit count to at most two
 * candidates (a bit range spans less than one decade); one pow10 comparison
 * settles it. The extra ±1 steps guard against float rounding in the
 * bits·log10(2) product, which can be off by one for bit lengths whose product
 * lands within ~1e-8 of an integer.
 */
export function digitCount(coefficient: bigint): number {
  const hex = coefficient.toString(16);
  const lead = hex.charCodeAt(0);
  const leadBits =
    lead >= 56 /* '8', '9', 'a'-'f' */ ? 4 : lead >= 52 /* '4'-'7' */ ? 3 : lead >= 50 /* '2'-'3' */ ? 2 : 1;
  const bits = (hex.length - 1) * 4 + leadBits;
  let digits = Math.floor(bits * LOG10_2) + 1;
  if (coefficient < pow10(digits - 1)) {
    digits -= 1;
    if (digits > 1 && coefficient < pow10(digits - 1)) {
      digits -= 1;
    }
  } else if (coefficient >= pow10(digits)) {
    digits += 1;
  }
  return digits;
}
