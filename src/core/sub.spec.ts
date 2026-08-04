import { describe, expect, it } from 'vitest';
import { sub } from './sub.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';

describe('sub', () => {
  it('subtracts exactly across scales', () => {
    expect(toString(sub(parse('1'), parse('0.999')))).toBe('0.001');
  });

  it('x − x = +0', () => {
    expect(sub(parse('1.5'), parse('1.5')).sign).toBe(1);
    expect(sub(parse('1.5'), parse('1.5')).coefficient).toBe(0n);
  });
});
