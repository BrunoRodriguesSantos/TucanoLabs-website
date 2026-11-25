/* ============================================================
   Tucano Labs / script.js
   Page behaviour. The site works without it: this only adds the
   film controls, the menu, and a few conveniences.
   ============================================================ */
(function () {
  'use strict';

  var TL = window.TL || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var supports = function (q) { return !!(window.CSS && CSS.supports && CSS.supports(q)); };
  var scrollDriven = supports('(animation-timeline: view()) and (animation-range: entry)');

  /* ---------- footer year ---------- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- menu on small screens ---------- */
  var bar = $('#top-bar'), menu = $('#menu-toggle'), nav = $('#site-nav');
  if (bar && menu && nav) {
    var setMenu = function (open) {
      bar.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    menu.addEventListener('click', function () { setMenu(!bar.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('is-open')) { setMenu(false); menu.focus(); }
    });
  }

  /* ---------- the hero film ---------- */
  var film = $('#film'), filmCanvas = $('#film-canvas');
  if (film && filmCanvas && TL.mountFilm) {
    var player = TL.mountFilm(filmCanvas, $('.film__screen', film));
    var buttons = $$('.chapter', film), caption = $('#film-caption'), toggle = $('#film-toggle');
    var current = -1;
    TL.hero = player;

    player.onframe = function (at) {
      if (!at) return;
      var dur = TL.chapters[at.index].dur;
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].style.setProperty('--p', i < at.index ? '1' : i === at.index ? (at.t / dur).toFixed(4) : '0');
      }
      if (at.index !== current) {
        current = at.index;
        buttons.forEach(function (b, i) {
          if (i === current) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
        if (caption) caption.textContent = TL.chapters[current].caption;
      }
    };

    var chapterStart = function (index) {
      var s = 0;
      for (var i = 0; i < index; i++) s += TL.chapters[i].dur;
      return s;
    };

    var setPlaying = function (on) {
      film.classList.toggle('is-paused', !on);
      // The label says what the button will do, so no aria-pressed
      if (toggle) toggle.setAttribute('aria-label', on ? 'Pause film' : 'Play film');
      if (on) player.play(); else player.pause();
    };

    if (toggle) toggle.addEventListener('click', function () { setPlaying(!player.wanted); });

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () {
        // Playing: start the chapter. Paused: show its finished frame.
        player.seek(chapterStart(i) + (player.wanted ? 0.02 : TL.chapters[i].still));
      });
    });

    // People who ask for less motion get a still, and can press play.
    var seekParam = /[?&]t=([\d.]+)/.exec(location.search);
    if (seekParam) { player.seek(parseFloat(seekParam[1])); setPlaying(false); }
    else if (reduce.matches) { player.seek(TL.chapters[0].still); setPlaying(false); }
    else setPlaying(true);

    // The canvas type uses the web fonts, so repaint once they arrive.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { player.paint(); });

    // With a mouse, the scene leans slightly towards the pointer.
    if (TL.lean && !reduce.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      film.addEventListener('pointermove', function (e) {
        var r = film.getBoundingClientRect();
        TL.lean(((e.clientX - r.left) / r.width - 0.5) * -2, ((e.clientY - r.top) / r.height - 0.5) * -2);
      });
      film.addEventListener('pointerleave', function () { TL.lean(0, 0); });
    }
  }

  /* ---------- the small case films ---------- */
  if (TL.mountCase) {
    $$('canvas[data-case]').forEach(function (c, i) {
      var p = TL.mountCase(c, c.getAttribute('data-case'), c.parentElement);
      if (!p) return;
      p.time = 2.4 + i * 1.3;
      if (reduce.matches) p.paint(); else p.play();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { p.paint(); });
    });
  }

  /* ---------- the paragraph that lights up word by word ----------
     Only where the browser can drive it from scroll position in CSS. */
  var say = $('#say-text');
  if (say && scrollDriven && !reduce.matches) {
    var words = say.textContent.trim().split(/\s+/);
    say.textContent = '';
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      var start = 20 + (i / words.length) * 27;
      span.className = 'w';
      span.textContent = word;
      span.style.setProperty('--s', start.toFixed(2));
      span.style.setProperty('--e', (start + 5).toFixed(2));
      say.appendChild(span);
      if (i < words.length - 1) say.appendChild(document.createTextNode(' '));
    });
    say.classList.add('is-split');
  }

  /* ---------- reveal fallback ----------
     Browsers with scroll-driven animations do this in CSS alone. */
  if (!scrollDriven && !reduce.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('io-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal, .tiles8 li').forEach(function (el) { io.observe(el); });
  }

  /* ---------- which section are we in ---------- */
  if (nav) {
    var links = $$('a', nav);
    var mark = function (active) {
      links.forEach(function (l) { l.setAttribute('aria-current', l === active ? 'true' : 'false'); });
    };
    if (supports('scroll-target-group: auto')) {
      // CSS highlights the link; this mirrors it for assistive technology.
      var sync = function () {
        var cur = null;
        try { cur = nav.querySelector('a:target-current'); } catch (err) { cur = null; }
        mark(cur);
      };
      sync();
      document.addEventListener('scrollend', sync);
      // scrollend is not sent for every kind of scroll, so settle after plain scroll events too
      var settle = 0;
      window.addEventListener('scroll', function () { clearTimeout(settle); settle = setTimeout(sync, 160); }, { passive: true });
    } else if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var active = null;
          links.forEach(function (l) {
            var on = l.getAttribute('href') === '#' + e.target.id;
            l.classList.toggle('target-current', on);
            if (on) active = l;
          });
          mark(active);
        });
      }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
      links.forEach(function (l) {
        var target = document.getElementById(l.getAttribute('href').slice(1));
        if (target) spy.observe(target);
      });
      var hero = $('#top');
      if (hero) spy.observe(hero);
    }
  }

  /* ---------- contact ---------- */
  var mail = $('#contact-mail');
  if (mail) {
    var questions = $$('.ask__list li').map(function (li, i) { return (i + 1) + '. ' + li.textContent.trim(); });
    var body = 'Hello Bruno and Danilo,\n\nSome answers to start the conversation:\n\n' + questions.join('\n\n\n') + '\n\n\nThanks,\n';
    mail.href = 'mailto:info@tucanolabs.net?subject=' + encodeURIComponent('How can Tucano Labs help') + '&body=' + encodeURIComponent(body);
  }

  var copy = $('#copy-email'), copyStatus = $('#copy-status');
  if (copy) {
    copy.addEventListener('click', function () {
      var email = copy.getAttribute('data-email');
      var hint = $('.copy__hint', copy);
      var done = function () {
        copy.classList.add('is-done');
        if (hint) hint.textContent = 'Copied';
        if (copyStatus) copyStatus.textContent = 'E-mail address copied';
        setTimeout(function () {
          copy.classList.remove('is-done');
          if (hint) hint.textContent = 'Copy';
          if (copyStatus) copyStatus.textContent = '';
        }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, function () { location.href = 'mailto:' + email; });
      } else {
        location.href = 'mailto:' + email;
      }
    });
  }
})();
