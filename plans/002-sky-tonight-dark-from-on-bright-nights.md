# Plan 002: Sky Tonight says when it gets darkest on nights that never reach full dark

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
> mismatch, treat it as a STOP condition. (Plan 001 edits the same three
> files in different places; changes from 001 alone are not a mismatch.)

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (run after 001 if both are being done, to avoid merge conflicts)
- **Category**: bug
- **Planned at**: commit `a7e6950`, 2026-11-09

## Why this matters

Above about 48.5° latitude the Sun never gets 18° below the horizon around
midsummer, so there is no astronomical dusk. On those nights the Sky Tonight
card shows `Sunset 9:21 pm · Dark from — · Sunrise 4:43 am` — a blank where
the page's own guide tells families to look ("the forecast shows a **Dark
from** time"). This is London, Paris, Berlin, Amsterdam, Seattle-latitude
Canada and all of Scandinavia from mid-May to late July. The rest of the page
already falls back to civil dusk on such nights; only this label does not.

## Current state

- `public/sky-forecast.js` — forecast maths. `nightWindow()` returns
  `{ start, end, sunset, civilDusk, astroDusk, astroDawn, civilDawn, sunrise, polar, ... }`;
  `astroDusk` is `null` when the night never reaches astronomical darkness.
- `public/sky-tonight.html` — page with one large inline module script.
- `public/_headers` — CSP hashes for inline scripts; rewritten only by
  `bun tools/stamp-module-versions.ts`.

Reproduction (read-only), London on 21 June 2026: `nightWindow` gives
`civilDusk 2026-06-21T21:09Z`-ish and `astroDusk null`.

`public/sky-forecast.js:223-232` — the fallback the rest of the page uses:

```js
// The slider moves in 5-minute steps from sunset. "Now" takes the nearest
// step; otherwise the first step at or after full dark, so the opening view
// is never a few minutes short of it.
export function defaultNightMinutes(window, now, isToday) {
  if (isToday && now >= window.start && now <= window.end) {
    return Math.round((now - window.start) / 300000) * 5;
  }
  const dark = window.astroDusk ?? window.civilDusk ?? window.start;
  return Math.ceil((dark - window.start) / 300000) * 5;
}
```

`public/sky-tonight.html:191` — the label:

```html
      <div class="window-stat"><span>Dark from</span><strong id="dark-time">—</strong></div>
```

`public/sky-tonight.html:826` — where it is filled (one long line; only the
middle statement matters):

```js
  sunsetTime.textContent = formatTime(activeWindow.sunset); darkTime.textContent = formatTime(activeWindow.astroDusk); sunriseTime.textContent = formatTime(activeWindow.sunrise);
```

`formatTime(null)` returns `'—'`. `darkTime` is
`document.getElementById('dark-time')` (line 492).

The id `dark-time` is listed in `qa-selectors.test.ts:40` as a stable QA
selector — it must keep that id.

Conventions: vanilla ES modules, 2-space indent, single quotes, semicolons.
Copy on this page is plain and short, written for families ("Dark from",
"Up now"). Tests for forecast maths live in `sky-forecast.test.ts` and import
from `./public/sky-forecast.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| All tests | `bun test` | `0 fail` |
| One file | `bun test sky-forecast.test.ts` | `0 fail` |
| Restamp hashes | `bun tools/stamp-module-versions.ts` | prints `Module versions and inline-script CSP hashes are current.` |

No install, lint or typecheck exists in this repo.

## Scope

**In scope**:

- `public/sky-forecast.js` — add one exported function
- `public/sky-tonight.html` — line 191 (label span gets an id) and the
  `darkTime` statement on line 826
- `sky-forecast.test.ts` — new tests
- `public/_headers` and import `?v=` hashes — only via the stamp tool

**Out of scope**:

- `nightWindow`, `darkBounds`, `defaultNightMinutes`, `SUN_LIMIT` and every
  visibility rule — settled in `REVIEW.md`; this plan changes a label only.
- The guide text at the bottom of `sky-tonight.html` and the print card.
- Polar day / polar night handling (`activeWindow.polar`) — those nights hide
  the whole row already (`windowTimes.hidden = true`).

## Git workflow

- Branch: `advisor/002-dark-from-bright-nights`
- One commit, plain imperative sentence, e.g. (repo style)
  `Say when the Moon stays below the horizon all night`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `darkFrom(window)` to `public/sky-forecast.js`

Directly below `defaultNightMinutes`, add:

```js
// The "Dark from" line. Near midsummer at high latitudes the Sun never gets
// 18° down, so there is no full dark; say when the sky is at its darkest
// stage instead of leaving the line blank.
export function darkFrom(window) {
  if (window.astroDusk) return { label: 'Dark from', time: window.astroDusk };
  return { label: 'Darkest from', time: window.civilDusk ?? null };
}
```

**Verify**: `bun test sky-forecast.test.ts` → 0 fail.

### Step 2: Tests

In `sky-forecast.test.ts`, add `darkFrom` to the import list at the top (keep
it alphabetical: after `currentNightDate`), then add:

```ts
describe('Sky Tonight dark-from line', () => {
  test('an ordinary night names astronomical dusk', () => {
    const line = darkFrom(window);
    expect(line.label).toBe('Dark from');
    expect(line.time).toBe(window.astroDusk);
  });

  test('a midsummer night that never gets fully dark still gets a time', () => {
    const london = new Astronomy.Observer(51.5, -0.1, 0);
    const night = nightWindow(london, new Date(2026, 5, 21, 12));
    expect(night.astroDusk).toBeNull();
    const line = darkFrom(night);
    expect(line.label).toBe('Darkest from');
    expect(line.time).toBe(night.civilDusk);
    expect(line.time).not.toBeNull();
  });
});
```

(`window` and `Astronomy` are already defined at the top of that file.)

**Verify**: `bun test sky-forecast.test.ts` → 0 fail, 2 new tests.

### Step 3: Use it on the page

In `public/sky-tonight.html`:

a. Line 191: give the label span an id —
   `<span id="dark-label">Dark from</span>`. Keep `id="dark-time"` on the `<strong>`.

b. Add `darkFrom` to the existing import from `./sky-forecast.js?v=…` near
   the top of the inline module script (find it with
   `grep -n "sky-forecast.js" public/sky-tonight.html`; add the name to the
   existing braces, do not add a second import statement and do not edit the
   `?v=` value by hand).

c. Next to `const darkTime = document.getElementById('dark-time');` (line
   492) add `const darkLabel = document.getElementById('dark-label');`.

d. On line 826 replace only
   `darkTime.textContent = formatTime(activeWindow.astroDusk);` with
   `const dark = darkFrom(activeWindow); darkLabel.textContent = dark.label; darkTime.textContent = formatTime(dark.time);`

   Check first that no variable named `dark` already exists in that function:
   `sed -n 815,832p public/sky-tonight.html | grep -n "\bdark\b"` → no match.
   If there is one, name yours `darkLine`.

**Verify**: `grep -c "dark-label" public/sky-tonight.html` → `2`;
`grep -c "activeWindow.astroDusk" public/sky-tonight.html` → `0`.

### Step 4: Restamp and run everything

`bun tools/stamp-module-versions.ts`, then `bun test`.

**Verify**: `bun test` → 0 fail. If `qa-selectors.test.ts` or `site.test.ts`
fails because of an id inventory, read the failing assertion: adding
`dark-label` to a selector list in a test file is allowed **only** if the
failure message names an unlisted id; otherwise STOP.

## Test plan

- Two new tests in step 2 (ordinary night; London 21 June 2026).
- Existing fixtures (San Francisco etc.) must be untouched and passing.

## Done criteria

- [ ] `bun test` exits 0 with at least 2 more passing tests
- [ ] `grep -n "Darkest from" public/sky-forecast.js` → 1 match
- [ ] `grep -c 'id="dark-time"' public/sky-tonight.html` → `1`
- [ ] `bun tools/stamp-module-versions.ts && git status --short` after commit → clean
- [ ] `plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match the live code.
- The print card or another element also reads `activeWindow.astroDusk`
  (the grep in step 3 should have found exactly one use before your edit;
  if it finds more, stop and report them).
- A test fails for a reason other than an id inventory (see step 4).

## Maintenance notes

- "Darkest from" is new visible copy; the owner may prefer other wording
  (e.g. "No full dark · darkest from"). It is one string in `darkFrom`.
- The guide text still says "the forecast shows a **Dark from** time"; that
  stays true on most nights and was left alone deliberately.
- Reviewer: confirm the label resets to "Dark from" when stepping from a June
  date to a September date (it is set on every render, so it should).
