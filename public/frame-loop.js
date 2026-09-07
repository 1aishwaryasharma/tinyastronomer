// One scheduler for canvas work: bounded frame rate, no hidden-tab work,
// and explicit invalidation for static (reduced-motion) drawings.
export function createFrameLoop(draw, {
  fps = 60,
  animated = true,
  element = null,
} = {}) {
  const interval = 1000 / fps;
  let frame = null, last = null, previousDraw = null, visible = true, dirty = true, disposed = false;

  function schedule() {
    if (!disposed && !document.hidden && visible && frame === null) {
      frame = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    frame = null;
    if (disposed || document.hidden || !visible) return;
    const elapsed = last === null ? interval : now - last;
    // Small tolerance avoids halving the rate due to vsync rounding.
    if (dirty || elapsed >= interval - 0.5) {
      const dt = previousDraw === null ? 0 : Math.min((now - previousDraw) / 1000, 0.1);
      previousDraw = now;
      const remainder = elapsed % interval;
      last = now - (remainder < interval - 0.5 ? remainder : 0);
      dirty = false;
      draw(now, dt);
    }
    if (animated) schedule();
  }
  function invalidate() {
    dirty = true;
    schedule();
  }
  function visibilityChanged() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last = previousDraw = null;
    invalidate();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('resize', invalidate);
  const observer = element && typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visibilityChanged();
    }) : null;
  if (observer) observer.observe(element);
  schedule();
  return {
    invalidate,
    dispose() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('resize', invalidate);
    },
  };
}
