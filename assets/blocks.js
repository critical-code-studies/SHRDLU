/* Hero "blocks world" — a homage to the original SHRDLU display: white
   wireframe solids on a black CRT, an arm/gripper that descends, grips a
   cube, lifts it and sets it back in a slow loop. Stroke-only vector
   line-drawing with a faint phosphor glow and a slight CRT wobble.
   Decorative only; honours prefers-reduced-motion (static, arm at rest). */
(function () {
  var canvas = document.getElementById('blockworld');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, DPR, ox, oy, U, t = 0, raf;

  // grid -> screen, axonometric, flattened to echo the receding ground plane
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
    var narrow = W < 760;
    U = Math.max(24, Math.min(44, W / 26));
    // scene anchored to the LEFT (the wordmark sits on the right)
    ox = narrow ? W * 0.50 : W * 0.30;
    oy = narrow ? H * 0.66 : H * 0.58;
  }

  function moveTo(p) { ctx.moveTo(p.x, p.y); }
  function lineTo(p) { ctx.lineTo(p.x, p.y); }
  function edge(a, b) { ctx.beginPath(); moveTo(a); lineTo(b); ctx.stroke(); }

  function wireCube(gx, gy, z0, s, h) {
    var x0 = gx - s/2, x1 = gx + s/2, y0 = gy - s/2, y1 = gy + s/2, z1 = z0 + (h || s);
    var b = [iso(x0,y0,z0), iso(x1,y0,z0), iso(x1,y1,z0), iso(x0,y1,z0)];
    var tp = [iso(x0,y0,z1), iso(x1,y0,z1), iso(x1,y1,z1), iso(x0,y1,z1)];
    ctx.beginPath();
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]);
    moveTo(tp[0]); lineTo(tp[1]); lineTo(tp[2]); lineTo(tp[3]); lineTo(tp[0]);
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(tp[i]); }
    ctx.stroke();
    return tp;
  }

  function wireOpenBox(gx, gy, z0, s, h) {
    var x0 = gx - s/2, x1 = gx + s/2, y0 = gy - s/2, y1 = gy + s/2, z1 = z0 + h;
    var b = [iso(x0,y0,z0), iso(x1,y0,z0), iso(x1,y1,z0), iso(x0,y1,z0)];
    var tp = [iso(x0,y0,z1), iso(x1,y0,z1), iso(x1,y1,z1), iso(x0,y1,z1)];
    ctx.beginPath();
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]);
    moveTo(tp[0]); lineTo(tp[1]); lineTo(tp[2]); lineTo(tp[3]); lineTo(tp[0]);
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(tp[i]); }
    ctx.stroke();
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
    moveTo(b[0]); lineTo(b[1]); lineTo(b[2]); lineTo(b[3]); lineTo(b[0]);
    for (var i = 0; i < 4; i++) { moveTo(b[i]); lineTo(apex); }
    ctx.stroke();
  }

  // the arm: a line from the top of the frame down to a wrist bar, then a
  // funnel of lines to the four top corners of the cube it is holding.
  function arm(topCorners) {
    var cx = (topCorners[0].x + topCorners[2].x) / 2;
    var cy = (topCorners[0].y + topCorners[2].y) / 2;
    var wrist = { x: cx, y: cy - U * 1.6 };
    edge({ x: cx, y: -10 }, wrist);
    edge({ x: cx - U * 0.5, y: wrist.y }, { x: cx + U * 0.5, y: wrist.y });
    for (var i = 0; i < 4; i++) edge(wrist, topCorners[i]);
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.42)';
    var a = iso(-5, -2, 0), b = iso(6, -2, 0), c = iso(6, 5, 0), d = iso(-5, 5, 0);
    ctx.beginPath(); moveTo(a); lineTo(b); lineTo(c); lineTo(d); lineTo(a); ctx.stroke();
    ctx.restore();
  }

  // pick-and-place cycle for the left cube: settle, grip, lift, hold, lower.
  // returns the cube's current base height in cube units.
  var PERIOD = 520;
  function liftHeight() {
    if (reduce) return 0;
    var u = (t % PERIOD) / PERIOD;            // 0..1
    var ease = function (a) { return a*a*(3 - 2*a); }; // smoothstep
    if (u < 0.18) return 0;                    // grounded, arm settling
    if (u < 0.40) return ease((u - 0.18) / 0.22) * 1.4;   // rising
    if (u < 0.60) return 1.4;                  // held aloft
    if (u < 0.82) return (1 - ease((u - 0.60) / 0.22)) * 1.4; // lowering
    return 0;                                  // grounded
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    var jx = 0, jy = 0;
    if (!reduce) {
      jx = Math.sin(t * 0.05) * 0.6 + Math.sin(t * 1.7) * 0.3;
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

    // left: the cube the arm is working, lifted by the pick-and-place cycle
    var lift = liftHeight();
    var held = wireCube(-2.4, 0.2, lift, 1.5, 1.4);
    arm(held);

    // an empty cube beside it
    wireCube(-0.3, -0.4, 0, 1.4, 1.3);

    // right: a tall stack, large cube -> open box -> pyramid
    wireCube(2.6, 0.7, 0, 1.7, 1.5);
    wireOpenBox(2.6, 0.7, 1.5, 1.35, 0.8);
    wirePyramid(2.6, 0.7, 2.3, 1.0);

    // a small bin at the front
    wireOpenBox(0.9, 2.6, 0, 0.8, 0.55);

    ctx.restore();

    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
