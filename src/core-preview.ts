/*
 * v1 architecture preview — a tree-shakable functional core (experimental, NOT part of the public API)
 *
 * Why this file exists: a class API like big.js hangs every method off the prototype,
 * so bundlers must ship the whole class even if you import a single method
 * (tree-shaking is impossible). Modeling values as plain objects {sign, coef, scale}
 * and operations as standalone functions means only the functions you import end up
 * in the bundle. See examples/treeshake/ for a measured comparison.
 *
 * In v1, the big.js-compatible class (src/big.ts) becomes a thin wrapper on top of this core.
 */

export interface Dec {
  sign: number;  // 1 | -1 (kept separate from the BigInt so -0 can be represented)
  coef: bigint;  // non-negative BigInt coefficient
  scale: number; // base-10 exponent of the least significant digit — value = sign × coef × 10^scale
}

const POWERS_OF_TEN: bigint[] = [1n];
function pow10(n: number): bigint {
  if (n < POWERS_OF_TEN.length) return POWERS_OF_TEN[n];
  if (n <= 4096) {
    let value = POWERS_OF_TEN[POWERS_OF_TEN.length - 1];
    for (let i = POWERS_OF_TEN.length; i <= n; i++) POWERS_OF_TEN[i] = value *= 10n;
    return value;
  }
  return 10n ** BigInt(n);
}

const TEN = 10n;
// Strip trailing zeros into the scale (requires coef > 0n)
function stripTrailingZeros(coef: bigint, scale: number): [bigint, number] {
  if (coef & 1n) return [coef, scale]; // an odd number cannot be a multiple of 10
  while (coef % TEN === 0n) { coef /= TEN; scale += 1; }
  return [coef, scale];
}

export function parse(str: string): Dec {
  const negative = str.charCodeAt(0) === 45; // '-'
  const body = negative ? str.slice(1) : str;
  const dotPos = body.indexOf('.');
  const digits = dotPos < 0 ? body : body.slice(0, dotPos) + body.slice(dotPos + 1);
  let scale = dotPos < 0 ? 0 : -(body.length - dotPos - 1);
  let start = 0, end = digits.length;
  while (start < end && digits.charCodeAt(start) === 48) start++; // leading zeros
  if (start === end) return { sign: negative ? -1 : 1, coef: 0n, scale: 0 };
  while (digits.charCodeAt(end - 1) === 48) { end--; scale++; } // trailing zeros
  return { sign: negative ? -1 : 1, coef: BigInt(digits.slice(start, end)), scale };
}

export function add(x: Dec, y: Dec): Dec {
  if (x.coef === 0n && y.coef === 0n) return { sign: 1, coef: 0n, scale: 0 };
  const scaleDiff = x.scale - y.scale;
  let xVal = x.sign < 0 ? -x.coef : x.coef;
  let yVal = y.sign < 0 ? -y.coef : y.coef;
  let scale = x.scale;
  if (scaleDiff > 0) { xVal *= pow10(scaleDiff); scale = y.scale; }
  else if (scaleDiff < 0) { yVal *= pow10(-scaleDiff); }
  const sum = xVal + yVal;
  if (sum === 0n) return { sign: 1, coef: 0n, scale: 0 };
  const sign = sum < 0n ? -1 : 1;
  const [coef, scale2] = stripTrailingZeros(sign < 0 ? -sum : sum, scale);
  return { sign, coef, scale: scale2 };
}

export function mul(x: Dec, y: Dec): Dec {
  const sign = x.sign === y.sign ? 1 : -1;
  if (x.coef === 0n || y.coef === 0n) return { sign, coef: 0n, scale: 0 };
  const [coef, scale] = stripTrailingZeros(x.coef * y.coef, x.scale + y.scale);
  return { sign, coef, scale };
}

export function toStr(x: Dec): string {
  const digits = x.coef.toString();
  const exponent = x.coef === 0n ? 0 : digits.length - 1 + x.scale;
  let body: string;
  if (exponent < 0) body = '0.' + '0'.repeat(-exponent - 1) + digits;
  else if (exponent + 1 > digits.length) body = digits + '0'.repeat(exponent + 1 - digits.length);
  else if (exponent + 1 < digits.length) body = digits.slice(0, exponent + 1) + '.' + digits.slice(exponent + 1);
  else body = digits;
  return x.sign < 0 && x.coef !== 0n ? '-' + body : body;
}
