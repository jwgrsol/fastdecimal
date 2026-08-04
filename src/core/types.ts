/**
 * Core value representation — see docs/core-contract.md §1.
 *
 * value = sign × coef × 10^scale
 *
 * Normal form (finite): if coef === 0n then scale === 0, otherwise coef % 10n !== 0n
 * (trailing zeros are absorbed into scale). Equal mathematical values always have
 * identical representations.
 *
 * Special values are encoded with coef === null:
 *   NaN        → { sign: 0,  coef: null, scale: 0 }
 *   +Infinity  → { sign: 1,  coef: null, scale: 0 }
 *   −Infinity  → { sign: -1, coef: null, scale: 0 }
 *   −0         → { sign: -1, coef: 0n,   scale: 0 }
 */
export interface Dec {
  sign: 1 | -1 | 0;
  coef: bigint | null;
  scale: number;
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
