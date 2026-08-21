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

  it('decides far-apart scale gaps by exponent, without materializing the gap', () => {
    expect(cmp(parse('1e100000000'), parse('1'))).toBe(1);
    expect(cmp(parse('1'), parse('1e100000000'))).toBe(-1);
    expect(cmp(parse('-1e100000000'), parse('-1'))).toBe(-1);
    expect(cmp(parse('1e-100000000'), parse('1'))).toBe(-1);
  });

  it('equal exponents across a large gap still compare digits', () => {
    // both have exponent 5000; 1.11…×10^5000 > 1×10^5000
    expect(cmp(parse('1e5000'), parse('1'.repeat(5001)))).toBe(-1);
    expect(cmp(parse('1'.repeat(5001)), parse('1e5000'))).toBe(1);
  });

  it('infinities order against everything', () => {
    expect(cmp(infinity(1), parse('1e100'))).toBe(1);
    expect(cmp(infinity(-1), parse('-1e100'))).toBe(-1);
    expect(cmp(infinity(1), infinity(1))).toBe(0);
  });
});
