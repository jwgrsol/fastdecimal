import { describe, expect, it } from 'vitest';
import { divToDecimalPlaces } from './divToDecimalPlaces.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity } from './make.ts';
import { isNaN } from './predicates.ts';

const div = (a: string, b: string, dp: number, rm: 0 | 1 | 4) =>
  toString(divToDecimalPlaces(parse(a), parse(b), dp, rm));

describe('divToDecimalPlaces', () => {
  it('divides to the requested decimal places', () => {
    expect(div('1', '3', 20, 4)).toBe('0.33333333333333333333');
    expect(div('2', '3', 2, 1)).toBe('0.66'); // DOWN
    expect(div('2', '3', 2, 0)).toBe('0.67'); // UP
  });

  it('division by zero follows IEEE, never throws (contract §4)', () => {
    expect(div('1', '0', 20, 4)).toBe('Infinity');
    expect(div('-1', '0', 20, 4)).toBe('-Infinity');
    expect(isNaN(divToDecimalPlaces(parse('0'), parse('0'), 20, 4))).toBe(true);
  });

  it('handles decimal places beyond the pow10 cache limit (>4096)', () => {
    // exercises the uncached 10n ** BigInt(n) fallback via a public path
    const result = divToDecimalPlaces(parse('1'), parse('3'), 5000, 1);
    expect(result.scale).toBe(-5000);
    const digits = (result.coefficient as bigint).toString();
    expect(digits.length).toBe(5000);
    expect(new Set(digits)).toEqual(new Set(['3']));
  });

  it('throws on an out-of-range rounding mode instead of silently rounding', () => {
    // @ts-expect-error — deliberately invalid mode (plain-JS caller scenario)
    expect(() => divToDecimalPlaces(parse('1'), parse('3'), 5, 42)).toThrow('Invalid rounding mode');
  });

  it('infinite operands', () => {
    expect(div('1', 'Infinity', 20, 4)).toBe('0');
    expect(divToDecimalPlaces(parse('-1'), infinity(1), 20, 4).sign).toBe(-1); // −0
    expect(isNaN(divToDecimalPlaces(infinity(1), infinity(1), 20, 4))).toBe(true);
  });
});
