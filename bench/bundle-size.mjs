// Bundle-size measurement (the es-toolkit pattern): bundle each import shape with
// esbuild against the built dist/ output — the evidence behind the tree-shaking
// claim. Run `yarn build` first, then `node bench/bundle-size.mjs`.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = f => join(here, '..', 'dist', f).replaceAll('\\', '/');

// Each scenario is what a user's entry file would import
const SCENARIOS = [
  {
    name: 'core: one function (add)',
    code: `import { add } from '${dist('index.mjs')}'; console.log(add);`,
  },
  {
    name: 'core: typical money math (parse, add, divToDecimalPlaces, toString)',
    code: `import { parse, add, divToDecimalPlaces, toString } from '${dist('index.mjs')}'; console.log(parse, add, divToDecimalPlaces, toString);`,
  },
  {
    name: 'core: everything',
    code: `import * as core from '${dist('index.mjs')}'; console.log(core);`,
  },
  {
    name: 'facade: Big (drop-in, all-or-nothing by design)',
    code: `import Big from '${dist('big.mjs')}'; console.log(Big);`,
  },
  {
    name: 'upstream big.js (for comparison)',
    code: `import Big from 'big.js'; console.log(Big);`,
  },
];

async function measure({ name, code }) {
  const result = await build({
    stdin: { contents: code, resolveDir: here, sourcefile: 'entry.js' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const bytes = result.outputFiles[0].contents;
  return { name, minified: bytes.length, gzipped: gzipSync(bytes).length };
}

const results = [];
for (const scenario of SCENARIOS) {
  results.push(await measure(scenario));
}

const fmt = n => `${(n / 1024).toFixed(2)} KB`;
const width = Math.max(...results.map(r => r.name.length));
console.log(`${'scenario'.padEnd(width)}  minified   gzipped`);
for (const r of results) {
  console.log(`${r.name.padEnd(width)}  ${fmt(r.minified).padStart(8)}  ${fmt(r.gzipped).padStart(8)}`);
}

writeFileSync(
  join(here, 'bundle-size.json'),
  JSON.stringify({ date: new Date().toISOString().slice(0, 10), results }, null, 2)
);
console.log(`\nWrote ${join(here, 'bundle-size.json')}`);
