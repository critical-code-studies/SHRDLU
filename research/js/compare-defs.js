/*
 * compare-defs.js - this bench's second mode in Compare (bench-kit's kit/compare.js): the
 * names each version defines, and whether each definition's code is the same.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  // Definitions: the names each version defines, and whether the definition's
  // code (comments and spacing aside) is the same.
  function defText(bb, s) {
    var d = s.defs[0];
    return bb.lines[d.file].slice(d.line - 1, d.end).map(function (x) { return SW.parseLine(x.raw).code; }).join(' ').replace(/[\f\u0003]/g, '').replace(/\s+/g, ' ').trim();
  }
  function symbolsDiff(el, A, B, h) {
    var K = root.LispIndex.KIND_LABEL, sa = A.sym || {}, sb = B.sym || {}, names = {};
    Object.keys(sa).concat(Object.keys(sb)).forEach(function (k) { names[k] = 1; });
    var srow = [], same = 0;
    Object.keys(names).sort().forEach(function (k) {
      var a = sa[k], x = sb[k];
      var st = !a ? 'added' : !x ? 'removed' : defText(A, a) !== defText(B, x) ? 'changed' : '';
      if (!st) { same++; return; }
      var s = a || x;
      srow.push([k, s.kinds.map(function (q) { return K[q] || q; }).join(', '), a ? A.parts[a.defs[0].file].src.split('/').pop() + ':' + a.defs[0].line : '', x ? B.parts[x.defs[0].file].src.split('/').pop() + ':' + x.defs[0].line : '', st]);
    });
    var pad = SW.el('div', { class: 'pad' });
    pad.innerHTML = '<h3>Definitions that differ</h3><p class="hint">' + Object.keys(names).length + ' names are defined in one or both; ' + same + ' have the same code in both (comments and spacing set aside). The rest are listed: added in the second, removed from it, or changed.</p>';
    pad.appendChild(SW.table(['Name', 'Kind', h.vl(A), h.vl(B), 'Change'], srow, { cls: ['mono', '', 'mono', 'mono', ''] }));
    el.appendChild(pad);
    return { crow: [], mrow: [], srow: srow };
  }

  SW.BENCH.compareDefs = {
    label: 'Definitions',
    render: function (el, A, B, h) { return symbolsDiff(el, A, B, h); },
    doc: function (A, B, r, h) {
      return { title: A.v.label + ' and ' + B.v.label + ': definitions that differ', blocks: [SW.tableBlock('Definitions that differ', ['Name', 'Kind', h.vl(A), h.vl(B), 'Change'], r.srow)] };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
