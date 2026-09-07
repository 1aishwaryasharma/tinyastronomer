# Website performance — September 7, 2026

The site is a static, vanilla-JavaScript application. Four pages use Three.js;
Missions and Sky Tonight use Canvas 2D and do not load Three.js.

## Findings and changes

- Missions repainted its full canvas 120 times per second on the local 120 Hz
  display. Shared scheduling now limits decorative canvases to 30 fps and 3D
  scenes to 60 fps. Simulation deltas use actual elapsed time rather than frame
  counts; resuming a hidden scene does not advance it by the hidden duration.
- Hidden tabs and offscreen canvases stop scheduling animation callbacks.
  Reduced-motion Canvas 2D pages draw once, then redraw on resize or input.
  The 3D scenes retain their interactive rendering loop while visible.
- Tour texture code imported an unversioned common.js alongside the versioned
  page import. Both now resolve to the same module URL. Earth texture helper
  URLs are also consistent between pages for reuse across navigation.
- The two required Three.js entry/core modules are preloaded after the import
  map. Putting the map first is necessary for older Chromium runtimes.
  Non-WebGL pages have no Three.js preload.
- The night-lights PNG was converted to lossless WebP: 410,160 → 306,308 bytes
  (25.3% smaller). Decoded RGBA bytes were compared and were identical. Cloud
  WebP was slightly larger than the original PNG, so the PNG remains in use.
- Changed module URLs and the inline-script CSP hashes were updated together.

## Validation

Local Chromium renderer measurements (Electron shell, 120 Hz host display):

| Check | Before | After |
| --- | --- | --- |
| Missions full-canvas redraws per second | 120 | 30 |
| Offscreen Missions redraws over 500 ms | Not measured | 0 |
| Resumed Missions redraws over 500 ms | Not measured | 15 |
| Home / Seasons / Scale Walk renders per second | Not measured | 60 |
| Grand Tour renders per second | Not measured | 58 |
| Sky Tonight redraws per second | Not measured | 30 |

All six pages were opened against the local server with production CSP rules.
The four WebGL contexts initialized successfully, each loaded one common.js
module URL, and resource timing reported no HTTP failures. `bun test` passes
129 tests, including deterministic 120/144 Hz scheduling, elapsed-time accuracy,
hidden/offscreen suspension, static-canvas invalidation, import-map order, and
WebP serving.

These are local rendering measurements, not production Core Web Vitals or a
mobile-network loading benchmark. No overall load-time or GPU-power percentage
improvement is claimed from the redraw counts alone.
