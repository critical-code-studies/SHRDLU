/* Hero "blocks world" — a homage to the original SHRDLU display: white
   wireframe solids on a black CRT, a gripper hung from above on its line,
   an open box, a pyramid on a stack. Stroke-only vector line-drawing with a
   faint phosphor glow and a slight CRT wobble. Decorative only; honours
   prefers-reduced-motion (static, no wobble). */
(function () {
  var canvas = document.getElementById('blockworld');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, DPR, ox, oy, U, t = 0, raf;

  // grid -> screen, axonometric. U is the unit (tile) size; flattened a little
  // to echo the low, receding ground plane of the original screen photograph.
  function iso(gx, gy, z) {
    return {
      x: ox + (gx - gy) * U,
      y: oy + (gx + gy) * U * 0.46 - z * U
    };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    U = Math.max(26, Math.min(46, W / 24));
    // anchor the scene toward the lower right; the headline sits lower-left
    ox = W * 0.60; oy = H * 0.60;
  }

  function moveTo(p) { ctx.moveTo(p.x, p.y); }
  function lineTo(p) { ctx.lineTo(p.x, p.y); }
  function edge(a, b) { ctx.beginPath(); moveTo(a); lineTo(b); ctx.stroke(); }

  // 12 edges of a box from (x0,y0,z0) to (x1,y1,z1)
  function wireCube(gx, gy, z0, s, h) {
    var x0 = gx - s/2, x1 = gx + s/2, y0 = gy - s/2, y1 = gy + s/2, z1 = z0 + (h || s);
    var b = [iso(x0,y0,z0), iso(x1,y0,z0), iso(x1,y1,z0), iso(x0,y1,z0)];
    var tp = [iso(x0,y0,z1), iso(x1,y0,z1), iso(x1,y1,z1), iso(x0,y1,z1)];
    ctx.beginPath();
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]); // bottom
    moveTo(tp[0]); lineTo(tp[1]); lineTo(tp[2]); lineTo(tp[3]); lineTo(tp[0]); // top
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(tp[i]); } // verticals
    ctx.stroke();
    return tp; // return top corners (for the gripper / stacking)
  }

  // open box (no top face), with a few vertical hatch lines on the near face
  function wireOpenBox(gx, gy, z0, s, h) {
    var x0 = gx - s/2, x1 = gx + s/2, y0 = gy - s/2, y1 = gy + s/2, z1 = z0 + h;
    var b = [iso(x0,y0,z0), iso(x1,y0,z0), iso(x1,y1,z0), iso(x0,y1,z0)];
    var tp = [iso(x0,y0,z1), iso(x1,y0,z1), iso(x1,y1,z1), iso(x0,y1,z1)];
    ctx.beginPath();
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]);
    moveTo(tp[0]); lineTo(tp[1]); lineTo(tp[2]); lineTo(tp[3]); lineTo(tp[0]); // open rim
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(tp[i]); }
    ctx.stroke();
    // hatch on the near (front, +y) face: between b[2]-b[3] and tp[2]-tp[3]
    for (var k = 1; k <= 3; k++) {
      var f = k / 4;
      var lo = { x: b[3].x + (b[2].x - b[3].x) * f, y: b[3].y + (b[2].y - b[3].y) * f };
      var hi = { x: tp[3].x + (tp[2].x - tp[3].x) * f, y: tp[3].y + (tp[2].y - tp[3].y) * f };
      edge(lo, hi);
    }
    return tp;
  }

  function wirePyramid(gx, gy, z0, s) {
    var x0 = gx - s/2, x1 = gx + s/2, y0 = gy - s/2, y1 = gy + s/2;
    var b = [iso(x0,y0,z0), iso(x1,y0,z0), iso(x1,y1,z0), iso(x0,y1,z0)];
    var apex = iso(gx, gy, z0 + s * 1.15);
    ctx.beginPath();
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]); // base
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(apex); }
    ctx.stroke();
  }

  // the SHRDLU gripper: a line dropping from the top of the frame to a small
  // wrist bar, then a funnel of lines splaying down to the four top corners of
  // the gripped cube.
  function gripper(topCorners) {
    var cx = (topCorners[0].x + topCorners[2].x) / 2;
    var cy = (topCorners[0].y + topCorners[2].y) / 2;
    var wristY = cy - U * 1.7;
    var wrist = { x: cx, y: wristY };
    edge({ x: cx, y: -10 }, wrist);                 // the long line from above
    edge({ x: cx - U * 0.5, y: wristY }, { x: cx + U * 0.5, y: wristY }); // wrist bar
    for (var i = 0; i < 4; i++) edge(wrist, topCorners[i]); // funnel
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.42)';
    var a = iso(-5, -2, 0), b = iso(6, -2, 0), c = iso(6, 5, 0), d = iso(-5, 5, 0);
    ctx.beginPath(); moveTo(a); lineTo(b); lineTo(c); lineTo(d); lineTo(a); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // CRT wobble: a small whole-scene translation + jitter (skipped if reduced)
    var jx = 0, jy = 0;
    if (!reduce) {
      jx = Math.sin(t * 0.05) * 0.6 + (Math.sin(t * 1.7) * 0.3);
      jy = Math.cos(t * 0.043) * 0.5;
    }
    ctx.save();
    ctx.translate(jx, jy);

    ctx.lineWidth = Math.max(1, U / 30);
    ctx.strokeStyle = 'rgba(234,240,247,0.9)';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(200,224,255,0.55)';
    ctx.shadowBlur = Math.max(4, U / 6);

    ground();

    // left: the gripped cube, raised slightly off the ground as if just lifted
    var gripped = wireCube(-2.4, 0.2, 0.25, 1.5, 1.4);
    gripper(gripped);

    // an empty cube beside it
    wireCube(-0.3, -0.4, 0, 1.4, 1.3);

    // right: a tall stack, large cube -> open box -> pyramid
    var bigTop = wireCube(2.6, 0.7, 0, 1.7, 1.5);
    wireOpenBox(2.6, 0.7, 1.5, 1.35, 0.8);
    wirePyramid(2.6, 0.7, 2.3, 1.0);

    // a small bin (open box) at the front
    wireOpenBox(0.9, 2.6, 0, 0.8, 0.55);

    ctx.restore();

    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
