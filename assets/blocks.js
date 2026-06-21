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

  // monochrome by default (the original vector display); a button on the page can
  // switch the blocks to their named colours (the later, coloured rendering)
  var colour = false;
  try { colour = localStorage.getItem('shrdlu-colour') === '1'; } catch (e) {}
  window.SHRDLU_setColour = function (on) { colour = !!on; if (reduce) draw(); };

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

  // pick stroke + glow for the frame: white in monochrome, the block's named
  // colour when colour mode is on
  function setPaint(monoStroke, colourStroke) {
    if (colour) { ctx.strokeStyle = colourStroke; ctx.shadowColor = colourStroke; }
    else { ctx.strokeStyle = monoStroke; ctx.shadowColor = 'rgba(200,224,255,0.35)'; }
  }

  function ground() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,224,238,0.28)';
    var a = iso(-4, -2, 0), b = iso(4, -2, 0), c = iso(4, 4, 0), d = iso(-4, 4, 0);
    ctx.beginPath(); moveTo(a); lineTo(b); lineTo(c); lineTo(d); lineTo(a); ctx.stroke();
    ctx.restore();
  }

  // Two blocks the arm tends, by colour. Mostly it works the red block (in and
  // out of the box, onto the blue block); now and then it lifts the blue block
  // itself, sets it down elsewhere, then brings it back. The box and the
  // pyramid-capped block are fixed scenery.
  var CUBE_S = 1.1, CUBE_H = 1.0;
  var POS = {
    ground:   { gx:  0.0, gy:  2.6, z: 0.0 },   // open ground, front
    box:      { gx:  2.3, gy:  1.0, z: 0.0 },   // inside the open box
    onblue:   { gx: -0.9, gy: -0.7, z: 1.0 },   // on top of the blue block
    bluehome: { gx: -0.9, gy: -0.7, z: 0.0 },   // the blue block's usual place
    bluemove: { gx: -2.3, gy: -0.3, z: 0.0 }    // where the blue block visits
  };
  var rest = { red: POS.ground, blue: POS.bluehome };
  var COLOUR = { red: 'rgba(226,81,65,0.96)', blue: 'rgba(77,146,224,0.94)' };
  // the looping itinerary of moves: mostly the red block, occasionally the blue
  var ITIN = [
    { b: 'red',  to: 'box' },
    { b: 'red',  to: 'ground' },
    { b: 'red',  to: 'onblue' },
    { b: 'red',  to: 'ground' },
    { b: 'red',  to: 'box' },
    { b: 'red',  to: 'ground' },
    { b: 'blue', to: 'bluemove' },
    { b: 'blue', to: 'bluehome' }
  ];
  var TRAVEL_Z = 1.95;                 // base height a block is carried at (clears the box wall)
  var GRIP_LIFT = 1.3, PARK_LIFT = 2.6;
  // phase lengths (frames) — very slow and deliberate: rest (set down, arm
  // waits), descend, lift, travel, lower, retract
  var REST = 280, DESC = 110, LIFT = 100, TRAVEL = 280, LOWER = 100, RETRACT = 110;
  var LEG = REST + DESC + LIFT + TRAVEL + LOWER + RETRACT;

  // stepper: each leg lifts block `carried` from fromPos to toPos, advancing
  // through ITIN. The SHRDLU prompt can nudge the red block via SHRDLU_moveTo.
  var legStart = 0, itPtr = 0, carried = ITIN[0].b, fromPos = rest[carried], toPos = POS[ITIN[0].to], pendingMove = null;
  window.SHRDLU_moveTo = function (idx) {
    if (reduce) return;
    var key = ['ground', 'box', 'onblue'][idx | 0];
    if (!key) return;
    var lt = t - legStart;
    if (lt < REST && carried === 'red') {        // red is resting: redirect now
      if (toPos === POS[key]) return;
      fromPos = rest.red; toPos = POS[key]; pendingMove = null; legStart = t - REST;
    } else { pendingMove = { b: 'red', to: key }; }   // else queue for next leg
  };

  function clamp01(a) { return a < 0 ? 0 : a > 1 ? 1 : a; }
  function ss(a) { a = clamp01(a); return a * a * (3 - 2 * a); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  // Resolve the carried block, its animated position, finger alpha and wrist lift.
  function state(frame) {
    var lt = frame - legStart;
    if (lt >= LEG) {
      rest[carried] = toPos;          // finalise the move just completed
      legStart += LEG;
      var mv;
      if (pendingMove) { mv = pendingMove; pendingMove = null; }
      else { itPtr = (itPtr + 1) % ITIN.length; mv = ITIN[itPtr]; }
      carried = mv.b;
      fromPos = rest[carried];
      toPos = POS[mv.to];
      lt = frame - legStart;
    }
    var cur = fromPos, nxt = toPos;
    var cube = { gx: cur.gx, gy: cur.gy, z: cur.z };
    var fingers = 0, lift = PARK_LIFT, u;

    if (lt < REST) {
      // resting at fromPos, released, arm parked high above it
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
    return { carried: carried, cube: cube, fingers: fingers, lift: lift };
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

    // fixed scenery: an open box on the right and a pyramid-capped block on the
    // left. Monochrome by default; named colours when the colour toggle is on.
    var MONO = 'rgba(234,240,247,0.78)', MONO_HI = 'rgba(234,240,247,0.92)';
    setPaint(MONO, 'rgba(87,184,107,0.92)');  wireOpenBox(2.3, 1.0, 0, 1.8, 1.1);   // box: green
    setPaint(MONO, 'rgba(87,184,107,0.92)');  wireCube(-2.8, 1.7, 0, 1.2, 1.1);     // capped block: green
    setPaint(MONO, 'rgba(242,171,60,0.95)');  wirePyramid(-2.8, 1.7, 1.1, 1.2);     // pyramid: amber

    var s = reduce ? { carried: 'red', cube: POS.ground, fingers: 0, lift: PARK_LIFT } : state(t);
    var other = s.carried === 'red' ? 'blue' : 'red';

    // the block at rest (not being carried), then the one the arm is carrying
    var op = rest[other];
    setPaint(MONO, COLOUR[other]);
    wireCube(op.gx, op.gy, op.z, CUBE_S, CUBE_H);

    setPaint(MONO_HI, COLOUR[s.carried]);
    var held = wireCube(s.cube.gx, s.cube.gy, s.cube.z, CUBE_S, CUBE_H);
    var cx = (held[0].x + held[2].x) / 2, cy = (held[0].y + held[2].y) / 2;
    // the arm stays white; reset the glow so it does not take the block's colour
    ctx.shadowColor = 'rgba(200,224,255,0.35)';
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
