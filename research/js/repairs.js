/*
 * repairs.js - what the bench does to make a version of SHRDLU run, recorded.
 *
 * Following the principles for reconstructing digital ruins (Berry, "Digital
 * Ruins and Critical Code Studies", Stunlaw, January 2025): minimum
 * intervention; every repair reversible and documented; the surviving texts
 * never altered (the files under source/ are read as they are, and repairs are
 * applied as the files are loaded); repairs marked where the code is shown.
 *
 * Kinds:
 *   'text'  a passage of a file replaced as it is loaded (lines n0..n1 of the
 *           held file read as the given text instead);
 *   'load'  a change to what the version's own loader reads;
 *   'form'  Lisp evaluated after loading and before SHRDLU starts;
 *   'start' how the bench starts the program and answers its start-up questions.
 * The machine's own stand-ins for ITS and MacLisp (the libraries, the display)
 * are listed separately, as MACHINE: they are the computer, not the program.
 *
 * mend: the kind of repair, after the forms of kintsugi, as the Spacewar! bench
 * marks them (so that the two benches keep one register):
 *   'hibi'       a reading corrected against another copy of the same file
 *                (a crack filled with gold);
 *   'yobitsugi'  a passage supplied from another copy or version (a piece from
 *                another vessel);
 *   'kake'       code written where none survives (a lost piece remade);
 *   'mount'      a change to how the program is loaded or started, not to its
 *                text (paler gold: adapting the evidence to run, not editing it).
 * Uncertain readings left as found are not repairs; Read marks them in grey.
 * by, date: who made the repair and when.
 */
(function (root) {
  'use strict';

  // Lisp that tells the program there is no display, as Swenson's start-up
  // does when the answer to "DO YOU WANT THE DISPLAY" is N (setup.65, INITIALSTUFF).
  var NO_DISPLAY = "(PROGN (AND (GET 'NO340 'EXPR) (NO340)) (PUTPROP 'MOVETO '(LAMBDA (X Y Z) NIL) 'EXPR) (PUTPROP 'GRASP '(LAMBDA (A) NIL) 'EXPR) (PUTPROP 'UNGRASP '(LAMBDA () NIL) 'EXPR) (PUTPROP 'BLINK '(LAMBDA (A) NIL) 'EXPR))";

  var REPAIRS = {
    ejs: [
      { id: 'E-S1', kind: 'start', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'Started as its dump started it',
        what: 'The bench loads the files with LOAD-SHRDLU-INTERPRETED (loader.22) and then calls DUMP-SHRDLU, which runs INITIALSTUFF: the banner, the display question, SHRDLU’s break loop, then (SHRDLU). The bench answers N to the display question and types GO to leave the break loop.',
        why: 'On ITS the program was loaded once and saved as a dump (:PDUMP SHRDLU;TS SHRDLU); each user then started the dump, which ran INITIALSTUFF. The bench loads and starts in one go. It answers N because its DEC 340 display is not built yet.',
        evidence: 'loader.22 (LOAD-SHRDLU-INTERPRETED); setup.65 (DUMP-SHRDLU, INITIALSTUFF); PDP-10/its build/shrdlu.tcl',
        start: { load: '(PROGN (LOAD (QUOTE LOADER)) (LOAD-SHRDLU-INTERPRETED))', run: '(DUMP-SHRDLU)', answers: ['N', 'GO '] } }
    ],
    mit: [
      { id: 'I-S1', kind: 'start', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'Loaded by its own loader, started with (SHRDLU)',
        what: 'The bench loads the files with LOADSHRDLU (loader.18), which reads each file form by form under an ERRSET, and then calls (SHRDLU).',
        why: 'This copy’s INITIALSTUFF, which would ask about the display, has that part commented out; the dump it made is not held.',
        evidence: 'loader.18 (LOADSHRDLU, LOADX); setup.62 (INITIALSTUFF, lines 239–261 commented out)',
        start: { load: '(PROGN (LOAD (QUOTE LOADER)) (LOADSHRDLU))', run: '(SHRDLU)', answers: [] } },
      { id: 'I-T1', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', file: 'dictio', n0: 178, n1: 178, title: 'BOTH calls MOVE-PTW where it called **',
        what: 'Line 178 of dictio.73, in the dictionary entry for BOTH, is read as Swenson’s restoration has it: (move-ptw N in place of (** N.',
        why: 'The entry calls a function ** that no surviving file defines, so any sentence with “both” halts (exchange 13 of the dialogue). The restoration calls MOVE-PTW, PROGRAMMAR’s function for moving the word pointer, whose arguments (N NW test NW) the call already has. (Finding F9.)',
        evidence: 'its/restored/dictio.76, line 178; progmr (MOVE-PTW)',
        from: { src: 'its/restored/dictio.76', n0: 178, n1: 178 } },
      { id: 'I-F1', kind: 'form', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'No display: the arm’s drawing made to do nothing',
        what: 'After loading, (NO340) is run and MOVETO, GRASP, UNGRASP and BLINK are defined to do nothing, as SHRDLU’s own start-up does when told there is no DEC 340.',
        why: 'The start-up that set the display up, or switched it off, is commented out in this copy, so the arm’s motion (MOVETO in graphf) meets an uninitialised display (GP-HANDIT unbound) and halts. The bench has no 340 display yet.',
        evidence: 'Swenson’s restoration does the same (setup.65, INITIALSTUFF, the NO340 branch); graphf.3 (NO340)',
        form: NO_DISPLAY }
    ],
    stanford: [
      { id: 'S-T1', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', file: 'smspec', n0: 712, n1: 771, title: 'The damaged block of smspec read from the ITS copy',
        what: 'Lines 712 to 771 of smspec are read as the ITS copy (smspec.94) has them.',
        why: 'In this copy those lines carry corrupted characters (THEN as P^HEN, REVERSE as REVE@SE), SMPOSS2 is named SMPORS2 and a parenthesis is lost, so the file does not read as whole forms from line 707. The two copies agree in every other line. (Finding F1.)',
        evidence: 'Collation of original/code/smspec with its/as-found/smspec.94 (the Findings view repeats it on every visit)',
        from: { src: 'its/as-found/smspec.94', n0: 712, n1: 771 } },
      { id: 'S-T2', kind: 'text', mend: 'hibi', by: 'the project', date: '30 Sep 2026', file: 'smutil', n0: 395, n1: 396, title: 'A comment broken into code, rejoined (smutil 395–396)',
        what: 'Lines 395 and 396 of smutil are read as the one line the ITS copy has (smutil.148, line 395).',
        why: 'The ITS line holds a bare carriage return inside a comment (“RETURNED JUST ^MTHE WAY IT WAS”), which MacLisp read as part of the comment. In this copy the carriage return became a line break, so “THE WAY IT WAS. HENCE THIS” stands on a line of its own without a semicolon, as code. Every bare carriage return in the ITS files became a line break in this copy. (Finding F8.)',
        evidence: 'its/as-found/smutil.148, line 395; the same conversion at gramar line 1 and demo line 155',
        from: { src: 'its/as-found/smutil.148', n0: 395, n1: 395 } },
      { id: 'S-T3', kind: 'text', mend: 'hibi', by: 'the project', date: '30 Sep 2026', file: 'smutil', n0: 862, n1: 863, title: 'A comment broken into code, rejoined (smutil 862–863)',
        what: 'Lines 862 and 863 of smutil are read as the one line the ITS copy has (smutil.148, line 861).',
        why: 'As S-T2: “RETRIEVES THE ^MAPPROPRIATE RECOMMENDATION USING” was broken at its carriage return, leaving “APPROPRIATE RECOMMENDATION USING” as code.',
        evidence: 'its/as-found/smutil.148, line 861',
        from: { src: 'its/as-found/smutil.148', n0: 861, n1: 861 } },
      { id: 'S-T4', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', file: 'dictio', n0: 178, n1: 178, title: 'BOTH calls MOVE-PTW where it called **',
        what: 'Line 178 of dictio, in the dictionary entry for BOTH, is read as Swenson’s restoration has it: (move-ptw N in place of (** N.',
        why: 'The entry calls a function ** that no surviving file defines, so any sentence with “both” halts (exchange 13 of the dialogue). The restoration calls MOVE-PTW, PROGRAMMAR’s function for moving the word pointer, whose arguments (N NW test NW) the call already has. (Finding F9.)',
        evidence: 'its/restored/dictio.76, line 178; progmr (MOVE-PTW)',
        from: { src: 'its/restored/dictio.76', n0: 178, n1: 178 } },
      { id: 'S-L1', kind: 'load', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'BLOCKS read as BLOCKL and BLOCKP',
        what: 'Where the loader asks for BLOCKS, the bench reads BLOCKL and BLOCKP.',
        why: 'LOADSHRDLU asks for a file BLOCKS, which this copy does not hold (the ITS copy has it, as blocks.144). The loader’s other function, SHRDLU-COMPILED, loads BLOCKL and BLOCKP, which this copy does hold.',
        evidence: 'loader (LOADSHRDLU, SHRDLU-COMPILED); files (McDonald’s description of BLOCKP and BLOCKL)',
        alias: { BLOCKS: ['BLOCKL', 'BLOCKP'] } },
      { id: 'S-L2', kind: 'load', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'The display code is absent, and skipped',
        what: 'The loader’s FASLOAD of GRAPHF is skipped, with a note in the load log.',
        why: 'This copy holds no display code (graphf). On ITS it was a compiled file on another directory, SHRDL1;.',
        evidence: 'loader (FASLOAD GRAPHF FASL DSK SHRDL1); the 1987 listing in file-note (GRAPHF FASL on SHRDLU;)',
        skip: ['GRAPHF'] },
      { id: 'S-S1', kind: 'start', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'Loaded by its own loader, started with (SHRDLU)',
        what: 'The bench loads the files with LOADSHRDLU and then calls (SHRDLU).',
        why: 'As for the MIT copy.', evidence: 'loader (LOADSHRDLU)',
        start: { load: '(PROGN (LOAD (QUOTE LOADER)) (LOADSHRDLU))', run: '(SHRDLU)', answers: [] } },
      { id: 'S-F1', kind: 'form', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'No display: the arm’s drawing made to do nothing',
        what: 'MOVETO, GRASP, UNGRASP and BLINK are defined to do nothing.',
        why: 'The display code is not in this copy (S-L2).', evidence: 'as I-F1', form: NO_DISPLAY }
    ]
  };

  // The machine's stand-ins for ITS and MacLisp: not repairs to SHRDLU.
  var MACHINE = [
    ['MacLisp', 'An interpreter written for the bench (js/maclisp.js), in two dialects: MacLisp 1.6 for the 1970s files, the later MacLisp for Swenson’s restoration. Variables are special, numbers are read in octal, as MacLisp read them.'],
    ['Libraries', 'SLAVE (the 340 display), FORMAT, UMLMAC, TRACE and GRINDEF are supplied by the interpreter; their FASL files are not loaded.'],
    ['Files', 'The version’s files, held under source/, stand for its ITS directory (DSK: SHRDLU;); a file is found by its first name, the highest version (">") being the one held.'],
    ['Teletype', 'Characters typed in the terminal, the return key sent as a carriage return, as on ITS.'],
    ['Clock', 'RUNTIME counts the interpreter’s steps, so that a run can be repeated exactly; RANDOM is a seeded generator for the same reason.'],
    ['Display', 'Not yet built: the program is told there is no DEC 340.']
  ];

  var MENDS = {
    hibi: { label: 'Corrected', note: 'a reading corrected against another copy of the same file (hibi: a crack filled with gold)' },
    yobitsugi: { label: 'Supplied', note: 'a passage supplied from another copy or version (yobitsugi: a piece from another vessel)' },
    kake: { label: 'Remade', note: 'code written where none survives (kake: a lost piece remade)' },
    mount: { label: 'For running', note: 'a change to how the program is loaded or started, not to its text (a mount, not a mend)' }
  };

  function forVersion(vid) { return REPAIRS[vid] || []; }
  function startOf(vid) { var s = forVersion(vid).filter(function (r) { return r.kind === 'start'; })[0]; return s ? s.start : null; }

  // Apply the text repairs to a version's files (a map NAME -> text) using the
  // other copies' texts (fetch(src) -> text). Returns the lines replaced, for marking.
  function applyText(vid, files, fetchSync) {
    var marks = [];
    // from the bottom of each file up, so that each repair's line numbers are the held file's own
    forVersion(vid).filter(function (r) { return r.kind === 'text'; }).sort(function (a, b) { return a.file === b.file ? b.n0 - a.n0 : 0; }).forEach(function (r) {
      var key = r.file.toUpperCase();
      if (files[key] == null) return;
      var lines = files[key].split('\n'), src = fetchSync(r.from.src).split('\n');
      var repl = src.slice(r.from.n0 - 1, r.from.n1);
      lines.splice.apply(lines, [r.n0 - 1, r.n1 - r.n0 + 1].concat(repl));
      files[key] = lines.join('\n');
      marks.push({ repair: r.id, file: r.file, n0: r.n0, n1: r.n1 });
    });
    return marks;
  }
  function aliases(vid) { var a = {}; forVersion(vid).forEach(function (r) { if (r.alias) Object.keys(r.alias).forEach(function (k) { a[k] = r.alias[k]; }); }); return a; }
  function skips(vid) { var s = []; forVersion(vid).forEach(function (r) { if (r.skip) s = s.concat(r.skip); }); return s; }
  function forms(vid) { return forVersion(vid).filter(function (r) { return r.kind === 'form'; }).map(function (r) { return r.form; }); }

  var api = { REPAIRS: REPAIRS, MACHINE: MACHINE, MENDS: MENDS, forVersion: forVersion, startOf: startOf, applyText: applyText, aliases: aliases, skips: skips, forms: forms };
  root.SHRepairs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
