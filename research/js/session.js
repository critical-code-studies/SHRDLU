/*
 * session.js - one run of SHRDLU on the bench's MacLisp: a version's files
 * gathered into its directory, its repairs applied, the program loaded by its
 * own loader and started. Used by the Run view and by tools/run-shrdlu.js.
 *
 *   var s = new SHSession({ version: V.byId('ejs'), texts: {src: text, ...},
 *                           out: fn(text), display: obj });
 *   s.boot(onState)   loads and starts (in slices, never blocking long)
 *   s.type(line)      sends a line to the teletype
 *   s.state           'loading' | 'running' | 'waiting' | 'halted'
 */
(function (root) {
  'use strict';
  var L = root.MacLisp || (typeof require === 'function' ? require('./maclisp.js') : null);
  var R = root.SHRepairs || (typeof require === 'function' ? require('./repairs.js') : null);

  // A file's name on ITS: first name, then second name without a version
  // number (plnr.182 -> PLNR; graphf.init -> GRAPHF INIT; demo.flick -> DEMO FLICK).
  function itsName(src) { return src.split('/').pop().replace(/\.\d+$/, '').replace('.', ' ').toUpperCase(); }

  function Session(o) {
    var s = this;
    s.v = o.version;
    s.log = '';
    s.out = o.out || function () {};
    s.onState = o.onState || function () {};
    s.slice = o.slice || 60000;
    s.schedule = o.schedule || (typeof setTimeout === 'function' ? function (f) { setTimeout(f, 0); } : null);
    s.repairs = R.forVersion(s.v.id);
    s.start = R.startOf(s.v.id);
    // the directory: every program and support file, by its ITS name
    var files = {};
    s.v.build.forEach(function (b) { if (b.role !== 'doc') files[itsName(b.src)] = o.texts[b.src]; });
    s.marks = R.applyText(s.v.id, files, function (src) { return o.texts[src]; });
    var al = R.aliases(s.v.id);
    Object.keys(al).forEach(function (k) { files[k] = al[k].map(function (n) { return files[n] || ''; }).join('\n'); });
    s.files = files;
    s.m = new L.Machine({ dialect: s.v.id === 'ejs' ? 'new' : 'old', files: files, display: o.display || null, skip: R.skips(s.v.id),
      out: function (t) { s.log += t; s.out(t); } });
    s.state = 'idle';
  }
  var S = Session.prototype;

  S.setState = function (st, info) { this.state = st; this.onState(st, info || {}); };
  S.eval = function (src) { var m = this.m; m.ev(m.readFrom(new m.Stream(src))); };
  // Run the machine in slices until it waits, halts or finishes; then call done(result).
  S.pump = function (done) {
    var s = this;
    (function step() {
      var r = s.m.run(s.slice);
      if (r === 'budget') { if (s.schedule) s.schedule(step); else step(); return; }
      done(r);
    })();
  };
  // Load, apply the form repairs, start, and answer the start-up questions.
  S.boot = function (cb) {
    var s = this, answers = (s.start.answers || []).slice();
    s.setState('loading');
    s.eval(s.start.load);
    s.pump(function (r) {
      if (r === 'error') { s.setState('halted', { phase: 'load' }); if (cb) cb(r); return; }
      R.forms(s.v.id).forEach(function (f) { s.eval(f); s.pumpSync(); });
      s.loadedSteps = s.m.steps;
      s.setState('running');
      s.eval(s.start.run);
      (function next() {
        s.pump(function (r2) {
          if (r2 === 'input' && answers.length) { var a = answers.shift(); s.out('\u0001' + a + '\u0002'); s.m.type(a); next(); return; }
          s.setState(r2 === 'input' ? 'waiting' : r2 === 'error' ? 'halted' : 'done');
          if (cb) cb(r2);
        });
      })();
    });
  };
  S.pumpSync = function () { var r; do { r = this.m.run(1e6); } while (r === 'budget'); return r; };
  S.type = function (line, cb) {
    var s = this;
    s.setState('running');
    s.m.type(line + '\r');
    s.pump(function (r) { s.setState(r === 'input' ? 'waiting' : r === 'error' ? 'halted' : 'done'); if (cb) cb(r); });
  };

  root.SHSession = Session;
  Session.itsName = itsName;
  if (typeof module !== 'undefined' && module.exports) module.exports = Session;
})(this);
