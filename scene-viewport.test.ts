import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import * as REAL_THREE from './public/vendor/three/three.module.min.js';

function loadSpace() {
  const listeners: Record<string, (() => void)[]> = {};
  const window = {
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 1,
    location: { search: '' },
    addEventListener(type: string, fn: () => void) { (listeners[type] ||= []).push(fn); },
  };
  const element = () => ({
    style: {} as Record<string, unknown>,
    setAttribute() {},
    appendChild() {},
    addEventListener() {},
  });
  const container = element();
  const document = { getElementById: (id: string) => id === 'canvas-container' ? container : null };
  class WebGLRenderer {
    domElement = element();
    shadowMap = {};
    width = 0;
    height = 0;
    getContext() { return {}; }
    setSize(w: number, h: number) { this.width = w; this.height = h; }
    setPixelRatio() {}
    render() {}
  }
  const THREE = { ...REAL_THREE, WebGLRenderer };
  const source = readFileSync(new URL('./public/common.js', import.meta.url), 'utf8');
  const body = source
    .slice(source.indexOf("'use strict';"))
    .replace(/window\.SPACE = SPACE;[\s\S]*$/, 'return SPACE;');
  const chrome = ['createFrameLoop', 'buildNav', 'clamp', 'initMobileHints', 'initMobileInfoPanels',
    'initSceneAccessibility', 'prefersReducedMotion', 'revealRailButton', 'setText'];
  const SPACE = new Function('window', 'document', 'THREE', ...chrome, body)(
    window, document, THREE, ...chrome.map((name) => name === 'clamp'
      ? (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
      : () => {}),
  );
  return { SPACE, THREE, window, resize() { listeners.resize?.forEach((fn) => fn()); } };
}

test('labels stay on their objects when a small height change keeps the canvas size', () => {
  const { SPACE, THREE, window, resize } = loadSpace();
  const setup = SPACE.createScene({ composer: false });
  setup.camera.position.set(0, 0, 10);
  setup.camera.lookAt(0, 0, 0);
  setup.camera.updateMatrixWorld();

  // A phone's address bar collapsing grows the viewport by less than 120 px.
  window.innerHeight = 880;
  resize();
  setup.render();
  expect([setup.renderer.width, setup.renderer.height]).toEqual([400, 800]);

  const label = { style: {} as Record<string, unknown> };
  SPACE.projectToScreen(new THREE.Object3D(), label, setup.camera, 0, true);
  expect(label.style.transform).toBe('translate(-50%, -50%) translate(200px, 400px)');

  // A quality change must not slip the skipped size past resize().
  setup.quality.setShadowLight(null);
  expect([setup.renderer.width, setup.renderer.height]).toEqual([400, 800]);
});
