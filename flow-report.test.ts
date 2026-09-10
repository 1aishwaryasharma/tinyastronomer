import { expect, test } from 'bun:test';
import { MARKER, describeResult, normalize, renderReport } from './tools/flow-report.ts';

const passing = {
  flow: 'qa-home-open-seasons',
  device: 'chromium-cdp-1',
  executionPrerequisite: '',
  ok: true,
  passed: 8,
  failed: 0,
  skipped: 0,
  errored: 0,
  steps: [
    { index: 0, kind: 'run', status: 'pass', flow: 'boot-electron', target: '../fragments/boot-electron.yaml' },
    { index: 1, kind: 'tap', status: 'pass', flow: 'qa-home-open-seasons', target: 'id=launch-seasons' },
    {
      index: 2,
      kind: 'idle',
      status: 'pass',
      flow: 'qa-home-open-seasons',
      warning: 'the screen settled, but a small part of it was still changing while it did',
    },
  ],
};

const failing = {
  flow: 'qa-explore-next-stop',
  device: 'chromium-cdp-1',
  executionPrerequisite: '',
  ok: false,
  passed: 7,
  failed: 1,
  skipped: 2,
  errored: 0,
  steps: [
    { index: 0, kind: 'run', status: 'pass', flow: 'boot-electron', target: '../fragments/boot-electron.yaml' },
    {
      index: 10,
      kind: 'tap',
      status: 'fail',
      flow: 'qa-explore-next-stop',
      target: 'id=scene-nav-btn',
      reason: 'no visible element matched selector id="scene-nav-btn"',
    },
    { index: 11, kind: 'await', status: 'skip', flow: 'qa-explore-next-stop', target: 'visible id=scene-menu' },
    { index: 12, kind: 'idle', status: 'skip', flow: 'qa-explore-next-stop' },
  ],
};

const batch = {
  ok: false,
  total: 2,
  passed: 1,
  failed: 1,
  skipped: 0,
  flows: [
    { path: 'qa-explore-next-stop.yaml', status: 'fail', report: failing },
    { path: 'qa-home-open-seasons.yaml', status: 'pass', report: passing },
  ],
};

test('a batch report renders the marker, the verdict, and one row per flow', () => {
  const md = renderReport(batch, { sha: '0123456789abcdef', runUrl: 'https://example.test/run/1' });
  const lines = md.split('\n');
  expect(lines[0]).toBe(MARKER);
  expect(lines[1]).toBe('## Argent QA · 0123456 · chromium (Electron, SwiftShader)');
  expect(md).toContain('**Result:** 1 of 2 flows passed (1 failed)');
  expect(md).toContain('| qa-home-open-seasons | pass | 8/3 | — |');
  expect(md).toContain(
    '| qa-explore-next-stop | fail at step 10 (tap id=scene-nav-btn) — no visible element matched selector id="scene-nav-btn" | 7/4 | — |',
  );
  expect(md).toContain('Readiness warnings (1)');
  expect(md).toContain('[workflow run](https://example.test/run/1)');
});

test('a single-flow report is normalized to a one-row batch', () => {
  const single = normalize(passing);
  expect(single?.total).toBe(1);
  expect(single?.ok).toBe(true);
  expect(single?.flows[0].path).toBe('qa-home-open-seasons.yaml');
  expect(describeResult(single!.flows[0])).toBe('pass');
});

test('a missing or unparsable report still produces a comment body', () => {
  expect(normalize(null)).toBeNull();
  expect(normalize({ unexpected: true })).toBeNull();
  const md = renderReport(null, { runUrl: 'https://example.test/run/2' });
  expect(md.split('\n')[0]).toBe(MARKER);
  expect(md).toContain('no flow report was produced');
  expect(md).toContain('https://example.test/run/2');
});

test('pipes in a failure reason do not break the table', () => {
  const entry = {
    path: 'x.yaml',
    status: 'fail',
    report: { ...failing, steps: [{ index: 3, kind: 'assert', status: 'fail', reason: 'wanted a | b' }] },
  };
  const md = renderReport({ ...batch, flows: [entry] });
  expect(md).toContain('wanted a \\| b');
});
