import { describe, expect, test } from 'bun:test';
import {
  Astronomy,
  bodyReport,
  brightnessDescription,
  compassDirection,
  conjunctions,
  defaultNightMinutes,
  moonReport,
  nightSpanMinutes,
  nightWindow,
  positionAt,
  timeInNight,
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

describe('Sky Tonight time-within-window', () => {
  const nextNight = nightWindow(observer, new Date(2026, 8, 8, 12));
  const duskMinutes = defaultNightMinutes(window, new Date('2026-09-08T12:00:00Z'), false);

  test('defaults to astronomical dusk when the clock is outside the window', () => {
    expect(duskMinutes).toBeGreaterThan(0);
    const dusk = timeInNight(window, duskMinutes);
    expect(Math.abs(dusk.getTime() - window.astroDusk.getTime())).toBeLessThan(5 * 60 * 1000);
    expect(positionAt('Sun', observer, dusk).altitude).toBeLessThan(-6);
  });

  test('the slider ends are sunset and sunrise, so night→day on drag is expected', () => {
    expect(positionAt('Sun', observer, timeInNight(window, 0)).altitude).toBeGreaterThan(-6);
    expect(positionAt('Sun', observer, timeInNight(window, nightSpanMinutes(window))).altitude).toBeGreaterThan(-6);
  });

  test('the same slider minutes stay in the same part of the next night', () => {
    const dusk = timeInNight(nextNight, duskMinutes);
    const dawn = timeInNight(nextNight, nightSpanMinutes(window));
    expect(positionAt('Sun', observer, dusk).altitude).toBeLessThan(-6);
    expect(positionAt('Sun', observer, dawn).altitude).toBeGreaterThan(-6);
    expect(dusk.getTime() - nextNight.start.getTime()).toBe(duskMinutes * 60 * 1000);
  });
});

describe('Sky Tonight accuracy regressions', () => {
  test('a location in another time zone gets its own night for the chosen date', () => {
    const tokyo = nightWindow(new Astronomy.Observer(35.7, 139.7, 0), new Date(2026, 8, 27, 12));
    expectMinute(tokyo.sunset, '2026-09-27T08:31:00Z');
    const honolulu = nightWindow(new Astronomy.Observer(21.3, -157.9, 0), new Date(2026, 8, 27, 12));
    expectMinute(honolulu.sunset, '2026-09-28T04:23:00Z');
  });

  test('twilight events from a later night are not reported for tonight', () => {
    const tromso = nightWindow(new Astronomy.Observer(69.6, 18.9, 0), new Date(2027, 7, 13, 12));
    for (const key of ['civilDusk', 'astroDusk', 'astroDawn', 'civilDawn'] as const) {
      const event = tromso[key];
      if (event) {
        expect(event.getTime()).toBeGreaterThanOrEqual(tromso.start.getTime());
        expect(event.getTime()).toBeLessThanOrEqual(tromso.end.getTime());
      }
    }
  });

  test('Mercury is not called visible when it sets in bright twilight', () => {
    const sf = new Astronomy.Observer(37.8, -122.4, 0);
    const night = nightWindow(sf, new Date(2026, 8, 27, 12));
    expect(bodyReport('Mercury', sf, night).visible).toBe(false);
    const venus = bodyReport('Venus', sf, night);
    expect(venus.visible).toBe(true);
    expect(positionAt('Sun', sf, venus.bestTime!).altitude).toBeLessThanOrEqual(-3);
  });

  test('highlighted pairings only include objects that are up in a dark sky', () => {
    const sf = new Astronomy.Observer(37.8, -122.4, 0);
    // Oct 5, 2026: the Moon is 1.5° from Mars, but both are still below the horizon at dusk.
    for (let day = 1; day <= 40; day += 1) {
      const night = nightWindow(sf, new Date(2026, 9, day, 12));
      for (const pair of conjunctions(sf, night)) {
        expect(positionAt('Sun', sf, pair.time).altitude).toBeLessThanOrEqual(-3);
        for (const body of pair.bodies) expect(positionAt(body, sf, pair.time).altitude).toBeGreaterThan(5);
      }
    }
  });
});

test('heights read in fists and directions in words', async () => {
  const { compassWords, darkEnoughFor, fistHeight, whereToLook, whereToLookShort } = await import('./public/sky-forecast.js');
  expect(fistHeight(1)).toBe('right on the horizon');
  expect(fistHeight(5)).toBe('half a fist up');
  // 7–7.5° once rounded to "0½ fists up".
  for (const altitude of [7, 7.2, 7.49]) expect(fistHeight(altitude)).toBe('half a fist up');
  expect(fistHeight(7.5)).toBe('1 fist up');
  expect(fistHeight(10)).toBe('1 fist up');
  expect(fistHeight(14)).toBe('1½ fists up');
  expect(fistHeight(19)).toBe('2 fists up');
  expect(fistHeight(80)).toBe('almost straight overhead');
  expect(compassWords('ESE')).toBe('east-southeast');
  expect(whereToLook({ altitude: 19, compass: 'ESE' })).toBe('2 fists up in the east-southeast');
  expect(whereToLook({ altitude: 81, compass: 'NNW' })).toBe('almost straight overhead');
  expect(whereToLookShort({ altitude: 19, compass: 'ESE' })).toBe('ESE, 2 fists up');
  expect(whereToLookShort({ altitude: 81, compass: 'NNW' })).toBe('straight up');
  // Venus shows in brighter twilight than everything else.
  expect(darkEnoughFor('Jupiter', -1)).toBe(false);
  expect(darkEnoughFor('Jupiter', -6)).toBe(true);
  expect(darkEnoughFor('Venus', -4)).toBe(true);
});
