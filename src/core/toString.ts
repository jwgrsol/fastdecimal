import type { DecimalValue } from './types.ts';
import { isFinite, isNaN, isZero } from './predicates.ts';

/**
 * Renders a decimal value as a string, in fixed or exponential notation
 * depending on the value's exponent. Specials render as `'NaN'`, `'Infinity'`,
 * `'-Infinity'`.
 *
 * @param x - The value to render.
 * @param negativeExponent - Exponent at or below which output switches to exponential
 *   notation (big.js `NE`, bignumber.js `EXPONENTIAL_AT[0]`, decimal.js `toExpNeg`).
 * @param positiveExponent - Exponent at or above which output switches to exponential
 *   notation (big.js `PE`, bignumber.js `EXPONENTIAL_AT[1]`, decimal.js `toExpPos`).
 * @param signedZero - Whether `−0` renders as `'-0'` (bignumber.js/decimal.js
 *   behavior, the default) or `'0'` (big.js `toString` behavior).
 * @returns The string form of the value.
 *
 * @example
 * toString(parse('1e21'));         // '1e+21'  (past the default threshold)
 * toString(parse('1234'), -7, 3);  // '1.234e+3'
 * toString(parse('-0'));           // '-0'
 */
export function toString(x: DecimalValue, negativeExponent = -7, positiveExponent = 21, signedZero = true): string {
  if (!isFinite(x)) {
    return isNaN(x) ? 'NaN' : x.sign > 0 ? 'Infinity' : '-Infinity';
  }
  const digits = x.coefficient.toString();
  const exponent = isZero(x) ? 0 : digits.length - 1 + x.scale;
  let body: string;
  if (exponent <= negativeExponent || exponent >= positiveExponent) {
    body = digits[0] + (digits.length > 1 ? '.' + digits.slice(1) : '') + (exponent < 0 ? 'e' : 'e+') + exponent;
  } else if (exponent < 0) {
    body = '0.' + '0'.repeat(-exponent - 1) + digits;
  } else {
    const intLen = exponent + 1;
    body =
      intLen >= digits.length
        ? digits + '0'.repeat(intLen - digits.length)
        : digits.slice(0, intLen) + '.' + digits.slice(intLen);
  }
  return x.sign < 0 && (x.coefficient !== 0n || signedZero) ? '-' + body : body;
}
