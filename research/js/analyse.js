/*
 * analyse.js - lenses on a version of SHRDLU: critical readings and maps of
 * the program. Each lens is a card set with its own export; the numbering is
 * stable so a lens can be named in discussion ("lens 3"). Also the tab-row
 * drop-down menus (Text, Program, Versions, Help), as on the main site.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, K = root.LispIndex.KIND_LABEL;
  var view = SW.$('#view-analyse');
  var build = null, lens = SW.store.get('an.lens', 1);
  var mode = SW.store.get('an.mode', 'one');
  var bioName = SW.store.get('an.bio', 'THGOAL');

  var LENSES = [
    [1, 'Comments', 'Every comment, searchable'],
    [2, 'Hands and dates', 'Names, initials and dates written into the files'],
    [3, 'Lexicon', 'Every name the program defines'],
    [4, 'Files', 'The files the loader reads, and what each holds'],
    [5, 'Calls', 'Which definitions call which'],
    [6, 'Theorems', 'The Micro-Planner theorems of the blocks world'],
    [7, 'Symbol histories', 'One name across the versions'],
    [8, 'Absence', 'Gaps in the record, and damage in the texts']
  ];
  if (!LENSES[lens - 1]) lens = 1;
  SW.anLens = function () { return lens; };
  SW.anLensName = function () { return LENSES[lens - 1][1]; };
  var ACROSS = { 1: 1, 3: 1, 4: 1 };   // lenses with an across-the-versions mode

  function fileName(b, p) { return b.parts[p].src.split('/').pop(); }
  function goto(p, n) { SW.state.sel = { p: p, n0: n, n1: n }; SW.setTab('read'); SW.emit('goto', { p: p, n: n, tab: 'read' }); }
  function card(title, lede) {
    var c = SW.el('div', { class: 'card' });
    c.innerHTML = '<h3>' + SW.esc(title) + '</h3>' + (lede ? '<p class="lede">' + lede + '</p>' : '');
    return c;
  }
  function wide(c) { c.style.gridColumn = '1 / -1'; return c; }
  function bars(rows, max) {
    max = max || rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 1);
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="b"><span title="' + SW.esc(r[0]) + '">' + SW.esc(r[0]) + '</span><i style="width:' + (100 * r[1] / max).toFixed(1) + '%"></i><em>' + r[1] + '</em></div>';
    }).join('') + '</div>';
  }
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
      b.lines.forEach(function (ls, p) { ls.forEach(function (L) { if (/[\u0000-\u0002\u0004-\u0008\u000e-\u001f\u007f]/.test(L.raw)) ctl.push([where(b, p, L.n), L.raw.replace(/[\u0000-\u001f\u007f]/g, function (ch) { return ch === '\t' ? ' ' : '^' + String.fromCharCode(ch.charCodeAt(0) ^ 64); }).trim().slice(0, 100)]); }); });
      var cc = wide(card('Control characters in the text', ctl.length ? ctl.length + ' lines carry control characters other than tabs, page breaks and end-of-file marks, a sign of damage in copying. Shown as ^H, ^@ and so on.' : 'None beyond tabs, page breaks and end-of-file marks.'));
      if (ctl.length) cc.appendChild(SW.table(['Where', 'Line'], ctl, { cls: ['mono', 'mono'] }));
      el.appendChild(cc); linkRows(cc);
    }
    return function () { return [SW.tableBlock('Absence and damage', ['Version', 'Date', 'Note'], lost.map(function (v) { return [v.label, v.date, v.summary]; }))].concat(rrows.length ? [SW.tableBlock('Repairs made to run this version', ['Repair', 'Kind', 'Where', 'What and why', 'Evidence', 'By'], rrows.map(function (r) { return r.map(function (c) { return c && c.text != null ? c.text : c; }); }))] : []); };
  };

  // ---------- rendering ----------
  var MENUS = { text: [['', [1, 2, 3, 7]]], program: [['', [4, 5, 6]]], versions: [['', [8]]] };
  function menuOf(n) { for (var m in MENUS) if (MENUS[m].some(function (gr) { return gr[1].indexOf(n) >= 0; })) return m; return 'text'; }
  function lensItems(groups, attr, cur) {
    return groups.map(function (gr) {
      return '<div class="lens-g">' + (gr[0] ? '<h5>' + SW.esc(gr[0]) + '</h5>' : '') + gr[1].map(function (n) {
        var l = LENSES[n - 1];
        return '<button ' + attr + '="' + n + '"' + (n === cur ? ' class="on"' : '') + '><b>' + SW.esc(l[1]) + '</b><span>' + SW.esc(l[2]) + '</span></button>';
      }).join('') + '</div>';
    }).join('');
  }
  function expMenu(w) {
    var d = SW.el('details', { class: 'menu exp-menu tb-right' });
    d.innerHTML = '<summary class="btn" title="Export this lens">⤓ Export ▾</summary>';
    var body = SW.el('div', { class: 'menu-body' });
    body.appendChild(w); d.appendChild(body);
    return d;
  }
  function render() {
    var b = build;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad', style: 'max-width:none' });
    var L = LENSES[lens - 1];
    var head = SW.el('div', { class: 'toolbar an-head', style: 'position:static;padding:0 0 10px' });
    var mg = MENUS[menuOf(lens)];
    var across = ACROSS[lens] && mode === 'across';
    head.innerHTML = (mg[0][1].length === 1 ? '<b class="an-title">' + SW.esc(L[1]) + '</b>' :
      '<details class="menu lens-menu"><summary class="btn" title="Choose">' + SW.esc(L[1]) + ' ▾</summary><div class="menu-body lens-list">' + lensItems(mg, 'data-l', lens) + '</div></details>') +
      (ACROSS[lens] ? '<span class="seg-btns"><button class="btn' + (!across ? ' on' : '') + '" data-mode="one">This version</button><button class="btn' + (across ? ' on' : '') + '" data-mode="across">Across the versions</button></span>' : '') +
      '<span class="hint an-desc">' + SW.esc(L[2]) + '.</span>' + (!across && lens !== 7 ? ' <span class="an-ref">' + SW.refTag(b.v.id) + '</span>' : '');
    head.addEventListener('click', function (e) {
      var t = e.target.closest('[data-l]');
      if (t) { lens = +t.dataset.l; SW.store.set('an.lens', lens); SW.writeQuery(); render(); return; }
      var m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; SW.store.set('an.mode', mode); render(); }
    });
    pad.appendChild(head);
    var cards = SW.el('div', { class: 'cards' });
    pad.appendChild(cards);
    view.appendChild(pad);
    SW.markTabs();
    var blocks;
    if (lens === 7) {
      blocks = biography(b, cards);
      head.appendChild(expMenu(SW.exportButtons(function () { return { title: 'SHRDLU: the history of the name “' + bioName + '”', meta: [['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION]], blocks: blocks() }; }, function () { return 'shrdlu-name-history-' + bioName; })));
      return;
    }
    if (across) {
      var vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, x) { return a.sort - x.sort; });
      var wait = SW.el('p', { class: 'hint' }, 'Reading ' + vs.length + ' versions…'); cards.appendChild(wait);
      Promise.all(vs.map(function (v) { return SW.build(v.id); })).then(function (bs) {
        wait.remove();
        var bl = XFNS[lens](vs, bs, cards);
        head.appendChild(expMenu(SW.exportButtons(function () { return { title: 'SHRDLU across the versions: ' + L[1].toLowerCase(), subtitle: L[2], meta: [['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION]], blocks: bl() }; }, 'shrdlu-versions-lens-' + L[0])));
      }).catch(function (e) { wait.textContent = e.message; });
      return;
    }
    if (!b.asm && lens !== 8) { cards.innerHTML = '<p class="hint">No source survives for ' + SW.esc(b.v.label) + '. Its record is under Versions ▸ This version.</p>'; return; }
    blocks = FNS[lens](b, cards);
    if (blocks) head.appendChild(expMenu(SW.exportButtons(function () {
      return { title: b.v.label + ': ' + L[1].toLowerCase(), subtitle: L[2], meta: SW.docMeta(b), blocks: blocks() };
    }, 'shrdlu-' + b.v.id + '-lens-' + L[0])));
  }

  SW.views.analyse = { show: function (b) { build = b; render(); } };

  // ---------- drop-downs in the tab row ----------
  var tabMenu = null;
  function closeTabMenu() { if (!tabMenu) return; tabMenu.el.remove(); tabMenu.btn.setAttribute('aria-expanded', 'false'); tabMenu = null; }
  var VERS = [['about', 'This version', 'Its record, sources and annotations'],
              ['compare', 'Compare', 'Two versions side by side'],
              ['genealogy', 'Genealogy', 'How the versions descend'],
              ['absence', 'Absence', 'Gaps in the record, and damage in the texts'],
              ['storage', 'How the files were stored', 'The machines, ITS files, disks and backup tapes, and the path of each copy']];
  function menuHTML(which) {
    if (which === 'help') {
      var dm = document.querySelector('meta[name="bench-date"]');
      var HELP = [['Getting started', [['tour', 'Take the welcome tour', 'A few stops through the bench; about two minutes'],
                                       ['refs', 'Referencing and versions', 'How the bench cites a source, as [REF: SHI, plnr.182:120]'],
                                       ['reading', 'What you should read', 'Winograd, Micro-Planner, and reading and repairing old code'],
                                       ['cards', 'Reconstruction cards', 'Every repair the bench makes to run each version, marked in gold'],
                                       ['join', 'Joining the annotation group', 'A Hypothesis account, the group and your token, step by step'],
                                       ['anno', 'Advanced annotation', 'Rich text, and links between annotations across versions'],
                                       ['sitemap', 'Site map', 'Every view and version as a plain link']]],
                  ['Your bench', [['settings', 'Settings', 'Initials, group, theme, fonts'],
                                  ['backup', 'Back up everything', 'Notes, drafts, settings and findings in one file'],
                                  ['restore', 'Restore from a backup…', 'Brings back notes and drafts beside those here']]],
                  ['The project', [['site', 'The SHRDLU project site', 'critical-code-studies.github.io/SHRDLU'],
                                   ['code', 'Source code on GitHub ↗', 'github.com/critical-code-studies/SHRDLU'],
                                   ['issue', 'Report a problem ↗', 'GitHub issues'],
                                   ['about', 'About the bench', 'Version, sources, citation']]]];
      return HELP.map(function (g, i) {
        return (i ? '<hr class="menu-rule">' : '') + '<div class="menu-group">' + SW.esc(g[0]) + '</div>' + g[1].map(function (h) {
          return '<button data-pick="' + h[0] + '"><b>' + SW.esc(h[1]) + '</b><span>' + SW.esc(h[2]) + '</span></button>';
        }).join('');
      }).join('') + '<div class="help-ver hint">SHRDLU Research Bench ' + SW.esc(SW.VERSION) + (dm ? ', ' + SW.esc(SW.fmtDate(dm.content)) : '') + '</div>';
    }
    if (which === 'versions') return VERS.map(function (h) {
      var on = h[0] === 'absence' ? SW.state.tab === 'analyse' && lens === 8 : SW.state.tab === h[0];
      return '<button data-pick="' + h[0] + '"' + (on ? ' class="on"' : '') + '><b>' + SW.esc(h[1]) + '</b><span>' + SW.esc(h[2]) + '</span></button>';
    }).join('');
    return lensItems(MENUS[which], 'data-pick', SW.state.tab === 'analyse' ? lens : 0);
  }
  SW.$$('#tabs [data-menu]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var which = btn.dataset.menu;
      if (tabMenu && tabMenu.btn === btn) { closeTabMenu(); return; }
      closeTabMenu();
      var r = btn.getBoundingClientRect(), el = SW.el('div', { class: 'tab-menu lens-list', role: 'menu', 'data-w': which }, menuHTML(which));
      document.body.appendChild(el);
      el.style.top = r.bottom + 'px';
      el.style.left = Math.max(6, Math.min(r.left, window.innerWidth - el.offsetWidth - 6)) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      tabMenu = { el: el, btn: btn };
      el.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-pick]');
        if (!t) return;
        closeTabMenu();
        var p = t.dataset.pick;
        if (which === 'help') {
          if (p === 'tour') { SW.tours.start('welcome'); return; }
          if (p === 'refs') { SW.refHelp(); return; }
          if (p === 'reading') { SW.readingHelp(); return; }
          if (p === 'cards') { SW.cardsHelp(); return; }
          if (p === 'anno') { SW.notes.help(); return; }
          if (p === 'join') { SW.notes.joinHelp(); return; }
          if (p === 'sitemap') { location.href = 'sitemap.html'; return; }
          if (p === 'backup') { SW.backup.save(); return; }
          if (p === 'restore') { SW.backup.restore(); return; }
          if (p === 'site') { window.open('../', '_blank', 'noopener'); return; }
          if (p === 'about') SW.$('#btn-about').click();
          else if (p === 'settings') SW.$('#btn-settings').click();
          else window.open(p === 'code' ? 'https://github.com/critical-code-studies/SHRDLU' : 'https://github.com/critical-code-studies/SHRDLU/issues', '_blank', 'noopener');
          return;
        }
        if (which === 'versions' && p === 'storage') { location.href = 'storage.html'; return; }
        if (which === 'versions' && p !== 'absence') { SW.setTab(p); return; }
        var nl = which === 'versions' ? 8 : +p;
        if (nl !== lens) { lens = nl; SW.store.set('an.lens', lens); SW.forget('analyse'); }
        SW.setTab('analyse');
      });
    });
  });
  document.addEventListener('mousedown', function (e) { if (tabMenu && !tabMenu.el.contains(e.target) && !tabMenu.btn.contains(e.target)) closeTabMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTabMenu(); });
  window.addEventListener('resize', closeTabMenu);
  SW.openLens = function (n) { lens = n; SW.store.set('an.lens', n); SW.forget('analyse'); SW.setTab('analyse'); };
  SW.setLens = function (n) { n = +n; if (LENSES[n - 1]) { lens = n; SW.store.set('an.lens', n); } };
  SW.setGraphic = function () {};
  SW.gfxItem = function () { return null; };
  SW.openGraphic = function () {};
  SW.biography = function (name) {
    bioName = name; SW.store.set('an.bio', name);
    lens = 7; SW.store.set('an.lens', 7);
    SW.forget('analyse');
    SW.setTab('analyse');
  };
})(this);
