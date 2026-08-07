/**
 * Cached powers of ten (internal — invisible to callers, contract §5).
 *
 * Precondition: `n` is a non-negative integer. A negative or fractional `n`
 * silently yields `undefined` (negative array index) — there is no runtime
 * guard here, so every caller branches on sign before calling.
 */
const POWERS_OF_TEN: bigint[] = [1n];

export function pow10(n: number): bigint {
  if (n < POWERS_OF_TEN.length) {
    return POWERS_OF_TEN[n];
  }
  if (n <= 4096) {
    let value = POWERS_OF_TEN[POWERS_OF_TEN.length - 1];
    for (let i = POWERS_OF_TEN.length; i <= n; i++) {
      POWERS_OF_TEN[i] = value *= 10n;
    }
    return value;
  }
  return 10n ** BigInt(n);
}
