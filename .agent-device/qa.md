# agent-device (local)

agent-device is the local device layer. Use it on a booted iOS Simulator (Safari) or Android emulator (Chrome). Pull requests do not run these flows; CI is Argent Chromium (`.argent/qa.md`).

## Setup

1. `bun dev-server.ts` so `http://127.0.0.1:8765/` matches production routing.
2. Boot a Simulator or emulator first. These scripts do not boot devices.
3. Android Chrome reaches the host at `http://10.0.2.2:8765/`.

## Commands

```sh
.agent-device/run ios
.agent-device/run ios qa-home-open-seasons
.agent-device/run android
.agent-device/run android qa-home-open-light-study
```

Those wrap `agent-device test` against `.agent-device/flows/ios` or `.agent-device/flows/android`. Extra flags pass through (`--device 'Pixel Fold API 36'`).

## Suite

| Flow | Journey | iOS Safari | Android Chrome |
| --- | --- | --- | --- |
| `qa-home-open-light-study` | Home deck opens Light Study | yes | yes |
| `qa-home-open-seasons` | Home deck opens Seasons | yes | yes |
| `qa-home-open-grand-tour` | Home deck opens Grand Tour | yes | — |
| `qa-home-open-scale-walk` | Home deck opens Scale Walk | yes | — |
| `qa-home-open-missions` | Home deck opens Missions | yes | yes |
| `qa-home-open-sky-tonight` | Home deck opens Sky Tonight | yes | — |
| `qa-explore-next-stop` | Light Study Explore menu goes to Seasons | yes | yes |

Safari VoiceOver does not expose HTML ids, so iOS scripts wait on visible labels. Android Chrome does expose ids, so those scripts use `launch-*` and `*-header`. Scripts do not pin a simulator name; pass `--device` to `.agent-device/run` when more than one device is booted.

Below-fold home links still use a recorded fling. agent-device `scroll` has no target selector, and an untargeted scroll hits Safari/Chrome chrome instead of `#launch-deck`. Do not replace that fling with `scroll down` until the harness can scroll to a label or id.

Android replay can flake when Chrome still has leftover tabs or the snapshot helper still owns the emulator; relaunch Chrome and retry before treating that as a product failure.

If the change is one study, run that study's flow. If it is chrome, routing, or the home deck, run the iOS suite.

## Live pass when no flow fits

Observe with `snapshot -i`, act with `press` / `gesture`, wait with `wait text` or `wait 'id="…"`. The 3D canvas is not a selector.

## Report

State what was verified, what failed, and what is still uncertain.
