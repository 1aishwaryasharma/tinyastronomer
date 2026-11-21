// Builds public/assets/missions/voyager-1/trajectory.json from JPL Horizons.
//
//   bun tools/build-voyager-trajectory.ts [--cache DIR]
//
// Everything the Voyager 1 page draws about where the spacecraft was, is, and
// how fast it moved comes from this file, so the page never invents a path.
// Horizons target -31 is Voyager 1; its reconstructed trajectory starts about
// an hour after launch on 1977-09-05. Vectors are geometric states in the
// ecliptic-of-J2000 frame, with times in UTC (see tools/horizons.ts). `--cache
// DIR` keeps the raw replies so a second run does not ask again.
//
// Output (distances in AU unless noted, times as days since 1977-09-05 00:00
// UTC):
//   cruise      heliocentric position and speed, launch to 1981, daily
//   deep        heliocentric position and speed, 1981 to 2040, every 30 days
//   speed       heliocentric speed around both flybys at two-hour steps, for
//               the gravity-assist chart
//   jupiter     path relative to Jupiter around closest approach, in km
//   saturn      path relative to Saturn, with Titan's, in km
//   checks      Earth-range samples the tests hold the page's arithmetic to
//   planetChecks  planet positions the tests hold the Kepler model to

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AU_KM } from "../public/mission-orbits.js";
import { closest, helioRow, horizons, kmRow, norm, round, speed, sub, utc } from "./horizons.ts";

const EPOCH = "1977-09-05T00:00:00Z";
const { vectors, stateAt } = horizons(EPOCH);

const cruise = await vectors("-31", "500@10", utc(1977, 9, 6), utc(1981, 1, 1), "1d");
const deep = await vectors("-31", "500@10", utc(1981, 1, 1), utc(2040, 1, 1), "30d");

// Two-hour steps resolve the speed spike at each closest approach; daily
// samples would step straight over it.
const speedJupiter = await vectors("-31", "500@10", utc(1979, 2, 20), utc(1979, 3, 20), "2h");
const speedSaturn = await vectors("-31", "500@10", utc(1980, 11, 1), utc(1980, 11, 25), "2h");

// The page plays a day and a half either side of each closest approach:
// 12:05 on 5 March 1979 and 23:46 on 12 November 1980.
const jupiterWindow = [utc(1979, 3, 3, 12), utc(1979, 3, 7, 1)] as const;
const saturnWindow = [utc(1980, 11, 10, 12), utc(1980, 11, 14, 12)] as const;
const jupiter = await vectors("-31", "500@599", ...jupiterWindow, "20m");
const io = await vectors("501", "500@599", ...jupiterWindow, "20m");
const saturn = await vectors("-31", "500@699", ...saturnWindow, "20m");
const titan = await vectors("606", "500@699", ...saturnWindow, "20m");

const checks = [];
for (const at of ["2026-11-18T10:16Z", "2027-03-10T00:00Z", "2027-09-01T00:00Z", "2028-06-01T00:00Z", "2029-11-18T00:00Z"]) {
  const fromEarth = await stateAt("-31", "500@399", Date.parse(at));
  const fromSun = await stateAt("-31", "500@10", Date.parse(at));
  checks.push({ utc: at, earthKm: Math.round(norm(fromEarth.p)), sunKm: Math.round(norm(fromSun.p)) });
}

// The page places the planets with JPL's approximate Keplerian elements
// rather than shipping an ephemeris. These samples hold that arithmetic to
// Horizons at the moments the story depends on.
const planetChecks = [];
for (const [name, id, at] of [
  ["earth", "399", "1990-02-14T00:00Z"],
  ["earth", "399", "2026-11-18T00:00Z"],
  ["venus", "299", "1990-02-14T00:00Z"],
  ["jupiter", "599", "1979-03-05T12:00Z"],
  ["saturn", "699", "1980-11-12T23:40Z"],
  ["neptune", "899", "1990-02-14T00:00Z"],
] as const) {
  const state = await stateAt(id, "500@10", Date.parse(at));
  planetChecks.push({ name, utc: at, au: state.p.map((km) => round(km / AU_KM, 5)) });
}

const jupiterClosest = closest(jupiter);
const saturnClosest = closest(saturn);
const titanClosest = closest(saturn.map((s, i) => ({ ...s, p: sub(s.p, titan[i].p) })));

const out = {
  source: "NASA/JPL Horizons, target -31 (Voyager 1), geometric states, ecliptic of J2000, times in UTC",
  generated: new Date().toISOString().slice(0, 10),
  epoch: EPOCH,
  auKm: AU_KM,
  cruise: cruise.map((s) => helioRow(s, 5, 3)),
  deep: deep.map((s) => helioRow(s, 5, 3)),
  speed: {
    jupiter: speedJupiter.map((s) => [round(s.t, 3), round(speed(s), 3)]),
    saturn: speedSaturn.map((s) => [round(s.t, 3), round(speed(s), 3)]),
  },
  jupiter: {
    closestDay: round(jupiterClosest.day, 4),
    closestKm: Math.round(jupiterClosest.km),
    path: jupiter.map(kmRow),
    io: io.map(kmRow),
  },
  saturn: {
    closestDay: round(saturnClosest.day, 4),
    closestKm: Math.round(saturnClosest.km),
    titanDay: round(titanClosest.day, 4),
    titanKm: Math.round(titanClosest.km),
    path: saturn.map(kmRow),
    titan: titan.map(kmRow),
  },
  checks,
  planetChecks,
};

const path = fileURLToPath(new URL("../public/assets/missions/voyager-1/trajectory.json", import.meta.url));
writeFileSync(path, JSON.stringify(out));
console.log(
  `wrote ${path}: ${(JSON.stringify(out).length / 1024).toFixed(1)} KB, ` +
    `${cruise.length} cruise + ${deep.length} deep samples; ` +
    `Jupiter ${out.jupiter.closestKm} km, Saturn ${out.saturn.closestKm} km, Titan ${out.saturn.titanKm} km`,
);
console.log(checks);
