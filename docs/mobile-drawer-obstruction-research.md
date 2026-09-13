# Mobile view: the bottom drawer obstructs the scene

Research notes for improving the phone layout, with Sky Tonight as the worst case.
All measurements taken against `bun dev-server.ts` at the listed CSS viewports.

## Summary

The collapsed info drawer is not merely "in the way" on Sky Tonight — it sits on
top of the one thing the page exists to show. The horizon line, the compass rose,
and every "below the horizon" planet label are drawn inside the band the drawer
occupies, at every phone size tested. In landscape the drawer and the controls
dock physically overlap each other.

Two independent defects produce this:

1. The drawer's vertical position is a hardcoded constant per breakpoint, tuned
   for the tallest dock on the site. It is wrong for every other page.
2. The Sky Tonight canvas lays out from `height * 0.76` — a fraction of the whole
   viewport. Nothing tells it that the bottom quarter of that viewport is covered.

## Measured behaviour

Geometry of the collapsed state. "Peek" is the 64px strip left visible by
`transform: translate3d(0, calc(100% - 64px), 0)` + `clip-path` in
`public/common.css:754`. "Horizon" is `horizonY = height * 0.76` from
`drawHorizon()` in `public/sky-tonight.html:269`.

| Viewport | Horizon y | Compass y | "Below" label lanes | Drawer peek | Dock | Horizon hidden | Compass hidden |
|---|---|---|---|---|---|---|---|
| 375 x 667 (SE) | 507 | 529 | 527 / 541 / 555 | 471–535 | 572–657 | yes | yes |
| 390 x 844 (12 Pro) | 641 | 663 | 661 / 675 / 689 | 628–692 | 749–834 | yes | yes |
| 430 x 932 (14 Pro Max) | 708 | 730 | 728 / 742 / 756 | 716–780 | 837–922 | no (8px clear) | yes |
| 844 x 390 (landscape) | 296 | 318 | 316 / 330 / 344 | 270–334 | 300–384 | yes | yes |

Bottom chrome consumes 23–31% of the viewport depending on device: 216px of 844
on an iPhone 12 Pro, 196px of 667 on an SE, 120px of 390 in landscape.

### 1. The horizon is drawn under the drawer

On a 390x844 iPhone 12 Pro the horizon line lands at y=641 and the drawer peek
spans 628–692. The compass letters (`horizonY + 22`) and the three stacked
"below" label lanes (`horizonY + 20 + lane * 14`) are all inside that band.

The practical effect: the forecast list says "Venus · SW (11° up) at 7:03 pm" and
the canvas renders SW-at-11-degrees behind an opaque panel whose only visible
content is the word "Read". Low-altitude objects at dusk — Mercury and Venus in
the sample forecast, exactly the ones worth chasing — are the ones occluded.

On the tallest phone the horizon line itself squeaks past, but the compass rose
and every below-horizon label still do not. There is no phone size where the
horizon view reads correctly.

### 2. The drawer and the dock overlap in landscape

At 844x390 the drawer is pinned to `bottom: 56px` (`common.css:992`) while the
dock sits at `bottom: 6px`. Sky Tonight's dock is two rows and 84px tall, so it
renders on top of the drawer peek with 34px of overlap — the panel heading is
sliced mid-glyph and the Read button is half covered. Confirmed visually.

### 3. Two collapse affordances fight in landscape

The mobile drawer activates on `(max-width: 820px), (max-height: 520px) and
(orientation: landscape)` (`common.css:647`). The desktop "Hide info" toggle
activates on `(min-width: 821px)` with no height condition (`common.css:1081`).
Landscape phones satisfy both: iPhone 12 Pro (844), Pixel 7 (915), 14 Pro Max
(932). Both controls render at once. Worse, the desktop toggle positions itself
from `getComputedStyle(panel).top`, which the mobile rule sets to `auto`, so it
lands at an arbitrary spot mid-screen.

### 4. The hardcoded offset wastes space on the pages that need it most

`bottom: 152px` is one constant that has to clear every page's dock, and dock
height is content-driven:

| Page | Dock height | Gap between peek bottom and dock top |
|---|---|---|
| Solar system | 134px | 8px |
| Seasons | 94px | 48px |
| Sky Tonight | 85px | 57px (at 430x932) / 48px (at 390x844) |

So the page with the most content and the most occlusion-sensitive canvas gives
up the most space to a gap that exists only because another page's dock is taller.

### 5. Expanding is not an escape

Sky Tonight's panel holds 1343px of content in a 439px window — 3.1 screens of
scrolling. Expanded, it covers y=253 to y=692, leaving only the empty upper sky
visible. For comparison the other drawers barely scroll: solar system 490px of
content in 439px, seasons 364px in 366px.

The panel and the canvas are not "scene plus optional commentary" here. The list
names a direction and an altitude; the canvas is what makes that mean something.
The current drawer forces an either/or between the two halves of one answer.

## Root causes

- **No shared notion of the free scene area.** Neither CSS nor the canvas code has
  a variable for "where the chrome starts". `drawHorizon()` computes from
  `height * 0.76` and `Math.max(92, height * 0.14)`; the drawer computes from
  `bottom: 152px`. The two numbers were tuned independently and collide.
- **The peek carries no information.** 64px of opaque panel across the full width
  shows a decorative rule, the page's `h2`, and a Read button — content the user
  already read in the header. It costs a quarter of the horizon to say nothing.
- **Breakpoint conditions are not mutually exclusive** between the mobile and
  desktop panel treatments.

## Options

**A. Publish the chrome geometry, let scenes lay out inside it.** Have `chrome.js`
measure the dock and drawer peek with the `ResizeObserver` it already runs for the
desktop toggle, and expose `--scene-bottom` / `--scene-top` plus a `SPACE` value.
`drawHorizon()` then derives `horizonY` from the real free band instead of 0.76,
reserving ~46px below it for the compass and label lanes. Fixes the occlusion at
every size and orientation, and gives the other scenes the same guarantee.
Foundational; everything else builds on it.

**B. Anchor the drawer to the measured dock.** Replace `bottom: 152px / 132px /
56px` with `calc(var(--dock-height) + 10px)`. Removes the 48–57px dead gap in
portrait and the 34px landscape overlap in one change. Small, mechanical.

**C. Make the peek say something.** Same 64px, but show the headline answer —
"Venus · SW · 11° up · sets 8:11 pm" — instead of repeating the page title. Turns
the most expensive strip on the screen from a tease into the answer. Cheap, and
the biggest perceived win per line changed.

**D. Split the Sky Tonight panel.** "What to look for" is short and belongs beside
the canvas; the location card, science note, and end-of-journey copy are long-form
reading. Only the latter needs a 1343px drawer. Structural, Sky-Tonight-specific.

**E. Three-state drawer (peek / half / full).** The standard bottom-sheet pattern.
Lets the reader hold the list and the horizon on screen together at the half stop.
More work, and needs drag handling to feel right.

**F. Full-screen sheet on expand.** Expanded already hides the useful sky, so going
full-screen costs nothing visually and gains ~400px of reading room. Loses any
chance of seeing both halves at once, which argues against it for this page.

## Recommendation

Ship **A + B** together as the bug fix, then **C** as the UX win. A and B are
what make the horizon view correct; C is what makes the drawer worth its space.
Fix the landscape media-query overlap (finding 3) alongside B — it is a one-line
condition change. Treat D and E as follow-ups once the geometry is trustworthy.

## Test and QA impact

`site.test.ts` pins the drawer *mechanism* but not its position:

- `mobile drawer opens without relayout or a native tap flash` (line 843) asserts
  `translate3d(0, calc(100% - 64px), 0)`, the clip-path pairing, the 12px 16px
  padding, and the 52px toggle width. Keeping the 64px peek height keeps this green;
  changing the peek height requires updating the regex.
- `interactive info panels use the shared mobile drawer` (797) and `mobile drawer
  scrolls as one box and pins Close` (805) are unaffected by geometry.
- No test asserts `bottom: 152px`, so **B is free**.

The Argent visual baseline `london-night-window__chromium-1280x800-crop` is a
1280x800 desktop crop, so mobile geometry changes do not touch it. The
`qa-sky-tonight-manual-location` flow types into `#latitude`, which is inside the
collapsed drawer and `pointer-events: none` on phones — that flow only runs at
desktop width today and would need a drawer-open step if it ever moves to a phone
viewport.

New coverage worth adding: a unit test asserting the drawer offset derives from
the dock rather than a literal, and a QA flow at a phone viewport that asserts the
horizon line and compass are outside the drawer's rect.
