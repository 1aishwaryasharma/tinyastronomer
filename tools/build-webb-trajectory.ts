// Builds public/assets/missions/webb/trajectory.json from JPL Horizons.
//
//   bun tools/build-webb-trajectory.ts
//
// Everything the Webb page draws about where the telescope was and is comes
// from this file, so the page never invents a path. Horizons target -170 is
// the James Webb Space Telescope: the as-flown trajectory from the Goddard
// Flight Dynamics Facility, starting about forty minutes after launch on
// 2021-12-25, followed by Goddard's own prediction for the next five years.
//
// Positions are in the frame that turns with the Sun-Earth line, centred on
// Earth, in kilometres:
//   +x  away from the Sun, along the line from the Sun through Earth
//   +y  the way Earth is moving around the Sun
//   +z  north of Earth's orbit
// In this frame the L2 point sits still on the +x axis, about 1.5 million km
// out, and Webb's halo orbit closes into a loop around it.
//
// Output (times as days since 2021-12-25 00:00 UTC):
//   transfer    launch to two days after arrival: [day, x, y, z, km/s]
//               every 20 minutes for the first two days, then every 2 hours.
//               The speed is relative to Earth.
//   halo        arrival to the end of Horizons' file, every 2 days:
//               [day, x, y, z]
//   moon        the Moon over the same month as the transfer, every 4 hours
//   measuredUntil  the day the as-flown solution ends and prediction begins
//   l2Ratio     distance of L2 beyond Earth as a share of the Sun-Earth
//               distance (the collinear solution for the Sun and Earth+Moon)
//   extent      how far the halo reaches from L2 across and above the orbit
//   checks      samples the tests hold the page's arithmetic to

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH = Date.UTC(2021, 11, 25);
const DAY = 86400000;
const WEBB = "-170";

type Vec = [number, number, number];
type State = { t: number; p: Vec; v: Vec };

async function vectors(target: string, center: string, start: string, stop: string, step: string): Promise<State[]> {
  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${target}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error(`Horizons ${response.status} for ${target} ${start}`);
  const text = await response.text();
  const body = text.match(/\$\$SOE\n([\s\S]*?)\$\$EOE/)?.[1];
  if (!body) throw new Error(`Horizons returned no table for ${target} ${start}:\n${text.slice(0, 600)}`);
  return body
    .trim()
    .split("\n")
    .map((line) => {
      const cells = line.split(",").map((cell) => cell.trim());
      const jd = Number(cells[0]);
      const n = cells.slice(2, 8).map(Number);
      // JD 2440587.5 is the Unix epoch. TDB and UTC differ by about a minute,
      // far below anything this page resolves.
      const ms = (jd - 2440587.5) * DAY;
      return { t: (ms - EPOCH) / DAY, p: [n[0], n[1], n[2]], v: [n[3], n[4], n[5]] } as State;
    });
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };

// A body seen from Earth, turned into the Sun-Earth frame. `earth` is Earth
// seen from the Sun at the same instants.
function rotating(body: State[], earth: State[]) {
  return body.map((s, i) => {
    const e = earth[i];
    if (Math.abs(e.t - s.t) > 1e-6) throw new Error("Earth and body samples are out of step");
    const x = unit(e.p);
    const z = unit(cross(e.p, e.v));
    const y = cross(z, x);
    return { t: s.t, r: [dot(s.p, x), dot(s.p, y), dot(s.p, z)] as Vec, speed: Math.hypot(...s.v), sunKm: Math.hypot(...e.p) };
  });
}
async function inFrame(target: string, start: string, stop: string, step: string) {
  const body = await vectors(target, "500@399", start, stop, step);
  const earth = await vectors("399", "500@10", start, stop, step);
  return rotating(body, earth);
}

// L2 of the Sun and the Earth-Moon pair: the root of the collinear quintic,
// as a share of the distance between the two.
const MU = 1 / (1 + 328900.56);
function l2Ratio() {
  let g = Math.cbrt(MU / 3);
  for (let i = 0; i < 50; i++) {
    const f = g ** 5 + (3 - MU) * g ** 4 + (3 - 2 * MU) * g ** 3 - MU * g * g - 2 * MU * g - MU;
    const d = 5 * g ** 4 + 4 * (3 - MU) * g ** 3 + 3 * (3 - 2 * MU) * g * g - 2 * MU * g - 2 * MU;
    g -= f / d;
  }
  return g;
}
const L2 = l2Ratio();

// The file starts at 13:01:09 TDB on launch day; the first whole step after
// that is 13:20.
const early = await inFrame(WEBB, "2021-12-25 13:20", "2021-12-27 00:00", "20m");
const later = await inFrame(WEBB, "2021-12-27 00:00", "2022-01-27 00:00", "2h");
const transfer = early.concat(later.slice(1));
const halo = await inFrame(WEBB, "2022-01-25 00:00", "2031-11-15 00:00", "2d");
const moon = await inFrame("301", "2021-12-25 12:00", "2022-01-27 00:00", "4h");

const dayOf = (utc: string) => (Date.parse(utc) - EPOCH) / DAY;
// Horizons lists where the tracked solution hands over to prediction; this is
// the date printed in the object header when the file was built.
const MEASURED_UNTIL = "2026-11-16T00:00:00Z";

const kmRow = (s: { t: number; r: Vec }) => [round(s.t, 4), ...s.r.map((km) => Math.round(km))];
const fromL2 = (s: { r: Vec; sunKm: number }): Vec => [s.r[0] - s.sunKm * L2, s.r[1], s.r[2]];
const flown = halo.filter((s) => s.t <= dayOf(MEASURED_UNTIL));
const reach = (axis: number) => Math.round(Math.max(...flown.map((s) => Math.abs(fromL2(s)[axis]))));
const range = flown.map((s) => Math.hypot(...s.r));

const checkDates = ["2022-01-24 19:00", "2022-07-12 00:00", "2024-06-01 00:00", "2026-11-21 00:00", "2028-03-01 00:00"];
const checks = [];
for (const date of checkDates) {
  const stop = date.replace(/(\d\d):(\d\d)$/, (_, h, m) => `${h}:${String(Number(m) + 1).padStart(2, "0")}`);
  const [fromEarth] = await vectors(WEBB, "500@399", date, stop, "1d");
  const [earth] = await vectors("399", "500@10", date, stop, "1d");
  checks.push({
    utc: date.replace(" ", "T") + "Z",
    earthKm: Math.round(Math.hypot(...fromEarth.p)),
    sunEarthKm: Math.round(Math.hypot(...earth.p)),
  });
}

const out = {
  source: "NASA/JPL Horizons, target -170 (James Webb Space Telescope), geometric states, turned into the Sun-Earth rotating frame",
  generated: new Date().toISOString().slice(0, 10),
  epoch: "2021-12-25T00:00:00Z",
  measuredUntil: round(dayOf(MEASURED_UNTIL), 4),
  l2Ratio: round(L2, 7),
  transfer: transfer.map((s) => [...kmRow(s), round(s.speed, 3)]),
  halo: halo.map(kmRow),
  moon: moon.map(kmRow),
  extent: {
    alongKm: reach(0),
    acrossKm: reach(1),
    aboveKm: reach(2),
    nearestEarthKm: Math.round(Math.min(...range)),
    farthestEarthKm: Math.round(Math.max(...range)),
  },
  checks,
};

const path = fileURLToPath(new URL("../public/assets/missions/webb/trajectory.json", import.meta.url));
writeFileSync(path, JSON.stringify(out));
console.log(
  `wrote ${path}: ${(JSON.stringify(out).length / 1024).toFixed(1)} KB, ` +
    `${transfer.length} transfer + ${halo.length} halo + ${moon.length} Moon samples; L2 ratio ${out.l2Ratio}`,
);
console.log(out.extent);
console.log(checks);
