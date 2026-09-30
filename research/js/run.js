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
  var sess = null, vid = SW.store.get('run.v', 'ejs'), dialogue = null, playing = false, results = {}, lastOut = '', side = SW.store.get('run.side', 'test');
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
  function ttyAppend(text, cls) {
    if (!out) return;
    var last = out.lastElementChild;
    if (!cls && last && last.classList.contains('tty-sh')) last.textContent += text;
    else out.appendChild(SW.el('span', { class: cls || 'tty-sh' }, SW.esc(text)));
    out.scrollTop = out.scrollHeight;
  }
  function onOut(t) {
    if (sess && sess.state === 'loading') { loadLog += t; return; }
    // the bench's own answers to start-up questions arrive marked \u0001...\u0002
    t.split(/(\u0001[^\u0002]*\u0002)/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '\u0001') { ttyAppend(part.slice(1, -1).trim() + '   ← typed by the bench (see the reconstruction card)\n', 'tty-bench'); return; }
      lastOut += part;
      ttyAppend(part);
    });
  }
  function status(t) { var s = SW.$('#run-status', view); if (s) s.textContent = t; }
  function stateText(st) {
    return { loading: 'Loading the files through the program’s own loader…', running: 'Running…', waiting: 'Waiting for you to type.', halted: 'Stopped on an error (see the teletype).', done: 'The program has returned.' }[st] || st;
  }

  // ---------- the DEC 340 display (js/display.js) ----------
  var dispOn = SW.store.get('run.display', true), animOn = SW.store.get('run.anim', true), colOn = SW.store.get('run.colour', false), disp = null;
  function hasDisplayCode(v) { return v.build.some(function (b) { return /graphf/.test(b.src); }); }
  function paintDispBar() {
    var v = V.byId(vid), has = hasDisplayCode(v), cap = SW.$('#d340-note', view), wrap = SW.$('.d340', view);
    if (!wrap) return;
    wrap.classList.toggle('off', !(dispOn && has));
    SW.$('#run-disp', view).disabled = !has;
    SW.$('#run-anim', view).disabled = !(dispOn && has);
    SW.$('#run-col', view).disabled = !(dispOn && has);
    cap.textContent = !has ? 'This copy holds no display code (graphf); the arm moves without being drawn (S-L2).' : dispOn ? '' : 'Off: the program is told there is no DEC 340.';
  }

  function boot() {
    var v = V.byId(vid);
    playing = false; results = {}; lastOut = ''; loadLog = '';
    if (out) out.innerHTML = '';
    paintSide();
    status('Fetching the files of ' + v.label + '…');
    // the version's files, and any other copy its repairs read from
    var srcs = v.build.map(function (b) { return b.src; });
    SHRepairs.forVersion(vid).forEach(function (r) { if (r.from) srcs.push(r.from.src); });
    var texts = {};
    Promise.all(srcs.map(function (s) { return SW.fetchText(s).then(function (t) { texts[s] = t; }); })).then(function () {
      var t0 = performance.now();
      var cv = SW.$('#d340', view);
      disp = dispOn && hasDisplayCode(v) && root.SH340 ? new root.SH340({ canvas: cv, colour: colOn }) : null;
      if (!disp && cv) { var g = cv.getContext('2d'); g.fillStyle = getComputedStyle(cv).getPropertyValue('--crt').trim() || '#05070a'; g.fillRect(0, 0, cv.width, cv.height); }
      paintDispBar();
      sess = new root.SHSession({ version: v, texts: texts, out: onOut, display: disp, animate: animOn, onState: function (st) { status(stateText(st) + (sess ? '  ·  ' + sess.m.steps.toLocaleString('en-GB') + ' steps' : '')); } });
      sess.boot(function (r) {
        var ms = Math.round(performance.now() - t0);
        ttyAppend('', 'tty-sh');
        SW.$('#run-loadlog', view).innerHTML = '<summary class="hint">Load log: ' + (sess.loadedSteps || 0).toLocaleString('en-GB') + ' steps, ' + ms + ' ms</summary><pre class="mono">' + SW.esc(loadLog) + '</pre>';
        status(stateText(sess.state) + '  ·  loaded and started in ' + ms + ' ms');
        var inp = SW.$('#tty-input', view); if (inp) inp.focus();
        void r;
      });
    }).catch(function (e) { status(e.message); });
  }

  var hist = SW.store.get('run.hist', []), hi = -1;
  function send(line) {
    if (!sess || sess.state !== 'waiting') { SW.toast(sess ? 'SHRDLU is busy; wait for it to finish.' : 'Start it first.'); return false; }
    ttyAppend(line + '\n', 'tty-you');
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
  function play() {
    loadDialogue().then(function (ex) {
      if (!sess || sess.state !== 'waiting') { SW.toast('Start the program first, and wait for READY.'); return; }
      queue = [];
      ex.forEach(function (e) { e.turns.forEach(function (t) { if (t.who === 'person') queue.push({ n: e.n, text: t.text.toLowerCase(), e: e }); }); });
      results = {}; playing = true; side = 'test'; paintSide();
      playNext();
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
    if (tr) { tr.outerHTML = rowHTML(e); var t2 = SW.$('.run-test tr[data-n="' + e.n + '"]', view); if (t2) t2.scrollIntoView({ block: 'nearest' }); }
    paintTally();
  }
  function paintTally() {
    var el = SW.$('#run-tally', view); if (!el || !dialogue) return;
    loadDialogue().then(function (ex) {
      var c = { same: 0, part: 0, differs: 0, break: 0, none: 0 }, n = 0;
      ex.forEach(function (e) { var vd = verdict(e); if (vd) { c[vd]++; n++; } });
      el.textContent = n ? n + ' of ' + ex.length + ' exchanges run: ' + c.same + ' the same as 1970, ' + c.part + ' partly, ' + c.differs + ' different, ' + c['break'] + ' stopped in the break loop.' : '';
    });
  }

  function paintSide() {
    var body = SW.$('#run-side-body', view); if (!body) return;
    SW.$$('.run-tabs button', view).forEach(function (b) { b.classList.toggle('on', b.dataset.side === side); });
    var v = V.byId(vid);
    if (side === 'card') { body.innerHTML = '<div class="card-bar">' + SW.cardBar() + '</div>' + SW.reconstructionCard(v); return; }
    if (side === 'about') {
      body.innerHTML = '<div class="prose run-about"><p>This is SHRDLU itself, running in your browser: the files of <b>' + SW.esc(v.label) + '</b>, read and loaded by the program’s own loader, on a MacLisp interpreter written for the bench. Nothing is scripted: each answer is computed by the 1970s code as you type.</p>' +
        '<p>Type English and press Return, as a user did at a teletype on ITS. SHRDLU reads upper and lower case alike. End a sentence with its full stop or question mark. If SHRDLU stops in its break loop (a line ending “&gt;&gt;&gt;”), it is asking its programmer for help; type <span class="mono">GO</span> to go on. Lisp typed there is evaluated, as it was for the lab’s programmers.</p>' +
        '<p>What survives is the system of 1972 to 1977, not the 1970 program that produced the demonstration dialogue; the test beside the teletype shows, exchange by exchange, where they agree. The DEC 340 display above the tabs is drawn from the program’s own calls to MacLisp’s display slave (DISCREATE, DISALINE, DISLOCATE…): the scene as graphf projects it, and the arm as MOVETO moves it, pausing where the code says SLEEP. The restoration reads its opening scene from a saved display, GRAPHF INIT; the MIT copy draws it afresh with GP-INITIAL (repair I-F2). Switch the display off to run as a user did who was not near a 340.</p></div>';
      return;
    }
    body.innerHTML = '<p class="hint" id="run-tally"></p><div class="run-test-wrap"><table class="data run-test"><thead><tr><th class="num">No.</th><th>Person</th><th>SHRDLU, 1970</th><th>This run</th><th></th></tr></thead><tbody><tr><td colspan="5" class="hint">Reading the dialogue…</td></tr></tbody></table></div>';
    loadDialogue().then(function (ex) {
      var tb = SW.$('.run-test tbody', view); if (tb) tb.innerHTML = ex.map(rowHTML).join('');
      paintTally();
    });
  }

  function show() {
    if (SW.$('.run-wrap', view) && sess && sess.v.id === vid) return;   // keep a running session when coming back
    view.innerHTML = '<div class="run-wrap">' +
      '<div class="toolbar run-bar"><label class="check">Version <select id="run-v">' + runnable().map(function (v) { return '<option value="' + v.id + '"' + (v.id === vid ? ' selected' : '') + '>' + SW.esc(SW.refOf(v.id) + '  ' + v.label) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" id="run-restart" title="Load the version afresh and start it">⟳ Restart</button>' +
      '<button class="btn" id="run-play" title="Type each of the person’s lines of the 1970 dialogue in turn, and record what this run answers">▶ Play the 1970 dialogue</button>' +
      '<button class="btn ghost" id="run-stop" title="Stop playing the dialogue after the current exchange">■ Stop</button>' +
      '<span class="hint" id="run-status"></span><span class="vlang tb-right" id="run-lang"></span></div>' +
      '<div class="run-grid"><div class="tty-col"><div class="tty"><div class="tty-out" id="tty-out" aria-live="polite"></div>' +
      '<form class="tty-in" id="tty-form"><span class="tty-prompt">▸</span><input id="tty-input" autocomplete="off" spellcheck="false" placeholder="type a sentence, e.g. pick up a big red block." aria-label="Type to SHRDLU"></form></div>' +
      '<details class="run-loadlog" id="run-loadlog"><summary class="hint">Load log</summary></details></div>' +
      '<div class="run-side"><div class="d340"><canvas id="d340" width="1024" height="1024" aria-label="The DEC 340 display: the blocks world as SHRDLU draws it"></canvas>' +
      '<div class="d340-bar"><span class="d340-name" title="The Type 340 Precision Incremental CRT display, on the AI Lab’s PDP-6 and PDP-10, driven through MacLisp’s display slave">DEC 340</span>' +
      '<label class="check" title="Answer Y to the display question, and draw what the program draws (restarts the run)"><input type="checkbox" id="run-disp"' + (dispOn ? ' checked' : '') + '> Display</label>' +
      '<label class="check" title="Pause where the program says SLEEP, so the arm is seen to move; untick to run at full speed"><input type="checkbox" id="run-anim"' + (animOn ? ' checked' : '') + '> Arm moves in time</label>' +
      '<label class="check" title="Draw each object in the colour SHRDLU names it (the labels graphf writes: RED, GREEN, BLUE, WHITE; the table grey). The DEC 340 drew in one colour; untick for the screen as it was"><input type="checkbox" id="run-col"' + (colOn ? ' checked' : '') + '> Colour</label>' +
      '<span id="run-dfig"></span>' +
      '<span class="hint" id="d340-note"></span></div></div>' +
      '<div class="seg-btns run-tabs"><button class="btn" data-side="test">The dialogue test</button><button class="btn" data-side="card">Reconstruction card</button><button class="btn" data-side="about">About running</button></div><div id="run-side-body"></div></div></div></div>';
    out = SW.$('#tty-out', view);
    SW.$('#run-lang', view).textContent = SW.langOf(V.byId(vid));
    SW.$('#run-v', view).onchange = function (e) { vid = e.target.value; SW.store.set('run.v', vid); SW.$('#run-lang', view).textContent = SW.langOf(V.byId(vid)); boot(); };
    SW.$('#run-restart', view).onclick = boot;
    SW.$('#run-disp', view).onchange = function (e) { dispOn = e.target.checked; SW.store.set('run.display', dispOn); boot(); };
    SW.$('#run-col', view).onchange = function (e) { colOn = e.target.checked; SW.store.set('run.colour', colOn); if (disp) { disp.colour = colOn; disp.dirty(); } };
    SW.$('#run-anim', view).onchange = function (e) { animOn = e.target.checked; SW.store.set('run.anim', animOn); if (sess) sess.animate = animOn; };
    SW.$('#run-dfig', view).appendChild(SW.figureButtons(function () { return disp ? disp.toSVG() : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#05070a"/></svg>'; }, function () { return 'shrdlu-' + vid + '-340'; }, function () { return SW.refText(vid); }));
    SW.$('#run-play', view).onclick = play;
    SW.$('#run-stop', view).onclick = function () { playing = false; queue = []; status('Stopped after this exchange.'); };
    SW.$('#run-side-body', view).addEventListener('click', function (e) { var c = e.target.closest('[data-cx]'); if (!c) return; var m = c.closest('details'); if (m) m.open = false; SW.cardAct(c.dataset.cx, vid); });
    SW.$('.run-tabs', view).addEventListener('click', function (e) { var b = e.target.closest('[data-side]'); if (b) { side = b.dataset.side; SW.store.set('run.side', side); paintSide(); } });
    var inp = SW.$('#tty-input', view);
    SW.$('#tty-form', view).onsubmit = function (e) { e.preventDefault(); if (send(inp.value)) inp.value = ''; };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hist.length) { hi = Math.min(hist.length - 1, hi + 1); inp.value = hist[hi]; e.preventDefault(); }
      if (e.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); inp.value = hi >= 0 ? hist[hi] : ''; e.preventDefault(); }
    });
    out.addEventListener('click', function () { inp.focus(); });
    paintSide();
    boot();
  }

  SW.views.run = { show: function (b) { if (b && b.v && b.v.build && !SW.$('.run-wrap', view)) vid = SW.store.get('run.v', b.v.id); show(); }, hide: function () {} };
})(this);
