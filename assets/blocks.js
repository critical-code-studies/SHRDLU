/* Hero "blocks world", a homage to the original SHRDLU display: white
   wireframe solids on a black CRT: an open box, a pyramid-capped block and a
   loose cube populate the scene, while an arm very slowly lifts one block and
   sets it down inside the box, then carries it back out, the canonical "put the
   block in the box". Stroke-only vector line-drawing with a
   phosphor glow. The static furniture is drawn dim so the eye follows the one
   block in motion. No idle sway; the only motion is the arm's work and an
   optional faint pointer parallax. Honours prefers-reduced-motion (static). */
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

  // The gantry arm: a post from the top of the frame to the wrist, a gripper
  // bar, and (only while gripping) four fingers angling down to the cube's top
  // corners. fingerAlpha fades the fingers in on grip and out on release.
  function drawArm(topCorners, wrist, fingerAlpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(234,240,247,0.5)';
    edge({ x: wrist.x, y: -10 }, wrist);
    edge({ x: wrist.x - U * 0.42, y: wrist.y }, { x: wrist.x + U * 0.42, y: wrist.y });
    if (fingerAlpha > 0.01) {
      ctx.strokeStyle = 'rgba(234,240,247,' + (0.5 * fingerAlpha).toFixed(3) + ')';
      for (var i = 1; i < 4; i++) edge(wrist, topCorners[i]);
    }
    ctx.restore();
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.28)';
    var a = iso(-4, -2, 0), b = iso(4, -2, 0), c = iso(4, 4, 0), d = iso(-4, 4, 0);
    ctx.beginPath(); moveTo(a); lineTo(b); lineTo(c); lineTo(d); lineTo(a); ctx.stroke();
    ctx.restore();
  }

  // The arm moves one block: mostly in and out of the open box ("put the block
  // in the box"), and now and then it stacks the block on the loose cube
  // instead. The rest of the scene (box, pyramid-capped block, loose cube) stays put.
  var CUBE_S = 1.1, CUBE_H = 1.0;
  var STATIONS = [
    { gx: 0.0,  gy: 2.6, z: 0.0 },    // 0: on the open ground, front
    { gx: 2.3,  gy: 1.0, z: 0.0 },    // 1: set down inside the open box
    { gx: -0.9, gy: -0.7, z: 1.0 }    // 2: stacked on top of the loose cube
  ];
  // the order the block visits, looping: in/out of the box, with an occasional
  // trip to stack it on the loose cube (station 2)
  var SEQUENCE = [0, 1, 0, 1, 0, 2, 0, 1, 0, 2];
  var TRAVEL_Z = 1.95;                 // base height the cube is carried at (clears the box wall)
  var GRIP_LIFT = 1.3, PARK_LIFT = 2.6;
  // phase lengths (frames) — very slow and deliberate: rest (set down, arm
  // waits), descend, lift, travel, lower, retract
  var REST = 280, DESC = 110, LIFT = 100, TRAVEL = 280, LOWER = 100, RETRACT = 110;
  var LEG = REST + DESC + LIFT + TRAVEL + LOWER + RETRACT;

  function clamp01(a) { return a < 0 ? 0 : a > 1 ? 1 : a; }
  function ss(a) { a = clamp01(a); return a * a * (3 - 2 * a); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  // Resolve the cube position, finger alpha, and wrist lift for the frame.
  function state(frame) {
    var leg = Math.floor(frame / LEG);
    var lt = frame - leg * LEG;
    var cur = STATIONS[SEQUENCE[leg % SEQUENCE.length]];
    var nxt = STATIONS[SEQUENCE[(leg + 1) % SEQUENCE.length]];
    var cube = { gx: cur.gx, gy: cur.gy, z: cur.z };
    var fingers = 0, lift = PARK_LIFT, u;

    if (lt < REST) {
      // resting at the station, released, arm parked high above it
    } else if (lt < REST + DESC) {
      u = ss((lt - REST) / DESC);                       // arm comes down, grips
      fingers = u;
      lift = lerp(PARK_LIFT, GRIP_LIFT, u);
    } else if (lt < REST + DESC + LIFT) {
      u = ss((lt - REST - DESC) / LIFT);                // lift off
      cube.z = lerp(cur.z, TRAVEL_Z, u);
      fingers = 1; lift = GRIP_LIFT;
    } else if (lt < REST + DESC + LIFT + TRAVEL) {
      u = ss((lt - REST - DESC - LIFT) / TRAVEL);       // carry across
      cube.gx = lerp(cur.gx, nxt.gx, u);
      cube.gy = lerp(cur.gy, nxt.gy, u);
      cube.z = TRAVEL_Z;
      fingers = 1; lift = GRIP_LIFT;
    } else if (lt < REST + DESC + LIFT + TRAVEL + LOWER) {
      u = ss((lt - REST - DESC - LIFT - TRAVEL) / LOWER); // set down
      cube.gx = nxt.gx; cube.gy = nxt.gy;
      cube.z = lerp(TRAVEL_Z, nxt.z, u);
      fingers = 1; lift = GRIP_LIFT;
    } else {
      u = ss((lt - REST - DESC - LIFT - TRAVEL - LOWER) / RETRACT); // release, retract
      cube.gx = nxt.gx; cube.gy = nxt.gy; cube.z = nxt.z;
      fingers = 1 - u;
      lift = lerp(GRIP_LIFT, PARK_LIFT, u);
    }
    return { cube: cube, fingers: fingers, lift: lift };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // ease parallax toward the pointer target (no idle sway)
    px += (tx - px) * 0.03; py += (ty - py) * 0.03;

    ctx.save();
    ctx.translate(px * 18, py * 12);
    ctx.lineWidth = Math.max(1, U / 34);
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(200,224,255,0.35)';
    ctx.shadowBlur = Math.max(2, U / 13);

    ground();

    // a populated blocks world, uniform phosphor white like the real display:
    // an open box on the right, a pyramid-capped block (the base of the pyramid
    // matches the block's top, so it caps it cleanly) on the left, and a loose
    // cube set back to the side
    ctx.strokeStyle = 'rgba(234,240,247,0.78)';
    wireOpenBox(2.3, 1.0, 0, 1.8, 1.1);
    wireCube(-2.8, 1.7, 0, 1.2, 1.1);
    wirePyramid(-2.8, 1.7, 1.1, 1.2);
    wireCube(-0.9, -0.7, 0, 1.1, 1.0);

    // the one block the arm is moving, drawn a touch brighter
    ctx.strokeStyle = 'rgba(234,240,247,0.92)';
    var s = reduce ? { cube: STATIONS[0], fingers: 0, lift: PARK_LIFT } : state(t);
    var held = wireCube(s.cube.gx, s.cube.gy, s.cube.z, CUBE_S, CUBE_H);
    var cx = (held[0].x + held[2].x) / 2, cy = (held[0].y + held[2].y) / 2;
    drawArm(held, { x: cx, y: cy - s.lift * U }, s.fingers);

    ctx.restore();

    t++;
    if (!reduce) raf = requestAnimationFrame(draw);
  }

  // pointer parallax only on a fine pointer (mouse); skip on touch so the
  // scene does not jump when a finger drags across the screen
  if (!reduce && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth) - 0.5;
      ty = (e.clientY / window.innerHeight) - 0.5;
    }, { passive: true });
  }
  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  resize();
  draw();
})();
