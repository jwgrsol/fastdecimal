// Post-build: rewrite the CJS declaration file (dist/big.d.ts) to use `export =`.
//
// The CJS runtime output sets `module.exports = Big` (a function), matching
// require('big.js'). tsdown generates `export default` declarations, which makes
// TypeScript under node16/CJS expect a `.default` property that isn't needed at
// runtime (attw: MissingExportEquals). The correct declaration for this shape is
// `export =` with a merged namespace for the named types. The ESM declaration
// (dist/big.d.mts) is left untouched.
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist/big.d.ts', import.meta.url), `\
import type * as m from './big.mjs';

declare const Big: m.BigConstructor;

declare namespace Big {
  export type Big = m.Big;
  export type BigConstructor = m.BigConstructor;
  export type BigSource = m.BigSource;
  export type RoundingMode = m.RoundingMode;
}

export = Big;
`);
console.log('postbuild: dist/big.d.ts rewritten to `export =` form (CJS interop types)');
