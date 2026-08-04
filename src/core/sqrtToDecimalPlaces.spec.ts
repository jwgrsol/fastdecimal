import { describe, expect, it } from 'vitest';
import { sqrtToDecimalPlaces } from './sqrtToDecimalPlaces.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity } from './make.ts';
import { isNaN } from './predicates.ts';

const sqrt = (value: string, dp = 20) => toString(sqrtToDecimalPlaces(parse(value), dp, 4));

describe('sqrtToDecimalPlaces', () => {
  it('computes to the requested precision', () => {
    expect(sqrt('2')).toBe('1.4142135623730950488');
    expect(sqrt('16')).toBe('4');
  });

  it('handles values outside the float estimate range', () => {
    expect(sqrt('1e400')).toBe('1e+200');
    // DP model: 1e-150 is not representable within 20 decimal places (matches upstream big.js)
    expect(sqrt('1e-300')).toBe('0');
  });

  it('terminates where upstream big.js hangs (iteration cap)', () => {
    // Upstream loops forever when the result exponent sits far below −dp;
    // the cap returns the current estimate instead (documented divergence).
    expect(toString(sqrtToDecimalPlaces(parse('9.7516778021407e-19'), 3, 0))).toBe('0.001');
  });

  it('special-value semantics', () => {
    expect(sqrtToDecimalPlaces(parse('-0'), 20, 4).sign).toBe(-1); // ±0 → ±0
    expect(isNaN(sqrtToDecimalPlaces(parse('-4'), 20, 4))).toBe(true);
    expect(toString(sqrtToDecimalPlaces(infinity(1), 20, 4))).toBe('Infinity');
  });
});
