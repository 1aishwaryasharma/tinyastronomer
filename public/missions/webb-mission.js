/* James Webb: what the page knows that needs no DOM and no 3D, so the tests
   can hold it to JPL Horizons and to the telescope model directly. */
import {
  AU_KM, LIGHT_KM_PER_SEC, clamp01, indexAt, lerp, missionCalendar, planetPosition, sampleRows, smooth,
} from '../mission-orbits.js?v=20261121-2';

// `key` names a node in webb.glb, with a `Hotspot_<key>` anchor beside it.
export const PARTS = [
  { key: 'PrimaryMirror', label: 'Big mirror', title: 'Primary mirror',
    text: 'Eighteen gold-coated hexagons that work as one mirror 6.5 metres across. It gathers faint light and bounces it to the small mirror out in front.' },
  { key: 'SecondaryMirror', label: 'Small mirror', title: 'Secondary mirror',
    text: 'A round mirror 74 centimetres wide, held out on three legs more than 7 metres long. It sends the light back through the hole in the middle of the big mirror.' },
  { key: 'Sunshield', label: 'Sunshield', title: 'Sunshield',
    text: 'Five silvery layers, each about as thin as a hair, 21 metres long and 14 wide. They keep the heat of the Sun, Earth and Moon off the telescope.' },
  { key: 'InstrumentModule', label: 'Instruments', title: 'Science instruments',
    text: 'Four instruments sit behind the mirror: cameras that take pictures, and spectrographs that spread light into its colours to show what things are made of.' },
  { key: 'Bus', label: 'Body', title: 'Spacecraft bus',
    text: 'The warm side. Computers, radio, fuel and thrusters live here below the sunshield, where their heat cannot reach the mirror.' },
  { key: 'SolarArray', label: 'Solar panel', title: 'Solar panel',
    text: 'It always faces the Sun and makes all of Webb’s electricity. It was the first thing to open, about half an hour after launch.' },
  { key: 'Antenna', label: 'Antenna', title: 'High-gain antenna',
    text: 'A small dish that points at Earth. Twice a day it sends home at least 28.6 gigabytes of pictures and measurements.' },
  { key: 'MomentumFlap', label: 'Trim flap', title: 'Momentum flap',
    text: 'Sunlight pushes very gently on the huge sunshield, like wind on a sail. This flap balances the push so Webb does not slowly tip over, which saves fuel.' },
];

// The one animation in webb.glb. Its second N is the start of step N.
export const CLIP = { name: 'Deploy', seconds: 10 };
// `date` is [year, month, day, hour] in UTC.
export const STEPS = [
  { date: [2021, 12, 25, 13], label: 'Solar panel opens' },
  { date: [2021, 12, 26, 15], label: 'Antenna swings out' },
  { date: [2021, 12, 28, 18], label: 'Sunshield pallets fold down' },
  { date: [2021, 12, 29, 15], label: 'Tower lifts the telescope' },
  { date: [2021, 12, 30, 14], label: 'Trim flap springs open' },
  { date: [2021, 12, 31, 20], label: 'Booms pull the shield wide' },
  { date: [2022, 1, 4, 17], label: 'Five layers pulled tight' },
  { date: [2022, 1, 5, 17], label: 'Small mirror swings out' },
  { date: [2022, 1, 7, 19], label: 'First mirror wing locks' },
  { date: [2022, 1, 8, 18], label: 'Second mirror wing locks' },
];

// NASA's two figures for the sunshield's faces, in °C.
export const SHIELD_C = { sun: 85, mirror: -233 };
export const celsius = (degrees) => (degrees > 0 ? '+' : '−') + Math.abs(degrees) + ' °C';

// What the sliders say at a setting from 0 to 1.
export const alignmentCaption = (aligned) => (aligned < 0.08 ? 'Eighteen separate pictures of the same star.'
  : aligned < 0.82 ? 'Each mirror segment is tipped and shifted until its picture lands on the others.'
    : 'One sharp star. The spikes come from the mirror’s hexagon edges and the legs of the small mirror.');
export const infraredCaption = (infrared) => (infrared < 0.25 ? 'Visible light: the dust cloud is a dark wall, and the stars behind it are hidden.'
  : infrared < 0.75 ? 'Longer waves: the dust is thinning, and stars begin to shine through.'
    : 'Infrared: the dust is almost clear. Stars inside and behind the cloud appear.');

const rowDay = (row) => row[0];

// `data` is trajectory.json: positions in km from Earth, in the frame that
// turns with the Sun-Earth line (x away from the Sun, y the way Earth moves,
// z north).
export function createFlight(data) {
  const calendar = missionCalendar(data.epoch);
  const { dayOf, msOf, dayOn } = calendar;
  // One lookup over the whole flight: the fine transfer rows, then the halo.
  // Each is [day, x, y, z].
  const transfer = data.transfer.filter((row) => row[0] < data.halo[0][0]);
  const rows = transfer.map((row) => row.slice(0, 4)).concat(data.halo);
  const lastDay = rows[rows.length - 1][0];
  const steps = STEPS.map((step) => ({ ...step, day: dayOn(...step.date) }));
  const DAYS = {
    first: rows[0][0],
    sunshieldOpen: steps[6].day,
    mirrorOpen: steps[9].day,
    arrive: dayOn(2022, 1, 24, 19),
  };
  // Indexes into `rows`: where the halo rows begin, and the last one that
  // was measured rather than forecast.
  const spans = { halo: transfer.length, measured: indexAt(rows, data.measuredUntil, rowDay) };

  const at = (day) => sampleRows(rows, day);
  const earthKm = (day) => { const [, x, y, z] = at(day); return Math.hypot(x, y, z); };
  const kmPerSec = (day) => sampleRows(data.transfer, day)[4];
  // L2 sits a fixed share of the Sun's distance beyond Earth, so it breathes
  // in and out by about 50,000 km as Earth's orbit carries it nearer the Sun
  // and farther away.
  const l2Km = (ms) => Math.hypot(...planetPosition('earth', ms)) * AU_KM * data.l2Ratio;
  // Each time Webb crosses from behind Earth's motion to ahead of it, it has
  // gone once more around L2.
  const lapStarts = [];
  for (let i = 1; i < data.halo.length; i++) {
    if (data.halo[i - 1][2] < 0 && data.halo[i][2] >= 0) lapStarts.push(data.halo[i][0]);
  }
  const lapsBy = (day) => Math.max(0, lapStarts.filter((start) => start <= day).length - 1);

  // Where Webb is at a wall-clock moment, held at the end of the forecast.
  function live(ms) {
    const day = Math.min(dayOf(ms), lastDay);
    const km = earthKm(day);
    return { ms: msOf(day), earthKm: km, lightSeconds: km / LIGHT_KM_PER_SEC, laps: lapsBy(day) };
  }

  // The unfolding chapter at scroll progress `p`: hold folded, play the
  // clip, hold open. Each step eases in and out, and the clock reaches the
  // step's date as it ends.
  function unfoldAt(p) {
    if (p <= 0.07) return { index: 0, second: 0, label: 'Folded for launch', dateDay: DAYS.first, day: DAYS.first };
    const t = clamp01((p - 0.07) / 0.83) * CLIP.seconds;
    const index = Math.min(steps.length - 1, Math.floor(t));
    const step = steps[index];
    return {
      index, second: index + smooth(0, 1, t - index), label: step.label, dateDay: step.day,
      day: Math.max(DAYS.first, lerp(step.day - 0.3, step.day, t - index)),
    };
  }

  // The mission day each chapter on the flight set shows at scroll progress `p`.
  const chapterDay = {
    journey: (p) => lerp(DAYS.first, DAYS.arrive, smooth(0, 1, p) * 0.6 + p * 0.4),
    // Reaches today early, then holds while the camera comes round to the
    // view from Earth.
    halo: (p) => lerp(DAYS.arrive, Math.min(dayOf(Date.now()), lastDay), smooth(0, 0.82, p)),
  };

  return {
    ...calendar, rows, spans, lastDay, DAYS, steps, at, earthKm, kmPerSec, l2Km, lapStarts, lapsBy, live, unfoldAt, chapterDay,
    speedRows: data.transfer.map((row) => [row[0], row[4]]),
  };
}
