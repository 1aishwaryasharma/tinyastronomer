// High-resolution Light Study wallpaper capture.
// Phone CSS pixels × pixelRatio≤2 are too small for a wallpaper. Capture
// resizes the shared composer to a wallpaper buffer, reads PNG pixels in
// the same turn (2D copy, not preserveDrawingBuffer), then restores the
// live renderer. GPU OOM steps down once; it never silently saves the
// on-screen buffer.
//
// Three.js r185 setPixelRatio immediately setSizes using the CURRENT
// logical size. After a wallpaper pass the logical size is still huge and
// pixel ratio is 1, so restoring pixel ratio first would allocate
// wallpaper × livePR (HalfFloat composer + bloom mips). Restore size first
// while pixel ratio is still 1, then restore pixel ratio.

const CAPTURE_HIDE_CLASS = 'is-capturing-view';
const WALLPAPER_PORTRAIT = { width: 1440, height: 2560 };
const WALLPAPER_LANDSCAPE = { width: 2560, height: 1440 };

function slugifyFilename(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function wallpaperFilename(study, observation) {
  const studySlug = slugifyFilename(study) || 'tinyastronomer';
  const observationSlug = slugifyFilename(observation);
  return (observationSlug ? studySlug + '-' + observationSlug : studySlug) + '.png';
}

export function wallpaperSize(viewW, viewH, maxEdge) {
  const width = Math.max(1, Number(viewW) || 1);
  const height = Math.max(1, Number(viewH) || 1);
  const portrait = height >= width;
  const min = portrait ? WALLPAPER_PORTRAIT : WALLPAPER_LANDSCAPE;
  const scale = Math.max(min.width / width, min.height / height);
  let outW = Math.round(width * scale);
  let outH = Math.round(height * scale);
  if (maxEdge && Math.max(outW, outH) > maxEdge) {
    const clampScale = maxEdge / Math.max(outW, outH);
    outW = Math.max(1, Math.round(outW * clampScale));
    outH = Math.max(1, Math.round(outH * clampScale));
  }
  return { width: outW, height: outH, portrait };
}

export function captureAttempts(viewW, viewH, maxEdge) {
  const full = wallpaperSize(viewW, viewH, maxEdge);
  const steppedEdge = Math.max(1, Math.round(Math.max(full.width, full.height) * 0.75));
  const cap = maxEdge ? Math.min(maxEdge, steppedEdge) : steppedEdge;
  const stepped = wallpaperSize(viewW, viewH, cap);
  const attempts = [{ width: full.width, height: full.height }];
  if (stepped.width !== full.width || stepped.height !== full.height) {
    attempts.push({ width: stepped.width, height: stepped.height });
  }
  return attempts;
}

function gpuMaxEdge(gl) {
  if (!gl || typeof gl.getParameter !== 'function') return 8192;
  const tex = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const rb = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const max = Math.min(tex > 0 ? tex : Infinity, rb > 0 ? rb : Infinity);
  return Number.isFinite(max) && max > 0 ? max : 8192;
}

function copyDrawingBuffer(source, documentLike) {
  if (!source || !source.width || !source.height) {
    throw new Error('Nothing to copy');
  }
  const copy = documentLike.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext('2d');
  if (!ctx || typeof ctx.drawImage !== 'function') {
    throw new Error('2D copy unavailable');
  }
  ctx.drawImage(source, 0, 0);
  return copy;
}

function pngBlobFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG encode failed'));
      }, 'image/png');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const comma = dataUrl.indexOf(',');
      const binary = atob(dataUrl.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch (err) {
      reject(err);
    }
  });
}

function downloadBlob(blob, filename, documentLike, windowLike) {
  const url = URL.createObjectURL(blob);
  const a = documentLike.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  documentLike.body.appendChild(a);
  a.click();
  a.remove();
  windowLike.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function snapshotLiveSurface(setup, windowLike) {
  const renderer = setup.renderer;
  const canvas = renderer.domElement;
  return {
    pixelRatio: renderer.getPixelRatio(),
    width: windowLike.innerWidth,
    height: windowLike.innerHeight,
    cameraAspect: setup.camera.aspect,
    drawingWidth: canvas.width,
    drawingHeight: canvas.height,
    canvasStyleWidth: canvas.style.width,
    canvasStyleHeight: canvas.style.height,
    bloomEnabled: setup.bloomPass ? Boolean(setup.bloomPass.enabled) : null
  };
}

export function restoreLiveSurface(setup, snap) {
  const renderer = setup.renderer;
  const composer = setup.composer;
  const camera = setup.camera;
  // Size first while pixel ratio is still 1 (the capture pass left it there).
  renderer.setSize(snap.width, snap.height);
  renderer.setPixelRatio(snap.pixelRatio);
  if (snap.canvasStyleWidth) renderer.domElement.style.width = snap.canvasStyleWidth;
  if (snap.canvasStyleHeight) renderer.domElement.style.height = snap.canvasStyleHeight;
  camera.aspect = snap.cameraAspect;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(snap.width, snap.height);
    composer.setPixelRatio(snap.pixelRatio);
  }
}

function renderCapturePass(setup, size, opts, documentLike) {
  const renderer = setup.renderer;
  const composer = setup.composer;
  const camera = setup.camera;
  renderer.setPixelRatio(1);
  renderer.setSize(size.width, size.height, false);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setPixelRatio(1);
    composer.setSize(size.width, size.height);
  }
  if (setup.bloomPass) setup.bloomPass.enabled = true;
  if (typeof opts.prepare === 'function') opts.prepare();

  const gl = renderer.getContext && renderer.getContext();
  if (gl && gl.isContextLost && gl.isContextLost()) {
    throw new Error('WebGL context lost');
  }

  setup.render();

  const canvas = renderer.domElement;
  const drawnW = (gl && gl.drawingBufferWidth) || canvas.width;
  const drawnH = (gl && gl.drawingBufferHeight) || canvas.height;
  if (drawnW < size.width * 0.9 || drawnH < size.height * 0.9) {
    throw new Error('Capture buffer smaller than requested');
  }
  return copyDrawingBuffer(canvas, documentLike);
}

export function captureSceneView(setup, opts) {
  opts = opts || {};
  const windowLike = opts.window || globalThis;
  const documentLike = opts.document || globalThis.document;
  const renderer = setup.renderer;
  const viewW = opts.viewWidth != null ? opts.viewWidth : windowLike.innerWidth;
  const viewH = opts.viewHeight != null ? opts.viewHeight : windowLike.innerHeight;
  const gl = renderer.getContext && renderer.getContext();
  const maxEdge = gpuMaxEdge(gl);
  const attempts = captureAttempts(viewW, viewH, maxEdge);
  const root = documentLike.documentElement;
  const snap = snapshotLiveSurface(setup, windowLike);
  root.classList.add(CAPTURE_HIDE_CLASS);
  void root.offsetHeight;

  let copy = null;
  let lastError = null;
  try {
    for (let i = 0; i < attempts.length; i++) {
      try {
        copy = renderCapturePass(setup, attempts[i], opts, documentLike);
        break;
      } catch (err) {
        lastError = err;
      }
    }
  } finally {
    try {
      restoreLiveSurface(setup, snap);
    } finally {
      if (setup.bloomPass && snap.bloomEnabled != null) {
        setup.bloomPass.enabled = snap.bloomEnabled;
      }
      root.classList.remove(CAPTURE_HIDE_CLASS);
      if (typeof opts.restore === 'function') opts.restore();
      try { setup.render(); } catch (err) { /* live frame is best-effort */ }
    }
  }

  if (!copy) throw lastError || new Error('Could not capture this view');
  if (
    copy.width === snap.drawingWidth
    && copy.height === snap.drawingHeight
    && (copy.width < attempts[0].width * 0.9 || copy.height < attempts[0].height * 0.9)
  ) {
    throw new Error('Refusing to save the on-screen buffer as a wallpaper');
  }

  return {
    canvas: copy,
    width: copy.width,
    height: copy.height,
    filename: opts.filename || wallpaperFilename(opts.study || 'light-study', opts.observation)
  };
}

export function bindSaveViewControl(setup, opts) {
  opts = opts || {};
  const documentLike = opts.document || globalThis.document;
  const windowLike = opts.window || globalThis;
  const btn = opts.button || documentLike.getElementById(opts.buttonId || 'save-view-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    const observation = typeof opts.getObservation === 'function'
      ? opts.getObservation()
      : (opts.observation || '');
    const filename = wallpaperFilename(opts.study || 'light-study', observation);
    const announce = setup.accessibility && setup.accessibility.announce;
    try {
      const result = captureSceneView(setup, {
        filename,
        observation,
        prepare: opts.prepare,
        restore: opts.restore,
        document: documentLike,
        window: windowLike
      });
      Promise.resolve(pngBlobFromCanvas(result.canvas)).then((blob) => {
        downloadBlob(blob, result.filename, documentLike, windowLike);
        if (announce) announce('Saved wallpaper image of this view.');
      }).catch((err) => {
        console.error(err);
        if (announce) announce('Could not save this view.');
      }).then(() => {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      });
    } catch (err) {
      console.error(err);
      if (announce) announce('Could not save this view.');
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  });
}
