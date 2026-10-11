/*
 * read.js - Read for SHRDLU: bench-kit's Read view (kit/read.js) with what is this bench's:
 * MacLisp highlighting, control characters and page marks, the files as the loader reads
 * them, the Key, the pop-up on a name, and the repairs in gold (kintsugi).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var ctx = null, view = null, opts = null, R = null, build = null;
  // the Read view's own, from bench-kit (set once SW.readView has made it)
  function paintSel() { ctx.paintSel(); }
  function applyFilter() { ctx.applyFilter(); }
  function listingDoc(b, sel, o) { return ctx.listingDoc(b, sel, o); }

  // ---------- the files a version is read from ----------
  // A SHRDLU version is a directory of MacLisp files, read in by its loader
  // one after another. Plain labels for each: program files (the loader reads
  // them), support files (loading, macros, the scripted demonstration), and
  // documentation (shown, not indexed as code).
  function tapeTitle(b, pi) { return ((b.asm && b.asm.titles.filter(function (t) { return t.file === pi; })[0]) || {}).text || ''; }
  var ROLE = { program: 'program', support: 'support', doc: 'documentation' };
  function tapeInfo(b) {
    return b.parts.map(function (part, pi) {
      var name = part.src.split('/').pop();
      return { pi: pi, supplied: part.role !== 'program', star: false, title: tapeTitle(b, pi).trim(), label: name + (part.role !== 'program' ? ' (' + ROLE[part.role] + ')' : '') };
    });
  }
  function tapeHelp(info) {
    return 'Why ' + info.length + ' files? SHRDLU is a directory of MacLisp files that its loader read in one after another, ' +
      'Micro-Planner first, then the system, the grammar and dictionary, the semantics, the answering code, the blocks world and its data. ' +
      'They are listed in that order. Choose one to read, or All to read them in order.';
  }

  // MacLisp's own forms and functions, and Micro-Planner's, marked in the listing
  var LISPFORMS = {};
  ('DEFUN DEFPROP DEFS PDEFINE LAMBDA PROG PROG2 PROGN COND AND OR NOT NULL SETQ SET QUOTE FUNCTION GO RETURN DO MAP MAPC MAPCAR MAPCAN MAPLIST APPLY EVAL ' +
   'CAR CDR CONS LIST APPEND NCONC REVERSE MEMQ MEMBER ASSQ ASSOC EQ EQUAL ATOM NUMBERP GET PUTPROP REMPROP ERRSET ERR CATCH THROW PRINT PRINC TERPRI READ READCH TYI TYO ' +
   'PLUS DIFFERENCE TIMES QUOTIENT ADD1 SUB1 GREATERP LESSP ZEROP MINUSP LENGTH RPLACA RPLACD DELQ DELETE SUBST STATUS SSTATUS DECLARE COMMENT IOC UREAD GENSYM EXPLODE READLIST MAKNAM INTERN').split(' ')
    .forEach(function (k) { LISPFORMS[k] = 1; });
  function hl(raw, b) {
    var p = SW.parseLine(raw), code = p.code, h = '', i = 0, n = code.length;
    while (i < n) {
      var c = code[i];
      if (c === '(' || c === ')') { h += '<span class="ps">' + c + '</span>'; i++; continue; }
      if (c === "'" || c === ' ' || c === '\t' || c === '\f') { var j0 = i; while (i < n && /[' \t\f]/.test(code[i])) i++; h += SW.esc(code.slice(j0, i)); continue; }
      var j = i, name = '';
      while (j < n && !/[()' \t\f]/.test(code[j])) { if (code[j] === '/' && j + 1 < n) { name += code[j + 1]; j += 2; continue; } name += code[j]; j++; }
      var tok = code.slice(i, j), key = name.toUpperCase(), cls;
      if (root.LispIndex.isNumberToken(tok)) cls = 'num';
      else if (/^\$[?_EN]/.test(key)) cls = 'var';
      else if (b.sym && b.sym[key]) cls = 'lab sym';
      else if (/^TH[A-Z]/.test(key)) cls = 'mac sym';
      else if (LISPFORMS[key]) cls = 'op sym';
      else cls = 'sym';
      h += '<span class="' + cls + '" data-s="' + SW.esc(key) + '">' + SW.esc(tok) + '</span>';
      i = j;
    }
    if (p.comment) h += '<span class="cm">' + SW.esc(p.comment) + '</span>';
    return h;
  }

  // Control characters as ^X: marked in the text, spelt plainly inside a tag's attributes
  var CTL = /[\u0000-\u0002\u0004-\u0008\u000b\u000e-\u001f\u007f\r]/g;
  function caret(c) { var n = c.charCodeAt(0); return n === 127 ? '^?' : '^' + String.fromCharCode(n + 64); }
  function ctlMark(m, tag, txt) {
    if (tag) return tag.replace(/[\f\u0003]/g, caret).replace(CTL, caret);
    return txt.replace(/\f/g, '<span class="pgbrk" title="Page break: a form feed in the file (ITS page mark)">↡</span>').replace(/\u0003/g, '<span class="pgbrk" title="End of file mark (^C, ITS padding)">␃</span>').replace(CTL, function (c) { var t = caret(c); return '<span class="ctl" title="A control character in the file: ' + t + '">' + t + '</span>'; });
  }

  // Control characters as ^X: marked in the text, spelt plainly inside a tag's attributes
  var CTL = /[\u0000-\u0002\u0004-\u0008\u000b\u000e-\u001f\u007f\r]/g;
  function caret(c) { var n = c.charCodeAt(0); return n === 127 ? '^?' : '^' + String.fromCharCode(n + 64); }
  function ctlMark(m, tag, txt) {
    if (tag) return tag.replace(/[\f\u0003]/g, caret).replace(CTL, caret);
    return txt.replace(/\f/g, '<span class="pgbrk" title="Page break: a form feed in the file (ITS page mark)">↡</span>').replace(/\u0003/g, '<span class="pgbrk" title="End of file mark (^C, ITS padding)">␃</span>').replace(CTL, function (c) { var t = caret(c); return '<span class="ctl" title="A control character in the file: ' + t + '">' + t + '</span>'; });
  }


  // ---------- the repairs in gold (kintsugi): bench-kit's kintsugi.js, with this bench's ----------
  // A gold dot by the line number; the characters the bench reads differently underlined in gold
  // (a faint wash as well where the passage is supplied from another copy or version). The held
  // text is shown; the hover gives what the bench reads instead. The repairs are js/repairs.js's.
  var K = SW.kintsugi;
  // a raw index as an index into the text shown (a control character is shown as two, ^X)
  function shownAt(raw, i) { var n = 0; for (var k = 0; k < i && k < raw.length; k++) n += /[\u0000-\u0002\u0004-\u0008\u000b\u000e-\u001f\u007f\r]/.test(raw[k]) ? 2 : 1; return n; }
  // the squiggle under a line's text, code and comment
  function squiggle(row, tx, raw) {
    var c0 = raw.search(/\S/), c1 = raw.replace(/\s+$/, '').length;
    if (c0 >= 0 && c1 > c0) K.squiggle(row, tx, shownAt(raw, c0), shownAt(raw, c1));
  }
  // uncertain readings, left as found: lines carrying control characters (damage in copying)
  // that no repair reads otherwise; the Absence lens lists the same lines. Not counted: tab,
  // page mark (^L), end-of-file padding (^C), a bare carriage return (^M, part of the ITS text)
  // and ALTMODE (^[, the $ of ITS commands such as Micro-Planner's $P)
  var CTL_DAMAGE = /[\u0000-\u0002\u0004-\u0008\u000e-\u001a\u001c-\u001f\u007f]/;
  function paintUnc(box, b) {
    b.lines.forEach(function (ls, p) {
      ls.forEach(function (L) {
        if (L.skipped || !CTL_DAMAGE.test(L.raw) || (b.kin && b.kin[p + ':' + L.n])) return;
        var row = SW.$('#L' + p + '-' + L.n, box), tx = row && row.querySelector('.t'); if (!tx) return;
        row.classList.add('rp-unc');
        var cs = (L.raw.match(new RegExp(CTL_DAMAGE.source, 'g')) || []).map(function (c) { var n = c.charCodeAt(0); return n === 127 ? '^?' : '^' + String.fromCharCode(n + 64); });
        tx.title = 'Kintsugi · Uncertain reading, left as found (not repaired): the line carries control characters (' + cs.slice(0, 6).join(' ') + '), a sign of damage in copying.' + (tx.title ? ' · ' + tx.title : '');
        squiggle(row, tx, L.raw);
      });
    });
  }
  function paintKin(box, b) {
    paintUnc(box, b);
    Object.keys(b.kinFiles || {}).forEach(function (pi) {
      pi = +pi;
      b.kinFiles[pi].forEach(function (r) {
        if (!r.from) return;
        SW.fetchText(r.from.src).then(function (txt) {
          if (build !== b) return;
          var src = root.LispIndex.splitLines(txt), now = src.slice(r.from.n0 - 1, r.from.n1), held = b.lines[pi].slice(r.n0 - 1, r.n1);
          var cls = 'rp-c ' + (r.mend === 'yobitsugi' ? 'rp-c-sup' : 'rp-c-fix'), from = r.from.src.split('/').pop() + ':' + r.from.n0 + (r.from.n1 !== r.from.n0 ? '–' + r.from.n1 : '');
          held.forEach(function (L, k) {
            var row = SW.$('#L' + pi + '-' + L.n, box), tx = row && row.querySelector('.t'); if (!tx) return;
            row.classList.add(r.mend === 'yobitsugi' ? 'rp-sup' : 'rp-fix');
            squiggle(row, tx, L.raw);
            var raw = L.raw, rep = now.length === held.length ? now[k] : null, d, title;
            if (rep != null) {
              if (rep === raw) return;
              // leading whitespace is not compared (tabs in one copy, spaces in another)
              var li = raw.length - raw.replace(/^\s+/, '').length, ri = rep.length - rep.replace(/^\s+/, '').length;
              if (rep.slice(ri) === raw.slice(li)) return;
              d = K.diffSpan(rep.slice(ri), raw.slice(li)); d = [d[0] + li, d[1] + li];
              title = 'Kintsugi · ' + SW.mendOf(r).label + ' (' + r.id + '): the bench reads “' + rep.trim() + '” here, from ' + from + '. Click the line number for why.';
            } else {   // lines joined or split: the whole line is read otherwise
              var lead = raw.length - raw.replace(/^\s+/, '').length; d = [lead, raw.length];
              title = 'Kintsugi · ' + SW.mendOf(r).label + ' (' + r.id + '): lines ' + r.n0 + '–' + r.n1 + ' are read as ' + from + ': “' + now.join(' ').trim().slice(0, 160) + '”. Click the line number for why.';
            }
            if (d[1] <= d[0]) return;
            K.wrapChars(tx, shownAt(raw, d[0]), shownAt(raw, d[1]), cls, title);
          });
        }, function () {});
      });
    });
  }

  // a stop for each passage the bench reads differently (a text repair), in file order, across
  // files: stepping to one in another file shows that file
  function kinWhat(r) { return SW.mendOf(r).label + ' (' + r.id + '): ' + r.title + '. ' + r.what + ' By ' + (r.by || 'the project') + ', ' + (r.date || '') + '.'; }
  function stops() {
    var st = [];
    Object.keys(build.kinFiles || {}).forEach(function (pi) {
      build.kinFiles[pi].forEach(function (r) {
        var w = kinWhat(r);
        st.push({ p: +pi, n0: r.n0, n1: r.n1, id: r.id, r: r, chip: { cls: 'rp-m-' + (r.mend || ''), label: SW.mendOf(r).label },
                  short: SW.mendOf(r).label + ' (' + r.id + '): ' + r.title, name: r.id + ': ' + r.title, what: w, toast: 'Kintsugi · ' + w,
                  note: w + ' Why: ' + r.why + ' Evidence: ' + r.evidence });
      });
    });
    return st.sort(function (x, y) { return x.p - y.p || x.n0 - y.n0; });
  }
  function others() { return (build.repairs || []).filter(function (r) { return r.kind !== 'text'; }); }
  function fromLink(s) {   // the copy a supplied or corrected passage was read from, in Read
    var f = s && s.r.from; if (!f) return null;
    var vid = null, pi = -1;
    root.SWVersions.VERSIONS.forEach(function (v) { (v.build || []).forEach(function (bb, k) { if (bb.src === f.src) { vid = v.id; pi = k; } }); });
    return vid ? { vid: vid, url: '?v=' + vid + '&tab=read&l=' + pi + ':' + f.n0 + (f.n1 !== f.n0 ? '-' + f.n1 : ''), label: f.src.split('/').pop() + ':' + f.n0 + (f.n1 !== f.n0 ? '–' + f.n1 : '') } : null;
  }
  var X = SW.kintsugi({
    stops: stops,
    has: function () { return !!(build.v.build && (build.repairs || []).length); },
    total: function () { return (build.repairs || []).length; },
    disableEmpty: true,
    paint: paintKin,
    // a file's repair chip, or a gold line number: what was done there, and why
    click: function (e, b) {
      var kc = e.target.closest('[data-kin]'), kr = kc ? b.repairs.filter(function (r) { return r.id === kc.dataset.kin; })[0] : null;
      if (!kr && e.target.closest('.ln.kin .n') && !e.target.closest('.qa')) { var row = e.target.closest('.ln'); kr = b.kin[row.dataset.p + ':' + row.dataset.n]; }
      if (kr) { SW.repairPop(kr, e.clientX, e.clientY); return true; }
      return false;
    },
    // the copy a passage is read from, and why it was repaired
    extras: function (cur, ui) {
      var fl = fromLink(cur);
      return ui.b('from', fl ? 'The copy the passage is read from: ' + SW.refText(fl.vid) + ', ' + fl.label + ', in Read, in a new tab' : 'Only corrected and supplied passages come from another copy', fl ? '' : ' disabled', fl ? SW.refOf(fl.vid) : '') +
        ui.b('why', cur ? 'What was done to ' + cur.id + ', why, the evidence and who made it' : 'No repair selected', cur ? '' : ' disabled');
    },
    act: function (k, cur, el) {
      if (k === 'from') { var fl = fromLink(cur); if (fl) root.open(fl.url, '_blank', 'noopener'); return true; }
      if (k === 'why') { var r0 = el.getBoundingClientRect(); if (cur) SW.repairPop(cur.r, r0.left, r0.bottom + 4); return true; }
      return false;
    },
    noRedraw: ['why'],
    // how the version is loaded or started: on the list, after the passages
    others: function () { return others().map(function (r) { return { chip: { cls: 'rp-m-' + (r.mend || ''), label: SW.mendOf(r).label }, ref: r.id, name: r.title, id: r.id }; }); },
    openOther: function (id, x, y) { var r = others().filter(function (o) { return o.id === id; })[0]; if (r) SW.repairPop(r, x, y); },
    copyLines: function () {
      return stops().map(function (s) { return SW.refText(build.v.id, s.p, s.n0, s.n1, build.parts.length) + '  ' + s.what; })
        .concat(others().map(function (r) { return SW.refText(build.v.id) + '  ' + SW.mendOf(r).label + ' (' + r.id + '): ' + r.title + '. ' + r.what; }));
    },
    about: function () { return SW.kinAbout(); },
    titles: {
      tog: 'Repairs: where the bench reads this version differently to run it (kintsugi). Click to show or hide the repairs bar',
      next: 'The next repair (in another file if need be)',
      view: 'Mark in gold where the bench changes what this version reads, to run it (kintsugi): readings corrected against another copy, passages supplied from another copy or version. Changes for running only (paler gold) are on the reconstruction card. Click a gold line number for what was changed and why.',
      list: function (n) { return 'Every repair to this version (' + n + '): in the text, and to how it is loaded or started'; },
      listHead: function () { return 'Repairs to ' + build.v.label + ' (' + (build.repairs || []).length + ')'; },
      others: 'Not in the text: how the version is loaded or started',
      noCurrent: 'No repair in the text; the repairs are to how it is loaded or started.',
      copy: 'Copy every repair to this version, with references, as plain text'
    }
  });

  // ---------- the pop-up on a name ----------
  function symbol(name, b) {
    var s = b.sym[name];
    var h = '<h4>' + SW.esc(name) + '</h4>';
    if (s) {
      var K = root.LispIndex.KIND_LABEL;
      h += '<div>' + SW.esc(s.kinds.map(function (k) { return K[k] || k; }).join(', ')) +
        ' <span class="faint">· defined ' + s.defs.length + '×, used ' + s.refs.length + '×' + (Object.keys(s.calledFrom || {}).length ? ', called from ' + Object.keys(s.calledFrom).length + ' definitions' : '') + '</span></div>';
      var list = s.defs.map(function (d) { return ['def', d]; }).concat(s.refs.map(function (r) { return ['ref', r]; }));
      h += '<div class="refs">' + list.slice(0, 200).map(function (x) {
        var L = b.lines[x[1].file][x[1].line - 1], f = b.parts[x[1].file].src.split('/').pop();
        return '<a href="#" data-p="' + x[1].file + '" data-n="' + x[1].line + '">' + (x[0] === 'def' ? '◆ ' : '· ') +
          SW.esc(f) + ':' + x[1].line + '  ' + SW.esc((L ? L.raw : '').trim().slice(0, 40)) + '</a>';
      }).join('') + '</div>';
    } else h += '<div class="faint">' + (LISPFORMS[name] ? 'A MacLisp form or function, not defined in SHRDLU’s files.' : /^TH/.test(name) ? 'A Micro-Planner name.' : 'Not defined in this version’s files.') + '</div>';
    if (s) h += '<div style="margin-top:6px"><a href="#" data-bio="' + SW.esc(name) + '" title="Follow this name through every version: when it appears, changes and goes">Its history across the versions →</a></div>';
    return h;
  }

  ctx = SW.readView({
    hl: hl,
    mark: function (html) { return html.replace(/(<[^>]*>)|([^<]+)/g, ctlMark); },
    files: {
      word: 'File', info: tapeInfo, help: tapeHelp, remember: true, jump: 'one',
      chips: function (b, pi) { return (b.kinFiles && b.kinFiles[pi] ? '<div class="ph-kin">' + b.kinFiles[pi].map(function (r) { return '<button class="kin-chip rp-m-' + SW.esc(r.mend || '') + '" data-kin="' + SW.esc(r.id) + '" title="' + SW.esc('Kintsugi · ' + SW.mendOf(r).label + ': ' + r.what) + '">◆ ' + SW.esc(r.id) + ' ' + SW.esc(r.title) + '</button>'; }).join('') + '</div>' : ''); },
      sub: function (b, pi, t) {
        var part = b.parts[pi];
        return '<span class="ph-lang" title="What this file is written in">' + SW.esc(SW.fileLangOf(part.src, part.role)) + '</span> · ' + SW.sourceLink(part.src, part.src.split('/').pop()) +
        ' · ' + ({ program: 'read in by the loader', support: 'a support file', doc: 'documentation' }[part.role] || 'text file') + ' · ' + b.lines[pi].length + ' lines' +
        (t.title && part.role !== 'doc' ? ' · <span title="Its first comment">“' + SW.esc(t.title.slice(0, 90)) + '”</span>' : '');
      }
    },
    errors: { word: 'bracket error', title: function () { return 'Where the parentheses do not balance'; } },
    rowClass: function (b, L, k) { var kin = b.kin && b.kin[k]; return kin ? ' kin rp-' + (kin.mend || 'hibi') : ''; },
    rowTitle: function (b, L, k, title) {
      var kin = b.kin && b.kin[k];
      return kin ? 'Kintsugi · ' + SW.mendOf(kin).label + ' when the bench runs this version (' + kin.id + ', ' + kin.title + '): ' + kin.what + ' By ' + (kin.by || 'the project') + ', ' + (kin.date || '') + '. Click the line number for the reason and evidence.' + (title ? ' · ' + title : '') : title;
    },
    key: function () {
      return '<h4>Key</h4><div class="keylist">' +
        '<div><i class="kx kdef"></i>a definition begins here (DEFUN, a theorem, a dictionary word, a grammar program)</div>' +
        '<div><i class="kx keq"></i>a global set at top level (SETQ)</div>' +
        '<div><i class="kx kcom"></i>a line of comment only</div>' +
        '<div><i class="kx knoted"></i>covered by an annotation (initials at the right; click them)</div>' +
        '<div><span class="errs">(</span> a parenthesis that does not balance (hover for the message)</div>' +
        '<div><span class="pgbrk">↡</span> a page break; <span class="pgbrk">␃</span> the end-of-file mark</div>' +
        '<div class="faint" style="margin-top:6px">Repairs, in gold (kintsugi; View ▸ Repairs):</div>' +
        '<div><span class="rp-line">(QUOTE <span class="rp-c rp-c-fix">0.43</span>302)</span> a repaired line, underlined in gold; the characters the bench reads otherwise in a gold wash (hover for what it reads)</div>' +
        '<div><span class="rp-line"><span class="rp-c rp-c-sup">(move-ptw</span> N</span> a deeper wash: a passage supplied from another copy or version; the chip above the file names it</div>' +
        '<div><span style="color:var(--gold)">●</span> a corrected line, <span style="color:var(--gold)">■</span> a supplied one, by the line number</div>' +
        '<div><span class="rp-line rp-line-unc">NCUJ HE@<span class="ctl">^D</span></span> an uncertain reading, left as found: a line with control characters that no repair reads otherwise (grey)</div>' +
        '<div class="faint flow" style="margin-top:6px">Text: <span class="lab">names defined in this version</span>, <span class="op">MacLisp</span>, <span class="mac">Micro-Planner (TH…)</span>, <span class="var">planner variables ($?X)</span>, <span class="num">numbers</span>, <span class="cm">comments</span>. Click a name for where it is defined and used.</div></div>';
    },
    symbol: symbol,
    lost: 'What is absent is also part of the record. Annotations on this version can still be kept under “Versions”.',
    repairs: X,
    onShow: function (b) { build = b; }
  });
  view = ctx.view; opts = ctx.opts; R = ctx.R;
})(this);
