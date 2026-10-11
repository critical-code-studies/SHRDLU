/*
 * functional.js - a functional overview of a version, for a programmer (Program ▸ Functional
 * overview), read from the source as the bench indexes it (js/lisp.js), not recorded: what the
 * top level does each time round its loop (the function SHRDLU, in syscom), what loading each
 * file does besides defining, the parts of the system (as the Dynamic Profile groups the files)
 * with what each defines and which of its functions the other parts call, and the calls between
 * the parts. A call is a defined name in the first place of a form; a name a function quotes,
 * for EVAL or APPLY to call, is shown as named. Micro-Planner reaches theorems by pattern
 * (THGOAL), not by name, so they are not counted as called. Names and marks given in the Dynamic
 * Profile are shown here too.
 */
(function (root) {
  'use strict';
  var SW = root.SW, F = SW.functional = {};
  var ENTRY = 'SHRDLU';   // the top level's function: (DEFUN SHRDLU NIL ...) in syscom

  function O() { return SW.overview; }
  function partOf(b, p) { var pt = O().partOf(b.parts[p].src); return pt === O().OTHER ? ['other', 'Other files', [], '#5b5f66'] : pt; }
  function fileName(b, p) { return b.parts[p].src.split('/').pop(); }
  function card(title, lede) { var c = SW.el('div', { class: 'card' }); c.innerHTML = '<h3>' + SW.esc(title) + '</h3>' + (lede ? '<p class="lede">' + lede + '</p>' : ''); return c; }
  function wide(c) { c.style.gridColumn = '1 / -1'; return c; }
  function chip(pt) { return '<i class="fo-chip" style="background:' + pt[3] + '"></i>'; }
  function at(b, p, n) { return { html: '<a href="#" data-go="' + p + ':' + n + '">' + SW.esc(fileName(b, p) + ':' + n) + '</a>', sort: p * 100000 + n, text: fileName(b, p) + ':' + n }; }

  // the definition of a name that is a function (or anything callable), and its part
  function defOf(b, name) { var s = b.sym[name]; return s && s.defs.length ? s.defs[0] : null; }
  function fnKinds(s) { return s && s.kinds.some(function (k) { return k !== 'VAR' && k !== 'PROP' && k !== 'WORD' && k !== 'THEOREM'; }); }
  // a function's name with your name and mark from the Dynamic Profile, if any
  function label(b, name) {
    var T = O().tracer(), nm = T.name(b.v.id, name), mk = T.mark(b.v.id, name);
    return (mk ? '<i class="fo-mk" style="background:' + T.markHex(mk) + '"></i>' : '') + (nm ? SW.esc(nm) + ' <span class="faint mono">(' + SW.esc(name) + ')</span>' : '<span class="mono">' + SW.esc(name) + '</span>');
  }

  // What a function's body calls and names, in the order of its lines: defined names only.
  // A name is called where it heads a form; named where the body quotes it, or a form it
  // heads ('NAME, '(NAME …), (QUOTE NAME)), for EVAL, APPLY or another function to call. T and NIL are left out: at the head of a COND
  // clause they are tests, not calls.
  var SKIP = { T: 1, NIL: 1 };
  function quoted(raw, name) {
    var n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp("(^|[\\s(])'\\(?" + n + '(?![A-Za-z0-9*?$-])|\\(QUOTE\\s+\\(?' + n + '(?![A-Za-z0-9*?$-])', 'i').test(raw || '');
  }
  function bodyOf(b, name) {
    var d = defOf(b, name); if (!d) return [];
    var out = [], uses = b.asm.uses;
    Object.keys(uses).forEach(function (a) {
      if (a === name || SKIP[a] || !b.sym[a] || !fnKinds(b.sym[a])) return;
      var call = null, named = null;
      uses[a].forEach(function (u) {
        if (u.owner !== name || u.file !== d.file || u.line < d.line || u.line > d.end) return;
        if (u.call) { if (call == null || u.line < call) call = u.line; }
        else if ((named == null || u.line < named) && quoted((b.lines[u.file][u.line - 1] || {}).raw, a)) named = u.line;
      });
      if (call != null) out.push({ name: a, line: call, call: true });
      else if (named != null) out.push({ name: a, line: named, call: false });
    });
    return out.sort(function (x, y) { return x.line - y.line || (x.name < y.name ? -1 : 1); });
  }

  // ---------- the main loop ----------
  function mainLoop(b, el, rows) {
    var d = defOf(b, ENTRY);
    var c = wide(card('The main loop', d ? 'The function ' + ENTRY + ' in ' + SW.esc(fileName(b, d.file)) + ', which the top level runs: each time round, the functions its body calls (→) or names for EVAL or APPLY to call (‘), in the order of its lines, with the part of the system each belongs to and what it calls in turn. Click a name to read it.' : ''));
    if (!d) { c.insertAdjacentHTML('beforeend', '<p class="hint">' + SW.esc(b.v.label) + ' defines no function ' + ENTRY + '.</p>'); el.appendChild(c); return; }
    var steps = bodyOf(b, ENTRY);
    // the arguments PARSEVAL is given (SETQ PARSEARGS ...), as the files have them
    var pa = null;
    b.lines.forEach(function (ls, p) { ls.forEach(function (L) { if (!pa && /^\(SETQ PARSEARGS\b/i.test(L.raw.trim())) pa = { p: p, n: L.n, raw: L.raw.trim() }; }); });
    var h = '<ol class="fo-loop">' + steps.map(function (s) {
      var sd = defOf(b, s.name), pt = partOf(b, sd.file), next = bodyOf(b, s.name);
      rows.push([String(s.line), s.name, s.call ? 'calls' : 'names', pt[1], fileName(b, sd.file) + ':' + sd.line, next.map(function (x) { return (x.call ? '' : '‘') + x.name; }).join(' ')]);
      return '<li><span class="fo-ln"><a href="#" data-go="' + d.file + ':' + s.line + '" title="Where ' + ENTRY + ' ' + (s.call ? 'calls' : 'names') + ' it">' + s.line + '</a></span>' +
        '<span class="fo-how" title="' + (s.call ? 'Called' : 'Named, for EVAL or APPLY to call') + '">' + (s.call ? '→' : '‘') + '</span>' +
        '<a href="#" data-go="' + sd.file + ':' + sd.line + '" class="fo-fn">' + label(b, s.name) + '</a> ' + chip(pt) + '<span class="faint">' + SW.esc(pt[1]) + '</span>' +
        (next.length ? '<div class="fo-next">' + next.slice(0, 14).map(function (x) { var xd = defOf(b, x.name); return '<a href="#" data-go="' + xd.file + ':' + xd.line + '" title="' + SW.esc(partOf(b, xd.file)[1]) + '">' + (x.call ? '' : '‘') + SW.esc(x.name) + '</a>'; }).join(' ') + (next.length > 14 ? ' <span class="faint">+' + (next.length - 14) + ' more</span>' : '') + '</div>' : '') + '</li>';
    }).join('') + '</ol>';
    if (pa) h += '<p class="hint">PARSEVAL is given PARSEARGS, set at load in ' + SW.esc(fileName(b, pa.p)) + ' (<a href="#" data-go="' + pa.p + ':' + pa.n + '">line ' + pa.n + '</a>): <code>' + SW.esc(pa.raw) + '</code></p>';
    c.insertAdjacentHTML('beforeend', h);
    el.appendChild(c);
  }

  // ---------- start-up ----------
  // Each file in the loader's order: what it defines, and the forms it runs as it is loaded
  // (anything at top level that defines nothing, or sets a global).
  function startUp(b, el, rows) {
    var byFile = b.parts.map(function () { return { defs: 0, run: [] }; });
    b.asm.forms.forEach(function (f) {
      var x = byFile[f.file]; if (!x) return;
      var defsFn = f.defs.filter(function (d) { return d.kind !== 'VAR'; }).length;
      if (defsFn) x.defs++; else x.run.push(f);
    });
    var c = wide(card('Start-up', 'The files in the order the loader reads them, each with the part of the system it belongs to, what it defines, and the forms it runs as it is loaded: globals set (SETQ), declarations, and calls made at load. Click a form to read it.'));
    var h = '<table class="data fo-start"><thead><tr><th>#</th><th>File</th><th>Part</th><th>Definitions</th><th>Run at load</th></tr></thead><tbody>' + b.parts.map(function (pt, p) {
      if (pt.role === 'doc') return '';
      var x = byFile[p], part = partOf(b, p), heads = {};
      x.run.forEach(function (f) { var k = String(f.head || '').toUpperCase(); if (!/^[A-Z%*$?][^\s\u0000-\u001f]*$/.test(k) || /^[+-]?\d+\.?$/.test(k)) return; (heads[k] = heads[k] || []).push(f); });
      var runH = Object.keys(heads).sort(function (a, z) { return heads[z].length - heads[a].length; }).map(function (k) {
        var f0 = heads[k][0];
        return '<a href="#" data-go="' + p + ':' + f0.line + '" title="The first at line ' + f0.line + '">' + SW.esc(k) + '</a>' + (heads[k].length > 1 ? ' ×' + heads[k].length : '');
      }).join(', ');
      rows.push([String(p + 1), fileName(b, p), part[1], String(x.defs), Object.keys(heads).map(function (k) { return k + (heads[k].length > 1 ? ' ×' + heads[k].length : ''); }).join(', ')]);
      return '<tr><td class="num">' + (p + 1) + '</td><td class="mono">' + SW.esc(fileName(b, p)) + (pt.role !== 'program' ? ' <span class="faint">(' + SW.esc(pt.role) + ')</span>' : '') + '</td><td>' + chip(part) + SW.esc(part[1]) + '</td><td class="num">' + x.defs + '</td><td class="mono fo-run">' + (runH || '<span class="faint">nothing</span>') + '</td></tr>';
    }).join('') + '</tbody></table>';
    c.insertAdjacentHTML('beforeend', h);
    el.appendChild(c);
  }

  // ---------- the parts, and the calls between them ----------
  function partsAndCalls(b, el, prow, crow) {
    var PARTS = O().PARTS.concat([['other', 'Other files', [], '#5b5f66']]);
    var partOfName = {}, kinds = {}, into = {}, pairs = {};
    b.asm.symbols.forEach(function (s) {
      if (!s.defs.length) return;
      var pt = partOf(b, s.defs[0].file);
      partOfName[s.name] = pt[0];
      var k = kinds[pt[0]] = kinds[pt[0]] || {};
      s.kinds.forEach(function (x) { k[x] = (k[x] || 0) + 1; });
    });
    var calls = b.asm.calls;
    Object.keys(calls).forEach(function (f) {
      var pf = partOfName[f]; if (!pf) return;
      Object.keys(calls[f]).forEach(function (g) {
        var pg = partOfName[g]; if (!pg || !fnKinds(b.sym[g])) return;
        var key = pf + '>' + pg; (pairs[key] = pairs[key] || []).push([f, g, calls[f][g]]);
        if (pf !== pg) { var e = into[g] = into[g] || {}; e[f] = 1; }
      });
    });
    var SHORT = { top: 'Top level', read: 'Reading', parse: 'Parsing', dict: 'Dictionary', sem: 'Semantics', ans: 'Answering', plnr: 'Micro-Planner', world: 'Blocks world', disp: 'Display', other: 'Other' };
    function short(pt) { return SHORT[pt[0]] || pt[1]; }
    var K = root.LispIndex.KIND_LABEL, present = PARTS.filter(function (pt) { return kinds[pt[0]]; });
    // the parts
    var pc = wide(card('The parts of the system', 'The files grouped as the Dynamic Profile groups them, with what each part defines and its entry points: its functions called from other parts, by how many outside functions call them.'));
    var ph = '<table class="data"><thead><tr><th>Part</th><th>Files</th><th>Defines</th><th>Entry points</th></tr></thead><tbody>' + present.map(function (pt) {
      var files = b.parts.map(function (x, p) { return partOf(b, p)[0] === pt[0] && x.role !== 'doc' ? fileName(b, p) : null; }).filter(Boolean);
      var defs = Object.keys(kinds[pt[0]]).sort(function (a, z) { return kinds[pt[0]][z] - kinds[pt[0]][a]; }).map(function (k) { var n = kinds[pt[0]][k], w = K[k] || k; return n + ' ' + (n === 1 ? w : w === 'property' ? 'properties' : w + 's'); }).join(', ');
      var entries = Object.keys(into).filter(function (g) { return partOfName[g] === pt[0]; }).sort(function (a, z) { return Object.keys(into[z]).length - Object.keys(into[a]).length; });
      prow.push([pt[1], files.join(' '), defs, entries.slice(0, 8).map(function (g) { return g + ' (' + Object.keys(into[g]).length + ')'; }).join(', ')]);
      return '<tr><td>' + chip(pt) + SW.esc(pt[1]) + '</td><td class="mono">' + SW.esc(files.join(' ')) + '</td><td>' + SW.esc(defs) + '</td><td class="mono">' + (entries.slice(0, 8).map(function (g) { var d = defOf(b, g); return '<a href="#" data-go="' + d.file + ':' + d.line + '" title="Called from ' + Object.keys(into[g]).length + ' functions in other parts">' + label(b, g) + '</a>'; }).join(', ') || '<span class="faint">none</span>') + (entries.length > 8 ? ' <span class="faint">+' + (entries.length - 8) + '</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
    pc.insertAdjacentHTML('beforeend', ph);
    el.appendChild(pc);
    // the matrix of calls between parts
    var mc = wide(card('Calls between the parts', 'Each row a part calling, each column a part called: the number of distinct calls from a function of one to a function of the other (a call made many times counts once). Click a number for the calls.'));
    var mh = '<table class="data fo-matrix"><thead><tr><th>calls ▸</th>' + present.map(function (pt) { return '<th title="' + SW.esc(pt[1]) + '">' + chip(pt) + SW.esc(short(pt)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      present.map(function (a) {
        return '<tr><th title="' + SW.esc(a[1]) + '">' + chip(a) + SW.esc(short(a)) + '</th>' + present.map(function (z) {
          var l = pairs[a[0] + '>' + z[0]] || [];
          if (l.length) crow.push([a[1], z[1], String(l.length)]);
          return '<td class="num' + (a === z ? ' fo-self' : '') + '">' + (l.length ? '<button class="fo-cell" data-pair="' + a[0] + '>' + z[0] + '">' + l.length + '</button>' : '') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table><div class="fo-pairs"></div>';
    mc.insertAdjacentHTML('beforeend', mh);
    mc.addEventListener('click', function (e) {
      var cell = e.target.closest('[data-pair]'); if (!cell) return;
      SW.$$('.fo-cell.on', mc).forEach(function (x) { x.classList.remove('on'); }); cell.classList.add('on');
      var ab = cell.dataset.pair.split('>'), pa = PARTS.filter(function (x) { return x[0] === ab[0]; })[0], pz = PARTS.filter(function (x) { return x[0] === ab[1]; })[0];
      var list = (pairs[cell.dataset.pair] || []).slice().sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : 1; });
      var box = SW.$('.fo-pairs', mc); box.innerHTML = '<h4>' + SW.esc(pa[1]) + ' calling ' + SW.esc(pz[1]) + ' (' + list.length + ')</h4>';
      box.appendChild(SW.table(['Caller', 'Where', 'Calls', 'Where', 'Call sites'], list.map(function (r) { var df = defOf(b, r[0]), dg = defOf(b, r[1]); return [r[0], at(b, df.file, df.line), r[1], at(b, dg.file, dg.line), r[2]]; }), { cls: ['mono', 'mono', 'mono', 'mono', 'num'] }));
    });
    el.appendChild(mc);
  }

  F.render = function (b, el) {
    var loop = [], start = [], prow = [], crow = [];
    el.classList.add('fo');
    mainLoop(b, el, loop);
    startUp(b, el, start);
    partsAndCalls(b, el, prow, crow);
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]'); if (!a) return;
      e.preventDefault(); var x = a.dataset.go.split(':'), p = +x[0], n = +x[1];
      SW.state.sel = { p: p, n0: n, n1: n }; SW.setTab('read'); SW.emit('goto', { p: p, n: n, tab: 'read' });
    });
    return function () {
      return [SW.tableBlock('The main loop: what ' + ENTRY + ' calls (→) and names (‘), in order', ['Line', 'Function', 'How', 'Part', 'Defined at', 'Which calls'], loop),
              SW.tableBlock('Start-up: the files in the loader’s order', ['#', 'File', 'Part', 'Definitions', 'Run at load'], start),
              SW.tableBlock('The parts of the system', ['Part', 'Files', 'Defines', 'Entry points (outside callers)'], prow),
              SW.tableBlock('Calls between the parts (distinct calls)', ['Calling', 'Called', 'Calls'], crow)];
    };
  };
})(this);
