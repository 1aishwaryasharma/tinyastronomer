const deck = document.querySelector('#launch-deck');
const launchStudies = document.querySelectorAll('[data-launch-study]');
const canvasContainer = document.querySelector('#canvas-container');
const isSceneNode = (node) => (
  node.nodeType === Node.ELEMENT_NODE
  && node !== deck
  && node !== canvasContainer
  && node.tagName !== 'SCRIPT'
  && node.tagName !== 'NOSCRIPT'
);

function setSceneAvailable(available) {
  Array.from(document.body.children).filter(isSceneNode).forEach((node) => {
    node.inert = !available;
    if (!available) node.setAttribute('aria-hidden', 'true');
    else node.removeAttribute('aria-hidden');
  });
}

function showLightStudy() {
  document.body.classList.add('is-study-open');
  deck.hidden = true;
  setSceneAvailable(true);
  if (window.location.hash !== '#light-study') {
    window.history.replaceState(null, '', '#light-study');
  }
  requestAnimationFrame(() => document.querySelector('canvas')?.focus());
}

function openLightStudy(event) {
  event.preventDefault();
  showLightStudy();
}

setSceneAvailable(false);
launchStudies.forEach((launchStudy) => launchStudy.addEventListener('click', openLightStudy));
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#light-study') showLightStudy();
});

const sceneObserver = new MutationObserver((entries) => {
  if (deck.hidden) return;
  entries.flatMap((entry) => Array.from(entry.addedNodes)).filter(isSceneNode).forEach((node) => {
    node.inert = true;
    node.setAttribute('aria-hidden', 'true');
  });
});
sceneObserver.observe(document.body, { childList: true });

if (window.location.hash === '#light-study') {
  showLightStudy();
}
