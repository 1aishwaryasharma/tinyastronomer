/* ─────────────────────────────────────────────────────────
   Page guide — the plain-language explainer and teacher notes
   that ship in each page's HTML. It lives in a <dialog> so the
   full-screen scenes keep their layout; the text is in the
   markup either way, so search engines and screen readers get
   it without opening anything.

   Standalone on purpose: the home deck loads no other script
   until a study opens, and the guide must work before that.
   ───────────────────────────────────────────────────────── */

const guide = document.getElementById('page-guide');

if (guide instanceof HTMLDialogElement) {
  const GUIDE_HASH = '#guide';
  let opener = null;

  function open(trigger) {
    if (guide.open) return;
    opener = trigger || document.activeElement;
    guide.showModal();
    guide.scrollTop = 0;
    // Start reading at the top, not on the Print button showModal would pick.
    guide.focus();
  }

  // Replace rather than push: Back should leave the page, not reopen the guide.
  function clearHash() {
    if (window.location.hash === GUIDE_HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  document.querySelectorAll('[data-guide-open]').forEach((trigger) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', guide.id);
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      open(trigger);
    });
  });

  guide.querySelectorAll('[data-guide-close]').forEach((button) => {
    button.addEventListener('click', () => guide.close());
  });

  guide.querySelectorAll('[data-guide-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  // A click on the backdrop lands on the dialog element itself. In-page links
  // (Grand Tour's #mars) drive the scene behind the guide, so step aside.
  guide.addEventListener('click', (event) => {
    if (event.target === guide || event.target.closest('a[href^="#"]')) guide.close();
  });

  guide.addEventListener('close', () => {
    clearHash();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    opener = null;
  });

  // Teachers can share /seasons#guide and land on the notes directly.
  const openFromHash = () => {
    if (window.location.hash === GUIDE_HASH) open(null);
  };
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}
