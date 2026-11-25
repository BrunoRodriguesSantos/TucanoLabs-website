# Tucano Labs Website

Marketing site for **Tucano Labs**. We design, build and run business platforms on Google
Cloud, from Auckland, New Zealand. The copy and the look follow the client presentation deck.

## Stack

Static site with zero build step and zero dependencies.

- `index.html`: page structure and content
- `styles.css`: the design system (navy, teal and the toucan's yellow; Sora, Manrope, JetBrains Mono)
- `motion.js`: the hero film and the five small case films, drawn on canvas
- `script.js`: film controls, mobile menu, contact e-mail
- `film.html`: the film on its own, full screen (press `F` for fullscreen, space to pause)
- `tools/export-film.mjs`: renders the film to an MP4

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

## The film

The hero is not a video file. It is a 32-second film in four chapters (Safe, Scalable,
Stable, Compliant) drawn live by `motion.js`, so it is sharp on any screen and weighs a
few kilobytes.

- Every scene is a function of time: `sceneSafe(g, t, k)` draws second `t` of its chapter
  inside a fixed 1000 x 700 box. Change a scene and reload to see it.
- Chapter names, captions and lengths are in the `CHAPTERS` list near the middle of the file.
- `index.html?t=12.5` opens the page with the film paused at second 12.5, which helps
  when adjusting a scene.
- The film stops drawing when it is off screen, and people who ask their system for
  reduced motion get a still frame with a play button.

To export it as a video (for LinkedIn, or a slide), with Chrome and ffmpeg installed:

```bash
node tools/export-film.mjs tucano-labs-film.mp4
```

To use real footage one day, replace the `<canvas>` inside `.film__screen` in `index.html`
with a `<video autoplay muted loop playsinline>` and remove the chapter buttons.

## Sections

1. Hero film: *Software your business can depend on.*
2. Who we are
3. Principles: Safe / Scalable / Stable / Compliant
4. Nest: the base under our platforms, and the services we build on
5. Work: five platforms by industry, with no client names
6. Founders: Bruno and Danilo
7. Contact: How can we help?

## Brand

- **Navy**: `#111F45`, **Ink**: `#0F1B3D`
- **Teal**: `#0B8F92`
- **Yellow**: `#F2B705`
- **Ground**: `#F5F7FB`
- **Display type**: Sora. **Body type**: Manrope. **Labels**: JetBrains Mono.
