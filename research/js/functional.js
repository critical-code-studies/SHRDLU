/*
 * functional.js - how this bench reads its MacLisp for bench-kit's Functional overview
 * (kit/functional.js; Program ▸ Functional overview), from the index js/lisp.js makes: the
 * functions and what each calls (a defined name heading a form) or names for EVAL, APPLY or
 * another function to call (quoted: 'NAME, '(NAME …), (QUOTE NAME)); the forms each file runs
 * as it is loaded; the parts of the system as the Dynamic Profile groups the files, and what
 * each defines; names and marks given in the Dynamic Profile; and the arguments PARSEVAL is
 * given. The program starts in the function SHRDLU, in syscom (SW.BENCH.entry). Micro-Planner
 * reaches theorems by pattern (THGOAL), not by name, so they are not counted as called. T and
 * NIL are left out: at the head of a COND clause they are tests, not calls.
 */
(function (root) {
  'use strict';
  var SW = root.SW;

  function O() { return SW.overview; }
  function fileName(b, p) { return b.parts[p].src.split('/').pop(); }
  // callable: a function, fexpr, macro, lexpr or grammar program (not a global, property, word or theorem)
  function callable(s) { return s && s.kinds.some(function (k) { return k !== 'VAR' && k !== 'PROP' && k !== 'WORD' && k !== 'THEOREM'; }); }
  var SKIP = { T: 1, NIL: 1 };
  function quoted(raw, name) {
    var n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp("(^|[\\s(])'\\(?" + n + '(?![A-Za-z0-9*?$-])|\\(QUOTE\\s+\\(?' + n + '(?![A-Za-z0-9*?$-])', 'i').test(raw || '');
  }
  var SHORT = { top: 'Top level', read: 'Reading', parse: 'Parsing', dict: 'Dictionary', sem: 'Semantics', ans: 'Answering', plnr: 'Micro-Planner', world: 'Blocks world', disp: 'Display', other: 'Other' };

  // Every defined name, with the callable names its definition calls and names, in the order of
  // its lines: one pass over the index's uses. All of them call (a dictionary word's definition
  // calls DEFS); only callable ones are shown as functions (show).
  function analyse(b) {
    var rs = [], byName = {};
    b.asm.symbols.forEach(function (s) {
      if (!s.defs.length || SKIP[s.name]) return;
      var d = s.defs[0], r = { name: s.name, p: d.file, n: d.line, end: d.end, calls: [], first: {} };
      rs.push(r); byName[s.name] = r;
    });
    var uses = b.asm.uses;
    Object.keys(uses).forEach(function (a) {
      if (SKIP[a] || !callable(b.sym[a])) return;
      uses[a].forEach(function (u) {
        var r = u.owner && byName[u.owner]; if (!r || a === r.name || u.file !== r.p || u.line < r.n || u.line > r.end) return;
        var f = r.first[a] || (r.first[a] = { call: null, named: null });
        if (u.call) { if (f.call == null || u.line < f.call) f.call = u.line; }
        else if ((f.named == null || u.line < f.named) && quoted((b.lines[u.file][u.line - 1] || {}).raw, a)) f.named = u.line;
      });
    });
    rs.forEach(function (r) {
      Object.keys(r.first).forEach(function (k) { var f = r.first[k]; if (f.call != null) r.calls.push({ name: k, line: f.call }); else if (f.named != null) r.calls.push({ name: k, line: f.named, named: true }); });
      r.calls.sort(function (x, y) { return x.line - y.line || (x.name < y.name ? -1 : 1); });
      delete r.first;
    });
    // what loading a file runs: its top-level forms that define nothing (or set a global), by head
    var load = b.parts.map(function () { return []; }), heads = b.parts.map(function () { return {}; });
    b.asm.forms.forEach(function (f) {
      if (f.defs.filter(function (d) { return d.kind !== 'VAR'; }).length) return;
      var k = String(f.head || '').toUpperCase(), h = heads[f.file]; if (!h) return;
      if (!/^[A-Z%*$?][^\s\u0000-\u001f]*$/.test(k) || /^[+-]?\d+\.?$/.test(k)) return;
      if (h[k]) h[k].count++; else { h[k] = { n: f.line, text: k, count: 1 }; load[f.file].push(h[k]); }
    });
    load.forEach(function (l) { l.sort(function (x, y) { return y.count - x.count; }); });
    return { rs: rs, load: load, show: function (r) { return callable(b.sym[r.name]); } };
  }

  SW.BENCH.functional = {
    word: 'function',
    startTitle: 'The main loop',
    startLede: function (b, e) {
      return 'The function ' + SW.esc(SW.BENCH.entry) + ' in ' + SW.esc(fileName(b, e.p)) + ', which the top level runs: each time round, the functions its body calls (→) or names for EVAL or APPLY to call (‘), in the order of its lines, with the part of the system each belongs to and what it calls in turn. Click a name to read it.';
    },
    analyse: analyse,
    partOf: function (b, p) {
      var pt = O().partOf(b.parts[p].src);
      if (pt === O().OTHER) return { id: 'other', label: 'Other files', short: 'Other', colour: '#5b5f66' };
      return { id: pt[0], label: pt[1], short: SHORT[pt[0]], colour: pt[3] };
    },
    // what the files of a part define, by kind
    defines: function (b, ps) {
      var K = root.LispIndex.KIND_LABEL, kinds = {};
      b.asm.symbols.forEach(function (s) { if (s.defs.length && ps.indexOf(s.defs[0].file) >= 0) s.kinds.forEach(function (k) { kinds[k] = (kinds[k] || 0) + 1; }); });
      return Object.keys(kinds).sort(function (a, z) { return kinds[z] - kinds[a]; }).map(function (k) { var n = kinds[k], w = K[k] || k; return n + ' ' + (n === 1 ? w : w === 'property' ? 'properties' : w + 's'); }).join(', ');
    },
    // a function's name with your name and mark from the Dynamic Profile, if any
    label: function (b, name) {
      var T = O().tracer(), nm = T.name(b.v.id, name), mk = T.mark(b.v.id, name);
      return (mk ? '<i class="fo-mk" style="background:' + T.markHex(mk) + '"></i>' : '') + (nm ? SW.esc(nm) + ' <span class="faint mono">(' + SW.esc(name) + ')</span>' : '<span class="mono">' + SW.esc(name) + '</span>');
    },
    // the arguments PARSEVAL is given (SETQ PARSEARGS ...), as the files have them
    note: function (b) {
      var pa = null;
      b.lines.forEach(function (ls, p) { ls.forEach(function (L) { if (!pa && /^\(SETQ PARSEARGS\b/i.test(L.raw.trim())) pa = { p: p, n: L.n, raw: L.raw.trim() }; }); });
      return pa ? '<p class="hint">PARSEVAL is given PARSEARGS, set at load in ' + SW.esc(fileName(b, pa.p)) + ' (<a href="#" data-go="' + pa.p + ':' + pa.n + '">line ' + pa.n + '</a>): <code>' + SW.esc(pa.raw) + '</code></p>' : '';
    }
  };
})(this);
