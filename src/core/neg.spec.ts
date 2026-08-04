import { describe, expect, it } from 'vitest';
import { neg } from './neg.ts';
import { parse } from './parse.ts';
import { infinity, nan } from './make.ts';
import { isNaN } from './predicates.ts';

describe('neg', () => {
  it('flips the sign, sharing the coefficient', () => {
    const x = parse('1.5');
    const negated = neg(x);
    expect(negated).toEqual({ sign: -1, coefficient: 15n, scale: -1 });
    expect(negated.coefficient).toBe(x.coefficient); // no BigInt allocation
  });

  it('−(−0) = +0 and −(+0) = −0', () => {
    expect(neg(parse('-0')).sign).toBe(1);
    expect(neg(parse('0')).sign).toBe(-1);
  });

  it('−(±∞) flips; −NaN stays NaN', () => {
    expect(neg(infinity(1)).sign).toBe(-1);
    expect(isNaN(neg(nan()))).toBe(true);
  });
});
