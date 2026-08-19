# Behavior review

Argent is the device layer for pull-request QA. Cursor is the agent. Saved flows in `.argent/flows/` are the repeatable verdicts.

## When this applies

A pull request, a running-site check, or a request to verify a user flow. Infer acceptance criteria from the change. Verify only the highest-signal journey. Treat the site as a black box.

## Setup

1. `bun dev-server.ts` so `http://127.0.0.1:8765/` matches production routing.
2. Drive the Electron shell with Argent (`boot-device` + `electronAppPath` `.argent/electron`, or `argent flow run`).
3. Confirm the window is this site: `launch-title` on the home deck, or the study header id on an inner page.

## Prefer a saved flow

| Flow | Journey |
| --- | --- |
| `qa-home-open-light-study` | Home deck opens Light Study in place |
| `qa-home-open-seasons` | Home deck opens Seasons |
| `qa-home-open-grand-tour` | Home deck opens Grand Tour |
| `qa-home-open-scale-walk` | Home deck opens Scale Walk |
| `qa-home-open-missions` | Home deck opens Missions |
| `qa-home-open-sky-tonight` | Home deck opens Sky Tonight |
| `qa-explore-next-stop` | Light Study Explore menu goes to Seasons |

Replay without a model:

```sh
argent flow run qa-home-open-seasons --platform chromium
```

If the PR touches one study, run that study's flow. If it touches chrome, routing, or the home deck, run all of them.

## Live pass when no flow fits

Observe with `describe`, act with `gesture-tap` / `keyboard`, wait with `await-ui-element`, keep a few screenshots as human evidence. Prefer ids (`launch-*`, `*-header`, `scene-nav-btn`, `scene-next`) over pixels. The 3D canvas is not a selector.

## Report

State what was verified, what failed, and what is still uncertain. A reviewer should be able to decide whether to ship from that evidence.
