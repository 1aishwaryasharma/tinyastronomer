// Builds public/assets/missions/webb/trajectory.json from JPL Horizons.
//
//   bun tools/build-webb-trajectory.ts [--cache DIR]
//
// Everything the Webb page draws about where the telescope was and is comes
// from this file, so the page never invents a path. Horizons target -170 is
// the James Webb Space Telescope: the as-flown trajectory from the Goddard
// Flight Dynamics Facility, starting about forty minutes after launch on
// 2021-12-25, followed by Goddard's own prediction for the next five years.
// Times are UTC (see tools/horizons.ts). `--cache DIR` keeps the raw replies
// so a second run does not ask again.
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
import { dot, horizons, kmRow, norm, round, speed, utc, type State, type Vec } from "./horizons.ts";

const EPOCH = "2021-12-25T00:00:00Z";
const WEBB = "-170";
const { dayOf, vectors, stateAt } = horizons(EPOCH);

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

// A body seen from Earth, turned into the Sun-Earth frame. `earth` is Earth
// seen from the Sun at the same instants.
function rotating(body: State[], earth: State[]) {
  return body.map((s, i) => {
    const e = earth[i];
    if (Math.abs(e.t - s.t) > 1e-6) throw new Error("Earth and body samples are out of step");
    const x = unit(e.p);
    const z = unit(cross(e.p, e.v));
    const y = cross(z, x);
    return { t: s.t, p: [dot(s.p, x), dot(s.p, y), dot(s.p, z)] as Vec, speed: speed(s), sunKm: norm(e.p) };
  });
}
async function inFrame(target: string, start: number, stop: number, step: string) {
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

// The file starts at 13:00 UTC on launch day; the first whole step after
// that is 13:20.
const early = await inFrame(WEBB, utc(2021, 12, 25, 13, 20), utc(2021, 12, 27), "20m");
const later = await inFrame(WEBB, utc(2021, 12, 27), utc(2022, 1, 27), "2h");
const transfer = early.concat(later.slice(1));
const halo = await inFrame(WEBB, utc(2022, 1, 25), utc(2031, 11, 15), "2d");
const moon = await inFrame("301", utc(2021, 12, 25, 12), utc(2022, 1, 27), "4h");

// Horizons lists where the tracked solution hands over to prediction; this is
// the date printed in the object header when the file was built.
const MEASURED_UNTIL = dayOf(utc(2026, 11, 16));

const fromL2 = (s: { p: Vec; sunKm: number }): Vec => [s.p[0] - s.sunKm * L2, s.p[1], s.p[2]];
const flown = halo.filter((s) => s.t <= MEASURED_UNTIL);
const reach = (axis: number) => Math.round(Math.max(...flown.map((s) => Math.abs(fromL2(s)[axis]))));
const range = flown.map((s) => norm(s.p));

const checks = [];
for (const at of ["2022-01-24T19:00Z", "2022-07-12T00:00Z", "2024-06-01T00:00Z", "2026-11-21T00:00Z", "2028-03-01T00:00Z"]) {
  const fromEarth = await stateAt(WEBB, "500@399", Date.parse(at));
  const earth = await stateAt("399", "500@10", Date.parse(at));
  checks.push({ utc: at, earthKm: Math.round(norm(fromEarth.p)), sunEarthKm: Math.round(norm(earth.p)) });
}

const out = {
  source: "NASA/JPL Horizons, target -170 (James Webb Space Telescope), geometric states, turned into the Sun-Earth rotating frame, times in UTC",
  generated: new Date().toISOString().slice(0, 10),
  epoch: EPOCH,
  measuredUntil: round(MEASURED_UNTIL, 4),
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
