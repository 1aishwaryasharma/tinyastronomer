import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('./public', import.meta.url)));

const pages = readdirSync('.').filter((file) => file.endsWith('.html'));

const requiredIds: Record<string, string[]> = {
  'index.html': [
    'launch-grand-tour',
    'launch-light-study',
    'launch-missions',
    'launch-scale-walk',
    'launch-seasons',
    'launch-sky-tonight',
    'launch-title',
    'light-study-header',
    'play-btn',
  ],
  'missions.html': ['missions-header'],
  'scale-walk.html': ['scale-walk-header'],
  'seasons.html': ['seasons-header'],
  'sky-tonight.html': ['sky-tonight-header'],
  'solar-system.html': ['grand-tour-header'],
};

test('every observatory path keeps its QA ids', () => {
  expect(
    [...pages].sort(),
    'requiredIds must name every HTML page',
  ).toEqual(Object.keys(requiredIds).sort());
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const id of requiredIds[file]) {
      expect(ids, `${file} is missing ${id}`).toContain(id);
    }
  }
  const chrome = readFileSync('chrome.js', 'utf8');
  expect(chrome).toContain("btn.id = 'scene-nav-btn'");
  expect(chrome).toContain("a.id = 'scene-link-' + s.key");
  expect(chrome).toContain("nextLink.id = 'scene-next'");
});

test('SPACE does not special-case the Electron QA shell by user-agent', () => {
  const common = readFileSync('common.js', 'utf8');
  expect(common).not.toMatch(/Electron/i);
});

test('Light Study opens from the #light-study hash', () => {
  const launchJs = readFileSync('home-launch.js', 'utf8');
  expect(launchJs).toContain('function showLightStudy()');
  expect(launchJs).toContain("addEventListener('hashchange'");
});
