import { expect, test } from 'bun:test';
import * as A from './public/vendor/astronomy-engine/astronomy.min.js';
import { STAR_CATALOG } from './public/assets/stars/catalog.js';
import { starPositions, starOpacity, brightStarsNow } from './public/sky-stars.js';

test('bright catalog has valid coordinates, unique IDs, and the source Sirius record', () => {
  expect(STAR_CATALOG.length).toBe(925);
  expect(new Set(STAR_CATALOG.map(row => row[0])).size).toBe(925);
  for (const [id, , ra, dec, mag, pmra, pmdec] of STAR_CATALOG) {
    expect(id).toBeGreaterThan(0);
    expect(ra).toBeGreaterThanOrEqual(0); expect(ra).toBeLessThan(24);
    expect(Math.abs(dec)).toBeLessThanOrEqual(90); expect(mag).toBeLessThanOrEqual(4.5);
    expect(Number.isFinite(pmra) && Number.isFinite(pmdec)).toBe(true);
  }
  expect(STAR_CATALOG.find(row => row[1] === 'Sirius')?.slice(0, 5)).toEqual([32263, 'Sirius', 6.752481, -16.716116, -1.44]);
});

test('horizon transform agrees with independent RA/Dec pathway at J2000', () => {
  const date = new Date('2000-01-01T12:00:00Z');
  for (const latitude of [41.9, -33.9, 0, 90, -90]) {
    const observer = new A.Observer(latitude, 151.2, 0);
    const positions = starPositions(observer, date);
    for (const name of ['Sirius', 'Polaris', 'Canopus']) {
      const row = STAR_CATALOG.find(row => row[1] === name)!;
      const vec = A.VectorFromSphere(new A.Spherical(row[3], row[2] * 15, 1), date);
      const eq = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(date), vec));
      const expected = A.Horizon(date, observer, eq.ra, eq.dec, 'normal');
      const actual = positions.find(star => star.name === name)!;
      expect(actual.altitude).toBeCloseTo(expected.altitude, 7);
      expect(actual.azimuth).toBeCloseTo(expected.azimuth, 7);
    }
  }
});

test('proper motion and horizon position agree with DefineStar reference within chart precision', () => {
  const date = new Date('2026-09-17T04:00:00Z'), observer = new A.Observer(41.9, -87.7, 0);
  const sirius = STAR_CATALOG.find(row => row[1] === 'Sirius')!;
  const years = (date.getTime() - Date.parse('2000-01-01T12:00:00Z')) / (365.25 * 86400000);
  const ra = sirius[2] + sirius[5] * years / (3600000 * 15 * Math.cos(sirius[3] * Math.PI / 180));
  const dec = sirius[3] + sirius[6] * years / 3600000;
  A.DefineStar('Star1', ra, dec, 8.6);
  const eq = A.Equator('Star1', date, observer, true, true);
  const expected = A.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  const actual = starPositions(observer, date).find(star => star.name === 'Sirius')!;
  // DefineStar includes annual aberration; vector chart intentionally omits it.
  expect(Math.abs(actual.altitude - expected.altitude)).toBeLessThan(0.02);
  expect(Math.abs(actual.azimuth - expected.azimuth)).toBeLessThan(0.02);
});

test('stars move with time and observer, with correct polar visibility', () => {
  const date = new Date('2026-09-17T04:00:00Z');
  const north = starPositions(new A.Observer(45, 0, 0), date);
  const south = starPositions(new A.Observer(-45, 0, 0), date);
  expect(north.find(s => s.name === 'Polaris')!.altitude).toBeGreaterThan(44);
  expect(south.find(s => s.name === 'Polaris')!.altitude).toBeLessThan(-44);
  const later = starPositions(new A.Observer(45, 0, 0), new Date(date.getTime() + 6 * 3600000));
  expect(Math.max(...north.map((star, index) => Math.abs(star.altitude - later[index].altitude)))).toBeGreaterThan(10);
  for (const star of [...north, ...south, ...later]) {
    expect(Number.isFinite(star.altitude)).toBe(true);
    expect(star.azimuth).toBeGreaterThanOrEqual(0); expect(star.azimuth).toBeLessThan(360);
  }
});

test('guide omits low stars and daylight and orders nighttime targets by brightness', () => {
  const positions = starPositions(new A.Observer(-33.9, 151.2, 0), new Date('2026-01-15T12:00:00Z'));
  const guide = brightStarsNow(positions, -20);
  expect(guide.length).toBe(5);
  expect(guide.every(star => star.altitude >= 10 && star.name)).toBe(true);
  expect(guide.map(star => star.magnitude)).toEqual(guide.map(star => star.magnitude).sort((a,b) => a-b));
  expect(brightStarsNow(positions, 10)).toEqual([]);
  expect(starOpacity(-1.44, 0)).toBe(0);
  expect(starOpacity(4.5, -10)).toBe(0);
  expect(starOpacity(4.5, -18)).toBeGreaterThan(0);
});
