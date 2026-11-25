/* ============================================================
   Tucano Labs / motion.js

   The hero film and the five small case films.
   Plain 2D canvas, no dependencies, no build step.

   Every scene is a pure function of time, so any frame can be
   drawn on demand: the film can be paused, scrubbed, shown as a
   still for people who prefer reduced motion, or exported.
   ============================================================ */
(function () {
  'use strict';

  var TL = (window.TL = window.TL || {});
  var TAU = Math.PI * 2;

  /* ---------- maths ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sat(v) { return clamp(v, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function frac(v) { return v - Math.floor(v); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function back(t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function quad(a, c, b, u) { var v = 1 - u; return v * v * a + 2 * v * u * c + u * u * b; }

  /* ---------- palettes ---------- */
  var DARK = {
    ink: '#eef2fc', dim: 'rgba(238,242,252,0.6)', faint: 'rgba(238,242,252,0.2)', hair: 'rgba(238,242,252,0.1)',
    teal: '#45d3d4', tealSoft: 'rgba(69,211,212,0.24)', beak: '#f2b705', beakSoft: 'rgba(242,183,5,0.26)',
    panel: 'rgba(255,255,255,0.06)', panelLine: 'rgba(255,255,255,0.16)', solid: '#14244f', blue: '#8fa8ff'
  };
  var LIGHT = {
    ink: '#0f1b3d', dim: '#5b6a8a', faint: 'rgba(15,27,61,0.16)', hair: 'rgba(15,27,61,0.08)',
    teal: '#0b8f92', tealSoft: 'rgba(11,143,146,0.16)', beak: '#f2b705', beakSoft: 'rgba(242,183,5,0.24)',
    panel: '#ffffff', panelLine: 'rgba(15,27,61,0.14)', solid: '#ffffff', blue: '#2f58e0'
  };

  /* ---------- drawing kit ----------
     Scenes draw in a fixed virtual box. `scale` is how many real
     pixels one virtual unit covers, used to keep type legible. */
  function kit(g, C, scale, smallest, compactBelow) {
    var minPx = (smallest || 10.5) / scale;
    var K = {
      g: g, C: C, scale: scale, compact: scale < (compactBelow || 0.5),
      mono: function (size, weight) { g.font = (weight || 500) + ' ' + Math.max(size, minPx) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace'; },
      sans: function (size, weight) { g.font = (weight || 600) + ' ' + Math.max(size, minPx) + 'px "Sora", system-ui, sans-serif'; },
      text: function (s, x, y, color, align) { g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); },
      dot: function (x, y, r, color) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill(); },
      halo: function (x, y, r, color, soft) { K.alpha(0.22, function () { K.dot(x, y, r * (soft || 2.6), color); }); K.dot(x, y, r, color); },
      line: function (x1, y1, x2, y2, color, w, dash, off) {
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
        g.strokeStyle = color; g.lineWidth = w || 1; g.setLineDash(dash || []); g.lineDashOffset = off || 0; g.stroke(); g.setLineDash([]);
      },
      curve: function (x1, y1, cx, cy, x2, y2, color, w, dash, off) {
        g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2);
        g.strokeStyle = color; g.lineWidth = w || 1; g.setLineDash(dash || []); g.lineDashOffset = off || 0; g.stroke(); g.setLineDash([]);
      },
      box: function (x, y, w, h, r, fill, stroke, lw) {
        g.beginPath(); g.roundRect(x, y, w, h, r);
        if (fill) { g.fillStyle = fill; g.fill(); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
      },
      ring: function (x, y, r, color, w, dash, off) {
        g.beginPath(); g.arc(x, y, r, 0, TAU);
        g.strokeStyle = color; g.lineWidth = w || 1; g.setLineDash(dash || []); g.lineDashOffset = off || 0; g.stroke(); g.setLineDash([]);
      },
      arc: function (x, y, r, a0, a1, color, w) {
        g.beginPath(); g.arc(x, y, r, a0, a1); g.strokeStyle = color; g.lineWidth = w || 1; g.lineCap = 'round'; g.stroke(); g.lineCap = 'butt';
      },
      check: function (x, y, s, color, w, p) {
        p = p === undefined ? 1 : sat(p); if (p <= 0) return;
        var ax = x - s * 0.5, ay = y, bx = x - s * 0.12, by = y + s * 0.36, cx = x + s * 0.52, cy = y - s * 0.36;
        g.beginPath(); g.moveTo(ax, ay);
        var p1 = sat(p / 0.4), p2 = sat((p - 0.4) / 0.6);
        g.lineTo(lerp(ax, bx, p1), lerp(ay, by, p1));
        if (p2 > 0) g.lineTo(lerp(bx, cx, p2), lerp(by, cy, p2));
        g.strokeStyle = color; g.lineWidth = w || 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.lineCap = 'butt'; g.lineJoin = 'miter';
      },
      cross: function (x, y, s, color, w) {
        g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s);
        g.strokeStyle = color; g.lineWidth = w || 2; g.lineCap = 'round'; g.stroke(); g.lineCap = 'butt';
      },
      alpha: function (a, fn) { if (a <= 0.003) return; var prev = g.globalAlpha; g.globalAlpha = prev * sat(a); fn(); g.globalAlpha = prev; },
      /* A line of "text" drawn as a soft bar, for sizes where real type would not be readable. */
      bar: function (x, y, w, h, color) { K.box(x, y - h, w, h, h / 2, color); }
    };
    return K;
  }

  /* ============================================================
     HERO FILM, four chapters (virtual box 1000 x 700)
     ============================================================ */

  /* ---- 01 Safe: every request signed, every action logged ---- */
  var SAFE_REQ = (function () {
    var r = rng(7), out = [], pattern = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1];
    for (var i = 0; i < 16; i++) out.push({ at: 0.2 + i * 0.47, ang: Math.PI * (0.6 + r() * 0.8), ok: pattern[i] });
    return out;
  })();
  var SAFE_LOG = ['read   invoice 2041', 'update order 7718', 'approve payment 311', 'export report Q3', 'read   customer 88', 'sign in  finance', 'update price book', 'read   ledger NZ', 'approve PO 5120', 'read   stock AKL', 'export audit pack', 'read   contract 17'];

  function sceneSafe(g, t, k) {
    var C = k.C, cx = 340, cy = 350, R1 = 236, R2 = 160, i;

    // perimeter
    var glow = g.createRadialGradient(cx, cy, 0, cx, cy, R1);
    glow.addColorStop(0, 'rgba(69,211,212,0.16)'); glow.addColorStop(1, 'rgba(69,211,212,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, R1, 0, TAU); g.fill();
    k.ring(cx, cy, R1, C.faint, 1.5, [3, 10], -t * 6);
    k.ring(cx, cy, R2, C.tealSoft, 2);
    k.arc(cx, cy, R2, t * 0.5, t * 0.5 + 0.55, C.teal, 2.5);
    k.arc(cx, cy, R2, t * 0.5 + Math.PI, t * 0.5 + Math.PI + 0.3, C.teal, 2.5);

    // the data at the centre
    k.box(cx - 64, cy - 50, 128, 100, 16, C.panel, C.panelLine, 1.2);
    for (i = 0; i < 4; i++) k.line(cx - 44, cy - 26 + i * 17, cx + 44 - (i % 2) * 22, cy - 26 + i * 17, i === 0 ? C.dim : C.faint, 3);
    // padlock
    k.box(cx - 13, cy - 88, 26, 22, 6, C.solid, C.teal, 1.8);
    g.beginPath(); g.arc(cx, cy - 88, 8, Math.PI, 0); g.strokeStyle = C.teal; g.lineWidth = 1.8; g.stroke();
    if (!k.compact) { k.mono(13, 500); k.text('encrypted', cx, cy + 78, C.dim, 'center'); k.text('signed requests only', cx, cy + R1 + 34, C.dim, 'center'); }

    // requests arriving from outside
    var passed = [];
    for (i = 0; i < SAFE_REQ.length; i++) {
      var q = SAFE_REQ[i], lt = t - q.at; if (lt < 0) continue;
      var dx = Math.cos(q.ang), dy = Math.sin(q.ang), rad;
      if (q.ok) {
        var p = sat(lt / 2.0); rad = lerp(480, 70, easeInOut(p));
        if (p < 1) {
          k.alpha(0.5, function () { k.line(cx + dx * (rad + 46), cy + dy * (rad + 46), cx + dx * rad, cy + dy * rad, C.teal, 1.5); });
          k.halo(cx + dx * rad, cy + dy * rad, 5, C.teal);
          var f1 = 1 - sat(Math.abs(rad - R1) / 42), f2 = 1 - sat(Math.abs(rad - R2) / 42);
          if (f1 > 0) k.alpha(f1, function () { k.arc(cx, cy, R1, q.ang - 0.24, q.ang + 0.24, C.teal, 3); });
          if (f2 > 0) k.alpha(f2, function () { k.arc(cx, cy, R2, q.ang - 0.3, q.ang + 0.3, C.ink, 3.5); });
        } else passed.push(lt - 2.0);
      } else {
        var pd = sat(lt / 1.2); rad = lerp(480, R1 + 10, easeOut(pd));
        var fade = 1 - sat((lt - 1.2) / 1.0);
        (function (rad, fade, pd) {
          k.alpha(fade, function () {
            k.dot(cx + dx * rad, cy + dy * rad, 5, C.dim);
            if (pd >= 1) {
              k.cross(cx + dx * (rad + 20), cy + dy * (rad + 20), 5, C.dim, 1.8);
              k.arc(cx, cy, R1, q.ang - 0.2, q.ang + 0.2, C.ink, 2.5);
            }
          });
        })(rad, fade, pd);
      }
    }
    // a soft pulse on the data each time one lands
    for (i = 0; i < passed.length; i++) if (passed[i] < 0.7) (function (s) { k.alpha((1 - s / 0.7) * 0.7, function () { k.ring(cx, cy, 74 + s * 46, C.teal, 2); }); })(passed[i]);

    // audit trail
    var px = 640, py = 150, pw = 320, ph = 400, rowH = 40, maxRows = 8;
    k.box(px, py, pw, ph, 20, C.panel, C.panelLine, 1.2);
    k.mono(13, 600); k.text('AUDIT TRAIL', px + 24, py + 36, C.teal);
    k.dot(px + pw - 28, py + 31, 4, C.teal);
    k.line(cx + 64, cy, px, cy, C.hair, 1.5, [4, 7]);
    for (i = 0; i < passed.length; i++) if (passed[i] < 0.42) k.halo(lerp(cx + 64, px, easeInOut(passed[i] / 0.42)), cy, 4, C.teal);
    var shown = [];
    for (i = 0; i < passed.length; i++) if (passed[i] > 0.38) shown.push({ n: i, a: easeOut(sat((passed[i] - 0.38) / 0.4)) });
    var scroll = Math.max(0, shown.length - maxRows);
    if (scroll > 0) scroll = scroll - 1 + shown[shown.length - 1].a;
    g.save(); g.beginPath(); g.rect(px + 4, py + 52, pw - 8, ph - 62); g.clip();
    for (i = 0; i < shown.length; i++) (function (row) {
      var y = py + 84 + (i - scroll) * rowH;
      if (y < py + 40 || y > py + ph + 10) return;
      k.alpha(row.a, function () {
        var x = px + 24 + (1 - row.a) * 14;
        k.check(x + 6, y - 5, 12, C.teal, 2);
        if (k.compact) { k.bar(x + 26, y, 70, 9, C.faint); k.bar(x + 108, y, 150 - (row.n % 3) * 26, 9, C.dim); }
        else {
          k.mono(13, 500); k.text('09:' + pad2(14 + row.n) + ':' + pad2((row.n * 17 + 3) % 60), x + 26, y, C.dim);
          k.text(SAFE_LOG[row.n % SAFE_LOG.length], x + 112, y, C.ink);
        }
      });
    })(shown[i]);
    g.restore();
  }

  /* ---- 02 Scalable: more users, more servers, same speed ---- */
  var SCALE_BIRTH = { 4: -1, 1: -1, 7: 1.9, 3: 1.9, 5: 3.5, 0: 3.5, 2: 5.0, 6: 5.0, 8: 5.0 };

  function sceneScalable(g, t, k) {
    var C = k.C, i, j, bx = 318, by = 350;
    var load = easeInOut(sat(t / 6.4));

    // users arriving
    if (!k.compact) { k.mono(13, 600); k.text('USERS', 24, 150, C.beak); }
    for (j = 0; j < 9; j++) {
      var on = sat(1.6 + load * 7.6 - j); if (on <= 0) continue;
      var ly = by + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 40;
      (function (ly, on, j) {
        k.alpha(on, function () {
          k.curve(24, ly, 210, ly, bx, by, C.hair, 1.2);
          for (var n = 0; n < 3; n++) {
            var u = frac(t * 0.42 + j * 0.37 + n / 3);
            var x = quad(24, 210, bx, u), y = quad(ly, ly, by, u);
            k.alpha(Math.min(1, u * 6, (1 - u) * 6), function () { k.dot(x, y, 4, C.beak); });
          }
        });
      })(ly, on, j);
    }
    k.halo(bx, by, 9, C.ink, 2.2);

    // servers
    var count = 0, gx = 430, gy = 232, cell = 80, gap = 16;
    for (i = 0; i < 9; i++) {
      var b = SCALE_BIRTH[i]; if (t < b) continue; count++;
      var age = t - b, s = b < 0 ? 1 : back(sat(age / 0.55));
      var col = i % 3, row = Math.floor(i / 3);
      var x0 = gx + col * (cell + gap), y0 = gy + row * (cell + gap), mx = x0 + cell / 2, my = y0 + cell / 2;
      k.alpha(0.5 * sat(age / 0.4 + (b < 0 ? 1 : 0)), function () { k.line(bx + 12, by, x0 - 4, my, C.faint, 1.2); });
      var u2 = frac(t * 0.9 + i * 0.23);
      k.dot(lerp(bx + 12, x0 - 4, u2), lerp(by, my, u2), 3, C.beak);
      g.save(); g.translate(mx, my); g.scale(s, s);
      var fresh = b < 0 ? 0 : 1 - sat(age / 1.1);
      k.box(-cell / 2, -cell / 2, cell, cell, 16, C.panel, fresh > 0 ? C.teal : C.panelLine, 1.2 + fresh * 1.6);
      for (j = 0; j < 4; j++) {
        var h = 10 + 26 * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7 + j * 1.1));
        k.box(-25 + j * 14, 22 - h, 8, h, 3, j === 3 ? C.teal : C.dim);
      }
      g.restore();
      if (fresh > 0) k.alpha(fresh * 0.6, function () { k.ring(mx, my, cell * 0.6 + (1 - fresh) * 30, C.teal, 2); });
    }
    k.sans(54, 700); k.text(String(count), gx, gy - 36, C.ink);
    k.mono(13, 500); if (!k.compact) k.text(count === 1 ? 'server' : 'servers, added as load grows', gx + 46 + (count > 9 ? 30 : 0), gy - 40, C.dim);

    // the chart: users climb, response time holds
    var px = 742, py = 196, pw = 234, ph = 308;
    k.box(px, py, pw, ph, 20, C.panel, C.panelLine, 1.2);
    var x1 = px + 22, x2 = px + pw - 22, yb = py + ph - 62, yt = py + 30, end = sat(t / 7.2);
    for (i = 0; i <= 3; i++) k.line(x1, lerp(yb, yt, i / 3), x2, lerp(yb, yt, i / 3), C.hair, 1);
    g.beginPath();
    for (i = 0; i <= 60; i++) { var u = i / 60; if (u > end) break; var yy = lerp(yb - 12, yt + 8, easeInOut(sat(u * 7.2 / 6.4))); if (i) g.lineTo(lerp(x1, x2, u), yy); else g.moveTo(x1, yy); }
    g.strokeStyle = C.beak; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke();
    g.beginPath();
    for (i = 0; i <= 60; i++) { var u3 = i / 60; if (u3 > end) break; var y3 = lerp(yb, yt, 0.42) + Math.sin(u3 * 31) * 3 + Math.sin(u3 * 13) * 2; if (i) g.lineTo(lerp(x1, x2, u3), y3); else g.moveTo(x1, y3); }
    g.strokeStyle = C.teal; g.lineWidth = 2.6; g.stroke();
    k.dot(lerp(x1, x2, end), lerp(yb - 12, yt + 8, easeInOut(sat(end * 7.2 / 6.4))), 4.5, C.beak);
    k.dot(lerp(x1, x2, end), lerp(yb, yt, 0.42) + Math.sin(end * 31) * 3 + Math.sin(end * 13) * 2, 4.5, C.teal);
    if (k.compact) { k.bar(x1, py + ph - 24, 60, 9, C.beak); k.bar(x1 + 76, py + ph - 24, 96, 9, C.teal); }
    else { k.mono(12, 500); k.dot(x1 + 4, py + ph - 38, 4, C.beak); k.text('users', x1 + 16, py + ph - 34, C.dim); k.dot(x1 + 4, py + ph - 18, 4, C.teal); k.text('response time', x1 + 16, py + ph - 14, C.dim); }
  }

  /* ---- 03 Stable: organised data your agents can reach ---- */
  var STABLE_PTS = (function () {
    var r = rng(21), a = [];
    for (var i = 0; i < 96; i++) a.push({ x: 40 + r() * 540, y: 120 + r() * 460, ph: r() * TAU, sp: 0.5 + r() });
    return a;
  })();
  var STABLE_READ = [{ row: 2, at: 5.0 }, { row: 5, at: 5.5 }, { row: 6, at: 6.0 }];

  function sceneStable(g, t, k) {
    var C = k.C, cols = 12, rows = 8, x0 = 92, y0 = 226, dx = 38, dy = 40, i;
    var framed = easeOut(sat((t - 2.9) / 0.9));

    // the table that the mess settles into
    k.alpha(framed, function () {
      k.box(x0 - 28, y0 - 64, cols * dx + 22, rows * dy + 72, 20, C.panel, C.panelLine, 1.2);
      k.mono(13, 600); k.text('ONE SOURCE OF TRUTH', x0 - 28, y0 - 82, C.teal);
      var heads = ['customers', 'orders', 'invoices', 'payments'];
      for (var h = 0; h < 4; h++) {
        if (k.compact) k.bar(x0 - 10 + h * 3 * dx, y0 - 30, 64, 8, C.dim);
        else { k.mono(12, 500); k.text(heads[h], x0 - 12 + h * 3 * dx, y0 - 30, C.dim); }
        if (h) k.line(x0 - 19 + h * 3 * dx, y0 - 50, x0 - 19 + h * 3 * dx, y0 + rows * dy - 12, C.hair, 1);
      }
    });

    for (i = 0; i < 96; i++) {
      var pt = STABLE_PTS[i], col = i % cols, row = Math.floor(i / cols);
      var p = easeInOut(sat((t - 1.3 - (col + row) * 0.05) / 1.5));
      var x = lerp(pt.x + Math.sin(t * pt.sp + pt.ph) * 12, x0 + col * dx, p);
      var y = lerp(pt.y + Math.cos(t * pt.sp * 0.8 + pt.ph) * 12, y0 + row * dy, p);
      var w = lerp(9, 27 - ((i * 7) % 3) * 5, p), hgt = lerp(9, 10, p), hl = 0;
      for (var r = 0; r < STABLE_READ.length; r++) if (STABLE_READ[r].row === row) hl = sat((t - STABLE_READ[r].at - col * 0.02) / 0.3);
      var a = lerp(0.55 + 0.3 * Math.sin(pt.ph + t), 0.85, p);
      (function (x, y, w, hgt, hl, a) {
        k.alpha(a, function () { k.box(x - w / 2, y - hgt / 2, w, hgt, hgt / 2, hl > 0 ? C.beak : (col % 3 === 0 ? C.ink : C.dim)); });
      })(x, y, w, hgt, hl, a);
    }

    // an agent reaches it through MCP
    var ag = easeOut(sat((t - 3.9) / 0.7)), ax = 814, ay = 226, tx = x0 + cols * dx - 4, ty = 330;
    k.alpha(ag, function () {
      k.curve(tx, ty, 640, 250, ax - 40, ay + 6, C.faint, 1.5, [5, 7], -t * 14);
      if (t > 4.5) {
        var u = frac((t - 4.5) * 0.8), back2 = Math.floor((t - 4.5) * 0.8) % 2 === 1;
        var uu = back2 ? u : 1 - u;
        k.halo(quad(tx, 640, ax - 40, uu), quad(ty, 250, ay + 6, uu), 4.5, back2 ? C.beak : C.teal);
      }
      k.box(634, 262, 66, 28, 14, C.solid, C.teal, 1.5);
      k.mono(13, 600); k.text('MCP', 667, 281, C.teal, 'center');
      k.halo(ax, ay, 38, C.tealSoft, 1.25);
      k.ring(ax, ay, 38, C.teal, 2);
      // spark
      g.beginPath();
      for (var s = 0; s < 8; s++) { var rr = s % 2 ? 6 : 19, an = -Math.PI / 2 + s * Math.PI / 4; if (s) g.lineTo(ax + Math.cos(an) * rr, ay + Math.sin(an) * rr); else g.moveTo(ax + Math.cos(an) * rr, ay + Math.sin(an) * rr); }
      g.closePath(); g.fillStyle = C.teal; g.fill();
      if (!k.compact) { k.mono(13, 500); k.text('your AI agent', ax, ay - 56, C.dim, 'center'); }
    });

    // and comes back with an answer
    var an2 = easeOut(sat((t - 6.3) / 0.6));
    k.alpha(an2, function () {
      var cx = 690, cy = 322 + (1 - an2) * 18;
      k.box(cx, cy, 270, 152, 20, C.panel, C.panelLine, 1.2);
      k.mono(12, 600); k.text('ANSWER', cx + 22, cy + 34, C.teal);
      if (k.compact) { k.bar(cx + 22, cy + 72, 190, 12, C.ink); k.bar(cx + 22, cy + 100, 140, 9, C.dim); }
      else { k.sans(21, 600); k.text('3 invoices overdue', cx + 22, cy + 70, C.ink); k.mono(13, 500); k.text('2 customers, sorted by age', cx + 22, cy + 96, C.dim); }
      var ok = sat((t - 7.0) / 0.5);
      if (ok > 0) { k.check(cx + 30, cy + 124, 13, C.beak, 2.2, ok); if (!k.compact) { k.mono(12, 500); k.alpha(ok, function () { k.text('approved by a person', cx + 48, cy + 129, C.dim); }); } }
    });
  }

  /* ---- 04 Compliant: validated, tested, deployed every day ---- */
  var REL = [0.3, 1.95, 3.6, 5.25];
  var REL_HOURS = [9.2, 11.4, 14.1, 16.3];

  function sceneCompliant(g, t, k) {
    var C = k.C, xs = [140, 376, 612, 848], y = 236, names = ['commit', 'test', 'validate', 'deploy'], hop = 0.5, i, r;

    k.line(xs[0], y, xs[3], y, C.faint, 2);
    for (i = 0; i < 4; i++) {
      var last = -1, n = 0;
      for (r = 0; r < REL.length; r++) { var since = t - (REL[r] + i * hop); if (since >= 0) { n++; last = since; } }
      (function (i, last, n) {
        var x = xs[i], pop = last >= 0 ? 1 - sat(last / 0.6) : 0;
        if (pop > 0) k.alpha(pop * 0.7, function () { k.ring(x, y, 30 + (1 - pop) * 26, C.teal, 2); });
        k.dot(x, y, 28, C.solid);
        k.ring(x, y, 28, n ? C.teal : C.panelLine, n ? 2.2 : 1.4);
        if (n) k.check(x, y, 20, C.teal, 2.6, last / 0.35); else k.dot(x, y, 4, C.faint);
        k.mono(14, 600); k.text(k.compact ? '' : names[i].toUpperCase(), x, y + 62, n ? C.ink : C.dim, 'center');
        if (k.compact) k.bar(x - 28, y + 58, 56, 9, n ? C.ink : C.dim);
      })(i, last, n);
    }
    // evidence filed for each release
    for (r = 0; r < REL.length; r++) {
      var since2 = t - (REL[r] + 2 * hop); if (since2 < 0) continue;
      (function (r, a) {
        k.alpha(a, function () {
          var dx2 = xs[2] - 22 + r * 9, dy2 = y - 100 - r * 9 + (1 - a) * 16;
          k.box(dx2, dy2, 44, 54, 7, C.solid, C.panelLine, 1.2);
          k.line(dx2 + 9, dy2 + 15, dx2 + 35, dy2 + 15, C.dim, 2.5); k.line(dx2 + 9, dy2 + 25, dx2 + 29, dy2 + 25, C.faint, 2.5);
          k.check(dx2 + 26, dy2 + 40, 11, C.beak, 2);
        });
      })(r, easeOut(sat(since2 / 0.45)));
    }
    // each release moving down the line
    for (r = 0; r < REL.length; r++) {
      var lt = t - REL[r]; if (lt < 0 || lt > 3 * hop + 0.15) continue;
      var u = sat(lt / (3 * hop)) * 3, seg = Math.min(2, Math.floor(u)), f = easeInOut(u - seg);
      k.halo(lerp(xs[seg], xs[seg + 1], f), y, 7, C.beak, 2.4);
    }

    // the day so far
    var ax1 = 110, ax2 = 890, ay = 520, done = 0;
    k.line(ax1, ay, ax2, ay, C.faint, 2);
    for (i = 0; i <= 5; i++) {
      var hx = lerp(ax1, ax2, i / 5);
      k.line(hx, ay - 6, hx, ay + 6, C.faint, 1.5);
      if (!k.compact) { k.mono(13, 500); k.text(pad2(8 + i * 2) + ':00', hx, ay + 32, C.dim, 'center'); }
    }
    for (r = 0; r < REL.length; r++) {
      var s3 = t - (REL[r] + 3 * hop); if (s3 < 0) continue; done++;
      (function (r, a, s3) {
        var mx = lerp(ax1, ax2, (REL_HOURS[r] - 8) / 10), my = ay - (1 - a) * 70;
        k.alpha(sat(s3 / 0.25), function () {
          k.line(mx, my - 34, mx, my, C.beak, 2);
          k.halo(mx, my, 7, C.beak, 2.2);
          if (!k.compact) { k.mono(13, 600); k.text(pad2(Math.floor(REL_HOURS[r])) + ':' + pad2(Math.round((REL_HOURS[r] % 1) * 60)), mx, my - 44, C.ink, 'center'); }
        });
      })(r, easeOut(sat(s3 / 0.5)), s3);
    }
    k.mono(13, 600); k.text('RELEASES TODAY', ax1, ay - 96, C.teal);
    k.sans(54, 700); k.text(String(done), ax2, ay - 84, C.ink, 'right');
  }

  var CHAPTERS = [
    { id: 'safe', label: 'Safe', caption: 'Every request signed, every action logged.', dur: 8, still: 6.6, draw: sceneSafe },
    { id: 'scalable', label: 'Scalable', caption: 'More users, more servers, the same speed.', dur: 8, still: 7.0, draw: sceneScalable },
    { id: 'stable', label: 'Stable', caption: 'Organised data that your agents can reach.', dur: 8, still: 7.6, draw: sceneStable },
    { id: 'compliant', label: 'Compliant', caption: 'Validated, tested and deployed every day.', dur: 8, still: 7.4, draw: sceneCompliant }
  ];
  var FILM_LENGTH = CHAPTERS.reduce(function (a, c) { return a + c.dur; }, 0);

  function chapterAt(T) {
    T = ((T % FILM_LENGTH) + FILM_LENGTH) % FILM_LENGTH;
    var acc = 0;
    for (var i = 0; i < CHAPTERS.length; i++) { if (T < acc + CHAPTERS[i].dur) return { index: i, t: T - acc, start: acc }; acc += CHAPTERS[i].dur; }
    return { index: 0, t: 0, start: 0 };
  }

  function drawFilmBackground(g, T, w, h) {
    var bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#101d49'); bg.addColorStop(1, '#0a1230');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    var m = Math.max(w, h);
    var g1 = g.createRadialGradient(w * (0.8 + Math.sin(T * 0.1) * 0.05), h * 0.12, 0, w * 0.8, h * 0.12, m * 0.62);
    g1.addColorStop(0, 'rgba(11,143,146,0.42)'); g1.addColorStop(1, 'rgba(11,143,146,0)');
    g.fillStyle = g1; g.fillRect(0, 0, w, h);
    var g2 = g.createRadialGradient(w * 0.06, h * (1.02 + Math.cos(T * 0.08) * 0.04), 0, w * 0.06, h, m * 0.42);
    g2.addColorStop(0, 'rgba(242,183,5,0.13)'); g2.addColorStop(1, 'rgba(242,183,5,0)');
    g.fillStyle = g2; g.fillRect(0, 0, w, h);
    // a fine grid that drifts slowly
    var step = 56, off = (T * 3) % step;
    g.beginPath();
    for (var x = -off; x < w; x += step) { g.moveTo(x, 0); g.lineTo(x, h); }
    for (var y = -off * 0.5; y < h; y += step) { g.moveTo(0, y); g.lineTo(w, y); }
    g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 1; g.stroke();
  }

  /* Where the scene sits inside the film: beside the headline on wide
     screens, above it on narrow ones. */
  function filmStage(w, h) {
    if (w >= 860) return { x: w * 0.4, y: h * 0.035, w: w * 0.565, h: h * 0.8 };
    return { x: w * 0.04, y: h * 0.03, w: w * 0.92, h: h * 0.44 };
  }

  /* The scene leans a few pixels towards the pointer. */
  var lean = { x: 0, y: 0, tx: 0, ty: 0 };
  TL.lean = function (x, y) { lean.tx = x; lean.ty = y; };

  function drawFilm(g, T, w, h) {
    lean.x += (lean.tx - lean.x) * 0.05; lean.y += (lean.ty - lean.y) * 0.05;
    drawFilmBackground(g, T, w, h);
    var at = chapterAt(T), ch = CHAPTERS[at.index], t = at.t;
    var st = filmStage(w, h), scale = Math.min(st.w / 1000, st.h / 700);
    var aIn = easeOut(sat(t / 0.7)), aOut = 1 - easeIn(sat((t - (ch.dur - 0.55)) / 0.55));
    g.save();
    g.translate(st.x + (st.w - 1000 * scale) / 2 + ((1 - aIn) * 46 - (1 - aOut) * 46) * scale + lean.x * 14, st.y + (st.h - 700 * scale) / 2 + lean.y * 10);
    g.scale(scale, scale);
    g.globalAlpha = aIn * aOut;
    ch.draw(g, t, kit(g, DARK, scale));
    g.restore();
    return at;
  }

  /* ============================================================
     CASE FILMS, five short loops (virtual box 640 x 400)
     ============================================================ */

  function caseIngest(g, t, k) {
    var C = k.C, i, hx = 300, hy = 178;
    if (!k.compact) { k.mono(11, 600); k.text('METER FILES', 36, 34, C.teal); k.text('BILLING ENGINE', 392, 112, C.dim); }
    for (i = 0; i < 5; i++) {
      var y = 52 + i * 58;
      k.line(96, y + 19, hx, hy, C.hair, 1.2);
      var u = frac(t * 0.5 + i * 0.21);
      k.dot(lerp(96, hx, u), lerp(y + 19, hy, u), 3.5, C.teal);
      k.box(36, y, 60, 38, 9, C.panel, C.panelLine, 1.2);
      k.line(48, y + 14, 84, y + 14, C.teal, 3); k.line(48, y + 24, 72, y + 24, C.tealSoft, 3);
    }
    var pulse = frac(t * 0.6);
    k.alpha(1 - pulse, function () { k.ring(hx, hy, 26 + pulse * 24, C.teal, 1.5); });
    k.dot(hx, hy, 24, C.teal);
    k.check(hx, hy, 18, '#fff', 2.6);
    if (!k.compact) { k.mono(11, 500); k.text('validated, no duplicates', hx, hy + 56, C.dim, 'center'); }
    k.line(hx + 26, hy, 392, hy, C.beak, 2, [6, 7], -t * 26);
    k.box(392, 130, 156, 96, 14, C.panel, C.beak, 1.8);
    k.mono(13, 600); k.text('kWh × rate', 470, k.compact ? 184 : 174, C.ink, 'center');
    k.mono(10, 500); if (!k.compact) k.text('tariffs · losses · GST', 470, 196, C.dim, 'center');
    var n = Math.floor(t / 1.5);
    for (i = 0; i < 3; i++) {
      var a = i === 0 ? easeOut(frac(t / 1.5) / 0.4 > 1 ? 1 : frac(t / 1.5) / 0.4) : 1;
      (function (i, a) { k.alpha(a * (1 - i * 0.28), function () { k.box(560, 138 + i * 30 - (i === 0 ? (1 - a) * 12 : 0), 66, 22, 7, C.panel, C.beak, 1.2); if (k.compact) k.bar(572, 153 + i * 30, 42, 7, C.dim); else { k.mono(9.5, 600); k.text('INV-' + (2040 + n - i), 593, 153 + i * 30, C.ink, 'center'); } }); })(i, a);
    }
    for (i = 0; i < 44; i++) {
      var v = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.36 + 1) * Math.cos(i * 0.11));
      var active = Math.floor(t * 7) % 44 === i;
      k.box(206 + i * 9.6, 372 - v * 52, 6, v * 52, 2, active ? C.beak : C.tealSoft);
    }
    if (!k.compact) { k.mono(10, 500); k.text('half-hour reads', 206, 306, C.dim); }
  }

  var ROUTES = [
    { a: [70, 78], b: [352, 232], c: [200, 250], col: 'beak', sp: 0.22 }, { a: [160, 52], b: [540, 280], c: [420, 60], col: 'beak', sp: 0.18 },
    { a: [250, 92], b: [300, 304], c: [210, 210], col: 'beak', sp: 0.25 }, { a: [112, 138], b: [540, 280], c: [300, 330], col: 'beak', sp: 0.16 },
    { a: [352, 232], b: [540, 280], c: [450, 190], col: 'blue', sp: 0.3 }, { a: [300, 304], b: [540, 280], c: [420, 350], col: 'blue', sp: 0.27 }
  ];
  function caseTwoCountries(g, t, k) {
    var C = k.C, i;
    for (i = 0; i < 9; i++) k.line(20 + i * 75, 20, 20 + i * 75, 380, C.hair, 1);
    for (i = 0; i < 5; i++) k.line(20, 40 + i * 80, 620, 40 + i * 80, C.hair, 1);
    var pulse = frac(t * 0.4);
    k.alpha((1 - pulse) * 0.6, function () { k.ring(540, 280, 14 + pulse * 60, C.beak, 1.5); });
    for (i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      k.curve(r.a[0], r.a[1], r.c[0], r.c[1], r.b[0], r.b[1], C.faint, 1.2);
      for (var n = 0; n < 2; n++) {
        var u = frac(t * r.sp + i * 0.31 + n * 0.5);
        k.dot(quad(r.a[0], r.c[0], r.b[0], u), quad(r.a[1], r.c[1], r.b[1], u), 4, C[r.col]);
      }
    }
    var sup = [[70, 78], [160, 52], [250, 92], [112, 138]];
    for (i = 0; i < sup.length; i++) k.halo(sup[i][0], sup[i][1], 5, C.teal, 2);
    var hubs = [[352, 232, 'Sydney'], [300, 304, 'Melbourne'], [540, 280, 'Auckland']];
    for (i = 0; i < hubs.length; i++) {
      k.halo(hubs[i][0], hubs[i][1], 7, C.beak, 2);
      if (!k.compact) { k.sans(12, 600); k.text(hubs[i][2], hubs[i][0] + 14, hubs[i][1] + 4, C.ink); }
    }
    if (!k.compact) { k.mono(11, 600); k.text('SUPPLIERS', 36, 30, C.teal); }
    var chips = ['NZD', 'AUD', 'USD', 'GST', 'BAS'], on = Math.floor(t / 1.1) % chips.length;
    for (i = 0; i < chips.length; i++) {
      k.box(36 + i * 62, 346, 54, 26, 13, i === on ? C.tealSoft : C.panel, i === on ? C.teal : C.panelLine, 1.2);
      k.mono(11, 600); k.text(chips[i], 63 + i * 62, 363, i === on ? C.teal : C.dim, 'center');
    }
  }

  function caseClinic(g, t, k) {
    var C = k.C, xs = [118, 320, 522], y = 140, names = ['Reception', 'Consultation', 'Billing'], i;
    var cyc = t % 7, u = sat(cyc / 5.2) * 2, seg = Math.min(1, Math.floor(u)), f = easeInOut(u - seg);
    var px = lerp(xs[seg], xs[seg + 1], f), stage = u >= 2 ? 2 : (u >= 1 ? 1 : 0);
    k.line(xs[0], y, xs[2], y, C.faint, 1.5, [5, 6]);
    for (i = 0; i < 3; i++) {
      var here = Math.abs(px - xs[i]) < 40;
      k.dot(xs[i], y, 56, C.panel);
      k.ring(xs[i], y, 56, here ? C.teal : C.panelLine, here ? 2.2 : 1.4);
      k.ring(xs[i], y, 68, C.hair, 1);
      k.box(xs[i] - 10, y + 44, 20, 17, 5, C.panel, C.beak, 1.8);
      g.beginPath(); g.arc(xs[i], y + 44, 6, Math.PI, 0); g.strokeStyle = C.beak; g.lineWidth = 1.8; g.stroke();
      k.sans(13, 600); if (!k.compact) k.text(names[i], xs[i], y + 92, C.ink, 'center');
    }
    k.box(px - 24, y - 18, 48, 36, 9, C.panel, C.teal, 1.6);
    k.dot(px - 11, y - 5, 5, C.teal); k.line(px, y - 7, px + 14, y - 7, C.dim, 2.5); k.line(px - 15, y + 7, px + 14, y + 7, C.faint, 2.5);
    var rowsTxt = ['reception · consent recorded', 'consultation · record signed', 'billing · insurer guide sent'];
    if (!k.compact) { k.mono(10.5, 600); k.text('AUDIT LOG', 60, 276, C.teal); }
    for (i = 0; i <= stage; i++) {
      var since = cyc - (i * 2.6 + 0.2), a = easeOut(sat(since / 0.5));
      (function (i, a) {
        k.alpha(a, function () {
          var ry = 292 + i * 30;
          k.box(60, ry, 520, 24, 8, C.panel, C.panelLine, 1);
          k.check(76, ry + 12, 9, C.teal, 1.8);
          if (k.compact) k.bar(92, ry + 16, 220 - i * 30, 7, C.dim); else { k.mono(10.5, 500); k.text(rowsTxt[i], 92, ry + 16, C.dim); }
        });
      })(i, a);
    }
  }

  var QR = (function () { var r = rng(5), a = []; for (var i = 0; i < 121; i++) a.push(r() > 0.5); return a; })();
  function caseTraining(g, t, k) {
    var C = k.C, i, cyc = t % 6;
    // certificate
    k.box(34, 60, 196, 150, 12, C.panel, C.panelLine, 1.2);
    k.line(46, 72, 46 + 172 * easeOut(sat(cyc / 1.6)), 72, C.beak, 2.5);
    k.sans(12.5, 700); if (k.compact) k.bar(84, 104, 96, 9, C.ink); else k.text('CERTIFICATE', 132, 106, C.ink, 'center');
    k.line(70, 126, 194, 126, C.faint, 3); k.line(90, 140, 174, 140, C.hair, 3);
    k.ring(132, 172, 15, C.beak, 2); k.check(132, 172, 12, C.beak, 2, (cyc - 1.6) / 0.5);
    if (!k.compact) { k.mono(9.5, 500); k.text('No. 000412 · verifiable', 132, 232, C.dim, 'center'); }
    // QR at the door
    var qx = 268, qy = 70, qs = 118, c = qs / 11;
    k.box(qx - 8, qy - 8, qs + 16, qs + 16, 10, C.panel, C.panelLine, 1.2);
    for (i = 0; i < 121; i++) {
      var col = i % 11, row = Math.floor(i / 11);
      var corner = (col < 3 && row < 3) || (col > 7 && row < 3) || (col < 3 && row > 7);
      if (corner || QR[i]) k.box(qx + col * c + 1, qy + row * c + 1, c - 2, c - 2, 1.5, C.ink);
    }
    var sy = qy + (0.5 + 0.5 * Math.sin(t * 2.6)) * qs;
    k.line(qx - 4, sy, qx + qs + 4, sy, C.teal, 2.5);
    var ok = Math.floor(t / 1.6) % 2 === 1;
    k.mono(10.5, 600); if (!k.compact) k.text(ok ? 'checked in' : 'scanning', qx + qs / 2, qy + qs + 34, ok ? C.teal : C.dim, 'center');
    // roll call
    var names = ['Almeida, R.', 'Barbosa, T.', 'Carvalho, M.', 'Duarte, P.', 'Ferreira, L.', 'Gomes, A.'];
    if (!k.compact) { k.mono(10.5, 600); k.text('ROLL CALL', 430, 64, C.teal); }
    for (i = 0; i < 6; i++) {
      var done = sat((cyc - 0.4 - i * 0.7) / 0.35), ry = 76 + i * 30;
      k.box(430, ry, 176, 24, 8, C.panel, done > 0 ? C.tealSoft : C.panelLine, 1);
      if (k.compact) k.bar(442, ry + 16, 90, 7, C.dim); else { k.mono(10.5, 500); k.text(names[i], 442, ry + 16, C.dim); }
      if (done > 0) k.check(590, ry + 12, 9, C.teal, 1.8, done);
    }
    var total = Math.min(6, Math.max(0, Math.floor((cyc - 0.4) / 0.7) + 1));
    k.line(34, 300, 606, 300, C.hair, 1);
    k.sans(30, 700); k.text(total + ' / 6', 34, 348, C.ink);
    if (!k.compact) { k.mono(11, 500); k.text('present, with evidence', 124, 344, C.dim); }
  }

  var GANTT = [[0.4, 3.5, 'Civil works'], [3.5, 2.2, 'Fabrication'], [6.0, 1.6, 'Electrical'], [8.4, 2.2, 'Commissioning']];
  function casePlanner(g, t, k) {
    var C = k.C, x0 = 44, x1 = 600, mw = (x1 - x0) / 12, i, cyc = (t % 8) / 8, today = lerp(0.6, 11.2, easeInOut(sat(cyc / 0.82)));
    var months = 'JFMAMJJASOND';
    for (i = 0; i <= 12; i++) k.line(x0 + i * mw, 44, x0 + i * mw, 210, C.hair, 1);
    k.mono(10, 500); for (i = 0; i < 12; i++) k.text(months[i], x0 + i * mw + mw / 2, 34, C.dim, 'center');
    for (i = 0; i < GANTT.length; i++) {
      var b = GANTT[i], bx = x0 + b[0] * mw, bw = b[1] * mw, by = 58 + i * 38;
      var p = sat((today - b[0]) / b[1]);
      k.box(bx, by, bw, 22, 7, C.tealSoft, C.teal, 1);
      if (p > 0) k.box(bx, by, Math.max(10, bw * p), 22, 7, C.teal);
      if (!k.compact) { k.mono(10, 600); k.text(b[2], bx + bw + 8, by + 15, C.ink); }
    }
    var tx = x0 + today * mw;
    k.line(tx, 40, tx, 214, C.beak, 2, [4, 4]);
    k.dot(tx, 40, 4, C.beak);
    var targets = [0.82, 0.57, 0.34], labels = ['Budget used', 'Schedule', 'Approvals'];
    for (i = 0; i < 3; i++) {
      var gx = 112 + i * 208, gy = 306, v = targets[i] * easeOut(sat(cyc / 0.7));
      k.arc(gx, gy, 40, Math.PI * 0.75, Math.PI * 2.25, C.hair, 9);
      if (v > 0.01) k.arc(gx, gy, 40, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * v), i === 0 ? C.beak : C.teal, 9);
      k.sans(17, 700); k.text(Math.round(v * 100) + '%', gx, gy + 6, C.ink, 'center');
      if (!k.compact) { k.mono(10, 500); k.text(labels[i], gx, gy + 66, C.dim, 'center'); }
    }
  }

  var CASES = { ingest: caseIngest, countries: caseTwoCountries, clinic: caseClinic, training: caseTraining, planner: casePlanner };

  /* ============================================================
     PLAYER: sizing, the loop, and knowing when not to run
     ============================================================ */
  function Player(canvas, render) {
    this.canvas = canvas; this.g = canvas.getContext('2d'); this.render = render;
    this.w = 0; this.h = 0; this.time = 0; this.last = 0; this.raf = 0;
    this.wanted = false;   // the visitor (or the default) wants it playing
    this.active = true;    // the browser is actually rendering it
    this.onframe = null;
    var self = this;
    this.tick = function (now) {
      self.raf = 0;
      if (!self.wanted || !self.active) return;
      self.time += Math.min(0.1, (now - self.last) / 1000); self.last = now;
      self.paint();
      self.raf = requestAnimationFrame(self.tick);
    };
    if (window.ResizeObserver) new ResizeObserver(function () { self.fit(); self.paint(); }).observe(canvas);
    this.fit();
  }
  Player.prototype.fit = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    this.dpr = dpr;
  };
  Player.prototype.paint = function () {
    if (!this.w) { this.fit(); if (!this.w) return; }
    var g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    var info = this.render(g, this.time, this.w, this.h);
    if (this.onframe) this.onframe(info, this.time);
  };
  Player.prototype.sync = function () {
    if (this.wanted && this.active) { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }
    else if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };
  Player.prototype.play = function () { this.wanted = true; this.sync(); };
  Player.prototype.pause = function () { this.wanted = false; this.sync(); };
  Player.prototype.setActive = function (on) { this.active = on; this.sync(); };
  Player.prototype.seek = function (t) { this.time = t; this.paint(); };

  /* Stop drawing while the browser is not rendering the element.
     `content-visibility: auto` tells us exactly that; browsers
     without it fall back to an IntersectionObserver. */
  function watchRendering(el, player) {
    if ('contentVisibility' in document.documentElement.style && 'oncontentvisibilityautostatechange' in el) {
      el.addEventListener('contentvisibilityautostatechange', function (e) { player.setActive(!e.skipped); });
    } else if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) { player.setActive(entries[entries.length - 1].isIntersecting); }, { rootMargin: '200px' }).observe(el);
    }
  }

  TL.chapters = CHAPTERS;
  TL.filmLength = FILM_LENGTH;
  TL.chapterAt = chapterAt;
  TL.drawFilm = drawFilm;

  TL.mountFilm = function (canvas, holder) {
    var p = new Player(canvas, drawFilm);
    watchRendering(holder || canvas, p);
    return p;
  };

  TL.mountCase = function (canvas, name, holder) {
    var draw = CASES[name]; if (!draw) return null;
    var p = new Player(canvas, function (g, t, w, h) {
      g.clearRect(0, 0, w, h);
      var scale = Math.min(w / 640, h / 400);
      g.save(); g.translate((w - 640 * scale) / 2, (h - 400 * scale) / 2); g.scale(scale, scale);
      draw(g, t, kit(g, LIGHT, scale, 9, 0.74));
      g.restore();
    });
    watchRendering(holder || canvas, p);
    return p;
  };
})();
