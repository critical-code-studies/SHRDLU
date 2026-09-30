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

  // Solid (an option): the scene drawn from its geometry, so that objects hide what lies
  // behind them. The 340 showed lines only; graphf takes out the lines it finds hidden when it
  // draws an object (GP-OPAQUE), but not those a moved object comes to stand in front of or
  // behind. Here every object is rebuilt in three dimensions from graphf's own tables
  // (GP-SURFACE: name, faces, location, hiders, item, handle, size; the shape and colour from
  // DISPLAY-AS; the box as four walls and a floor), projected as GP-PROJECT projects, and each
  // face that turns towards the viewer is filled and outlined, back to front.
  //   Order: two objects whose outlines overlap on the screen are separated by a plane; the one
  //   on the far side is behind (the line of sight runs towards -x, +y, -z). The pairs are put in
  //   order by a topological sort.
  //   The hand in motion: GP-MOVEHAND moves it in four legs, each changing one coordinate (up to
  //   height 1300, along y, along x, down; from (CAR GP-HANDIT) to LOCATION), so its place in
  //   three dimensions is found from where graphf has drawn it; a held object keeps its offset
  //   from the handle it was grasped by (the handle in its GP-SURFACE entry).
  //   The box's walls are drawn part-transparent, so that what is inside shows faintly.
  var VIEW = [0.75111, -1, 0.43302];   // towards the viewer
  function proj(x, y, z) { return [0.9 * (x + 0.75111 * y + 3), 0.9 * (z + 0.43302 * y + 3)]; }
  function lisp(x, m) {   // a Lisp value as plain data: lists as arrays, numbers, symbols by name
    if (x === m.NIL || x == null) return null;
    if (typeof x === 'number') return x;
    if (x instanceof L.Flo) return x.v;
    if (x instanceof L.Cons) { var a = []; while (x instanceof L.Cons) { a.push(lisp(x.car, m)); x = x.cdr; } return a; }
    return x.name != null ? x.name : null;
  }
  function inStack(m, fn) { var st = m.stack; for (var i = st.length - 1; i >= 0; i--) if (st[i].fnName === fn) return true; return false; }
  // an axis-aligned box: its faces (corners in order, outward normal)
  function boxFaces(x0, y0, z0, x1, y1, z1) {
    var c = function (x, y, z) { return [x, y, z]; };
    return [
      { n: [0, -1, 0], p: [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)] },
      { n: [0, 1, 0], p: [c(x0, y1, z0), c(x0, y1, z1), c(x1, y1, z1), c(x1, y1, z0)] },
      { n: [-1, 0, 0], p: [c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1), c(x0, y1, z0)] },
      { n: [1, 0, 0], p: [c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)] },
      { n: [0, 0, -1], p: [c(x0, y0, z0), c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0)] },
      { n: [0, 0, 1], p: [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)] }];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function pyramidFaces(x0, y0, z0, x1, y1, z1) {
    var A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y1, z0], D0 = [x0, y1, z0], T = [(x0 + x1) / 2, (y0 + y1) / 2, z1];
    var tri = function (p, q) { return { n: cross(sub(q, p), sub(T, p)), p: [p, q, T] }; };
    return [{ n: [0, 0, -1], p: [A, D0, C, B] }, tri(A, B), tri(B, C), tri(C, D0), tri(D0, A)];
  }
  function hull2(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // do two convex screen polygons overlap (more than touching)?
  function overlap2(P, Q) {
    var polys = [P, Q];
    for (var s = 0; s < 2; s++) {
      var R = polys[s];
      for (var i = 0; i < R.length; i++) {
        var a = R[i], b = R[(i + 1) % R.length], nx = a[1] - b[1], ny = b[0] - a[0];
        var pm = [Infinity, -Infinity], qm = [Infinity, -Infinity];
        P.forEach(function (v) { var d = v[0] * nx + v[1] * ny; pm[0] = Math.min(pm[0], d); pm[1] = Math.max(pm[1], d); });
        Q.forEach(function (v) { var d = v[0] * nx + v[1] * ny; qm[0] = Math.min(qm[0], d); qm[1] = Math.max(qm[1], d); });
        if (pm[1] <= qm[0] + 0.5 || qm[1] <= pm[0] + 0.5) return false;
      }
    }
    return true;
  }
  // is A behind B? A plane between them, A on the far side (-x, +y, -z are away from the viewer)
  function behind(A, B) {
    if (A.z1 <= B.z0) return true;  if (B.z1 <= A.z0) return false;   // below / above
    if (A.y0 >= B.y1) return true;  if (B.y0 >= A.y1) return false;   // further back / nearer
    if (A.x1 <= B.x0) return true;  if (B.x1 <= A.x0) return false;   // to the left / right
    return (A.cd > B.cd);   // interpenetrating: by centres
  }
  function centreDepth(o) { return -0.75111 * (o.x0 + o.x1) / 2 + (o.y0 + o.y1) / 2 - 0.43302 * (o.z0 + o.z1) / 2; }

  // the hand's place in three dimensions, from where graphf has drawn it (see above)
  function handAt(disp, m, handit, sx, sy) {
    var start = handit && handit[0], loc = lisp(m.obarray.get('LOCATION') ? m.obarray.get('LOCATION').value : null, m);
    if (!Array.isArray(start)) return null;
    if (!inStack(m, 'GP-MOVEHAND') || !Array.isArray(loc) || loc.length < 3) return start.slice();
    var H = 704;   // 1300 octal: the height the hand travels at
    var P = [start, [start[0], start[1], H], [start[0], loc[1], H], [loc[0], loc[1], H], loc];
    var best = null;
    for (var i = 0; i < 4; i++) {
      var a = proj.apply(null, P[i]), b = proj.apply(null, P[i + 1]), dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      var tt = L2 ? Math.max(0, Math.min(1, ((sx - a[0]) * dx + (sy - a[1]) * dy) / L2)) : 0;
      var ex = a[0] + tt * dx - sx, ey = a[1] + tt * dy - sy, e = ex * ex + ey * ey;
      // a later leg wins a tie: the hand moves through them in order
      if (!best || e <= best.e + 0.01) best = { e: e, i: i, t: tt };
    }
    var A = P[best.i], B = P[best.i + 1];
    return [A[0] + best.t * (B[0] - A[0]), A[1] + best.t * (B[1] - A[1]), A[2] + best.t * (B[2] - A[2])];
  }

  // the scene: the table, the objects (faces in three dimensions), the arm; in painting order
  function sceneOf(disp) {
    var m = disp.m; if (!m) return null;
    var val = function (n) { var s = m.obarray.get(n); return s ? s.value : null; };
    var surf = lisp(val('GP-SURFACE'), m), dis = lisp(val('DISPLAY-AS'), m), handit = lisp(val('GP-HANDIT'), m);
    if (!Array.isArray(surf)) return null;
    var shape = {}, colour = {};
    (Array.isArray(dis) ? dis : []).forEach(function (e) { if (Array.isArray(e)) { shape[e[0]] = e[2]; colour[e[0]] = e[5]; } });
    var held = Array.isArray(handit) ? handit[1] : null, hitem = Array.isArray(handit) ? disp.items[handit[2]] : null;
    var hand = hitem ? handAt(disp, m, handit, hitem.ox, hitem.oy) : null;
    var table = null, objs = [];
    surf.forEach(function (e) {
      if (!Array.isArray(e) || e[0] === ':VIRTUAL' || !Array.isArray(e[2]) || !Array.isArray(e[6])) return;
      var nm = e[0], sh = String(shape[nm] || ''), l = e[2].slice(), s = e[6];
      if (nm === held && hand && Array.isArray(e[5])) l = [hand[0] + l[0] - e[5][0], hand[1] + l[1] - e[5][1], hand[2] + l[2] - e[5][2]];
      var x0 = l[0], y0 = l[1], z0 = l[2], x1 = x0 + s[0], y1 = y0 + s[1], z1 = z0 + s[2];
      var col = COLOURS[String(colour[nm] || '').toUpperCase()] || null;
      if (/TABLE/.test(sh)) { table = { x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, faces: [{ n: [0, 0, 1], p: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] }], col: col, name: nm }; return; }
      if (/BOX/.test(sh)) {   // four walls and a floor
        var w = 10;
        [[x0, y0, z0, x1, y0 + w, z1], [x0, y1 - w, z0, x1, y1, z1], [x0, y0, z0, x0 + w, y1, z1], [x1 - w, y0, z0, x1, y1, z1], [x0, y0, z0, x1, y1, z0 + 1]].forEach(function (b, i) {
          objs.push({ x0: b[0], y0: b[1], z0: b[2], x1: b[3], y1: b[4], z1: b[5], faces: boxFaces(b[0], b[1], b[2], b[3], b[4], b[5]), col: col, name: nm + (i < 4 ? ' wall' : ' floor'), wall: true });
        });
        return;
      }
      objs.push({ x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1, faces: /PYRAMID/.test(sh) ? pyramidFaces(x0, y0, z0, x1, y1, z1) : boxFaces(x0, y0, z0, x1, y1, z1), col: col, name: nm, held: nm === held });
    });
    if (hand) objs.push({ x0: hand[0], y0: hand[1], z0: hand[2], x1: hand[0] + 0.01, y1: hand[1] + 0.01, z1: 4000, faces: [], arm: true, name: 'arm' });
    objs.forEach(function (o) {
      o.cd = centreDepth(o);
      var pts = []; o.faces.forEach(function (f) { f.p.forEach(function (c) { pts.push(proj(c[0], c[1], c[2])); }); });
      if (o.arm) { var a = proj(o.x0, o.y0, o.z0); pts = [a, [a[0], 2000], [a[0] + 0.5, 2000], [a[0] + 0.5, a[1]]]; }
      o.hull = hull2(pts);
    });
    // back to front: a topological sort of "behind", for pairs that overlap on the screen
    var n = objs.length, after = objs.map(function () { return []; }), indeg = objs.map(function () { return 0; });
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      if (!overlap2(objs[i].hull, objs[j].hull)) continue;
      if (behind(objs[i], objs[j])) { after[i].push(j); indeg[j]++; } else { after[j].push(i); indeg[i]++; }
    }
    var ready = [], out = [];
    for (i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
    while (out.length < n) {
      if (!ready.length) {   // a cycle: break it at the farthest remaining
        var rest = []; for (i = 0; i < n; i++) if (indeg[i] > 0) rest.push(i);
        rest.sort(function (a, b) { return objs[b].cd - objs[a].cd; }); indeg[rest[0]] = 0; ready.push(rest[0]);
      }
      ready.sort(function (a, b) { return objs[b].cd - objs[a].cd; });
      var k0 = ready.shift(); if (indeg[k0] < 0) continue; indeg[k0] = -1; out.push(objs[k0]);
      after[k0].forEach(function (j2) { if (indeg[j2] > 0 && --indeg[j2] === 0) ready.push(j2); });
    }
    return { table: table, objs: out };
  }
  function Display(o) {
    o = o || {};
    this.colour = !!o.colour;
    this.solid = !!o.solid;
    this.faces = !!o.faces;   // Solid with its faces shaded, not only outlined
    this.labels = o.labels !== false;   // the names graphf writes by each object (DISCUSS); the 1970 film shows none
    // Dialogue (an option, after the 1970 film, which shows the conversation at the top of the
    // screen; the surviving code writes only the objects' names on the 340): the last exchanges,
    // [{ you, shrdlu }], in capitals, the typed sentence indented
    this.dialogue = !!o.dialogue; this.caption = [];
    this.canvas = o.canvas || null;
    this.onChange = o.onChange || null;
    this.reset();
  }
  var D = Display.prototype;
  D.scene = function () { return sceneOf(this); };
  // paint the scene: each face turned to the viewer, filled in the screen's colour and outlined
  D.drawSolid = function (g, k, H, beam, bg) {
    var sc = sceneOf(this); if (!sc) return false;
    var d = this, S = function (c) { var p = proj(c[0], c[1], c[2]); return [p[0] * k, H - p[1] * k]; };
    // a face's shade, with Faces on: lit from above and in front (top lightest, then front, then side)
    function shade(f, col) {
      var n = f.n, L = Math.hypot(n[0], n[1], n[2]) || 1, lit = (0.25 * n[0] - 0.45 * n[1] + 0.85 * n[2]) / L;
      var c = /^#([0-9a-f]{6})$/i.exec(col), r = c ? parseInt(c[1].slice(0, 2), 16) : 200, gg = c ? parseInt(c[1].slice(2, 4), 16) : 220, b = c ? parseInt(c[1].slice(4, 6), 16) : 235;
      var k2 = 0.22 + 0.5 * Math.max(0, lit);
      return 'rgb(' + Math.round(r * k2) + ',' + Math.round(gg * k2) + ',' + Math.round(b * k2) + ')';
    }
    function face(f, col, alpha) {
      g.beginPath(); f.p.forEach(function (c, i) { var p = S(c); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath();
      g.save(); g.shadowBlur = 0; g.globalAlpha = alpha; g.fillStyle = d.faces ? shade(f, col) : bg; g.fill(); g.restore();
      g.strokeStyle = g.shadowColor = col; g.stroke();
    }
    var colOf = function (o) { return d.colour && o.col ? o.col : beam; };
    if (sc.table) sc.table.faces.forEach(function (f) { face(f, colOf(sc.table), 1); });
    sc.objs.forEach(function (o) {
      if (o.arm) {
        var a = S([o.x0, o.y0, o.z0]); g.strokeStyle = g.shadowColor = beam; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0], 0); g.stroke(); return;
      }
      o.faces.forEach(function (f) { if (f.n[0] * VIEW[0] + f.n[1] * VIEW[1] + f.n[2] * VIEW[2] > 1e-9) face(f, colOf(o), o.wall ? 0.7 : 1); });
    });
    return true;
  };

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
    // Solid: the scene from its geometry, then only the labels; otherwise the display list
    var solid = false;
    if (d.solid || d.faces) { try { solid = d.drawSolid(g, k, H, beam, bg); } catch (e) { solid = false; if (root.console) console.warn('Solid view:', e); } }
    d.order.forEach(function (id) {
      var it = d.items[id]; if (!it || !it.visible) return;
      if (solid) { if (d.labels && it.texts.length) { g.globalAlpha = 1; g.fillStyle = g.shadowColor = d.colour ? itemColour(it, beam) : beam; g.font = Math.round(14 * k * 1.4) + 'px ui-monospace, Menlo, monospace'; it.texts.forEach(function (t) { g.fillText(t[2], (it.ox + t[0]) * k, H - (it.oy + t[1]) * k - 4 * k); }); } return; }
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
