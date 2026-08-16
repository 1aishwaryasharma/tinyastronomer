/* ─────────────────────────────────────────────────────────
   SPACE_DATA — one canonical body catalog for every scene.
   Physical identity, sky elements, and Grand Tour story live
   here. common.js stays render-only; pages that need bodies
   load this file. Missions does not.
   ───────────────────────────────────────────────────────── */
export const SPACE_DATA = (function () {
  const F = (size, day, year, moons, gravity) => ({ day, gravity, moons, size, year });

  const BODIES = {
    ceres: {
      au: 2.77,
      blurb: 'The biggest object in the asteroid belt, and the closest dwarf planet to the Sun. It is round, like a tiny planet.',
      dot: '#9a9088',
      dwarf: true,
      facts: F('Its volume is about <strong>1/2,500 of Earth\'s</strong>.', 'One spin takes just <strong>9 hours</strong>.',
        'One trip around the Sun takes about <strong>4.6 Earth years</strong>.', '<strong>No known moons.</strong>', 'Surface gravity is about <strong>3% of Earth\'s</strong>.'),
      g: 0.029,
      key: 'ceres',
      moons: 0,
      name: 'Ceres',
      num: '◦',
      periodDays: 1682,
      radiusKm: 473,
      retro: false,
      rotationHours: 9.07,
      tiltDeg: 4,
      type: 'rock',
      wow: 'Ceres may hide salty water beneath its surface — and it has bright, shiny spots made of salt!'
    },
    earth: {
      L0: 100.46435,
      au: 1.0,
      blurb: 'Our home — the only place we know of with oceans, air to breathe, and living things.',
      dot: '#6ab0ff',
      facts: F('<strong>This is home!</strong> Everything you know lives here.', 'One spin takes <strong>24 hours</strong> — one day and night.',
        'One trip around the Sun takes about <strong>365.25 days</strong>.', '<strong>1 moon</strong> — the one you see at night.', 'Surface gravity is the <strong>Earth reference: 1×</strong>.'),
      g: 1.0,
      key: 'earth',
      moonList: [{ color: '#cfcabd', name: 'Moon', orbit: 2.6, period: 27.3, size: 0.27 }],
      moons: 1,
      n: 0.98560912,
      naked: true,
      name: 'Earth',
      num: '03',
      periodDays: 365.25,
      radiusKm: 6371,
      retro: false,
      rotationHours: 23.93,
      tiltDeg: 23.4393,
      type: 'earth',
      wow: 'Earth is the only planet with liquid water oceans on its surface — a big part of why life can live here.'
    },
    eris: {
      au: 67.78,
      blurb: 'A faraway, icy dwarf planet about the same size as Pluto. Its discovery helped prompt astronomers to define the modern category "dwarf planet."',
      dot: '#d8d2c4',
      dwarf: true,
      facts: F('About the same size as Pluto.', 'One spin takes about <strong>26 hours</strong>.',
        'One trip around the Sun takes about <strong>558 Earth years</strong>!', '<strong>1 known moon</strong>, called Dysnomia.', 'Surface gravity is about <strong>8% of Earth\'s</strong>.'),
      g: 0.084,
      key: 'eris',
      moons: 1,
      name: 'Eris',
      num: '◦',
      periodDays: 203830,
      radiusKm: 1163,
      retro: false,
      rotationHours: 25.9,
      // Eris's spin-axis tilt has not been established; keep the teaching
      // globe upright instead of confusing orbital inclination with axial tilt.
      tiltDeg: 0,
      type: 'rock',
      wow: 'Eris is so far away that from its surface, the Sun would look like just a very bright star.'
    },
    jupiter: {
      L0: 34.40438,
      au: 5.203,
      bands: ['#c9a06b', '#ddc196', '#a9713f', '#e8d6b0', '#93613c', '#d0aa78'],
      blurb: 'The biggest planet of all — a giant ball of gas with colourful stripes and a storm bigger than Earth.',
      dot: '#d9b48a',
      facts: F('Its volume is about <strong>1,321 Earth volumes</strong>.', 'It spins the fastest — one spin takes only <strong>10 hours</strong>.',
        'A year is almost <strong>12 Earth years</strong> long.', '<strong>115 moons</strong> were officially recognized as of August 2026.', 'Near the cloud tops, gravity is about <strong>2.5× Earth\'s</strong>; there is no solid surface.'),
      g: 2.53,
      key: 'jupiter',
      moonList: [
        { color: '#e8df8a', name: 'Io', orbit: 1.9, period: 1.77, size: 0.10 },
        { color: '#d8cdbf', name: 'Europa', orbit: 2.3, period: 3.55, size: 0.09 },
        { color: '#a89a86', name: 'Ganymede', orbit: 2.9, period: 7.15, size: 0.14 },
        { color: '#7d7266', name: 'Callisto', orbit: 3.6, period: 16.7, size: 0.13 }
      ],
      moons: 115,
      n: 0.08308676,
      naked: true,
      name: 'Jupiter',
      num: '05',
      periodDays: 4331,
      radiusKm: 69911,
      retro: false,
      rotationHours: 9.93,
      spot: { color: '#b5573a', rx: 0.09, ry: 0.05, x: 0.62, y: 0.60 },
      tiltDeg: 3.13,
      type: 'gas',
      wow: 'The Great Red Spot is a storm bigger than the entire Earth that has been swirling for hundreds of years.'
    },
    mars: {
      L0: 355.45332,
      au: 1.524,
      blurb: 'The red planet — a cold, dusty desert world. NASA\'s Curiosity and Perseverance rovers were operating there as of August 2026.',
      dot: '#d0674a',
      facts: F('Its volume is about <strong>15% of Earth\'s</strong>.', 'A day is 24.6 hours — <strong>almost like Earth\'s</strong>.',
        'A year is 687 Earth days — nearly <strong>2 Earth years</strong>.', '<strong>2 tiny moons</strong>, Phobos and Deimos.', 'Surface gravity is about <strong>38% of Earth\'s</strong>.'),
      g: 0.38,
      key: 'mars',
      moonList: [
        { color: '#9a8d7f', name: 'Phobos', orbit: 2.0, period: 0.32, size: 0.06 },
        { color: '#9a8d7f', name: 'Deimos', orbit: 2.8, period: 1.26, size: 0.05 }
      ],
      moons: 2,
      n: 0.52403304,
      naked: true,
      name: 'Mars',
      num: '04',
      periodDays: 687,
      polarCaps: true,
      radiusKm: 3390,
      retro: false,
      rotationHours: 24.62,
      tiltDeg: 25.19,
      type: 'rock',
      wow: 'Mars has the tallest volcano in the whole solar system — three times higher than Mount Everest.'
    },
    mercury: {
      L0: 252.25084,
      au: 0.387,
      blurb: 'The smallest planet and the closest to the Sun. It races around the Sun faster than any other world.',
      dot: '#b9b2a6',
      facts: F('Its volume is about <strong>5.6% of Earth\'s</strong>.', 'One slow spin takes <strong>59 Earth days</strong>.',
        'A whole year is just <strong>88 Earth days</strong>.', '<strong>No known moons.</strong>', 'Surface gravity is about <strong>38% of Earth\'s</strong>.'),
      g: 0.38,
      key: 'mercury',
      moons: 0,
      n: 4.09233445,
      naked: true,
      name: 'Mercury',
      num: '01',
      periodDays: 88,
      radiusKm: 2440,
      retro: false,
      rotationHours: 1407.6,
      tiltDeg: 0.03,
      type: 'rock',
      wow: 'Its days are boiling hot and its nights are freezing cold, because it has almost no air to hold in the warmth.'
    },
    neptune: {
      L0: 304.88003,
      au: 30.07,
      bands: ['#3b6fd0', '#4f80dc', '#3160b8', '#5a8ae0'],
      blurb: 'The farthest planet — a pale blue ice giant with the fastest winds in the solar system.',
      dot: '#3f6fd8',
      facts: F('Its volume is about <strong>58 Earth volumes</strong>.', 'A day is about <strong>16 hours</strong> long.',
        'A year is <strong>165 Earth years</strong> — it completed its first post-discovery orbit in 2011!', '<strong>16 known moons</strong> as reviewed in August 2026.', 'Near the cloud tops, gravity is about <strong>1.1× Earth\'s</strong>; there is no solid surface.'),
      g: 1.14,
      key: 'neptune',
      moonList: [{ color: '#cdd6d8', name: 'Triton', orbit: 2.4, period: -5.9, size: 0.10 }],
      moons: 16,
      n: 0.00598103,
      naked: false,
      name: 'Neptune',
      num: '08',
      periodDays: 60190,
      radiusKm: 24622,
      retro: false,
      rotationHours: 16.11,
      spot: { color: '#20407e', rx: 0.06, ry: 0.045, x: 0.40, y: 0.44 },
      tiltDeg: 28.32,
      type: 'ice',
      wow: 'Its winds can exceed 2,000 km/h — the fastest measured anywhere in the solar system.'
    },
    pluto: {
      au: 39.48,
      blurb: 'Once called the ninth planet, Pluto is now a "dwarf planet" — small and icy, sharing its zone with many other little worlds far past Neptune.',
      dot: '#c9b8a0',
      dwarf: true,
      facts: F('Smaller than our own Moon!', 'One spin takes about <strong>6.4 Earth days</strong>.',
        'One trip around the Sun takes <strong>248 Earth years</strong>.', '<strong>5 known moons</strong> — the biggest is Charon.', 'Surface gravity is about <strong>6% of Earth\'s</strong>.'),
      g: 0.063,
      key: 'pluto',
      moons: 5,
      name: 'Pluto',
      num: '◦',
      periodDays: 90560,
      radiusKm: 1188,
      retro: true,
      rotationHours: 153.3,
      tiltDeg: 122.5,
      type: 'rock',
      wow: 'Pluto and its moon Charon always face each other as they spin — like two dancers holding hands.'
    },
    saturn: {
      L0: 49.94432,
      au: 9.537,
      bands: ['#d8c69a', '#e9dbb8', '#c9b184', '#efe3c6', '#cbb98d', '#e2d3aa'],
      blurb: 'Famous for its dazzling rings, made of billions of chunks of ice and rock all circling the planet.',
      dot: '#e6d3a0',
      facts: F('Its volume is about <strong>764 Earth volumes</strong>.', 'A day is only about <strong>11 hours</strong> long.',
        'A year is about <strong>29 Earth years</strong>.', '<strong>293 moons</strong> were confirmed as of August 2026.', 'Near the cloud tops, gravity is about <strong>1.1× Earth\'s</strong>; there is no solid surface.'),
      g: 1.07,
      key: 'saturn',
      moonList: [
        { color: '#c9a24b', name: 'Titan', orbit: 3.2, period: 15.9, size: 0.13 },
        { color: '#b7b2a6', name: 'Rhea', orbit: 2.5, period: 4.5, size: 0.07 }
      ],
      moons: 293,
      n: 0.03344414,
      naked: true,
      name: 'Saturn',
      num: '06',
      periodDays: 10747,
      radiusKm: 58232,
      retro: false,
      rings: true,
      rotationHours: 10.66,
      tiltDeg: 26.73,
      type: 'gas',
      wow: 'Saturn is so light for its size that it would float in a giant bathtub of water — if you could find one big enough!'
    },
    uranus: {
      L0: 313.23218,
      au: 19.19,
      bands: ['#a9d8e0', '#bfe4ea', '#98cdd6', '#b6e0e6'],
      blurb: 'A cold, blue-green world that is tipped right over — it spins on its side, like a ball rolling around the Sun.',
      dot: '#a9e0e2',
      facts: F('Its volume is about <strong>63 Earth volumes</strong>.', 'A day is about <strong>17 hours</strong> long.',
        'A year is <strong>84 Earth years</strong>!', '<strong>29 known moons</strong> as of August 2026.', 'Near the cloud tops, gravity is about <strong>0.9× Earth\'s</strong>; there is no solid surface.'),
      g: 0.90,
      key: 'uranus',
      moonList: [
        { color: '#b9c7c9', name: 'Titania', orbit: 2.2, period: 8.7, size: 0.07 },
        { color: '#a9b6b8', name: 'Oberon', orbit: 2.8, period: 13.5, size: 0.06 }
      ],
      moons: 29,
      n: 0.01172834,
      naked: false,
      name: 'Uranus',
      num: '07',
      periodDays: 30589,
      radiusKm: 25362,
      retro: true,
      rotationHours: 17.24,
      tiltDeg: 97.77,
      type: 'ice',
      wow: 'Uranus is tipped over on its side, so each of its summers and winters lasts about 21 Earth years.'
    },
    venus: {
      L0: 181.97973,
      au: 0.723,
      blurb: 'The hottest planet of all, wrapped in thick, swirling yellow clouds. It is almost exactly the same size as Earth.',
      dot: '#e8cd8a',
      facts: F('Its volume is about <strong>86% of Earth\'s</strong>.', 'It rotates <strong>backwards</strong>: one spin relative to the stars takes 243 Earth days; sunrise to sunrise takes about 117.',
        'A year is 225 Earth days — <strong>shorter than its day</strong>!', '<strong>No known moons.</strong>', 'Surface gravity is about <strong>91% of Earth\'s</strong>.'),
      g: 0.91,
      key: 'venus',
      moons: 0,
      n: 1.60213047,
      naked: true,
      name: 'Venus',
      num: '02',
      periodDays: 224.7,
      radiusKm: 6052,
      retro: true,
      rotationHours: 5832.5,
      tiltDeg: 177.4,
      type: 'venus',
      wow: 'It is hot enough to melt lead — the hottest planet, even though Mercury sits closer to the Sun.'
    }
  };

  const PLANET_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  const DWARF_ORDER = ['ceres', 'pluto', 'eris'];

  const OTHER = {
    comet: {
      blurb: 'A small icy body on a Halley-like orbit. When it swoops near the Sun, some of its ice turns to gas and dust streams out into a bright coma and tails.',
      dot: '#9fd8ff',
      facts: F('A small, icy nucleus — shown much larger than scale.', 'It tumbles as it flies; this model does not simulate its rotation.',
        'This example takes about <strong>75 years</strong> per orbit.', '<strong>No moons are modeled.</strong>', 'Its gravity is <strong>far weaker than Earth\'s</strong>.'),
      key: 'comet',
      name: 'Halley-like Comet',
      num: '☄',
      wow: 'A comet\'s ion tail points almost directly away from the Sun. Its dust tail also extends generally away but can curve.'
    },
    sun: {
      blurb: 'Our star — a giant, glowing ball of superheated plasma that gives every planet its light and warmth.',
      dot: '#f4c560',
      facts: F('Its volume is about <strong>1.3 million Earth volumes</strong>.', 'It rotates at different speeds: about <strong>25 days at the equator</strong> and 36 near the poles.',
        'It circles the Milky Way roughly once every <strong>230 million Earth years</strong>.', '<strong>8 planets</strong> circle it, plus moons, dwarf planets and comets.',
        'The Sun has no solid surface; gravity at its visible photosphere is about <strong>28× Earth\'s</strong>.'),
      key: 'sun',
      name: 'The Sun',
      num: '☀',
      wow: 'The Sun contains about 99.8% of the solar system\'s mass.'
    }
  };

  function copies(order) {
    return order.map((key) => {
      const body = BODIES[key];
      if (!body) throw new Error('Unknown body key: ' + key);
      return Object.assign({}, body);
    });
  }

  return {
    BODIES,
    DWARF_ORDER,
    OTHER,
    PLANET_ORDER,
    dwarfs: () => copies(DWARF_ORDER),
    list: copies,
    planets: () => copies(PLANET_ORDER)
  };
})();

window.SPACE_DATA = SPACE_DATA;
