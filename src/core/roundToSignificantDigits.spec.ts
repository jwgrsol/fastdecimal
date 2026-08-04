import { describe, expect, it } from 'vitest';
import { roundToSignificantDigits } from './roundToSignificantDigits.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';

const round = (value: string, sd: number) => toString(roundToSignificantDigits(parse(value), sd, 4));

describe('roundToSignificantDigits', () => {
  it('carries across a power of ten (999 → 1000 at 1 sd)', () => {
    expect(round('999', 1)).toBe('1000');
  });

  it('counts significant digits from the most significant digit', () => {
    expect(round('0.0001234', 2)).toBe('0.00012');
  });

  it('zero passes through (no significant digits)', () => {
    expect(round('0', 3)).toBe('0');
  });
});
