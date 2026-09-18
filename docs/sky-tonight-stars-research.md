# Actual stars in Sky Tonight

Researched September 16, 2026. This is a feasibility and implementation recommendation for the existing static site.

## Decision and placement

Yes: ship a small, local star catalog and calculate its sky positions in the browser using the Astronomy Engine already bundled with the site. There is no need for a paid API, new backend, account, or image service. This is an implementation inference from the catalog and coordinate-transform capabilities below.

Put the stars directly in the existing **Sky Tonight → Horizon** view, alongside the Moon and planets, using the same location, date, and time controls. Replace that view's random decorative dots with calculated stars. Keep Orbit as the solar-system illustration. Add a short “Bright stars” list to the existing information panel with names, compass directions, and altitude; this provides a useful alternative to the canvas.

The user reports that Sky Tonight drives the site's traction. Improving that destination is therefore the recommended first placement; a separate star page would make visitors navigate away to finish the same observing task. This is a product judgment, not an analytics finding.

## Data choice

Use a pinned snapshot of **HYG v4.1**. Its records include J2000 right ascension and declination, apparent visual magnitude, common names, constellation abbreviations, color index, and proper motion. The catalog distinguishes reference epoch/equinox from the observing date. [HYG field documentation](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/README.md)

- Snapshot commit: `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`.
- [Exact downloadable CSV](https://raw.githubusercontent.com/astronexus/HYG-Database/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv). The README's abbreviated filename is inaccurate; the actual filename contains `hygdata`.
- [Snapshot license](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/LICENSE): CC BY-SA 4.0.
- HYG's author moved active development to Codeberg; the GitHub repository is an archive. A pinned archive remains a reproducible input. [Maintainer migration notice](https://github.com/astronexus/HYG-Database)

Local CSV measurements, excluding the Sun (`id=0`):

| Maximum magnitude | Catalog entries |
| --- | ---: |
| 4.5 | 925 |
| 5.0 | 1,637 |
| 6.0 | 5,070 |

Recommend magnitude 4.5 for the first release: enough stars for recognizable patterns without crowding a small horizon chart. Preserve IDs, names, coordinates, and magnitude; ship the filtered artifact rather than the 33.9 MB source. Keep a reproducible generator and source attribution next to it. The threshold is a display scope, not a promise that every plotted star is visible from a city.

Credit David Nash / Astronexus, link the source and license, state that the catalog was filtered/reformatted, and distribute the derived data under CC BY-SA 4.0. These correspond to the license's attribution, change-notice, and share-alike requirements. [Creative Commons license summary](https://creativecommons.org/licenses/by-sa/4.0/)

## Coordinate pipeline

Interpret catalog RA as hours and declination as degrees. Convert RA to degrees (`ra * 15`) when creating a spherical vector. Rotate its J2000 vector using `Rotation_EQJ_EQD(time)`, convert with `EquatorFromVector`, then call `Horizon(time, observer, ra, dec, 'normal')`. The rotation accounts for precession and nutation. Do not pass catalog J2000 coordinates directly to the of-date horizon calculation. An equivalent direct path is `Rotation_EQJ_HOR` → `RotateVector` → `HorizonFromVector('normal')`; its result uses `lat` for altitude and `lon` for clockwise azimuth, with east at 90°. [Astronomy Engine coordinate/API reference](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#coordinate-transforms)

Calculate the rotation once per selected time/location, reuse it across stars, and cache the resulting chart positions between animation frames. Plot only stars above the horizon. Size dots by magnitude and limit labels to a few bright named targets so the Moon and planet labels remain readable. Avoid `DefineStar` as the catalog mechanism: its API exposes only eight mutable star slots. [DefineStar documentation](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#DefineStar)

## Scope and verification

Call this a calculated sky chart, not a live camera or photograph. Fade stars in daylight/twilight; describe horizon position separately from likely naked-eye visibility. Clouds, buildings, terrain, light pollution, Moon glare, eyesight, and atmospheric extinction are not measured by this feature. The product should not infer clear skies from geometric altitude.

The implementation advances tangential proper motion from J2000 before rotating the coordinate frame. It does not model annual parallax/aberration or radial-velocity perspective effects. Do not advertise telescope-pointing precision or exact historical/future star positions. [HYG motion and epoch fields](https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/README.md)

Recommended tests: check the catalog's finite coordinate ranges, unique IDs, exclusion of the Sun, and magnitude cutoff; verify named reference records such as Sirius (RA 6.752481 h, declination −16.716116°, magnitude −1.44); compare the implementation's two-stage transform against the direct horizontal transform; exercise northern and southern locations, changing time, below-horizon filtering, and daylight messaging. These cross-path tests check our integration but are not an independent observational validation. Test keyboard access and the text list, then inspect desktop and narrow layouts for overlap.

Future additions can include constellation lines, search, a full-sky projection, and device orientation. They are separate interaction/data decisions; none is required to make the existing Horizon view show actual catalog stars.

## Implementation and verification — September 17, 2026

Implemented in `feature/sky-tonight-stars`: locally bundled 925-star catalog (47,359 bytes uncompressed), `public/sky-stars.js` coordinate/visibility helpers, actual stars in the existing horizon view, and up to five named targets in an accessible button list. Selecting a target highlights it and closes the information panel. Proper motion is advanced along tangent vectors; calculations run only when observer/time changes, not per animation frame. The orbit illustration retains its decorative background.

Validation: `bun test` passed 179 tests, including catalog invariants, north/south/polar cases, agreement with Astronomy Engine's alternative equatorial-coordinate path and DefineStar reference, and twilight filtering. These are integration checks, not independent observed-sky validation. `git diff --check` passed. Live Chromium/Electron inspection checked desktop and a 390px viewport, no horizontal overflow, selection/focus return, time-to-daylight empty state, and a Sydney manual-location update. The device keyboard tool did not activate the focused button; DOM activation/focus behavior was verified, but end-to-end keyboard activation remains unverified.

Existing saved flows were attempted: `qa-home-open-sky-tonight` failed to boot Electron; `qa-sky-tonight-manual-location` booted after unsetting inherited `ELECTRON_RUN_AS_NODE`, then lost CDP before the launch-deck assertion. Neither is recorded as a pass. No production deployment was performed.
