(function () {
  var COUNT = 170;                   // number of digits
  var RGB = '233,230,223';           // digit color (same as your text)
  var KEEP_OFF_TEXT = 22;            // px of clear space kept around the h1

  var cv = document.createElement('canvas');
  cv.className = 'bin bin-back';
  cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var ctx = cv.getContext('2d');
  var W = 0, H = 0;

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }
  size();
  window.addEventListener('resize', size);

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function reset(p, first) {
    p.k = Math.floor(rnd(0, 4));     // which corner: 0 tl, 1 tr, 2 bl, 3 br
    p.ch = Math.random() < 0.5 ? '0' : '1';
    p.fs = rnd(11, 19);
    p.r = rnd(1.8, 4.2);             // ring radius, in page widths
    p.flat = rnd(0.25, 0.5);         // how flat the ring looks
    p.y = rnd(-1.1, 1.1);            // height along the line
    p.th = rnd(0, 6.283);
    p.m = rnd(1, 2.5);               // how strongly it follows the ring's spin
    p.t1 = rnd(2.2, 3.8);            // seconds travelling from the corner
    p.t2 = rnd(9, 20);               // seconds circling the line
    p.t3 = 1.2;                      // seconds fading out
    p.jx = rnd(-40, 40);
    p.jy = rnd(-40, 40);
    p.bow = rnd(-0.25, 0.25);        // how much the path curves
    p.age = first ? -rnd(0, 8) : -rnd(0, 2);
  }

  var P = [];
  for (var i = 0; i < COUNT; i++) {
    var p = {};
    reset(p, true);
    P.push(p);
  }

  var stage = document.getElementById('stage');
  var h1 = document.querySelector('h1');
  var prev = 0;
  var sRot = 0, sTz = 0, sTx = -6, sEn = 0;    // smoothed copies of the axis state

  function frame(now) {
    var dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    var t = now / 1000;
    ctx.clearRect(0, 0, W, H);

    /* follow the axis, with a little lag so it feels like it's being pulled along */
    var A = window.__axis;
    var rotNow = A ? A.rot : t * 16;
    var k = Math.min(1, dt * 6);
    sRot += (rotNow - sRot) * k;
    sTz += ((A ? A.tz : 0) - sTz) * k;
    sTx += ((A ? A.tx : -6) - sTx) * k;
    sEn += ((A ? A.en : 0) - sEn) * k;

    var cx = W / 2, cy = H / 2;
    if (stage) {
      var sr = stage.getBoundingClientRect();
      cx = sr.left + sr.width / 2;
      cy = sr.top + sr.height / 2;
    }
    var card = document.querySelector('.ring .card');
    var cw = card ? card.offsetWidth : 140;
    var chh = card ? card.offsetHeight : 180;
    var L = chh * 0.65;                              // half the length of the line
    var tilt = sTz * Math.PI / 180;
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    var tr = h1 ? h1.getBoundingClientRect() : null;
    var flatAdd = clamp(-(sTx + 6) * 0.012, -0.15, 0.25);   // rings open up when the axis tips

    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.age += dt;
      if (p.age < 0) continue;
      var total = p.t1 + p.t2 + p.t3;
      if (p.age > total) { reset(p, false); continue; }

      var a = p.th + sRot * Math.PI / 180 * p.m;     // orbit angle comes from the ring's rotation
      var R = p.r * cw * (1 - 0.1 * sEn);            // pulled in while the axis is busy
      var depth = Math.sin(a);                       // +1 in front of the line, -1 behind
      var ox = Math.cos(a) * R;
      var wave = Math.sin(p.y * 2.6 + t * 2 + sRot * 0.03) * cw * (0.05 + 0.12 * sEn);
      var oy = p.y * L + wave + depth * R * clamp(p.flat + flatAdd, 0.1, 0.7);
      var tx = cx + ox * ct - oy * st;
      var ty = cy + ox * st + oy * ct;

      var x = tx, y = ty, e = 1;
      if (p.age < p.t1) {
        var u = p.age / p.t1;
        e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        var sx = (p.k % 2 ? W + 30 : -30) + p.jx;
        var sy = (p.k < 2 ? -30 : H + 30) + p.jy;
        var dx = tx - sx, dy = ty - sy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var bow = p.bow * dist * Math.sin(Math.PI * e);
        x = sx + dx * e + (-dy / dist) * bow;
        y = sy + dy * e + (dx / dist) * bow;
      }

      var alpha = (0.4 + (0.18 + 0.5 * (depth * 0.5 + 0.5) - 0.4) * e) * Math.min(1, p.age / 0.4);
      if (p.age > p.t1 + p.t2) alpha *= 1 - (p.age - p.t1 - p.t2) / p.t3;
      alpha *= 0.8 + 0.7 * sEn;                      // brighter while the axis is moving

      /* keep clear of the axis and the ring: an ellipse around the line */
      var lx = (x - cx) * ct + (y - cy) * st;
      var ly = -(x - cx) * st + (y - cy) * ct;
      var nd = Math.sqrt((lx / (cw * 1.6)) * (lx / (cw * 1.6)) + (ly / (L * 1.15)) * (ly / (L * 1.15)));
      alpha *= clamp((nd - 1) / 0.35, 0, 1);

      /* keep clear of the h1 */
      if (tr) {
        var hx = Math.max(tr.left - KEEP_OFF_TEXT - x, 0, x - (tr.right + KEEP_OFF_TEXT));
        var hy = Math.max(tr.top - KEEP_OFF_TEXT - y, 0, y - (tr.bottom + KEEP_OFF_TEXT));
        alpha *= clamp(Math.sqrt(hx * hx + hy * hy) / 40, 0, 1);
      }

      alpha = Math.min(alpha, 0.9);
      if (alpha < 0.01) continue;
      ctx.font = Math.round(p.fs * (0.8 + 0.4 * (depth * e * 0.5 + 0.5))) +
                 'px ui-monospace, Consolas, "Courier New", monospace';
      ctx.fillStyle = 'rgba(' + RGB + ',' + alpha.toFixed(3) + ')';
      ctx.fillText(p.ch, x, y);

      if (Math.random() < 0.003 + 0.03 * sEn) p.ch = Math.random() < 0.5 ? '0' : '1';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();