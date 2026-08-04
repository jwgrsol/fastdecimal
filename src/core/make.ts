import type { Dec } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';

/**
 * Value constructors. Every Dec in the system is created here (or by parse),
 * so the three-field shape and creation order stay identical for the JIT
 * (contract §1) and the normal-form invariant holds by construction.
 */

export function nan(): Dec {
  return { sign: 0, coef: null, scale: 0 };
}

export function infinity(sign: 1 | -1): Dec {
  return { sign, coef: null, scale: 0 };
}

export function zero(sign: 1 | -1): Dec {
  return { sign, coef: 0n, scale: 0 };
}

/** Finite value from already-normalized parts (internal fast path — no re-strip). */
export function fromNormalized(sign: 1 | -1, coef: bigint, scale: number): Dec {
  return { sign, coef, scale };
}

/** Finite value from arbitrary parts: normalizes trailing zeros and zero-scale. */
export function fromParts(sign: 1 | -1, coef: bigint, scale: number): Dec {
  if (coef === 0n) return { sign, coef: 0n, scale: 0 };
  const stripped = stripTrailingZeros(coef, scale);
  return { sign, coef: stripped, scale: stripResult.scale };
}
