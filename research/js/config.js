/* config.js - this bench's settings for bench-kit (research/kit). Loaded after core.js, before the kit. */
(function (root) {
  'use strict';
  root.SW.BENCH = {
    name: 'SHRDLU',
    title: 'SHRDLU Research Bench',
    relation: 'SHRDLU, ',
    topShare: false,
    paratexts: { org: 'critical-code-studies', repo: 'shrdlu_paratexts', cache: 'shrdlu-paratexts' },
    examples: { date: 'e.g. 1971-01-15, or 1971', archive: 'e.g. MIT Museum', versions: 'e.g. mit, stanford',
                refs: 'e.g. [REF: SHI, plnr.182:120]', publisher: 'e.g. MIT Press', finding: 'F2' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
