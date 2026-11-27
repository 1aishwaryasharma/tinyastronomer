import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AU_KM,
  clockTime,
  equatorialToEcliptic,
  formatLightTime,
  indexAt,
  missionCalendar,
  planetOrbit,
  planetPosition,
  sampleRows,
  unpackRows,
} from "./public/mission-orbits.js";
import { createPartPicker, follow, storyState } from "./public/mission-story.js";
import { PARTS, createFlight } from "./public/missions/voyager-1-mission.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const data = JSON.parse(read("assets/missions/voyager-1/trajectory.json"));
const page = read("missions/voyager-1.html");
const DAY = 86400000;
const flight = createFlight(data);
const dayOf = (utc: string) => flight.dayOf(Date.parse(utc));

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
  // Each flyby chapter plays inside the stretch of path it has, with the
  // pass in the middle.
  for (const name of ["jupiter", "saturn"] as const) {
    const day = flight.chapterDay[name];
    expect(day(0)).toBeGreaterThanOrEqual(data[name].path[0][0]);
    expect(day(1)).toBeLessThanOrEqual(data[name].path.at(-1)[0]);
    expect(day(0.5)).toBeCloseTo(data[name].closestDay, 9);
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
  for (const check of data.checks) {
    const live = flight.live(Date.parse(check.utc));
    expect(Math.abs(live.earthKm - check.earthKm), `Earth range at ${check.utc}`).toBeLessThan(20000);
    expect(Math.abs(live.sunKm - check.sunKm), `Sun range at ${check.utc}`).toBeLessThan(5000);
  }
  // One light-day is 86,400 light-seconds; Horizons puts the crossing at
  // about 10:16 UTC on 18 November 2026.
  const crossing = flight.live(Date.parse("2026-11-18T10:16Z"));
  expect(Math.abs(crossing.lightSeconds - 86400)).toBeLessThan(0.1);
  expect(flight.live(Date.parse("2026-11-17T00:00Z")).lightSeconds).toBeLessThan(86400);
  expect(flight.live(Date.parse("2026-11-20T00:00Z")).lightSeconds).toBeGreaterThan(86400);
  expect(page).toContain("On 18 November 2026 Voyager 1 became the first spacecraft so far away");
});

test("the distance from Earth shrinks for part of each year, as the page says", () => {
  const earthKm = (utc: string) => flight.live(Date.parse(utc)).earthKm;
  expect(earthKm("2027-04-01T00:00Z")).toBeLessThan(earthKm("2027-02-01T00:00Z"));
  // It never falls back inside one light-day.
  for (let day = 0; day < 365; day += 5) {
    const live = flight.live(Date.parse("2026-11-19T00:00Z") + day * DAY);
    expect(live.lightSeconds).toBeGreaterThan(86400);
  }
  expect(page).toContain("The distance from Earth wobbles");
});

test("the heliosphere crossings are drawn where Voyager was on those dates", () => {
  const sunAu = (day: number) => Math.hypot(...flight.at(day).slice(1, 4));
  expect(Math.round(sunAu(flight.DAYS.shock))).toBe(94);
  expect(Math.round(sunAu(flight.DAYS.pause))).toBe(122);
  expect(Math.round(sunAu(flight.DAYS.portrait) * AU_KM / 1e9)).toBe(6);
  expect(flight.DAYS.shock).toBe(dayOf("2004-12-16T00:00Z"));
  expect(flight.DAYS.pause).toBe(dayOf("2012-08-25T00:00Z"));
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
  // The sample at or before a day, whatever the samples are.
  const days = [0, 2, 4, 9];
  expect([-1, 0, 1.9, 2, 8.9, 9, 50].map((day) => indexAt(days, day))).toEqual([0, 0, 0, 1, 2, 3, 3]);
  expect(indexAt(rows, 3, (row) => row[0])).toBe(1);
  expect(indexAt([7], 3)).toBe(0);
  expect(formatLightTime(86421)).toBe("24 h 00 min 21 s");
  // Saturn's pole leans about 27 degrees from the ecliptic pole.
  const pole = equatorialToEcliptic(40.589, 83.537);
  expect(Math.round(Math.acos(pole[2]) * 180 / Math.PI)).toBe(28);
});

test("mission days count from the epoch, and the clock reads them in UTC", () => {
  const calendar = missionCalendar("1977-09-05T00:00:00Z");
  expect(calendar.dayOn(1977, 9, 6)).toBe(1);
  expect(calendar.dayOn(1977, 9, 5, 12)).toBe(0.5);
  expect(calendar.dayOn(1977, 9, 5, 0, 36)).toBeCloseTo(0.025, 12);
  expect(calendar.dayOf(calendar.msOf(4321.5))).toBe(4321.5);
  expect(new Date(calendar.msOf(calendar.dayOn(2026, 11, 18, 10))).toISOString()).toBe("2026-11-18T10:00:00.000Z");
  const ms = Date.UTC(2015, 9, 28, 15, 22, 42);
  expect(clockTime(ms)).toBe("15:22 UTC");
  expect(clockTime(ms, true)).toBe("15:22:42 UTC");
  expect(clockTime(Date.UTC(2004, 6, 1, 2, 5))).toBe("02:05 UTC");
});

test("a packed path unpacks to the days and kilometres that went in", () => {
  const meta = { byteOffset: 8, count: 3, unitKm: 50, stepSeconds: 60, startDay: 100 };
  const buffer = new ArrayBuffer(8 + 3 * 8);
  const view = new DataView(buffer, 8);
  [[0, 10, -20, 30], [90, 11, -21, 31], [1440, -5, 0, 7]].forEach(([ticks, x, y, z], i) => {
    view.setInt16(i * 8, x, true); view.setInt16(i * 8 + 2, y, true); view.setInt16(i * 8 + 4, z, true);
    view.setUint16(i * 8 + 6, ticks, true);
  });
  expect(unpackRows(buffer, meta)).toEqual([
    [100, 500, -1000, 1500],
    [100.0625, 550, -1050, 1550],
    [101.0625, -250, 0, 350],
  ]);
});

test("scroll position maps to one chapter, its progress, and a cut between sets", () => {
  const chapters = [
    { top: 0, height: 1000, stage: "craft" },
    { top: 1000, height: 2000, stage: "system" },
    { top: 3000, height: 2000, stage: "system" },
  ];
  const band = 800 * 0.22;
  const at = (middle: number) => storyState(chapters, middle - 400, 800);
  expect(at(412)).toMatchObject({ index: 0, progress: 0.5, dim: 0 });
  // The picture is fully dimmed on both sides of a change of set.
  expect(at(999).dim).toBeCloseTo(1, 1);
  expect(at(1001).dim).toBeCloseTo(1, 1);
  expect(at(1000 + band).dim).toBe(0);
  // A chapter plays only while it can be seen: it has finished before the
  // picture starts to dim, and the next does not start until it is back.
  expect(at(1000 - band).progress).toBeCloseTo(1, 9);
  expect(at(1000 - band).dim).toBeCloseTo(0, 9);
  expect(at(1000 + band / 2).progress).toBe(0);
  expect(at(1000 + band).progress).toBeCloseTo(0, 9);
  expect(at(1000 + band + (2000 - band) / 2).progress).toBeCloseTo(0.5, 9);
  // Chapters that share a set run into each other without a cut.
  expect(at(2999).dim).toBe(0);
  expect(at(2999).progress).toBeGreaterThan(0.999);
  expect(at(3001)).toMatchObject({ index: 2, dim: 0 });
  expect(at(3001).progress).toBeLessThan(0.001);
  // Below the story the reading matter takes over and rendering can stop.
  expect(at(5000 - band * 2).progress).toBeCloseTo(1, 9);
  expect(at(5000).dim).toBe(1);
  expect(at(5000).past).toBe(false);
  expect(at(5500).past).toBe(true);
});

test("every chapter in the markup has a rail link and a known set, and the dated ones a date", () => {
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)" data-stage="([^"]+)">/g)];
  expect(chapters.map((m) => m[1])).toEqual([
    "hero", "craft", "launch", "jupiter", "cruise", "saturn", "portrait", "edge", "lightday", "record", "future",
  ]);
  for (const [, id, stage] of chapters) {
    expect(["craft", "system", "jupiter", "saturn"], `${id} names an unknown set`).toContain(stage);
    expect(page, `no rail link for ${id}`).toContain(`<a href="#${id}">`);
  }
  // A flyby is its own set, so the cut into and out of it is hidden.
  expect(chapters.find((m) => m[1] === "jupiter")![2]).toBe("jupiter");
  expect(chapters.find((m) => m[1] === "saturn")![2]).toBe("saturn");
  const dated = chapters.filter((m) => m[2] !== "craft").map((m) => m[1]);
  expect(Object.keys(flight.chapterDay)).toEqual(dated);
});

test("the story's clock only runs forward, from launch to today", () => {
  const { chapterDay, DAYS } = flight;
  let last = 0;
  for (const [id, day] of Object.entries(chapterDay)) {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      expect(day(p), `${id} at ${p.toFixed(2)}`).toBeGreaterThanOrEqual(last);
      last = day(p);
    }
  }
  expect(chapterDay.launch(0)).toBe(1);
  // The cruise chapters stop short of each planet, where its own set takes over.
  expect(chapterDay.launch(1)).toBeLessThan(chapterDay.jupiter(0));
  expect(chapterDay.cruise(0)).toBeGreaterThan(chapterDay.jupiter(1));
  expect(chapterDay.cruise(1)).toBeLessThan(chapterDay.saturn(0));
  // The portrait is taken a third of the way in; the rest is the look back.
  expect(chapterDay.portrait(0.32)).toBe(DAYS.portrait);
  expect(chapterDay.portrait(1)).toBe(DAYS.portrait);
  expect(chapterDay.edge(0)).toBe(DAYS.portrait);
  expect(chapterDay.edge(1)).toBeGreaterThan(DAYS.pause);
  expect(chapterDay.lightday(0)).toBeGreaterThanOrEqual(DAYS.lightDay);
  expect(chapterDay.lightday(0)).toBeLessThanOrEqual(flight.lastDay);
});

test("the part picker works without the 3D scene", () => {
  const element = () => ({
    textContent: "", attributes: {} as Record<string, string>, children: [] as any[], click: () => {},
    setAttribute(name: string, value: string) { this.attributes[name] = value; },
    addEventListener(_: string, handler: () => void) { this.click = handler; },
    appendChild(child: unknown) { this.children.push(child); },
  });
  const nodes: Record<string, ReturnType<typeof element>> = { parts: element(), "part-title": element(), "part-text": element() };
  const scope = globalThis as { document?: unknown };
  const before = scope.document;
  scope.document = { getElementById: (id: string) => nodes[id], createElement: element };
  try {
    const picker = createPartPicker(PARTS);
    const buttons = nodes.parts.children;
    expect(buttons.map((b) => b.textContent)).toEqual(PARTS.map((part) => part.label));
    expect(picker.selected).toBe(null);
    buttons[1].click();
    expect(picker.selected).toBe("RTG");
    expect(nodes["part-title"].textContent).toBe("Nuclear batteries");
    expect(buttons.map((b) => b.attributes["aria-pressed"])).toEqual(PARTS.map((_, i) => String(i === 1)));
    // A marker on the model picks through the same call.
    picker.select("GoldenRecord");
    expect(buttons[5].attributes["aria-pressed"]).toBe("true");
    expect(buttons[1].attributes["aria-pressed"]).toBe("false");
    // Picking the same part again lets go, and leaves its text up.
    buttons[5].click();
    expect(picker.selected).toBe(null);
    expect(buttons.every((b) => b.attributes["aria-pressed"] === "false")).toBe(true);
    expect(nodes["part-text"].textContent).toBe(PARTS[5].text);
  } finally {
    scope.document = before;
  }
});

test("the story is readable and the live figures show before any script runs", () => {
  // No curtain: the loader is a chip, and there is no JavaScript-required wall.
  expect(page).toContain('class="loader mission-loader"');
  expect(page).not.toContain("loader-js-required");
  expect(read("mission-page.css")).toMatch(/\.loader\.mission-loader\s*\{[^}]*inset:\s*auto/);
  // The canvas is decoration; every fact is in the cards.
  expect(page).toContain('<div id="canvas-container"></div>');
  // The figures shipped in the markup are the right size before any script.
  expect(page).toMatch(/id="hero-earth-km">25,9\d\d,\d{3},\d{3}</);
  const written = flight.live(Date.parse("2026-11-21T00:00Z"));
  const shipped = Number(page.match(/id="ld-sun-km">([\d,]+)</)![1].replace(/,/g, ""));
  expect(Math.abs(shipped - written.sunKm)).toBeLessThan(5e6);
  expect(page).toContain(`id="ld-speed">${written.kmPerSec.toFixed(1)}<`);
});

test("the camera eases toward its pose at the same pace on any display, and jumps at a cut", () => {
  expect(follow(1 / 60, true)).toBe(1);
  const slow = follow(1 / 30, false);
  expect(slow).toBeGreaterThan(0);
  expect(slow).toBeLessThan(0.25);
  // Two frames at 60 Hz cover the same ground as one at 30 Hz.
  const fast = follow(1 / 60, false);
  expect(1 - (1 - fast) ** 2).toBeCloseTo(slow, 12);
});

test("mission modules are imported under one URL each", () => {
  const specifiers = new Map<string, Set<string>>();
  const files = ["missions/voyager-1.html", "missions/voyager-1.js", "missions/voyager-1-mission.js", "mission-scene.js", "mission-story.js", "mission-audio.js"];
  for (const file of files) {
    for (const match of read(file).matchAll(/(?:from\s+|src=)["']((?:\.{0,2}\/)[^"'?]+\.js)(\?[^"']*)?["']/g)) {
      const url = new URL(match[1], "https://site/" + file).pathname;
      if (!specifiers.has(url)) specifiers.set(url, new Set());
      specifiers.get(url)!.add(match[2] ?? "");
    }
  }
  for (const module of ["/mission-orbits.js", "/mission-story.js", "/mission-scene.js", "/mission-audio.js", "/missions/voyager-1-mission.js", "/planet-models.js"]) {
    expect([...specifiers.keys()]).toContain(module);
  }
  for (const [module, versions] of specifiers) expect([...versions], module).toHaveLength(1);
  // Every page shares one copy of the planet-model loader.
  expect(read("solar-system.html")).toContain("planet-models.js" + [...specifiers.get("/planet-models.js")!][0]);
  // The bundle and the page must share one chrome.js instance.
  const chromeUrl = read("common.bundle.js").match(/chrome\.js\?v=[\w-]+/)![0];
  expect(page).toContain(`src="/${chromeUrl}"`);
  const bundleUrl = read("seasons.html").match(/common\.bundle\.js\?v=[\w-]+/)![0];
  expect([...specifiers.get("/common.bundle.js")!]).toEqual([bundleUrl.slice(bundleUrl.indexOf("?"))]);
});

test("the spacecraft model keeps its named parts and stays within the phone budget", () => {
  const path = root + "assets/missions/voyager-1/voyager.glb";
  const glb = readFileSync(path);
  expect(statSync(path).size).toBeLessThan(700 * 1024);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
  const names = json.nodes.map((node: { name?: string }) => node.name);
  expect(PARTS.length).toBe(8);
  for (const part of PARTS.map((p) => p.key)) {
    expect(names, `model has no ${part}`).toContain(part);
    expect(names, `model has no label anchor for ${part}`).toContain(`Hotspot_${part}`);
  }
  expect(json.extensionsRequired).toContain("EXT_meshopt_compression");
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
    expect(statSync(`${root}missions/${path}.html`).isFile()).toBe(true);
  }
  // A mission with a deep dive has no static card repeating it below.
  const cards = [...missions.matchAll(/<article class="card"[\s\S]*?<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  expect(cards).toEqual(["Perseverance", "New Horizons", "Parker Solar Probe", "Apollo 11", "Hubble Telescope"]);
  expect(missions).toContain('About <span id="dive-voyager-km">25,320,225,956</span> km from the Sun');
  expect(missions).toContain("JPL Horizons figure for 1 January 2026");
  expect(page).toContain('<a class="crumb" href="/missions">');
});
