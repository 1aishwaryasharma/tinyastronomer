# 001. Use fixed Chromium replays and advisory behavior review

Status: Accepted

## Context

The observatory can show its static header even when the scene script fails.
Moving canvases and platform-specific rendering also make full-page
screenshots unreliable as regression checks.

## Decision

Use [Argent Chromium replay](../../.github/workflows/argent-qa.yml) as the
pull-request regression gate. Use [agent-device](../../.agent-device/run)
for local Safari and Android Chrome coverage. The device flows use visible
labels where Safari VoiceOver omits HTML IDs. They use a recorded fling
where an untargeted scroll would reach browser chrome instead of the home deck.
On Android, relaunch Chrome before diagnosing a replay failure when a previous
session left tabs open.

Choose replays by reading the routes and assertions in the
[saved flows](../../.argent/flows). Run the full suite for shared changes
that affect navigation, routing, or the home deck. Update affected flows in
the same PR when a journey changes. Preserve the strength of each check and
require two unchanged passing Chromium replays before merging a flow or
baseline change.

Assert on visible leaf text produced by the scene script. A static header can
pass while the scene fails, and Argent can read an empty string from a wrapper
with visible child text. Restart the dev server after CSP changes. It reads
`public/_headers` at startup, so a stale policy can block changed inline scripts.

## Visual baselines

Use the [Electron fixture](../../.argent/electron/preload.js) to keep the
forecast and DOM crops stable. Hiding moving scene pixels and pausing
continuous redraws stabilizes translucent panel crops. These crops cover
the controls and panels. The saved flows assert on scene content separately.

Generate candidates with the workflow's `update_baselines` input. Inspect
both Ubuntu artifacts for complete content, correct controls and spacing,
and consistent crops. Commit one approved set. Generation does not count
toward the two regression passes. Local macOS captures can use a different
pixel ratio, which changes the baseline key. Use Ubuntu captures for the
committed set.

Electron 33 can retain Argent's quarter-scale readiness capture and corrupt
later screenshots. The [capture patch](../../.github/scripts/patch-argent-capture.cjs)
uses native scale and preserves pixel-idle checks and snapshot tolerances.
Reassess the patch on an Argent or Electron upgrade. A running Argent server
must restart to load the patch.

The [London forecast flow](../../.argent/flows/qa-sky-tonight-manual-location.yaml)
checks times and phase as text. Its old image crop failed when unrelated
layout changes moved it by a fraction of a pixel. The flow uses Next day
because native date controls have different hit targets on macOS and Ubuntu.
The fixed clock keeps the selected date within the allowed range.

## Advisory behavior review

The [behavior-review workflow](../../.github/workflows/behavior-review.yml)
asks whether the highest-risk user-visible behavior works in Electron. The
result is advisory. The saved replays provide the deterministic merge gate.

1. Infer acceptance criteria from the PR and changed paths. Use its QA or
   How to test section as the criteria when present. Choose one study and its
   highest-signal saved flow by inspecting the changed routes and flow
   assertions. Add another flow only if the criteria span both within that
   study. If the change has no runtime behavior, report that and skip device use.
2. Verify the workflow bootstrap report. Find or start the Electron device and
   await `launch-title` on the home page. Retry startup once. If startup still
   fails, report an environment failure.
3. Replay the selected flow before live checks. Record any failed step and
   its evidence. A flow failure remains a finding. Use live checks for
   acceptance criteria the replay leaves open.
4. Stay in the selected study and use at most 12 UI-changing actions.
   Observation, waits, screenshots, and saved replays are outside that count.
   Inspect live targets before tapping, use stable IDs, and stop retrying a tap
   after two failures.
5. Save three to six screenshots for a live review. Name each for the state it
   proves. Support each claim with a replay result or screenshot. If no saved
   flow covers the behavior, include a YAML draft in the structured result
   for a human to review.
6. Return `yes` if all criteria are proven and the selected replays pass.
   Return `no` for an observed product or saved-flow failure. Return
   `not on this alone` if the evidence is incomplete or the environment fails.
   Keep environment failures separate from saved-flow failures so only the
   latter trigger the workflow's diagnostic pass.
