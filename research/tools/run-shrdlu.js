// Run a version of SHRDLU on the bench's MacLisp interpreter, from the command line.
//   node research/tools/run-shrdlu.js <version> [--pre FORM]... [sentence ... | --dialogue]
// Loads the version's files (with its recorded repairs) through its own loader,
// starts it as the bench does, types each sentence and prints the teletype.
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../js/versions.js');
const Session = require('../js/session.js');

const vid = process.argv[2] || 'ejs';
let args = process.argv.slice(3);
const pre = [];
while (args[0] === '--pre') { pre.push(args[1]); args = args.slice(2); }
if (args[0] === '--dialogue') {
  args = [];
  fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'shrdlu-dialogue-canonical.md'), 'utf8').split('\n').forEach(function (l) {
    const a = /^(\d+)\.\s+Person:\s*(.*)$/.exec(l), b = /^\s+Person:\s*(.*)$/.exec(l);
    if (a) args.push(a[2].toLowerCase()); else if (b) args.push(b[1].toLowerCase());
  });
}
const v = V.byId(vid);
const ROOT = path.join(__dirname, '..', '..', 'source');
const texts = {};
Object.keys(V.VERSIONS).forEach(function () {});
V.VERSIONS.forEach(function (w) { (w.build || []).forEach(function (b) { texts[b.src] = fs.readFileSync(path.join(ROOT, b.src), 'latin1'); }); });
const s = new Session({ version: v, texts: texts, schedule: null, out: function (t) { process.stdout.write(t.replace(/\u0001/g, '\n[bench types] ').replace(/\u0002/g, '\n')); } });
const t0 = Date.now();
s.boot(function (r) {
  process.stdout.write('\n[booted: ' + r + ', ' + s.m.steps + ' steps, ' + (Date.now() - t0) + ' ms]\n');
  pre.forEach(function (f) { s.eval(f); s.pumpSync(); });
  (function next(i) {
    if (s.state !== 'waiting' || i >= args.length) {
      if (s.state === 'halted') console.log('[halted:', s.m.halted.msg, s.m.halted.obj ? s.m.prin1String(s.m.halted.obj) : '', '] backtrace:', (s.m.haltedStack || []).slice(0, 15).join(' < '));
      return;
    }
    process.stdout.write('\n>>> ' + JSON.stringify(args[i]) + '\n');
    const t1 = Date.now(), st = s.m.steps;
    s.type(args[i], function (r2) { process.stdout.write('\n[' + r2 + ', ' + (s.m.steps - st) + ' steps, ' + (Date.now() - t1) + ' ms]\n'); next(i + 1); });
  })(0);
});
