/*
 * deepdive.js - the Deep dive panel under Run's teletype: the variables and structures
 * SHRDLU keeps, read from the running interpreter each time the program stops to wait,
 * with what changed in the last exchange marked.
 *
 * Nothing here runs Lisp: values are read from the symbols' value cells and property
 * lists. MacLisp's interpreted variables are special (shallow-bound), so the variables
 * SHRDLU's top-level PROG binds (SENT, C, BACKREF...) hold the current exchange's values
 * while the program waits at READY.
 *
 * Where each comes from:
 *   SENTNO                   syscom (SHRDLU): the sentence's number; its words are read
 *                            from the parse, since ETAOIN empties SENT while it waits
 *   C                        syscom: the top node of the parse; a node is a list whose
 *                            first element carries the registers FEATURES, DAUGHTERS,
 *                            FIRSTWORD, WORDAFTER, SEMANTICS (progmr: GETR, FE, H, NB, N, SM)
 *   INTERPRETATION           syscom: (SM C), the semantic structures
 *   BACKREF, LASTREL         syscom, smutil: referents found, for "it" and "that"
 *   GLOBAL-MESSAGE           syscom: what SHRDLU says when it cannot go on
 *   P-TIME ... ANS-TIME      syscom (PARSEVAL, TIME-ANSWER): time in each stage, in the
 *                            bench's RUNTIME (interpreter steps), not 1970s seconds
 *   HANDAT, ATABLE           blockl, data: the hand's position, each object's place and size
 *   GRASPLIST, THTIME        blockp, data: what was held when, the event clock
 *   EVENTLIST                blockl (MEMORY, MEMOREND): events, each an atom with the
 *                            properties START, END, TYPE and WHY
 */
(function (root) {
  'use strict';
  var SW = root.SW, L = root.MacLisp;

  var GROUPS = [
    ['The sentence', [['SENTNO', 'the sentence’s number'], ['C', 'the words of the last sentence, as the parse holds them (FIRSTWORD of C); SENT itself is empty again while ETAOIN waits for the next', 'words']]],
    ['The parse', [['C', 'the parse, node by node: features, and the words each covers', 'tree']]],
    ['The meaning', [['INTERPRETATION', 'the semantic structures of the clause, (SM C)'], ['BACKREF', 'referents found in this sentence, for “it” and “that”'], ['LASTREL', 'the last relative, for “that”'], ['GLOBAL-MESSAGE', 'what SHRDLU says when it cannot go on']]],
    ['The world', [['HANDAT', 'where the hand is'], ['GRASPLIST', 'what the hand held, and from when (time, object)'], ['THTIME', 'the event clock'], ['ATABLE', 'each object: its place and size', 'atable']]],
    ['Memory', [['EVENTLIST', 'what SHRDLU did, event by event: its type, why, and when it began and ended', 'events']]],
    ['Time', [['P-TIME', 'parsing'], ['SMN-TIME', 'semantics'], ['PLNR-TIME', 'Micro-Planner, for semantics'], ['ANS-TIME', 'answering']]]
  ];

  function sym(m, name) { return m.obarray && m.obarray.get ? m.obarray.get(name) : null; }
  function valOf(m, name) { var s = sym(m, name); return s ? s.value : L.UNBOUND; }
  function show(m, v, max) {
    if (v === L.UNBOUND) return null;
    var t = m.prin1String(v); max = max || 600;
    return t.length > max ? t.slice(0, max) + ' …' : t;
  }
  function list(m, x) { var a = []; while (x instanceof L.Cons) { a.push(x.car); x = x.cdr; } return a; }
  function reg(m, node, r) { var s = sym(m, r); return node instanceof L.Cons && s ? m.get(node.car, s) : m.NIL; }

  // a node's words: from FIRSTWORD up to (not including) WORDAFTER
  function words(m, node) {
    var a = reg(m, node, 'FIRSTWORD'), z = reg(m, node, 'WORDAFTER'), out = [];
    while (a instanceof L.Cons && a !== z && out.length < 40) { out.push(m.princString(a.car)); a = a.cdr; }
    return out.join(' ');
  }
  function tree(m, node, depth, out) {
    if (!(node instanceof L.Cons) || depth > 12 || out.length > 200) return;
    var fe = list(m, reg(m, node, 'FEATURES')).map(function (f) { return m.princString(f); });
    out.push('<div class="dd-node" style="--dd:' + depth + '"><span class="dd-fe">' + SW.esc(fe.join(' ') || '(node)') + '</span> <span class="dd-w">' + SW.esc(words(m, node)) + '</span></div>');
    // DAUGHTERS: a node is a tail of the list of nodes (GETR takes its CAR), kept last first
    var ds = [], x = reg(m, node, 'DAUGHTERS');
    while (x instanceof L.Cons && ds.length < 60) { ds.push(x); x = x.cdr; }
    ds.reverse().forEach(function (d) { tree(m, d, depth + 1, out); });
  }
  function atable(m, v) {
    var rows = list(m, v).map(function (e) { var a = list(m, e); return '<tr><td class="mono">' + SW.esc(m.princString(a[0])) + '</td><td class="mono">' + SW.esc(m.prin1String(a[1])) + '</td><td class="mono">' + SW.esc(m.prin1String(a[2])) + '</td></tr>'; });
    return rows.length ? '<table class="dd-t"><thead><tr><th>Object</th><th>Place (x y z)</th><th>Size</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '';
  }
  function events(m, v) {
    var P = function (ev, p) { var s = sym(m, p); return s ? m.get(ev, s) : m.NIL; };
    var evs = list(m, v).filter(function (e) { return e instanceof L.Sym && e.name !== 'EE'; });
    var rows = evs.slice(0, 30).map(function (ev) {
      return '<tr><td class="mono">' + SW.esc(ev.name) + '</td><td class="mono">' + SW.esc(m.princString(P(ev, 'TYPE'))) + '</td><td class="mono">' + SW.esc(m.princString(P(ev, 'WHY'))) + '</td><td class="num">' + SW.esc(m.princString(P(ev, 'START'))) + '</td><td class="num">' + SW.esc(m.princString(P(ev, 'END'))) + '</td></tr>';
    });
    return rows.length ? '<table class="dd-t"><thead><tr><th>Event</th><th>Type</th><th>Why</th><th>Start</th><th>End</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' + (evs.length > 30 ? '<p class="hint">' + (evs.length - 30) + ' earlier events not shown.</p>' : '') : '<p class="hint">No events yet.</p>';
  }

  // Render into el; prev holds the last values shown, to mark what changed
  function render(el, m, prev, watch) {
    if (!m) { el.innerHTML = '<p class="hint">Start the program to see its variables.</p>'; return prev; }
    var next = {}, h = [];
    var groups = GROUPS.concat(watch && watch.length ? [['Watched', watch.map(function (w) { return [w, 'added by you']; })]] : []);
    groups.forEach(function (g) {
      h.push('<div class="dd-g"><h4>' + SW.esc(g[0]) + '</h4>');
      g[1].forEach(function (r) {
        var name = r[0], key = name + (r[2] ? ':' + r[2] : ''), v = valOf(m, name), txt = show(m, v, 4000), changed = prev && prev[key] !== undefined && prev[key] !== txt;
        next[key] = txt;
        var body;
        if (txt === null) body = '<span class="faint">unbound</span>';
        else if (r[2] === 'tree') { var out = []; tree(m, v, 0, out); body = out.length ? '<div class="dd-tree">' + out.join('') + '</div>' : '<span class="mono">' + SW.esc(show(m, v)) + '</span>'; }
        else if (r[2] === 'words') body = '<span class="mono dd-v">' + SW.esc(words(m, v)) + '</span>';
        else if (r[2] === 'atable') body = atable(m, v);
        else if (r[2] === 'events') body = events(m, v);
        else body = '<span class="mono dd-v">' + SW.esc(show(m, v)) + '</span>';
        h.push('<div class="dd-row' + (changed ? ' dd-ch' : '') + '"><div class="dd-name"><span class="mono">' + SW.esc(name) + '</span>' + (changed ? ' <span class="dd-mark" title="Changed in the last exchange">changed</span>' : '') + (r[3] !== false && watch && watch.indexOf(name) >= 0 ? ' <button class="dd-x" data-unwatch="' + SW.esc(name) + '" title="Stop watching">✕</button>' : '') + '<div class="hint">' + SW.esc(r[1]) + '</div></div><div class="dd-val">' + body + '</div></div>');
      });
      h.push('</div>');
    });
    h.push('<form class="dd-add"><input placeholder="Watch another variable, e.g. LASTSENT" aria-label="A variable to watch" spellcheck="false"><button class="btn">Watch</button></form>');
    el.innerHTML = h.join('');
    return next;
  }

  SW.deepDive = { render: render, GROUPS: GROUPS };
})(this);
