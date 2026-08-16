# Sol · Terra · Luna

An accessible, responsive collection of interactive solar-system experiences:

- **Light Study** — Sun, Earth, and Moon lighting, phases, and eclipses
- **Grand Tour** — the planets, dwarf planets, belts, moons, and a comet
- **Seasons** — Earth's tilt, sunlight, solstices, and equinoxes
- **Scale Walk** — proportional planetary distances and size analogies
- **Sky Tonight** — a rough elongation-based guide to planetary visibility
- **Missions** — notable spacecraft and their discoveries

## Run locally

Serve the deployable `public/` directory with any static web server (ES
modules will not load from `file://`):

```sh
python3 -m http.server 8000 --directory public
```

Then visit <http://localhost:8000>.

Three.js (r185, ES modules) is vendored under `vendor/three/`, so the 3D
scenes work fully offline once the site is served. WebGL pages load it
through an import map (`three` → `vendor/three/three.module.min.js`).
Missions and Sky Tonight import only `chrome.js` and never load Three.js.

## Verify

Run the repository checks with Bun:

```sh
bun test site.test.ts
```

For an additional HTML conformance check:

```sh
bunx html-validate public/index.html public/solar-system.html \
  public/seasons.html public/scale-walk.html public/sky-tonight.html \
  public/missions.html
```

## Technology

- Three.js 0.185.1
- WebGL and custom GLSL shaders
- Vanilla HTML, CSS, and JavaScript
- 4K Earth day, 2K night-lights, normal, and specular maps from the
  [three.js example planet textures](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets)
  (three.js is MIT-licensed), derived from NASA's
  [Visible Earth "Blue Marble" planet textures](https://visibleearth.nasa.gov/collection/1484/planet-textures)
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

## Credits

- 3D rendering: [three.js](https://github.com/mrdoob/three.js) (MIT License)
- Earth textures: [three.js example planet textures](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets),
  derived from NASA [Visible Earth — Blue Marble](https://visibleearth.nasa.gov/collection/1484/planet-textures)
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
