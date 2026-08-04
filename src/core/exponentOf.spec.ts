import { describe, expect, it } from 'vitest';
import { exponentOf } from './exponentOf.ts';
import { parse } from './parse.ts';
import { infinity, nan, zero } from './make.ts';

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
});
