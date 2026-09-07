# Performance fixes — September 7, 2026

The implementation is local; these results do not represent a new deployment.
The earlier deployed baseline is in [production-performance.md](production-performance.md).

## Changes

- The homepage displays an 85 KB capture of its Earth scene, then initializes
  Three.js and the interactive Light Study when opened, including direct links.
- Fonts are served locally, with Latin subsets and swap rendering.
- Teaching planet textures are prebuilt WebP assets instead of synchronous
  procedural canvas work. Overview Earth textures use a compact 2K image;
  the Light Study retains its original detailed imagery.
- Scale Walk loads only the Earth map it uses.
- Grand Tour starts with its neutral fallback globes. Selecting a world loads
  its NASA model and the GLTF loader on demand; other models remain deferred.
- Shared render helpers are bundled to shorten the module request chain.
  Navigation initializes independently of the rendering modules.

## Latest mobile lab results

Lighthouse 13.4.1, Headless Chrome 152, simulated mobile throttling (150 ms RTT,
1,638.4 Kbps, 4× CPU slowdown). The local server uses the repository's routing
and CSP with gzip for text resources, approximating production compression.
Audits ran sequentially. Each row is the latest completed run for that page's
final implementation, not a median. All reports have no runtime error or run
warnings. WebGL startup and machine load can cause substantial variance.

| Page | Performance / 100 | LCP | TBT | Transfer |
| --- | ---: | ---: | ---: | ---: |
| Home | 97 | 2.56 s | 0 ms | 262 KiB |
| Missions | 98 | 1.95 s | 0 ms | 165 KiB |
| Sky Tonight | 99 | 1.95 s | 8 ms | 171 KiB |
| Seasons | 91 | 3.17 s | 0 ms | 613 KiB |
| Scale Walk | 91 | 3.16 s | 0 ms | 810 KiB |
| Grand Tour | 89 | 3.30 s | 0 ms | 1483 KiB |

Same-server compressed baseline audits of commit 9182686 scored 80 for Seasons,
77 for Scale Walk, and 65 for Grand Tour. Their transfers were 878, 1732, and
4308 KiB respectively. These comparisons support improvements independently
of the earlier deployed audit, whose network and rendering conditions differ.
The earlier deployed scores should not be treated as a controlled before/after
comparison with localhost. Grand Tour remains below 90 in its latest run;
its remaining loading delay needs another measurement on the deployed build.

## Verification and artifacts

- `bun run build.ts` regenerates `public/common.bundle.js`. CI checks that the
  generated file is current.
- `bun test`: 134 passing tests, including lazy startup, direct-link startup,
  model-loader deferral, texture caching, local fonts, and existing CSP checks.
- `git diff --check` passes.
- Electron checks on the final build confirmed no canvas or Three.js request on
  home, successful Light Study initialization through its hash, no GLB or GLTF
  loader request in Grand Tour overview, and a successful Mars model response
  when navigating to `solar-system#mars`.

Reports are local, gitignored files in `artifacts/perf-fixes/`:
`home-final`, `missions-final`, `sky-tonight-final`, `seasons-bundle`,
`scale-walk-bundle`, and `solar-system-lazy-loader` (each `.report.json` and
`.report.html`). The gzip test server is saved there as `server.ts`.

After deployment, rerun the six public URLs under the same Lighthouse profile
and use repeated runs to assess rendering variability and CDN behavior.
