/* Hero "blocks world", a homage to the original SHRDLU display: white
   wireframe solids on a black CRT, an arm that lifts a cube in a slow loop.
   Behind it, a faint isometric grid drifts and parallaxes for depth.
   Stroke-only vector line-drawing with a phosphor glow and slight CRT wobble.
   Decorative; honours prefers-reduced-motion (static, no drift/parallax). */
(function () {
  var canvas = document.getElementById('blockworld');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, DPR, ox, oy, U, t = 0, raf;
  // pointer parallax: target (tx,ty) eased into (px,py), normalised about centre
  var tx = 0, ty = 0, px = 0, py = 0;

  function iso(gx, gy, z) {
    return { x: ox + (gx - gy) * U, y: oy + (gx + gy) * U * 0.46 - z * U };
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var narrow = W < 880;
    U = Math.max(20, Math.min(40, W / 32));
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

  function arm(topCorners) {
    var cx = (topCorners[0].x + topCorners[2].x) / 2;
    var cy = (topCorners[0].y + topCorners[2].y) / 2;
    var wrist = { x: cx, y: cy - U * 1.6 };
    ctx.save();
    ctx.strokeStyle = 'rgba(234,240,247,0.5)';
    edge({ x: cx, y: -10 }, wrist);
    edge({ x: cx - U * 0.42, y: wrist.y }, { x: cx + U * 0.42, y: wrist.y });
    for (var i = 1; i < 4; i++) edge(wrist, topCorners[i]);
    ctx.restore();
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.3)';
    var a = iso(-4, -2, 0), b = iso(4, -2, 0), c = iso(4, 4, 0), d = iso(-4, 4, 0);
    ctx.beginPath(); moveTo(a); lineTo(b); lineTo(c); lineTo(d); lineTo(a); ctx.stroke();
    ctx.restore();
  }

  // faint full-bleed isometric grid, the coordinate space behind the scene
  function bgGrid(offx, offy) {
    var bx = W * 0.5 + offx, by = H * 0.46 + offy, gu = U * 1.15, R = 22;
    function p(gx, gy) { return { x: bx + (gx - gy) * gu, y: by + (gx + gy) * gu * 0.46 }; }
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(150,205,175,0.05)';
    ctx.shadowBlur = 0;
    for (var g = -R; g <= R; g += 2) {
      ctx.beginPath(); moveTo(p(g, -R)); lineTo(p(g, R)); ctx.stroke();
      ctx.beginPath(); moveTo(p(-R, g)); lineTo(p(R, g)); ctx.stroke();
    }
    ctx.restore();
  }

  var PERIOD = 520;
  function liftHeight() {
    if (reduce) return 0;
    var u = (t % PERIOD) / PERIOD;
    var ease = function (a) { return a*a*(3 - 2*a); };
    if (u < 0.18) return 0;
    if (u < 0.40) return ease((u - 0.18) / 0.22) * 1.4;
    if (u < 0.60) return 1.4;
    if (u < 0.82) return (1 - ease((u - 0.60) / 0.22)) * 1.4;
    return 0;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // ease parallax toward the pointer target
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    var wob = reduce ? 0 : Math.sin(t * 0.05) * 0.6 + Math.sin(t * 1.7) * 0.3;
    var wobY = reduce ? 0 : Math.cos(t * 0.043) * 0.5;
    var driftX = reduce ? 0 : Math.sin(t * 0.005) * 10;
    var driftY = reduce ? 0 : Math.cos(t * 0.004) * 7;

    // background: faint grid, moves a little (far layer) + slow drift
    ctx.save();
    ctx.translate(px * 9 + driftX, py * 7 + driftY);
    bgGrid(0, 0);
    ctx.restore();

    // foreground: the scene, moves more (near layer) + CRT wobble
    ctx.save();
    ctx.translate(px * 24 + wob, py * 17 + wobY);
    ctx.lineWidth = Math.max(1, U / 32);
    ctx.strokeStyle = 'rgba(234,240,247,0.82)';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(200,224,255,0.45)';
    ctx.shadowBlur = Math.max(3, U / 9);

    ground();
    var lift = liftHeight();
    var held = wireCube(-2.2, 0.0, lift, 1.5, 1.4);
    arm(held);
    wireCube(2.2, 0.6, 0, 1.6, 1.5);
    wirePyramid(2.2, 0.6, 1.5, 1.05);
    wireOpenBox(0.4, 2.4, 0, 0.95, 0.6);
    ctx.restore();

    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth) - 0.5;
      ty = (e.clientY / window.innerHeight) - 0.5;
    }, { passive: true });
  }
  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
