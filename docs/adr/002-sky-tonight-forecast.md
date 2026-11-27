# 002. Keep Sky Tonight's forecast and selected-time view consistent

Status: Accepted

## Context and decision

Use the observing site's calendar date for the forecast and the printed
“Night of” label. A visitor who selects a location abroad sees the same
observing night in both places.

Share the visibility predicate across the nightly search, pairings, and
“Up now”. The Moon's twilight limit changes which samples qualify on the
shared grid from sunset. Applying the predicate again after sampling costs
one comparison and keeps the rule in one place. A minute-level comparison
over 400 London nights found one missed four-minute conjunction.

Announce the headline on a committed slider, date, or location change. The
lists rebuild during slider movement, so live regions on those lists would
announce each intermediate state.

Keep the existing `bodyReport` fields for callers and fixtures. The page uses
`sets` for settings and reads selected-time positions from `sortSkyLists`.
The shared overhead threshold supports separate wording for the list and
the shorter phone line.

## Evidence and tradeoffs

At 6× CPU throttling, the reviewed implementation measured 10 ms for a time
step and 193 ms for a date step. The comparison against `main` was 11 ms and
190 ms. Those results did not warrant extra code to avoid list rebuilding,
Sun-altitude calculations, or per-step constellation lookups.

A sweep of 7,664 “Later tonight” rows at Tromsø and Longyearbyen during the
2026–27 polar nights found no missed bodies from a second rise. Two rises in
a 24-hour window put the first near its start because successive rises are
about one day apart.

The shared-clock links for `Atlantic/Jan_Mayen` and `Pacific/Yap` had no
`#=` geographic successor in tzdb's `backward` file at review time. Check that
file before choosing a geographic replacement for a link.

Content hashes cover Sky Tonight's module imports. Shared modules
`chrome.js`, `frame-loop.js`, and `data.js` retain the site's date versions
because they also serve other pages and the common bundle. Changing their
version scheme requires a site-wide migration.
