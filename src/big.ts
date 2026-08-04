/*
 * fastdecimal — big.js facade over the functional core (docs/core-contract.md §6).
 *
 * This file contains ONLY the big.js translation layer: its grammar and error
 * messages, its constructor semantics (new-less calls, the Big() clone factory,
 * shared prototype), its global settings (DP/RM/NE/PE/strict), its rounding-mode
 * numbering, and its derived c/e properties. All arithmetic lives in src/core.
 *
 * Instances are structurally core DecimalValue values: they carry {sign, coefficient, scale} as
 * own fields, so they flow into core functions with zero conversion cost. The
 * big.js public property `s` is a prototype accessor over `sign`.
 */

import type { DecimalValue, RoundingMode as CoreRoundingMode } from './core/types.ts';
import { add as coreAdd } from './core/add.ts';
import { sub as coreSub } from './core/sub.ts';
import { mul as coreMul } from './core/mul.ts';
import { divToDecimalPlaces as coreDivToDecimalPlaces } from './core/divToDecimalPlaces.ts';
import { mod as coreMod } from './core/mod.ts';
import { powInt as corePowInt } from './core/powInt.ts';
import { sqrtToDecimalPlaces as coreSqrtToDecimalPlaces } from './core/sqrtToDecimalPlaces.ts';
import { cmp as coreCmp } from './core/cmp.ts';
import { roundToDecimalPlaces as coreRoundToDecimalPlaces } from './core/roundToDecimalPlaces.ts';
import { roundToSignificantDigits as coreRoundToSignificantDigits } from './core/roundToSignificantDigits.ts';
import { toString as coreToString } from './core/toString.ts';
import { exponentOf } from './core/exponentOf.ts';
import { pow10 } from './core/_internal/pow10.ts';
import { stripTrailingZeros, stripResult } from './core/_internal/strip.ts';

export type BigSource = number | string | bigint | Big;
export type RoundingMode = 0 | 1 | 2 | 3;

export interface Big {
  sign: 1 | -1; // structurally a subset of core DecimalValue's sign (the facade never holds NaN)
  coefficient: bigint;
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
  if (start === end) { x.sign = sign; x.coefficient = 0n; x.scale = 0; return; } // ±0
  let scale = exp - fracLen;
  while (digits.charCodeAt(end - 1) === 48) { end--; scale++; } // trailing zeros
  x.sign = sign;
  x.coefficient = BigInt(start > 0 || end < digits.length ? digits.slice(start, end) : digits);
  x.scale = scale;
}

// ---- shared prototype (shared by every cloned constructor, exactly like big.js) ----
const bigPrototype: any = {};

// Internal allocator: a real constructor call gives V8 a stable hidden class and a
// preallocated shape, measurably faster than Object.create + per-property assignment
const InternalBig: any = function (this: any, sign: number, coefficient: bigint, scale: number, Ctor: BigConstructor) {
  this.sign = sign; this.coefficient = coefficient; this.scale = scale;
  this.constructor = Ctor;
};
InternalBig.prototype = bigPrototype;

function makeBig(Ctor: BigConstructor, sign: number, coefficient: bigint, scale: number): Big {
  return new InternalBig(sign, coefficient, scale, Ctor);
}
/** Wrap a core result into a big.js instance. */
function fromDec(Ctor: BigConstructor, d: DecimalValue): Big {
  return new InternalBig(d.sign, d.coefficient, d.scale, Ctor);
}
function toBig(x: Big, y: BigSource): Big {
  return y instanceof Object && 'coefficient' in (y as any) ? (y as Big) : new x.constructor(y as any);
}
function checkRM(rm: unknown): asserts rm is RoundingMode {
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
}

function digitsOf(x: Big | DecimalValue): string { return (x.coefficient as bigint).toString(); }

// big.js's stringify: exponential form outside (NE, PE); forceSign emits '-' even for -0
function stringify(x: Big | DecimalValue, forceSign: boolean): string {
  const Ctor = (x as Big).constructor;
  return coreToString(x as DecimalValue, Ctor.NE, Ctor.PE, forceSign);
}

// ---- instance methods ----

bigPrototype.abs = function (this: Big): Big {
  return makeBig(this.constructor, 1, this.coefficient, this.scale);
};
bigPrototype.neg = function (this: Big): Big {
  return makeBig(this.constructor, -this.sign, this.coefficient, this.scale);
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
  if (other.coefficient === 0n) throw Error(DIV_BY_ZERO); // big.js throws; the core would return ±∞
  const rm = Ctor.RM;
  checkRM(rm);
  return fromDec(Ctor, coreDivToDecimalPlaces(this, other, dp, TO_CORE_RM[rm]));
};

bigPrototype.mod = function (this: Big, y: BigSource): Big {
  const other = toBig(this, y);
  if (other.coefficient === 0n) throw Error(DIV_BY_ZERO); // big.js throws; the core would return NaN
  return fromDec(this.constructor, coreMod(this, other, 1)); // mode 1 = truncated division (big.js semantics)
};

bigPrototype.pow = function (this: Big, n: number): Big {
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + 'exponent');
  const Ctor = this.constructor;
  if (n === 0) return new Ctor(1); // big.js: x^0 = 1 unconditionally (facade policy)
  const isNegativeExp = n < 0;
  const result = fromDec(Ctor, corePowInt(this, isNegativeExp ? -n : n));
  return isNegativeExp ? new Ctor(1).div(result) : result; // 1 ÷ x^n at the facade's DP/RM
};

bigPrototype.sqrt = function (this: Big): Big {
  const Ctor = this.constructor;
  if (this.coefficient === 0n) return makeBig(Ctor, this.sign, 0n, 0);
  if (this.sign < 0) throw Error(NAME + 'No square root'); // big.js throws; the core would return NaN
  const dp = Ctor.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP); // big.js validates via its inner div
  const rm = Ctor.RM;
  checkRM(rm);
  return fromDec(Ctor, coreSqrtToDecimalPlaces(this, dp, TO_CORE_RM[rm]));
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
  return fromDec(this.constructor, coreRoundToDecimalPlaces(this, dp, TO_CORE_RM[rm]));
};

bigPrototype.prec = function (this: Big, sd: number, rm?: RoundingMode): Big {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = this.constructor.RM;
  checkRM(rm);
  return fromDec(this.constructor, coreRoundToSignificantDigits(this, sd, TO_CORE_RM[rm]));
};

bigPrototype.toExponential = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this.coefficient !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big | DecimalValue = this, pad = 0;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = coreRoundToSignificantDigits(this, dp + 1, TO_CORE_RM[rm]);
    pad = dp + 1;
  }
  let digits = digitsOf(x);
  if (pad > digits.length) digits = digits.padEnd(pad, '0');
  const exponent = x.coefficient === 0n ? 0 : digitsOf(x).length - 1 + x.scale;
  const body = digits[0]
    + (digits.length > 1 ? '.' + digits.slice(1) : '')
    + (exponent < 0 ? 'e' : 'e+') + exponent;
  return x.sign < 0 && wasNonzero ? '-' + body : body;
};

bigPrototype.toFixed = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this.coefficient !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big | DecimalValue = this;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = coreRoundToDecimalPlaces(this, dp, TO_CORE_RM[rm]);
  } else dp = Math.max(0, -x.scale);
  // exactly dp digits after the decimal point, never exponential notation
  let coefficient = x.coefficient as bigint, scale = x.scale;
  if (scale > -dp) { coefficient *= pow10(scale + dp); scale = -dp; } // align digits (rounding guarantees scale >= -dp)
  const digits = coefficient.toString();
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
  const wasNonzero = this.coefficient !== 0n;
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = Ctor.RM;
  checkRM(rm);
  const x = coreRoundToSignificantDigits(this, sd, TO_CORE_RM[rm]);
  let digits = digitsOf(x);
  if (sd > digits.length) digits = digits.padEnd(sd, '0');
  const exponent = x.coefficient === 0n ? 0 : digitsOf(x).length - 1 + x.scale;
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
    const exponent = this.coefficient === 0n ? 0 : exponentOf(this);
    const digits = value.join('');
    const coefficient = BigInt(digits);
    if (coefficient === 0n) { this.coefficient = 0n; this.scale = 0; return; }
    this.coefficient = stripTrailingZeros(coefficient, exponent - (digits.length - 1));
    this.scale = stripResult.scale;
  },
});
Object.defineProperty(bigPrototype, 'e', {
  get(this: Big): number { return this.coefficient === 0n ? 0 : exponentOf(this); },
  set(this: Big, exponent: number): void {
    if (this.coefficient !== 0n) this.scale = exponent - (digitsOf(this).length - 1);
  },
});

// ---- constructor factory (same as big.js's _Big_: calling Big() with no args returns an independent constructor) ----
function createBig(): BigConstructor {
  const Big = function (this: any, value?: BigSource): any {
    if (!(this instanceof Big)) {
      return value === undefined && arguments.length === 0 ? createBig() : new (Big as any)(value);
    }
    if (value instanceof Object && 'coefficient' in (value as any)) {
      const other = value as Big;
      this.sign = other.sign; this.coefficient = other.coefficient; this.scale = other.scale;
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
