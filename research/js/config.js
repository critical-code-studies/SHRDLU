/* config.js - this bench's settings for bench-kit (research/kit). Loaded after kit/base.js, before the rest of the kit and the bench's own scripts. */
(function (root) {
  'use strict';
  root.SW.BENCH = {
    name: 'SHRDLU',
    title: 'SHRDLU Research Bench',
    slug: 'shrdlu',
    store: 'shbench.',
    forks: [['mit', 'MIT (ITS)'], ['cmu', 'Carnegie-Mellon'], ['restored', 'Restored']],   // the version picker's groups (kit/shell.js)
    start: 'mit',   // the version shown first
    // references to the sources (kit/refs.js; the short names are SW.REF, in js/core.js)
    refs: { repo: 'https://github.com/critical-code-studies/SHRDLU', dir: 'source', prefix: 'SH-' },
    // Read ▾: the versions, then the open version's code by part (kit/menus.js)
    readFiles: {
      groups: [{ label: 'SHRDLU', note: 'its own code: top level, reading, grammar, dictionary, semantics, answering, the blocks world', rest: true },
               { label: 'PROGRAMMAR', test: /^(progmr|proggo|ginter)$/ },
               { label: 'Micro-Planner', test: /^(plnr|thtrac)$/ }],
      about: function (src, role) { return root.SW.fileLangOf ? root.SW.fileLangOf(src, role) : role; }
    },
    entry: 'SHRDLU',   // where the program starts: the top level's function, in syscom (Program ▸ Functional overview)
    // the About box (kit/about.js); purpose, inside and sources are HTML
    about: {
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true" width="40" height="40"><g fill="none" stroke="#3aa862" stroke-width="1.6" stroke-linejoin="round"><path d="M16 4 L27 10 L16 16 L5 10 Z"/><path d="M27 10 L27 21 M16 16 L16 27 M5 10 L5 21"/><path d="M5 21 L16 27 L27 21"/></g></svg>',
      author: 'David M. Berry', citeAuthor: 'Berry, D. M.',
      purpose: 'A bench for the critical reading of the SHRDLU source code, made for the Critical Code Studies SHRDLU project (David M. Berry and Mark C. Marino).',
      techMore: 'Built on the Spacewar! Research Bench.',
      inside: 'A MacLisp reader that indexes the sources, and an interpreter that runs SHRDLU in the browser from each version’s own files, with every repair recorded.',
      sources: 'Code by Terry Winograd, revised by Dave McDonald, Jeff Hill, Stu Card and Andee Rubin (MIT AI Laboratory, 1968–77); the MIT files as recovered on ITS and Eric Swenson’s 2024 restoration (PDP-10/its); Winograd’s Stanford distribution. Details under Versions.',
      code: 'https://github.com/critical-code-studies/SHRDLU',
      catalogue: { held: 'held as source' }
    },
    // the default colour theme's name, and the accent of figures exported on black and on white
    theme: { label: 'Blocks world', note: 'warm white on the charcoal of the lab bench, green for the machine, as on the project site (the default)' },
    accent: { dark: '#e58be0', light: '#a3317a' },
    // the people whose initials or names are written into the text (Analyse ▸ Hands and dates, Compare)
    hands: [
      { k: 'tw', who: 'Terry Winograd', re: /\bwinograd\b|\bt\.\s?w\.|\btw\b/i, colour: '#2a9d6f' },
      { k: 'ddm', who: 'Dave McDonald', re: /\bddm\b|\bmcdonald\b/i, colour: '#d99a1e' },
      { k: 'hill', who: 'Jeff Hill', re: /\bjeff hill\b/i, colour: '#3f8fd0' },
      { k: 'jmh', who: '“JMH” (not yet identified)', re: /\bjmh\b/i, colour: '#c05a93' },
      { k: 'ejs', who: 'Eric Swenson (2024)', re: /\bejs\b|\bswenson\b/i, colour: '#8a7ae0' }
    ],
    group: '1Kb3vwEV',
    relation: 'SHRDLU, ',
    topShare: false,
    settings: {
      tour: 'A few stops through reading, comparing and annotating; about two minutes.',
      groupHint: 'Annotations are shared through the project’s private Hypothesis group, <b>1Kb3vwEV</b> (set for you). Paste another group’s link or ID only to use a different one, and a personal API token (hypothes.is/account/developer). Without them, annotations are kept as drafts in this browser and can be exported or published later.',
      groupPlaceholder: 'https://hypothes.is/groups/1Kb3vwEV/shrdlu',
      themeHint: 'The colours of the whole bench: listings, annotations and figures. The ◐ button in the top bar switches between your last light and dark themes. The display in Run keeps the DEC 340’s own phosphor.'
    },
    tag: 'sh:',   // the prefix of this bench's tags in Hypothesis before bench-kit 0.5.0 (sh:v:mit …): still read; new tags are bk:
    tagsHint: 'e.g. grammar, planner, provenance',   // examples of tags, in the annotate dialog
    joinCard: '<figure class="js-card"><img src="img/join-card.png" width="600" height="315" alt="The invitation card: SHRDLU, an invitation to the Research Bench, RSVP"><figcaption class="hint">The invitation others see when you send them the link (Share, above); it opens the bench with this guide showing.</figcaption></figure>',
    // the worked examples in Help ▸ Advanced annotation
    annoHelp: {
      manual: 'https://dspace.mit.edu/handle/1721.1/5833', manualName: 'Micro-Planner manual',
      start: 'TC-CLEARTOP builds its goal stack here', search: 'goal',
      refA: 'CD, SHI, blockp.3:111–128', refB: 'EF, SHE, blockp.7:118–135',
      noteA: 'A note on the goal stack…', noteB: 'The same stack in the restoration…', quoteA: 'A note on the goal stack…',
      boxA: 'MIT, blockp.3, lines 111–128', boxB: 'Restoration, blockp.7, lines 118–135',
      tryText: 'The goal is set by `THGOAL` with `THUSE`', code: '`THGOAL`',
      caption: 'A link from an annotation on the restoration to one on the MIT files. The MIT annotation lists it under Linked from'
    },
    lang: 'maclisp',   // the language of the texts, for Compare and Genealogy (kit/lang-maclisp.js)
    compare: { comment: ';', normalised: false, reading: 'Reading',
               supplied: ['support files', 'Include the support files (the loader, macros, the demonstration script), not only the program files the loader reads'] },
    comparePrefix: 'SHRDLU: ',
    genealogy: { set: ['mit', 'stanford', 'ejs'], line: 'restored', lineNames: { restored: 'To the restoration', stanford: 'Winograd’s copy' } },
    figureNum: { print: '#a3317a', paper: '#a3317a', phosphor: '#e58be0' },
    paratexts: { org: 'critical-code-studies', repo: 'shrdlu_paratexts', cache: 'shrdlu-paratexts' },
    examples: { date: 'e.g. 1971-01-15, or 1971', archive: 'e.g. MIT Museum', versions: 'e.g. mit, stanford',
                refs: 'e.g. [REF: SHI, plnr.182:120]', publisher: 'e.g. MIT Press', finding: 'F2' },
    // the first version is lost, and the tree grows from it
    stemma: { root: 'jan71', lostBetween: {}, skip: [], lostOnTrunk: true },
    edition: {
      built: function (b) {
        return ['Read as', 'MacLisp 1.6 source' + (b.asm ? '; ' + b.asm.forms.length.toLocaleString('en-GB') + ' top-level forms, ' + b.asm.symbols.length.toLocaleString('en-GB') + ' names defined' : '')];
      },
      // MacLisp is laid out by its own indentation: tabs set at eight
      layout: function (raw) { return String(raw).replace(/\t/g, '        ').replace(/[\f\u0003]/g, ''); },
      words: false,
      files: ['all files', 'Include the support and documentation files, not only the program files']
    },
    // Help ▸ What you should read (kit/helppages.js): entries as the project site's bibliography has
    // them, checked against the Zotero library
    // sitemap.html (Help ▸ Site map), written by kit/tools/sitemap.js
    sitemap: { site: ['../index.html', 'The SHRDLU site'], opens: 'the MIT files as found on ITS',
               sitePages: [['../overview.html', 'overview'], ['../dialogue.html', 'the dialogue'], ['../code.html', 'the code'], ['../people.html', 'people'], ['../timeline.html', 'timeline'], ['../bibliography.html', 'bibliography']],
               files: 'Files in the order the program’s loader read them.', links: { storage: 'storage.html', site: '../index.html' } },
    reading: {
      intro: 'The reading behind the bench. The full list, with histories and media theory, is the project site’s <a href="../bibliography.html" target="_blank" rel="noopener">bibliography</a>.',
      menu: 'Winograd, Micro-Planner, and reading and repairing old code',
      groups: [
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
      ]
    },
    // Help ▸ Referencing and versions (kit/helppages.js)
    refHelp: {
      example: '[REF: SHI, smspec.94:712–714]',
      about: '<p><b>SH</b>, then a letter for the witness, the particular surviving set of files (<b>I</b>); then the file as that witness names it (<b>smspec.94</b>) and the lines (<b>712–714</b>). The ITS copies carry ITS version numbers in their names; Winograd’s Stanford copy does not.</p>',
      letters: [['I', 'the MIT files as found on ITS backup tapes (PDP-10/its, imported unedited, July 2024)'], ['S', 'Winograd’s code directory, distributed from Stanford (files dated 1997)'], ['E', 'Eric Swenson’s restoration (PDP-10/its, July to August 2024)']],
      more: '<p>Shorter forms: the witness alone, <span class="mono">[REF: SHI]</span>; a whole file, <span class="mono">[REF: SHI, plnr.182]</span>. Lost versions are named without a letter: <span class="mono">SH-JAN71</span>, <span class="mono">SH-C1</span>.</p>',
      form: 'Form: [REF: SH<witness>, <file>:<lines>], e.g. [REF: SHI, smspec.94:712–714].',
      versions: { title: 'The versions', all: true },
      ports: { title: 'Re-creations', head: ['Reference', 'What', 'In', 'Where and by whom', 'Date'] }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
