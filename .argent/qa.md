# Argent (CI)

Argent flows in `.argent/flows/` are the pull-request regression suite. GitHub replays them in Electron on Ubuntu (`.github/workflows/argent-qa.yml`). That is the merge gate.

Local simulator and emulator QA is agent-device, not Argent. See `.agent-device/qa.md`.

## Setup

1. `bun dev-server.ts` so `http://127.0.0.1:8765/` matches production routing.
2. Drive the Electron shell (`argent flow run … --platform chromium`). Vendoring it (`npm ci` in `.argent/electron`) and installing Argent need Node 22 or 24; CI runs the suite on both.

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
