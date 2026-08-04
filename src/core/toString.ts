import type { DecimalValue } from './types.ts';

/**
 * Fixed/exponential string form of a value.
 *
 * `negativeExponent`/`positiveExponent` are the exponent thresholds at which output switches to
 * exponential notation (the NE/PE of big.js, EXPONENTIAL_AT of bignumber.js,
 * toExpNeg/toExpPos of decimal.js — all default to −7/21).
 *
 * `signedZero`: whether −0 renders as "-0" (bignumber.js/decimal.js) or "0"
 * (big.js toString) — a facade-visible difference, so it is a parameter.
 */
export function toString(x: DecimalValue, negativeExponent = -7, positiveExponent = 21, signedZero = true): string {
  if (x.coefficient === null) return x.sign === 0 ? 'NaN' : x.sign > 0 ? 'Infinity' : '-Infinity';
  const digits = x.coefficient.toString();
  const exponent = x.coefficient === 0n ? 0 : digits.length - 1 + x.scale;
  let body: string;
  if (exponent <= negativeExponent || exponent >= positiveExponent) {
    body = digits[0]
      + (digits.length > 1 ? '.' + digits.slice(1) : '')
      + (exponent < 0 ? 'e' : 'e+') + exponent;
  } else if (exponent < 0) {
    body = '0.' + '0'.repeat(-exponent - 1) + digits;
  } else {
    const intLen = exponent + 1;
    body = intLen >= digits.length
      ? digits + '0'.repeat(intLen - digits.length)
      : digits.slice(0, intLen) + '.' + digits.slice(intLen);
  }
  return x.sign < 0 && (x.coefficient !== 0n || signedZero) ? '-' + body : body;
}
