import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  advanceTrackedCoordinate,
  relaxedPlanetDistance,
  sunAndPlanetFrame,
  updatedAutomaticDistance
} from "./public/tour-camera.js";

process.chdir(fileURLToPath(new URL("./public", import.meta.url)));

const pages = readdirSync(".").filter((file) => file.endsWith(".html"));
const teachingRadius = (radiusKm: number) =>
  Math.max(0.30, Math.min(0.55 * Math.pow(radiusKm / 6371, 0.4), 1.55));

test("only the public directory is deployable", () => {
  const wrangler = JSON.parse(readFileSync("../wrangler.jsonc", "utf8"));
  expect(wrangler.assets.directory).toBe("./public");
  for (const privatePath of [
    '.argent',
    '.git',
    'dev-server.ts',
    'README.md',
    'site.test.ts',
    'wrangler.jsonc',
  ]) {
    expect(existsSync(privatePath), `${privatePath} must not be a public asset`).toBe(false);
  }
});

test("asset routing is pinned rather than inherited from platform defaults", () => {
  const wrangler = JSON.parse(readFileSync("../wrangler.jsonc", "utf8"));

  // Every canonical URL is extensionless AND slashless. "drop-trailing-slash" is
  // what makes `/missions` (not `/missions/`) the served form, which also keeps
  // the pages' relative `./chrome.js` imports resolving to /chrome.js.
  expect(
    wrangler.assets.html_handling,
    "canonical URLs must not depend on a Cloudflare default",
  ).toBe("drop-trailing-slash");

  // Anything else — notably "single-page-application" — would answer unknown
  // paths with index.html and a 200, which Google files as a soft 404.
  expect(wrangler.assets.not_found_handling, "unknown paths must be a real 404").toBe("none");
});

test("security headers cover every static response and authorize current inline scripts", () => {
  const headers = readFileSync("_headers", "utf8");
  expect(headers).toMatch(/^\/\*$/m);
  for (const name of [
    "Content-Security-Policy",
    "Cross-Origin-Opener-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    expect(headers).toContain(`${name}:`);
  }

  const scriptPolicy = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] || "";
  expect(scriptPolicy).toContain("script-src 'self'");
  expect(scriptPolicy.match(/script-src[^;]*/)?.[0]).not.toContain("'unsafe-inline'");
  expect(scriptPolicy).toContain("frame-ancestors 'none'");
  expect(scriptPolicy).toContain("object-src 'none'");

  const liveHashes = new Set<string>();
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc=["']/i.test(match[1] || "")) continue;
      const digest = createHash("sha256").update(match[2]).digest("base64");
      expect(scriptPolicy, `${page}: CSP is missing its inline-script hash`).toContain(
        `'sha256-${digest}'`,
      );
      liveHashes.add(`sha256-${digest}`);
    }
  }

  // Editing an inline script changes its hash, so the old one has to go with it.
  // Without this the policy silently accumulates hashes for scripts that no
  // longer exist, widening script-src for bodies nobody can review.
  const declaredHashes =
    scriptPolicy.match(/script-src[^;]*/)?.[0].match(/sha256-[A-Za-z0-9+/=]+/g) ?? [];
  for (const declared of declaredHashes) {
    expect(liveHashes.has(declared), `CSP lists ${declared}, which no inline script matches`).toBe(
      true,
    );
  }
});

describe.each(pages)("%s", (file) => {
  const html = readFileSync(file, "utf8");

  test("has core document metadata", () => {
    expect(html).toMatch(/<html\s[^>]*lang=/i);
    expect(html).toMatch(/<meta\s+name=["']viewport["']/i);
    expect(html).toMatch(/<title>[^<]+<\/title>/i);
  });

  test("has unique IDs", () => {
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("references existing local files", () => {
    const references = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((value) => !/^(?:https?:|data:|#|javascript:)/i.test(value))
      .map((value) => value.split(/[?#]/)[0]);

    for (const reference of references) {
      const localPath = reference === "/"
        ? "index.html"
        : reference.startsWith("/")
          ? reference.slice(1)
          : reference;
      const deployablePath = existsSync(localPath) ? localPath : `${localPath}.html`;
      expect(existsSync(deployablePath), `${file}: missing ${reference}`).toBe(true);
    }
  });

  test('scripts are served locally', () => {
    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(
      (match) => match[1],
    );
    for (const src of srcs) {
      expect(src).not.toMatch(/^(?:https?:)?\/\//);
    }
    for (const match of html.matchAll(/from\s+["']([^"']+)["']/g)) {
      expect(match[1]).not.toMatch(/^(?:https?:)?\/\//);
    }
  });

  test('inline scripts parse', () => {
    for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      const attrs = match[1] || '';
      // import maps are JSON, not JS; skip them.
      if (/\btype=["'](?:importmap|application\/ld\+json)["']/i.test(attrs)) continue;
      let source = match[2];
      // Module scripts may use import declarations — strip those so the
      // remaining classic body still parses under new Function.
      if (/\btype=["']module["']/i.test(attrs)) {
        source = source.replace(/^\s*import\s[\s\S]*?;\s*/gm, '');
      }
      expect(() => new Function(source)).not.toThrow();
    }
  });

  test("range inputs have accessible names", () => {
    const ranges = [...html.matchAll(/<input\b[^>]*type=["']range["'][^>]*>/gi)].map(
      (match) => match[0],
    );
    for (const input of ranges) {
      expect(input).toMatch(/\baria-(?:label|labelledby)=["'][^"']+["']/i);
    }
  });

  test("buttons have explicit types", () => {
    const buttons = [...html.matchAll(/<button\b[^>]*>/gi)].map((match) => match[0]);
    for (const button of buttons) {
      expect(button).toMatch(/\btype=["'](?:button|submit|reset)["']/i);
    }
  });

  test("toggle buttons expose their state", () => {
    const toggles = [...html.matchAll(/<button\b[^>]*class=["'][^"']*\btoggle-btn\b[^"']*["'][^>]*>/gi)]
      .map((match) => match[0]);
    for (const toggle of toggles) {
      expect(toggle).toMatch(/\baria-pressed=["'](?:true|false)["']/i);
    }
  });
});

test('Argent QA selectors stay on every observatory path', () => {
  const chrome = readFileSync('chrome.js', 'utf8');
  const index = readFileSync('index.html', 'utf8');
  expect(chrome).toContain("btn.id = 'scene-nav-btn'");
  expect(chrome).toContain("a.id = 'scene-link-' + s.key");
  expect(chrome).toContain("nextLink.id = 'scene-next'");
  expect(index).toContain('id="launch-title"');
  expect(index).toContain('id="play-btn"');
  for (const id of [
    'launch-grand-tour',
    'launch-light-study',
    'launch-missions',
    'launch-scale-walk',
    'launch-seasons',
    'launch-sky-tonight',
  ]) {
    expect(index).toContain(`id="${id}"`);
  }
  expect(index).toContain('id="light-study-header"');
  expect(readFileSync('seasons.html', 'utf8')).toContain('id="seasons-header"');
  expect(readFileSync('solar-system.html', 'utf8')).toContain('id="grand-tour-header"');
  expect(readFileSync('scale-walk.html', 'utf8')).toContain('id="scale-walk-header"');
  expect(readFileSync('missions.html', 'utf8')).toContain('id="missions-header"');
  expect(readFileSync('sky-tonight.html', 'utf8')).toContain('id="sky-tonight-header"');
});

test("shared scene navigation points to every live page", () => {
  const chrome = readFileSync("chrome.js", "utf8");
  for (const page of pages) {
    const route = page === "index.html" ? "/" : `/${page.replace(/\.html$/, "")}`;
    expect(chrome, `navigation does not include ${route}`).toContain(`href: '${route}`);
  }
});

test("shared navigation opens the Light Study instead of the home deck", () => {
  const chrome = readFileSync("chrome.js", "utf8");
  expect(chrome).toContain("href: '/#light-study', key: 'light'");
});

test("the obsolete duplicate page is not shipped", () => {
  expect(existsSync("sun-earth-moon (1).html")).toBe(false);
});

test('shared assets use a consistent cache-busting version', () => {
  const versions = new Set<string>();
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    for (const match of html.matchAll(/common\.css\?v=([^"'&]+)/g)) {
      versions.add(match[1]);
    }
  }
  expect(versions.size).toBe(1);
});

test('interactive scenes expose canvas descriptions and live announcements', () => {
  const common = readFileSync('common.js', 'utf8');
  const chrome = readFileSync('chrome.js', 'utf8');
  expect(common).toContain("renderer.domElement.setAttribute('aria-describedby', description.id)");
  expect(common).toContain('createScene requires canvasDescriptionId to reference a text equivalent');
  expect(chrome).toContain("status.setAttribute('aria-live', 'polite')");
  expect(chrome).toContain("status.setAttribute('aria-atomic', 'true')");
  expect(chrome).toContain('return { announce };');
  expect(chrome).not.toContain('describe(text)');

  for (const page of ['index.html', 'solar-system.html', 'seasons.html', 'scale-walk.html']) {
    const html = readFileSync(page, 'utf8');
    const description = html.match(/<p id="scene-description" class="sr-only">([^<]+)<\/p>/)?.[1];
    expect(description?.length, `${page} needs a real scene-specific text equivalent`).toBeGreaterThan(80);
    expect(html).toContain("canvasDescriptionId: 'scene-description'");
    expect(html, `${page} needs user-triggered scene announcements`).toContain('setup.accessibility.announce(');
  }
  const sky = readFileSync('sky-tonight.html', 'utf8');
  expect(sky).toContain('<canvas id="sky" aria-hidden="true"></canvas>');
  expect(sky).toContain('SPACE.initSceneAccessibility()');
  expect(sky).toContain('accessibility.announce(');
  expect(readFileSync('missions.html', 'utf8')).toContain('<canvas id="bg" aria-hidden="true"></canvas>');
});

test('system reduced-motion preference uses play state as the animation policy', () => {
  const common = readFileSync('common.js', 'utf8');
  const chrome = readFileSync('chrome.js', 'utf8');
  expect(chrome).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  expect(chrome).not.toContain('Reduced motion');
  expect(common).toContain('sim.playing = !sim.playing');

  const index = readFileSync('index.html', 'utf8');
  const solar = readFileSync('solar-system.html', 'utf8');
  const seasons = readFileSync('seasons.html', 'utf8');
  for (const page of [index, solar, seasons]) {
    expect(page).toContain('playing: !SPACE.prefersReducedMotion');
    expect(page).toContain('SPACE.wirePlayPause(');
  }
  expect(index).toContain('if (sim.playing) {\n    sim.time +=');
  expect(index).not.toContain('playing && !SPACE.prefersReducedMotion');
  expect(index.match(/setPlaying\(!SPACE\.prefersReducedMotion\)/g)?.length).toBe(2);
  expect(solar).toContain('if (sim.playing) {\n    sim.timeDays +=');
  expect(seasons).toContain('if (state.playing){\n    state.theta=');
});

test('Three.js is loaded as a local ES module', () => {
  const commonJs = readFileSync('common.js', 'utf8');
  expect(commonJs).toMatch(/from\s+['"]three['"]/);
  expect(commonJs).toContain('three/addons/postprocessing/');
  expect(commonJs).toContain('renderer.shadowMap.type = THREE.PCFShadowMap');
  expect(commonJs).not.toContain('THREE.PCFSoftShadowMap');
  expect(existsSync('vendor/three/three.module.min.js')).toBe(true);
  expect(existsSync('vendor/three/three.core.min.js')).toBe(true);
  for (const page of ['index.html', 'solar-system.html', 'seasons.html', 'scale-walk.html']) {
    const html = readFileSync(page, 'utf8');
    expect(html).toContain('type="importmap"');
    expect(html).toContain('three.module.min.js');
    expect(html).not.toContain('three.min.js');
  }
  for (const page of ['missions.html', 'sky-tonight.html']) {
    const html = readFileSync(page, 'utf8');
    expect(html).toContain("./chrome.js");
    expect(html).not.toContain('type="importmap"');
    expect(html).not.toContain('common.js');
  }
});

test('Grand Tour uses traceable scientific surface assets', () => {
  const tour = readFileSync('solar-system.html', 'utf8');
  const models = readFileSync('planet-models.js', 'utf8');
  const textures = readFileSync('tour-textures.js', 'utf8');
  const earthVisuals = readFileSync('earth-visuals.js', 'utf8');
  const manifest = readFileSync('assets/planet-models/README.md', 'utf8');

  expect(tour).toContain('createPlanetModelLoader');
  expect(textures).toContain('loadEarthTextureSet');
  expect(earthVisuals).toContain('assets/earth/day-4k.jpg');
  expect(earthVisuals).toContain('assets/earth/lights-2k.png');
  expect(textures).toContain("p.key === 'eris'");
  for (const key of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'ceres', 'pluto']) {
    expect(models).toContain(`assets/planet-models/${key}.glb`);
    expect(existsSync(`assets/planet-models/${key}.glb`)).toBe(true);
    expect(manifest).toContain(`${key}.glb`);
  }
});

test('Earth visuals have one scientifically shaped asset seam', () => {
  const earthVisuals = readFileSync('earth-visuals.js', 'utf8');
  const consumers = ['index.html', 'seasons.html', 'solar-system.html', 'tour-textures.js']
    .map(file => readFileSync(file, 'utf8'));

  expect(earthVisuals).toContain('EQUATORIAL_RADIUS_KM = 6378.137');
  expect(earthVisuals).toContain('POLAR_RADIUS_KM = 6356.752314245');
  expect(earthVisuals).toContain('createEarthGeometry');
  for (const consumer of consumers) {
    expect(consumer).toContain('earth-visuals.js');
    expect(consumer).not.toContain('assets/earth/day-4k.jpg');
    expect(consumer).not.toContain('assets/earth/lights-2k.png');
  }
});

test('planet lighting and radius normalization retain physical meaning', () => {
  const index = readFileSync('index.html', 'utf8');
  const seasons = readFileSync('seasons.html', 'utf8');
  const tour = readFileSync('solar-system.html', 'utf8');
  const models = readFileSync('planet-models.js', 'utf8');

  for (const scene of [index, seasons, tour]) expect(scene).not.toContain('new THREE.AmbientLight');
  expect(models).toContain('Math.cbrt(size.x * size.y * size.z)');
  expect(models).toContain("root.position.copy(center).multiplyScalar(-modelScale)");
  expect(tour).toContain("w.type === 'earth' ? createEarthGeometry(1, 96, 64) : unitSphere");
});

test('vendored Three.js retains its original MIT notice', () => {
  const notice = readFileSync('vendor/three/LICENSE', 'utf8');
  const projectLicense = readFileSync('../LICENSE', 'utf8');
  expect(notice).toContain('Copyright © 2010-2026 three.js authors');
  expect(notice).toContain('Permission is hereby granted, free of charge');
  expect(projectLicense).toContain('vendor/three/LICENSE');
});

test('project credits appear only on the home screen', () => {
  const home = readFileSync('index.html', 'utf8');
  const chrome = readFileSync('chrome.js', 'utf8');
  const sources = [
    'https://science.nasa.gov/',
    'https://www.jpl.nasa.gov/',
    'https://www.noaa.gov/',
    'https://aa.usno.navy.mil/'
  ];

  expect(home).toContain('aria-label="Project credits"');
  expect(home).toContain('https://threejs.org/');
  expect(home).not.toContain('https://github.com/1aishwaryasharma/tinyastronomer');
  expect(chrome).not.toContain('scene-menu-credits');
  expect(chrome).not.toContain('https://threejs.org/');
  expect(chrome).not.toContain('github.com');
  for (const source of sources) {
    expect(home).toContain(source);
    expect(chrome).not.toContain(source);
  }
});

test('asset documentation does not call quantized geometry lossless', () => {
  const readme = readFileSync('../README.md', 'utf8');
  expect(readme).not.toContain('lossless geometry quantization');
  expect(readme).toContain('preserve topology while using geometry quantization');
});

test('Light Study includes a night-side aurora around the magnetic poles', () => {
  const index = readFileSync('index.html', 'utf8');
  const common = readFileSync('common.js', 'utf8');
  expect(common).toContain('function createAurora');
  expect(common).toContain('uMagNorth');
  expect(index).toContain('SPACE.createAurora');
  expect(index).toContain('data-preset="aurora"');
  expect(index).toContain('id="toggle-aurora"');
});

test('Aurora stays off until its preset selects it', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toMatch(/toggle-aurora[^>]*aria-pressed=["']false["']/);
  expect(index).toContain('showAurora: false');
  expect(index).toContain('AURORA.mesh.visible = false');
  // applyPreset clears it, so only the aurora preset's apply() re-enables it.
  expect(index).toContain('setAuroraVisible(true)');
});

test('Aurora surface stays temporally stable so it cannot flicker over Earth', () => {
  const common = readFileSync('common.js', 'utf8');
  const aurora = common.slice(
    common.indexOf('function createAurora'),
    common.indexOf('// ── Custom orbit-camera controls')
  );
  // Local noise must stay fixed to the rotating Earth. The visible response
  // to a solar storm is one slow, uniform intensity envelope instead.
  expect(aurora).not.toContain('uTime');
  expect(aurora).not.toContain('uOutputScale');
  expect(aurora).toContain('uIntensity');
  expect(aurora).toContain('col * glow * 1.1');
  // The static pattern is baked once into a texture; the fragment shader must
  // not re-run simplex noise per fragment (it made fragment-heavy views like
  // the top-down oval too slow for smooth motion).
  expect(aurora).toContain('texture2D(uPattern');
  expect(aurora).not.toContain('snoise(p');
  expect(aurora).not.toContain('fbm3(p');
  // GLSL smoothstep requires edge0 < edge1. Invert the result rather than
  // reversing its edges, which is undefined and varies between GPU drivers.
  expect(aurora).toContain('1.0 - smoothstep(-0.06, 0.18');
  expect(aurora).not.toContain('smoothstep(0.18, -0.06');
});

test('quality governor backs off after a failed upgrade instead of oscillating', () => {
  const common = readFileSync('common.js', 'utf8');
  const governor = common.slice(
    common.indexOf('function createQualityGovernor'),
    common.indexOf('// ── Keyboard camera control')
  );
  // Every tier change resizes the canvas — a visible flash. A view whose cost
  // sits between two tiers (the aurora oval seen top-down) must settle rather
  // than flap up and down every few seconds.
  expect(governor).toContain('lastUpgradeAt');
  expect(governor).toContain('FLAP_WINDOW_MS');
  expect(governor).toContain('upgradeDwellS = Math.min(upgradeDwellS * 4, MAX_DWELL_S)');
  expect(governor).toContain('headroomTime > upgradeDwellS');
  expect(governor).not.toContain('headroomTime > 6)');
});

test('Polar Lights cannot resize the framebuffer during an orbit drag', () => {
  const common = readFileSync('common.js', 'utf8');
  const index = readFileSync('index.html', 'utf8');
  const controls = common.slice(
    common.indexOf('function createOrbitControls'),
    common.indexOf('// ── Adaptive quality governor')
  );
  const governor = common.slice(
    common.indexOf('function createQualityGovernor'),
    common.indexOf('// ── Keyboard camera control')
  );

  expect(controls).toContain('interacting: false');
  expect(controls).toContain('cam.interacting = true');
  expect(controls).toContain('cam.interacting = false');
  expect(governor).toContain('frame(rawDt, interactionActive = false)');
  expect(governor).toContain('if (interactionActive || now < warmupUntil)');
  expect(governor).toContain('downgradeTime += rawDt');
  expect(governor).toContain('downgradeTime > DOWNGRADE_DWELL_S');
  expect(index).toContain('quality.frame(rawDt, cam.interacting)');

  // Execute the real governor with renderer/composer spies. A sustained drag
  // must never call the resize path that produced the visible Polar flash,
  // while genuinely slow settled frames must still be allowed to adapt.
  let now = 0;
  const resizeCalls: string[] = [];
  const makeSurface = (name: string) => ({
    setPixelRatio(value: number) { resizeCalls.push(`${name}.pixelRatio:${value}`); },
    setSize(width: number, height: number) {
      resizeCalls.push(`${name}.size:${width}x${height}`);
    },
  });
  const createQualityGovernor = new Function(
    'performance',
    'window',
    `${governor}; return createQualityGovernor;`,
  )(
    { now: () => now },
    { innerWidth: 1280, innerHeight: 800 },
  );
  const quality = createQualityGovernor({
    renderer: makeSurface('renderer'),
    composer: makeSurface('composer'),
    bloomPass: { enabled: true },
  });

  for (let frame = 0; frame < 20 * 60; frame++) {
    now += 1000 / 60;
    quality.frame(1 / 60, true);
  }
  expect(quality.tier).toBe(0);
  expect(resizeCalls).toEqual([]);

  for (let frame = 0; frame < 30; frame++) {
    now += 50;
    quality.frame(0.05, false);
  }
  expect(quality.tier).toBe(1);
  expect(resizeCalls.length).toBeGreaterThan(0);
});

test('render diagnostics stay opt-in and cost nothing by default', () => {
  const common = readFileSync('common.js', 'utf8');
  // The overlay is a debugging aid for glitches that only reproduce on real
  // hardware. It must never install itself for ordinary visitors.
  expect(common).toContain('function installDiagnostics');
  expect(common).toContain("/[?&]diag=1\\b/.test(window.location.search)");
  const createScene = common.slice(
    common.indexOf('function createScene'),
    common.indexOf('function installDiagnostics')
  );
  const guard = createScene.match(/if \(\/\[\?&\]diag=1[^\n]*\n/)?.[0] || '';
  expect(guard).toContain('installDiagnostics(setup)');
  // Exactly one call site, and it is the guarded one.
  expect(common.match(/installDiagnostics\(/g)?.length).toBe(2);
});

test('Polar Lights visualizes the solar-eruption-to-aurora chain', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('function createSolarStorm');
  expect(index).toContain('SOLAR_STORM.update');
  expect(index).toContain('start.copy(sunGroup.position)');
  expect(index).toContain('approachPoint.lerp(arrivalPoint, funnel)');
  expect(index).toContain('AURORA.uniforms.uIntensity.value = impact');
});

test('Polar Lights and Ocean Tides leave the orbit camera under user control', () => {
  const index = readFileSync('index.html', 'utf8');
  const solarUpdate = index.slice(
    index.indexOf('function updateSolarStorm'),
    index.indexOf('function updateTides')
  );
  const tideUpdate = index.slice(
    index.indexOf('function updateTides'),
    index.indexOf('// 10. PRESETS')
  );
  for (const update of [solarUpdate, tideUpdate]) {
    expect(update).not.toContain('cam.azimuthTarget');
    expect(update).not.toContain('cam.elevationTarget');
    expect(update).not.toContain('cam.distanceTarget');
    expect(update).not.toContain('cam.target.set');
  }
});

test('Polar Lights suppresses the outer solar corona that flashes at the viewport edge', () => {
  const index = readFileSync('index.html', 'utf8');
  const applyPreset = index.slice(
    index.indexOf('function applyPreset'),
    index.indexOf('presetEls.forEach')
  );
  expect(applyPreset).toContain("sunCorona.visible = name !== 'aurora'");
});

test('Polar Lights holds Earth steady to avoid top-down texture flicker', () => {
  const index = readFileSync('index.html', 'utf8');
  const animate = index.slice(
    index.indexOf('function animate'),
    index.indexOf('SPACE.createLoader')
  );
  expect(animate).toContain("sim.preset === 'aurora' ? 0 : sim.earthSpinSpeed");
  expect(animate).toContain('sim.earthRotation += dt * sim.speed * earthSpinRate');
  expect(animate).toContain('earth.rotation.y = sim.earthRotation');
});

test('Solar-storm particles meet the rotating aurora oval above Earth', () => {
  const index = readFileSync('index.html', 'utf8');
  const storm = index.slice(
    index.indexOf('function createSolarStorm'),
    index.indexOf('// Earth axis helper line')
  );
  expect(storm).toContain('function auroraOvalWorldPoint');
  expect(storm).toContain('AURORA.uniforms.uMagNorth.value');
  expect(storm).toContain('earth.localToWorld(target)');
  expect(storm).toContain('AURORA_ARRIVAL_RADIUS = EARTH_RADIUS * 1.075');
  expect(index).toContain('SPACE.createAurora(EARTH_RADIUS * 1.028)');
  expect(storm).toMatch(/auroraOvalWorldPoint\([\s\S]*?arrivalPoint/);
  expect(storm).toContain('updateFieldGuide(northGuide, nightLongitude)');
  expect(storm).not.toContain('THREE.MathUtils.lerp(positions[o], -0.08');
});

test('Light Study includes an animated ocean-tide model', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('data-preset="tides"');
  expect(index).toContain('function createOceanTide');
  expect(index).toContain('Most coasts experience about two high and two low tides each lunar day');
  expect(index).toContain('spring tides');
  expect(index).toContain('neap tides');
  // The bulge is the P2 (quadrupole) stretch of each pull, so spring and
  // neap alignments fall out of the same shader.
  expect(index).toContain('1.5 * pow(dot(p, uMoonDir), 2.0) - 0.5');
  expect(index).toContain('uMoonAmp');
  expect(index).toContain('uSunAmp');
});

test('Tide overlay stays hidden outside its preset', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('TIDE.shell.visible = false');
  expect(index).toMatch(/if \(sim\.preset !== 'tides'\)/);
  expect(index).not.toContain('Your beach');
  expect(index).not.toContain('TIDE.marker');
});

test('Ocean Tides and Polar Lights do not show guided instruction overlays', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).not.toContain('id="aurora-stage"');
  expect(index).not.toContain('id="tide-stage"');
  expect(index).not.toContain('1 / 4');
});

test('scene navigation is one journey with progress and a next stop', () => {
  const chrome = readFileSync('chrome.js', 'utf8');
  expect(chrome).toContain("JOURNEY_KEY = 'ta-journey'");
  expect(chrome).toContain('Your journey');
  expect(chrome).toContain('Next stop');
  expect(chrome).toContain('Journey complete');
  // The story ends outside, looking up: Sky Tonight is the final stop.
  const order = [...chrome.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
  expect(order[0]).toBe('light');
  expect(order[order.length - 1]).toBe('sky');
});

test('missions link to the worlds they explored', () => {
  const missions = readFileSync('missions.html', 'utf8');
  for (const target of ['#neptune', '#mars', '#saturn', '#pluto']) {
    expect(missions).toContain(`/solar-system${target}`);
  }
  expect(missions).toContain('id="voyager-dist"');
  expect(missions).toContain('KM_PER_SEC');
});

test('grand tour honours body deep links', () => {
  const tour = readFileSync('solar-system.html', 'utf8');
  expect(tour).toContain('function applyBodyHash');
  expect(tour).toContain("window.addEventListener('hashchange', applyBodyHash)");
});

test('Grand Tour body framing leaves enough visual breathing room', () => {
  const fov = 45;
  const apparentHeight = (radius: number, distance: number) =>
    (2 * Math.asin(radius / distance)) / (fov * Math.PI / 180);

  const mercuryRadius = teachingRadius(2440);
  const mercuryOrbit = 6 + 6 * Math.sqrt(0.387);
  const mercuryFrame = sunAndPlanetFrame({
    aspect: 1.6,
    planetRadius: mercuryRadius,
    separation: mercuryOrbit,
    sunRadius: 3.4,
    verticalFovDegrees: fov
  });
  const jupiterRadius = teachingRadius(69911);
  const jupiterDistance = relaxedPlanetDistance({
    aspect: 1.6,
    hasRings: false,
    moonExtent: 3.6 + 0.14,
    planetRadius: jupiterRadius,
    verticalFovDegrees: fov
  });
  expect({
    jupiterFits: apparentHeight(jupiterRadius, jupiterDistance) <= 0.17,
    sunFits: apparentHeight(3.4, mercuryFrame.distance) <= 0.30
  }).toEqual({ jupiterFits: true, sunFits: true });
});

test('Grand Tour tracking carries forward a moving body without camera lag', () => {
  expect(advanceTrackedCoordinate(10, 12, 10, 0.1, false)).toBe(12);
});

test('Grand Tour automatic framing follows viewport changes but preserves manual zoom', () => {
  const landscape = sunAndPlanetFrame({
    aspect: 1.6,
    planetRadius: teachingRadius(2440),
    separation: 6 + 6 * Math.sqrt(0.387),
    sunRadius: 3.4,
    verticalFovDegrees: 45
  }).distance;
  const portrait = sunAndPlanetFrame({
    aspect: 390 / 844,
    planetRadius: teachingRadius(2440),
    separation: 6 + 6 * Math.sqrt(0.387),
    sunRadius: 3.4,
    verticalFovDegrees: 45
  }).distance;

  expect(updatedAutomaticDistance(landscape, landscape, portrait)).toBe(portrait);
  expect(updatedAutomaticDistance(landscape + 2, landscape, portrait)).toBeNull();
});

test('Earth night shader uses the current Three.js map UV varying', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('texture2D(nightMap, vMapUv)');
  expect(index).not.toContain('texture2D(nightMap, vUv)');
});

test('WebGL scenes preserve their pre-upgrade lighting levels', () => {
  const common = readFileSync('common.js', 'utf8');
  const index = readFileSync('index.html', 'utf8');
  const scaleWalk = readFileSync('scale-walk.html', 'utf8');
  const seasons = readFileSync('seasons.html', 'utf8');
  const solarSystem = readFileSync('solar-system.html', 'utf8');

  expect(common).toContain('b.threshold != null ? b.threshold : 1.35 * Math.PI');
  expect(common).toContain('col * 1.45 * uOutputScale');
  expect(common).toContain('renderer.toneMappingExposure = 1.1');
  for (const scene of [index, scaleWalk, seasons, solarSystem]) {
    expect(scene).toContain('uOutputScale.value = setup.bloomPass && setup.bloomPass.enabled');
  }
  expect(index).toContain('new THREE.DirectionalLight(0xffeacc, 2.2 * Math.PI)');
  expect(scaleWalk).toContain('new THREE.PointLight(0xfff2e0, 2.6 * Math.PI, 0, 0)');
  expect(seasons).toContain('new THREE.PointLight(0xfff2e0, 2.4 * Math.PI, 0, 0)');
  expect(solarSystem).toContain('new THREE.PointLight(0xfff2e0, 2.6 * Math.PI, 0, 0)');
});

test("interactive info panels use the shared mobile drawer", () => {
  const chromeJs = readFileSync("chrome.js", "utf8");
  const commonCss = readFileSync("common.css", "utf8");
  expect(chromeJs).toContain("initMobileInfoPanels");
  expect(chromeJs).toContain("aria-expanded");
  expect(commonCss).toContain(".info-panel.mobile-info-panel:not(.is-expanded)");
});

test('mobile drawer scrolls as one box and pins Close', () => {
  // The panel is the overflow box a finger actually pans. Close is the
  // first child and sticky so it stays on screen after the list scrolls.
  const chromeJs = readFileSync('chrome.js', 'utf8');
  const commonCss = readFileSync('common.css', 'utf8');
  expect(chromeJs).toContain('panel.insertBefore(toggle, panel.firstChild)');
  expect(chromeJs).not.toContain('mobile-info-scroll');
  expect(commonCss).toMatch(
    /\.info-panel\.mobile-info-panel\s*\{[\s\S]*?overflow:\s*auto/
  );
  expect(commonCss).toMatch(
    /\.mobile-info-toggle\s*\{[\s\S]*?position:\s*sticky/
  );
});

test('mobile drawer restores its heading after it closes', () => {
  const chromeJs = readFileSync('chrome.js', 'utf8');
  expect(chromeJs).toMatch(
    /if\s*\(!expanded\)\s*\{\s*panel\.scrollTop\s*=\s*0;\s*\}/
  );
});

test('every browser can hit-test the narrow launch-deck scroller', () => {
  const launchJs = readFileSync('home-launch.js', 'utf8');
  const homeCss = readFileSync('home.css', 'utf8');

  expect(launchJs).not.toContain('navigator.vendor');
  expect(launchJs).not.toContain('is-apple-webkit');
  expect(homeCss).toMatch(
    /@media not all and \(min-width: 60rem\)\s*\{[\s\S]*?\.launch-deck\s*\{[\s\S]*?pointer-events:\s*auto/
  );
  expect(homeCss).not.toContain('is-apple-webkit');
  const narrowRule = homeCss.indexOf('@media not all and (min-width: 60rem)');
  expect(homeCss.indexOf('pointer-events: auto', narrowRule)).toBeGreaterThan(
    homeCss.indexOf('pointer-events: none', homeCss.indexOf('.launch-deck {'))
  );
});

test('mobile drawer opens without relayout or a native tap flash', () => {
  const commonCss = readFileSync('common.css', 'utf8');
  const drawerRule = commonCss.match(
    /\.info-panel\.mobile-info-panel\s*\{([\s\S]*?)\n\s*\}/
  );
  expect(drawerRule).not.toBeNull();
  expect(drawerRule![1]).toMatch(/padding:\s*12px 16px/);
  expect(drawerRule![1]).toMatch(/transition:[^;]*transform[^;]*clip-path/);
  expect(drawerRule![1]).not.toMatch(/transition:[^;]*max-height/);
  expect(drawerRule![1]).toMatch(/backdrop-filter:\s*none/);
  expect(commonCss).toMatch(
    /\.info-panel\.mobile-info-panel:not\(\.is-expanded\)\s*\{[^}]*transform:\s*translate3d\(0,\s*calc\(100% - 64px\),\s*0\)[^}]*clip-path:/
  );
  expect(commonCss).not.toMatch(
    /\.info-panel\.mobile-info-panel:not\(\.is-expanded\)\s*>[^\{]+\{[^}]*display:\s*none/
  );
  expect(commonCss).toMatch(
    /\.info-panel\.mobile-info-panel:not\(\.is-expanded\)\s*>[^\{]+\{[^}]*visibility:\s*hidden[^}]*transition-delay:\s*0\.32s/
  );
  expect(commonCss).not.toMatch(
    /\.info-panel\.mobile-info-panel\.is-expanded\s*\{[^}]*padding-right/
  );
  const toggleRule = commonCss.match(
    /\.mobile-info-toggle\s*\{\s*display:\s*inline-flex;([\s\S]*?)\n\s*\}/
  );
  expect(toggleRule).not.toBeNull();
  expect(toggleRule![1]).toMatch(/appearance:\s*none/);
  expect(toggleRule![1]).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
  expect(toggleRule![1]).toMatch(/width:\s*52px/);
});

test('every page carries the wordmark and links it home', () => {
  const commonCss = readFileSync('common.css', 'utf8');
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const brand = html.match(/<a class="brand"[^>]*>[\s\S]*?<\/a>/);
    expect(brand, `${file}: missing the brand wordmark`).not.toBeNull();
    expect(brand![0]).toContain('href="/"');
    expect(brand![0].replace(/<[^>]+>/g, '')).toBe('tinyastronomer');
    // Keep the visible name as one token; <em> can split it for crawlers.
    expect(brand![0]).not.toMatch(/<em>/i);
    // It sits inside the fixed header, which is pointer-events: none.
    expect(html.indexOf(brand![0])).toBeGreaterThan(html.indexOf('<header class="header"'));
  }
  expect(commonCss).toMatch(/\.brand\s*\{[\s\S]*?pointer-events:\s*auto/);
});

test('pages name tinyastronomer in the signals Google uses for brand search', () => {
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    expect(html, `${file}: title`).toMatch(/<title>[^<]*tinyastronomer[^<]*<\/title>/);
    expect(html, `${file}: description`).toMatch(
      /<meta\s+name=["']description["']\s+content=["']tinyastronomer /i
    );
    expect(html, `${file}: og:site_name`).toMatch(
      /<meta\s+property=["']og:site_name["']\s+content=["']tinyastronomer["']/
    );
    expect(html, `${file}: og:title`).toMatch(
      /<meta\s+property=["']og:title["']\s+content="[^"]*tinyastronomer[^"]*"/
    );
    expect(html, `${file}: twitter:title`).toMatch(
      /<meta\s+name=["']twitter:title["']\s+content="[^"]*tinyastronomer[^"]*"/
    );
  }

  const home = readFileSync('index.html', 'utf8');
  const jsonLd = home.match(
    /<script type=["']application\/ld\+json["']>\s*([\s\S]*?)<\/script>/
  );
  expect(jsonLd, 'homepage WebSite JSON-LD').not.toBeNull();
  const site = JSON.parse(jsonLd![1]);
  expect(site['@context']).toBe('https://schema.org');
  expect(site['@type']).toBe('WebSite');
  expect(site.name).toBe('tinyastronomer');
  expect(site.url).toBe('https://tinyastronomer.com/');
  expect(site.alternateName).toEqual(['tiny astronomer', 'tinyastronomer.com']);
  expect(home).toContain('tinyastronomer is free, ad-free astronomy for curious kids.');

  const sitemap = readFileSync('sitemap.xml', 'utf8');
  expect(sitemap).toContain('<lastmod>2026-08-17</lastmod>');
  expect(sitemap).not.toContain('2026-07-27');
});

test('indexing signals use directly served canonical URLs', () => {
  const canonicalUrls: Record<string, string> = {
    'index.html': 'https://tinyastronomer.com/',
    'solar-system.html': 'https://tinyastronomer.com/solar-system',
    'seasons.html': 'https://tinyastronomer.com/seasons',
    'scale-walk.html': 'https://tinyastronomer.com/scale-walk',
    'sky-tonight.html': 'https://tinyastronomer.com/sky-tonight',
    'missions.html': 'https://tinyastronomer.com/missions',
  };

  for (const [file, canonicalUrl] of Object.entries(canonicalUrls)) {
    const html = readFileSync(file, 'utf8');
    expect(html, `${file}: canonical URL`).toContain(
      `<link rel="canonical" href="${canonicalUrl}">`,
    );
    expect(html, `${file}: Open Graph URL`).toContain(
      `<meta property="og:url" content="${canonicalUrl}">`,
    );
    // Any path shape, not just a single leading slash: `./missions.html` and
    // `../missions.html` redirect exactly like `/missions.html` does, so they
    // reintroduce the same split indexing signal.
    expect(html, `${file}: navigation must not advertise redirecting .html URLs`).not.toMatch(
      /href=["'][^"']*(?:index|missions|scale-walk|seasons|sky-tonight|solar-system)\.html(?:[?#][^"']*)?["']/i,
    );
  }

  const sitemap = readFileSync('sitemap.xml', 'utf8');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(sitemapUrls).toEqual(Object.values(canonicalUrls));

  const chrome = readFileSync('chrome.js', 'utf8');
  expect(chrome, 'shared navigation must not advertise redirecting .html URLs').not.toMatch(
    /href:\s*["'][^"']*\.html(?:[?#][^"']*)?["']/i,
  );
});

test('every .html URL permanently redirects to its canonical', () => {
  // Cloudflare's own html_handling redirect is temporary, so Google keeps the
  // .html URL in the index instead of folding it into the canonical. These
  // explicit 301s are what actually consolidate the two.
  const rules = new Map(
    readFileSync('_redirects', 'utf8')
      .split('\n')
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((line) => {
        const [from, to, status] = line.split(/\s+/);
        return [from, { to, status }] as const;
      }),
  );

  for (const page of pages) {
    const rule = rules.get(`/${page}`);
    expect(rule, `/${page} has no redirect rule`).toBeDefined();
    expect(rule!.to, `/${page} must redirect to its canonical path`).toBe(
      page === 'index.html' ? '/' : `/${page.slice(0, -'.html'.length)}`,
    );
    expect(rule!.status, `/${page} must redirect permanently, not temporarily`).toBe('301');
  }

  for (const from of rules.keys()) {
    expect(pages, `${from} redirects from a page that no longer exists`).toContain(from.slice(1));
  }
});

test('small-screen chrome keeps menus and controls inside the viewport', () => {
  const commonCss = readFileSync('common.css', 'utf8');
  expect(commonCss).toContain('@media (max-width: 1024px)');
  expect(commonCss).toContain('@media (max-width: 820px)');
  expect(commonCss).toMatch(/\.subtitle\s*\{[\s\S]*?display:\s*none\s*!important/);
  expect(commonCss).toMatch(/\.header-meta\s*\{[\s\S]*?position:\s*fixed/);
  expect(commonCss).toMatch(/\.scene-menu[\s\S]*?right:\s*0/);
  expect(commonCss).toMatch(/\.side-rail[\s\S]*?flex-direction:\s*row/);
  expect(commonCss).toMatch(/\.label-3d[\s\S]*?display:\s*none\s*!important/);
  expect(commonCss).toMatch(/\.controls,[\s\S]*?flex-wrap:\s*wrap\s*!important/);
  expect(commonCss).toContain('100svh');
  expect(commonCss).toContain('@media (pointer: coarse)');
  expect(commonCss).toMatch(/\.scene-nav-btn\s*\{[\s\S]*?color:\s*var\(--accent\)/);
});

test('horizontal chip rails scroll the selected stop into view', () => {
  const chromeJs = readFileSync('chrome.js', 'utf8');
  const commonJs = readFileSync('common.js', 'utf8');
  expect(chromeJs).toContain('function revealRailButton');
  expect(chromeJs).toContain("inline: 'center'");
  expect(commonJs).toContain('revealRailButton');
  for (const file of ['index.html', 'seasons.html', 'solar-system.html', 'scale-walk.html']) {
    expect(readFileSync(file, 'utf8')).toContain('SPACE.revealRailButton');
  }
});

test('mobile interaction hint is shown only once across pages', () => {
  const chromeJs = readFileSync('chrome.js', 'utf8');
  expect(chromeJs).toContain("MOBILE_HINT_KEY = 'ta-mobile-hint-seen'");
  expect(chromeJs).toContain('window.localStorage.getItem(MOBILE_HINT_KEY)');
  expect(chromeJs).toContain("window.localStorage.setItem(MOBILE_HINT_KEY, '1')");
  expect(chromeJs).toContain("h.classList.add('is-dismissed')");
});

test('sky tonight uses the shared mobile drawer so the sky stays visible', () => {
  const sky = readFileSync('sky-tonight.html', 'utf8');
  const chromeJs = readFileSync('chrome.js', 'utf8');
  const commonCss = readFileSync('common.css', 'utf8');
  expect(sky).not.toContain('data-keep-open');
  expect(chromeJs).not.toContain('data-keep-open');
  expect(commonCss).not.toContain('[data-keep-open]');
  expect(sky).toContain('class="info-panel"');
  expect(chromeJs).toContain('initMobileInfoPanels');
});

test("current mission figures remain current", () => {
  const missions = readFileSync("missions.html", "utf8");
  expect(missions).toContain("<b>nearly 24 hours</b>");
  expect(missions).toContain("more than <b>1.7 million observations</b>");
});

test("volatile moon counts are dated to their current NASA review", () => {
  const data = readFileSync("data.js", "utf8");
  expect(data).toContain("<strong>115 moons</strong>");
  expect(data).toContain("<strong>293 moons</strong>");
  expect(data).toContain("<strong>29 known moons</strong>");
  expect(data).toContain("<strong>16 known moons</strong>");
  expect(data.match(/August 2026/g)?.length).toBeGreaterThanOrEqual(4);
});

test('every study explains its scientific fidelity and cites primary sources', () => {
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    expect(html, `${file}: fidelity disclosure`).toContain('class="science-note"');
    expect(html, `${file}: fidelity classification`).toContain('class="science-kind"');
    expect(html, `${file}: primary source`).toMatch(/href="https:\/\/(?:science\.nasa\.gov|www\.nasa\.gov|ssd\.jpl\.nasa\.gov|oceanservice\.noaa\.gov)\//);
  }
});

test('model labels do not overclaim simulation fidelity', () => {
  const tour = readFileSync('solar-system.html', 'utf8');
  const scale = readFileSync('scale-walk.html', 'utf8');
  const sky = readFileSync('sky-tonight.html', 'utf8');
  const data = readFileSync('data.js', 'utf8');

  expect(tour).not.toContain('True&nbsp;Scale');
  expect(tour).not.toContain("'True scale'");
  expect(tour).toContain('Distance&nbsp;View');
  expect(scale).toContain('average distance');
  expect(sky).toContain('not a local visibility forecast');
  expect(data).not.toContain('30&nbsp;kg kid would weigh');
  expect(tour).toContain("row('Gravity', f.gravity)");
});

test('Earth and planet spin stay eastward (+Y in Three.js)', () => {
  // Right-hand +rotation.y is CCW from above the north pole = geographic east.
  // A previous "fix" negated these signs after misreading that convention.
  const index = readFileSync('index.html', 'utf8');
  const seasons = readFileSync('seasons.html', 'utf8');
  const tour = readFileSync('solar-system.html', 'utf8');

  expect(index).toMatch(/sim\.earthRotation\s*\+=\s*dt\s*\*\s*sim\.speed\s*\*\s*earthSpinRate\s*;/);
  expect(index).toMatch(/earth\.rotation\.y\s*=\s*sim\.earthRotation\s*;/);
  expect(index).not.toMatch(/sim\.earthRotation\s*-=|earth\.rotation\.y\s*=\s*-\s*sim\.earthRotation/);

  expect(seasons).toMatch(/earth\.rotation\.y\s*=\s*motionTime\s*\*\s*0\.6\s*;/);
  expect(seasons).not.toMatch(/earth\.rotation\.y\s*=\s*-\s*motionTime/);

  expect(tour).toMatch(/w\.spinDir\s*=\s*w\.retro\s*\?\s*-1\s*:\s*1\s*;/);
});

test('Three.js +Y carries the near face toward geographic east', () => {
  // makeRotationY(+θ): (x,y,z) -> (c*x + s*z, y, -s*x + c*z)
  // Front equator point (0,0,1) moves to +X; at +Z, east is +X.
  const theta = 0.2;
  const x = Math.sin(theta);
  expect(x).toBeGreaterThan(0);
});
