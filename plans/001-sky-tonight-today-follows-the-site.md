# Plan 001: Sky Tonight's "Today" is always the night in progress or the next night at the observing site

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7e6950..HEAD -- public/sky-forecast.js public/sky-tonight.html sky-forecast.test.ts public/_headers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a7e6950`, 2026-11-09

## Why this matters

Sky Tonight (`/sky-tonight`) shows a night-sky forecast for a chosen place.
"Today" (date offset 0) is meant to be the night in progress at that place,
or the coming night. Two defects break that:

1. `currentNightDate` only ever chooses between the *device's* yesterday and
   today. When the chosen place is a calendar day ahead of the device (a
   visitor in New York at 9 pm looking at Tokyo, Sydney or Auckland), "Today"
   shows a night that ended hours ago and the Now button is disabled. Where
   the local clock is more than 12 hours from solar time (Samoa, Tonga), the
   night in progress at 3 am is never shown at all.
2. The page computes its base date once at load. A phone tab left open
   overnight keeps "Today" on last night, and pressing Today does not fix it.

After this plan, offset 0 is the first night that has not yet ended at the
site, and the page re-checks that when Today is pressed and when the tab
becomes visible again.

## Current state

Files:

- `public/sky-forecast.js` — pure forecast maths; exports `nightWindow` and
  `currentNightDate`. Imported by tests directly.
- `public/sky-tonight.html` — the page; one large inline `<script type="module">`
  holds the UI glue (`baseDate`, `offset`, `syncBaseDate`, the Today button).
- `sky-forecast.test.ts` — Bun tests for the forecast module (repo root).
- `public/_headers` — holds a CSP hash for every inline script. You never edit
  it by hand; `bun tools/stamp-module-versions.ts` rewrites it.

`public/sky-forecast.js:201-210` today:

```js
// The calendar date (at local noon) of the night in progress. Before sunrise
// the night began at yesterday's sunset, so someone out at 2 am gets the sky
// above them, not the evening still to come.
export function currentNightDate(observer, now = new Date()) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return now <= nightWindow(observer, yesterday).end ? yesterday : today;
}
```

`nightWindow(observer, localDate)` returns `{ start, end, ... }` (both `Date`)
for the night that begins on calendar date `localDate`. Consecutive dates give
consecutive, non-overlapping windows.

`public/sky-tonight.html:513` (initial state):

```js
let baseDate = new Date(); baseDate.setHours(12, 0, 0, 0);
let offset = 0;
```

`public/sky-tonight.html:850-859`:

```js
// Offset 0 is the night in progress at the observing site, which before
// sunrise began yesterday. A new location can move it: "Today" stays on the
// night in progress, and any other chosen date is kept.
function syncBaseDate() {
  const next = currentNightDate(new Astronomy.Observer(location.lat, location.lon, 0));
  const shift = Math.round((baseDate - next) / DAY_MS);
  baseDate = next;
  if (offset) offset = clamp(offset + shift, 0, MAX_OFFSET);
  slider.value = offset;
  dateInput.min = isoLocal(dateAt(0)); dateInput.max = isoLocal(dateAt(MAX_OFFSET));
}
```

`public/sky-tonight.html:868-870`:

```js
// Today drops the chosen time, so it lands on now during the night (and on
// dark otherwise) instead of the same slider minutes on today's night.
document.getElementById('today-btn').onclick = () => { selectedTime = null; setOffset(0); };
```

`public/sky-tonight.html:841` (what `update()` does — re-renders everything
from `baseDate`, `offset`, `location`):

```js
function update() {
  metaDate.textContent = fmtDate(offset); ...; updateLocationCopy(); renderForecast();
}
```

`public/sky-tonight.html:1033` (end of script, first render):

```js
updateViewButtons(); syncBaseDate(); update();
```

Existing tests, `sky-forecast.test.ts:375-393`:

```ts
describe('Sky Tonight night in progress', () => {
  const sf = new Astronomy.Observer(37.77, -122.42, 10);
  const calendarDay = (date: Date) => [date.getFullYear(), date.getMonth(), date.getDate()];
  // An hour either side of sunrise on Sep 8, 2026 (13:40 UTC), which is
  // Sep 8 on the device clock in any zone from UTC-11 to UTC+9.

  test('before sunrise, the night in progress began yesterday', () => { ... });
  test('after sunrise, tonight is the coming night', () => { ... });
});
```

The first of those currently **fails** when the machine's zone is east of
UTC+9 (`TZ=Pacific/Auckland bun test sky-forecast.test.ts` → 1 fail). This plan
fixes that as a side effect.

Conventions to match:

- Vanilla ES modules, 2-space indent, single quotes, semicolons, no
  TypeScript in `public/`. Comments explain *why* in plain sentences (see the
  comment above `currentNightDate`).
- The inline script in `sky-tonight.html` packs short related statements on
  one line; follow the surrounding style, do not reformat neighbours.
- `REVIEW.md` lists settled decisions. One applies here: *"'Night of' on the
  print card uses the chosen calendar date. The forecast reads that date at
  the observing site (`localNoon`)"*. **Do not change `localNoon` or
  `nightWindow`.**

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| All tests | `bun test` | `0 fail` (275 pass before this plan, more after) |
| One file | `bun test sky-forecast.test.ts` | `0 fail` |
| Other zone | `TZ=Pacific/Auckland bun test sky-forecast.test.ts` | `0 fail` after step 1 |
| Restamp hashes | `bun tools/stamp-module-versions.ts` | prints `Module versions and inline-script CSP hashes are current.` |
| Bundle unchanged | `bun run build.ts && git diff --exit-code -- public/common.bundle.js` | exit 0 |

There is no install step, no lint and no typecheck in this repo.

## Scope

**In scope** (the only files you should modify):

- `public/sky-forecast.js` — `currentNightDate` only
- `public/sky-tonight.html` — the Today handler and one new listener block
- `sky-forecast.test.ts` — new tests
- `public/_headers` — only via the stamp tool
- Any file the stamp tool rewrites (it updates `?v=` hashes on imports of
  `sky-forecast.js`; that is expected)

**Out of scope** (do NOT touch):

- `localNoon`, `nightWindow`, and everything else in `public/sky-forecast.js`
  — settled in `REVIEW.md`; the date *label* in Samoa/Tonga stays as it is.
- `public/sky-location.js`, `public/frame-loop.js`, `public/chrome.js`.
- Existing assertions in `sky-forecast.test.ts` — add tests, do not edit old ones
  (you may update the two-line comment about "UTC-11 to UTC+9", which becomes untrue).

## Git workflow

- Branch: `advisor/001-sky-tonight-today`
- One commit. Message style is a plain imperative sentence, no prefix — e.g.
  from `git log`: `Let Today snap to now, and turn Now on when the night starts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `currentNightDate` return the first night that has not ended

Replace the function body and its comment in `public/sky-forecast.js` with:

```js
// The calendar date (at local noon) of the first night that has not ended at
// the observing site. Before sunrise that night began at yesterday's sunset,
// so someone out at 2 am gets the sky above them. The site can also be a
// calendar day ahead of or behind the device, so the search runs from two
// days back to tomorrow rather than assuming the device's own date.
export function currentNightDate(observer, now = new Date()) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  for (let shift = -2; shift <= 1; shift += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + shift);
    if (now <= nightWindow(observer, date).end) return date;
  }
  return today;
}
```

**Verify**: `bun test sky-forecast.test.ts` → 0 fail, and
`TZ=Pacific/Auckland bun test sky-forecast.test.ts` → 0 fail (it failed before).

### Step 2: Add tests

Inside the existing `describe('Sky Tonight night in progress', ...)` block in
`sky-forecast.test.ts`, add these tests (they use fixed UTC instants, so they
hold in every host time zone):

```ts
  test('a site a calendar day ahead of the device gets its coming night, not one that ended', () => {
    const tokyo = new Astronomy.Observer(35.7, 139.7, 0);
    const now = new Date('2026-11-10T02:00:00Z'); // 11:00 in Tokyo, 21:00 the evening before in New York
    const date = currentNightDate(tokyo, now);
    const night = nightWindow(tokyo, date);
    expect(night.end.getTime()).toBeGreaterThan(now.getTime());
    const previous = new Date(date); previous.setDate(date.getDate() - 1);
    expect(nightWindow(tokyo, previous).end.getTime()).toBeLessThan(now.getTime());
    expect(date.getHours()).toBe(12);
  });

  test('west of the date line on an eastern clock, 3 am is still inside the night shown', () => {
    const apia = new Astronomy.Observer(-13.8, -171.8, 0);
    const now = new Date('2026-11-08T14:00:00Z'); // 03:00 on Nov 9 in Apia (UTC+13)
    const night = nightWindow(apia, currentNightDate(apia, now));
    expect(now >= night.start && now <= night.end).toBe(true);
  });
```

**Verify**: for each of `UTC`, `America/New_York`, `Asia/Tokyo`,
`Pacific/Auckland`, `Pacific/Apia`, `Etc/GMT+12`:
`TZ=<zone> bun test sky-forecast.test.ts` → 0 fail.

### Step 3: Re-check the base date when Today is pressed and when the tab returns

In `public/sky-tonight.html`:

a. Replace the Today handler line (868-870 region) with:

```js
// Today drops the chosen time, so it lands on now during the night (and on
// dark otherwise) instead of the same slider minutes on today's night. The
// base date is read again first: a tab left open overnight has moved on.
document.getElementById('today-btn').onclick = () => { selectedTime = null; offset = 0; syncBaseDate(); setOffset(0); };
```

b. Immediately after that line, add:

```js
// A tab kept open, or restored from the back/forward cache, can outlive its
// night. When it is shown again, move "Today" to the night now in progress;
// a visitor who chose another date keeps that calendar date.
function refreshBaseDate() {
  if (document.hidden) return;
  const next = currentNightDate(new Astronomy.Observer(location.lat, location.lon, 0));
  if (next.getTime() === baseDate.getTime()) return;
  if (offset === 0) selectedTime = null;
  syncBaseDate(); update();
}
document.addEventListener('visibilitychange', refreshBaseDate);
addEventListener('pageshow', (event) => { if (event.persisted) refreshBaseDate(); });
```

`currentNightDate`, `Astronomy`, `location`, `baseDate`, `selectedTime`,
`syncBaseDate` and `update` are all already in scope in that script — confirm
with `grep -n "currentNightDate" public/sky-tonight.html` (it must already
appear in an import and in `syncBaseDate`).

**Verify**: `grep -c "refreshBaseDate" public/sky-tonight.html` → `3`.

### Step 4: Restamp hashes

Run `bun tools/stamp-module-versions.ts`. It rewrites the `?v=` hash on
imports of `sky-forecast.js` and the inline-script hash in `public/_headers`.

**Verify**: `bun test` → 0 fail. `git status --short` lists only
`public/sky-forecast.js`, `public/sky-tonight.html`, `public/_headers`,
`sky-forecast.test.ts`, and possibly other `public/sky-*.js` files whose
import hashes the stamp tool updated.

## Test plan

- New: the two tests in step 2 (regressions for the Tokyo-from-New-York case
  and the Samoa 3 am case).
- Existing `before sunrise…` / `after sunrise…` tests must keep passing in
  every zone listed in step 2.
- The page wiring in step 3 has no unit harness in this repo (the inline
  script is not importable); it is covered by `bun test`'s CSP-hash check and
  by review. Do not invent a DOM harness for it.

## Done criteria

- [ ] `bun test` exits 0 with 2 more passing tests than before
- [ ] `TZ=Pacific/Auckland bun test` exits 0
- [ ] `TZ=Pacific/Apia bun test sky-forecast.test.ts` exits 0
- [ ] `bun tools/stamp-module-versions.ts && git diff --exit-code` after committing → no further changes (stamps are current)
- [ ] `bun run build.ts && git diff --exit-code -- public/common.bundle.js` exits 0
- [ ] `git diff a7e6950 -- public/sky-forecast.js` touches only `currentNightDate` and its comment
- [ ] `plans/README.md` status row updated

## STOP conditions

- The excerpts in "Current state" do not match the live code.
- Any existing test in `sky-forecast.test.ts` or `sky-location.test.ts` fails
  after step 1 and the cause is not obvious within two attempts.
- The fix seems to need a change to `localNoon` or `nightWindow`.
- `bun tools/stamp-module-versions.ts` throws.

## Maintenance notes

- Deferred on purpose: in Samoa, Tonga and Wallis the *date label* is still a
  day off, because `localNoon` derives noon from longitude rather than from
  the place's time zone. Fixing that means changing `localNoon`, which
  `REVIEW.md` records as settled; it needs the owner's decision and a wider
  fixture sweep.
- Reviewer: check that `refreshBaseDate` does not announce (it must not call
  `announceForecast`; a silent correction on return is intended), and that a
  non-zero offset keeps its calendar date after a refresh.
- If the Argent QA flows freeze the clock, they are unaffected: the frozen
  `Date` makes `next` equal `baseDate`.
