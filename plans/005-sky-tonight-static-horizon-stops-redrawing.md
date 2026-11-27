# Plan 005: Sky Tonight's horizon view draws only when something changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7e6950..HEAD -- public/frame-loop.js public/sky-tonight.html frame-loop.test.ts public/_headers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plans 001 and 002 edit other parts
> of `sky-tonight.html`; their changes alone are not a mismatch.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (run after 001 and 002 if all are being done)
- **Category**: perf
- **Planned at**: commit `a7e6950`, 2026-11-09

## Why this matters

Sky Tonight is the page people hold up outdoors at night on a phone. Its
default "horizon" view is a still picture: nothing in it moves with time. Yet
the page repaints the full-screen canvas 30 times a second for as long as the
tab is visible — a full-screen gradient at device pixel ratio, 925 catalogue
stars, and label layout on every frame. That is battery and heat spent on a
static image. Only the alternate "orbit" view actually animates (its stars
twinkle). After this plan the horizon view draws once and again only when
invalidated; the orbit view animates as before.

## Current state

- `public/frame-loop.js` (60 lines) — the site's one animation scheduler,
  `createFrameLoop(draw, { fps, animated, element })`. Used by every page.
- `public/sky-tonight.html` — the page, with one large inline module script.
- `frame-loop.test.ts` — behavioural tests for the scheduler with a fake
  `requestAnimationFrame`.
- `public/_headers` — CSP hashes for inline scripts; refreshed by
  `bun tools/stamp-module-versions.ts`.

`public/frame-loop.js:3-8` and `:16-31`:

```js
export function createFrameLoop(draw, {
  fps = 60,
  animated = true,
  element = null,
} = {}) {
  ...
  function tick(now) {
    frame = null;
    if (disposed || document.hidden || !visible) return;
    const elapsed = last === null ? interval : now - last;
    // Small tolerance avoids halving the rate due to vsync rounding.
    if (dirty || elapsed >= interval - 0.5) {
      ...
      dirty = false;
      draw(now, dt);
    }
    if (animated && !globalThis.taVisualBaselines) schedule();
  }
  function invalidate() {
    dirty = true;
    schedule();
  }
```

So with `animated` false the loop draws once and then only after
`invalidate()` (or resize / visibility change).

`public/sky-tonight.html:1034-1040`:

```js
const startTime = performance.now();
function loop() {
  const time = SPACE.prefersReducedMotion ? 0 : (performance.now() - startTime) * 0.001;
  if (viewMode === 'horizon') drawHorizon(time); else drawOrbit(time);
}
const drawing = SPACE.createFrameLoop(loop, { fps: 30, animated: !SPACE.prefersReducedMotion, element: canvas });
document.addEventListener('input', drawing.invalidate); document.addEventListener('change', drawing.invalidate); document.addEventListener('click', drawing.invalidate);
```

`drawHorizon(time)` (lines 326-465) never reads its `time` argument; nothing
in it depends on the clock. `drawOrbit(time)` (line 293) does:

```js
    const twinkle = 0.5 + 0.5 * Math.sin(time * 1.5 + star.phase);
```

`public/sky-tonight.html:603-610` — switching view already invalidates:

```js
function setView(mode, announce = true) {
  viewMode = mode === 'orbit' ? 'orbit' : 'horizon';
  try { localStorage.setItem('sky.view', viewMode); } catch {}
  highlightedBody = null;
  updateViewButtons();
  drawing.invalidate();
  ...
```

Every other state change already invalidates too: the document-level
`input` / `change` / `click` listeners above, `highlightBody()` (hover and
list focus), and the frame loop's own resize and visibility handlers. Users
with reduced motion already run with `animated: false`, so the static path
is exercised in production today.

`viewMode` is declared with `let` at line 522, long before `loop`.

Existing test to model on, `frame-loop.test.ts:74-90`:

```ts
test('static canvases draw once and redraw on edits and resize without an idle loop', () => {
  const h = harness({ animated: false });
  h.tick(0);
  expect(h.frames.length).toBe(1);
  expect(h.pending.size).toBe(0);
  h.loop.invalidate(); h.loop.invalidate();
  expect(h.pending.size).toBe(1);
  h.tick(10);
  expect(h.frames.length).toBe(2);
  ...
```

`harness(options)` builds a loop with fakes; `h.tick(now)` runs pending
frames, `h.frames` records draws, `h.pending` is the set of scheduled frames.

Conventions: 2-space indent, single quotes, semicolons; comments say why.
`frame-loop.js` is imported by `chrome.js` as `./frame-loop.js?v=20260910-1`
— a hand-written version string. Recent commits change shared modules without
bumping these strings; **do not change any `?v=` string by hand.**

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Scheduler tests | `bun test frame-loop.test.ts` | `0 fail` |
| All tests | `bun test` | `0 fail` |
| Restamp CSP hashes | `bun tools/stamp-module-versions.ts` | prints `Module versions and inline-script CSP hashes are current.` |
| Bundle check | `bun run build.ts && git diff --stat -- public/common.bundle.js` | see step 3 |

No install, lint or typecheck exists in this repo.

## Scope

**In scope**:

- `public/frame-loop.js` — `animated` may be a function
- `public/sky-tonight.html` — the one `createFrameLoop` call
- `frame-loop.test.ts` — one new test
- `public/common.bundle.js` — only if `bun run build.ts` changes it (step 3)
- `public/_headers` — only via the stamp tool

**Out of scope**:

- `drawHorizon`, `drawOrbit`, label layout, the star catalogue.
- Other pages' `createFrameLoop` calls (they pass booleans and keep working).
- `REVIEW.md`'s settled item "Slider and date-step cost" — this plan does
  not touch list rebuilding or per-step work, only idle repainting.
- Any `?v=` string.

## Git workflow

- Branch: `advisor/005-static-horizon`
- One commit, plain imperative sentence (repo style).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Let `animated` be a function in `public/frame-loop.js`

Change the top comment's second line and the one condition. After the change
the file starts:

```js
// One scheduler for canvas work: bounded frame rate, no hidden-tab work,
// and explicit invalidation for static (reduced-motion) drawings.
// `animated` may be a function, for a canvas that moves in one mode only.
```

and in `tick`, replace

```js
    if (animated && !globalThis.taVisualBaselines) schedule();
```

with

```js
    const moving = typeof animated === 'function' ? animated() : animated;
    if (moving && !globalThis.taVisualBaselines) schedule();
```

**Verify**: `bun test frame-loop.test.ts` → 0 fail (all existing tests unchanged).

### Step 2: Test it

Add to `frame-loop.test.ts`, after the `static canvases…` test:

```ts
test('a canvas that animates in one mode idles in the other and resumes on invalidate', () => {
  let moving = false;
  const h = harness({ fps: 30, animated: () => moving });
  h.tick(0);
  expect(h.frames.length).toBe(1);
  expect(h.pending.size).toBe(0);
  moving = true;
  h.loop.invalidate();
  h.tick(40);
  expect(h.frames.length).toBe(2);
  expect(h.pending.size).toBe(1);
  h.tick(80);
  expect(h.frames.length).toBe(3);
  moving = false;
  h.tick(120);
  expect(h.pending.size).toBe(0);
  h.loop.dispose();
});
```

**Verify**: `bun test frame-loop.test.ts` → 0 fail, one more test than before.

### Step 3: Check whether the bundle embeds `frame-loop.js`

Run `bun run build.ts`, then `git diff --stat -- public/common.bundle.js`.

- No diff: the bundle does not contain the scheduler; nothing to do.
- A diff: the bundle inlines it; keep the regenerated file (it is in scope).
  CI requires the committed bundle to equal a fresh build.

**Verify**: `bun run build.ts && git diff --exit-code -- public/common.bundle.js`
exits 0 once the regenerated bundle (if any) is staged or committed.

### Step 4: Animate Sky Tonight only in orbit view

In `public/sky-tonight.html` replace

```js
const drawing = SPACE.createFrameLoop(loop, { fps: 30, animated: !SPACE.prefersReducedMotion, element: canvas });
```

with

```js
// Only the orbit view moves (its stars twinkle). The horizon view is a still
// picture, redrawn when something invalidates it, so a phone held up outside
// is not repainting the sky 30 times a second.
const drawing = SPACE.createFrameLoop(loop, { fps: 30, animated: () => viewMode === 'orbit' && !SPACE.prefersReducedMotion, element: canvas });
```

Do not change the `invalidate` listeners on the next line.

**Verify**: `grep -c "animated: () => viewMode === 'orbit'" public/sky-tonight.html` → `1`.

### Step 5: Restamp and run everything

`bun tools/stamp-module-versions.ts`, then `bun test`.

**Verify**: `bun test` → 0 fail.

### Step 6 (optional manual check, only if you can open a browser)

`bun dev-server.ts`, open `http://localhost:8765/sky-tonight`. In DevTools →
Rendering, enable "Paint flashing" (or the Performance monitor). Expected:
horizon view shows no continuous repaint while idle; moving the time slider,
hovering a planet row, or resizing repaints once; switching to Orbit shows
continuous twinkle; switching back stops it. If you have no browser, say so
in your report — do not claim this check was done.

## Test plan

- One new scheduler test (step 2) covering: idle when the function returns
  false, resume on `invalidate()` when it returns true, stop again when it
  returns false.
- All existing `frame-loop.test.ts` tests pass unchanged (boolean `animated`
  still works).

## Done criteria

- [ ] `bun test` exits 0, with 1 new passing test in `frame-loop.test.ts`
- [ ] `bun run build.ts && git diff --exit-code -- public/common.bundle.js` exits 0 on the committed tree
- [ ] `bun tools/stamp-module-versions.ts && git status --short` → clean on the committed tree
- [ ] `git diff a7e6950 -- public/ | grep -c '^[+-].*frame-loop.js?v='` → `0`
- [ ] `plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match the live code.
- `drawHorizon` turns out to read the clock after all:
  `sed -n '/^function drawHorizon(time)/,/^}/p' public/sky-tonight.html | grep -nE "\btime\b|performance\.now|Date\.now"`
  must print only the `function drawHorizon(time) {` line. If it prints
  more, stop — the view is not static and this plan's premise is wrong.
- A visual-baseline or Argent-related test (`visual-fixture.test.ts`,
  `sky-rendering.test.ts`) fails after step 4.

## Maintenance notes

- If the horizon view ever gains motion (a slow star drift, a pulsing
  highlight), change the `animated` function, not the scheduler.
- Any new state that affects the horizon drawing must call
  `drawing.invalidate()`; previously the 30 fps loop hid a missed
  invalidation. Reviewer: click through the page once looking for a control
  whose effect only appears after the next interaction — that is the
  failure mode this change can expose.
- A visitor with a cached older `frame-loop.js` and the new page gets the
  old behaviour (a function is truthy), not a break.
