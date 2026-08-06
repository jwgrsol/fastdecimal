import type { DecimalValue } from './types.ts';
import { nan, infinity, zero } from './make.ts';

/**
 * Parse a decimal string: optional sign, digits with optional dot, optional
 * e-notation exponent, plus the special literals NaN / Infinity / -Infinity.
 *
 * Throws a neutral Error on invalid input (contract §4) — facades validate
 * against their own grammars first and produce their own legacy messages.
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
