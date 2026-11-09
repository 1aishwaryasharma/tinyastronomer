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

// Item 7 of the Nov 2026 UX review: the small grey labels. Measured, the
// tokens clear 4.5:1 on the space background by a wide margin (the dimmest,
// --control-border, is 5.9:1); the real problem was size, so mono labels now
// have a floor.
const oklchToRgb = (L: number, C: number, h: number) => {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(v => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255));
};
const homeToken = (name: string) => {
  const tokens = readFileSync(new URL('./public/tokens.css', import.meta.url), 'utf8');
  const value = tokens.match(new RegExp(`--${name}:\\s*([^;]+)`))![1];
  if (value.startsWith('#')) return value.slice(1).match(/../g)!.map(v => parseInt(v, 16));
  const [L, C, h] = value.match(/[\d.]+/g)!.map(Number);
  return oklchToRgb(L / 100, C, h);
};

test('every text token on the space background clears WCAG AA for body text', () => {
  const bg = token('bg');
  for (const name of ['ink', 'ink-dim', 'ink-faint', 'accent', 'accent-warm', 'accent-cool']) {
    expect(contrast(token(name), bg), name).toBeGreaterThanOrEqual(4.5);
  }
  for (const name of ['color-ink', 'color-ink-2', 'color-muted', 'color-accent']) {
    expect(contrast(homeToken(name), homeToken('color-space')), name).toBeGreaterThanOrEqual(4.5);
  }
});

test('mono labels are at least 10px, body-size labels 11px, and the home small text 12px', () => {
  expect(css).not.toMatch(/font-size:\s*[89]px/);
  const tokens = readFileSync(new URL('./public/tokens.css', import.meta.url), 'utf8');
  expect(parseFloat(tokens.match(/--text-xs:\s*([\d.]+)rem/)![1])).toBeGreaterThanOrEqual(0.75);
  for (const selector of ['.info-label', '.fact-key', '.hint', '.speed-label', '.header-meta', '.rail-btn .num']) {
    const block = css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}'))![0];
    expect(block, selector).toMatch(/font-size:\s*1[1-9]px/);
  }
});
