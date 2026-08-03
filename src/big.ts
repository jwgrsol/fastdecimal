/*
 * fastdecimal — BigInt-powered drop-in replacement for big.js
 * Representation: value = s × _coef × 10^_scale
 *   s:      1 | -1 (kept separate from the BigInt so -0 can be represented)
 *   _coef:  non-negative BigInt coefficient
 *   _scale: base-10 exponent of the least significant digit
 * Invariant: if _coef === 0n then _scale === 0, otherwise _coef % 10n !== 0n
 * (trailing zeros are absorbed into _scale — the same normal form as big.js's digit array c)
 */

export type BigSource = number | string | bigint | Big;
export type RoundingMode = 0 | 1 | 2 | 3;

export interface Big {
  s: number;
  _coef: bigint;
  _scale: number;
  readonly c: number[];
  readonly e: number;
  constructor: BigConstructor;
  abs(): Big;
  add(y: BigSource): Big;
  cmp(y: BigSource): number;
  div(y: BigSource): Big;
  eq(y: BigSource): boolean;
  gt(y: BigSource): boolean;
  gte(y: BigSource): boolean;
  lt(y: BigSource): boolean;
  lte(y: BigSource): boolean;
  minus(y: BigSource): Big;
  mod(y: BigSource): Big;
  mul(y: BigSource): Big;
  neg(): Big;
  plus(y: BigSource): Big;
  pow(exp: number): Big;
  prec(sd: number, rm?: RoundingMode): Big;
  round(dp?: number, rm?: RoundingMode): Big;
  sqrt(): Big;
  sub(y: BigSource): Big;
  times(y: BigSource): Big;
  toExponential(dp?: number, rm?: RoundingMode): string;
  toFixed(dp?: number, rm?: RoundingMode): string;
  toJSON(): string;
  toNumber(): number;
  toPrecision(sd?: number, rm?: RoundingMode): string;
  toString(): string;
  valueOf(): string;
}

export interface BigConstructor {
  (value: BigSource): Big;
  (): BigConstructor;
  new (value: BigSource): Big;
  DP: number;
  RM: RoundingMode;
  NE: number;
  PE: number;
  strict: boolean;
  roundDown: 0;
  roundHalfUp: 1;
  roundHalfEven: 2;
  roundUp: 3;
  Big: BigConstructor;
  default: BigConstructor;
}

const NAME = '[big.js] ';
const INVALID = NAME + 'Invalid ';
const INVALID_DP = INVALID + 'decimal places';
const INVALID_RM = INVALID + 'rounding mode';
const DIV_BY_ZERO = NAME + 'Division by zero';
const MAX_DP = 1e6;
const MAX_POWER = 1e6;

// ---- 10^n BigInt cache ----
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

// ---- strip trailing zeros into the scale (requires coef > 0n) ----
// Returns the stripped coefficient; the adjusted scale is left in `strippedScale`.
// (An out-parameter instead of a [coef, scale] tuple — this runs on every arithmetic
// result, and skipping the array allocation is a measurable win.)
const TEN_16 = 10n ** 16n, TEN_8 = 10n ** 8n, TEN_4 = 10000n, TEN_2 = 100n, TEN_1 = 10n;
let strippedScale = 0;
function stripTrailingZeros(coef: bigint, scale: number): bigint {
  strippedScale = scale;
  if (coef & 1n) return coef; // an odd number cannot be a multiple of 10 — O(1) early exit
  if (coef % TEN_1 !== 0n) return coef;
  while (coef % TEN_16 === 0n) { coef /= TEN_16; scale += 16; }
  if (coef % TEN_8 === 0n) { coef /= TEN_8; scale += 8; }
  if (coef % TEN_4 === 0n) { coef /= TEN_4; scale += 4; }
  if (coef % TEN_2 === 0n) { coef /= TEN_2; scale += 2; }
  if (coef % TEN_1 === 0n) { coef /= TEN_1; scale += 1; }
  strippedScale = scale;
  return coef;
}

function invalid(): never { throw Error(INVALID + 'number'); }

// ---- parsing (accepts exactly what big.js's NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i accepts) ----
function parseInto(x: Big, str: string): void {
  const len = str.length;
  let i = 0, sign = 1;
  if (str.charCodeAt(0) === 45 /* '-' */) { sign = -1; i = 1; }
  const digitsStart = i;
  let dotPos = -1, expPos = -1;
  for (; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code >= 48 && code <= 57) continue; // '0'-'9'
    if (code === 46 /* '.' */ && dotPos < 0 && expPos < 0) { dotPos = i; continue; }
    if ((code === 101 || code === 69) /* 'e' | 'E' */ && i > digitsStart) { expPos = i; break; }
    invalid();
  }
  const mantissaEnd = expPos < 0 ? len : expPos;
  const intLen = (dotPos < 0 ? mantissaEnd : dotPos) - digitsStart;
  const fracLen = dotPos < 0 ? 0 : mantissaEnd - dotPos - 1;
  if (intLen === 0 && fracLen === 0) invalid();

  let exp = 0;
  if (expPos >= 0) {
    let j = expPos + 1, expSign = 1;
    const first = str.charCodeAt(j);
    if (first === 43 /* '+' */) j++; else if (first === 45 /* '-' */) { expSign = -1; j++; }
    if (j >= len) invalid();
    let value = 0;
    for (; j < len; j++) {
      const code = str.charCodeAt(j);
      if (code < 48 || code > 57) invalid();
      value = value * 10 + (code - 48);
    }
    exp = expSign * value;
  }

  const digits = dotPos < 0
    ? str.slice(digitsStart, mantissaEnd)
    : str.slice(digitsStart, dotPos) + str.slice(dotPos + 1, mantissaEnd);
  let start = 0, end = digits.length;
  while (start < end && digits.charCodeAt(start) === 48) start++; // leading zeros
  if (start === end) { x.s = sign; x._coef = 0n; x._scale = 0; return; } // ±0
  let scale = exp - fracLen;
  while (digits.charCodeAt(end - 1) === 48) { end--; scale++; } // trailing zeros
  x.s = sign;
  x._coef = BigInt(start > 0 || end < digits.length ? digits.slice(start, end) : digits);
  x._scale = scale;
}

// ---- shared prototype (shared by every cloned constructor, exactly like big.js) ----
const bigPrototype: any = {};

// Internal allocator: a real constructor call gives V8 a stable hidden class and a
// preallocated shape, measurably faster than Object.create + per-property assignment
const InternalBig: any = function (this: any, sign: number, coef: bigint, scale: number, Ctor: BigConstructor) {
  this.s = sign; this._coef = coef; this._scale = scale;
  this.constructor = Ctor;
};
InternalBig.prototype = bigPrototype;

function makeBig(Ctor: BigConstructor, sign: number, coef: bigint, scale: number): Big {
  return new InternalBig(sign, coef, scale, Ctor);
}
function toBig(x: Big, y: BigSource): Big {
  return y instanceof Object && '_coef' in (y as any) ? (y as Big) : new x.constructor(y as any);
}
function assertRoundingMode(rm: unknown): asserts rm is RoundingMode {
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
}

// Apply rounding to a truncated quotient (operates on magnitude; sign is handled by callers)
function applyRound(truncated: bigint, remainder: bigint, divisor: bigint, rm: RoundingMode): bigint {
  if (remainder === 0n || rm === 0) return truncated;
  if (rm === 3) return truncated + 1n;
  const doubled = remainder * 2n;
  if (rm === 1) return doubled >= divisor ? truncated + 1n : truncated;
  // half-even: round half to the nearest even quotient
  return doubled > divisor ? truncated + 1n
    : doubled < divisor ? truncated
    : (truncated & 1n) ? truncated + 1n : truncated;
}

// Round to dp decimal places (negative dp allowed). A zero result keeps its sign (-0)
function roundToDp(x: Big, dp: number, rm: RoundingMode): Big {
  const Ctor = x.constructor;
  const shift = -dp - x._scale; // how many digits to drop
  if (shift <= 0 || x._coef === 0n) return makeBig(Ctor, x.s, x._coef, x._scale);
  const divisor = pow10(shift);
  const truncated = x._coef / divisor;
  const rounded = applyRound(truncated, x._coef - truncated * divisor, divisor, rm);
  if (rounded === 0n) return makeBig(Ctor, x.s, 0n, 0);
  const coef = stripTrailingZeros(rounded, -dp);
  return makeBig(Ctor, x.s, coef, strippedScale);
}

// Round to sd significant digits (equivalent to big.js's internal round(x, sd, rm))
function roundToSd(x: Big, sd: number, rm: RoundingMode): Big {
  if (x._coef === 0n) return makeBig(x.constructor, x.s, 0n, 0);
  return roundToDp(x, sd - exponentOf(x) - 1, rm);
}

function digitsOf(x: Big): string { return x._coef.toString(); }
// Base-10 exponent of the most significant digit (big.js's e)
function exponentOf(x: Big): number { return x._coef === 0n ? 0 : digitsOf(x).length - 1 + x._scale; }

// Signed addition on magnitudes: compare and subtract smaller from larger instead of
// negating BigInts — avoids up to two negation allocations per call (hot for minus)
function addSigned(x: Big, y: Big, ySign: number): Big {
  const Ctor = x.constructor;
  if (x._coef === 0n && y._coef === 0n) return makeBig(Ctor, x.s < 0 && ySign < 0 ? -1 : 1, 0n, 0);
  const scaleDiff = x._scale - y._scale;
  let xMag = x._coef, yMag = y._coef, scale = x._scale;
  if (scaleDiff > 0) { xMag *= pow10(scaleDiff); scale = y._scale; }
  else if (scaleDiff < 0) { yMag *= pow10(-scaleDiff); }
  let sign: number, magnitude: bigint;
  if (x.s === ySign) { sign = ySign; magnitude = xMag + yMag; }
  else if (xMag === yMag) return makeBig(Ctor, 1, 0n, 0); // exact cancellation → +0 (like big.js)
  else if (xMag > yMag) { sign = x.s; magnitude = xMag - yMag; }
  else { sign = ySign; magnitude = yMag - xMag; }
  const coef = stripTrailingZeros(magnitude, scale);
  return makeBig(Ctor, sign, coef, strippedScale);
}

// ---- string formatting ----
// digits: digit string (may be padded), exponent: base-10 exponent of the most significant digit
function formatExponential(digits: string, exponent: number): string {
  return digits[0]
    + (digits.length > 1 ? '.' + digits.slice(1) : '')
    + (exponent < 0 ? 'e' : 'e+') + exponent;
}
function formatPlain(digits: string, exponent: number): string {
  if (exponent < 0) return '0.' + '0'.repeat(-exponent - 1) + digits;
  const intLen = exponent + 1;
  if (intLen > digits.length) return digits + '0'.repeat(intLen - digits.length);
  if (intLen < digits.length) return digits.slice(0, intLen) + '.' + digits.slice(intLen);
  return digits;
}
// forceSign: emit '-' even for negative zero (big.js's stringify "full precision" paths)
function stringify(x: Big, forceSign: boolean): string {
  const Ctor = x.constructor;
  const digits = digitsOf(x);
  const exponent = x._coef === 0n ? 0 : digits.length - 1 + x._scale;
  const body = exponent <= Ctor.NE || exponent >= Ctor.PE
    ? formatExponential(digits, exponent)
    : formatPlain(digits, exponent);
  return x.s < 0 && (forceSign || x._coef !== 0n) ? '-' + body : body;
}

// ---- instance methods ----

bigPrototype.abs = function (this: Big): Big {
  return makeBig(this.constructor, 1, this._coef, this._scale);
};
bigPrototype.neg = function (this: Big): Big {
  return makeBig(this.constructor, -this.s, this._coef, this._scale);
};

bigPrototype.plus = bigPrototype.add = function (this: Big, y: BigSource): Big {
  const other = toBig(this, y);
  return addSigned(this, other, other.s);
};
bigPrototype.minus = bigPrototype.sub = function (this: Big, y: BigSource): Big {
  const other = toBig(this, y);
  return addSigned(this, other, -other.s);
};

bigPrototype.times = bigPrototype.mul = function (this: Big, y: BigSource): Big {
  const other = toBig(this, y);
  const Ctor = this.constructor;
  const sign = this.s === other.s ? 1 : -1;
  if (this._coef === 0n || other._coef === 0n) return makeBig(Ctor, sign, 0n, 0);
  const coef = stripTrailingZeros(this._coef * other._coef, this._scale + other._scale);
  return makeBig(Ctor, sign, coef, strippedScale);
};

bigPrototype.div = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor, dp = Ctor.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
  const other = toBig(this, y);
  if (other._coef === 0n) throw Error(DIV_BY_ZERO);
  const sign = this.s === other.s ? 1 : -1;
  if (this._coef === 0n) return makeBig(Ctor, sign, 0n, 0);
  const rm = Ctor.RM;
  assertRoundingMode(rm);
  // Scale the integer division so the quotient carries exactly dp decimal places
  const shift = this._scale - other._scale + dp;
  let numerator = this._coef, denominator = other._coef;
  if (shift > 0) numerator *= pow10(shift); else if (shift < 0) denominator *= pow10(-shift);
  const truncated = numerator / denominator;
  // one division + multiply-subtract (replaces a second remainder division)
  const rounded = applyRound(truncated, numerator - truncated * denominator, denominator, rm);
  if (rounded === 0n) return makeBig(Ctor, sign, 0n, 0);
  const coef = stripTrailingZeros(rounded, -dp);
  return makeBig(Ctor, sign, coef, strippedScale);
};

bigPrototype.mod = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor;
  const other = toBig(this, y);
  if (other._coef === 0n) throw Error(DIV_BY_ZERO);
  if (this._coef === 0n) return makeBig(Ctor, this.s, 0n, 0); // preserve ±0
  const scaleDiff = this._scale - other._scale;
  let xVal = this.s < 0 ? -this._coef : this._coef;
  let yVal = other.s < 0 ? -other._coef : other._coef;
  let scale = this._scale;
  if (scaleDiff > 0) { xVal *= pow10(scaleDiff); scale = other._scale; }
  else if (scaleDiff < 0) { yVal *= pow10(-scaleDiff); }
  const quotient = xVal / yVal; // truncating division (same as big.js with DP=0/RM=0)
  const remainder = xVal - quotient * yVal;
  if (remainder === 0n) return makeBig(Ctor, 1, 0n, 0); // big.js computes this via minus, so the result is +0
  const sign = remainder < 0n ? -1 : 1;
  const coef = stripTrailingZeros(sign < 0 ? -remainder : remainder, scale);
  return makeBig(Ctor, sign, coef, strippedScale);
};

bigPrototype.pow = function (this: Big, n: number): Big {
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + 'exponent');
  const Ctor = this.constructor;
  if (n === 0) return new Ctor(1);
  const isNegativeExp = n < 0;
  if (isNegativeExp) n = -n;
  const sign = this.s < 0 && (n & 1) ? -1 : 1;
  let result: Big;
  if (this._coef === 0n) result = makeBig(Ctor, sign, 0n, 0);
  else {
    const coef = stripTrailingZeros(this._coef ** BigInt(n), this._scale * n);
    result = makeBig(Ctor, sign, coef, strippedScale);
  }
  return isNegativeExp ? new Ctor(1).div(result) : result;
};

bigPrototype.sqrt = function (this: Big): Big {
  const Ctor = this.constructor;
  if (this._coef === 0n) return makeBig(Ctor, this.s, 0n, 0);
  if (this.s < 0) throw Error(NAME + 'No square root');
  // Initial estimate via float sqrt (same strategy as big.js)
  let estimate = Math.sqrt(Number(stringify(this, true)));
  let result: Big;
  if (estimate === 0 || estimate === Infinity) {
    // Value out of float range: estimate from the digits and halve the exponent
    let digits = digitsOf(this);
    const exponent = exponentOf(this);
    if (!((digits.length + exponent) & 1)) digits += '0';
    estimate = Math.sqrt(Number(digits));
    const halfExp = (((exponent + 1) / 2) | 0) - (exponent < 0 || exponent & 1 ? 1 : 0);
    let mantissa: string;
    if (estimate === Infinity) mantissa = '5e';
    else {
      const text = estimate.toExponential();
      mantissa = text.slice(0, text.indexOf('e') + 1);
    }
    result = new Ctor(mantissa + halfExp);
  } else {
    result = new Ctor(String(estimate));
  }
  // Newton–Raphson at DP+4 guard digits, then round back to DP
  const DP = Ctor.DP;
  const cmpDigits = exponentOf(result) + (Ctor.DP = DP + 4);
  const half = new Ctor('0.5');
  let prev: Big;
  try {
    do {
      prev = result;
      result = half.times(prev.plus(this.div(prev)));
    } while (digitsOf(prev).slice(0, cmpDigits) !== digitsOf(result).slice(0, cmpDigits));
  } finally {
    Ctor.DP = DP;
  }
  return roundToSd(result, DP + exponentOf(result) + 1, Ctor.RM);
};

bigPrototype.cmp = function (this: Big, y: BigSource): number {
  const other = toBig(this, y);
  if (this._coef === 0n) return other._coef === 0n ? 0 : -other.s;
  if (other._coef === 0n) return this.s;
  if (this.s !== other.s) return this.s;
  const scaleDiff = this._scale - other._scale;
  let xAligned = this._coef, yAligned = other._coef;
  if (scaleDiff > 0) xAligned *= pow10(scaleDiff); else if (scaleDiff < 0) yAligned *= pow10(-scaleDiff);
  return xAligned === yAligned ? 0 : (xAligned > yAligned ? 1 : -1) * this.s;
};
bigPrototype.eq = function (this: Big, y: BigSource): boolean { return this.cmp(y) === 0; };
bigPrototype.gt = function (this: Big, y: BigSource): boolean { return this.cmp(y) > 0; };
bigPrototype.gte = function (this: Big, y: BigSource): boolean { return this.cmp(y) >= 0; };
bigPrototype.lt = function (this: Big, y: BigSource): boolean { return this.cmp(y) < 0; };
bigPrototype.lte = function (this: Big, y: BigSource): boolean { return this.cmp(y) <= 0; };

bigPrototype.round = function (this: Big, dp?: number, rm?: RoundingMode): Big {
  if (dp === undefined) dp = 0;
  else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) throw Error(INVALID_DP);
  if (rm === undefined) rm = this.constructor.RM;
  assertRoundingMode(rm);
  return roundToDp(this, dp, rm);
};

bigPrototype.prec = function (this: Big, sd: number, rm?: RoundingMode): Big {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = this.constructor.RM;
  assertRoundingMode(rm);
  return roundToSd(this, sd, rm);
};

bigPrototype.toExponential = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this._coef !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big = this, pad = 0;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    assertRoundingMode(rm);
    x = roundToSd(this, dp + 1, rm);
    pad = dp + 1;
  }
  let digits = digitsOf(x);
  if (pad > digits.length) digits = digits.padEnd(pad, '0');
  const exponent = x._coef === 0n ? 0 : digitsOf(x).length - 1 + x._scale;
  const body = formatExponential(digits, exponent);
  return x.s < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toFixed = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this._coef !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big = this;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    assertRoundingMode(rm);
    x = roundToDp(this, dp, rm);
  } else dp = Math.max(0, -x._scale);
  // exactly dp digits after the decimal point, never exponential notation
  let coef = x._coef, scale = x._scale;
  if (scale > -dp) { coef *= pow10(scale + dp); scale = -dp; } // align digits (rounding guarantees scale >= -dp)
  const digits = coef.toString();
  let body: string;
  if (dp === 0) body = digits + (scale > 0 ? '0'.repeat(scale) : '');
  else {
    const padded = digits.padStart(dp + 1, '0');
    body = padded.slice(0, padded.length - dp) + '.' + padded.slice(padded.length - dp);
  }
  return x.s < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toPrecision = function (this: Big, sd?: number, rm?: RoundingMode): string {
  if (sd === undefined) return this.toString();
  const Ctor = this.constructor;
  const wasNonzero = this._coef !== 0n;
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = Ctor.RM;
  assertRoundingMode(rm);
  const x = roundToSd(this, sd, rm);
  let digits = digitsOf(x);
  if (sd > digits.length) digits = digits.padEnd(sd, '0');
  const exponent = x._coef === 0n ? 0 : digitsOf(x).length - 1 + x._scale;
  const body = sd <= exponent || exponent <= Ctor.NE || exponent >= Ctor.PE
    ? formatExponential(digits, exponent)
    : formatPlain(digits, exponent);
  return x.s < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toString = bigPrototype.toJSON = function (this: Big): string {
  return stringify(this, false);
};
bigPrototype.valueOf = function (this: Big): string {
  if (this.constructor.strict === true) throw Error(NAME + 'valueOf disallowed');
  return stringify(this, true);
};
bigPrototype.toNumber = function (this: Big): number {
  const n = Number(stringify(this, true));
  if (this.constructor.strict === true && !this.eq(n.toString())) throw Error(NAME + 'Imprecise conversion');
  return n;
};

// big.js ecosystem compatibility: c (digit array) and e (MSD exponent) are derived from
// (_coef, _scale) on read, and writable — assigning them updates the underlying value like
// big.js's plain properties would (setting c keeps e; setting e keeps the digits).
Object.defineProperty(bigPrototype, 'c', {
  get(this: Big): number[] {
    const digits = digitsOf(this);
    const result = new Array(digits.length);
    for (let i = 0; i < digits.length; i++) result[i] = digits.charCodeAt(i) - 48;
    return result;
  },
  set(this: Big, value: number[]): void {
    const exponent = exponentOf(this);
    const digits = value.join('');
    const coef = BigInt(digits);
    if (coef === 0n) { this._coef = 0n; this._scale = 0; return; }
    this._coef = stripTrailingZeros(coef, exponent - (digits.length - 1));
    this._scale = strippedScale;
  },
});
Object.defineProperty(bigPrototype, 'e', {
  get(this: Big): number { return exponentOf(this); },
  set(this: Big, exponent: number): void {
    if (this._coef !== 0n) this._scale = exponent - (digitsOf(this).length - 1);
  },
});

// ---- constructor factory (same as big.js's _Big_: calling Big() with no args returns an independent constructor) ----
function createBig(): BigConstructor {
  const Big = function (this: any, value?: BigSource): any {
    if (!(this instanceof Big)) {
      return value === undefined && arguments.length === 0 ? createBig() : new (Big as any)(value);
    }
    if (value instanceof Object && '_coef' in (value as any)) {
      const other = value as Big;
      this.s = other.s; this._coef = other._coef; this._scale = other._scale;
    } else {
      if (typeof value !== 'string') {
        // strict mode accepts strings, bigints, and Big instances — exactly like big.js (big.js:103)
        if ((Big as any).strict === true && typeof value !== 'bigint') {
          throw TypeError(INVALID + 'value');
        }
        value = typeof value === 'number' && value === 0 && 1 / value < 0 ? '-0' : String(value);
      }
      parseInto(this, value);
    }
    this.constructor = Big;
  } as any;

  Big.prototype = bigPrototype;
  Big.DP = 20;
  Big.RM = 1;
  Big.NE = -7;
  Big.PE = 21;
  Big.strict = false;
  Big.roundDown = 0;
  Big.roundHalfUp = 1;
  Big.roundHalfEven = 2;
  Big.roundUp = 3;
  return Big as BigConstructor;
}

export const Big: BigConstructor = createBig();
(Big as any).default = (Big as any).Big = Big;
export default Big;
