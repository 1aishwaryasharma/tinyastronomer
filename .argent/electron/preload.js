'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('taQa', true);

// Runs in the page's main world before its scripts, only in the visual QA shell.
// Keep Date arithmetic intact; freeze only the implicit clock. performance.now()
// and timers still advance so loading, animations, and Argent waits can finish.
function installVisualFixture() {
  window.taVisualBaselines = true;
  const NativeDate = Date;
  const now = NativeDate.parse('2026-09-08T12:00:00Z');
  window.Date = new Proxy(NativeDate, {
    apply() { return new NativeDate(now).toString(); },
    construct(target, args, newTarget) {
      return Reflect.construct(target, args.length ? args : [now], newTarget);
    },
    get(target, key, receiver) {
      return key === 'now' ? () => now : Reflect.get(target, key, receiver);
    },
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.dataset.qaVisualBaselines = '';
    const style = document.createElement('style');
    // Panels are translucent: even a DOM-only crop can contain the moving
    // canvas behind it. Preserve layout and scene execution, hide just pixels.
    style.textContent = '[data-qa-visual-baselines] :is(canvas, .label-3d) { visibility: hidden !important; }';
    document.head.append(style);
  }, { once: true });
}

if (process.argv.includes('--visual-baselines')) {
  require('electron').webFrame.executeJavaScript(`(${installVisualFixture.toString()})();`);
}
