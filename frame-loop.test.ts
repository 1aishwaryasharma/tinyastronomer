import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

function harness(options = {}, visualBaselines = false) {
  const pending = new Map<number, FrameRequestCallback>();
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = new EventTarget();
  let id = 0;
  let intersection: (entries: { isIntersecting: boolean }[]) => void;
  const frames: { now: number; dt: number }[] = [];
  const source = readFileSync(new URL('./public/frame-loop.js', import.meta.url), 'utf8');
  const create = new Function('document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver', 'globalThis',
    source.replace('export function', 'function') + '; return createFrameLoop;')(
    document, window,
    (fn: FrameRequestCallback) => { pending.set(++id, fn); return id; },
    (key: number) => pending.delete(key),
    class { constructor(fn: typeof intersection) { intersection = fn; } observe() {} disconnect() {} },
    { taVisualBaselines: visualBaselines },
  );
  const loop = create((now: number, dt: number) => frames.push({ now, dt }), options);
  return {
    document, window, frames, pending, loop,
    visibility(visible: boolean) { intersection([{ isIntersecting: visible }]); },
    tick(now: number) { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); },
  };
}

test('visual baseline canvases draw once and retain explicit invalidation', () => {
  const h = harness({}, true);
  h.tick(0);
  expect(h.frames.length).toBe(1);
  expect(h.pending.size).toBe(0);
  h.loop.invalidate();
  h.tick(10);
  expect(h.frames.length).toBe(2);
  expect(h.pending.size).toBe(0);
});

test('decorative canvas draws 30 times rather than 120 per second', () => {
  const h = harness({ fps: 30 });
  for (let i = 0; i < 120; i++) h.tick(i * 1000 / 120);
  expect(h.frames.length).toBe(30);
  h.loop.dispose();
  expect(h.pending.size).toBe(0);
});

test('60 fps cap preserves elapsed simulation time on a 144 Hz display', () => {
  const h = harness();
  for (let i = 0; i < 144; i++) h.tick(i * 1000 / 144);
  expect(h.frames.length).toBe(60);
  const elapsed = h.frames.reduce((sum, frame) => sum + frame.dt, 0);
  expect(elapsed).toBeCloseTo(h.frames.at(-1)!.now / 1000, 8);
});

test('hidden tabs and offscreen canvases stop scheduling and resume without a time jump', () => {
  const h = harness({ element: {} });
  h.tick(0);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event('visibilitychange'));
  expect(h.pending.size).toBe(0);
  h.document.hidden = false;
  h.document.dispatchEvent(new Event('visibilitychange'));
  h.tick(60_000);
  expect(h.frames.at(-1)!.dt).toBe(0);
  h.visibility(false);
  expect(h.pending.size).toBe(0);
  h.loop.invalidate();
  expect(h.pending.size).toBe(0);
  h.visibility(true);
  h.tick(120_000);
  expect(h.frames.at(-1)!.dt).toBe(0);
});

test('static canvases draw once and redraw on edits and resize without an idle loop', () => {
  const h = harness({ animated: false });
  h.tick(0);
  expect(h.frames.length).toBe(1);
  expect(h.pending.size).toBe(0);
  h.loop.invalidate(); h.loop.invalidate();
  expect(h.pending.size).toBe(1);
  h.tick(10);
  expect(h.frames.length).toBe(2);
  h.window.dispatchEvent(new Event('resize'));
  h.tick(20);
  expect(h.frames.length).toBe(3);
  h.loop.dispose();
  h.loop.invalidate();
  h.window.dispatchEvent(new Event('resize'));
  expect(h.pending.size).toBe(0);
});
