import type { Dec } from './types.ts';

export function isFinite(x: Dec): boolean {
  return x.coef !== null;
}

export function isNaN(x: Dec): boolean {
  return x.coef === null && x.sign === 0;
}

export function isInfinite(x: Dec): boolean {
  return x.coef === null && x.sign !== 0;
}

export function isZero(x: Dec): boolean {
  return x.coef === 0n;
}
