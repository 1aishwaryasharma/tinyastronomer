# Search improvements: what changed and why

October 31, 2026, from `main` at `ad1722d`. Branch `sky-tonight-place-search`.

## In short

Sky Tonight now lets a visitor **type their town or city** instead of granting
location permission or knowing their latitude and longitude. Each town carries
its own time zone, which also fixes a real bug: typed coordinates for about one
town in five showed sunset, sunrise and rise/set times on the wrong clock
(Beijing was shown in Pyongyang time, an hour late).

Nothing else on the site changed. The other seven proposals were weighed and
deferred or rejected below, mostly because the Search Console data cannot show
they would help.

## What the evidence says, and what it does not

Three months of Search Console: 978 impressions, 8 clicks, 0.8% CTR, average
position 42.2. Eight of the ten visible queries are "what is in the sky
tonight" variations: 135 impressions, 0 clicks. One, "what is in the sky
tonight from my location", names the location task directly (19 impressions).

The data has no query-level positions and no page mapping. It cannot show that
a title is weak, that Google fails to index the page, or that any change will
bring clicks. An average position of 42 suggests ranking, not the snippet, is
the main limit. So this branch improves **what a visitor can do once they
arrive**, and leaves search-result experiments until there is data to judge them.

## What already existed, and still does

Sky Tonight already had a readable headline, the planets and stars that are up,
directions in fists, best viewing times, sunset, dark and sunrise, Moon phase,
"Later tonight", and a printable sky card. The header already shows date, time
and location. Location came from the device's time zone, browser geolocation,
or typed latitude and longitude, all processed on the device. Every page has
teacher notes and metadata. None of this was rebuilt.

## Before, change, reason

| | Before (`main`) | After (this branch) | Why it matters |
| --- | --- | --- | --- |
| Correcting the location | "Use my location" (permission prompt) or type latitude and longitude | Also: type a town name and pick it from a list | Most families and classrooms know their town, not its coordinates. Many people decline location prompts, and school devices often block them. |
| Same-named places | n/a | "Springfield" lists eight, each with its state; "springfield, mass" narrows it | A town name alone is ambiguous; picking the wrong one gives the wrong sky. |
| Clock for a chosen place | n/a | The town's own IANA zone ("Chosen place · times in New York time") | Times must read on the observer's clock, not the device's. |
| Clock for typed coordinates | Zone of the nearest of ~350 reference cities. Wrong for 6,165 of 31,781 towns (19.4%) | Zone of the nearest of 31,781 towns; the old rule only if the list cannot load | Beijing showed sunset 6:14 pm in "Pyongyang time"; it now shows 5:14 pm in Shanghai time. Mumbai was on Karachi time, Delhi on Kathmandu time. |
| Page weight | n/a | Unchanged on load. The list (952 KB, ~307 KB with Brotli) downloads only when someone opens **Change** | Most visitors never change their location, so they pay nothing. |
| Guide text | "Use my location … or type in a latitude and longitude" | Adds "press Change and search for your town or city" | Keeps the how-to accurate. |

## Decision record

Each proposal was argued for and against. Outcomes are **accepted**,
**deferred** (worth doing once its condition is met) or **rejected**.

| # | Proposal | For | Against | Outcome |
| --- | --- | --- | --- | --- |
| 3 | City search | The only location query in the data names the task ("…from my location"). The current alternatives are a permission prompt or coordinates. It also fixes the measured time-zone error above | Adds a data file; a tiny demo list would be worse than none | **Accepted**, with 31,781 GeoNames towns of 15,000+ people, loaded on demand |
| 3b | Date · time · place line under the headline | Reads as one answer | The header already shows all three; on phones the drawer shows the place and the controls show date and time. It would duplicate them | **Rejected** |
| 1 | Shorter Sky Tonight title | The title is 85 characters | It already contains "What's in the Sky Tonight", "planets" and "your location". At position ~42, the snippet is unlikely to be the limit, and there is no query-position data to test it | **Deferred** until query-level positions show the page on page one with low CTR |
| 2 | Homepage labels and positioning; separate `/light-study` URL | Clearer hub | The links already have descriptive sublabels ("Planets · Moon · where to look"). The title matches the Light Study that lives on the homepage, and changing it risks unknown rankings. A URL move has migration cost | **Deferred** until there is page-level query data for `/` |
| 4 | Pre-rendered results in the HTML | Content visible without JavaScript | Google renders JavaScript; empty containers are not proof of an indexing problem. Daily generated forecasts would go stale | **Deferred**: check URL Inspection's rendered HTML first |
| 5 | Visible guides or lesson pages | More teaching content in normal page flow | Guides and teacher notes already exist in each page's HTML. Thin duplicate pages risk Google's scaled-content policy | **Deferred** |
| 6 | Per-page share images; copy-link that keeps date, time and place | Better sharing | Search Console does not measure referrals. It needs decisions on URL parameters and on never putting a precise location in a link by default | **Deferred**; a chosen town (not coordinates) would be the safe thing to share |
| 7 | Printable classroom resources | Teachers can use them | Print cards and printable guides already exist | **Deferred** |
| 8 | "Bright object near the Moon" finder | Answers a real question | It came from one today-only query and has no three-month evidence | **Rejected for now** |

## How it works

- `tools/build-places.ts` downloads GeoNames `cities15000` and region names. It
  drops city sections (Brooklyn, Shinjuku), historical and abandoned places, and
  rounds coordinates to 0.1°, as typed coordinates already are. It keeps a region
  only where a country has two places of that name, and writes
  `public/sky-places.js`.
- `public/sky-location.js` searches the list: whole names first, then
  prefixes, then later words, ties by population. It ignores accents and
  punctuation ("sao paulo", "st louis", "lodz"). Text after a comma narrows by
  region or country. Results that would still look the same (the two Udaipurs
  in Rajasthan) also show their coordinates.
- A chosen town is stored like other locations: in `localStorage`, on the device
  only. Typing never leaves the device; the list is a static file from the same
  origin, versioned by content hash like the other Sky Tonight modules.
- The search box is an ARIA combobox: arrow keys move through results, Enter
  picks one, Escape closes the list, and focus returns to **Change** afterwards.
  On touch screens the targets are 44 px and the field uses 16 px text so iOS
  does not zoom.

## Limitations

- **Former names and some English names are missing.** GeoNames lists most
  big cities under their English name (Munich, Vienna, Tokyo). Former names
  (Bombay, Peking, Kiev, Saigon) and a few English names (Cologne, Seville,
  Mecca) do not match. The page then suggests the local spelling or a larger
  town nearby. Adding GeoNames' language-tagged alternate names would fix this,
  but the source file is very large; it is left for later.
- **Towns under 15,000 people are not listed.** Pick the nearest listed town.
  The sky changes very little over tens of kilometres, but near a time-zone
  border the nearest listed town could be on the other clock.
- **Coordinates are town centres rounded to 0.1°**, about 10 km, the same
  precision as the rest of the page.
- **Country names come from the browser** (`Intl.DisplayNames`), so a few read
  differently by platform (for example "China" or "China mainland").
- **Manual locations saved before this change** keep the old nearest-city rule
  until re-entered; they carry no stored zone.
- **No search-traffic effect is claimed.** This improves the visit, not
  ranking. Measure it separately (below).

## Verification

- `bun test`: 253 pass, including new tests for search ranking, accents, comma
  narrowing, duplicate labels, retry after a failed load, storage and reload,
  unknown-zone fallback, Beijing/Mumbai/London coordinates, coverage on every
  inhabited continent, every bundled zone resolving to a clock the runtime accepts, the generator, and
  lazy-loading and hash-stamping of the dynamic import.
- Deployment CI exposed an older Linux time-zone database that rejects
  `America/Coyhaique`. The fallback now skips unsupported reference zones too.
  A regression test simulates that older runtime for both chosen towns and
  manual coordinates.
- `bunx html-validate` on all six pages: clean. The listbox needs one scoped
  exception, since a native `<select>` cannot filter as you type.
- Rendered in Chromium through `bun dev-server.ts`, with production routing and
  CSP, at 1280×800 and 390×844 (touch), America/Chicago device time, driven
  with Argent. `main` and this branch ran side by side. Checked: the default
  view is unchanged; searching, picking with the keyboard and by tap; the
  forecast re-renders; the chosen place survives a reload; Beijing coordinates
  on `main` versus the branch; a blocked list shows the fallback message, then
  retries once unblocked; the no-match hint; and the list is not requested on
  page load, only after **Change** opens. Screenshots are in `artifacts/place-search-evidence/` (local, not
  committed).
- Not run here: the Argent Electron flows (their shell's dependencies are not
  installed in this checkout) and real iOS Safari.
  `qa-sky-tonight-manual-location` should still pass: London coordinates still
  give "Manual coordinates · times in London time". CI will confirm.

## Measuring it

Search Console cannot see this change. If analytics are added, count "place
chosen" events, never the place itself. For search, export queries **with
position and page** for `/sky-tonight` before judging titles. Compare equal
28-day periods after Google recrawls the page.
