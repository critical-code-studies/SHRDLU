/*
 * findings-checks.js - this bench's check in Findings (bench-kit's kit/findings.js), run
 * afresh each time the Bench side is shown: the Stanford and ITS copies collated.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, F = SW.findings, last = null;
  // The Stanford and ITS copies collated afresh: for each program file they
  // share, how many lines differ, and how many once spacing, page marks and
  // blank lines are set aside.
  function checkCollation(box) {
    box.innerHTML = '<p class="hint">Reading both copies…</p>';
    Promise.all([SW.build('stanford'), SW.build('mit')]).then(function (bs) {
      var S = bs[0], I = bs[1], rows = [];
      function norm(t) { return t.replace(/[\f\u0003\r]/g, '').replace(/\s+/g, ' ').trim(); }
      S.parts.forEach(function (sp, si) {
        var name = sp.src.split('/').pop();
        var ip = I.parts.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { var n = x.p.src.split('/').pop(); return n.replace(/\.\d+$/, '') === name || (name === 'demo' && n === 'demo.flick'); })[0];
        if (!ip) return;
        var a = S.lines[si].map(function (L) { return L.raw.replace(/[\f\u0003]/g, ''); }).filter(function (x) { return x.trim(); });
        var c = I.lines[ip.i].map(function (L) { return L.raw.replace(/[\f\u0003]/g, ''); }).filter(function (x) { return x.trim(); });
        var diff = 0, n = Math.max(a.length, c.length);
        for (var k = 0; k < n; k++) if (a[k] !== c[k]) diff++;
        var same = norm(a.join(' ')) === norm(c.join(' '));
        rows.push([name, ip.p.src.split('/').pop(), a.length, diff, same ? 'the same' : 'differs']);
      });
      last = rows;
      box.innerHTML = '';
      box.appendChild(SW.table(['Stanford', 'ITS', 'Lines', 'Lines differing, in place', 'Text, spacing aside'], rows, { cls: ['mono', 'mono', 'num', 'num', ''] }));
    }).catch(function (err) { box.innerHTML = '<p class="badge err">' + SW.esc(err.message) + '</p>'; });
  }

  F.addCheck({ title: 'The Stanford and ITS copies, collated now', run: checkCollation, doc: function () {
    if (!last) return [];
    return [{ type: 'h2', text: 'The Stanford and ITS copies' },
            SW.tableBlock('The two copies collated, file by file, ' + SW.fmtDate(SW.today()), ['Stanford', 'ITS', 'Lines', 'Lines differing, in place', 'Text, spacing aside'], last)];
  } });
})(typeof window !== 'undefined' ? window : globalThis);
