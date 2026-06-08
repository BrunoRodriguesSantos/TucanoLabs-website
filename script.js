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

  // Subtle parallax on the hero floating cards (rAF-throttled)
  const cards = document.querySelectorAll(".hero__art .card--floating");
  if (cards.length) {
    let mx = 0,
      my = 0,
      ticking = false;
    const hero = document.querySelector(".hero__art");
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      mx = (e.clientX - (r.left + r.width / 2)) / r.width;
      my = (e.clientY - (r.top + r.height / 2)) / r.height;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          cards.forEach((c, i) => {
            const depth = 6 + i * 4;
            c.style.transform = `translate3d(${mx * depth}px, ${my * depth}px, 0)`;
          });
          ticking = false;
        });
      }
    };
    if (window.matchMedia("(hover: hover)").matches) {
      window.addEventListener("mousemove", onMove);
    }
  }
})();
