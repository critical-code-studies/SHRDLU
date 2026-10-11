/* config.js - this bench's settings for bench-kit (research/kit). Loaded after core.js, before the kit. */
(function (root) {
  'use strict';
  root.SW.BENCH = {
    name: 'SHRDLU',
    title: 'SHRDLU Research Bench',
    slug: 'shrdlu',
    store: 'shbench.',
    group: '1Kb3vwEV',
    relation: 'SHRDLU, ',
    topShare: false,
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
