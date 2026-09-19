# Tucano Labs Website

Marketing site for **Tucano Labs**, a senior-led IT consultancy in Aotearoa New Zealand
serving the ANZ region.

## Stack

Static site with zero build step and zero dependencies.

- `index.html`: page structure and content
- `styles.css`: design system (Space Grotesk + Inter, toucan teal/navy palette)
- `script.js`: sticky nav, scroll reveals, hero console demo, Kea conversation,
  module rail, counters, hero title cursor effect

## Running locally

```bash
python3 -m http.server 8080
# open http://127.0.0.1:8080
```

Or open `index.html` directly in a browser.

## Deploying

Hosted on Cloudflare Pages, connected to this GitHub repo. Every push to `main`
deploys automatically. No build command; output directory is the repo root (`/`).

Live domain: **tucanolabs.net**. Contact: **info@tucanolabs.net**.

## Brand

Palette taken from the toucan in the logo. The orange is the beak only, so it
stays in the mark and out of the interface.

- **Primary**: `#048F92` (toucan teal)
- **Deep**: `#1D346F` (toucan navy), `#111F45`
- **Highlight**: `#14B8B3` (teal on dark), `#FFCC2E` (beak yellow, rare)
- **Ink**: `#0A1020` (cool near-black)
- **Display type**: Space Grotesk
- **Body type**: Inter

Small text meets WCAG AA on white: `--teal-text` 6.05:1, `--muted` 4.97:1.

## Sections

1. Hero: *Run your whole business on one AI-powered platform* — full-bleed, with
   an interactive Tucano Nest console that cycles through its modules on its own
2. Inside Tucano Nest: continuous ticker
3. Product: ERP / CRM / BI / Kea, on a sticky rail that follows the scroll
4. Kea: a conversation that types itself and loops through three scripts
5. Solutions & Services
6. Founders: Bruno & Danilo
7. The Tucano Spirit
8. CTA, Index, footer

## Motion

Everything that moves on its own can be paused, and `prefers-reduced-motion`
disables the lot. Scroll reveals are progressive enhancement: the resting
(hidden) state only applies once JS confirms it will reveal, so with JS off or
blocked the page renders in full.
