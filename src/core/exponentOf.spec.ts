import { describe, expect, it } from 'vitest';
import { exponentOf } from './exponentOf.ts';
import { parse } from './parse.ts';
import { fromParts, infinity, nan, zero } from './make.ts';

describe('exponentOf', () => {
  it('returns the base-10 exponent of the most significant digit', () => {
    expect(exponentOf(parse('123.45'))).toBe(2);
    expect(exponentOf(parse('0.00012'))).toBe(-4);
    expect(exponentOf(parse('1e21'))).toBe(21);
    expect(exponentOf(parse('-9'))).toBe(0);
  });

  it('zero returns 0 (matching big.js/bignumber.js/decimal.js)', () => {
    expect(exponentOf(zero(1))).toBe(0);
    expect(exponentOf(zero(-1))).toBe(0);
  });

  it('specials return NaN', () => {
    expect(Number.isNaN(exponentOf(nan()))).toBe(true);
    expect(Number.isNaN(exponentOf(infinity(1)))).toBe(true);
  });

  it('computes exact digit counts at decade boundaries when the cache is cold', () => {
    // fromParts leaves digits unfilled, forcing the hex-based digitCount path;
    // 10^k−1 / 10^k / 10^k+1 straddle every boundary where an off-by-one in
    // the bit-length→digit-count math would surface.
    for (let k = 1; k <= 400; k++) {
      const p = 10n ** BigInt(k);
      expect(exponentOf(fromParts(1, p - 1n, 0))).toBe(k - 1);
      expect(exponentOf(fromParts(1, p + 1n, 0))).toBe(k);
    }
    expect(exponentOf(fromParts(1, 10n ** 5000n + 1n, 0))).toBe(5000);
  });

  it('memoizes the digit count into the value on first read', () => {
    const x = fromParts(1, 12345n * 10n ** 20n, 0);
    expect(x.digits).toBe(0);
    expect(exponentOf(x)).toBe(24);
    expect(x.digits).toBe(5);
    expect(exponentOf(x)).toBe(24); // cache hit — same answer
  });
});
