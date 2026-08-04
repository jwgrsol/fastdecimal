import { describe, expect, it } from 'vitest';
import { fromNormalized, fromParts, infinity, nan, zero } from './make.ts';

describe('make', () => {
  it('special constructors produce the contract encodings (§1)', () => {
    expect(nan()).toEqual({ sign: 0, coefficient: null, scale: 0 });
    expect(infinity(1)).toEqual({ sign: 1, coefficient: null, scale: 0 });
    expect(infinity(-1)).toEqual({ sign: -1, coefficient: null, scale: 0 });
    expect(zero(-1)).toEqual({ sign: -1, coefficient: 0n, scale: 0 });
  });

  it('constructors return fresh objects (callers may not share mutable state)', () => {
    expect(nan()).not.toBe(nan());
    expect(zero(1)).not.toBe(zero(1));
  });

  it('fromParts normalizes to the invariant: no trailing zeros, zero has scale 0', () => {
    expect(fromParts(1, 12300n, -2)).toEqual({ sign: 1, coefficient: 123n, scale: 0 });
    expect(fromParts(-1, 0n, 5)).toEqual({ sign: -1, coefficient: 0n, scale: 0 });
  });

  it('fromNormalized trusts its input (fast path — no re-strip)', () => {
    expect(fromNormalized(1, 123n, 4)).toEqual({ sign: 1, coefficient: 123n, scale: 4 });
  });
});
