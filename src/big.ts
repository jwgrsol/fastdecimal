/*
 * fastdecimal — BigInt-powered drop-in replacement for big.js
 * Representation: value = s × _b × 10^_q  (s: 1|-1 to support -0, _b: non-negative BigInt, _q: exponent of the least significant digit)
 * Invariant: if _b === 0n then _q === 0, otherwise _b % 10n !== 0n (same normal form as big.js's digit array c)
 */

export type BigSource = number | string | bigint | Big;
export type RoundingMode = 0 | 1 | 2 | 3;

export interface Big {
  s: number;
  _b: bigint;
  _q: number;
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
const P10: bigint[] = [1n];
function pow10(n: number): bigint {
  if (n < P10.length) return P10[n];
  if (n <= 4096) {
    let v = P10[P10.length - 1];
    for (let i = P10.length; i <= n; i++) P10[i] = v *= 10n;
    return v;
  }
  return 10n ** BigInt(n);
}

// ---- strip trailing zeros (requires b > 0n) ----
const S16 = 10n ** 16n, S8 = 10n ** 8n, S4 = 10000n, S2 = 100n, S1 = 10n;
function strip(b: bigint, q: number): [bigint, number] {
  if (b & 1n) return [b, q]; // an odd number cannot be a multiple of 10 — O(1) early exit
  if (b % S1 !== 0n) return [b, q];
  while (b % S16 === 0n) { b /= S16; q += 16; }
  if (b % S8 === 0n) { b /= S8; q += 8; }
  if (b % S4 === 0n) { b /= S4; q += 4; }
  if (b % S2 === 0n) { b /= S2; q += 2; }
  if (b % S1 === 0n) { b /= S1; q += 1; }
  return [b, q];
}

function invalid(): never { throw Error(INVALID + 'number'); }

// ---- parsing (accepts exactly what big.js's NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i accepts) ----
function parseInto(x: Big, str: string): void {
  const n = str.length;
  let i = 0, s = 1;
  if (str.charCodeAt(0) === 45) { s = -1; i = 1; }
  const ds = i;
  let dot = -1, ep = -1;
  for (; i < n; i++) {
    const cc = str.charCodeAt(i);
    if (cc >= 48 && cc <= 57) continue;
    if (cc === 46 && dot < 0 && ep < 0) { dot = i; continue; }
    if ((cc === 101 || cc === 69) && i > ds) { ep = i; break; }
    invalid();
  }
  const mEnd = ep < 0 ? n : ep;
  const intLen = (dot < 0 ? mEnd : dot) - ds;
  const fracLen = dot < 0 ? 0 : mEnd - dot - 1;
  if (intLen === 0 && fracLen === 0) invalid();

  let exp = 0;
  if (ep >= 0) {
    let j = ep + 1, es = 1;
    const c0 = str.charCodeAt(j);
    if (c0 === 43) j++; else if (c0 === 45) { es = -1; j++; }
    if (j >= n) invalid();
    let v = 0;
    for (; j < n; j++) {
      const cc = str.charCodeAt(j);
      if (cc < 48 || cc > 57) invalid();
      v = v * 10 + (cc - 48);
    }
    exp = es * v;
  }

  let digits = dot < 0 ? str.slice(ds, mEnd) : str.slice(ds, dot) + str.slice(dot + 1, mEnd);
  let a = 0, b = digits.length;
  while (a < b && digits.charCodeAt(a) === 48) a++;
  if (a === b) { x.s = s; x._b = 0n; x._q = 0; return; } // ±0
  let q = exp - fracLen;
  while (digits.charCodeAt(b - 1) === 48) { b--; q++; }
  x.s = s;
  x._b = BigInt(a > 0 || b < digits.length ? digits.slice(a, b) : digits);
  x._q = q;
}

// ---- shared prototype (shared by every cloned constructor, exactly like big.js) ----
const P: any = {};

function mk(Ctor: BigConstructor, s: number, b: bigint, q: number): Big {
  const x: any = Object.create(P);
  x.s = s; x._b = b; x._q = q;
  x.constructor = Ctor;
  return x;
}
function cvt(x: Big, y: BigSource): Big {
  return y instanceof Object && '_b' in (y as any) ? (y as Big) : new x.constructor(y as any);
}
function checkRM(rm: unknown): asserts rm is RoundingMode {
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
}

// Apply rounding to a truncated quotient (operates on magnitude; sign is handled by callers)
function applyRound(qq: bigint, r: bigint, den: bigint, rm: RoundingMode): bigint {
  if (r === 0n || rm === 0) return qq;
  if (rm === 3) return qq + 1n;
  const two = r * 2n;
  if (rm === 1) return two >= den ? qq + 1n : qq;
  return two > den ? qq + 1n : two < den ? qq : (qq & 1n) ? qq + 1n : qq; // half-even
}

// Round to dp decimal places (negative dp allowed). A zero result keeps its sign (-0)
function roundToDp(x: Big, dp: number, rm: RoundingMode): Big {
  const Ctor = x.constructor;
  const shift = -dp - x._q;
  if (shift <= 0 || x._b === 0n) return mk(Ctor, x.s, x._b, x._q);
  const den = pow10(shift);
  const qt = x._b / den;
  const qq = applyRound(qt, x._b - qt * den, den, rm);
  if (qq === 0n) return mk(Ctor, x.s, 0n, 0);
  const [b, q] = strip(qq, -dp);
  return mk(Ctor, x.s, b, q);
}

// Round to sd significant digits (equivalent to big.js's internal round(x, sd, rm))
function roundSD(x: Big, sd: number, rm: RoundingMode): Big {
  if (x._b === 0n) return mk(x.constructor, x.s, 0n, 0);
  const e = msdExp(x);
  return roundToDp(x, sd - e - 1, rm);
}

function digitsOf(x: Big): string { return x._b.toString(); }
function msdExp(x: Big): number { return x._b === 0n ? 0 : digitsOf(x).length - 1 + x._q; }

function addSub(x: Big, y: Big, ys: number): Big {
  const Ctor = x.constructor;
  const xb = x._b, yb = y._b;
  if (xb === 0n && yb === 0n) return mk(Ctor, x.s < 0 && ys < 0 ? -1 : 1, 0n, 0);
  const dq = x._q - y._q;
  let vx = x.s < 0 ? -xb : xb, vy = ys < 0 ? -yb : yb, q;
  if (dq === 0) q = x._q;
  else if (dq > 0) { vx *= pow10(dq); q = y._q; }
  else { vy *= pow10(-dq); q = x._q; }
  const v = vx + vy;
  if (v === 0n) return mk(Ctor, 1, 0n, 0);
  const s = v < 0n ? -1 : 1;
  const [b, q2] = strip(s < 0 ? -v : v, q);
  return mk(Ctor, s, b, q2);
}

// ---- string formatting ----
// d: digit string (may be padded), e: exponent of the most significant digit
function fmtExp(d: string, e: number): string {
  return d[0] + (d.length > 1 ? '.' + d.slice(1) : '') + (e < 0 ? 'e' : 'e+') + e;
}
function fmtNormal(d: string, e: number): string {
  if (e < 0) return '0.' + '0'.repeat(-e - 1) + d;
  const p = e + 1;
  if (p > d.length) return d + '0'.repeat(p - d.length);
  if (p < d.length) return d.slice(0, p) + '.' + d.slice(p);
  return d;
}
function stringifyFB(x: Big, forceSign: boolean): string {
  const Ctor = x.constructor;
  const d = digitsOf(x);
  const e = x._b === 0n ? 0 : d.length - 1 + x._q;
  const s = e <= Ctor.NE || e >= Ctor.PE ? fmtExp(d, e) : fmtNormal(d, e);
  return x.s < 0 && (forceSign || x._b !== 0n) ? '-' + s : s;
}

// ---- instance methods ----

P.abs = function (this: Big): Big { return mk(this.constructor, 1, this._b, this._q); };
P.neg = function (this: Big): Big { return mk(this.constructor, -this.s, this._b, this._q); };

P.plus = P.add = function (this: Big, y: BigSource): Big {
  const yy = cvt(this, y); return addSub(this, yy, yy.s);
};
P.minus = P.sub = function (this: Big, y: BigSource): Big {
  const yy = cvt(this, y); return addSub(this, yy, -yy.s);
};

P.times = P.mul = function (this: Big, y: BigSource): Big {
  const yy = cvt(this, y);
  const Ctor = this.constructor;
  const s = this.s === yy.s ? 1 : -1;
  if (this._b === 0n || yy._b === 0n) return mk(Ctor, s, 0n, 0);
  const [b, q] = strip(this._b * yy._b, this._q + yy._q);
  return mk(Ctor, s, b, q);
};

P.div = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor, dp = Ctor.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
  const yy = cvt(this, y);
  if (yy._b === 0n) throw Error(DIV_BY_ZERO);
  const s = this.s === yy.s ? 1 : -1;
  if (this._b === 0n) return mk(Ctor, s, 0n, 0);
  const rm = Ctor.RM; checkRM(rm);
  const k = this._q - yy._q + dp;
  let num = this._b, den = yy._b;
  if (k > 0) num *= pow10(k); else if (k < 0) den *= pow10(-k);
  const qt = num / den;
  const qq = applyRound(qt, num - qt * den, den, rm); // one division + multiply-subtract (replaces a second remainder division)
  if (qq === 0n) return mk(Ctor, s, 0n, 0);
  const [b, q] = strip(qq, -dp);
  return mk(Ctor, s, b, q);
};

P.mod = function (this: Big, y: BigSource): Big {
  const Ctor = this.constructor;
  const yy = cvt(this, y);
  if (yy._b === 0n) throw Error(DIV_BY_ZERO);
  if (this._b === 0n) return mk(Ctor, this.s, 0n, 0); // preserve ±0
  const dq = this._q - yy._q;
  let vx = this.s < 0 ? -this._b : this._b;
  let vy = yy.s < 0 ? -yy._b : yy._b;
  let q = this._q;
  if (dq > 0) { vx *= pow10(dq); q = yy._q; }
  else if (dq < 0) { vy *= pow10(-dq); }
  const qt = vx / vy;              // truncating division (same as big.js with DP=0/RM=0)
  const r = vx - qt * vy;
  if (r === 0n) return mk(Ctor, 1, 0n, 0); // big.js computes this via minus, so the result is +0
  const s = r < 0n ? -1 : 1;
  const [b, q2] = strip(s < 0 ? -r : r, q);
  return mk(Ctor, s, b, q2);
};

P.pow = function (this: Big, n: number): Big {
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + 'exponent');
  const Ctor = this.constructor;
  if (n === 0) return new Ctor(1);
  const neg = n < 0; if (neg) n = -n;
  const s = this.s < 0 && (n & 1) ? -1 : 1;
  let r: Big;
  if (this._b === 0n) r = mk(Ctor, s, 0n, 0);
  else { const [b, q] = strip(this._b ** BigInt(n), this._q * n); r = mk(Ctor, s, b, q); }
  return neg ? new Ctor(1).div(r) : r;
};

P.sqrt = function (this: Big): Big {
  const Ctor = this.constructor;
  if (this._b === 0n) return mk(Ctor, this.s, 0n, 0);
  if (this.s < 0) throw Error(NAME + 'No square root');
  // Initial estimate (same strategy as big.js)
  let s = Math.sqrt(Number(stringifyFB(this, true)));
  let r: Big;
  if (s === 0 || s === Infinity) {
    let c = digitsOf(this);
    const e0 = msdExp(this);
    if (!((c.length + e0) & 1)) c += '0';
    s = Math.sqrt(Number(c));
    const e2 = (((e0 + 1) / 2) | 0) - (e0 < 0 || e0 & 1 ? 1 : 0);
    let ms: string;
    if (s === Infinity) ms = '5e';
    else { const t = s.toExponential(); ms = t.slice(0, t.indexOf('e') + 1); }
    r = new Ctor(ms + e2);
  } else {
    r = new Ctor(String(s));
  }
  const DP = Ctor.DP;
  const cmpDigits = msdExp(r) + (Ctor.DP = DP + 4);
  const half = new Ctor('0.5');
  let t: Big;
  do {
    t = r;
    r = half.times(t.plus(this.div(t)));
  } while (digitsOf(t).slice(0, cmpDigits) !== digitsOf(r).slice(0, cmpDigits));
  Ctor.DP = DP;
  return roundSD(r, DP + msdExp(r) + 1, Ctor.RM);
};

P.cmp = function (this: Big, y: BigSource): number {
  const yy = cvt(this, y);
  const xb = this._b, yb = yy._b;
  if (xb === 0n) return yb === 0n ? 0 : -yy.s;
  if (yb === 0n) return this.s;
  if (this.s !== yy.s) return this.s;
  const dq = this._q - yy._q;
  let a = xb, c = yb;
  if (dq > 0) a *= pow10(dq); else if (dq < 0) c *= pow10(-dq);
  return a === c ? 0 : (a > c ? 1 : -1) * this.s;
};
P.eq = function (this: Big, y: BigSource): boolean { return this.cmp(y) === 0; };
P.gt = function (this: Big, y: BigSource): boolean { return this.cmp(y) > 0; };
P.gte = function (this: Big, y: BigSource): boolean { return this.cmp(y) >= 0; };
P.lt = function (this: Big, y: BigSource): boolean { return this.cmp(y) < 0; };
P.lte = function (this: Big, y: BigSource): boolean { return this.cmp(y) <= 0; };

P.round = function (this: Big, dp?: number, rm?: RoundingMode): Big {
  if (dp === undefined) dp = 0;
  else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) throw Error(INVALID_DP);
  if (rm === undefined) rm = this.constructor.RM;
  checkRM(rm);
  return roundToDp(this, dp, rm);
};

P.prec = function (this: Big, sd: number, rm?: RoundingMode): Big {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = this.constructor.RM;
  checkRM(rm);
  return roundSD(this, sd, rm);
};

P.toExponential = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this._b !== 0n;
  let x: Big = this, pad = 0;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = roundSD(this, dp + 1, rm);
    pad = dp + 1;
  }
  let d = digitsOf(x);
  if (pad > d.length) d = d.padEnd(pad, '0');
  const e = x._b === 0n ? 0 : digitsOf(x).length - 1 + x._q;
  const s = fmtExp(d, e);
  return x.s < 0 && wasNonzero ? '-' + s : s;
};

P.toFixed = function (this: Big, dp?: number, rm?: RoundingMode): string {
  const wasNonzero = this._b !== 0n; // big.js decides the sign from the pre-rounding original
  let x: Big = this;
  if (dp !== undefined) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    if (rm === undefined) rm = this.constructor.RM;
    checkRM(rm);
    x = roundToDp(this, dp, rm);
  } else dp = Math.max(0, -x._q);
  // exactly dp digits after the decimal point, never exponential notation
  let b = x._b, q = x._q;
  if (q > -dp) { b *= pow10(q + dp); q = -dp; } // align digits (rounding guarantees q >= -dp)
  const d = b.toString();
  let s: string;
  if (dp === 0) s = d + (q > 0 ? '0'.repeat(q) : '');
  else {
    const p = d.padStart(dp + 1, '0');
    s = p.slice(0, p.length - dp) + '.' + p.slice(p.length - dp);
  }
  return x.s < 0 && wasNonzero ? '-' + s : s;
};

P.toPrecision = function (this: Big, sd?: number, rm?: RoundingMode): string {
  if (sd === undefined) return this.toString();
  const Ctor = this.constructor;
  const wasNonzero = this._b !== 0n;
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + 'precision');
  if (rm === undefined) rm = Ctor.RM;
  checkRM(rm);
  const x = roundSD(this, sd, rm);
  let d = digitsOf(x);
  if (sd > d.length) d = d.padEnd(sd, '0');
  const e = x._b === 0n ? 0 : digitsOf(x).length - 1 + x._q;
  const s = sd <= e || e <= Ctor.NE || e >= Ctor.PE ? fmtExp(d, e) : fmtNormal(d, e);
  return x.s < 0 && wasNonzero ? '-' + s : s;
};

P.toString = P.toJSON = function (this: Big): string { return stringifyFB(this, false); };
P.valueOf = function (this: Big): string {
  if (this.constructor.strict === true) throw Error(NAME + 'valueOf disallowed');
  return stringifyFB(this, true);
};
P.toNumber = function (this: Big): number {
  const n = Number(stringifyFB(this, true));
  if (this.constructor.strict === true && !this.eq(n.toString())) throw Error(NAME + 'Imprecise conversion');
  return n;
};

// big.js ecosystem compatibility: derived c (digit array) and e (MSD exponent) properties
Object.defineProperty(P, 'c', {
  get(this: Big): number[] {
    const d = digitsOf(this);
    const r = new Array(d.length);
    for (let i = 0; i < d.length; i++) r[i] = d.charCodeAt(i) - 48;
    return r;
  },
});
Object.defineProperty(P, 'e', { get(this: Big): number { return msdExp(this); } });

// ---- constructor factory (same as big.js's _Big_: calling Big() with no args returns an independent constructor) ----
function createBig(): BigConstructor {
  const Big = function (this: any, v?: BigSource): any {
    if (!(this instanceof Big)) {
      return v === undefined && arguments.length === 0 ? createBig() : new (Big as any)(v);
    }
    if (v instanceof Object && '_b' in (v as any)) {
      const y = v as Big;
      this.s = y.s; this._b = y._b; this._q = y._q;
    } else {
      if (typeof v !== 'string') {
        if ((Big as any).strict === true && typeof v !== 'bigint') {
          throw TypeError(INVALID + 'value');
        }
        v = typeof v === 'number' && v === 0 && 1 / v < 0 ? '-0' : String(v);
      }
      parseInto(this, v);
    }
    this.constructor = Big;
  } as any;

  Big.prototype = P;
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
