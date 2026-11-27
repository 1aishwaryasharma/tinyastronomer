# Plan 004: Scene keyboard shortcuts stay out of the open guide and never fire with a modifier key

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7e6950..HEAD -- public/common.js public/common.bundle.js public/solar-system.html public/scale-walk.html site.test.ts public/_headers`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `a7e6950`, 2026-11-09

## Why this matters

Every scene page has a plain-language guide in a modal `<dialog id="page-guide">`
that scrolls. The scene's keyboard shortcuts listen on `window` and only skip
form fields, so while the guide is open:

- on Light Study, Seasons and Grand Tour, ↑/↓ do not scroll the guide — they
  tilt the hidden 3D camera (and `preventDefault()` blocks the scroll); Home
  recentres the hidden scene and announces it to screen readers;
- on Scale Walk, ←/→ move the walk to another stop behind the dialog.

Scale Walk's handler also ignores modifier keys, so the browser's Back
shortcut (Alt+← / Cmd+←) first pushes a new history entry and then goes back
to the one it just left: the visitor does not move. And Scale Walk's canvas
label tells screen-reader users "use the arrow keys to rotate, plus and minus
to zoom", which is false on that page (arrows travel between stops; there is
no keyboard zoom).

## Current state

Files:

- `public/common.js` — source of the shared `SPACE` helpers. **The browser
  loads `public/common.bundle.js`, generated from it by `bun run build.ts`.**
  CI fails if the committed bundle differs from a fresh build.
- `public/solar-system.html` (Grand Tour) and `public/scale-walk.html` — each
  has a large inline `<script type="module">`. Editing an inline script
  changes its CSP hash; `bun tools/stamp-module-versions.ts` refreshes
  `public/_headers`.
- `public/guide.js` — opens the dialog with `guide.showModal()` then
  `guide.focus()`, so key events inside it have the `<dialog open>` (or a
  descendant) as `event.target`.

`public/common.js:663-691`:

```js
  // ── Keyboard camera control (arrows rotate, +/− zoom) ──
  // Works with any cam exposing azimuthTarget / elevationTarget /
  // distanceTarget. Ignored while a form field has focus so native
  // behaviours (e.g. arrow keys on range sliders) are preserved.
  function bindCameraKeys(cam, opts) {
    ...
    window.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, select, textarea, [contenteditable]')) return;
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft':  cam.azimuthTarget += rotStep; break;
        ...
```

`public/common.js:1083-1108` — the object `SPACE` exposes (alphabetical-ish
list starting `bindCameraKeys, createFrameLoop, buildNav, clamp, ...` and
ending `..., setText, wirePlayPause`).

`public/solar-system.html:541-545`:

```js
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target && e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
  if (e.key === 'Home' || e.key === '0') { recenterView(); e.preventDefault(); }
});
```

`public/scale-walk.html:364-367`:

```js
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goTo(idx + 1);
  if (e.key === 'ArrowLeft') goTo(idx - 1);
});
```

`public/scale-walk.html:124-125`:

```js
const setup = SPACE.createScene({
  canvasLabel: 'True-scale solar system distance walk. Focus it and use the arrow keys to rotate, plus and minus to zoom.',
```

Scale Walk does not call `SPACE.bindCameraKeys` (only `index.html:876`,
`seasons.html:240`, `solar-system.html:514` do). Its visible hint
(`scale-walk.html:112`) correctly says `← → to travel`.

In both HTML pages `SPACE` is the object imported from
`./common.bundle.js?v=20260909-2` and is in scope where these handlers are.

Conventions:

- `common.js` is one IIFE with 2-space-indented inner functions, single
  quotes, semicolons, section comments like `// ── Title ──`.
- Tests at the repo root (`*.test.ts`, `bun test`). `site.test.ts` does
  `process.chdir('./public')` at the top, so it reads files as
  `readFileSync('common.js', 'utf8')`. `common.js` cannot be imported in Bun
  (it imports `three` through a browser import map), so tests slice a
  function out of the source text and evaluate it with `new Function`.
- Recent commits edit `common.js`, rebuild the bundle, and leave the
  hand-written `?v=20260909-2` query strings alone. Do the same: **do not
  change any `?v=` string.**

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Rebuild bundle | `bun run build.ts` | prints `Built public/common.bundle.js` |
| Restamp CSP hashes | `bun tools/stamp-module-versions.ts` | prints `Module versions and inline-script CSP hashes are current.` |
| All tests | `bun test` | `0 fail` |

No install, lint or typecheck exists in this repo. `build.ts` and the stamp
tool write files in `public/`; that is expected.

## Scope

**In scope**:

- `public/common.js` — add one helper, use it in `bindCameraKeys`, export it
- `public/common.bundle.js` — regenerated only, never hand-edited
- `public/solar-system.html` — the Home/0 handler
- `public/scale-walk.html` — the arrow handler and the `canvasLabel` string
- `site.test.ts` — new tests appended at the end
- `public/_headers` — only via the stamp tool

**Out of scope**:

- `public/index.html`, `public/seasons.html` — they get the fix through
  `bindCameraKeys`; no edit needed.
- `public/guide.js`, `public/chrome.js`.
- Adding keyboard zoom to Scale Walk — a feature, not this fix.
- Any `?v=` string anywhere.

## Git workflow

- Branch: `advisor/004-scene-shortcuts`
- One commit, plain imperative sentence (repo style, e.g.
  `Keep scene controls, hint and info panel apart on laptop screens`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the shared guard to `public/common.js`

Directly above the `// ── Keyboard camera control` comment (line 663), add:

```js
  // ── Scene shortcuts ──
  // Skipped with a modifier held (browser shortcuts such as Alt+← for Back),
  // in form fields, and while a dialog such as the page guide is open, so the
  // keys keep their native meaning there.
  function ignoresSceneKeys(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return true;
    const t = e.target;
    return !!(t && t.closest && t.closest('input, select, textarea, [contenteditable], dialog[open]'));
  }

```

In `bindCameraKeys`, replace these three lines

```js
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, select, textarea, [contenteditable]')) return;
```

with

```js
      if (ignoresSceneKeys(e)) return;
```

In the returned object near the end of the file (the `return {` that lists
`bindCameraKeys, createFrameLoop, buildNav, ...`), add `ignoresSceneKeys,` on
its own line directly after `glowShell,`.

**Verify**: `grep -c "ignoresSceneKeys" public/common.js` → `3`.

### Step 2: Rebuild the bundle

`bun run build.ts`

**Verify**: `grep -c "dialog\[open\]" public/common.bundle.js` → `1`;
`git diff --stat -- public/common.bundle.js` shows the file changed.

### Step 3: Grand Tour Home/0 handler

In `public/solar-system.html` replace

```js
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target && e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
  if (e.key === 'Home' || e.key === '0') { recenterView(); e.preventDefault(); }
```

with

```js
  if (SPACE.ignoresSceneKeys(e)) return;
  if (e.key === 'Home' || e.key === '0') { recenterView(); e.preventDefault(); }
```

**Verify**: `grep -c "SPACE.ignoresSceneKeys" public/solar-system.html` → `1`.

### Step 4: Scale Walk arrows and label

In `public/scale-walk.html` replace the handler with

```js
addEventListener('keydown', e => {
  if (SPACE.ignoresSceneKeys(e)) return;
  if (e.key === 'ArrowRight') goTo(idx + 1);
  if (e.key === 'ArrowLeft') goTo(idx - 1);
});
```

and change the `canvasLabel` string to

```js
  canvasLabel: 'True-scale solar system distance walk. Use the left and right arrow keys to travel between stops; drag to look around.',
```

**Verify**: `grep -c "plus and minus to zoom" public/scale-walk.html` → `0`;
`grep -c "SPACE.ignoresSceneKeys" public/scale-walk.html` → `1`.

### Step 5: Tests

Append to the end of `site.test.ts`:

```ts
describe("scene keyboard shortcuts", () => {
  const common = readFileSync("common.js", "utf8");
  const source = common.match(/function ignoresSceneKeys\(e\) \{[\s\S]*?\n  \}/);
  if (!source) throw new Error("ignoresSceneKeys not found in common.js");
  const ignores = new Function(`${source[0]}; return ignoresSceneKeys;`)() as (e: object) => boolean;
  const within = (...selectors: string[]) => ({
    closest: (list: string) => (selectors.some((s) => list.split(", ").includes(s)) ? {} : null),
  });

  test("plain keys on the scene are handled", () => {
    expect(ignores({ target: within() })).toBe(false);
    expect(ignores({ target: null })).toBe(false);
  });

  test("modifier chords are left to the browser", () => {
    for (const key of ["altKey", "ctrlKey", "metaKey"]) expect(ignores({ [key]: true, target: within() })).toBe(true);
  });

  test("form fields and the open guide keep their own keys", () => {
    expect(ignores({ target: within("input") })).toBe(true);
    expect(ignores({ target: within("dialog[open]") })).toBe(true);
  });

  test("every scene shortcut handler uses the shared guard", () => {
    expect(common.match(/bindCameraKeys[\s\S]*?switch \(e\.key\)/)![0]).toContain("ignoresSceneKeys(e)");
    for (const file of ["solar-system.html", "scale-walk.html"]) {
      const html = readFileSync(file, "utf8");
      for (const handler of html.matchAll(/addEventListener\('keydown', \(?e\)? => \{[\s\S]*?\n\}\);/g)) {
        expect(handler[0], file).toContain("SPACE.ignoresSceneKeys(e)");
      }
    }
    expect(readFileSync("scale-walk.html", "utf8")).not.toContain("plus and minus to zoom");
  });
});
```

`describe`, `expect`, `test` and `readFileSync` are already imported at the
top of `site.test.ts`; that file uses double quotes — keep them.

If the last test fails because one of those two pages has *another*
`keydown` handler that legitimately must not use the guard (for example an
Escape handler for a panel), do not weaken the guard: narrow the test to the
two handlers named in steps 3 and 4 and report what you found.

**Verify**: `bun test site.test.ts` → 0 fail, 4 new tests.

### Step 6: Restamp and run everything

`bun tools/stamp-module-versions.ts`, then `bun test`.

**Verify**: `bun test` → 0 fail.
`bun run build.ts && git diff --exit-code -- public/common.bundle.js` after
staging/committing → exit 0 (bundle matches source).

## Test plan

- Four new tests in `site.test.ts` (step 5): the guard's behaviour executed
  with fake events, plus one check that all three handlers use it.
- Optional manual check if a browser is available: `bun dev-server.ts`, open
  `http://localhost:8765/seasons#guide`, press ↓ — the guide scrolls; close
  it, press ↓ — the camera tilts.

## Done criteria

- [ ] `bun test` exits 0, with 4 new passing tests
- [ ] `bun run build.ts && git diff --exit-code -- public/common.bundle.js` exits 0 on the committed tree
- [ ] `bun tools/stamp-module-versions.ts && git status --short` → clean on the committed tree
- [ ] `git diff a7e6950 -- public/ | grep -c '^[+-].*?v='` → `0` (no version string changed)
- [ ] `grep -rn "closest('input, select, textarea, \[contenteditable\]')" public/common.js public/solar-system.html public/scale-walk.html` → no matches
- [ ] `plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match the live code.
- `bun run build.ts` fails, or changes files other than `public/common.bundle.js`.
- A test about bundle size or asset budget (`asset-budget.test.ts`) fails
  after the rebuild.
- You find the guide dialog is not a `<dialog>` element on some page
  (`grep -c '<dialog class="page-guide"' public/*.html`), which would make
  the `dialog[open]` selector miss it.

## Maintenance notes

- Any new window-level scene shortcut should call `SPACE.ignoresSceneKeys`.
- The `?v=20260909-2` string on `common.bundle.js` was left alone to match
  recent practice; Cloudflare's default revalidation serves the new bundle.
  If the owner wants it bumped it must change in five files at once
  (`index.html`, `seasons.html`, `scale-walk.html`, `solar-system.html`,
  `tour-textures.js`).
- Deferred: Scale Walk still has no keyboard zoom; the label no longer
  promises one.
- Reviewer: check the bundle diff contains only the guard change.
