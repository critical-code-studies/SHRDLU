/*
 * run.js - the Run view. For now: the 1970 demonstration dialogue as the test
 * every run of SHRDLU will be held to, exchange by exchange, with a column for
 * each witness. The MacLisp interpreter that will run each witness from its
 * own source, in the browser, is being built; until it is in, the columns say
 * so, and nothing is claimed about what any version answers.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var view = SW.$('#view-run');
  var dialogue = null;

  // the canonical transcript (docs/shrdlu-dialogue-canonical.md), exchange by exchange
  function loadDialogue() {
    if (dialogue) return dialogue;
    dialogue = fetch('../docs/shrdlu-dialogue-canonical.md', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Could not fetch the dialogue (' + r.status + ')');
      return r.text();
    }).then(function (t) {
      var ex = [], cur = null, last = null;
      t.split('\n').forEach(function (line) {
        var m = /^(\d+)\.\s+Person:\s*(.*)$/.exec(line);
        if (m) { cur = { n: +m[1], turns: [{ who: 'person', text: m[2] }] }; ex.push(cur); last = cur.turns[0]; return; }
        if (!cur) return;
        var s = line.trim();
        if (!s || /^<\//.test(s)) return;
        var p = /^Person:\s*(.*)$/.exec(s), c = /^Computer:\s*(.*)$/.exec(s);
        if (p) { last = { who: 'person', text: p[1] }; cur.turns.push(last); }
        else if (c) { last = { who: 'shrdlu', text: c[1] }; cur.turns.push(last); }
        else if (last) last.text += '\n' + s;
      });
      return ex;
    });
    return dialogue;
  }

  function show(b) {
    var runs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, x) { return a.sort - x.sort; });
    view.innerHTML = '<div class="pad run-pad" style="max-width:none">' +
      '<div class="run-intro prose">' +
      '<h2 style="margin-top:0">Run <span class="badge">being built</span></h2>' +
      '<p>SHRDLU will run here in the browser, from the source of each version, on a MacLisp interpreter written for the bench: the sentence typed in, the parse, the Micro-Planner goals, the arm moving in the blocks world, the answer. Beside it, a reference machine: Eric Swenson’s restoration run on an emulated PDP-10 under ITS, the answers recorded for comparison.</p>' +
      '<p class="hint">Until then, this page holds the test every run will be held to: the forty-two exchanges of the 1970 demonstration dialogue, as Winograd published it, with a column for each version the bench holds. Swenson noted in July 2024 that the restored program “fails at some things that the DEMO apparently succeeded in doing”; the columns will say, exchange by exchange, which.</p>' +
      '</div>' +
      '<figure class="run-still"><img src="../assets/images/SHRDLU-demonstration-Object%20ID-2007.020.027.jpg" alt="A still of the SHRDLU demonstration on the DEC 340 display: wireframe blocks, a pyramid and an open box, the gripper above a stack, and the teletype exchange."><figcaption class="hint">The blocks world as it appeared on the DEC Type 340 display (Object ID 2007.020.027).</figcaption></figure>' +
      '<div class="run-table-host"><p class="hint">Reading the dialogue…</p></div></div>';
    loadDialogue().then(function (ex) {
      var host = SW.$('.run-table-host', view);
      var head = '<tr><th class="num">No.</th><th>Person</th><th>SHRDLU, 1970</th>' + runs.map(function (v) { return '<th title="' + SW.esc(v.label) + '">' + SW.esc(SW.refOf(v.id)) + '</th>'; }).join('') + '</tr>';
      var rows = ex.map(function (e) {
        var person = e.turns.filter(function (t) { return t.who === 'person'; }).map(function (t) { return t.text.toLowerCase(); }).join('\n');
        var reply = e.turns.filter(function (t) { return t.who === 'shrdlu'; }).map(function (t) { return t.text; }).join('\n');
        return '<tr><td class="num"><a href="../dialogue.html#x' + e.n + '" target="_blank" rel="noopener" title="This exchange on the dialogue page">' + e.n + '</a></td>' +
          '<td class="run-person">' + SW.esc(person).replace(/\n/g, '<br>') + '</td><td class="run-shrdlu">' + SW.esc(reply).replace(/\n/g, '<br>') + '</td>' +
          runs.map(function () { return '<td class="faint" title="Not yet run">·</td>'; }).join('') + '</tr>';
      }).join('');
      host.innerHTML = '<h3>The demonstration dialogue, as the test</h3><table class="data run-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>' +
        '<p class="hint">Source: the canonical transcript (docs/shrdlu-dialogue-canonical.md), verbatim from Winograd’s SHRDLU page, typos kept. · marks an exchange not yet run.</p>';
    }).catch(function (e) { SW.$('.run-table-host', view).innerHTML = '<p class="badge err">' + SW.esc(e.message) + '</p>'; });
  }

  SW.views.run = { show: show, hide: function () {} };
})(this);
