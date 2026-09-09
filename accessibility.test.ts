import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./public/common.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+)`))![1];
  return value.startsWith('#')
    ? value.slice(1).match(/../g)!.map(v => parseInt(v, 16))
    : value.match(/[\d.]+/g)!.map(Number);
};
const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: number[], b: number[]) => {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test('actionable text remains legible with a white scene behind the panel', () => {
  const panel = token('panel');
  const brightBackdrop = panel.slice(0, 3).map(v => v * panel[3] + 255 * (1 - panel[3]));
  for (const name of ['ink', 'ink-dim', 'ink-faint', 'accent']) {
    expect(contrast(token(name), brightBackdrop)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(name), token('control-active'))).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(token('control-border'), brightBackdrop)).toBeGreaterThanOrEqual(3);
  expect(contrast(token('control-border'), token('control-active'))).toBeGreaterThanOrEqual(3);
});

test('slider tracks and the two-color focus indicator have contrasting boundaries', () => {
  expect(contrast(token('control-border'), token('bg'))).toBeGreaterThanOrEqual(3);
  expect(contrast(token('accent'), token('bg'))).toBeGreaterThanOrEqual(3);
});

test('the gold landing CTA overrides inherited link text color', () => {
  const home = readFileSync(new URL('./public/home.css', import.meta.url), 'utf8');
  expect(home).toMatch(/\.launch-deck \.observatory-cta\s*\{[^}]*color: var\(--color-accent-ink\)/);
});
