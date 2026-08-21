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

  it('a zero operand returns the other value without aligning scales', () => {
    expect(add(parse('0'), parse('1e1000000'))).toEqual({ sign: 1, coefficient: 1n, scale: 1000000, digits: 1 });
    expect(add(parse('1e-1000000'), parse('-0'))).toEqual({ sign: 1, coefficient: 1n, scale: -1000000, digits: 1 });
    expect(str(add(parse('-0'), parse('-3.5')))).toBe('-3.5');
    expect(str(add(parse('7'), parse('0')))).toBe('7');
  });

  it('carry chains normalize: 999…9 + 1 = 10^n', () => {
    expect(add(parse('9'.repeat(100)), parse('1'))).toEqual({ sign: 1, coefficient: 1n, scale: 100, digits: 0 });
  });

  it('propagates specials per IEEE', () => {
    expect(str(add(infinity(1), parse('1')))).toBe('Infinity');
    expect(isNaN(add(infinity(1), infinity(-1)))).toBe(true);
    expect(isNaN(add(nan(), parse('1')))).toBe(true);
  });
});
