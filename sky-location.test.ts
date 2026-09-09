import { describe, expect, test } from 'bun:test';
import { TZ_COORDS } from './public/tz-coords.js';
import {
  LOCATION_STORAGE_KEY,
  describeLocation,
  requestDeviceLocation,
  resolveLocation,
  setManualLocation,
} from './public/sky-location.js';
import { buildModule, parseIso6709 } from './tools/build-tz-coords.ts';

function fakeEnvironment(timeZone = 'America/Chicago') {
  const values = new Map<string, string>();
  return {
    Date,
    Intl: {
      DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }),
    },
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    navigator: {},
    values,
  };
}

test('the generated IANA table covers common browser time zones', () => {
  expect(Object.keys(TZ_COORDS).length).toBeGreaterThan(300);
  expect(TZ_COORDS['America/Chicago']).toEqual([41.85, -87.65]);
  expect(TZ_COORDS['Europe/London']).toEqual([51.51, -0.13]);
});

test('the generator parses minute and second ISO 6709 coordinates', () => {
  expect(parseIso6709('+4151-08739')).toEqual([41.85, -87.65]);
  const [lat, lon] = parseIso6709('+513030-0000731');
  expect(lat).toBeCloseTo(51.5083, 4);
  expect(lon).toBeCloseTo(-0.1253, 4);
  expect(buildModule('US\t+4151-08739\tAmerica/Chicago\n')).toContain('"America/Chicago": [41.85, -87.65]');
});

describe('location resolution', () => {
  test('uses and stores a silent time-zone guess without touching geolocation', () => {
    const env = fakeEnvironment();
    Object.defineProperty(env.navigator, 'geolocation', {
      get() { throw new Error('geolocation must not be read'); },
    });
    const location = resolveLocation(env);
    expect(location).toMatchObject({ lat: 41.85, lon: -87.65, source: 'tz', label: 'Chicago area' });
    expect(JSON.parse(env.values.get(LOCATION_STORAGE_KEY)!)).toMatchObject({ source: 'tz' });
  });

  test('prefers a valid stored location', () => {
    const env = fakeEnvironment();
    env.values.set(LOCATION_STORAGE_KEY, JSON.stringify({ lat: -33.9, lon: 151.2, source: 'manual' }));
    expect(resolveLocation(env)).toMatchObject({ lat: -33.9, lon: 151.2, source: 'manual' });
  });

  test('falls back to the UTC offset when the zone is unknown', () => {
    const env = fakeEnvironment('Etc/Unknown');
    expect(resolveLocation(env)).toMatchObject({ lat: 0, source: 'tz', approximate: true });
  });
});

test('device location rounds to one decimal and persists only after a request', async () => {
  const env = fakeEnvironment();
  env.navigator.geolocation = {
    getCurrentPosition(success: Function, _failure: Function, options: object) {
      expect(options).toEqual({ enableHighAccuracy: false, maximumAge: 21_600_000, timeout: 10_000 });
      success({ coords: { latitude: 37.7749, longitude: -122.4194 } });
    },
  };
  await expect(requestDeviceLocation(env)).resolves.toMatchObject({
    lat: 37.8,
    lon: -122.4,
    source: 'geo',
    label: '37.8°N 122.4°W',
  });
});

test('device location errors use short, useful copy', async () => {
  const env = fakeEnvironment();
  env.navigator.geolocation = {
    getCurrentPosition(_success: Function, failure: Function) { failure({ code: 1 }); },
  };
  await expect(requestDeviceLocation(env)).rejects.toThrow('Location permission was denied.');
});

test('manual locations validate, round, describe, and store', () => {
  const env = fakeEnvironment();
  expect(setManualLocation('-33.86', '151.24', env)).toMatchObject({
    lat: -33.9,
    lon: 151.2,
    source: 'manual',
  });
  expect(describeLocation({ lat: -33.9, lon: 151.2, source: 'manual' })).toBe('33.9°S 151.2°E');
  expect(() => setManualLocation(91, 0, env)).toThrow('Latitude must be between');
  expect(() => setManualLocation(0, -181, env)).toThrow('Longitude must be between');
  expect(() => setManualLocation('', '', env)).toThrow('Enter both');
});
