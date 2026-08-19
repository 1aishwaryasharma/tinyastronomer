# Argent (CI)

Argent flows in `.argent/flows/` are the pull-request regression suite. GitHub replays them in Electron on Ubuntu. That is the merge gate.

Local simulator and emulator QA is agent-device, not Argent. See `.agent-device/qa.md`.

## Setup

1. `bun dev-server.ts` so `http://127.0.0.1:8765/` matches production routing.
2. Drive the Electron shell (`argent flow run … --platform chromium`).

## Suite

| Flow | Journey |
| --- | --- |
| `qa-home-open-light-study` | Home deck opens Light Study in place |
| `qa-home-open-seasons` | Home deck opens Seasons |
| `qa-home-open-grand-tour` | Home deck opens Grand Tour |
| `qa-home-open-scale-walk` | Home deck opens Scale Walk |
| `qa-home-open-missions` | Home deck opens Missions |
| `qa-home-open-sky-tonight` | Home deck opens Sky Tonight |
| `qa-explore-next-stop` | Light Study Explore menu goes to Seasons |

```sh
bun dev-server.ts
argent flow run qa-home-open-seasons --platform chromium
argent flow run .argent/flows --platform chromium
```

Home-open flows `run:` `.argent/fragments/boot-electron.yaml` so the Electron launch lives in one place. If the PR touches one study, run that study's flow. If it touches chrome, routing, or the home deck, run the directory.

## Keep the suite current

When a journey changes, update the matching flow in the same PR. Do not leave a red flow and do not weaken a check to get green.

- **Replay first** with `argent flow run … --platform chromium`. Unchanged YAML that still passes needs no edit.
- **Repair on failure.** Re-record the diverging step against the live site. Keep `id:` targets (`launch-*`, `*-header`, `scene-nav-btn`, `scene-next`).
- **Prove Chromium twice** before merging.
- **Keep ids in the page.** `qa-selectors.test.ts` fails if a launch link, study header, or Explore control loses its id.

## Live pass when no flow fits

Observe with `describe`, act with `gesture-tap` / `keyboard`, wait with `await-ui-element`. Prefer the ids above. The 3D canvas is not a selector.

## Report

State what was verified, what failed, and what is still uncertain. A reviewer should be able to decide whether to ship from that evidence.
