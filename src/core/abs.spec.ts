import { describe, expect, it } from 'vitest';
import { abs } from './abs.ts';
import { parse } from './parse.ts';
import { infinity, nan } from './make.ts';
import { isNaN } from './predicates.ts';

describe('abs', () => {
  it('makes the sign positive, sharing the coefficient', () => {
    expect(abs(parse('-1.5'))).toEqual({ sign: 1, coefficient: 15n, scale: -1 });
    expect(abs(parse('1.5')).sign).toBe(1);
  });

  it('|−0| = +0', () => {
    expect(abs(parse('-0')).sign).toBe(1);
  });

  it('|−∞| = +∞; |NaN| stays NaN', () => {
    expect(abs(infinity(-1))).toEqual({ sign: 1, coefficient: null, scale: 0 });
    expect(isNaN(abs(nan()))).toBe(true);
  });
});
