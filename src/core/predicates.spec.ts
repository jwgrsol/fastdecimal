import { describe, expect, it } from 'vitest';
import { isFinite, isInfinite, isNaN, isZero } from './predicates.ts';
import { infinity, nan, zero } from './make.ts';
import { parse } from './parse.ts';

describe('predicates', () => {
  // every representation class against every predicate
  const values = {
    finite: parse('1.5'),
    positiveZero: zero(1),
    negativeZero: zero(-1),
    positiveInfinity: infinity(1),
    negativeInfinity: infinity(-1),
    notANumber: nan(),
  };

  it('isFinite: finite numbers and zeros only', () => {
    expect(isFinite(values.finite)).toBe(true);
    expect(isFinite(values.positiveZero)).toBe(true);
    expect(isFinite(values.negativeZero)).toBe(true);
    expect(isFinite(values.positiveInfinity)).toBe(false);
    expect(isFinite(values.negativeInfinity)).toBe(false);
    expect(isFinite(values.notANumber)).toBe(false);
  });

  it('isNaN: NaN only', () => {
    expect(isNaN(values.notANumber)).toBe(true);
    expect(isNaN(values.finite)).toBe(false);
    expect(isNaN(values.positiveInfinity)).toBe(false);
    expect(isNaN(values.negativeZero)).toBe(false);
  });

  it('isInfinite: both infinities, nothing else', () => {
    expect(isInfinite(values.positiveInfinity)).toBe(true);
    expect(isInfinite(values.negativeInfinity)).toBe(true);
    expect(isInfinite(values.notANumber)).toBe(false);
    expect(isInfinite(values.finite)).toBe(false);
  });

  it('isZero: both zeros, not NaN/Infinity (null coefficient is not 0n)', () => {
    expect(isZero(values.positiveZero)).toBe(true);
    expect(isZero(values.negativeZero)).toBe(true);
    expect(isZero(values.finite)).toBe(false);
    expect(isZero(values.notANumber)).toBe(false);
    expect(isZero(values.positiveInfinity)).toBe(false);
  });
});
