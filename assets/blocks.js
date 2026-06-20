/* Hero "blocks world" — an axonometric line-drawing of SHRDLU's tabletop:
   cubes, pyramids and a box on a faint table grid, in the blocks-world primaries.
   A quiet homage to the DEC-340 line display. Decorative only; honours
   prefers-reduced-motion (draws a static scene, no animation). */
(function () {
  var canvas = document.getElementById('blockworld');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, DPR, ox, oy, t = 0, raf;
  var TILE = 30, CUBE = 30; // iso tile half-width and cube height in px (scaled below)

  var COL = {
    red:   { top: '#e25141', l: '#a83a2f', r: '#c4463a' },
    green: { top: '#57b86b', l: '#3f8a50', r: '#4aa45f' },
    blue:  { top: '#4d92e0', l: '#356aa6', r: '#427fc4' },
    amber: { top: '#f2ab3c', l: '#bd842c', r: '#d89633' }
  };

  // The scene: a hand-laid arrangement keyed loosely to the canonical demo
  // (green cubes supporting pyramids, a tall blue block, a box).
  // grid coords (gx, gy) on the table; z = stack height in cube units.
  var SCENE = [
    { gx: -2, gy: 1,  z: 0, k: 'cube', size: 1.0, c: 'green' },
    { gx: -2, gy: 1,  z: 1, k: 'pyr',  size: 0.8, c: 'red'   },
    { gx: 0,  gy: 0,  z: 0, k: 'cube', size: 1.0, c: 'red'   },
    { gx: 0,  gy: 0,  z: 1, k: 'cube', size: 0.82, c: 'green' },
    { gx: 0,  gy: 0,  z: 2, k: 'pyr',  size: 0.7, c: 'green' },
    { gx: 2,  gy: 1,  z: 0, k: 'cube', size: 1.3, c: 'blue'  },
    { gx: 1,  gy: 3,  z: 0, k: 'pyr',  size: 1.0, c: 'amber' },
    { gx: -1, gy: 4,  z: 0, k: 'box',  size: 1.0, c: 'green' }
  ];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var s = Math.max(0.7, Math.min(1.35, W / 1000));
    TILE = 34 * s; CUBE = 30 * s;
    // anchor the scene toward the right so it sits behind/around the headline
    ox = W * 0.66; oy = H * 0.42;
  }

  // isometric projection of a grid point at height z (in cube units)
  function iso(gx, gy, z) {
    return {
      x: ox + (gx - gy) * TILE,
      y: oy + (gx + gy) * TILE * 0.5 - z * CUBE
    };
  }

  function lineTo(p, move) { if (move) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }

  function face(pts, fill) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) lineTo(pts[i], i === 0);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(231,228,218,0.85)';
    ctx.stroke();
  }

  function drawCube(o) {
    var s = o.size, c = COL[o.c];
    var x0 = o.gx - s/2, x1 = o.gx + s/2, y0 = o.gy - s/2, y1 = o.gy + s/2;
    var z0 = o.z, z1 = o.z + s;
    // top
    face([iso(x0,y0,z1), iso(x1,y0,z1), iso(x1,y1,z1), iso(x0,y1,z1)], c.top);
    // left (front-left face, +x edge toward viewer)
    face([iso(x1,y0,z0), iso(x1,y1,z0), iso(x1,y1,z1), iso(x1,y0,z1)], c.r);
    // right (front face toward +y)
    face([iso(x0,y1,z0), iso(x1,y1,z0), iso(x1,y1,z1), iso(x0,y1,z1)], c.l);
  }

  function drawPyramid(o) {
    var s = o.size, c = COL[o.c];
    var x0 = o.gx - s/2, x1 = o.gx + s/2, y0 = o.gy - s/2, y1 = o.gy + s/2;
    var z0 = o.z, apex = iso(o.gx, o.gy, o.z + s * 1.25);
    var b1 = iso(x1,y0,z0), b2 = iso(x1,y1,z0), b3 = iso(x0,y1,z0);
    face([b1, b2, apex], c.r);   // right visible face
    face([b2, b3, apex], c.l);   // left visible face
  }

  function drawBox(o) {
    // an open container: a low wireframe well
    var s = o.size * 1.6;
    var x0 = o.gx - s/2, x1 = o.gx + s/2, y0 = o.gy - s/2, y1 = o.gy + s/2;
    var d = 0.5;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(87,184,107,0.75)';
    // floor
    face([iso(x0,y0,0), iso(x1,y0,0), iso(x1,y1,0), iso(x0,y1,0)], 'rgba(87,184,107,0.10)');
    // two visible walls
    ctx.beginPath();
    lineTo(iso(x1,y0,0), true); lineTo(iso(x1,y0,d)); lineTo(iso(x1,y1,d)); lineTo(iso(x1,y1,0));
    lineTo(iso(x0,y1,0)); lineTo(iso(x0,y1,d)); lineTo(iso(x1,y1,d));
    ctx.strokeStyle = 'rgba(87,184,107,0.8)'; ctx.stroke();
  }

  function drawGrid() {
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(231,228,218,0.07)';
    var R = 6;
    for (var g = -R; g <= R; g++) {
      ctx.beginPath(); lineTo(iso(g, -R, 0), true); lineTo(iso(g, R, 0)); ctx.stroke();
      ctx.beginPath(); lineTo(iso(-R, g, 0), true); lineTo(iso(R, g, 0)); ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // gentle breathing offset for the whole scene (skipped if reduced motion)
    var bob = reduce ? 0 : Math.sin(t * 0.012) * 5;
    var oy0 = oy; oy = oy0 + bob;

    drawGrid();
    // painter's order: sort by (gx+gy) then z so nearer objects draw later
    var order = SCENE.slice().sort(function (a, b) {
      return (a.gx + a.gy + a.z * 0.01) - (b.gx + b.gy + b.z * 0.01);
    });
    for (var i = 0; i < order.length; i++) {
      var o = order[i];
      if (o.k === 'cube') drawCube(o);
      else if (o.k === 'pyr') drawPyramid(o);
      else if (o.k === 'box') drawBox(o);
    }
    oy = oy0;
    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
