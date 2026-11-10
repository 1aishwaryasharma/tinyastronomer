import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { TZ_ALIASES, TZ_CITY_COORDS, TZ_COORDS, TZ_SHARED_CLOCKS } from './public/tz-coords.js';
import {
  LOCATION_STORAGE_KEY,
  describeLocation,
  loadPlaces,
  locationTimeZone,
  nearestPlace,
  nearestTimeZone,
  normalizePlaceName,
  parsePlaces,
  placeLabel,
  placeOptions,
  searchPlaces,
  setPlaceLocation,
  requestDeviceLocation,
  resolveLocation,
  setManualLocation,
  timeZoneLabel,
} from './public/sky-location.js';
import { buildModule, parseIso6709 } from './tools/build-tz-coords.ts';
import { buildModule as buildPlacesModule, parseAdmin1, parseCities } from './tools/build-places.ts';
import * as PLACE_DATA from './public/sky-places.js';

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
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
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

test('a stored device location keeps the clock it was taken on after travel', async () => {
  const tokyo = placeEnvironment('Asia/Tokyo');
  tokyo.navigator.geolocation = {
    getCurrentPosition(success: Function) { success({ coords: { latitude: 35.68, longitude: 139.77 } }); },
  };
  await requestDeviceLocation(tokyo);
  const london = placeEnvironment('Europe/London');
  london.values.set(LOCATION_STORAGE_KEY, tokyo.values.get(LOCATION_STORAGE_KEY)!);
  expect(locationTimeZone(resolveLocation(london), london)).toBe('Asia/Tokyo');

  london.values.set(LOCATION_STORAGE_KEY, JSON.stringify({ lat: 35.7, lon: 139.8, source: 'geo' }));
  expect(resolveLocation(london)).toMatchObject({ source: 'geo', label: '35.7°N 139.8°E' });
  expect(locationTimeZone(resolveLocation(london), london)).toBe('Europe/London');
});

test('device location errors use short, useful copy', async () => {
  const env = fakeEnvironment();
  env.navigator.geolocation = {
    getCurrentPosition(_success: Function, failure: Function) { failure({ code: 1 }); },
  };
  await expect(requestDeviceLocation(env)).rejects.toThrow('Location permission was denied.');
});

test('device location stops waiting when the browser never answers the permission prompt', async () => {
  const env = fakeEnvironment();
  let answer: Function = () => {};
  let wait: Function = () => {};
  env.setTimeout = (callback: () => void, delay: number) => {
    expect(delay).toBe(30_000);
    wait = callback;
    return 1;
  };
  env.navigator.geolocation = {
    getCurrentPosition(success: Function) { answer = success; },
  };
  const request = requestDeviceLocation(env);
  wait();
  await expect(request).rejects.toThrow('Your browser did not answer. Try again, or set a place by hand.');
  answer({ coords: { latitude: 37.7749, longitude: -122.4194 } });
  expect(env.values.size).toBe(0);
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
    const env = placeEnvironment('Europe/London');
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

function placeEnvironment(timeZone = 'America/Chicago', unsupportedZones: readonly string[] = []) {
  const env = fakeEnvironment(timeZone);
  function DateTimeFormat(locales?: string, options?: Intl.DateTimeFormatOptions) {
    if (options?.timeZone && unsupportedZones.includes(options.timeZone)) throw new RangeError('Unsupported time zone');
    return locales === undefined ? { resolvedOptions: () => ({ timeZone }) } : new Intl.DateTimeFormat(locales, options);
  }
  return { ...env, Intl: { DateTimeFormat } };
}

const PLACES = parsePlaces(PLACE_DATA);

describe('place search', () => {
  const fixture = parsePlaces({
    ZONES: ['America/Chicago', 'America/New_York', 'Europe/Paris', 'Europe/Warsaw'],
    PLACES: [
      'Paris|FR|48.9|2.4|2',
      'New York City|US|40.7|-74|1',
      'Springfield|US|37.2|-93.3|0|Missouri',
      'Springfield|US|42.1|-72.6|1|Massachusetts',
      'Łódź|PL|51.8|19.5|3||Lodz',
      'Paris|US|33.7|-95.6|0',
      'West Springfield|US|42.1|-72.6|1',
      'St. Louis|US|38.6|-90.2|0',
    ],
  });
  const names = (query: string) => searchPlaces(fixture, query).map(placeLabel);

  test('ranks whole names, then name starts, then later words, each by population', () => {
    expect(names('springfield')).toEqual([
      'Springfield, Missouri, United States',
      'Springfield, Massachusetts, United States',
      'West Springfield, United States',
    ]);
    expect(names('york')).toEqual(['New York City, United States']);
    expect(names('par')).toEqual(['Paris, France', 'Paris, United States']);
  });

  test('ignores accents, case and punctuation, and knows ASCII spellings', () => {
    expect(normalizePlaceName('São Paulo')).toBe('sao paulo');
    expect(names('ST LOUIS')).toEqual(['St. Louis, United States']);
    expect(names('lodz')).toEqual(['Łódź, Poland']);
  });

  test('a comma narrows by region or country, part by part', () => {
    // West Springfield's name is unique, so it carries no region to match.
    expect(names('springfield, mass')).toEqual(['Springfield, Massachusetts, United States']);
    expect(names('paris, us')).toEqual(['Paris, United States']);
    expect(names('paris, fr')).toEqual(['Paris, France']);
    expect(names('Springfield, Missouri, United States')).toEqual(['Springfield, Missouri, United States']);
  });

  test('waits for two letters and caps the list', () => {
    expect(names('p')).toEqual([]);
    expect(searchPlaces(PLACES, 'san', 5)).toHaveLength(5);
  });

  test('same-looking results show where they are', () => {
    const twins = parsePlaces({ ZONES: ['Asia/Kolkata'], PLACES: ['Udaipur|IN|24.6|73.7|0|Rajasthan', 'Udaipur|IN|27.7|75.5|0|Rajasthan', 'Agra|IN|27.2|78|0'] });
    expect(placeOptions(twins).map((option) => option.area)).toEqual([
      'Rajasthan, India · 24.6°N 73.7°E', 'Rajasthan, India · 27.7°N 75.5°E', 'India',
    ]);
  });

  test('a failed load is retried rather than remembered', async () => {
    let calls = 0;
    const flaky = () => (++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ZONES: ['Europe/Paris'], PLACES: ['Paris|FR|48.9|2.4|0'] }));
    await expect(loadPlaces(flaky)).rejects.toThrow('offline');
    expect((await loadPlaces(flaky)).map(placeLabel)).toEqual(['Paris, France']);
    expect(calls).toBe(2);
  });
});

describe('the bundled place list', () => {
  test('covers towns on every inhabited continent, with their own clocks', () => {
    expect(PLACES.length).toBeGreaterThan(30_000);
    for (const [query, label, zone] of [
      ['springfield, illinois', 'Springfield, Illinois, United States', 'America/Chicago'],
      ['springfield, massachusetts', 'Springfield, Massachusetts, United States', 'America/New_York'],
      ['el paso', 'El Paso, United States', 'America/Denver'],
      ['sao paulo', 'São Paulo, Brazil', 'America/Sao_Paulo'],
      ['lagos', 'Lagos, Nigeria', 'Africa/Lagos'],
      ['mumbai', 'Mumbai, India', 'Asia/Kolkata'],
      ['beijing', 'Beijing, China', 'Asia/Shanghai'],
      ['tromso', 'Tromsø, Norway', 'Europe/Oslo'],
      ['auckland', 'Auckland, New Zealand', 'Pacific/Auckland'],
      ['reykjavik', 'Reykjavík, Iceland', 'Atlantic/Reykjavik'],
    ]) {
      const [first] = searchPlaces(PLACES, query);
      // ICU builds name CN "China" or "China mainland"; either is the place.
      expect(placeLabel(first).replace('China mainland', 'China'), query).toBe(label);
      expect(first.timeZone, query).toBe(zone);
    }
  });

  test('every bundled zone resolves to a clock this runtime accepts', () => {
    const placesByZone = new Map(PLACES.map((place) => [place.timeZone, place]));
    expect(placesByZone.size).toBe(PLACE_DATA.ZONES.length);
    for (const place of placesByZone.values()) {
      const zone = locationTimeZone({ ...place, source: 'city' });
      expect(() => new Intl.DateTimeFormat('en', { timeZone: zone }), place.timeZone).not.toThrow();
    }
  });

  test('typed coordinates take the nearest town\'s clock, not the nearest reference city\'s', () => {
    // The reference-city rule puts Beijing on Pyongyang time and Mumbai on Karachi time.
    expect(nearestTimeZone(39.9, 116.4)).toBe('Asia/Pyongyang');
    expect(nearestTimeZone(19.1, 72.9)).toBe('Asia/Karachi');
    const env = placeEnvironment('Europe/London');
    expect(locationTimeZone(setManualLocation(39.9, 116.4, env, PLACES), env)).toBe('Asia/Shanghai');
    expect(locationTimeZone(setManualLocation(19.1, 72.9, env, PLACES), env)).toBe('Asia/Kolkata');
    expect(locationTimeZone(setManualLocation(51.5, -0.1, env, PLACES), env)).toBe('Europe/London');
    expect(nearestPlace(PLACES, 51.5, -0.1)?.name).toBe('London');
    // Without the list (offline), the old rule still gives an answer.
    expect(locationTimeZone(setManualLocation(39.9, 116.4, env), env)).toBe('Asia/Pyongyang');
  });
});

describe('chosen places', () => {
  test('an older runtime never gets the unsupported zone back as its fallback', () => {
    const env = placeEnvironment('Europe/London', ['America/Coyhaique']);
    for (const source of ['city', 'manual']) {
      const location = { lat: -45.6, lon: -72.1, source, name: 'Coyhaique', country: 'CL', timeZone: 'America/Coyhaique' };
      const zone = locationTimeZone(location, env);
      expect(zone).toBe('America/Argentina/Rio_Gallegos');
      expect(() => new env.Intl.DateTimeFormat('en', { timeZone: zone })).not.toThrow();
    }
  });

  test('store the place, its own zone, and survive a reload', () => {
    const env = placeEnvironment('America/Chicago');
    const [springfield] = searchPlaces(PLACES, 'springfield, massachusetts');
    const chosen = setPlaceLocation(springfield, env);
    expect(chosen).toMatchObject({ source: 'city', name: 'Springfield', region: 'Massachusetts', country: 'US', timeZone: 'America/New_York' });
    expect(chosen.label).toBe('Springfield, Massachusetts, United States');
    expect(JSON.parse(env.values.get(LOCATION_STORAGE_KEY)!)).toMatchObject({ source: 'city', name: 'Springfield' });
    const restored = resolveLocation(env);
    expect(restored.label).toBe('Springfield, Massachusetts, United States');
    expect(locationTimeZone(restored, env)).toBe('America/New_York');
    expect(describeLocation(restored)).toBe('Springfield, Massachusetts, United States');
  });

  test('a zone the browser does not know falls back to the nearest one', () => {
    const env = placeEnvironment('Europe/London');
    const location = { lat: 35.7, lon: 139.7, source: 'city', name: 'Tokyo', country: 'JP', timeZone: 'Asia/Not_A_Zone' };
    expect(locationTimeZone(location, env)).toBe('Asia/Tokyo');
  });

  test('a malformed stored place is ignored in favour of the time-zone guess', () => {
    const env = placeEnvironment('Europe/London');
    env.values.set(LOCATION_STORAGE_KEY, JSON.stringify({ lat: 51.5, lon: -0.1, source: 'city', name: 'London' }));
    expect(resolveLocation(env).source).toBe('tz');
  });
});

describe('the place list generator', () => {
  const row = (name: string, ascii: string, country: string, admin1: string, population: number, feature = 'PPL') =>
    ['1', name, ascii, '', '10.04', '-20.06', 'P', feature, country, '', admin1, '', '', '', String(population), '', '', 'Etc/UTC', ''].join('\t');

  test('keeps regions only for repeated names, and ASCII names only when they differ', () => {
    const cities = parseCities([
      row('Springfield', 'Springfield', 'US', 'IL', 100), row('Springfield', 'Springfield', 'US', 'MA', 200),
      row('Łódź', 'Lodz', 'PL', '74', 300), row('São Paulo', 'Sao Paulo', 'BR', '27', 50),
      row('Brooklyn', 'Brooklyn', 'US', 'NY', 900, 'PPLX'),
    ].join('\n'));
    const regions = parseAdmin1('US.IL\tIllinois\tIllinois\t1\nUS.MA\tMassachusetts\tMassachusetts\t2\n');
    const module = buildPlacesModule(cities, regions, '2026-10-31');
    expect(module).toContain('GeoNames');
    expect(module).toContain('CC BY 4.0');
    const places = JSON.parse(module.match(/export const PLACES = (.*);/)![1]);
    expect(places).toEqual([
      'Łódź|PL|10|-20.1|0||Lodz',
      'Springfield|US|10|-20.1|0|Massachusetts',
      'Springfield|US|10|-20.1|0|Illinois',
      'São Paulo|BR|10|-20.1|0',
    ]);
  });
});

test('the times-in note compares the two clocks on the chosen night', () => {
  const html = readFileSync(new URL('./public/sky-tonight.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function zoneOffset('), html.indexOf('function insideWindow('))
    + html.slice(html.indexOf('function sourceDescription('), html.indexOf('function locationMeta('));
  // London and Abidjan share GMT in November, but London is an hour ahead in July.
  function DateTimeFormat(locales?: string, options?: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(locales, options ?? { timeZone: 'Europe/London' });
  }
  const describeNight = (night: string) => runInNewContext(`${source}; sourceDescription()`, {
    Intl: { DateTimeFormat },
    location: { source: 'city' },
    displayTimeZone: 'Africa/Abidjan',
    timeZoneLabel,
    offset: 0,
    dateAt: () => new Date(night),
  });
  expect(describeNight('2026-11-09T12:00:00Z')).toBe('Chosen place');
  expect(describeNight('2027-07-01T12:00:00Z')).toBe(`Chosen place · times in ${timeZoneLabel('Africa/Abidjan')}`);
});
