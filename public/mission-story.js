/* Scroll position → story position, for the mission pages.

   A mission page is a column of tall `.chapter` sections over one fixed 3D
   canvas. Scrolling is the timeline: the chapter under the middle of the
   viewport is the active one, and how far the middle has travelled through
   it (0 to 1) is that chapter's progress. Each chapter names the 3D set it
   plays on in `data-stage`; where two neighbours use different sets, `dim`
   rises to 1 at the boundary so the page can cut between them unseen. */

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
