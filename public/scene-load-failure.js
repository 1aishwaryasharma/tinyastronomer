// The scene pages cover themselves with a loader until the 3D scene is ready.
// If a script fails to download or setup throws, nothing would ever hide it.
// While the loader is still showing, turn any such failure into a message.
export function watchSceneLoad(win = window, doc = document) {
  function fail() {
    const loader = doc.getElementById('loader');
    if (!loader || loader.classList.contains('hidden')) return;
    loader.setAttribute('role', 'alert');
    loader.classList.add('loader-failed');
    const text = loader.querySelector('.loader-text');
    if (text) text.textContent = 'This page could not load. Check your connection and reload to try again.';
    const bar = loader.querySelector('.loader-bar');
    if (bar) bar.hidden = true;
  }
  // Capture phase: a failed <script> fetch fires on the element and does not bubble.
  win.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target !== win && target.tagName !== 'SCRIPT') return;
    fail();
  }, true);
  win.addEventListener('unhandledrejection', fail);
  return fail;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') watchSceneLoad();
