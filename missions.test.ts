import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AU_KM,
  createTrajectory,
  equatorialToEcliptic,
  formatLightTime,
  planetOrbit,
  planetPosition,
  sampleRows,
} from "./public/mission-orbits.js";
import { storyState } from "./public/mission-story.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const data = JSON.parse(read("assets/missions/voyager-1/trajectory.json"));
const page = read("missions/voyager-1.html");
const script = read("missions/voyager-1.js");
const kit = read("mission-scene.js");
const DAY = 86400000;
const dayOf = (utc: string) => (Date.parse(utc) - Date.parse(data.epoch)) / DAY;

test("the trajectory is JPL's, sampled finely enough for what the page draws", () => {
  expect(data.source).toContain("JPL Horizons");
  expect(data.source).toContain("-31");
  // Daily from the day after launch to 1981, then every thirty days.
  expect(data.cruise[0][0]).toBe(1);
  expect(data.cruise[1][0] - data.cruise[0][0]).toBe(1);
  expect(data.deep[0][0]).toBe(data.cruise.at(-1)[0]);
  expect(data.deep[1][0] - data.deep[0][0]).toBe(30);
  // The page's live figures must not run off the end of the data for years.
  expect(data.deep.at(-1)[0]).toBeGreaterThan(dayOf("2039-01-01T00:00Z"));
  for (const rows of [data.cruise, data.deep]) {
    for (let i = 1; i < rows.length; i++) expect(rows[i][0]).toBeGreaterThan(rows[i - 1][0]);
  }
});

test("the flybys land on the dates and distances NASA reports", () => {
  // NASA: closest to Jupiter on 5 March 1979 at about 349,000 km from its
  // centre; closest to Saturn on 12 November 1980 at about 184,000 km.
  expect(Math.abs(data.jupiter.closestDay - dayOf("1979-03-05T12:05Z"))).toBeLessThan(0.02);
  expect(data.jupiter.closestKm).toBeGreaterThan(345000);
  expect(data.jupiter.closestKm).toBeLessThan(352000);
  expect(Math.abs(data.saturn.closestDay - dayOf("1980-11-12T23:46Z"))).toBeLessThan(0.02);
  expect(data.saturn.closestKm).toBeGreaterThan(182000);
  expect(data.saturn.closestKm).toBeLessThan(187000);
  // Titan comes first, about eighteen hours before Saturn.
  expect(data.saturn.titanDay).toBeLessThan(data.saturn.closestDay);
  expect(data.saturn.titanKm).toBeLessThan(8000);
  // Each flyby chapter plays a day and a half either side of closest approach.
  for (const flyby of [data.jupiter, data.saturn]) {
    expect(flyby.path[0][0]).toBeLessThanOrEqual(flyby.closestDay - 1.5);
    expect(flyby.path.at(-1)[0]).toBeGreaterThanOrEqual(flyby.closestDay + 1.5);
  }
});

test("the gravity-assist copy matches the measured speeds", () => {
  const speeds = data.speed.jupiter.map((row: number[]) => row[1]);
  expect(Math.round(speeds[0])).toBe(13);
  expect(Math.round(speeds.at(-1))).toBe(24);
  expect(Math.round(Math.max(...speeds))).toBe(37);
  expect(page).toContain("arrived moving about 13 km/s and left at about 24");
  expect(page).toContain("brief peak of 37");
  // "slowed from 24 km/s to 20" on the way to Saturn.
  expect(Math.round(data.speed.saturn[0][1])).toBe(20);
});

test("planet positions from JPL's approximate elements stay close to Horizons", () => {
  expect(data.planetChecks.length).toBeGreaterThanOrEqual(6);
  for (const check of data.planetChecks) {
    const [x, y, z] = planetPosition(check.name, Date.parse(check.utc));
    const miss = Math.hypot(x - check.au[0], y - check.au[1], z - check.au[2]);
    // A few thousandths of an AU for the inner planets; Saturn's long-period
    // wobble against Jupiter is the worst case in the 1800–2050 table.
    const limit = check.name === "saturn" ? 0.02 : 0.005;
    expect(miss, `${check.name} at ${check.utc}`).toBeLessThan(limit);
  }
});

test("a planet sits on the ellipse the page draws for it", () => {
  const when = Date.UTC(1985, 0, 1);
  for (const name of ["earth", "jupiter", "neptune"]) {
    const orbit = planetOrbit(name, when, 720);
    const [x, y, z] = planetPosition(name, when);
    const nearest = Math.min(...orbit.map((p) => Math.hypot(p[0] - x, p[1] - y, p[2] - z)));
    const size = Math.hypot(x, y, z);
    expect(nearest / size, name).toBeLessThan(0.01);
  }
});

test("live distance and light-time follow Horizons to a fraction of a second", () => {
  const trajectory = createTrajectory(data);
  for (const check of data.checks) {
    const live = trajectory.live(Date.parse(check.utc));
    expect(Math.abs(live.earthKm - check.earthKm), `Earth range at ${check.utc}`).toBeLessThan(20000);
    expect(Math.abs(live.sunKm - check.sunKm), `Sun range at ${check.utc}`).toBeLessThan(5000);
  }
  // One light-day is 86,400 light-seconds; Horizons puts the crossing at
  // about 10:16 UTC on 18 November 2026.
  const crossing = trajectory.live(Date.parse("2026-11-18T10:16Z"));
  expect(Math.abs(crossing.lightSeconds - 86400)).toBeLessThan(0.1);
  expect(trajectory.live(Date.parse("2026-11-17T00:00Z")).lightSeconds).toBeLessThan(86400);
  expect(trajectory.live(Date.parse("2026-11-20T00:00Z")).lightSeconds).toBeGreaterThan(86400);
  expect(page).toContain("On 18 November 2026 Voyager 1 became the first spacecraft so far away");
});

test("the distance from Earth shrinks for part of each year, as the page says", () => {
  const trajectory = createTrajectory(data);
  const earthKm = (utc: string) => trajectory.live(Date.parse(utc)).earthKm;
  expect(earthKm("2027-04-01T00:00Z")).toBeLessThan(earthKm("2027-02-01T00:00Z"));
  // It never falls back inside one light-day.
  for (let day = 0; day < 365; day += 5) {
    const live = trajectory.live(Date.parse("2026-11-19T00:00Z") + day * DAY);
    expect(live.lightSeconds).toBeGreaterThan(86400);
  }
  expect(page).toContain("The distance from Earth wobbles");
});

test("the heliosphere crossings are drawn where Voyager was on those dates", () => {
  const trajectory = createTrajectory(data);
  const sunAu = (utc: string) => Math.hypot(...trajectory.at(dayOf(utc)).slice(1, 4));
  expect(Math.round(sunAu("2004-12-16T00:00Z"))).toBe(94);
  expect(Math.round(sunAu("2012-08-25T00:00Z"))).toBe(122);
  expect(Math.round(sunAu("1990-02-14T00:00Z") * AU_KM / 1e9)).toBe(6);
  expect(page).toContain("16 Dec 2004 <small>· 94 AU</small>");
  expect(page).toContain("25 Aug 2012 <small>· 122 AU</small>");
  expect(page).toContain("6 billion km out");
});

test("sampling interpolates between rows and clamps at the ends", () => {
  const rows = [[0, 0, 10], [2, 4, 20], [4, 8, 60]];
  expect(sampleRows(rows, 1)).toEqual([1, 2, 15]);
  expect(sampleRows(rows, 3)).toEqual([3, 6, 40]);
  expect(sampleRows(rows, -5)).toEqual([0, 0, 10]);
  expect(sampleRows(rows, 99)).toEqual([4, 8, 60]);
  expect(formatLightTime(86421)).toBe("24 h 00 min 21 s");
  // Saturn's pole leans about 27 degrees from the ecliptic pole.
  const pole = equatorialToEcliptic(40.589, 83.537);
  expect(Math.round(Math.acos(pole[2]) * 180 / Math.PI)).toBe(28);
});

test("scroll position maps to one chapter, its progress, and a cut between sets", () => {
  const chapters = [
    { top: 0, height: 1000, stage: "craft" },
    { top: 1000, height: 2000, stage: "system" },
    { top: 3000, height: 2000, stage: "system" },
  ];
  const at = (middle: number) => storyState(chapters, middle - 400, 800);
  expect(at(500)).toMatchObject({ index: 0, progress: 0.5, dim: 0 });
  // The picture is fully dimmed on both sides of a change of set.
  expect(at(999).dim).toBeCloseTo(1, 1);
  expect(at(1001).dim).toBeCloseTo(1, 1);
  expect(at(1000 + 800 * 0.22).dim).toBe(0);
  // Chapters that share a set run into each other without a cut.
  expect(at(2999).dim).toBe(0);
  expect(at(3001)).toMatchObject({ index: 2, dim: 0 });
  expect(at(2000).progress).toBe(0.5);
  // Below the story the reading matter takes over and rendering can stop.
  expect(at(5000).dim).toBe(1);
  expect(at(5000).past).toBe(false);
  expect(at(5500).past).toBe(true);
});

test("every chapter in the markup has a scene, a rail link, and a known set", () => {
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)" data-stage="([^"]+)">/g)];
  expect(chapters.map((m) => m[1])).toEqual([
    "hero", "craft", "launch", "jupiter", "cruise", "saturn", "portrait", "edge", "lightday", "record", "future",
  ]);
  const handlers = script.slice(script.indexOf("const CHAPTERS = {"), script.indexOf("function enterStage"));
  for (const [, id, stage] of chapters) {
    expect(handlers, `no scene for chapter ${id}`).toMatch(new RegExp(`\\n    ${id}\\(`));
    expect(["craft", "system", "jupiter", "saturn"], `${id} names an unknown set`).toContain(stage);
    expect(page, `no rail link for ${id}`).toContain(`<a href="#${id}">`);
  }
  // A flyby is its own set, so the cut into and out of it is hidden.
  expect(chapters.find((m) => m[1] === "jupiter")![2]).toBe("jupiter");
  expect(chapters.find((m) => m[1] === "saturn")![2]).toBe("saturn");
});

test("the story is readable and the live figures run without the 3D scene", () => {
  // No curtain: the loader is a chip, and there is no JavaScript-required wall.
  expect(page).toContain('class="loader mission-loader"');
  expect(page).not.toContain("loader-js-required");
  expect(read("mission-page.css")).toMatch(/\.loader\.mission-loader\s*\{[^}]*inset:\s*auto/);
  // The canvas is decoration; every fact is in the cards.
  expect(page).toContain('<div id="canvas-container"></div>');
  expect(script + kit).not.toContain("canvasLabel");
  // Live readouts and the part picker are wired before WebGL is asked for.
  const scene = script.indexOf("createMissionKit()");
  expect(scene).toBeGreaterThan(0);
  expect(script.indexOf("setInterval(tickLive, 1000)")).toBeLessThan(scene);
  expect(script.indexOf("$('hello-btn').addEventListener")).toBeLessThan(scene);
  expect(script.indexOf("$('parts').appendChild(btn)")).toBeLessThan(scene);
  expect(script).toContain("if (kit) startScene(kit);");
  expect(kit).toContain("if (!setup) return null;");
  // The figures shipped in the markup are the right size before any script.
  expect(page).toMatch(/id="hero-earth-km">25,9\d\d,\d{3},\d{3}</);
});

test("system reduced-motion preference stills the drift but keeps scroll control", () => {
  expect(kit).toContain("const reduced = SPACE.prefersReducedMotion;");
  expect(kit).toContain("if (!reduced) kit.time += dt;");
  expect(kit).toContain("const k = snap || reduced ? 1 : 1 - Math.exp(-dt * 6);");
});

test("mission modules are imported under one URL each", () => {
  const specifiers = new Map<string, Set<string>>();
  for (const source of [page, script]) {
    for (const match of source.matchAll(/(?:from\s+|src=)["'](\/[^"'?]+\.js)(\?[^"']*)?["']/g)) {
      if (!specifiers.has(match[1])) specifiers.set(match[1], new Set());
      specifiers.get(match[1])!.add(match[2] ?? "");
    }
  }
  expect([...specifiers.keys()]).toContain("/mission-orbits.js");
  for (const [module, versions] of specifiers) expect([...versions], module).toHaveLength(1);
  // The bundle and the page must share one chrome.js instance.
  const chromeUrl = read("common.bundle.js").match(/chrome\.js\?v=[\w-]+/)![0];
  expect(page).toContain(`src="/${chromeUrl}"`);
  const bundleUrl = read("seasons.html").match(/common\.bundle\.js\?v=[\w-]+/)![0];
  expect(script).toContain(`'/${bundleUrl}'`);
  expect(kit).toContain(`'./${bundleUrl}'`);
});

test("the spacecraft model keeps its named parts and stays within the phone budget", () => {
  const path = root + "assets/missions/voyager-1/voyager.glb";
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
  expect(json.extensionsRequired).toContain("EXT_meshopt_compression");
  expect(kit).toContain("loader.setMeshoptDecoder(MeshoptDecoder)");
  const readme = read("assets/missions/voyager-1/README.md");
  expect(readme).toContain("https://science.nasa.gov/resource/voyager-3d-model/");
  for (const still of ["og-cover.png", "poster.webp", "poster-800.webp"]) {
    expect(statSync(root + "assets/missions/voyager-1/" + still).size).toBeGreaterThan(10000);
  }
});

test("the page is reachable from the home deck and the Missions card", () => {
  expect(read("index.html")).toContain('href="/missions#deep-dives" id="launch-deep-dives"');
  const missions = read("missions.html");
  for (const [id, path] of [["dive-voyager", "voyager-1"], ["dive-cassini", "cassini"], ["dive-webb", "webb"]]) {
    expect(missions).toContain(`<a class="dive" id="${id}" href="/missions/${path}">`);
    expect(missions).toContain(`<a class="go" href="/missions/${path}">`);
    expect(statSync(`${root}missions/${path}.html`).isFile()).toBe(true);
  }
  expect(page).toContain('<a class="crumb" href="/missions">');
  expect(script).toContain("SPACE.buildNav('missions')");
});
