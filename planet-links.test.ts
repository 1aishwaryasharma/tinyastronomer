import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (name: string) => readFileSync(new URL(`./public/${name}`, import.meta.url), 'utf8');

// Lift the URL helpers out of the Grand Tour script and run them against a
// fake window, so the acceptance cases run without a browser.
function tourUrlHelpers(href: string) {
  const html = read('solar-system.html');
  const start = html.indexOf('const BASE_TITLE = document.title;');
  const end = html.indexOf("window.addEventListener('popstate'", start);
  const source = html.slice(start, end);
  const calls: { mode: string; url: string }[] = [];
  const location = new URL(href);
  const window = {
    location,
    history: {
      pushState: (_s: unknown, _t: string, url: string) => { calls.push({ mode: 'push', url }); location.href = new URL(url, href).href; },
      replaceState: (_s: unknown, _t: string, url: string) => { calls.push({ mode: 'replace', url }); location.href = new URL(url, href).href; },
    },
  };
  const document = { title: 'Solar System for Kids: The 8 Planets in 3D | tinyastronomer' };
  const bodies: Record<string, string> = { sun: 'The Sun', mars: 'Mars', saturn: 'Saturn', comet: 'Halley-like Comet' };
  const api = new Function('window', 'document', 'infoByKey', 'nameOf',
    source + ';return { bodyKeyFromUrl, urlForBody, syncHistory, syncTitle };')(
    window, document, (key: string) => (bodies[key] ? { name: bodies[key] } : undefined), (key: string) => bodies[key]);
  return { ...api, calls, location, document };
}

test('a fresh tab at ?planet=saturn selects Saturn; unknown values fall back to the overview', () => {
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system?planet=saturn').bodyKeyFromUrl()).toBe('saturn');
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system?planet=Saturn').bodyKeyFromUrl()).toBe('saturn');
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system#mars').bodyKeyFromUrl()).toBe('mars');
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system?planet=saturn#mars').bodyKeyFromUrl()).toBe('mars');
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system?planet=foo').bodyKeyFromUrl()).toBeNull();
  expect(tourUrlHelpers('https://tinyastronomer.com/solar-system').bodyKeyFromUrl()).toBeNull();
});

test('selecting a body writes ?planet=; the overview clears it; automatic moves replace', () => {
  const t = tourUrlHelpers('https://tinyastronomer.com/solar-system#saturn');
  expect(t.urlForBody('mars')).toBe('/solar-system?planet=mars');
  expect(t.urlForBody(null)).toBe('/solar-system');
  t.syncHistory('mars', 'push');
  t.syncHistory('saturn', 'replace');
  t.syncHistory('saturn', 'replace');
  t.syncHistory(null, 'none');
  expect(t.calls).toEqual([
    { mode: 'push', url: '/solar-system?planet=mars' },
    { mode: 'replace', url: '/solar-system?planet=saturn' },
  ]);
  t.syncTitle('saturn');
  expect(t.document.title).toBe('Saturn in 3D for Kids | tinyastronomer');
  t.syncTitle(null);
  expect(t.document.title).toBe('Solar System for Kids: The 8 Planets in 3D | tinyastronomer');
});

test('Back and Forward, Tour steps and deep links are wired to the selection', () => {
  const tour = read('solar-system.html');
  expect(tour).toContain("window.addEventListener('popstate', () => {\n  stopModes();\n  selectBody(bodyKeyFromUrl(), { history: 'none' });\n});");
  expect(tour).toContain("selectBody(step.key, { history: 'replace' });");
  expect(tour).toContain("if (key && key !== sim.selected) {\n    stopModes();\n    selectBody(key, { history: 'replace' });\n  }");
  // Quiz picks are game moves, not places to return to.
  expect(tour).toContain("selectBody(key, { history: answeringQuiz ? 'replace' : 'push' });");
});

test('Scale Walk stops have URLs too', () => {
  const walk = read('scale-walk.html');
  expect(walk).toContain("url.searchParams.get('stop')");
  expect(walk).toContain("url.searchParams.set('stop', STOP_KEYS[idx])");
  expect(walk).toContain("window.addEventListener('popstate', () => goTo(stopFromUrl(), { history: 'none' }));");
  expect(walk).toContain('idx = stopFromUrl();\ncam.target.copy(targetPos());');
});

test('quiz questions hide the facts panel until answered, then reveal them with persistent feedback', () => {
  const tour = read('solar-system.html');
  expect(tour).toContain('if (quiz.active && !quiz.answered) { renderQuizPanel(); return; }');
  expect(tour).toMatch(/function renderQuizPanel\(\) \{[\s\S]*?infoFacts\.innerHTML = row\('Score'/);
  // A right answer re-renders the panel with that world as the reward.
  expect(tour).toContain('if (answeringQuiz) quizPick(key);');
  expect(tour).toMatch(/quizPick\(key\);[\s\S]*?renderSelectionPanel\(\);/);
  // Feedback stays for at least 1.5 s, in the aria-live stage, with a Next button.
  expect(tour).toMatch(/const QUIZ_FEEDBACK_MS = (\d+);/);
  expect(Number(tour.match(/const QUIZ_FEEDBACK_MS = (\d+);/)![1])).toBeGreaterThanOrEqual(1500);
  expect(tour).toContain('<div class="stage" id="stage" role="status" aria-live="polite">');
  expect(tour).toContain("stageNext.addEventListener('click', () => { if (tour.active) nextTourStep(); else if (quiz.active) advanceQuiz(); });");
  // Ending the quiz puts the selected body's facts back.
  expect(tour).toContain('if (quizWasActive) renderSelectionPanel(false);');
});

test('the view can be turned, zoomed and recentred without dragging', () => {
  const common = read('common.js');
  const tour = read('solar-system.html');
  const css = read('common.css');
  expect(common).toContain('function createViewPad(cam, opts)');
  for (const label of ['Turn left', 'Turn right', 'Zoom in', 'Zoom out', 'Recenter the view']) {
    expect(common).toContain(`'${label}'`);
  }
  expect(tour).toContain('onRecenter: recenterView');
  expect(tour).toContain("if (e.key === 'Home' || e.key === '0') { recenterView(); e.preventDefault(); }");
  expect(tour).toContain('viewPad.setRecenter(sim.selected ? `Back to ${nameOf(sim.selected)}` : ');
  // Phone buttons meet the 44 px target; desktop keeps them compact.
  expect(css).toMatch(/\.view-pad-btn \{ width: 44px; height: 44px; \}/);
});

test('touch screens get touch words, placed under the chips instead of over the Sun', () => {
  const chrome = read('chrome.js');
  const tour = read('solar-system.html');
  const css = read('common.css');
  expect(chrome).toContain("matchMedia('(max-width: 820px), (pointer: coarse)')");
  expect(chrome).toContain("h.querySelector('.hint-touch')");
  expect(tour).toContain('<span class="hint-touch" hidden><span class="key">Drag</span> to turn · <span class="key">Pinch</span> to zoom · <span class="key">Tap</span> a planet</span>');
  const phone = css.slice(css.indexOf('@media (max-width: 820px), (max-height: 520px) and (orientation: landscape) {\n  .header'));
  expect(phone).toMatch(/\.hint \{\s*top: calc\(var\(--scene-top, 118px\) \+ 10px\);/);
  expect(phone).toMatch(/\.rail-btn \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
});

// Run the tour script against a fake document and clock.
function tourHarness() {
  const html = read('solar-system.html');
  const start = html.indexOf('const TOUR = [');
  const end = html.indexOf('const QUIZ = [', start);
  const source = html.slice(start, end);
  const el = () => ({ innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {} }, setAttribute() {} });
  const listeners: Record<string, () => void> = {};
  const document = {
    hidden: false,
    body: el(),
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; },
  };
  let now = 0;
  let timers: { id: number; at: number; fn: () => void }[] = [];
  let nextId = 1;
  const setTimeout = (fn: () => void, ms: number) => { const id = nextId++; timers.push({ id, at: now + ms, fn }); return id; };
  const clearTimeout = (id: number) => { timers = timers.filter(t => t.id !== id); };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter(t => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter(t => t !== due);
      now = due.at; due.fn();
    }
    now = until;
  };
  const selected: (string | null)[] = [];
  const api = new Function('document', 'setTimeout', 'clearTimeout', 'SPACE', 'selectBody',
    'stageEl', 'stageText', 'stageNext', 'btnTour', 'btnQuiz', 'quiz', 'renderSelectionPanel',
    source + ';return { startTour, tour };')(
    document, setTimeout, clearTimeout, { prefersReducedMotion: false }, (key: string | null) => selected.push(key),
    el(), el(), el(), el(), el(), { active: false, timer: null }, () => {});
  const setHidden = (hidden: boolean) => { document.hidden = hidden; listeners.visibilitychange?.(); };
  return { ...api, advance, setHidden, selected };
}

test('the Grand Tour holds its stop while the tab is hidden and carries on when shown', () => {
  const h = tourHarness();
  h.startTour();
  h.advance(8000);
  expect(h.selected.at(-1)).toBe('mercury');

  h.advance(5000);
  h.setHidden(true);
  h.advance(60000);
  expect(h.selected.at(-1)).toBe('mercury');
  expect(h.tour.active).toBe(true);

  h.setHidden(false);
  h.advance(7999);
  expect(h.selected.at(-1)).toBe('mercury');
  h.advance(1);
  expect(h.selected.at(-1)).toBe('venus');
});
