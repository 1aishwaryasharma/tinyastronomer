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

const COMPASS_WORDS = {
  N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast',
  E: 'east', ESE: 'east-southeast', SE: 'southeast', SSE: 'south-southeast',
  S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
  W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
};

export function compassWords(compass) {
  return COMPASS_WORDS[compass] ?? compass;
}

// A fist held at arm's length covers about 10° of sky, for adults and children
// alike (smaller hands, shorter arms). Degrees mean little to a seven-year-old.
// Above this, direction stops being useful: look straight up.
const OVERHEAD = 75;

export function fistHeight(altitude) {
  if (altitude < 3) return 'right on the horizon';
  // Below 7.5° the nearest half fist rounds to ½, which reads as "0½ fists".
  if (altitude < 7.5) return 'half a fist up';
  if (altitude >= OVERHEAD) return 'almost straight overhead';
  const halves = Math.round(altitude / 5) / 2;
  const whole = Math.floor(halves);
  return `${whole}${halves % 1 ? '½' : ''} fist${halves === 1 ? '' : 's'} up`;
}

export function whereToLook(position) {
  const height = fistHeight(position.altitude);
  return position.altitude >= OVERHEAD ? height : `${height} in the ${compassWords(position.compass)}`;
}

// The same rule in a phone-width line: "E, 2 fists up" or "straight up".
export function whereToLookShort(position) {
  return position.altitude >= OVERHEAD ? 'straight up' : `${position.compass}, ${fistHeight(position.altitude)}`;
}

// Uranus and Neptune are in the forecast, but a child looking for them by eye
// will not find them, so they stay out of the headline lists and the chart
// unless asked for. The value is what to say instead of a brightness.
const TELESCOPE_NOTES = {
  uranus: 'optical aid recommended',
  neptune: 'telescope required',
};
export const TELESCOPE_BODIES = new Set(Object.keys(TELESCOPE_NOTES));

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


// The Moon is plain to see in twilight, and even by day, so it is up for the
// whole night window. Venus is bright enough to find in early twilight, once
// the Sun is a few degrees down. Everything else, Mercury included, needs
// civil twilight to end.
const SUN_LIMIT = { Moon: 0, Venus: -3 };

// Below this altitude an object is too low to see clearly.
export const MIN_ALTITUDE = 5;

// Whether the sky is dark enough at this Sun altitude to see the body.
export function darkEnoughFor(body, sunAltitudeDegrees) {
  return sunAltitudeDegrees <= (SUN_LIMIT[body] ?? -6);
}

// The one visibility rule: the nightly search, the pairings and the page's
// "Up now" list all use it.
export function isVisibleAt(body, altitude, sunAltitudeDegrees) {
  return altitude > MIN_ALTITUDE && darkEnoughFor(body, sunAltitudeDegrees);
}

// Every body is sampled on the same grid from sunset, then filtered by its
// own darkness rule. Pairings match samples by timestamp, so a grid that
// started at each body's own twilight limit never lined the Moon or Venus up
// with the other planets.
function visibilitySamples(body, observer, window) {
  return samplesBetween(window.start, window.end).map((time) => ({
    time,
    position: horizontal(body, observer, time),
    sunAltitude: sunAltitude(observer, time),
  })).filter((sample) => darkEnoughFor(body, sample.sunAltitude));
}

function invisibleNote(samples) {
  if (samples.length === 0) return 'No dark observing window tonight.';
  const maxAltitude = Math.max(...samples.map((sample) => sample.position.altitude));
  if (maxAltitude <= 0) return 'Below the horizon all night.';
  if (maxAltitude <= MIN_ALTITUDE) return 'Too low on the horizon to see clearly.';
  return 'Lost in twilight tonight.';
}

// The first setting after the window opens, which may be after it closes,
// and every setting inside it: in a long polar night a body can set, rise
// and set again before the window ends.
function settings(body, observer, window) {
  const first = searchRiseSet(body, observer, -1, window.start, 2);
  const within = [];
  for (let set = first; set && set <= window.end && within.length < 4;) {
    within.push(set);
    // Only the rest of this window matters, so stop the search at its end.
    const from = new Date(set.getTime() + 60000);
    const remainingDays = (window.end - from) / DAY_MS;
    set = remainingDays > 0 ? searchRiseSet(body, observer, -1, from, remainingDays) : null;
  }
  return { first, within };
}

export function bodyReport(body, observer, window, sampleTime) {
  const at = asDate(sampleTime ?? window.astroDusk ?? window.civilDusk ?? window.start);
  const samples = visibilitySamples(body, observer, window);
  const candidates = samples.filter((sample) => isVisibleAt(body, sample.position.altitude, sample.sunAltitude));
  const withCompass = (sample) => sample && { time: sample.time, position: { ...sample.position, compass: compassDirection(sample.position.azimuth) } };
  const best = candidates.reduce(
    (winner, sample) => !winner || sample.position.altitude > winner.position.altitude ? sample : winner,
    null,
  );
  const position = horizontal(body, observer, at);
  const illumination = A.Illumination(body, best?.time ?? at);
  const key = body.toLowerCase();
  const telescopeNote = TELESCOPE_NOTES[key];
  const sets = settings(body, observer, window);

  return {
    key,
    name: body,
    visible: Boolean(best),
    bestTime: best?.time ?? null,
    bestPosition: withCompass(best)?.position ?? null,
    // Every visible sample, so the page can tell "later" from "earlier" in
    // a long polar night, where a body can set and rise again.
    visibleSamples: candidates.map(withCompass),
    altitude: position.altitude,
    azimuth: position.azimuth,
    compass: compassDirection(position.azimuth),
    mag: illumination.mag,
    brightness: telescopeNote ?? brightnessDescription(illumination.mag),
    rise: searchRiseSet(body, observer, +1, window.start, 2),
    set: sets.first,
    sets: sets.within,
    constellation: constellationAt(body, observer, at),
    note: best ? '' : invisibleNote(samples),
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
        .filter((sample) => isVisibleAt(body, sample.position.altitude, sample.sunAltitude))
        .map(({ time }) => [time.getTime(), A.Equator(body, time, observer, false, true).vec])));
    }
    return vectors.get(body);
  };
  // No pair closes more than a few degrees in one night, so a single midnight
  // check skips the far-apart pairs before sampling the whole night.
  const middle = new Date((window.start.getTime() + window.end.getTime()) / 2);
  // Only pairs a child can find by eye: Uranus and Neptune are not shown.
  const bodies = FORECAST_BODIES.filter((body) => !TELESCOPE_BODIES.has(body.toLowerCase()));
  const middleVectors = new Map(bodies.map((body) => [body, A.Equator(body, middle, observer, false, true).vec]));
  const pairs = [];

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const bodyA = bodies[i];
      const bodyB = bodies[j];
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

export function constellationAt(body, observer, date) {
  const eqj = A.Equator(body, date, observer, false, true);
  return A.Constellation(eqj.ra, eqj.dec).name;
}

export function displayName(name) {
  return name === 'Moon' ? 'the Moon' : name;
}

// Sorts tonight's reports for the selected moment. Reports are computed once
// per night; positions are at `time`, and "up" rows carry the constellation
// at `time` too, since the Moon can cross into another during the night.
export function sortSkyLists(reports, positions, observer, time) {
  const naked = reports.filter((report) => !TELESCOPE_BODIES.has(report.key));
  const up = [], later = [], earlier = [], missing = [];
  for (const report of naked) {
    // The chosen moment is checked exactly, so a body visible now is up even
    // when no 10-minute sample of the night caught it.
    if (isVisibleAt(report.name, positions[report.key].altitude, positions.sun.altitude)) {
      up.push({ ...report, position: positions[report.key], constellation: constellationAt(report.name, observer, time) });
      continue;
    }
    if (!report.visible) { missing.push(report); continue; }
    // "Later" if it is visible again before the window ends; its best time
    // is the best still to come.
    const ahead = report.visibleSamples.filter((sample) => sample.time > time);
    if (!ahead.length) { earlier.push(report); continue; }
    const next = ahead.reduce((best, sample) => sample.position.altitude > best.position.altitude ? sample : best);
    later.push({ ...report, bestTime: next.time, bestPosition: next.position });
  }
  up.sort((a, b) => a.position.magnitude - b.position.magnitude);
  later.sort((a, b) => a.bestTime - b.bestTime);
  const telescope = reports.filter((report) => TELESCOPE_BODIES.has(report.key));
  return { up, later, earlier, missing, telescope };
}

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const andList = new Intl.ListFormat('en', { type: 'conjunction' });

// `when` is "now" or "at 9:30 pm"; `time` formats a Date for the reader.
export function skyHeadline({ up, later }, { when, time, hasStars = false }) {
  const names = up.map((item) => displayName(item.name));
  if (names.length > 3) return `${capitalize(andList.format([...names.slice(0, 2), `${names.length - 2} more`]))} are up ${when}`;
  if (names.length) return `${capitalize(andList.format(names))} ${names.length === 1 ? 'is' : 'are'} up ${when}`;
  if (later.length) return `${capitalize(displayName(later[0].name))} is best later, around ${time(later[0].bestTime)}`;
  return hasStars ? 'No planets up — look for bright stars' : 'No planets up at this time';
}

export { A as Astronomy };
