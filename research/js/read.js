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


  // ---------- the repairs in the code, in gold (kintsugi), as on the Spacewar! bench ----------
  // A gold dot by the line number; the characters the bench reads differently underlined
  // in gold (a faint wash as well where the passage is supplied from another copy or
  // version). The held text is shown; the hover gives what the bench reads instead.
  function diffSpan(a, b) {   // where b differs from a: [start, end) in b
    var i = 0, j = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return [i, Math.max(i, b.length - j)];
  }
  // a raw index as an index into the text shown (a control character is shown as two, ^X)
  function shownAt(raw, i) { var n = 0; for (var k = 0; k < i && k < raw.length; k++) n += /[\u0000-\u0002\u0004-\u0008\u000b\u000e-\u001f\u007f\r]/.test(raw[k]) ? 2 : 1; return n; }
  function wrapChars(t, s, e, cls, title) {
    var nodes = [], w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x, pos = 0;
    while ((x = w.nextNode())) nodes.push(x);
    nodes.forEach(function (nd) {
      var len = nd.nodeValue.length, a = Math.max(s, pos), bb = Math.min(e, pos + len);
      if (a < bb) {
        var piece = nd;
        if (a > pos) piece = piece.splitText(a - pos);
        if (bb - a < piece.nodeValue.length) piece.splitText(bb - a);
        var sp = SW.el('span', { class: cls, title: title });
        piece.parentNode.insertBefore(sp, piece); sp.appendChild(piece);
      }
      pos += len;
    });
  }
  // where a line's comment begins: the first ; not escaped with / (MacLisp's escape)
  function lispComment(s) { for (var i = 0; i < s.length; i++) { if (s[i] === '/') { i++; continue; } if (s[i] === ';') return i; } return -1; }
  // the squiggle's reach, the line's text (code and comment), measured once drawn, in em so that it follows the text size
  function kinMeasure(row) {
    var rl = row.querySelectorAll('.rp-line'), first = rl[0], last = rl[rl.length - 1];
    if (!last) return;
    var r0 = row.getBoundingClientRect(), fs = parseFloat(getComputedStyle(row).fontSize) || 13;
    var a = first.getBoundingClientRect().left - r0.left, z = last.getBoundingClientRect().right - r0.left;
    if (!r0.width || z <= a) return;
    row.style.setProperty('--k0', (a / fs).toFixed(2) + 'em');
    row.style.setProperty('--kw', ((z - a) / fs).toFixed(2) + 'em');
  }
  // the squiggle under a line's text, code and comment (as under a misspelt word): gold for a
  // repair, grey for an uncertain reading left as found
  function squiggle(row, tx, raw) {
    if (row.classList.contains('rp-sq')) return;
    var c0 = raw.search(/\S/), c1 = raw.replace(/\s+$/, '').length;
    if (c0 < 0 || c1 <= c0) return;
    wrapChars(tx, shownAt(raw, c0), shownAt(raw, c1), 'rp-line', '');
    row.classList.add('rp-sq'); kinMeasure(row);
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
              d = diffSpan(rep.slice(ri), raw.slice(li)); d = [d[0] + li, d[1] + li];
              title = 'Kintsugi · ' + SW.mendOf(r).label + ' (' + r.id + '): the bench reads “' + rep.trim() + '” here, from ' + from + '. Click the line number for why.';
            } else {   // lines joined or split: the whole line is read otherwise
              var lead = raw.length - raw.replace(/^\s+/, '').length; d = [lead, raw.length];
              title = 'Kintsugi · ' + SW.mendOf(r).label + ' (' + r.id + '): lines ' + r.n0 + '–' + r.n1 + ' are read as ' + from + ': “' + now.join(' ').trim().slice(0, 160) + '”. Click the line number for why.';
            }
            if (d[1] <= d[0]) return;
            wrapChars(tx, shownAt(raw, d[0]), shownAt(raw, d[1]), cls, title);
          });
        }, function () {});
      });
    });
  }

  // ---------- ◆ the repairs, in turn, and the repairs menu (as on the Spacewar! bench) ----------
  // A stop for each passage the bench reads differently (a text repair), in file order,
  // across files: stepping to one in another file shows that file.
  function kinStops() {
    var st = [];
    Object.keys(build.kinFiles || {}).forEach(function (pi) { build.kinFiles[pi].forEach(function (r) { st.push({ p: +pi, n0: r.n0, n1: r.n1, r: r }); }); });
    return st.sort(function (x, y) { return x.p - y.p || x.n0 - y.n0; });
  }
  function kinPaint() {
    var nav = SW.$('.kin-nav', view); if (!nav) return;
    var n = kinStops().length;
    nav.hidden = !(build.v.build && (build.repairs || []).length);
    SW.$('.kin-n', nav).textContent = n;
    SW.$('#rd-kprev', nav).disabled = SW.$('#rd-knext', nav).disabled = !n;
    kinBar();
  }
  function kinWhat(s) { return SW.mendOf(s.r).label + ' (' + s.r.id + '): ' + s.r.title + '. ' + s.r.what + ' By ' + (s.r.by || 'the project') + ', ' + (s.r.date || '') + '.'; }
  function kinGo(s) {
    R.goto(s.p, s.n0, false);
    SW.state.sel = { p: s.p, n0: s.n0, n1: s.n1 }; paintSel(); SW.writeQuery();
    var r = SW.$('#L' + s.p + '-' + s.n0, view);
    if (r) { r.scrollIntoView({ block: 'center' }); r.classList.remove('kin-flash'); void r.offsetWidth; r.classList.add('kin-flash'); }
    SW.toast('Kintsugi · ' + kinWhat(s), 6000);
  }
  function kinCurrent() {   // the selected repair, else the next one after the selection
    var st = kinStops(), s = SW.state.sel; if (!st.length) return null;
    if (s) {
      var hit = st.filter(function (x) { return x.p === s.p && x.n0 <= s.n1 && x.n1 >= s.n0; })[0]; if (hit) return hit;
      var nx = st.filter(function (x) { return x.p > s.p || (x.p === s.p && x.n0 > s.n1); })[0]; if (nx) return nx;
    }
    return st[0];
  }
  function kinStep(dir) {
    var st = kinStops(); if (!st.length) return;
    var s = SW.state.sel, i;
    if (!s) i = dir > 0 ? 0 : st.length - 1;
    else {
      var at = -1; st.forEach(function (x, k) { if (x.p < s.p || (x.p === s.p && x.n0 <= s.n0)) at = k; });
      var on = at >= 0 && st[at].p === s.p && st[at].n0 <= s.n1 && st[at].n1 >= s.n0;
      i = dir > 0 ? at + 1 : (on ? at - 1 : at);
    }
    kinGo(st[(i + st.length) % st.length]);
  }
  function fromLink(s) {   // the copy a supplied or corrected passage was read from, in Read
    var f = s && s.r.from; if (!f) return null;
    var vid = null, pi = -1;
    root.SWVersions.VERSIONS.forEach(function (v) { (v.build || []).forEach(function (bb, k) { if (bb.src === f.src) { vid = v.id; pi = k; } }); });
    return vid ? { vid: vid, url: '?v=' + vid + '&tab=read&l=' + pi + ':' + f.n0 + (f.n1 !== f.n0 ? '-' + f.n1 : ''), label: f.src.split('/').pop() + ':' + f.n0 + (f.n1 !== f.n0 ? '–' + f.n1 : '') } : null;
  }
  function kinList(btn) {
    var st = kinStops(), others = (build.repairs || []).filter(function (r) { return r.kind !== 'text'; }), r0 = btn.getBoundingClientRect();
    SW.pop(r0.left, r0.bottom + 4, '<h4>Repairs to ' + SW.esc(build.v.label) + ' (' + build.repairs.length + ')</h4><div class="kin-list">' + st.map(function (s, i) {
      return '<a href="#" data-k="' + i + '"><span class="kin-k rp-m-' + SW.esc(s.r.mend) + '">' + SW.esc(SW.mendOf(s.r).label) + '</span> <span class="mono">' + SW.esc(SW.refText(build.v.id, s.p, s.n0, s.n1, build.parts.length)) + '</span><span class="kin-w">' + SW.esc(s.r.id + ': ' + s.r.title) + '</span></a>';
    }).join('') + (others.length ? '<div class="faint kin-sub">Not in the text: how the version is loaded or started</div>' + others.map(function (r) {
      return '<a href="#" data-o="' + SW.esc(r.id) + '"><span class="kin-k rp-m-' + SW.esc(r.mend) + '">' + SW.esc(SW.mendOf(r).label) + '</span> <span class="mono">' + SW.esc(r.id) + '</span><span class="kin-w">' + SW.esc(r.title) + '</span></a>';
    }).join('') : '') + '</div>');
    var pop = SW.$('.pop');
    if (pop) pop.addEventListener('click', function (e) {
      var a = e.target.closest('[data-k]'), o = e.target.closest('[data-o]');
      if (a) { e.preventDefault(); SW.unpop(); kinGo(st[+a.dataset.k]); }
      else if (o) { e.preventDefault(); var rr = build.repairs.filter(function (x) { return x.id === o.dataset.o; })[0]; SW.unpop(); if (rr) SW.repairPop(rr, r0.left, r0.bottom + 4); }
    });
  }
  // small line icons for the repairs bar (currentColor, 14px), as on the Spacewar! bench
  var KI = {
    list: '<path d="M2 4h10M2 7h10M2 10h10"/>',
    only: '<path d="M2 3h10L8.2 7.6V11L5.8 12V7.6z"/>',
    from: '<path d="M3.5 1.5h5l2.5 2.5v8.5h-7.5z M8.5 1.5V4H11 M5.5 7h3.5M5.5 9.5h3.5"/>',
    why: '<path d="M5 5.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.6 M7 10.8v.1"/>',
    keep: '<path d="M3.5 1.5h7v11L7 10l-3.5 2.5z M7 4v4M5 6h4"/>',
    copy: '<path d="M4.5 4.5h7v7h-7z M2.5 9.5v-7h7"/>',
    card: '<path d="M1.5 3.5h11v7h-11z M3.5 6h7M3.5 8h4.5"/>',
    cards: '<path d="M3.5 5.5h9v6.5h-9z M1.5 8.5V3.5h9 M5.5 8h5"/>',
    about: '<path d="M7 1.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z M7 6.2v3.8 M7 4.2v.1"/>'
  };
  function kic(k) { return '<svg class="ki" viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + KI[k] + '</svg>'; }
  // ◆ ⌄: the repairs bar, one row folded down under the toolbar (redrawn as the selection and settings change)
  function kinBar() {
    var bar = SW.$('.kin-bar', view), tog = SW.$('#rd-klist', view); if (!bar || !build) return;
    var st = kinStops(), n = st.length, on = opts.kinBar && !!(build.repairs || []).length;
    bar.hidden = !on;
    if (tog) { tog.setAttribute('aria-expanded', on ? 'true' : 'false'); tog.classList.toggle('open', on); }
    if (!on) return;
    var cur = kinCurrent(), fl = fromLink(cur), ref = cur ? SW.refText(build.v.id, cur.p, cur.n0, cur.n1, build.parts.length) : '';
    var s = SW.state.sel, here = cur && s && cur.p === s.p && cur.n0 <= s.n1 && cur.n1 >= s.n0;
    function b(k, title, extra, lab) { return '<button class="kb" data-km="' + k + '" title="' + SW.esc(title) + '"' + (extra || '') + '>' + (KI[k] ? kic(k) : '') + (lab ? '<span>' + SW.esc(lab) + '</span>' : '') + '</button>'; }
    function tg(k, on, title, lab, extra) { return b(k, title, ' aria-pressed="' + (on ? 'true' : 'false') + '"' + (extra || ''), lab); }
    bar.innerHTML =
      '<button class="kb" data-km="prev" title="The previous repair"' + (n ? '' : ' disabled') + '>‹</button><button class="kb" data-km="next" title="The next repair (in another file if need be)"' + (n ? '' : ' disabled') + '>›</button>' +
      b('list', 'Every repair to this version (' + build.repairs.length + '): in the text, and to how it is loaded or started', '', String(build.repairs.length)) +
      (cur ? '<button class="kin-cur" data-km="go" title="' + SW.esc((here ? 'This repair' : 'The next repair after the selection') + ': ' + ref + ' ' + kinWhat(cur)) + '"><span class="mono">' + SW.esc(ref.replace(/^\[REF: |\]$/g, '')) + '</span> ' + SW.esc(SW.mendOf(cur.r).label + ' (' + cur.r.id + '): ' + cur.r.title) + '</button>' : '<span class="kin-cur faint">No repair in the text; the repairs are to how it is loaded or started.</span>') +
      '<span class="kbs"></span>' +
      tg('only', opts.onlyRepaired, 'Only the repaired lines, with two either side', '', n ? '' : ' disabled') +
      b('from', fl ? 'The copy the passage is read from: ' + SW.refText(fl.vid) + ', ' + fl.label + ', in Read, in a new tab' : 'Only corrected and supplied passages come from another copy', fl ? '' : ' disabled', fl ? SW.refOf(fl.vid) : '') +
      b('why', cur ? 'What was done to ' + cur.r.id + ', why, the evidence and who made it' : 'No repair selected', cur ? '' : ' disabled') +
      '<span class="kbs"></span>' +
      b('keep', cur ? 'Add this repair to My notes (' + ref + '), cited, with its lines' : 'No repair selected', cur ? '' : ' disabled') +
      b('copy', 'Copy every repair to this version, with references, as plain text') +
      '<span class="kbs"></span>' +
      b('card', 'This version’s reconstruction card') +
      b('cards', 'All reconstruction cards') +
      b('about', 'What the gold marks mean') +
      '<button class="kb kb-x" data-km="close" title="Fold the repairs bar away">✕</button>';
  }
  function kinAct(k, el) {
    var cur = kinCurrent(), on = el && el.getAttribute && el.hasAttribute('aria-pressed') ? el.getAttribute('aria-pressed') !== 'true' : el && el.checked;
    if (k === 'prev') kinStep(-1);
    else if (k === 'next') kinStep(1);
    else if (k === 'list') kinList(el || SW.$('#rd-klist', view));
    else if (k === 'go') { if (cur) kinGo(cur); }
    else if (k === 'close') { opts.kinBar = false; SW.store.set('read.kinBar', false); kinBar(); }
    else if (k === 'from') { var fl = fromLink(cur); if (fl) root.open(fl.url, '_blank', 'noopener'); }
    else if (k === 'why') { var r0 = (el || SW.$('#rd-klist', view)).getBoundingClientRect(); if (cur) SW.repairPop(cur.r, r0.left, r0.bottom + 4); }
    else if (k === 'only') { opts.onlyRepaired = on; applyFilter(); if (opts.onlyRepaired) { var s = kinStops()[0]; if (s) kinGo(s); } }
    else if (k === 'marks') { var cb = SW.$('#rd-repairs', view); if (cb) { cb.checked = on; cb.dispatchEvent(new Event('change')); } }
    else if (k === 'card') SW.cardsOne(build.v.id);
    else if (k === 'cards') SW.cardsHelp();
    else if (k === 'about') { var r1 = (el || SW.$('#rd-klist', view)).getBoundingClientRect(); SW.pop(r1.left, r1.bottom + 4, SW.kinAbout()); }
    else if (k === 'copy') {
      var lines = kinStops().map(function (s) { return SW.refText(build.v.id, s.p, s.n0, s.n1, build.parts.length) + '  ' + kinWhat(s); })
        .concat((build.repairs || []).filter(function (r) { return r.kind !== 'text'; }).map(function (r) { return SW.refText(build.v.id) + '  ' + SW.mendOf(r).label + ' (' + r.id + '): ' + r.title + '. ' + r.what; }));
      var text = 'Repairs to ' + build.v.label + ' ' + SW.refText(build.v.id) + ' (SHRDLU Research Bench ' + SW.VERSION + '):\n' + lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { SW.toast(lines.length + ' repairs copied'); }, function () { root.prompt('Copy:', text); });
    }
    else if (k === 'keep') {
      if (!cur || !SW.tray) return;
      var ref = SW.refText(build.v.id, cur.p, cur.n0, cur.n1, build.parts.length), sel = { p: cur.p, n0: cur.n0, n1: cur.n1 };
      listingDoc(build, sel).then(function (d) {
        d.title = 'Repair ' + cur.r.id + ' ' + ref;
        d.blocks.push({ type: 'p', text: kinWhat(cur) + ' Why: ' + cur.r.why + ' Evidence: ' + cur.r.evidence });
        SW.tray.addDoc(d, { anchor: { p: cur.p, n0: cur.n0, n1: cur.n1, src: build.parts[cur.p].src }, quote: build.lines[cur.p].slice(cur.n0 - 1, cur.n1).map(function (L) { return L.raw; }).join('\n'), tags: ['repair'] });
      });
    }
  }

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
    repairs: {
      nav: '<span class="kin-nav" hidden><button class="btn" id="rd-kprev" title="The previous repair">‹</button>' +
      '<button class="btn kin-tog" id="rd-klist" aria-expanded="false" title="Repairs: where the bench reads this version differently to run it (kintsugi). Click to show or hide the repairs bar"><span class="kin-dia">◆</span> <span class="kin-n"></span> <span class="kin-chev" aria-hidden="true">⌄</span></button>' +
      '<button class="btn" id="rd-knext" title="The next repair (in another file if need be)">›</button></span>',
      view: function () {
        return '<label class="check" title="Mark in gold where the bench changes what this version reads, to run it (kintsugi): readings corrected against another copy, passages supplied from another copy or version. Changes for running only (paler gold) are on the reconstruction card. Click a gold line number for what was changed and why."><input type="checkbox" id="rd-repairs"' + (opts.repairs ? ' checked' : '') + '> Repairs (gold)</label>';
      },
      wire: function (tb) {
        SW.$('#rd-kprev', tb).onclick = function () { kinStep(-1); };
        SW.$('#rd-knext', tb).onclick = function () { kinStep(1); };
        var kb = SW.el('div', { class: 'kin-bar', role: 'toolbar', 'aria-label': 'Repairs' }); kb.hidden = true;
        tb.appendChild(kb);
        SW.$('#rd-klist', tb).onclick = function () { opts.kinBar = !opts.kinBar; SW.store.set('read.kinBar', opts.kinBar); kinBar(); };
        kb.addEventListener('click', function (e) { var b = e.target.closest('[data-km]'); if (b && b.tagName !== 'INPUT' && !b.disabled) { e.preventDefault(); kinAct(b.dataset.km, b); if (!/^(close|list|about|card|cards|why)$/.test(b.dataset.km)) kinBar(); } });
        kb.addEventListener('change', function (e) { var b = e.target.closest('[data-km]'); if (b) { kinAct(b.dataset.km, b); kinBar(); } });
        setTimeout(kinPaint, 0);
        SW.$('#rd-repairs', tb).onchange = function (e) { opts.repairs = e.target.checked; SW.store.set('read.repairs', opts.repairs); SW.$$('.listing', view).forEach(function (x) { x.classList.toggle('no-repairs', !opts.repairs); }); };
      },
      paint: paintKin,
      // a file's repair chip, or a gold line number: what was done there, and why
      click: function (e, b) {
        var kc = e.target.closest('[data-kin]'), kr = kc ? b.repairs.filter(function (r) { return r.id === kc.dataset.kin; })[0] : null;
        if (!kr && e.target.closest('.ln.kin .n') && !e.target.closest('.qa')) { var row = e.target.closest('.ln'); kr = b.kin[row.dataset.p + ':' + row.dataset.n]; }
        if (kr) { SW.repairPop(kr, e.clientX, e.clientY); return true; }
        return false;
      },
      bar: function () { kinBar(); },
      kept: function () { var keep = {}; kinStops().forEach(function (s) { for (var n = s.n0 - 2; n <= s.n1 + 2; n++) keep[s.p + ':' + n] = true; }); return keep; }
    },
    onShow: function (b) { build = b; }
  });
  view = ctx.view; opts = ctx.opts; R = ctx.R;
})(this);
