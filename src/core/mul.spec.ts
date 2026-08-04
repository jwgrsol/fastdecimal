import { describe, expect, it } from 'vitest';
import { mul } from './mul.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity } from './make.ts';
import { isNaN } from './predicates.ts';

describe('mul', () => {
  it('multiplies exactly', () => {
    expect(toString(mul(parse('1.5'), parse('-2')))).toBe('-3');
  });

  it('zero results keep the sign product', () => {
    expect(mul(parse('0'), parse('-5')).sign).toBe(-1);
  });

  it('propagates specials per IEEE', () => {
    expect(isNaN(mul(infinity(1), parse('0')))).toBe(true); // ∞ × 0
    expect(toString(mul(infinity(-1), parse('-2')))).toBe('Infinity');
  });
});
