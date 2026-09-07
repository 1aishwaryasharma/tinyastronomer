import { createFrameLoop } from './frame-loop.js?v=20260907-1';
/* ─────────────────────────────────────────────────────────
   Chrome helpers shared by every page — navigation, mobile
   drawers, hints, and tiny DOM utilities. No Three.js here so
   Missions and Sky Tonight stay lightweight.
   ───────────────────────────────────────────────────────── */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE_HINT_KEY = 'ta-mobile-hint-seen';

function initSceneAccessibility() {
  const status = document.createElement('p');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.appendChild(status);

  let announcementTimer = 0;
  function announce(message) {
    window.clearTimeout(announcementTimer);
    // Clearing first makes repeat actions announce reliably.
    status.textContent = '';
    announcementTimer = window.setTimeout(() => { status.textContent = message; }, 30);
  }
  return { announce };
}

function setText(el, text) {
  if (el.__spaceText !== text) {
    el.__spaceText = text;
    el.textContent = text;
  }
}

// Horizontal chip strips hide the selected stop. Bring it back into view
// without yanking the page — only the rail scrolls.
function revealRailButton(btn) {
  if (!btn) return;
  const rail = btn.closest('.side-rail');
  if (!rail) return;
  const railRect = rail.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const pad = 8;
  if (btnRect.left >= railRect.left + pad && btnRect.right <= railRect.right - pad) return;
  btn.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: prefersReducedMotion ? 'auto' : 'smooth'
  });
}

// A chip strip that hides half its stops looks complete. Expose how much is
// still off-screen on each edge as CSS variables; the stylesheet turns them
// into edge fades wherever a rail scrolls. Both axes are measured because
// the rail is a row on phones and a column on wide screens.
function initRailOverflow() {
  const rails = document.querySelectorAll('.side-rail');
  if (!rails.length) return;
  const FADE = '28px';
  const update = (rail) => {
    const maxX = rail.scrollWidth - rail.clientWidth;
    const maxY = rail.scrollHeight - rail.clientHeight;
    rail.style.setProperty('--rail-fade-start', maxX > 1 && rail.scrollLeft > 1 ? FADE : '0px');
    rail.style.setProperty('--rail-fade-end', maxX > 1 && rail.scrollLeft < maxX - 1 ? FADE : '0px');
    rail.style.setProperty('--rail-fade-top', maxY > 1 && rail.scrollTop > 1 ? FADE : '0px');
    rail.style.setProperty('--rail-fade-bottom', maxY > 1 && rail.scrollTop < maxY - 1 ? FADE : '0px');
  };
  rails.forEach((rail) => {
    rail.addEventListener('scroll', () => update(rail), { passive: true });
    // Rails are filled by each study after this runs, and web fonts change
    // the chip widths once they arrive.
    new MutationObserver(() => update(rail)).observe(rail, { childList: true });
    new ResizeObserver(() => update(rail)).observe(rail);
    update(rail);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => rails.forEach(update));
  }
}

// On short phones a three-row dock covers a third of the scene. The display
// toggles fold behind one Display button that opens a popover above the dock.
// The stylesheet decides when that applies; on wide screens the button stays
// hidden and the toggles sit inline exactly as before.
function initDisplayMenus() {
  document.querySelectorAll('.controls .toggle-group[data-display-menu]').forEach((group, index) => {
    if (!group.id) group.id = 'display-menu-' + (index + 1);
    group.classList.add('display-menu');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Display options');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-btn display-menu-btn';
    btn.textContent = 'Display';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', group.id);
    group.before(btn);

    function setOpen(open) {
      group.classList.toggle('is-open', open);
      btn.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', () => setOpen(!group.classList.contains('is-open')));
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.focus();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!group.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
  });
}

function initMobileHints() {
  const hints = document.querySelectorAll('.hint');
  if (!hints.length) return;
  const isMobile = window.matchMedia('(max-width: 820px)').matches;
  if (isMobile) {
    try {
      if (window.localStorage.getItem(MOBILE_HINT_KEY) === '1') {
        hints.forEach((h) => h.classList.add('is-dismissed'));
        return;
      }
    } catch (err) {
      // Storage can be unavailable in private or restricted browsing.
    }
    hints.forEach((h) => {
      h.innerHTML = '<span class="key">Drag</span> to rotate · <span class="key">Pinch</span> to zoom';
    });
    try {
      window.localStorage.setItem(MOBILE_HINT_KEY, '1');
    } catch (err) {
      // The hint still works for this visit when persistence is unavailable.
    }
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
  { href: '/#light-study', key: 'light', label: 'Light Study' },
  { href: '/seasons', key: 'seasons', label: 'Seasons' },
  { href: '/solar-system', key: 'tour', label: 'Grand Tour' },
  { href: '/scale-walk', key: 'scale', label: 'Scale Walk' },
  { href: '/missions', key: 'missions', label: 'Missions' },
  { href: '/sky-tonight', key: 'sky', label: 'Sky Tonight' }
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
  btn.id = 'scene-nav-btn';
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
    a.id = 'scene-link-' + s.key;
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
  nextLink.id = 'scene-next';
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
      if (!expanded) {
        panel.scrollTop = 0;
      }
      toggle.textContent = expanded ? 'Close' : 'Read';
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute(
        'aria-label',
        expanded ? 'Close the full explanation' : 'Read the full explanation'
      );
    });

    // First child so position:sticky can pin Close to the top of the
    // same overflow box the finger actually scrolls.
    panel.insertBefore(toggle, panel.firstChild);
  });
}

function initChrome() {
  initMobileInfoPanels();
  initMobileHints();
  initDisplayMenus();
  initRailOverflow();
}

if (document.readyState === 'loading') {
  // Initialize the page controls as soon as HTML is parsed, independently of
  // large deferred 3D modules. DOMContentLoaded waits for those modules.
  document.addEventListener('readystatechange', function onParsed() {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', onParsed);
    initChrome();
  });
} else {
  initChrome();
}

const SPACE = {
  createFrameLoop,
  buildNav,
  clamp,
  initDisplayMenus,
  initMobileHints,
  initMobileInfoPanels,
  initRailOverflow,
  prefersReducedMotion,
  initSceneAccessibility,
  revealRailButton,
  setText
};

window.SPACE = SPACE;

export {
  SPACE,
  createFrameLoop,
  buildNav,
  clamp,
  initDisplayMenus,
  initMobileHints,
  initMobileInfoPanels,
  initRailOverflow,
  initSceneAccessibility,
  prefersReducedMotion,
  revealRailButton,
  setText
};
