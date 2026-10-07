# Review notes

Decisions already argued and measured on Sky Tonight. Don't raise them again
unless the code they rely on changes or new evidence contradicts them.

## Settled

- **Slider and date-step cost.** List rebuilding, repeated Sun-altitude and
  sample work, and per-step `constellationAt` were all measured against `main`
  at 6× CPU throttling: time step 10 ms vs 11 ms, date step 193 ms vs 190 ms.
  Optimisations that add code without a measured regression are out of scope.
- **The Moon's twilight rule lives in `SUN_LIMIT`.** Every body is sampled on
  one grid from sunset and filtered by its own darkness rule, so the rule does
  not shift the sampling grid. `conjunctions()` is checked against a
  minute-level reference over 400 London nights (1 miss: a 4-minute window).
- **"Night of" on the print card uses the chosen calendar date.** The forecast
  reads that date at the observing site (`localNoon`), so the label names the
  same night the forecast shows, for manual locations abroad too.
- **`#night-window` and the 1280×800 Argent panel.** The QA flows run on a
  frozen clock and fixed location, so the Up now list above the card has a
  fixed length there. The card ends 66 px inside the panel; if a change pushed
  it out, the flow would fail on that id.
- **No `aria-live` on the lists.** They rebuild on every slider step. The
  slider's `change`, date and location changes announce the headline and where
  to look instead.
- **`isVisibleAt` after `visibilitySamples` repeats the darkness check.**
  Deliberate: `isVisibleAt` is the single visibility rule used by the nightly
  search, pairings and "Up now". Splitting it to skip one comparison per sample
  would put the rule back in several places.
- **`bodyReport` keeps `set` beside `sets`.** `set` (first setting after the
  window opens) predates this work on `main` and is covered by the San
  Francisco fixture; the page reads `sets`.
- **`bodyReport`'s `constellation`, `altitude`, `azimuth`, `compass` and
  `mag`.** Pre-existing API on `main`, covered by its fixtures; the page reads
  the selected-time values from `sortSkyLists` instead.
- **Overhead wording.** One `OVERHEAD` constant; `whereToLook` and
  `whereToLookShort` word it differently on purpose (list vs. phone line).
- **"Later tonight" missing a second rise in a polar night.** Not possible in
  practice: a second rise comes about 23 h 56 min after the first (the Moon
  about 24 h 50 min), so inside a 24-hour window the first rise would fall in
  its opening minutes and still be shown. A sweep of 7,664 "Later" rows over
  every 2026–27 polar night at Tromsø and Longyearbyen found none missing.
- **`#=` successors for shared-clock links.** tzdb's `backward` has no `#=`
  note on `Atlantic/Jan_Mayen` or `Pacific/Yap`; there is no nearer place to
  use. Check the file before raising this for another zone.
- **Hash-versioning shared modules.** `chrome.js`, `frame-loop.js` and
  `data.js` serve every page and the common bundle and keep the site's
  hand-bumped dates; switching the whole site is its own change.

## Conventions

- Sky Tonight module imports carry a content hash (`?v=`). After editing
  any module in `VERSIONED_MODULES` (tools/stamp-module-versions.ts), run
  `bun tools/stamp-module-versions.ts`; `site.test.ts` fails until you do.
  The tool also refreshes the inline-script CSP hashes in `public/_headers`,
  so run it after editing any inline script too.
- A finding about behaviour should come with a failing test or a reproduction.
