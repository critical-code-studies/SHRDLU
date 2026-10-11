/*
 * about.js - this bench's rows on Versions ▸ This version (bench-kit's kit/version.js): the files
 * of the version, how the bench reads them (MacLisp, from its index), how it runs them, where the
 * text held was made, and the version's reconstruction card.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.BENCH.version = {
    rows: function (b) {
      var v = b.v, a = b.asm, K = root.LispIndex.KIND_LABEL, kinds = {};
      if (a) a.symbols.forEach(function (x) { x.kinds.forEach(function (k) { kinds[k] = (kinds[k] || 0) + 1; }); });
      return [
        ['Files', b.parts.map(function (p, i) {
          return '<a href="' + SW.esc(SW.sourceURL(p.src)) + '" target="_blank" rel="noopener">' + SW.esc(p.src.split('/').pop()) + '</a>' +
            (p.role !== 'program' ? ' <span class="faint">(' + SW.esc(p.role === 'doc' ? 'documentation' : 'support') + ')</span>' : '') +
            ' <span class="faint">' + b.lines[i].length + ' lines</span>';
        }).join('<br>') || 'none'],
        ['Read as', a ? 'MacLisp 1.6 source: ' + a.forms.length + ' top-level forms; ' + Object.keys(kinds).map(function (k) { return kinds[k] + ' ' + (K[k] || k) + (kinds[k] === 1 ? '' : 's'); }).join(', ') + (a.errors.length ? '; ' + a.errors.length + ' places where the parentheses do not balance' : '') : 'none'],
        ['Runs', v.build ? 'in the browser, on the bench’s MacLisp, loaded by its own loader, with the repairs in its reconstruction card (below); open Run to type to it' : 'no: no copy is held'],
        ['This text', SW.esc(SW.MADE[v.id] || (v.medium || ''))]
      ];
    },
    after: function (v) { return SW.cardHTML(v, { about: true }); }
  };
})(this);
