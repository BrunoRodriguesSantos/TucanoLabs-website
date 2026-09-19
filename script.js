// ============================================================
// Tucano Labs / small enhancement layer
// ============================================================

(function () {
  // Sticky nav border on scroll
  const nav = document.getElementById("nav");
  const onScroll = () => {
    if (!nav) return;
    if (window.scrollY > 8) nav.classList.add("is-stuck");
    else nav.classList.remove("is-stuck");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Footer year
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // (o parallax das cards flutuantes saiu junto com elas: o herói agora
  // traz o console interativo no lugar)
})();

// ============================================================
// Camada de interacao v2 — reveals no scroll + modulos fixos
// ============================================================

(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  // ---------- Herói: revelação linha a linha no load ----------
  const hero = document.querySelector(".hero");
  if (hero) {
    hero.querySelectorAll(".hero__title .rl__i").forEach((el, i) => {
      el.style.setProperty("--d", i * 110 + "ms");
    });
    // espera a fonte para a máscara não cortar errado
    const ready = () => requestAnimationFrame(() => hero.classList.add("is-ready"));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready);
    else window.addEventListener("load", ready);
    setTimeout(ready, 1200); // rede de segurança
  }

  if (reduced || !("IntersectionObserver" in window)) {
    root.classList.remove("js-reveal");
    return;
  }

  // ---------- Reveals genéricos ----------
  // Marca os alvos aqui em vez de poluir o HTML com data-reveal.
  const targets = [
    ".hero__sub",
    ".hero__cta",
    ".hero__proof .proof",
    ".hero__stage .console",
    ".strip__inner > *",
    ".section__head > *",
    ".shot",
    ".rail__item",
    ".idx__item",
    ".modules__panels .pillar",
    ".stage",
    ".advantage__copy > *",
    ".advantage__art",
    ".pillars--trio .pillar",
    ".founder",
    ".spirit__inner > *",
    ".cta__inner > *",
    ".footer__brand",
    ".footer__col",
  ];

  // Títulos de seção ganham máscara: o texto sobe por trás de uma borda
  // recortada em vez de só aparecer. O conteúdo é movido inteiro para dentro
  // do span, então o .grad interno continua intacto (nada de dividir letras).
  document.querySelectorAll(".section__title, .cta__title, .idx__label").forEach((t) => {
    const inner = document.createElement("span");
    inner.className = "mk__i";
    while (t.firstChild) inner.appendChild(t.firstChild);
    const mask = document.createElement("span");
    mask.className = "mk";
    mask.appendChild(inner);
    t.appendChild(mask);
    t.setAttribute("data-mask", "");
  });

  const groups = new Map();
  targets.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.hasAttribute("data-reveal")) return;
      if (el.hasAttribute("data-mask")) return; // a máscara já cuida dele
      el.setAttribute("data-reveal", "");
      const key = el.parentElement || document.body;
      const list = groups.get(key) || [];
      list.push(el);
      groups.set(key, list);
    });
  });

  // cascata entre irmãos do mesmo pai
  groups.forEach((list) => {
    list.forEach((el, i) => el.style.setProperty("--d", Math.min(i, 8) * 115 + "ms"));
  });

  const revelar = (el) => {
    el.classList.add("is-in");
    io.unobserve(el);
    pendentes.delete(el);
  };

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) revelar(e.target); }),
    { rootMargin: "0px 0px -16% 0px", threshold: 0.06 }
  );
  const pendentes = new Set(document.querySelectorAll("[data-reveal], [data-mask]"));
  pendentes.forEach((el) => io.observe(el));

  // Rede de segurança: se o IO não entregar (callback atrasado, aba oculta no
  // load), o conteúdo ficaria invisível para sempre. Uma varredura no scroll
  // custa pouco e o conjunto só encolhe.
  const varrer = () => {
    if (!pendentes.size) return;
    const h = window.innerHeight;
    pendentes.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.88 && r.bottom > 0) revelar(el);
    });
  };
  window.addEventListener("scroll", varrer, { passive: true });
  window.addEventListener("resize", varrer, { passive: true });
  window.addEventListener("load", varrer);

  // Já visível na primeira tela: revela SINCRONAMENTE, na mesma task em que
  // marcamos os alvos — se esperar um frame, o conteúdo já pintado pisca.
  pendentes.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) revelar(el);
  });

  // ---------- Módulos: trilho fixo segue o scroll ----------
  const mods = document.querySelector("[data-modules]");
  if (mods) {
    const panels = [...mods.querySelectorAll("[data-panel]")];
    const items = [...mods.querySelectorAll("[data-rail]")];
    let current = -1;

    // Determinístico: ativo = último painel cujo topo já cruzou a linha de
    // referência (40% da viewport). Um IntersectionObserver com faixa larga
    // elegeria o painel mais ao topo, não o que domina a tela.
    const pick = () => {
      const line = window.innerHeight * 0.4;
      let idx = 0;
      for (let i = 0; i < panels.length; i++) {
        if (panels[i].getBoundingClientRect().top <= line) idx = i;
      }
      if (idx === current) return;
      current = idx;
      items.forEach((it, n) => it.classList.toggle("is-active", n === idx));
    };

    // Sem throttle de rAF de propósito: o browser já agrupa scroll em ~1 evento
    // por frame, e 4 getBoundingClientRect são baratos. Com o guard de rAF, um
    // frame atrasado deixava o trilho preso no módulo anterior.
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick, { passive: true });
    pick();

    // clique no trilho rola até o painel
    items.forEach((it, n) => {
      it.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        panels[n].scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
})();

// ============================================================
// Console interativo do herói — abas reais, teclado e autoplay
// ============================================================

const STEP = 3400;  // ms por módulo no autoplay
const GRACE = 9000; // folga depois de um clique, para dar tempo de ler

// Datilografia reaproveitada pelo console e pela demo do Kea
function typeInto(el, text, speed, done) {
  el.textContent = "";
  el.classList.add("is-typing");
  let i = 0;
  const id = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(id);
      el.classList.remove("is-typing");
      if (done) done();
    }
  }, speed);
  return () => { clearInterval(id); el.classList.remove("is-typing"); };
}

(function () {
  const root = document.querySelector("[data-console]");
  if (!root) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const bar = root.querySelector("[data-progress]");
  const toggle = root.querySelector("[data-toggle]");

  let idx = 0;
  let timer = null;
  let graceTimer = null;
  let paused = false;   // pausa explícita pelo botão — a única que persiste
  let visible = false;
  let cancelType = null;

  function runBar() {
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0%";
    if (!timer) return;
    requestAnimationFrame(() => {
      bar.style.transition = "width " + STEP + "ms linear";
      bar.style.width = "100%";
    });
  }

  function freezeBar() {
    if (!bar) return;
    const w = getComputedStyle(bar).width;
    bar.style.transition = "none";
    bar.style.width = w;
  }

  function show(n, focus) {
    idx = (n + tabs.length) % tabs.length;
    tabs.forEach((t, i) => {
      const on = i === idx;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
      panels[i].classList.toggle("is-on", on);
    });
    if (focus) tabs[idx].focus();

    if (cancelType) { cancelType(); cancelType = null; }
    const kea = panels[idx].querySelector("[data-type]");
    if (kea) {
      const full = kea.getAttribute("data-type");
      if (reduced) kea.textContent = full;
      else cancelType = typeInto(kea, full, 18);
    }
    runBar();
  }

  function play() {
    if (paused || reduced || !visible || timer || graceTimer) return;
    timer = setInterval(() => show(idx + 1), STEP);
    runBar();
  }

  function stop(freeze) {
    clearInterval(timer);
    clearTimeout(graceTimer);
    timer = null;
    graceTimer = null;
    if (freeze) freezeBar();
    else if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; }
  }

  // Clicar não pausa: a demo é contínua. Só adia o próximo salto por GRACE,
  // para o módulo escolhido ficar legível antes de o ciclo retomar.
  function pick(i, focus) {
    show(i, focus);
    if (paused || reduced || !visible) return;
    clearInterval(timer);
    timer = null;
    clearTimeout(graceTimer);
    // Avança JÁ ao fim da folga, antes de religar o intervalo. Sem isso a
    // barra enchia aos 9s e o salto só vinha 3,4s depois, com ela parada cheia.
    graceTimer = setTimeout(() => { graceTimer = null; show(idx + 1); play(); }, GRACE);
    if (bar) { // a barra acompanha a folga maior
      bar.style.transition = "none";
      bar.style.width = "0%";
      requestAnimationFrame(() => {
        bar.style.transition = "width " + GRACE + "ms linear";
        bar.style.width = "100%";
      });
    }
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => pick(i));
    t.addEventListener("keydown", (e) => {
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (map[e.key]) { e.preventDefault(); pick(idx + map[e.key], true); }
      else if (e.key === "Home") { e.preventDefault(); pick(0, true); }
      else if (e.key === "End") { e.preventDefault(); pick(tabs.length - 1, true); }
    });
  });

  function syncToggle() {
    if (!toggle) return;
    toggle.classList.toggle("is-paused", paused);
    toggle.setAttribute("aria-label", paused ? "Play the demo" : "Pause the demo");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      paused = !paused;
      syncToggle();
      if (paused) stop(false); else play();
    });
  }

  // Antes o mouse por cima pausava; agora não — a demo é contínua.
  // As abas ficam na coluna fixa, então trocar de painel não move o alvo do clique.

  // Visibilidade medida direto, não via IntersectionObserver: o callback do IO
  // pode não chegar (aba oculta, primeiro frame atrasado) e o autoplay nunca
  // arrancaria. Aqui o estado inicial é calculado na hora.
  const inView = () => {
    const r = root.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  const update = () => {
    const v = inView() && !document.hidden;
    if (v === visible) return;
    visible = v;
    v ? play() : stop(false);
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  document.addEventListener("visibilitychange", update);

  syncToggle();
  update();
})();

// ============================================================
// Kea: a conversa se escreve sozinha e recomeça
// ============================================================

(function () {
  const box = document.querySelector("[data-kea-demo]");
  if (!box) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toggle = document.querySelector("[data-kea-toggle]");

  // O 1º roteiro vem do próprio HTML: sem JS, ele fica na página como está
  // (conteúdo real para leitores e crawlers, não um container vazio).
  const first = [...box.querySelectorAll(".kea-chat__msg")].map((p) => ({
    who: p.classList.contains("kea-chat__msg--user") ? "user" : "kea",
    text: p.textContent.replace(/\s+/g, " ").trim(),
  }));

  const scripts = [
    first,
    [
      { who: "user", text: "Which customers are about to churn?" },
      { who: "kea", text: "Four accounts have gone quiet for 60+ days, worth $86k a year. I've ranked them by risk and drafted a check-in for each." },
      { who: "user", text: "Send the top two." },
      { who: "kea", text: "Sent. I'll flag any replies in your Monday digest." },
    ],
    [
      { who: "user", text: "Close the month for me." },
      { who: "kea", text: "Reconciled 214 transactions, matched 209 automatically. Five need your eyes — all under $200. Want the summary?" },
      { who: "user", text: "Yes, and file it." },
      { who: "kea", text: "Filed to Reports · March. Your accountant has view access." },
    ],
  ];

  if (reduced) return; // deixa o roteiro estático do HTML em paz

  let s = 0, paused = false, visible = false, running = false;
  const timers = [];
  const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
  const clearAll = () => { while (timers.length) clearTimeout(timers.pop()); };

  function add(m) {
    const p = document.createElement("p");
    p.className = "kea-chat__msg kea-chat__msg--" + (m.who === "user" ? "user" : "kea");
    box.appendChild(p);
    return p;
  }

  async function play() {
    if (running || paused || !visible) return;
    running = true;
    while (!paused && visible) {
      box.textContent = "";
      for (const m of scripts[s]) {
        if (paused || !visible) break;
        const p = add(m);
        if (m.who === "user") { p.textContent = m.text; await wait(900); }
        else {
          await new Promise((res) => { typeInto(p, m.text, 16, res); });
          await wait(1100);
        }
      }
      if (paused || !visible) break;
      await wait(2600);
      s = (s + 1) % scripts.length;
    }
    running = false;
  }

  function stop() { clearAll(); running = false; }

  function sync() {
    if (!toggle) return;
    toggle.classList.toggle("is-paused", paused);
    toggle.setAttribute("aria-label", paused ? "Play the conversation" : "Pause the conversation");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      paused = !paused; sync();
      if (paused) stop(); else play();
    });
  }

  const inView = () => {
    const r = box.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  const update = () => {
    const v = inView() && !document.hidden;
    if (v === visible) return;
    visible = v;
    v ? play() : stop();
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  document.addEventListener("visibilitychange", update);

  sync();
  update();
})();

// ============================================================
// Contadores — o valor final já está no HTML, isto só anima até ele
// ============================================================

(function () {
  const els = [...document.querySelectorAll("[data-count]")];
  if (!els.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return; // o HTML ja traz o numero final

  const fmt = (el, v) => {
    const dec = +(el.dataset.dec || 0);
    return (el.dataset.prefix || "") + v.toFixed(dec) + (el.dataset.suffix || "");
  };

  function run(el) {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    const target = parseFloat(el.dataset.count);
    const dur = 1100;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(el, target * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(el, target);
    };
    // começa do zero só no primeiro frame, para não piscar o valor final
    el.textContent = fmt(el, 0);
    requestAnimationFrame(step);
  }

  // Dentro do console os números contam toda vez que o painel reaparece;
  // fora dele, contam uma vez quando entram na tela.
  const inConsole = (el) => !!el.closest("[data-console]");

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  const check = () => {
    els.forEach((el) => {
      if (inConsole(el)) return;
      if (visible(el)) run(el);
    });
  };

  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check, { passive: true });
  check();

  // reexecuta os do console a cada troca de painel
  const panels = document.querySelectorAll("[data-console] [role='tabpanel']");
  if (panels.length && "MutationObserver" in window) {
    new MutationObserver((muts) => {
      muts.forEach((m) => {
        const p = m.target;
        if (p.hidden) return;
        p.querySelectorAll("[data-count]").forEach((el) => {
          el.dataset.done = "";
          run(el);
        });
      });
    }).observe(document.querySelector("[data-console]"), {
      attributes: true,
      attributeFilter: ["hidden"],
      subtree: true,
    });
  }
})();

// ============================================================
// Título do herói: peso variável reagindo ao cursor
// ============================================================

(function () {
  const title = document.querySelector(".hero__title");
  if (!title) return;

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return; // toque e reduced-motion ficam com o texto normal

  // O título é 700 e continua 700: mexer no peso deixaria a manchete mais
  // fina em repouso, mudando o visual sem pedido. A onda é de posição/escala,
  // que também funciona na linha com gradiente (onde a cor é do background).
  const LIFT = 15;    // subida máxima, em px
  const SCALE = 0.1;  // acréscimo máximo de escala
  let RADIUS = 260;   // recalculado a partir do tamanho da fonte

  // Quebra em palavras (para não estragar a quebra de linha) e depois em letras
  const chars = [];
  title.querySelectorAll(".rl__i").forEach((line) => {
    const words = line.textContent.split(/(\s+)/);
    line.textContent = "";
    words.forEach((w) => {
      if (/^\s+$/.test(w)) { line.appendChild(document.createTextNode(" ")); return; }
      const ws = document.createElement("span");
      ws.className = "w";
      [...w].forEach((ch) => {
        const cs = document.createElement("span");
        cs.className = "c";
        cs.textContent = ch;
        ws.appendChild(cs);
        chars.push(cs);
      });
      line.appendChild(ws);
    });
  });

  // A linha .grad pinta o texto recortando um gradiente (background-clip:text).
  // Com as letras em spans que ganham will-change/transform, o Chrome promove
  // cada uma a camada própria durante a animação de entrada e o recorte falha
  // por alguns frames: o gradiente aparece como retângulo cheio.
  // Solução: nada de background nas letras. Cada uma recebe uma cor sólida
  // amostrada do mesmo gradiente pela sua posição na linha. Visualmente igual,
  // e sem recorte não há o que quebrar.
  const lerCor = (nome) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    const m = v.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const paintGradient = () => {
    const linha = title.querySelector(".rl__i.grad");
    if (!linha) return;
    const paradas = [
      { p: 0, c: lerCor("--navy") },
      { p: 0.55, c: lerCor("--teal") },
      { p: 1, c: lerCor("--teal-bright") },
    ];
    const amostra = (t) => {
      let i = 1;
      while (i < paradas.length - 1 && t > paradas[i].p) i++;
      const a = paradas[i - 1], b = paradas[i];
      const k = b.p === a.p ? 0 : (t - a.p) / (b.p - a.p);
      return "rgb(" + a.c.map((v, j) => Math.round(v + (b.c[j] - v) * k)).join(",") + ")";
    };

    // o gradiente do CSS deixa de ser usado nesta linha
    linha.style.backgroundImage = "none";
    const lr = linha.getBoundingClientRect();
    const largura = lr.width || 1;
    linha.querySelectorAll(".c").forEach((c) => {
      const anterior = c.style.transform;
      c.style.transform = "none"; // mede a posição de repouso
      const cr = c.getBoundingClientRect();
      c.style.transform = anterior;
      const t = Math.min(1, Math.max(0, (cr.left + cr.width / 2 - lr.left) / largura));
      c.style.color = amostra(t);
      c.style.backgroundImage = "none";
      c.style.webkitBackgroundClip = "border-box";
      c.style.backgroundClip = "border-box";
    });
  };

  let centers = [];
  const measure = () => {
    // o raio acompanha o tamanho da fonte: em telas menores a onda encolhe junto
    const fs = parseFloat(getComputedStyle(title).fontSize) || 80;
    RADIUS = fs * 3.2;
    centers = chars.map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  };

  let mx = -9999, my = -9999, ticking = false, live = false;

  function paint() {
    ticking = false;
    for (let i = 0; i < chars.length; i++) {
      const p = centers[i];
      if (!p) continue;
      const dx = p.x - mx, dy = p.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      // queda suave: 1 no cursor, 0 na borda do raio
      const f = d >= RADIUS ? 0 : Math.pow(1 - d / RADIUS, 2);
      chars[i].style.transform = f
        ? "translateY(" + (-LIFT * f).toFixed(2) + "px) scale(" + (1 + SCALE * f).toFixed(3) + ")"
        : "";
    }
  }

  const onMove = (e) => {
    mx = e.clientX; my = e.clientY;
    if (!live) { live = true; title.classList.add("is-live"); measure(); }
    if (!ticking) { ticking = true; requestAnimationFrame(paint); }
  };

  const onLeave = () => {
    live = false;
    title.classList.remove("is-live");
    mx = my = -9999;
    requestAnimationFrame(paint);
  };

  // escuta na seção inteira: o efeito começa antes do cursor tocar as letras
  const area = title.closest(".hero") || title;
  area.addEventListener("pointermove", onMove);
  area.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", () => { paintGradient(); if (live) measure(); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintGradient);
  window.addEventListener("scroll", () => { if (live) measure(); }, { passive: true });

  paintGradient();
  paint(); // estado de repouso
})();
