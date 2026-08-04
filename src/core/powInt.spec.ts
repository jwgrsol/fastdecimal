import { describe, expect, it } from 'vitest';
import { powInt } from './powInt.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity, nan } from './make.ts';
import { isNaN } from './predicates.ts';

describe('powInt', () => {
  it('computes exact integer powers', () => {
    expect(toString(powInt(parse('2'), 10))).toBe('1024');
    expect(toString(powInt(parse('0.5'), 3))).toBe('0.125');
  });

  it('sign follows exponent parity for negative bases', () => {
    expect(toString(powInt(parse('-2'), 3))).toBe('-8');
    expect(toString(powInt(parse('-2'), 4))).toBe('16');
  });

  it('(-0)^odd keeps the negative sign', () => {
    expect(powInt(parse('-0'), 5).sign).toBe(-1);
  });

  it('special-value semantics', () => {
    expect(toString(powInt(infinity(1), 2))).toBe('Infinity');
    expect(toString(powInt(infinity(-1), 3))).toBe('-Infinity');
    expect(isNaN(powInt(nan(), 2))).toBe(true);
  });
});
