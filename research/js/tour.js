/*
 * tour.js - this bench's guided tour: its stops, and the offer made on a first visit. The
 * tour itself is bench-kit's (kit/tours.js), which reads them from SW.BENCH. A stop: title,
 * text, and where to go: v (version), tab, find (a pattern for the line to select in Read),
 * lens, graphic, gen (genealogy view), tape ({path, mode}), b (Collate's other version),
 * focus (a selector to outline).
 */
(function (root) {
  'use strict';
  var B = root.SW.BENCH;
  B.tourOffer = 'A short tour shows how to read, compare and annotate the SHRDLU sources (seven stops, about two minutes).';
  B.tours = {
    welcome: { title: 'Welcome to the bench', stops: [
      { title: 'Welcome to the bench', v: 'mit', tab: 'read', focus: '#pick-a',
        text: 'The bench holds the surviving texts of SHRDLU: the MIT files as recovered from ITS, Winograd’s own Stanford distribution, and Eric Swenson’s 2024 restoration, with the versions known but lost. Choose a version here. Each is a directory of MacLisp files, read in the order the program’s own loader read them.' },
      { title: 'Reading a listing', v: 'mit', tab: 'read', find: /^\(DEFPROP TC-CLEARTOP/, focus: '.ln.sel',
        text: 'This is TC-CLEARTOP, the Micro-Planner theorem for clearing the top of a block, in the file blockp. Names defined in this version are coloured; click one for where it is defined and used. Key in the toolbar explains the marks, and File chooses among the files.' },
      { title: 'Annotating together', v: 'mit', tab: 'read', find: /^\(DEFPROP TC-CLEARTOP/, focus: '#rd-selbar',
        text: 'Select a line (shift-click for a range) and choose Annotate. Annotations are signed with your initials and dated, and shared with the group through Hypothesis. Set your initials and token in ⚙ Settings; until then, annotations are kept as drafts in this browser.' },
      { title: 'Text and Program', v: 'mit', lens: 3, focus: '#tabs [data-menu="text"]',
        text: 'The Text and Program menus open lenses on the code: comments, hands and dates, the lexicon of every defined name, the files, the calls between definitions, the Micro-Planner theorems, and the history of one name across the versions.' },
      { title: 'Collate two versions', v: 'mit', tab: 'compare', b: 'stanford', focus: '#tabs [data-menu="versions"]',
        text: 'Versions ▸ Collate sets two versions side by side, as text, as the definitions that differ, or as a map of their forms. Here the MIT files against Winograd’s Stanford copy: the same text, except where the Stanford smspec is damaged.' },
      { title: 'Run', v: 'mit', tab: 'run', focus: '#tabs [data-tab="run"]',
        text: 'Run runs SHRDLU in the browser, from each version’s own source, on a MacLisp interpreter written for the bench. Type to it at the teletype, or play the forty-two exchanges of the 1970 demonstration dialogue and see, exchange by exchange, where the surviving code agrees with the demonstration.' },
      { title: 'Findings and My notes', v: 'mit', tab: 'findings', focus: '#tabs [data-tab="notes"]',
        text: 'Findings gathers what the group and the bench have established, each with its evidence a click away. My notes is your own tray for writing: figures, excerpts and findings, exported to Word or Markdown. Help holds this tour, referencing, the site map and Settings.' }
    ] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
