// JPL Horizons vector tables for the build-*-trajectory scripts.
//
// Vectors are geometric states in the ecliptic-of-J2000 frame, km and km/s.
// Horizons tabulates them in TDB. Every time this module takes or returns is
// UTC: requests are shifted into TDB so that samples land on the UTC instants
// asked for, and the times that come back are shifted out again.
//
// `--cache DIR` on the command line of any script that uses this keeps the
// raw replies, so a second run does not ask again.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AU_KM, DAY_MS } from "../public/mission-orbits.js";

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";

const cacheAt = process.argv.indexOf("--cache");
const cacheDir = cacheAt > 0 ? process.argv[cacheAt + 1] : null;
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

export type Vec = [number, number, number];
export type State = { t: number; p: Vec; v: Vec };

// TAI − UTC from each date on, newest first; TDB runs 32.184 s ahead of TAI.
// Later dates are taken to have no further leap second; nothing here predates
// 1972.
const LEAPS = ([
  ["2017-01-01", 37], ["2015-07-01", 36], ["2012-07-01", 35], ["2009-01-01", 34], ["2006-01-01", 33],
  ["1999-01-01", 32], ["1997-07-01", 31], ["1996-01-01", 30], ["1994-07-01", 29], ["1993-07-01", 28],
  ["1992-07-01", 27], ["1991-01-01", 26], ["1990-01-01", 25], ["1988-01-01", 24], ["1985-07-01", 23],
  ["1983-07-01", 22], ["1982-07-01", 21], ["1981-07-01", 20], ["1980-01-01", 19], ["1979-01-01", 18],
  ["1978-01-01", 17], ["1977-01-01", 16], ["1976-01-01", 15], ["1975-01-01", 14], ["1974-01-01", 13],
  ["1973-01-01", 12], ["1972-07-01", 11], ["1972-01-01", 10],
] as const).map(([from, seconds]) => [Date.parse(from), seconds] as const);
const tdbMinusUtc = (ms: number) => (LEAPS.find(([from]) => ms >= from)![1] + 32.184) * 1000;
const tdbStamp = (ms: number) => new Date(ms + tdbMinusUtc(ms)).toISOString().replace("T", " ").slice(0, 23);

export const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);
export const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

export const round = (value: number, digits: number) => Number(value.toFixed(digits));
export const norm = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const speed = (s: State) => norm(s.v);
export const kmRow = (s: { t: number; p: Vec }) => [round(s.t, 4), ...s.p.map((km) => Math.round(km))];
export const helioRow = (s: State, auDigits: number, speedDigits: number) =>
  [round(s.t, 3), ...s.p.map((km) => round(km / AU_KM, auDigits)), round(speed(s), speedDigits)];

// The moment of closest approach between samples, from the samples either
// side of the nearest one (distance squared is a parabola there).
export function closest(states: State[]) {
  let i = 0;
  states.forEach((s, k) => { if (norm(s.p) < norm(states[i].p)) i = k; });
  i = Math.max(1, Math.min(states.length - 2, i));
  const [a, b, c] = [states[i - 1], states[i], states[i + 1]].map((s) => dot(s.p, s.p));
  const offset = Math.max(-1, Math.min(1, (a - c) / (2 * (a - 2 * b + c))));
  const step = states[i + 1].t - states[i].t;
  return { day: states[i].t + offset * step, km: Math.sqrt(b - ((a - c) * offset) / 4), speed: speed(states[i]) };
}

async function reply(url: string, label: string) {
  const cached = cacheDir && `${cacheDir}/${createHash("sha1").update(url).digest("hex")}.txt`;
  if (cached && existsSync(cached)) return readFileSync(cached, "utf8");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    const text = await response.text();
    if (response.ok && text.includes("$$SOE")) {
      if (cached) writeFileSync(cached, text);
      return text;
    }
    if (attempt === 3) throw new Error(`Horizons ${response.status} for ${label}:\n${text.slice(0, 600)}`);
    await Bun.sleep(4000 * (attempt + 1));
  }
}

// A client whose sample times are days since `epoch`, an ISO date in UTC.
export function horizons(epoch: string) {
  const epochMs = Date.parse(epoch);
  const dayOf = (ms: number) => (ms - epochMs) / DAY_MS;

  async function table(target: string, center: string, when: Record<string, string>, withVelocity: boolean, label: string) {
    const params = new URLSearchParams({
      format: "text",
      COMMAND: `'${target}'`,
      OBJ_DATA: "'NO'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: `'${center}'`,
      ...when,
      VEC_TABLE: withVelocity ? "'2'" : "'1'",
      REF_PLANE: "'ECLIPTIC'",
      OUT_UNITS: "'KM-S'",
      CSV_FORMAT: "'YES'",
    });
    const text = await reply(`${API}?${params}`, `${target} ${label}`);
    const body = text.match(/\$\$SOE\n([\s\S]*?)\$\$EOE/)?.[1];
    if (!body) throw new Error(`Horizons returned no table for ${target} ${label}:\n${text.slice(0, 600)}`);
    return body.trim().split("\n").map((line) => {
      const cells = line.split(",");
      const n = cells.slice(2, 8).map(Number);
      // JD 2440587.5 is the Unix epoch.
      const tdbMs = (Number(cells[0]) - 2440587.5) * DAY_MS;
      const ms = tdbMs - tdbMinusUtc(tdbMs);
      return { t: dayOf(ms), p: [n[0], n[1], n[2]], v: withVelocity ? [n[3], n[4], n[5]] : [0, 0, 0] } as State;
    });
  }

  // `from` and `to` are UTC milliseconds. `step` is a Horizons step such as
  // "1d" or "20m"; a bare number asks for that many equal intervals instead.
  const vectors = (target: string, center: string, from: number, to: number, step: string, withVelocity = true) =>
    table(target, center, { START_TIME: `'${tdbStamp(from)}'`, STOP_TIME: `'${tdbStamp(to)}'`, STEP_SIZE: `'${step}'` }, withVelocity, stamp(from));

  const stateAt = async (target: string, center: string, ms: number) =>
    (await table(target, center, { TLIST: `'${tdbStamp(ms)}'`, TLIST_TYPE: "'CAL'" }, true, stamp(ms)))[0];

  return { dayOf, vectors, stateAt };
}
