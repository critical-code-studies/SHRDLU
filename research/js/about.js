/*
 * about.js - a version's metadata, provenance, build log and shared notes.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var view = SW.$('#view-about');
  var build = null;

  function timeline(cur) {
    return '<div class="timeline">' + V.VERSIONS.slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (v) {
      return '<div class="v' + (v.id === cur ? ' on' : '') + (v.status === 'lost' ? ' lost' : '') + '" data-v="' + SW.esc(v.id) + '" title="' + SW.esc(v.label + ' · ' + v.date + '\n' + v.summary) + '">' +
        '<b>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</b><span>' + SW.esc(v.date) + '</span><span class="faint">' + SW.esc(v.fork) + ' · ' + SW.esc(v.status) + '</span></div>';
    }).join('') + '</div>';
  }

  // Where the version sits in the lines of descent (versions.js).
  function descent(v) {
    var name = function (id) { var x = V.byId(id); return x ? SW.esc(x.label.replace(/^Spacewar! /, '')) : SW.esc(id); };
    if (v.witnessOf) return 'another reading of ' + name(v.witnessOf) + ', not a version of its own';
    if (!v.parent) return v.id === '1' ? 'none: the first version' : 'not placed in a line of descent';
    return name(v.parent) +
      (v.also.length ? '; also draws on ' + v.also.map(name).join(', ') : '') +
      (v.influence.length ? '; with ' + v.influence.map(name).join(', ') + ' as influence, not parent' : '') +
      ' <span class="faint">(line: ' + SW.esc(V.ancestry(v.id).map(function (id) { return V.byId(id).label.replace(/^Spacewar! /, ''); }).join(' → ')) + ')</span>';
  }

  function render(b) {
    var v = b.v, a = b.asm;
    var pad = SW.el('div', { class: 'pad' });
    var K = root.LispIndex.KIND_LABEL, kinds = {};
    if (a) a.symbols.forEach(function (x) { x.kinds.forEach(function (k) { kinds[k] = (kinds[k] || 0) + 1; }); });
    var dl = [
      ['Date', v.date], ['Authors', v.authors], ['Descends from', descent(v)], ['Status', v.status], ['Survives as', v.medium || 'none'],
      ['Files', b.parts.map(function (p, i) {
        return '<a href="' + SW.esc(SW.sourceURL(p.src)) + '" target="_blank" rel="noopener">' + SW.esc(p.src.split('/').pop()) + '</a>' +
          (p.role !== 'program' ? ' <span class="faint">(' + SW.esc(p.role === 'doc' ? 'documentation' : 'support') + ')</span>' : '') +
          ' <span class="faint">' + b.lines[i].length + ' lines</span>';
      }).join('<br>') || 'none'],
      ['Read as', a ? 'MacLisp 1.6 source: ' + a.forms.length + ' top-level forms; ' + Object.keys(kinds).map(function (k) { return kinds[k] + ' ' + (K[k] || k) + (kinds[k] === 1 ? '' : 's'); }).join(', ') + (a.errors.length ? '; ' + a.errors.length + ' places where the parentheses do not balance' : '') : 'none'],
      ['Runs', v.build ? 'in the browser, on the bench’s MacLisp, loaded by its own loader, with the repairs in its reconstruction card (below); open Run to type to it' : 'no: no copy is held'],
      ['This text', SW.esc(SW.MADE[v.id] || (v.medium || ''))],
      ['SWHID', v.build ? SW.swhidList(SW.filesOf(v)) + '<span class="hint">Software Heritage identifiers of the files, from their bytes; click to copy.</span>' : 'none'],
      ['Cite this version', SW.esc(v.label + ' (' + v.date + '). ' + (v.authors || '') + '. SHRDLU research bench, ' + SW.versionURI(v.id) + (v.build ? ' ' + SW.refText(v.id) : ''))]
    ];
    pad.innerHTML = '<h2 style="margin-top:0">' + SW.esc(v.label) + (v.build ? ' ' + SW.refTag(v.id) : '') + '</h2><p class="prose">' + SW.esc(v.summary) + '</p>' +
      '<dl class="meta">' + dl.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + (/</.test(r[1]) ? r[1] : r[1]) + '</dd>'; }).join('') + '</dl>' +
      SW.reconstructionCard(v) +
      '<h3>The variorum</h3>' + timeline(v.id) +
      '<h3 style="margin-top:22px">Annotations on this version</h3>' +
      '<p class="hint">A shared space for provenance, corrections and general discussion of the version as a whole. Annotations on lines are made in the Read view.</p>' +
      '<div class="toolbar" style="position:static;padding-left:0" id="ab-tools"></div><div id="ab-notes" class="hint">Loading annotations…</div>';
    view.innerHTML = '';
    view.appendChild(pad);
    SW.$('.timeline', pad).addEventListener('click', function (e) {
      var t = e.target.closest('.v');
      if (t && !t.classList.contains('lost')) SW.select(t.dataset.v);
      else if (t) SW.select(t.dataset.v);
    });
    var tools = SW.$('#ab-tools', pad);
    tools.appendChild(SW.el('button', { class: 'btn', onclick: function () {
      N.dialog({ vid: v.id, kind: 'version', anchor: null, heading: 'Annotate ' + v.label, anchorText: 'An annotation on the version as a whole (provenance, correction, discussion).' });
    } }, '✎ Annotate the version'));
    tools.appendChild(SW.el('button', { class: 'btn', onclick: function () { N.publishDrafts(); } }, '⇪ Publish drafts to the group'));
    tools.appendChild(SW.el('span', { class: 'sep' }));
    tools.appendChild(SW.exportButtons(function () { return doc(b); }, 'shrdlu-' + v.id + '-annotations'));
    var binBox = SW.el('div', { style: 'margin-top:26px' });
    binBox.innerHTML = '<h3>Deleted annotations</h3><p class="hint">Annotations you delete go to the bin. It shows this version’s by default; tick “all versions” for the rest. Restore them one at a time, or delete them for good.</p>';
    var bb = SW.el('button', { class: 'btn' }, '🗑 Show the bin');
    binBox.appendChild(bb);
    pad.appendChild(binBox);
    bb.onclick = function () { bb.remove(); N.showBin(binBox.appendChild(SW.el('div')), { vid: v.id }); };
    var logBox = SW.el('div', { style: 'margin-top:26px' });
    logBox.innerHTML = '<h3>All annotations, every version</h3><p class="hint">The whole discussion in one place: the group’s annotations, your drafts and the build logs for every version, newest first. Search by word, initials or version.</p>';
    var lb = SW.el('button', { class: 'btn' }, 'Show the log');
    logBox.appendChild(lb);
    pad.appendChild(logBox);
    lb.onclick = function () { lb.remove(); allLog(logBox); };
    notes(b);
  }

  function allLog(box) {
    var wait = SW.el('p', { class: 'hint' }, 'Gathering annotations…');
    box.appendChild(wait);
    N.listAll().then(function (all) {
      wait.remove();
      var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
      var q = SW.el('input', { type: 'search', placeholder: 'Search annotations, initials, versions…' });
      tb.appendChild(q);
      var src = SW.el('select', { class: 'btn' }, '<option value="">all sources</option><option value="hypothesis">group annotations</option><option value="draft">my drafts</option><option value="buildlog">build logs</option>');
      tb.appendChild(src);
      var holder = SW.el('div');
      var rowsNow = [];
      function run() {
        var t = q.value.trim().toLowerCase(), sv = src.value;
        var list = all.filter(function (n) {
          if (sv && n.source !== sv) return false;
          if (!t) return true;
          return (n.text + ' ' + n.by + ' ' + n.vid + ' ' + (n.tags || []).join(' ')).toLowerCase().indexOf(t) >= 0;
        }).sort(function (a, b2) { return String(b2.date) < String(a.date) ? -1 : 1; });
        var noteOf = new Map();
        rowsNow = list.map(function (n) {
          var v = V.byId(n.vid);
          var row = [{ html: SW.esc(SW.fmtDate(n.date)), sort: String(n.date), text: SW.fmtDate(n.date) }, n.by, v ? v.label.replace(/^Spacewar! /, '') : n.vid,
                  n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : (n.source === 'buildlog' ? 'build log' : 'version'),
                  n.parent ? '↳ reply' : '', n.text];
          noteOf.set(row, n);
          return row;
        });
        holder.innerHTML = '<p class="hint">' + list.length + ' annotations</p>';
        holder.appendChild(SW.table(['Date', 'By', 'Version', 'Where', '', 'Annotation'], rowsNow, { cls: ['mono', 'mono', 'mono', 'mono', '', ''], onRow: function (r) {
          var n = noteOf.get(r);
          if (!n) return;
          if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
          if (n.vid !== SW.state.v) SW.select(n.vid);
          SW.setTab(n.anchor ? 'read' : 'about');
        } }));
      }
      tb.appendChild(SW.el('span', { class: 'sep' }));
      tb.appendChild(SW.exportButtons(function () {
        return { title: 'SHRDLU research annotations, all versions', subtitle: 'Annotations, drafts and build logs' + (q.value ? ' matching “' + q.value + '”' : ''),
                 blocks: [SW.tableBlock('Annotations', ['Date', 'By', 'Version', 'Where', '', 'Annotation'], rowsNow)] };
      }, 'shrdlu-annotations-log'));
      q.addEventListener('input', run);
      src.addEventListener('change', run);
      box.appendChild(tb);
      box.appendChild(holder);
      run();
    });
  }

  function notes(b) {
    N.list(b.v.id).then(function (all) {
      if (build !== b) return;
      var ts = N.threads(all);
      var el = SW.$('#ab-notes', view);
      var ver = ts.filter(function (t) { return !t.note.anchor; }), lines = ts.filter(function (t) { return t.note.anchor; });
      el.innerHTML = (ver.length ? ver.map(function (t) { return N.renderThread(t, b); }).join('') : '<p>No annotations on the version yet.</p>') +
        (lines.length ? '<h3>Annotations on lines (' + lines.length + ')</h3>' + lines.map(function (t) { return N.renderThread(t, b); }).join('') : '');
      el.classList.remove('hint');
      N.wire(el, b.v.id, all);
    });
  }

  function doc(b) {
    return N.list(b.v.id).then(function (all) {
      var ts = N.threads(all);
      return { title: b.v.label + ': annotations', subtitle: b.v.summary, meta: SW.docMeta(b),
               blocks: [{ type: 'h2', text: 'Annotations on the version, and the build log' }].concat(N.blocks(ts.filter(function (t) { return !t.note.anchor; }), b),
                 [{ type: 'h2', text: 'Annotations on lines' }], N.blocks(ts.filter(function (t) { return t.note.anchor; }), b)) };
    });
  }

  SW.views.about = { show: function (b) { build = b; render(b); } };
  SW.on('notes', function (vid) {
    if (build && build.v.id === vid && SW.state.tab === 'about') notes(build);
    var open = SW.$('.bin', view);
    if (open && SW.state.tab === 'about') N.showBin(open);
  });
})(this);
