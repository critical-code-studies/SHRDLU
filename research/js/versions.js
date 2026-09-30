/*
 * versions.js - the SHRDLU variorum as the research bench sees it.
 *
 * SHRDLU survives as sets of MacLisp files, not as one text. Each record here
 * is a witness: a surviving set of files (or a lost one known from the record),
 * with the files in the order the system's own loader read them (LOADSHRDLU in
 * the file "loader": Micro-Planner first, then the system, the grammar and
 * dictionary, the semantics, the answering code, the blocks world and its data).
 * Files are shown exactly as held under source/; nothing is normalised.
 *
 * roles: 'program' (read in by the loader), 'support' (loading, macros, the
 * scripted demonstration), 'doc' (documentation and indexes, shown but not
 * indexed as code).
 */
(function (root) {
  'use strict';

  var SRC = '../source/';

  // No normalisations yet: kept so the views that list them still work.
  var TRANSFORMS = {};

  function files(dir, list) {
    return list.map(function (x) {
      var f = typeof x === 'string' ? { src: x } : x;
      f.src = dir + f.src;
      f.role = f.role || 'program';
      return f;
    });
  }

  var AUTHORS = 'Terry Winograd; revised by Dave McDonald, Jeff Hill, Stu Card and Andee Rubin';

  var VERSIONS = [
    { id: 'jan71', label: 'The January 1971 files', date: 'c. January 1971', sort: 19710100, authors: 'Terry Winograd',
      fork: 'mit', status: 'lost', medium: null,
      summary: 'The system as it stood around January 1971. Dave McDonald’s directory note (#FILES, 1975) describes files whose names begin “Z” as “the original files of the system circa January 1971”, using “the old list oriented data structures” and “essentially uncommented”. The 1987 listing of MC:SHRDLU; in Winograd’s file-note shows an archive, AR0 JAN71. The bench holds no copy, but the Z files probably survive: z.answer, z.blocks, z.break, z.dictio, z.gramar, z.mover, z.semant and z.syscom are in the directory SHRDLU; as saved on a backup tape of 9 March 1973 (Tapes of Tech Square, tape 3100015), published in the PDP-10/its-vault repository on 21 February 2018.' },
    { id: 'c1', label: 'The CMU C1 version', date: 'June 1972', sort: 19720600, authors: AUTHORS + '; TOPS-10 MacLisp by George Robertson',
      fork: 'cmu', status: 'lost', medium: null,
      summary: 'The version distributed from Carnegie-Mellon, “current with the MIT version to June 1972”, moved off ITS to DEC’s TOPS-10 by converting MacLisp itself; the “Show and Tell” interface was added for the CMU workshop of June 1972. Without the display (so the CMU manual, preserved in the Stanford set). The bench holds no copy of the CMU files.' },
    { id: 'mit', label: 'MIT, as found on ITS', date: 'files 1972–77; imported 24 July 2024', sort: 19770000, authors: AUTHORS,
      fork: 'mit', status: 'recovered', medium: 'Source files (ITS backup tapes)',
      summary: 'The directory SHRDLU; of the MIT machines as recovered from ITS backup tapes and imported unedited into the PDP-10/its repository by Eric Swenson on 24 July 2024 (“the original, unedited files written for an old version of Maclisp”). The ITS version numbers (PLNR 182, GRAMAR 28, SYSCOM 180) match the 1987 listing in Winograd’s file-note, with two exceptions: smspec.94 where the listing has SMSPEC 96, and PLNR 182, which the listing shows rewritten on MC on 18 August 1987 (the Stanford plnr is that later state; this plnr.182 is earlier). Which tape or tapes the import came from is not recorded. It holds the display code (graphf.3), the combined blocks file the loader reads as BLOCKS (blocks.144), and DEMO FLICK (added to PDP-10/its in 2019 with the TWDEMO program, not in the 2024 import; the same, byte for byte, as the copy on the 1973 backup tape), the script of the 1976 TWDEMO replay program.',
      build: files('its/as-found/', ['plnr.182', 'thtrac.22', 'syscom.180', 'morpho.13', 'show.13', 'progmr.57', 'ginter.5', 'gramar.28', 'dictio.73',
        'smspec.94', 'smass.19', 'smutil.148', 'newans.78', 'blockp.3', 'blockl.4', 'blocks.144', 'data.6', 'graphf.3', 'setup.62',
        { src: 'loader.18', role: 'support' }, { src: 'twutil.14', role: 'support' }, { src: 'demo.flick', role: 'support' }]) },
    { id: 'stanford', label: 'Winograd’s distribution (Stanford)', date: 'files 1972–77; distributed 1997', sort: 19970916, authors: AUTHORS,
      fork: 'mit', status: 'recovered', medium: 'Source files (Winograd’s code directory, dated 16 September 1997)',
      summary: 'The 33-file directory Winograd gave out from Stanford, “a cleaned up version done by Stu Card, Andee Rubin, and Terry Winograd in 1972”, retrieved from MIT’s MC machine in 1987 (John Mallery’s letter in file-note). Its program files carry the same text as the ITS files: they differ in end-of-file page marks and blank lines, in plnr laid out with other indentation (the same words), in bare carriage returns of the ITS text made into line breaks (two of them splitting comments in smutil so that their ends read as code), and in a block of about sixty lines of smspec whose characters are corrupted. It adds the CMU manual, the MacLisp usage index, Winograd’s README, and files the ITS copy lacks (cgram, parser, init, macros). No display code.',
      build: files('original/code/', ['plnr', 'thtrac', 'syscom', 'morpho', 'show', 'progmr', 'ginter', 'gramar', 'dictio',
        'smspec', 'smass', 'smutil', 'newans', 'blockp', 'blockl', 'data', 'setup',
        { src: 'loader', role: 'support' }, { src: 'init', role: 'support' }, { src: 'macros', role: 'support' }, { src: 'parser', role: 'support' },
        { src: 'cgram', role: 'support' }, { src: 'demo', role: 'support' },
        { src: 'README', role: 'doc' }, { src: 'file-note', role: 'doc' }, { src: 'files', role: 'doc' }, { src: 'blurb', role: 'doc' },
        { src: 'help', role: 'doc' }, { src: 'minih', role: 'doc' }, { src: 'mannew', role: 'doc' }, { src: 'manual', role: 'doc' },
        { src: 'lisp', role: 'doc' }, { src: 'fasl', role: 'doc' }]) },
    { id: 'ejs', label: 'Swenson’s restoration', date: 'July–August 2024', sort: 20240823, authors: AUTHORS + '; restored by Eric Swenson',
      fork: 'restored', status: 'recovered', medium: 'Edited source (runs under emulated ITS)',
      summary: 'Eric Swenson’s restoration in the PDP-10/its repository (July to August 2024): the MIT files made to load and run on a later MacLisp, bugs fixed, compiled, with the Type 340 display on the pdp10-ka emulator. His note of 22 July records that SHRDLU “fails at some things that the DEMO apparently succeeded in doing”. The text held is the repository at commit 173f8220 (23 August 2024).',
      build: files('its/restored/', ['plnr.185', 'thtrac.24', 'macros.2', 'syscom.182', 'morpho.15', 'show.15', 'progmr.59', 'proggo.33', 'ginter.6', 'gramar.30', 'dictio.76',
        'smspec.97', 'smass.20', 'smutil.152', 'newans.83', 'blockp.7', 'blockl.7', 'data.7', 'data2.1', 'graphf.6', 'setup.65',
        { src: 'loader.22', role: 'support' }, { src: 'plnrfi.2', role: 'support' }, { src: 'parser.12', role: 'support' }, { src: 'graphf.init', role: 'support' },
        { src: 'twutil.14', role: 'support' }, { src: 'demo.flick', role: 'support' }, { src: '_index.4', role: 'doc' }]) }
  ];

  // One dialect: the files are read, not assembled. Kept for the views that ask.
  var DIALECTS = { maclisp: { label: 'MacLisp 1.6 (read, not run)', options: {}, noPass1: true } };

  VERSIONS.forEach(function (v) {
    v.dialect = 'maclisp';
    v.buildNotes = (v.buildNotes || []).map(function (t) { return { by: 'log', who: 'Claude Code (build log)', date: '2026-09-30', text: t }; });
    v.runnable = !!v.build;   // runs on the bench's MacLisp (js/maclisp.js), with its recorded repairs (js/repairs.js)
    v.url = function () { return '#v=' + encodeURIComponent(v.id); };
  });

  function byId(id) {
    for (var i = 0; i < VERSIONS.length; i++) if (VERSIONS[i].id === id) return VERSIONS[i];
    return null;
  }

  // ---------- descent ----------
  // parent: the version it was made from. witnessOf: another copy of the same
  // files, not a step of its own. The Stanford set is a second copy of the
  // MC:SHRDLU; files that the ITS tapes also preserve.
  var PARENT = { c1: 'jan71', mit: 'jan71', ejs: 'mit' };
  var WITNESS = { stanford: 'mit' };
  var ALSO = {};
  var INFLUENCE = {};
  VERSIONS.forEach(function (v) {
    v.parent = PARENT[v.id] || null;
    v.witnessOf = WITNESS[v.id] || null;
    v.also = ALSO[v.id] || [];
    v.influence = INFLUENCE[v.id] || [];
  });
  function ancestry(id) {
    var v = byId(id), chain = [];
    if (!v) return chain;
    var cur = v.witnessOf || v.id;
    while (cur) { chain.unshift(cur); var p = byId(cur); cur = p && p.parent; }
    if (v.witnessOf) chain[chain.length - 1] = v.id;
    return chain;
  }
  var LINES = [
    { id: 'restored', label: 'To the restoration (MIT → Swenson 2024)', tip: 'ejs' },
    { id: 'stanford', label: 'Winograd’s copy (MIT → Stanford)', tip: 'stanford' }
  ];
  LINES.forEach(function (l) { l.ids = ancestry(l.tip); });

  function findTitle() { return 1; }

  function load(v, fetchText, splitLines) {
    if (!v.build) return Promise.resolve({ version: v, parts: [], files: [] });
    return Promise.all(v.build.map(function (b) { return fetchText(b.src); })).then(function (texts) {
      var parts = v.build.map(function (b, i) {
        var raw = texts[i];
        return { src: b.src, role: b.role, raw: raw, text: raw, patch: null, title: 1, end: null };
      });
      // the files the indexer reads as code: program and support, not documentation
      var files = parts.map(function (p) { return { name: p.src.split('/').pop(), text: p.role === 'doc' ? '' : p.text, doc: p.role === 'doc' }; });
      return { version: v, parts: parts, files: files };
    });
  }

  var api = { VERSIONS: VERSIONS, TRANSFORMS: TRANSFORMS, DIALECTS: DIALECTS, byId: byId, load: load,
              findTitle: findTitle, SRC: SRC, LINES: LINES, ancestry: ancestry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SWVersions = api;
})(this);
