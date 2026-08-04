import { describe, expect, it } from 'vitest';
import { cmp } from './cmp.ts';
import { parse } from './parse.ts';
import { infinity, nan } from './make.ts';

describe('cmp', () => {
  it('compares mathematical values across scales', () => {
    expect(cmp(parse('1.20'), parse('1.2'))).toBe(0);
  });

  it('−0 equals +0', () => {
    expect(cmp(parse('-0'), parse('0'))).toBe(0);
  });

  it('NaN comparisons return NaN (bignumber facade maps this to null)', () => {
    expect(Number.isNaN(cmp(nan(), parse('1')))).toBe(true);
  });

  it('infinities order against everything', () => {
    expect(cmp(infinity(1), parse('1e100'))).toBe(1);
    expect(cmp(infinity(-1), parse('-1e100'))).toBe(-1);
    expect(cmp(infinity(1), infinity(1))).toBe(0);
  });
});
