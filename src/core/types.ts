/**
 * Core value representation — see docs/core-contract.md §1.
 *
 * value = sign × coefficient × 10^scale
 *
 * Normal form (finite): if coefficient === 0n then scale === 0, otherwise coefficient % 10n !== 0n
 * (trailing zeros are absorbed into scale). Equal mathematical values always have
 * identical representations.
 *
 * Special values are encoded with coefficient === null:
 *   NaN        → { sign: 0,  coefficient: null, scale: 0 }
 *   +Infinity  → { sign: 1,  coefficient: null, scale: 0 }
 *   −Infinity  → { sign: -1, coefficient: null, scale: 0 }
 *   −0         → { sign: -1, coefficient: 0n,   scale: 0 }
 */
export interface PlainDecimal {
  sign: 1 | -1 | 0;
  coefficient: bigint | null;
  scale: number;
  /**
   * Decimal digit count of `coefficient` — a lazily filled cache, not part of
   * value identity. `0` means "not computed yet" (always the case for specials
   * and zero); a producer sets it only when it knows the count for free, and
   * `exponentOf` fills it on first demand. Finite core values are never
   * mutated after creation, so a nonzero `digits` can never go stale; the only
   * mutation sites are the big.js facade's property setters, which reset it.
   */
  digits: number;
}

/**
 * Rounding modes — the bignumber.js/decimal.js shared numbering (contract §3).
 * big.js's 0–3 use a different numbering; its facade maps {0→1, 1→4, 2→6, 3→0}.
 *
 * 0 UP         away from zero
 * 1 DOWN       toward zero (truncate)
 * 2 CEIL       toward +Infinity
 * 3 FLOOR      toward −Infinity
 * 4 HALF_UP    ties away from zero
 * 5 HALF_DOWN  ties toward zero
 * 6 HALF_EVEN  ties to even
 * 7 HALF_CEIL  ties toward +Infinity
 * 8 HALF_FLOOR ties toward −Infinity
 */
export type RoundingMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Modulo modes (bignumber.js MODULO_MODE): the quotient is rounded to an integer
 * with the corresponding RoundingMode, and the remainder is x − y·q. Mode 9
 * (EUCLID) always yields a non-negative remainder: q = sign(y) · floor(x ÷ |y|).
 * big.js's mod is mode 1 (truncated division, remainder takes the dividend's sign).
 */
export type ModuloMode = RoundingMode | 9;
