/*
 * guides.js - Help guides for the parts of the bench that have grown their own ways of working:
 * Paratexts, and codes, links and sharing. Each opens in a box over whatever is showing (Help
 * menu, or a link: ?help=paratexts, ?help=codes). As on the Spacewar! bench.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  function ul(items) { return '<ul class="ah-steps">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
  function k(t) { return '<kbd>' + t + '</kbd>'; }

  var GUIDES = {
    paratexts: ['Paratexts', [
      ['What they are', '<p>The scans, clippings, photographs and documents around the program, kept for the crew in a private GitHub repository (critical-code-studies/shrdlu_paratexts): a catalogue of records, and the files. Every change made here is saved there as a commit, signed with your initials, so the history of each item is kept.</p>'],
      ['Getting access', ul([
        'Accept the invitation to the <b>critical-code-studies</b> organisation that GitHub emails you.',
        'Help ▸ Joining the annotation group, step 5: open the token form (its name, owner, expiry and permission are filled in), choose <b>Only select repositories</b> and <b>shrdlu_paratexts</b>, generate the token, paste it in, and <b>Save and test</b>. ⚙ Settings has the same box.',
        'The token stays in this browser. On another computer, paste it there too.'])],
      ['The left panel', ul([
        '<b>＋ Add a paratext</b>: choose or drop a file (up to 50 MB), give it a title and what else you know, and Upload. It goes into the collection you are in, unless you untick it.',
        '<b>All</b>, <b>Not in a collection</b>, your <b>collections</b>, and <b>Withdrawn</b>, each with its count.',
        'Collections nest like folders, and an item can be in several. ＋ beside Collections makes one; on a collection, ＋ makes one inside it, ✎ renames it and ✕ deletes it (its items stay in the catalogue; the collections inside it move up a level).',
        'Drag items onto a collection to put them in it. From inside a collection a drag moves them; hold ' + k('⌥') + ' to add them instead. Drag one collection onto another to nest it, or onto All to bring it to the top.'])],
      ['Views', ul([
        '▦ a grid of cards, small, medium or large (S M L), or ☰ a list with a column for each field; click a column’s heading to sort by it, again to reverse.',
        '<b>Sort</b>: date made, title, accessioned (newest first), rating, code, size, creator or kind.',
        'Find searches codes, titles, descriptions, tags, archives and collection names; Tag, Version and Kind narrow the list.',
        'Your view is remembered in this browser. ↻ reads the catalogue again.'])],
      ['Selecting several', ul([
        'Tick the box at a card’s corner, ' + k('⌘') + '-click to add or take one, ' + k('⇧') + '-click to take a run, or ' + k('Space') + ' on a focused card.',
        'The bar that appears: add them to a collection (or a new one), take them out of this one, tag them, ⤓ Export their records, copy their codes, and, under ⋯, withdraw them.',
        'With two selected, <b>Side by side</b> shows them in one box. Pictures zoom (wheel, pinch, ＋ −, double-click) and pan (drag); with <b>Together</b> on, both follow, matched by their place on the page, for comparing two printings or copies. Fit (' + k('0') + ') puts them back; ⇄ Swap turns them round.'])],
      ['One item', ul([
        'Click a card for its box: the file (a picture, a PDF, a text), its record, its collections, the crew’s ratings, reactions and comments.',
        'The record: title, date made, creator, source (where this copy came from), <b>Held at</b>, <b>Archive ref</b> and <b>Archive link</b> (the original, in its archive: an <b>In the archive ↗</b> button appears), rights, accession date (the day it came into the collection, set on upload), description, tags, versions and references. <b>Save changes</b> keeps them.',
        '<b>More metadata</b> folds out the rest of Dublin Core: type (from DCMI’s list), publisher, contributors, language, coverage, identifiers (DOI, ISBN, URL), and the file’s format.',
        'Rate it with one to three stars (gold up to the crew’s average), react with an emoji, and comment; comments fold away until you open them.',
        'At the top: <b>Share</b>, ＋ My notes, ⤓ Download, the file on GitHub with its history.',
        '<b>⤓ Export</b> saves its record: <b>CSL-JSON</b> or <b>RIS</b> to import into Zotero (File ▸ Import; creators as Family, Given, separated by semicolons; the archive and its reference go to Zotero’s Archive and Loc. in Archive), or <b>Dublin Core</b> (oai_dc XML). The read-only box has it too.',
        'Under ⋯: <b>Withdraw from the list</b>.'])],
      ['Withdrawing', '<p>Withdrawing takes an item out of the list for the whole crew. It asks for a reason, kept with the record, and for the item’s code typed in (for several, their number). The file stays in the repository, with its history. <b>Withdrawn</b>, in the left panel, lists them, with who withdrew each and why; select them there and <b>Bring back</b>.</p>'],
      ['Linking to one', ul([
        'In an annotation, note or finding, write its code, as <span class="mono">P-MJH2M</span>. It shows as a link, <b>Paratext:</b> and its title.',
        'Clicking the link opens the paratext read-only, over whatever you were doing, and closes back to it. At its foot, <b>Go to P-… in Paratexts →</b> opens its full box.',
        '<b>Share</b> sends a link that opens the bench at the paratext; whoever opens it needs access to see it.',
        'Its box lists where it is <b>Cited in</b>: the group’s annotations, replies and findings, the bench’s findings and your notes that write its code, each a link.'])],
      ['Speed and privacy', '<p>The catalogue and each file are kept in this browser’s cache after the first time, so the list appears at once and pictures load from here; the bench checks GitHub behind them and redraws if anything has changed. Taking your token out of ⚙ Settings clears the cache.</p>']
    ]],
    codes: ['Codes, links and sharing', [
      ['Every item has a code', '<p>Each thing the bench keeps has a code that does not change, shown on it (click to copy):</p>' + ul([
        '<span class="mono">A-XXXXX</span> an annotation, <span class="mono">R-XXXXX</span> a reply',
        '<span class="mono">C-XXXXX</span> a finding of the crew’s, <span class="mono">F2</span> one of the bench’s own',
        '<span class="mono">DMB-N14</span> a note in My notes (your initials and its number)',
        '<span class="mono">P-XXXXX</span> a paratext'])],
      ['Going to one', ul([
        '<b>#</b> in the top bar: type a code and Enter.',
        'In an annotation, note or finding, a code written in the text becomes a link (a paratext’s shows as <b>Paratext:</b> and its title, and opens read-only where you are).',
        'A web link can carry one: <span class="mono">…/research/?code=A-MLKH5</span>.'])],
      ['Sharing', ul([
        '<b>Share</b> on a paratext sends a link to it. Where the browser has a share sheet (Safari, phones), it opens it: Mail, Messages and the rest. Elsewhere the link is copied, to paste.',
        'Help ▸ Joining the annotation group, <b>Share an invitation</b>: a link that sets up the annotation group for whoever opens it. Send it only to the crew: anyone with it can join.'])],
      ['Findings and My notes', ul([
        'A note in My notes can be shared to Findings, where the crew can reply, rate it and react; it moves to the <b>Shared</b> box in My notes. Recalling it brings it back, with its replies.',
        'A finding’s status comes from reactions: 🔓 marks it open, 💡 asks for help, ✅ resolves it. Findings filters by status and by category.',
        '<b>✉</b> lists what is new in the group’s annotations, replies to your own first.'])]
    ]]
  };

  SW.guide = function (name) {
    var g = GUIDES[name]; if (!g) return;
    var d = SW.el('dialog', { class: 'tray-big annohelp guidehelp' });
    d.innerHTML = '<div class="tray-bighead"><b>' + g[0] + '</b><span class="refhelp-acts"><button class="btn ghost" data-share title="A link that opens the bench with this guide showing">' + SW.SHARE_ICON + ' Share</button><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div><div class="ah">' +
      '<nav class="gh-toc">' + g[1].map(function (s, i) { return '<a href="#" data-to="' + i + '">' + s[0] + '</a>'; }).join('') + '</nav>' +
      g[1].map(function (s, i) { return '<section data-s="' + i + '"><h3>' + s[0] + '</h3>' + s[1] + '</section>'; }).join('') + '</div>';
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
      if (e.target.closest('[data-share]')) { SW.share({ title: g[0] + ' · SHRDLU Research Bench', url: SW.BASE_URI + '?help=' + name }); return; }
      var to = e.target.closest('[data-to]');
      if (to) { e.preventDefault(); var sec = d.querySelector('[data-s="' + to.dataset.to + '"]'); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    d.addEventListener('close', function () { d.remove(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
