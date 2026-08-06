import { describe, expect, it } from 'vitest';
import { mod } from './mod.ts';
import type { ModuloMode } from './types.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity } from './make.ts';
import { isNaN } from './predicates.ts';

const rem = (a: string, b: string, mode: ModuloMode) => toString(mod(parse(a), parse(b), mode));

describe('mod', () => {
  it('mode 1 DOWN — truncated division, remainder takes the dividend sign (big.js/JS %)', () => {
    expect(rem('-7', '3', 1)).toBe('-1');
    expect(rem('7', '3', 1)).toBe('1');
    expect(rem('5.5', '1.2', 1)).toBe('0.7');
  });

  it('mode 3 FLOOR — remainder takes the divisor sign (Python %)', () => {
    expect(rem('-7', '3', 3)).toBe('2');
    expect(rem('7', '-3', 3)).toBe('-2');
  });

  it('mode 9 EUCLID — remainder is always non-negative', () => {
    expect(rem('-7', '3', 9)).toBe('2');
    expect(rem('7', '-3', 9)).toBe('1');
  });

  it('half modes round the quotient to the nearest integer', () => {
    expect(rem('-7', '3', 6)).toBe('-1'); // q = −2.33 → −2 (HALF_EVEN)
  });

  it('an exact zero remainder is +0; a zero dividend keeps its sign', () => {
    expect(rem('6', '3', 1)).toBe('0');
    expect(mod(parse('-0'), parse('3'), 1).sign).toBe(-1);
  });

  it('special-value semantics', () => {
    expect(isNaN(mod(parse('1'), parse('0'), 1))).toBe(true); // x mod 0
    expect(isNaN(mod(infinity(1), parse('3'), 1))).toBe(true); // ±∞ mod y
    expect(rem('-7.5', 'Infinity', 1)).toBe('-7.5'); // finite mod ±∞ = x
  });
});
