import { describe, expect, it } from 'vitest';
import { add } from './add.ts';
import { parse } from './parse.ts';
import { toString } from './toString.ts';
import { infinity, nan } from './make.ts';
import { isNaN } from './predicates.ts';

const str = (x: ReturnType<typeof parse>) => toString(x);

describe('add', () => {
  it('adds exactly', () => {
    expect(str(add(parse('0.1'), parse('0.2')))).toBe('0.3');
  });

  it('exact cancellation yields +0', () => {
    expect(str(add(parse('5'), parse('-5')))).toBe('0');
    expect(add(parse('5'), parse('-5')).sign).toBe(1);
  });

  it('(-0) + (-0) = -0', () => {
    expect(add(parse('-0'), parse('-0')).sign).toBe(-1);
  });

  it('propagates specials per IEEE', () => {
    expect(str(add(infinity(1), parse('1')))).toBe('Infinity');
    expect(isNaN(add(infinity(1), infinity(-1)))).toBe(true);
    expect(isNaN(add(nan(), parse('1')))).toBe(true);
  });
});
