/* config.js - this bench's settings for bench-kit (research/kit). Loaded after kit/base.js, before the rest of the kit and the bench's own scripts. */
(function (root) {
  'use strict';
  root.SW.BENCH = {
    name: 'SHRDLU',
    title: 'SHRDLU Research Bench',
    slug: 'shrdlu',
    store: 'shbench.',
    // the About box (kit/about.js); purpose, inside and sources are HTML
    about: {
      icon: '<svg viewBox="0 0 32 32" aria-hidden="true" width="40" height="40"><g fill="none" stroke="#3aa862" stroke-width="1.6" stroke-linejoin="round"><path d="M16 4 L27 10 L16 16 L5 10 Z"/><path d="M27 10 L27 21 M16 16 L16 27 M5 10 L5 21"/><path d="M5 21 L16 27 L27 21"/></g></svg>',
      author: 'David M. Berry', citeAuthor: 'Berry, D. M.',
      purpose: 'A bench for the critical reading of the SHRDLU source code, made for the Critical Code Studies SHRDLU project (David M. Berry and Mark C. Marino).',
      techMore: 'Built on the Spacewar! Research Bench.',
      inside: 'A MacLisp reader and indexer for the source files, and a MacLisp interpreter written for the bench (MacLisp 1.6 and the later MacLisp of the 2024 restoration) that runs SHRDLU in the browser from each version’s own source, with every repair recorded.',
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
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
