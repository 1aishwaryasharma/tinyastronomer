/* Voyager 1: what the page knows that needs no DOM and no 3D, so the tests
   can hold it to JPL Horizons and to the spacecraft model directly. */
import {
  AU_KM, LIGHT_KM_PER_SEC, lerp, missionCalendar, planetPosition, sampleRows, smooth,
} from '../mission-orbits.js?v=20261121-1';

// `key` names a node in voyager.glb, with a `Hotspot_<key>` anchor beside it.
export const PARTS = [
  { key: 'HighGainAntenna', label: 'Big dish', title: 'High-gain antenna',
    text: 'A 3.7-metre dish that always points at Earth. Its radio is about as powerful as a fridge light bulb, and by the time the signal arrives it is billions of times fainter than a watch battery.' },
  { key: 'RTG', label: 'Power', title: 'Nuclear batteries',
    text: 'Three generators turn the heat of decaying plutonium into electricity. They sit out on a boom so their radiation does not confuse the instruments.' },
  { key: 'ScanPlatform', label: 'Cameras', title: 'Scan platform',
    text: 'A turning mount for two cameras and other light sensors. It took the close-ups of Jupiter and Saturn, and the Pale Blue Dot. Switched off since 1990.' },
  { key: 'MagnetometerBoom', label: 'Long boom', title: 'Magnetometer boom',
    text: 'Thirteen metres long, folded into a can for launch. It holds magnetic sensors far from the spacecraft, and is still measuring the magnetism between the stars.' },
  { key: 'PlasmaWaveAntennas', label: 'Whiskers', title: 'Plasma wave antennas',
    text: 'Two 10-metre rods that feel ripples in the thin gas around the spacecraft. In 2012 they picked up the hum that proved Voyager had reached interstellar space.' },
  { key: 'GoldenRecord', label: 'Golden Record', title: 'The Golden Record',
    text: 'A gold-plated record of pictures, music and greetings from Earth, under a cover engraved with instructions for playing it.' },
  { key: 'ScienceBoom', label: 'Particle detectors', title: 'Science boom',
    text: 'Detectors for cosmic rays and charged particles ride here. Most have been switched off to save power as the batteries fade.' },
  { key: 'Bus', label: 'Body', title: 'The bus',
    text: 'A ten-sided box holding three pairs of computers, a tape recorder and the fuel tank. All its computers together have about 70 kilobytes of memory, far less than one phone photo.' },
];

// The Golden Record greetings the page can play: ten of the fifty-five.
// `said` is NASA's translation; `key` names the recording,
// audio/greeting-<key>.mp3.
export const GREETINGS = [
  { key: 'english', label: 'English', said: 'Hello from the children of planet Earth.' },
  { key: 'mandarin', label: 'Mandarin', said: 'Hope everyone’s well. We are thinking about you all. Please come here to visit when you have time.' },
  { key: 'hindi', label: 'Hindi', said: 'Greetings from the inhabitants of this world.' },
  { key: 'spanish', label: 'Spanish', said: 'Hello and greetings to all.' },
  { key: 'arabic', label: 'Arabic', said: 'Greetings to our friends in the stars. We wish that we will meet you someday.' },
  { key: 'french', label: 'French', said: 'Hello everybody.' },
  { key: 'bengali', label: 'Bengali', said: 'Hello! Let there be peace everywhere.' },
  { key: 'russian', label: 'Russian', said: 'Greetings! I welcome you!' },
  { key: 'japanese', label: 'Japanese', said: 'Hello? How are you?' },
  { key: 'zulu', label: 'Zulu', said: 'We greet you, great ones. We wish you longevity.' },
];

// What Voyager's plasma wave antennas picked up, by the chapter that plays
// it: electric waves, not sound, played through a speaker by the University
// of Iowa team that built the instrument. `key` names audio/<key>.mp3, `text`
// is what the card says while it plays, and `gain` tames the loud ones.
export const RECORDINGS = {
  jupiter: [
    { key: 'jupiter-lightning', label: 'Lightning', gain: 0.45,
      text: '<strong>Lightning on Jupiter.</strong> Each falling whistle is the radio crackle of a lightning bolt: the first sign of storms on another planet. March 1979.' },
    { key: 'jupiter-chorus', label: 'Dawn chorus', gain: 0.4,
      text: '<strong>Jupiter’s dawn chorus.</strong> Electrons trapped in the planet’s radiation belts make rising chirps, like birds at sunrise. 5 March 1979.' },
    { key: 'jupiter-bow-shock', label: 'Bow shock', gain: 0.35,
      text: '<strong>The bow shock.</strong> The hiss turns to a roar where the solar wind slams into Jupiter’s magnetic field, four days before the flyby. 1 March 1979.' },
  ],
  edge: [
    { key: 'termination-shock', label: 'Solar wind slows', gain: 0.5,
      text: '<strong>15 December 2004.</strong> Ripples in the thin gas just before Voyager crossed the termination shock, where the solar wind suddenly slows. Three hours are squeezed into six seconds.' },
    { key: 'plasma-waves', label: 'Interstellar space', gain: 0.5,
      text: '<strong>2012 and 2013.</strong> Ripples in the gas between the stars. Seven months are squeezed into twelve seconds, and the rising pitch means the gas is getting denser: the proof that Voyager had left the Sun’s bubble.' },
  ],
};

// The hum under each chapter, as mission-audio.js takes it: pitch and filter
// in hertz, `air` the hiss of wind, `swell` how hard the chapter's event
// presses as the reader scrolls. The launch roars and falls away, each giant
// planet swells to its closest approach, the wind rises where the Sun's
// bubble ends, and the last chapter dies away as the spacecraft does.
const pass = (p) => smooth(0, 1, 1 - Math.abs(p - 0.5) * 2);
export const BEDS = {
  hero: { root: 110, bright: 500, air: 0.01, level: 0.6 },
  craft: { root: 110, bright: 700, air: 0.01, level: 0.5 },
  launch: { root: 61.7, bright: 350, air: 0.06, level: 0.7, swell: (p) => 1 - smooth(0, 0.45, p) },
  jupiter: { root: 82.4, bright: 300, air: 0.02, level: 0.6, swell: pass },
  cruise: { root: 98, bright: 600, air: 0.02, level: 0.5 },
  saturn: { root: 73.4, bright: 320, air: 0.02, level: 0.6, swell: pass },
  portrait: { root: 196, bright: 1600, air: 0, level: 0.45 },
  edge: { root: 98, bright: 400, air: 0.04, level: 0.6, swell: (p) => smooth(0.6, 0.85, p) },
  lightday: { root: 130.8, bright: 900, air: 0.02, level: 0.4 },
  record: { root: 110, bright: 700, air: 0, level: 0.25 },
  future: { root: 82.4, bright: 500, air: 0.04, level: 0.7, fades: true },
};

// `data` is trajectory.json.
export function createFlight(data) {
  const calendar = missionCalendar(data.epoch);
  const { dayOf, dayOn } = calendar;
  // One lookup over the mission: the daily cruise rows to 1981, then the
  // thirty-day rows. Each is [day, x, y, z, speed].
  const rows = data.cruise.concat(data.deep.slice(1));
  const lastDay = rows[rows.length - 1][0];
  const at = (day) => sampleRows(rows, day);
  const DAYS = {
    jupiter: data.jupiter.closestDay,
    saturn: data.saturn.closestDay,
    portrait: dayOn(1990, 2, 14),
    shock: dayOn(2004, 12, 16),
    pause: dayOn(2012, 8, 25),
    lightDay: dayOn(2026, 11, 18, 10),
  };

  // Where Voyager 1 is at a wall-clock moment, measured two ways. The range
  // from Earth swings by about 250 million km over a year as Earth circles
  // the Sun, so for a few months of each year it shrinks.
  function live(ms) {
    const [, x, y, z, kmPerSec] = at(dayOf(ms));
    const earth = planetPosition('earth', ms);
    const sunKm = Math.hypot(x, y, z) * AU_KM;
    const earthKm = Math.hypot(x - earth[0], y - earth[1], z - earth[2]) * AU_KM;
    return { sunKm, earthKm, lightSeconds: earthKm / LIGHT_KM_PER_SEC, kmPerSec };
  }

  // A day and a half either side of closest approach, so the middle of the
  // chapter is the moment of the pass.
  const flyby = (closestDay) => (p) => lerp(closestDay - 1.5, closestDay + 1.5, smooth(0, 1, p) * 0.5 + p * 0.5);
  // The mission day each dated chapter shows at scroll progress `p`.
  const chapterDay = {
    launch: (p) => lerp(1, DAYS.jupiter - 4, p),
    jupiter: flyby(DAYS.jupiter),
    cruise: (p) => lerp(DAYS.jupiter + 4, DAYS.saturn - 4, p),
    saturn: flyby(DAYS.saturn),
    // Reaches 14 February 1990 early, then holds while the camera turns back.
    portrait: (p) => lerp(DAYS.saturn + 4, DAYS.portrait, smooth(0, 0.32, p)),
    edge: (p) => lerp(DAYS.portrait, DAYS.pause + 420, smooth(0.05, 0.95, p)),
    lightday: () => Math.min(dayOf(Date.now()), lastDay),
  };

  return { ...calendar, rows, at, lastDay, DAYS, live, chapterDay };
}
