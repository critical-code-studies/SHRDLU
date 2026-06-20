/* Hero "blocks world", a homage to the original SHRDLU display: white
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
    var narrow = W < 880;
    U = Math.max(20, Math.min(40, W / 32));
    // scene anchored to the LEFT third so it clears the right-hand wordmark column
    ox = narrow ? W * 0.50 : W * 0.23;
    oy = narrow ? H * 0.66 : H * 0.55;
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
    ctx.save();
    ctx.strokeStyle = 'rgba(234,240,247,0.5)';   // dimmer so the arm reads quietly
    edge({ x: cx, y: -10 }, wrist);
    edge({ x: cx - U * 0.42, y: wrist.y }, { x: cx + U * 0.42, y: wrist.y });
    for (var i = 1; i < 4; i++) edge(wrist, topCorners[i]); // skip the occluded back corner
    ctx.restore();
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.3)';
    var a = iso(-4, -2, 0), b = iso(4, -2, 0), c = iso(4, 4, 0), d = iso(-4, 4, 0);
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

    ctx.lineWidth = Math.max(1, U / 32);
    ctx.strokeStyle = 'rgba(234,240,247,0.82)';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(200,224,255,0.45)';
    ctx.shadowBlur = Math.max(3, U / 9);

    ground();

    // three clear objects, well spaced, no overlap:
    // 1) the cube the arm is working, lifted by the pick-and-place cycle
    var lift = liftHeight();
    var held = wireCube(-2.2, 0.0, lift, 1.5, 1.4);
    arm(held);

    // 2) a cube with a pyramid on top
    wireCube(2.2, 0.6, 0, 1.6, 1.5);
    wirePyramid(2.2, 0.6, 1.5, 1.05);

    // 3) a single open box (the bin)
    wireOpenBox(0.4, 2.4, 0, 0.95, 0.6);

    ctx.restore();

    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
