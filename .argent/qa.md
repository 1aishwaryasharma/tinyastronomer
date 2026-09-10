# Argent (CI)

Argent flows in `.argent/flows/` are the pull-request regression suite. GitHub replays them in Electron on Ubuntu (`.github/workflows/argent-qa.yml`). That is the merge gate.

Local simulator and emulator QA is agent-device, not Argent. See `.agent-device/qa.md`.

## Setup

1. `bun dev-server.ts` so `http://127.0.0.1:8765/` matches production routing.
2. Drive the Electron shell (`argent flow run … --platform chromium`). Vendoring it (`npm ci` in `.argent/electron`) and installing Argent need Node 22 or 24; CI runs the suite on both.

CI pins Argent to `0.21.0` and applies
`.github/scripts/patch-argent-capture.cjs` after installation. With Electron
33, Argent's quarter-scale readiness captures can leave the compositor scaled
down, corrupting subsequent screenshots. The workaround captures readiness at
native scale and keeps pixel-idle checks and snapshot tolerances intact. It
fails on another Argent version or an unexpected source shape, so upgrades
must re-evaluate it. To apply the same workaround to a local global install:

```sh
node .github/scripts/patch-argent-capture.cjs "$(npm root -g)/@swmansion/argent"
```

Apply it before starting the Argent server. An already running server retains
the old code until restarted; coordinate a restart with anyone sharing it.

The dev server reads `public/_headers` once at startup. After any change to `_headers` or to an inline `<script>` (which changes its CSP hash), restart the dev server before replaying. A stale server blocks the new inline scripts, every scene script dies silently, and the home-open flows fail on their content asserts while the header awaits still pass.

## Suite

Every flow proves the arrival header, then one piece of content only the scene script can produce, then the Explore button that `SPACE.buildNav` adds last.

| Flow | Journey | Content assert |
| --- | --- | --- |
| `qa-home-open-light-study` | Home deck opens Light Study in place | `info-title` equals "A world half-lit" |
| `qa-home-open-seasons` | Home deck opens Seasons | `picker` lists the four stops in order |
| `qa-home-open-grand-tour` | Home deck opens Grand Tour | `info-title` equals "Meet the neighbourhood" |
| `qa-home-open-scale-walk` | Home deck opens Scale Walk | `stops` runs from The Sun to Neptune |
| `qa-home-open-missions` | Home deck opens Missions | `voyager-dist` is a live km figure |
| `qa-home-open-sky-tonight` | Home deck opens Sky Tonight | `location-source` is time-zone based; `moon-summary` shows the phase and % lit |
| `qa-sky-tonight-manual-location` | Sky Tonight accepts a private manual London location | `meta-location`, `location-source`, `moon-summary` re-rendered for London |
| `qa-explore-next-stop` | Light Study Explore menu goes to Seasons | Seasons `picker` lists the four stops |

```sh
bun dev-server.ts
argent flow run qa-home-open-seasons --platform chromium
argent flow run .argent/flows --platform chromium
argent flow run .argent/flows --platform chromium --json --output artifacts > artifacts/flows.json
```

Home-open flows `run:` `.argent/fragments/boot-electron.yaml` so the Electron launch lives in one place. If the PR touches one study, run that study's flow. If it touches chrome, routing, or the home deck, run the directory.

## Which flows a change touches

Use this to pick what to replay locally and to read the CI table. The flows marked "planned" arrive with the site positioning work (new names, deep links, the teacher page).

| Changed path | Study | Flows | Structural tests to watch |
| --- | --- | --- | --- |
| `public/index.html` deck markup, `home.css`, `home-launch.js` | Home | every `qa-home-open-*`, `qa-explore-next-stop` | `site.test.ts` home assertions, `qa-selectors.test.ts` |
| `public/index.html` scene script, `earth-visuals.js`, `capture.js` | Light Study | `qa-home-open-light-study`, `qa-explore-next-stop`; planned `qa-light-study-presets` | `startup.test.ts`, tides and aurora tests |
| `public/seasons.html` | Seasons | `qa-home-open-seasons`, `qa-explore-next-stop`; planned `qa-seasons-stops` | seasons tests in `site.test.ts` |
| `public/solar-system.html`, `planet-models.js`, `tour-*.js` | Grand Tour | `qa-home-open-grand-tour` | body deep link and framing tests |
| `public/scale-walk.html` | Scale Walk | `qa-home-open-scale-walk` | Scale Walk texture test in `startup.test.ts` |
| `public/missions.html` | Missions | `qa-home-open-missions` | missions cross-link test |
| `public/sky-tonight.html`, `sky-forecast.js`, `sky-location.js`, `tz-coords.js` | Sky Tonight | `qa-home-open-sky-tonight`, `qa-sky-tonight-manual-location` | `sky-forecast.test.ts`, `sky-location.test.ts` |
| `public/chrome.js`, `common.js`, `common.css`, `tokens.css`, `_headers`, `_redirects`, `wrangler.jsonc`, `dev-server.ts` | Shared | the whole directory | CSP hash test, routing tests |
| `public/teachers.html` (planned) | Teachers | planned `qa-home-open-teachers` | new-page checklist tests |
| `docs/**`, `*.test.ts`, `.github/**`, `.argent/**` only | none | CI still runs the directory; nothing to replay by hand | all |

## What CI posts

The flows job runs the directory with `--json`, keeps the report at `artifacts/flows.json`, and renders it with `bun tools/flow-report.ts` into one pull-request comment that starts with `<!-- argent-qa -->`. Each push edits that comment in place. The same table goes to the job summary, so a push to `main` (which posts no comment) is still readable from the run page. Failed snapshot images, when a flow has a `snapshot:` step, land under `artifacts/<flow>/`.

The runner boots through `.github/actions/argent-shell`, which also wipes the SwiftShader user-data directory so no `localStorage` (journey progress, saved location, the mobile hint) survives between runs. The job is a two-leg matrix, Node 22 and Node 24; the Node 24 leg posts the comment and each leg uploads its own `argent-qa-node<major>` artifact.

## Visual baselines

The shared launch fragment passes `--visual-baselines` to the Electron shell.
This mode fixes the browser clock at `2026-09-08T12:00:00Z`, sets UTC and
`en-US`, and requests reduced motion. The preload installs the clock before
page scripts, including after navigation. Date constructors with arguments,
calendar arithmetic, timers, and `performance.now()` still work normally.
The plain `npm start` shell keeps the real clock and visible scenes.

The visual mode adds `data-qa-visual-baselines` to the document and hides
canvas pixels and projected `.label-3d` overlays. The scenes still initialize
and the content assertions still run. This keeps moving scene pixels out of
the translucent DOM crops; these snapshots do not verify 3D rendering.

| Flow | Snapshot | Crop / expected state |
| --- | --- | --- |
| `qa-home-open-light-study` | `light-info-panel` | `#light-info-panel`, free observation, science note closed |
| `qa-home-open-light-study` | `observation-presets` | `#presets`, seven labels, free observation selected |
| `qa-home-open-seasons` | `season-picker` | `#picker`, four stops, initial selection |
| `qa-home-open-seasons` | `season-controls` | `#seasons-controls`, initial slider and buttons |
| `qa-sky-tonight-manual-location` | `london-night-window` | `#night-window`, London (51.5, -0.1), September 9, 2026, UTC |

The forecast snapshot belongs to the manual-location flow, so the silent
timezone-location flow retains its original purpose. The Next day button advances September 8 to September 9; hard checks prove
both the initial and committed dates. Native date-field segments differ
between macOS and Ubuntu, so the flow does not depend on their hit targets. The frozen clock prevents the input's
today-to-one-year range from invalidating this fixture as calendar time passes.

All snapshots use Argent's default 0.5% mismatch tolerance. A crop-size change
fails independently of that tolerance. Identity and content checks run before
the crops; a missing baseline fails instead of silently adopting an image.

### Seed and review on CI

1. Push the feature branch and run **Argent QA** with `workflow_dispatch`,
   selecting that branch and `update_baselines: true`. With `gh` installed:

   ```sh
   gh workflow run argent-qa.yml --ref feature/qa-visual-baselines -f update_baselines=true
   ```

2. Require both Node legs to finish successfully. Generation is explicitly
   labelled in the job summary and does **not** count as a regression pass.
   Only a successful generation run uploads `argent-baselines-node22` and
   `argent-baselines-node24`. The workflow never commits images.
3. Download the artifacts and review all five images in each leg for correct
   text, spacing, active states, closed science note, and no scene pixels.
   In the London window expect sunset **6:28 pm**, dark from **8:27 pm**,
   sunrise **5:27 am**, and **New Moon · 2% lit** (all times UTC).
   Reject incorrect, clipped, incomplete, or inconsistent candidates.
4. After human approval, place one reviewed set under
   `.argent/flows/__baselines__/`, preserving each flow's subdirectory, and
   commit it. Do not combine competing versions from the two Node legs.
5. Replay the directory in CI twice, unchanged, with `update_baselines: false`.
   Both Node legs must be green on both runs before merge. Any baseline or
   flow edit resets that two-pass count.

Local macOS captures are typically 2560×1600 (1280×800 CSS pixels at 2×),
while CI captures are 1280×800 at 1×. Argent keys baselines by capture geometry
and crop selector, so **missing baseline** on a local snapshot is expected.
Keep local current images in `artifacts/`; do not seed or commit macOS images
as CI baselines. A local run that stops at a missing baseline has verified
only its preceding steps, not subsequent snapshots or the complete flow.

The five committed Ubuntu baselines come from
[generation run 34436943847](https://github.com/1aishwaryasharma/tinyastronomer/actions/runs/34436943847).
All five images were visually reviewed; Node 22 and Node 24 produced
byte-identical sets. Earlier candidates were rejected for blank or scaled
content, which the native-scale readiness capture workaround corrected.
Generation does not count toward the required two unchanged regression passes.

Local implementation check (2026-09-09): 163 Bun tests passed and the build
left `common.bundle.js` unchanged. All five flows without snapshots passed;
the other three reached their first snapshot with their content checks
passing and failed only for missing macOS baselines. Separate diagnostic
launches captured the two later crops; all five fresh-launch crops were
inspected. The Seasons hint originally overlapped the controls. It now has
its own centered row beneath the desktop controls; live geometry confirms
an 18-pixel gap at 1280×800. The phone and short-landscape rules are unchanged.
Reports and current images are in `artifacts/phase1-final/` locally. These
are diagnostic captures, not adopted baselines or two full passing replays.

## Keep the suite current

When a journey changes, update the matching flow in the same PR. Do not leave a red flow and do not weaken a check to get green.

- **Replay first** with `argent flow run … --platform chromium`. Unchanged YAML that still passes needs no edit.
- **Repair on failure.** Re-record the diverging step against the live site. Keep `id:` targets (`launch-*`, `*-header`, `scene-nav-btn`, `scene-next`, and the content ids in the suite table).
- **Prove Chromium twice** before merging.
- **Keep ids in the page.** `qa-selectors.test.ts` fails if a launch link, study header, Explore control, or content id a flow asserts on loses its id. Add any new id a flow selects to `requiredIds` in the same PR.
- **Prefer `assert` on settled content** over another `await visible` on static markup. A header in the HTML is visible even when the scene script has died.
- **Assert on a visible leaf, not a container.** `text.in` only matches visible elements (zero-size `sr-only` text is invisible to it), and a plain `div` wrapper such as `sky-list` reads as empty text even when its rows have content. Point at the row, heading, or paragraph that carries the words.

## Live pass when no flow fits

Observe with `describe`, act with `gesture-tap` / `keyboard`, wait with `await-ui-element`. Prefer the ids above. The 3D canvas is not a selector.

## Report

State what was verified, what failed, and what is still uncertain. A reviewer should be able to decide whether to ship from that evidence.
