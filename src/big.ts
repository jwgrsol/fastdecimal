/*
 * fastdecimal — big.js facade over the functional core (docs/core-contract.md §6).
 *
 * This file contains ONLY the big.js translation layer: its grammar and error
 * messages, its constructor semantics (new-less calls, the Big() clone factory,
 * shared prototype), its global settings (DP/RM/NE/PE/strict), its rounding-mode
 * numbering, and its derived c/e properties. All arithmetic lives in src/core.
 *
 * Instances are structurally core Dec values: they carry {sign, coef, scale} as
 * own fields, so they flow into core functions with zero conversion cost. The
 * big.js public property `s` is a prototype accessor over `sign`.
 */

import type { Dec, RoundingMode as CoreRoundingMode } from './core/types.ts';
import { add as coreAdd } from './core/add.ts';
import { sub as coreSub } from './core/sub.ts';
import { mul as coreMul } from './core/mul.ts';
import { divToDp as coreDivToDp } from './core/divToDp.ts';
import { cmp as coreCmp } from './core/cmp.ts';
import { roundToDp as coreRoundToDp } from './core/roundToDp.ts';
import { roundToSd as coreRoundToSd } from './core/roundToSd.ts';
import { toString as coreToString } from './core/toString.ts';
import { exponentOf } from './core/_internal/exponentOf.ts';
import { pow10 } from './core/_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './core/_internal/strip.ts';

export type BigSource = number | string | bigint | Big;
export type RoundingMode = 0 | 1 | 2 | 3;

export interface Big {
  sign: 1 | -1; // structurally a subset of core Dec's sign (the facade never holds NaN)
  coef: bigint;
  scale: number;
  s: number;
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

// ---- big.js contract constants (error strings are part of the observable API) ----
const NAME = '[big.js] ';
const INVALID = NAME + 'Invalid ';
const INVALID_DP = INVALID + 'decimal places';
const INVALID_RM = INVALID + 'rounding mode';
const DIV_BY_ZERO = NAME + 'Division by zero';
const MAX_DP = 1e6;
const MAX_POWER = 1e6;

// big.js rounding numbering → core numbering (contract §3)
// big 0 roundDown→core 1 DOWN · big 1 roundHalfUp→core 4 · big 2 roundHalfEven→core 6 · big 3 roundUp→core 0
const TO_CORE_RM: readonly CoreRoundingMode[] = [1, 4, 6, 0];

function invalid(): never { throw Error(INVALID + 'number'); }

// ---- parsing (accepts exactly what big.js's NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i accepts) ----
// Stays in the facade: the grammar (no leading '+', no NaN/Infinity literals) and the
// error message are big.js contract, not core parsing.
function parseInto(x: Big, str: string): void {
  const len = str.length;
  let i = 0;
  let sign: 1 | -1 = 1;
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
  if (start === end) { x.sign = sign; x.coef = 0n; x.scale = 0; return; } // ±0
  let scale = exp - fracLen;
  while (digits.charCodeAt(end - 1) === 48) { end--; scale++; } // trailing zeros
  x.sign = sign;
  x.coef = BigInt(start > 0 || end < digits.length ? digits.slice(start, end) : digits);
  x.scale = scale;
}

// ---- shared prototype (shared by every cloned constructor, exactly like big.js) ----
const bigPrototype: any = {};

// Internal allocator: a real constructor call gives V8 a stable hidden class and a
// preallocated shape, measurably faster than Object.create + per-property assignment
const InternalBig: any = function (this: any, sign: number, coef: bigint, scale: number, Ctor: BigConstructor) {
  this.sign = sign; this.coef = coef; this.scale = scale;
  this.constructor = Ctor;
};
InternalBig.prototype = bigPrototype;

function makeBig(Ctor: BigConstructor, sign: number, coef: bigint, scale: number): Big {
  return new InternalBig(sign, coef, scale, Ctor);
}
/** Wrap a core result into a big.js instance. */
function fromDec(Ctor: BigConstructor, d: Dec): Big {
  return new InternalBig(d.sign, d.coef, d.scale, Ctor);
}
function toBig(x: Big, y: BigSource): Big {
  return y instanceof Object && 'coef' in (y as any) ? (y as Big) : new x.constructor(y as any);
}
function checkRM(rm: unknown): asserts rm is RoundingMode {
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
}

function digitsOf(x: Big | Dec): string { return (x.coef as bigint).toString(); }

// big.js's stringify: exponential form outside (NE, PE); forceSign emits '-' even for -0
function stringify(x: Big | Dec, forceSign: boolean): string {
  const Ctor = (x as Big).constructor;
  return coreToString(x as Dec, Ctor.NE, Ctor.PE, forceSign);
}

// ---- instance methods ----

bigPrototype.abs = function (this: Big): Big {
  return makeBig(this.constructor, 1, this.coef, this.scale);
};
bigPrototype.neg = function (this: Big): Big {
  return makeBig(this.constructor, -this.sign, this.coef, this.scale);
};

bigPrototype.plus = bigPrototype.add = function (this: Big, y: BigSource): Big {
  return fromDec(this.constructor, coreAdd(this, toBig(this, y)));
};
bigPrototype.minus = bigPrototype.sub = function (this: Big, y: BigSource): Big {
  return fromDec(this.constructor, coreSub(this, toBig(this, y)));
};
bigPrototype.times = bigPrototype.mul = function (this: Big, y: BigSource): Big {
  return fromDec(this.constructor, coreMul(this, toBig(this, y)));
};

bigPrototype.div = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor, dp = Ctor.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
  const other = toBig(this, y);
  if (other.coef === 0n) throw Error(DIV_BY_ZERO); // big.js throws; the core would return ±∞
  const rm = Ctor.RM;
  checkRM(rm);
  return fromDec(Ctor, coreDivToDp(this, other, dp, TO_CORE_RM[rm]));
};

bigPrototype.mod = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor;
  const other = toBig(this, y);
  if (other.coef === 0n) throw Error(DIV_BY_ZERO);
  if (this.coef === 0n) return makeBig(Ctor, this.sign, 0n, 0); // preserve ±0
  const scaleDiff = this.scale - other.scale;
  let xVal = this.sign < 0 ? -this.coef : this.coef;
  let yVal = other.sign < 0 ? -other.coef : other.coef;
  let scale = this.scale;
  if (scaleDiff > 0) { xVal *= pow10(scaleDiff); scale = other.scale; }
  else if (scaleDiff < 0) { yVal *= pow10(-scaleDiff); }
  const quotient = xVal / yVal; // truncating division (same as big.js with DP=0/RM=0)
  const remainder = xVal - quotient * yVal;
  if (remainder === 0n) return makeBig(Ctor, 1, 0n, 0); // big.js computes this via minus, so the result is +0
  const sign = remainder < 0n ? -1 : 1;
  const coef = stripTrailingZeros(sign < 0 ? -remainder : remainder, scale);
  return makeBig(Ctor, sign, coef, stripResult.scale);
};

bigPrototype.pow = function (this: Big, n: number): Big {
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + 'exponent');
  const Ctor = this.constructor;
  if (n === 0) return new Ctor(1);
  const isNegativeExp = n < 0;
  if (isNegativeExp) n = -n;
  const sign = this.sign < 0 && (n & 1) ? -1 : 1;
  let result: Big;
  if (this.coef === 0n) result = makeBig(Ctor, sign, 0n, 0);
  else {
    const coef = stripTrailingZeros(this.coef ** BigInt(n), this.scale * n);
    result = makeBig(Ctor, sign, coef, stripResult.scale);
  }
  return isNegativeExp ? new Ctor(1).div(result) : result;
};

bigPrototype.sqrt = function (this: Big): Big {
  const Ctor = this.constructor;
  if (this.coef === 0n) return makeBig(Ctor, this.sign, 0n, 0);
  if (this.sign < 0) throw Error(NAME + 'No square root');
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
  return fromDec(Ctor, coreRoundToSd(result, DP + exponentOf(result) + 1, TO_CORE_RM[Ctor.RM]));
};

bigPrototype.cmp = function (this: Big, y: BigSource): number {
  return coreCmp(this, toBig(this, y));
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
  checkRM(rm);
  return fromDec(this.constructor, coreRoundToDp(this, dp, TO_CORE_RM[rm]));
};

bigPrototype.prec = function (this: Big, sd: number, rm?: RoundingMode): Big {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = this.constructor.RM;
  checkRM(rm);
  return fromDec(this.constructor, coreRoundToSd(this, sd, TO_CORE_RM[rm]));
};

bigPrototype.toExponential = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this.coef !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big | Dec = this, pad = 0;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = coreRoundToSd(this, dp + 1, TO_CORE_RM[rm]);
    pad = dp + 1;
  }
  let digits = digitsOf(x);
  if (pad > digits.length) digits = digits.padEnd(pad, '0');
  const exponent = x.coef === 0n ? 0 : digitsOf(x).length - 1 + x.scale;
  const body = digits[0]
    + (digits.length > 1 ? '.' + digits.slice(1) : '')
    + (exponent < 0 ? 'e' : 'e+') + exponent;
  return x.sign < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toFixed = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this.coef !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big | Dec = this;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = coreRoundToDp(this, dp, TO_CORE_RM[rm]);
  } else dp = Math.max(0, -x.scale);
  // exactly dp digits after the decimal point, never exponential notation
  let coef = x.coef as bigint, scale = x.scale;
  if (scale > -dp) { coef *= pow10(scale + dp); scale = -dp; } // align digits (rounding guarantees scale >= -dp)
  const digits = coef.toString();
  let body: string;
  if (dp === 0) body = digits + (scale > 0 ? '0'.repeat(scale) : '');
  else {
    const padded = digits.padStart(dp + 1, '0');
    body = padded.slice(0, padded.length - dp) + '.' + padded.slice(padded.length - dp);
  }
  return x.sign < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toPrecision = function (this: Big, sd?: number, rm?: RoundingMode): string {
  if (sd === undefined) return this.toString();
  const Ctor = this.constructor;
  const wasNonzero = this.coef !== 0n;
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = Ctor.RM;
  checkRM(rm);
  const x = coreRoundToSd(this, sd, TO_CORE_RM[rm]);
  let digits = digitsOf(x);
  if (sd > digits.length) digits = digits.padEnd(sd, '0');
  const exponent = x.coef === 0n ? 0 : digitsOf(x).length - 1 + x.scale;
  let body: string;
  if (sd <= exponent || exponent <= Ctor.NE || exponent >= Ctor.PE) {
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
  return x.sign < 0 && wasNonzero ? '-' + body : body;
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

// ---- big.js public properties as accessors over the core representation ----

// s: the big.js sign property (1 | -1), read and written by user code
Object.defineProperty(bigPrototype, 's', {
  get(this: Big): number { return this.sign; },
  set(this: Big, value: number): void { this.sign = value as 1 | -1; },
});

// c (digit array) and e (MSD exponent) are derived on read and writable —
// assigning them updates the underlying value like big.js's plain properties
// would (setting c keeps e; setting e keeps the digits).
Object.defineProperty(bigPrototype, 'c', {
  get(this: Big): number[] {
    const digits = digitsOf(this);
    const result = new Array(digits.length);
    for (let i = 0; i < digits.length; i++) result[i] = digits.charCodeAt(i) - 48;
    return result;
  },
  set(this: Big, value: number[]): void {
    const exponent = this.coef === 0n ? 0 : exponentOf(this);
    const digits = value.join('');
    const coef = BigInt(digits);
    if (coef === 0n) { this.coef = 0n; this.scale = 0; return; }
    this.coef = stripTrailingZeros(coef, exponent - (digits.length - 1));
    this.scale = stripResult.scale;
  },
});
Object.defineProperty(bigPrototype, 'e', {
  get(this: Big): number { return this.coef === 0n ? 0 : exponentOf(this); },
  set(this: Big, exponent: number): void {
    if (this.coef !== 0n) this.scale = exponent - (digitsOf(this).length - 1);
  },
});

// ---- constructor factory (same as big.js's _Big_: calling Big() with no args returns an independent constructor) ----
function createBig(): BigConstructor {
  const Big = function (this: any, value?: BigSource): any {
    if (!(this instanceof Big)) {
      return value === undefined && arguments.length === 0 ? createBig() : new (Big as any)(value);
    }
    if (value instanceof Object && 'coef' in (value as any)) {
      const other = value as Big;
      this.sign = other.sign; this.coef = other.coef; this.scale = other.scale;
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
