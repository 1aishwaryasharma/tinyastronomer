import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { equatorialToEcliptic, sampleRows, unpackRows } from "./public/mission-orbits.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const ASSETS = "assets/missions/cassini/";
const data = JSON.parse(read(ASSETS + "trajectory.json"));
const bin = readFileSync(root + ASSETS + "tour.bin");
const page = read("missions/cassini.html");
const script = read("missions/cassini.js");
const voyagerPage = read("missions/voyager-1.html");
const voyagerScript = read("missions/voyager-1.js");
const DAY = 86400000;
const dayOf = (utc: string) => (Date.parse(utc) - Date.parse(data.epoch)) / DAY;
const norm = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
const POLE = equatorialToEcliptic(40.589, 83.537);

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
  expect(data.soi.crossings[0].day).toBeLessThan(dayOf("2004-07-01T01:12Z"));
  expect(data.soi.crossings[1].day).toBeGreaterThan(dayOf("2004-07-01T02:48Z"));
  expect(script).toContain("burnStart: dayOn(2004, 7, 1, 1, 12)");
  expect(script).toContain("burnEnd: dayOn(2004, 7, 1, 2, 48)");
  // The chapter plays from 0.34 days before closest approach to 0.3 after.
  expect(data.soi.path[0][0]).toBeLessThan(data.soi.closestDay - 0.34);
  expect(data.soi.path.at(-1)[0]).toBeGreaterThan(data.soi.closestDay + 0.3);
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
  // The chapter plays from 0.22 days before entry to 0.05 after landing.
  expect(data.titan.huygens[0][0]).toBeLessThan(data.titan.entryDay - 0.22);
  expect(data.titan.cassini.at(-1)[0]).toBeGreaterThan(data.titan.landDay + 0.05);
});

test("the tour has the orbits, the reach and the Titan the page draws", () => {
  // NASA counts 294 completed orbits: the laps between 295 close passes.
  expect(data.periapses).toHaveLength(295);
  expect(data.checks.periapsisCount - 1).toBe(294);
  expect(page).toContain('<span class="stat-label">Orbits of Saturn</span><span class="stat-value">294</span>');
  expect(script).toContain("Math.max(0, passes - 1)");
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
    const phase = (((check.day - loop[0][0]) % period) + period) % period;
    const at = sampleRows(loop, loop[0][0] + phase);
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
  // The chapter plays 0.0028 days either side of the pass.
  expect(data.enceladus.path[0][0]).toBeLessThan(data.enceladus.closestDay - 0.0028);
  expect(data.enceladus.path.at(-1)[0]).toBeGreaterThan(data.enceladus.closestDay + 0.0028);
  // The lowest point is under the southern hemisphere, where the plume is.
  const lowest = data.enceladus.path.reduce((best: number[], row: number[]) => (norm(row.slice(1)) < norm(best.slice(1)) ? row : best));
  expect(lowest[1] * POLE[0] + lowest[2] * POLE[1] + lowest[3] * POLE[2]).toBeLessThan(0);
});

test("the Grand Finale is 22 dives through the gap, then the plunge", () => {
  const dives = data.finale.periapses;
  expect(dives).toHaveLength(22);
  expect(page).toContain("it dived <strong>22 times</strong>");
  expect(script).toContain("of 22'");
  // First dive on 26 April, last on 9 September 2017.
  expect(new Date(Date.parse(data.epoch) + dives[0].day * DAY).toISOString().slice(0, 10)).toBe("2017-04-26");
  expect(new Date(Date.parse(data.epoch) + dives.at(-1).day * DAY).toISOString().slice(0, 10)).toBe("2017-09-09");
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
  expect(data.end.utc).toBe("2017-09-15T10:32:00Z");
  expect(page).toContain('<span class="stat-value">10:32 <small>UTC</small></span>');
});

test("every chapter in the markup has a scene, a rail link, and a known set", () => {
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)" data-stage="([^"]+)">/g)];
  expect(chapters.map((m) => m[1])).toEqual([
    "hero", "craft", "cruise", "arrival", "release", "titan", "tour", "enceladus", "finale", "legacy",
  ]);
  const handlers = script.slice(script.indexOf("const CHAPTERS = {"), script.indexOf("const PHONE_STEP_BACK"));
  const sets = script.match(/\n    sets: \{([^}]+)\}/)![1];
  const stepBack = script.match(/const PHONE_STEP_BACK = \{([^}]+)\}/)![1];
  for (const [, id, stage] of chapters) {
    expect(handlers, `no scene for chapter ${id}`).toMatch(new RegExp(`\\n    ${id}\\(`));
    expect(["craft", "system", "soi", "titan", "tour", "enceladus", "finale"], `${id} names an unknown set`).toContain(stage);
    expect(sets, `no set for ${stage}`).toMatch(new RegExp(`\\b${stage}: \\[`));
    expect(page, `no rail link for ${id}`).toContain(`<a href="#${id}">`);
    expect(stepBack, `no phone framing for ${id}`).toMatch(new RegExp(`\\b${id}: [\\d.]+`));
  }
  // Every change of subject is a change of set, so the cut is hidden.
  const stageOf = Object.fromEntries(chapters.map((m) => [m[1], m[2]]));
  for (const [a, b] of [["cruise", "arrival"], ["arrival", "release"], ["release", "titan"], ["titan", "tour"], ["tour", "enceladus"], ["enceladus", "finale"], ["finale", "legacy"]]) {
    expect(stageOf[a], `${a} and ${b} share a set`).not.toBe(stageOf[b]);
  }
});

test("the story is readable and the live figures run without the 3D scene", () => {
  expect(page).toContain('class="loader mission-loader"');
  expect(page).not.toContain("loader-js-required");
  expect(page).toContain('<div id="canvas-container"></div>');
  expect(script).not.toContain("canvasLabel");
  // Live readouts, the part picker and the chart are wired before WebGL is
  // asked for.
  const scene = script.indexOf("createMissionKit()");
  expect(scene).toBeGreaterThan(0);
  expect(script.indexOf("setInterval(tickLive, 1000)")).toBeLessThan(scene);
  expect(script.indexOf("createPartPicker(PARTS)")).toBeLessThan(scene);
  expect(script.indexOf("drawCruiseChart(data.speed[0][0])")).toBeLessThan(scene);
  expect(script).toContain("if (kit) startScene(kit);");
  // The markup ships a plain-words figure; only the script writes the exact
  // light-time, which is what a test of "the script ran" can look for.
  expect(page).toContain('id="hero-signal">about 80 minutes<');
  expect(page).toMatch(/id="hero-saturn-km">1,\d00</);
  // Nothing moves on its own except through the kit's clock, which the
  // reduced-motion preference stops.
  expect(script).not.toMatch(/requestAnimationFrame|performance\.now|Date\.now\(\) [-+*/]/);
  expect(script.match(/kit\.time/g)!.length).toBeGreaterThan(3);
  // No inline script beyond the import map, whose hash the CSP already allows.
  const importMap = (html: string) => html.match(/<script type="importmap">[\s\S]*?<\/script>/)![0];
  expect(importMap(page)).toBe(importMap(voyagerPage));
  expect(page.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toEqual(['<script type="importmap">']);
});

test("the page shares Voyager's module URLs, so each loads once", () => {
  const imports = (source: string) => [...source.matchAll(/from '(\/(?!missions\/)[^']+)'/g)].map((m) => m[1]).sort();
  expect(imports(script)).toEqual(imports(voyagerScript));
  for (const asset of ["/scene-load-failure.js", "/chrome.js", "/common.css", "/mission-page.css"]) {
    const url = new RegExp(asset.replace(/[./]/g, "\\$&") + "(\\?v=[\\w-]+)?\"");
    expect(page.match(url)![0], asset).toBe(voyagerPage.match(url)![0]);
  }
  expect(page).toContain('<a class="crumb" href="/missions">');
  expect(script).toContain("SPACE.buildNav('missions')");
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
  const parts = [...script.matchAll(/\{ key: '(\w+)', label:/g)].map((m) => m[1]);
  expect(parts.length).toBe(8);
  for (const part of parts) {
    expect(names, `model has no ${part}`).toContain(part);
    expect(names, `model has no label anchor for ${part}`).toContain(`Hotspot_${part}`);
  }
  // The page lets Huygens go, so it must be a node of its own.
  expect(script).toContain("getObjectByName('HuygensProbe')");
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
