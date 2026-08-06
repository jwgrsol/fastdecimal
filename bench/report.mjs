// Generates bench/report.html — a self-contained visual report from bench/results.json.
// Run `node bench/run.mjs` (full matrix) first, then `node bench/report.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { meta, results } = JSON.parse(readFileSync(join(here, 'results.json'), 'utf8'));

const OPS = [...new Set(results.map(r => r.opName))];
const SIZES = [...new Set(results.map(r => r.sizeName))];

// ---- layout ----
const ROW_H = 24,
  M = { top: 8, right: 74, bottom: 30, left: 88 };
const W = 760,
  innerW = W - M.left - M.right;
const panelH = M.top + OPS.length * ROW_H + M.bottom;

// log-10 x scale over the data range with headroom
const ratios = results.map(r => r.ratio);
const domainMin = Math.min(0.4, ...ratios) / 1.4;
const domainMax = Math.max(4, ...ratios) * 1.4;
const xPos = v =>
  M.left + ((Math.log10(v) - Math.log10(domainMin)) / (Math.log10(domainMax) - Math.log10(domainMin))) * innerW;
const TICKS = [0.25, 1, 4, 16, 64, 256, 1024].filter(t => t > domainMin && t < domainMax);

const fmtOps = n => Math.round(n).toLocaleString('en-US');
const fmtRatio = r => (r >= 100 ? `${Math.round(r)}×` : `${r.toFixed(2)}×`);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---- one panel per operand size ----
function panel(sizeName) {
  const rows = OPS.map(op => results.find(r => r.sizeName === sizeName && r.opName === op)).filter(Boolean);
  const maxRow = rows.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const parts = [];

  // gridlines + ticks
  for (const t of TICKS) {
    const x = xPos(t);
    parts.push(`<line x1="${x}" y1="${M.top}" x2="${x}" y2="${panelH - M.bottom}" class="grid"/>`);
    parts.push(`<text x="${x}" y="${panelH - M.bottom + 16}" class="tick" text-anchor="middle">${t}×</text>`);
  }
  // 1× reference line (parity with big.js)
  const x1 = xPos(1);
  parts.push(`<line x1="${x1}" y1="${M.top}" x2="${x1}" y2="${panelH - M.bottom}" class="ref"/>`);

  rows.forEach((r, i) => {
    const y = M.top + i * ROW_H + ROW_H / 2;
    const x = xPos(r.ratio);
    const cls = r.ratio >= 1 ? 'faster' : 'slower';
    parts.push(`<text x="${M.left - 10}" y="${y + 4}" class="oplabel" text-anchor="end">${r.opName}</text>`);
    parts.push(`<line x1="${x1}" y1="${y}" x2="${x}" y2="${y}" class="stem"/>`);
    parts.push(`<circle cx="${x}" cy="${y}" r="5" class="dot ${cls}"/>`);
    // selective direct labels: the panel max and every slower-than-parity case
    if (r === maxRow) parts.push(`<text x="${x + 10}" y="${y + 4}" class="vlabel">${fmtRatio(r.ratio)}</text>`);
    else if (r.ratio < 1)
      parts.push(`<text x="${x - 10}" y="${y + 4}" class="vlabel" text-anchor="end">${fmtRatio(r.ratio)}</text>`);
    // oversized invisible hit target for the tooltip
    parts.push(
      `<circle cx="${x}" cy="${y}" r="13" class="hit" data-op="${r.opName}" data-size="${sizeName}" data-big="${fmtOps(r['big.js'])}" data-fast="${fmtOps(r['fastdecimal'])}" data-ratio="${fmtRatio(r.ratio)}"/>`
    );
  });

  return `<section class="panel">
  <h2>${sizeName} <span class="digits">— ${meta.sizes[sizeName]} significant digits per operand</span></h2>
  <svg viewBox="0 0 ${W} ${panelH}" role="img" aria-label="Speedup of fastdecimal over big.js, ${sizeName} operands">
    ${parts.join('\n    ')}
  </svg>
</section>`;
}

const fasterCount = results.filter(r => r.ratio >= 1).length;
const median = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
const max = Math.max(...ratios);

const tableRows = results
  .map(
    r =>
      `<tr><td>${r.opName}</td><td>${r.sizeName}</td><td class="num">${fmtOps(r['big.js'])}</td><td class="num">${fmtOps(r['fastdecimal'])}</td><td class="num">${fmtRatio(r.ratio)}</td></tr>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fastdecimal vs big.js — benchmark report</title>
<style>
  :root {
    color-scheme: light;
    --page: #f9f9f7; --surface: #fcfcfb;
    --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
    --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11,11,11,0.10);
    --faster: #2a78d6; --slower: #e34948;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --page: #0d0d0d; --surface: #1a1a19;
      --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
      --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
      --faster: #3987e5; --slower: #e66767;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19;
    --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
    --faster: #3987e5; --slower: #e66767;
  }
  * { margin: 0; box-sizing: border-box; }
  body { background: var(--page); color: var(--ink); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; }
  main { max-width: 820px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 650; }
  .meta { color: var(--ink-2); font-size: 13px; margin-top: 4px; }
  .stats { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; }
  .stat .v { font-size: 22px; font-weight: 650; }
  .stat .l { font-size: 12px; color: var(--ink-2); margin-top: 2px; }
  .legend { display: flex; gap: 18px; align-items: center; font-size: 13px; color: var(--ink-2); margin: 8px 0 4px; }
  .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px 8px; margin: 14px 0; }
  .panel h2 { font-size: 14px; font-weight: 650; margin-bottom: 6px; }
  .panel .digits { color: var(--ink-2); font-weight: 400; font-size: 13px; }
  svg { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .ref { stroke: var(--axis); stroke-width: 1.5; }
  .stem { stroke: var(--grid); stroke-width: 1; }
  .dot.faster { fill: var(--faster); }
  .dot.slower { fill: var(--slower); }
  .dot { stroke: var(--surface); stroke-width: 2; }
  .hit { fill: transparent; cursor: default; }
  .oplabel { font: 12px system-ui, sans-serif; fill: var(--ink-2); }
  .vlabel { font: 11px system-ui, sans-serif; fill: var(--ink); font-variant-numeric: tabular-nums; }
  .tick { font: 11px system-ui, sans-serif; fill: var(--muted); font-variant-numeric: tabular-nums; }
  .note { color: var(--muted); font-size: 12px; margin: 4px 0 16px; }
  #tooltip { position: fixed; display: none; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,0.18); z-index: 10; }
  #tooltip .t { font-weight: 650; margin-bottom: 4px; }
  #tooltip td { padding: 1px 0 1px 12px; text-align: right; font-variant-numeric: tabular-nums; }
  #tooltip td:first-child { padding-left: 0; text-align: left; color: var(--ink-2); }
  details { margin: 20px 0; }
  summary { cursor: pointer; color: var(--ink-2); font-size: 14px; }
  table.data { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 13px; background: var(--surface); }
  table.data th, table.data td { border: 1px solid var(--grid); padding: 5px 10px; text-align: left; }
  table.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<main>
  <h1>fastdecimal vs big.js</h1>
  <p class="meta">${meta.date} · Node ${esc(meta.node)} · ${esc(meta.cpu)} · big.js v${esc(meta.bigJsVersion)} · defaults DP=20, RM=1 · reproduce: <code>node bench/run.mjs</code></p>
  <div class="stats">
    <div class="stat"><div class="v">${fasterCount}/${results.length}</div><div class="l">cases faster than big.js</div></div>
    <div class="stat"><div class="v">${fmtRatio(median)}</div><div class="l">median speedup</div></div>
    <div class="stat"><div class="v">${fmtRatio(max)}</div><div class="l">largest speedup</div></div>
  </div>
  <div class="legend">
    <span><span class="swatch" style="background:var(--faster)"></span>faster than big.js</span>
    <span><span class="swatch" style="background:var(--slower)"></span>slower</span>
    <span>vertical line = 1× (parity) · log scale</span>
  </div>
  ${SIZES.map(panel).join('\n')}
  <p class="note">Each dot is one operation's throughput ratio (fastdecimal ops/s ÷ big.js ops/s). Dots left of the 1× line are slower than big.js.</p>
  <details>
    <summary>Data table (all ${results.length} measurements)</summary>
    <table class="data">
      <tr><th>operation</th><th>size</th><th class="num">big.js (ops/s)</th><th class="num">fastdecimal (ops/s)</th><th class="num">speedup</th></tr>
      ${tableRows}
    </table>
  </details>
</main>
<div id="tooltip"></div>
<script>
  const tip = document.getElementById('tooltip');
  document.querySelectorAll('.hit').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      const d = el.dataset;
      tip.innerHTML = '<div class="t">' + d.op + ' · ' + d.size + '</div>' +
        '<table><tr><td>big.js</td><td>' + d.big + ' ops/s</td></tr>' +
        '<tr><td>fastdecimal</td><td>' + d.fast + ' ops/s</td></tr>' +
        '<tr><td>speedup</td><td>' + d.ratio + '</td></tr></table>';
      tip.style.display = 'block';
    });
    el.addEventListener('mousemove', (e) => {
      const pad = 14, r = tip.getBoundingClientRect();
      tip.style.left = Math.min(e.clientX + pad, innerWidth - r.width - 8) + 'px';
      tip.style.top = Math.min(e.clientY + pad, innerHeight - r.height - 8) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
</script>
</body>
</html>
`;

writeFileSync(join(here, 'report.html'), html);
console.log(`Wrote ${join(here, 'report.html')} (${SIZES.length} panels, ${results.length} measurements)`);
