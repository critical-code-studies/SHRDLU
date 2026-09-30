/*
 * graphics.js - the Graphics menu: the blocks world and the machinery that draws and moves it,
 * each view built from the program's own tables and code.
 *
 *   objects   the objects: each block, pyramid and the box, from the version's data file
 *             (DISPLAY-AS: name, shape, place, size, colour; ATABLE: the world's own table of
 *             places and sizes), or as the running program has them now; drawn in three
 *             dimensions to turn about, or as GP-PROJECT puts them on the 340
 *   crane     the hand and arm: how graphf moves them (GP-MOVEHAND's four legs, GP-DISMOTION's
 *             steps and pauses), the registers that record them, and the hand's path in the
 *             last exchange run
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, L = root.MacLisp;
  var G = root.SH340 && root.SH340.geom;

  var GFX = [
    ['objects', 'The objects', 'Each block, pyramid and the box, to turn about: shape, place, size, colour, what supports what'],
    ['hand', 'The hand, 1970 and after', 'The gripper the film shows, and the point the surviving code leaves'],
    ['crane', 'The crane', 'How graphf moves the hand and arm: four legs, in steps, and holding'],
    ['path', 'The hand’s path', 'Where the hand went in the last exchange run, in three dimensions and over time']
  ];
  var GFXG = [['What it draws', ['objects', 'hand']], ['What moves', ['crane', 'path']]];
  var gid = SW.store.get('gfx.id', 'objects'), build = null;
  SW.setGraphic = function (id) { if (GFX.some(function (g) { return g[0] === id; })) { gid = id; SW.store.set('gfx.id', id); } };
  SW.gfxItem = function () { return gid; };
  SW.openGraphic = function (id) { SW.setGraphic(id); SW.forget('graphics'); SW.setTab('graphics'); };
  SW.gfxMenu = function () {
    return GFXG.map(function (g, i) {
      return (i ? '<hr class="menu-rule">' : '') + '<div class="menu-group">' + SW.esc(g[0]) + '</div>' + g[1].map(function (id) {
        var x = GFX.filter(function (y) { return y[0] === id; })[0];
        return '<button data-pick="' + id + '"' + (SW.state.tab === 'graphics' && gid === id ? ' class="on"' : '') + '><b>' + SW.esc(x[1]) + '</b><span>' + SW.esc(x[2]) + '</span></button>';
      }).join('');
    }).join('');
  };

  // ---------- the world's tables, from the data file or the running program ----------
  // the version's data file, read by the bench's MacLisp reader (octal, as MacLisp read it)
  function readData(b) {
    var p = -1; b.parts.forEach(function (pt, i) { if (/(^|\/)data(\.\d+)?$/.test(pt.src)) p = i; });
    if (p < 0) return null;
    var m = new L.Machine({ dialect: b.v.id === 'ejs' ? 'new' : 'old', files: {}, out: function () {} });
    var st = new m.Stream(b.parts[p].raw), EOF = {}, out = { part: p, src: b.parts[p].src };
    for (var n = 0; n < 400; n++) {
      var x; try { x = m.readFrom(st, EOF); } catch (e) { break; }
      if (x === EOF) break;
      var a = G.lisp(x, m);
      if (Array.isArray(a) && a[0] === 'SETQ') for (var i = 1; i + 1 < a.length; i += 2) {
        var v = a[i + 1]; if (Array.isArray(v) && v[0] === 'QUOTE') v = v[1];
        if (a[i] === 'DISPLAY-AS' || a[i] === 'ATABLE') out[a[i]] = v;
      }
    }
    // the line each object's DISPLAY-AS entry is on, for a link to it in Read
    out.lines = {};
    b.lines[p].forEach(function (Lr) { var mm = /\((:[A-Z0-9]+)\s+[#!]DISPLAY/.exec(Lr.raw); if (mm) out.lines[mm[1]] = Lr.n; });
    return out;
  }
  // the same tables as the running program has them now (Run, on this version)
  function readLive(vid) {
    var r = SW.runNow && SW.runNow(); if (!r || !r.sess || r.vid !== vid) return null;
    var m = r.sess.m, val = function (n) { var s = m.obarray.get(n); return s ? G.lisp(s.value, m) : null; };
    var d = val('DISPLAY-AS'), a = val('ATABLE');
    return Array.isArray(d) ? { 'DISPLAY-AS': d, ATABLE: a, live: true, handit: val('GP-HANDIT') } : null;
  }
  // objects: name, shape, colour, place and size (DISPLAY-AS gives the shape and colour; ATABLE, the
  // world's table, the place and size where it has the object)
  function objectsOf(t) {
    var at = {}; (t.ATABLE || []).forEach(function (e) { if (Array.isArray(e)) at[e[0]] = e; });
    return (t['DISPLAY-AS'] || []).filter(function (e) { return Array.isArray(e) && e[0] !== ':HAND'; }).map(function (e) {
      // ATABLE's :BOX is the floor only (its walls are :BW1 to :BW4): the box whole from DISPLAY-AS
      var a = /BOX/.test(e[2]) ? null : at[e[0]], loc = a ? a[1] : e[3], size = a ? a[2] : e[4];
      return { name: e[0], shape: String(e[2] || '').replace(/^[#!]/, ''), loc: loc, size: size, colour: e[5], table: /TABLE/.test(e[2]), box: /BOX/.test(e[2]) };
    });
  }
  function supports(objs) {
    var on = {};
    objs.forEach(function (a) { objs.forEach(function (b) {
      if (a === b || a.table || !a.loc || !b.loc || b.box) return;
      var top = b.table ? 0 : b.loc[2] + b.size[2];
      var overlap = a.loc[0] < b.loc[0] + b.size[0] && b.loc[0] < a.loc[0] + a.size[0] && a.loc[1] < b.loc[1] + b.size[1] && b.loc[1] < a.loc[1] + a.size[1];
      if (Math.abs(a.loc[2] - top) <= 1 && (overlap || b.table)) (on[a.name] = on[a.name] || []).push(b.name);
    }); });
    // what stands on the table only when nothing else holds it up
    Object.keys(on).forEach(function (k) { if (on[k].length > 1) on[k] = on[k].filter(function (n) { return !/TABLE/.test(n); }); });
    return on;
  }
  var oct = function (n) { return typeof n === 'number' ? n.toString(8) : String(n); };
  var trip = function (a) { return Array.isArray(a) ? '(' + a.map(oct).join(' ') + ')' : ''; };
  var dec = function (a) { return Array.isArray(a) ? a.join(', ') : ''; };

  // ---------- a small renderer: faces in three dimensions, turned about the scene's centre ----------
  function Viewer(cv, onPick) {
    this.cv = cv; this.yaw = -0.6; this.pitch = 0.5; this.zoom = 1; this.mode = '3d'; this.objs = []; this.sel = null; this.onPick = onPick;
    var v = this, drag = null;
    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: v.yaw, pitch: v.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { v.mode = '3d'; v.yaw = drag.yaw + dx * 0.01; v.pitch = Math.max(-0.2, Math.min(1.5, drag.pitch + dy * 0.01)); v.draw(); if (v.onMode) v.onMode(); }
    });
    cv.addEventListener('pointerup', function (e) { if (drag && !drag.moved) v.pick(e); drag = null; });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); v.zoom = Math.max(0.4, Math.min(4, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); v.draw(); }, { passive: false });
  }
  Viewer.prototype.setObjects = function (objs) { this.objs = objs; this.draw(); };
  // world to screen: in 3D turned (yaw about z, pitch about x) and scaled; in '340' as GP-PROJECT does
  Viewer.prototype.xf = function (c) {
    var W = this.cv.width, H = this.cv.height;
    if (this.mode === '340') { var p = G.proj(c[0], c[1], c[2]), s = W / 1024 * this.zoom; return [W / 2 + (p[0] - 512) * s, H / 2 - (p[1] - 400) * s, 0]; }
    var x = c[0] - 320, y = c[1] - 320, z = c[2] - (this.cz || 60), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var x1 = x * cy - y * sy, y1 = x * sy + y * cy;
    var y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;   // looking down: y2 depth (away from the viewer), z2 up the screen
    var s2 = W / 900 * this.zoom;
    return [W / 2 + x1 * s2, H / 2 - z2 * s2, y2];
  };
  Viewer.prototype.faces = function () {
    var out = [], v = this;
    this.objs.forEach(function (o) {
      if (!o.loc || !o.size) return;
      var x0 = o.loc[0], y0 = o.loc[1], z0 = o.loc[2], x1 = x0 + o.size[0], y1 = y0 + o.size[1], z1 = z0 + o.size[2];
      var fs;
      if (o.table) fs = [{ n: [0, 0, 1], p: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]] }];
      else if (o.box) { fs = []; var w = 8; [[x0, y0, z0, x1, y0 + w, z1], [x0, y1 - w, z0, x1, y1, z1], [x0, y0, z0, x0 + w, y1, z1], [x1 - w, y0, z0, x1, y1, z1], [x0, y0, z0, x1, y1, z0 + 1]].forEach(function (b) { fs = fs.concat(G.boxFaces(b[0], b[1], b[2], b[3], b[4], b[5])); }); }
      else fs = /PYRAMID/.test(o.shape) ? G.pyramidFaces(x0, y0, z0, x1, y1, z1) : G.boxFaces(x0, y0, z0, x1, y1, z1);
      fs.forEach(function (f) {
        var P = f.p.map(function (c) { return v.xf(c); });
        // turned to the viewer? (the screen polygon's winding)
        var a = 0; for (var i = 0; i < P.length; i++) { var q = P[i], r = P[(i + 1) % P.length]; a += q[0] * r[1] - r[0] * q[1]; }
        if (!o.table && a >= 0) return;
        var d = 0; P.forEach(function (q) { d += q[2]; }); d /= P.length;
        if (v.mode === '340') d = -(f.p.reduce(function (s, c) { return s - 0.75111 * c[0] + c[1] - 0.43302 * c[2]; }, 0) / f.p.length);
        out.push({ o: o, f: f, P: P, d: d, box: o.box });
      });
    });
    // back to front, the table first
    return out.sort(function (a, b) { if (a.o.table !== b.o.table) return a.o.table ? -1 : 1; return v.mode === '340' ? a.d - b.d : b.d - a.d; });
  };
  function shadeOf(col, n, lit) {
    var c = /^#([0-9a-f]{6})$/i.exec(col || '#cfe8ff'), r = parseInt(c[1].slice(0, 2), 16), g = parseInt(c[1].slice(2, 4), 16), b = parseInt(c[1].slice(4, 6), 16);
    var k = 0.25 + 0.55 * Math.max(0, lit);
    return 'rgb(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ')';
  }
  Viewer.prototype.draw = function () {
    var cv = this.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height, v = this, C = root.SH340.COLOURS;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
    this.drawn = this.faces();
    this.drawn.forEach(function (F) {
      var col = C[String(F.o.colour || '').toUpperCase()] || '#cfe8ff', n = F.f.n, L0 = Math.hypot(n[0], n[1], n[2]) || 1;
      var lit = (0.3 * n[0] - 0.4 * n[1] + 0.85 * n[2]) / L0;
      g.beginPath(); F.P.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath();
      g.globalAlpha = F.box ? 0.55 : 1; g.fillStyle = F.o.table ? '#15191f' : shadeOf(col, n, lit); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = v.sel === F.o.name ? '#ffffff' : col; g.lineWidth = v.sel === F.o.name ? 2.2 : 1.1; g.stroke();
    });
    // a path through the scene (the hand's, in The crane): orchid where it holds something
    if (this.path && this.path.length > 1) {
      var P = this.path.map(function (q) { return v.xf([q.x, q.y, q.z]); });
      for (var i = 1; i < P.length; i++) {
        g.strokeStyle = this.path[i].held ? '#e58be0' : '#dff2ff'; g.lineWidth = this.path[i].held ? 3 : 1.6;
        g.beginPath(); g.moveTo(P[i - 1][0], P[i - 1][1]); g.lineTo(P[i][0], P[i][1]); g.stroke();
      }
      g.fillStyle = '#dff2ff'; g.beginPath(); g.arc(P[0][0], P[0][1], 4, 0, 7); g.fill();
      g.fillStyle = '#e58be0'; g.beginPath(); g.arc(P[P.length - 1][0], P[P.length - 1][1], 4, 0, 7); g.fill();
    }
  };
  Viewer.prototype.pick = function (e) {
    var r = this.cv.getBoundingClientRect(), x = (e.clientX - r.left) * this.cv.width / r.width, y = (e.clientY - r.top) * this.cv.height / r.height, hit = null;
    var g = this.cv.getContext('2d');
    (this.drawn || []).forEach(function (F) { if (F.o.table) return; g.beginPath(); F.P.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); if (g.isPointInPath(x, y)) hit = F.o; });
    this.sel = hit ? hit.name : null; this.draw(); if (this.onPick) this.onPick(hit);
  };

  // ---------- the views: each fills the page's body with cards, as on the Spacewar! bench ----------
  var viewer = null, useLive = SW.store.get('gfx.live', false);
  function cardHTML(title, lede, body, cls) { return '<div class="card' + (cls ? ' ' + cls : '') + '"><h3>' + title + '</h3>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + body + '</div>'; }
  function objectsView(el, b) {
    var data = readData(b), live = useLive ? readLive(b.v.id) : null, t = live || data;
    if (!t || !t['DISPLAY-AS']) { el.innerHTML = '<p class="hint">No data file with DISPLAY-AS in ' + SW.esc(b.v.label) + '.</p>'; return; }
    var objs = objectsOf(t), on = supports(objs), canLive = !!readLive(b.v.id);
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('The scene ' + (data ? '<span class="swref-sm mono">' + SW.esc(SW.refText(b.v.id, data.part, null, null, b.parts.length)) + '</span>' : ''),
        'Each object’s shape and colour from DISPLAY-AS, its place and size from ATABLE, the world’s own table; ' + (live ? 'as the program running in Run has them now' : 'as the data file sets them out') + '. Drag to turn it, scroll to zoom, click an object.',
        '<div class="gx-bar"><button class="btn" data-gx="340" title="The scene as graphf projects it on the 340 (GP-PROJECT)">The 340’s view</button><button class="btn" data-gx="3d" title="Turn about the scene">Turn about</button>' +
        '<label class="check" title="The world as the program running in Run has it now, after the exchanges typed there' + (canLive ? '' : ' (start the program in Run on this version first)') + '"><input type="checkbox" data-gx="live"' + (useLive ? ' checked' : '') + (canLive ? '' : ' disabled') + '> As it stands in Run</label></div>' +
        '<canvas class="gx-cv" width="900" height="640" aria-label="The blocks world in three dimensions"></canvas>', 'gx-wide') +
      cardHTML('The object', '', '<div class="gx-info"><p class="hint">Click an object in the scene or the table.</p></div>') +
      cardHTML('Every object', 'Numbers in octal, as MacLisp read them.', '<table class="ov-sub gx-t"><thead><tr><th>Object</th><th>Shape</th><th>Colour</th><th>Place</th><th>Size</th></tr></thead><tbody>' +
        objs.map(function (o) { return '<tr data-o="' + SW.esc(o.name) + '"><td class="mono">' + SW.esc(o.name) + '</td><td>' + SW.esc(o.shape.toLowerCase()) + '</td><td>' + SW.esc(String(o.colour || '').toLowerCase()) + '</td><td class="mono">' + SW.esc(trip(o.loc)) + '</td><td class="mono">' + SW.esc(trip(o.size)) + '</td></tr>'; }).join('') + '</tbody></table>') +
      '</div>';
    var cv = SW.$('.gx-cv', el), info = SW.$('.gx-info', el);
    function show(o) {
      SW.$$('.gx-t tr', el).forEach(function (tr) { tr.classList.toggle('on', !!o && tr.dataset.o === o.name); });
      if (!o) { info.innerHTML = '<p class="hint">Click an object in the scene or the table.</p>'; return; }
      var under = on[o.name] || [], over = Object.keys(on).filter(function (k) { return on[k].indexOf(o.name) >= 0; });
      var ln = data && data.lines[o.name];
      info.innerHTML = '<h4 class="mono">' + SW.esc(o.name) + '</h4><dl class="gx-dl">' +
        '<dt>Shape</dt><dd>' + SW.esc(o.shape.toLowerCase()) + '</dd><dt>Colour</dt><dd>' + SW.esc(String(o.colour || '').toLowerCase()) + '</dd>' +
        '<dt>Place</dt><dd class="mono">' + SW.esc(trip(o.loc)) + ' <span class="faint">(' + dec(o.loc) + ')</span></dd>' +
        '<dt>Size</dt><dd class="mono">' + SW.esc(trip(o.size)) + ' <span class="faint">(' + dec(o.size) + ')</span></dd>' +
        '<dt>Stands on</dt><dd class="mono">' + SW.esc(under.join(' ') || '·') + '</dd><dt>Holds up</dt><dd class="mono">' + SW.esc(over.join(' ') || '·') + '</dd></dl>' +
        (ln ? '<p><a href="#" data-read="' + data.part + ':' + ln + '">Its entry in ' + SW.esc(data.src.split('/').pop()) + ', line ' + ln + '</a></p>' : '') +
        '<p class="hint">“Stands on” is worked out here from the places and sizes; the program keeps its own record of support as Micro-Planner assertions (#SUPPORT).</p>';
    }
    viewer = new Viewer(cv, show);
    viewer.setObjects(objs);
    el.onclick = function (e) {
      var a2 = e.target.closest('[data-gx]'), tr = e.target.closest('tr[data-o]');
      if (e.target.closest('[data-read]')) { linkRead(e); return; }
      if (tr) { viewer.sel = tr.dataset.o; viewer.draw(); show(objs.filter(function (o) { return o.name === tr.dataset.o; })[0]); return; }
      if (!a2 || a2.tagName === 'INPUT') return;
      if (a2.dataset.gx === '340') { viewer.mode = '340'; viewer.zoom = 1; viewer.draw(); }
      if (a2.dataset.gx === '3d') { viewer.mode = '3d'; viewer.draw(); }
    };
    el.onchange = function (e) { var a3 = e.target.closest('[data-gx="live"]'); if (a3) { useLive = a3.checked; SW.store.set('gfx.live', useLive); objectsView(el, b); } };
  }

  // the crane: how graphf moves the hand, with references to its functions
  function craneView(el, b) {
    var p = -1; b.parts.forEach(function (pt, i) { if (/graphf(\.\d+)?$/.test(pt.src)) p = i; });
    if (p < 0) { el.innerHTML = '<p class="hint">' + SW.esc(b.v.label) + ' holds no display code (graphf).</p>'; return; }
    var ref = function (fn) {
      var n = 0; b.lines[p].some(function (Lr) { if (new RegExp('\\(DEFUN\\s+' + fn.replace(/[-]/g, '\\-') + '\\b').test(Lr.raw)) { n = Lr.n; return true; } return false; });
      return n ? ' <a href="#" class="mono" data-read="' + p + ':' + n + '">' + SW.esc(SW.refText(b.v.id, p, n, n, b.parts.length)) + '</a>' : '';
    };
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('A move, in four legs' + ref('GP-MOVEHAND'), '', '<p class="gx-p">MOVETO' + ref('MOVETO') + ' takes the place the hand is to go to (LOCX LOCY LOCZ); if the hand holds something it first works out what the load will pass in front of. GP-MOVEHAND then moves the hand in four legs, each changing one coordinate: up to height 1300 (octal) where it stands, back or forward (y) at that height, across (x), and down to the place. The first element of GP-HANDIT, its record of where the hand is, is set to the new place at the end.</p>') +
      cardHTML('Each leg, in steps' + ref('GP-DISMOTION'), '', '<p class="gx-p">GP-DISMOTION moves the hand on the screen 20 (octal) points at a time across and 14 up or down. At each step it draws a new arm, from the hand up to height 1730, moves the hand to it, waits (SLEEP .06), and removes the old arm. Run pauses where the code says SLEEP; its Arm menu shortens the pauses.</p>') +
      cardHTML('Holding' + ref('GRASP'), '', '<p class="gx-p">GRASP moves the hand to the object’s handle and links the object’s picture to the hand’s (DISLINK), so that it moves with it; UNGRASP' + ref('UNGRASP') + ' unlinks it and draws it afresh where it now stands. The Planner keeps its own account of the same things: HANDAT, where the hand is, and GRASPLIST, what it held and from when (Run ▸ Deep dive).</p>') +
      '</div>';
    el.onclick = linkRead;
  }
  // the hand's path in the last exchange: through the scene, and over time
  function pathView(el, b) {
    var r = SW.runNow && SW.runNow(), track = r && r.disp && r.vid === b.v.id ? r.disp.track || [] : [];
    if (!track.length) { el.innerHTML = '<div class="cards gx-cards">' + cardHTML('No path yet', '', '<p class="gx-p">Run an exchange that moves the arm on this version (Run, with the display on), for example “pick up a big red block.”, and its path shows here.</p>') + '</div>'; return; }
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('Through the scene', 'Drag to turn, scroll to zoom. Orchid where the hand holds something; the start is the white dot, the end the orchid one.', '<canvas class="gx-cv gx-cv3" width="900" height="640" aria-label="The hand’s path through the scene, to turn about"></canvas>', 'gx-wide') +
      cardHTML('Over time', 'The hand’s x (across), y (back) and z (height), in octal, at each of the ' + track.length + ' steps graphf moved it' + (track.some(function (q) { return q.held; }) ? '; the thicker line where it held something' : '') + '.', '<canvas class="gx-plot" width="640" height="360" aria-label="The hand’s x, y and z at each step"></canvas>', 'gx-wide') +
      '</div>';
    plot(SW.$('.gx-plot', el), track);
    var t0 = readLive(b.v.id) || readData(b);
    var v3 = new Viewer(SW.$('.gx-cv3', el), null); v3.path = track; v3.cz = 330; v3.zoom = 0.72; v3.setObjects(t0 ? objectsOf(t0) : []);
  }
  // the hand, 1970 and after: what the film shows, and what the surviving code draws
  function handSection(b) {
    var find = function (re, part) { var hit = null; b.parts.forEach(function (pt, i) { if (hit || (part && !part.test(pt.src))) return; b.lines[i].some(function (Lr) { if (re.test(Lr.raw)) { hit = [i, Lr.n]; return true; } return false; }); }); return hit; };
    var lk = function (h) { return h ? ' <a href="#" class="mono" data-read="' + h[0] + ':' + h[1] + '">' + SW.esc(SW.refText(b.v.id, h[0], h[1], h[1], b.parts.length)) + '</a>' : ''; };
    var hb = find(/\(QUOTE [#!]HAND\)\)/, /graphf/), hd = find(/\(:HAND [#!]DISPLAY/, /data/);
    // two sketches, drawn as the 340 would: the arm and, in 1970, the gripper
    var sk = function (grip) {
      return '<svg viewBox="0 0 120 150" width="120" height="150" class="gx-hand" aria-hidden="true"><g stroke="#dff2ff" stroke-width="1.6" fill="none" stroke-linecap="round">' +
        '<line x1="60" y1="4" x2="60" y2="' + (grip ? 78 : 104) + '"/>' +
        (grip ? '<path d="M60 78 L34 100 L60 110 L86 100 Z M60 78 L60 110"/><path d="M34 100 L34 104 L60 114 L86 104 L86 100"/>' : '<circle cx="60" cy="104" r="2.5" fill="#dff2ff"/>') +
        '<path d="M28 112 L60 124 L92 112 L60 100 Z" stroke="#4fdc6a"/><path d="M28 112 L28 140 L60 150 M60 124 L60 150 M92 112 L92 140 L60 150" stroke="#4fdc6a"/></g></svg>';
    };
    return '<h3>The hand, 1970 and after</h3>' +
      '<div class="gx-hands"><figure>' + sk(true) + '<figcaption>1970, as the film shows it</figcaption></figure><figure>' + sk(false) + '<figcaption>1972–77, as the surviving code draws it</figcaption></figure></div>' +
      '<p>The film of 1970 shows a gripper at the end of the arm: a small pyramid, its point on the arm, standing on a flat plate that rests on the block it holds.</p>' +
      '<p>The surviving code draws no hand. For the hand, GP-SELECTSHAPE' + lk(hb) + ' makes two display items: one for the arm, given a line from the hand up to the top of the screen, and one for the hand, given only a pen and a brightness (DISET) and no line. The data file gives the hand no size: its entry in DISPLAY-AS' + lk(hd) + ' has the size (0 0 0), a point. So from 1972 the arm ends at a point on the block, and the hand is where the line stops.</p>' +
      '<p class="hint">The January 1971 files, which might hold the 1970 drawing, are not held. Run’s 1970 Hand switch draws the film’s gripper at the hand’s place; it is the bench’s, after the film.</p>';
  }
  function handView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The hand, 1970 and after', '', handSection(b).replace('<h3>The hand, 1970 and after</h3>', ''), 'gx-wide') + '</div>';
    el.onclick = linkRead;
  }
  function linkRead(e) { var r2 = e.target.closest('[data-read]'); if (!r2) return; e.preventDefault(); var x = r2.dataset.read.split(':'); SW.setTab('read'); setTimeout(function () { if (SW.views.read.goto) SW.views.read.goto(+x[0], +x[1], true); }, 300); }
  function plot(cv, tr) {
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 36;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
    var all = []; tr.forEach(function (q) { all.push(q.x, q.y, q.z); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi === lo) hi = lo + 1;
    var X = function (i) { return pad + i * (W - 2 * pad) / Math.max(1, tr.length - 1); }, Y = function (v) { return H - pad - (v - lo) * (H - 2 * pad) / (hi - lo); };
    g.strokeStyle = '#23262f'; g.lineWidth = 1; g.font = '11px ui-monospace, Menlo, monospace'; g.fillStyle = '#8a8d86';
    for (var k = 0; k <= 4; k++) { var v = lo + (hi - lo) * k / 4; g.beginPath(); g.moveTo(pad, Y(v)); g.lineTo(W - pad, Y(v)); g.stroke(); g.fillText(Math.round(v).toString(8), 2, Y(v) + 4); }
    [['x', '#5aa2ff'], ['y', '#4fdc6a'], ['z', '#ff5a4e']].forEach(function (s) {
      tr.forEach(function (q, i) {
        if (!i) return;
        g.strokeStyle = s[1]; g.lineWidth = q.held ? 3 : 1.4; g.beginPath(); g.moveTo(X(i - 1), Y(tr[i - 1][s[0]])); g.lineTo(X(i), Y(q[s[0]])); g.stroke();
      });
      g.fillStyle = s[1]; g.fillText(s[0], W - pad + 6, Y(tr[tr.length - 1][s[0]]) + 4);
    });
  }

  SW.views.graphics = { show: function (b) {
    build = b;
    var el = SW.$('#view-graphics'), G0 = GFX.filter(function (x) { return x[0] === gid; })[0] || GFX[0];
    el.className = 'view on';
    el.innerHTML = '<div class="pad gfx-page" style="max-width:none"><div class="toolbar an-head" style="position:static;padding:0 0 10px">' +
      '<details class="menu lens-menu"><summary class="btn" title="Choose a graphic">' + SW.esc(G0[1]) + ' ▾</summary><div class="menu-body lens-list">' + SW.gfxMenu().replace(/data-pick=/g, 'data-g=') + '</div></details>' +
      '<span class="hint an-desc">' + SW.esc(G0[2]) + '.</span></div><div class="gx-body"></div></div>';
    SW.$('.an-head', el).addEventListener('click', function (e) { var t2 = e.target.closest('[data-g]'); if (t2) { SW.setGraphic(t2.dataset.g); SW.writeQuery(); SW.views.graphics.show(build); } });
    var body = SW.$('.gx-body', el);
    if (!b.v.build) { body.innerHTML = '<p class="hint">No source survives for ' + SW.esc(b.v.label) + ', so there is nothing to draw.</p>'; return; }
    ({ crane: craneView, path: pathView, hand: handView }[gid] || objectsView)(body, b);
  } };
})(this);
