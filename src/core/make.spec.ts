import { describe, expect, it } from 'vitest';
import { fromParts, infinity, nan, zero } from './make.ts';

describe('make', () => {
  it('special constructors produce the contract encodings (§1)', () => {
    expect(nan()).toEqual({ sign: 0, coefficient: null, scale: 0, digits: 0 });
    expect(infinity(1)).toEqual({ sign: 1, coefficient: null, scale: 0, digits: 0 });
    expect(infinity(-1)).toEqual({ sign: -1, coefficient: null, scale: 0, digits: 0 });
    expect(zero(-1)).toEqual({ sign: -1, coefficient: 0n, scale: 0, digits: 0 });
  });

  it('constructors return fresh objects (callers may not share mutable state)', () => {
    expect(nan()).not.toBe(nan());
    expect(zero(1)).not.toBe(zero(1));
  });

  it('fromParts normalizes to the invariant: no trailing zeros, zero has scale 0', () => {
    expect(fromParts(1, 12300n, -2)).toEqual({ sign: 1, coefficient: 123n, scale: 0, digits: 0 });
    expect(fromParts(-1, 0n, 5)).toEqual({ sign: -1, coefficient: 0n, scale: 0, digits: 0 });
  });

  it('fromParts strips long zero runs across the ladder boundaries', () => {
    // 16/32/64 sit on the squaring ladder; 37 = 16+16+4+1 and 100 = 64+32+4
    // exercise the binary descent, 15 stays under the ladder entirely.
    for (const zeros of [15, 16, 17, 31, 32, 33, 37, 63, 64, 100]) {
      expect(fromParts(1, 123n * 10n ** BigInt(zeros), -3)).toEqual({
        sign: 1,
        coefficient: 123n,
        scale: zeros - 3,
        digits: 0,
      });
      expect(fromParts(-1, 10n ** BigInt(zeros), 0)).toEqual({
        sign: -1,
        coefficient: 1n,
        scale: zeros,
        digits: 0,
      });
    }
  });
});
