import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { layoutSkyLabels } from './public/sky-labels.js';

const html = readFileSync(new URL('./public/sky-tonight.html', import.meta.url), 'utf8');
const renderer = html.slice(html.indexOf('function horizonX('), html.indexOf('const listEl ='));

function rgba(color: string) {
  if (color.startsWith('#')) return [...[1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)), 1];
  const values = color.match(/[\d.]+/g)!.map(Number);
  return values.length === 3 ? [...values, 1] : values;
}

function scene(altitude: number, width = 402, bodies = []) {
  // Sample the background's 70% stop, away from stars, labels, and Sun glow.
  // Track premultiplied RGB to exercise source-over accumulation across frames.
  let pixel = [0, 0, 0];
  let glowAlpha = 0;
  const labels: { name: string; x: number; y: number }[] = [];
  function gradient(kind: string) {
    return { kind, stops: new Map<number, string>(), addColorStop(at: number, color: string) { this.stops.set(at, color); } };
  }
  const ctx = new Proxy({
    fillStyle: gradient('background'),
    createLinearGradient: () => gradient('background'),
    createRadialGradient: () => gradient('glow'),
    clearRect() { pixel = [0, 0, 0]; },
    fillRect() {
      const paint = this.fillStyle;
      if (paint.kind === 'background') {
        const color = rgba(paint.stops.get(0.7)!);
        pixel = pixel.map((value, i) => color[i] * color[3] + value * (1 - color[3]));
      } else if (paint.kind === 'glow') glowAlpha = rgba(paint.stops.get(0)!)[3];
    },
    measureText: () => ({ width: 60 }),
    fillText(name: string, x: number, y: number) { labels.push({ name, x, y }); },
  }, { get: (target, key) => key in target ? Reflect.get(target, key) : () => {} });
  const draw = runInNewContext(renderer + '; drawHorizon', {
    ctx, width, height: 714, HORIZON_GUTTER: 56, layoutSkyLabels,
    currentHorizonPositions: [{ key: 'sun', name: 'Sun', dot: '#f4c560', azimuth: 280, altitude }, ...bodies],
    stars: [], highlightedBody: null,
    clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    SPACE: { prefersReducedMotion: true, sceneInsets: { bottom: 600 } },
  });
  return { frame() { glowAlpha = 0; labels.length = 0; draw(0); return { pixel: [...pixel], glowAlpha, labels: [...labels] }; } };
}

test('twilight background remains identical after repeated frames', () => {
  const sky = scene(-17.609425640618596); // Chicago, Sep 17 2026, 8:31 pm.
  const first = sky.frame();
  for (let i = 0; i < 60; i++) expect(sky.frame().pixel).toEqual(first.pixel);
});

test('only mobile omits below-horizon objects and repositions visible names', () => {
  const bodies = [
    { key: 'moon', name: 'Moon', dot: '#fff', azimuth: 90, altitude: 20 },
    { key: 'saturn', name: 'Saturn', dot: '#fff', azimuth: 100, altitude: -5 },
  ];
  const mobile = scene(-20, 402, bodies).frame().labels;
  expect(mobile.some(label => label.name === 'Moon')).toBe(true);
  expect(mobile.some(label => label.name.includes('Saturn'))).toBe(false);
  const desktop = scene(-20, 1280, bodies).frame().labels;
  expect(desktop.some(label => label.name === 'Saturn · below')).toBe(true);
  const moon = desktop.find(label => label.name === 'Moon')!;
  expect(moon.x).toBeCloseTo(51.2 + 90 / 360 * (1280 - 102.4) + 9);
  expect(moon.y).toBeCloseTo(544 - 20 / 90 * (544 - 714 * 0.14) - 7);
});

test('twilight background and Sun glow fade continuously into night', () => {
  const night = scene(-18.001).frame();
  const almostNight = scene(-17.999).frame();
  for (let i = 0; i < 3; i++) expect(Math.abs(almostNight.pixel[i] - night.pixel[i])).toBeLessThan(0.1);
  expect(almostNight.glowAlpha).toBeLessThan(0.001);
  expect(night.glowAlpha).toBe(0);
  const sunset = scene(0).frame();
  expect(sunset.glowAlpha).toBeGreaterThan(0.5);
  expect(sunset.pixel.every((value, i) => value > night.pixel[i])).toBe(true);
});
