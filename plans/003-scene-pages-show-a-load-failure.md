# Plan 003: The 3D pages tell the visitor when the scene fails to load, instead of pulsing forever

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7e6950..HEAD -- public/solar-system.html public/seasons.html public/scale-walk.html site.test.ts`
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

Grand Tour (`solar-system.html`), Seasons (`seasons.html`) and Scale Walk
(`scale-walk.html`) cover the page with a full-screen loader ("Charting the
planets…") until the 3D scene is ready. If any script fails to download (a
flaky phone connection, a school filter, a deploy that changed a file while
the page was loading) or scene setup throws, nothing ever hides that loader
and nothing explains it: the visitor sees a pulsing message forever. The
Light Study on the home page already handles this with a plain message. This
plan gives the other three pages the same behaviour with one small shared
module.

## Current state

- `public/solar-system.html`, `public/seasons.html`, `public/scale-walk.html`
  — each has a loader element and one big inline `<script type="module">`.
- `public/index.html:1373-1379` — the existing good behaviour, for reference:

```js
  } catch (error) {
    console.error('Light Study could not start.', error);
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');
    loader.setAttribute('role', 'alert');
    loader.querySelector('.loader-text').textContent = 'The study could not load. Reload the page to try again.';
  }
```

Loader markup (same shape on all three pages), `public/solar-system.html:84-88`:

```html
<div class="loader" id="loader" role="status" aria-live="polite">
  <div class="loader-inner">
    <div class="loader-text">Charting the planets…</div>
    <div class="loader-bar" role="progressbar" ...><span class="loader-bar-fill"></span></div>
  </div>
```

The loader is hidden by adding the class `hidden` (done by
`SPACE.createLoader` in `public/common.js:1002-1030`, which also sets a
5-second safety timeout — but only once setup has reached that call).

Why setup can die before that call:

`public/solar-system.html:174-188` — top-level `await` of seven dynamic
imports with no catch:

```html
<script type="module">
// Initialize navigation and mobile controls before requesting the 3D graph.
import './chrome.js?v=20261008-1';
const [THREE, { SPACE }, { SPACE_DATA }, { createEarthGeometry },
  { createTourTextures }, { createPlanetModelLoader },
  { advanceTrackedCoordinate, relaxedPlanetDistance, sunAndPlanetFrame, updatedAutomaticDistance }
] = await Promise.all([
  import('three'),
  import('./common.bundle.js?v=20260909-2'),
  ...
```

`public/seasons.html:132-137` and `public/scale-walk.html:118-121` — static
imports; if one fails to fetch, the module never runs at all, so a
`try/catch` inside it cannot help:

```html
<script type="module">
import * as THREE from 'three';
import { SPACE } from './common.bundle.js?v=20260909-2';
```

How browsers report these failures (this is why the design below listens for
three things):

- A module script whose import graph fails to fetch fires an `error` event
  **on the `<script>` element**. It does not bubble, but a capture-phase
  listener on `window` sees it.
- An exception thrown while the module runs fires `error` on `window`.
- A rejected top-level `await` is reported as `error` on `window` in current
  browsers; `unhandledrejection` is listened to as well for safety.

Other page scripts: each page also loads
`<script type="module" async src="chrome.js?v=20261008-1"></script>` (line 16)
and, near the end, `<script type="module" src="guide.js?v=20260927-1"></script>`.
Module scripts with `src` need **no** CSP hash; only inline scripts do, and
this plan does not change any inline script.

Conventions:

- Small single-purpose ES modules in `public/` (see `public/guide.js`,
  69 lines, and `public/home-launch.js`, 59 lines). 2-space indent, single
  quotes, semicolons, a short "why" comment at the top.
- Tests live at the repo root as `*.test.ts`, run with `bun test`, and
  commonly evaluate a module's source with fakes. Pattern to copy —
  `frame-loop.test.ts:11-19`:

```ts
  const source = readFileSync(new URL('./public/frame-loop.js', import.meta.url), 'utf8');
  const create = new Function('document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'globalThis',
    source.replace('export function', 'function') + '; return createFrameLoop;')(
    document, window, ...
```

- `site.test.ts` checks many invariants across pages (script tags, redirects,
  sitemap, asset budgets). New files in `public/` may trip an inventory test;
  see step 4.
- `public/_headers` gives every `/*.js` an `X-Robots-Tag: noindex`; a new
  root-level `.js` file is covered automatically.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| All tests | `bun test` | `0 fail` |
| New test only | `bun test scene-load-failure.test.ts` | `0 fail` |
| Stamps unchanged | `bun tools/stamp-module-versions.ts && git diff --exit-code -- public/_headers` | exit 0 (no inline script changed) |
| Local server | `bun dev-server.ts` | serves http://localhost:8765 (only needed for the optional manual check) |

No install, lint or typecheck exists in this repo.

## Scope

**In scope**:

- `public/scene-load-failure.js` (create)
- `scene-load-failure.test.ts` (create, repo root)
- `public/solar-system.html`, `public/seasons.html`, `public/scale-walk.html`
  — add one `<script>` tag each, nothing else
- `site.test.ts` — only if an inventory assertion needs the new file listed
  (see step 4)

**Out of scope**:

- `public/index.html` — already handles this.
- `public/sky-tonight.html`, `public/missions.html` — no full-screen loader.
- `public/common.js`, `public/common.bundle.js`, `public/chrome.js` — do not
  put the handler there; those are shared, hand-versioned files and editing
  them forces a bundle rebuild and version bumps across six pages.
- Any inline script. If you edit one, the CSP hash changes; you should not
  need to.

## Git workflow

- Branch: `advisor/003-scene-load-failure`
- One commit, plain imperative sentence (repo style, e.g.
  `Say when the Moon stays below the horizon all night`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `public/scene-load-failure.js`

```js
// The scene pages cover themselves with a loader until the 3D scene is ready.
// If a script fails to download or setup throws, nothing would ever hide it.
// While the loader is still showing, turn any such failure into a message.
export function watchSceneLoad(win = window, doc = document) {
  function fail() {
    const loader = doc.getElementById('loader');
    if (!loader || loader.classList.contains('hidden')) return;
    loader.setAttribute('role', 'alert');
    loader.classList.add('loader-failed');
    const text = loader.querySelector('.loader-text');
    if (text) text.textContent = 'This page could not load. Check your connection and reload to try again.';
    const bar = loader.querySelector('.loader-bar');
    if (bar) bar.hidden = true;
  }
  // Capture phase: a failed <script> fetch fires on the element and does not bubble.
  win.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target !== win && target.tagName !== 'SCRIPT') return;
    fail();
  }, true);
  win.addEventListener('unhandledrejection', fail);
  return fail;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') watchSceneLoad();
```

Notes on the design, so you do not "simplify" it wrongly:

- The `tagName !== 'SCRIPT'` filter ignores failed images, fonts and
  textures (the scenes already have fallbacks for those). `target === win`
  is a thrown exception.
- The `hidden` check means an error *after* the scene is up changes nothing.

**Verify**: `bun -e "const m = await import('./public/scene-load-failure.js'); console.log(typeof m.watchSceneLoad)"` → `function`

### Step 2: Write `scene-load-failure.test.ts`

Create it at the repo root:

```ts
import { expect, test } from 'bun:test';
import { watchSceneLoad } from './public/scene-load-failure.js';

function page(hidden = false) {
  const classes = new Set<string>(hidden ? ['hidden'] : []);
  const text = { textContent: 'Charting the planets…' };
  const bar = { hidden: false };
  const attributes = new Map<string, string>([['role', 'status']]);
  const loader = {
    classList: { contains: (name: string) => classes.has(name), add: (name: string) => classes.add(name) },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    querySelector: (selector: string) => (selector === '.loader-text' ? text : selector === '.loader-bar' ? bar : null),
  };
  const win = new EventTarget();
  const doc = { getElementById: (id: string) => (id === 'loader' ? loader : null) };
  watchSceneLoad(win as never, doc as never);
  const fire = (type: string, target?: object) => {
    const event = new Event(type);
    if (target) Object.defineProperty(event, 'target', { value: target });
    win.dispatchEvent(event);
  };
  return { win, text, bar, attributes, classes, fire };
}

test('a thrown error while the loader shows becomes a visible alert', () => {
  const p = page();
  p.fire('error');
  expect(p.attributes.get('role')).toBe('alert');
  expect(p.text.textContent).toContain('could not load');
  expect(p.bar.hidden).toBe(true);
});

test('a script that fails to download is reported too', () => {
  const p = page();
  p.fire('error', { tagName: 'SCRIPT' });
  expect(p.attributes.get('role')).toBe('alert');
});

test('a rejected startup promise is reported', () => {
  const p = page();
  p.fire('unhandledrejection');
  expect(p.attributes.get('role')).toBe('alert');
});

test('a failed image or texture is not a page failure', () => {
  const p = page();
  p.fire('error', { tagName: 'IMG' });
  expect(p.attributes.get('role')).toBe('status');
  expect(p.text.textContent).toBe('Charting the planets…');
});

test('errors after the scene is showing leave the page alone', () => {
  const p = page(true);
  p.fire('error');
  expect(p.attributes.get('role')).toBe('status');
});
```

`EventTarget.dispatchEvent` sets `event.target` to the dispatching object
unless overridden; the `defineProperty` line overrides it for the
script/image cases. If Bun refuses to redefine `target` (TypeError), build
the event as a plain subclass instead:
`class Fake extends Event { constructor(type: string, private t: object) { super(type); } get target() { return this.t as never; } }`.

**Verify**: `bun test scene-load-failure.test.ts` → 5 pass, 0 fail.

### Step 3: Load it on the three pages

In each of `public/solar-system.html`, `public/seasons.html`,
`public/scale-walk.html`, insert this line **immediately before** the line
containing `<script type="module" async src="chrome.js?v=20261008-1"></script>`
(line 16 in each file):

```html
<script type="module" src="scene-load-failure.js"></script>
```

It must come before the big inline module so its listeners exist first
(module scripts run in document order). Do not add `async`.

**Verify**: `grep -c 'src="scene-load-failure.js"' public/solar-system.html public/seasons.html public/scale-walk.html` → each `:1`.

### Step 4: Run the whole suite and reconcile inventories

Run `bun test`.

- If everything passes, continue.
- If a `site.test.ts` assertion fails because it enumerates expected script
  `src` values or root `.js` files and does not know `scene-load-failure.js`,
  add the new name to that list, matching how neighbours are listed.
- If the test named `each local module is imported under one URL` or any
  version/`?v=` test fails, STOP — do not add a `?v=` string on your own.
- Any other failure: STOP.

Then run `bun tools/stamp-module-versions.ts`.

**Verify**: `bun test` → 0 fail; `git diff --exit-code -- public/_headers`
→ exit 0 (no CSP change, because no inline script changed).

### Step 5 (optional manual check, only if you can open a browser)

`bun dev-server.ts`, open `http://localhost:8765/seasons`, and in DevTools
block the request URL pattern `*common.bundle.js*`, then reload. Expected:
the loader text changes to "This page could not load. Check your connection
and reload to try again." Unblock and reload: the scene appears as before.
Skip this step if you have no browser; say so in your report.

## Test plan

- New file `scene-load-failure.test.ts` with the five cases in step 2.
- Full `bun test` must stay green; CSP hashes must be unchanged.

## Done criteria

- [ ] `bun test` exits 0, with 5 new passing tests
- [ ] `test -f public/scene-load-failure.js`
- [ ] `grep -l 'scene-load-failure.js' public/*.html | wc -l` → `3`
- [ ] `git diff --stat a7e6950 -- public/_headers public/common.js public/common.bundle.js public/chrome.js public/index.html` → empty
- [ ] `plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match the live code (for example the
  loader no longer has `id="loader"` or `.loader-text`).
- A version/`?v=` test fails (step 4).
- You find you need to edit an inline script or `common.js`.
- `bun test` fails twice for a reason not covered in step 4.

## Maintenance notes

- The module is deliberately unversioned (no `?v=`): the site's `?v=`
  strings are hand-bumped and already drift (see `plans/README.md`,
  "Findings not planned"). If the owner later adopts one versioning scheme,
  include this file.
- `.loader-failed` is added as a styling hook but has no CSS yet; the pulsing
  animation on `.loader-text` continues. A follow-up could stop it with
  `.loader-failed .loader-text { animation: none; }` in `public/common.css`
  (that file has a hand-bumped `?v=` on seven pages, which is why it was left
  out here).
- Related, not fixed here: `public/planet-models.js:60` caches a rejected
  loader promise, so one failed model-loader import disables detailed planet
  models until reload.
- Reviewer: confirm the new `<script>` precedes the inline module on all
  three pages and that no inline script changed.
