# Sol · Terra · Luna

An accessible, responsive collection of interactive solar-system experiences:

- **Light Study** — Sun, Earth, and Moon lighting, phases, and eclipses. Save the current view as a wallpaper image.
- **Grand Tour** — the planets, dwarf planets, belts, moons, and a comet
- **Seasons** — Earth's tilt, sunlight, solstices, and equinoxes
- **Scale Walk** — proportional planetary distances and size analogies
- **Sky Tonight** — a rough elongation-based guide to planetary visibility
- **Missions** — notable spacecraft and their discoveries

## Run locally

```sh
bun dev-server.ts        # http://localhost:8765
```

`dev-server.ts` serves the deployable `public/` directory the way Cloudflare
does, reading the same `wrangler.jsonc`, `_redirects`, and `_headers`. That
matters because the site's URLs are extensionless — a plain static file server
cannot resolve `/seasons` to `seasons.html`, so every cross-page link 404s. It
also applies the production `Content-Security-Policy`, so a missing
inline-script hash shows up locally instead of on the live site.

Pass a port to override the default: `bun dev-server.ts 3000`.

For full fidelity — Workers runtime included — use `bunx wrangler dev` instead.

Three.js (r185, ES modules) is vendored under `vendor/three/`, so the 3D
scenes work fully offline once the site is served. WebGL pages load it
through an import map (`three` → `vendor/three/three.module.min.js`).
Missions and Sky Tonight import only `chrome.js` and never load Three.js.

## Verify

The browser loads `public/common.bundle.js`, generated from `common.js` and
its post-processing helpers. After editing those sources, rebuild with
`bun run build.ts`. Three.js and the early-loading chrome module remain shared
external dependencies.

Run the repository checks with Bun:

```sh
bun test
```

The Argent flows are the pull-request regression suite. CI replays them in
Electron (`--platform chromium`). On a booted Simulator or emulator, use
agent-device:

```sh
bun dev-server.ts
argent flow run qa-home-open-light-study --platform chromium
.agent-device/run ios
.agent-device/run android
```

Argent YAML lives in `.argent/flows/` (`.argent/qa.md`). Local Safari/Chrome
scripts live in `.agent-device/flows/` (`.agent-device/qa.md`).

For an additional HTML conformance check:

```sh
bunx html-validate public/index.html public/solar-system.html \
  public/seasons.html public/scale-walk.html public/sky-tonight.html \
  public/missions.html
```

## URLs

Every page is served extensionless and without a trailing slash — `/seasons`,
not `/seasons.html` or `/seasons/`. One URL per page, and `<link rel=canonical>`,
`og:url`, and `sitemap.xml` all name that one. Three pieces hold it together:

- `wrangler.jsonc` pins `html_handling: "drop-trailing-slash"`, which is what
  serves `seasons.html` at `/seasons`. Trailing slashes matter beyond tidiness:
  pages import `./chrome.js`, which resolves to `/chrome.js` from `/seasons` but
  to `/seasons/chrome.js` — a 404 — from `/seasons/`.
- `public/_redirects` sends each `.html` URL to its absolute https canonical
  (`https://tinyastronomer.com/`, `https://tinyastronomer.com/missions`, …)
  with a **301**. Cloudflare would redirect them anyway, but only temporarily,
  which leaves the old URLs sitting in Google's index rather than folding them
  into the canonical.
- `not_found_handling: "none"` keeps unknown paths a real 404 instead of a
  soft 404 serving `index.html` with a 200.

Adding a page means adding it to `sitemap.xml` and `_redirects` too; the checks
in `site.test.ts` fail if you skip either.

## Technology

- Three.js 0.185.1
- WebGL and custom GLSL shaders
- Vanilla HTML, CSS, and JavaScript
- 4K Earth day, 2K night-lights, normal, and specular maps from the
  [three.js example planet textures](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets)
  (three.js is MIT-licensed), derived from NASA's
  [Visible Earth "Blue Marble" planet textures](https://visibleearth.nasa.gov/collection/1484/planet-textures)
- Earth cloud overlay from the three.js example planet textures; its drift and altitude are illustrative, not live weather.
- Moon color (2K) and elevation (1K) maps from [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), based on LRO/LROC and LOLA data.
- Grand Tour planet models and surface composites from NASA's
  [3D Resources](https://science.nasa.gov/3d-resources/), prepared by NASA's
  Visualization Technology Applications and Development team. The bundled
  copies preserve topology while using geometry quantization and 2K WebP texture compression.

## Scientific model

Each study now carries a visible fidelity label that states what its model
preserves, what it changes, and which primary sources support it. The Light
Study is an Earth-centered reference view with compressed display distances;
body spacing and the Sun's visible size are not to scale, which keeps the
complete system legible on one screen. That model uses:

- Earth's 23.4393° obliquity and a 365.256-day year
- Earth's WGS 84 equatorial and polar radii, normalized to its volumetric mean radius
- The Moon's 27.321661-day sidereal period, 5.145° orbital inclination,
  0.0549 eccentricity, synchronous rotation, and 18.6-year node precession
- Angular eclipse tests that are independent of the compressed display scale

Small effects such as lunar libration, nutation, and short-period orbital
perturbations are intentionally omitted. The Sky Tonight
page uses circular mean-orbit approximations and is a general guide rather than
a location-specific observing forecast.

Reference values come from [NASA Solar System facts](https://science.nasa.gov/solar-system/),
[NASA Earth facts](https://science.nasa.gov/earth/facts/),
[NASA Moon facts](https://science.nasa.gov/moon/facts/), and
[NASA eclipse orbital data](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html)
(Fred Espenak, NASA Goddard Space Flight Center).

The claim-by-claim review, source matrix, volatile-data policy, and maintenance
checklist are recorded in [the scientific audit](docs/scientific-audit.md).

## Performance

The home deck uses a captured Earth preview and loads the interactive Light
Study on demand (including direct `#light-study` links). Grand Tour loads NASA
models when a planet is selected, except Saturn: its small model loads in the
overview too, preserving its flattened globe and ring geometry. Other overview
globes use neutral fallbacks. Earth's normal, specular, and night maps also load only when Earth is
selected. Grand Tour initializes lightweight controls before loading the 3D
modules and precompiles scene shaders before starting animation. Scale Walk uses
pre-rendered illustrative textures. Fonts are hosted
locally under their bundled SIL Open Font Licenses in `public/assets/fonts/`.
Visible 3D animation is capped at 60 fps and decorative 2D animation at 30 fps;
hidden tabs and offscreen canvases suspend their animation callbacks.

Keep local profiling reports, screenshots, and recordings under `artifacts/`
(ignored by Git). Source, tests, reusable QA flows, and asset provenance belong
in the repository; one-off audit notes and personal IDE settings do not.

## Credits

- 3D rendering: [three.js](https://github.com/mrdoob/three.js) (MIT License)
- Earth textures: [three.js example planet textures](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets),
  derived from NASA [Visible Earth — Blue Marble](https://visibleearth.nasa.gov/collection/1484/planet-textures)
- Moon imagery: NASA’s Scientific Visualization Studio, Ernie Wright — [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). The elevation map supplies subtle bump shading; it does not change the lunar silhouette.
- Grand Tour planet models: NASA Visualization Technology Applications and
  Development, via NASA [3D Resources](https://science.nasa.gov/3d-resources/)
- Reference data: NASA [Solar System](https://science.nasa.gov/solar-system/),
  [Earth facts](https://science.nasa.gov/earth/facts/),
  [Moon facts](https://science.nasa.gov/moon/facts/), and
  [eclipse / Moon-orbit data](https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html)

## License

Original code (the HTML, CSS, JavaScript, and shaders in this repository) is
released under the [MIT License](LICENSE). Bundled third-party assets in
`assets/` retain the terms of their original sources, noted under Credits and in
the `LICENSE` file.
