import { describe, expect, test } from 'bun:test';
import {
  Astronomy,
  bodyReport,
  brightnessDescription,
  compassDirection,
  moonReport,
  nightWindow,
  positionAt,
} from './public/sky-forecast.js';

const observer = new Astronomy.Observer(37.77, -122.42, 10);
const sampleTime = new Date('2026-09-08T03:00:00Z');
const window = nightWindow(observer, new Date(2026, 8, 7, 12));

function expectMinute(actual: Date | null, iso: string) {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual?.getTime() ?? 0) - new Date(iso).getTime())).toBeLessThan(60_000);
}

describe('Sky Tonight forecast fixture', () => {
  test('matches the checked San Francisco sky positions', () => {
    const expected = {
      Venus: [9.6, 242.5, -4.7],
      Saturn: [-8.3, 79.5, 0.3],
      Mars: [-26.1, 339.7, 1.2],
      Moon: [-21.2, 320.8, -7.6],
    } as const;

    for (const [body, [altitude, azimuth, magnitude]] of Object.entries(expected)) {
      const result = positionAt(body, observer, sampleTime);
      expect(result.altitude).toBeCloseTo(altitude, 1);
      expect(result.azimuth).toBeCloseTo(azimuth, 1);
      expect(result.magnitude).toBeCloseTo(magnitude, 1);
    }
  });

  test('finds the checked night events and constellations', () => {
    expectMinute(window.sunset, '2026-09-08T02:29:00Z');
    expectMinute(window.astroDusk, '2026-09-08T03:59:00Z');

    const expectedSets = {
      Venus: '2026-09-08T03:55:00Z',
      Saturn: '2026-09-08T16:03:00Z',
      Mars: '2026-09-08T23:37:00Z',
      Moon: '2026-09-09T01:15:00Z',
    };
    for (const [body, expectedSet] of Object.entries(expectedSets)) {
      expectMinute(bodyReport(body, observer, window, sampleTime).set, expectedSet);
    }
    expect(bodyReport('Mars', observer, window, sampleTime).constellation).toBe('Gemini');
  });

  test('reports the checked crescent Moon', () => {
    const moon = moonReport(observer, window, sampleTime);
    expect(moon.phaseAngle).toBeCloseTo(320.6, 1);
    expect(moon.illumination).toBeCloseTo(0.11, 2);
    expect(moon.phase).toBe('Waning crescent');
  });
});

test('polar summer reports polar day instead of inventing a sunset', () => {
  const polar = nightWindow(new Astronomy.Observer(80, 0, 0), new Date(2026, 5, 21, 12));
  expect(polar.polar).toBe('day');
  expect(polar.sunset).toBeNull();
  expect(polar.end.getTime() - polar.start.getTime()).toBe(24 * 60 * 60 * 1000);
});

test('compass directions wrap around the 16 points', () => {
  expect(compassDirection(0)).toBe('N');
  expect(compassDirection(45)).toBe('NE');
  expect(compassDirection(180)).toBe('S');
  expect(compassDirection(348)).toBe('NNW');
});

test('brightness descriptions switch at the documented thresholds', () => {
  expect(brightnessDescription(-3.1)).toBe('brighter than any star');
  expect(brightnessDescription(-3)).toBe('as bright as the brightest stars');
  expect(brightnessDescription(0)).toBe('bright, easy to spot');
  expect(brightnessDescription(2)).toBe('faint, needs a dark sky');
  expect(brightnessDescription(4)).toBe('binoculars');
  expect(brightnessDescription(6)).toBe('telescope');
});
