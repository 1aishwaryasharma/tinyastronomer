// Validates Claude's structured behavior-review result and renders the one
// advisory pull-request comment. Invalid or absent output becomes an explicit
// environment failure so a review never disappears silently.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

export const BEHAVIOR_REVIEW_MARKER = '<!-- behavior-review -->';

export type ShipDecision = 'yes' | 'no' | 'not on this alone';
export type FlowResult = 'pass' | 'fail' | 'environment failure';

export type EvidenceClaim = {
  claim: string;
  evidence: string;
};

export type SavedFlowResult = {
  flow: string;
  result: FlowResult;
  time: string;
  evidence: string;
};

export type BehaviorReview = {
  acceptance_criteria: string;
  ship_decision: ShipDecision;
  ship_reason: string;
  no_runtime_behavior_change: boolean;
  study: string;
  saved_flow_failed: boolean;
  saved_flows: SavedFlowResult[];
  verified: EvidenceClaim[];
  failed: EvidenceClaim[];
  uncertain: EvidenceClaim[];
  uncovered_flow_draft: string;
  environment_failure: string;
};

export type FailureDiagnosis = {
  summary: string;
  likely_cause: string;
  evidence: string;
  next_step: string;
};

export type ReviewEnvelope = {
  action_state: string;
  valid: boolean;
  saved_flow_failed: boolean;
  screenshot_count: number;
  contract_issues: string[];
  review: BehaviorReview | null;
};

export type RenderOptions = {
  sha?: string;
  runUrl?: string;
  platform?: string;
  diagnosisState?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

function parseClaims(value: unknown): EvidenceClaim[] | null {
  if (!Array.isArray(value)) return null;
  const claims: EvidenceClaim[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isString(item.claim) || !isString(item.evidence)) return null;
    const claim = item.claim.trim();
    const evidence = item.evidence.trim();
    if (!claim || !evidence) return null;
    claims.push({ claim, evidence });
  }
  return claims;
}

function parseFlows(value: unknown): SavedFlowResult[] | null {
  if (!Array.isArray(value)) return null;
  const flows: SavedFlowResult[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isString(item.flow) ||
      !isString(item.result) ||
      !['pass', 'fail', 'environment failure'].includes(item.result) ||
      !isString(item.time) ||
      !isString(item.evidence)
    ) {
      return null;
    }
    const flow = item.flow.trim();
    const time = item.time.trim();
    const evidence = item.evidence.trim();
    if (!flow || !time || !evidence) return null;
    flows.push({
      flow,
      result: item.result as FlowResult,
      time,
      evidence,
    });
  }
  return flows;
}

export function parseBehaviorReview(value: unknown): BehaviorReview | null {
  if (!isRecord(value)) return null;
  const flows = parseFlows(value.saved_flows);
  const verified = parseClaims(value.verified);
  const failed = parseClaims(value.failed);
  const uncertain = parseClaims(value.uncertain);
  if (
    !isString(value.acceptance_criteria) ||
    !isString(value.ship_decision) ||
    !['yes', 'no', 'not on this alone'].includes(value.ship_decision) ||
    !isString(value.ship_reason) ||
    typeof value.no_runtime_behavior_change !== 'boolean' ||
    !isString(value.study) ||
    typeof value.saved_flow_failed !== 'boolean' ||
    !flows ||
    !verified ||
    !failed ||
    !uncertain ||
    !isString(value.uncovered_flow_draft) ||
    !isString(value.environment_failure)
  ) {
    return null;
  }
  const acceptanceCriteria = value.acceptance_criteria.trim();
  const shipReason = value.ship_reason.trim();
  if (!acceptanceCriteria || !shipReason) return null;
  return {
    acceptance_criteria: acceptanceCriteria,
    ship_decision: value.ship_decision as ShipDecision,
    ship_reason: shipReason,
    no_runtime_behavior_change: value.no_runtime_behavior_change,
    study: value.study.trim(),
    saved_flow_failed: value.saved_flow_failed,
    saved_flows: flows,
    verified,
    failed,
    uncertain,
    uncovered_flow_draft: value.uncovered_flow_draft.trim(),
    environment_failure: value.environment_failure.trim(),
  };
}

export function parseFailureDiagnosis(value: unknown): FailureDiagnosis | null {
  if (!isRecord(value)) return null;
  if (
    !isString(value.summary) ||
    !isString(value.likely_cause) ||
    !isString(value.evidence) ||
    !isString(value.next_step)
  ) {
    return null;
  }
  return {
    summary: value.summary.trim(),
    likely_cause: value.likely_cause.trim(),
    evidence: value.evidence.trim(),
    next_step: value.next_step.trim(),
  };
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function prepareReview(
  raw: string | undefined,
  actionState: string,
  screenshotCount = 0,
): ReviewEnvelope {
  const review = parseBehaviorReview(parseJson(raw));
  const savedFlowFailed = Boolean(
    review && (review.saved_flow_failed || review.saved_flows.some((flow) => flow.result === 'fail')),
  );
  const contractIssues: string[] = [];
  if (review && !review.no_runtime_behavior_change && !review.environment_failure) {
    if (screenshotCount < 3) {
      contractIssues.push(`Only ${screenshotCount} of the required three to six screenshots were saved.`);
    } else if (screenshotCount > 6) {
      contractIssues.push(`${screenshotCount} screenshots were saved; the review limit is six.`);
    }
  }
  return {
    action_state: actionState || 'unknown',
    valid: Boolean(review),
    saved_flow_failed: savedFlowFailed,
    screenshot_count: screenshotCount,
    contract_issues: contractIssues,
    review,
  };
}

const inline = (value: string, fallback = '—') =>
  (value || fallback).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function claimLines(claims: EvidenceClaim[], fallback: string): string[] {
  if (claims.length === 0) return [`- ${fallback}`];
  return claims.map(({ claim, evidence }) => `- ${inline(claim)} (${inline(evidence, 'evidence unavailable')})`);
}

function indentedBlock(value: string): string[] {
  if (!value) return ['', 'None.'];
  return ['', ...value.split(/\r?\n/).map((line) => `    ${line}`)];
}

function invalidReviewReason(state: string): string {
  if (state === 'not-configured') return 'ANTHROPIC_API_KEY is not configured for this repository.';
  if (state === 'shell-failure') return 'The shared Argent shell or dev server did not boot successfully.';
  if (state === 'failure') return 'The behavior-review agent failed before returning a valid structured result.';
  return 'The behavior-review agent did not return a valid structured result.';
}

export function renderBehaviorReport(
  envelope: ReviewEnvelope,
  diagnosis: FailureDiagnosis | null = null,
  opts: RenderOptions = {},
): string {
  const sha = opts.sha ? opts.sha.slice(0, 7) : 'local';
  const platform = opts.platform ?? 'chromium (Electron, SwiftShader)';
  const review = envelope.review;
  const lines = [BEHAVIOR_REVIEW_MARKER, `## Behavior review · ${sha} · ${platform}`, ''];

  if (!review) {
    const reason = invalidReviewReason(envelope.action_state);
    lines.push(
      '**Acceptance criteria inferred:** unavailable',
      `**Would I ship on this evidence?** not on this alone — ${reason}`,
      '',
      '### Saved flows',
      '',
      '| Flow | Result | Time | Evidence |',
      '| --- | --- | --- | --- |',
      '| — | not run | — | — |',
      '',
      '### Verified',
      '',
      '- None.',
      '',
      '### Failed',
      '',
      '- None.',
      '',
      '### Uncertain',
      '',
      `- ${reason}`,
      '',
      '### Not covered by any saved flow',
      '',
      'None.',
    );
  } else {
    let shipDecision = review.ship_decision;
    let shipReason = review.ship_reason;
    if (review.failed.length > 0 || envelope.saved_flow_failed) {
      shipDecision = 'no';
      shipReason = 'a confirmed failure is recorded below';
    } else if ((review.environment_failure || envelope.contract_issues.length > 0) && shipDecision === 'yes') {
      shipDecision = 'not on this alone';
      shipReason = 'the review evidence is incomplete';
    }
    lines.push(
      `**Acceptance criteria inferred:** ${inline(review.acceptance_criteria, 'none stated')}`,
      `**Would I ship on this evidence?** ${shipDecision} — ${inline(shipReason, 'no reason supplied')}`,
      '',
      '### Saved flows',
      '',
      '| Flow | Result | Time | Evidence |',
      '| --- | --- | --- | --- |',
    );
    if (review.saved_flows.length === 0) {
      lines.push('| — | not run | — | — |');
    } else {
      for (const flow of review.saved_flows) {
        lines.push(
          `| ${inline(flow.flow)} | ${inline(flow.result)} | ${inline(flow.time)} | ${inline(flow.evidence)} |`,
        );
      }
    }
    const uncertain = [
      ...review.uncertain,
      ...envelope.contract_issues.map((claim) => ({ claim, evidence: 'artifact validation' })),
    ];
    if (review.environment_failure) {
      uncertain.push({ claim: review.environment_failure, evidence: 'workflow environment' });
    }
    lines.push(
      '',
      '### Verified',
      '',
      ...claimLines(review.verified, 'None.'),
      '',
      '### Failed',
      '',
      ...claimLines(review.failed, 'None.'),
      '',
      '### Uncertain',
      '',
      ...claimLines(uncertain, 'None.'),
      '',
      '### Not covered by any saved flow',
      ...indentedBlock(review.uncovered_flow_draft),
    );
  }

  if (envelope.saved_flow_failed) {
    lines.push('', '### Saved-flow failure diagnosis', '');
    if (diagnosis) {
      lines.push(
        `- **Summary:** ${inline(diagnosis.summary)}`,
        `- **Likely cause:** ${inline(diagnosis.likely_cause)}`,
        `- **Evidence:** ${inline(diagnosis.evidence)}`,
        `- **Next step:** ${inline(diagnosis.next_step)}`,
      );
    } else {
      const state = opts.diagnosisState || 'missing';
      lines.push(`- Opus escalation ${inline(state)}; no structured diagnosis was available.`);
    }
  }

  if (opts.runUrl) {
    lines.push('', `Screenshots and structured results are in the [behavior-review workflow run](${opts.runUrl}).`);
  }
  lines.push('');
  return lines.join('\n');
}

type CliArgs = Record<string, string>;

function parseArgs(argv: string[]): { command: string; args: CliArgs } {
  const [command = '', ...rest] = argv;
  const args: CliArgs = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = rest[++index] ?? '';
  }
  return { command, args };
}

if (import.meta.main) {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'prepare') {
    const raw = process.env[args['json-env'] || 'REVIEW_JSON'];
    let screenshotCount = 0;
    if (args.screenshots) {
      try {
        screenshotCount = readdirSync(args.screenshots).filter((name) => name.endsWith('.png')).length;
      } catch {
        screenshotCount = 0;
      }
    }
    const envelope = prepareReview(raw, args.state || 'unknown', screenshotCount);
    const output = args.output;
    if (!output) throw new Error('prepare requires --output');
    writeFileSync(output, `${JSON.stringify(envelope, null, 2)}\n`);
    if (args['github-output']) {
      writeFileSync(
        args['github-output'],
        `saved_flow_failed=${envelope.saved_flow_failed}\nvalid=${envelope.valid}\n`,
        { flag: 'a' },
      );
    }
  } else if (command === 'render') {
    const envelopePath = args.envelope;
    if (!envelopePath) throw new Error('render requires --envelope');
    const envelope = JSON.parse(readFileSync(envelopePath, 'utf8')) as ReviewEnvelope;
    const diagnosisRaw = process.env[args['diagnosis-env'] || 'DIAGNOSIS_JSON'];
    const diagnosis = parseFailureDiagnosis(parseJson(diagnosisRaw));
    process.stdout.write(
      renderBehaviorReport(envelope, diagnosis, {
        sha: args.sha,
        runUrl: args['run-url'],
        platform: args.platform,
        diagnosisState: args['diagnosis-state'],
      }),
    );
  } else {
    console.error(
      'usage: bun tools/behavior-review-report.ts prepare|render [options]',
    );
    process.exit(2);
  }
}
