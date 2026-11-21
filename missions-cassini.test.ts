import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AU_KM, equatorialToEcliptic, planetPosition, sampleRows, unpackRows } from "./public/mission-orbits.js";
import { yieldingLabels } from "./public/mission-story.js";
import { PARTS, SATURN, createFlight } from "./public/missions/cassini-mission.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const ASSETS = "assets/missions/cassini/";
const data = JSON.parse(read(ASSETS + "trajectory.json"));
const bin = readFileSync(root + ASSETS + "tour.bin");
const page = read("missions/cassini.html");
const voyagerPage = read("missions/voyager-1.html");
const flight = createFlight(data);
const { DAYS, chapterDay } = flight;
const dayOf = (utc: string) => flight.dayOf(Date.parse(utc));
const utcDate = (day: number) => new Date(flight.msOf(day)).toISOString().slice(0, 10);
const norm = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
const POLE = equatorialToEcliptic(SATURN.pole[0], SATURN.pole[1]);
// The sine of a position's latitude on Saturn or one of its moons.
const sinLat = (p: number[]) => (p[0] * POLE[0] + p[1] * POLE[1] + p[2] * POLE[2]) / norm(p);

// tour.bin: [day, x, y, z] in km.
const track = (meta: { byteOffset: number }) => unpackRows(bin.buffer, { ...meta, byteOffset: bin.byteOffset + meta.byteOffset });
const tour = track(data.tour);
const finale = track(data.finale);

test("the trajectory is JPL's and covers launch to the final plunge", () => {
  expect(data.source).toContain("JPL Horizons");
  expect(data.source).toContain("-82");
  expect(data.source).toContain("-150");
  // Daily from the day after launch, then every five days, to Saturn arrival.
  expect(data.cruise[0][0]).toBeCloseTo(1, 2);
  expect(data.cruise[1][0] - data.cruise[0][0]).toBeCloseTo(1, 3);
  expect(data.cruise.at(-1)[0]).toBeCloseTo(dayOf("2004-07-01T00:00Z"), 2);
  expect(data.cruise.at(-1)[0] - data.cruise.at(-2)[0]).toBeLessThanOrEqual(5.001);
  for (let i = 1; i < data.cruise.length; i++) expect(data.cruise[i][0]).toBeGreaterThan(data.cruise[i - 1][0]);
  // The tour picks up where the cruise stops and runs to the last signal.
  expect(tour[0][0]).toBeCloseTo(dayOf("2004-07-01T00:00Z"), 2);
  expect(Math.abs(tour.at(-1)![0] - data.end.day)).toBeLessThan(0.01);
  expect(finale.at(-1)![0]).toBeCloseTo(dayOf("2017-09-15T10:32Z"), 3);
  for (const rows of [tour, finale]) {
    for (let i = 1; i < rows.length; i++) expect(rows[i][0]).toBeGreaterThan(rows[i - 1][0]);
  }
  // Starts 80,000 km from Saturn at arrival, ends at the cloud tops.
  expect(data.checks.saturnAtArrivalAu).toBeGreaterThan(9);
  expect(norm(finale.at(-1)!.slice(1)) / data.saturnKm).toBeLessThan(1.03);
});

test("the four flybys land on the dates and distances NASA reports", () => {
  const { venus1, venus2, earth, jupiter } = data.flybys;
  expect(venus1.utc.slice(0, 10)).toBe("1998-04-26");
  expect(venus1.altitudeKm).toBe(284);
  expect(venus2.utc.slice(0, 10)).toBe("1999-06-24");
  expect(venus2.altitudeKm).toBeGreaterThan(590);
  expect(venus2.altitudeKm).toBeLessThan(630);
  expect(earth.utc.slice(0, 10)).toBe("1999-08-18");
  expect(Math.abs(earth.altitudeKm - 1172)).toBeLessThanOrEqual(1);
  expect(jupiter.utc.slice(0, 10)).toBe("2000-12-30");
  // NASA quotes the distance to the cloud tops.
  expect((jupiter.altitudeKm / 1e6).toFixed(1)).toBe("9.7");
  expect(page).toContain('<span class="stat-value">1,172 <small>km up</small></span>');
  expect(page).toContain("First Venus flyby, 284 km above the planet.");
  expect(page).toContain("Earth flyby, 1,172 km above");
  expect(page).toContain("Jupiter flyby, from 9.7 million km.");
});

test("the speed chart shows what its description says", () => {
  // "a sudden jump of 3 to 4 kilometres per second at each flyby of Venus,
  // Venus again and Earth": measured a day before and a day after.
  for (const key of ["venus1", "venus2", "earth"]) {
    const gain = data.flybys[key].speedAfter - data.flybys[key].speedBefore;
    expect(gain, key).toBeGreaterThan(3);
    expect(gain, key).toBeLessThan(4);
  }
  expect(page).toContain("a sudden jump of 3 to 4 kilometres per second at each flyby");
  // The chart has hourly samples through each inner flyby and stops in 2001.
  const near = data.speed.filter((row: number[]) => Math.abs(row[0] - data.flybys.earth.day) < 1);
  expect(near.length).toBeGreaterThan(40);
  expect(data.speed.at(-1)[0]).toBeLessThan(dayOf("2001-07-02T00:00Z"));
  for (let i = 1; i < data.speed.length; i++) expect(data.speed[i][0]).toBeGreaterThanOrEqual(data.speed[i - 1][0]);
  // "and a smaller bump at Jupiter": faster two months after than two before.
  const speedAt = (day: number) => sampleRows(data.speed, day)[1];
  const bump = speedAt(data.flybys.jupiter.day + 30) - speedAt(data.flybys.jupiter.day - 30);
  expect(bump).toBeGreaterThan(0.5);
  expect(bump).toBeLessThan(3);
  // "3.5 billion km" for the whole trip.
  expect((data.checks.cruiseKm / 1e9).toFixed(1)).toBe("3.5");
  expect(page).toContain('<span class="stat-value">3.5 <small>billion km</small></span>');
  expect(page).toContain("The trip covered 3.5 billion kilometres.");
});

test("orbit insertion matches the record: through the ring plane, 20,000 km over the clouds", () => {
  expect(data.soi.closestUtc.slice(0, 16)).toBe("2004-07-01T02:38");
  expect(Math.round((data.soi.closestKm - data.saturnKm) / 1000)).toBe(20);
  expect(page).toContain("it skimmed 20,000 km above the cloud tops");
  // NASA: both crossings about 158,500 km from Saturn's centre, between the
  // F and G rings; up before the burn and back down after it.
  expect(data.soi.crossings).toHaveLength(2);
  expect(data.soi.crossings[0].northward).toBe(true);
  expect(data.soi.crossings[1].northward).toBe(false);
  for (const crossing of data.soi.crossings) expect(Math.abs(crossing.km - 158500)).toBeLessThan(500);
  // NASA: the engine fired for 96 minutes from 01:12 UTC, across the pass.
  expect(DAYS.burnStart).toBeCloseTo(dayOf("2004-07-01T01:12Z"), 9);
  expect((DAYS.burnEnd - DAYS.burnStart) * 1440).toBeCloseTo(96, 6);
  expect(data.soi.crossings[0].day).toBeLessThan(DAYS.burnStart);
  expect(data.soi.crossings[1].day).toBeGreaterThan(DAYS.burnEnd);
  expect(DAYS.soi).toBeGreaterThan(DAYS.burnStart);
  expect(DAYS.soi).toBeLessThan(DAYS.burnEnd);
  // The chapter plays inside the stretch of path it has, around the pass.
  expect(chapterDay.arrival(0)).toBeGreaterThan(data.soi.path[0][0]);
  expect(chapterDay.arrival(1)).toBeLessThan(data.soi.path.at(-1)[0]);
  expect(chapterDay.arrival(0)).toBeLessThan(data.soi.crossings[0].day);
  expect(chapterDay.arrival(1)).toBeGreaterThan(data.soi.crossings[1].day);
  // "It would not come that close again for almost thirteen years."
  const closer = tour.find((row) => row[0] > data.soi.closestDay + 1 && norm(row.slice(1)) < data.soi.closestKm);
  expect(closer![0]).toBeGreaterThan(dayOf("2017-04-22T00:00Z"));
});

test("Huygens's release and landing match the page", () => {
  expect(data.release.utc.slice(0, 13)).toBe("2004-12-25T02");
  // "still more than 2 million km away"
  expect(data.release.titanKm).toBeGreaterThan(2e6);
  expect(data.release.titanKm).toBeLessThan(3e6);
  expect(page).toContain("still more than <strong>2 million km</strong> away");
  // NASA/ESA: entry at 1,270 km altitude at about 09:06 UTC, at 6 km/s.
  expect(data.titan.entryUtc.slice(0, 16)).toBe("2005-01-14T09:05");
  expect(Math.round(data.titan.entrySpeed)).toBe(6);
  expect(page).toContain("<strong>6 km every second</strong>");
  // The predicted descent reaches the ground about two and a half hours later.
  const descentHours = (data.titan.landDay - data.titan.entryDay) * 24;
  expect(descentHours).toBeGreaterThan(2.1);
  expect(descentHours).toBeLessThan(2.7);
  expect(norm(data.titan.huygens.at(-1).slice(1))).toBeLessThan(data.titanKm + 1);
  expect(page).toContain("the one JPL predicted a week before landing");
  // Cassini passed 60,000 km above Titan while it listened.
  expect(Math.abs(data.titan.cassiniKm - data.titanKm - 60000)).toBeLessThan(100);
  // The chapter plays inside the paths it has: the fall, the descent
  // through the air, then a while on the ground.
  expect(chapterDay.titan(0)).toBeGreaterThan(data.titan.huygens[0][0]);
  expect(chapterDay.titan(0)).toBeGreaterThan(data.titan.cassini[0][0]);
  expect(chapterDay.titan(1)).toBeLessThan(data.titan.cassini.at(-1)[0]);
  expect(data.titan.huygens.at(-1)[0]).toBeGreaterThanOrEqual(DAYS.landed);
  expect(flight.titanDescent(0)).toMatchObject({ falling: 0, descent: 0, after: 0 });
  expect(flight.titanDescent(0.46)).toEqual({ day: DAYS.entry, falling: 1, descent: 0, after: 0 });
  expect(flight.titanDescent(0.62).day).toBeCloseTo((DAYS.entry + DAYS.landed) / 2, 9);
  expect(flight.titanDescent(0.78)).toMatchObject({ day: DAYS.landed, falling: 1, after: 0 });
  expect(flight.titanDescent(0.78).descent).toBeCloseTo(1, 9);
  expect(flight.titanDescent(1).after).toBeCloseTo(1, 9);
  expect(chapterDay.titan(1)).toBeGreaterThan(DAYS.landed);
});

test("the tour has the orbits, the reach and the Titan the page draws", () => {
  // NASA counts 294 completed orbits: the laps between 295 close passes.
  expect(data.periapses).toHaveLength(295);
  expect(data.checks.periapsisCount - 1).toBe(294);
  expect(page).toContain('<span class="stat-label">Orbits of Saturn</span><span class="stat-value">294</span>');
  expect(flight.orbitsCompleted(DAYS.end)).toBe(294);
  expect(flight.orbitsCompleted(chapterDay.tour(0))).toBe(0);
  expect(flight.orbitsCompleted(data.periapses[1] - 0.01)).toBe(0);
  expect(flight.orbitsCompleted(data.periapses[1])).toBe(1);
  // The chapter runs the whole tour, and names the mission's four phases.
  expect(chapterDay.tour(0)).toBe(tour[0][0]);
  expect(chapterDay.tour(1)).toBe(DAYS.end);
  expect(flight.PHASES.map((phase) => phase.name)).toEqual(["Prime mission", "Equinox mission", "Solstice mission", "Grand Finale"]);
  expect(flight.phaseAt(chapterDay.tour(0)).name).toBe("Prime mission");
  expect(flight.phaseAt(dayOf("2009-08-11T00:00Z")).name).toBe("Equinox mission");
  expect(flight.phaseAt(dayOf("2015-10-28T00:00Z")).name).toBe("Solstice mission");
  expect(flight.phaseAt(DAYS.end).name).toBe("Grand Finale");
  for (let i = 1; i < data.periapses.length; i++) expect(data.periapses[i] - data.periapses[i - 1]).toBeGreaterThan(4);
  expect(data.periapses[0]).toBeCloseTo(data.soi.closestDay, 1);
  // The first orbit is the widest, about 150 Saturn radii out.
  const far = Math.max(...tour.map((row) => norm(row.slice(1))));
  expect(Math.abs(far - data.checks.farthestKm) / far).toBeLessThan(0.001);
  expect(Math.round(far / data.saturnKm)).toBeGreaterThan(140);
  // Thinning keeps the curve: no sample turns the path by more than a
  // glance, and the packed positions land where Horizons put the passes.
  expect(tour.length).toBeGreaterThan(10000);
  const soi = sampleRows(tour, data.soi.closestDay);
  expect(Math.abs(norm(soi.slice(1)) - data.soi.closestKm) / data.soi.closestKm).toBeLessThan(0.05);
  // One measured lap of Titan, repeated, stays on Titan for thirteen years.
  const loop = data.titanOrbit.path, period = data.titanOrbit.periodDays;
  expect(Math.abs(period - 15.945)).toBeLessThan(0.002);
  expect(loop.at(-1)[0] - loop[0][0]).toBeGreaterThan(period - 0.09);
  for (const check of data.titanChecks) {
    const lapDay = flight.titanLapDay(check.day);
    expect(lapDay).toBeGreaterThanOrEqual(loop[0][0]);
    expect(lapDay).toBeLessThan(loop[0][0] + period);
    const at = sampleRows(loop, lapDay);
    const miss = norm([at[1] - check.km[0], at[2] - check.km[1], at[3] - check.km[2]]);
    // Within two Saturn radii on an orbit twenty radii wide: under 6 degrees.
    expect(miss, `Titan on day ${check.day}`).toBeLessThan(2 * data.saturnKm);
  }
});

test("the Enceladus dive is the 28 October 2015 pass, 49 km over the south pole", () => {
  expect(data.enceladus.closestUtc.slice(0, 16)).toBe("2015-10-28T15:22");
  expect(Math.round(data.enceladus.altitudeKm)).toBe(49);
  expect(data.enceladus.latitude).toBeLessThan(-80);
  expect(page).toContain("49 km above the ground");
  // The chapter plays inside the path it has, with the pass in the middle.
  expect(chapterDay.enceladus(0)).toBeGreaterThan(data.enceladus.path[0][0]);
  expect(chapterDay.enceladus(1)).toBeLessThan(data.enceladus.path.at(-1)[0]);
  expect(chapterDay.enceladus(0.5)).toBeCloseTo(data.enceladus.closestDay, 9);
  // The clock's height is above the squashed ball Enceladus is, not a sphere.
  const south = Math.sin((data.enceladus.latitude * Math.PI) / 180);
  expect(Math.round(flight.iceAltitudeKm(data.enceladus.closestKm, south))).toBe(49);
  expect(flight.iceAltitudeKm(data.enceladus.equatorKm, 0)).toBeCloseTo(0, 9);
  expect(flight.iceAltitudeKm(data.enceladus.polarKm, -1)).toBeCloseTo(0, 9);
  // The lowest point is under the southern hemisphere, where the plume is.
  const lowest = data.enceladus.path.reduce((best: number[], row: number[]) => (norm(row.slice(1)) < norm(best.slice(1)) ? row : best));
  expect(lowest[1] * POLE[0] + lowest[2] * POLE[1] + lowest[3] * POLE[2]).toBeLessThan(0);
});

test("the Grand Finale is 22 dives through the gap, then the plunge", () => {
  const dives = data.finale.periapses;
  expect(dives).toHaveLength(22);
  expect(page).toContain("it dived <strong>22 times</strong>");
  // First dive on 26 April, last on 9 September 2017.
  expect(utcDate(dives[0].day)).toBe("2017-04-26");
  expect(utcDate(dives.at(-1).day)).toBe("2017-09-09");
  // The clock counts each dive from half a day before its close pass.
  expect(flight.diveNumber(chapterDay.finale(0))).toBe(0);
  dives.forEach((dive: { day: number }, i: number) => {
    expect(flight.diveNumber(dive.day - 0.51)).toBe(i);
    expect(flight.diveNumber(dive.day)).toBe(i + 1);
  });
  expect(flight.finalApproach(dives.at(-1).day)).toBe(false);
  expect(flight.finalApproach(chapterDay.finale(0.7) + 0.01)).toBe(true);
  expect(chapterDay.finale(0)).toBeGreaterThan(finale[0][0]);
  expect(chapterDay.finale(1)).toBe(DAYS.end);
  for (const dive of dives) {
    // Between the cloud tops and the inner edge of the D ring (66,900 km).
    expect(dive.km).toBeGreaterThan(data.saturnKm + 1500);
    expect(dive.km).toBeLessThan(data.saturnKm + 4000);
    // "at 34 km every second"
    expect(Math.round(dive.speed)).toBe(34);
  }
  for (const km of data.finale.gapCrossingsKm) {
    expect(km).toBeGreaterThan(data.saturnKm);
    expect(km).toBeLessThan(66900);
  }
  expect(data.finale.gapCrossingsKm).toHaveLength(22);
  expect(page).toContain("at 34 km every second");
  // The packed finale passes through each dive within a few hundred km.
  for (const dive of dives) {
    const at = sampleRows(finale, dive.day);
    expect(Math.abs(norm(at.slice(1)) - dive.km)).toBeLessThan(400);
  }
  // "Above the cloud tops" is above Saturn's squashed one-bar surface: each
  // dive clears it, and the signal is lost about 1,300 km up.
  const cloudAltitude = (row: number[]) => flight.cloudAltitudeKm(norm(row.slice(1)), sinLat(row.slice(1)));
  expect(flight.cloudAltitudeKm(data.saturnKm, 0)).toBeCloseTo(0, 6);
  expect(flight.cloudAltitudeKm(SATURN.polarKm, 1)).toBeCloseTo(0, 6);
  for (const dive of dives) {
    expect(cloudAltitude(sampleRows(finale, dive.day))).toBeGreaterThan(1500);
    expect(cloudAltitude(sampleRows(finale, dive.day))).toBeLessThan(4000);
  }
  expect(cloudAltitude(sampleRows(finale, DAYS.end))).toBeGreaterThan(1200);
  expect(cloudAltitude(sampleRows(finale, DAYS.end))).toBeLessThan(1500);
  expect(data.end.utc).toBe("2017-09-15T10:32:00Z");
  expect(page).toContain('<span class="stat-value">10:32 <small>UTC</small></span>');
});

test("a planet's name never prints over its own flyby tag", () => {
  const { flybys } = flight;
  expect(flybys.map((flyby) => flyby.text)).toEqual(["Venus flyby · 1998", "Venus flyby · 1999", "Earth flyby · 1999", "Jupiter flyby · 2000"]);
  // Each mark is where Cassini was, a planet's width from the planet.
  for (const flyby of flybys) {
    const planet = planetPosition(flyby.planet, flight.msOf(flyby.day));
    expect(norm(planet.map((v, i) => v - flyby.at[i])) * AU_KM, flyby.key).toBeLessThan(flyby.key === "jupiter" ? 1.2e7 : 2e5);
  }
  // Venus is back at the 1998 flyby point in July 1999, and Earth and
  // Jupiter sit on their marks on the day: one tag there, not two.
  expect(flight.nameTagAlpha("venus", dayOf("1999-07-19T00:00Z"))).toBe(0);
  for (const flyby of flybys) expect(flight.nameTagAlpha(flyby.planet, flyby.day), flyby.key).toBe(0);
  // Before a flyby there is no tag to clash with.
  expect(flight.nameTagAlpha("venus", flybys[0].day - 1)).toBe(1);
  expect(flight.nameTagAlpha("jupiter", flybys[3].day - 1)).toBe(1);
  // Every day of the cruise: the name is up unless a shown flyby tag of the
  // same planet is right beside it, and it is never down for long.
  const hiddenDays: Record<string, number> = { venus: 0, earth: 0, jupiter: 0, saturn: 0 };
  for (let day = 1; day <= DAYS.arrival; day += 0.5) {
    const ms = flight.msOf(day);
    for (const planet of Object.keys(hiddenDays)) {
      const at = planetPosition(planet, ms);
      const nearest = Math.min(Infinity, ...flybys
        .filter((flyby) => flyby.planet === planet && flight.flybyTagged(flyby, day))
        .map((flyby) => norm(at.map((v, i) => v - flyby.at[i]))));
      const alpha = flight.nameTagAlpha(planet, day);
      if (nearest < 0.12) expect(alpha, `${planet} on ${utcDate(day)}`).toBe(0);
      if (nearest > 0.36) expect(alpha, `${planet} on ${utcDate(day)}`).toBe(1);
      if (alpha < 0.5) hiddenDays[planet] += 0.5;
    }
  }
  expect(hiddenDays.saturn).toBe(0);
  expect(hiddenDays.venus).toBeLessThan(90);
  expect(hiddenDays.earth).toBeLessThan(30);
  expect(hiddenDays.jupiter).toBeLessThan(45);
  // Past the asteroid belt the inner flyby tags come down; Jupiter's stays.
  const late = dayOf("2003-01-01T00:00Z");
  expect(flight.cruise(late).inner).toBe(false);
  expect(flybys.filter((flyby) => flight.flybyTagged(flyby, late)).map((flyby) => flyby.key)).toEqual(["jupiter"]);
  expect(flight.nameTagAlpha("venus", late)).toBe(1);
});

test("the labels that would print over each other give way by rank, and the cruise ranks them", () => {
  const box = (x: number, y: number, rank: number | null, w = 60, h = 12) => ({ x, y, w, h, rank });
  // The lower rank gives way to the higher, whichever was placed first.
  expect([...yieldingLabels([box(0, 0, 1), box(30, 4, 2)])]).toEqual([0]);
  expect([...yieldingLabels([box(0, 0, 2), box(30, 4, 1)])]).toEqual([1]);
  // Equal ranks: the earlier one stays.
  expect([...yieldingLabels([box(0, 0, 1), box(30, 4, 1)])]).toEqual([1]);
  // Apart, or with no rank, nothing moves; a label that gave way frees the others.
  expect(yieldingLabels([box(0, 0, 1), box(80, 0, 2), box(0, 40, 2)]).size).toBe(0);
  expect(yieldingLabels([box(0, 0, null), box(10, 2, null), box(20, 4, 1)]).size).toBe(0);
  expect([...yieldingLabels([box(0, 0, 3), box(40, 6, 2), box(90, 12, 1)])]).toEqual([1]);
  // Lines set one above the other, edge to edge, are not printing over each other.
  expect(yieldingLabels([box(0, 0, 1), box(0, 11, 2)]).size).toBe(1);
  expect(yieldingLabels([box(0, 0, 1), box(0, 12, 2)]).size).toBe(0);
  // The cruise page ranks Cassini over a flyby tag over a planet's name.
  const cruise = read("missions/cassini.js");
  expect(cruise).toMatch(/alpha: flight\.nameTagAlpha\(planet, day\), rank: 1/);
  expect(cruise).toMatch(/place\('cassini', 'Cassini', cassini, \{[^}]*rank: 3/);
  expect(cruise).toMatch(/place\('fly-' \+ flyby\.key[^;]*rank: 2/);
});

test("every chapter in the markup has a rail link and a known set, and the dated ones a date", () => {
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)" data-stage="([^"]+)">/g)];
  expect(chapters.map((m) => m[1])).toEqual([
    "hero", "craft", "cruise", "arrival", "release", "titan", "tour", "enceladus", "finale", "legacy",
  ]);
  for (const [, id, stage] of chapters) {
    expect(["craft", "system", "soi", "titan", "tour", "enceladus", "finale"], `${id} names an unknown set`).toContain(stage);
    expect(page, `no rail link for ${id}`).toContain(`<a href="#${id}">`);
  }
  // Every change of subject is a change of set, so the cut is hidden.
  const stageOf = Object.fromEntries(chapters.map((m) => [m[1], m[2]]));
  for (const [a, b] of [["cruise", "arrival"], ["arrival", "release"], ["release", "titan"], ["titan", "tour"], ["tour", "enceladus"], ["enceladus", "finale"], ["finale", "legacy"]]) {
    expect(stageOf[a], `${a} and ${b} share a set`).not.toBe(stageOf[b]);
  }
  const dated = chapters.filter((m) => m[2] !== "craft").map((m) => m[1]);
  expect(Object.keys(chapterDay)).toEqual(dated);
});

test("each chapter's clock only runs forward, inside the mission", () => {
  for (const [id, day] of Object.entries(chapterDay)) {
    let last = 1;
    for (let step = 0; step <= 100; step++) {
      expect(day(step / 100), `${id} at ${step}%`).toBeGreaterThanOrEqual(last);
      last = day(step / 100);
    }
    expect(last, id).toBeLessThanOrEqual(DAYS.end);
  }
  // The cruise spends over half its length on the two inner years, and runs
  // from the day after launch to arrival, where the path stops.
  expect(chapterDay.cruise(0)).toBe(data.cruise[0][0]);
  expect(chapterDay.cruise(0.56)).toBeGreaterThan(data.flybys.earth.day);
  expect(chapterDay.cruise(0.56)).toBeLessThan(data.flybys.jupiter.day);
  expect(chapterDay.cruise(1)).toBe(DAYS.arrival);
  const { sunAu, kmPerSec } = flight.cruise(DAYS.arrival);
  expect(sunAu).toBeCloseTo(data.checks.saturnAtArrivalAu, 1);
  expect(kmPerSec).toBe(data.cruise.at(-1)[4]);
});

test("the story is readable and the live figures show before any script runs", () => {
  expect(page).toContain('class="loader mission-loader"');
  expect(page).not.toContain("loader-js-required");
  expect(page).toContain('<div id="canvas-container"></div>');
  // The markup ships plain-words figures of the right size; the script
  // writes the exact ones. Saturn is 66 to 92 light-minutes from Earth.
  expect(page).toContain('id="hero-signal">about 80 minutes<');
  const shipped = Number(page.match(/id="hero-saturn-km">([\d,]+)</)![1].replace(/,/g, "")) * 1e6;
  const range = { near: Infinity, far: 0 };
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2056, 0, 1); ms += 5 * 86400000) {
    const { earthKm, lightSeconds } = flight.live(ms);
    expect(lightSeconds).toBeCloseTo(earthKm / 299792.458, 6);
    range.near = Math.min(range.near, earthKm);
    range.far = Math.max(range.far, earthKm);
  }
  expect(shipped).toBeGreaterThan(range.near);
  expect(shipped).toBeLessThan(range.far);
  expect(range.near / 299792.458 / 60).toBeGreaterThan(65);
  expect(range.far / 299792.458 / 60).toBeLessThan(93);
  // No inline script beyond the import map, whose hash the CSP already allows.
  const importMap = (html: string) => html.match(/<script type="importmap">[\s\S]*?<\/script>/)![0];
  expect(importMap(page)).toBe(importMap(voyagerPage));
  expect(page.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toEqual(['<script type="importmap">']);
});

test("the page shares Voyager's module URLs, so each loads once", () => {
  const specifiers = new Map<string, Set<string>>();
  const files = ["missions/cassini.html", "missions/cassini.js", "missions/cassini-mission.js", "missions/voyager-1.js", "mission-scene.js", "mission-story.js"];
  for (const file of files) {
    for (const match of read(file).matchAll(/(?:from\s+|src=)["']((?:\.{0,2}\/)[^"'?]+\.js)(\?[^"']*)?["']/g)) {
      const url = new URL(match[1], "https://site/" + file).pathname;
      if (!specifiers.has(url)) specifiers.set(url, new Set());
      specifiers.get(url)!.add(match[2] ?? "");
    }
  }
  for (const module of ["/mission-orbits.js", "/mission-story.js", "/mission-scene.js", "/missions/cassini.js", "/missions/cassini-mission.js"]) {
    expect([...specifiers.keys()]).toContain(module);
  }
  for (const [module, versions] of specifiers) expect([...versions], module).toHaveLength(1);
  for (const asset of ["/scene-load-failure.js", "/chrome.js", "/common.css", "/mission-page.css"]) {
    const url = new RegExp(asset.replace(/[./]/g, "\\$&") + "(\\?v=[\\w-]+)?\"");
    expect(page.match(url)![0], asset).toBe(voyagerPage.match(url)![0]);
  }
  expect(page).toContain('<a class="crumb" href="/missions">');
  expect(page).toContain('<link rel="canonical" href="https://tinyastronomer.com/missions/cassini">');
});

test("what is illustrative is said to be so, and volatile facts are dated", () => {
  const notes = [...page.matchAll(/<details class="science-note">[\s\S]*?<\/details>/g)].map((m) => m[0]);
  expect(notes).toHaveLength(4);
  expect(notes[0]).toContain('<span class="science-kind">Measured path</span>');
  expect(notes[1]).toContain("This close-up is an illustration, not tracking data.");
  expect(notes[2]).toContain("an artist's choice");
  expect(notes[3]).toContain("The plume's shape, brightness and motion are an illustration");
  for (const note of notes) expect(note).toContain("Reviewed Nov 21, 2026");
  expect(page).toContain("As of November 2026 its launch is planned for July 2028");
  expect(page).toContain("Counts are NASA's, from the end of the mission.");
});

test("the spacecraft model keeps its named parts and everything stays within budget", () => {
  const path = root + ASSETS + "cassini.glb";
  const glb = readFileSync(path);
  expect(statSync(path).size).toBeLessThan(700 * 1024);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
  const names = json.nodes.map((node: { name?: string }) => node.name);
  const parts = PARTS.map((part) => part.key);
  expect(parts.length).toBe(8);
  for (const part of parts) {
    expect(names, `model has no ${part}`).toContain(part);
    expect(names, `model has no label anchor for ${part}`).toContain(`Hotspot_${part}`);
  }
  // The page lets Huygens go, so it must be a part with a node of its own.
  expect(parts).toContain("HuygensProbe");
  expect(json.extensionsRequired).toContain("EXT_meshopt_compression");
  const triangles = json.meshes.flatMap((mesh: { primitives: { indices: number }[] }) => mesh.primitives)
    .reduce((sum: number, primitive: { indices: number }) => sum + json.accessors[primitive.indices].count / 3, 0);
  expect(triangles).toBeLessThan(120000);
  const readme = read(ASSETS + "README.md");
  expect(readme).toContain("https://science.nasa.gov/resource/cassini-3d-model/");
  for (const part of parts) expect(readme).toContain("`" + part + "`");
  // All trajectory data together: about 250 KB.
  expect(statSync(root + ASSETS + "trajectory.json").size + statSync(root + ASSETS + "tour.bin").size).toBeLessThan(256 * 1024);
  expect(bin.length).toBe((data.tour.count + data.finale.count) * 8);
  expect(statSync(root + ASSETS + "og-cover.png").size).toBeLessThan(500 * 1024);
  expect(statSync(root + ASSETS + "poster.webp").size).toBeLessThan(180 * 1024);
  for (const still of ["og-cover.png", "poster.webp", "poster-800.webp"]) {
    expect(statSync(root + ASSETS + still).size).toBeGreaterThan(10000);
  }
  const png = readFileSync(root + ASSETS + "og-cover.png");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
