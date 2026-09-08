# Sky Tonight: from elongation sketch to local forecast

Implementation plan. Written 2026-09-08 on branch `plan/sky-tonight-local-forecast`.
The implementing agent should work on a feature branch cut from `main`, not on
this plan branch, and should tick the checkboxes in this file as work lands.

## 1. Why

Search Console shows that nearly every impression the site gets is a variation
of "sky tonight". People typing that want three things: what can I see from
where I am, in which direction, and at what time.

`public/sky-tonight.html` does not answer any of them. It draws a top-down
orrery from circular mean orbits, classifies each planet by its angle from the
Sun, and says in its own copy that it is "not a local visibility forecast".
`docs/scientific-audit.md` (section "Sky Tonight", line 158 onward) rates the
page "Not valid as a visibility forecast" and documents elongation errors of
4° to 9° against JPL Horizons.

The fix is to make the page answer the question it ranks for. That needs real
planetary positions, an observer location, and a horizon-based presentation.
Everything below is designed to fit the site's constraints: static files, no
network calls, offline-capable, ad-free, accessible.

## 2. Goals and non-goals

Goals:

- Tonight's observing window for the user's location: sunset, end of twilight,
  sunrise.
- For the Moon and each planet: visible tonight or not, when it rises and sets,
  which direction and how high at a given time, and how bright in plain words.
- A horizon view the user can scrub through the night so they know where to
  look.
- Location without a prompt for most users, with an optional one-tap precise
  location, and a manual override. Location never leaves the device.
- Page metadata that matches the new promise so click-through improves.
- Drop the "rough guide" caveats and update the scientific audit accordingly.

Non-goals (do not build):

- Weather, cloud cover, ISS passes, or satellite tracking. They need network
  calls, and the Content Security Policy forbids them.
- Device compass or augmented-reality pointing. The Permissions-Policy blocks
  the sensors, and the site does not need them.
- Deep-sky objects, star catalogs, or a full planetarium.
- Any change to the other five studies.

## 3. Hard constraints found in the repo

Read these before touching anything. Each one has a test that will fail if
ignored.

| Constraint | Where | What it means for this work |
| --- | --- | --- |
| `connect-src 'self' blob:` | `public/_headers` | No fetch to any other origin. All computation is client-side from vendored code. Also lets the UI truthfully say "your location never leaves this device". |
| Inline script hashes | `public/_headers`, `site.test.ts:58` | Every inline `<script>` body must have its sha256 in `script-src`, and stale hashes must be removed. Editing the page script changes its hash. The failing test prints the required digest. |
| `geolocation=()` | `public/_headers` Permissions-Policy | Geolocation is blocked at the header level. Must become `geolocation=(self)` or the API silently fails. |
| Sky Tonight imports only `./chrome.js` | `site.test.ts:303` | The page must contain `./chrome.js`, must not contain `type="importmap"`, and must not contain `common.js`. A second import from `./vendor/astronomy-engine/...` is fine. |
| "not a local visibility forecast" string | `site.test.ts:1154` | This assertion must be rewritten, not deleted, once the page becomes a forecast. Replace it with an assertion that the new model label is present. |
| Date controls | `site.test.ts:1079` | Keeps `date-prev`, `date-next`, `date-input`, `isoLocal`, and the `setOffset` handlers. Keep those ids and function names. |
| Mobile drawer | `site.test.ts:1109`, `chrome.js:271` `initMobileInfoPanels` | The `.info-panel` becomes a bottom drawer under 820px. New location controls must work inside it. |
| Accessibility | `site.test.ts:250` | Keep `<canvas id="sky" aria-hidden="true">`, `SPACE.initSceneAccessibility()`, and `accessibility.announce(` calls. |
| QA ids | `qa-selectors.test.ts`, `.argent/flows/qa-home-open-sky-tonight.yaml` | `launch-sky-tonight` and `sky-tonight-header` must survive. Argent Chromium flows are the merge gate. |
| Source disclosure | `site.test.ts:1140` | Each study links a NASA or JPL primary source. Keep the `science-note` block with a `science-sources` line. |
| Extensionless URLs | `dev-server.ts`, `site.test.ts:933` | Never link to `sky-tonight.html`. Run `bun dev-server.ts`, not a plain static server. |
| No `package.json` | repo root | Nothing is installed from npm at build time. Vendor the library into `public/vendor/` exactly like Three.js. |

## 4. Decisions already made

### 4.1 Library: astronomy-engine, vendored

- Package: `astronomy-engine@2.1.19`, MIT, by Don Cross.
  Tarball: `https://registry.npmjs.org/astronomy-engine/-/astronomy-engine-2.1.19.tgz`
- Ship the ESM build minified with Bun. Verified on 2026-09-08:

  ```sh
  mkdir -p /tmp/ae && cd /tmp/ae
  curl -sL https://registry.npmjs.org/astronomy-engine/-/astronomy-engine-2.1.19.tgz | tar xz
  bun build package/esm/astronomy.js --minify --format=esm \
    --outfile public/vendor/astronomy-engine/astronomy.min.js
  ```

  Output is 112 KB raw, 44 KB gzipped, no Node globals. Copy the MIT license
  text from the header of `package/astronomy.browser.min.js` into
  `public/vendor/astronomy-engine/LICENSE` and note the version in a
  `VERSION` file.
- Why not hand-port the JPL Keplerian elements: they give positions but not
  rise/set, twilight, Moon phase, or magnitude, and each of those is where the
  bugs would live.
- Verified API calls (all pure, no I/O). `A` is the module namespace:

  ```js
  const obs = new A.Observer(lat, lon, heightMeters);
  const t = A.MakeTime(date);
  const eq = A.Equator(body, t, obs, true, true);            // ra, dec
  const hz = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');     // altitude, azimuth (refracted)
  const il = A.Illumination(body, t);                        // mag, phase_fraction
  A.SearchRiseSet(body, obs, +1, t, 1)                       // next rise within 1 day, or null
  A.SearchRiseSet(body, obs, -1, t, 1)                       // next set
  A.SearchAltitude('Sun', obs, -1, t, 1, -18)                // astronomical dusk
  A.SearchAltitude('Sun', obs, -1, t, 1, -6)                 // civil dusk
  A.MoonPhase(t)                                             // 0..360, 180 = full
  A.SearchMoonQuarter(t) / A.NextMoonQuarter(q)              // next quarter events
  A.Constellation(eq.ra, eq.dec).name
  A.AngleFromSun(body, t)                                    // elongation for the orrery panel
  A.PairLongitude(body1, body2, t)                           // conjunction search helper
  ```

  Body names: `'Mercury' 'Venus' 'Mars' 'Jupiter' 'Saturn' 'Uranus' 'Neptune' 'Moon' 'Sun'`.
  `data.js` keys are lowercase; map with a small table.

### 4.2 Location: three tiers, no prompt by default

1. **Timezone guess (default, silent).** `Intl.DateTimeFormat().resolvedOptions().timeZone`
   mapped to a representative latitude and longitude. Generate the table from
   IANA `zone1970.tab` (public domain, `https://data.iana.org/time-zones/tzdb/zone1970.tab`,
   column 2 is `±DDMM±DDDMM` or `±DDMMSS±DDDMMSS`). Emit `public/tz-coords.js`
   as `export const TZ_COORDS = { 'America/Chicago': [41.85, -87.65], ... }`
   rounded to two decimals. About 350 entries, under 12 KB. Include a
   generator script `tools/build-tz-coords.ts` so it can be refreshed.
   Fallback when the zone is unknown: latitude 0, longitude from the UTC
   offset times 15, and label the location "approximate".
2. **"Use my location" button (on tap only).** `navigator.geolocation.getCurrentPosition`
   with `enableHighAccuracy: false`, `maximumAge: 6 hours`, `timeout: 10 s`.
   Round to one decimal (about 11 km). Never call on page load.
3. **Manual entry.** Two number inputs, latitude and longitude, with a
   "Set" button. Validate ranges. This is also the accessibility path and the
   path for users who deny the prompt.

Persist the chosen location in `localStorage` under `sky.location` as
`{ lat, lon, source: 'tz' | 'geo' | 'manual', label }`. Wrap in try/catch like
`chrome.js:126` does, since storage can be unavailable.

Show the active source in the header meta line, for example
`Location · Chicago area (from time zone)` or `Location · 41.9°N 87.6°W (device)`.
Next to the button, one sentence: "Used only on this device. Nothing is sent
anywhere." That claim is enforced by the CSP.

### 4.3 Presentation: horizon strip first, orrery second

The canvas keeps id `sky` and stays full-screen behind the panel. It gets a
new mode:

- **Horizon view (default).** A 360° azimuth strip, north at both edges,
  south in the centre, altitude 0° at the bottom rising to 90° at the top.
  Cardinal letters along the bottom. Plot the Moon and the planets at their
  altitude and azimuth for the selected time. Below-horizon bodies are drawn
  dim below the line. The Sun is drawn when above -18° so twilight is visible
  as a glow. A time scrubber runs from sunset to sunrise.
- **Orbit view (secondary).** The existing orrery, now driven by
  `A.HelioVector` so it is no longer a mean-orbit sketch. Keep it because it
  explains the "why" of evening versus morning.

A two-button segmented control near the date controls switches modes. Persist
the choice in `localStorage` under `sky.view`.

## 5. Work breakdown

Land each phase as its own commit so a reviewer can bisect. Phases 0 to 3
change what the page says and are the minimum to ship. Phases 4 and 5 are the
horizon view and polish.

### Phase 0: vendor the library

- [ ] Add `public/vendor/astronomy-engine/astronomy.min.js`, `LICENSE`, `VERSION`
      using the commands in 4.1.
- [ ] Add a test in `site.test.ts` next to the Three.js vendor test (line 295)
      asserting the file exists and the page imports it.
- [ ] Confirm `bun dev-server.ts` serves it with the right content type and the
      CSP allows it (`script-src 'self'` covers it).

### Phase 1: pure forecast module

Create `public/sky-forecast.js`. Pure functions only, no DOM, so `bun test` can
exercise it directly.

- [ ] `nightWindow(observer, localDate)` returns `{ sunset, civilDusk, astroDusk, astroDawn, sunrise, moonRise, moonSet }`
      as `Date`s. "Tonight" starts at the sunset on or after local noon of
      `localDate` and ends at the following sunrise. Handle polar cases where a
      search returns null: fall back to noon to noon and set a flag
      `polar: 'day' | 'night'` so the UI can say so.
- [ ] `bodyReport(body, observer, window, sampleTime)` returns
      `{ key, name, visible, bestTime, altitude, azimuth, compass, mag, brightness, rise, set, constellation, note }`.
      Rules:
      - `visible` is true if the body is above 5° altitude at any time between
        `civilDusk` and `civilDawn` with the Sun below -6°. Sample every 10
        minutes. Mercury and Venus count as visible during civil twilight if
        above 5°.
      - `bestTime` is the sample with the highest altitude during the dark
        window, or, if the body only appears in twilight, the sample where it
        is highest during twilight.
      - `compass` is a 16-point name from azimuth (`N NNE NE ...`).
      - `brightness` in words from magnitude: below -3 "brighter than any star",
        below 0 "as bright as the brightest stars", below 2 "bright, easy to spot",
        below 4 "faint, needs a dark sky", below 6 "binoculars", else "telescope".
        Uranus and Neptune keep their fixed optical-aid notes from the audit
        (Uranus "optical aid recommended", Neptune "telescope required").
- [ ] `moonReport(observer, window)` returns phase name, illumination
      percentage, rise, set, and whether it will wash out the sky (illumination
      above 60% and up during the dark window).
- [ ] `conjunctions(observer, window)` returns pairs of bodies within 5° of each
      other at `astroDusk` or `astroDawn`, and any planet within 5° of the Moon.
      Use `A.AngleBetween` on equatorial vectors.
- [ ] `meteorShowers(date)` from a static table in the module: Quadrantids,
      Lyrids, Eta Aquariids, Perseids, Orionids, Leonids, Geminids, Ursids with
      peak month/day and a NASA source link. Return the shower if the date is
      within 2 days of its peak.
- [ ] `orbitPositions(date)` returns heliocentric ecliptic x, y in AU for the
      orrery via `A.HelioVector`, so Phase 3 can drop `L0`/`n` maths.
- [ ] Fixture test `sky-forecast.test.ts`. Use the observer
      `lat 37.77, lon -122.42, height 10` at `2026-09-08T03:00:00Z`. Expected
      values verified with the library on 2026-09-08:

      | Body | Alt | Az | Mag | Next set (UTC) |
      | --- | ---: | ---: | ---: | --- |
      | Venus | 9.6 | 242.5 | -4.7 | 2026-09-08T03:55Z |
      | Saturn | -8.3 | 79.5 | 0.3 | 2026-09-08T16:03Z |
      | Mars | -26.1 | 339.7 | 1.2 | 2026-09-08T23:37Z |
      | Moon | -21.2 | 320.8 | -7.6 | 2026-09-09T01:15Z |

      Moon phase angle 320.6°, illumination 11%. Sunset 2026-09-09T02:28Z,
      astronomical dusk 2026-09-08T03:59Z. Mars is in Gemini.
      Assert to one decimal for angles and to the minute for times.
      Also test: a polar observer (lat 80) in June returns `polar: 'day'`;
      the compass function maps 0, 45, 180, 348 correctly; the brightness
      words switch at the stated thresholds.

### Phase 2: location layer and headers

Create `public/sky-location.js`.

- [ ] `public/tz-coords.js` generated by `tools/build-tz-coords.ts` from
      `zone1970.tab`. Commit both. Add a test that the table has more than 300
      entries and that `America/Chicago` and `Europe/London` are present.
- [ ] `resolveLocation()` returns the stored location, else the timezone
      guess. Never touches geolocation.
- [ ] `requestDeviceLocation()` wraps `getCurrentPosition` in a promise,
      rounds, stores, and returns `{ lat, lon, source: 'geo' }`. Map the error
      codes to short copy: denied, unavailable, timeout.
- [ ] `setManualLocation(lat, lon)` validates and stores.
- [ ] `describeLocation(loc)` returns a short label. For the timezone tier use
      the city part of the zone id, for example `Chicago area`. For the other
      tiers format as `41.9°N 87.6°W`.
- [ ] Change `public/_headers` Permissions-Policy from `geolocation=()` to
      `geolocation=(self)`. Add an assertion in `site.test.ts` in the security
      headers test that it reads `geolocation=(self)` and that no other feature
      changed.
- [ ] Confirm `dev-server.ts` passes the header through unchanged.

### Phase 3: rewrite the page around tonight

Edit `public/sky-tonight.html`. Keep the structure the tests expect (see
section 3). Suggested panel order, top to bottom:

- [ ] `info-label`: `— Tonight from your location —`.
- [ ] `info-title`: `What's in the sky tonight?`
- [ ] **Location row.** Label with the active source, a `Use my location`
      button (`id="use-location"`), a `Change` disclosure that reveals the
      manual latitude and longitude inputs, and the one-sentence privacy note.
- [ ] **Tonight's window.** Sunset, dark from (astronomical dusk), sunrise,
      in the user's local time. Moon phase with illumination and rise/set.
      Add a moon-phase glyph drawn on a small inline canvas or as SVG.
- [ ] **What to look for.** One line per visible body, sorted by best time:
      `Venus · SW, 10° up at 8:05 pm · brighter than any star · sets 8:55 pm`.
      Then a collapsed "Not tonight" group listing the rest with the reason
      (below horizon all night, lost in twilight, needs a telescope).
- [ ] **Tonight's highlights.** Conjunctions and meteor showers when present,
      otherwise omit the block.
- [ ] Keep one `fact-callout` "Try it" with the twinkling sentence from the
      audit. Keep the "End of the journey" framed callout.
- [ ] Replace the `science-note` copy. New model label:
      `Local forecast · Positions from astronomy-engine (VSOP87-based), topocentric with refraction. Assumes a flat horizon and clear sky. Location precision: about 10 km from the device, about a city from the time zone.`
      Sources: keep JPL Horizons and NASA Skywatching, add
      `https://github.com/cosinekitty/astronomy`. Set `Reviewed` to the
      implementation date.
- [ ] Date controls stay as they are. `offset` now shifts the local calendar
      date passed to `nightWindow`. Keep `Today` meaning tonight.
- [ ] `accessibility.announce` on date change and on location change, for
      example `Sky forecast updated for Chicago area, Sept 8.` Also add a
      visually hidden text summary of the horizon view for screen readers,
      regenerated with the list.
- [ ] Update the inline script hash in `public/_headers` and remove the old
      one. `bun test` reports the digest.
- [ ] Rewrite `site.test.ts:1154` to assert the new model label, and update the
      `sky` assertions in `site.test.ts:250` if the canvas markup changes.
- [ ] Ensure everything works with `prefers-reduced-motion` (no twinkling,
      static frame) as the existing loop already does.

### Phase 4: horizon view and time scrubber

- [ ] Draw the horizon strip on the `sky` canvas as described in 4.3. Use the
      existing `SPACE.createFrameLoop` at 30 fps and `drawing.invalidate` on
      input, as the page already does.
- [ ] Add a time scrubber (`input type="range"`, `id="time-slider"`) from
      sunset to sunrise in 5-minute steps, plus a `Now` button that is enabled
      only while the current time is inside tonight's window. Show the chosen
      local time next to it. On the mobile layout it sits in the same fixed
      bottom bar as the date controls; on narrow screens stack the two rows.
- [ ] Bodies are drawn as dots in their `data.js` colours with a label. Tap or
      hover a dot to highlight the matching list row.
- [ ] View toggle `id="view-horizon"` / `id="view-orbit"` with `aria-pressed`.
      The orbit view is the existing draw routine fed by `orbitPositions`.
- [ ] The header `Date ·` meta gains `Time ·` showing the scrubbed time.
- [ ] Test in `site.test.ts` that the scrubber and toggle ids exist and that
      the page still has exactly one `canvas`.

### Phase 5: metadata, docs, QA

- [ ] `<title>`: `What's in the Sky Tonight? Planets and Moon for your location | tinyastronomer`.
- [ ] `<meta name="description">` and both `og:description` and
      `twitter:description`: `See which planets and the Moon are up tonight from your location, which direction to look, and when. Free, ad-free, works offline.`
- [ ] Home card subtitle in `public/index.html:152`: change
      `Evening · morning · horizon` to `Planets · Moon · where to look`.
- [ ] `public/sitemap.xml`: bump `lastmod` for `/sky-tonight`.
- [ ] `docs/scientific-audit.md`: replace the Sky Tonight row in the summary
      table (line 29) and rewrite section 158 onward to describe the new model,
      its residual assumptions (flat horizon, standard refraction, no weather),
      and the spot-check table from Phase 1 with a fresh JPL Horizons
      comparison for the same instant.
- [ ] `README.md`: update the Sky Tonight bullet and the sentence that says the
      page imports only `chrome.js`.
- [ ] `.argent/flows/qa-home-open-sky-tonight.yaml`: after the header await,
      add an await for `id: use-location` visible, and an await that the
      forecast list container (`id="sky-list"`) is visible. Do not tap the
      location button in CI. Run the flow twice on Chromium as `.argent/qa.md`
      requires.
- [ ] Add a second flow `qa-sky-tonight-manual-location.yaml`: open the page,
      open `Change`, type `51.5` and `-0.1`, tap `Set`, await the header meta
      containing `51.5°N`. This proves the manual tier without a permission
      prompt.
- [ ] Run `bun test`, `bun run build.ts` (unchanged output expected), and
      `bun dev-server.ts` plus a manual check on a phone-width viewport.

## 6. Copy rules

- Never promise weather or cloud cover.
- Directions are compass words first, degrees second: `low in the SW (10° up)`.
- Times are local to the browser, 12-hour with am/pm via `toLocaleTimeString`.
- "Tonight" on the page always means the night that starts at the next sunset
  from the selected date's noon.
- Keep sentences short. The audience includes children.

## 7. Acceptance checklist

- [ ] Loading the page with no stored location shows a forecast within one
      frame after the module imports, with no permission prompt.
- [ ] Tapping `Use my location` triggers the browser prompt once. Denying it
      leaves the timezone forecast in place with a short message.
- [ ] Manual entry of Sydney (`-33.9, 151.2`) flips the horizon strip so that
      planets near the ecliptic appear in the northern half, and times update.
- [ ] Venus is reported with `brighter than any star` whenever its magnitude
      is below -3.
- [ ] `bun test` passes, including the new fixture test and the hash test.
- [ ] Both Argent Chromium flows for the page pass twice in a row.
- [ ] Lighthouse or the existing `startup.test.ts` budget is not regressed.
      The new import is about 44 KB gzipped, on a page that loads no Three.js.
- [ ] No request leaves the origin. Check the network panel on the dev server.

## 8. Open questions for the owner

None block the work. Defaults chosen:

- Height above sea level is assumed 0 m. Not worth an input.
- Night sampling is every 10 minutes. Fine for a phone; revisit only if the
  forecast takes more than about 50 ms on a low-end device.
- The orrery survives as a secondary view rather than being deleted, because
  it is the only part of the page that teaches why planets sit east or west
  of the Sun.
