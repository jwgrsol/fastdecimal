import { describe, expect, it } from 'vitest';
import { toString } from './toString.ts';
import { parse } from './parse.ts';

describe('toString', () => {
  it('switches to exponential form at the default thresholds (−7 / 21)', () => {
    expect(toString(parse('1e21'))).toBe('1e+21');
    expect(toString(parse('1e-7'))).toBe('1e-7');
  });

  it('thresholds are parameters (facades pass their NE/PE)', () => {
    expect(toString(parse('1234'), -7, 3)).toBe('1.234e+3');
  });

  it('signedZero controls −0 rendering (bignumber/decimal vs big.js toString)', () => {
    expect(toString(parse('-0'))).toBe('-0');
    expect(toString(parse('-0'), -7, 21, false)).toBe('0');
  });
});
