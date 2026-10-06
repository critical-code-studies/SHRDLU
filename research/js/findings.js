/*
 * findings.js - what the bench has established, in one citable place: the
 * discoveries recorded in the build logs, each with its evidence (lines in
 * the source, tapes in sources/), the witness tapes and punched titles
 * checked afresh on every visit, and the group's own notes tagged "finding".
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var view = SW.$('#view-findings');

  // Evidence is either a line, found by pattern in a version's assembled
  // source (so it survives renumbering), or a tape image in sources/.
  var FINDINGS = [
    { no: 'F1', kind: 'Damage', cat: 'text', level: 'key', title: 'Winograd’s Stanford copy of smspec carries a block of corrupted characters, and a broken SMPOSS2',
      text: 'Between lines 712 and 771 of smspec in the Stanford distribution, characters are corrupted that the ITS copy (smspec.94) holds intact: “THEN” reads “P^HEN”, “NO NOUN HEAD” reads “NK NCUJ HE@^D”, “REVERSE” reads “REVE@SE”, and control characters (backspace, NUL) sit in the text. The definition of SMPOSS2, which the possessive specialist SMPOSS calls, is named SMPORS2, its variable list is garbled (“SL^COL^P” for SMCOMP) and a parenthesis is lost, so from there the file no longer reads as whole forms. A run of the Stanford copy would need this block taken from the ITS text. Exchange 18 of the dialogue, “the tallest pyramid’s support”, is a possessive.',
      ev: [{ v: 'stanford', re: /SMPORS2/, label: 'the damaged definition' }, { v: 'mit', re: /^\(DEFUN SMPOSS2/, label: 'the ITS text' }, { v: 'stanford', tab: 'analyse', lens: 8, label: 'Absence: the damage listed' }] },
    { no: 'F2', kind: 'Collation', cat: 'versions', level: 'key', title: 'The Stanford distribution and the MIT files on ITS carry the same text',
      text: 'Collated file by file, the program files the two share differ only in end-of-file page marks and blank lines, in three places where a bare carriage return of the ITS text became a line break (F8), in plnr laid out with other indentation (the same words, once spacing is set aside), and in the damaged block of smspec (F1). The ITS version numbers match the 1987 listing of MC:SHRDLU; in Winograd’s file-note (PLNR 182, GRAMAR 28, SYSCOM 180, BLOCKP 3 and the rest) except SMSPEC, listed as 96 but held on ITS as smspec.94, with the same text. The check below repeats the collation on every visit.',
      ev: [{ v: 'stanford', re: /^MC: SHRDLU; \* \*/, label: 'the 1987 listing in file-note' }, { v: 'mit', tab: 'compare', label: 'Compare' }] },
    { no: 'F3', kind: 'Anomaly', cat: 'text', level: 'minor', title: 'Two stray closing parentheses, in show and in the demonstration script',
      text: 'A closing parenthesis with nothing open ends a form near line 1026 of show, and line 31 of the demonstration script (DEMO FLICK), in both the ITS and the Stanford copies. The MacLisp reader would have read past it; it is in the text as held.',
      ev: [{ v: 'mit', re: /^\(DEFUN HELP NIL/, label: 'show, after the stray parenthesis' }, { v: 'mit', re: /\(DISME\)\(FRAME WAIT\)\(DTHRU\)\)/, label: 'demo.flick:31' }] },
    { no: 'F4', kind: 'Record', cat: 'versions', level: 'notable', title: 'The 1976 demonstration program replays a script; it does not run SHRDLU',
      text: 'TWDEMO, dated 6 May 1976 on MC, was added to the PDP-10/its repository in 2019 by Lars Brinkhoff as “a program that just replays the dialogue in SHRDLU; DEMO FLICK”. Its script sets the dialogue’s text between @ signs and interleaves display commands that move the arm to fixed coordinates: (MOVETO 100 340 500), (GRASP (QUOTE :B7)), (UNGRASP). What TWDEMO shows is the dialogue drawn on the 340 with none of the parser, the semantics or Micro-Planner running.',
      ev: [{ v: 'mit', re: /PICK UP A BIG RED BLOCK/, label: 'the first exchange in the script' }, { v: 'mit', re: /GRASP \(QUOTE :B7\)/, label: 'the arm told where to go' }] },
    { no: 'F5', kind: 'Restoration', cat: 'versions', level: 'notable', title: 'The 2024 restoration writes Micro-Planner’s # as !',
      text: 'In the MIT files as found, 1,403 names in code begin with #, Micro-Planner’s mark for the predicates of the blocks world (#SUPPORT, #PUT, #COLOR). In Eric Swenson’s restoration 1,136 begin with ! instead (three # remain): (DEFS !PART …) for (DEFS #PART …). His commit messages do not say why; later MacLisps read # as a macro character, which would account for it.',
      ev: [{ v: 'mit', re: /^\(DEFS #PART/, label: '#PART as found' }, { v: 'ejs', re: /^\(DEFS !PART/, label: '!PART restored' }] },
    { no: 'F6', kind: 'Record', cat: 'hands', level: 'minor', title: '“Performed on graduation day, June 2, 1972 by JMH”',
      text: 'A comment beside the dictionary entry for #PART in dictio records who made it and when: “PERFORMED ON GRADUATION DAY, JUNE 2, 1972 BY JMH”. JMH is not yet identified. Jeff Hill, one of the four the CMU manual names as revising the program, is named in gramar as the author of a check on quoted subjects “put in by Jeff Hill in the spring of 1972” and later deleted; whether he is JMH the record does not settle.',
      ev: [{ v: 'mit', re: /GRADUATION DAY/, label: 'the comment' }, { v: 'mit', re: /Jeff Hill/, label: 'Jeff Hill in gramar' }] },
    { no: 'F7', kind: 'Record', cat: 'run', level: 'key', title: 'The restored program “fails at some things that the DEMO apparently succeeded in doing”',
      text: 'Eric Swenson’s note on restoring SHRDLU to run on a later MacLisp (22 July 2024): “Without the Type 340 display, SHRDLU should work reasonably well. It fails at some things that the DEMO apparently succeeded in doing. It is not clear why, but likely the demo was created at one point, and the SHRDLU sources were updated after that point, breaking some things.” The Run view will test the 42 exchanges against each version held.',
      ev: [{ v: 'ejs', tab: 'about', label: 'the restoration’s record' }, { v: 'ejs', tab: 'run', label: 'the dialogue as the test' }] },
    { no: 'F8', kind: 'Damage', cat: 'text', level: 'key', title: 'Carriage returns became line breaks in the Stanford copy, turning two comments into code',
      text: 'The ITS files hold a few bare carriage returns (control-M without a line feed): at the head of gramar, before a line of the demonstration script, and inside two comments in smutil (“RETURNED JUST ^MTHE WAY IT WAS”, “RETRIEVES THE ^MAPPROPRIATE RECOMMENDATION”). MacLisp read such a character as part of the comment. In Winograd’s Stanford copy every one of them is a line break, so in smutil the rest of each comment stands on a line of its own without a semicolon and is read as code: THE, WAY, IT and WAS become variables the program tries to evaluate. On the bench’s interpreter the Stanford copy halts on “THE” in its first sentence unless the two lines are rejoined (repairs S-T2 and S-T3). The conversion from ITS to Unix text that produced the Stanford files evidently treated a lone carriage return as the end of a line.',
      ev: [{ v: 'stanford', re: /^THE WAY IT WAS\./, label: 'the comment broken into code' }, { v: 'mit', re: /RETURNED JUST \rTHE WAY IT WAS/, label: 'the ITS line, whole' }, { v: 'stanford', re: /^APPROPRIATE RECOMMENDATION USING/, label: 'the second break' }] },
    { no: 'F9', kind: 'Anomaly', cat: 'grammar', level: 'notable', title: 'The word BOTH calls a function that no surviving file defines',
      text: 'In the MIT and Stanford copies the dictionary entry for BOTH, a procedure as SHRDLU’s dictionary entries can be, calls (** N NW (EQ (WORD PTW) (CAR A)) NW). No file of either copy defines **, so on the bench a sentence with “both” halts: exchange 13 of the dialogue, “will you please stack up both of the red blocks and either a green cube or a pyramid?”. Swenson’s restoration calls move-ptw there, PROGRAMMAR’s function for moving the word pointer, which takes arguments of just this shape. Whether ** was defined in a file the record does not keep, or the entry was left broken, is not known. The bench runs the older copies with the restoration’s reading of this line (repairs I-T1 and S-T4).',
      ev: [{ v: 'mit', re: /\(\*\* N/, label: 'the call to **' }, { v: 'ejs', re: /\(move-ptw N/, label: 'the restoration’s reading' }] }

  ];
  // Each finding's number is its own, written above and never changed: a new
  // finding takes the next number, wherever it is placed in the list.
  var FIND = FINDINGS;

  function vLabel(id) { var v = V.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : id; }

  // The line a pattern finds, in the assembled parts of a version.
  function locate(ev) {
    if (!ev.re) return Promise.resolve(null);
    return SW.build(ev.v).then(function (b) {
      for (var p = 0; p < b.lines.length; p++) {
        var ls = b.lines[p];
        for (var i = 0; i < ls.length; i++) if (!ls[i].away && ev.re.test(ls[i].raw)) return { b: b, p: p, n: ls[i].n };
      }
      return null;
    }).catch(function () { return null; });
  }

  function go(ev, at) {
    if (ev.tape) {
      var owner = ev.v || (SW.tape.allTapes().filter(function (t) { return t.path === ev.tape; })[0] || {}).versions;
      var vid = typeof owner === 'string' ? owner : owner && owner[0];
      if (!vid) { window.open(SW.sourceURL(ev.tape), '_blank', 'noopener'); return; }
      SW.state.tapeGo = { path: ev.tape, from: ev.from };
      if (vid !== SW.state.v) SW.select(vid);
      SW.setTab('tape');
      return;
    }
    if (at && !ev.tab) { SW.openAt(ev.v, { p: at.p, n0: at.n }); return; }
    if (ev.v !== SW.state.v) SW.select(ev.v);
    if (ev.lens) { SW.openLens(ev.lens); return; }
    SW.setTab(ev.tab || 'read');
  }

  function evidenceHTML(f, el) {
    var wrap = SW.el('div', { class: 'fd-ev' });
    wrap.appendChild(SW.el('span', { class: 'hint' }, 'Evidence '));
    f.ev.forEach(function (ev) {
      if (ev.tape) {
        var a = SW.el('button', { class: 'btn ghost mono', title: 'Show this tape in the Tape view' + (ev.from ? ', from frame ' + ev.from : '') }, '▤ ' + ev.tape.split('/').pop());
        a.onclick = function () { go(ev); };
        wrap.appendChild(a);
        wrap.insertAdjacentHTML('beforeend', '<span class="fd-gh"><a href="' + SW.esc(SW.sourceURL(ev.tape)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(ev.tape) + ' on GitHub in a new tab">↗</a></span>');
        return;
      }
      var bv = V.byId(ev.v), btn = SW.el('button', { class: 'btn ghost', title: 'Open in ' + vLabel(ev.v) }, SW.esc(vLabel(ev.v) + (ev.label ? ', ' + ev.label : '')) + (bv && bv.build ? ' ' + SW.refTag(ev.v) : ''));
      var at = null;
      btn.onclick = function () { go(ev, at); };
      wrap.appendChild(btn);
      locate(ev).then(function (r) {
        if (!r) return;
        at = r;
        btn.innerHTML = SW.esc(vLabel(ev.v) + ', l. ' + r.n + (ev.label ? ' (' + ev.label + ')' : '')) + ' ' + SW.refTag(r.b.v.id, r.p, r.n, r.n, r.b.parts.length);
        btn.title = SW.cite(r.b, r.p, r.n, r.n);
        ev.cite = SW.cite(r.b, r.p, r.n, r.n);
      });
    });
    el.appendChild(wrap);
  }

  // ---------- live checks ----------
  var live = { notes: null, threads: null, box: null };
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
      box.innerHTML = '';
      box.appendChild(SW.table(['Stanford', 'ITS', 'Lines', 'Lines differing, in place', 'Text, spacing aside'], rows, { cls: ['mono', 'mono', 'num', 'num', ''] }));
    }).catch(function (err) { box.innerHTML = '<p class="badge err">' + SW.esc(err.message) + '</p>'; });
  }

  // Who added a finding, as a colour: the bench (its build logs) in the beam
  // colour, each person by their initials.
  function hueOf(by) { var h = 0; for (var i = 0; i < by.length; i++) h = (h * 31 + by.charCodeAt(i)) % 360; return (h + 200) % 360; }
  function colourOf(by) { return by === 'bench' ? 'var(--beam)' : 'hsl(' + hueOf(by) + ',62%,60%)'; }
  function legend(people) {
    var el = SW.$('.fd-legend', view);
    if (!el) return;
    el.innerHTML = '<span class="hint">Added by</span> <span class="fd-who"><i style="background:' + colourOf('bench') + '"></i>the bench (build logs)</span>' +
      people.map(function (p) { return ' <span class="fd-who"><i style="background:' + colourOf(p) + '"></i>' + SW.esc(p) + '</span>'; }).join('');
  }
  function mineButton(make, extra) {
    return SW.el('button', { class: 'btn ghost fd-mine', title: 'Put this finding in My notes (private)', onclick: function () { SW.tray.addDoc(make(), extra); } }, '＋ My notes');
  }
  // On a finding of one's own: edit it, move it to the bin, or take it back
  // into My notes (out of the group).
  var undo = [];   // this session: how to reverse each change to the group's findings
  function paintUndo() {
    var b = SW.$('#view-findings .fd-undo'); if (!b) return;
    b.hidden = !undo.length; b.title = undo.length ? 'Undo: ' + undo[undo.length - 1].label : '';
  }
  function did(label, fn) {
    undo.push({ label: label, fn: fn });
    paintUndo();
    SW.toast(label, 0, { label: 'Undo', fn: undoLast });
  }
  function undoLast() {
    var u = undo.pop(); paintUndo(); if (!u) return;
    Promise.resolve(u.fn()).then(function () { SW.toast('Undone'); }, function (err) { SW.toast(err.message, 5000); });
  }
  function ownActions(n, li) {
    var box = SW.el('span', { class: 'fd-own' });
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Edit the text and tags', onclick: function () {
      if (SW.$('.fd-edit', li)) return;
      var ed = SW.el('div', { class: 'fd-edit' });
      var keep = (n.tags || []).filter(function (g) { return /^findings?$/i.test(g); });
      var c0 = catOf(n.text, n.tags), l0 = levelOf(n.tags);
      ed.innerHTML = '<textarea rows="4"></textarea><input placeholder="Tags, separated by commas">' +
        '<div class="toolbar" style="position:static;padding-left:0"><label class="check">Importance <select data-e2="lvl">' + LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === l0 ? ' selected' : '') + '>' + l[2] + ' ' + l[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="check">Category <select data-e2="cat"><option value="">Found from the words (' + SW.esc(CATNAME[catOf(n.text, []).id]) + ')</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (!c0.auto && c0.id === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn" data-e="save">Save</button><button class="btn ghost" data-e="cancel">Cancel</button></div>';
      var fpe = SW.figpack.split(n.text);
      SW.$('textarea', ed).value = fpe.text;
      SW.mdTools(SW.$('textarea', ed));
      SW.$('input', ed).value = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).join(', ');
      ed.addEventListener('click', function (e) {
        var b = e.target.closest('[data-e]'); if (!b) return;
        if (b.dataset.e === 'cancel') { ed.remove(); return; }
        var text = SW.$('textarea', ed).value.trim(); if (!text) return;
        var fpk = SW.figpack.split(n.text); if (fpk.b64) text += '\n\n<!-- sh:fig:gz ' + fpk.b64 + ' -->';
        var tags = keep.concat(SW.$('input', ed).value.split(',').map(function (g) { return g.trim(); }).filter(function (g) { return g && !/^(cat|level):/.test(g); }));
        tags.push('level:' + SW.$('[data-e2="lvl"]', ed).value);
        if (SW.$('[data-e2="cat"]', ed).value) tags.push('cat:' + SW.$('[data-e2="cat"]', ed).value);
        b.disabled = true;
        var was = { text: n.text, tags: (n.tags || []).slice() };
        N.update(n, text, tags).then(function () { did('Finding edited', function () { return N.update(n, was.text, was.tags); }); }, function (err) { b.disabled = false; SW.toast(err.message, 5000); });
      });
      li.appendChild(ed);
      SW.$('textarea', ed).focus();
    } }, '✎ Edit'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group’s Findings (to the bin, where it can be restored)', onclick: function () {
      if (!confirm('Delete this finding from the group? It goes to the bin, where it can be restored.')) return;
      N.bin(n).then(function () { did('Finding moved to the bin', function () { return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '🗑 Delete'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group and back into My notes, private', onclick: function () {
      var nr = threadOf(n) ? countReplies(threadOf(n)) : 0;
      if (!confirm('Take this finding out of the group and back into My notes?' + (nr ? ' Its ' + nr + ' comment' + (nr === 1 ? '' : 's') + ' from the group will come with it, into the note.' : ''))) return;
      // the group's replies come with it, into the note (they stay with the finding in the bin, and return if it is restored)
      var said = []; (function walk(rs) { rs.forEach(function (r) { said.push({ by: r.note.by, date: r.note.date, text: r.note.text }); walk(r.replies); }); })((threadOf(n) || { replies: [] }).replies);
      N.bin(n).then(function () { SW.tray.recall(n, said); did('Back in My notes' + (said.length ? ', with ' + said.length + ' comment' + (said.length === 1 ? '' : 's') : ''), function () { SW.tray.undo(); return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '↩ Recall to My notes'));
    return box;
  }
  // Annotations tagged "finding": cards in their author's colour; the first line is the title.
  function checkNotes(box, cached) {
    live.box = box;
    if (!cached || !live.notes) box.innerHTML = '<p class="hint">Gathering the group’s findings…</p>';
    return (cached && live.notes ? Promise.resolve(null) : N.whoami().catch(function () {}).then(function () { return N.listAll({ reactions: true }); })).then(function (all) {
      if (all) live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; }));
      var list = all ? all.filter(function (n) {
        return !n.parent && (n.tags || []).some(function (t) { return /^findings?$/i.test(t); });
      }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }) : live.notes;
      live.notes = list;
      box.innerHTML = '';
      var people = []; list.forEach(function (n) { if (people.indexOf(n.by) < 0) people.push(n.by); });
      legend(people);
      var mem = SW.$('#view-findings .fd-members');
      if (mem) {
        var cnt = {}; list.forEach(function (n) { cnt[n.by] = (cnt[n.by] || 0) + 1; });
        mem.innerHTML = '<button class="btn ghost' + (!FS.by ? ' on' : '') + '" data-by="">All <span class="faint">' + list.length + '</span></button>' +
          people.map(function (pp) { return '<button class="btn ghost' + (FS.by === pp ? ' on' : '') + '" data-by="' + SW.esc(pp) + '"><i class="fd-dot" style="background:' + colourOf(pp) + '"></i>' + SW.esc(pp) + ' <span class="faint">' + cnt[pp] + '</span></button>'; }).join('');
        mem.onclick = function (e) { var b = e.target.closest('[data-by]'); if (!b) return; FS.by = b.dataset.by; SW.store.set('fd.filt', FS); checkNotes(box, true); };
      }
      if (!list.length) {
        box.innerHTML = '<p class="hint">None from the group yet. Add one with ✎ Add a finding above, or ★ Finding on a selection in Read: it is shared with the group, signed and dated, and shown here in your colour.</p>';
        return;
      }
      var items = list.map(function (n, i) {
        var c = catOf(n.text, n.tags), lvl = levelOf(n.tags);
        var th0 = threadOf(n), st = th0 ? N.statusOf(th0.reactions).state : '';
        return { key: 'n:' + n.id, by: n.by, cat: c, lvl: lvl, st: st, order: i, text: refOf(n) + ' ' + n.text + ' ' + (n.tags || []).join(' ') + ' ' + n.by, vids: [n.vid], card: function () { return groupCard(n, i, c, lvl); } };
      });
      grouped(box, items, 'None.');
    });
  }
  // Reactions and ratings on a finding: an emoji, or a rating of one to three
  // stars (a reaction "★1".."★3", one per person), each signed and removable.
  var RATE = /^★([123])$/;
  function emojiOf(t) { return t ? t.reactions.filter(function (r) { return !RATE.test(r.text) && !/^status:/.test(r.text); }) : []; }
  function ratingOf(t) {
    var rs = t ? t.reactions.filter(function (r) { return RATE.test(r.text); }) : [];
    if (!rs.length) return null;
    var sum = rs.reduce(function (a, r) { return a + +RATE.exec(r.text)[1]; }, 0), mine = rs.filter(function (r) { return N.myReaction(r); })[0];
    return { n: rs.length, avg: sum / rs.length, mine: mine ? +RATE.exec(mine.text)[1] : 0, who: rs.map(function (r) { return r.by + ' ' + r.text; }) };
  }
  function rxBar(t) {
    var by = {}, mineE = {}; emojiOf(t).forEach(function (r) { (by[r.text] = by[r.text] || []).push(r.by); if (N.myReaction(r)) mineE[r.text] = 1; });
    var R = ratingOf(t);
    return '<div class="fd-rxbar"><span class="fd-rate" title="Your rating (one to three stars); the crew’s average beside it">' + [1, 2, 3].map(function (k) { return '<button data-rate="' + k + '" class="' + (R && R.mine >= k ? 'on' : '') + '">★</button>'; }).join('') +
      (R ? ' <span class="hint" title="' + SW.esc(R.who.join('; ')) + '">' + (Math.round(R.avg * 10) / 10) + ' from ' + R.n + '</span>' : '') + '</span>' +
      N.EMOJI.map(function (e) { return '<button class="fd-emo' + (mineE[e] ? ' on' : '') + '" data-emoji="' + e + '" title="' + SW.esc((by[e] || []).join(', ') || 'React') + '">' + e + (by[e] ? '<sup>' + by[e].length + '</sup>' : '') + '</button>'; }).join('') + '</div>';
  }
  function refreshThreads() {
    return N.listAll({ reactions: true }).then(function (all) { live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; })); if (live.box) checkNotes(live.box, true); });
  }
  function react(n, emoji) {
    var t = threadOf(n), mine = t && t.reactions.filter(function (r) { return r.text === emoji && N.myReaction(r); })[0];
    return (mine ? N.remove(mine, true) : N.create({ vid: n.vid, parent: n.id, kind: 'reaction', anchor: n.anchor, text: emoji, tags: [], quiet: true })).then(refreshThreads);
  }
  function rate(n, k) {
    var t = threadOf(n), mine = t ? t.reactions.filter(function (r) { return RATE.test(r.text) && N.myReaction(r); }) : [], same = mine.some(function (r) { return r.text === '★' + k; });
    return mine.reduce(function (p, r) { return p.then(function () { return N.remove(r, true); }); }, Promise.resolve())
      .then(function () { return same ? null : N.create({ vid: n.vid, parent: n.id, kind: 'reaction', anchor: n.anchor, text: '★' + k, tags: [], quiet: true }); }).then(refreshThreads);
  }
  // A crew finding's reference: from its annotation's id, so it is the same for
  // everyone and never changes (a finding shared again is a new annotation, with a new one)
  function refOf(n) { var h = 5381, id = String(n.id); for (var k = 0; k < id.length; k++) h = ((h * 33) ^ id.charCodeAt(k)) >>> 0; return 'C-' + h.toString(36).toUpperCase().slice(-5).padStart(5, '0'); }
  function threadOf(n) { return (live.threads || []).filter(function (t) { return t.note.id === n.id; })[0] || null; }
  function countReplies(t) { return t.replies.reduce(function (a, r) { return a + 1 + countReplies(r); }, 0); }
  // A finding in a large window: its whole text and figure, its tags, and
  // what others have added (replies and reactions), with a reply box.
  function openFinding(n, i, title, fp, c, lvl, where, toReply) {
    var d = SW.el('dialog', { class: 'tray-big fd-big' });
    var rest = fp.text.split('\n').slice(1).join('\n').trim();
    var tags = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); });
    function rx(t) {
      var by = {}; t.reactions.forEach(function (r) { (by[r.text] = by[r.text] || []).push(r.by); });
      return Object.keys(by).map(function (k) { return '<span class="fd-rx">' + SW.esc(k) + ' ' + SW.esc(by[k].join(', ')) + '</span>'; }).join(' ');
    }
    function replies(t, depth) {
      return t.replies.map(function (r) {
        return '<div class="fd-reply" style="margin-left:' + (depth * 16) + 'px;border-left-color:' + colourOf(r.note.by) + '"><div class="fd-rhead"><span class="badge" style="background:' + colourOf(r.note.by) + ';color:#000">' + SW.esc(r.note.by) + '</span> <span class="hint">' + SW.esc(SW.fmtDate(r.note.date)) + '</span></div>' +
          '<div class="fd-rtext note-md">' + SW.md(r.note.text) + '</div>' + (r.reactions.length ? '<div>' + rx(r) + '</div>' : '') + '</div>' + replies(r, depth + 1);
      }).join('');
    }
    function paint() {
      var t = threadOf(n);
      d.innerHTML = '<div class="tray-bighead"><span class="fd-no fd-ref mono">' + refOf(n) + '</span> ' + (t ? N.statusChip(N.statusOf(t.reactions)) + ' ' : '') + '<b>' + SW.md(title).replace(/^<p>|<\/p>$/g, '') + '</b> <span class="badge" style="background:' + colourOf(n.by) + ';color:#000">' + SW.esc(n.by) + '</span>' + chips(c, lvl) +
        ' <span class="hint">' + SW.esc(SW.fmtDate(n.date)) + '</span><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
        (rest ? '<div class="fd-rtext note-md">' + SW.md(rest) + '</div>' : '') + '<div class="fd-bigfig"></div>' +
        (tags.length ? '<p>' + tags.map(function (g) { return '<span class="fd-tag">' + SW.esc(g.replace(/^chapter:/, '')) + '</span>'; }).join(' ') + '</p>' : '') +
        '<p class="hint">Evidence: ' + SW.esc(where) + '</p>' + rxBar(t) +
        '<h4 class="fd-rh">Replies' + (t ? ' <span class="faint">' + countReplies(t) + '</span>' : '') + '</h4>' + (t && t.replies.length ? replies(t, 0) : '<p class="hint">None yet.</p>') +
        '<div class="fd-replybox"><textarea rows="3" placeholder="Reply, signed with your initials"></textarea><button class="btn" data-reply>Reply</button></div>';
      SW.mdTools(SW.$('.fd-replybox textarea', d));
      if (fp.b64) SW.figpack.unpack(fp.b64).then(function (svg) { var fb = SW.$('.fd-bigfig', d); if (fb) fb.innerHTML = '<div class="tray-fig">' + SW.figpack.img(svg, 'fig-full') + '</div>'; });
    }
    paint();
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); return; }
      var eb = e.target.closest('[data-emoji], [data-rate]');
      if (eb) { eb.disabled = true; (eb.dataset.emoji ? react(n, eb.dataset.emoji) : rate(n, +eb.dataset.rate)).then(paint, function (err) { eb.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); }); return; }
      var rb = e.target.closest('[data-reply]');
      if (rb) {
        var ta = SW.$('.fd-replybox textarea', d), text = ta.value.trim(); if (!text) return;
        rb.disabled = true;
        N.create({ vid: n.vid, parent: n.id, kind: n.kind, anchor: n.anchor, text: text, tags: [] }).then(function () {
          return N.listAll({ reactions: true });
        }).then(function (all) { live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; })); paint(); }, function (err) { rb.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); });
      }
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    if (toReply) { var ta = SW.$('.fd-replybox textarea', d); if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus(); } }
  }
  function groupCard(n, i, c, lvl) {
      {
        var fp = SW.figpack.split(n.text);
        var lines = fp.text.split(/\n/), title = lines[0].replace(/^#+\s*/, ''), rest = lines.slice(1).join('\n').trim();
        var where = vLabel(n.vid) + ' ' + (n.anchor ? SW.refText(n.vid, n.anchor.p, n.anchor.n0, n.anchor.n1, SW.nparts(n.vid)) : SW.refText(n.vid) + ', the version');
        var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf(n.by) });
        var th = threadOf(n), nrep = th ? countReplies(th) : 0, nrx = emojiOf(th).length, R0 = ratingOf(th);
        li.innerHTML = '<div class="fd-head"><button class="icon-btn fd-open" title="Open: the whole finding, replies and reactions">⤢</button><span class="fd-no fd-ref mono" title="Its reference, which does not change">' + refOf(n) + '</span> ' + (th ? N.statusChip(N.statusOf(th.reactions)) + ' ' : '') + '<b class="fd-title">' + SW.md(title).replace(/^<p>|<\/p>$/g, '') + '</b> <span class="badge" style="background:' + colourOf(n.by) + ';color:#000">' + SW.esc(n.by) + '</span>' + chips(c, lvl) + ' <span class="hint">' + SW.esc(SW.fmtDate(n.date)) + '</span></div>' +
          (rest ? '<div class="note-md">' + SW.md(rest) + '</div>' : '') + ((n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).map(function (g) { return /^note:/.test(g) ? '<span class="fd-tag fd-noteref mono" title="The note in its author’s My notes that this was shared from">from ' + SW.esc(g.slice(5)) + '</span>' : '<span class="fd-tag">' + SW.esc(g.replace(/^chapter:/, '')) + '</span>'; }).join(' ') || '') + '<div class="fd-ev"><span class="hint">Evidence </span><a href="#" class="fd-go">' + SW.esc(where) + '</a></div>';
        if (nrep || nrx || R0) SW.$('.fd-ev', li).insertAdjacentHTML('beforeend', ' <a href="#" class="fd-replies">' + [nrep ? nrep + (nrep === 1 ? ' reply' : ' replies') : '', nrx ? emojiOf(th).map(function (r) { return r.text; }).join('') : '', R0 ? 'crew ' + SW.stars(R0.avg, (Math.round(R0.avg * 10) / 10) + ' from ' + R0.n) + ' (' + R0.n + ')' : ''].filter(Boolean).join(' · ') + '</a>');
        li.addEventListener('click', function (e) {
          if (e.target.closest('.fd-open, .fd-title, .fd-replies')) { e.preventDefault(); openFinding(n, i, title, fp, c, lvl, where); return; }
          if (e.target.closest('[data-freply]')) { e.preventDefault(); openFinding(n, i, title, fp, c, lvl, where, true); return; }
          // anywhere else on the card that is not a control opens it to read
          if (!e.target.closest('a, button, input, textarea, select, label, .fd-edit, .fd-fig, .fd-fold, details')) openFinding(n, i, title, fp, c, lvl, where);
        });
        li.classList.add('fd-click');
        SW.$('.fd-go', li).onclick = function (e) {
          e.preventDefault();
          if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
          if (n.vid !== SW.state.v) SW.select(n.vid);
          SW.setTab(n.anchor ? 'read' : 'about');
        };
        if (fp.b64) {   // the figure shared with it
          var fbox = SW.el('div', { class: 'fd-fig' }, '<p class="hint">Opening the figure…</p>');
          li.insertBefore(fbox, SW.$('.fd-ev', li));
          SW.figpack.unpack(fp.b64).then(function (svg) {
            fbox.innerHTML = SW.figpack.img(svg, 'fd-thumb') + '<button class="icon-btn fd-expand" title="Open larger">⤢</button>';
            fbox.onclick = function () { SW.figpack.big(svg, title); };
            fbox._svg = svg;
          }, function (e) { fbox.innerHTML = '<p class="hint">' + SW.esc(e.message) + '</p>'; });
        }
        li.appendChild(SW.el('button', { class: 'btn ghost fd-replybtn', 'data-freply': '1', title: 'Read it, with what others have said, and reply' }, '💬 ' + (nrep ? nrep + ' repl' + (nrep === 1 ? 'y' : 'ies') + ' · ' : '') + 'Reply'));
        if (N.mine(n)) li.appendChild(ownActions(n, li));
        if (fp.b64) li.appendChild(SW.el('button', { class: 'btn ghost fd-mine', title: 'Put this finding’s figure in My notes (private)', onclick: function () { var fb = SW.$('.fd-fig', li); if (fb && fb._svg) SW.tray.addFigure(fb._svg, title); } }, '＋ My notes'));
        else li.appendChild(mineButton(function () { return { title: title, subtitle: n.by + ', ' + SW.fmtDate(n.date) + '; ' + where, blocks: rest ? [{ type: 'p', text: rest }] : [] }; }, { by: n.by, vid: n.vid, shared: { date: n.date }, tags: (n.tags || []).filter(function (g) { return !/^findings?$|^chapter:/i.test(g); }) }));
        return li;
      }
  }

  // ---------- export ----------
  function doc() {
    var blocks = [{ type: 'h2', text: 'Established by the bench' }];
    FIND.forEach(function (f) {
      blocks.push({ type: 'h3', text: f.no + '. ' + f.title });
      blocks.push({ type: 'p', text: f.text });
      var ev = f.ev.map(function (e) {
        return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : ''));
      });
      blocks.push({ type: 'p', text: 'Evidence. ' + ev.join('; ') + '.' });
    });
    if (live.witness) {
      blocks.push({ type: 'h2', text: 'Witness tapes' });
      blocks.push(SW.tableBlock('Builds compared with surviving object tapes, ' + SW.fmtDate(SW.today()), ['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        live.witness.map(function (r) { return r.slice(0, 7); })));
    }
    if (live.titles) {
      blocks.push({ type: 'h2', text: 'Punched titles' });
      blocks.push(SW.tableBlock('Titles punched into the tapes, as read by the bench', ['Tape', 'Frames', 'Reading', 'Versions'],
        live.titles.map(function (r) { return [r.tape.path, r.t.from + '–' + r.t.to, r.t.text, r.tape.versions.map(function (id) { var v = V.byId(id); return vLabel(id) + (v && v.build ? ' ' + SW.refText(id) : ''); }).join(', ')]; })));
    }
    if (live.notes && live.notes.length) {
      blocks.push({ type: 'h2', text: 'Findings from the group' });
      blocks.push(SW.tableBlock('Annotations tagged “finding”', ['Ref', 'Date', 'By', 'Version', 'Where', 'Finding'], live.notes.map(function (n) {
        return [refOf(n), SW.fmtDate(n.date), n.by, vLabel(n.vid), n.anchor ? SW.refText(n.vid, n.anchor.p, n.anchor.n0, n.anchor.n1, SW.nparts(n.vid)) : SW.refText(n.vid), SW.figpack.split(n.text).text + (SW.figpack.split(n.text).b64 ? ' [with a figure]' : '')];
      })));
    }
    return { title: 'SHRDLU findings', subtitle: 'What the sources and their collation show',
             meta: [['Generated', SW.fmtDate(SW.today()) + ', SHRDLU research bench v' + SW.VERSION]], blocks: blocks };
  }

  // ---------- view ----------
  // ---------- categories and importance ----------
  // A category is found from the words of a finding (the one with most
  // matches), unless a "cat:" tag sets it; importance from a "level:" tag, and
  // for the bench's own findings Notable until set otherwise.
  var CATS = [
    ['text', 'Text and damage', /\b(corrupt\w*|damage\w*|characters?|typos?|comments?|parenthes\w*|spellings?|transcri\w*)\b/gi],
    ['grammar', 'Grammar and parsing', /\b(grammar|programmar|pars\w*|syntax|clauses?|noun groups?|systemic|dictionary|words?)\b/gi],
    ['semantics', 'Semantics and answering', /\b(semantic\w*|specialists?|meanings?|answer\w*|possessives?|referents?|pronouns?)\b/gi],
    ['planner', 'Micro-Planner and the blocks world', /\b(planner|micro-planner|theorems?|thgoal|assert\w*|goals?|blocks?|pyramids?|arm|hand|grasp\w*)\b/gi],
    ['run', 'Running and the demonstration', /\b(runs?|running|demo\w*|dialogue|exchanges?|display|340|emulat\w*)\b/gi],
    ['hands', 'Hands and dates', /\b(initials|hands?|jmh|ddm|ejs|winograd|mcdonald|hill|card|rubin|dated?)\b/gi],
    ['versions', 'Versions and genealogy', /\b(versions?|witness\w*|copies|copy|collat\w*|restor\w*|its|stanford|mit|listing)\b/gi]
  ];
  var CATNAME = { other: 'Other' }; CATS.forEach(function (c) { CATNAME[c[0]] = c[1]; });
  var LEVELS = [['key', 'Key', '★★★'], ['notable', 'Notable', '★★'], ['minor', 'Minor', '★']];
  function catOf(text, tags) {
    var t = (tags || []).filter(function (g) { return /^cat:/.test(g); })[0];
    if (t && CATNAME[t.slice(4)]) return { id: t.slice(4), auto: false };
    var best = 'other', bn = 0;
    CATS.forEach(function (c) { var m = (String(text).match(c[2]) || []).length; if (m > bn) { bn = m; best = c[0]; } });
    return { id: best, auto: true };
  }
  function levelOf(tags, dflt) {
    var t = (tags || []).filter(function (g) { return /^level:/.test(g); })[0], id = t ? t.slice(6) : '';
    return LEVELS.some(function (l) { return l[0] === id; }) ? id : (dflt || 'notable');
  }
  function chips(c, lvl) {
    var L = LEVELS.filter(function (l) { return l[0] === lvl; })[0];
    return ' <span class="fd-cat" title="' + (c.auto ? 'Category found from the words of the finding; a cat: tag sets it' : 'Category set by a cat: tag') + '">' + SW.esc(CATNAME[c.id]) + (c.auto ? '' : ' ✓') + '</span>' +
      ' <span class="fd-lvl fd-' + lvl + '" title="' + L[1] + '">' + L[2] + '</span>';
  }
  var FS = SW.store.get('fd.filt', {}) || {};
  function passes(it) {
    if (FS.cat && it.cat.id !== FS.cat) return false;
    if (FS.lvl === 'key' && it.lvl !== 'key') return false;
    if (FS.lvl === 'notable' && it.lvl === 'minor') return false;
    if (FS.v && it.vids.indexOf(FS.v) < 0) return false;
    if (FS.by && it.by !== 'bench' && it.by !== FS.by) return false;
    if (FS.q && it.text.toLowerCase().indexOf(FS.q.toLowerCase()) < 0) return false;
    if (FS.st === 'open' && !(it.st === 'open' || it.st === 'help')) return false;
    if (FS.st === 'resolved' && it.st !== 'resolved') return false;
    if (FS.st === 'none' && it.st) return false;
    return true;
  }
  var LORD = { key: 0, notable: 1, minor: 2 };
  // items {cat, lvl, text, vids, card()} under category headings, most important first, minor ones folded
  // Folding: a category or a single finding folded down to its heading, remembered.
  function folds() { return SW.store.get('fd.fold', {}) || {}; }
  function setFold(k, on) { var F = folds(); if (on) F[k] = 1; else delete F[k]; SW.store.set('fd.fold', F); }
  function chevron(el, k, on) {
    var b = SW.el('button', { class: 'fd-fold', type: 'button', title: on ? 'Open' : 'Fold away', 'aria-expanded': String(!on) }, on ? '▸' : '▾');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var f = !el.classList.contains('folded'); el.classList.toggle('folded', f); setFold(k, f);
      b.textContent = f ? '▸' : '▾'; b.title = f ? 'Open' : 'Fold away'; b.setAttribute('aria-expanded', String(!f));
    });
    return b;
  }
  function foldCard(li, k) {
    var head = SW.$('.fd-head', li); if (!head || !k) return li;
    var on = !!folds()['f:' + k]; li.classList.toggle('folded', on);
    head.insertBefore(chevron(li, 'f:' + k, on), head.firstChild);
    return li;
  }
  function grouped(box, items, empty) {
    var shown = items.filter(passes);
    if (!shown.length) { box.appendChild(SW.el('p', { class: 'hint' }, items.length ? 'None with these filters.' : empty)); return; }
    CATS.map(function (c) { return c[0]; }).concat(['other']).forEach(function (id) {
      var g = shown.filter(function (it) { return it.cat.id === id; }); if (!g.length) return;
      g.sort(function (a, b) { return LORD[a.lvl] - LORD[b.lvl] || a.order - b.order; });
      var sec = SW.el('div', { class: 'fd-cgroup' }), con = !!folds()['c:' + id], h = SW.el('h4', { class: 'fd-chead' }, SW.esc(CATNAME[id]) + ' <span class="faint">' + g.length + '</span>');
      sec.classList.toggle('folded', con);
      h.insertBefore(chevron(sec, 'c:' + id, con), h.firstChild);
      sec.appendChild(h);
      var ol = SW.el('ol', { class: 'fd-list' }), minor = g.filter(function (it) { return it.lvl === 'minor'; });
      g.filter(function (it) { return it.lvl !== 'minor'; }).forEach(function (it) { ol.appendChild(foldCard(it.card(), it.key)); });
      sec.appendChild(ol);
      if (minor.length) {
        var d = SW.el('details', { class: 'fd-minor' }, '<summary>' + minor.length + ' minor</summary>'), ol2 = SW.el('ol', { class: 'fd-list' });
        minor.forEach(function (it) { ol2.appendChild(foldCard(it.card(), it.key)); }); d.appendChild(ol2); sec.appendChild(d);
      }
      box.appendChild(sec);
    });
  }
  function filterBar(onChange) {
    var vs = V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, b) { return a.sort - b.sort; });
    var bar = SW.el('div', { class: 'toolbar fd-filters', style: 'position:static;padding-left:0' });
    bar.innerHTML = '<label class="check">Category <select data-f="cat"><option value="">All</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (FS.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check">Importance <select data-f="lvl"><option value="">All</option><option value="notable"' + (FS.lvl === 'notable' ? ' selected' : '') + '>Key and notable</option><option value="key"' + (FS.lvl === 'key' ? ' selected' : '') + '>Key only</option></select></label>' +
      '<label class="check">Version <select data-f="v"><option value="">All</option>' + vs.map(function (v) { return '<option value="' + v.id + '"' + (FS.v === v.id ? ' selected' : '') + '>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</option>'; }).join('') + '</select></label>' +
      '<label class="check" title="From the group’s reactions: 🔓 open, 💡 help wanted, ✅ resolved (the latest counts)">Status <select data-f="st"><option value="">All</option><option value="open"' + (FS.st === 'open' ? ' selected' : '') + '>Open or help wanted</option><option value="resolved"' + (FS.st === 'resolved' ? ' selected' : '') + '>Resolved</option><option value="none"' + (FS.st === 'none' ? ' selected' : '') + '>No status</option></select></label>' +
      '<input type="search" data-f="q" placeholder="Find in findings" value="' + SW.esc(FS.q || '') + '">' +
      '<button class="btn ghost" type="button" data-fold="all" title="Fold every finding down to its heading">Fold all</button><button class="btn ghost" type="button" data-fold="none" title="Open every finding and category">Open all</button>';
    function set(e) { var f = e.target.dataset.f; if (!f) return; FS[f] = e.target.value; SW.store.set('fd.filt', FS); onChange(); }
    bar.addEventListener('click', function (e) {
      var t = e.target.closest('[data-fold]'); if (!t) return;
      var all = t.dataset.fold === 'all', box = bar.parentNode || document;
      SW.$$('li.fd', box).forEach(function (li) { var b = SW.$('.fd-fold', li); if (b && li.classList.contains('folded') !== all) b.click(); });
      if (!all) SW.$$('.fd-cgroup.folded', box).forEach(function (sec) { var b = SW.$('.fd-chead .fd-fold', sec); if (b) b.click(); });
    });
    bar.addEventListener('change', set);
    bar.addEventListener('input', function (e) { if (e.target.dataset.f === 'q') { clearTimeout(bar._t); bar._t = setTimeout(function () { set(e); }, 250); } });
    return bar;
  }

  // The shared findings: the bench's and the group's. (My notes has its own tab.)
  var done = false;
  function render() {
    done = true;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad findings' });
    view.appendChild(pad);
    var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    tb.appendChild(SW.el('button', { class: 'btn', title: 'A finding on the version open, shared with the group, tagged “finding”; the first line is its title. (For lines, select them in Read and use ★ Finding.)', onclick: function () {
      var v = SW.state.v && V.byId(SW.state.v);
      if (!v) return;
      N.dialog({ vid: v.id, kind: 'version', anchor: null, tags: ['finding'], heading: 'Add a finding', anchorText: 'On ' + v.label + '. Shared with the group and listed under Findings; the first line is its title.' });
    } }, '✎ Add a finding'));
    // export and the rest in one ⋯ menu, as in My notes
    var more = SW.el('details', { class: 'menu exp-menu more-menu' });
    more.innerHTML = '<summary class="btn ghost" title="Export, or check again">⋯</summary>';
    var mb = SW.el('div', { class: 'menu-body' });
    SW.$$('button', SW.exportButtons(doc, 'shrdlu-findings')).forEach(function (x) { x.classList.add('ghost'); mb.appendChild(x); });
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Collate the copies again, and fetch the group’s findings', onclick: function () { run(); } }, '↻ Check again'));
    var right = SW.el('span', { class: 'tb-right', style: 'display:inline-flex;gap:6px' });
    var ub = SW.el('button', { class: 'btn ghost fd-undo', onclick: undoLast }, '↶ Undo');
    ub.hidden = !undo.length; if (undo.length) ub.title = 'Undo: ' + undo[undo.length - 1].label;
    right.appendChild(ub);
    right.appendChild(SW.el('button', { class: 'btn ghost ov-binbtn', title: 'Open the bin: findings you deleted, to restore or delete for good', onclick: function (e) {
      var btn = e.currentTarget, hb = SW.$('.fd-bin', pad);
      if (hb) { hb.remove(); btn.classList.remove('on'); btn.title = 'Open the bin: findings you deleted, to restore or delete for good'; return; }
      hb = SW.el('div', { class: 'fd-bin' }); hb.binFilter = function (n) { return (n.tags || []).some(function (g) { return /^findings?$/i.test(g); }); };
      tb.after(hb); N.showBin(hb, { all: true }); btn.classList.add('on'); btn.title = 'Close the bin';
    } }, '🗑'));
    mb.addEventListener('click', function (e) { if (e.target.closest('button')) more.open = false; });
    more.appendChild(mb);
    right.appendChild(more);
    tb.appendChild(right);
    pad.insertAdjacentHTML('beforeend', '<h2>Findings</h2><p class="prose">What the group and the bench have established about the SHRDLU sources, each with its evidence one click away. Crew: the group’s findings, by member. Bench: the bench’s own, with the Stanford and ITS copies collated afresh.</p>');
    pad.appendChild(tb);
    legend([]);
    // Crew (the group's findings, by member) | Bench (the bench's own, and its checks)
    var side = SW.store.get('fd.side', 'bench');
    var seg = SW.el('div', { class: 'seg-btns fd-side' }, '<button class="btn' + (side === 'crew' ? ' on' : '') + '" data-side="crew" title="The group’s findings">Crew</button><button class="btn' + (side === 'bench' ? ' on' : '') + '" data-side="bench" title="What the bench has established, and its checks of the tapes">Bench</button>');
    seg.addEventListener('click', function (e) { var b = e.target.closest('[data-side]'); if (b && b.dataset.side !== side) { SW.store.set('fd.side', b.dataset.side); render(); } });
    pad.appendChild(seg);
    var fbar = filterBar(function () { if (side === 'bench') paintBench(); else checkNotes(nBox, true); });
    pad.appendChild(fbar);
    var list = SW.el('div', { class: 'fd-bench' });
    function benchCard(f, c, lvl) {
      var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf('bench') });
      li.innerHTML = '<div class="fd-head"><span class="fd-no mono">' + f.no + '</span> <b>' + SW.esc(f.title) + '</b> <span class="badge">' + SW.esc(f.kind) + '</span>' + chips(c, lvl) + '</div><p>' + SW.esc(f.text) + '</p>';
      evidenceHTML(f, li);
      li.appendChild(mineButton(function () {
        return { title: f.no + '. ' + f.title, subtitle: 'Finding (the bench), ' + f.kind, blocks: [{ type: 'p', text: f.text }, { type: 'p', text: 'Evidence. ' + f.ev.map(function (e) { return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : '')); }).join('; ') + '.' }] };
      }));
      return li;
    }
    function paintBench() {
      list.innerHTML = '';
      grouped(list, FIND.map(function (f, n) {
        var c = catOf(f.title + ' ' + f.text + ' ' + f.kind, f.cat ? ['cat:' + f.cat] : []), lvl = f.level || 'notable';
        return { key: 'b:' + f.no, by: 'bench', cat: c, lvl: lvl, order: n, text: f.no + ' ' + f.title + ' ' + f.text + ' ' + f.kind, vids: f.ev.map(function (e) { return e.v; }).filter(Boolean), card: function () { return benchCard(f, c, lvl); } };
      }), 'None.');
    }
    var nBox = SW.el('div'), wBox = SW.el('div'), tBox = SW.el('div');
    if (side === 'bench') {
      pad.appendChild(list);
      paintBench();
      pad.appendChild(SW.el('h3', {}, 'The Stanford and ITS copies, collated now'));
      pad.appendChild(wBox);
    } else {
      pad.appendChild(SW.el('div', { class: 'toolbar fd-members', style: 'position:static;padding-left:0' }));
      pad.appendChild(nBox);
    }
    function run() {
      if (side === 'bench') { checkCollation(wBox); }
      else checkNotes(nBox);
    }
    run();
  }
  SW.findings = { list: FIND, showMine: function () { SW.setTab('notes'); } };
  // To a finding by its code: Findings opened on the side it is on, with the filters off, and the finding shown
  function reveal(side, match, then) {
    FS.by = ''; FS.cat = ''; FS.lvl = ''; FS.v = ''; FS.q = ''; SW.store.set('fd.filt', FS);
    SW.store.set('fd.side', side); done = false;
    if (SW.state.tab === 'findings') render(); else SW.setTab('findings');
    var t0 = Date.now();
    (function look() {
      var li = SW.$$('#view-findings li.fd').filter(function (x) { return match(x); })[0];
      if (li) { li.scrollIntoView({ block: li.offsetHeight > innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' }); li.classList.remove('note-flash'); void li.offsetWidth; li.classList.add('note-flash'); if (then) then(li); return; }
      if (Date.now() - t0 < 8000) setTimeout(look, 200); else SW.toast('Not found among the findings.', 4000);
    })();
  }
  SW.findings.openRef = function (ref) { reveal('crew', function (li) { var r = li.querySelector('.fd-ref'); return r && r.textContent.trim() === ref; }, function (li) { var o = li.querySelector('.fd-open'); if (o) o.click(); }); };
  SW.findings.openBench = function (no) { reveal('bench', function (li) { var r = li.querySelector('.fd-no'); return r && r.textContent.trim() === no; }); };
  SW.on('notes', function () { if (done && SW.state.tab === 'findings') render(); });

  SW.views.findings = { show: function () { if (!done) render(); }, reset: function () { done = false; } };
})(this);
