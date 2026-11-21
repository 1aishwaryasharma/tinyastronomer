/* Arithmetic for the mission pages. No DOM and no Three.js, so the tests can
   hold it to JPL Horizons directly.

     lerp, smooth, clamp01                  easing
     planetPosition, planetOrbit, PLANETS   JPL's approximate planets
     equatorialToEcliptic                   spin axes
     indexAt, sampleRows, unpackRows        sampled paths, rows of [day, x, y, z, …]
     missionCalendar                        mission days ↔ wall-clock time
     formatDate, clockTime, formatLightTime text for the cards and the clock

   Planet positions are heliocentric, in astronomical units, in the
   ecliptic-of-J2000 frame: +x toward the March equinox, +z toward the
   ecliptic north pole. */

export const AU_KM = 149597870.7;
export const LIGHT_KM_PER_SEC = 299792.458;
export const DAY_MS = 86400000;

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
// 0 below `a`, 1 above `b`, an eased ramp between.
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;

// JPL "Approximate Positions of the Planets", table 1 (valid 1800–2050):
// a (AU), e, I, L, longitude of perihelion, longitude of the ascending node
// (degrees), each followed by its rate per Julian century.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
const ELEMENTS = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
    0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
    0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  // The Earth–Moon barycentre, at most 4,700 km from Earth's centre.
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0,
    0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
    -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
    -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
    0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};

export const PLANETS = Object.keys(ELEMENTS);

function elementsAt(name, ms) {
  const e = ELEMENTS[name];
  const T = (ms - J2000_MS) / (DAY_MS * 36525);
  return [0, 1, 2, 3, 4, 5].map((i) => e[i] + e[i + 6] * T);
}

// Position on the orbit for a given mean anomaly (radians), using the
// elements of the date `ms`. Splitting this from planetPosition lets a page
// draw the whole ellipse a planet is on.
function positionAt(elements, meanAnomaly) {
  const [a, e, I, , peri, node] = elements;
  let E = meanAnomaly;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = (peri - node) * RAD, O = node * RAD, i = I * RAD;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

export function planetPosition(name, ms) {
  const elements = elementsAt(name, ms);
  return positionAt(elements, (elements[3] - elements[4]) * RAD);
}

// The closed ellipse a planet follows around the date `ms`, as `steps` points.
export function planetOrbit(name, ms, steps = 180) {
  const elements = elementsAt(name, ms);
  const points = [];
  for (let i = 0; i < steps; i++) points.push(positionAt(elements, (i / steps) * Math.PI * 2));
  return points;
}

// A unit vector in the ecliptic frame from a right ascension and declination
// (degrees, J2000 equator), for planet spin axes.
export function equatorialToEcliptic(raDeg, decDeg) {
  const ra = raDeg * RAD, dec = decDeg * RAD, eps = 23.4392911 * RAD;
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  return [x, y * Math.cos(eps) + z * Math.sin(eps), -y * Math.sin(eps) + z * Math.cos(eps)];
}

// Index of the last sample at or before `day`, clamped to the ends.
// `samples` are sorted; `dayOf` reads the day out of one.
export function indexAt(samples, day, dayOf = (sample) => sample) {
  let lo = 0, hi = samples.length - 1;
  if (day >= dayOf(samples[hi])) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (dayOf(samples[mid]) <= day) lo = mid; else hi = mid;
  }
  return lo;
}

const rowDay = (row) => row[0];
// Samples are rows of [day, x, y, z, ...extra], sorted by day. Returns the
// row interpolated at `day`, clamped to the ends.
export function sampleRows(rows, day) {
  const i = indexAt(rows, day, rowDay);
  const a = rows[i], b = rows[i + 1];
  if (!b || day <= a[0]) return a.slice();
  const f = (day - a[0]) / (b[0] - a[0]);
  return a.map((value, k) => value + (b[k] - value) * f);
}

// Rows of [day, x, y, z] in km from a packed path: eight bytes a sample,
// x, y, z as signed 16-bit counts of `unitKm` and the time since the sample
// before as an unsigned count of `stepSeconds`.
export function unpackRows(buffer, { byteOffset, count, unitKm, stepSeconds, startDay }) {
  const view = new DataView(buffer, byteOffset, count * 8);
  const rows = [];
  let tick = 0;
  for (let i = 0; i < count; i++) {
    tick += view.getUint16(i * 8 + 6, true);
    rows.push([
      startDay + (tick * stepSeconds) / 86400,
      view.getInt16(i * 8, true) * unitKm, view.getInt16(i * 8 + 2, true) * unitKm, view.getInt16(i * 8 + 4, true) * unitKm,
    ]);
  }
  return rows;
}

// Mission days count from `epoch` (an ISO date), in UTC.
export function missionCalendar(epoch) {
  const epochMs = Date.parse(epoch);
  const dayOf = (ms) => (ms - epochMs) / DAY_MS;
  return {
    epochMs,
    dayOf,
    msOf: (day) => epochMs + day * DAY_MS,
    dayOn: (year, month, date, hour = 0, minute = 0) => dayOf(Date.UTC(year, month - 1, date, hour, minute)),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(ms) {
  const d = new Date(ms);
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// "02:38 UTC", or "15:22:42 UTC" with seconds.
export function clockTime(ms, seconds = false) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + (seconds ? ':' + pad(d.getUTCSeconds()) : '') + ' UTC';
}

// 86,412 s → "24 h 00 min 12 s".
export function formatLightTime(seconds) {
  const s = Math.round(seconds);
  const pad = (n) => String(n).padStart(2, '0');
  return Math.floor(s / 3600) + ' h ' + pad(Math.floor((s % 3600) / 60)) + ' min ' + pad(s % 60) + ' s';
}
