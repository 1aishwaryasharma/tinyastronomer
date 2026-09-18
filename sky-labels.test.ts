import { expect, test } from 'bun:test';
import { layoutSkyLabels } from './public/sky-labels.js';

const names = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
for (const viewport of [320, 402, 820]) {
  for (const edge of ['left', 'center', 'right']) {
    test(`full mobile names stay separate in a conjunction at ${edge}, ${viewport}px`, () => {
      const bounds = { left: 26, right: viewport - 26, top: 100, bottom: 400 };
      const x = edge === 'left' ? bounds.left : edge === 'right' ? bounds.right : viewport / 2;
      const points = names.map((name, i) => ({ name, x, y: 380 - i * 2 }));
      const labels = layoutSkyLabels(points, bounds, name => name.length * 7);
      expect(labels.map(label => label.name)).toEqual(names);
      for (const label of labels) {
        expect(label.labelX).toBeGreaterThanOrEqual(bounds.left);
        expect(label.labelX + label.width).toBeLessThanOrEqual(bounds.right);
        expect(label.labelY - 12).toBeGreaterThanOrEqual(bounds.top);
        expect(label.labelY + 4).toBeLessThanOrEqual(bounds.bottom);
        for (const other of labels) {
          if (other === label) continue;
          const overlap = label.labelX < other.labelX + other.width && label.labelX + label.width > other.labelX
            && label.labelY - 12 < other.labelY + 4 && label.labelY + 4 > other.labelY - 12;
          expect(overlap).toBe(false);
        }
        for (const point of points) {
          const coversMarker = label.labelX < point.x + 8 && label.labelX + label.width > point.x - 8
            && label.labelY - 12 < point.y + 8 && label.labelY + 4 > point.y - 8;
          expect(coversMarker).toBe(false);
        }
      }
    });
  }
}
