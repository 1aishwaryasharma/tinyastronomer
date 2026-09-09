import { TZ_COORDS } from './tz-coords.js';

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
    && ['tz', 'geo', 'manual'].includes(location.source);
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

function timezoneLabel(timeZone) {
  const city = timeZone.includes('/') ? timeZone.split('/').at(-1) : timeZone;
  return `${city.replaceAll('_', ' ')} area`;
}

function coordinateLabel(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(1)}°${longitude < 0 ? 'W' : 'E'}`;
  return `${lat} ${lon}`;
}

function timezoneGuess(env) {
  const timeZone = env.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? '';
  const known = TZ_COORDS[timeZone];
  if (known) {
    const location = {
      lat: known[0],
      lon: known[1],
      source: 'tz',
      timeZone,
      approximate: false,
    };
    location.label = describeLocation(location);
    return location;
  }

  const offsetMinutes = new env.Date().getTimezoneOffset();
  const location = {
    lat: 0,
    lon: Math.max(-180, Math.min(180, -offsetMinutes / 4)),
    source: 'tz',
    timeZone,
    approximate: true,
  };
  location.label = 'Approximate time-zone location';
  return location;
}

export function describeLocation(location) {
  if (location.source === 'tz' && location.timeZone && !location.approximate) {
    return timezoneLabel(location.timeZone);
  }
  if (location.source === 'tz' && location.approximate) {
    return 'Approximate time-zone location';
  }
  return coordinateLabel(location.lat, location.lon);
}

export function resolveLocation(env = globalThis) {
  const stored = readStoredLocation(env);
  if (stored) return { ...stored, label: describeLocation(stored) };
  const location = timezoneGuess(env);
  return storeLocation(location, env);
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

    env.navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: roundCoordinate(position.coords.latitude),
          lon: roundCoordinate(position.coords.longitude),
          source: 'geo',
        };
        location.label = describeLocation(location);
        resolve(storeLocation(location, env));
      },
      (error) => reject(new Error(GEOLOCATION_ERRORS[error.code] ?? 'Could not get your location.')),
      { enableHighAccuracy: false, maximumAge: 6 * 60 * 60 * 1000, timeout: 10_000 },
    );
  });
}

export function setManualLocation(latitude, longitude, env = globalThis) {
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
  location.label = describeLocation(location);
  return storeLocation(location, env);
}
