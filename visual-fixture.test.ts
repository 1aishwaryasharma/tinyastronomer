import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const preload = readFileSync(new URL('./.argent/electron/preload.js', import.meta.url), 'utf8');

function page(visual: boolean) {
  const context = createContext({
    process: { argv: visual ? ['--visual-baselines'] : [] },
    document: { addEventListener() {} },
  });
  runInContext('globalThis.window = globalThis', context);
  context.require = () => ({
    contextBridge: { exposeInMainWorld() {} },
    webFrame: { executeJavaScript: (source: string) => runInContext(source, context) },
  });
  runInContext(preload, context);
  return (source: string) => runInContext(source, context);
}

test('visual clock freezes implicit dates while preserving astronomy date arithmetic', () => {
  const evaluate = page(true);
  const epoch = Date.parse('2026-09-08T12:00:00Z');
  expect(evaluate('Date.now()')).toBe(epoch);
  expect(evaluate('+new Date()')).toBe(epoch);
  expect(evaluate('Date()')).toBe(new Date(epoch).toString());
  expect(evaluate('Date(0)')).toBe(new Date(epoch).toString());
  expect(evaluate('new Date(0).toISOString()')).toBe('1970-01-01T00:00:00.000Z');
  expect(evaluate('new Date("2026-10-08T12:00:00Z").toISOString()')).toBe('2026-10-08T12:00:00.000Z');
  expect(evaluate('Date.UTC(2026, 8, 8, 12)')).toBe(epoch);
  expect(evaluate('Date.parse("2026-09-08T12:00:00Z")')).toBe(epoch);
  expect(evaluate('window.taVisualBaselines')).toBe(true);
  expect(evaluate('new Date(NaN).getTime()')).toBeNaN();
  expect(evaluate(`(() => {
    class ObservationDate extends Date {}
    const date = new ObservationDate();
    date.setUTCDate(date.getUTCDate() + 30);
    return [date instanceof Date, date instanceof ObservationDate, date.toISOString()];
  })()`)).toEqual([true, true, '2026-10-08T12:00:00.000Z']);
});

test('plain Electron shell retains the real browser clock', () => {
  const before = Date.now();
  const evaluate = page(false);
  const now = evaluate('Date.now()');
  expect(now).toBeGreaterThanOrEqual(before);
  expect(now).toBeLessThanOrEqual(Date.now());
  expect(evaluate('Date === window.Date')).toBe(true);
  expect(evaluate('window.taVisualBaselines')).toBeUndefined();
});
