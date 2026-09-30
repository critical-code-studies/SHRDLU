/*
 * run.js - the Run view: SHRDLU running in the browser, from a version's own
 * source, on the bench's MacLisp (js/maclisp.js, js/session.js). A teletype
 * to type at; the 1970 demonstration dialogue played as a test, exchange by
 * exchange, against what this run answers; and the version's reconstruction
 * card (js/repairs.js): everything the bench does to make it run.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var view = SW.$('#view-run');
  var sess = null, vid = 'ejs', dialogue = null, playing = false, results = {}, lastOut = '', side = 'test';
  var runnable = function () { return V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; }); };

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

  // ---------- the teletype ----------
  var out = null, loadLog = '';
  // the output goes in before the input line, which stays at the cursor, as on a terminal
  function ttyAppend(text, cls) {
    if (!out) return;
    var form = SW.$('#tty-form', out), last = form ? form.previousElementSibling : out.lastElementChild;
    if (!cls && last && last.classList.contains('tty-sh')) last.textContent += text;
    else out.insertBefore(SW.el('span', { class: cls || 'tty-sh' }, SW.esc(text)), form || null);
    out.scrollTop = out.scrollHeight;
  }
  function onOut(t) {
    if (sess && sess.state === 'loading') { loadLog += t; return; }
    // the bench's own answers to start-up questions arrive marked \u0001...\u0002
    t.split(/(\u0001[^\u0002]*\u0002)/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '\u0001') { ttyAppend(part.slice(1, -1).trim() + '   ← typed by the bench (Help ▸ Reconstruction cards)\n', 'tty-bench'); return; }
      lastOut += part;
      ttyAppend(part);
    });
  }
  // the exchange on the 340 (Dialogue): SHRDLU's reply, without its parse counters and prompts
  function caption() {
    if (!said || !disp) return;
    var ans = lastOut.split('\n').map(function (l) { return l.replace(/\[\d+\]/g, ' ').trim(); })
      .filter(function (l) { return l && !/^READY$/.test(l) && !/^RATIO OF WINNING PARSES/.test(l) && !/^>>>/.test(l); }).join(' ');
    // the restoration echoes the sentence before it answers: the echo is left out
    var key = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ''); }, k = key(said.you), words = ans.split(' '), cut = 0;
    for (var i = 1; i <= words.length; i++) if (key(words.slice(0, i).join(' ')) === k) { cut = i; break; }
    if (cut) ans = words.slice(cut).join(' ').replace(/^[\s.,;:?!]+/, '');
    ans = ans.replace(/\s+([.,;:?!])/g, '$1').trim();
    disp.caption.push({ you: said.you, shrdlu: ans });
    if (disp.caption.length > 4) disp.caption.shift();
    said = null; disp.dirty();
  }
  // ---------- Tab completion in the teletype ----------
  // Whole sentences of the 1970 dialogue that begin with what is typed; otherwise the word being
  // typed, completed from SHRDLU's own dictionary (every word with a FEATURES property in the
  // running Lisp). The best shows in grey after the cursor; Tab takes it, Tab again the next.
  var vocab = null, sugg = [], suggAt = 0, sentences = [];
  function dictionary() {
    if (vocab || !sess) return vocab || [];
    var m = sess.m, F = m.obarray.get('FEATURES'), out = [];
    if (F) m.obarray.forEach(function (s) { if (/^[A-Z][A-Z-]*$/.test(s.name) && s.name.length > 1 && m.get(s, F) !== m.NIL) out.push(s.name.toLowerCase()); });
    vocab = out.sort();
    return vocab;
  }
  function suggest() {
    var inp = SW.$('#tty-input', view), g = SW.$('#tty-ghost', view), list = SW.$('#tty-sugg', view); if (!inp || !g) return;
    var v = inp.value, lv = v.toLowerCase();
    sugg = []; suggAt = 0;
    if (v.trim().length >= 2 && inp.selectionStart === v.length && !/^\s*\(/.test(v)) {
      sugg = sentences.filter(function (s) { return s.indexOf(lv) === 0 && s !== lv; }).slice(0, 6).map(function (s) { return { full: s, label: s }; });
      if (!sugg.length) {
        var mw = /([a-z-]+)$/i.exec(v), w = mw ? mw[1].toLowerCase() : '';
        if (w.length >= 1) sugg = dictionary().filter(function (d) { return d.indexOf(w) === 0 && d !== w; }).slice(0, 8).map(function (d) { return { full: v.slice(0, v.length - w.length) + d, label: d }; });
      }
    }
    paintSugg();
  }
  function paintSugg() {
    var inp = SW.$('#tty-input', view), g = SW.$('#tty-ghost', view), list = SW.$('#tty-sugg', view);
    var s = sugg[suggAt], v = inp.value;
    g.innerHTML = s && s.full.toLowerCase().indexOf(v.toLowerCase()) === 0 ? '<span class="tty-ghost-v">' + SW.esc(v) + '</span>' + SW.esc(s.full.slice(v.length)) : '';
    list.innerHTML = sugg.length ? '<span class="hint">Tab</span> ' + sugg.map(function (x, i) { return '<button type="button" class="tty-s' + (i === suggAt ? ' on' : '') + '" data-s="' + i + '">' + SW.esc(x.label) + '</button>'; }).join('') : '';
  }
  var taken = null;   // the last completion taken, so that Tab again cycles to the next
  function fill(s) { return s.full + (/[.?!]$/.test(s.full) ? '' : ' '); }
  function takeSugg(i) {
    var inp = SW.$('#tty-input', view), s = sugg[i]; if (!s) return;
    taken = { list: sugg, i: i };
    inp.value = fill(s);
    inp.focus(); suggest();
  }
  var deepPrev = null, watch = SW.store.get('run.watch', []);
  function paintDeep(fresh) {
    var d = SW.$('#run-deep', view), body = SW.$('#run-deep-body', view);
    if (!d || !body || !d.open || !SW.deepDive) return;
    var p = SW.deepDive.render(body, sess && sess.m, fresh ? deepPrev : null, watch);
    if (fresh) deepPrev = p;
  }
  function status(t) { var s = SW.$('#run-status', view); if (s) { s.textContent = t; s.title = t; } }
  function stateText(st) {
    return { loading: 'Loading the files through the program’s own loader…', running: 'Running…', waiting: 'Waiting for you to type.', halted: 'Stopped on an error (see the teletype).', done: 'The program has returned.' }[st] || st;
  }

  // ---------- the DEC 340 display (js/display.js) ----------
  var dispOn = SW.store.get('run.display', true), armSpeed = +SW.store.get('run.arm', SW.store.get('run.anim', true) ? 1 : 0), colOn = SW.store.get('run.colour', false), solidOn = SW.store.get('run.solid', false), labOn = SW.store.get('run.labels', true), dlgOn = SW.store.get('run.dialogue', true), disp = null, said = null;
  function hasDisplayCode(v) { return v.build.some(function (b) { return /graphf/.test(b.src); }); }
  function paintDispBar() {
    var v = V.byId(vid), has = hasDisplayCode(v), cap = SW.$('#d340-note', view), wrap = SW.$('.d340', view);
    if (!wrap) return;
    wrap.classList.toggle('off', !(dispOn && has));
    SW.$('#run-disp', view).disabled = !has;
    SW.$('#run-arm', view).disabled = !(dispOn && has);
    SW.$('#run-col', view).disabled = !(dispOn && has);
    SW.$('#run-lab', view).disabled = !(dispOn && has);
    SW.$('#run-dlgon', view).disabled = !(dispOn && has);
    SW.$('#run-solid', view).disabled = !(dispOn && has);
    cap.textContent = !has ? 'This copy holds no display code (graphf); the arm moves without being drawn (S-L2).' : dispOn ? '' : 'Off: the program is told there is no DEC 340.';
  }

  function boot(then) {
    var v = V.byId(vid);
    playing = false; limit = 0; played = 0; replaying = false; queue = []; cur = null; results = {}; deepPrev = null; vocab = null; lastOut = ''; loadLog = '';
    if (out) SW.$$('span', out).forEach(function (s) { if (!s.closest('#tty-form')) s.remove(); });
    paintSide();
    status('Fetching the files of ' + v.label + '…');
    // the version's files, and any other copy its repairs read from
    var srcs = v.build.map(function (b) { return b.src; });
    SHRepairs.forVersion(vid).forEach(function (r) { if (r.from) srcs.push(r.from.src); });
    var texts = {};
    Promise.all(srcs.map(function (s) { return SW.fetchText(s).then(function (t) { texts[s] = t; }); })).then(function () {
      var t0 = performance.now();
      var cv = SW.$('#d340', view);
      disp = dispOn && hasDisplayCode(v) && root.SH340 ? new root.SH340({ canvas: cv, colour: colOn, solid: solidOn, labels: labOn, dialogue: dlgOn }) : null;
      if (!disp && cv) { var g = cv.getContext('2d'); g.fillStyle = getComputedStyle(cv).getPropertyValue('--crt').trim() || '#05070a'; g.fillRect(0, 0, cv.width, cv.height); }
      paintDispBar();
      sess = new root.SHSession({ version: v, texts: texts, out: onOut, display: disp, animate: armSpeed > 0, speed: armSpeed || 1, onState: function (st) { status(stateText(st) + (sess ? '  ·  ' + sess.m.steps.toLocaleString('en-GB') + ' steps' : '')); if (st !== 'running' && st !== 'loading') { paintDeep(true); caption(); } } });
      sess.boot(function (r) {
        var ms = Math.round(performance.now() - t0);
        ttyAppend('', 'tty-sh');
        SW.$('#run-loadlog', view).innerHTML = '<summary class="hint">Load log: ' + (sess.loadedSteps || 0).toLocaleString('en-GB') + ' steps, ' + ms + ' ms</summary><pre class="mono">' + SW.esc(loadLog) + '</pre>';
        status(stateText(sess.state) + '  ·  loaded and started in ' + ms + ' ms');
        var inp = SW.$('#tty-input', view); if (inp) inp.focus();
        void r;
        if (typeof then === 'function' && sess.state === 'waiting') then();
      });
    }).catch(function (e) { status(e.message); });
  }

  var hist = SW.store.get('run.hist', []), hi = -1;
  function send(line) {
    if (!sess || sess.state !== 'waiting') { SW.toast(sess ? 'SHRDLU is busy; wait for it to finish.' : 'Start it first.'); return false; }
    ttyAppend(line + '\n', 'tty-you');
    if (line.trim() && !/^\s*\(/.test(line) && !/^\s*GO\s*$/i.test(line)) said = { you: line.trim(), out: '' };
    lastOut = '';
    sess.type(line, function () {
      // SHRDLU reads a sentence until its full stop, question mark or exclamation mark
      if (!playing && line.trim() && !/[.?!]\s*$/.test(line) && !/^\s*\(/.test(line) && !/^\s*GO\s*$/i.test(line) && sess.state === 'waiting' && !/READY\s*$/.test(lastOut) && !/CONTINUE THE SENTENCE\.\s*$/.test(lastOut))
        ttyAppend('SHRDLU is reading on to the end of the sentence: finish it with a full stop, question mark or exclamation mark.\n', 'tty-bench');
      if (!playing && /CONTINUE THE SENTENCE\.\s*$/.test(lastOut))
        ttyAppend('Press Return for the line feed it asks for, then type the rest of the sentence.\n', 'tty-bench');
      if (playing) playNext();
    });
    if (line.trim() && hist[0] !== line) { hist.unshift(line); hist = hist.slice(0, 50); SW.store.set('run.hist', hist); }
    hi = -1;
    return true;
  }

  // ---------- the 1970 dialogue as a test ----------
  var queue = [], cur = null;
  function norm(t) {
    return String(t || '').replace(/\[\d+\]/g, ' ').replace(/RATIO OF WINNING PARSES TO TOTAL\s+\S+/g, ' ').replace(/\bREADY\b/g, ' ').replace(/\(does it\)/gi, ' ')
      .toUpperCase().replace(/ANWHERE/g, 'ANYWHERE').replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  // Play from the start, or on from where » or Stop left off (limit: how many exchanges before
  // waiting; Infinity for Play, 1 for »). « goes back one: a run is repeatable (RANDOM is seeded,
  // RUNTIME counts steps), so the program is started afresh and the exchanges before are replayed
  // at full speed.
  var limit = 0, played = 0, replaying = false;
  function play(n) {
    loadDialogue().then(function (ex) {
      if (!sess || sess.state !== 'waiting') { SW.toast(sess && sess.state === 'running' ? 'SHRDLU is busy: Stop quits it, as ^G did.' : 'Start the program first, and wait for READY.'); return; }
      if (!queue.length && !played) {
        ex.forEach(function (e) { e.turns.forEach(function (t) { if (t.who === 'person') queue.push({ n: e.n, text: t.text.toLowerCase(), e: e }); }); });
        results = {}; paintSide();
      }
      if (!queue.length) { status('The dialogue is played.  ·  « goes back an exchange; ⟳ Restart starts again'); return; }
      playing = true; limit = n;
      playNext();
    });
  }
  function back() {
    var target = played - 1;
    if (target < 0 || (sess && sess.state === 'running')) { SW.toast(target < 0 ? 'Nothing played yet.' : 'SHRDLU is busy: Stop it first.'); return; }
    boot(function () {
      if (!target) { status('Back at the start.  ·  » plays exchange 1'); return; }
      replaying = true; if (sess) sess.animate = false;
      ttyAppend('Replaying exchanges 1–' + target + ' at full speed   ← the bench, going back one exchange\n', 'tty-bench');
      play(target);
    });
  }
  function playNext() {
    if (cur) {
      var r = results[cur.n] || (results[cur.n] = { out: '', breaks: [] });
      r.out += lastOut;
      // SHRDLU stopped in its break loop (">>>"): record it, and type GO, as a user would, to go on
      if (/>>>\s*$/.test(lastOut)) {
        r.breaks.push(lastOut.replace(/>>>\s*$/, '').trim());
        paintRow(cur.e);
        lastOut = '';
        ttyAppend('GO   ← typed by the bench to leave the break loop and go on\n', 'tty-bench');
        sess.type('GO ', function () { if (playing) playNext(); });
        return;
      }
      paintRow(cur.e);
    }
    if (cur) { played++; limit--; }
    if (cur && limit <= 0) {
      playing = false; var done = cur.n; cur = null;
      if (replaying) { replaying = false; if (sess) sess.animate = armSpeed > 0; }
      status('Exchange ' + done + ' played' + (queue.length ? '  ·  » for exchange ' + queue[0].n + ', ▶ Play for the rest, « back one' : '  ·  the dialogue is played'));
      return;
    }
    if (!playing || !queue.length || !sess || sess.state !== 'waiting') { playing = false; cur = null; status(stateText(sess ? sess.state : '') + (queue.length ? '' : '  ·  the dialogue is played')); return; }
    cur = queue.shift();
    send(cur.text);
  }
  function verdict(e) {
    var r = results[e.n]; if (!r) return null;
    var want = norm(e.turns.filter(function (t) { return t.who === 'shrdlu'; }).map(function (t) { return t.text; }).join(' '));
    var got = norm(r.out);
    if (r.breaks.length) return 'break';
    if (!got) return 'none';
    return got === want ? 'same' : got.indexOf(want) >= 0 || want.indexOf(got) >= 0 ? 'part' : 'differs';
  }
  var VERDICT = { same: ['=', 'The same words as 1970'], part: ['≈', 'Part of the 1970 answer, or more than it'], differs: ['≠', 'A different answer'], break: ['⊘', 'SHRDLU stopped in its break loop'], none: ['·', 'No answer'] };
  function rowHTML(e) {
    var person = e.turns.filter(function (t) { return t.who === 'person'; }).map(function (t) { return t.text.toLowerCase(); }).join('\n');
    var reply = e.turns.filter(function (t) { return t.who === 'shrdlu'; }).map(function (t) { return t.text; }).join('\n');
    var r = results[e.n], vd = verdict(e);
    var got = r ? (r.breaks.length ? r.breaks.map(function (b) { return '⊘ ' + b; }).join('\n') + '\n' : '') + r.out.replace(/>>>\s*/g, '').replace(/\bREADY\b\s*/g, '').replace(/\n{2,}/g, '\n').trim() : '';
    return '<tr data-n="' + e.n + '"><td class="num"><a href="../dialogue.html#x' + e.n + '" target="_blank" rel="noopener" title="This exchange on the dialogue page">' + e.n + '</a></td>' +
      '<td class="run-person">' + SW.esc(person).replace(/\n/g, '<br>') + '</td><td class="run-shrdlu">' + SW.esc(reply).replace(/\n/g, '<br>') + '</td>' +
      '<td class="run-got">' + SW.esc(got).replace(/\n/g, '<br>') + '</td><td class="run-vd vd-' + (vd || 'no') + '" title="' + (vd ? VERDICT[vd][1] : 'Not yet run') + '">' + (vd ? VERDICT[vd][0] : '') + '</td></tr>';
  }
  function paintRow(e) {
    var tr = SW.$('.run-test tr[data-n="' + e.n + '"]', view);
    if (tr) { tr.outerHTML = rowHTML(e); var t2 = SW.$('.run-test tr[data-n="' + e.n + '"]', view); var dl = SW.$('#run-dlg', view); if (t2 && dl && dl.open) t2.scrollIntoView({ block: 'nearest' }); }
    paintTally();
  }
  function paintTally() {
    var el = SW.$('#run-tally', view) || document.createElement('span'); if (!dialogue) return;
    loadDialogue().then(function (ex) {
      var c = { same: 0, part: 0, differs: 0, break: 0, none: 0 }, n = 0;
      ex.forEach(function (e) { var vd = verdict(e); if (vd) { c[vd]++; n++; } });
      var bn = SW.$('#run-tally-n', view); if (bn) bn.textContent = n ? n + '/' + ex.length : '';
      el.textContent = n ? n + ' of ' + ex.length + ' exchanges run: ' + c.same + ' the same as 1970, ' + c.part + ' partly, ' + c.differs + ' different, ' + c['break'] + ' stopped in the break loop.' : '';
    });
  }

  function paintSide() {
    var body = SW.$('#run-side-body', view); if (!body) return;
    var tt = SW.$('#run-dlg-t', view); if (tt) tt.textContent = side === 'about' ? 'About running' : 'The dialogue test: the 1970 dialogue, and what this run answers';
    var v = V.byId(vid);
    if (side === 'about') {
      body.innerHTML = '<div class="prose run-about"><p>This is SHRDLU itself, running in your browser: the files of <b>' + SW.esc(v.label) + '</b>, read and loaded by the program’s own loader, on a MacLisp interpreter written for the bench. Nothing is scripted: each answer is computed by the 1970s code as you type.</p>' +
        '<p>Type English and press Return, as a user did at a teletype on ITS. SHRDLU reads upper and lower case alike. End a sentence with its full stop or question mark. If SHRDLU stops in its break loop (a line ending “&gt;&gt;&gt;”), it is asking its programmer for help; type <span class="mono">GO</span> to go on. Lisp typed there is evaluated, as it was for the lab’s programmers.</p>' +
        '<p>What survives is the system of 1972 to 1977, not the 1970 program that produced the demonstration dialogue; the test beside the teletype shows, exchange by exchange, where they agree. The DEC 340 display beside the teletype is drawn from the program’s own calls to MacLisp’s display slave (DISCREATE, DISALINE, DISLOCATE…): the scene as graphf projects it, and the arm as MOVETO moves it, pausing where the code says SLEEP. The restoration reads its opening scene from a saved display, GRAPHF INIT; the MIT copy draws it afresh with GP-INITIAL (repair I-F2). Switch the display off to run as a user did who was not near a 340.</p></div>';
      return;
    }
    body.innerHTML = '<p class="hint" id="run-tally"></p><div class="run-test-wrap"><table class="data run-test"><thead><tr><th class="num">No.</th><th>Person</th><th>SHRDLU, 1970</th><th>This run</th><th></th></tr></thead><tbody><tr><td colspan="5" class="hint">Reading the dialogue…</td></tr></tbody></table></div>';
    loadDialogue().then(function (ex) {
      var tb = SW.$('.run-test tbody', view); if (tb) tb.innerHTML = ex.map(rowHTML).join('');
      paintTally();
    });
  }

  function show() {
    if (SW.$('.run-wrap', view)) {
      if (sess && sess.v.id === vid) return;   // keep a running session when coming back
      SW.$('#run-lang', view).textContent = SW.langOf(V.byId(vid)); boot(); return;   // the top bar chose another version
    }
    view.innerHTML = '<div class="run-wrap">' +
      '<div class="toolbar run-bar">' +
      '<button class="btn" id="run-restart" title="Load the version afresh and start it">⟳ Restart</button>' +
      '<button class="btn" id="run-play" title="Type each of the person’s lines of the 1970 dialogue in turn, and record what this run answers">▶ Play the 1970 dialogue</button>' +
      '<button class="btn" id="run-back" title="Back one exchange: start the program afresh and replay the exchanges before, at full speed">«</button>' +
      '<button class="btn" id="run-step" title="Forward one exchange: type the next exchange of the 1970 dialogue, then wait">»</button>' +
      '<button class="btn ghost" id="run-stop" title="Stop: quit what SHRDLU is doing, as ^G did on ITS, and stop playing the dialogue">■ Stop</button>' +
      '<button class="btn" data-side="test" title="The 1970 dialogue, exchange by exchange, beside what this run answers">☷ Dialogue test <span class="badge" id="run-tally-n"></span></button>' +
      '<button class="btn" data-side="about" title="What is running, and how to type to it">ⓘ About…</button>' +
      '<span class="hint" id="run-status"></span><span class="vlang tb-right" id="run-lang"></span></div>' +
      '<div class="run-grid' + (SW.store.get('run.flip', false) ? ' flip' : '') + '"><div class="tty-col"><div class="tty"><button class="icon-btn tty-copy" id="tty-copy" title="Copy the whole transcript (or select text in the teletype and copy it as usual)">⧉</button><div class="tty-out" id="tty-out" aria-live="polite"><form class="tty-in" id="tty-form"><span class="tty-ghost" id="tty-ghost" aria-hidden="true"></span><input id="tty-input" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="type here, e.g. pick up a big red block.  (Tab completes)" aria-label="Type to SHRDLU"><div class="tty-sugg" id="tty-sugg"></div></form></div></div>' +
      '<details class="run-deep" id="run-deep"><summary><b>Deep dive</b> <span class="hint">the variables and structures SHRDLU keeps, read each time it waits; what changed is marked</span></summary><div id="run-deep-body"></div></details>' +
      '<details class="run-loadlog" id="run-loadlog"><summary class="hint">Load log</summary></details></div>' +
      '<div class="run-side"><div class="d340"><canvas id="d340" width="1024" height="1024" aria-label="The DEC 340 display: the blocks world as SHRDLU draws it"></canvas>' +
      '<div class="d340-bar"><span class="d340-name" title="The Type 340 Precision Incremental CRT display, on the AI Lab’s PDP-6 and PDP-10, driven through MacLisp’s display slave">DEC 340</span>' +
      '<label class="check" title="Answer Y to the display question, and draw what the program draws (restarts the run)"><input type="checkbox" id="run-disp"' + (dispOn ? ' checked' : '') + '> Display</label>' +
      '<label class="check" title="How fast the arm moves: Original pauses where graphf’s MOVETO says SLEEP (.06 seconds a step); ×2 and ×3 shorten the pauses; Instant leaves them out">Arm <select id="run-arm">' + [[1, 'Original'], [2, '×2'], [3, '×3'], [0, 'Instant']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === armSpeed ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check" title="Draw each object in the colour SHRDLU names it (the labels graphf writes: RED, GREEN, BLUE, WHITE; the table grey). The DEC 340 drew in one colour; untick for the screen as it was"><input type="checkbox" id="run-col"' + (colOn ? ' checked' : '') + '> Colour</label>' +
      '<label class="check" title="The names graphf writes by each object (RED, GREEN, BLUE, WHITE, BLACK: the last field of each entry in DISPLAY-AS). The surviving code of 1972–77 draws them; the 1970 film shows none"><input type="checkbox" id="run-lab"' + (labOn ? ' checked' : '') + '> Labels</label>' +
      '<label class="check" title="The last exchanges at the top of the screen, in capitals, as the 1970 film shows the conversation on the display. The surviving code writes only the objects’ names on the 340; this is the bench, after the film"><input type="checkbox" id="run-dlgon"' + (dlgOn ? ' checked' : '') + '> Dialogue</label>' +
      '<label class="check" title="Objects hide what stands behind them, painted back to front from graphf’s own tables of positions and sizes; what is in the box shows faintly through its walls. The 340 drew lines only, with the lines graphf found hidden left out; untick for the screen as it was"><input type="checkbox" id="run-solid"' + (solidOn ? ' checked' : '') + '> Solid</label>' +
      '<button class="btn ghost" id="run-flip" title="Put the display on the other side of the teletype">⇄</button>' +
      '<span id="run-dfig"></span>' +
      '<span class="hint" id="d340-note"></span></div></div>' +
      '</div></div>' +
      '<dialog class="tray-big run-dlg" id="run-dlg"><div class="tray-bighead"><b id="run-dlg-t"></b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div><div id="run-side-body"></div></dialog></div>';
    out = SW.$('#tty-out', view);
    SW.$('#run-lang', view).textContent = SW.langOf(V.byId(vid));
    SW.$('#run-restart', view).onclick = function () { boot(); };
    SW.$('#run-disp', view).onchange = function (e) { dispOn = e.target.checked; SW.store.set('run.display', dispOn); boot(); };
    var dd = SW.$('#run-deep', view);
    dd.addEventListener('toggle', function () { if (dd.open) paintDeep(false); });
    dd.addEventListener('submit', function (e) { e.preventDefault(); var i = e.target.querySelector('input'), n = i && i.value.trim().toUpperCase(); if (n && watch.indexOf(n) < 0) { watch.push(n); SW.store.set('run.watch', watch); } paintDeep(false); });
    dd.addEventListener('click', function (e) { var x = e.target.closest('[data-unwatch]'); if (!x) return; watch = watch.filter(function (w) { return w !== x.dataset.unwatch; }); SW.store.set('run.watch', watch); paintDeep(false); });
    SW.$('#run-flip', view).onclick = function () { var g = SW.$('.run-grid', view), on = !g.classList.contains('flip'); g.classList.toggle('flip', on); SW.store.set('run.flip', on); };
    SW.$('#run-solid', view).onchange = function (e) { solidOn = e.target.checked; SW.store.set('run.solid', solidOn); if (disp) { disp.solid = solidOn; disp.dirty(); } };
    SW.$('#run-dlgon', view).onchange = function (e) { dlgOn = e.target.checked; SW.store.set('run.dialogue', dlgOn); if (disp) { disp.dialogue = dlgOn; disp.dirty(); } };
    SW.$('#run-lab', view).onchange = function (e) { labOn = e.target.checked; SW.store.set('run.labels', labOn); if (disp) { disp.labels = labOn; disp.dirty(); } };
    SW.$('#run-col', view).onchange = function (e) { colOn = e.target.checked; SW.store.set('run.colour', colOn); if (disp) { disp.colour = colOn; disp.dirty(); } };
    SW.$('#run-arm', view).onchange = function (e) { armSpeed = +e.target.value; SW.store.set('run.arm', armSpeed); if (sess) { sess.animate = armSpeed > 0; sess.speed = armSpeed || 1; } };
    SW.$('#run-dfig', view).appendChild(SW.figureButtons(function () { return disp ? disp.toSVG() : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#05070a"/></svg>'; }, function () { return 'shrdlu-' + vid + '-340'; }, function () { return SW.refText(vid); }));
    SW.$('#run-play', view).onclick = function () { play(Infinity); };
    SW.$('#run-step', view).onclick = function () { play(1); };
    SW.$('#run-back', view).onclick = back;
    SW.$('#run-stop', view).onclick = function () {
      var busy = sess && sess.state === 'running';
      playing = false; limit = 0; replaying = false;
      if (cur) { queue.unshift(cur); cur = null; }   // the exchange cut short is played again by Play or Step
      if (!busy) { status('Stopped.' + (queue.length ? '  ·  ▶ Play or » go on from exchange ' + queue[0].n : '')); return; }
      ttyAppend('\n^G   ← typed by the bench: Stop quits to the top level, as ^G did on ITS\n', 'tty-bench');
      lastOut = '';
      sess.quit(function () { status('Stopped: SHRDLU is back at READY.' + (queue.length ? '  ·  ▶ Play or » go on from exchange ' + queue[0].n : '')); });
    };
    SW.$$('.run-bar [data-side]', view).forEach(function (b) { b.onclick = function () { side = b.dataset.side; paintSide(); var d = SW.$('#run-dlg', view); if (!d.open) d.showModal(); }; });
    SW.$('#run-dlg', view).addEventListener('click', function (e) { var d = SW.$('#run-dlg', view); if (e.target === d || e.target.closest('[data-x]')) d.close(); });
    var inp = SW.$('#tty-input', view);
    SW.$('#tty-form', view).onsubmit = function (e) { e.preventDefault(); if (send(inp.value)) inp.value = ''; };
    loadDialogue().then(function (ex) { sentences = []; ex.forEach(function (e) { e.turns.forEach(function (tn) { if (tn.who === 'person') sentences.push(tn.text.toLowerCase().replace(/\s+/g, ' ')); }); }); });
    inp.addEventListener('input', function () { taken = null; suggest(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && taken && inp.value === fill(taken.list[taken.i]) && taken.list.length > 1) {
        e.preventDefault();
        taken.i = (taken.i + (e.shiftKey ? taken.list.length - 1 : 1)) % taken.list.length;
        inp.value = fill(taken.list[taken.i]);
        SW.$('#tty-sugg', view).innerHTML = '<span class="hint">Tab</span> ' + taken.list.map(function (x, k) { return '<button type="button" class="tty-s' + (k === taken.i ? ' on' : '') + '">' + SW.esc(x.label) + '</button>'; }).join('');
        SW.$('#tty-ghost', view).innerHTML = '';
        return;
      }
      if (e.key === 'Tab' && sugg.length) {
        e.preventDefault();
        var g = SW.$('#tty-ghost', view);
        if (g.textContent && inp.value !== sugg[suggAt].full) takeSugg(suggAt);
        else { suggAt = (suggAt + (e.shiftKey ? sugg.length - 1 : 1)) % sugg.length; paintSugg(); }
        return;
      }
      if (e.key === 'Escape') { sugg = []; paintSugg(); }
    });
    SW.$('#tty-sugg', view).addEventListener('mousedown', function (e) { var b = e.target.closest('[data-s]'); if (b) { e.preventDefault(); takeSugg(+b.dataset.s); } });
    SW.$('#tty-form', view).addEventListener('submit', function () { sugg = []; setTimeout(paintSugg, 0); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hist.length) { hi = Math.min(hist.length - 1, hi + 1); inp.value = hist[hi]; e.preventDefault(); }
      if (e.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); inp.value = hi >= 0 ? hist[hi] : ''; e.preventDefault(); }
    });
    // a click puts the cursor in the input line, unless text is being selected to copy
    out.addEventListener('click', function () { var s = window.getSelection(); if (!s || s.isCollapsed || !out.contains(s.anchorNode)) inp.focus(); });
    SW.$('#tty-copy', view).onclick = function () {
      var txt = SW.$$('span', out).filter(function (s) { return !s.closest('#tty-form'); }).map(function (s) { return s.textContent; }).join('');
      SW.copyText(txt.replace(/\n{3,}/g, '\n\n').trim() + '\n', 'the transcript');
    };
    paintSide();
    boot();
  }

  // Run runs the version chosen in the top bar; one with no text to run leaves the last one running
  SW.views.run = { show: function (b) {
    var v = b && b.v;
    if (v && v.build) vid = v.id;
    show();
    if (v && !v.build) status(v.label + ' survives in no text the bench can run; still running ' + V.byId(vid).label + '.');
  }, hide: function () {} };
})(this);
