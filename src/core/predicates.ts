import type { DecimalValue } from './types.ts';

export function isFinite(x: DecimalValue): boolean {
  return x.coefficient !== null;
}

export function isNaN(x: DecimalValue): boolean {
  return x.coefficient === null && x.sign === 0;
}

export function isInfinite(x: DecimalValue): boolean {
  return x.coefficient === null && x.sign !== 0;
}

export function isZero(x: DecimalValue): boolean {
  return x.coefficient === 0n;
}
