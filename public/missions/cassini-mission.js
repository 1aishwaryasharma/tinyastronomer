/* Cassini–Huygens: what the page knows that needs no DOM and no 3D, so the
   tests can hold it to JPL Horizons and to the spacecraft model directly. */
import {
  AU_KM, LIGHT_KM_PER_SEC, clamp01, lerp, missionCalendar, planetPosition, sampleRows, smooth,
} from '../mission-orbits.js?v=20261121-2';

// `key` names a node in cassini.glb, with a `Hotspot_<key>` anchor beside it.
export const PARTS = [
  { key: 'HighGainAntenna', label: 'Big dish', title: 'High-gain antenna',
    text: 'A 4-metre dish built in Italy. It sent every picture home, and worked as a radar to see through Titan’s haze. In risky spots Cassini flew dish-first and used it as a shield.' },
  { key: 'HuygensProbe', label: 'Huygens', title: 'The Huygens probe',
    text: 'Europe’s Titan lander, 2.7 metres across, rode on Cassini’s side for seven years. The gold shell is a heat shield. Inside were six instruments and three parachutes.' },
  { key: 'RTG', label: 'Power', title: 'Nuclear batteries',
    text: 'Sunlight at Saturn is about a hundred times weaker than at Earth. Three generators turned the heat of decaying plutonium into electricity instead.' },
  { key: 'MagnetometerBoom', label: 'Long boom', title: 'Magnetometer boom',
    text: 'An 11-metre arm that unfolded after the Earth flyby. It held magnetic sensors far from the spacecraft’s own electronics. They found the first hint of Enceladus’s plume.' },
  { key: 'RemoteSensingPallet', label: 'Cameras', title: 'Cameras and telescopes',
    text: 'Two cameras and three other telescopes, all bolted to one platform and all looking the same way. To aim them, the whole spacecraft had to turn.' },
  { key: 'RPWSAntennas', label: 'Whiskers', title: 'Radio and plasma antennas',
    text: 'Three 10-metre rods that listened to radio waves from Saturn’s lightning and auroras, and felt ring dust pattering against the spacecraft.' },
  { key: 'MainEngines', label: 'Engines', title: 'Main engines',
    text: 'Two engines, one of them a spare. A single 96-minute burn slowed Cassini enough for Saturn to catch it. More than half of Cassini’s launch weight was fuel.' },
  { key: 'Bus', label: 'Body', title: 'The body',
    text: 'A stack nearly 7 metres tall: computers and radios in the ring under the dish, then the fuel tanks, wrapped in gold-coloured blankets against the cold.' },
];

// The pole is its right ascension and declination in degrees. Saturn's moons
// turn about the same axis. The polar radius is at the one-bar level, like
// the equatorial radius the trajectory is scaled by.
export const SATURN = { pole: [40.589, 83.537], periodDays: 0.44401, polarKm: 54364 };

// The recordings each chapter can play, as mission-audio.js takes them:
// `key` names audio/<key>.mp3, `text` is what the card says while it plays,
// `gain` tames the loud ones, and `at` is the scroll progress from which the
// story plays it by itself for a reader with sound on. All but the legacy's
// are what Cassini's radio and plasma wave antennas picked up: electric
// waves, not sound, played through a speaker by the University of Iowa team
// that built the instrument. The finale's `at` are where its chapter reaches
// each recording's date; the lightning's is where the tour reaches January
// 2006. Mission control at the end plays as the reader arrives after the
// plunge, as the last signal reached Earth after it.
export const RECORDINGS = {
  arrival: [
    { key: 'saturn-bow-shock', label: 'Bow shock', gain: 0.5, at: 0.05,
      text: '<strong>27 June 2004.</strong> Four days out, Cassini crossed the bow shock, where the solar wind slams into Saturn’s magnetic field, and the hiss turns to a roar. Twenty-eight minutes are squeezed into ten seconds.' },
  ],
  tour: [
    { key: 'saturn-radio', label: 'Radio from the auroras', gain: 0.45, at: 0.03,
      text: '<strong>Saturn’s radio voice.</strong> Radio waves from its auroras, rising and falling like birdsong. They are far too high to hear, so they are played 44 times lower and 22 times faster. November 2003, as Cassini closed in.' },
    { key: 'saturn-lightning', label: 'Lightning', gain: 0.5, at: 0.145,
      text: '<strong>A thunderstorm on Saturn.</strong> Each crackle is the radio burst from a lightning bolt deep in its clouds, like static on a radio during a storm. About fifty minutes are squeezed into twelve seconds. 23 January 2006.' },
  ],
  finale: [
    { key: 'ring-gap', label: 'Inside the gap', gain: 0.5, at: 0.012,
      text: '<strong>26 April 2017.</strong> The first dive between the rings and the planet. Scientists expected dust to pelt the spacecraft. They heard almost none: only the whistles of waves in the thin gas. Played four times faster.' },
    { key: 'enceladus-waves', label: 'Enceladus calling', gain: 0.5, at: 0.66,
      text: '<strong>2 September 2017.</strong> Waves running along the magnetic field between Saturn and Enceladus, the moon with the fountains: a sign the two are wired together. Lowered five times in pitch, and played about thirty times faster.' },
  ],
  legacy: [
    { key: 'loss-of-signal', label: 'The last signal', at: 0,
      text: '<strong>Mission control, 15 September 2017.</strong> The room at JPL as Cassini’s radio fell silent: “the signal from the spacecraft is gone, and within the next 45 seconds, so will be the spacecraft.” A real recording, made on Earth.' },
  ],
};

// Flyby tags crowd the inner solar system, so once Cassini is this far from
// the Sun only Jupiter's is left up, and the outer planets get their names.
const INNER_AU = 2.2;
// A planet this close to one of its own flyby tags (AU) loses its name tag;
// by the second distance the tag is back in full.
const TAG_HIDDEN_AU = 0.12, TAG_CLEAR_AU = 0.36;

// Distance from the centre of a flattened globe to its surface at a latitude.
const surfaceKm = (equatorKm, polarKm, sinLat) => 1 / Math.sqrt((1 - sinLat * sinLat) / (equatorKm * equatorKm) + (sinLat * sinLat) / (polarKm * polarKm));

// `data` is trajectory.json.
export function createFlight(data) {
  const calendar = missionCalendar(data.epoch);
  const { msOf, dayOn } = calendar;
  const DAYS = {
    arrival: data.cruise[data.cruise.length - 1][0],
    soi: data.soi.closestDay,
    // NASA: the engine fired for 96 minutes from 01:12 UTC at Saturn.
    burnStart: dayOn(2004, 7, 1, 1, 12),
    burnEnd: dayOn(2004, 7, 1, 2, 48),
    entry: data.titan.entryDay,
    landed: data.titan.landDay,
    plume: data.enceladus.closestDay,
    finale: dayOn(2017, 4, 22),
    end: data.end.day,
  };
  const PHASES = [
    { name: 'Prime mission', from: -Infinity },
    { name: 'Equinox mission', from: dayOn(2008, 7, 1) },
    { name: 'Solstice mission', from: dayOn(2010, 9, 27) },
    { name: 'Grand Finale', from: DAYS.finale },
  ];
  const dives = data.finale.periapses;
  const lastDive = dives[dives.length - 1].day;

  // How far a radio message has to travel between Saturn and Earth at a
  // wall-clock moment. Cassini's last signal took 83 minutes.
  function live(ms) {
    const saturn = planetPosition('saturn', ms), earth = planetPosition('earth', ms);
    const earthKm = Math.hypot(saturn[0] - earth[0], saturn[1] - earth[1], saturn[2] - earth[2]) * AU_KM;
    return { earthKm, lightSeconds: earthKm / LIGHT_KM_PER_SEC };
  }

  // Each flyby with its tag and where Cassini was at the time (AU, ecliptic).
  const flybys = ['venus1', 'venus2', 'earth', 'jupiter'].map((key) => {
    const flyby = data.flybys[key];
    return {
      ...flyby, key, planet: flyby.name.toLowerCase(),
      text: flyby.name + ' flyby · ' + new Date(msOf(flyby.day)).getUTCFullYear(),
      at: sampleRows(data.cruise, flyby.day).slice(1, 4),
    };
  });
  function cruise(day) {
    const [, x, y, z, kmPerSec] = sampleRows(data.cruise, day);
    const sunAu = Math.hypot(x, y, z);
    return { sunAu, kmPerSec, inner: sunAu < INNER_AU };
  }
  const flybyTagged = (flyby, day) => day >= flyby.day && (flyby.key === 'jupiter' || cruise(day).inner);
  // How strongly to show a planet's own name. Its flyby tags already name it,
  // and the two would print over each other while the planet is at the
  // flyby point: on the day itself, and whenever its orbit brings it back
  // round, as Venus's does in July 1999.
  function nameTagAlpha(planet, day) {
    const at = planetPosition(planet, msOf(day));
    let alpha = 1;
    for (const flyby of flybys) {
      if (flyby.planet !== planet || !flybyTagged(flyby, day)) continue;
      const apart = Math.hypot(at[0] - flyby.at[0], at[1] - flyby.at[1], at[2] - flyby.at[2]);
      alpha = Math.min(alpha, smooth(TAG_HIDDEN_AU, TAG_CLEAR_AU, apart));
    }
    return alpha;
  }

  // Titan on any day of the tour is the one measured lap, repeated: the day
  // within that lap when Titan was where it is on `day`.
  const lap = data.titanOrbit;
  const titanLapDay = (day) => {
    const start = lap.path[0][0];
    return start + ((((day - start) % lap.periodDays) + lap.periodDays) % lap.periodDays);
  };

  // Huygens's last hours: the fall toward Titan, the descent through its air,
  // then the time on the ground, each as 0 to 1.
  function titanDescent(p) {
    const falling = clamp01(p / 0.46), descent = clamp01((p - 0.46) / 0.32), after = clamp01((p - 0.78) / 0.22);
    const day = p < 0.46 ? lerp(DAYS.entry - 0.22, DAYS.entry, 1 - Math.pow(1 - falling, 1.6))
      : p < 0.78 ? lerp(DAYS.entry, DAYS.landed, descent) : lerp(DAYS.landed, DAYS.landed + 0.05, after);
    return { day, falling, descent, after };
  }

  // The mission day each dated chapter shows at scroll progress `p`.
  const chapterDay = {
    // The inner flybys take a third of the days but most of the story.
    cruise: (p) => (p < 0.56 ? lerp(1, 720, p / 0.56) : lerp(720, DAYS.arrival, (p - 0.56) / 0.44)),
    arrival: (p) => lerp(DAYS.soi - 0.34, DAYS.soi + 0.3, smooth(0, 1, p) * 0.4 + p * 0.6),
    titan: (p) => titanDescent(p).day,
    tour: (p) => lerp(data.tour.startDay, DAYS.end, smooth(0, 1, p) * 0.3 + p * 0.7),
    enceladus: (p) => lerp(DAYS.plume - 0.0028, DAYS.plume + 0.0028, p),
    // Twenty-two quick laps, then the last half-lap with its final hours
    // stretched out.
    finale: (p) => (p < 0.7 ? lerp(dives[0].day - 2.2, lastDive + 0.6, p / 0.7)
      : lerp(lastDive + 0.6, DAYS.end, 1 - Math.pow(1 - (p - 0.7) / 0.3, 3))),
  };

  return {
    ...calendar, DAYS, PHASES, flybys, dives, live, cruise, flybyTagged, nameTagAlpha, titanLapDay, titanDescent, chapterDay,
    phaseAt: (day) => PHASES.findLast((phase) => day >= phase.from),
    // An orbit is complete at each close pass after the first.
    orbitsCompleted: (day) => Math.max(0, data.periapses.filter((pass) => pass <= day).length - 1),
    // Which dive of the Grand Finale Cassini is on: each starts half a day
    // before its close pass.
    diveNumber: (day) => dives.filter((dive) => dive.day - 0.5 <= day).length,
    finalApproach: (day) => day > lastDive + 0.6,
    // Height above the level where Saturn's air is as thick as Earth's at
    // the sea, which is what "the cloud tops" means. `sinLat` is the sine of
    // the latitude; both worlds bulge at the equator.
    cloudAltitudeKm: (distanceKm, sinLat) => distanceKm - surfaceKm(data.saturnKm, SATURN.polarKm, sinLat),
    iceAltitudeKm: (distanceKm, sinLat) => distanceKm - surfaceKm(data.enceladus.equatorKm, data.enceladus.polarKm, sinLat),
  };
}
