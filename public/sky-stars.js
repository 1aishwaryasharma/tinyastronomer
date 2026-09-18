import * as A from './vendor/astronomy-engine/astronomy.min.js';
import { STAR_CATALOG } from './assets/stars/catalog.js';
import { compassDirection } from './sky-forecast.js';

const MAS_TO_RAD = Math.PI / (180 * 3600000);
const J2000 = Date.parse('2000-01-01T12:00:00Z');

// Catalog vectors and tangential proper motion are prepared once, not per frame.
const catalog = STAR_CATALOG.map(([id, name, ra, dec, magnitude, pmRA, pmDec]) => {
  const alpha = ra * Math.PI / 12, delta = dec * Math.PI / 180;
  const ca = Math.cos(alpha), sa = Math.sin(alpha), cd = Math.cos(delta), sd = Math.sin(delta);
  return {
    key: `star-${id}`, name, magnitude,
    vector: [cd * ca, cd * sa, sd],
    motion: [(-pmRA * sa - pmDec * sd * ca) * MAS_TO_RAD,
      (pmRA * ca - pmDec * sd * sa) * MAS_TO_RAD, pmDec * cd * MAS_TO_RAD],
  };
});

export function starPositions(observer, date) {
  const time = A.MakeTime(date);
  const years = (time.date.getTime() - J2000) / (365.25 * 86400000);
  const rotation = A.Rotation_EQJ_HOR(time, observer);
  return catalog.map(({ vector, motion, ...star }) => {
    const [x, y, z] = vector.map((value, index) => value + years * motion[index]);
    const horizon = A.HorizonFromVector(A.RotateVector(rotation, new A.Vector(x, y, z, time)), 'normal');
    return { ...star, altitude: horizon.lat, azimuth: horizon.lon, compass: compassDirection(horizon.lon) };
  });
}

// A drawing convention, not a prediction of naked-eye visibility.
export function starOpacity(magnitude, sunAltitude) {
  if (sunAltitude >= -6) return 0;
  const darkness = Math.min(1, (-sunAltitude - 6) / 12);
  const limit = 1 + 3.5 * darkness;
  if (magnitude > limit) return 0;
  return darkness * Math.max(0.28, Math.min(1, 1 - (magnitude + 1.5) * 0.11));
}

export function brightStarsNow(positions, sunAltitude) {
  if (sunAltitude >= -6) return [];
  return positions.filter(star => star.name && star.altitude >= 10 && starOpacity(star.magnitude, sunAltitude) > 0)
    .sort((a, b) => a.magnitude - b.magnitude).slice(0, 5);
}
