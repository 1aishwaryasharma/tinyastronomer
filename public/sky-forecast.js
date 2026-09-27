import * as A from './vendor/astronomy-engine/astronomy.min.js';

export const PLANET_BODIES = [
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
];

export const FORECAST_BODIES = ['Moon', ...PLANET_BODIES];

const TEN_MINUTES = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

const METEOR_SHOWERS = [
  { name: 'Quadrantids', month: 1, day: 3 },
  { name: 'Lyrids', month: 4, day: 22 },
  { name: 'Eta Aquariids', month: 5, day: 6 },
  { name: 'Perseids', month: 8, day: 12 },
  { name: 'Orionids', month: 10, day: 21 },
  { name: 'Leonids', month: 11, day: 17 },
  { name: 'Geminids', month: 12, day: 14 },
  { name: 'Ursids', month: 12, day: 22 },
];

const NASA_METEOR_SOURCE = 'https://science.nasa.gov/solar-system/meteors-meteorites/meteor-showers-shooting-stars/';

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (value.date instanceof Date) return new Date(value.date.getTime());
  return new Date(value);
}

function eventDate(event) {
  return event ? asDate(event.date ?? event) : null;
}

function horizontal(body, observer, date) {
  const equatorial = A.Equator(body, date, observer, true, true);
  return A.Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
}

function sunAltitude(observer, date) {
  return horizontal('Sun', observer, date).altitude;
}

// Anchor the night search at the observer's mean solar noon on the chosen
// calendar date, so a manual location in another time zone gets the same
// night as someone standing there, not the one nearest the device's noon.
function localNoon(localDate, observer) {
  const date = asDate(localDate);
  const utcNoon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return new Date(utcNoon - observer.longitude / 15 * 3600000);
}

// A twilight search can run past sunrise and find a later night's event on
// nights that never get that dark; those events do not belong to tonight.
function withinNight(date, start, end) {
  return date && date >= start && date <= end ? date : null;
}

function searchAltitude(observer, direction, start, limitDays, altitude) {
  return eventDate(A.SearchAltitude('Sun', observer, direction, start, limitDays, altitude));
}

function searchRiseSet(body, observer, direction, start, limitDays = 2) {
  return eventDate(A.SearchRiseSet(body, observer, direction, start, limitDays));
}

export function compassDirection(azimuth) {
  const normalized = ((azimuth % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 22.5) % 16];
}

export function brightnessDescription(magnitude) {
  if (!Number.isFinite(magnitude)) return 'brightness unavailable';
  if (magnitude < -3) return 'brighter than any star';
  if (magnitude < 0) return 'as bright as the brightest stars';
  if (magnitude < 2) return 'bright, easy to spot';
  if (magnitude < 4) return 'faint, needs a dark sky';
  if (magnitude < 6) return 'binoculars';
  return 'telescope';
}

export function nightWindow(observer, localDate) {
  const noon = localNoon(localDate, observer);
  const sunset = searchRiseSet('Sun', observer, -1, noon, 1.5);

  if (!sunset) {
    const end = new Date(noon.getTime() + DAY_MS);
    const polar = sunAltitude(observer, noon) > 0 ? 'day' : 'night';
    return {
      start: noon,
      end,
      sunset: null,
      civilDusk: null,
      astroDusk: null,
      astroDawn: null,
      civilDawn: null,
      sunrise: null,
      moonRise: searchRiseSet('Moon', observer, +1, noon, 2),
      moonSet: searchRiseSet('Moon', observer, -1, noon, 2),
      polar,
    };
  }

  const sunrise = searchRiseSet('Sun', observer, +1, new Date(sunset.getTime() + 1000), 1.5);
  if (!sunrise) {
    const end = new Date(sunset.getTime() + DAY_MS);
    return {
      start: sunset,
      end,
      sunset,
      civilDusk: searchAltitude(observer, -1, sunset, 1, -6),
      astroDusk: searchAltitude(observer, -1, sunset, 1, -18),
      astroDawn: null,
      civilDawn: null,
      sunrise: null,
      moonRise: searchRiseSet('Moon', observer, +1, sunset, 2),
      moonSet: searchRiseSet('Moon', observer, -1, sunset, 2),
      polar: 'night',
    };
  }

  const inNight = (date) => withinNight(date, sunset, sunrise);
  const civilDusk = inNight(searchAltitude(observer, -1, sunset, 1, -6));
  const astroDusk = inNight(searchAltitude(observer, -1, sunset, 1, -18));
  const searchStart = new Date(sunset.getTime() + 1000);
  const astroDawn = inNight(searchAltitude(observer, +1, searchStart, 1.5, -18));
  const civilDawn = inNight(searchAltitude(observer, +1, searchStart, 1.5, -6));

  return {
    start: sunset,
    end: sunrise,
    sunset,
    civilDusk,
    astroDusk,
    astroDawn,
    civilDawn,
    sunrise,
    moonRise: searchRiseSet('Moon', observer, +1, sunset, 2),
    moonSet: searchRiseSet('Moon', observer, -1, sunset, 2),
    polar: null,
  };
}

export function nightSpanMinutes(window) {
  if (!window?.start || !window?.end) return 5;
  return Math.max(5, Math.round((window.end - window.start) / 60000));
}

export function timeInNight(window, minutesFromStart) {
  const maxMinutes = nightSpanMinutes(window);
  const minutes = Math.max(0, Math.min(maxMinutes, Number(minutesFromStart) || 0));
  return new Date(window.start.getTime() + minutes * 60000);
}

export function defaultNightMinutes(window, now, isToday) {
  const pick = isToday && now >= window.start && now <= window.end
    ? now
    : window.astroDusk ?? window.civilDusk ?? window.start;
  return Math.round((pick - window.start) / 300000) * 5;
}

function samplesBetween(start, end) {
  if (!start || !end || end <= start) return [];
  const samples = [];
  for (let time = start.getTime(); time <= end.getTime(); time += TEN_MINUTES) {
    samples.push(new Date(time));
  }
  if (samples.at(-1)?.getTime() !== end.getTime()) samples.push(new Date(end));
  return samples;
}

function darkBounds(window) {
  return {
    start: window.civilDusk ?? window.start,
    end: window.civilDawn ?? window.end,
  };
}

function constellationAt(body, observer, date) {
  const eqj = A.Equator(body, date, observer, false, true);
  return A.Constellation(eqj.ra, eqj.dec).name;
}

// Venus is bright enough to find in early twilight, once the Sun is a few
// degrees down. Everything else, Mercury included, needs civil twilight to end.
const SUN_LIMIT = { Venus: -3 };

function visibilitySamples(body, observer, window) {
  const sunLimit = SUN_LIMIT[body] ?? -6;
  const bounds = sunLimit > -6
    ? { start: window.start, end: window.end }
    : darkBounds(window);

  return samplesBetween(bounds.start, bounds.end).map((time) => ({
    time,
    position: horizontal(body, observer, time),
    sunAltitude: sunAltitude(observer, time),
  })).filter((sample) => sample.sunAltitude <= sunLimit);
}

function invisibleNote(samples) {
  if (samples.length === 0) return 'No dark observing window tonight.';
  const maxAltitude = Math.max(...samples.map((sample) => sample.position.altitude));
  if (maxAltitude <= 0) return 'Below the horizon all night.';
  if (maxAltitude <= 5) return 'Too low on the horizon to see clearly.';
  return 'Lost in twilight tonight.';
}

export function bodyReport(body, observer, window, sampleTime) {
  const at = asDate(sampleTime ?? window.astroDusk ?? window.civilDusk ?? window.start);
  const samples = visibilitySamples(body, observer, window);
  const candidates = samples.filter((sample) => sample.position.altitude > 5);
  const best = candidates.reduce(
    (winner, sample) => !winner || sample.position.altitude > winner.position.altitude ? sample : winner,
    null,
  );
  const position = horizontal(body, observer, at);
  const illumination = A.Illumination(body, best?.time ?? at);
  let note = best ? '' : invisibleNote(samples);
  if (body === 'Uranus') note = note || 'Optical aid recommended.';
  if (body === 'Neptune') note = note || 'Telescope required.';

  return {
    key: body.toLowerCase(),
    name: body,
    visible: Boolean(best),
    bestTime: best?.time ?? null,
    altitude: position.altitude,
    azimuth: position.azimuth,
    compass: compassDirection(position.azimuth),
    mag: illumination.mag,
    brightness: body === 'Uranus'
      ? 'optical aid recommended'
      : body === 'Neptune'
        ? 'telescope required'
        : brightnessDescription(illumination.mag),
    rise: searchRiseSet(body, observer, +1, window.start, 2),
    set: searchRiseSet(body, observer, -1, window.start, 2),
    constellation: constellationAt(body, observer, at),
    note,
  };
}

function moonPhaseName(angle) {
  if (angle < 22.5 || angle >= 337.5) return 'New Moon';
  if (angle < 67.5) return 'Waxing crescent';
  if (angle < 112.5) return 'First quarter';
  if (angle < 157.5) return 'Waxing gibbous';
  if (angle < 202.5) return 'Full Moon';
  if (angle < 247.5) return 'Waning gibbous';
  if (angle < 292.5) return 'Last quarter';
  return 'Waning crescent';
}

export function moonReport(observer, window, sampleTime) {
  const bounds = darkBounds(window);
  const at = asDate(sampleTime ?? bounds.start ?? window.start);
  const phaseAngle = A.MoonPhase(at);
  const illumination = A.Illumination('Moon', at).phase_fraction;
  const samples = samplesBetween(bounds.start, bounds.end);
  const upDuringDark = samples.some((time) => horizontal('Moon', observer, time).altitude > 0);
  const position = horizontal('Moon', observer, at);

  return {
    phase: moonPhaseName(phaseAngle),
    phaseAngle,
    illumination,
    illuminationPercent: Math.round(illumination * 100),
    rise: window.moonRise ?? searchRiseSet('Moon', observer, +1, window.start, 2),
    set: window.moonSet ?? searchRiseSet('Moon', observer, -1, window.start, 2),
    washesOutSky: illumination > 0.6 && upDuringDark,
    altitude: position.altitude,
    azimuth: position.azimuth,
    compass: compassDirection(position.azimuth),
  };
}

// A pairing only counts when both objects are actually up in a dark enough sky.
export function conjunctions(observer, window) {
  // Direction vectors keyed by sample time, only while the body is usefully up.
  const vectors = new Map();
  const upVectors = (body) => {
    if (!vectors.has(body)) {
      vectors.set(body, new Map(visibilitySamples(body, observer, window)
        .filter((sample) => sample.position.altitude > 5)
        .map(({ time }) => [time.getTime(), A.Equator(body, time, observer, false, true).vec])));
    }
    return vectors.get(body);
  };
  // No pair closes more than a few degrees in one night, so a single midnight
  // check skips the far-apart pairs before sampling the whole night.
  const middle = new Date((window.start.getTime() + window.end.getTime()) / 2);
  const middleVectors = new Map(FORECAST_BODIES.map((body) => [body, A.Equator(body, middle, observer, false, true).vec]));
  const pairs = [];

  for (let i = 0; i < FORECAST_BODIES.length; i += 1) {
    for (let j = i + 1; j < FORECAST_BODIES.length; j += 1) {
      const bodyA = FORECAST_BODIES[i];
      const bodyB = FORECAST_BODIES[j];
      if (A.AngleBetween(middleVectors.get(bodyA), middleVectors.get(bodyB)) > 15) continue;
      const vectorsB = upVectors(bodyB);
      let closest = null;
      for (const [time, vectorA] of upVectors(bodyA)) {
        const vectorB = vectorsB.get(time);
        if (!vectorB) continue;
        const degrees = A.AngleBetween(vectorA, vectorB);
        if (!closest || degrees < closest.degrees) closest = { time: new Date(time), degrees };
      }
      if (closest && closest.degrees <= 5) {
        pairs.push({ bodies: [bodyA, bodyB], ...closest });
      }
    }
  }

  return pairs.sort((a, b) => a.degrees - b.degrees);
}

function calendarDistance(date, month, day) {
  const year = date.getFullYear();
  const target = new Date(year, month - 1, day, 12);
  const distances = [
    target.getTime() - date.getTime(),
    new Date(year - 1, month - 1, day, 12).getTime() - date.getTime(),
    new Date(year + 1, month - 1, day, 12).getTime() - date.getTime(),
  ];
  return Math.min(...distances.map((distance) => Math.abs(distance))) / DAY_MS;
}

export function meteorShowers(date) {
  const localDate = asDate(date);
  return METEOR_SHOWERS
    .filter((shower) => calendarDistance(localDate, shower.month, shower.day) <= 2)
    .map((shower) => ({ ...shower, source: NASA_METEOR_SOURCE }));
}

export function orbitPositions(date) {
  const positions = {};
  for (const body of ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
    const vector = A.HelioVector(body, date);
    positions[body.toLowerCase()] = {
      x: vector.x,
      y: vector.y,
      z: vector.z,
      distance: Math.hypot(vector.x, vector.y, vector.z),
      longitude: Math.atan2(vector.y, vector.x),
    };
  }
  return positions;
}

export function positionAt(body, observer, date) {
  const position = horizontal(body, observer, date);
  let magnitude = null;
  if (body !== 'Sun') magnitude = A.Illumination(body, date).mag;
  return {
    altitude: position.altitude,
    azimuth: position.azimuth,
    magnitude,
    compass: compassDirection(position.azimuth),
  };
}

export { A as Astronomy };
