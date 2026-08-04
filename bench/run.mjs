// fastdecimal benchmark suite — fastdecimal vs big.js, per operation × operand size.
//
// Usage:
//   yarn bench                 full matrix (writes bench/RESULTS.md)
//   yarn bench --quick         faster run (fewer sizes, shorter sampling)
//   yarn bench --op=div,sqrt   only these operations
//   yarn bench --size=small    only these operand sizes
//
// Fairness rules:
//   - identical inputs (deterministic, seeded), identical settings (DP=20, RM=1 — both defaults)
//   - operands are pre-constructed outside the measured function (except `parse`,
//     which measures construction itself)
//   - every measured result is consumed so the JIT cannot dead-code-eliminate the work
import { Bench } from 'tinybench';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';
import FastBig from '../src/big.ts';
import * as core from '../src/core/index.ts';

const require = createRequire(import.meta.url);
const OrigBig = require('big.js');

// ---- deterministic input generation (seeded PRNG so runs are reproducible) ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomDecimalString(rand, intDigits, fracDigits) {
  let s = String(1 + Math.floor(rand() * 9)); // non-zero leading digit
  for (let i = 1; i < intDigits; i++) s += Math.floor(rand() * 10);
  if (fracDigits > 0) {
    s += '.';
    for (let i = 0; i < fracDigits - 1; i++) s += Math.floor(rand() * 10);
    s += 1 + Math.floor(rand() * 9); // non-zero last digit (keeps the full precision)
  }
  return s;
}

// digits = total significant digits of each operand
const SIZES = {
  small: { int: 5, frac: 2 },     // e.g. 12345.67       — everyday money math
  medium: { int: 10, frac: 10 },  // 20 significant digits
  large: { int: 50, frac: 50 },   // 100 significant digits
  huge: { int: 250, frac: 250 },  // 500 significant digits
};

// Each op: (Ctor, a, b) → value. `parse` receives strings; the rest receive instances.
// `core` is the same operation through the functional core directly (operands are
// pre-parsed DecimalValues) — its gap vs the facade IS the facade's wrap overhead.
// big.js defaults DP=20/RM=1 map to core (decimalPlaces 20, roundingMode 4 HALF_UP).
const OPS = {
  parse: { fn: (B, s) => new B(s), core: (s) => core.parse(s), input: 'string' },
  plus: { fn: (_, a, b) => a.plus(b), core: (a, b) => core.add(a, b) },
  minus: { fn: (_, a, b) => a.minus(b), core: (a, b) => core.sub(a, b) },
  times: { fn: (_, a, b) => a.times(b), core: (a, b) => core.mul(a, b) },
  div: { fn: (_, a, b) => a.div(b), core: (a, b) => core.divToDecimalPlaces(a, b, 20, 4) },
  mod: { fn: (_, a, b) => a.mod(b), core: (a, b) => core.mod(a, b, 1) },
  pow: { fn: (_, a) => a.pow(8), core: (a) => core.powInt(a, 8) },
  sqrt: { fn: (_, a) => a.sqrt(), core: (a) => core.sqrtToDecimalPlaces(a, 20, 4) },
  cmp: { fn: (_, a, b) => a.cmp(b), core: (a, b) => core.cmp(a, b) },
  round: { fn: (_, a) => a.round(5), core: (a) => core.roundToDecimalPlaces(a, 5, 4) },
  toString: { fn: (_, a) => a.toString(), core: (a) => core.toString(a, -7, 21, false) },
  toFixed: { fn: (_, a) => a.toFixed(5) }, // formatting is facade-only — no core case
};

// ---- CLI args ----
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const pick = (flag) => args.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1]?.split(',');
const opFilter = pick('op') ?? Object.keys(OPS);
const sizeFilter = pick('size') ?? (quick ? ['small', 'large'] : Object.keys(SIZES));
const sampleTimeMs = quick ? 50 : 200;

// ---- build the matrix ----
const LIBS = { 'big.js': OrigBig, fastdecimal: FastBig };
let sink; // consume results so the JIT cannot eliminate the measured work

// 16 operand pairs per size, cycled during measurement — a single fixed pair would let
// value-specific effects (digit cancellation in subtraction, trailing zeros in results,
// result sign) dominate the numbers. Cycling averages over them; both libraries see the
// exact same sequence.
const PAIRS = 16;
const cases = [];
for (const sizeName of sizeFilter) {
  const { int, frac } = SIZES[sizeName];
  const rand = mulberry32(0xfa57dec1);
  const stringPairs = Array.from({ length: PAIRS }, () => [
    randomDecimalString(rand, int, frac),
    randomDecimalString(rand, int, frac),
  ]);
  for (const opName of opFilter) {
    const op = OPS[opName];
    for (const [libName, Ctor] of Object.entries(LIBS)) {
      const pairs = op.input === 'string'
        ? stringPairs
        : stringPairs.map(([a, b]) => [new Ctor(a), new Ctor(b)]);
      let i = 0;
      cases.push({
        name: `${opName} · ${sizeName} · ${libName}`,
        opName, sizeName, libName,
        run: () => {
          const p = pairs[i = (i + 1) & (PAIRS - 1)];
          sink = op.fn(Ctor, p[0], p[1]);
        },
      });
    }
    if (op.core) {
      const pairs = op.input === 'string'
        ? stringPairs
        : stringPairs.map(([a, b]) => [core.parse(a), core.parse(b)]);
      let i = 0;
      cases.push({
        name: `${opName} · ${sizeName} · core`,
        opName, sizeName, libName: 'core',
        run: () => {
          const p = pairs[i = (i + 1) & (PAIRS - 1)];
          sink = op.core(p[0], p[1]);
        },
      });
    }
  }
}

// ---- run ----
console.log(`fastdecimal bench — ops: ${opFilter.join(', ')} | sizes: ${sizeFilter.join(', ')}${quick ? ' | quick' : ''}`);
const bench = new Bench({ time: sampleTimeMs, warmupTime: Math.max(10, sampleTimeMs / 4) });
for (const c of cases) bench.add(c.name, c.run);
await bench.run();

// hz across tinybench major versions: v2 exposes result.hz, newer versions expose latency stats in ms
function opsPerSec(task) {
  const r = task.result;
  if (!r) return NaN;
  if (typeof r.hz === 'number') return r.hz;
  const meanMs = r.latency?.mean ?? r.mean;
  return meanMs ? 1000 / meanMs : NaN;
}

const byCase = new Map();
for (let i = 0; i < cases.length; i++) {
  const { opName, sizeName, libName } = cases[i];
  const key = `${opName}|${sizeName}`;
  if (!byCase.has(key)) byCase.set(key, { opName, sizeName });
  byCase.get(key)[libName] = opsPerSec(bench.tasks[i]);
}

// ---- report ----
const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : 'n/a');
const fmtRatio = (n) => (Number.isFinite(n) ? `${n.toFixed(2)}×` : 'n/a');
const rows = [...byCase.values()].map((r) => ({
  ...r,
  ratio: r['fastdecimal'] / r['big.js'],
  // facade throughput ÷ core throughput — the cost of the big.js wrapper (1.00 = free)
  facadeOverhead: r['core'] ? r['fastdecimal'] / r['core'] : NaN,
}));

const header = ['operation', 'size', 'big.js (ops/s)', 'core (ops/s)', 'facade (ops/s)', 'speedup', 'facade/core'];
const table = [header, ...rows.map((r) => [
  r.opName, r.sizeName, fmt(r['big.js']), fmt(r['core']), fmt(r['fastdecimal']),
  fmtRatio(r.ratio), fmtRatio(r.facadeOverhead),
])];
const widths = header.map((_, i) => Math.max(...table.map((row) => String(row[i]).length)));
for (const row of table) {
  console.log(row.map((cell, i) => String(cell).padEnd(widths[i])).join('  '));
}

const slower = rows.filter((r) => r.ratio < 1);
console.log(slower.length === 0
  ? `\nfastdecimal is faster in all ${rows.length} measured cases.`
  : `\nWARNING: fastdecimal is slower in ${slower.length}/${rows.length} cases: ${slower.map((r) => `${r.opName}·${r.sizeName} (${r.ratio.toFixed(2)}×)`).join(', ')}`);

// ---- write RESULTS.md + results.json (full runs only, so committed files are always the complete matrix) ----
if (!quick && !pick('op') && !pick('size')) {
  const bigJsVersion = require('big.js/package.json').version;
  const meta = {
    date: new Date().toISOString().slice(0, 10),
    node: process.version,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    bigJsVersion,
    sizes: Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v.int + v.frac])),
  };
  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'results.json'),
    JSON.stringify({ meta, results: rows }, null, 2),
  );
  const md = [
    '# Benchmark results',
    '',
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Node: ${process.version} | CPU: ${os.cpus()[0]?.model ?? 'unknown'} | OS: ${os.platform()} ${os.release()}`,
    `- big.js: v${bigJsVersion} | settings: library defaults (DP=20, RM=1) for both`,
    `- Sizes: ${Object.entries(SIZES).map(([k, v]) => `${k}=${v.int + v.frac} digits`).join(', ')}`,
    '- Reproduce: `yarn bench`',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.opName} | ${r.sizeName} | ${fmt(r['big.js'])} | ${fmt(r['core'])} | ${fmt(r['fastdecimal'])} | ${fmtRatio(r.ratio)} | ${fmtRatio(r.facadeOverhead)} |`),
    '',
  ].join('\n');
  const out = join(dirname(fileURLToPath(import.meta.url)), 'RESULTS.md');
  writeFileSync(out, md);
  console.log(`\nWrote ${out}`);
}
