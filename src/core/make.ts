import type { DecimalValue } from './types.ts';
import { stripTrailingZeros, stripResult } from './_internal/strip.ts';

/**
 * Value constructors. Every DecimalValue in the system is created here (or by parse),
 * so the three-field shape and creation order stay identical for the JIT
 * (contract §1) and the normal-form invariant holds by construction.
 */

export function nan(): DecimalValue {
  return { sign: 0, coefficient: null, scale: 0 };
}

export function infinity(sign: 1 | -1): DecimalValue {
  return { sign, coefficient: null, scale: 0 };
}

export function zero(sign: 1 | -1): DecimalValue {
  return { sign, coefficient: 0n, scale: 0 };
}

/** Finite value from already-normalized parts (internal fast path — no re-strip). */
export function fromNormalized(sign: 1 | -1, coefficient: bigint, scale: number): DecimalValue {
  return { sign, coefficient, scale };
}

/** Finite value from arbitrary parts: normalizes trailing zeros and zero-scale. */
export function fromParts(sign: 1 | -1, coefficient: bigint, scale: number): DecimalValue {
  if (coefficient === 0n) return { sign, coefficient: 0n, scale: 0 };
  const stripped = stripTrailingZeros(coefficient, scale);
  return { sign, coefficient: stripped, scale: stripResult.scale };
}
