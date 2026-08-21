import { describe, expect, it } from 'vitest';
import { parse } from './parse.ts';
import { isNaN } from './predicates.ts';

describe('parse', () => {
  it('parses and normalizes trailing zeros into the scale', () => {
    expect(parse('123.4500')).toEqual({ sign: 1, coefficient: 12345n, scale: -2, digits: 5 });
    expect(parse('1000')).toEqual({ sign: 1, coefficient: 1n, scale: 3, digits: 1 });
  });

  it('preserves the sign of negative zero', () => {
    expect(parse('-0')).toEqual({ sign: -1, coefficient: 0n, scale: 0, digits: 0 });
  });

  it('parses exponent notation and a leading plus', () => {
    expect(parse('-1.2e-5')).toEqual({ sign: -1, coefficient: 12n, scale: -6, digits: 2 });
    expect(parse('+1.5')).toEqual({ sign: 1, coefficient: 15n, scale: -1, digits: 2 });
  });

  it('parses special literals', () => {
    expect(isNaN(parse('NaN'))).toBe(true);
    expect(parse('-Infinity')).toEqual({ sign: -1, coefficient: null, scale: 0, digits: 0 });
  });

  it('throws on invalid input', () => {
    expect(() => parse('abc')).toThrow();
    expect(() => parse('1.2.3')).toThrow();
    expect(() => parse('1e')).toThrow();
    expect(() => parse('-NaN')).toThrow();
  });
});
