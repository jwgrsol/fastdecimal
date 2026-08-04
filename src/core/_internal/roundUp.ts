import type { RoundingMode } from '../types.ts';

/**
 * Sign-aware rounding decision (contract §3): should a truncated magnitude be
 * incremented by one unit in the last kept place?
 *
 * Operates on the magnitude split `|value| = truncated × divisor + remainder`
 * (0 ≤ remainder < divisor). `sign` is the sign of the full value — required
 * because CEIL/FLOOR-family modes (2, 3, 7, 8) round in a fixed direction on
 * the number line, so their effect on the magnitude depends on the sign.
 */
export function roundUp(
  truncated: bigint,
  remainder: bigint,
  divisor: bigint,
  sign: number,
  rm: RoundingMode,
): boolean {
  if (remainder === 0n) return false;
  switch (rm) {
    case 0: return true;                    // UP — away from zero
    case 1: return false;                   // DOWN — truncate
    case 2: return sign > 0;                // CEIL
    case 3: return sign < 0;                // FLOOR
  }
  const doubled = remainder * 2n;
  if (doubled > divisor) return true;
  if (doubled < divisor) return false;
  // exact tie
  switch (rm) {
    case 4: return true;                    // HALF_UP — ties away from zero
    case 5: return false;                   // HALF_DOWN — ties toward zero
    case 6: return (truncated & 1n) === 1n; // HALF_EVEN — ties to even
    case 7: return sign > 0;                // HALF_CEIL
    default: return sign < 0;               // 8 HALF_FLOOR
  }
}
