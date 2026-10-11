/*
 * read.js - the listing: source as held, with what the assembler made of it.
 */
(function (root) {
  'use strict';
  var SW = root.SW, N = SW.notes;
  var view = SW.$('#view-read');
  var R = SW.views.read = {};
  var build = null, notes = [], counts = {}, noted = {}, anchorSel = null;
  // tapes: which of the version's tapes to show: 'all', or a single tape's index.
  var opts = { repairs: SW.store.get('read.repairs', true), kinBar: SW.store.get('read.kinBar', false), words: false, norm: false, tapes: SW.store.get('read.file', '0'), heat: false, onlyNoted: false, by: '', notes: SW.store.get('read.notes', 'inline'), show: SW.store.get('read.show', 'all'), ghosts: SW.store.get('read.ghosts', true) };
  // show: whose annotations Read shows: 'all', 'mine' (those you started) or 'none';
  // cycled from the chevron on the Annotations heading.
  var SHOW = { all: '▾ All', mine: '▾ Mine', open: '▾ Open', none: '▸ None' }, SHOW_NEXT = { all: 'mine', mine: 'open', open: 'none', none: 'all' };
  function isMine(n) { var me = SW.me().initials; return N.mine(n) || (!!me && n.by === me); }
  // notes: 'inline' (each thread under its lines, the default), 'margin' (cards
  // beside the lines) or 'off' (initials at the line end); chosen from the ▴ Notes button.
  function marginOn() { return opts.notes === 'margin'; }

  // Annotations in Read (threads, ghosts, the margin, the selection, export): bench-kit's readnotes.js
  var K = SW.readNotes({ view: view, R: R, opts: opts, isMine: isMine, showsTape: showsTape, filtering: filtering,
    keptLines: keptLines, tapeInfo: tapeInfo, kinBar: kinBar });
  var paintNotes = K.paintNotes, paintMargin = K.paintMargin, layoutMargin = K.layoutMargin, wireMargin = K.wireMargin,
    threadClick = K.threadClick, threadFor = K.threadFor, loadGhosts = K.loadGhosts, MODES = K.MODES, modeOf = K.modeOf,
    setNotes = K.setNotes, modeBtn = K.modeBtn, live = K.live, paintSel = K.paintSel, annotateSel = K.annotateSel,
    selLines = K.selLines, copy = K.copy, listingDoc = K.listingDoc, ro = null;

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
  function showsTape(pi) { return opts.tapes === 'all' || +opts.tapes === pi; }
  function tapeOptions(b, info) {
    var o = [['all', 'All ' + info.length + ' files']].concat(info.map(function (t) { return [String(t.pi), (t.pi + 1) + '. ' + t.label]; }));
    return o.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === String(opts.tapes) ? ' selected' : '') + '>' + SW.esc(x[1]) + '</option>'; }).join('');
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
  SW.hlLine = function (raw, b) { return hl(raw, b); };
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

  // ---------- rendering ----------
  function rowHTML(b, L) {
    var k = L.p + ':' + L.n, cls = 'ln';
    var words = null;
    if (L.skipped) cls += ' skip';
    if (b.errorsAt[k]) cls += ' err';
    if (L.raw !== L.norm && !L.skipped) cls += ' norm';
    if (b.kind && b.kind[k]) cls += ' k' + b.kind[k];
    var kin = b.kin && b.kin[k];
    if (kin) cls += ' kin rp-' + (kin.mend || 'hibi');
    if (SW.breakpoints && words && words.some(function (w) { return SW.breakpoints[w.loc]; })) cls += ' bp';
    var a = '', w = '', wTitle = '';
    if (words && words.length) {
      a = SW.oct(words[0].loc, 4);
      w = SW.oct(words[0].val) + (words.length > 1 ? ' <span class="faint">+' + (words.length - 1) + '</span>' : '');
      var last = words[words.length - 1].loc;
      wTitle = words.length === 1 ? '1 word, at ' + a
        : words.length + ' words, at ' + (last - words[0].loc === words.length - 1 ? a + '–' + SW.oct(last, 4) : words.map(function (x) { return SW.oct(x.loc, 4); }).join(', ')) +
          (b.kind && b.kind[k] === 'call' ? ' (the macro expanded)' : '');
      wTitle += words.length === 1 ? '. Click to see it.' : '. Click to see them all.';
    }
    var text = opts.norm ? L.norm : L.raw;
    var mk = N.marginMark(k, counts[k]);
    if (noted[k]) cls += ' noted';
    var heat = '';
    if (opts.heat && SW.profile && SW.profile.build === b && words) {
      var ex = 0;
      words.forEach(function (x) { ex += SW.profile.exec[x.loc] || 0; });
      if (ex) heat = 'background:color-mix(in srgb, var(--amber) ' + (100 * Math.min(0.5, 0.06 + Math.log10(1 + ex) / 12)).toFixed(1) + '%, transparent)';
    }
    var title = '';
    if (b.errorsAt[k]) title = b.errorsAt[k].map(function (e) { return e.message + (e.symbol ? ' "' + e.symbol + '"' : ''); }).join('; ');
    if (kin) title = 'Kintsugi · ' + SW.mendOf(kin).label + ' when the bench runs this version (' + kin.id + ', ' + kin.title + '): ' + kin.what + ' By ' + (kin.by || 'the project') + ', ' + (kin.date || '') + '. Click the line number for the reason and evidence.' + (title ? ' · ' + title : '');
    
    return '<div class="' + cls + '" id="L' + L.p + '-' + L.n + '" data-p="' + L.p + '" data-n="' + L.n + '"' +
      (title ? ' title="' + SW.esc(title) + '"' : '') + '>' +
      '<span class="n" style="--d:' + String(L.n).length + ';' + heat + '"><button class="qa" tabindex="-1" title="Annotate this">+A</button>' + L.n + '</span><span class="a"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + a + '</span>' +
      '<span class="w"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + w + '</span>' +
      '<span class="t">' + (text ? hl(text, b).replace(/(<[^>]*>)|([^<]+)/g, ctlMark) : ' ') + '</span><span class="mk">' + mk + '</span></div>';
  }

  function render() {
    var b = build;
    view.innerHTML = '';
    var tb = SW.el('div', { class: 'toolbar' });
    tb.innerHTML =
      '<input type="search" id="rd-find" placeholder="Find text or /regex/ …">' +
      '<button class="btn" id="rd-prev" title="Previous match">↑</button><button class="btn" id="rd-next" title="Next match">↓</button>' +
      '<span class="hint" id="rd-hits"></span><span class="sep"></span>' +
      '<details class="menu"><summary class="btn" title="What the listing shows">View ▾</summary><div class="menu-body">' +
      '<label class="check" title="Hide every line that no annotation covers, so the listing reads as the discussion so far. A dashed rule marks where lines are left out. Exports of the whole listing follow the filter."><input type="checkbox" id="rd-noted"' + (opts.onlyNoted ? ' checked' : '') + '> Only annotated lines</label>' +
      '<label class="check" title="Show only annotations (and the lines they cover) in which these initials take part, as author or in a reply">Annotations by <select id="rd-by"><option value="">anyone</option></select></label>' +
      '<label class="check" title="Mark in gold where the bench changes what this version reads, to run it (kintsugi): readings corrected against another copy, passages supplied from another copy or version. Changes for running only (paler gold) are on the reconstruction card. Click a gold line number for what was changed and why."><input type="checkbox" id="rd-repairs"' + (opts.repairs ? ' checked' : '') + '> Repairs (gold)</label>' +
      '</div></details><span class="hint" id="rd-nf"></span>' +
      '<span class="undo-pair"><button class="btn" id="rd-undo" disabled title="Undo">↶</button><button class="btn" id="rd-redo" disabled title="Redo">↷</button></span>' +
      '<span class="kin-nav" hidden><button class="btn" id="rd-kprev" title="The previous repair">‹</button>' +
      '<button class="btn kin-tog" id="rd-klist" aria-expanded="false" title="Repairs: where the bench reads this version differently to run it (kintsugi). Click to show or hide the repairs bar"><span class="kin-dia">◆</span> <span class="kin-n"></span> <span class="kin-chev" aria-hidden="true">⌄</span></button>' +
      '<button class="btn" id="rd-knext" title="The next repair (in another file if need be)">›</button></span>';
    tb.appendChild(SW.el('button', { class: 'btn', title: 'What the colours and marks in the listing mean', onclick: function (e) {
      SW.pop(e.clientX, e.clientY, '<h4>Key</h4><div class="keylist">' +
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
        '<div class="faint flow" style="margin-top:6px">Text: <span class="lab">names defined in this version</span>, <span class="op">MacLisp</span>, <span class="mac">Micro-Planner (TH…)</span>, <span class="var">planner variables ($?X)</span>, <span class="num">numbers</span>, <span class="cm">comments</span>. Click a name for where it is defined and used.</div></div>');
    } }, 'Key'));
    if (b.v.build && b.parts.length > 1) {
      var ti = tapeInfo(b);
      tb.appendChild(SW.el('label', { class: 'check tape-pick', title: tapeHelp(ti) },
        'File <select id="rd-tape">' + tapeOptions(b, ti) + '</select> <span class="help-dot">?</span>'));
    }
    // Only assembly errors are flagged here; the word count and start address
    // are on the Version & notes page.
    if (b.asm && b.asm.errors.length) {
      b.asm.errorCount = b.asm.errors.length;
      var eb = SW.el('button', { class: 'badge err', title: 'Where the parentheses do not balance' },
        b.asm.errorCount + ' bracket error' + (b.asm.errorCount > 1 ? 's' : ''));
      eb.onclick = function () { SW.asmErrors(b); };
      tb.appendChild(eb);
    } else if (!b.asm) tb.appendChild(SW.el('span', { class: 'hint' }, 'No source survives.'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    if (b.v.build && SW.edition) tb.appendChild(SW.edition.menu(function () { return build; }));
    // one Export menu: the listing (as shown, or the annotated lines only) to Word or
    // Markdown, or the annotations with their lines into My notes
    var exm = SW.el('details', { class: 'menu more-menu' });
    exm.innerHTML = '<summary class="btn" title="Export this version’s listing, or put its annotations in My notes">⤓ Export ▾</summary><div class="menu-body">' +
      '<p class="hint">The listing, as shown</p><button class="btn ghost" data-ex="all:docx">⤓ Word</button><button class="btn ghost" data-ex="all:md">⤓ Markdown</button>' +
      '<p class="hint">The annotated lines only</p><button class="btn ghost" data-ex="noted:docx">⤓ Word</button><button class="btn ghost" data-ex="noted:md">⤓ Markdown</button>' +
      '<p class="hint">Private</p><button class="btn ghost" data-ex="noted:tray" title="Each annotation with the lines it covers, as one excerpt in My notes">＋ My notes: the annotations</button></div>';
    exm.addEventListener('click', function (e) {
      var x = e.target.closest('[data-ex]'); if (!x) return;
      exm.open = false;
      var k = x.dataset.ex.split(':'), noted = k[0] === 'noted';
      var dp = listingDoc(b, null, { onlyNoted: noted });
      if (k[1] === 'tray') { dp.then(function (d) { if (!d.blocks.some(function (bl) { return bl.type === 'code'; })) { SW.toast('No annotations on this version yet.'); return; } SW.tray.addDoc(d); }); return; }
      Promise.resolve(dp).then(function (d) { SW.exportDoc(d, 'shrdlu-' + b.v.id + (noted ? '-annotations' : '-listing'), k[1]); });
    });
    tb.appendChild(exm);
    tb.appendChild(SW.el('button', { class: 'btn notes-mode', id: 'rd-notes-mode', onclick: function () {
      var i = MODES.indexOf(modeOf(opts.notes));
      setNotes(MODES[(i + 1) % MODES.length][0]);
    } }));
    view.appendChild(tb);

    if (!b.v.build) {
      var lost = SW.el('div', { class: 'pad prose' });
      lost.innerHTML = '<h2>' + SW.esc(b.v.label) + '</h2><p>' + SW.esc(b.v.summary) + '</p><p class="muted">What is absent is also part of the record. Annotations on this version can still be kept under “Versions”.</p>';
      view.appendChild(lost);
      return;
    }
    view.appendChild(SW.el('div', { class: 'selbar', id: 'rd-selbar' }));
    renderListing();
    wireTb(tb);
    modeBtn();
  }

  // The listing alone, so choosing a tape keeps the toolbar (and a search) as it is.
  function renderListing() {
    var b = build, info = tapeInfo(b), bar = SW.$('#rd-selbar', view);
    SW.$$('.rd-body', view).forEach(function (x) { x.remove(); });
    var wrap = SW.el('div', { class: 'rd-body' + (marginOn() ? ' with-margin' : '') });
    var box = SW.el('div', { class: 'listing' + (opts.words ? '' : ' hide-words') + (opts.repairs ? '' : ' no-repairs') });
    var margin = SW.el('div', { class: 'note-margin', 'aria-label': 'Annotations' });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-asmerrs]')) { e.stopPropagation(); SW.asmErrors(b); return; }
      var kc = e.target.closest('[data-kin]'), kr = kc ? b.repairs.filter(function (r) { return r.id === kc.dataset.kin; })[0] : null;
      if (!kr && e.target.closest('.ln.kin .n') && !e.target.closest('.qa')) { var row = e.target.closest('.ln'); kr = b.kin[row.dataset.p + ':' + row.dataset.n]; }
      if (kr) { e.stopPropagation(); SW.repairPop(kr, e.clientX, e.clientY); }
    });
    b.parts.forEach(function (part, pi) {
      if (!showsTape(pi)) return;
      var t = info[pi], sec = SW.el('div', { class: 'part' });
      var errs = b.asm.errors.filter(function (e) { return e.file === pi; }).length;
      var span = part.end ? 'lines ' + part.title + '–' + part.end : part.title > 1 ? 'from line ' + part.title : 'whole file';
      sec.innerHTML = '<div class="part-head" data-p="' + pi + '">' +
        '<div class="ph-main">' + (b.parts.length > 1 ? '<span class="ph-num">File ' + (pi + 1) + ' of ' + b.parts.length + '</span>' : '') +
        '<span class="ph-title">' + SW.esc(t.label) + '</span> ' + SW.refTag(b.v.id, pi, null, null, b.parts.length) +
        (errs ? '<button class="badge err" data-asmerrs title="What the error' + (errs > 1 ? 's are' : ' is') + ', explained">' + errs + ' bracket error' + (errs > 1 ? 's' : '') + '</button>' : '') + '</div>' +
        (b.kinFiles && b.kinFiles[pi] ? '<div class="ph-kin">' + b.kinFiles[pi].map(function (r) { return '<button class="kin-chip rp-m-' + SW.esc(r.mend || '') + '" data-kin="' + SW.esc(r.id) + '" title="' + SW.esc('Kintsugi · ' + SW.mendOf(r).label + ': ' + r.what) + '">◆ ' + SW.esc(r.id) + ' ' + SW.esc(r.title) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="ph-sub"><span class="ph-lang" title="What this file is written in">' + SW.esc(SW.fileLangOf(part.src, part.role)) + '</span> · ' + SW.sourceLink(part.src, part.src.split('/').pop()) +
        ' · ' + ({ program: 'read in by the loader', support: 'a support file', doc: 'documentation' }[part.role] || 'text file') + ' · ' + b.lines[pi].length + ' lines' +
        (t.title && part.role !== 'doc' ? ' · <span title="Its first comment">“' + SW.esc(t.title.slice(0, 90)) + '”</span>' : '') + '</div>' +
        '<div class="lncols"><span class="n" title="The line’s number in the source file">Line</span>' +
        '<span class="a" title="Where the line’s first word was placed in core memory, in octal (0000–7777)">Address</span>' +
        '<span class="w" title="The 18-bit machine word the line assembled to, in octal; “+N” means N more words followed (hover a row for the count)">Word <button class="colfold" data-cf="0" title="Fold away Address and Word, for more room (View ▸ Addresses &amp; words brings them back too)">‹</button></span>' +
        '<span class="t" title="The source as written (or as the assembler read it, with Normalised text on in View)"><button class="colfold cf-show" data-cf="1" title="Show Address and Word">›</button>Source</span>' +
        '<span class="mk" title="Initials of anyone who has annotated the line; click them to read">Annotations<button class="ann-cyc" data-ann title="Show all annotations, only yours, only open questions, or none (click to change)">' + SHOW[opts.show] + '</button><button class="ann-cyc ghost-sw' + (opts.ghosts ? ' on' : '') + '" data-ghosts aria-pressed="' + !!opts.ghosts + '" title="Ghosts: annotations made on other versions, shown faintly on the lines here that match">Ghosts</button></span></div></div>';
      sec.insertAdjacentHTML('beforeend', b.lines[pi].filter(function (L) { return !L.away; }).map(function (L) { return rowHTML(b, L); }).join(''));
      box.appendChild(sec);
    });
    wrap.appendChild(box);
    wrap.appendChild(margin);
    view.insertBefore(wrap, bar);
    wireBox(box);
    paintKin(box, b);
    wireMargin(margin);
    applyFilter();
    paintSel();
    // Cards placed while Read was hidden all measure 0: place them again when it shows.
    if (ro) ro.disconnect();
    if (root.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (!marginOn() || !wrap.getClientRects().length) return;
        K.refit();
      });
      ro.observe(wrap);
    }
  }

  function wireBox(box) {
    K.wireLit(box, '.ithread'); K.wireDrop(box);
    box.addEventListener('click', function (e) {
      var cf = e.target.closest('[data-cf]');
      if (cf) { setWords(cf.dataset.cf === '1'); return; }
      if (e.target.closest('[data-ghosts]')) {
        opts.ghosts = !opts.ghosts; SW.store.set('read.ghosts', opts.ghosts);
        SW.$$('[data-ghosts]', view).forEach(function (b) { b.classList.toggle('on', opts.ghosts); b.setAttribute('aria-pressed', String(opts.ghosts)); });
        if (opts.ghosts) SW.toast('Looking for annotations on the other versions…', 2500);
        loadGhosts().then(function () {
          paintNotes();
          if (opts.ghosts) SW.toast(K.ghostCount() ? K.ghostCount() + ' ghost annotation' + (K.ghostCount() === 1 ? '' : 's') + ' from other versions' : 'No annotations on other versions match lines here', 3500);
        });
        return;
      }
      if (e.target.closest('[data-ann]')) {
        opts.show = SHOW_NEXT[opts.show] || 'all'; SW.store.set('read.show', opts.show);
        SW.$$('[data-ann]', view).forEach(function (b) { b.textContent = SHOW[opts.show]; });
        paintNotes();
        SW.toast(opts.show === 'all' ? 'Showing all annotations' : opts.show === 'mine' ? 'Showing only your annotations' : opts.show === 'open' ? 'Showing only open questions' : 'Annotations hidden', 2500);
        return;
      }
      if (e.target.closest('.part-head')) return;   // tape headers only label (their source link opens GitHub)
      if (e.target.closest('.inote')) { threadClick(e); return; }   // note buttons are wired by N.wire
      // +A by a line number: a quick annotation on that line, or on the selection it is in
      var qa = e.target.closest('.qa');
      if (qa) {
        var qr = qa.closest('.ln'), qp = +qr.dataset.p, qn = +qr.dataset.n, s0 = SW.state.sel;
        var r0 = s0 && s0.p === qp && qn >= s0.n0 && qn <= s0.n1 ? s0 : { p: qp, n0: qn, n1: qn };
        SW.state.sel = r0; paintSel(); SW.writeQuery();
        annotateSel();
        return;
      }
      var dot = e.target.closest('.note-dot');
      if (dot) { showNotesFor(dot.dataset.k); return; }
      var sym = e.target.closest('.sym');
      if (sym) { symbolPop(sym.dataset.s, e.clientX, e.clientY); return; }
      var row = e.target.closest('.ln');
      if (!row) return;
      var p = +row.dataset.p, n = +row.dataset.n;
      
      if (e.shiftKey && anchorSel && anchorSel.p === p) {
        SW.state.sel = { p: p, n0: Math.min(anchorSel.n, n), n1: Math.max(anchorSel.n, n) };
      } else {
        anchorSel = { p: p, n: n };
        SW.state.sel = { p: p, n0: n, n1: n };
      }
      paintSel();
      SW.writeQuery();
      var k = p + ':' + n;
      if (counts[k] && opts.notes !== 'hide') {
        var card = opts.notes !== 'off' && threadFor(k);
        if (card) { card.scrollIntoView({ block: 'nearest' }); card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 900); }
        else showNotesFor(k);
      }
    });
  }

  // Address and Word shown or folded away: from View, or the chevron in the column headings
  function setWords(on) {
    opts.words = on; SW.store.set('read.words', on);
    var box = SW.$('.listing', view), cb = SW.$('#rd-words', view);
    if (box) box.classList.toggle('hide-words', !on);
    if (cb) cb.checked = on;
    if (build && SW.$('.rd-body', view)) paintNotes();
  }
  // ↶ ↷: undo and redo what was done to annotations (notes.js keeps the steps)
  function paintUndo() {
    var u = SW.$('#rd-undo', view), r = SW.$('#rd-redo', view); if (!u) return;
    var h = N.history();
    u.disabled = !h.undo || h.busy; r.disabled = !h.redo || h.busy;
    u.title = h.undo ? 'Undo ' + h.undo + ' (⌘Z)' : 'Undo: nothing to undo yet';
    r.title = h.redo ? 'Redo ' + h.redo + ' (⇧⌘Z)' : 'Redo: nothing to redo';
  }
  SW.on('notes-history', paintUndo);
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

  function wireTb(tb) {
    SW.$('#rd-kprev', tb).onclick = function () { kinStep(-1); };
    SW.$('#rd-knext', tb).onclick = function () { kinStep(1); };
    var kb = SW.el('div', { class: 'kin-bar', role: 'toolbar', 'aria-label': 'Repairs' }); kb.hidden = true;
    tb.appendChild(kb);
    SW.$('#rd-klist', tb).onclick = function () { opts.kinBar = !opts.kinBar; SW.store.set('read.kinBar', opts.kinBar); kinBar(); };
    kb.addEventListener('click', function (e) { var b = e.target.closest('[data-km]'); if (b && b.tagName !== 'INPUT' && !b.disabled) { e.preventDefault(); kinAct(b.dataset.km, b); if (!/^(close|list|about|card|cards|why)$/.test(b.dataset.km)) kinBar(); } });
    kb.addEventListener('change', function (e) { var b = e.target.closest('[data-km]'); if (b) { kinAct(b.dataset.km, b); kinBar(); } });
    setTimeout(kinPaint, 0);
    SW.$('#rd-undo', tb).onclick = function () { N.undo(); };
    SW.$('#rd-redo', tb).onclick = function () { N.redo(); };
    setTimeout(paintUndo, 0);
    var tapeSel = SW.$('#rd-tape', tb);
    if (tapeSel) tapeSel.onchange = function () { opts.tapes = tapeSel.value; SW.store.set('read.file', tapeSel.value); renderListing(); view.scrollTop = 0; };
    SW.$('#rd-repairs', tb).onchange = function (e) { opts.repairs = e.target.checked; SW.store.set('read.repairs', opts.repairs); SW.$$('.listing', view).forEach(function (x) { x.classList.toggle('no-repairs', !opts.repairs); }); };
    SW.$('#rd-noted', tb).onchange = function (e) { opts.onlyNoted = e.target.checked; applyFilter(); view.scrollTop = 0; };
    SW.$('#rd-by', tb).onchange = function (e) { opts.by = e.target.value; applyFilter(); view.scrollTop = 0; };
    fillBy();

    var find = SW.$('#rd-find', tb), hits = [], hi = -1;
    function search() {
      SW.$$('.ln.cur', view).forEach(function (e) { e.classList.remove('cur'); });
      hits = [];
      var q = find.value;
      if (!q) { SW.$('#rd-hits', tb).textContent = ''; return; }
      var re;
      try { re = /^\/.*\/$/.test(q) ? new RegExp(q.slice(1, -1), 'i') : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
      catch (err) { SW.$('#rd-hits', tb).textContent = 'bad pattern'; return; }
      var keep = filtering() ? keptLines() : null;
      build.lines.forEach(function (ls, pi) { ls.forEach(function (L) { if (!L.away && re.test(L.raw) && (!keep || keep[L.p + ':' + L.n])) hits.push(L); }); });
      SW.$('#rd-hits', tb).textContent = hits.length + ' match' + (hits.length === 1 ? '' : 'es');
      hi = -1; step(1);
    }
    function step(d) {
      if (!hits.length) return;
      hi = (hi + d + hits.length) % hits.length;
      R.goto(hits[hi].p, hits[hi].n, true);
    }
    find.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.shiftKey ? step(-1) : (hits.length && find.dataset.q === find.value ? step(1) : (find.dataset.q = find.value, search())); } });
    SW.$('#rd-next', tb).onclick = function () { if (find.dataset.q !== find.value) { find.dataset.q = find.value; search(); } else step(1); };
    SW.$('#rd-prev', tb).onclick = function () { step(-1); };
  }

  function toggleExpansion(row, p, n) {
    var nx = row.nextElementSibling;
    if (nx && nx.classList.contains('expansion')) { nx.remove(); return; }
    var ws = (build.asm.byLine[p] || [])[n];
    if (!ws) return;
    var h = ws.map(function (w) {
      var ex = SW.profile && SW.profile.build === build ? SW.profile.exec[w.loc] : null;
      return SW.oct(w.loc, 4) + '  ' + SW.oct(w.val) + '  ' + SW.esc(root.PDP1CPU.disasm(w.val, build.symAt)) +
        (w.macro ? '  <span class="faint">(macro ' + SW.esc(w.macro) + ')</span>' : '') +
        (w.kind ? '  <span class="faint">(' + w.kind + ')</span>' : '') +
        (ex ? '  <span class="num">×' + ex + '</span>' : '');
    }).join('\n');
    var d = SW.el('div', { class: 'expansion' }, h);
    d.style.whiteSpace = 'pre';
    row.insertAdjacentElement('afterend', d);
  }

  function symbolPop(name, x, y) {
    var b = build, s = b.sym[name];
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
    var pop = SW.pop(x, y, h);
    pop.addEventListener('click', function (e) {
      var bio = e.target.closest('a[data-bio]');
      if (bio) { e.preventDefault(); SW.unpop(); SW.biography(bio.dataset.bio); return; }
      var a = e.target.closest('a[data-n]');
      if (!a) return;
      e.preventDefault();
      SW.unpop();
      R.goto(+a.dataset.p, +a.dataset.n, true);
    });
  }

  var openNotesKey = null, binInPanel = false;
  function showNotesFor(k, quiet) {
    var parts = k.split(':'), p = +parts[0], n = +parts[1];
    var ts = N.threads(notes).filter(function (t) { return t.note.anchor && t.note.anchor.p === p && t.note.anchor.n0 === n; });
    var c = counts[k], n1 = c ? c.n1 : n;
    // No citation here: the version and file are in the page title and part
    // header, and every thread in this panel is on the line just clicked.
    void n1;
    var html = '<p style="margin-top:0"><button class="btn" data-act="new">✎ Annotate this line</button> ' +
      '<button class="btn" data-act="bin" title="Deleted annotations on this version: restore them, or delete them for good">🗑 Bin</button></p>' +
      (ts.map(function (t) { return N.renderThread(t, null); }).join('') || '<p class="hint">No annotations yet.</p>') +
      '<div class="panel-bin"' + (binInPanel ? '' : ' hidden') + '><h4>Deleted annotations</h4><div></div></div>';
    var body = SW.drawer('Annotations', html);
    body.dataset.notes = k;
    openNotesKey = k;
    N.wire(body, build.v.id, notes);
    var pb = body.querySelector('.panel-bin'), binBtn = body.querySelector('[data-act="bin"]');
    function openBin() { N.showBin(pb.lastChild, { vid: build.v.id }); }
    if (binInPanel) openBin();
    binBtn.classList.toggle('on', binInPanel);
    binBtn.onclick = function (e) {
      e.stopPropagation();
      binInPanel = pb.hidden;
      pb.hidden = !binInPanel;
      binBtn.classList.toggle('on', binInPanel);
      if (binInPanel) { openBin(); pb.scrollIntoView({ block: 'nearest' }); }
    };
    body.querySelector('[data-act="new"]').onclick = function () {
      var L = build.lines[p][n - 1];
      N.dialog({ vid: build.v.id, kind: 'line', anchor: { p: p, n0: n, n1: n, src: build.parts[p].src }, quote: L ? L.raw : '',
                 heading: 'Annotate', anchorText: SW.cite(build, p, n, n) });
    };
    void quiet;
  }

  R.goto = function (p, n, flash) {
    // A line on a tape not shown (a search hit, a note, a link): show every tape.
    if (build.parts[p] && !showsTape(p)) {
      opts.tapes = String(p);
      var ts = SW.$('#rd-tape', view);
      if (ts) ts.value = String(p);
      renderListing();
    }
    var el = SW.$('#L' + p + '-' + n, view);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    if (flash) {
      SW.$$('.ln.cur', view).forEach(function (e) { e.classList.remove('cur'); });
      el.classList.add('cur');
    }
  };

  // ---------- notes filter ----------
  // Lines covered by notes, limited to those in which the chosen initials take part.
  function keptLines() {
    var keep = {};
    if (opts.onlyRepaired) {
      kinStops().forEach(function (s) { for (var n = s.n0 - 2; n <= s.n1 + 2; n++) keep[s.p + ':' + n] = true; });
      if (!opts.onlyNoted && !opts.by) return keep;
    }
    Object.keys(counts).forEach(function (k) {
      var c = counts[k];
      if (opts.by && c.by.indexOf(opts.by) < 0) return;
      for (var n = c.n0; n <= c.n1; n++) keep[c.p + ':' + n] = true;
    });
    return keep;
  }
  function filtering() { return opts.onlyNoted || !!opts.by || !!opts.onlyRepaired; }
  function fillBy() {
    var sel = SW.$('#rd-by', view);
    if (!sel) return;
    var who = {};
    Object.keys(counts).forEach(function (k) { counts[k].by.forEach(function (x) { who[x] = 1; }); });
    if (opts.by) who[opts.by] = 1;
    sel.innerHTML = '<option value="">anyone</option>' + Object.keys(who).sort().map(function (x) {
      return '<option value="' + SW.esc(x) + '"' + (x === opts.by ? ' selected' : '') + '>' + SW.esc(x) + '</option>';
    }).join('');
  }
  function applyFilter() {
    var on = filtering(), keep = on ? keptLines() : null, shown = 0, gap = false;
    SW.$$('.listing .ln', view).forEach(function (row) {
      var k = row.dataset.p + ':' + row.dataset.n, hide = on && !keep[k];
      row.classList.toggle('nf-hide', hide);
      row.classList.toggle('nf-jump', on && !hide && gap);
      if (hide) gap = true; else { gap = false; shown++; }
    });
    SW.$$('.listing .part', view).forEach(function (sec) {
      sec.classList.toggle('nf-empty', on && !SW.$('.ln:not(.nf-hide)', sec));
    });
    var out = SW.$('#rd-nf', view);
    if (out) out.textContent = on ? shown + (opts.onlyRepaired && !opts.onlyNoted && !opts.by ? ' line' + (shown === 1 ? '' : 's') + ' at the repairs' : ' annotated line' + (shown === 1 ? '' : 's') + (opts.by ? ' with ' + opts.by : '')) : '';
    var box = SW.$('.listing', view);
    if (box) {
      var none = SW.$('.nf-none', box);
      if (on && !shown && !none) box.insertBefore(SW.el('p', { class: 'hint nf-none pad' }, opts.by ? 'No annotations by ' + opts.by + ' on this version' + (opts.tapes === 'all' ? '' : ' and tape') + '.' : 'No annotated lines on this version' + (opts.tapes === 'all' ? '' : ' and tape') + ' yet.'), box.firstChild);
      else if ((!on || shown) && none) none.remove();
    }
    if (build && SW.$('.rd-body', view)) paintNotes();   // the notes follow the lines left showing
  }

  function refreshNotes() {
    if (!build) return;
    N.list(build.v.id).then(function (all) {
      notes = all; K.set({ notes: all });
      counts = N.countsByLine(all);
      noted = {};
      Object.keys(counts).forEach(function (k) {
        var c = counts[k];
        for (var n = c.n0; n <= c.n1; n++) noted[c.p + ':' + n] = true;
      });
      SW.$$('.ln', view).forEach(function (row) {
        var k = row.dataset.p + ':' + row.dataset.n, mk = row.querySelector('.mk');
        if (mk) mk.innerHTML = N.marginMark(k, counts[k]);
        row.classList.toggle('noted', !!noted[k]);
      });
      fillBy();
      applyFilter();
      if (opts.ghosts) loadGhosts(true).then(paintNotes);
      // keep an open panel current; a closed one stays closed (the refresh runs every 20 seconds)
      if (openNotesKey && SW.$('#drawer-body').dataset.notes === openNotesKey && document.body.classList.contains('drawer-open')) showNotesFor(openNotesKey, true);
    });
  }

  R.show = function (b) {
    if (build !== b && !(b.parts[+opts.tapes] || opts.tapes === 'all')) opts.tapes = '0';
    build = b; K.set({ build: b });
    R.build = b;
    SW.loadGlosses();
    render();
    refreshNotes();
    live();
    var s = SW.state.sel;
    if (s) setTimeout(function () { R.goto(s.p, s.n0, false); }, 0);
  };
  SW.on('notes', function (vid) { if (build && vid === build.v.id) refreshNotes(); });
  SW.on('goto', function (g) { if (build && g.tab === 'read') { SW.setTab('read'); setTimeout(function () { R.goto(g.p, g.n, true); paintSel(); }, 0); } });
  SW.on('profile', function () { if (opts.heat && build) render(); });
  // Lines change height with the window or the code size: the cards follow.
  var relay = null;
  window.addEventListener('resize', function () { clearTimeout(relay); relay = setTimeout(function () { if (build && marginOn()) layoutMargin(); }, 120); });
  SW.on('codetext', function () { if (build && marginOn()) setTimeout(function () { layoutMargin(); }, 50); });
})(this);
