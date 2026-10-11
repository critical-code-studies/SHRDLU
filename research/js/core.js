/*
 * core.js - this bench's own state and helpers: its texts fetched, built and indexed, its
 * references and repairs. The helpers every bench shares are in bench-kit (kit/base.js,
 * kit/md.js, kit/themes.js), loaded before this file.
 *
 * A "build" is one version fetched, normalised and assembled: the unit that
 * every view reads from. Builds are cached, so moving between views or
 * comparing versions never reassembles needlessly.
 */
(function (root) {
  'use strict';

  var A = root.LispIndex, V = root.SWVersions;
  var SW = root.SW;   // made by kit/base.js

  SW.BASE_URI = 'https://critical-code-studies.github.io/SHRDLU/research/';
  SW.oct = function (n, w) { if (n == null) return ''; var s = (n >>> 0).toString(8); while (s.length < (w || 6)) s = '0' + s; return s; };
  // The Spacewar! bench probed its emulator for the control bits; SHRDLU has no
  // controls to probe, so this answers nothing.
  SW.controlMap = function () { return Promise.resolve(null); };

  // Displays a version draws on. 4.4 (the dual-console version) addresses a second
  // display with the instruction 720407 (dpy-i 400 in dj6): DEC's 1963 handbook
  // (F-15D) gives 720407 as dpp, display one point on the second CRT (Type 31),
  // beside dpy 720007 for the Type 30. Each of its frames goes to one of the two.
  SW.scopeCount = function (b) { return b && b.sym && b.sym.dj6 ? 2 : 1; };
  SW.scopeOf = function (b, md) { return SW.scopeCount(b) === 2 && md != null && (md & 0o777) === 0o407 ? 2 : 1; };

  // ---------- fetching and building ----------
  var textCache = {};
  SW.fetchText = function (path) {
    if (textCache[path]) return textCache[path];
    var url = V.SRC + path.split('/').map(encodeURIComponent).join('/');
    // revalidated, so a corrected transcription is not served from an old cache
    textCache[path] = fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Could not fetch ' + path + ' (' + r.status + ')');
      return r.text();
    });
    return textCache[path];
  };
  SW.fetchBytes = function (path) {
    var url = V.SRC + path.split('/').map(encodeURIComponent).join('/');
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Could not fetch ' + path);
      return r.arrayBuffer();
    }).then(function (b) { return new Uint8Array(b); });
  };

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

  // Build = fetch + read + index. Cached per version.
  var buildCache = {};
  SW.build = function (id) {
    var v = V.byId(id);
    if (!v) return Promise.reject(new Error('Unknown version ' + id));
    var key = id;
    if (buildCache[key]) return buildCache[key];
    buildCache[key] = V.load(v, SW.fetchText, A.splitLines).then(function (L) {
      var t0 = performance.now();
      var asm = v.build ? A.index(L.files) : null;
      var b = { v: v, dialect: v.dialect, parts: L.parts, asm: asm, ms: 0 };
      index(b);
      b.ms = Math.round(performance.now() - t0);
      return b;
    });
    buildCache[key].catch(function () { delete buildCache[key]; });
    return buildCache[key];
  };

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

  // Open a version at a line range (or its notes page when there is none).
  SW.openAt = function (vid, a) {
    var same = !vid || vid === SW.state.v;
    if (!same) SW.select(vid);
    if (!a) { SW.setTab('about'); return; }
    SW.state.sel = { p: a.p, n0: a.n0, n1: a.n1 != null ? a.n1 : a.n0 };
    SW.setTab('read');   // draws Read at the selection if it was not yet showing this version
    if (same) SW.emit('goto', { p: a.p, n: a.n0, tab: 'read' });
  };
  SW.current = function () { return SW.state.v ? SW.build(SW.state.v) : Promise.reject(new Error('no version')); };

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
  // A source file's SWHID (swh:1:cnt:, its git blob hash; js/swhid.js); with the
  // repository as origin, its path, and lines where they are lines of the file.
  SW.SWHID_ORIGIN = 'https://github.com/critical-code-studies/SHRDLU';
  SW.swhidOf = function (path) { var h = SW.SWHID && SW.SWHID[path]; return h ? 'swh:1:cnt:' + h[0] : ''; };
  // a link that works now: GitHub, at the last commit that changed the file, to the lines
  SW.permalinkOf = function (path, n0, n1) {
    var h = SW.SWHID && SW.SWHID[path]; if (!h) return '';
    return SW.SWHID_ORIGIN + '/blob/' + h[1] + '/source/' + path.split('/').map(encodeURIComponent).join('/') + (n0 != null ? '#L' + n0 + (n1 && n1 !== n0 ? '-L' + n1 : '') : '');
  };
  SW.swhidURL = function (id) { return 'https://archive.softwareheritage.org/' + id; };
  SW.swhidCite = function (path, n0, n1) {
    var id = SW.swhidOf(path); if (!id) return '';
    return id + ';origin=' + SW.SWHID_ORIGIN + ';path=/source/' + path + (n0 != null ? ';lines=' + n0 + (n1 && n1 !== n0 ? '-' + n1 : '') : '');
  };
  SW.filesOf = function (v) { var seen = {}, out = []; (v.build || []).forEach(function (b) { var f = b.src || b.tape; if (f && !seen[f]) { seen[f] = 1; out.push(f); } }); return out; };
  // The options for a version's emulated PDP-1. The CHM builds of 4.1 (2005 to 2008)
  // were made for the Computer History Museum's PDP-1, which draws intensity codes 4
  // to 7 otherwise than DEC's PDP-35-2 (as Landsteiner's emulator maps them: 4 as 7,
  // 5 and 6 as 6, 7 as 0); shown so unless Settings says otherwise.
  var CHM_INTEN = [0, 1, 2, 3, 7, 6, 6, 0];
  SW.chmInten = function (v) { return (v.id === '4.1d' || v.id === '4.1f') && SW.store.get('chmBright', true) ? CHM_INTEN : null; };
  SW.cpuOpts = function (v) {
    return { mdv: v.mdv, ctlLoad: v.ctlLoad, intenMap: SW.chmInten(v) };
  };
  // The beam's brightness for a display intensity s (-4 to 3: DEC's order 4 5 6 7 0 1 2 3,
  // PDP-35-2): 4 is seen by a photomultiplier only, 7 barely, 0 is normal, 3 brightest.
  // As an opacity, 0 for s = -4; 0.62 for s = 0, as the bench drew normal points before.
  var BEAM = [0, 0.12, 0.22, 0.34, 0.62, 0.75, 0.88, 1];
  SW.beam = function (s) { s = s == null ? 0 : s; return BEAM[Math.max(-4, Math.min(3, s)) + 4]; };
  // A version's own texts: its build less the macro tape and star table supplied to it
  SW.ownFilesOf = function (v) {
    var seen = {}, out = [];
    (v.build || []).forEach(function (b) { var f = b.src || b.tape; if (!f || seen[f] || (b.role && /^(macro fio-dec system|Expensive Planetarium star table)/.test(b.role))) return; seen[f] = 1; out.push(f); });
    return out.length ? out : SW.filesOf(v);
  };
  // Tiny SWHIDs, one per file, each copying on a click, its file named on hover
  SW.swhidTiny = function (files) {
    return files.map(function (f) { var id = SW.swhidOf(f); return id ? '<div class="swhid-row tiny"><button class="swhid mono" title="' + SW.esc(f.split('/').pop()) + ': copy ' + SW.esc(id) + '" data-copy="' + SW.esc(id) + '">' + SW.esc(id.slice(10, 22)) + '…</button> <a class="swhid-go" href="' + SW.esc(SW.swhidURL(id)) + '" target="_blank" rel="noopener" title="Open in the Software Heritage archive (once the repository is archived there)">↗</a></div>' : '<div class="swhid-row tiny faint">none</div>'; }).join('');
  };
  SW.swhidList = function (files) {
    return files.map(function (f) { var id = SW.swhidOf(f); return '<div class="swhid-row"><a class="mono" href="' + SW.esc(SW.permalinkOf(f)) + '" target="_blank" rel="noopener" title="The file on GitHub, at its last change">' + SW.esc(f.split('/').pop()) + '</a> ' + (id ? '<button class="swhid mono" title="Copy ' + SW.esc(id) + '" data-copy="' + SW.esc(id) + '">' + SW.esc(id.slice(0, 17)) + '…</button> <a class="swhid-go" href="' + SW.esc(SW.swhidURL(id)) + '" target="_blank" rel="noopener" title="Open in the Software Heritage archive (once the repository is archived there)">↗</a>' : '<span class="faint">no SWHID (not in the repository)</span>') + '</div>'; }).join('');
  };
  SW.refOf = function (vid, p, n0, n1) {
    var r = SW.REF[vid] || ('SH-' + vid);
    if (p == null) return r;
    var v = V.byId(vid), part = v && v.build && v.build[p];
    var file = part ? part.src.split('/').pop() : String(p + 1);
    return r + ', ' + file + (n0 != null ? ':' + n0 + (n1 && n1 !== n0 ? '–' + n1 : '') : '');
  };
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
  // The reconstruction card: every repair to a version, and the machine it runs on
  SW.reconstructionCard = function (v) {
    var rs = root.SHRepairs ? root.SHRepairs.forVersion(v.id) : [];
    if (!v.build) return '';
    return '<div class="kin-card"><h3>Reconstruction card: ' + SW.esc(v.label) + '</h3><p class="hint">What the bench does to run this version, after the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold where the code is shown. The files under source/ are never altered. Corrections and supplied passages change what the program reads; changes for running (paler gold) change only how it is loaded or started.</p>' +
      (rs.length ? '<table class="ov-sub"><thead><tr><th>Repair</th><th>Kind</th><th>What</th><th>Why</th><th>Evidence</th><th>By</th></tr></thead><tbody>' +
        rs.map(function (r) { var m = mendOf(r); return '<tr><td class="mono">' + SW.esc(r.id) + '</td><td><span class="rp-chip rp-m-' + SW.esc(r.mend || '') + '" title="' + SW.esc(m.note) + '">' + SW.esc(m.label) + '</span><div class="faint">' + SW.esc(KIND[r.kind] || r.kind) + '</div></td><td><b>' + SW.esc(r.title) + '.</b> ' + SW.esc(r.what) + '</td><td>' + SW.esc(r.why) + '</td><td class="faint">' + SW.esc(r.evidence) + '</td><td class="faint">' + SW.esc((r.by || '') + (r.date ? ', ' + r.date : '')) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>No repairs.</p>') +
      '<h4>The machine</h4><table class="ov-sub"><tbody>' + (root.SHRepairs ? root.SHRepairs.MACHINE : []).map(function (m) { return '<tr><td>' + SW.esc(m[0]) + '</td><td>' + SW.esc(m[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  };
  function bigDialog(title, html, cls) {
    var d = SW.el('dialog', { class: 'tray-big ' + (cls || '') });
    d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(title) + '</b><span class="refhelp-acts"><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' + html;
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return d;
  }
  SW.kinAbout = function () {
    return '<h4>The repair marks</h4><p>Where the bench reads a version differently in order to run it, the line is marked in gold, after kintsugi, the mending of pottery with gold, which leaves the repair in view. The held files are never altered; each repair is made as the version is loaded, and each is recorded with its reason, evidence and author on the version’s reconstruction card.</p>' +
      '<div class="keylist"><div><span class="rp-line">(QUOTE <span class="rp-c rp-c-fix">0.43</span>302)</span> corrected: a reading mended against another copy of the same file; the line underlined in gold, the characters read otherwise in a gold wash</div><div><span class="rp-line"><span class="rp-c rp-c-sup">(move-ptw</span> N</span> supplied: a passage from another copy or version, in a deeper wash</div><div>For running: how the program is loaded or started, not its text; on the reconstruction card, not in the code</div></div>' +
      '<p class="faint">After Berry, ‘Digital ruins and critical code studies’ (2025): see Help ▸ What you should read, and Help ▸ Reconstruction cards.</p>';
  };
  // ---------- the cards as data: for Copy, export (Word, Markdown, PNG, SVG) and My notes ----------
  function cardVersion(x) { return typeof x === 'string' ? V.byId(x) : x; }
  function cardWhere(r, v) {
    if (r.kind !== 'text') return SW.refOf(v.id);
    var pi = -1; (v.build || []).forEach(function (b, k) { if (b.src.split('/').pop().replace(/\.\d+$/, '').toLowerCase() === r.file.toLowerCase()) pi = k; });
    return pi >= 0 ? SW.refOf(v.id, pi, r.n0, r.n1) : SW.refOf(v.id);
  }
  function cardRows(v) {
    return (root.SHRepairs ? root.SHRepairs.forVersion(v.id) : []).map(function (r) {
      return [r.id, mendOf(r).label, cardWhere(r, v), r.title + '. ' + r.what, r.why, r.evidence, (r.by || '') + (r.date ? ', ' + r.date : '')];
    });
  }
  var CARD_HEAD = ['Repair', 'Kind', 'Where', 'What', 'Why', 'Evidence', 'By'];
  SW.cardText = function (x) {
    var v = cardVersion(x);
    return 'Reconstruction card: ' + v.label + ' ' + SW.refText(v.id) + ' (SHRDLU Research Bench ' + SW.VERSION + ')\n' +
      cardRows(v).map(function (r) { return r[0] + '  ' + r[1] + ', ' + r[2] + ': ' + r[3] + ' Why: ' + r[4] + ' Evidence: ' + r[5] + '. By ' + r[6] + '.'; }).join('\n') +
      '\nThe machine: ' + (root.SHRepairs ? root.SHRepairs.MACHINE : []).map(function (m) { return m[0] + ': ' + m[1]; }).join(' ');
  };
  function cardBlocks(v) {
    var rows = cardRows(v);
    return [{ type: 'h2', text: 'Reconstruction card: ' + v.label + ' ' + SW.refText(v.id) }]
      .concat(rows.length ? [{ type: 'table', head: CARD_HEAD, rows: rows }] : [{ type: 'p', text: 'No repairs.' }])
      .concat([{ type: 'h3', text: 'The machine' }, { type: 'table', head: ['Part', 'What the bench supplies'], rows: (root.SHRepairs ? root.SHRepairs.MACHINE : []).map(function (m) { return [m[0], m[1]]; }) }]);
  }
  SW.cardDoc = function (xs) {
    var vs = xs.map(cardVersion);
    return { title: vs.length === 1 ? 'Reconstruction card: ' + vs[0].label : 'SHRDLU reconstruction cards',
      subtitle: 'What the bench does to each version to run it',
      meta: [['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION], ['Bench', SW.BASE_URI]],
      blocks: [{ type: 'p', text: 'After the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold in Read. The files under source/ are never altered; each repair is made as the version is loaded. Corrected and supplied passages change what the program reads; changes for running change only how it is loaded or started.' }]
        .concat([].concat.apply([], vs.map(cardBlocks))) };
  };
  // the card as an SVG table, for PNG and SVG export and for My notes
  SW.cardSVG = function (x) {
    var v = cardVersion(x), rows = cardRows(v), W = 1500, pad = 24, cols = [70, 110, 190, 330, 390, 250, 110], fs = 13, lh = 17, cw = fs * 0.56;
    function wrap(s, w) {
      var n = Math.max(4, Math.floor((w - 10) / cw)), out = [], line = '';
      String(s).split(/\s+/).forEach(function (wd) { if ((line + ' ' + wd).trim().length > n) { if (line) out.push(line); line = wd; while (line.length > n) { out.push(line.slice(0, n)); line = line.slice(n); } } else line = (line + ' ' + wd).trim(); });
      if (line) out.push(line); return out;
    }
    var esc = SW.esc, o = [], y = pad + 26;
    o.push('<text x="' + pad + '" y="' + y + '" font-size="22" font-weight="600" fill="#9a7400">Reconstruction card: ' + esc(v.label) + '</text>');
    y += 22; o.push('<text x="' + pad + '" y="' + y + '" font-size="12" fill="#666" font-family="IBM Plex Mono, monospace">' + esc(SW.refText(v.id)) + '  ·  SHRDLU Research Bench ' + esc(SW.VERSION) + ', ' + esc(SW.fmtDate(SW.today())) + '</text>');
    y += 26;
    var xs = [pad]; cols.forEach(function (c, i) { xs.push(xs[i] + c); });
    CARD_HEAD.forEach(function (h, i) { o.push('<text x="' + (xs[i] + 4) + '" y="' + y + '" font-size="' + fs + '" font-weight="600" fill="#222">' + h + '</text>'); });
    y += 8; o.push('<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" stroke="#9a7400"/>');
    rows.forEach(function (r) {
      var cells = r.map(function (c, i) { return wrap(c, cols[i]); }), h = Math.max.apply(null, cells.map(function (c) { return c.length; })) * lh + 8;
      cells.forEach(function (c, i) { c.forEach(function (ln, k) { o.push('<text x="' + (xs[i] + 4) + '" y="' + (y + 16 + k * lh) + '" font-size="' + fs + '" fill="' + (i === 1 ? '#9a7400' : i >= 5 ? '#666' : '#222') + '"' + (i === 0 || i === 2 ? ' font-family="IBM Plex Mono, monospace"' : '') + '>' + esc(ln) + '</text>'); }); });
      y += h; o.push('<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '" stroke="#ddd"/>');
    });
    y += pad;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + y + '" width="' + W + '" height="' + y + '" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif"><rect width="' + W + '" height="' + y + '" fill="#fffdf6"/><rect x="0" y="0" width="5" height="' + y + '" fill="#d4af37"/>' + o.join('') + '</svg>';
  };
  // Copy, export or keep a card: k is copy | docx | md | png | svg | keep | docx-all | md-all
  SW.cardAct = function (k, x) {
    var v = cardVersion(x), all = V.VERSIONS.filter(function (w) { return w.build; }).sort(function (a, b) { return a.sort - b.sort; }), base = 'shrdlu-reconstruction-card-' + SW.refOf(v.id);
    if (k === 'copy') SW.copyText(SW.cardText(v), 'the reconstruction card');
    else if (k === 'keep') { if (SW.tray) SW.tray.addDoc(SW.cardDoc([v]), { vid: v.id, tags: ['repair', 'reconstruction card'] }); }
    else if (k === 'svg') root.SWExport.download(base + '.svg', SW.cardSVG(v), 'image/svg+xml');
    else if (k === 'png') { SW.toast('Rendering PNG…'); SW.figures.svgToPNG(SW.cardSVG(v), 2, '#fffdf6').then(function (r) { root.SWExport.download(base + '.png', r.png, 'image/png'); }, function () { SW.toast('The PNG could not be made; try SVG.', 6000); }); }
    else if (k === 'keep-fig') { if (SW.tray) SW.tray.addFigure(SW.cardSVG(v), 'Reconstruction card: ' + v.label); }
    else if (/-all$/.test(k)) SW.exportDoc(SW.cardDoc(all), 'shrdlu-reconstruction-cards', k.replace('-all', ''));
    else SW.exportDoc(SW.cardDoc([v]), base, k);
  };
  // the actions, as a bar: in the card dialog and on Run's card tab
  SW.cardBar = function () {
    return '<span class="refhelp-acts card-acts"><button class="btn ghost" data-cx="copy" title="This card as plain text, with its references">⧉ Copy</button>' +
      '<details class="menu more-menu"><summary class="btn ghost" title="This card, or every card, as a file">⤓ Export ▾</summary><div class="menu-body">' +
      '<button class="btn ghost" data-cx="docx">⤓ This card, Word</button><button class="btn ghost" data-cx="md">⤓ This card, Markdown</button>' +
      '<button class="btn ghost" data-cx="png">⤓ This card, PNG</button><button class="btn ghost" data-cx="svg">⤓ This card, SVG</button>' +
      '<button class="btn ghost" data-cx="docx-all">⤓ All cards, Word</button><button class="btn ghost" data-cx="md-all">⤓ All cards, Markdown</button></div></details>' +
      '<details class="menu more-menu"><summary class="btn ghost" title="Put this card in My notes (private), to gather with others for a chapter">＋ My notes ▾</summary><div class="menu-body">' +
      '<button class="btn ghost" data-cx="keep">＋ As text and a table</button><button class="btn ghost" data-cx="keep-fig">＋ As a figure</button></div></details></span>';
  };
  // One card at a time, chosen from the versions the bench runs
  function cardDialog(x) {
    var vs = V.VERSIONS.filter(function (w) { return w.build; }).sort(function (a, b) { return a.sort - b.sort; }), esc = SW.esc;
    var v0 = cardVersion(x), cur = v0 && v0.build ? v0.id : vs[0].id;
    var d = SW.el('dialog', { class: 'tray-big refhelp cardshelp' });
    d.innerHTML = '<div class="tray-bighead"><b>Reconstruction cards</b><span class="refhelp-acts">' + SW.cardBar() + '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<p>What the bench does to each version to run it, after the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold in Read. The files under source/ are never altered.</p>' +
      '<div class="keylist"><div><span class="rp-chip rp-m-hibi">Corrected</span> a reading corrected against another copy of the same file</div><div><span class="rp-chip rp-m-yobitsugi">Supplied</span> a passage supplied from another copy or version</div><div><span class="rp-chip rp-m-kake">Remade</span> code written where none survives (none so far)</div><div><span class="rp-chip rp-m-mount">For running</span> a change to how the program is loaded or started, not to its text</div></div>' +
      '<div class="kin-pick"><button class="btn ghost" data-cx="prev" title="The previous version">‹</button><select aria-label="Version">' +
      vs.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === cur ? ' selected' : '') + '>' + esc(SW.refOf(w.id) + '  ' + w.label) + '</option>'; }).join('') +
      '</select><button class="btn ghost" data-cx="next" title="The next version">›</button></div><div class="kin-one"></div>';
    document.body.appendChild(d);
    var sel = d.querySelector('select'), box = d.querySelector('.kin-one');
    function show(id) { cur = id; sel.value = id; box.innerHTML = SW.reconstructionCard(V.byId(id)); }
    sel.addEventListener('change', function () { show(sel.value); });
    d.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cx]');
      if (c) {
        var k = c.dataset.cx, m = c.closest('details'); if (m) m.open = false;
        var i = vs.findIndex(function (w) { return w.id === cur; });
        if (k === 'prev' || k === 'next') { show(vs[(i + (k === 'next' ? 1 : -1) + vs.length) % vs.length].id); return; }
        SW.cardAct(k, cur); return;
      }
      if (e.target === d || e.target.closest('[data-x]')) d.close();
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    show(cur);
  }
  SW.cardsOne = function (x) { cardDialog(x); };
  // Help ▸ Reconstruction cards: opens on the version in view
  SW.cardsHelp = function () { cardDialog(SW.state && SW.state.v); };
  // Help ▸ What you should read: the reading behind the bench (entries as the
  // project site's bibliography has them, checked against the Zotero library)
  var READING = [
    ['The program', [
      'Winograd, T. (1971) <i>Procedures as a Representation for Data in a Computer Program for Understanding Natural Language</i>. PhD thesis. Massachusetts Institute of Technology. Issued as MIT Artificial Intelligence Laboratory Technical Report AI-TR-235.',
      'Winograd, T. (1972) ‘Understanding natural language’, <i>Cognitive Psychology</i>, 3(1), pp. 1–191. doi: 10.1016/0010-0285(72)90002-3.',
      'Winograd, T. (1972) <i>Understanding Natural Language</i>. New York: Academic Press.',
      'Winograd, T. (1991) Oral history interview with Terry Winograd. Interviewed by Arthur L. Norberg, 11 December. Charles Babbage Institute, University of Minnesota. Available at: <a href="https://hdl.handle.net/11299/107717" target="_blank" rel="noopener">hdl.handle.net/11299/107717</a>.']],
    ['The languages', [
      'Sussman, G.J., Winograd, T. and Charniak, E. (1970) <i>Micro-Planner Reference Manual</i>. MIT Artificial Intelligence Laboratory, AI Memo 203. Available at: <a href="https://dspace.mit.edu/handle/1721.1/5833" target="_blank" rel="noopener">dspace.mit.edu/handle/1721.1/5833</a>.',
      'Hewitt, C. (1969) ‘PLANNER: a language for proving theorems in robots’, in <i>Proceedings of the 1st International Joint Conference on Artificial Intelligence</i>. Washington, DC, 7–9 May, pp. 295–301.']],
    ['Reading and repairing code', [
      'Berry, D. M. (2025) ‘Digital Ruins and Critical Code Studies: Towards an Ethics of Historical Software Reconstruction’, <i>Stunlaw: Philosophy and Critique for a Digital Age</i>. Available at: <a href="https://stunlaw.blogspot.com/2025/01/digital-ruins-and-critical-code-studies.html" target="_blank" rel="noopener">https://stunlaw.blogspot.com/2025/01/digital-ruins-and-critical-code-studies.html</a>. <span class="faint">The approach behind the bench’s repair marks (gold, in Read) and its reconstruction cards.</span>',
      'Berry, D. M. and Marino, M. C. (2024) ‘Reading ELIZA: Critical Code Studies in Action’, <i>Electronic Book Review</i>. Available at: <a href="https://electronicbookreview.com/essay/reading-eliza-critical-code-studies-in-action/" target="_blank" rel="noopener">https://electronicbookreview.com/essay/reading-eliza-critical-code-studies-in-action/</a>.',
      'Marino, M. C., Weil, P., Shrager, J., Schwarz, A., Hay, A., Ciston, S., Berry, D. M. and Millican, P. (2026) ‘Conversations about conversational code: on the collaborative critical code studies reading of ELIZA’, <i>AI &amp; Society</i>. <a href="https://doi.org/10.1007/s00146-026-03086-7" target="_blank" rel="noopener">https://doi.org/10.1007/s00146-026-03086-7</a>.',
      'Marino, M. C. (2020) <i>Critical Code Studies</i>. Cambridge, MA: The MIT Press.',
      'Berry, D. M. (2011) <i>The Philosophy of Software: Code and Mediation in the Digital Age</i>. Basingstoke: Palgrave Macmillan.',
      'Montfort, N., Baudoin, P., Bell, J., Bogost, I., Douglass, J., Marino, M. C., Mateas, M., Reas, C., Sample, M. and Vawter, N. (2014) <i>10 PRINT CHR$(205.5+RND(1)); : GOTO 10</i>. Cambridge, MA: MIT Press.']],
    ['Critique', [
      'Dreyfus, H.L. (1972) <i>What Computers Can’t Do: A Critique of Artificial Reason</i>. New York: Harper &amp; Row.',
      'Winograd, T. and Flores, F. (1986) <i>Understanding Computers and Cognition: A New Foundation for Design</i>. Norwood, NJ: Ablex.']],
    ['Other runs of SHRDLU', [
      'Semaphore Corp. (2013) <i>SHRDLU resurrection</i>. semaphorecorp.com/misc/shrdlu.html (via the Internet Archive).',
      'van Bergen, P. (2023) <i>Blocks World</i>. Available at: <a href="https://patrickvanbergen.com/blocks-world" target="_blank" rel="noopener">patrickvanbergen.com/blocks-world</a>.']]
  ];
  SW.readingHelp = function () {
    bigDialog('What you should read', '<p>The reading behind the bench. The full list, with histories and media theory, is the project site’s <a href="../bibliography.html" target="_blank" rel="noopener">bibliography</a>.</p>' +
      READING.map(function (g) { return '<h4>' + SW.esc(g[0]) + '</h4><ul class="reading">' + g[1].map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>'; }).join(''), 'refhelp');
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

  // Help ▸ Referencing and versions: the convention, and every source's reference
  SW.refHelp = function () {
    var vs = V.VERSIONS.slice().sort(function (a, b) { return a.sort - b.sort; });
    var d = SW.el('dialog', { class: 'tray-big refhelp' });
    d.innerHTML = '<div class="tray-bighead"><b>Referencing and versions</b><span class="refhelp-acts">' +
      '<button class="btn ghost" data-rx="copy" title="Every reference as plain text">⧉ Copy the list</button>' +
      '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<p>The bench names each source text in one form, shown beside it across the bench, in citations and in exports:</p>' +
      '<p class="refhelp-ex mono">[REF: SHI, smspec.94:712–714]</p>' +
      '<p><b>SH</b>, then a letter for the witness, the particular surviving set of files (<b>I</b>); then the file as that witness names it (<b>smspec.94</b>) and the lines (<b>712–714</b>). The ITS copies carry ITS version numbers in their names; Winograd’s Stanford copy does not.</p>' +
      '<table class="ov-sub"><thead><tr><th>Letter</th><th>The witness</th></tr></thead><tbody>' +
      [['I', 'the MIT files as found on ITS backup tapes (PDP-10/its, imported unedited, July 2024)'], ['S', 'Winograd’s code directory, distributed from Stanford (files dated 1997)'], ['E', 'Eric Swenson’s restoration (PDP-10/its, July to August 2024)']].map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td>' + SW.esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p>Shorter forms: the witness alone, <span class="mono">[REF: SHI]</span>; a whole file, <span class="mono">[REF: SHI, plnr.182]</span>. Lost versions are named without a letter: <span class="mono">SH-JAN71</span>, <span class="mono">SH-C1</span>.</p>' +
      '<h4>The versions</h4><table class="ov-sub refhelp-t"><thead><tr><th>No.</th><th>Reference</th><th>Version</th><th>Dated</th><th>This text</th></tr></thead><tbody>' +
      vs.map(function (v, n) { return '<tr><td class="num">' + (n + 1) + '</td><td class="mono"><span class="swref-c" data-copy="' + SW.esc(SW.refText(v.id)) + '" title="Click to copy">' + SW.esc(SW.refOf(v.id)) + '</span></td><td>' + SW.esc(v.label) + (v.status === 'lost' ? ' <span class="faint">(lost)</span>' : '') + '</td><td>' + SW.esc(v.date || '') + '</td><td>' + SW.esc(SW.MADE[v.id] || v.medium || 'none held') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h4>Re-creations</h4><table class="ov-sub refhelp-t"><thead><tr><th>Reference</th><th>What</th><th>In</th><th>Where and by whom</th><th>Date</th></tr></thead><tbody>' +
      SW.PORTS.map(function (r) { return '<tr><td class="mono">' + SW.esc(r[0]) + '</td><td>' + SW.esc(r[1]) + '</td><td>' + SW.esc(r[2]) + '</td><td>' + SW.esc(r[3]) + '</td><td>' + SW.esc(r[4]) + '</td></tr>'; }).join('') + '</tbody></table>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
      var rx = e.target.closest('[data-rx]'); if (rx && rx.dataset.rx === 'copy') SW.copyText(SW.refList.text(), 'the list of references');
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  };
  SW.refList = {
    text: function () {
      var L = ['SHRDLU source references (SHRDLU Research Bench ' + SW.VERSION + ', ' + SW.fmtDate(SW.today()) + ')', '',
        'Form: [REF: SH<witness>, <file>:<lines>], e.g. [REF: SHI, smspec.94:712–714].', 'Witnesses: I the MIT files as found on ITS; S Winograd’s Stanford distribution; E Swenson’s 2024 restoration.', ''];
      V.VERSIONS.slice().sort(function (a, b) { return a.sort - b.sort; }).forEach(function (v, n) { L.push((n + 1) + '. ' + SW.refOf(v.id) + '  ' + v.label + ' (' + (v.date || '') + ')' + (v.status === 'lost' ? ', lost' : '')); });
      return L.join('\n');
    }
  };

  // the number of tapes (parts) a version's text is built from, without building it
  SW.nparts = function (vid) { var v = root.SWVersions.byId(vid); return v && v.build ? v.build.length : 1; };
  SW.refText = function (vid, p, n0, n1, nparts) { return '[REF: ' + SW.refOf(vid, p, n0, n1, nparts) + ']'; };
  SW.refTag = function (vid, p, n0, n1, nparts) { var t = SW.refText(vid, p, n0, n1, nparts); return '<span class="swref" data-copy="' + SW.esc(t) + '" title="Click to copy. The bench’s reference to this source (Help ▸ Referencing and versions)">' + SW.esc(t) + '</span>'; };
  SW.cite = function (b, p, n0, n1) {
    var part = b.parts[p];
    var range = n1 && n1 !== n0 ? 'll. ' + n0 + '–' + n1 : 'l. ' + n0;
    return b.v.label + ' (' + b.v.date + '), ' + part.src + ', ' + range + ' ' + SW.refText(b.v.id, p, n0, n1, b.parts.length);
  };
  // A file in sources/, opened in a new tab on GitHub (tape images are binary,
  // so the browser cannot show them itself; GitHub shows size, history, raw).
  SW.REPO = 'https://github.com/critical-code-studies/SHRDLU/blob/main/source/';
  SW.sourceURL = function (path) { return SW.REPO + path.split('/').map(encodeURIComponent).join('/'); };
  SW.sourceLink = function (path, text) {
    return '<a href="' + SW.esc(SW.sourceURL(path)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(path) + ' in a new tab">' + SW.esc(text || path) + ' ↗</a>';
  };

  // Glosses for names (the Spacewar! bench glossed PDP-1 instructions); none yet.
  SW.glosses = {};
  SW.loadGlosses = function () {
    SW.glossP = SW.glossP || Promise.resolve(SW.glosses);
    if (SW.glossP) return SW.glossP;
    SW.glossP = fetch('../assets/pdp1-instructions.json').then(function (r) { return r.json(); })
      .then(function (j) { SW.glosses = j.entries || {}; return SW.glosses; })
      .catch(function () { SW.glosses = {}; return SW.glosses; });
    return SW.glossP;
  };

  // ---------- ghosts (kit/base.js, SW.ghostMatch) ----------
  // lines as keys: comments, spacing and case set aside; blank lines count for nothing
  SW.lineKey = function (t) { return SW.parseLine(t).code.replace(/[\f\u0003]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); };

  SW.docMeta = function (b) {
    return [
      ['Version', b.v.label], ['Reference', SW.refText(b.v.id)], ['Date', b.v.date], ['Authors', b.v.authors],
      ['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : ''); }).join('; ')],
      ['Read as', 'MacLisp 1.6 source, indexed by the bench'],
      ['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION]
    ];
  };
})(this);
