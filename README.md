# Tucano Labs Website

Marketing site for **Tucano Labs**, a senior-led IT consultancy in Aotearoa New Zealand
serving the ANZ region.

## Stack

Static site with zero build step and zero dependencies.

- `index.html`: page structure and content
- `styles.css`: design system (Plus Jakarta Sans + Inter, Tropical Tech palette)
- `script.js`: sticky-nav state, dynamic footer year, hero card parallax

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

- **Primary**: `#FF6B1A` (Tucano orange)
- **Accent**: `#FFB627` (yellow), `#00B4A6` (teal)
- **Ink**: `#0F1420`
- **Display type**: Plus Jakarta Sans
- **Body type**: Inter

## Sections

1. Hero: *Precision Engineering. Data-Driven Growth.*
2. The Four Pillars: Software / Data / Cloud / Operational Tech
3. Founder-Led Advantage: Bruno & Danilo
4. The Tucano Spirit: Brazilian heritage meets NZ reliability
5. CTA: Book a Strategic Consultation
