// Builds public/assets/missions/cassini/trajectory.json and tour.bin from JPL
// Horizons.
//
//   bun tools/build-cassini-trajectory.ts [--cache DIR]
//
// Everything the Cassini page draws about where the spacecraft was and how
// fast it moved comes from these two files, so the page never invents a path.
// Horizons target -82 is Cassini (launch to the final plunge; from July 2004
// it is the navigation team's post-mission reconstruction). Target -150 is
// the Huygens probe, release to landing; Horizons still serves the descent
// as PREDICTED on 6 January 2005, not as flown, and the page says so.
//
// Vectors are geometric states in the ecliptic-of-J2000 frame. Horizons
// tabulates them in TDB; times here are converted to UTC. `--cache DIR` keeps
// the raw replies (about 100 MB) so a second run does not ask again.
//
// trajectory.json (times are days since 1997-10-15 00:00 UTC):
//   cruise     heliocentric position (AU) and speed (km/s), launch to Saturn:
//              daily to 2000, then every five days
//   speed      heliocentric speed with hourly samples around each flyby, for
//              the gravity-assist chart
//   flybys     closest approach to Venus (twice), Earth and Jupiter
//   soi        path relative to Saturn around orbit insertion (km), with the
//              two ring-plane crossings
//   release    when Huygens was let go, and how far it then was from Titan
//   titan      Huygens and Cassini relative to Titan over the last day (km)
//   enceladus  Cassini relative to Enceladus on the 28 Oct 2015 plume dive (km)
//   titanOrbit one revolution of Titan around Saturn and its period, so the
//              page can place Titan on any date of the tour
//   periapses  the day of every closest pass by Saturn; an orbit is the lap
//              from one to the next
//   tour, finale  where each lives in tour.bin
//   checks     figures the tests hold the page's copy to
//
// tour.bin: little-endian records of four 16-bit numbers, x y z (signed, in
// `unitKm`) and the time since the previous record (unsigned, in
// `stepSeconds`). Samples are kept wherever the path has turned by a set
// angle, so a fast pass by Saturn gets many and a slow apoapsis few.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const AU_KM = 149597870.7;
const EPOCH = Date.UTC(1997, 9, 15);
const DAY = 86400000;
const SATURN_KM = 60268;
const TITAN_KM = 2574.7;
const ENCELADUS_KM = 252.1;
const RAD = Math.PI / 180;

const cacheAt = process.argv.indexOf("--cache");
const cacheDir = cacheAt > 0 ? process.argv[cacheAt + 1] : null;
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

type Vec = [number, number, number];
type State = { t: number; p: Vec; v: Vec };

// TAI − UTC over the mission; TDB runs 32.184 s ahead of TAI.
const LEAPS: [number, number][] = [
  [Date.UTC(2017, 0, 1), 37], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2012, 6, 1), 35],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2006, 0, 1), 33], [Date.UTC(1999, 0, 1), 32], [Date.UTC(1997, 6, 1), 31],
];
const tdbMinusUtc = (ms: number) => (LEAPS.find(([from]) => ms >= from)![1] + 32.184) * 1000;
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);
const dayOf = (ms: number) => (ms - EPOCH) / DAY;

// `from` and `to` are UTC milliseconds; the request is made in TDB so that
// the samples land on whole UTC minutes.
async function vectors(target: string, center: string, from: number, to: number, step: string, withVelocity = true): Promise<State[]> {
  const tdb = (ms: number) => new Date(ms + tdbMinusUtc(ms)).toISOString().replace("T", " ").slice(0, 23);
  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${target}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    START_TIME: `'${tdb(from)}'`,
    STOP_TIME: `'${tdb(to)}'`,
    STEP_SIZE: `'${step}'`,
    VEC_TABLE: withVelocity ? "'2'" : "'1'",
    REF_PLANE: "'ECLIPTIC'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });
  const url = `${API}?${params}`;
  const cached = cacheDir && `${cacheDir}/${createHash("sha1").update(url).digest("hex")}.txt`;
  let text = "";
  if (cached && existsSync(cached)) text = readFileSync(cached, "utf8");
  else {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url);
      text = await response.text();
      if (response.ok && text.includes("$$SOE")) break;
      if (attempt === 3) throw new Error(`Horizons ${response.status} for ${target} ${stamp(from)}:\n${text.slice(0, 600)}`);
      await Bun.sleep(4000 * (attempt + 1));
    }
    if (cached) writeFileSync(cached, text);
  }
  const body = text.match(/\$\$SOE\n([\s\S]*?)\$\$EOE/)?.[1];
  if (!body) throw new Error(`Horizons returned no table for ${target} ${stamp(from)}:\n${text.slice(0, 600)}`);
  return body.trim().split("\n").map((line) => {
    const cells = line.split(",");
    const n = cells.slice(2, 8).map(Number);
    // JD 2440587.5 is the Unix epoch.
    const tdbMs = (Number(cells[0]) - 2440587.5) * DAY;
    const ms = tdbMs - tdbMinusUtc(tdbMs);
    return { t: dayOf(ms), p: [n[0], n[1], n[2]], v: withVelocity ? [n[3], n[4], n[5]] : [0, 0, 0] } as State;
  });
}

// Horizons caps one table at about 90,000 rows.
async function longVectors(target: string, center: string, from: number, to: number, stepMinutes: number): Promise<State[]> {
  const span = 60000 * stepMinutes * 60 * 1000;
  const out: State[] = [];
  for (let start = from; start < to; start += span) {
    const part = await vectors(target, center, start, Math.min(to, start + span), `${stepMinutes}m`, false);
    out.push(...(out.length ? part.slice(1) : part));
    console.log(`  ${target} from ${center}: ${stamp(start)} (${out.length} rows)`);
  }
  return out;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const norm = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const speed = (s: State) => norm(s.v);
const helioRow = (s: State) => [round(s.t, 3), ...s.p.map((km) => round(km / AU_KM, 4)), round(speed(s), 2)];
const kmRow = (s: State) => [round(s.t, 4), ...s.p.map((km) => Math.round(km))];
const iso = (day: number) => new Date(EPOCH + day * DAY).toISOString().slice(0, 19) + "Z";

// The moment of closest approach between samples, from the samples either
// side of the nearest one (distance squared is a parabola there).
function closest(states: State[]) {
  let i = 0;
  states.forEach((s, k) => { if (norm(s.p) < norm(states[i].p)) i = k; });
  i = Math.max(1, Math.min(states.length - 2, i));
  const [a, b, c] = [states[i - 1], states[i], states[i + 1]].map((s) => dot(s.p, s.p));
  const offset = Math.max(-1, Math.min(1, (a - c) / (2 * (a - 2 * b + c))));
  const step = states[i + 1].t - states[i].t;
  return { day: states[i].t + offset * step, km: Math.sqrt(b - ((a - c) * offset) / 4), speed: speed(states[i]) };
}

// Saturn's north pole (IAU: right ascension 40.589°, declination 83.537°) in
// the ecliptic frame. Titan and Enceladus orbit in Saturn's equator plane and
// keep their own poles within a degree of this.
const POLE = (() => {
  const ra = 40.589 * RAD, dec = 83.537 * RAD, eps = 23.4392911 * RAD;
  const x = Math.cos(dec) * Math.cos(ra), y = Math.cos(dec) * Math.sin(ra), z = Math.sin(dec);
  return [x, y * Math.cos(eps) + z * Math.sin(eps), -y * Math.sin(eps) + z * Math.cos(eps)];
})();

/* ── Cruise ── */
console.log("cruise");
const cruiseNear = await vectors("-82", "500@10", utc(1997, 10, 16), utc(2000, 1, 1), "1d");
const cruiseFar = await vectors("-82", "500@10", utc(2000, 1, 1), utc(2004, 7, 1), "5d");
// Five-day steps from 1 January stop short of arrival day; add it.
const [cruiseEnd] = await vectors("-82", "500@10", utc(2004, 7, 1), utc(2004, 7, 1, 0, 1), "1d");
const cruise = cruiseNear.concat(cruiseFar.slice(1), cruiseEnd);

const FLYBYS = [
  { key: "venus1", name: "Venus", body: "299", radiusKm: 6051.8, at: utc(1998, 4, 26, 13, 45), hours: 6, step: "1m" },
  { key: "venus2", name: "Venus", body: "299", radiusKm: 6051.8, at: utc(1999, 6, 24, 20, 30), hours: 6, step: "1m" },
  { key: "earth", name: "Earth", body: "399", radiusKm: 6378.1, at: utc(1999, 8, 18, 3, 28), hours: 6, step: "1m" },
  { key: "jupiter", name: "Jupiter", body: "599", radiusKm: 71492, at: utc(2000, 12, 30, 10), hours: 72, step: "10m" },
];
const flybys: Record<string, unknown> = {};
const spikes: State[] = [];
for (const f of FLYBYS) {
  const near = closest(await vectors("-82", `500@${f.body}`, f.at - f.hours * 3600000, f.at + f.hours * 3600000, f.step));
  // Speed relative to the Sun a set time either side: a day for the inner
  // planets, a hundred days for Jupiter, whose pull acts over months.
  const lead = f.key === "jupiter" ? 100 : 1;
  const ms = EPOCH + near.day * DAY;
  const [before] = await vectors("-82", "500@10", ms - lead * DAY, ms - lead * DAY + 60000, "1d");
  const [after] = await vectors("-82", "500@10", ms + lead * DAY, ms + lead * DAY + 60000, "1d");
  flybys[f.key] = {
    name: f.name, utc: iso(near.day), day: round(near.day, 4), centreKm: Math.round(near.km),
    altitudeKm: Math.round(near.km - f.radiusKm), speedBefore: round(speed(before), 2), speedAfter: round(speed(after), 2), leadDays: lead,
  };
  if (f.key !== "jupiter") spikes.push(...await vectors("-82", "500@10", ms - 2 * DAY, ms + 2 * DAY, "1h"));
}
const speedRows = cruise.concat(spikes).sort((a, b) => a.t - b.t)
  .filter((s) => s.t < dayOf(utc(2001, 7, 1)))
  .map((s) => [round(s.t, 3), round(speed(s), 2)]);
let cruiseKm = 0;
for (let i = 1; i < cruise.length; i++) cruiseKm += ((speed(cruise[i]) + speed(cruise[i - 1])) / 2) * (cruise[i].t - cruise[i - 1].t) * 86400;

/* ── Saturn orbit insertion ── */
console.log("orbit insertion");
const soi = await vectors("-82", "500@699", utc(2004, 6, 30, 12), utc(2004, 7, 2, 0), "5m");
const soiFine = await vectors("-82", "500@699", utc(2004, 6, 30, 22), utc(2004, 7, 1, 7), "1m");
const soiClosest = closest(soiFine);
const crossings = [];
for (let i = 1; i < soiFine.length; i++) {
  const a = dot(soiFine[i - 1].p, POLE), b = dot(soiFine[i].p, POLE);
  if (a * b > 0) continue;
  const f = a / (a - b);
  const at = soiFine[i - 1].p.map((value, k) => value + (soiFine[i].p[k] - value) * f);
  crossings.push({ day: round(soiFine[i - 1].t + (soiFine[i].t - soiFine[i - 1].t) * f, 4), km: Math.round(norm(at)), northward: b > a });
}

/* ── Huygens ── */
console.log("Huygens");
// Horizons picks Huygens up as it leaves Cassini, at 02:00 UTC on 25 December.
const releaseFrom = utc(2004, 12, 25, 2, 1);
const [releaseHuygens] = await vectors("-150", "500@606", releaseFrom, releaseFrom + 60000, "1d");
const lastDayFrom = utc(2005, 1, 13, 12);
const titanHuygens = (await vectors("-150", "500@606", lastDayFrom, utc(2005, 1, 14, 9), "10m"))
  .concat((await vectors("-150", "500@606", utc(2005, 1, 14, 9), utc(2005, 1, 14, 12, 5), "1m")).slice(1));
const titanCassini = await vectors("-82", "500@606", lastDayFrom, utc(2005, 1, 15, 6), "10m");
const cassiniPass = closest(await vectors("-82", "500@606", utc(2005, 1, 14, 9), utc(2005, 1, 14, 14), "1m"));
// NASA and ESA count atmospheric entry from 1,270 km above the surface.
const entry = titanHuygens.find((s) => norm(s.p) < TITAN_KM + 1270)!;
// The predicted descent ends on the ground; the first sample there is the
// predicted landing.
const landed = titanHuygens.find((s) => norm(s.p) < TITAN_KM + 0.5)!;
const cassiniAtLanding = titanCassini.reduce((best, s) => (Math.abs(s.t - landed.t) < Math.abs(best.t - landed.t) ? s : best));

/* ── Enceladus, 28 October 2015: the deepest pass through the plume ── */
console.log("Enceladus");
const e21 = utc(2015, 10, 28, 15, 23);
// Horizons has no step unit below a minute; a bare number asks for that many
// equal intervals instead: 20 seconds here, then 1 second around the pass.
const enceladus = await vectors("-82", "500@602", e21 - 20 * 60000, e21 + 20 * 60000, "120");
const enceladusFine = await vectors("-82", "500@602", e21 - 3 * 60000, e21 + 3 * 60000, "360");
const enceladusClosest = closest(enceladusFine);
// Enceladus is squashed: 248.3 km from centre to pole, about 254 km to the
// equator. Height above the ground is measured to that shape.
const groundKm = (p: Vec) => {
  const sinLat = dot(p, POLE) / norm(p);
  return 1 / Math.sqrt((1 - sinLat * sinLat) / (254.0 * 254.0) + (sinLat * sinLat) / (248.3 * 248.3));
};
const lowest = enceladusFine.reduce((best, s) => (norm(s.p) - groundKm(s.p) < norm(best.p) - groundKm(best.p) ? s : best));

/* ── The whole tour, and the last 22 orbits more finely ── */
console.log("tour");
const tourFrom = utc(2004, 7, 1), finaleFrom = utc(2017, 4, 20), end = utc(2017, 9, 15, 10, 32);
const tourRaw = await longVectors("-82", "500@699", tourFrom, end, 10);
const finaleRaw = await longVectors("-82", "500@699", finaleFrom, end, 2);

const periapses: { day: number; km: number }[] = [];
for (let i = 1; i < tourRaw.length - 1; i++) {
  const [a, b, c] = [tourRaw[i - 1], tourRaw[i], tourRaw[i + 1]].map((s) => norm(s.p));
  if (b > a || b >= c) continue;
  // A close Titan flyby next to a pass (October 2013) dents the distance
  // curve twice; a real orbit never took less than four days.
  const pass = closest(tourRaw.slice(i - 1, i + 2));
  const previous = periapses.at(-1);
  if (previous && pass.day - previous.day < 2) { if (pass.km < previous.km) Object.assign(previous, pass); } else periapses.push(pass);
}
// The finale's passes are quick enough that ten-minute samples blur them.
const finalePeriapses: { day: number; km: number; speed?: number }[] = [];
for (let i = 1; i < finaleRaw.length - 1; i++) {
  const [a, b, c] = [finaleRaw[i - 1], finaleRaw[i], finaleRaw[i + 1]].map((s) => norm(s.p));
  if (b <= a && b < c && finaleRaw[i].t > dayOf(utc(2017, 4, 23))) finalePeriapses.push(closest(finaleRaw.slice(i - 1, i + 2)));
}
// How fast the dives were, from the positions two minutes either side.
for (const fine of finalePeriapses) {
  const i = finaleRaw.findIndex((s) => s.t >= fine.day);
  fine.speed = norm(sub(finaleRaw[i + 1].p, finaleRaw[i - 1].p)) / ((finaleRaw[i + 1].t - finaleRaw[i - 1].t) * 86400);
}
for (const fine of finalePeriapses) {
  const coarse = periapses.find((p) => Math.abs(p.day - fine.day) < 0.2);
  if (coarse) { coarse.day = fine.day; coarse.km = fine.km; }
}
// Where each finale pass crosses the ring plane, which is where the gap is.
const gapCrossings = [];
for (let i = 1; i < finaleRaw.length; i++) {
  const a = dot(finaleRaw[i - 1].p, POLE), b = dot(finaleRaw[i].p, POLE);
  const r = norm(finaleRaw[i].p);
  if (a * b <= 0 && r < 2 * SATURN_KM && finaleRaw[i].t > dayOf(utc(2017, 4, 23))) gapCrossings.push(Math.round(r));
}

// Keep a sample each time the direction of travel has turned by `degrees`.
function thin(states: State[], degrees: number) {
  const kept = [states[0]];
  let turned = 0;
  for (let i = 1; i < states.length - 1; i++) {
    const a = sub(states[i].p, states[i - 1].p), b = sub(states[i + 1].p, states[i].p);
    turned += Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (norm(a) * norm(b))))) / RAD;
    if (turned >= degrees) { kept.push(states[i]); turned = 0; }
  }
  kept.push(states[states.length - 1]);
  return kept;
}
function pack(states: State[], stepSeconds: number) {
  const reach = states.reduce((far, s) => Math.max(far, ...s.p.map(Math.abs)), 0);
  const unitKm = Math.ceil(reach / 32760);
  const bytes = new DataView(new ArrayBuffer(states.length * 8));
  let last = Math.round((states[0].t * 86400) / stepSeconds);
  const startDay = (last * stepSeconds) / 86400;
  states.forEach((s, i) => {
    const tick = Math.round((s.t * 86400) / stepSeconds);
    if (tick - last > 65535) throw new Error("gap too long for 16 bits");
    for (let k = 0; k < 3; k++) bytes.setInt16(i * 8 + k * 2, Math.round(s.p[k] / unitKm), true);
    bytes.setUint16(i * 8 + 6, tick - last, true);
    last = tick;
  });
  return { bytes: new Uint8Array(bytes.buffer), meta: { count: states.length, unitKm, stepSeconds, startDay: round(startDay, 6) } };
}
const tourPacked = pack(thin(tourRaw, 9), 600);
const finalePacked = pack(thin(finaleRaw, 4), 120);
const bin = new Uint8Array(tourPacked.bytes.length + finalePacked.bytes.length);
bin.set(tourPacked.bytes, 0);
bin.set(finalePacked.bytes, tourPacked.bytes.length);

/* ── Titan's orbit ── */
console.log("Titan");
// The period that carries Titan's longitude from the first day of the tour to
// the last: its direction at both ends, and the whole turns between them.
const titanEnds = [await vectors("606", "500@699", tourFrom, tourFrom + 60000, "1d"), await vectors("606", "500@699", end, end + 60000, "1d")].map((s) => s[0]);
const longitude = (s: State) => {
  const ref: Vec = [POLE[1], -POLE[0], 0];
  const u = ref.map((v) => v / norm(ref)), w = [POLE[1] * u[2] - POLE[2] * u[1], POLE[2] * u[0] - POLE[0] * u[2], POLE[0] * u[1] - POLE[1] * u[0]];
  return Math.atan2(dot(s.p, w), dot(s.p, u));
};
const span = titanEnds[1].t - titanEnds[0].t;
const turns = Math.round(span / 15.9454) + ((longitude(titanEnds[1]) - longitude(titanEnds[0])) / (2 * Math.PI));
const candidates = [-1, 0, 1].map((k) => span / (turns + k)).sort((a, b) => Math.abs(a - 15.9454) - Math.abs(b - 15.9454));
const titanPeriod = candidates[0];
const loopFrom = utc(2011, 1, 1);
const titanLoop = await vectors("606", "500@699", loopFrom, loopFrom + titanPeriod * DAY, "2h");
const titanChecks = [];
for (const at of [utc(2004, 10, 26, 15, 30), utc(2008, 6, 1), utc(2013, 2, 1), utc(2017, 4, 22, 6)]) {
  const [s] = await vectors("606", "500@699", at, at + 60000, "1d");
  titanChecks.push({ day: round(s.t, 4), km: s.p.map(Math.round) });
}

const out = {
  source: "NASA/JPL Horizons, targets -82 (Cassini) and -150 (Huygens probe, predicted descent), geometric states, ecliptic of J2000, times in UTC",
  generated: new Date().toISOString().slice(0, 10),
  epoch: "1997-10-15T00:00:00Z",
  auKm: AU_KM,
  saturnKm: SATURN_KM,
  titanKm: TITAN_KM,
  enceladusKm: ENCELADUS_KM,
  cruise: cruise.map(helioRow),
  speed: speedRows,
  flybys,
  soi: {
    closestDay: round(soiClosest.day, 4), closestUtc: iso(soiClosest.day), closestKm: Math.round(soiClosest.km),
    crossings, path: soi.map(kmRow),
  },
  release: {
    day: round(releaseHuygens.t, 4), utc: iso(releaseHuygens.t), titanKm: Math.round(norm(releaseHuygens.p)),
  },
  titan: {
    huygens: titanHuygens.map(kmRow), cassini: titanCassini.map(kmRow),
    entryDay: round(entry.t, 4), entryUtc: iso(entry.t), entrySpeed: round(speed(entry), 2),
    landDay: round(landed.t, 4), landUtc: iso(landed.t), cassiniAtLandingKm: Math.round(norm(cassiniAtLanding.p)),
    cassiniDay: round(cassiniPass.day, 4), cassiniUtc: iso(cassiniPass.day), cassiniKm: Math.round(cassiniPass.km),
  },
  enceladus: {
    closestDay: round(enceladusClosest.day, 5), closestUtc: iso(enceladusClosest.day),
    closestKm: round(enceladusClosest.km, 1), speed: round(enceladusClosest.speed, 2),
    altitudeKm: round(norm(lowest.p) - groundKm(lowest.p), 1), latitude: round(Math.asin(dot(lowest.p, POLE) / norm(lowest.p)) / RAD, 1),
    polarKm: 248.3, equatorKm: 254.0,
    path: enceladus.map((s) => [round(s.t, 5), ...s.p.map((km) => round(km, 1))]),
  },
  titanOrbit: { periodDays: round(titanPeriod, 6), path: titanLoop.map(kmRow) },
  titanChecks,
  periapses: periapses.map((p) => round(p.day, 3)),
  tour: { byteOffset: 0, ...tourPacked.meta },
  finale: {
    byteOffset: tourPacked.bytes.length, ...finalePacked.meta,
    periapses: finalePeriapses.map((p) => ({ day: round(p.day, 4), km: Math.round(p.km), speed: round(p.speed!, 1) })),
    gapCrossingsKm: gapCrossings,
  },
  end: { day: round(dayOf(end), 4), utc: iso(dayOf(end)), km: Math.round(norm(finaleRaw.at(-1)!.p)) },
  checks: {
    cruiseKm: Math.round(cruiseKm),
    periapsisCount: periapses.length,
    farthestKm: Math.round(tourRaw.reduce((far, s) => Math.max(far, norm(s.p)), 0)),
    saturnAtArrivalAu: round(norm(cruise.at(-1)!.p) / AU_KM, 3),
  },
};

const dir = fileURLToPath(new URL("../public/assets/missions/cassini/", import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "trajectory.json", JSON.stringify(out));
writeFileSync(dir + "tour.bin", bin);
console.log(
  `wrote trajectory.json ${(JSON.stringify(out).length / 1024).toFixed(1)} KB and tour.bin ${(bin.length / 1024).toFixed(1)} KB ` +
    `(${tourPacked.meta.count} tour + ${finalePacked.meta.count} finale samples)`,
);
console.log(out.flybys, out.soi.closestUtc, out.soi.closestKm, out.soi.crossings, out.titan.entryUtc, out.titan.entrySpeed,
  out.titan.cassiniUtc, out.titan.cassiniKm, out.titan.landUtc, out.titan.cassiniAtLandingKm, out.release, out.enceladus.closestUtc, out.enceladus.closestKm, out.enceladus.speed, out.enceladus.altitudeKm, out.enceladus.latitude,
  out.titanOrbit.periodDays, out.finale.periapses.length, out.end, out.checks);
