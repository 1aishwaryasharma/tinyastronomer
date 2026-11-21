// Builds public/assets/missions/voyager-1/trajectory.json from JPL Horizons.
//
//   bun tools/build-voyager-trajectory.ts
//
// Everything the Voyager 1 page draws about where the spacecraft was, is, and
// how fast it moved comes from this file, so the page never invents a path.
// Horizons target -31 is Voyager 1; its reconstructed trajectory starts about
// an hour after launch on 1977-09-05. Vectors are geometric states in the
// ecliptic-of-J2000 frame.
//
// Output (distances in AU unless noted, times as days since 1977-09-05 00:00):
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

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const AU_KM = 149597870.7;
const EPOCH = Date.UTC(1977, 8, 5);
const DAY = 86400000;

type State = { t: number; p: [number, number, number]; v: [number, number, number] };

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
const speed = (s: State) => Math.hypot(...s.v);
const au = (s: State) => s.p.map((km) => round(km / AU_KM, 5));
const helioRow = (s: State) => [round(s.t, 3), ...au(s), round(speed(s), 3)];

const cruise = await vectors("-31", "500@10", "1977-09-06", "1981-01-01", "1d");
const deep = await vectors("-31", "500@10", "1981-01-01", "2040-01-01", "30d");

// Two-hour steps resolve the speed spike at each closest approach; daily
// samples would step straight over it.
const speedJupiter = await vectors("-31", "500@10", "1979-02-20", "1979-03-20", "2h");
const speedSaturn = await vectors("-31", "500@10", "1980-11-01", "1980-11-25", "2h");

const jupiter = await vectors("-31", "500@599", "1979-03-03 12:00", "1979-03-07 00:00", "20m");
const saturn = await vectors("-31", "500@699", "1980-11-10 12:00", "1980-11-14 12:00", "20m");
const titan = await vectors("606", "500@699", "1980-11-10 12:00", "1980-11-14 12:00", "20m");
const io = await vectors("501", "500@599", "1979-03-03 12:00", "1979-03-07 00:00", "20m");

const closest = (states: State[]) =>
  states.reduce((best, s) => (Math.hypot(...s.p) < Math.hypot(...best.p) ? s : best));
const kmRow = (s: State) => [round(s.t, 4), ...s.p.map((km) => Math.round(km))];

const checkDates = ["2026-11-18 10:16", "2027-03-10 00:00", "2027-09-01 00:00", "2028-06-01 00:00", "2029-11-18 00:00"];
const checks = [];
for (const date of checkDates) {
  const stop = date.replace(/(\d\d):(\d\d)$/, (_, h, m) => `${h}:${String(Number(m) + 1).padStart(2, "0")}`);
  const [fromEarth] = await vectors("-31", "500@399", date, stop, "1d");
  const [fromSun] = await vectors("-31", "500@10", date, stop, "1d");
  checks.push({
    utc: date.replace(" ", "T") + "Z",
    earthKm: Math.round(Math.hypot(...fromEarth.p)),
    sunKm: Math.round(Math.hypot(...fromSun.p)),
  });
}

// The page places the planets with JPL's approximate Keplerian elements
// rather than shipping an ephemeris. These samples hold that arithmetic to
// Horizons at the moments the story depends on.
const planetChecks = [];
for (const [name, id, date] of [
  ["earth", "399", "1990-02-14 00:00"],
  ["earth", "399", "2026-11-18 00:00"],
  ["venus", "299", "1990-02-14 00:00"],
  ["jupiter", "599", "1979-03-05 12:00"],
  ["saturn", "699", "1980-11-12 23:40"],
  ["neptune", "899", "1990-02-14 00:00"],
] as const) {
  const stop = date.replace(/(\d\d):(\d\d)$/, (_, h, m) => `${h}:${String(Number(m) + 1).padStart(2, "0")}`);
  const [state] = await vectors(id, "500@10", date, stop, "1d");
  planetChecks.push({ name, utc: date.replace(" ", "T") + "Z", au: au(state) });
}

const jupiterClosest = closest(jupiter);
const saturnClosest = closest(saturn);
const titanGap = saturn
  .map((s, i) => ({ t: s.t, km: Math.hypot(s.p[0] - titan[i].p[0], s.p[1] - titan[i].p[1], s.p[2] - titan[i].p[2]) }))
  .reduce((best, s) => (s.km < best.km ? s : best));

const out = {
  source: "NASA/JPL Horizons, target -31 (Voyager 1), geometric states, ecliptic of J2000",
  generated: new Date().toISOString().slice(0, 10),
  epoch: "1977-09-05T00:00:00Z",
  auKm: AU_KM,
  cruise: cruise.map(helioRow),
  deep: deep.map(helioRow),
  speed: {
    jupiter: speedJupiter.map((s) => [round(s.t, 3), round(speed(s), 3)]),
    saturn: speedSaturn.map((s) => [round(s.t, 3), round(speed(s), 3)]),
  },
  jupiter: {
    closestDay: round(jupiterClosest.t, 4),
    closestKm: Math.round(Math.hypot(...jupiterClosest.p)),
    path: jupiter.map(kmRow),
    io: io.map(kmRow),
  },
  saturn: {
    closestDay: round(saturnClosest.t, 4),
    closestKm: Math.round(Math.hypot(...saturnClosest.p)),
    titanDay: round(titanGap.t, 4),
    titanKm: Math.round(titanGap.km),
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
