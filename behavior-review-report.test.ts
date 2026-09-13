import { expect, test } from 'bun:test';
import {
  BEHAVIOR_REVIEW_MARKER,
  parseBehaviorReview,
  parseFailureDiagnosis,
  prepareReview,
  renderBehaviorReport,
} from './tools/behavior-review-report.ts';

const passingReview = {
  acceptance_criteria: 'Selecting June updates the Seasons explanation.',
  ship_decision: 'yes',
  ship_reason: 'the mapped flow and live state agree',
  no_runtime_behavior_change: false,
  study: 'Seasons',
  saved_flow_failed: false,
  saved_flows: [
    { flow: 'qa-home-open-seasons', result: 'pass', time: '14 s', evidence: 'flow result' },
  ],
  verified: [
    {
      claim: 'June selection updates the explanation',
      evidence: 'seasons-june-selected.png',
    },
  ],
  failed: [],
  uncertain: [],
  uncovered_flow_draft: '',
  environment_failure: '',
};

test('valid structured output renders the fixed report with evidence', () => {
  const envelope = prepareReview(JSON.stringify(passingReview), 'success', 3);
  const report = renderBehaviorReport(envelope, null, {
    sha: '0123456789abcdef',
    runUrl: 'https://example.test/run/7',
  });
  expect(report.split('\n')[0]).toBe(BEHAVIOR_REVIEW_MARKER);
  expect(report).toContain('## Behavior review · 0123456 · chromium (Electron, SwiftShader)');
  expect(report).toContain('| qa-home-open-seasons | pass | 14 s | flow result |');
  expect(report).toContain('- June selection updates the explanation (seasons-june-selected.png)');
  expect(report).toContain('[behavior-review workflow run](https://example.test/run/7)');
  expect(envelope.contract_issues).toEqual([]);
});

test('missing or malformed output becomes a visible advisory environment failure', () => {
  const missing = prepareReview('', 'not-configured');
  expect(missing.valid).toBe(false);
  expect(renderBehaviorReport(missing)).toContain('ANTHROPIC_API_KEY is not configured');

  const malformed = prepareReview('{nope', 'failure');
  expect(malformed.valid).toBe(false);
  expect(renderBehaviorReport(malformed)).toContain('failed before returning a valid structured result');
});

test('a non-runtime review needs no screenshots or device evidence', () => {
  const review = {
    ...passingReview,
    acceptance_criteria: 'No runtime behavior changed.',
    ship_reason: 'only QA infrastructure changed',
    no_runtime_behavior_change: true,
    study: 'none',
    saved_flows: [],
    verified: [],
  };
  const envelope = prepareReview(JSON.stringify(review), 'success', 0);
  expect(envelope.contract_issues).toEqual([]);
  expect(renderBehaviorReport(envelope)).toContain(
    '**Would I ship on this evidence?** yes — only QA infrastructure changed',
  );
});

test('a failing flow forces escalation even if the model flag is false', () => {
  const review = {
    ...passingReview,
    saved_flow_failed: false,
    saved_flows: [
      {
        flow: 'qa-home-open-seasons',
        result: 'fail',
        time: '9 s',
        evidence: 'failed step 4',
      },
    ],
  };
  const envelope = prepareReview(JSON.stringify(review), 'success', 3);
  expect(envelope.saved_flow_failed).toBe(true);

  const diagnosis = parseFailureDiagnosis({
    summary: 'The selected stop did not render.',
    likely_cause: 'The changed selector no longer matches.',
    evidence: 'flow result step 4',
    next_step: 'Restore the stable id.',
  });
  const report = renderBehaviorReport(envelope, diagnosis);
  expect(report).toContain('### Saved-flow failure diagnosis');
  expect(report).toContain('**Would I ship on this evidence?** no — a confirmed failure is recorded below');
  expect(report).toContain('**Likely cause:** The changed selector no longer matches.');
});

test('invalid fields and table pipes are handled safely', () => {
  expect(parseBehaviorReview({ ...passingReview, ship_decision: 'maybe' })).toBeNull();
  const envelope = prepareReview(
    JSON.stringify({
      ...passingReview,
      saved_flows: [{ flow: 'flow|name', result: 'pass', time: '1 s', evidence: 'a|b' }],
    }),
    'success',
    3,
  );
  const report = renderBehaviorReport(envelope);
  expect(report).toContain('| flow\\|name | pass | 1 s | a\\|b |');
});

test('a live review with too few screenshots is reported as uncertain', () => {
  const envelope = prepareReview(JSON.stringify(passingReview), 'success', 2);
  expect(envelope.contract_issues).toEqual([
    'Only 2 of the required three to six screenshots were saved.',
  ]);
  expect(renderBehaviorReport(envelope)).toContain(
    '- Only 2 of the required three to six screenshots were saved. (artifact validation)',
  );
  expect(renderBehaviorReport(envelope)).toContain(
    '**Would I ship on this evidence?** not on this alone — the review evidence is incomplete',
  );
});
