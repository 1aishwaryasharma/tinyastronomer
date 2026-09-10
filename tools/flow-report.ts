// Renders `argent flow run --json` output as the Markdown that argent-qa.yml
// posts on a pull request and writes to the job summary.
//
//   bun tools/flow-report.ts artifacts/flows.json \
//     --sha "$HEAD_SHA" --run-url "$RUN_URL" --artifacts artifacts
//
// Accepts the batch shape (a directory run) and the single-flow shape. It
// never exits non-zero for a failing flow; the workflow decides that from the
// CLI exit code. An empty or unparsable file still produces a report that
// says so, so the PR comment is never silently missing.

import { existsSync, readFileSync } from 'node:fs';

export const MARKER = '<!-- argent-qa -->';

export type StepReport = {
  index: number;
  kind: string;
  status: string;
  flow?: string;
  target?: string;
  reason?: string;
  warning?: string;
  message?: string;
};

export type FlowReport = {
  flow: string;
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  steps: StepReport[];
};

export type BatchEntry = { path: string; status: string; report?: FlowReport };

export type BatchReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flows: BatchEntry[];
};

export type ReportOptions = {
  sha?: string;
  runUrl?: string;
  artifactsDir?: string;
  platform?: string;
};

const WARNING_LIMIT = 160;

export function normalize(raw: unknown): BatchReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (Array.isArray(value.flows)) return value as unknown as BatchReport;
  if (Array.isArray(value.steps) && typeof value.flow === 'string') {
    const report = value as unknown as FlowReport;
    return {
      ok: report.ok,
      total: 1,
      passed: report.ok ? 1 : 0,
      failed: report.ok ? 0 : 1,
      skipped: 0,
      flows: [{ path: `${report.flow}.yaml`, status: report.ok ? 'pass' : 'fail', report }],
    };
  }
  return null;
}

export function flowName(entry: BatchEntry): string {
  if (entry.report?.flow) return entry.report.flow;
  const base = entry.path.split('/').pop() ?? entry.path;
  return base.replace(/\.ya?ml$/, '');
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function describeResult(entry: BatchEntry): string {
  const report = entry.report;
  if (!report) return entry.status;
  if (report.ok) return 'pass';
  const step = report.steps.find((s) => s.status === 'fail' || s.status === 'error');
  if (!step) return entry.status;
  const what = [step.kind, step.target].filter(Boolean).join(' ');
  const reason = step.reason ? ` — ${step.reason}` : '';
  return `${step.status} at step ${step.index} (${what})${reason}`;
}

export function stepCount(entry: BatchEntry): string {
  const report = entry.report;
  if (!report) return '—';
  return `${report.passed}/${report.steps.length}`;
}

export function renderReport(batch: BatchReport | null, opts: ReportOptions = {}): string {
  const lines: string[] = [MARKER];
  const sha = opts.sha ? opts.sha.slice(0, 7) : 'local';
  const platform = opts.platform ?? 'chromium (Electron, SwiftShader)';
  lines.push(`## Argent QA · ${sha} · ${platform}`, '');

  if (!batch) {
    lines.push(
      '**Result:** no flow report was produced. The run stopped before Argent wrote its JSON; open the workflow log.',
      '',
    );
    if (opts.runUrl) lines.push(`[Workflow run](${opts.runUrl})`, '');
    return lines.join('\n');
  }

  const verdict = batch.ok ? 'all passed' : `${batch.failed} failed`;
  lines.push(`**Result:** ${batch.passed} of ${batch.total} flows passed (${verdict})`, '');
  lines.push('### Saved flows', '', '| Flow | Result | Steps | Evidence |', '| --- | --- | --- | --- |');
  for (const entry of batch.flows) {
    const name = flowName(entry);
    const dir = opts.artifactsDir ? `${opts.artifactsDir}/${name}` : null;
    const evidence = dir && existsSync(dir) ? `${dir}/` : '—';
    lines.push(`| ${name} | ${cell(describeResult(entry))} | ${stepCount(entry)} | ${evidence} |`);
  }

  const warnings = batch.flows.flatMap((entry) =>
    (entry.report?.steps ?? [])
      .filter((s) => s.warning)
      .map((s) => {
        const text = s.warning ?? '';
        const short = text.length > WARNING_LIMIT ? `${text.slice(0, WARNING_LIMIT)}…` : text;
        return `- ${flowName(entry)} step ${s.index} (${s.kind}): ${short}`;
      }),
  );
  if (warnings.length > 0) {
    lines.push('', `<details><summary>Readiness warnings (${warnings.length})</summary>`, '', ...warnings, '', '</details>');
  }

  lines.push('');
  if (opts.runUrl) {
    lines.push(`Artifacts (\`flows.json\`, failed snapshots) are on the [workflow run](${opts.runUrl}).`, '');
  }
  return lines.join('\n');
}

function parseArgs(argv: string[]): { file: string } & ReportOptions {
  const out: { file: string } & ReportOptions = { file: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sha') out.sha = argv[++i];
    else if (arg === '--run-url') out.runUrl = argv[++i];
    else if (arg === '--artifacts') out.artifactsDir = argv[++i];
    else if (arg === '--platform') out.platform = argv[++i];
    else if (!out.file) out.file = arg;
  }
  if (!out.file) {
    console.error('usage: bun tools/flow-report.ts <flows.json> [--sha SHA] [--run-url URL] [--artifacts DIR]');
    process.exit(2);
  }
  return out;
}

if (import.meta.main) {
  const { file, ...opts } = parseArgs(process.argv.slice(2));
  let batch: BatchReport | null = null;
  try {
    batch = normalize(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    batch = null;
  }
  process.stdout.write(renderReport(batch, opts));
}
