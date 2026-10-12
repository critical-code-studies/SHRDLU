/*
 * core.js - this bench's own state and helpers: how a version is read (the MacLisp reader,
 * js/lisp.js) and indexed, its references and repairs. Fetching, the cache of builds and
 * opening a version at a line are bench-kit's (kit/builds.js), as are the helpers every bench
 * shares (kit/base.js, kit/md.js, kit/themes.js), loaded before this file.
 */
(function (root) {
  'use strict';

  var A = root.LispIndex, V = root.SWVersions;
  var SW = root.SW;   // made by kit/base.js

  SW.BASE_URI = 'https://critical-code-studies.github.io/SHRDLU/research/';
  // Split one MacLisp source line into code and comment: a comment begins at the
  // first ";" that is not escaped by "/". (labels and loc are kept empty, for the
  // views that were written for assembly listings.)
  SW.parseLine = function (raw) {
    var s = String(raw || '').replace(/\n$/, ''), ci = -1;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '/') { i++; continue; }
      if (s[i] === ';') { ci = i; break; }
    }
    return { labels: [], loc: '', code: ci >= 0 ? s.slice(0, ci) : s, comment: ci >= 0 ? s.slice(ci) : '' };
  };

  // The language a version is written in, and what a file of it is, for the
  // small type in the top bar and the file headers.
  SW.langOf = function (v) {
    if (!v) return '';
    return v.id === 'ejs' ? 'MacLisp 2156 (ITS, 2024) · Micro-Planner' : 'MacLisp 1.6 (June 1972) · Micro-Planner';
  };
  var FILE_LANG = { plnr: 'Micro-Planner, written in MacLisp', thtrac: 'Micro-Planner tracing, MacLisp', progmr: 'PROGRAMMAR, the grammar language, MacLisp', proggo: 'PROGRAMMAR, MacLisp',
    ginter: 'PROGRAMMAR interpreter, MacLisp', gramar: 'the grammar, in PROGRAMMAR', cgram: 'the grammar, precompiled PROGRAMMAR', dictio: 'the dictionary, DEFS entries in MacLisp',
    blockp: 'Micro-Planner theorems', blocks: 'the blocks world, MacLisp and Micro-Planner', blockl: 'MacLisp', data: 'Micro-Planner assertions (THDATA)', data2: 'Micro-Planner theorem names (THDATA)',
    graphf: 'MacLisp, driving the DEC 340 display', smspec: 'the semantic specialists, MacLisp', smutil: 'semantic utilities, building Micro-Planner code, MacLisp', smass: 'semantic access functions, MacLisp',
    newans: 'answering, MacLisp calling Micro-Planner', syscom: 'the top level and system commands, MacLisp', morpho: 'reading and morphology (ETAOIN), MacLisp', show: 'the Show and Tell interface, MacLisp', setup: 'start-up and switches, MacLisp', loader: 'the loader, MacLisp', init: 'a loader, MacLisp', parser: 'the parser alone, MacLisp', demo: 'the TWDEMO replay script: text between @ signs, display commands in MacLisp', twutil: 'MacLisp (TWDEMO)', macros: 'MacLisp macros' };
  SW.fileLangOf = function (src, role) {
    var base = src.split('/').pop().replace(/\.[^.]*$/, '').replace(/\.\d+$/, '').toLowerCase();
    if (role === 'doc') return 'documentation, text';
    return FILE_LANG[base] || 'MacLisp';
  };

  // A build: the files read by the MacLisp reader and indexed (kit/builds.js caches it)
  SW.builds({
    split: A.splitLines,
    read: function (v, L) {
      var b = { v: v, dialect: v.dialect, parts: L.parts, asm: v.build ? A.index(L.files) : null };
      index(b);
      return b;
    },
    meta: function () { return [['Read as', 'MacLisp 1.6 source, indexed by the bench']]; }
  });

  function index(b) {
    b.lines = b.parts.map(function (p, pi) {
      return A.splitLines(p.raw).map(function (r, i) {
        return { p: pi, n: i + 1, raw: r, norm: r, skipped: false, title: false };
      });
    });
    b.sym = {}; b.labelAt = {}; b.errorsAt = {}; b.macros = {}; b.kind = {};
    // repairs the bench makes to this version as it runs it (js/repairs.js), by line: kintsugi marks in Read
    b.repairs = root.SHRepairs ? root.SHRepairs.forVersion(b.v.id) : [];
    b.kin = {}; b.kinFiles = {};
    b.repairs.forEach(function (r) {
      if (r.kind !== 'text') return;
      b.parts.forEach(function (pt, pi) {
        if (pt.src.split('/').pop().replace(/\.\d+$/, '').toLowerCase() !== r.file.toLowerCase()) return;
        for (var n = r.n0; n <= r.n1; n++) b.kin[pi + ':' + n] = r;
        (b.kinFiles[pi] = b.kinFiles[pi] || []).push(r);
      });
    });
    b.srcOf = function () { return null; };
    b.symAt = function () { return null; };
    if (!b.asm) return;
    b.asm.symbols.forEach(function (s) { b.sym[s.name] = s; });
    b.asm.errors.forEach(function (e) { var k = e.file + ':' + e.line; (b.errorsAt[k] = b.errorsAt[k] || []).push(e); });
    b.asm.macros.forEach(function (m) { b.macros[m.name] = m; });
    // What each line is, for the marks in Read: def (a definition begins here),
    // eq (a global set at top level), com (a line of comment only).
    b.lines.forEach(function (ls, pi) {
      var by = b.asm.defsByLine[pi] || {};
      ls.forEach(function (L) {
        var k = pi + ':' + L.n, d = by[L.n];
        if (d) { b.kind[k] = d.kind === 'VAR' ? 'eq' : 'def'; return; }
        var pl = SW.parseLine(L.raw);
        if (!pl.code.trim() && pl.comment.replace(/^;+/, '').trim()) b.kind[k] = 'com';
      });
    });
  }

  // The bench's references to its sources (Help ▸ Referencing and versions):
  // SH, then a letter for the witness, then the file and lines:
  // [REF: SHI, smspec.94:712–714]. I: the MIT files as found on ITS; S: Winograd's
  // Stanford distribution; E: Eric Swenson's 2024 restoration. Lost versions are
  // named without a letter.
  SW.REF = { mit: 'SHI', stanford: 'SHS', ejs: 'SHE', jan71: 'SH-JAN71', c1: 'SH-C1' };
  // SHRDLU was not ported in the Spacewar! sense; later re-creations are listed here.
  SW.PORTS = [
    ['SHP-CL-PENLU', 'SHRDLU, minimally modified for Common Lisp', 'Common Lisp (clisp)', 'github.com/penlu/shrdlu', 'after 2000', ''],
    ['SHP-UMR-JAVA3D', 'SHRDLU resurrection (console and Java 3D)', 'Common Lisp and Java', 'University of Missouri–Rolla student project (preserved via semaphorecorp)', 'c. 2002', ''],
    ['SHP-VANBERGEN-2023', 'Blocks World (a replication of the dialogue, not a port)', 'Web', 'Patrick van Bergen', '2023', '']
  ];
  // When the text we hold was made, where it is not the version's own date.
  SW.MADE = { mit: 'recovered from ITS backup tapes and imported unedited into PDP-10/its, 24 July 2024 (commit ace4248f)',
    stanford: 'Winograd’s code directory as distributed from Stanford, files dated 16 September 1997',
    ejs: 'edited by Eric Swenson, July to August 2024 (PDP-10/its at commit 173f8220)' };
  // ---------- repairs: kintsugi ----------
  var KIND = { text: 'A passage read from another copy', load: 'What the loader reads', form: 'Lisp run before the program starts', start: 'How the bench starts it' };
  function mendOf(r) { var M = root.SHRepairs && root.SHRepairs.MENDS; return (M && M[r.mend]) || { label: KIND[r.kind] || r.kind, note: '' }; }
  SW.mendOf = mendOf;
  SW.repairPop = function (r, x, y) {
    var m = mendOf(r);
    SW.pop(x, y, '<h4 class="kin-h">Kintsugi · ' + SW.esc(r.id) + ': ' + SW.esc(r.title) + '</h4><div class="faint"><span class="rp-chip rp-m-' + SW.esc(r.mend || '') + '">' + SW.esc(m.label) + '</span> ' + SW.esc(m.note) + '. ' + SW.esc(KIND[r.kind] || r.kind) + '.</div>' +
      '<p><b>What.</b> ' + SW.esc(r.what) + '</p><p><b>Why.</b> ' + SW.esc(r.why) + '</p><p class="faint"><b>Evidence.</b> ' + SW.esc(r.evidence) + '</p>' +
      (r.by ? '<p class="faint"><b>By</b> ' + SW.esc(r.by) + ', ' + SW.esc(r.date || '') + '.</p>' : '') +
      '<p class="faint">The held file is not changed: the repair is made as the bench loads the version to run it (Run), and is marked here in gold.</p>');
  };
  SW.kinAbout = function () {
    return '<h4>The repair marks</h4><p>Where the bench reads a version differently in order to run it, the line is marked in gold, after kintsugi, the mending of pottery with gold, which leaves the repair in view. The held files are never altered; each repair is made as the version is loaded, and each is recorded with its reason, evidence and author on the version’s reconstruction card.</p>' +
      '<div class="keylist"><div><span class="rp-line">(QUOTE <span class="rp-c rp-c-fix">0.43</span>302)</span> corrected: a reading mended against another copy of the same file; the line underlined in gold, the characters read otherwise in a gold wash</div><div><span class="rp-line"><span class="rp-c rp-c-sup">(move-ptw</span> N</span> supplied: a passage from another copy or version, in a deeper wash</div><div>For running: how the program is loaded or started, not its text; on the reconstruction card, not in the code</div></div>' +
      '<p class="faint">After Berry, ‘Digital ruins and critical code studies’ (2025): see Help ▸ What you should read, and Help ▸ Reconstruction cards.</p>';
  };

  // Help ▸ Reconstruction cards and the card on This version (kit/helppages.js): every repair the
  // bench makes to a version to run it (js/repairs.js), and the machine it runs on
  function cardWhere(r, v) {
    if (r.kind !== 'text') return SW.refOf(v.id);
    var pi = -1; (v.build || []).forEach(function (b, k) { if (b.src.split('/').pop().replace(/\.\d+$/, '').toLowerCase() === r.file.toLowerCase()) pi = k; });
    return pi >= 0 ? SW.refOf(v.id, pi, r.n0, r.n1) : SW.refOf(v.id);
  }
  SW.BENCH.cards = {
    about: 'What the bench does to each version to run it, after the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold in Read. The files under source/ are never altered; each repair is made as the version is loaded. Corrected and supplied passages change what the program reads; changes for running (paler gold) change only how it is loaded or started.',
    subtitle: 'What the bench does to each version to run it',
    menu: 'Every repair the bench makes to run each version, marked in gold',
    kinds: (function () { var M = (root.SHRepairs && root.SHRepairs.MENDS) || {}, o = {}; Object.keys(M).forEach(function (k) { o[k] = ['rp-m-' + k, M[k].label, M[k].note]; }); return o; })(),
    head: [['id', 'Repair'], ['kind', 'Kind'], ['where', 'Where'], ['what', 'What'], ['why', 'Why'], ['evidence', 'Evidence'], ['by', 'By']],
    rows: function (v) {
      return (root.SHRepairs ? root.SHRepairs.forVersion(v.id) : []).map(function (r) {
        return { id: r.id, kind: r.mend, kindNote: KIND[r.kind] || r.kind, where: cardWhere(r, v), title: r.title, what: r.what, why: r.why, evidence: r.evidence, by: (r.by || '') + (r.date ? ', ' + r.date : '') };
      });
    },
    after: function () { return { title: 'The machine', head: ['Part', 'What the bench supplies'], rows: root.SHRepairs ? root.SHRepairs.MACHINE : [] }; },
    empty: 'No repairs.'
  };

  // ---------- reading errors (the badges in Read open this) ----------
  // The bench reads each file as MacLisp would; these are the places where the
  // parentheses do not balance, which the MacLisp reader would also have met.
  SW.asmErrors = function (b) {
    var es = (b.asm && b.asm.errors) || [];
    var d = SW.el('dialog', { class: 'tray-big' });
    d.innerHTML = '<div class="tray-bighead"><b>Reading ' + SW.esc(b.v.label) + ': ' + es.length + ' place' + (es.length === 1 ? '' : 's') + ' where the parentheses do not balance</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
      '<p class="hint">The bench reads every file as the MacLisp reader would. An unclosed parenthesis swallows the rest of its file into one form; a stray closing one is read as nothing. Either is in the text as held, not made by the bench.</p>' +
      '<table class="ov-sub"><thead><tr><th>Where</th><th>What</th></tr></thead><tbody>' +
      es.map(function (e) { return '<tr><td class="mono"><a href="#" data-p="' + e.file + '" data-n="' + e.line + '">' + SW.esc(b.parts[e.file].src.split('/').pop() + ':' + e.line) + '</a> ' + SW.refTag(b.v.id, e.file, e.line, e.line) + '</td><td>' + SW.esc(e.message) + '</td></tr>'; }).join('') +
      '</tbody></table>';
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) {
      if (ev.target === d || ev.target.closest('[data-x]')) { d.close(); return; }
      var a = ev.target.closest('a[data-p]'); if (!a) return;
      ev.preventDefault(); d.close();
      SW.openAt(b.v.id, { p: +a.dataset.p, n0: +a.dataset.n, n1: +a.dataset.n });
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  };

  // ---------- ghosts (kit/base.js, SW.ghostMatch) ----------
  // lines as keys: comments, spacing and case set aside; blank lines count for nothing
  SW.lineKey = function (t) { return SW.parseLine(t).code.replace(/[\f\u0003]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); };

})(this);
