import type { DecimalValue } from './types.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Parses a decimal string into a normalized value.
 *
 * Accepts an optional sign (`+` or `-`), digits with an optional decimal
 * point, an optional e-notation exponent (`1.2e-5`), and the special literals
 * `NaN` / `Infinity` / `-Infinity`. The result is always in normal form:
 * trailing zeros are absorbed into the scale, so `parse('1.20')` and
 * `parse('1.2')` produce identical representations.
 *
 * Throws a neutral `Error` on invalid input — facades validate against their
 * own stricter grammars first and produce their own legacy messages.
 *
 * @param str - The decimal string to parse.
 * @returns The parsed value in normal form.
 *
 * @example
 * parse('123.4500'); // { sign: 1, coefficient: 12345n, scale: -2 }
 * parse('-0');       // { sign: -1, coefficient: 0n, scale: 0 }
 * parse('1e21');     // { sign: 1, coefficient: 1n, scale: 21 }
 */
export function parse(str: string): DecimalValue {
  const len = str.length;
  let i = 0;
  let sign: 1 | -1 = 1;
  const first = str.charCodeAt(0);
  if (first === 45 /* '-' */) {
    sign = -1;
    i = 1;
  } else if (first === 43 /* '+' */) {
    i = 1;
  }

  // special literals
  if (str.charCodeAt(i) === 78 /* 'N' */) {
    if (str.slice(i) === 'NaN' && i === 0) return nan();
    throw Error(`Invalid decimal string: ${str}`);
  }
  if (str.charCodeAt(i) === 73 /* 'I' */) {
    if (str.slice(i) === 'Infinity') return infinity(sign);
    throw Error(`Invalid decimal string: ${str}`);
  }

  const digitsStart = i;
  let dotPos = -1,
    expPos = -1;
  for (; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code >= 48 && code <= 57) continue; // '0'-'9'
    if (code === 46 /* '.' */ && dotPos < 0 && expPos < 0) {
      dotPos = i;
      continue;
    }
    if ((code === 101 || code === 69) /* 'e' | 'E' */ && i > digitsStart) {
      expPos = i;
      break;
    }
    throw Error(`Invalid decimal string: ${str}`);
  }
  const mantissaEnd = expPos < 0 ? len : expPos;
  const intLen = (dotPos < 0 ? mantissaEnd : dotPos) - digitsStart;
  const fracLen = dotPos < 0 ? 0 : mantissaEnd - dotPos - 1;
  if (intLen === 0 && fracLen === 0) throw Error(`Invalid decimal string: ${str}`);

  let exp = 0;
  if (expPos >= 0) {
    let j = expPos + 1,
      expSign = 1;
    const c = str.charCodeAt(j);
    if (c === 43 /* '+' */) j++;
    else if (c === 45 /* '-' */) {
      expSign = -1;
      j++;
    }
    if (j >= len) throw Error(`Invalid decimal string: ${str}`);
    let value = 0;
    for (; j < len; j++) {
      const code = str.charCodeAt(j);
      if (code < 48 || code > 57) throw Error(`Invalid decimal string: ${str}`);
      value = value * 10 + (code - 48);
    }
    exp = expSign * value;
  }

  const digits =
    dotPos < 0
      ? str.slice(digitsStart, mantissaEnd)
      : str.slice(digitsStart, dotPos) + str.slice(dotPos + 1, mantissaEnd);
  let start = 0,
    end = digits.length;
  while (start < end && digits.charCodeAt(start) === 48) start++; // leading zeros
  if (start === end) return zero(sign);
  let scale = exp - fracLen;
  while (digits.charCodeAt(end - 1) === 48) {
    end--;
    scale++;
  } // trailing zeros
  return {
    sign,
    coefficient: BigInt(start > 0 || end < digits.length ? digits.slice(start, end) : digits),
    scale,
  };
}
