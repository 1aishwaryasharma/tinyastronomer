import { expect, test } from 'bun:test';
import { watchSceneLoad } from './public/scene-load-failure.js';

function page(hidden = false) {
  const classes = new Set<string>(hidden ? ['hidden'] : []);
  const text = { textContent: 'Charting the planets…' };
  const bar = { hidden: false };
  const attributes = new Map<string, string>([['role', 'status']]);
  const loader = {
    classList: { contains: (name: string) => classes.has(name), add: (name: string) => classes.add(name) },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    querySelector: (selector: string) => (selector === '.loader-text' ? text : selector === '.loader-bar' ? bar : null),
  };
  const win = new EventTarget();
  const doc = { getElementById: (id: string) => (id === 'loader' ? loader : null) };
  watchSceneLoad(win as never, doc as never);
  const fire = (type: string, target?: object) => {
    const event = new Event(type);
    if (target) Object.defineProperty(event, 'target', { value: target });
    win.dispatchEvent(event);
  };
  return { win, text, bar, attributes, classes, fire };
}

test('a thrown error while the loader shows becomes a visible alert', () => {
  const p = page();
  p.fire('error');
  expect(p.attributes.get('role')).toBe('alert');
  expect(p.text.textContent).toContain('could not load');
  expect(p.bar.hidden).toBe(true);
});

test('a script that fails to download is reported too', () => {
  const p = page();
  p.fire('error', { tagName: 'SCRIPT' });
  expect(p.attributes.get('role')).toBe('alert');
});

test('a rejected startup promise is reported', () => {
  const p = page();
  p.fire('unhandledrejection');
  expect(p.attributes.get('role')).toBe('alert');
});

test('a failed image or texture is not a page failure', () => {
  const p = page();
  p.fire('error', { tagName: 'IMG' });
  expect(p.attributes.get('role')).toBe('status');
  expect(p.text.textContent).toBe('Charting the planets…');
});

test('errors after the scene is showing leave the page alone', () => {
  const p = page(true);
  p.fire('error');
  expect(p.attributes.get('role')).toBe('status');
});
