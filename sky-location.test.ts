import { describe, expect, test } from 'bun:test';
import { TZ_ALIASES, TZ_CITY_COORDS, TZ_COORDS, TZ_SHARED_CLOCKS } from './public/tz-coords.js';
import {
  LOCATION_STORAGE_KEY,
  describeLocation,
  locationTimeZone,
  nearestTimeZone,
  requestDeviceLocation,
  resolveLocation,
  setManualLocation,
  timeZoneLabel,
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

test('names browsers report from CLDR resolve to the place they mean', () => {
  // Chrome's ICU reports CLDR's canonical IDs, some of which tzdb retired or
  // files elsewhere: Coral_Harbour is Atikokan, not Panama.
  for (const [reported, zone] of [
    ['America/Coral_Harbour', 'America/Atikokan'], ['Asia/Calcutta', 'Asia/Kolkata'],
    ['Africa/Asmera', 'Africa/Asmara'], ['America/Godthab', 'America/Nuuk'], ['Pacific/Truk', 'Pacific/Chuuk'],
  ]) expect(TZ_ALIASES[reported], reported).toBe(zone);
  const module = buildModule(
    'PA\t+0858-07932\tAmerica/Panama\n',
    'CA\t+484531-0913718\tAmerica/Atikokan\n',
    '# Non-zone.tab locations\n# Link\tTARGET\tLINK-NAME\nLink\tAmerica/Panama\tAmerica/Coral_Harbour\n',
    '<type name="cayzs" alias="America/Coral_Harbour America/Atikokan" iana="America/Atikokan"/>',
  );
  expect(module.slice(module.indexOf('TZ_ALIASES'), module.indexOf('TZ_SHARED_CLOCKS'))).toContain('"America/Coral_Harbour": "America/Atikokan"');
  expect(module.slice(module.indexOf('TZ_SHARED_CLOCKS'))).not.toContain('Coral_Harbour');
});

test('the generator refuses backward data it cannot classify', () => {
  const zones = 'CI\t+0519-00402\tAfrica/Abidjan\n';
  expect(() => buildModule(zones, '', '# A new reason\n# Link\tTARGET\tLINK-NAME\nLink\tAfrica/Abidjan\tX/Y\n'))
    .toThrow('Unknown backward section');
  expect(() => buildModule(zones, '', 'Zone\tABC1DEF\t-1:00\t-\tABC\n')).toThrow('Unknown Zone');
  // A heading without its column header does not inherit the last section.
  expect(() => buildModule(zones, '', '# Alternate names for the same location\n# Link\tTARGET\tLINK-NAME\n\n# Something new\nLink\tAfrica/Abidjan\tX/Y\n'))
    .toThrow('Link before any section');
  // POSIX clock zones and a "#=" successor that is not in the table are rough.
  const module = buildModule(
    zones + 'US\t+404251-0740023\tAmerica/New_York\n',
    '',
    '# Pre-1993 naming conventions\n# Link\tTARGET\tLINK-NAME\nLink\tAfrica/Abidjan\tIceland\t#= Atlantic/Reykjavik\n\nZone\tEST5EDT\t-5:00\tUSback\tE%sT\n',
  );
  const shared = module.slice(module.indexOf('TZ_SHARED_CLOCKS'));
  expect(shared).toContain('"Iceland": "Africa/Abidjan"');
  expect(shared).toContain('"EST5EDT": "America/New_York"');
});

test('legacy and per-country zone names resolve to real coordinates', () => {
  // Chrome reports Asia/Calcutta for all of India; zone1970.tab alone lacks it.
  expect(TZ_ALIASES['Asia/Calcutta']).toBe('Asia/Kolkata');
  for (const zone of ['Asia/Saigon', 'Asia/Katmandu', 'Europe/Kiev', 'America/Buenos_Aires']) {
    expect(TZ_COORDS[TZ_ALIASES[zone]] ?? TZ_CITY_COORDS[TZ_ALIASES[zone]]).toBeDefined();
  }
  for (const zone of ['Europe/Amsterdam', 'Europe/Stockholm', 'Asia/Kuala_Lumpur', 'Asia/Kuwait', 'Africa/Accra']) {
    expect(TZ_CITY_COORDS[zone]).toBeDefined();
  }
  // backward links promise a shared clock, not a shared place. Renames (and
  // #= successors) are exact; merged places and clock names are rough.
  expect(TZ_ALIASES['Africa/Asmera']).toBe('Africa/Asmara');
  expect(TZ_ALIASES['Pacific/Truk']).toBe('Pacific/Chuuk');
  expect(TZ_ALIASES.Iceland).toBe('Atlantic/Reykjavik');
  for (const zone of ['Africa/Timbuktu', 'Pacific/Yap', 'Antarctica/South_Pole', 'Atlantic/Jan_Mayen', 'Asia/Harbin', 'Asia/Chungking', 'EST', 'CET']) {
    expect(TZ_ALIASES[zone], zone).toBeUndefined();
    expect(TZ_SHARED_CLOCKS[zone], zone).toBeDefined();
  }
  const module = buildModule(
    'BE,LU,NL\t+5050+00420\tEurope/Brussels\nCI,ML\t+0519-00402\tAfrica/Abidjan\nIS\t+6409-02151\tAtlantic/Reykjavik\n',
    'NL\t+5222+00454\tEurope/Amsterdam\n',
    [
      '# Pre-1993 naming conventions',
      '# Link\tTARGET\tLINK-NAME\t#= TARGET1',
      'Link\tEurope/Brussels\tCET',
      'Link\tAfrica/Abidjan\tIceland\t#= Atlantic/Reykjavik',
      '',
      '# Non-zone.tab locations with timestamps since 1970 that duplicate',
      '# those of an existing location',
      '# Link\tTARGET\tLINK-NAME',
      'Link\tAfrica/Abidjan\tAfrica/Timbuktu',
      '',
      '# Alternate names for the same location',
      '# Link\tTARGET\tLINK-NAME',
      'Link\tEurope/Amsterdam\tEurope/Old_Name # comment',
    ].join('\n'),
  );
  expect(module).toContain('"Europe/Amsterdam": [52.37, 4.9]');
  expect(module).toContain('"Iceland": "Atlantic/Reykjavik"');
  expect(module).toContain('"Europe/Old_Name": "Europe/Amsterdam"');
  const shared = module.slice(module.indexOf('TZ_SHARED_CLOCKS'));
  expect(shared).toContain('"Africa/Timbuktu": "Africa/Abidjan"');
  expect(shared).toContain('"CET": "Europe/Brussels"');
});

describe('location resolution', () => {
  test('uses a silent time-zone guess without touching geolocation or storage', () => {
    const env = fakeEnvironment();
    Object.defineProperty(env.navigator, 'geolocation', {
      get() { throw new Error('geolocation must not be read'); },
    });
    const location = resolveLocation(env);
    expect(location).toMatchObject({ lat: 41.85, lon: -87.65, source: 'tz', label: 'Chicago area' });
    expect(env.values.has(LOCATION_STORAGE_KEY)).toBe(false);
  });

  test('prefers a valid stored location', () => {
    const env = fakeEnvironment();
    env.values.set(LOCATION_STORAGE_KEY, JSON.stringify({ lat: -33.9, lon: 151.2, source: 'manual' }));
    expect(resolveLocation(env)).toMatchObject({ lat: -33.9, lon: 151.2, source: 'manual' });
  });

  test('legacy browser zone names are located, not sent to the equator', () => {
    const location = resolveLocation(fakeEnvironment('Asia/Calcutta'));
    expect(location).toMatchObject({ lat: 22.53, lon: 88.37, source: 'tz', approximate: false, label: 'Kolkata area' });
  });

  test('a zone that only shares another country\'s clock is a labelled rough guess', () => {
    // Africa/Timbuktu (Mali) runs on Abidjan (Ivory Coast) time.
    expect(resolveLocation(fakeEnvironment('Africa/Timbuktu'))).toMatchObject({
      lat: 5.32, lon: -4.03, approximate: true, label: 'your area (rough guess)',
    });
  });

  test('a stored time-zone guess is redone, so old equator fallbacks heal', () => {
    const env = fakeEnvironment('Asia/Calcutta');
    env.values.set(LOCATION_STORAGE_KEY, JSON.stringify({ lat: 0, lon: 82.5, source: 'tz', timeZone: 'Asia/Calcutta', approximate: true }));
    expect(resolveLocation(env)).toMatchObject({ lat: 22.53, approximate: false });
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

describe('location time zones', () => {
  test('manual coordinates use the nearest zone', () => {
    expect(nearestTimeZone(35.7, 139.7)).toBe('Asia/Tokyo');
    expect(nearestTimeZone(-33.9, 151.2)).toBe('Australia/Sydney');
    expect(nearestTimeZone(21.3, -157.9)).toBe('Pacific/Honolulu');
    // Towns on a fixed clock must not capture their daylight-saving neighbours.
    expect(nearestTimeZone(49.5, -115.77)).toBe('America/Edmonton'); // Cranbrook, not Creston
    expect(nearestTimeZone(48.6, -93.4)).toBe('America/Winnipeg'); // Fort Frances, not Atikokan
    const env = fakeEnvironment('Europe/London');
    expect(locationTimeZone({ lat: 35.7, lon: 139.7, source: 'manual' }, env)).toBe('Asia/Tokyo');
    expect(timeZoneLabel('Asia/Tokyo')).toBe('Tokyo time');
  });

  test('device and time-zone locations keep the device clock', () => {
    const env = fakeEnvironment('Europe/London');
    expect(locationTimeZone({ lat: 35.7, lon: 139.7, source: 'geo' }, env)).toBe('Europe/London');
    expect(locationTimeZone({ lat: 51.5, lon: -0.1, source: 'tz' }, env)).toBe('Europe/London');
  });
});

test('a shared-clock zone finds its target wherever the generator put it', async () => {
  const { locateZone } = await import('./public/sky-location.js');
  // The generator keeps a shared target from zone1970 or zone.tab, so the
  // browser must look in both tables, not fall back to the equator.
  const tables = {
    TZ_COORDS: {},
    TZ_CITY_COORDS: { 'Europe/Amsterdam': [52.37, 4.9] },
    TZ_ALIASES: {},
    TZ_SHARED_CLOCKS: { 'Europe/Somewhere': 'Europe/Amsterdam' },
  };
  expect(locateZone('Europe/Somewhere', tables)).toEqual({ lat: 52.37, lon: 4.9, approximate: true });
  expect(locateZone('Europe/Amsterdam', tables)).toEqual({ lat: 52.37, lon: 4.9, approximate: false, zone: 'Europe/Amsterdam' });
  expect(locateZone('Etc/Unknown', tables)).toBeNull();
});

test('a rough location reads as a place inside sentences', () => {
  // The label is dropped into "Sky forecast updated for …" and "At 9:30 pm from …".
  const location = resolveLocation(fakeEnvironment('Etc/Unknown'));
  expect(`Sky forecast updated for ${location.label}.`).toBe('Sky forecast updated for your area (rough guess).');
});

test('one lookup gives both the coordinates and the zone used for the label', async () => {
  const { locateZone } = await import('./public/sky-location.js');
  expect(locateZone('Asia/Calcutta')).toMatchObject({ zone: 'Asia/Kolkata', approximate: false });
  expect(resolveLocation(fakeEnvironment('Asia/Calcutta')).label).toBe('Kolkata area');
});
