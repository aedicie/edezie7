(function () {
  /* ---------- Lightbox ---------- */
  var box = document.getElementById('lightbox');
  var boxImg = document.getElementById('lightbox-img');
  var boxClose = document.getElementById('lightbox-close');

  function openBox(img) {
    boxImg.src = img.src;
    boxImg.alt = img.alt;
    box.hidden = false;
    boxClose.focus();
  }
  function closeBox() {
    box.hidden = true;
    stage.focus();
  }
  box.addEventListener('click', function (e) {
    if (e.target !== boxImg) closeBox();
  });

  /* ---------- Contact dropdown in the header ---------- */
  var contactBtn = document.getElementById('contact-btn');
  var contactInfo = document.getElementById('contact-info');

  function setContact(open) {
    contactBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    contactInfo.hidden = !open;
  }
  contactBtn.addEventListener('click', function () {
    setContact(contactBtn.getAttribute('aria-expanded') !== 'true');
  });

  /* ---------- Pages around the line ---------- */
  var stage = document.getElementById('stage');
  var ring = document.getElementById('ring');
  var cards = Array.prototype.slice.call(ring.children);
  var n = cards.length;

  var axis = document.createElement('div');
  axis.className = 'axis';
  ring.appendChild(axis);

  var N = 20;                       // strips per page: more = smoother paper
  var AUTO = 16;                    // degrees per second when nobody touches it
  var rot = 0, vel = 0;             // vel in degrees per second
  var dragging = false, lastX = 0, lastT = 0, startX = 0, moved = 0, downCard = null;
  var cx = 0, cy = 0, cs = 0, en = 0, tx = -6, tz = 0;
  var w = 0, h = 0, builtKey = '', prev = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function build() {
    w = cards[0].offsetWidth;
    h = cards[0].offsetHeight;
    if (!w) return false;
    var key = w + 'x' + h;
    if (key === builtKey) return true;
    builtKey = key;
    var sw = w / N;
    cards.forEach(function (card) {
      var img = card.querySelector('img');
      card._img = img;
      var nw = img.naturalWidth, nh = img.naturalHeight;
      var bw = w, bh = h, ox = 0, oy = 0;
      if (nw && nh) {               // same crop as object-fit: cover
        var sc = Math.max(w / nw, h / nh);
        bw = nw * sc; bh = nh * sc;
        ox = (w - bw) / 2; oy = (h - bh) / 2;
      }
      (card._all || []).forEach(function (s) { card.removeChild(s); });
      card._all = [];
      ['_f', '_b'].forEach(function (kind) {
        var arr = [];
        for (var i = 0; i < N; i++) {
          var s = document.createElement('i');
          s.className = 'strip';
          s.style.width = (sw + 1) + 'px';       // +1px overlap hides seams
          s.style.backgroundImage = 'url("' + img.src + '")';
          s.style.backgroundSize = bw + 'px ' + bh + 'px';
          s.style.backgroundPosition = (ox - i * sw) + 'px ' + oy + 'px';
          card.appendChild(s);
          card._all.push(s);
          arr.push(s);
        }
        card[kind] = arr;
      });
    });
    return true;
  }

  cards.forEach(function (card) {
    card.querySelector('img').addEventListener('load', function () {
      builtKey = '';
      render(performance.now() / 1000);
    });
  });

  function layout() {
    if (build()) render(performance.now() / 1000);
  }

  function render(t) {
    if (!build()) return;
    ring.style.transform =
      'rotateZ(' + tz.toFixed(2) + 'deg) rotateX(' + tx.toFixed(2) + 'deg)';

    var step = 360 / n;
    var breathe = 1 + 0.05 * Math.sin(t * 0.6);   // pages open and close a little
    var sw = w / N;
    var A = (6 + 16 * en) * Math.PI / 180;         // max page angle: soft at rest, more when moving

    for (var i = 0; i < n; i++) {
      var card = cards[i];
      var ang = rot + i * step * breathe;
      card.style.transform = 'rotateY(' + ang.toFixed(2) + 'deg)';

      var F = card._f, B = card._b;
      if (!F || !B) continue;
      var phase = t * 2 + i * 0.9 + ang * 0.03;
      var X = 0, Z = 0;                            // each strip starts where the last one ends
      for (var s = 0; s < N; s++) {
        var u = (s + 0.5) / N;
        var phi = A * (0.2 + 0.8 * u) * Math.sin(u * Math.PI * 1.8 + phase);
        var tf = 'translate3d(' + X.toFixed(2) + 'px,0,' + Z.toFixed(2) + 'px) rotateY(' +
                 (-phi * 180 / Math.PI).toFixed(2) + 'deg)';
        F[s].style.transform = tf;
        B[N - 1 - s].style.transform = tf + ' translateX(' + sw.toFixed(2) + 'px) rotateY(180deg)';
        X += sw * Math.cos(phi);
        Z += sw * Math.sin(phi);
      }
    }
  }

  function tick(now) {
    var dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (box.hidden && stage.offsetParent !== null) {
      if (!dragging) {
        rot += (AUTO + vel) * dt;                  // always turning, plus any throw
        vel *= Math.exp(-2.5 * dt);
      }
      cs *= Math.exp(-4 * dt);
      var target = Math.min(1, Math.abs(vel) / 200 + cs + (dragging ? 0.5 : 0) + 0.05);
      en += (target - en) * Math.min(1, dt * 6);

      var sway = Math.sin(now / 1000 * 0.5) * 7;   // gentle tilt when nobody touches it
      tz += ((cx * 22 + sway) - tz) * Math.min(1, dt * 4);
      tx += ((-6 - cy * 12) - tx) * Math.min(1, dt * 4);

      window.__axis = { tz: tz, tx: tx, rot: rot, en: en };   // read by bg.js

      render(now / 1000);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Pointer: drag, cursor, tap ---------- */
  function track(e) {
    var r = stage.getBoundingClientRect();
    cx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    cy = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
  }

  stage.addEventListener('pointerdown', function (e) {
    dragging = true; vel = 0;
    lastX = e.clientX; lastT = e.timeStamp;
    startX = e.clientX; moved = 0;
    downCard = e.target.closest('.card');
    track(e);
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', function (e) {
    var dx = e.clientX - lastX;
    track(e);
    cs = Math.min(1, cs + Math.abs(dx) / 120);
    if (!dragging) { lastX = e.clientX; lastT = e.timeStamp; return; }
    moved = Math.max(moved, Math.abs(e.clientX - startX));
    var dr = dx * 0.4;                             // degrees per pixel
    rot += dr;
    var dtm = Math.max((e.timeStamp - lastT) / 1000, 0.008);
    vel = clamp(vel * 0.5 + (dr / dtm) * 0.5, -700, 700);
    lastX = e.clientX; lastT = e.timeStamp;
  });
  stage.addEventListener('pointerup', function () {
    dragging = false;
    if (downCard && downCard._img && moved < 6) openBox(downCard._img);
    downCard = null;
  });
  stage.addEventListener('pointercancel', function () {
    dragging = false; downCard = null;
  });
  stage.addEventListener('pointerleave', function () { cx = 0; cy = 0; });

  /* ---------- Sideways scroll / trackpad (vertical scroll still scrolls the page) ---------- */
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    rot += e.deltaX * 0.2;
    cs = Math.min(1, cs + 0.3);
  }, { passive: false });

  stage.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') vel = 150;
    if (e.key === 'ArrowLeft') vel = -150;
  });

  /* ---------- Escape: lightbox first, then contact ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!box.hidden) closeBox();
    else setContact(false);
  });

  window.addEventListener('resize', layout);
  layout();
  requestAnimationFrame(tick);
})();