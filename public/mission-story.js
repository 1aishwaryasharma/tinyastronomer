/* The parts of a mission page that work without WebGL, and the scene's
   arithmetic that the tests can run without it.

     storyState(chapters, scrollY, viewportHeight)   pure scroll arithmetic
     createStory(root, { onChapter })                the page's chapters, measured
     followStory(root, onState)                      the story's state on every scroll,
                                                     for a page with no 3D scene to drive it
     follow(dt, jump)                                the camera's easing
     yieldingLabels(boxes)                           which of a frame's labels give way
     createPartPicker(parts)                         the spacecraft-parts buttons
     createChart(canvas, rows, { unit, events })     a line chart in a card

   A mission page is a column of tall `.chapter` sections over one fixed 3D
   canvas. Scrolling is the timeline: the chapter under the middle of the
   viewport is the active one. Each chapter names the 3D set it plays on in
   `data-stage`; where two neighbours use different sets, `dim` rises to 1 at
   the boundary so the page can cut between them unseen. A chapter's progress
   runs from 0 to 1 across the part of it that is not dimmed, so nothing it
   shows happens in the dark. */

import { clamp01, sampleRows, smooth } from './mission-orbits.js?v=20261121-2';

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
  const cutIn = index > 0 && chapters[index - 1].stage !== chapter.stage ? band : 0;
  // Past the last chapter the reading matter below takes over the screen.
  const cutOut = index === last ? band * 2 : chapters[index + 1].stage !== chapter.stage ? band : 0;
  return {
    index,
    progress: clamp01((into - cutIn) / Math.max(1, chapter.height - cutIn - cutOut)),
    dim: 1 - Math.min(cutIn ? smooth(0, cutIn, into) : 1, cutOut ? smooth(0, cutOut, left) : 1),
    past: index === last && left < -viewportHeight * 0.5,
  };
}

// `read()` returns storyState plus the chapter's id, its stage, and the side
// of the screen its card sits on (`.chapter.right` in the markup).
export function createStory(root, { onChapter } = {}) {
  const chapters = [...root.querySelectorAll('.chapter')].map((el) => ({
    el, id: el.id, stage: el.dataset.stage, side: el.classList.contains('right') ? 'right' : 'left', top: 0, height: 1,
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
    return { ...state, id: chapter.id, stage: chapter.stage, side: chapter.side };
  }

  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(root);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  return { chapters, measure, read };
}

// For a page whose 3D scene could not start: nothing draws frames, so read
// the story on each scroll instead. The chapter rail keeps working too.
export function followStory(root, onState) {
  const story = createStory(root);
  const read = () => onState(story.read());
  addEventListener('scroll', read, { passive: true });
  read();
}

// The share of the way to its target the camera covers in a frame `dt`
// seconds long. A cut between sets, or reduced motion, jumps straight there.
export const follow = (dt, jump) => (jump ? 1 : 1 - Math.exp(-dt * 6));

// Which of one frame's labels should give way. `boxes` are { x, y, w, h, rank }
// in screen pixels, in a stable order. A label with a rank gives way to a
// higher-ranked one it would print over, and the earlier of two equals wins;
// one that has given way takes no one else's place. A label without a rank
// (null) neither gives way nor is given way to. Returns a Set of indices.
export function yieldingLabels(boxes) {
  const order = boxes.flatMap((box, i) => (box.rank == null ? [] : [i]))
    .sort((a, b) => boxes[b].rank - boxes[a].rank || a - b);
  const held = [], gives = new Set();
  for (const i of order) {
    const a = boxes[i];
    const covered = held.some((j) => {
      const b = boxes[j];
      return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    });
    if (covered) gives.add(i); else held.push(i);
  }
  return gives;
}

// One button per part in #parts; picking one fills #part-title and
// #part-text, picking it again lets go. `parts` are { key, label, title,
// text }. The kit's hotspots read and set the same selection.
export function createPartPicker(parts) {
  const title = document.getElementById('part-title'), text = document.getElementById('part-text');
  const buttons = new Map();
  const picker = {
    parts,
    selected: null,
    select(key) {
      picker.selected = picker.selected === key ? null : key;
      for (const [k, btn] of buttons) btn.setAttribute('aria-pressed', String(k === picker.selected));
      const part = parts.find((p) => p.key === picker.selected);
      if (part) {
        title.textContent = part.title;
        text.textContent = part.text;
      }
    },
  };
  for (const part of parts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part-btn';
    btn.textContent = part.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => picker.select(part.key));
    document.getElementById('parts').appendChild(btn);
    buttons.set(part.key, btn);
  }
  return picker;
}

// A small line chart on a 2D canvas inside a card: `rows` are [day, value]
// samples and `events` are { day, label } marks under the axis. The returned
// function draws the trace up to a given day.
export function createChart(canvas, rows, { unit = 'km/s', events = [] } = {}) {
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
    for (const event of events) {
      ctx.fillStyle = day >= event.day ? accent : ink;
      ctx.fillRect(Math.round(X(event.day)), h - padB + 1, 1, 4);
      ctx.fillText(event.label, X(event.day), h - 3);
    }
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
