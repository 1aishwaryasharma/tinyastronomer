/* ─────────────────────────────────────────────────────────
   Chrome helpers shared by every page — navigation, mobile
   drawers, hints, and tiny DOM utilities. No Three.js here so
   Missions and Sky Tonight stay lightweight.
   ───────────────────────────────────────────────────────── */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setText(el, text) {
  if (el.__spaceText !== text) {
    el.__spaceText = text;
    el.textContent = text;
  }
}

function initMobileHints() {
  const hints = document.querySelectorAll('.hint');
  if (!hints.length) return;
  if (window.matchMedia('(max-width: 820px)').matches) {
    hints.forEach((h) => {
      h.innerHTML = '<span class="key">Drag</span> to rotate · <span class="key">Pinch</span> to zoom';
    });
  }
  let done = false;
  function dismiss() {
    if (done) return;
    done = true;
    hints.forEach((h) => h.classList.add('is-dismissed'));
    window.removeEventListener('pointerdown', dismiss, true);
    window.removeEventListener('keydown', dismiss, true);
    window.removeEventListener('wheel', dismiss, true);
  }
  window.addEventListener('pointerdown', dismiss, true);
  window.addEventListener('keydown', dismiss, true);
  window.addEventListener('wheel', dismiss, true);
  window.setTimeout(dismiss, 8000);
}

// Ordered as one journey: start at home, learn what Earth and Moon do,
// meet the neighbourhood, feel the distances, see who we sent — and end
// by going outside to look up.
const SCENES = [
  { href: 'index.html', key: 'light', label: 'Light Study' },
  { href: 'seasons.html', key: 'seasons', label: 'Seasons' },
  { href: 'solar-system.html', key: 'tour', label: 'Grand Tour' },
  { href: 'scale-walk.html', key: 'scale', label: 'Scale Walk' },
  { href: 'missions.html', key: 'missions', label: 'Missions' },
  { href: 'sky-tonight.html', key: 'sky', label: 'Sky Tonight' }
];

// A tiny logbook: which stops the visitor has already explored. localStorage
// can throw (private browsing, blocked storage) — the journey still works,
// it just forgets.
const JOURNEY_KEY = 'ta-journey';
function readVisited() {
  try {
    const list = JSON.parse(window.localStorage.getItem(JOURNEY_KEY));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}
function markVisited(key) {
  try {
    const list = readVisited();
    if (!list.includes(key)) {
      list.push(key);
      window.localStorage.setItem(JOURNEY_KEY, JSON.stringify(list));
    }
    return list;
  } catch (err) {
    return [key];
  }
}

function buildNav(currentKey) {
  const nav = document.createElement('nav');
  nav.className = 'scene-nav';
  nav.setAttribute('aria-label', 'Explore scenes');
  const btn = document.createElement('button');
  btn.className = 'scene-nav-btn';
  btn.type = 'button';
  btn.textContent = '✦ Explore';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'true');
  const menu = document.createElement('div');
  menu.className = 'scene-menu';
  menu.id = 'scene-menu';
  menu.hidden = true;
  btn.setAttribute('aria-controls', menu.id);

  const visited = markVisited(currentKey);
  const seen = SCENES.filter((s) => visited.includes(s.key)).length;
  const head = document.createElement('div');
  head.className = 'scene-menu-head';
  head.textContent = 'Your journey · ' + seen + ' / ' + SCENES.length;
  menu.appendChild(head);

  SCENES.forEach((s, i) => {
    const a = document.createElement('a');
    a.href = s.href;
    if (s.key === currentKey) {
      a.className = 'current';
      a.setAttribute('aria-current', 'page');
    } else if (visited.includes(s.key)) {
      a.className = 'visited';
    }
    a.innerHTML = '<span class="dot"></span>' + s.label
      + '<span class="step">' + String(i + 1).padStart(2, '0') + '</span>';
    menu.appendChild(a);
  });

  // The journey always knows where to go next; the final stop loops home.
  const currentIndex = SCENES.findIndex((s) => s.key === currentKey);
  const next = currentIndex >= 0 && currentIndex < SCENES.length - 1
    ? SCENES[currentIndex + 1]
    : null;
  const nextLink = document.createElement('a');
  nextLink.className = 'scene-next';
  nextLink.href = (next || SCENES[0]).href;
  nextLink.innerHTML = next
    ? 'Next stop · ' + next.label + ' <span class="arrow">→</span>'
    : 'Journey complete · start again <span class="arrow">↻</span>';
  menu.appendChild(nextLink);

  nav.appendChild(btn);
  nav.appendChild(menu);
  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!nav.classList.contains('open'));
  });
  nav.addEventListener('click', (e) => e.stopPropagation());
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      btn.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!nav.contains(e.target)) setOpen(false);
  });
  document.body.appendChild(nav);
}

function initMobileInfoPanels() {
  document.querySelectorAll('.info-panel').forEach((panel, index) => {
    if (panel.classList.contains('mobile-info-panel')) return;
    // Sky Tonight's panel is the page content; collapsing it would hide the list.
    if (panel.hasAttribute('data-keep-open')) return;

    panel.classList.add('mobile-info-panel');
    panel.classList.remove('is-expanded');

    if (!panel.id) panel.id = 'info-panel-' + (index + 1);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-info-toggle';
    toggle.textContent = 'Read';
    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Read the full explanation');

    toggle.addEventListener('click', () => {
      const expanded = panel.classList.toggle('is-expanded');
      toggle.textContent = expanded ? 'Close' : 'Read';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute(
        'aria-label',
        expanded ? 'Close the full explanation' : 'Read the full explanation'
      );
    });

    panel.appendChild(toggle);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initMobileInfoPanels();
    initMobileHints();
  }, { once: true });
} else {
  initMobileInfoPanels();
  initMobileHints();
}

const SPACE = {
  buildNav,
  clamp,
  initMobileHints,
  initMobileInfoPanels,
  prefersReducedMotion,
  setText
};

window.SPACE = SPACE;

export {
  SPACE,
  buildNav,
  clamp,
  initMobileHints,
  initMobileInfoPanels,
  prefersReducedMotion,
  setText
};
