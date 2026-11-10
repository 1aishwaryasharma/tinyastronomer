import { TZ_ALIASES, TZ_CITY_COORDS, TZ_COORDS, TZ_SHARED_CLOCKS } from './tz-coords.js?v=a9c8921321';

export const LOCATION_STORAGE_KEY = 'sky.location';

function roundCoordinate(value) {
  return Math.round(value * 10) / 10;
}

function validCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validLocation(location) {
  return location
    && validCoordinate(location.lat, -90, 90)
    && validCoordinate(location.lon, -180, 180)
    && ['tz', 'geo', 'manual', 'city'].includes(location.source)
    && (location.timeZone === undefined || typeof location.timeZone === 'string')
    && (location.source !== 'city' || (typeof location.name === 'string' && typeof location.country === 'string' && typeof location.timeZone === 'string'));
}

function readStoredLocation(env) {
  try {
    const parsed = JSON.parse(env.localStorage?.getItem(LOCATION_STORAGE_KEY) ?? 'null');
    return validLocation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeLocation(location, env) {
  try {
    env.localStorage?.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Private browsing and strict browser settings can make storage unavailable.
  }
  return location;
}


function timezoneLabel(zone) {
  const city = zone.includes('/') ? zone.split('/').at(-1) : zone;
  return `${city.replaceAll('_', ' ')} area`;
}

function coordinateLabel(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(1)}°${longitude < 0 ? 'W' : 'E'}`;
  return `${lat} ${lon}`;
}

const TABLES = { TZ_ALIASES, TZ_CITY_COORDS, TZ_COORDS, TZ_SHARED_CLOCKS };

// Where a browser time zone puts the device. Exact for a zone or one of its
// old names; approximate for a zone that only shares another place's clock
// (Africa/Timbuktu runs on Abidjan time). Both tables are searched, as the
// generator keeps targets from either. Null when the zone is unknown.
export function locateZone(timeZone, tables = TABLES) {
  const coordinates = (zone) => tables.TZ_COORDS[zone] ?? tables.TZ_CITY_COORDS[zone];
  const exact = coordinates(tables.TZ_ALIASES[timeZone] ?? timeZone);
  if (exact) return { lat: exact[0], lon: exact[1], approximate: false, zone: tables.TZ_ALIASES[timeZone] ?? timeZone };
  const shared = coordinates(tables.TZ_SHARED_CLOCKS[timeZone]);
  return shared ? { lat: shared[0], lon: shared[1], approximate: true } : null;
}

function timezoneGuess(env) {
  const timeZone = env.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? '';
  // Unknown zones fall back to the equator at the clock's longitude.
  const offsetMinutes = new env.Date().getTimezoneOffset();
  const location = {
    lat: 0,
    lon: Math.max(-180, Math.min(180, -offsetMinutes / 4)),
    approximate: true,
    ...locateZone(timeZone),
    source: 'tz',
    timeZone,
  };
  location.label = describeLocation(location);
  return location;
}

const countryNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; }
})();

function countryName(code) {
  try { return countryNames?.of(code) ?? code; } catch { return code; }
}

// The region is kept only where a country has two places of one name, so
// "Paris, France" but "Springfield, Illinois, United States".
export function placeArea(place) {
  return [place.region, countryName(place.country)].filter(Boolean).join(', ');
}

export function placeLabel(place) {
  return `${place.name}, ${placeArea(place)}`;
}

// What a search result shows under its name. A few places still share a name
// and region (two Udaipurs in Rajasthan), so those also show where they are.
export function placeOptions(matches) {
  const labels = matches.map(placeLabel);
  return matches.map((place, index) => ({
    place,
    area: labels.indexOf(labels[index]) === labels.lastIndexOf(labels[index])
      ? placeArea(place) : `${placeArea(place)} · ${coordinateLabel(place.lat, place.lon)}`,
  }));
}

export function describeLocation(location) {
  if (location.source === 'city') return placeLabel(location);
  if (location.source === 'tz' && location.timeZone && !location.approximate) {
    return timezoneLabel(location.zone ?? location.timeZone);
  }
  if (location.source === 'tz' && location.approximate) {
    // Read inside sentences ("updated for …", "At 9:30 pm from …").
    return 'your area (rough guess)';
  }
  return coordinateLabel(location.lat, location.lon);
}

export function resolveLocation(env = globalThis) {
  const stored = readStoredLocation(env);
  // A time-zone guess is cheap to redo, so only device and manual locations
  // are kept. Redoing it picks up travel and heals guesses stored before a
  // zone name was recognised, such as the old equator fallback for India.
  if (stored && stored.source !== 'tz') return { ...stored, label: describeLocation(stored) };
  return timezoneGuess(env);
}

const GEOLOCATION_ERRORS = {
  1: 'Location permission was denied.',
  2: 'Your location is unavailable.',
  3: 'Location request timed out.',
};

export function requestDeviceLocation(env = globalThis) {
  return new Promise((resolve, reject) => {
    if (!env.navigator?.geolocation) {
      reject(new Error('Device location is not available in this browser.'));
      return;
    }

    // The browser's timeout only starts once permission is given, and some
    // browsers never answer a dismissed or ignored prompt. A late answer is
    // dropped: the visitor has already been told to try again.
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      env.clearTimeout(timer);
      callback(value);
    };
    const timer = env.setTimeout(
      finish(() => reject(new Error('Your browser did not answer. Try again, or set a place by hand.'))),
      30_000,
    );
    env.navigator.geolocation.getCurrentPosition(
      finish((position) => {
        const location = {
          lat: roundCoordinate(position.coords.latitude),
          lon: roundCoordinate(position.coords.longitude),
          source: 'geo',
        };
        const timeZone = env.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
        if (timeZone) location.timeZone = timeZone;
        location.label = describeLocation(location);
        resolve(storeLocation(location, env));
      }),
      finish((error) => reject(new Error(GEOLOCATION_ERRORS[error.code] ?? 'Could not get your location.'))),
      { enableHighAccuracy: false, maximumAge: 6 * 60 * 60 * 1000, timeout: 10_000 },
    );
  });
}

// With the place list, typed coordinates take the nearest town's time zone.
// Without it (offline before the list ever loaded) they fall back to the
// nearest reference city in locationTimeZone.
export function setManualLocation(latitude, longitude, env = globalThis, places = null) {
  if (latitude === '' || latitude === null || latitude === undefined
      || longitude === '' || longitude === null || longitude === undefined) {
    throw new RangeError('Enter both latitude and longitude.');
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!validCoordinate(lat, -90, 90)) {
    throw new RangeError('Latitude must be between −90 and 90.');
  }
  if (!validCoordinate(lon, -180, 180)) {
    throw new RangeError('Longitude must be between −180 and 180.');
  }
  const location = { lat: roundCoordinate(lat), lon: roundCoordinate(lon), source: 'manual' };
  const nearest = places && nearestPlace(places, location.lat, location.lon);
  if (nearest) location.timeZone = nearest.timeZone;
  location.label = describeLocation(location);
  return storeLocation(location, env);
}

// Search text: lower case, no accents, punctuation as spaces, so "st. louis"
// finds "St. Louis" and "sao paulo" finds "São Paulo". The place list's
// generator uses the same rule to decide which names need an ASCII spelling.
export function normalizePlaceName(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// sky-places.js lists places most populous first, one "|"-separated row each:
// name, country, lat, lon, zone index, region (only where needed), ASCII name.
export function parsePlaces({ PLACES, ZONES }) {
  return PLACES.map((row) => {
    const [name, country, lat, lon, zone, region, ascii] = row.split('|');
    return {
      name, country, region: region || undefined, lat: Number(lat), lon: Number(lon), timeZone: ZONES[Number(zone)],
      keys: [normalizePlaceName(name), ...(ascii ? [normalizePlaceName(ascii)] : [])],
    };
  });
}

let placesPromise;
// The list is about 1 MB (300 KB compressed), so it loads only when someone
// opens Change to set a location.
// A failed load is not cached: going back online lets the next try work.
export function loadPlaces(load = () => import('./sky-places.js?v=38fdfe645c')) {
  placesPromise ??= load().then(parsePlaces, (error) => { placesPromise = undefined; throw error; });
  return placesPromise;
}

// Whole name, then name start, then a later word ("york" finds New York).
// Ties keep list order, which is by population. Each part after a comma
// narrows by region or country: "springfield, mass", "paris, fr", or a whole
// pasted label.
export function searchPlaces(places, query, limit = 8) {
  const [nameQuery, ...rest] = query.split(',');
  const name = normalizePlaceName(nameQuery);
  const areas = rest.map(normalizePlaceName).filter(Boolean);
  if (name.length < 2) return [];
  const tiers = [[], [], []];
  for (const place of places) {
    let tier = 3;
    for (const key of place.keys) {
      if (key === name) tier = 0;
      else if (key.startsWith(name)) tier = Math.min(tier, 1);
      else if (key.includes(` ${name}`)) tier = Math.min(tier, 2);
    }
    if (tier === 3 || !areas.every((area) => matchesArea(place, area))) continue;
    tiers[tier].push(place);
    if (tier === 0 && tiers[0].length >= limit) break;
  }
  return tiers.flat().slice(0, limit);
}

function matchesArea(place, within) {
  const country = normalizePlaceName(countryName(place.country));
  return normalizePlaceName(place.country) === within
    || country.startsWith(within)
    || (place.region && normalizePlaceName(place.region).startsWith(within));
}

// A chosen place keeps its own time zone, so its times are right even where
// the nearest reference city runs on another clock.
export function setPlaceLocation(place, env = globalThis) {
  const location = {
    lat: place.lat, lon: place.lon, source: 'city',
    name: place.name, country: place.country, timeZone: place.timeZone,
    ...(place.region ? { region: place.region } : {}),
  };
  location.label = describeLocation(location);
  return storeLocation(location, env);
}

function closeness(latitude, longitude, lat, lon) {
  const toRadians = Math.PI / 180;
  const dLat = (lat - latitude) * toRadians, dLon = (lon - longitude) * toRadians;
  return Math.sin(dLat / 2) ** 2 + Math.cos(latitude * toRadians) * Math.cos(lat * toRadians) * Math.sin(dLon / 2) ** 2;
}

export function nearestPlace(places, latitude, longitude) {
  let best = null, bestDistance = Infinity;
  for (const place of places) {
    const distance = closeness(latitude, longitude, place.lat, place.lon);
    if (distance < bestDistance) { bestDistance = distance; best = place; }
  }
  return best;
}

function knownTimeZone(timeZone, env) {
  try { new env.Intl.DateTimeFormat('en', { timeZone }); return true; } catch { return false; }
}

// The IANA zone whose reference city is closest to the coordinates. Borders
// do not follow distance exactly, so callers should say which zone they used.
// Only one city per distinct clock is searched: a country's own reference
// town on another zone's clock (Creston, Atikokan) would pull its neighbours
// onto a clock without daylight saving.
export function nearestTimeZone(latitude, longitude, env = globalThis) {
  let best = null, bestDistance = Infinity;
  for (const [timeZone, [lat, lon]] of Object.entries(TZ_COORDS)) {
    const distance = closeness(latitude, longitude, lat, lon);
    if (distance < bestDistance && knownTimeZone(timeZone, env)) { bestDistance = distance; best = timeZone; }
  }
  return best;
}

// A time-zone guess is where the device is, so its clock fits. A device fix
// keeps the clock it was taken on, so it stays right after travel; one stored
// before fixes kept a zone uses the device clock. A chosen place, and typed
// coordinates set with the place list, carry their own zone. Otherwise typed
// coordinates use the nearest reference city's zone, which is wrong for about
// one town in five (Beijing is nearer Pyongyang's reference point than Shanghai's).
export function locationTimeZone(location, env = globalThis) {
  const deviceZone = env.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
  if (location.source === 'tz') return deviceZone;
  // Older runtimes may not know a newer zone, including its reference-table entry.
  if (location.timeZone && knownTimeZone(location.timeZone, env)) return location.timeZone;
  if (location.source === 'geo') return deviceZone;
  return nearestTimeZone(location.lat, location.lon, env) ?? deviceZone;
}

export function timeZoneLabel(timeZone) {
  return timeZone ? `${timezoneLabel(timeZone).replace(/ area$/, '')} time` : '';
}
