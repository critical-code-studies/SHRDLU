/*
 * core.js - shared state and helpers for the research bench.
 *
 * A "build" is one version fetched, normalised and assembled: the unit that
 * every view reads from. Builds are cached, so moving between views or
 * comparing versions never reassembles needlessly.
 */
(function (root) {
  'use strict';

  var A = root.LispIndex, V = root.SWVersions;
  var SW = root.SW = {};

  SW.BASE_URI = 'https://critical-code-studies.github.io/SHRDLU/research/';
  SW.state = { v: null, tab: 'read', sel: null, b: null };
  SW.views = {};
  // The bench's version: the ?v= on this script's own tag in index.html (the
  // one place it is set), shown beside the title and recorded in exports.
  SW.VERSION = ((document.currentScript && /[?&]v=([^&#]+)/.exec(document.currentScript.src)) || [])[1] || 'dev';
  var verEl = document.getElementById('bench-ver');
  if (verEl) { verEl.textContent = 'v' + SW.VERSION; verEl.title = 'Research bench version ' + SW.VERSION; }

  // ---------- small helpers ----------
  SW.$ = function (sel, el) { return (el || document).querySelector(sel); };
  SW.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  SW.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  SW.oct = function (n, w) { if (n == null) return ''; var s = (n >>> 0).toString(8); while (s.length < (w || 6)) s = '0' + s; return s; };
  SW.el = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  SW.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  SW.today = function () { return new Date().toISOString().slice(0, 10); };
  SW.slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, ''); };

  // ---------- storage (always guarded) ----------
  SW.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('shbench.' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('shbench.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };
  // The Spacewar! bench probed its emulator for the control bits; SHRDLU has no
  // controls to probe, so this answers nothing.
  SW.controlMap = function () { return Promise.resolve(null); };

  // Displays a version draws on. 4.4 (the dual-console version) addresses a second
  // display with the instruction 720407 (dpy-i 400 in dj6): DEC's 1963 handbook
  // (F-15D) gives 720407 as dpp, display one point on the second CRT (Type 31),
  // beside dpy 720007 for the Type 30. Each of its frames goes to one of the two.
  SW.scopeCount = function (b) { return b && b.sym && b.sym.dj6 ? 2 : 1; };
  // A draggable divide between the first and last columns of a three-column
  // grid (left, divide, right); the width is kept under key, double-click resets.
  SW.dragSplit = function (wrap, split, key, minL, minR) {
    minL = minL || 200; minR = minR || 240;
    split.classList.add('split-v'); split.setAttribute('role', 'separator'); split.setAttribute('aria-orientation', 'vertical');
    split.title = 'Drag to resize; double-click to reset';
    function set(w) { wrap.style.gridTemplateColumns = w ? Math.round(w) + 'px 6px minmax(0, 1fr)' : ''; }
    set(SW.store.get(key, 0));
    split.addEventListener('pointerdown', function (e) {
      e.preventDefault(); split.setPointerCapture(e.pointerId); split.classList.add('on');
      var x0 = wrap.getBoundingClientRect().left, max = wrap.clientWidth - minR, w = 0;
      function mv(ev) { w = Math.max(minL, Math.min(max, ev.clientX - x0)); set(w); window.dispatchEvent(new Event('resize')); }
      function up() { split.removeEventListener('pointermove', mv); split.removeEventListener('pointerup', up); split.classList.remove('on'); if (w) SW.store.set(key, Math.round(w)); }
      split.addEventListener('pointermove', mv); split.addEventListener('pointerup', up);
    });
    split.addEventListener('dblclick', function () { SW.store.set(key, 0); set(0); window.dispatchEvent(new Event('resize')); });
  };
  SW.scopeOf = function (b, md) { return SW.scopeCount(b) === 2 && md != null && (md & 0o777) === 0o407 ? 2 : 1; };
  SW.me = function () {
    return { initials: SW.store.get('initials', ''), name: SW.store.get('name', '') };
  };

  // ---------- events ----------
  var handlers = {};
  SW.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  SW.emit = function (ev, data) { (handlers[ev] || []).forEach(function (fn) { fn(data); }); };

  // ---------- toast / status ----------
  var toastTimer;
  // act: {label, fn}, a button in the toast (Undo)
  SW.toast = function (msg, ms, act) {
    var t = SW.$('#toast');
    t.textContent = msg;
    t.classList.toggle('act', !!act);
    if (act) {
      var b = SW.el('button', { class: 'btn ghost toast-act' }, SW.esc(act.label));
      b.onclick = function () { t.classList.remove('on'); act.fn(); };
      t.appendChild(b);
    }
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || (act ? 6000 : 2600));
  };
  SW.status = function (msg) { SW.$('#status').textContent = msg || ''; };

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
  // Copy text; where the clipboard API is refused, through a selected textarea.
  SW.copyText = function (t, what) {
    function old() {
      var ta = SW.el('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = t;
      (document.querySelector('dialog[open]') || document.body).appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); SW.toast(ok ? 'Copied ' + (what || '') : 'Could not copy');
    }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { SW.toast('Copied ' + (what || t)); }, old);
  };
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    e.preventDefault(); e.stopPropagation();
    var t = c.dataset.copy;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { SW.toast('Copied ' + t); }, function () { window.prompt('Copy:', t); });
  }, true);
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
      '<div class="keylist"><div><span class="kx-kin rp-hibi"></span> corrected: a reading mended against another copy of the same file</div><div><span class="kx-kin rp-yobitsugi"></span> supplied: a passage from another copy or version</div><div><span class="kx-kin rp-mount"></span> for running (paler): how the program is loaded or started, not its text</div></div>' +
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
  SW.permalink = function (params) {
    var q = [];
    for (var k in params) if (params[k] != null && params[k] !== '') q.push(k + '=' + encodeURIComponent(params[k]));
    return SW.BASE_URI + (q.length ? '?' + q.join('&') : '');
  };
  // A file in sources/, opened in a new tab on GitHub (tape images are binary,
  // so the browser cannot show them itself; GitHub shows size, history, raw).
  SW.REPO = 'https://github.com/critical-code-studies/SHRDLU/blob/main/source/';
  SW.sourceURL = function (path) { return SW.REPO + path.split('/').map(encodeURIComponent).join('/'); };
  SW.sourceLink = function (path, text) {
    return '<a href="' + SW.esc(SW.sourceURL(path)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(path) + ' in a new tab">' + SW.esc(text || path) + ' ↗</a>';
  };
  SW.versionURI = function (id) { return SW.BASE_URI + '?v=' + encodeURIComponent(id); };

  // ---------- routing ----------
  SW.readQuery = function () {
    var q = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    });
    return q;
  };
  SW.writeQuery = function (extra) {
    var s = SW.state, q = { v: s.v, tab: s.tab !== 'read' ? s.tab : null };
    if (s.b && (s.tab === 'compare')) q.b = s.b;
    if (s.tab === 'analyse' && SW.anLens) q.lens = SW.anLens();
    if (s.tab === 'graphics' && SW.gfxItem) q.g = SW.gfxItem();
    if (s.sel && s.tab === 'read') q.l = s.sel.p + ':' + s.sel.n0 + (s.sel.n1 !== s.sel.n0 ? '-' + s.sel.n1 : '');
    for (var k in extra || {}) q[k] = extra[k];
    var parts = [];
    for (var k2 in q) if (q[k2] != null && q[k2] !== '') parts.push(k2 + '=' + encodeURIComponent(q[k2]));
    try { history.replaceState(null, '', '?' + parts.join('&')); } catch (e) { /* file: urls */ }
  };

  // ---------- drawer and popover ----------
  // The side panel. Closing it minimises it to a tab at the foot of the screen,
  // which brings it back with its contents as they were.
  SW.drawer = function (title, html) {
    document.body.classList.remove('drawer-wide');
    delete SW.$('#drawer-body').dataset.notes;
    delete SW.$('#drawer-body').dataset.panel;
    SW.$('#drawer-title').textContent = title;
    var body = SW.$('#drawer-body');
    if (typeof html === 'string') body.innerHTML = html; else { body.innerHTML = ''; body.appendChild(html); }
    document.body.classList.add('drawer-open');
    var dk = SW.$('#drawer-dock');
    if (dk) dk.classList.remove('on');
    return body;
  };
  SW.closeDrawer = function () {
    var wide = document.body.classList.contains('drawer-wide');
    document.body.classList.remove('drawer-open', 'drawer-wide');
    // An annotations panel is reopened from the Annotations tab (notes.js), which is always there.
    if (SW.$('#drawer-title').textContent === 'Annotations') { var d0 = SW.$('#drawer-dock'); if (d0) d0.classList.remove('on'); return; }
    var dock = SW.$('#drawer-dock');
    if (!dock) {
      dock = SW.el('button', { id: 'drawer-dock', class: 'drawer-dock', title: 'Show the side panel again' });
      document.body.appendChild(dock);
      dock.onclick = function () {
        document.body.classList.add('drawer-open');
        if (dock.dataset.wide === '1') document.body.classList.add('drawer-wide');
        dock.classList.remove('on');
      };
    }
    dock.dataset.wide = wide ? '1' : '';
    dock.textContent = '▴ ' + (SW.$('#drawer-title').textContent || 'Side panel');
    dock.classList.add('on');
  };

  var popEl = null;
  SW.pop = function (x, y, html) {
    SW.unpop();
    popEl = SW.el('div', { class: 'pop' }, html);
    document.body.appendChild(popEl);
    var r = popEl.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - r.width - 10), top = y + 14;
    if (top + r.height > window.innerHeight - 10) top = Math.max(10, y - r.height - 10);
    popEl.style.left = Math.max(10, left) + 'px';
    popEl.style.top = top + 'px';
    return popEl;
  };
  SW.unpop = function () { if (popEl) { popEl.remove(); popEl = null; } };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') SW.unpop(); });
  document.addEventListener('mousedown', function (e) { if (popEl && !popEl.contains(e.target)) SW.unpop(); });
  // Toolbar drop-down menus (<details class="menu">) close on a click elsewhere.
  document.addEventListener('mousedown', function (e) {
    SW.$$('details.menu[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });

  // A click on a modal's backdrop closes it. Both ends of the click must fall
  // outside the box, so a text selection dragged out of a field does not.
  function outside(d, e) {
    var r = d.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }
  var downOnBackdrop = null;
  document.addEventListener('mousedown', function (e) {
    downOnBackdrop = e.target.tagName === 'DIALOG' && e.target.open && outside(e.target, e) ? e.target : null;
  });
  // A dialog marked data-keep (the note) stays open while it holds text: the
  // click shakes it and shows its .keep-hint instead.
  document.addEventListener('click', function (e) {
    var d = e.target;
    if (d === downOnBackdrop && d.open && outside(d, e)) {
      var held = d.hasAttribute('data-keep') &&
        SW.$$('textarea, input:not([type]), input[type="text"]', d).some(function (x) { return x.value.trim(); });
      if (!held) d.close();
      else {
        d.classList.remove('nudge'); void d.offsetWidth; d.classList.add('nudge');
        var k = SW.$('.keep-hint', d); if (k) k.hidden = false;
        var f = SW.$('textarea', d); if (f) f.focus();
      }
    }
    downOnBackdrop = null;
  });

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

  // A table (array of rows) sorted by clicking headers.
  SW.table = function (head, rows, opts) {
    opts = opts || {};
    var t = SW.el('table', { class: 'data' });
    var sortCol = -1, asc = true;
    function render() {
      var h = '<thead><tr>' + head.map(function (c, i) {
        return '<th data-i="' + i + '">' + SW.esc(c) + (i === sortCol ? (asc ? ' ▲' : ' ▼') : '') + '</th>';
      }).join('') + '</tr></thead><tbody>';
      h += rows.map(function (r, ri) {
        return '<tr data-r="' + ri + '">' + r.map(function (c, i) {
          var cls = (opts.cls && opts.cls[i]) || '';
          var v = c && typeof c === 'object' && 'html' in c ? c.html : SW.esc(c);
          return '<td class="' + cls + '">' + v + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      t.innerHTML = h;
    }
    t.addEventListener('click', function (e) {
      var th = e.target.closest('th');
      if (th) {
        var i = +th.dataset.i;
        asc = sortCol === i ? !asc : true;
        sortCol = i;
        rows.sort(function (a, b) {
          var x = a[i], y = b[i];
          if (x && typeof x === 'object') x = x.sort != null ? x.sort : x.html;
          if (y && typeof y === 'object') y = y.sort != null ? y.sort : y.html;
          if (typeof x === 'number' && typeof y === 'number') return asc ? x - y : y - x;
          return asc ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
        });
        render();
        return;
      }
      var tr = e.target.closest('tr[data-r]');
      if (tr && opts.onRow) opts.onRow(rows[+tr.dataset.r], e);
    });
    render();
    t.getRows = function () { return rows; };
    return t;
  };

  // Plain text of a table for export.
  SW.tableBlock = function (caption, head, rows) {
    return { type: 'table', caption: caption, head: head, rows: rows.map(function (r) {
      return r.map(function (c) {
        if (c && typeof c === 'object') return c.text != null ? String(c.text) : String(c.html).replace(/<[^>]+>/g, '');
        return String(c == null ? '' : c);
      });
    }) };
  };

  // ---------- code text: font and size, for reading ----------
  var WEBFONTS = { 'JetBrains Mono': 1, 'IBM Plex Mono': 1, 'Source Code Pro': 1, 'Fira Code': 1, 'Courier Prime': 1 };
  SW.codeFont = function () { return SW.store.get('codeFont', 'system'); };
  SW.codeSize = function () { var n = +SW.store.get('codeSize', 13); return n >= 9 && n <= 24 ? n : 13; };
  // A faint ground on annotated lines, unless turned off in Settings.
  SW.applyNoteShade = function () {
    document.documentElement.classList.toggle('no-note-shade', !SW.store.get('noteShade', true));
  };
  SW.applyCodeText = function () {
    var f = SW.codeFont(), de = document.documentElement;
    if (WEBFONTS[f] && !document.getElementById('font-' + SW.slug(f))) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.id = 'font-' + SW.slug(f);
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    de.style.setProperty('--code-font', f === 'system' ? 'var(--mono)' : '"' + f + '", var(--mono)');
    de.style.setProperty('--code-size', SW.codeSize() + 'px');
    SW.emit('codetext');
  };
  SW.setCodeSize = function (n) {
    n = Math.max(9, Math.min(24, Math.round(n)));
    SW.store.set('codeSize', n);
    SW.applyCodeText();
    SW.toast('Code text ' + n + ' px');
  };

  // ---------- hands: the people whose initials or names are written into the text ----------
  // Colours read on both the dark plate and white.
  SW.HANDS = [
    { k: 'tw', who: 'Terry Winograd', re: /\bwinograd\b|\bt\.\s?w\.|\btw\b/i, colour: '#2a9d6f' },
    { k: 'ddm', who: 'Dave McDonald', re: /\bddm\b|\bmcdonald\b/i, colour: '#d99a1e' },
    { k: 'hill', who: 'Jeff Hill', re: /\bjeff hill\b/i, colour: '#3f8fd0' },
    { k: 'jmh', who: '“JMH” (not yet identified)', re: /\bjmh\b/i, colour: '#c05a93' },
    { k: 'ejs', who: 'Eric Swenson (2024)', re: /\bejs\b|\bswenson\b/i, colour: '#8a7ae0' }
  ];
  SW.handOf = function (k) { return SW.HANDS.filter(function (h) { return h.k === k; })[0] || null; };
  // The hands named in a piece of text, in the order of SW.HANDS.
  SW.handsIn = function (text) {
    return SW.HANDS.filter(function (h) { return h.re.test(text || ''); }).map(function (h) { return h.k; });
  };

  // ---------- colour schemes for the genealogy figures ----------
  SW.PALETTES = [
    ['phosphor', 'Theme colours (default)'], ['okabe', 'Colour-blind safe (Okabe–Ito)'], ['tol', 'Colour-blind safe (Tol)'],
    ['muted', 'Muted (print)'], ['bold', 'Bold, high contrast'], ['warm', 'Warm'], ['grey', 'Greyscale']
  ];
  SW.palette = function () { return SW.store.get('gen.palette', 'phosphor'); };
  SW.applyPalette = function (k) {
    if (k) SW.store.set('gen.palette', k);
    k = SW.palette();
    if (k === 'phosphor') document.documentElement.removeAttribute('data-gpal');
    else document.documentElement.setAttribute('data-gpal', k);
  };
  // A select for choosing a scheme; onChange re-renders the caller's figure.
  SW.paletteSelect = function (onChange) {
    var l = SW.el('label', { class: 'check', title: 'Colours for retained, moved, edited, added and removed, on screen and in exported figures' }, 'Colours ');
    l.classList.add('pal-pick');
    var sel = SW.el('select', {}, SW.PALETTES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === SW.palette() ? ' selected' : '') + '>' + SW.esc(p[1]) + '</option>'; }).join(''));
    sel.onchange = function (e) { e.stopPropagation(); SW.applyPalette(sel.value); if (onChange) onChange(); };
    l.appendChild(sel);
    return l;
  };

  // ---------- colour themes ----------
  // Each is a set of CSS custom properties (css/research.css, :root[data-theme]).
  // 'dark' says whether its ground is dark, for figures that draw their own.
  SW.THEMES = [
    { id: 'phosphor', label: 'Blocks world', dark: true, note: 'warm white on the charcoal of the lab bench, green for the machine, as on the project site (the default)' },
    { id: 'green', label: 'Terminal, green', dark: true, note: 'green phosphor on black' },
    { id: 'amber', label: 'Terminal, amber', dark: true, note: 'amber phosphor on black' },
    { id: 'contrast', label: 'High contrast', dark: true, note: 'white and bright colours on black' },
    { id: 'paper', label: 'Listing paper', dark: false, note: 'dark ink on the cream of a printed listing' },
    { id: 'white', label: 'Paper', dark: false, note: 'black on white' },
    { id: 'sepia', label: 'Sepia', dark: false, note: 'brown ink on warm paper, for long reading' }
  ];
  SW.themeInfo = function (id) {
    id = id || document.documentElement.getAttribute('data-theme') || 'phosphor';
    return SW.THEMES.filter(function (t) { return t.id === id; })[0] || SW.THEMES[0];
  };
  SW.theme = function () { return SW.themeInfo().id; };
  // A custom property as the current theme (or a given one) sets it.
  SW.cssVar = function (name, theme) { return SW.resolveVars('var(' + name + ')', theme); };

  // ---------- figures: on screen in the theme's colours; in export, the chosen background ----------
  // 'theme' exports in the colours of the theme in use, on its own figure plate.
  SW.FIGBG = { white: '#ffffff', paper: '#f4f1e8', black: '#04060b', transparent: null, theme: 'theme' };
  SW.figBg = function () { var b = SW.store.get('figbg', 'white'); return b in SW.FIGBG ? b : 'white'; };
  // The theme whose colours an export uses, and the colour laid under it.
  var FIGBG_THEME = { white: 'white', paper: 'paper', black: 'phosphor', transparent: 'white' };
  SW.figTheme = function () { var k = SW.figBg(); return k === 'theme' ? SW.theme() : FIGBG_THEME[k]; };
  SW.figBgColour = function () { var k = SW.figBg(); return k === 'theme' ? SW.cssVar('--plate') : SW.FIGBG[k]; };

  // Resolve CSS custom properties in an SVG against a given theme, so the
  // figure stands alone. The theme attribute is switched and restored
  // synchronously, which reads the other palette without a repaint.
  SW.resolveVars = function (svg, theme) {
    var de = document.documentElement, was = de.getAttribute('data-theme');
    if (theme) de.setAttribute('data-theme', theme);
    var cs = getComputedStyle(de), cache = {};
    function val(name, fb) {
      if (!(name in cache)) cache[name] = cs.getPropertyValue(name).trim();
      return cache[name] || (fb || '#888').trim();
    }
    var out = svg.replace(/var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, function (m, name, fb) { return val(name, fb); });
    if (theme) { if (was == null) de.removeAttribute('data-theme'); else de.setAttribute('data-theme', was); }
    return out;
  };
  // Figures on screen take the colours of the theme in use, on its figure plate.
  SW.lightTheme = function () { return !SW.themeInfo().dark; };
  // A figure carried in an annotation's text: the SVG gzipped and base64'd on
  // one closing line, <!-- sh:fig:gz ... -->. Shown as an <img>, so markup
  // from someone else's finding is never run.
  // A string gzipped and base64'd, and back (for My notes kept on Hypothesis).
  SW.gz = {
    pack: function (str) {
      if (!root.CompressionStream) return Promise.reject(new Error('This browser cannot compress.'));
      return new Response(new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf), bin = '';
        for (var i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return btoa(bin);
      });
    },
    unpack: function (b64) {
      var bin = atob(b64), b = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
  };
  // ---------- ghosts: where a block of lines from one version sits in another ----------
  // lines as keys: comments, spacing and case set aside; blank lines count for nothing
  SW.lineKey = function (t) { return SW.parseLine(t).code.replace(/[\f\u0003]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); };
  // src and here: arrays of { k } (line keys); index: key -> positions in here.
  // The start in here of src[s0..s1], where most of its lines match in order
  // (at least 60% of the non-blank ones), two lines either side counting as
  // context; -1 when none is good enough, or a single common line has no context.
  SW.ghostMatch = function (src, s0, s1, here, index) {
    var len = s1 - s0 + 1, best = null, cands = {}, need = 0, i, q;
    for (i = s0; i <= s1; i++) {
      var k = src[i].k; if (!k) continue;
      need++;
      (index[k] || []).forEach(function (j) { var st = j - (i - s0); if (st >= 0 && st + len <= here.length) cands[st] = 1; });
    }
    if (!need) return -1;
    Object.keys(cands).forEach(function (st) {
      st = +st;
      var hit = 0, ctx = 0;
      for (q = 0; q < len; q++) if (src[s0 + q].k && src[s0 + q].k === here[st + q].k) hit++;
      for (q = 1; q <= 2; q++) {
        if (s0 - q >= 0 && st - q >= 0 && src[s0 - q].k && src[s0 - q].k === here[st - q].k) ctx++;
        if (s1 + q < src.length && st + len - 1 + q < here.length && src[s1 + q].k && src[s1 + q].k === here[st + len - 1 + q].k) ctx++;
      }
      var score = hit + ctx * 0.5;
      if (!best || score > best.score) best = { st: st, hit: hit, ctx: ctx, score: score };
    });
    if (!best || best.hit < Math.max(1, Math.ceil(need * 0.6))) return -1;
    if (need === 1 && best.ctx === 0 && (index[src[s0].k] || []).length > 1) return -1;
    return best.st;
  };
  // ---------- earlier wordings of an annotation ----------
  // When a note is edited, the wording it replaces is kept in the note itself, on
  // a closing line <!-- sh:was DATE BASE64 --> (before any figure), so the record
  // travels with the note in Hypothesis. Hidden wherever the note is shown.
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function unb64(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return ''; } }
  var WAS = /\n*<!-- sh:was (\S+) ([A-Za-z0-9+\/=]+) -->/g;
  SW.noteHistory = {
    visible: function (t) { return String(t || '').replace(/\n*<!-- sh:[\s\S]*?-->/g, '').replace(/\s+$/, ''); },
    list: function (t) { var out = [], m; WAS.lastIndex = 0; while ((m = WAS.exec(String(t || '')))) out.push({ date: m[1], text: unb64(m[2]) }); return out; },
    wasLines: function (t) { return (String(t || '').match(WAS) || []).map(function (x) { return '\n\n' + x.replace(/^\n+/, ''); }).join(''); },
    was: function (text, date) { return '\n\n<!-- sh:was ' + (date || new Date().toISOString()) + ' ' + b64(text) + ' -->'; },
    fig: function (t) { var m = /\n*<!-- sh:fig:gz [A-Za-z0-9+\/=]+ -->\s*$/.exec(String(t || '')); return m ? '\n\n' + m[0].replace(/^\s+/, '') : ''; },
    // the full text to store: the new wording, earlier ones (with the one replaced), a figure last
    compose: function (newText, oldFull, oldDate) {
      var H = SW.noteHistory, vNew = H.visible(newText), vOld = H.visible(oldFull);
      return vNew + H.wasLines(oldFull) + (vOld && vNew !== vOld ? H.was(vOld, oldDate) : '') + (H.fig(newText) || H.fig(oldFull));
    }
  };

  // ---------- Developer mode (⚙) ----------
  // For the team: shows annotations marked Developer only, and features still
  // being built. A feature in progress checks SW.dev(), or its markup takes the
  // class dev-only, shown only while body has dev-on.
  SW.dev = function () { return !!SW.store.get('dev', false); };
  SW.applyDev = function () { document.body.classList.toggle('dev-on', SW.dev()); };
  if (document.body) SW.applyDev(); else document.addEventListener('DOMContentLoaded', SW.applyDev);

  // ---------- rich text in annotations ----------
  // Notes are Markdown, as Hypothesis stores and shows them, so a note written
  // here reads the same in Hypothesis's own client and the other way round.
  // SW.md renders the subset people use in a note: paragraphs and line breaks,
  // **bold**, *italic*, ~~struck~~, `code`, ``` code blocks ```, > quotations,
  // - and 1. lists, # headings, [links](https://…) and bare URLs. Everything is
  // escaped first, and a link must be http, https or mailto; links open in a new tab.
  var MD_URL = /^(https?:\/\/|mailto:)/i;
  function mdLink(href, label, bare) {
    var own = SW.internalLink && SW.internalLink(href, label, bare);   // a link within the bench (notes.js)
    if (own) return own;
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer"' + (bare ? ' data-bare="1"' : '') + '>' + label + '</a>';
  }
  function mdInline(s) {
    var keep = [];
    function stash(h) { keep.push(h); return '\u0000' + (keep.length - 1) + '\u0000'; }
    function emph(t) {
      return t.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>').replace(/__(?=\S)([\s\S]*?\S)__/g, '<b>$1</b>')
        .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
        .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1<i>$2</i>')
        .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<i>$2</i>');
    }
    s = s.replace(/`([^`\n]+)`/g, function (m, c) { return stash('<code>' + c + '</code>'); });
    // a web address takes no Markdown escapes (an editor may have put \_ in one)
    function unesc(u) { return u.replace(/\\([\\`*_\[\]~#+\-.!()])/g, '$1'); }
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      u = unesc(u);
      return MD_URL.test(u.replace(/&amp;/g, '&')) ? stash(mdLink(u, emph(t))) : m;
    });
    s = s.replace(/(^|[\s(])((?:https?:\/\/)[^\s<]+?)(?=[.,;:!?)]*(?:\s|$|&lt;))/g, function (m, pre, u) { u = unesc(u); return pre + stash(mdLink(u, u, true)); });
    s = s.replace(/\\(&gt;|&lt;|&amp;|[\\`*_\[\]~#+\-.!()])/g, function (m, c) { return stash(c); });   // \* is a plain *
    // @DMB: a mention of someone by their initials
    s = s.replace(/(^|[\s(>])@([A-Z][A-Za-z]{1,5})\b/g, function (m, pre, who) { return pre + stash('<span class="mention" title="A mention of ' + who + '">@' + who + '</span>'); });
    s = emph(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return keep[+i]; });
  }
  SW.md = function (text) {
    var fences = [];
    var src = String(text == null ? '' : text).replace(/\n*<!-- sh:[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n')
      .replace(/^```[^\n]*\n([\s\S]*?)\n?```[ \t]*$/gm, function (m, code) { fences.push(code); return '\n\u0001' + (fences.length - 1) + '\u0001\n'; });
    return mdBlocks(src.split('\n'), fences);
  };
  function mdBlocks(lines, fences) {
    var out = [], para = [], i = 0, m, items;
    function line(l) { var h = /^#{1,4}\s+(.*)$/.exec(l); return h ? '<b class="md-h">' + mdInline(SW.esc(h[1])) + '</b>' : mdInline(SW.esc(l)); }
    function flush() { if (para.length) out.push('<p>' + para.map(line).join('<br>') + '</p>'); para = []; }
    function run(re) { items = []; while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, '')); return items; }
    while (i < lines.length) {
      var l = lines[i];
      if (!l.trim()) { flush(); i++; }
      else if ((m = /^\u0001(\d+)\u0001$/.exec(l.trim()))) { flush(); out.push('<pre class="md-pre"><code>' + SW.esc(fences[+m[1]]) + '</code></pre>'); i++; }
      else if (/^\s*>/.test(l)) { flush(); out.push('<blockquote>' + mdBlocks(run(/^\s*>\s?/), fences) + '</blockquote>'); }
      else if (/^\s*[-*+]\s+/.test(l)) { flush(); out.push('<ul>' + run(/^\s*[-*+]\s+/).map(function (t) { return '<li>' + line(t) + '</li>'; }).join('') + '</ul>'); }
      else if (/^\s*\d+[.)]\s+/.test(l)) { flush(); out.push('<ol>' + run(/^\s*\d+[.)]\s+/).map(function (t) { return '<li>' + line(t) + '</li>'; }).join('') + '</ol>'); }
      else { para.push(l); i++; }
    }
    flush();
    return out.join('');
  }
  // The same text without its marks, for a line of news or a Word export:
  // links kept as "text (url)".
  SW.mdPlain = function (text) {
    return String(text == null ? '' : text).replace(/\n*<!-- sh:[\s\S]*?-->/g, '')
      .replace(/^```[^\n]*\n?|```$/gm, '')
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2').replace(/~~([^~]+)~~/g, '$1')
      .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, '$1$2').replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1$2')
      .replace(/`([^`\n]+)`/g, '$1').replace(/^\s*>\s?/gm, '').replace(/^#{1,4}\s+/gm, '')
      .replace(/\\([\\`*_\[\]~#>+\-.!()])/g, '$1');
  };

  // Rich text back to Markdown, for the rich editor: what is stored and shared
  // stays Markdown. Marks typed as text are escaped, so they stay text.
  function mdText(s) {
    // web addresses as they are; marks elsewhere escaped
    return s.replace(/\u00a0/g, ' ').split(/((?:https?:\/\/|mailto:)[^\s<>]+)/).map(function (part, k) {
      if (k % 2) return part;
      return part.replace(/([\\`*\[\]~])/g, '\\$1')
        .replace(/_/g, function (m, i, all) { return /\w/.test(all.charAt(i - 1)) && /\w/.test(all.charAt(i + 1)) ? '_' : '\\_'; });
    }).join('');
  }
  function mdWrap(mark, inner) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    return m[2] ? m[1] + mark + m[2] + mark + m[3] : inner;
  }
  SW.htmlToMd = function (root) {
    function kids(n) { var s = ''; for (var c = n.firstChild; c; c = c.nextSibling) s += ser(c); return s; }
    function ser(n) {
      if (n.nodeType === 3) return mdText(n.nodeValue);
      if (n.nodeType !== 1) return '';
      var t = n.tagName, st = n.style || {};
      if (t === 'BR') return '\n';
      if (/^H[1-6]$/.test(t) || (t === 'B' && n.classList.contains('md-h'))) return '\n\n# ' + kids(n).trim() + '\n\n';
      if (t === 'B' || t === 'STRONG') return mdWrap('**', kids(n));
      if (t === 'I' || t === 'EM') return mdWrap('*', kids(n));
      if (t === 'S' || t === 'STRIKE' || t === 'DEL') return mdWrap('~~', kids(n));
      if (t === 'CODE') return n.textContent ? '`' + n.textContent.replace(/`/g, '') + '`' : '';
      if (t === 'A' && n.getAttribute('data-bare') && MD_URL.test(n.getAttribute('href') || '')) return n.getAttribute('href');   // written bare, kept bare
      if (t === 'A') { var h = n.getAttribute('href') || '', k = kids(n); return MD_URL.test(h) && k.trim() ? '[' + k.replace(/\n/g, ' ') + '](' + h.replace(/[()\s]/g, encodeURIComponent) + ')' : k; }
      if (t === 'PRE') return '\n\n```\n' + n.textContent.replace(/\n$/, '') + '\n```\n\n';
      if (t === 'UL' || t === 'OL') {
        var i = 0;
        return '\n\n' + Array.prototype.filter.call(n.children, function (c) { return c.tagName === 'LI'; }).map(function (li) {
          return (t === 'OL' ? (++i) + '. ' : '- ') + kids(li).trim().replace(/\n+/g, ' ');
        }).join('\n') + '\n\n';
      }
      if (t === 'BLOCKQUOTE') return '\n\n' + tidy(kids(n)).split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n') + '\n\n';
      if (t === 'P' || t === 'DIV') return '\n\n' + kids(n) + '\n\n';
      var s = kids(n);
      if (t === 'SPAN') {
        if (/bold|[6-9]00/.test(st.fontWeight || '')) s = mdWrap('**', s);
        if (st.fontStyle === 'italic') s = mdWrap('*', s);
      }
      return s;
    }
    function tidy(s) { return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, ''); }
    return tidy(kids(root));
  };

  // The editor over a note's text box, in two modes, chosen with the switch at
  // the right of its toolbar and kept for next time: rich text (formatting shown
  // as it will look) or Markdown (the marks typed, with a preview). The text box
  // underneath always holds the Markdown, so saving works the same either way.
  // Cmd/Ctrl+B, I and K; pasting a URL over selected words makes a link.
  SW.mdTools = function (ta) {
    if (!ta || ta._mdTools) return;
    ta._mdTools = true;
    var mode = SW.store.get('noteMode', 'rich');
    var bar = SW.el('div', { class: 'md-tools' });
    bar.innerHTML = [['b', '<b>B</b>', 'Bold (⌘B)'], ['i', '<i>I</i>', 'Italic (⌘I)'], ['code', '<code>`</code>', 'Code'],
      ['link', '🔗', 'Link (⌘K): select the words first'], ['ann', '↪', 'Link to another annotation, in this version or any other'], ['quote', '❝', 'Quotation'], ['list', '•', 'List']]
      .map(function (b) { return '<button type="button" data-md="' + b[0] + '" title="' + b[2] + '">' + b[1] + '</button>'; }).join('') +
      '<span class="md-link" hidden><input type="url" placeholder="https://…" spellcheck="false"><button type="button" data-md="link-ok">Link</button></span>' +
      '<span class="md-sep"></span><button type="button" data-md="preview" class="md-prev" title="See it as it will be shown">Preview</button>' +
      '<button type="button" data-md="help" class="md-help" title="How to format and link annotations (Help ▸ Advanced annotation)">?</button>' +
      '<span class="md-mode" role="group" aria-label="Edit as"><button type="button" data-mode="rich" title="Edit with the formatting shown">Rich text</button><button type="button" data-mode="md" title="Edit the Markdown itself">Markdown</button></span>';
    var rich = SW.el('div', { class: 'md-rich note-md', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true' });
    rich.style.minHeight = (Math.max(3, ta.rows || 3) * 1.5) + 'em';
    if (ta.placeholder) rich.dataset.placeholder = ta.placeholder;
    var prev = SW.el('div', { class: 'md-preview note-md', hidden: '' });
    ta.parentNode.insertBefore(bar, ta);
    ta.insertAdjacentElement('afterend', rich);
    rich.insertAdjacentElement('afterend', prev);
    var linkBox = bar.querySelector('.md-link'), linkIn = linkBox.querySelector('input'), saved = null;
    var taFocus = HTMLTextAreaElement.prototype.focus;
    ta.focus = function () { if (mode === 'rich') rich.focus(); else taFocus.call(ta); };

    // ---- Markdown mode: marks inserted into the text box
    function sel() { return { a: ta.selectionStart, b: ta.selectionEnd, t: ta.value.slice(ta.selectionStart, ta.selectionEnd) }; }
    function put(a, b, text, s0, s1) {
      taFocus.call(ta); ta.setSelectionRange(a, b);
      if (!document.execCommand || !document.execCommand('insertText', false, text)) ta.setRangeText(text, a, b, 'end');
      ta.setSelectionRange(a + s0, a + s1);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function wrap(m, ph) { var s = sel(), t = s.t || ph; put(s.a, s.b, m + t + m, m.length, m.length + t.length); }
    function lines(fn) {
      var v = ta.value, a = v.lastIndexOf('\n', ta.selectionStart - 1) + 1, e = v.indexOf('\n', ta.selectionEnd); if (e < 0) e = v.length;
      var t = v.slice(a, e).split('\n').map(fn).join('\n'); put(a, e, t, 0, t.length);
    }
    function mdLinkIn(url) {
      var s = sel(), t = s.t || 'link';
      if (url) put(s.a, s.b, '[' + t + '](' + url + ')', 1, 1 + t.length);
      else put(s.a, s.b, '[' + t + '](https://)', t.length + 3, t.length + 11);
    }

    // ---- rich mode: the browser's own editing commands, kept in step with the text box
    function sync() { ta.value = SW.htmlToMd(rich); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    function cmd(c, v) { rich.focus(); document.execCommand(c, false, v); sync(); }
    function within(tag) { var s = window.getSelection(); var n = s.rangeCount ? s.getRangeAt(0).commonAncestorContainer : null; for (; n && n !== rich; n = n.parentNode) if (n.nodeType === 1 && n.tagName === tag) return n; return null; }
    function fixUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (!MD_URL.test(u) && /^[\w-]+(\.[\w-]+)+/.test(u)) u = 'https://' + u; return MD_URL.test(u) ? u : ''; }
    function richLink(url) {
      var s = window.getSelection();
      if (saved) { rich.focus(); s.removeAllRanges(); s.addRange(saved); }
      if (s.isCollapsed) cmd('insertHTML', '<a href="' + SW.esc(url) + '">' + SW.esc(url) + '</a>&nbsp;');
      else cmd('createLink', url);
    }
    function askLink() {
      var s = window.getSelection();
      saved = s.rangeCount && rich.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
      var a = within('A'); linkIn.value = a ? a.getAttribute('href') : '';
      linkBox.hidden = false; linkIn.focus(); linkIn.select();
    }
    function doneLink() {
      var u = fixUrl(linkIn.value); linkBox.hidden = true;
      if (u) richLink(u); else if (linkIn.value.trim() === '' && saved) { rich.focus(); var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); cmd('unlink'); }
      else rich.focus();
    }
    linkIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doneLink(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); linkBox.hidden = true; rich.focus(); }
    });

    function annLink() {
      var s = window.getSelection(), m = sel();
      var keep = mode === 'rich' && s.rangeCount && rich.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
      SW.notes.pick(function (url, label) {
        label = label.replace(/[\[\]\n]/g, '');
        if (mode === 'rich') {
          rich.focus();
          if (keep) { s.removeAllRanges(); s.addRange(keep); }
          if (!keep || keep.collapsed) cmd('insertHTML', '<a href="' + SW.esc(url) + '">' + SW.esc(label) + '</a>&nbsp;');
          else cmd('createLink', url);
        } else {
          var t = m.t && !/\n/.test(m.t) ? m.t : label;
          put(m.a, m.b, '[' + t + '](' + url + ')', 1, 1 + t.length);
        }
      });
    }
    function act(k) {
      if (k === 'link-ok') return doneLink();
      if (k === 'ann') return annLink();
      if (k === 'help') return SW.notes.help();
      if (k === 'preview') {
        var on = prev.hidden;
        prev.hidden = !on; ta.hidden = on;
        bar.querySelector('.md-prev').classList.toggle('on', on);
        bar.querySelector('.md-prev').textContent = on ? 'Write' : 'Preview';
        if (on) prev.innerHTML = SW.md(ta.value) || '<p class="hint">Nothing yet.</p>'; else taFocus.call(ta);
        return;
      }
      if (mode === 'rich') {
        if (k === 'b') cmd('bold');
        else if (k === 'i') cmd('italic');
        else if (k === 'code') {
          var s = window.getSelection(), t = s.toString();
          var c = within('CODE');
          if (c) { c.replaceWith(document.createTextNode(c.textContent)); sync(); }
          else if (t.indexOf('\n') >= 0) cmd('insertHTML', '<pre>' + SW.esc(t) + '</pre><p><br></p>');
          else cmd('insertHTML', '<code>' + SW.esc(t || 'code') + '</code>&nbsp;');
        }
        else if (k === 'link') askLink();
        else if (k === 'quote') cmd('formatBlock', within('BLOCKQUOTE') ? 'P' : 'BLOCKQUOTE');
        else if (k === 'list') cmd('insertUnorderedList');
      } else {
        if (k === 'b') wrap('**', 'bold');
        else if (k === 'i') wrap('*', 'italic');
        else if (k === 'code') { var m = sel(); if (m.t.indexOf('\n') >= 0) put(m.a, m.b, '```\n' + m.t + '\n```', 4, 4 + m.t.length); else wrap('`', 'code'); }
        else if (k === 'link') mdLinkIn();
        else if (k === 'quote') lines(function (l) { return '> ' + l; });
        else if (k === 'list') lines(function (l) { return '- ' + l; });
      }
    }
    function setMode(m, keep) {
      if (m === 'rich' && mode !== 'rich') rich.innerHTML = SW.md(ta.value);
      mode = m;
      if (!keep) SW.store.set('noteMode', m);
      if (!prev.hidden) { prev.hidden = true; bar.querySelector('.md-prev').classList.remove('on'); bar.querySelector('.md-prev').textContent = 'Preview'; }
      rich.hidden = m !== 'rich'; ta.hidden = m === 'rich';
      bar.querySelector('.md-prev').hidden = m === 'rich';
      linkBox.hidden = true;
      SW.$$('[data-mode]', bar).forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-pressed', b.dataset.mode === m); });
    }
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('[data-md], [data-mode]')) e.preventDefault(); });   // keep the selection
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-md]'), md = e.target.closest('[data-mode]');
      if (b) { e.preventDefault(); e.stopPropagation(); act(b.dataset.md); }
      else if (md) { e.preventDefault(); e.stopPropagation(); setMode(md.dataset.mode); ta.focus(); }
    });
    function keys(e) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      var k = { b: 'b', i: 'i', k: 'link' }[e.key.toLowerCase()];
      if (k) { e.preventDefault(); act(k); }
    }
    ta.addEventListener('keydown', keys);
    rich.addEventListener('keydown', function (e) {
      // Cmd/Ctrl+Enter (save) and Escape (cancel) go to whatever listens on the text box
      if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
        e.preventDefault();
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, bubbles: true, cancelable: true }));
        return;
      }
      keys(e);
    });
    rich.addEventListener('input', sync);
    ta.addEventListener('paste', function (e) {
      var s = sel(), u = (e.clipboardData && e.clipboardData.getData('text/plain') || '').trim();
      if (s.t && !/\n/.test(s.t) && MD_URL.test(u) && !/\s/.test(u)) { e.preventDefault(); mdLinkIn(u); }
    });
    // pasted or dropped into the rich editor: plain text, or a link over selected words
    function plainIn(e, dt) {
      if (!dt) return;
      e.preventDefault();
      var t = dt.getData('text/plain') || '', s = window.getSelection();
      if (!s.isCollapsed && MD_URL.test(t.trim()) && !/\s/.test(t.trim())) { saved = null; cmd('createLink', t.trim()); return; }
      cmd('insertText', t);
    }
    rich.addEventListener('paste', function (e) { plainIn(e, e.clipboardData); });
    rich.addEventListener('drop', function (e) { plainIn(e, e.dataTransfer); });
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (x) { /* older browsers */ }
    // @: the people who have annotated, offered as you type their initials
    var menu = SW.el('div', { class: 'md-mention', hidden: '' });
    rich.insertAdjacentElement('afterend', menu);
    function mentionAt() {
      if (mode === 'rich') {
        var sl = window.getSelection(); if (!sl.rangeCount || !rich.contains(sl.anchorNode) || sl.anchorNode.nodeType !== 3) return null;
        var before = sl.anchorNode.nodeValue.slice(0, sl.anchorOffset), m = /(?:^|\s)@([A-Za-z]{0,6})$/.exec(before);
        return m ? { q: m[1], node: sl.anchorNode, end: sl.anchorOffset } : null;
      }
      var mm = /(?:^|\s)@([A-Za-z]{0,6})$/.exec(ta.value.slice(0, ta.selectionStart));
      return mm ? { q: mm[1], end: ta.selectionStart } : null;
    }
    function people() { return (SW.notes && SW.notes.people ? SW.notes.people() : []); }
    function offer() {
      var at = mentionAt();
      if (!at) { menu.hidden = true; return; }
      var q = at.q.toLowerCase(), ps = people().filter(function (p) { return !q || p.by.toLowerCase().indexOf(q) === 0 || (p.name || '').toLowerCase().indexOf(q) === 0; }).slice(0, 8);
      if (!ps.length) { menu.hidden = true; return; }
      menu.innerHTML = ps.map(function (p) { return '<button type="button" data-who="' + SW.esc(p.by) + '"><b>@' + SW.esc(p.by) + '</b>' + (p.name ? ' <span class="faint">' + SW.esc(p.name) + '</span>' : '') + '</button>'; }).join('');
      menu.hidden = false;
    }
    function pick(who) {
      var at = mentionAt(); menu.hidden = true; if (!at) return;
      if (mode === 'rich') {
        var r = document.createRange(); r.setStart(at.node, at.end - at.q.length - 1); r.setEnd(at.node, at.end);
        var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r);
        cmd('insertText', '@' + who + ' ');
      } else put(at.end - at.q.length - 1, at.end, '@' + who + ' ', who.length + 2, who.length + 2);
    }
    menu.addEventListener('mousedown', function (e) { e.preventDefault(); });
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-who]'); if (b) { e.stopPropagation(); pick(b.dataset.who); } });
    ta.addEventListener('input', offer);
    rich.addEventListener('input', offer);
    function mentionKeys(e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); menu.hidden = true; }
      else if (e.key === 'Tab' || e.key === 'Enter') { var first = menu.querySelector('[data-who]'); if (first) { e.preventDefault(); e.stopPropagation(); pick(first.dataset.who); } }
    }
    ta.addEventListener('keydown', mentionKeys, true);
    rich.addEventListener('keydown', mentionKeys, true);
    // reopened for a fresh note, or the text set from outside: show it again
    ta._mdReset = function () { rich.innerHTML = SW.md(ta.value); setMode(SW.store.get('noteMode', 'rich'), true); };
    rich.innerHTML = SW.md(ta.value);
    setMode(mode, true);
  };

  SW.figpack = {
    RE: /\n*<!-- sh:fig:gz ([A-Za-z0-9+\/=]+) -->\s*$/,
    pack: function (svg) {
      var bytes = new TextEncoder().encode(svg);
      if (!root.CompressionStream) return Promise.resolve('');
      var cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(cs).arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf), bin = '';
        for (var i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return '\n\n<!-- sh:fig:gz ' + btoa(bin) + ' -->';
      });
    },
    split: function (text) { var m = SW.figpack.RE.exec(String(text || '')); var H = SW.noteHistory; return m ? { text: H.visible(String(text).slice(0, m.index)), b64: m[1] } : { text: H.visible(text), b64: null }; },
    unpack: function (b64) {
      if (!root.DecompressionStream) return Promise.reject(new Error('This browser cannot open the figure.'));
      var bin = atob(b64), b = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    },
    img: function (svg, cls) { return '<img class="' + (cls || '') + '" alt="Figure" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">'; },
    big: function (svg, title) {
      var d = SW.el('dialog', { class: 'tray-big' });
      d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(title || 'Figure') + '</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div><div class="tray-fig">' + SW.figpack.img(svg, 'fig-full') + '</div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); } });
      d.addEventListener('close', function () { d.remove(); });
      d.showModal();
    }
  };
  SW.displaySVG = function (svg) { return SW.resolveVars(svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')); };
  // Palettes for figures that draw their own ground (sky, ships).
  SW.PLATE = { bg: '#02040a', ink: '#e6f4ff', ink2: '#8fc3d6', dim: '#7fa6c4', accent: '#e58be0', dark: true };
  SW.exportPalette = function () {
    var k = SW.figBg();
    if (k === 'theme') {
      var t = SW.themeInfo();
      return { bg: SW.cssVar('--plate'), dark: t.dark, ink: SW.cssVar('--g-text'), ink2: SW.cssVar('--beam'), dim: SW.cssVar('--g-muted'), accent: SW.cssVar('--amber') };
    }
    var dark = k === 'black';
    return { bg: SW.FIGBG[k], dark: dark, ink: dark ? '#e6f4ff' : '#1b1f23', ink2: dark ? '#8fc3d6' : '#0f6f86',
             dim: dark ? '#7fa6c4' : '#56606a', accent: dark ? '#e58be0' : '#a3317a' };
  };
  // An SVG for export: coloured for the chosen background, with that background laid under it.
  SW.exportSVG = function (svg) {
    var bg = SW.figBgColour();
    // XML 1.0 forbids most control characters; the sources carry form feeds.
    svg = svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    svg = SW.resolveVars(svg, SW.figTheme());
    if (bg) svg = svg.replace(/(<svg\b[^>]*>)/, '$1<rect x="0" y="0" width="100%" height="100%" fill="' + bg + '"/>');
    return svg;
  };
  // SVG and PNG buttons for a figure. getSvg(palette) returns the markup.
  // A figure's reference, in small type in its bottom right corner, so an exported
  // figure carries the source it was drawn from (ref: a string, or a function giving one)
  SW.refsOf = function (vids) { var seen = {}; return (vids || []).filter(function (v) { if (!v || seen[v]) return false; seen[v] = 1; return true; }).map(function (v) { return SW.refText(v); }).join(' '); };
  SW.stampRef = function (svg, ref) {
    if (typeof ref === 'function') ref = ref();
    if (!ref) return svg;
    var m = /<svg\b[^>]*>/.exec(svg); if (!m) return svg;
    var vb = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(m[0]), wd = /\bwidth="([\d.]+)/.exec(m[0]), ht = /\bheight="([\d.]+)/.exec(m[0]);
    var x0 = vb ? +vb[1] : 0, y0 = vb ? +vb[2] : 0, W = vb ? +vb[3] : wd ? +wd[1] : 0, H = vb ? +vb[4] : ht ? +ht[1] : 0;
    if (!W || !H) return svg;
    var t = '<text x="' + (x0 + W - 6) + '" y="' + (y0 + H - 5) + '" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="' + Math.max(8, Math.round(W / 110)) + '" fill="#8a96a3" opacity="0.9">' + SW.esc(ref) + '</text>';
    return svg.replace(/<\/svg>\s*$/, t + '</svg>');
  };
  SW.figureButtons = function (getSvg0, name0, ref) {
    var nm = function () { return typeof name0 === 'function' ? name0() : name0; };
    var getSvg = ref ? function (pal) { return SW.stampRef(getSvg0(pal), ref); } : getSvg0;
    var w = SW.el('span');
    w.appendChild(SW.el('button', { class: 'btn', title: 'Save as SVG (background: ' + SW.figBg() + '; change under ⚙)', onclick: function () {
      root.SWExport.download(nm() + '.svg', SW.exportSVG(getSvg(SW.exportPalette())), 'image/svg+xml');
    } }, '▣ SVG'));
    w.appendChild(document.createTextNode(' '));
    w.appendChild(SW.el('button', { class: 'btn', title: 'Save as PNG at three times screen size (background: ' + SW.figBg() + '; change under ⚙)', onclick: function () {
      SW.toast('Rendering PNG…');
      SW.figures.svgToPNG(SW.exportSVG(getSvg(SW.exportPalette())), 3, SW.figBgColour()).then(function (r) {
        root.SWExport.download(nm() + '.png', r.png, 'image/png');
      }, function () { SW.toast('The PNG could not be made from this figure; try SVG, or zoom out first.', 6000); });
    } }, '▣ PNG'));
    w.appendChild(document.createTextNode(' '));
    w.appendChild(SW.el('button', { class: 'btn ghost', title: 'Put this figure in My notes (private), to gather with others for a chapter', onclick: function () {
      if (SW.tray) SW.tray.addFigure(getSvg(SW.exportPalette()), nm());
    } }, '＋ My notes'));
    return w;
  };

  // Export a document model as .docx or .md.
  SW.exportDoc = function (doc, base, fmt) {
    var E = root.SWExport;
    if (!E) { SW.toast('Export library not loaded'); return; }
    var name = SW.slug(base || doc.title || 'shrdlu');
    if (fmt === 'md') {
      E.download(name + '.md', E.markdown(doc), 'text/markdown');
      (E.markdownAssets ? E.markdownAssets(doc) : []).forEach(function (a) {
        E.download(name + '-' + a.name, a.data, 'image/png');
      });
    } else {
      E.download(name + '.docx', E.docx(doc),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    SW.toast('Exported ' + name + (fmt === 'md' ? '.md' : '.docx'));
  };
  SW.exportButtons = function (makeDoc, base) {
    var wrap = SW.el('span');
    wrap.appendChild(SW.el('button', { class: 'btn', title: 'Export to Word', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { SW.exportDoc(d, typeof base === 'function' ? base() : base, 'docx'); });
    } }, '⤓ Word'));
    wrap.appendChild(document.createTextNode(' '));
    wrap.appendChild(SW.el('button', { class: 'btn', title: 'Export to Markdown', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { SW.exportDoc(d, typeof base === 'function' ? base() : base, 'md'); });
    } }, '⤓ Markdown'));
    wrap.appendChild(document.createTextNode(' '));
    wrap.appendChild(SW.el('button', { class: 'btn ghost', title: 'Put this (as it would export) in My notes (private), to gather with others for a chapter', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { if (SW.tray) SW.tray.addDoc(d); });
    } }, '＋ My notes'));
    return wrap;
  };

  SW.docMeta = function (b) {
    return [
      ['Version', b.v.label], ['Reference', SW.refText(b.v.id)], ['Date', b.v.date], ['Authors', b.v.authors],
      ['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : ''); }).join('; ')],
      ['Read as', 'MacLisp 1.6 source, indexed by the bench'],
      ['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION]
    ];
  };
})(this);
