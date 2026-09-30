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
    ['world', 'The microworld', 'Move the objects with the mouse, through SHRDLU’s own theorems: what it will do, and what it refuses'],
    ['support', 'What is on what', 'The Planner’s own record of what supports what, and what the box contains'],
    ['space', 'Finding space', 'How FINDSPACE finds room to put something down: its random tries, as GROW widens them'],
    ['projection', 'The projection', 'How GP-PROJECT puts a point of the world on the 340’s screen'],
    ['hidden', 'Hidden lines', 'graphf’s own hidden lines beside the bench’s solid view, and where graphf’s go stale'],
    ['dlist', 'The display list', 'The 340’s items as the program has made them, and its last calls to the display'],
    ['events', 'The event memory', 'What SHRDLU remembers doing, event by event, in time: what lets it answer “why?”'],
    ['goals', 'The goal tree', 'The goals a command set off, each under the goal it served'],
    ['parse', 'The parse', 'The last sentence’s parse, drawn as a tree'],
    ['objects', 'The objects', 'Each block, pyramid and the box, to turn about: shape, place, size, colour, what supports what'],
    ['hand', 'The hand, 1970 and after', 'The gripper the film shows, and the point the surviving code leaves'],
    ['crane', 'The crane', 'How graphf moves the hand and arm: four legs, in steps, and holding'],
    ['path', 'The hand’s path', 'Where the hand went in the last exchange run, in three dimensions and over time']
  ];
  var GFXG = [['The world', ['world', 'support', 'space']], ['What it draws', ['objects', 'projection', 'hidden', 'dlist', 'hand']], ['What moves', ['crane', 'path']], ['What it knows', ['events', 'goals', 'parse']]];
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
      var LEG = ['#ff5a4e', '#4fdc6a', '#5aa2ff', '#e58be0'];
      for (var i = 1; i < P.length; i++) {
        g.strokeStyle = this.path[i].leg != null ? LEG[this.path[i].leg] : this.path[i].held ? '#e58be0' : '#dff2ff'; g.lineWidth = this.path[i].held || this.path[i].leg != null ? 3 : 1.6;
        g.beginPath(); g.moveTo(P[i - 1][0], P[i - 1][1]); g.lineTo(P[i][0], P[i][1]); g.stroke();
      }
      g.fillStyle = '#dff2ff'; g.beginPath(); g.arc(P[0][0], P[0][1], 4, 0, 7); g.fill();
      g.fillStyle = '#e58be0'; g.beginPath(); g.arc(P[P.length - 1][0], P[P.length - 1][1], 4, 0, 7); g.fill();
      // the legs numbered at their middles
      if (this.path[1] && this.path[1].leg != null) { g.font = 'bold 20px ui-monospace, Menlo, monospace'; for (var j = 1; j < P.length; j++) { var mx = (P[j - 1][0] + P[j][0]) / 2, my = (P[j - 1][1] + P[j][1]) / 2; g.fillStyle = LEG[this.path[j].leg]; g.fillText(String(this.path[j].leg + 1), mx + 8, my - 6); } }
      if (this.dot != null) { var q = this.dotAt(P); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill(); }
    }
  };
  // a point a fraction of the way along a screen path (for the moving dot)
  Viewer.prototype.dotAt = function (P) {
    var L = [0], tot = 0; for (var i = 1; i < P.length; i++) { tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(tot); }
    var s = (this.dot % 1) * tot; for (i = 1; i < P.length; i++) if (L[i] >= s) { var f = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [P[i - 1][0] + f * (P[i][0] - P[i - 1][0]), P[i - 1][1] + f * (P[i][1] - P[i - 1][1])]; }
    return P[P.length - 1];
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
      cardHTML('Holding' + ref('GRASP'), '', '<p class="gx-p">GRASP moves the hand to the object’s handle and links the object’s picture to the hand’s (DISLINK), so that it moves with it; UNGRASP' + ref('UNGRASP') + ' unlinks it and draws it afresh where it now stands. The Planner keeps its own account of the same things: HANDAT, where the hand is, and GRASPLIST, what it held and from when (Run ▸ Deep dive).</p>' + linkSVG()) +
      cardHTML('One move, leg by leg', 'The hand going from where it starts (DISPLAY-AS gives :HAND the place (40 0 0)) to the handle of the blue block, :B10 (the top of its middle; nothing stands on it), as GP-MOVEHAND moves it: 1 up to 1300, 2 back, 3 across, 4 down. Drag to turn, scroll to zoom.', '<canvas class="gx-cv gx-legs" width="900" height="640" aria-label="The four legs of one move, in three dimensions"></canvas>', 'gx-wide') +
      cardHTML('The steps of a leg', 'Leg 3, across, as the 340 shows it: at each step GP-DISMOTION draws a new arm 20 (octal) points on, moves the hand to it, waits .06 seconds and removes the old arm. Here the arms are all left standing, the newest brightest.', '<canvas class="gx-steps" width="900" height="300" aria-label="Successive arms along one leg"></canvas>', 'gx-wide') +
      '</div>';
    el.onclick = linkRead;
    // the four legs, from the data file's places
    var dt = readData(b), obs = dt ? objectsOf(dt) : [], hand = null, blk = null;
    (dt && dt['DISPLAY-AS'] || []).forEach(function (e) { if (Array.isArray(e) && e[0] === ':HAND') hand = e[3]; });
    obs.forEach(function (o) { if (o.name === ':B10') blk = o; });
    var cvL = SW.$('.gx-legs', el);
    if (hand && blk) {
      var H = 704, tgt = [blk.loc[0] + blk.size[0] / 2, blk.loc[1] + blk.size[1] / 2, blk.loc[2] + blk.size[2]];
      var P = [hand, [hand[0], hand[1], H], [hand[0], tgt[1], H], [tgt[0], tgt[1], H], tgt], path = [];
      P.forEach(function (c, i) { path.push({ x: c[0], y: c[1], z: c[2], leg: i ? i - 1 : 0 }); });
      var vl = new Viewer(cvL, null); vl.path = path; vl.cz = 330; vl.zoom = 0.72; vl.dot = 0; vl.setObjects(obs);
      var t0 = null;
      (function tick(ts) { if (!cvL.isConnected) return; if (t0 == null) t0 = ts; vl.dot = ((ts - t0) / 6000) % 1; vl.draw(); requestAnimationFrame(tick); })(performance.now());
    } else cvL.replaceWith(SW.el('p', { class: 'hint' }, 'No data file with the hand and :B10 in this version.'));
    steps(SW.$('.gx-steps', el));
  }
  // the hand and a block as two display items, linked: moving the hand's item moves the block's
  function linkSVG() {
    return '<svg viewBox="0 0 360 150" class="gx-link" role="img" aria-label="The hand’s item and the block’s item, linked by DISLINK"><g font-family="ui-monospace, Menlo, monospace" font-size="11" fill="#8a8d86">' +
      '<rect x="20" y="30" width="120" height="44" rx="6" fill="none" stroke="#dff2ff"/><text x="80" y="50" text-anchor="middle" fill="#dff2ff">hand item</text><text x="80" y="65" text-anchor="middle">GP-HANDIT, third</text>' +
      '<rect x="220" y="30" width="120" height="44" rx="6" fill="none" stroke="#4fdc6a"/><text x="280" y="50" text-anchor="middle" fill="#4fdc6a">block item</text><text x="280" y="65" text-anchor="middle">its GP-LINES entry</text>' +
      '<path d="M140 52 H220" stroke="#e58be0" stroke-width="2" marker-end="url(#gxa)"/><text x="180" y="44" text-anchor="middle" fill="#e58be0">DISLINK … T</text>' +
      '<text x="80" y="104" text-anchor="middle">DISLOCATE hand x y</text><path d="M80 80 V92" stroke="#8a8d86"/><text x="280" y="104" text-anchor="middle">moves with it</text><path d="M280 80 V92" stroke="#8a8d86"/>' +
      '<text x="180" y="136" text-anchor="middle">UNGRASP: DISLINK … NIL, then the block drawn afresh where it stands</text>' +
      '</g><defs><marker id="gxa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#e58be0"/></marker></defs></svg>';
  }
  // the arms along one leg, as GP-DISMOTION draws them (20 octal = 16 points apart on the screen)
  function steps(cv) {
    var g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
    var n = 24, x0 = 60, dx = (W - 120) / n, hy = H - 70;
    for (var i = 0; i <= n; i++) {
      var x = x0 + i * dx, a = 0.12 + 0.88 * Math.pow(i / n, 2.2);
      g.globalAlpha = a; g.strokeStyle = '#dff2ff'; g.lineWidth = i === n ? 2.2 : 1.2;
      g.beginPath(); g.moveTo(x, 12); g.lineTo(x, hy); g.stroke();
      g.fillStyle = '#dff2ff'; g.beginPath(); g.arc(x, hy, i === n ? 4 : 2.2, 0, 7); g.fill();
    }
    g.globalAlpha = 1; g.fillStyle = '#8a8d86'; g.font = '13px ui-monospace, Menlo, monospace';
    g.fillText('← 20 (octal) points a step →', x0 + dx * 2, H - 36);
    g.fillText('each step: DISCREATE a new arm · DISALINE up to 1730 · DISLOCATE the hand · SLEEP .06 · DISFLUSH the old arm', x0, H - 14);
  }
  // the hand's path in the last exchange: through the scene, and over time
  function pathView(el, b) {
    var r = SW.runNow && SW.runNow(), track = r && r.disp && r.vid === b.v.id ? r.disp.track || [] : [];
    if (!track.length) {
      el.innerHTML = '<div class="cards gx-cards">' + cardHTML('Running exchange 1…', '', '<p class="gx-p">No path from Run on this version yet, so the bench is running the first sentence of the 1970 dialogue, “pick up a big red block.”, on its own copy of the program. An exchange you run in Run takes its place here.</p>') + '</div>';
      demoPath(b, function (tr) { if (el.isConnected && gid === 'path') { el.dataset.demo = '1'; drawPath(el, b, tr, true); } });
      return;
    }
    drawPath(el, b, track, false);
  }
  // the program with exchange 1 run, by version (for the path, the event memory, the goal tree, the parse)
  var demo = {};
  function demoSession(b, cb) {
    var v = b.v, dm = demo[v.id];
    if (dm) { if (dm.ready) cb(dm); else dm.waiters.push(cb); return; }
    dm = demo[v.id] = { ready: false, waiters: [cb] };
    texts(b, function (tx) {
      dm.disp = new root.SH340({}); dm.sess = new root.SHSession({ version: v, texts: tx, display: dm.disp, animate: false, out: function () {} });
      dm.sess.boot(function (r) {
        var go = function () { dm.ready = true; var w = dm.waiters; dm.waiters = []; w.forEach(function (f) { f(dm); }); };
        if (r !== 'input') { go(); return; }
        dm.sess.type('pick up a big red block.', function () { dm.track = (dm.disp.track || []).slice(); go(); });
      });
    });
  }
  function demoPath(b, cb) { demoSession(b, function (dm) { cb(dm.track || []); }); }
  // the program to read what it knows from: Run's, when it runs this version and has taken a sentence; else exchange 1, run here
  function knowing(b, cb) {
    var r = SW.runNow && SW.runNow();
    if (r && r.sess && r.vid === b.v.id && r.sess.state === 'waiting') { var s = r.sess.m.obarray.get('SENTNO'); if (s && typeof s.value === 'number' && s.value > 1) { cb(r.sess.m, 'the program running in Run'); return; } }
    demoSession(b, function (dm) { cb(dm.sess.m, 'exchange 1, “pick up a big red block.”, run here (run your own in Run to see it instead)'); });
  }
  function drawPath(el, b, track, isDemo) {
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('Through the scene', (isDemo ? 'Exchange 1, “pick up a big red block.”, run by the bench. ' : 'The last exchange run in Run. ') + 'Drag to turn, scroll to zoom. Orchid where the hand holds something; the start is the white dot, the end the orchid one.', '<canvas class="gx-cv gx-cv3" width="900" height="640" aria-label="The hand’s path through the scene, to turn about"></canvas>', 'gx-wide') +
      cardHTML('Over time', 'The hand’s x (across), y (back) and z (height), in octal, at each of the ' + track.length + ' steps graphf moved it' + (track.some(function (q) { return q.held; }) ? '; the thicker line where it held something' : '') + '.', '<canvas class="gx-plot" width="640" height="360" aria-label="The hand’s x, y and z at each step"></canvas>', 'gx-wide') +
      '</div>';
    plot(SW.$('.gx-plot', el), track);
    var t0 = readLive(b.v.id) || readData(b);
    var v3 = new Viewer(SW.$('.gx-cv3', el), null); v3.path = track; v3.cz = 330; v3.zoom = 0.72; v3.setObjects(t0 ? objectsOf(t0) : []);
  }
  // ---------- the microworld: the objects moved with the mouse, by SHRDLU's own theorems ----------
  // Its own copy of the program, with a 340 of its own. A goal is run as SHRDLU runs a command:
  // (THVAL2 NIL '(THGOAL (!PUTON A B) (THUSE TC-PUTON))), from its break loop (Session.planner).
  var mw = null;   // { vid, sess, disp, busy, sel, ready, waiters }
  // the world's own copy of the program (shared by The microworld, What is on what, Finding space,
  // Hidden lines, The display list), started once per version
  function texts(b, cb) {
    var v = b.v, srcs = v.build.map(function (x) { return x.src; }).concat(root.SHRepairs.sources(v.id)), tx = {};
    Promise.all(srcs.map(function (s) { return SW.fetchText(s).then(function (x) { tx[s] = x; }); })).then(function () { cb(tx); });
  }
  function ensureWorld(b, cb) {
    if (mw && mw.vid === b.v.id) { if (mw.ready) cb(mw); else mw.waiters.push(cb); return; }
    if (mw && mw.sess) mw.sess.gen = (mw.sess.gen || 0) + 1;
    var me = mw = { vid: b.v.id, busy: true, sel: null, ready: false, waiters: [cb] };
    texts(b, function (tx) {
      if (mw !== me) return;
      me.disp = new root.SH340({ colour: true, solid: true, hand1970: true, labels: false });
      me.sess = new root.SHSession({ version: b.v, texts: tx, display: me.disp, animate: true, speed: 2, out: function () {} });
      me.sess.boot(function () { me.busy = false; me.ready = true; var w = me.waiters; me.waiters = []; w.forEach(function (f) { f(me); }); });
    });
  }
  // a printed Lisp value read back (in octal, as the program prints it), as plain data
  var rdr = {};
  function readValue(b, str) {
    var d = b.v.id === 'ejs' ? 'new' : 'old', m = rdr[d] || (rdr[d] = new L.Machine({ dialect: d, files: {}, out: function () {} }));
    try { return G.lisp(m.readFrom(new m.Stream(str)), m); } catch (e) { return null; }
  }
  var pfx = function (b) { return b.v.id === 'ejs' ? '!' : '#'; };   // the restoration writes # as ! (F5)
  var ACTS = [['puton', 'Put it on…', 'then click where: another object or the table', null],
              ['pickup', 'Pick it up', '', '(THGOAL (!PICKUP $X) (THUSE TC-PICKUP))'],
              ['cleartop', 'Clear its top', '', '(THGOAL (!CLEARTOP $X) (THUSE TC-CLEARTOP))'],
              ['getridof', 'Get rid of it', '', '(THGOAL (!GET-RID-OF $X) (THUSE TC-GET-RID-OF))']];
  function worldView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('The world', 'Click an object, then click where it is to go: another object, or the table. SHRDLU works out how, clearing and moving what is in the way, or refuses. The arm moves as it goes.',
        '<div class="gx-bar"><span class="mw-sel hint">Nothing chosen.</span><span class="mw-acts"></span><button class="btn ghost" data-mw="reset" title="Start the world afresh">⟳ Start afresh</button></div><div class="mw-screen"><canvas class="mw-cv" width="1024" height="1024" aria-label="The blocks world on the 340: click an object, then where it is to go"></canvas></div>', 'gx-wide mw-card') +
      cardHTML('What SHRDLU did', 'Each goal as it was given to Micro-Planner, and what came of it: done, refused (the goal failed), or stopped where one of the program’s own checks broke into its break loop.', '<ol class="mw-log"></ol>', 'gx-wide') +
      '</div>';
    var cv = SW.$('.mw-cv', el), log = SW.$('.mw-log', el), selEl = SW.$('.mw-sel', el), actsEl = SW.$('.mw-acts', el);
    function say(html, cls) { var li = document.createElement('li'); li.className = cls || ''; li.innerHTML = html; log.insertBefore(li, log.firstChild); }
    function paintSel() {
      selEl.innerHTML = mw && mw.sel ? 'Chosen: <b class="mono">' + SW.esc(mw.sel) + '</b>' : mw && mw.busy ? 'SHRDLU is working…' : 'Nothing chosen.';
      actsEl.innerHTML = mw && mw.sel ? ACTS.map(function (a) { return '<button class="btn" data-mw="' + a[0] + '"' + (mw.busy ? ' disabled' : '') + ' title="' + SW.esc(a[2]) + '">' + SW.esc(a[1]) + '</button>'; }).join('') : '';
      if (mw && mw.disp) { mw.disp.highlight = mw.sel; mw.disp.dirty(); }
    }
    function run(goal) {
      mw.busy = true; paintSel();
      say('<span class="mono">' + SW.esc(goal) + '</span> <span class="hint">…</span>', 'mw-run');
      var steps0 = mw.sess.m.steps;
      mw.sess.planner(goal, function (r) {
        mw.busy = false;
        var li = log.firstChild, n = (mw.sess.m.steps - steps0).toLocaleString('en-GB');
        li.className = r.ok ? 'mw-ok' : r.message ? 'mw-brk' : 'mw-no';
        li.innerHTML = '<span class="mono">' + SW.esc(goal) + '</span><div>' + (r.ok ? '<b>Done.</b>' : r.message ? '<b>Stopped</b> in the break loop: <span class="mono">' + SW.esc(r.message) + '</span>. SHRDLU was taken back to READY (GO).' : '<b>Refused:</b> the goal failed (<span class="mono">' + SW.esc(r.value || 'NIL') + '</span>).') + ' <span class="hint">' + n + ' steps.</span></div>';
        mw.sel = null; paintSel();
      });
    }
    function boot(fresh) {
      if (fresh) { if (mw && mw.sess) mw.sess.gen = (mw.sess.gen || 0) + 1; mw = null; }
      ensureWorld(b, function () { mw.disp.canvas = cv; mw.disp.dirty(); paintSel(); });
      paintSel();
    }
    cv.addEventListener('click', function (e) {
      if (!mw || !mw.disp || mw.busy) return;
      var rc = cv.getBoundingClientRect(), X = (e.clientX - rc.left) / rc.width * 1024, Y = 1024 - (e.clientY - rc.top) / rc.height * 1024;
      var hit = mw.disp.pickAt(X, Y);
      if (mw.pending && hit) { var a = mw.pending; mw.pending = null; run('(THGOAL (!PUTON ' + a + ' ' + hit + ') (THUSE TC-PUTON))'); return; }
      mw.sel = hit && !/TABLE/.test(hit) ? hit : null; paintSel();
      if (mw.sel) { mw.pending = mw.sel; selEl.innerHTML += ' <span class="hint">then click where it is to go, or choose below</span>'; }
    });
    el.onclick = function (e) {
      var a = e.target.closest('[data-mw]'); if (!a || a.disabled) return;
      if (a.dataset.mw === 'reset') { log.innerHTML = ''; boot(true); return; }
      var act = ACTS.filter(function (x) { return x[0] === a.dataset.mw; })[0]; if (!act || !mw.sel) return;
      if (!act[3]) { mw.pending = mw.sel; selEl.innerHTML = 'Chosen: <b class="mono">' + SW.esc(mw.sel) + '</b> <span class="hint">now click where it is to go</span>'; return; }
      mw.pending = null; run(act[3].replace('$X', mw.sel));
    };
    boot(false);
  }

  // ---------- What is on what: the Planner's #SUPPORT and #CONTAIN assertions, as a side view ----------
  function supportView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('What is on what', 'Asked of the Planner itself, in the microworld’s copy of the program: (THFIND ALL … (THGOAL (' + pfx(b) + 'SUPPORT $?X $?Y))), and the same for ' + pfx(b) + 'CONTAIN. Each object stands above what holds it up, across at its own place; what the box contains sits in the box. Move things in The microworld and look again.', '<div class="gx-bar"><button class="btn" data-sp="again">⟳ Ask again</button><span class="hint sp-note">Asking…</span></div><div class="sp-draw"></div>', 'gx-wide') + cardHTML('The assertions', '', '<ul class="sp-list mono"></ul>') + '</div>';
    function ask() {
      ensureWorld(b, function () {
        var P = pfx(b), q = function (rel, cb) { mw.sess.lisp("(THVAL2 NIL '(THFIND ALL (LIST $?X $?Y) (X Y) (THGOAL (" + P + rel + " $?X $?Y))))", function (r) { cb(readValue(b, r.value) || []); }, true); };
        q('SUPPORT', function (sup) { q('CONTAIN', function (con) { if (el.isConnected) drawSupport(el, b, sup, con); }); });
      });
    }
    el.onclick = function (e) { if (e.target.closest('[data-sp]')) ask(); };
    ask();
  }
  function drawSupport(el, b, sup, con) {
    var m = mw.sess.m, val = function (n) { var s = m.obarray.get(n); return s ? G.lisp(s.value, m) : null; };
    var at = {}, col = {}; (val('ATABLE') || []).forEach(function (e) { if (Array.isArray(e)) at[e[0]] = e; });
    (val('DISPLAY-AS') || []).forEach(function (e) { if (Array.isArray(e)) col[e[0]] = e[5]; });
    var under = {}, kids = {}; sup.forEach(function (p) { if (Array.isArray(p)) { under[p[2]] = p[1]; (kids[p[1]] = kids[p[1]] || []).push(p[2]); } });
    var inBox = {}; con.forEach(function (p) { if (Array.isArray(p)) inBox[p[2]] = p[1]; });
    var level = {}, lv = function (n) { if (level[n] != null) return level[n]; var u = under[n]; return (level[n] = !u || /TABLE/.test(u) ? 0 : lv(u) + 1); };
    var names = Object.keys(under), W = 900, H = 330, C = root.SH340.COLOURS, o = [];
    o.push('<svg viewBox="0 0 ' + W + ' ' + H + '" class="sp-svg" role="img" aria-label="What is on what"><rect width="' + W + '" height="' + H + '" fill="#05070a"/><line x1="20" y1="' + (H - 30) + '" x2="' + (W - 20) + '" y2="' + (H - 30) + '" stroke="#8a909a" stroke-width="3"/><text x="24" y="' + (H - 10) + '" fill="#8a909a" font-size="12" font-family="ui-monospace, Menlo, monospace">:TABLE</text>');
    var X = function (n) { var e = at[n]; return e ? 30 + (e[1][0] + e[2][0] / 2) / 640 * (W - 60) : W / 2; };
    // on each level, boxes that would overlap are spread apart, in order across
    var xs = {}, byLv = {};
    names.forEach(function (n) { (byLv[lv(n)] = byLv[lv(n)] || []).push(n); });
    Object.keys(byLv).forEach(function (l) { var row = byLv[l].sort(function (a2, b2) { return X(a2) - X(b2); }), last = -1e9; row.forEach(function (n) { var w0 = /BOX/.test(n) ? 140 : 76, x = Math.max(X(n), last + w0 / 2 + 6); xs[n] = x; last = x + w0 / 2; }); });
    names.sort(function (a2, b2) { return lv(a2) - lv(b2); }).forEach(function (n) {
      var x = xs[n], l = lv(n), y = H - 30 - 46 - l * 52, c = C[String(col[n] || '').toUpperCase()] || '#cfe8ff', w = 76;
      if (/BOX/.test(n)) { w = 140; o.push('<path d="M' + (x - w / 2) + ' ' + (y - 6) + ' V' + (y + 46) + ' H' + (x + w / 2) + ' V' + (y - 6) + '" fill="none" stroke="' + c + '" stroke-width="2"/>'); }
      else o.push('<rect x="' + (x - w / 2) + '" y="' + y + '" width="' + w + '" height="40" rx="3" fill="' + c + '" fill-opacity=".22" stroke="' + c + '" stroke-width="1.6"/>');
      o.push('<text x="' + x + '" y="' + (y + 25) + '" text-anchor="middle" fill="#e7e4da" font-size="13" font-family="ui-monospace, Menlo, monospace">' + SW.esc(n) + (inBox[n] ? ' ⊂ box' : '') + '</text>');
    });
    o.push('</svg>');
    SW.$('.sp-draw', el).innerHTML = o.join('');
    SW.$('.sp-note', el).textContent = sup.length + ' SUPPORT and ' + con.length + ' CONTAIN assertions.';
    SW.$('.sp-list', el).innerHTML = sup.map(function (p) { return '<li>' + SW.esc(p[1]) + ' holds up ' + SW.esc(p[2]) + '</li>'; }).concat(con.map(function (p) { return '<li>' + SW.esc(p[1]) + ' contains ' + SW.esc(p[2]) + '</li>'; })).join('');
  }

  // ---------- Finding space: FINDSPACE's own tries, recorded by wrapping GROW for one call ----------
  function spaceView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('Finding space', 'Where SHRDLU puts something down (blockl, FINDSPACE): up to nine tries, each a random point on the surface (RANDOM) which GROW widens into the largest clear rectangle about it; the first big enough is used, its middle the place. The bench wraps GROW for one call to record each try, then puts it back. Seen from above; octal units.',
      '<div class="gx-bar"><label class="check">Surface <select class="fs-surf"><option>:TABLE</option><option>:BOX</option></select></label><label class="check">Size <select class="fs-size"><option value="100 100 100">100 × 100 (a small cube)</option><option value="200 200 200" selected>200 × 200 (a large cube)</option><option value="200 300 300">200 × 300 (the big red block)</option></select></label><button class="btn" data-fs="try">Find space</button><span class="hint fs-note"></span></div><div class="fs-draw"></div>', 'gx-wide') + '</div>';
    el.onclick = function (e) {
      if (!e.target.closest('[data-fs]')) return;
      var surf = SW.$('.fs-surf', el).value, size = SW.$('.fs-size', el).value;
      SW.$('.fs-note', el).textContent = 'Asking…';
      ensureWorld(b, function () {
        var form = "(PROGN (PUTPROP 'GROW-REAL (GET 'GROW 'EXPR) 'EXPR) (SETQ *GROWS* NIL) (DEFUN GROW (A B C D) ((LAMBDA (V) (SETQ *GROWS* (CONS (LIST A V) *GROWS*)) V) (GROW-REAL A B C D))) ((LAMBDA (R) (PUTPROP 'GROW (GET 'GROW-REAL 'EXPR) 'EXPR) (LIST R (REVERSE *GROWS*))) (FINDSPACE 'RANDOM '" + surf + " '(" + size + ") NIL)))";
        mw.sess.lisp(form, function (r) { var v = readValue(b, r.value); if (el.isConnected) drawSpace(el, b, surf, size.split(' ').map(function (x) { return parseInt(x, 8); }), v, r.message); }, true);
      });
    };
    SW.$('[data-fs="try"]', el).click();
  }
  function drawSpace(el, b, surf, size, v, msg) {
    var m = mw.sess.m, val = function (n) { var s = m.obarray.get(n); return s ? G.lisp(s.value, m) : null; };
    var at = val('ATABLE') || [], col = {}; (val('DISPLAY-AS') || []).forEach(function (e) { if (Array.isArray(e)) col[e[0]] = e[5]; });
    var box = null; at.forEach(function (e) { if (e[0] === ':BOX') box = e; });
    var S = 440 / 640, W = 480, o = ['<svg viewBox="0 0 ' + W + ' ' + W + '" class="fs-svg" role="img" aria-label="The surface from above, with FINDSPACE’s tries"><rect width="' + W + '" height="' + W + '" fill="#05070a"/>'], C = root.SH340.COLOURS;
    var P = function (x, y) { return [20 + x * S, W - 20 - y * S]; }, R = function (x0, y0, x1, y1, attrs) { var a = P(x0, y1), c = P(x1, y0); return '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + (c[0] - a[0]) + '" height="' + (c[1] - a[1]) + '" ' + attrs + '/>'; };
    o.push(R(0, 0, 640, 640, 'fill="#15191f" stroke="#8a909a"'));
    at.forEach(function (e) { if (!Array.isArray(e) || /^:BW/.test(e[0]) || !Array.isArray(e[1])) return; var c = C[String(col[e[0]] || '').toUpperCase()] || '#cfe8ff'; o.push(R(e[1][0], e[1][1], e[1][0] + e[2][0], e[1][1] + e[2][1], 'fill="' + c + '" fill-opacity=".18" stroke="' + c + '"')); var t0 = P(e[1][0] + 4, e[1][1] + e[2][1] - 14); o.push('<text x="' + t0[0] + '" y="' + t0[1] + '" fill="' + c + '" font-size="10" font-family="ui-monospace, Menlo, monospace">' + SW.esc(e[0]) + '</text>'); });
    var tries = v && Array.isArray(v[1]) ? v[1] : [], place = v && Array.isArray(v[0]) ? v[0] : null;
    tries.forEach(function (tr, i) {
      var pt = tr[0], rc = tr[1], ok = rc && rc[1][0] - rc[0][0] >= size[0] && rc[1][1] - rc[0][1] >= size[1];
      if (rc) o.push(R(rc[0][0], rc[0][1], rc[1][0], rc[1][1], 'fill="none" stroke="' + (ok ? '#e58be0' : '#8a8d86') + '" stroke-dasharray="' + (ok ? '0' : '4 3') + '" stroke-width="1.5"'));
      var q = P(pt[0], pt[1]); o.push('<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4" fill="' + (ok ? '#e58be0' : '#8a8d86') + '"/><text x="' + (q[0] + 6) + '" y="' + (q[1] - 5) + '" fill="#e7e4da" font-size="11" font-family="ui-monospace, Menlo, monospace">' + (i + 1) + '</text>');
    });
    if (place) o.push(R(place[0], place[1], place[0] + size[0], place[1] + size[1], 'fill="#e58be0" fill-opacity=".25" stroke="#e58be0" stroke-width="2"'));
    o.push('</svg>');
    SW.$('.fs-draw', el).innerHTML = o.join('') + '<p class="hint">' + (msg ? 'Stopped: ' + SW.esc(msg) : place ? 'Found in ' + tries.length + ' tr' + (tries.length === 1 ? 'y' : 'ies') + ': the place (' + place.map(function (n) { return n.toString(8); }).join(' ') + '), its corner; the rectangle GROW made in orchid, the others dashed.' : 'No room found in ' + tries.length + ' tries: FINDSPACE returns NIL.') + ' Find space again for other random tries.</p>';
    SW.$('.fs-note', el).textContent = '';
  }

  // ---------- The projection: GP-PROJECT, with a point to move ----------
  function projectionView(el, b) {
    var p = -1, n = 0; b.parts.forEach(function (pt, i) { if (/graphf/.test(pt.src)) p = i; });
    if (p >= 0) b.lines[p].some(function (Lr) { if (/\(DEFUN GP-PROJECT/.test(Lr.raw)) { n = Lr.n; return true; } return false; });
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The projection' + (n ? ' <a href="#" class="mono" data-read="' + p + ':' + n + '">' + SW.esc(SW.refText(b.v.id, p, n, n, b.parts.length)) + '</a>' : ''), 'GP-PROJECT turns a place in the world (x across, y back, z up) into a point on the 340: X = 0.9 × (x + 0.75111 y + 3), Y = 0.9 × (z + 0.43302 y + 3). It is an oblique projection: x and z are drawn true, y slanted up and to the right, so the back of the table is higher and further right than its front. Move the point.',
      '<div class="pj-grid"><canvas class="pj-cv" width="1024" height="1024" aria-label="The projection, with a point to move"></canvas><div class="pj-ctl">' + ['x', 'y', 'z'].map(function (k, i) { return '<label class="pj-l"><b>' + k + '</b> <input type="range" min="0" max="832" value="' + [320, 320, 200][i] + '" data-pj="' + k + '"><span class="mono" data-pv="' + k + '"></span></label>'; }).join('') + '<pre class="pj-out mono"></pre></div></div>', 'gx-wide') + '</div>';
    el.onclick = linkRead;
    var cv = SW.$('.pj-cv', el), dt = readData(b), obs = dt ? objectsOf(dt) : [];
    function draw() {
      var g = cv.getContext('2d'), k = cv.width / 1024, H = cv.height, P = G.proj;
      var v = {}; ['x', 'y', 'z'].forEach(function (a) { v[a] = +SW.$('[data-pj="' + a + '"]', el).value; SW.$('[data-pv="' + a + '"]', el).textContent = v[a].toString(8) + ' (' + v[a] + ')'; });
      var S = function (c) { var q = P(c[0], c[1], c[2]); return [q[0] * k, H - q[1] * k]; };
      g.fillStyle = '#05070a'; g.fillRect(0, 0, cv.width, H);
      // the scene faintly
      g.globalAlpha = 0.35; g.strokeStyle = '#8a909a'; g.lineWidth = 1;
      obs.forEach(function (o) { if (!o.loc || !o.size || o.table) return; var x0 = o.loc[0], y0 = o.loc[1], z0 = o.loc[2], x1 = x0 + o.size[0], y1 = y0 + o.size[1], z1 = z0 + o.size[2]; G.boxFaces(x0, y0, z0, x1, y1, z1).forEach(function (f) { g.beginPath(); f.p.forEach(function (c, i) { var q = S(c); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke(); }); });
      g.globalAlpha = 1;
      // the table and the axes
      var T = [[0, 0, 0], [640, 0, 0], [640, 640, 0], [0, 640, 0]]; g.strokeStyle = '#8a909a'; g.beginPath(); T.forEach(function (c, i) { var q = S(c); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke();
      [[[0, 0, 0], [700, 0, 0], 'x', '#5aa2ff'], [[0, 0, 0], [0, 700, 0], 'y', '#4fdc6a'], [[0, 0, 0], [0, 0, 700], 'z', '#ff5a4e']].forEach(function (a) { var p0 = S(a[0]), p1 = S(a[1]); g.strokeStyle = g.fillStyle = a[3]; g.lineWidth = 2; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); g.font = 'bold 26px ui-monospace, Menlo, monospace'; g.fillText(a[2], p1[0] + 8, p1[1] - 8); });
      // the point: dropped to the table, and along x and y on the table
      var pt = [v.x, v.y, v.z], foot = [v.x, v.y, 0], q0 = S(pt), q1 = S(foot), qx = S([v.x, 0, 0]), qy = S([0, v.y, 0]);
      g.setLineDash([6, 5]); g.lineWidth = 1.5; g.strokeStyle = '#ff5a4e'; g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke();
      g.strokeStyle = '#4fdc6a'; g.beginPath(); g.moveTo(qx[0], qx[1]); g.lineTo(q1[0], q1[1]); g.stroke();
      g.strokeStyle = '#5aa2ff'; g.beginPath(); g.moveTo(qy[0], qy[1]); g.lineTo(q1[0], q1[1]); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#e58be0'; g.beginPath(); g.arc(q0[0], q0[1], 9, 0, 7); g.fill();
      var X = 0.9 * (v.x + 0.75111 * v.y + 3), Y = 0.9 * (v.z + 0.43302 * v.y + 3);
      SW.$('.pj-out', el).textContent = 'X = 0.9 × (' + v.x + ' + 0.75111 × ' + v.y + ' + 3) = ' + X.toFixed(1) + '\nY = 0.9 × (' + v.z + ' + 0.43302 × ' + v.y + ' + 3) = ' + Y.toFixed(1) + '\n\n(the screen: 0 to 1777 octal, 1023, both ways)\n(FIX drops the fraction: ' + Math.floor(X) + ', ' + Math.floor(Y) + ')';
    }
    el.oninput = draw; draw();
  }

  // ---------- Hidden lines: graphf's own, beside the bench's solid view ----------
  function hiddenView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' +
      cardHTML('graphf’s hidden lines', 'What the program draws: when it draws an object, GP-OPAQUE and GP-DRAWL cut its edges where they pass behind the surfaces of other objects, and draw the hidden parts with the pen up. It draws only the object that moved, so what that object now stands in front of, or behind, keeps the lines it had.', '<canvas class="hl-a" width="1024" height="1024" aria-label="The scene as the program draws it"></canvas>') +
      cardHTML('Drawn from the geometry', 'The bench’s Solid view of the same scene: every object rebuilt in three dimensions and drawn face by face, back to front. Where the two differ, graphf’s lines are stale or cut wrongly.', '<canvas class="hl-b" width="1024" height="1024" aria-label="The same scene drawn from its geometry"></canvas>') +
      cardHTML('The scene', 'The microworld’s copy of the program: move things there, then look again here.', '<div class="gx-bar"><button class="btn" data-hl="again">⟳ Look again</button><button class="btn" data-hl="world">The microworld</button></div>') + '</div>';
    function draw() { ensureWorld(b, function () { mw.disp.drawTo(SW.$('.hl-a', el), { solid: false, faces: false, colour: true, labels: false, dialogue: false, hand1970: false }); mw.disp.drawTo(SW.$('.hl-b', el), { solid: true, faces: false, colour: true, labels: false, dialogue: false, hand1970: false }); }); }
    el.onclick = function (e) { var a = e.target.closest('[data-hl]'); if (!a) return; if (a.dataset.hl === 'world') SW.openGraphic('world'); else draw(); };
    draw();
  }

  // ---------- The display list: the 340's items, and the last calls ----------
  function dlistView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The items', 'Each DISCREATE makes an item: an origin, and lines drawn relative to it (DISALINE), so that DISLOCATE moves the whole. Click an item to light it up. Names are from graphf’s own tables: GP-LINES for the objects, GP-HANDIT for the hand and arm.', '<div class="dl-grid"><canvas class="dl-cv" width="1024" height="1024" aria-label="The display, with the chosen item lit"></canvas><div class="dl-t"></div></div>', 'gx-wide') +
      cardHTML('The last calls', 'The program’s most recent calls to the display slave, oldest first, arguments as the program gave them (octal).', '<ol class="dl-calls mono"></ol>', 'gx-wide') + '</div>';
    ensureWorld(b, function () {
      var d = mw.disp, m = mw.sess.m, val = function (n) { var s = m.obarray.get(n); return s ? G.lisp(s.value, m) : null; };
      var name = {}; (val('GP-LINES') || []).forEach(function (e) { if (Array.isArray(e) && typeof e[5] === 'number') name[e[5]] = e[0]; });
      var hi = val('GP-HANDIT'); if (Array.isArray(hi)) { name[hi[2]] = 'the hand'; name[hi[4]] = 'the arm'; }
      var sel = null, cv = SW.$('.dl-cv', el);
      function draw() {
        var g = cv.getContext('2d'), k = cv.width / 1024, H = cv.height;
        g.fillStyle = '#05070a'; g.fillRect(0, 0, cv.width, H);
        d.order.forEach(function (id) { var it = d.items[id]; if (!it || !it.visible) return; g.strokeStyle = sel == null || sel === id ? '#dff2ff' : '#3a3f47'; g.lineWidth = sel === id ? 2.4 : 1.2; g.beginPath(); it.segs.forEach(function (s) { g.moveTo((it.ox + s[0]) * k, H - (it.oy + s[1]) * k); g.lineTo((it.ox + s[2]) * k, H - (it.oy + s[3]) * k); }); g.stroke(); if (sel === id) { g.fillStyle = '#e58be0'; g.beginPath(); g.arc(it.ox * k, H - it.oy * k, 6, 0, 7); g.fill(); } });
      }
      SW.$('.dl-t', el).innerHTML = '<table class="ov-sub gx-t"><thead><tr><th>Item</th><th>What</th><th>Origin</th><th>Lines</th><th>Shown</th><th>Carries</th></tr></thead><tbody>' + d.order.map(function (id) { var it = d.items[id]; return '<tr data-it="' + id + '"><td class="mono">' + id.toString(8) + '</td><td class="mono">' + SW.esc(name[id] || '') + '</td><td class="mono">(' + Math.round(it.ox).toString(8) + ' ' + Math.round(it.oy).toString(8) + ')</td><td class="num">' + it.segs.length + '</td><td>' + (it.visible ? 'yes' : 'no') + '</td><td class="mono">' + it.links.map(function (x) { return x.toString(8); }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table><p class="hint">' + d.order.length + ' items; item numbers and origins in octal. “Carries”: items DISLINKed to it, which move with it.</p>';
      SW.$('.dl-calls', el).innerHTML = (d.clog || []).slice(-80).map(function (c) { return '<li>(' + SW.esc(c.n) + ' ' + SW.esc(c.a) + ')</li>'; }).join('');
      el.onclick = function (e) { var tr = e.target.closest('tr[data-it]'); if (!tr) return; sel = +tr.dataset.it; SW.$$('tr[data-it]', el).forEach(function (x) { x.classList.toggle('on', x === tr); }); draw(); };
      draw();
    });
  }

  // ---------- What SHRDLU knows: the event memory, the goal tree, the parse ----------
  function eventsOf(m) {
    var el0 = m.obarray.get('EVENTLIST'), P = function (ev, p) { var s = m.obarray.get(p); return s ? m.get(ev, s) : m.NIL; };
    var out = []; var x = el0 ? el0.value : null;
    while (x instanceof L.Cons) { var ev = x.car; if (ev instanceof L.Sym && ev.name !== 'EE') {
      var as = m.prin1String(P(ev, 'THASSERTION')), act = /\(([#!][A-Z-]+)\s+:?E\d+\s*([^()]*)\)/.exec(as);
      out.push({ name: ev.name, type: m.princString(P(ev, 'TYPE')), why: m.princString(P(ev, 'WHY')), start: G.lisp(P(ev, 'START'), m), end: G.lisp(P(ev, 'END'), m), what: act ? (act[1] + ' ' + act[2]).trim() : '' });
    } x = x.cdr; }
    return out.reverse();
  }
  var TYPEC = { PICKUP: '#ff5a4e', PUTON: '#ff5a4e', PUT: '#ff5a4e', STACKUP: '#ff5a4e', GRASP: '#4fdc6a', UNGRASP: '#4fdc6a', CLEARTOP: '#5aa2ff', 'GET-RID-OF': '#5aa2ff', RAISEHAND: '#e58be0', MOVEHAND: '#e58be0' };
  function evColour(tp) { return TYPEC[String(tp).replace(/^[#!]/, '')] || '#cfe8ff'; }
  function eventsView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The event memory', '', '<p class="hint ev-src">Reading…</p><div class="ev-draw"></div>', 'gx-wide') + '</div>';
    knowing(b, function (m, src) {
      var evs = eventsOf(m); SW.$('.ev-src', el).textContent = 'From ' + src + '. Each event MEMORY recorded (blockl): its type, its start and end on the event clock (THTIME), and why: a command, or the event it served. Bars in time, each row under the event it served.';
      if (!evs.length) { SW.$('.ev-draw', el).innerHTML = '<p class="hint">No events yet.</p>'; return; }
      var byName = {}; evs.forEach(function (e) { byName[e.name] = e; });
      var depth = function (e) { var d = 0, w = e; while (w && byName[w.why] && d < 12) { w = byName[w.why]; d++; } return d; };
      var tmax = Math.max.apply(null, evs.map(function (e) { return typeof e.end === 'number' ? e.end : typeof e.start === 'number' ? e.start : 0; })) || 1;
      var W = 900, rh = 26, H = evs.length * rh + 40, X = function (tt) { return 200 + tt / tmax * (W - 420); }, o = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="ev-svg" role="img" aria-label="The event memory in time"><rect width="' + W + '" height="' + H + '" fill="#05070a"/>'];
      for (var tt = 0; tt <= tmax; tt++) o.push('<line x1="' + X(tt) + '" y1="10" x2="' + X(tt) + '" y2="' + (H - 24) + '" stroke="#1d2129"/><text x="' + X(tt) + '" y="' + (H - 8) + '" fill="#8a8d86" font-size="11" text-anchor="middle" font-family="ui-monospace, Menlo, monospace">' + tt + '</text>');
      evs.sort(function (a2, b2) { return (a2.start || 0) - (b2.start || 0) || depth(a2) - depth(b2); }).forEach(function (e, i) {
        var y = 14 + i * rh, s = typeof e.start === 'number' ? e.start : 0, en = typeof e.end === 'number' ? e.end : s, c = evColour(e.type), dx = depth(e) * 14;
        o.push('<text x="' + (8 + dx) + '" y="' + (y + 15) + '" fill="' + c + '" font-size="12" font-family="ui-monospace, Menlo, monospace">' + SW.esc(e.name + ' ' + e.type) + '</text>');
        o.push('<rect x="' + X(s) + '" y="' + (y + 3) + '" width="' + Math.max(4, X(en) - X(s)) + '" height="' + (rh - 8) + '" rx="3" fill="' + c + '" fill-opacity=".35" stroke="' + c + '"><title>' + SW.esc(e.name + ' ' + e.what + ', why: ' + e.why + ', from ' + s + ' to ' + en) + '</title></rect>');
        o.push('<text x="' + (X(en) + 6) + '" y="' + (y + 15) + '" fill="#8a8d86" font-size="11" font-family="ui-monospace, Menlo, monospace">' + SW.esc(e.what) + (byName[e.why] ? ' · for ' + SW.esc(e.why) : e.why === 'COMMAND' ? ' · the command' : '') + '</text>');
      });
      o.push('</svg>');
      SW.$('.ev-draw', el).innerHTML = o.join('');
    });
  }
  function goalsView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The goal tree', '', '<p class="hint gt-src">Reading…</p><div class="gt-draw"></div>', 'gx-wide') + '</div>';
    knowing(b, function (m, src) {
      var evs = eventsOf(m); SW.$('.gt-src', el).textContent = 'From ' + src + '. The goals the command set off, each drawn under the goal it served (the event’s WHY). This is the record SHRDLU answers “why did you …?” from: it climbs the tree.';
      if (!evs.length) { SW.$('.gt-draw', el).innerHTML = '<p class="hint">No events yet.</p>'; return; }
      var kids = {}, roots = [], byName = {}; evs.forEach(function (e) { byName[e.name] = e; });
      evs.forEach(function (e) { if (byName[e.why]) (kids[e.why] = kids[e.why] || []).push(e); else roots.push(e); });
      var W = 900, lw = 150, col = 0, pos = {}, maxd = 0;
      (function lay(list, d) { list.forEach(function (e) { maxd = Math.max(maxd, d); var ch = kids[e.name] || []; if (!ch.length) { pos[e.name] = { x: col++, d: d }; } else { lay(ch, d + 1); var xs = ch.map(function (c) { return pos[c.name].x; }); pos[e.name] = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, d: d }; } }); })(roots, 0);
      var cw = Math.max(lw + 10, (W - 20) / Math.max(1, col)), H = (maxd + 1) * 90 + 30, o = ['<svg viewBox="0 0 ' + Math.max(W, col * cw + 20) + ' ' + H + '" class="gt-svg" role="img" aria-label="The goal tree"><rect width="100%" height="100%" fill="#05070a"/>'];
      var XY = function (e) { var p0 = pos[e.name]; return [20 + p0.x * cw + cw / 2, 30 + p0.d * 90]; };
      evs.forEach(function (e) { if (byName[e.why]) { var a = XY(byName[e.why]), c = XY(e); o.push('<path d="M' + a[0] + ' ' + (a[1] + 44) + ' C' + a[0] + ' ' + (a[1] + 70) + ' ' + c[0] + ' ' + (c[1] - 26) + ' ' + c[0] + ' ' + c[1] + '" fill="none" stroke="#3a3f47" stroke-width="1.5"/>'); } });
      evs.forEach(function (e) { var p1 = XY(e), c = evColour(e.type); o.push('<rect x="' + (p1[0] - lw / 2) + '" y="' + p1[1] + '" width="' + lw + '" height="44" rx="6" fill="' + c + '" fill-opacity=".16" stroke="' + c + '"/><text x="' + p1[0] + '" y="' + (p1[1] + 18) + '" text-anchor="middle" fill="' + c + '" font-size="13" font-family="ui-monospace, Menlo, monospace">' + SW.esc(e.type) + '</text><text x="' + p1[0] + '" y="' + (p1[1] + 35) + '" text-anchor="middle" fill="#e7e4da" font-size="11" font-family="ui-monospace, Menlo, monospace">' + SW.esc(e.name + ' ' + e.what.replace(/^[#!][A-Z-]+\s*/, '')) + '</text>'); });
      o.push('</svg>');
      SW.$('.gt-draw', el).innerHTML = o.join('');
    });
  }
  function parseView(el, b) {
    el.innerHTML = '<div class="cards gx-cards">' + cardHTML('The parse', '', '<p class="hint pt-src">Reading…</p><div class="pt-draw"></div>', 'gx-wide') + '</div>';
    knowing(b, function (m, src) {
      var reg = function (node, r) { var s = m.obarray.get(r); return node instanceof L.Cons && s ? m.get(node.car, s) : m.NIL; };
      var lst = function (x) { var a = []; while (x instanceof L.Cons) { a.push(x.car); x = x.cdr; } return a; };
      var words = function (node) { var a = reg(node, 'FIRSTWORD'), z = reg(node, 'WORDAFTER'), out = []; while (a instanceof L.Cons && a !== z && out.length < 40) { out.push(m.princString(a.car)); a = a.cdr; } return out.join(' '); };
      var cs = m.obarray.get('C'), top = cs ? cs.value : null;
      SW.$('.pt-src', el).textContent = 'From ' + src + '. The top node C, each node a unit PROGRAMMAR built: its first feature (CLAUSE, NG, VG, PREPG, ADJG, or a word class) over the words it covers; hover a node for all its features.';
      if (!(top instanceof L.Cons)) { SW.$('.pt-draw', el).innerHTML = '<p class="hint">No parse yet.</p>'; return; }
      var nodes = [], col = 0;
      (function lay(node, d) { var ds = [], x = reg(node, 'DAUGHTERS'); while (x instanceof L.Cons && ds.length < 40) { ds.push(x); x = x.cdr; } ds.reverse(); var me = { node: node, d: d, kids: [] }; nodes.push(me); if (!ds.length) me.x = col++; else { ds.forEach(function (c) { me.kids.push(lay(c, d + 1)); }); me.x = (me.kids[0].x + me.kids[me.kids.length - 1].x) / 2; } return me; })(top, 0);
      var cw = 110, W = Math.max(900, col * cw + 40), maxd = Math.max.apply(null, nodes.map(function (n2) { return n2.d; })), H = (maxd + 1) * 78 + 40;
      var XY = function (n2) { return [20 + n2.x * cw + cw / 2, 26 + n2.d * 78]; }, o = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="pt-svg" role="img" aria-label="The parse tree"><rect width="100%" height="100%" fill="#05070a"/>'];
      nodes.forEach(function (n2) { var a = XY(n2); n2.kids.forEach(function (k2) { var c = XY(k2); o.push('<line x1="' + a[0] + '" y1="' + (a[1] + 30) + '" x2="' + c[0] + '" y2="' + (c[1] - 4) + '" stroke="#3a3f47" stroke-width="1.5"/>'); }); });
      nodes.forEach(function (n2) { var a = XY(n2), fe = lst(reg(n2.node, 'FEATURES')).map(function (f) { return m.princString(f); }), wd = words(n2.node), leaf = !n2.kids.length;
        o.push('<g><title>' + SW.esc(fe.join(' ') + ': ' + wd) + '</title><text x="' + a[0] + '" y="' + (a[1] + 10) + '" text-anchor="middle" fill="#4d92e0" font-size="13" font-weight="600" font-family="ui-monospace, Menlo, monospace">' + SW.esc(fe[0] || '') + '</text><text x="' + a[0] + '" y="' + (a[1] + 27) + '" text-anchor="middle" fill="' + (leaf ? '#e7e4da' : '#8a8d86') + '" font-size="' + (leaf ? 13 : 11) + '" font-family="ui-monospace, Menlo, monospace">' + SW.esc(leaf ? wd : wd.length > 22 ? wd.slice(0, 21) + '…' : wd) + '</text></g>'); });
      o.push('</svg>');
      SW.$('.pt-draw', el).innerHTML = o.join('');
    });
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
    ({ world: worldView, support: supportView, space: spaceView, projection: projectionView, hidden: hiddenView, dlist: dlistView, events: eventsView, goals: goalsView, parse: parseView, crane: craneView, path: pathView, hand: handView }[gid] || objectsView)(body, b);
  } };
})(this);
