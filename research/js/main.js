/*
 * main.js - this bench's parts of the frame (bench-kit's kit/shell.js, loaded after it is set):
 * its views in the order of the tabs, the language shown beside the picker, the links that open a
 * lens or a graphic, and its own Help items. The picker's groups and the version shown first are
 * in js/config.js (forks, start).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.BENCH.shell = {
    views: ['read', 'run', 'analyse', 'compare', 'genealogy', 'about', 'graphics', 'findings', 'notes', 'paratexts'],
    lang: function (v) { return { text: SW.langOf(v), title: 'The language this version is written in' }; },
    // a view named in the link (the site map links to each): its lens or graphic
    query: function (q) {
      if (q.lens) { SW.setLens(q.lens); if (!q.tab) q.tab = 'analyse'; }
      if (q.g) { SW.setGraphic(q.g); if (!q.tab) q.tab = 'graphics'; }
    },
    help: { site: function () { window.open('../', '_blank', 'noopener'); } }
  };
})(this);
