/*
 * display.js - the DEC 340 display, as SHRDLU's display code (graphf) drove it
 * through MacLisp's display slave: the DIS* functions of the SLAVE library
 * (MACLISP; SLAVE, 1976 NEWIO version, in PDP-10/its src/l/slave.11), which
 * passed each call to a slave program on the PDP-6 that kept the display list.
 *
 * The slave's program is not held, so what each call does is read from its
 * callers: graphf (SHRDLU), graphf.init (a saved display, in Swenson's
 * restoration) and TURTLE (the Logo turtle, src/lisp/turtle.468).
 *   items     each DISCREATE makes an item with an origin; its lines are kept
 *             relative to the origin, so DISLOCATE moves the whole item.
 *             Items are numbered from 1: graphf.init creates ten items, then
 *             sets up items 11 and 12 octal (9 and 10), the hand and the arm.
 *   pen       -1 draws, 1 moves without drawing (TURTLE: PENDOWN is
 *             (DISET :PICTURE -1), PENUP (DISET :PICTURE 1)); kept per item,
 *             and set by the optional argument of DISALINE.
 *   ASTATE    DISINI n sets how coordinates are read and returns the old
 *             state: 0 relative to the item's origin (TURTLE), 1 absolute on
 *             the screen (graphf: DISINI 1), 2 relative to the pen (inferred),
 *             3 polar, a length and a heading in degrees (TURTLE: DISINI 3).
 *   links     DISLINK a b T carries item b with a when a is moved (the block
 *             held in the hand); NIL undoes it.
 *   screen    1024 by 1024 points, 0 to 1777 octal, the origin at the bottom
 *             left (the arm is drawn up to 1730 or 2000).
 * SLEEP (in MOVETO, between steps of the arm) pauses the interpreter, so the
 * arm's motion is seen.
 */
(function (root) {
  'use strict';
  var L = root.MacLisp || (typeof require === 'function' ? require('./maclisp.js') : null);

  // Colour (an option; the 340 drew in one colour): each item in the colour its own label
  // names, the label graphf writes by each object with DISCUSS (RED, GREEN, BLUE, WHITE;
  // BLACK, the table, drawn grey so that it shows)
  var COLOURS = { RED: '#ff5a4e', GREEN: '#4fdc6a', BLUE: '#5aa2ff', WHITE: '#f2f2f2', BLACK: '#8a909a' };
  function itemColour(it, beam) {
    for (var i = 0; i < it.texts.length; i++) { var c = COLOURS[String(it.texts[i][2]).trim().toUpperCase()]; if (c) return c; }
    return beam;
  }

  function Display(o) {
    o = o || {};
    this.colour = !!o.colour;
    this.canvas = o.canvas || null;
    this.onChange = o.onChange || null;
    this.reset();
  }
  var D = Display.prototype;

  D.reset = function () { this.items = {}; this.order = []; this.next = 1; this.astate = 0; this.calls = 0; this.dirty(); };
  D.dirty = function () {
    var d = this;
    if (d.pending) return;
    d.pending = true;
    var go = function () { d.pending = false; d.draw(); if (d.onChange) d.onChange(d); };
    if (typeof requestAnimationFrame === 'function' && d.canvas) requestAnimationFrame(go); else go();
  };

  function num(x) { return typeof x === 'number' ? x : x && typeof x.v === 'number' ? x.v : 0; }
  function isNil(x, m) { return x === m.NIL || x == null; }
  D.item = function (a, m) { var it = this.items[num(a)]; if (!it) throw new L.LispError('NO SUCH DISPLAY ITEM', a); return it; };
  // optional arguments after the required ones: a fixnum is the pen, a list the
  // brightness and scale (BSL), as the slave's PPBSL reads them
  D.opts = function (it, rest, m) {
    rest.forEach(function (x) {
      if (isNil(x, m)) return;
      if (x instanceof L.Cons) { it.bright = num(x.car); return; }
      var p = num(x); if (p) it.pen = p < 0 ? -1 : 1;
    });
  };
  // where (x y) puts the pen, under the current ASTATE
  D.target = function (it, x, y) {
    switch (this.astate) {
      case 0: return [it.ox + num(x), it.oy + num(y)];
      case 2: return [it.px + num(x), it.py + num(y)];
      case 3: var r = num(x), h = num(y) * Math.PI / 180; return [it.px + r * Math.cos(h), it.py + r * Math.sin(h)];
      default: return [num(x), num(y)];
    }
  };
  D.make = function (x, y) {
    var id = this.next++, it = { id: id, ox: x, oy: y, px: x, py: y, pen: -1, bright: 8, segs: [], pts: [], texts: [], visible: true, blink: false, links: [] };
    this.items[id] = it; this.order.push(id);
    return it;
  };
  D.move = function (it, dx, dy, seen) {
    seen = seen || {};
    if (seen[it.id]) return; seen[it.id] = true;
    it.ox += dx; it.oy += dy; it.px += dx; it.py += dy;
    var d = this;
    it.links.forEach(function (id) { var c = d.items[id]; if (c) d.move(c, dx, dy, seen); });
  };
  D.flush = function (id) {
    delete this.items[id];
    this.order = this.order.filter(function (x) { return x !== id; });
    var d = this;
    Object.keys(d.items).forEach(function (k) { d.items[k].links = d.items[k].links.filter(function (x) { return x !== id; }); });
  };

  // ---------- the DIS* calls: each takes its arguments as a list and the machine ----------
  D.DISINI = function (a, m) {
    this.calls++;
    if (!a.length) { this.reset(); return this.astate; }
    var old = this.astate, n = num(a[0]);
    if (n >= 0 && n <= 3) this.astate = n;
    return old;
  };
  D.DISCREATE = function (a, m) {
    this.calls++;
    var it = this.make(a.length ? num(a[0]) : 0, a.length > 1 ? num(a[1]) : 0);
    this.dirty();
    return it.id;
  };
  D.DISALINE = function (a, m) {
    this.calls++;
    var it = this.item(a[0], m);
    this.opts(it, a.slice(3), m);
    var t = this.target(it, a[1], a[2]);
    if (it.pen < 0) it.segs.push([it.px - it.ox, it.py - it.oy, t[0] - it.ox, t[1] - it.oy]);
    it.px = t[0]; it.py = t[1];
    this.dirty();
    return m.NIL;
  };
  D.DISAPOINT = function (a, m) {
    this.calls++;
    var it = this.item(a[0], m);
    this.opts(it, a.slice(3), m);
    var t = this.target(it, a[1], a[2]);
    it.pts.push([t[0] - it.ox, t[1] - it.oy]);
    it.px = t[0]; it.py = t[1];
    this.dirty();
    return m.NIL;
  };
  D.DISCUSS = function (a, m) {
    this.calls++;
    var it = this.item(a[0], m);
    this.opts(it, a.slice(4), m);
    var t = this.target(it, a[1], a[2]);
    it.texts.push([t[0] - it.ox, t[1] - it.oy, m.princString(a[3])]);
    this.dirty();
    return m.NIL;
  };
  D.DISLOCATE = function (a, m) {
    this.calls++;
    var it = this.item(a[0], m);
    this.move(it, num(a[1]) - it.ox, num(a[2]) - it.oy);
    this.dirty();
    return m.NIL;
  };
  D.DISET = function (a, m) {
    this.calls++;
    var it = this.item(a[0], m);
    this.opts(it, a.slice(1), m);
    return m.NIL;
  };
  D.DISPLAY = function (a, m) {
    this.calls++;
    this.item(a[0], m).visible = !isNil(a[1], m);
    this.dirty();
    return m.NIL;
  };
  D.DISBLINK = function (a, m) { this.calls++; this.item(a[0], m).blink = !isNil(a[1], m); this.dirty(); return m.NIL; };
  D.DISLINK = function (a, m) {
    this.calls++;
    var p = this.item(a[0], m), c = num(a[1]);
    p.links = p.links.filter(function (x) { return x !== c; });
    if (!isNil(a[2], m)) p.links.push(c);
    return m.NIL;
  };
  D.DISFLUSH = function (a, m) {
    this.calls++;
    var d = this;
    if (!a.length) { d.items = {}; d.order = []; }
    else a.forEach(function (x) { d.flush(num(x)); });
    this.dirty();
    return m.NIL;
  };
  D.DISCHANGE = function (a, m) { this.calls++; var it = this.item(a[0], m); if (a.length > 1) it.bright = num(a[1]) || it.bright; this.dirty(); return m.NIL; };
  D.DISCOPY = function (a, m) {
    this.calls++;
    var s = this.item(a[0], m), it = this.make(s.ox, s.oy);
    it.px = s.px; it.py = s.py; it.pen = s.pen; it.bright = s.bright;
    it.segs = s.segs.map(function (x) { return x.slice(); }); it.pts = s.pts.map(function (x) { return x.slice(); }); it.texts = s.texts.map(function (x) { return x.slice(); });
    this.dirty();
    return it.id;
  };
  D.DISLIST = function (a, m) { this.calls++; return m.list.apply(m, this.order.slice()); };
  D.DISCRIBE = function (a, m) { this.calls++; var it = this.item(a[0], m); return m.list(Math.round(it.ox), Math.round(it.oy), Math.round(it.px), Math.round(it.py), it.pen); };
  D.DISMARK = function (a, m) { this.calls++; return m.NIL; };
  D.DISMOTION = function (a, m) { this.calls++; return m.NIL; };
  D.DISGORGE = function (a, m) { this.calls++; return m.NIL; };
  D.DISAD = D.DISPOINT = function (a, m) { this.calls++; return m.NIL; };

  // ---------- drawing ----------
  D.lines = function () {   // every visible line on the screen, in screen points
    var out = [], d = this;
    d.order.forEach(function (id) {
      var it = d.items[id]; if (!it || !it.visible) return;
      it.segs.forEach(function (s) { out.push([it.ox + s[0], it.oy + s[1], it.ox + s[2], it.oy + s[3], it]); });
    });
    return out;
  };
  D.draw = function () {
    var cv = this.canvas; if (!cv || !cv.getContext) return;
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / 1024, d = this;
    var css = typeof getComputedStyle === 'function' ? getComputedStyle(cv) : null;
    var beam = (css && css.getPropertyValue('--p7').trim()) || '#cfe8ff';
    g.fillStyle = (css && css.getPropertyValue('--crt').trim()) || '#05070a';
    g.fillRect(0, 0, W, H);
    g.lineCap = 'round';
    g.strokeStyle = beam; g.fillStyle = beam;
    g.shadowColor = beam; g.shadowBlur = 6 * k * 2;
    g.lineWidth = Math.max(1, 1.6 * k);
    var now = Date.now();
    d.order.forEach(function (id) {
      var it = d.items[id]; if (!it || !it.visible) return;
      if (it.blink && Math.floor(now / 400) % 2) return;
      g.globalAlpha = Math.max(0.35, Math.min(1, it.bright / 8));
      var col = d.colour ? itemColour(it, beam) : beam;
      g.strokeStyle = g.fillStyle = g.shadowColor = col;
      g.beginPath();
      it.segs.forEach(function (s) {
        g.moveTo((it.ox + s[0]) * k, H - (it.oy + s[1]) * k);
        g.lineTo((it.ox + s[2]) * k, H - (it.oy + s[3]) * k);
      });
      g.stroke();
      it.pts.forEach(function (p) { g.fillRect((it.ox + p[0]) * k - k, H - (it.oy + p[1]) * k - k, 2 * k + 1, 2 * k + 1); });
      g.font = Math.round(14 * k * 1.4) + 'px ui-monospace, Menlo, monospace';
      it.texts.forEach(function (t) { g.fillText(t[2], (it.ox + t[0]) * k, H - (it.oy + t[1]) * k - 4 * k); });
    });
    g.globalAlpha = 1; g.shadowBlur = 0;
  };
  // the screen as SVG, for figures and for checks without a canvas
  D.toSVG = function () {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#05070a"/><g stroke="#cfe8ff" stroke-width="1.6" stroke-linecap="round" fill="none">'], d = this;
    d.lines().forEach(function (l) { o.push('<line x1="' + l[0].toFixed(1) + '" y1="' + (1024 - l[1]).toFixed(1) + '" x2="' + l[2].toFixed(1) + '" y2="' + (1024 - l[3]).toFixed(1) + '"' + (d.colour ? ' stroke="' + itemColour(l[4], '#cfe8ff') + '"' : '') + '/>'); });
    o.push('</g><g fill="#cfe8ff" font-family="monospace" font-size="20">');
    d.order.forEach(function (id) { var it = d.items[id]; if (it && it.visible) it.texts.forEach(function (t) { o.push('<text' + (d.colour ? ' fill="' + itemColour(it, '#cfe8ff') + '"' : '') + ' x="' + (it.ox + t[0]).toFixed(1) + '" y="' + (1024 - it.oy - t[1] - 4).toFixed(1) + '">' + String(t[2]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'); }); });
    o.push('</g></svg>');
    return o.join('');
  };

  Display.COLOURS = COLOURS;
  root.SH340 = Display;
  if (typeof module !== 'undefined' && module.exports) module.exports = Display;
})(this);
