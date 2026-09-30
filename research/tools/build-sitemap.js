// Writes research/sitemap.html from the version catalogue (js/versions.js):
// every view as a plain link, and every version with its files on GitHub.
// Run from the repository root: node research/tools/build-sitemap.js
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../js/versions.js');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const REF = { mit: 'SHI', stanford: 'SHS', ejs: 'SHE', jan71: 'SH-JAN71', c1: 'SH-C1' };
const GH = 'https://github.com/critical-code-studies/SHRDLU/blob/main/source/';
const today = new Date().toISOString().slice(0, 10);

const views = [
  ['Read', [['index.html?tab=read', 'Read', 'the listing, annotated'], ['index.html?tab=run', 'Run', 'the demonstration dialogue as the test; the interpreter being built']]],
  ['Text', [['index.html?lens=1', 'Comments', 'every comment, searchable'], ['index.html?lens=2', 'Hands and dates', 'names, initials, dates'], ['index.html?lens=3', 'Lexicon', 'every defined name'], ['index.html?lens=7', 'Symbol histories', 'one name across the versions']]],
  ['Program', [['index.html?lens=4', 'Files', 'the files the loader reads'], ['index.html?lens=5', 'Calls', 'which definitions call which'], ['index.html?lens=6', 'Theorems', 'the Micro-Planner theorems']]],
  ['Versions', [['index.html?tab=about', 'This version', 'its record and annotations'], ['index.html?tab=compare&b=stanford', 'Compare', 'two versions side by side'], ['index.html?tab=genealogy', 'Genealogy', 'how the versions descend'], ['index.html?lens=8', 'Absence', 'gaps and damage']]],
  ['Shared', [['index.html?tab=findings', 'Findings', 'what has been established, with evidence'], ['index.html?tab=notes', 'My notes', 'your tray for writing']]],
  ['Help', [['index.html?tour=welcome', 'Welcome tour', ''], ['index.html?help=refs', 'Referencing and versions', ''], ['index.html?help=join', 'Joining the annotation group', ''], ['index.html?help=about', 'About the bench', '']]]
];

const rows = V.VERSIONS.slice().sort((a, b) => a.sort - b.sort).map((v, i) => {
  if (!v.build) return `<tr class="lost"><td></td><td class="mono">${esc(REF[v.id] || '')}</td><td>${esc(v.label)}</td><td>${esc(v.date)}</td><td><a href="index.html?v=${esc(v.id)}&amp;tab=about">Record</a></td><td>lost: no copy held</td></tr>`;
  const files = v.build.map((b) => `<a href="${GH}${b.src.split('/').map(encodeURIComponent).join('/')}">${esc(b.src.split('/').pop())}</a>`).join(' · ');
  return `<tr><td class="num">${i + 1}</td><td class="mono">${esc(REF[v.id] || '')}</td><td>${esc(v.label)}</td><td>${esc(v.date)}</td><td><a href="index.html?v=${esc(v.id)}">Read</a> · <a href="index.html?v=${esc(v.id)}&amp;tab=about">Record</a></td><td class="files">${files}</td></tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site map · SHRDLU Research Bench</title>
<meta name="description" content="Every view of the SHRDLU Research Bench as a plain link, with the versions and their source files.">
<style>
  :root { --bg: #f6f4ee; --fg: #1d1f24; --dim: #5d6058; --line: #d8d4c8; --link: #2c7a4b; --head: #ecE8dc; }
  @media (prefers-color-scheme: dark) { :root { --bg: #11131a; --fg: #e7e4da; --dim: #989b93; --line: #2f333d; --link: #6fdc8c; --head: #171a23; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 24px; margin: 8px 0 4px; } h2 { font-size: 17px; margin: 26px 0 8px; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
  a { color: var(--link); } p { margin: 6px 0; } .dim { color: var(--dim); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 24px; }
  .grid h3 { font-size: 14px; margin: 10px 0 2px; } .grid ul { margin: 0; padding-left: 18px; }
  .wrap { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid var(--line); } th { background: var(--head); font-weight: 600; }
  .num { text-align: right; } .mono { font-family: ui-monospace, Menlo, Consolas, monospace; white-space: nowrap; } .files { font-size: 12.5px; } tr.lost td { color: var(--dim); }
  .top a { margin-right: 14px; }
</style>
</head>
<body>
<main>
<p class="top"><a href="index.html">← The research bench</a><a href="../index.html">The SHRDLU site</a></p>
<h1>Site map</h1>
<p>Every view of the SHRDLU Research Bench as a plain link, for when a menu will not open. The bench runs in JavaScript; without it, the source files below open on GitHub.</p>
<p class="dim">Each link opens the MIT files as found on ITS unless it names a version; the version picker at the top of the bench changes it. Generated from the bench’s version list, ${today}.</p>
<h2>Views</h2>
<div class="grid">${views.map(([h, items]) => `<div><h3>${esc(h)}</h3><ul>${items.map(([u, t, d]) => `<li><a href="${esc(u)}">${esc(t)}</a>${d ? ': ' + esc(d) : ''}</li>`).join('')}</ul></div>`).join('')}</div>
<h2>Versions and their sources</h2>
<p class="dim">References as in Help ▸ Referencing and versions. Files in the order the program’s loader read them.</p>
<div class="wrap"><table><thead><tr><th>No.</th><th>Reference</th><th>Version</th><th>Dated</th><th>Open</th><th>Source files</th></tr></thead><tbody>
${rows}
</tbody></table></div>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'sitemap.html'), html);
console.log('sitemap.html written');
