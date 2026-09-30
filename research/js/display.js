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

  // Solid (an option): objects hide what lies behind them. The 340 showed lines only, and
  // graphf takes out the lines hidden when it draws an object (GP-OPAQUE) but does not redraw
  // what a moved object comes to stand in front of. Here each object's outline is taken from
  // graphf's own tables (GP-SURFACE: name, faces, location, hiders, item, handle, size; the
  // shape from DISPLAY-AS), projected as GP-PROJECT projects, and the objects are painted back
  // to front along the projection's line of sight (-0.75111, 1, -0.43302), each filling its
  // outline in the screen's colour before its lines are drawn. A held object, the hand and the
  // arm are painted last; the box's front walls after the objects inside it.
  function proj(x, y, z) { return [0.9 * (x + 0.75111 * y + 3), 0.9 * (z + 0.43302 * y + 3)]; }
  function depth(x, y, z) { return -0.75111 * x + y - 0.43302 * z; }
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function lisp(x, m) {   // a Lisp value as plain data: lists as arrays, numbers, symbols by name
    if (x === m.NIL || x == null) return null;
    if (typeof x === 'number') return x;
    if (x instanceof L.Flo) return x.v;
    if (x instanceof L.Cons) { var a = []; while (x instanceof L.Cons) { a.push(lisp(x.car, m)); x = x.cdr; } return a; }
    return x.name != null ? x.name : null;
  }
  // the scene for painting: [{ item, poly (relative to the item's origin), depth, front }]
  function sceneOf(disp) {
    var m = disp.m; if (!m) return null;
    var val = function (n) { var s = m.obarray && m.obarray.get ? m.obarray.get(n) : null; s = s || m.intern(n); return s.value; };
    var surf = lisp(val('GP-SURFACE'), m), dis = lisp(val('DISPLAY-AS'), m), handit = lisp(val('GP-HANDIT'), m);
    if (!Array.isArray(surf)) return null;
    var shape = {}; (Array.isArray(dis) ? dis : []).forEach(function (e) { if (Array.isArray(e)) shape[e[0]] = e[2]; });
    var held = Array.isArray(handit) ? handit[1] : null, out = [], d = disp;
    surf.forEach(function (e) {
      if (!Array.isArray(e) || !Array.isArray(e[2]) || !Array.isArray(e[6]) || !d.items[e[4]]) return;
      var nm = e[0], sh = shape[nm] || '', l = e[2], s = e[6], x0 = l[0], y0 = l[1], z0 = l[2], x1 = x0 + s[0], y1 = y0 + s[1], z1 = z0 + s[2];
      var o = proj(x0, y0, z0), rel = function (p) { return [p[0] - o[0], p[1] - o[1]]; }, dp = depth((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (/TABLE/.test(sh)) { out.push({ item: e[4], poly: null, depth: 1e9 }); return; }
      if (/BOX/.test(sh)) {   // the inside and back first; the front and right walls later
        out.push({ item: e[4], poly: null, depth: dp + 1e6, box: { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0 } });
        out.push({ item: e[4], poly: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]].map(function (c) { return rel(proj(c[0], c[1], c[2])); }), depth: null, boxFront: { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0 } });
        return;
      }
      var cs = /PYRAMID/.test(sh) ? [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [(x0 + x1) / 2, (y0 + y1) / 2, z1]]
        : [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      out.push({ item: e[4], poly: hull(cs.map(function (c) { return rel(proj(c[0], c[1], c[2])); })), depth: nm === held ? -1e9 : dp, name: nm, loc: [x0, y0, z0] });
    });
    // the box's front walls go just in front of whatever stands inside it
    out.filter(function (s) { return s.boxFront; }).forEach(function (bf) {
      var b = bf.boxFront, inside = out.filter(function (s) { return s.loc && s.loc[0] >= b.x0 && s.loc[0] < b.x1 && s.loc[1] >= b.y0 && s.loc[1] < b.y1 && s.loc[2] >= b.z0 && s.depth > -1e9; });
      bf.depth = inside.length ? Math.min.apply(null, inside.map(function (s) { return s.depth; })) - 1 : depth(b.x1, b.y0, b.z0);
    });
    return out.sort(function (a, b) { return b.depth - a.depth; });
  }

  function Display(o) {
    o = o || {};
    this.colour = !!o.colour;
    this.solid = !!o.solid;
    this.labels = o.labels !== false;
    // Dialogue (an option, after the 1970 film, which shows the conversation at the top of the
    // screen; the surviving code writes only the objects' names on the 340): the last exchanges,
    // [{ you, shrdlu }], in capitals, the typed sentence indented
    this.dialogue = !!o.dialogue; this.caption = [];   // the names graphf writes by each object (DISCUSS); the 1970 film shows none
    this.canvas = o.canvas || null;
    this.onChange = o.onChange || null;
    this.reset();
  }
  var D = Display.prototype;
  D.scene = function () { return sceneOf(this); };

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

  // the caption as screen lines: at most 44 characters, the typed sentence indented one space
  D.captionLines = function () {
    var out = [], W = 44;
    function wrap(s, lead) {
      var words = String(s).toUpperCase().replace(/\s+/g, ' ').trim().split(' '), line = lead;
      words.forEach(function (w) { if ((line + w).length > W && line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; } line += w + ' '; });
      if (line.trim()) out.push(line.replace(/\s+$/, ''));
    }
    // as in the film: the sentence, indented, and the reply running on from it (PUT THE BLUE PYRAMID ... BOX. OK.)
    this.caption.slice(-2).forEach(function (c, i) { if (i) out.push(''); wrap((c.you || '') + ' ' + (c.shrdlu || ''), ' '); });
    return out.slice(-11);
  };

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
    var now = Date.now(), bg = g.fillStyle;
    bg = (css && css.getPropertyValue('--crt').trim()) || '#05070a';
    // the order of painting: in Solid, the scene back to front, then every other item
    var seq = d.order.map(function (id) { return { item: id, poly: null }; });
    if (d.solid) { var sc = null; try { sc = d.scene(); } catch (e) { sc = null; }
      if (sc) { var inScene = {}; sc.forEach(function (s) { inScene[s.item] = 1; }); seq = sc.concat(d.order.filter(function (id) { return !inScene[id]; }).map(function (id) { return { item: id, poly: null }; })); } }
    seq.forEach(function (s) {
      var id = s.item, it = d.items[id]; if (!it || !it.visible) return;
      if (s.poly && s.poly.length > 2) {   // Solid: fill the outline in the screen's colour, hiding what is behind
        g.save(); g.shadowBlur = 0; g.globalAlpha = s.boxFront ? 0.7 : 1; g.fillStyle = bg; g.beginPath();   // the box's walls let what is inside show faintly
        s.poly.forEach(function (p, i) { var X = (it.ox + p[0]) * k, Y = H - (it.oy + p[1]) * k; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
        g.closePath(); g.fill(); g.restore();
      }
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
      if (d.labels) it.texts.forEach(function (t) { g.fillText(t[2], (it.ox + t[0]) * k, H - (it.oy + t[1]) * k - 4 * k); });
    });
    if (d.dialogue && d.caption.length) {   // the conversation, top left, as in the film
      g.globalAlpha = 1; g.fillStyle = g.shadowColor = beam; g.shadowBlur = 4 * k;
      g.font = Math.round(26 * k) + 'px ui-monospace, Menlo, monospace';
      d.captionLines().forEach(function (ln, i) { g.fillText(ln, 40 * k, (70 + i * 36) * k); });
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
  };
  // the screen as SVG, for figures and for checks without a canvas
  D.toSVG = function () {
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#05070a"/><g stroke="#cfe8ff" stroke-width="1.6" stroke-linecap="round" fill="none">'], d = this;
    d.lines().forEach(function (l) { o.push('<line x1="' + l[0].toFixed(1) + '" y1="' + (1024 - l[1]).toFixed(1) + '" x2="' + l[2].toFixed(1) + '" y2="' + (1024 - l[3]).toFixed(1) + '"' + (d.colour ? ' stroke="' + itemColour(l[4], '#cfe8ff') + '"' : '') + '/>'); });
    o.push('</g><g fill="#cfe8ff" font-family="monospace" font-size="20">');
    if (d.labels) d.order.forEach(function (id) { var it = d.items[id]; if (it && it.visible) it.texts.forEach(function (t) { o.push('<text' + (d.colour ? ' fill="' + itemColour(it, '#cfe8ff') + '"' : '') + ' x="' + (it.ox + t[0]).toFixed(1) + '" y="' + (1024 - it.oy - t[1] - 4).toFixed(1) + '">' + String(t[2]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'); }); });
    if (d.dialogue && d.caption.length) d.captionLines().forEach(function (ln, i) { o.push('<text x="40" y="' + (70 + i * 36) + '" font-size="26">' + ln.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'); });
    o.push('</g></svg>');
    return o.join('');
  };

  Display.COLOURS = COLOURS;
  root.SH340 = Display;
  if (typeof module !== 'undefined' && module.exports) module.exports = Display;
})(this);
