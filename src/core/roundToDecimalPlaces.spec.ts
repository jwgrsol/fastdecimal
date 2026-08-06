import { describe, expect, it } from 'vitest';
import { roundToDecimalPlaces } from './roundToDecimalPlaces.ts';
import type { RoundingMode } from './types.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { nan } from './make.ts';
import { isNaN } from './predicates.ts';

const round = (value: string, dp: number, rm: RoundingMode) => toString(roundToDecimalPlaces(parse(value), dp, rm));

describe('roundToDecimalPlaces', () => {
  // Every mode against signed values, including exact ties (contract §3)
  const matrix: Array<[string, string[]]> = [
    //         UP    DOWN  CEIL  FLOOR H_UP  H_DN  H_EVEN H_CEIL H_FLOOR
    ['2.5', ['3', '2', '3', '2', '3', '2', '2', '3', '2']],
    ['-2.5', ['-3', '-2', '-2', '-3', '-3', '-2', '-2', '-2', '-3']],
    ['3.5', ['4', '3', '4', '3', '4', '3', '4', '4', '3']],
    ['2.4', ['3', '2', '3', '2', '2', '2', '2', '2', '2']],
    ['-2.4', ['-3', '-2', '-2', '-3', '-2', '-2', '-2', '-2', '-2']],
  ];
  it.each(matrix)('rounds %s correctly in all 9 modes', (value, expected) => {
    for (let rm = 0; rm <= 8; rm++) {
      expect(round(value, 0, rm as RoundingMode), `rm ${rm}`).toBe(expected[rm]);
    }
  });

  it('a zero result keeps the sign of the input (−0.4 → −0)', () => {
    const rounded = roundToDecimalPlaces(parse('-0.4'), 0, 2); // CEIL
    expect(rounded.sign).toBe(-1);
    expect(rounded.coefficient).toBe(0n);
  });

  it('accepts negative decimal places', () => {
    expect(round('12345', -2, 4)).toBe('12300');
  });

  it('specials pass through', () => {
    expect(isNaN(roundToDecimalPlaces(nan(), 0, 4))).toBe(true);
  });
});
