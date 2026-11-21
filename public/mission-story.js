/* Scroll position → story position, for the mission pages.

   A mission page is a column of tall `.chapter` sections over one fixed 3D
   canvas. Scrolling is the timeline: the chapter under the middle of the
   viewport is the active one, and how far the middle has travelled through
   it (0 to 1) is that chapter's progress. Each chapter names the 3D set it
   plays on in `data-stage`; where two neighbours use different sets, `dim`
   rises to 1 at the boundary so the page can cut between them unseen. */

import { sampleRows } from './mission-orbits.js?v=20261121-1';

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Pure: `chapters` are { top, height, stage } in document pixels.
export function storyState(chapters, scrollY, viewportHeight) {
  const middle = scrollY + viewportHeight * 0.5;
  const last = chapters.length - 1;
  let index = chapters.findIndex((c) => middle < c.top + c.height);
  if (index === -1) index = last;
  const chapter = chapters[index];
  const into = middle - chapter.top;
  const left = chapter.top + chapter.height - middle;
  const band = viewportHeight * 0.22;
  let dim = 0;
  if (index > 0 && chapters[index - 1].stage !== chapter.stage) dim = Math.max(dim, 1 - smoothstep(0, band, into));
  if (index < last && chapters[index + 1].stage !== chapter.stage) dim = Math.max(dim, 1 - smoothstep(0, band, left));
  // Past the last chapter the reading matter below takes over the screen.
  if (index === last) dim = Math.max(dim, 1 - smoothstep(0, band * 2, left));
  return {
    index,
    progress: Math.max(0, Math.min(1, into / chapter.height)),
    dim,
    past: index === last && left < -viewportHeight * 0.5,
  };
}

export function createStory(root, { onChapter } = {}) {
  const chapters = [...root.querySelectorAll('.chapter')].map((el) => ({
    el, id: el.id, stage: el.dataset.stage, top: 0, height: 1,
  }));
  const rail = document.querySelector('.chapter-rail');
  const railLinks = rail ? [...rail.querySelectorAll('a')] : [];
  let current = -1;

  function measure() {
    for (const chapter of chapters) {
      const rect = chapter.el.getBoundingClientRect();
      chapter.top = rect.top + window.scrollY;
      chapter.height = Math.max(1, rect.height);
    }
  }

  function read() {
    const state = storyState(chapters, window.scrollY, window.innerHeight);
    const chapter = chapters[state.index];
    if (state.index !== current) {
      current = state.index;
      for (const link of railLinks) {
        if (link.getAttribute('href') === '#' + chapter.id) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      }
      if (onChapter) onChapter(chapter);
    }
    return { ...state, id: chapter.id, stage: chapter.stage };
  }

  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(root);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  return { chapters, measure, read };
}

// A small line chart on a 2D canvas inside a card: `rows` are [day, value]
// samples, and the returned function draws the trace up to a given day.
export function createChart(canvas, rows, eventDay, { unit = 'km/s', eventLabel = 'closest approach' } = {}) {
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue('--ink-faint').trim(), accent = style.getPropertyValue('--accent').trim();
  const t0 = rows[0][0], t1 = rows[rows.length - 1][0];
  const top = Math.ceil(Math.max(...rows.map((r) => r[1])) / 10) * 10;
  let lastDrawn = null;
  return function draw(day) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const key = w + ':' + h + ':' + day.toFixed(3);
    if (key === lastDrawn) return;
    lastDrawn = key;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 30, padB = 18, padT = 6;
    const X = (t) => padL + ((t - t0) / (t1 - t0)) * (w - padL - 4);
    const Y = (v) => padT + (1 - v / top) * (h - padT - padB);
    ctx.font = '10px "Fragment Mono", monospace';
    ctx.fillStyle = ink;
    ctx.strokeStyle = 'rgba(232,236,244,0.12)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= top; v += 10) {
      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - 4, Y(v)); ctx.stroke();
      ctx.fillText(String(v), 4, Y(v) + 3);
    }
    ctx.fillText(unit, 4, h - 4);
    ctx.textAlign = 'center';
    ctx.fillText(eventLabel, X(eventDay), h - 4);
    ctx.textAlign = 'left';
    const trace = (until, color, width) => {
      ctx.beginPath();
      rows.forEach((r, i) => { if (r[0] <= until) ctx[i ? 'lineTo' : 'moveTo'](X(r[0]), Y(r[1])); });
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    trace(t1, 'rgba(232,236,244,0.28)', 1);
    trace(day, accent, 2);
    const now = sampleRows(rows, day);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(X(now[0]), Y(now[1]), 3.5, 0, Math.PI * 2); ctx.fill();
  };
}
