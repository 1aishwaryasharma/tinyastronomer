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

// The hum under each chapter, as mission-audio.js takes it: pitch and filter
// in hertz, `air` the hiss of wind. Low and close at the giant planets, thin
// and windy at the edge of the Sun's bubble, dying away in the last chapter
// as the spacecraft does.
export const BEDS = {
  hero: { root: 110, bright: 700, air: 0.02, level: 0.8 },
  craft: { root: 110, bright: 900, air: 0.02, level: 0.7 },
  launch: { root: 123.5, bright: 1100, air: 0.04, level: 0.9 },
  jupiter: { root: 82.4, bright: 600, air: 0.05 },
  cruise: { root: 98, bright: 800, air: 0.03, level: 0.8 },
  saturn: { root: 73.4, bright: 650, air: 0.05 },
  portrait: { root: 146.8, bright: 1400, air: 0.01, level: 0.6 },
  edge: { root: 98, bright: 500, air: 0.12, level: 0.9 },
  lightday: { root: 130.8, bright: 900, air: 0.03, level: 0.5 },
  record: { root: 110, bright: 700, air: 0, level: 0.35 },
  future: { root: 82.4, bright: 500, air: 0.04, level: 0.8, fades: true },
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
