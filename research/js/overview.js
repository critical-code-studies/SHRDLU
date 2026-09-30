/*
 * overview.js - a functional overview of a version, for a programmer (Program ▸ Functional overview):
 * one exchange recorded as the program runs it on the bench's interpreter, as the Spacewar! bench
 * records a version on its emulator. Every named Lisp function entered and left is kept (the
 * interpreter tells an attached profiler, m.prof), with the steps spent in it alone and with
 * what it calls, who called it, and, moment by moment, which part of the program is running: the
 * file of the innermost function, gathered into the program's parts (the top level, reading,
 * parsing, semantics, answering, Micro-Planner, the blocks world, the display).
 */
(function (root) {
  'use strict';
  var SW = root.SW, O = SW.overview = {};

  // the program's parts, by file (the files' first names, as the loader reads them)
  var PARTS = [
    ['top', 'The top level', ['SYSCOM', 'SETUP', 'LOADER', 'SHOW'], '#8a909a'],
    ['read', 'Reading the sentence', ['MORPHO'], '#cfe8ff'],
    ['parse', 'Parsing (PROGRAMMAR and the grammar)', ['PROGMR', 'GINTER', 'GRAMAR', 'PARSER', 'CGRAM', 'MACROS'], '#4d92e0'],
    ['dict', 'The dictionary', ['DICTIO'], '#6fdc8c'],
    ['sem', 'Semantics', ['SMSPEC', 'SMASS', 'SMUTIL'], '#4fdc6a'],
    ['ans', 'Answering', ['NEWANS'], '#e58be0'],
    ['plnr', 'Micro-Planner', ['PLNR', 'THTRAC'], '#ff9f6b'],
    ['world', 'The blocks world', ['BLOCKS', 'BLOCKL', 'BLOCKP', 'DATA'], '#ff5a4e'],
    ['disp', 'The display (graphf)', ['GRAPHF'], '#d4ecff']
  ];
  var PART_OF = {}; PARTS.forEach(function (p) { p[2].forEach(function (f) { PART_OF[f] = p; }); });
  var OTHER = ['other', 'Supplied by the machine', [], '#5b5f66'];
  function fileKey(src) { return src.split('/').pop().replace(/\.\d+$/, '').replace(/\..*$/, '').toUpperCase(); }

  // the profiler: calls, steps with and without callees, callers, and the running part over time
  function Prof(fnPart) {
    this.fn = {}; this.stack = []; this.timeline = []; this.fnPart = fnPart; this.cur = null; this.t0 = null;
  }
  Prof.prototype.enter = function (name, steps) {
    if (this.t0 == null) this.t0 = steps;
    var f = this.fn[name] || (this.fn[name] = { name: name, calls: 0, incl: 0, excl: 0, callers: {} }), top = this.stack[this.stack.length - 1];
    f.calls++;
    if (top) { f.callers[top.name] = (f.callers[top.name] || 0) + 1; top.child += 0; }
    this.stack.push({ name: name, start: steps, child: 0, rec: this.stack.some(function (s) { return s.name === name; }) });
    this.mark(this.fnPart(name), steps);
    return true;
  };
  Prof.prototype.exit = function (name, steps) {
    var s = this.stack.pop(); if (!s) return;
    var f = this.fn[s.name], d = steps - s.start;
    if (!s.rec) f.incl += d;   // a recursive call's time is counted once, at its outermost entry
    f.excl += d - s.child;
    var up = this.stack[this.stack.length - 1]; if (up) up.child += d;
    this.mark(up ? this.fnPart(up.name) : null, steps);
  };
  // the part running, as segments in time
  Prof.prototype.mark = function (part, steps) {
    if (this.cur && this.cur.part === part) return;
    if (this.cur) this.cur.end = steps;
    this.cur = part ? { part: part, start: steps, end: steps } : null;
    if (this.cur) this.timeline.push(this.cur);
  };

  // record an exchange: the program started on its own copy, then the sentence typed with the profiler on
  var cache = {};
  O.record = function (b, sentence, cb) {
    var key = b.v.id + '|' + sentence;
    if (cache[key]) { cb(cache[key]); return; }
    var defs = {}; (b.asm ? b.asm.symbols : []).forEach(function (s) { var d = s.defs && s.defs[0]; if (d && d.file != null) defs[s.name] = d.file; });
    var fnPart = function (name) { var p = defs[name]; return p != null ? (PART_OF[fileKey(b.parts[p].src)] || OTHER) : OTHER; };
    var v = b.v, srcs = v.build.map(function (x) { return x.src; }).concat(root.SHRepairs.sources(v.id)), tx = {};
    Promise.all(srcs.map(function (s) { return SW.fetchText(s).then(function (x) { tx[s] = x; }); })).then(function () {
      var out = '', d = new root.SH340({}), s = new root.SHSession({ version: v, texts: tx, display: d, animate: false, out: function (t) { out += t; } });
      s.boot(function (r) {
        if (r !== 'input') { cb({ error: 'The program did not start (' + r + ').' }); return; }
        var prof = s.m.prof = new Prof(fnPart), st0 = s.m.steps; out = '';
        s.type(sentence, function () {
          s.m.prof = null;
          if (prof.cur) prof.cur.end = s.m.steps;
          var res = { prof: prof, steps: s.m.steps - st0, out: out, defs: defs, t0: prof.t0 == null ? st0 : prof.t0, t1: s.m.steps };
          cache[key] = res; cb(res);
        });
      });
    });
  };

  O.render = function (b, el) {
    var sentence = SW.store.get('ov.sentence', 'pick up a big red block.');
    el.innerHTML = '<div class="card ov-card" style="grid-column:1/-1"><h3>An exchange, recorded</h3><p class="lede">The program run on its own copy, the sentence typed, and every Lisp function it enters recorded, with the steps of the bench’s interpreter spent in it. The parts are the program’s files, gathered as its loader gathers them.</p>' +
      '<form class="ov-form gx-bar"><input class="ov-in mono" value="' + SW.esc(sentence) + '" aria-label="A sentence to record" spellcheck="false"><button class="btn">Record</button><span class="hint ov-note">Recording…</span></form><div class="ov-body"></div></div>';
    SW.$('.ov-form', el).onsubmit = function (e) { e.preventDefault(); var s = SW.$('.ov-in', el).value.trim(); if (!s) return; SW.store.set('ov.sentence', s); O.render(b, el); };
    if (!b.v.build) { SW.$('.ov-note', el).textContent = 'No source to run.'; return; }
    O.record(b, sentence, function (res) {
      if (!el.isConnected) return;
      if (res.error) { SW.$('.ov-note', el).textContent = res.error; return; }
      SW.$('.ov-note', el).textContent = res.steps.toLocaleString('en-GB') + ' steps, ' + Object.keys(res.prof.fn).length + ' functions.';
      draw(b, SW.$('.ov-body', el), res);
    });
  };

  function draw(b, el, res) {
    var P = res.prof, T0 = res.t0, T1 = res.t1, span = Math.max(1, T1 - T0);
    // the parts over time
    var W = 1000, o = ['<svg viewBox="0 0 ' + W + ' 150" class="ov-svg" role="img" aria-label="The part of the program running, moment by moment"><rect width="' + W + '" height="150" fill="#05070a"/>'];
    var X = function (s) { return 10 + (s - T0) / span * (W - 20); };
    P.timeline.forEach(function (seg) { var x0 = X(seg.start), x1 = X(seg.end); if (x1 - x0 < 0.3) return; o.push('<rect x="' + x0.toFixed(1) + '" y="20" width="' + Math.max(0.6, x1 - x0).toFixed(1) + '" height="60" fill="' + seg.part[3] + '"><title>' + SW.esc(seg.part[1]) + '</title></rect>'); });
    for (var k = 0; k <= 10; k++) { var sx = 10 + k * (W - 20) / 10; o.push('<line x1="' + sx + '" y1="84" x2="' + sx + '" y2="92" stroke="#5b5f66"/><text x="' + sx + '" y="106" fill="#8a8d86" font-size="11" text-anchor="middle" font-family="ui-monospace, Menlo, monospace">' + Math.round(k * span / 10 / 1000) + 'k</text>'); }
    o.push('<text x="10" y="138" fill="#8a8d86" font-size="12" font-family="ui-monospace, Menlo, monospace">steps of the bench’s interpreter, from the sentence typed to READY</text></svg>');
    // the parts: steps spent in each (each function's own steps, by its file)
    var byPart = {}; Object.keys(P.fn).forEach(function (n) { var f = P.fn[n], pt = P.fnPart(n); (byPart[pt[0]] = byPart[pt[0]] || { part: pt, steps: 0, fns: 0 }); byPart[pt[0]].steps += f.excl; byPart[pt[0]].fns++; });
    var parts = Object.keys(byPart).map(function (k) { return byPart[k]; }).sort(function (a, c) { return c.steps - a.steps; }), tot = parts.reduce(function (s, p) { return s + p.steps; }, 0) || 1;
    var key = PARTS.concat([OTHER]).filter(function (p) { return byPart[p[0]]; }).map(function (p) { return '<span class="ov-k"><i style="background:' + p[3] + '"></i>' + SW.esc(p[1]) + '</span>'; }).join('');
    var bars = parts.map(function (p) { return '<div class="ov-bar"><span>' + SW.esc(p.part[1]) + '</span><i style="width:' + (100 * p.steps / tot).toFixed(1) + '%;background:' + p.part[3] + '"></i><em>' + (100 * p.steps / tot).toFixed(1) + '% · ' + p.fns + ' fn</em></div>'; }).join('');
    // the functions
    var fns = Object.keys(P.fn).map(function (n) { return P.fn[n]; }).sort(function (a, c) { return c.incl - a.incl; });
    var ref = function (n) { var p = res.defs[n]; if (p == null) return SW.esc(n); var line = 0; (b.asm.symbols || []).some(function (s) { if (s.name === n && s.defs && s.defs[0]) { line = s.defs[0].line; return true; } return false; }); return '<a href="#" data-read="' + p + ':' + line + '" class="mono">' + SW.esc(n) + '</a>'; };
    var rows = fns.slice(0, 80).map(function (f) {
      var callers = Object.keys(f.callers).sort(function (a, c) { return f.callers[c] - f.callers[a]; }).slice(0, 3);
      var pt = P.fnPart(f.name), p = res.defs[f.name];
      return '<tr><td>' + ref(f.name) + '</td><td><i class="ov-dot" style="background:' + pt[3] + '"></i>' + SW.esc(p != null ? b.parts[p].src.split('/').pop() : 'the machine') + '</td><td class="num">' + f.calls.toLocaleString('en-GB') + '</td><td class="num">' + f.incl.toLocaleString('en-GB') + '</td><td class="num">' + f.excl.toLocaleString('en-GB') + '</td><td class="mono">' + callers.map(SW.esc).join(' ') + '</td></tr>';
    }).join('');
    el.innerHTML = '<h4>The exchange in time</h4><p class="hint">Which part of the program is running, moment by moment: the file of the innermost Lisp function.</p>' + o.join('') + '<div class="ov-keys">' + key + '</div>' +
      '<h4>Where the steps go</h4><p class="hint">Each function’s own steps (not those of what it calls), gathered by part.</p><div class="ov-bars">' + bars + '</div>' +
      '<h4>The functions</h4><p class="hint">The ' + Math.min(80, fns.length) + ' of ' + fns.length + ' with the most steps, what they call included. Click a name to read it.</p><div class="ov-t"><table class="ov-sub"><thead><tr><th>Function</th><th>File</th><th>Calls</th><th>Steps, with what it calls</th><th>Steps, its own</th><th>Called most from</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h4>What SHRDLU said</h4><pre class="ov-out mono">' + SW.esc(res.out.trim()) + '</pre>';
    el.onclick = function (e) { var a = e.target.closest('[data-read]'); if (!a) return; e.preventDefault(); var x = a.dataset.read.split(':'); SW.state.sel = { p: +x[0], n0: +x[1], n1: +x[1] }; SW.setTab('read'); setTimeout(function () { if (SW.views.read.goto) SW.views.read.goto(+x[0], +x[1], true); }, 300); };
  }
})(this);
