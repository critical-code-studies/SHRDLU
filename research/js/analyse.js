/*
 * analyse.js - lenses on a version of SHRDLU: critical readings and maps of
 * the program, drawn in bench-kit's Analyse view (kit/lenses.js), which gives
 * each its heading, menu, modes and export. Also this bench's items in the tab
 * row's menus (Versions, Help, Graphics).
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, K = root.LispIndex.KIND_LABEL;
  var bioName = SW.store.get('an.bio', 'THGOAL');

  var LENSES = [
    [1, 'Comments', 'Every comment, searchable'],
    [2, 'Hands and dates', 'Names, initials and dates written into the files'],
    [3, 'Lexicon', 'Every name the program defines'],
    [4, 'Files', 'The files the loader reads, and what each holds'],
    [5, 'Calls', 'Which definitions call which'],
    [6, 'Theorems', 'The Micro-Planner theorems of the blocks world'],
    [7, 'Symbol histories', 'One name across the versions'],
    [8, 'Absence', 'Gaps in the record, and damage in the texts'],
    [9, 'Dynamic Profile', 'An exchange recorded: the parts of the program in time, where the steps go, the functions called, named and marked'],
    [10, 'Functional overview', 'Read from the source: the main loop, start-up, the parts of the system and the calls between them']
  ];

  function fileName(b, p) { return b.parts[p].src.split('/').pop(); }
  function goto(p, n) { SW.state.sel = { p: p, n0: n, n1: n }; SW.setTab('read'); SW.emit('goto', { p: p, n: n, tab: 'read' }); }
  var card = SW.lenses.card, wide = SW.lenses.wide, bars = SW.lenses.bars;   // kit/lenses.js
  function where(b, p, n) { return { html: '<a href="#" data-go="' + p + ':' + n + '">' + SW.esc(fileName(b, p) + ':' + n) + '</a>', sort: p * 100000 + n, text: fileName(b, p) + ':' + n }; }
  function linkRows(el) {
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]'); if (!a) return;
      e.preventDefault(); var x = a.dataset.go.split(':'); goto(+x[0], +x[1]);
    });
  }
  var STOP = { THE: 1, A: 1, OF: 1, TO: 1, AND: 1, IS: 1, IN: 1, FOR: 1, IF: 1, ON: 1, AT: 1, BY: 1, IT: 1, BE: 1, OR: 1, AS: 1, FROM: 1, WITH: 1, THIS: 1, THAT: 1, NOT: 1, NO: 1, AN: 1, ARE: 1, WE: 1, ITS: 1, SO: 1 };

  // every comment of the program and support files, with where it is
  function commentsOf(b) {
    var out = [];
    (b.asm ? b.asm.comments : []).forEach(function (cs, p) {
      if (b.parts[p].role === 'doc') return;
      cs.forEach(function (c) { var t = c.text.replace(/^;+\s*/, '').trim(); if (t) out.push({ p: p, n: c.line, c: t }); });
    });
    return out;
  }

  // ---------- 1 comments ----------
  var FNS = {}, XFNS = {};
  FNS[1] = function (b, el) {
    var items = commentsOf(b), q = SW.store.get('an.cq', '');
    var c = wide(card('Comments', items.length + ' comments in the program and support files. Search them (keyword in context); click a row to read it in place.'));
    var inp = SW.el('input', { type: 'search', placeholder: 'Find in comments…', value: q, style: 'width:260px' });
    var list = SW.el('div', { class: 'kwic' });
    function draw() {
      var s = inp.value.trim().toUpperCase(); SW.store.set('an.cq', inp.value);
      var h = [];
      items.forEach(function (x) {
        var t = x.c, idx = s ? t.toUpperCase().indexOf(s) : 0;
        if (s && idx < 0) return;
        var l = s ? t.slice(Math.max(0, idx - 60), idx) : '', k = s ? t.slice(idx, idx + s.length) : '', r = s ? t.slice(idx + s.length, idx + s.length + 70) : t.slice(0, 130);
        if (h.length < 1500) h.push('<div class="kw" data-go="' + x.p + ':' + x.n + '"><span class="kn">' + SW.esc(fileName(b, x.p) + ':' + x.n) + '</span><span class="kl">' + SW.esc(l) + '</span><span class="k">' + SW.esc(k) + '</span><span class="kr">' + SW.esc(r) + '</span></div>');
      });
      list.innerHTML = h.join('') || '<p class="hint">No comment matches.</p>';
    }
    inp.oninput = draw;
    c.appendChild(inp); c.appendChild(list); el.appendChild(c); draw();
    linkRows(list);
    var words = {};
    items.forEach(function (x) { x.c.toUpperCase().split(/[^A-Z']+/).forEach(function (w) { if (w.length > 2 && !STOP[w]) words[w] = (words[w] || 0) + 1; }); });
    var top = Object.keys(words).sort(function (a, c2) { return words[c2] - words[a]; }).slice(0, 30).map(function (w) { return [w, words[w]]; });
    var wc = card('The words of the comments', 'The most frequent words, less the commonest English ones.');
    wc.insertAdjacentHTML('beforeend', bars(top));
    el.appendChild(wc);
    var per = b.parts.map(function (pt, p) { return [fileName(b, p), items.filter(function (x) { return x.p === p; }).length]; }).filter(function (r) { return r[1]; });
    var pc = card('Comments by file', 'How much each file says about itself.');
    pc.insertAdjacentHTML('beforeend', bars(per));
    el.appendChild(pc);
    return function () { return [SW.tableBlock('Comments' + (inp.value ? ' containing “' + inp.value + '”' : ''), ['Where', 'Comment'], items.filter(function (x) { return !inp.value || x.c.toUpperCase().indexOf(inp.value.toUpperCase()) >= 0; }).map(function (x) { return [fileName(b, x.p) + ':' + x.n, x.c]; }))]; };
  };
  XFNS[1] = function (vs, bs, el) {
    var rows = vs.map(function (v, i) { return [v.label, commentsOf(bs[i]).length, bs[i].lines.reduce(function (s, ls, p) { return s + (bs[i].parts[p].role === 'doc' ? 0 : ls.length); }, 0)]; });
    var c = wide(card('Comments across the versions', 'How many comments each version’s program and support files carry, against their length.'));
    c.appendChild(SW.table(['Version', 'Comments', 'Lines'], rows));
    el.appendChild(c);
    return function () { return [SW.tableBlock('Comments by version', ['Version', 'Comments', 'Lines'], rows)]; };
  };

  // ---------- 2 hands and dates ----------
  var DATE = /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|(19|20)\d\d-\d\d-\d\d|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.? *\d{0,2},? *(19|20)?\d\d)\b/i;
  FNS[2] = function (b, el) {
    var rows = [];
    b.lines.forEach(function (ls, p) {
      if (b.parts[p].role === 'doc') return;
      ls.forEach(function (L) {
        var hands = SW.handsIn(L.raw), d = DATE.exec(L.raw);
        if (!hands.length && !d) return;
        rows.push([where(b, p, L.n), hands.map(function (k) { return SW.handOf(k).who; }).join(', '), d ? d[0] : '', L.raw.trim().slice(0, 110)]);
      });
    });
    var c = wide(card('Hands and dates', 'Lines that name a person (by name or initials) or carry a date. The hands the bench knows: ' + SW.HANDS.map(function (h) { return h.who; }).join('; ') + '.'));
    c.appendChild(SW.table(['Where', 'Hand', 'Date', 'Line'], rows, { cls: ['mono', '', 'mono', 'mono'] }));
    el.appendChild(c); linkRows(c);
    return function () { return [SW.tableBlock('Hands and dates', ['Where', 'Hand', 'Date', 'Line'], rows)]; };
  };

  // ---------- 3 lexicon ----------
  function lexRows(b, kind) {
    return (b.asm ? b.asm.symbols : []).filter(function (s) { return !kind || s.kinds.indexOf(kind) >= 0; }).map(function (s) {
      var d = s.defs[0];
      return [{ html: '<a href="#" data-go="' + d.file + ':' + d.line + '" class="mono">' + SW.esc(s.name) + '</a>', sort: s.name, text: s.name },
        s.kinds.map(function (k) { return K[k] || k; }).join(', '), s.refs.length, where(b, d.file, d.line), s.defs.length > 1 ? s.defs.length : ''];
    });
  }
  FNS[3] = function (b, el) {
    var kinds = {};
    b.asm.symbols.forEach(function (s) { s.kinds.forEach(function (k) { kinds[k] = (kinds[k] || 0) + 1; }); });
    var kc = card('What the program defines', b.asm.symbols.length + ' names are defined in this version’s files.');
    kc.insertAdjacentHTML('beforeend', bars(Object.keys(kinds).sort(function (a, c) { return kinds[c] - kinds[a]; }).map(function (k) { return [K[k] || k, kinds[k]]; })));
    el.appendChild(kc);
    var pick = SW.store.get('an.lexkind', '');
    var c = wide(card('The lexicon', 'Every defined name: its kind, how often it is used elsewhere, and where it is defined. Click a column to sort, a name to read its definition.'));
    var sel = SW.el('select', {}, '<option value="">every kind</option>' + Object.keys(kinds).map(function (k) { return '<option value="' + k + '"' + (k === pick ? ' selected' : '') + '>' + SW.esc(K[k] || k) + '</option>'; }).join(''));
    var host = SW.el('div');
    function draw() { host.innerHTML = ''; host.appendChild(SW.table(['Name', 'Kind', 'Uses', 'Defined at', 'Times defined'], lexRows(b, sel.value), { cls: ['mono', '', 'num', 'mono', 'num'] })); }
    sel.onchange = function () { SW.store.set('an.lexkind', sel.value); draw(); };
    var lab = SW.el('label', { class: 'check' }, 'Show '); lab.appendChild(sel);
    c.appendChild(lab); c.appendChild(host); el.appendChild(c); linkRows(c); draw();
    var twice = b.asm.symbols.filter(function (s) { return s.defs.length > 1; });
    if (twice.length) {
      var t = card('Defined more than once', twice.length + ' names are defined in more than one place; when the files are loaded, the one read last is the one that holds.');
      t.appendChild(SW.table(['Name', 'Where'], twice.map(function (s) { return [s.name, { html: s.defs.map(function (d) { return '<a href="#" data-go="' + d.file + ':' + d.line + '">' + SW.esc(fileName(b, d.file) + ':' + d.line) + '</a>'; }).join(', '), text: s.defs.map(function (d) { return fileName(b, d.file) + ':' + d.line; }).join(', ') }]; }), { cls: ['mono', 'mono'] }));
      el.appendChild(t); linkRows(t);
    }
    return function () { return [SW.tableBlock('Lexicon', ['Name', 'Kind', 'Uses', 'Defined at', 'Times defined'], lexRows(b, sel.value))]; };
  };
  XFNS[3] = function (vs, bs, el) {
    var names = {};
    bs.forEach(function (b, i) { (b.asm ? b.asm.symbols : []).forEach(function (s) { (names[s.name] = names[s.name] || { kinds: s.kinds, in: {} }).in[i] = 1; }); });
    var keys = Object.keys(names).sort();
    var notAll = keys.filter(function (k) { return Object.keys(names[k].in).length < bs.length; });
    var rows = notAll.map(function (k) { return [k, names[k].kinds.map(function (x) { return K[x] || x; }).join(', ')].concat(bs.map(function (b, i) { return names[k].in[i] ? '●' : ''; })); });
    var c = wide(card('Names not in every version', keys.length + ' names are defined across the versions held; ' + notAll.length + ' of them are missing from at least one. ● marks the versions that define a name.'));
    c.appendChild(SW.table(['Name', 'Kind'].concat(vs.map(function (v) { return SW.refOf(v.id); })), rows, { cls: ['mono', ''] }));
    el.appendChild(c);
    return function () { return [SW.tableBlock('Names not in every version', ['Name', 'Kind'].concat(vs.map(function (v) { return SW.refOf(v.id); })), rows)]; };
  };

  // ---------- 4 files ----------
  function fileRows(b) {
    return b.parts.map(function (pt, p) {
      var byKind = {};
      b.asm.forms.forEach(function (f) { if (f.file === p) f.defs.forEach(function (d) { byKind[d.kind] = (byKind[d.kind] || 0) + 1; }); });
      return [{ html: '<a href="#" data-go="' + p + ':1" class="mono">' + SW.esc(fileName(b, p)) + '</a>', sort: p, text: fileName(b, p) }, pt.role, b.lines[p].length,
        pt.role === 'doc' ? '' : b.asm.forms.filter(function (f) { return f.file === p; }).length,
        Object.keys(byKind).map(function (k) { return byKind[k] + ' ' + (K[k] || k); }).join(', '), pt.role === 'doc' ? '' : b.asm.comments[p].length];
    });
  }
  FNS[4] = function (b, el) {
    var rows = fileRows(b);
    var c = wide(card('The files', 'In the order the loader reads them (LOADSHRDLU in “loader”): Micro-Planner, the system, the grammar and dictionary, the semantics, answering, the blocks world. Top-level forms, what they define, and comment lines.'));
    c.appendChild(SW.table(['File', 'Role', 'Lines', 'Forms', 'Defines', 'Comment lines'], rows, { cls: ['mono', '', 'num', 'num', '', 'num'] }));
    el.appendChild(c); linkRows(c);
    var lc = card('Lines by file', 'Program and support files.');
    lc.insertAdjacentHTML('beforeend', bars(b.parts.map(function (pt, p) { return pt.role === 'doc' ? null : [fileName(b, p), b.lines[p].length]; }).filter(Boolean)));
    el.appendChild(lc);
    return function () { return [SW.tableBlock('The files of ' + b.v.label, ['File', 'Role', 'Lines', 'Forms', 'Defines', 'Comment lines'], rows)]; };
  };
  XFNS[4] = function (vs, bs, el) {
    var stems = {};
    function stem(src) { return src.split('/').pop().replace(/\.\d+$/, '').replace(/^demo\.flick$/, 'demo'); }
    bs.forEach(function (b, i) { b.parts.forEach(function (pt, p) { (stems[stem(pt.src)] = stems[stem(pt.src)] || {})[i] = b.lines[p].length; }); });
    var rows = Object.keys(stems).sort().map(function (s) { return [s].concat(bs.map(function (b, i) { return stems[s][i] != null ? stems[s][i] : ''; })); });
    var c = wide(card('The files across the versions', 'Each file by its name without the ITS version number, and its length in lines in each version (blank: not held there).'));
    c.appendChild(SW.table(['File'].concat(vs.map(function (v) { return SW.refOf(v.id); })), rows, { cls: ['mono'] }));
    el.appendChild(c);
    return function () { return [SW.tableBlock('Files by version', ['File'].concat(vs.map(function (v) { return SW.refOf(v.id); })), rows)]; };
  };

  // ---------- 5 calls ----------
  FNS[5] = function (b, el) {
    var calls = b.asm.calls, defined = b.sym, into = {};
    Object.keys(calls).forEach(function (f) { Object.keys(calls[f]).forEach(function (g) { if (defined[g]) into[g] = (into[g] || 0) + calls[f][g]; }); });
    var top = Object.keys(into).sort(function (a, c) { return into[c] - into[a]; }).slice(0, 30).map(function (k) { return [k, into[k]]; });
    var tc = card('Most called', 'Call sites of each definition, across this version’s files (a call is a name in the first place of a form).');
    tc.insertAdjacentHTML('beforeend', bars(top));
    el.appendChild(tc);
    var out = Object.keys(calls).filter(function (f) { return defined[f]; }).map(function (f) { return [f, Object.keys(calls[f]).filter(function (g) { return defined[g]; }).length]; }).sort(function (a, c) { return c[1] - a[1]; }).slice(0, 30);
    var oc = card('Calling most', 'Definitions that call the most other definitions of the program.');
    oc.insertAdjacentHTML('beforeend', bars(out));
    el.appendChild(oc);
    var rows = [];
    Object.keys(calls).forEach(function (f) { if (!defined[f]) return; Object.keys(calls[f]).forEach(function (g) { if (defined[g]) rows.push([f, g, calls[f][g]]); }); });
    var c = wide(card('Every call between definitions', rows.length + ' pairs. Sort by caller, callee or count.'));
    c.appendChild(SW.table(['Caller', 'Calls', 'Times'], rows, { cls: ['mono', 'mono', 'num'] }));
    el.appendChild(c);
    return function () { return [SW.tableBlock('Calls between definitions', ['Caller', 'Calls', 'Times'], rows)]; };
  };

  // ---------- 6 theorems ----------
  // The pattern of a theorem: the form after its variable list, found by
  // counting parentheses (variable lists nest: (X Y (WHY (EV)) EV)).
  function theoremPattern(txt) {
    var m = /\((THCONSE|THANTE|THERASING)\b/.exec(txt); if (!m) return '';
    var i = m.index + m[0].length, forms = [];
    while (i < txt.length && forms.length < 2) {
      while (/\s/.test(txt[i] || '')) i++;
      if (txt[i] === '(') { var d = 0, j = i; do { if (txt[j] === '(') d++; else if (txt[j] === ')') d--; j++; } while (d > 0 && j < txt.length); forms.push(txt.slice(i, j)); i = j; }
      else if (/[^\s)]/.test(txt[i] || '')) { var k = i; while (k < txt.length && /[^\s()]/.test(txt[k])) k++; forms.push(txt.slice(i, k)); i = k; }
      else break;
    }
    return forms[1] || '';
  }
  FNS[6] = function (b, el) {
    var rows = [];
    b.asm.symbols.forEach(function (s) {
      if (s.kinds.indexOf('THEOREM') < 0) return;
      var d = s.defs.filter(function (x) { return x.kind === 'THEOREM'; })[0];
      var txt = b.lines[d.file].slice(d.line - 1, Math.min(d.end, d.line + 6)).map(function (x) { return SW.parseLine(x.raw).code; }).join(' ');
      var type = (/\((THCONSE|THANTE|THERASING)\b/.exec(txt) || [])[1] || '';
      var pat = theoremPattern(txt);
      rows.push([{ html: '<a href="#" data-go="' + d.file + ':' + d.line + '" class="mono">' + SW.esc(s.name) + '</a>', sort: s.name, text: s.name },
        { THCONSE: 'consequent', THANTE: 'antecedent', THERASING: 'erasing' }[type] || type, pat, s.refs.length, where(b, d.file, d.line)]);
    });
    var c = wide(card('The theorems', rows.length + ' Micro-Planner theorems. A consequent theorem (THCONSE) says how to achieve a goal that matches its pattern; an antecedent theorem (THANTE) runs when a matching assertion is added, an erasing one (THERASING) when one is removed.'));
    c.appendChild(SW.table(['Theorem', 'Kind', 'Pattern', 'Uses', 'Defined at'], rows, { cls: ['mono', '', 'mono', 'num', 'mono'] }));
    el.appendChild(c); linkRows(c);
    return function () { return [SW.tableBlock('Micro-Planner theorems', ['Theorem', 'Kind', 'Pattern', 'Uses', 'Defined at'], rows)]; };
  };

  // ---------- 7 symbol histories ----------
  function biography(b, el) {
    var c = wide(card('The history of a name', 'Follow one name through every version held: where it is defined, how often it is used, and whether its definition changes.'));
    var inp = SW.el('input', { type: 'search', value: bioName, placeholder: 'A name, e.g. SMPOSS2', style: 'width:220px' });
    var out = SW.el('div');
    c.appendChild(inp); c.appendChild(out); el.appendChild(c);
    var rows = [];
    function draw() {
      bioName = inp.value.trim().toUpperCase(); SW.store.set('an.bio', bioName);
      var vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, x) { return a.sort - x.sort; });
      out.innerHTML = '<p class="hint">Reading ' + vs.length + ' versions…</p>';
      Promise.all(vs.map(function (v) { return SW.build(v.id); })).then(function (bs) {
        var prev = null;
        rows = bs.map(function (bb, i) {
          var s = bb.sym[bioName];
          if (!s) return [vs[i].label, SW.refOf(vs[i].id), 'not defined', '', ''];
          var d = s.defs[0], text = bb.lines[d.file].slice(d.line - 1, d.end).map(function (x) { return SW.parseLine(x.raw).code; }).join(' ').replace(/\s+/g, ' ').trim();
          var note = prev == null ? '' : prev === text ? 'the same as in the version above' : 'changed from the version above';
          prev = text;
          return [vs[i].label, SW.refOf(vs[i].id), s.kinds.map(function (k) { return K[k] || k; }).join(', ') + ' at ' + fileName(bb, d.file) + ':' + d.line, s.refs.length, note];
        });
        out.innerHTML = '';
        out.appendChild(SW.table(['Version', 'Reference', 'Defined', 'Uses', 'Its definition'], rows, { cls: ['', 'mono', 'mono', 'num', ''] }));
      });
    }
    inp.onchange = draw; draw();
    return function () { return [SW.tableBlock('The history of ' + bioName, ['Version', 'Reference', 'Defined', 'Uses', 'Its definition'], rows)]; };
  }

  // ---------- 8 absence ----------
  // 9: the Dynamic Profile, recorded as the program runs an exchange (js/overview.js)
  FNS[9] = function (b, el) { SW.overview.render(b, el); return null; };
  FNS[8] = function (b, el) {
    var lost = V.VERSIONS.filter(function (v) { return v.status === 'lost'; });
    var lc = wide(card('Versions known and not held', 'What the record names but the bench cannot read.'));
    lc.insertAdjacentHTML('beforeend', lost.map(function (v) { return '<p><b>' + SW.esc(v.label) + '</b> <span class="faint">(' + SW.esc(v.date) + ')</span><br>' + SW.esc(v.summary) + '</p>'; }).join(''));
    el.appendChild(lc);
    // the repairs register (js/repairs.js), as the reconstruction card has it; gold in Read
    var rrows = (b.repairs || []).map(function (r) {
      var p = -1; if (r.file) b.parts.forEach(function (pt, pi) { if (pt.src.split('/').pop().replace(/\.\d+$/, '').toLowerCase() === r.file.toLowerCase()) p = pi; });
      return [r.id, SW.mendOf(r).label, p >= 0 ? where(b, p, r.n0) : '', r.title + '. ' + r.why, r.evidence, (r.by || '') + (r.date ? ', ' + r.date : '')];
    });
    if (b.v.build) {
      var rc = wide(card('What the bench repairs to run this version', rrows.length ? 'The version’s reconstruction card: corrections and supplied passages (gold in Read), and changes for running (paler gold). Click a place to see it in Read.' : 'No repairs.'));
      if (rrows.length) rc.appendChild(SW.table(['Repair', 'Kind', 'Where', 'What and why', 'Evidence', 'By'], rrows, { cls: ['mono', '', 'mono', '', 'faint', 'faint'] }));
      el.appendChild(rc); linkRows(rc);
    }
    if (b.asm) {
      var ec = wide(card('Parentheses that do not balance in this version', b.asm.errors.length ? 'Places where the text as held cannot be read as whole MacLisp forms: damage, or an edit left unfinished.' : 'None: every file of this version reads as whole forms.'));
      if (b.asm.errors.length) ec.appendChild(SW.table(['Where', 'What'], b.asm.errors.map(function (e) { return [where(b, e.file, e.line), e.message]; }), { cls: ['mono', ''] }));
      el.appendChild(ec); linkRows(ec);
      var ctl = [];
      b.lines.forEach(function (ls, p) { ls.forEach(function (L) { if (/[\u0000-\u0002\u0004-\u0008\u000e-\u001a\u001c-\u001f\u007f]/.test(L.raw)) ctl.push([where(b, p, L.n), L.raw.replace(/[\u0000-\u001f\u007f]/g, function (ch) { return ch === '\t' ? ' ' : '^' + String.fromCharCode(ch.charCodeAt(0) ^ 64); }).trim().slice(0, 100)]); }); });
      var cc = wide(card('Control characters in the text', ctl.length ? ctl.length + ' lines carry control characters other than tabs, page breaks, end-of-file marks, bare carriage returns and ALTMODE (^[, the $ of ITS commands), a sign of damage in copying. Shown as ^H, ^@ and so on; underlined in grey in Read as uncertain readings, left as found.' : 'None beyond tabs, page breaks, end-of-file marks, bare carriage returns and ALTMODE.'));
      if (ctl.length) cc.appendChild(SW.table(['Where', 'Line'], ctl, { cls: ['mono', 'mono'] }));
      el.appendChild(cc); linkRows(cc);
    }
    return function () { return [SW.tableBlock('Absence and damage', ['Version', 'Date', 'Note'], lost.map(function (v) { return [v.label, v.date, v.summary]; }))].concat(rrows.length ? [SW.tableBlock('Repairs made to run this version', ['Repair', 'Kind', 'Where', 'What and why', 'Evidence', 'By'], rrows.map(function (r) { return r.map(function (c) { return c && c.text != null ? c.text : c; }); }))] : []); };
  };

  // ---------- the lenses, for kit/lenses.js ----------
  FNS[7] = biography;
  SW.BENCH.lenses = {
    list: LENSES,
    // in the tab row: Text ▾, Program ▾, and Absence under Versions ▾
    menus: { text: [['', [1, 2, 3, 7]]], program: [['', [10, 9, 4, 5, 6]]], versions: [['', [8]]] },
    picks: { absence: 8 },
    one: FNS, across: XFNS, acrossLabel: 'Across the versions',
    history: { n: 7, title: function () { return 'SHRDLU: the history of the name “' + bioName + '”'; }, file: function () { return 'shrdlu-name-history-' + bioName; } },
    functional: 10,   // kit/functional.js, read as js/functional.js says
    anySource: [7, 8],
    noSource: function (b) { return 'No source survives for ' + SW.esc(b.v.label) + '. Its record is under Versions ▸ This version.'; }
  };

  // ---------- the menus in the tab row (bench-kit's kit/menus.js) ----------
  // Versions ▾ and Help ▾ are the kit's, with this bench's items; the lens menus are
  // kit/lenses.js's, Graphics ▾ kit/graphics.js's.
  SW.BENCH.menus = {
    versions: [['about', 'This version', 'Its record, sources and annotations'],
              ['compare', 'Collate', 'Two versions collated: side by side, as text or by definition'],
              ['genealogy', 'Genealogy', 'How the versions descend'],
              ['absence', 'Absence', 'Gaps in the record, and damage in the texts'],
              ['storage', 'How the files were stored', 'The machines, ITS files, disks and backup tapes, and the path of each copy']],
    // Help ▾: the kit's list, with these lines changed and the project site added
    help: { text: { tour: 'A few stops through the bench; about two minutes',
                    refs: 'How the bench cites a source, as [REF: SHI, plnr.182:120]',
                    paratexts: 'The crew’s scans and documents: collections, views, metadata, links' },
            add: [['The project', ['site', 'The SHRDLU project site', 'critical-code-studies.github.io/SHRDLU']]] },
    pick: function (which, p) {
      if (which === 'versions' && p === 'storage') { location.href = 'storage.html'; return true; }
      return false;
    }
  };
  // a name's history, from elsewhere (the symbol pop-up in Read)
  SW.biography = function (name) { bioName = name; SW.store.set('an.bio', name); SW.forget('analyse'); SW.openLens(7); };
})(this);
