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
    s.animate = !!o.animate;
    s.speed = o.speed || 1;   // the arm: 1 as the program's SLEEPs ask, 2 or 3 times as fast
    s.wait = o.wait || (typeof setTimeout === 'function' ? function (f, ms) { setTimeout(f, ms); } : null);
    s.display = o.display || null;
    s.repairs = R.forVersion(s.v.id);
    s.start = R.startOf(s.v.id, !!o.display);
    // the directory: every program and support file, by its ITS name
    var files = {};
    s.v.build.forEach(function (b) { if (b.role !== 'doc') files[itsName(b.src)] = o.texts[b.src]; });
    s.marks = R.applyText(s.v.id, files, function (src) { return o.texts[src]; }, !!o.display);
    var al = R.aliases(s.v.id);
    Object.keys(al).forEach(function (k) { files[k] = al[k].map(function (n) { return files[n] || ''; }).join('\n'); });
    s.files = files;
    s.m = new L.Machine({ dialect: s.v.id === 'ejs' ? 'new' : 'old', files: files, display: o.display || null, skip: R.skips(s.v.id, !!o.display),
      out: function (t) { s.log += t; s.out(t); } });
    if (o.display) o.display.m = s.m;   // the display reads graphf's tables for its Solid view
    s.state = 'idle';
  }
  var S = Session.prototype;

  S.setState = function (st, info) { this.state = st; this.onState(st, info || {}); };
  S.eval = function (src) { var m = this.m; m.ev(m.readFrom(new m.Stream(src))); };
  // Run the machine in slices until it waits, halts or finishes; then call done(result).
  S.pump = function (done) {
    var s = this, g = s.gen = (s.gen || 0);
    (function step() {
      if (s.gen !== g) return;   // quit (^G) since: this run is abandoned
      var r = s.m.run(s.slice);
      if (r === 'budget') { if (s.schedule) s.schedule(step); else step(); return; }
      // SLEEP: wait as long as the program asked, when animating; otherwise go straight on
      if (r === 'sleep') { if (s.animate && s.wait) s.wait(step, s.m.slept / (s.speed || 1)); else if (s.schedule) s.schedule(step); else step(); return; }
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
      R.forms(s.v.id, !!s.display).forEach(function (f) { s.eval(f); s.pumpSync(); });
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
  // ^G, as on ITS: quit whatever is running to the top level, which SHRDLU sets to itself
  // ((SSTATUS TOPLEVEL '(SHRDLU)) in the restoration; (SHRDLU) is the loop in every copy)
  // graphf's display operations draw in steps (a new arm made, the old one removed, the hand's
  // record updated at the end); quitting inside one leaves the screen and graphf's record of it
  // at odds (two arms). ^G waits for the one under way to finish, run at full speed.
  var DISPLAY_OPS = { MOVETO: 1, GRASP: 1, UNGRASP: 1, 'GP-DISMOTION': 1, 'GP-MOVEHAND': 1, 'GP-SELECTSHAPE': 1, 'GP-DRAWL': 1, 'GP-OPAQUE': 1, 'GP-TRANSPARENT': 1, 'GP-REFRESH': 1, 'GP-INITIAL': 1 };
  S.inDisplayOp = function () { var st = this.m.stack; for (var i = st.length - 1; i >= 0; i--) if (st[i].fnName && DISPLAY_OPS[st[i].fnName]) return true; return false; };
  S.quit = function (cb) {
    var s = this;
    s.gen = (s.gen || 0) + 1;
    if (s.display && s.inDisplayOp()) {
      var g = s.gen;
      (function tick() {
        if (s.gen !== g) return;
        var r, n = 0;
        do { r = s.m.run(200); } while ((r === 'budget' || r === 'sleep') && s.inDisplayOp() && ++n < 500);
        if ((r === 'budget' || r === 'sleep') && s.inDisplayOp()) { setTimeout(tick, 0); return; }
        s.quitNow(cb);
      })();
      return;
    }
    s.quitNow(cb);
  };
  S.quitNow = function (cb) {
    var s = this;
    s.gen = (s.gen || 0) + 1;
    s.m.quitToTop();
    s.setState('running');
    s.eval('(SHRDLU)');
    s.pump(function (r) { s.setState(r === 'input' ? 'waiting' : r === 'error' ? 'halted' : 'done'); if (cb) cb(r); });
  };
  // characters as typed, without a line end (^X, for instance), then run until the program waits
  S.raw = function (text, cb) {
    var s = this;
    s.setState('running'); s.m.type(text);
    s.pump(function (r) { s.setState(r === 'input' ? 'waiting' : r === 'error' ? 'halted' : 'done'); if (cb) cb(r); });
  };
  // A Micro-Planner goal, run as SHRDLU runs a command (THVAL2 NIL goal: ANSCOMMAND in newans), from
  // READY: ^X takes SHRDLU into its break loop (ETAOIN reads ^X so), where the form is evaluated and its
  // value printed; GO takes it back to READY. cb({ value, message, ok }): value, what the break loop
  // printed (the goal on success, NIL on failure); message, a break the goal ran into on the way (a
  // guard such as TE-SUPP), after which GO also returns to READY.
  S.planner = function (goal, cb) {
    var s = this, got = '', out0 = s.out;
    if (s.state !== 'waiting') { cb({ ok: false, message: 'SHRDLU is busy' }); return; }
    s.out = function (t) { got += t; out0(t); };
    var done = function (res) { s.out = out0; cb(res); };
    s.raw('\x18', function () {
      got = '';
      s.raw("(THVAL2 NIL '" + goal + ')\r\n', function (r) {
        var text = got.replace(/>>>\s*$/, '').trim(), lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        var value = lines.length ? lines[lines.length - 1] : '', message = lines.length > 1 ? lines.slice(0, -1).join(' ') : '';
        // a nested break loop: the last line is its message, not a value
        if (!/^[(]|^NIL$/.test(value)) { message = text; value = ''; }
        s.raw('GO \r\n', function () { done({ ok: /^\(/.test(value), value: value, message: message, raw: text, state: r }); });
      });
    });
  };
  S.pumpSync = function () { var r; do { r = this.m.run(1e6); } while (r === 'budget' || r === 'sleep'); return r; };
  S.type = function (line, cb) {
    var s = this;
    s.setState('running');
    // Return sends a carriage return and a line feed: the ITS teletype had a key for each, and
    // SHRDLU asks for a line feed after a word it does not know (morpho, ETAOIN: NOGO)
    s.m.type(line + '\r\n');
    s.pump(function (r) { s.setState(r === 'input' ? 'waiting' : r === 'error' ? 'halted' : 'done'); if (cb) cb(r); });
  };

  root.SHSession = Session;
  Session.itsName = itsName;
  if (typeof module !== 'undefined' && module.exports) module.exports = Session;
})(this);
