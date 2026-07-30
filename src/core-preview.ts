/*
 * v1 architecture preview — a tree-shakable functional core (experimental, NOT part of the public API)
 *
 * Why this file exists: a class API like big.js hangs every method off the prototype,
 * so bundlers must ship the whole class even if you import a single method
 * (tree-shaking is impossible). Modeling values as plain objects {s, b, q} and
 * operations as standalone functions means only the functions you import end up
 * in the bundle. See examples/treeshake/ for a measured comparison.
 *
 * In v1, the big.js-compatible class (src/big.ts) becomes a thin wrapper on top of this core.
 */

export interface Dec {
  s: number;   // sign: 1 | -1
  b: bigint;   // coefficient (non-negative)
  q: number;   // exponent of the least significant digit — value = s × b × 10^q
}

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

const S1 = 10n;
function strip(b: bigint, q: number): [bigint, number] {
  if (b & 1n) return [b, q];
  while (b % S1 === 0n && b !== 0n) { b /= S1; q += 1; }
  return [b, q];
}

export function parse(str: string): Dec {
  const neg = str.charCodeAt(0) === 45;
  const body = neg ? str.slice(1) : str;
  const dot = body.indexOf('.');
  const digits = dot < 0 ? body : body.slice(0, dot) + body.slice(dot + 1);
  let q = dot < 0 ? 0 : -(body.length - dot - 1);
  let a = 0, e = digits.length;
  while (a < e && digits.charCodeAt(a) === 48) a++;
  if (a === e) return { s: neg ? -1 : 1, b: 0n, q: 0 };
  while (digits.charCodeAt(e - 1) === 48) { e--; q++; }
  return { s: neg ? -1 : 1, b: BigInt(digits.slice(a, e)), q };
}

export function add(x: Dec, y: Dec): Dec {
  if (x.b === 0n && y.b === 0n) return { s: 1, b: 0n, q: 0 };
  const dq = x.q - y.q;
  let vx = x.s < 0 ? -x.b : x.b, vy = y.s < 0 ? -y.b : y.b, q = x.q;
  if (dq > 0) { vx *= pow10(dq); q = y.q; }
  else if (dq < 0) { vy *= pow10(-dq); }
  const v = vx + vy;
  if (v === 0n) return { s: 1, b: 0n, q: 0 };
  const s = v < 0n ? -1 : 1;
  const [b, q2] = strip(s < 0 ? -v : v, q);
  return { s, b, q: q2 };
}

export function mul(x: Dec, y: Dec): Dec {
  const s = x.s === y.s ? 1 : -1;
  if (x.b === 0n || y.b === 0n) return { s, b: 0n, q: 0 };
  const [b, q] = strip(x.b * y.b, x.q + y.q);
  return { s, b, q };
}

export function toStr(x: Dec): string {
  const d = x.b.toString();
  const e = x.b === 0n ? 0 : d.length - 1 + x.q;
  let out: string;
  if (e < 0) out = '0.' + '0'.repeat(-e - 1) + d;
  else if (e + 1 > d.length) out = d + '0'.repeat(e + 1 - d.length);
  else if (e + 1 < d.length) out = d.slice(0, e + 1) + '.' + d.slice(e + 1);
  else out = d;
  return x.s < 0 && x.b !== 0n ? '-' + out : out;
}
