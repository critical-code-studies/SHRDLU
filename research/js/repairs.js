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
        what: 'The bench loads the files with LOAD-SHRDLU-INTERPRETED (loader.22) and then calls DUMP-SHRDLU, which runs INITIALSTUFF: the banner, the display question, SHRDLU’s break loop, then (SHRDLU). The bench answers Y to the display question when its DEC 340 is on (Run ▸ Display), N when it is off, and types GO to leave the break loop.',
        why: 'On ITS the program was loaded once and saved as a dump (:PDUMP SHRDLU;TS SHRDLU); each user then started the dump, which ran INITIALSTUFF. The bench loads and starts in one go. With Y, INITIALSTUFF reads the saved display, GRAPHF INIT, form by form; with N it runs NO340.',
        evidence: 'loader.22 (LOAD-SHRDLU-INTERPRETED); setup.65 (DUMP-SHRDLU, INITIALSTUFF); PDP-10/its build/shrdlu.tcl',
        start: { load: '(PROGN (LOAD (QUOTE LOADER)) (LOAD-SHRDLU-INTERPRETED))', run: '(DUMP-SHRDLU)', answers: ['N', 'GO '], displayAnswers: ['Y', 'GO '] } }
    ],
    mit: [
      { id: 'I-S1', kind: 'start', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'Loaded by its own loader, started with (SHRDLU)',
        what: 'The bench loads the files with LOADSHRDLU (loader.18), which reads each file form by form under an ERRSET, and then calls (SHRDLU).',
        why: 'This copy’s INITIALSTUFF, which would ask about the display, has that part commented out; the dump it made is not held.',
        evidence: 'loader.18 (LOADSHRDLU, LOADX); setup.62 (INITIALSTUFF, lines 239–266 commented out)',
        start: { load: '(PROGN (LOAD (QUOTE LOADER)) (LOADSHRDLU))', run: '(SHRDLU)', answers: [] } },
      { id: 'I-T1', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', file: 'dictio', n0: 178, n1: 178, title: 'BOTH calls MOVE-PTW where it called **',
        what: 'Line 178 of dictio.73, in the dictionary entry for BOTH, is read as Swenson’s restoration has it: (move-ptw N in place of (** N.',
        why: 'The entry calls a function ** that no surviving file defines, so any sentence with “both” halts (exchange 13 of the dialogue). The restoration calls MOVE-PTW, PROGRAMMAR’s function for moving the word pointer, whose arguments (N NW test NW) the call already has. (Finding F9.)',
        evidence: 'its/restored/dictio.76, line 178; progmr (MOVE-PTW)',
        from: { src: 'its/restored/dictio.76', n0: 178, n1: 178 } },
      { id: 'I-T2', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', file: 'graphf', n0: 13, n1: 13, title: 'A damaged number in the display code read as the restoration has it',
        what: 'Line 13 of graphf.3, in GP-PROJECT, is read as Swenson’s restoration has it: (QUOTE 0.43302) where the file holds QUOTE followed by eight damaged characters.',
        why: 'The file holds “(QUOTE” then the bytes 0xF4, ^L, ^W, “4g302)” (0xF4 stored as two bytes, C3 B4, as UTF-8), so MacLisp reads a symbol, not a number, and GP-PROJECT, which projects every corner of the scene onto the screen, fails at its first call. Some of the damaged characters are the expected ones shifted by a bit (“.” 0x2E as 0x17), and the digits 4 and 302 survive. The restoration reads 0.43302, the vertical factor of the projection beside the horizontal 0.75111.',
        evidence: 'its/as-found/graphf.3, line 13 (bytes); its/restored/graphf.6, line 11',
        from: { src: 'its/restored/graphf.6', n0: 11, n1: 11 } },
      { id: 'I-F1', kind: 'form', mend: 'mount', by: 'the project', date: '30 Sep 2026', title: 'No display: the arm’s drawing made to do nothing',
        what: 'With the bench’s 340 off: after loading, (NO340) is run and MOVETO, GRASP, UNGRASP and BLINK are defined to do nothing, as SHRDLU’s own start-up does when told there is no DEC 340.',
        why: 'The start-up that set the display up, or switched it off, is commented out in this copy, so the arm’s motion (MOVETO in graphf) meets an uninitialised display (GP-HANDIT unbound) and halts. This repair applies when the bench’s 340 is off (Run ▸ Display); with it on, I-F2 applies instead.',
        evidence: 'Swenson’s restoration does the same (setup.65, INITIALSTUFF, the NO340 branch); graphf.3 (NO340)',
        form: NO_DISPLAY, display: false },
      { id: 'I-F2', kind: 'form', mend: 'mount', by: 'the project', date: '30 Sep 2026', display: true, title: 'With the display: the scene drawn by GP-INITIAL',
        what: 'After loading, the display variables are cleared and GP-INITIAL is called, which draws the table, the blocks, the box and the hand from DISPLAY-AS (data.6); BLINK is defined to do nothing.',
        why: 'This is the second branch of the start-up this copy has commented out (setup.62, lines 254–266), run with the bench’s DEC 340 on. The first branch reads a saved display, GRAPHF INIT, which this copy does not hold. BLINK is defined only in twutil, which the loader does not read; the restoration defines it to do nothing (setup.65).',
        evidence: 'setup.62, lines 239–266 (commented out); graphf.3 (GP-INITIAL); data.6 (DISPLAY-AS); setup.65 (BLINK)',
        form: "(PROGN (SETQ PH-TURN-ON NIL GP-LINES NIL GP-SURFACE NIL GP-HANDIT NIL GP-NEWOBLOCAT NIL PH-BLOCKS NIL) (GP-INITIAL) (PUTPROP 'BLINK '(LAMBDA (A) NIL) 'EXPR))" }
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
      { id: 'S-L2', kind: 'load', mend: 'mount', by: 'the project', date: '30 Sep 2026', display: false, title: 'The display code is absent, and skipped',
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
        why: 'The display code is not in this copy (S-L2).', evidence: 'as I-F1', form: NO_DISPLAY, display: false },
      { id: 'S-L3', kind: 'load', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', display: true, title: 'The display code supplied from the MIT copy',
        what: 'With the bench’s 340 on, the loader’s GRAPHF is read from the MIT copy’s graphf.3, with its damaged number read as the restoration has it (S-T5), and the scene drawn by GP-INITIAL (S-F2).',
        why: 'This copy holds no display code. On ITS it was a compiled file, GRAPHF FASL on SHRDL1; (the loader’s FASLOAD; the 1987 listing in file-note has GRAPHF FASL on SHRDLU;), which is not held. The nearest text held is the MIT copy’s source, graphf.3; the two copies agree in the files they share, apart from the differences recorded as F1 and F8.',
        evidence: 'loader (FASLOAD GRAPHF FASL DSK SHRDL1); file-note (the 1987 listing); its/as-found/graphf.3',
        supply: { GRAPHF: 'its/as-found/graphf.3' } },
      { id: 'S-T5', kind: 'text', mend: 'yobitsugi', by: 'the project', date: '30 Sep 2026', display: true, file: 'graphf', n0: 13, n1: 13, title: 'A damaged number in the supplied display code read as the restoration has it',
        what: 'Line 13 of the supplied graphf.3 is read as the restoration has it: (QUOTE 0.43302).', why: 'As I-T2.', evidence: 'as I-T2', from: { src: 'its/restored/graphf.6', n0: 11, n1: 11 } },
      { id: 'S-F2', kind: 'form', mend: 'mount', by: 'the project', date: '30 Sep 2026', display: true, title: 'With the display: the scene drawn by GP-INITIAL',
        what: 'As I-F2: the display variables cleared, GP-INITIAL called, BLINK defined to do nothing.', why: 'As I-F2: this copy’s setup has the display start-up commented out, as the MIT copy’s does.', evidence: 'setup (INITIALSTUFF, commented out); as I-F2',
        form: "(PROGN (SETQ PH-TURN-ON NIL GP-LINES NIL GP-SURFACE NIL GP-HANDIT NIL GP-NEWOBLOCAT NIL PH-BLOCKS NIL) (GP-INITIAL) (PUTPROP 'BLINK '(LAMBDA (A) NIL) 'EXPR))" }
    ]
  };

  // The machine's stand-ins for ITS and MacLisp: not repairs to SHRDLU.
  var MACHINE = [
    ['MacLisp', 'An interpreter written for the bench (js/maclisp.js), in two dialects: MacLisp 1.6 for the 1970s files, the later MacLisp for Swenson’s restoration. Variables are special, numbers are read in octal, as MacLisp read them.'],
    ['Libraries', 'SLAVE (the 340 display), FORMAT, UMLMAC, TRACE and GRINDEF are supplied by the interpreter; their FASL files are not loaded.'],
    ['Files', 'The version’s files, held under source/, stand for its ITS directory (DSK: SHRDLU;); a file is found by its first name, the highest version (">") being the one held.'],
    ['Teletype', 'Characters typed in the terminal; the Return key sends a carriage return and a line feed. The ITS teletype had a key for each: SHRDLU ends a word at a carriage return (CARRET, morpho) and, after a word it does not know, asks for a line feed. The held files have Unix line ends, so CARRET, written as / and a line end, is read here as the line feed; on ITS it was the carriage return. Either way a Return ends the word.'],
    ['Clock', 'RUNTIME counts the interpreter’s steps, so that a run can be repeated exactly; RANDOM is a seeded generator for the same reason.'],
    ['Display', 'The DEC 340 (js/display.js): the DIS* calls of MacLisp’s display slave (SLAVE, src/l/slave.11), drawn on a 1024-point square screen. The slave’s own program, on the PDP-6, is not held; what each call does is read from its callers (graphf, graphf.init, the Logo TURTLE): -1 draws and 1 moves, lines are kept relative to an item’s origin, DISINI 1 reads coordinates as absolute, items are numbered from 1. SLEEP pauses the run so that the arm is seen to move. Off (Run ▸ Display), the program is told there is no 340.']
  ];

  var MENDS = {
    hibi: { label: 'Corrected', note: 'a reading corrected against another copy of the same file (hibi: a crack filled with gold)' },
    yobitsugi: { label: 'Supplied', note: 'a passage supplied from another copy or version (yobitsugi: a piece from another vessel)' },
    kake: { label: 'Remade', note: 'code written where none survives (kake: a lost piece remade)' },
    mount: { label: 'For running', note: 'a change to how the program is loaded or started, not to its text (a mount, not a mend)' }
  };

  function forVersion(vid) { return REPAIRS[vid] || []; }
  function startOf(vid, display) {
    var s = forVersion(vid).filter(function (r) { return r.kind === 'start'; })[0]; if (!s) return null;
    var st = s.start;
    return display && st.displayAnswers ? { load: st.load, run: st.run, answers: st.displayAnswers } : st;
  }
  // a repair marked display: true or false applies only with the bench's 340 on, or off
  function applies(r, display) { return r.display === undefined || r.display === !!display; }

  // Apply the text repairs to a version's files (a map NAME -> text) using the
  // other copies' texts (fetch(src) -> text). Returns the lines replaced, for marking.
  function applyText(vid, files, fetchSync, display) {
    var marks = [];
    // files supplied from another copy first, so that the text repairs reach them
    supplies(vid, display).forEach(function (s) { files[s.name] = fetchSync(s.src); });
    // from the bottom of each file up, so that each repair's line numbers are the held file's own
    forVersion(vid).filter(function (r) { return r.kind === 'text' && applies(r, display); }).sort(function (a, b) { return a.file === b.file ? b.n0 - a.n0 : 0; }).forEach(function (r) {
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
  // files supplied from another copy: [{ name (ITS first name), src }]
  function supplies(vid, display) { var s = []; forVersion(vid).forEach(function (r) { if (r.supply && applies(r, display)) Object.keys(r.supply).forEach(function (k) { s.push({ name: k, src: r.supply[k] }); }); }); return s; }
  // every other copy's file a version's repairs read from
  function sources(vid) { var s = []; forVersion(vid).forEach(function (r) { if (r.from) s.push(r.from.src); if (r.supply) Object.keys(r.supply).forEach(function (k) { s.push(r.supply[k]); }); }); return s; }
  function aliases(vid) { var a = {}; forVersion(vid).forEach(function (r) { if (r.alias) Object.keys(r.alias).forEach(function (k) { a[k] = r.alias[k]; }); }); return a; }
  function skips(vid, display) { var s = []; forVersion(vid).forEach(function (r) { if (r.skip && applies(r, display)) s = s.concat(r.skip); }); return s; }
  function forms(vid, display) { return forVersion(vid).filter(function (r) { return r.kind === 'form' && applies(r, display); }).map(function (r) { return r.form; }); }

  var api = { REPAIRS: REPAIRS, MACHINE: MACHINE, MENDS: MENDS, applies: applies, supplies: supplies, sources: sources, forVersion: forVersion, startOf: startOf, applyText: applyText, aliases: aliases, skips: skips, forms: forms };
  root.SHRepairs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
