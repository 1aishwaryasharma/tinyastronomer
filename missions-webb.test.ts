import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AU_KM, planetPosition, sampleRows } from "./public/mission-orbits.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const ASSETS = "assets/missions/webb/";
const data = JSON.parse(read(ASSETS + "trajectory.json"));
const page = read("missions/webb.html");
const script = read("missions/webb.js");
const voyagerPage = read("missions/voyager-1.html");
const voyagerScript = read("missions/voyager-1.js");
const readme = read(ASSETS + "README.md");
const DAY = 86400000;
const dayOf = (utc: string) => (Date.parse(utc) - Date.parse(data.epoch)) / DAY;
const range = (row: number[]) => Math.hypot(row[1], row[2], row[3]);

// The lookup the page builds: the fine transfer rows, then the halo.
const path: number[][] = data.transfer
  .filter((row: number[]) => row[0] < data.halo[0][0])
  .map((row: number[]) => row.slice(0, 4))
  .concat(data.halo);
const l2Km = (ms: number) => Math.hypot(...(planetPosition("earth", ms) as number[])) * AU_KM * data.l2Ratio;
const lapStarts: number[] = [];
for (let i = 1; i < data.halo.length; i++) {
  if (data.halo[i - 1][2] < 0 && data.halo[i][2] >= 0) lapStarts.push(data.halo[i][0]);
}

test("the trajectory is JPL's, sampled finely enough for what the page draws", () => {
  expect(data.source).toContain("JPL Horizons");
  expect(data.source).toContain("-170");
  expect(data.epoch).toBe("2021-12-25T00:00:00Z");
  // Launch was at 12:20 UTC; Horizons' file opens at 13:00 UTC and the first row
  // is the next whole step.
  expect(data.transfer[0][0]).toBeCloseTo(dayOf("2021-12-25T13:20Z"), 3);
  expect(data.transfer[1][0] - data.transfer[0][0]).toBeCloseTo(20 / 1440, 3);
  expect(data.transfer.at(-1)[0]).toBeGreaterThan(dayOf("2022-01-25T00:00Z"));
  // The halo rows pick up before the transfer rows end, every two days.
  expect(data.halo[0][0]).toBeLessThan(data.transfer.at(-1)[0]);
  expect(data.halo[1][0] - data.halo[0][0]).toBe(2);
  // The live figures must not run off the end of the data for years.
  expect(data.halo.at(-1)[0]).toBeGreaterThan(dayOf("2031-01-01T00:00Z"));
  expect(data.measuredUntil).toBeGreaterThan(dayOf("2026-11-01T00:00Z"));
  expect(data.measuredUntil).toBeLessThan(data.halo.at(-1)[0]);
  for (const rows of [data.transfer, data.halo, data.moon, path]) {
    for (let i = 1; i < rows.length; i++) expect(rows[i][0]).toBeGreaterThan(rows[i - 1][0]);
  }
});

test("the climb to L2 slows the way the card and its chart say", () => {
  const speeds = data.transfer.map((row: number[]) => row[4]);
  expect(speeds[0]).toBeCloseTo(6.6, 1);
  const arrival = sampleRows(data.transfer, dayOf("2022-01-24T19:00Z"));
  expect(arrival[4]).toBeCloseTo(0.2, 1);
  // It only ever slows: nothing in the month speeds it back up.
  for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeLessThan(speeds[i - 1] + 0.002);
  expect(page).toContain("from 6.6 km/s an hour after launch to 0.2 km/s a month later");
  expect(page).toContain("falls from 6.6 kilometres per second an hour after launch to about 0.2");
  // The shared chart draws its grid in tens, so the trace must fit under 10.
  expect(Math.max(...speeds)).toBeLessThan(10);
  expect(script).toContain("createChart($('chart-speed'), speedRows, { events: [{ day: DAYS.arrive, label: 'arrives' }] })");
});

test("the distance from Earth follows Horizons, and L2 sits where the page says", () => {
  expect(data.checks.length).toBeGreaterThanOrEqual(5);
  for (const check of data.checks) {
    const ms = Date.parse(check.utc);
    const km = range(sampleRows(path, dayOf(check.utc)));
    // Two-day rows joined by straight lines miss the curve of the halo by a
    // few hundred kilometres at most.
    expect(Math.abs(km - check.earthKm), `Earth range at ${check.utc}`).toBeLessThan(1500);
    // L2 from the page's own Earth model against Horizons' Sun-Earth distance.
    expect(Math.abs(l2Km(ms) - check.sunEarthKm * data.l2Ratio), `L2 at ${check.utc}`).toBeLessThan(400);
  }
  // "1.5 million km away, four times as far as the Moon", "1.0 % of the Sun's distance".
  expect(data.l2Ratio).toBeCloseTo(0.01008, 4);
  expect(Math.round((data.l2Ratio * AU_KM) / 1e5) / 10).toBe(1.5);
  const moonKm = data.moon.map(range);
  const moonMean = moonKm.reduce((a: number, b: number) => a + b, 0) / moonKm.length;
  expect(moonMean).toBeGreaterThan(375000);
  expect(moonMean).toBeLessThan(395000);
  expect(Math.round((data.l2Ratio * AU_KM) / moonMean)).toBe(4);
  expect(page).toContain("a point 1.5 million km away, four times as far as the Moon");
  expect(page).toContain("1.0 % of the Sun's distance beyond Earth");
});

test("Webb arrives on 24 January 2022 and stays in a loop around L2", () => {
  const arrive = dayOf("2022-01-24T19:00Z");
  const flown = data.halo.filter((row: number[]) => row[0] >= arrive && row[0] <= data.measuredUntil);
  for (const row of flown) {
    const ms = Date.parse(data.epoch) + row[0] * DAY;
    const fromL2 = Math.hypot(row[1] - l2Km(ms), row[2], row[3]);
    expect(fromL2, `day ${row[0]}`).toBeGreaterThan(200000);
    expect(fromL2, `day ${row[0]}`).toBeLessThan(1000000);
  }
  // Before arrival it is still on its way out: nearer Earth than L2 is.
  for (const row of data.transfer) if (row[0] < arrive) expect(row[1]).toBeLessThan(1260000);
  expect(page).toContain('<time datetime="2022-01-24">24 January 2022</time>');
  expect(script).toContain("arrive: dayOn(2022, 1, 24, 19)");
});

test("the halo is as wide, as slow and as far as the copy says", () => {
  // "swings up to 800,000 km to either side of L2, wider than the Moon's whole orbit"
  expect(Math.round(data.extent.acrossKm / 1e5)).toBe(8);
  expect(data.extent.acrossKm * 2).toBeGreaterThan(2 * 406000);
  expect(page).toContain("The loop swings up to 800,000 km to either side of L2, wider than the Moon's whole orbit.");
  // "its distance from Earth swings between about 1.2 and 1.75 million kilometres"
  expect(Math.round(data.extent.nearestEarthKm / 1e5) / 10).toBe(1.2);
  expect(Math.round(data.extent.farthestEarthKm / 5e4) / 20).toBe(1.75);
  expect(page).toContain("swings between about 1.2 and 1.75 million kilometres");
  // "about twice a year", "about once every six months"
  const laps = lapStarts.slice(1).map((start, i) => start - lapStarts[i]);
  const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
  expect(mean).toBeGreaterThan(170);
  expect(mean).toBeLessThan(190);
  expect(page).toContain("Webb loops around that empty point about twice a year.");
  // The figures shipped in the markup are right for the day they were written.
  const written = dayOf("2026-11-21T00:00Z");
  expect(lapStarts.filter((start) => start <= written).length - 1).toBe(9);
  expect(page).toContain('id="halo-laps">9<');
  const shipped = Number(page.match(/id="hero-earth-km">([\d,]+)</)![1].replace(/,/g, ""));
  expect(Math.abs(shipped - range(sampleRows(path, written)))).toBeLessThan(5000);
  expect(page).toMatch(/id="halo-earth-km">1,6\d\d,\d{3}</);
  // 5.6 light-seconds.
  expect((shipped / 299792.458).toFixed(1)).toBe("5.6");
  expect(page).toContain('id="hero-light">5.6 seconds<');
});

test("the unfolding steps agree between the card, the script, the clip and its notes", () => {
  const items = [...page.matchAll(/<li><time datetime="(\d{4}-\d\d-\d\d)">[^<]+<\/time>[^<]+<\/li>/g)].map((m) => m[1]);
  const steps = items.slice(0, 10);
  expect(steps).toEqual([
    "2021-12-25", "2021-12-26", "2021-12-28", "2021-12-29", "2021-12-30",
    "2021-12-31", "2022-01-04", "2022-01-05", "2022-01-07", "2022-01-08",
  ]);
  const dates = [...script.matchAll(/\{ date: \[(\d+), (\d+), (\d+), \d+\], label: '[^']+' \}/g)]
    .map((m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  expect(dates).toEqual(steps);
  expect(script).toContain("const CLIP_END = 10;");
  expect(readme).toContain("One animation, `Deploy`, 10 seconds long");
  // Every step is inside the month Horizons' transfer rows cover, so the
  // clock's distance for it is measured.
  for (const date of steps) {
    expect(dayOf(date + "T12:00Z")).toBeGreaterThan(data.transfer[0][0] - 0.1);
    expect(dayOf(date + "T12:00Z")).toBeLessThan(data.transfer.at(-1)[0]);
  }
  expect(page).toContain("The motion is simplified");
});

test("every chapter in the markup has a scene, a rail link, and a known set", () => {
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)" data-stage="([^"]+)">/g)];
  expect(chapters.map((m) => m[1])).toEqual([
    "hero", "telescope", "unfold", "journey", "halo", "sunshield", "mirror", "infrared", "future",
  ]);
  const handlers = script.slice(script.indexOf("const CHAPTERS = {"), script.indexOf("function before"));
  for (const [, id, stage] of chapters) {
    expect(handlers, `no scene for chapter ${id}`).toMatch(new RegExp(`\\n    ${id}\\(`));
    expect(["craft", "l2", "nebula"], `${id} names an unknown set`).toContain(stage);
    expect(page, `no rail link for ${id}`).toContain(`<a href="#${id}">`);
  }
  expect(page.match(/<a href="#[a-z]+"><span>/g)!.length).toBe(chapters.length);
  // The flight and the dust cloud are their own sets, so the cuts are hidden.
  expect(chapters.find((m) => m[1] === "journey")![2]).toBe("l2");
  expect(chapters.find((m) => m[1] === "infrared")![2]).toBe("nebula");
  for (const id of ["mission-header", "story", "parts", "guide", "hero-asof"]) {
    expect(page.split(`id="${id}"`).length, id).toBe(2);
  }
});

test("the story is readable and its controls work without the 3D scene", () => {
  expect(page).toContain('class="loader mission-loader"');
  expect(page).not.toContain("loader-js-required");
  expect(page).toContain('<div id="canvas-container"></div>');
  // Live readouts, the part picker and both sliders are wired before WebGL
  // is asked for.
  const scene = script.indexOf("createMissionKit(");
  expect(scene).toBeGreaterThan(0);
  expect(script.indexOf("setInterval(tickLive, 1000)")).toBeLessThan(scene);
  expect(script.indexOf("createPartPicker(PARTS)")).toBeLessThan(scene);
  expect(script.indexOf("$('align-slider').addEventListener")).toBeLessThan(scene);
  expect(script.indexOf("$('ir-slider').addEventListener")).toBeLessThan(scene);
  expect(script).toContain("if (kit) startScene(kit);");
  // One line near the top is written only by the script.
  expect(page).toContain('<p class="stat-note" id="hero-asof"></p>');
  expect(script).toContain("'Worked out for ' + formatDate(ms) + ' from JPL Horizons data'");
  // The only inline script is the import map, byte for byte Voyager's, so
  // its CSP hash is the one already allowed.
  const inline = (html: string) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[0]);
  expect(inline(page)).toEqual(inline(voyagerPage));
  expect(inline(page)).toHaveLength(1);
  expect(page).not.toMatch(/<script[^>]+src="https?:/);
  expect(page).not.toMatch(/\son[a-z]+="/);
  // Each control says what it is.
  for (const input of page.match(/<input[^>]*type="range"[^>]*>/g)!) expect(input).toContain("aria-label=");
  for (const button of page.match(/<button[^>]*>/g) ?? []) expect(button).toContain('type="');
  expect(read("mission-story.js")).toContain("btn.type = 'button';");
});

test("what is drawn rather than measured says so", () => {
  const notes = [...page.matchAll(/<span class="science-kind">([^<]+)<\/span>/g)].map((m) => m[1]);
  expect(notes).toEqual(["Simplified model", "Measured path", "Illustration"]);
  expect(page).toContain("is drawn by this page, not taken by Webb");
  expect(page.match(/Illustration, not a Webb image/g)).toHaveLength(1);
  expect(page).toContain("in space the mirror side is always in shadow");
  // Hot and cold are NASA's two figures, the same everywhere they appear.
  expect(page.match(/\+85 °C/g)!.length).toBeGreaterThanOrEqual(2);
  expect(page.match(/−233 °C/g)!.length).toBeGreaterThanOrEqual(2);
  expect(script).toContain("lerp(85, -233, side)");
  expect(page).toContain("https://science.nasa.gov/");
});

test("the page carries the head tags and guide the site's page checks ask for", () => {
  const title = page.match(/<title>([^<]+)<\/title>/)![1];
  expect(title.endsWith(" | tinyastronomer")).toBe(true);
  expect(title.startsWith("James Webb Space Telescope")).toBe(true);
  const description = page.match(/<meta name="description" content="([^"]+)">/)![1];
  expect(description.length).toBeGreaterThanOrEqual(110);
  expect(description.length).toBeLessThanOrEqual(160);
  expect(page).toContain(`<meta property="og:description" content="${description}">`);
  expect(page).toContain(`<meta name="twitter:description" content="${description}">`);
  expect(page).toContain('<link rel="canonical" href="https://tinyastronomer.com/missions/webb">');
  expect(page).toContain('<meta property="og:url" content="https://tinyastronomer.com/missions/webb">');
  expect(page).toContain('<meta property="og:image" content="https://tinyastronomer.com/assets/missions/webb/og-cover.png">');
  const brand = voyagerPage.match(/<a class="brand"[\s\S]*?<\/a>/)![0];
  expect(page).toContain(brand);
  expect(page).toContain('<a class="crumb" href="/missions">');
  expect(page).toContain('<section class="guide guide-inline" id="guide" aria-labelledby="guide-title">');
  expect(page).toContain('<h3 id="guide-teach-title">For teachers</h3>');
  const guide = page.slice(page.indexOf('id="guide"'), page.indexOf('<div class="foot">'));
  expect(guide.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length).toBeGreaterThan(450);
  expect(guide).toContain('class="science-sources"');
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(script).toContain("SPACE.buildNav('missions')");
});

test("shared modules are imported under the same URLs the Voyager page uses", () => {
  const imports = (source: string) => {
    const found = new Map<string, string>();
    for (const match of source.matchAll(/(?:from\s+|src=|href=)["'](\/[^"'?]+\.(?:js|css))(\?[^"']*)?["']/g)) {
      found.set(match[1], match[2] ?? "");
    }
    return found;
  };
  const mine = new Map([...imports(page), ...imports(script)]);
  const theirs = new Map([...imports(voyagerPage), ...imports(voyagerScript)]);
  for (const module of ["/common.bundle.js", "/mission-orbits.js", "/mission-scene.js", "/mission-story.js", "/chrome.js", "/scene-load-failure.js", "/common.css", "/mission-page.css"]) {
    expect(mine.get(module), module).toBe(theirs.get(module)!);
  }
  // Nothing relative: the page sits in a folder.
  expect(page).not.toMatch(/(?:src|href)="\.\.?\//);
  expect(script).not.toMatch(/from\s+['"]\.\.?\//);
});

type Gltf = {
  nodes: { name?: string; mesh?: number }[];
  meshes: { primitives: { indices: number }[] }[];
  accessors: { count: number }[];
  animations: { name: string; channels: { target: { node: number; path: string } }[] }[];
  extensionsRequired: string[];
  images?: unknown[];
};

test("the telescope model keeps its named parts, its clip and the phone budget", () => {
  const file = root + ASSETS + "webb.glb";
  const glb = readFileSync(file);
  expect(statSync(file).size).toBeLessThan(900 * 1024);
  const json: Gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
  const names = json.nodes.map((node) => node.name);
  const parts = [...script.matchAll(/\{ key: '(\w+)', label:/g)].map((m) => m[1]);
  expect(parts).toEqual([
    "PrimaryMirror", "SecondaryMirror", "Sunshield", "InstrumentModule", "Bus", "SolarArray", "Antenna", "MomentumFlap",
  ]);
  for (const part of parts) {
    expect(names, `model has no ${part}`).toContain(part);
    expect(names, `model has no label anchor for ${part}`).toContain(`Hotspot_${part}`);
    expect(readme).toContain("`" + part + "`");
  }
  const triangles = json.meshes.flatMap((mesh) => mesh.primitives).reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0);
  expect(triangles).toBeGreaterThan(40000);
  expect(triangles).toBeLessThan(150000);
  expect(json.images ?? []).toHaveLength(0);
  expect(json.extensionsRequired).toContain("EXT_meshopt_compression");
  // One clip, and it only ever moves pivots: Meshopt's quantization owns the
  // transform of every mesh node.
  expect(json.animations.map((a) => a.name)).toEqual(["Deploy"]);
  expect(json.animations[0].channels.length).toBe(19);
  for (const channel of json.animations[0].channels) {
    const node = json.nodes[channel.target.node];
    expect(node.name).toMatch(/^(Pivot|Scale)_/);
    expect(node.mesh).toBeUndefined();
  }
  expect(script).toContain("THREE.AnimationClip.findByName(gltf.animations, 'Deploy')");
  expect(readme).toContain("https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/");
  // Stills: the social card is 1200 x 630 and both are light.
  const cover = readFileSync(root + ASSETS + "og-cover.png");
  expect([cover.readUInt32BE(16), cover.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(cover.length).toBeLessThan(500 * 1024);
  expect(statSync(root + ASSETS + "poster.webp").size).toBeLessThan(180 * 1024);
  for (const still of ["og-cover.png", "poster.webp", "poster-800.webp"]) {
    expect(statSync(root + ASSETS + still).size).toBeGreaterThan(8000);
    expect(page).toContain("/" + ASSETS + still);
  }
});

test("the packed model loads in the vendored three.js and its clip unfolds the telescope", async () => {
  const vendor = root + "vendor/three/";
  // The addons import the bare name "three", which the page's import map
  // points at the vendored build. Outside a browser there is no import map,
  // so the two addon files are copied with that name spelled out.
  const copies = mkdtempSync(join(tmpdir(), "webb-three-"));
  const spelled = (file: string) => readFileSync(vendor + file, "utf8")
    .replace(/from\s+'three'/g, `from '${vendor}three.module.min.js'`)
    .replace(/'\.\.\/utils\/(\w+\.js)'/g, "'./$1'");
  writeFileSync(join(copies, "GLTFLoader.js"), spelled("addons/loaders/GLTFLoader.js"));
  for (const util of ["BufferGeometryUtils.js", "SkeletonUtils.js"]) writeFileSync(join(copies, util), spelled("addons/utils/" + util));
  // GLTFLoader expects a worker-style global when it is not in a browser.
  (globalThis as { self?: unknown }).self ??= globalThis;
  const THREE = await import(vendor + "three.module.min.js");
  const { GLTFLoader } = await import(join(copies, "GLTFLoader.js"));
  const { MeshoptDecoder } = await import(vendor + "addons/libs/meshopt_decoder.module.js");
  rmSync(copies, { recursive: true });
  const glb = readFileSync(root + ASSETS + "webb.glb");
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf: any = await new Promise((resolve, reject) =>
    loader.parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "", resolve, reject));
  const clip = THREE.AnimationClip.findByName(gltf.animations, "Deploy");
  expect(clip.duration).toBeCloseTo(10, 3);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.play();
  const sizeAt = (second: number) => {
    action.time = second;
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  };
  const at = (name: string) => gltf.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());

  // At rest, with no clip applied, the file is the open telescope.
  gltf.scene.updateMatrixWorld(true);
  const rest = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  expect(rest.z).toBeGreaterThan(20);

  // Folded for launch it has to fit a rocket: far narrower and shorter.
  const folded = sizeAt(0);
  expect(folded.x).toBeLessThan(7);
  expect(folded.z).toBeLessThan(11);
  const towerDown = at("Hotspot_PrimaryMirror").y;
  const mirrorTucked = at("Hotspot_SecondaryMirror").z;

  // After the pallets and tower, long but still narrow.
  const pallets = sizeAt(4.5);
  expect(pallets.z).toBeGreaterThan(20);
  expect(pallets.x).toBeLessThan(7);
  // The tower lifts the telescope 1.22 m.
  expect(at("Hotspot_PrimaryMirror").y - towerDown).toBeCloseTo(1.22, 2);

  // Open: about 21 m long and 14 m wide.
  const open = sizeAt(9.999);
  expect(open.z).toBeGreaterThan(20.5);
  expect(open.z).toBeLessThan(21.7);
  expect(open.x).toBeGreaterThan(14);
  expect(open.x).toBeLessThan(15);
  expect(open.x).toBeCloseTo(rest.x, 1);
  // The secondary mirror ends up more than 7 m out in front of the primary.
  expect(at("Hotspot_SecondaryMirror").z - at("Hotspot_PrimaryMirror").z).toBeGreaterThan(7);
  expect(at("Hotspot_SecondaryMirror").z).toBeGreaterThan(mirrorTucked + 5);
  const mirror = new THREE.Box3();
  for (const name of ["PrimaryMirror", "MirrorWingA", "MirrorWingB"]) {
    gltf.scene.getObjectByName(name).traverse((node: any) => {
      if (node.isMesh && node.material.name === "Gold") mirror.expandByObject(node);
    });
  }
  const across = mirror.getSize(new THREE.Vector3());
  // Five columns of hexagons point to point, five rows flat to flat: the
  // published 6.5 m lies between the two.
  expect(across.x).toBeGreaterThan(6.0);
  expect(across.x).toBeLessThan(6.2);
  expect(across.y).toBeGreaterThan(6.5);
  expect(across.y).toBeLessThan(6.7);
  // Gold that would go black under one light is the thing to avoid.
  const gold = gltf.scene.getObjectByName("PrimaryMirror").children.find((node: any) => node.material?.name === "Gold").material;
  expect(gold.metalness).toBeLessThan(0.5);
  expect(gold.roughness).toBeGreaterThan(0.3);
});
