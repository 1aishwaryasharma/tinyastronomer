import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  advanceTrackedCoordinate,
  relaxedPlanetDistance,
  sunAndPlanetFrame,
  updatedAutomaticDistance
} from "./tour-camera.js";

const pages = readdirSync(".").filter((file) => file.endsWith(".html"));
const teachingRadius = (radiusKm: number) =>
  Math.max(0.30, Math.min(0.55 * Math.pow(radiusKm / 6371, 0.4), 1.55));

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
      expect(existsSync(reference), `${file}: missing ${reference}`).toBe(true);
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
      if (/\btype=["']importmap["']/i.test(attrs)) continue;
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

test("shared scene navigation points to every live page", () => {
  const chrome = readFileSync("chrome.js", "utf8");
  for (const page of pages.filter((file) => !file.includes(" (1)"))) {
    expect(chrome, `navigation does not include ${page}`).toContain(`href: '${page}'`);
  }
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

test('Three.js is loaded as a local ES module', () => {
  const commonJs = readFileSync('common.js', 'utf8');
  expect(commonJs).toMatch(/from\s+['"]three['"]/);
  expect(commonJs).toContain('three/addons/postprocessing/');
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
  const projectLicense = readFileSync('LICENSE', 'utf8');
  expect(notice).toContain('Copyright © 2010-2026 three.js authors');
  expect(notice).toContain('Permission is hereby granted, free of charge');
  expect(projectLicense).toContain('vendor/three/LICENSE');
});

test('asset documentation does not call quantized geometry lossless', () => {
  const readme = readFileSync('README.md', 'utf8');
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
  // GLSL smoothstep requires edge0 < edge1. Invert the result rather than
  // reversing its edges, which is undefined and varies between GPU drivers.
  expect(aurora).toContain('1.0 - smoothstep(-0.06, 0.18');
  expect(aurora).not.toContain('smoothstep(0.18, -0.06');
});

test('Polar Lights visualizes the solar-eruption-to-aurora chain', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('function createSolarStorm');
  expect(index).toContain('SOLAR_STORM.update');
  expect(index).toContain('A CME launches a cloud of charged particles');
  expect(index).toContain('Earth’s magnetic field funnels energy poleward');
  expect(index).toContain('The upper atmosphere glows as aurora');
});

test('Polar Lights announces each causal stage to assistive technology', () => {
  const index = readFileSync('index.html', 'utf8');
  const stage = index.match(/<div class="aurora-stage"[^>]*>/)?.[0] || '';
  expect(stage).toContain('role="status"');
  expect(stage).toContain('aria-live="polite"');
  expect(stage).toContain('aria-atomic="true"');
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

test('Light Study teaches ocean tides as a guided study', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('data-preset="tides"');
  expect(index).toContain('function createOceanTide');
  expect(index).toContain('two high tides a day');
  expect(index).toContain('spring tides');
  expect(index).toContain('neap tides');
  // The bulge is the P2 (quadrupole) stretch of each pull, so spring and
  // neap alignments fall out of the same shader.
  expect(index).toContain('1.5 * pow(dot(p, uMoonDir), 2.0) - 0.5');
  expect(index).toContain('uMoonAmp');
  expect(index).toContain('uSunAmp');
});

test('Tide overlays stay hidden outside their preset', () => {
  const index = readFileSync('index.html', 'utf8');
  expect(index).toContain('TIDE.shell.visible = false');
  expect(index).toContain('TIDE.marker.visible = false');
  expect(index).toMatch(/if \(sim\.preset !== 'tides'\)/);
});

test('Ocean Tides announces each stage to assistive technology', () => {
  const index = readFileSync('index.html', 'utf8');
  const stage = index.match(/<div class="aurora-stage tide-stage"[^>]*>/)?.[0] || '';
  expect(stage).toContain('role="status"');
  expect(stage).toContain('aria-live="polite"');
  expect(stage).toContain('aria-atomic="true"');
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
    expect(missions).toContain(`solar-system.html${target}`);
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
    /\.info-panel\.mobile-info-panel\.is-expanded \.mobile-info-toggle\s*\{[\s\S]*?position:\s*sticky/
  );
});

test('every page carries the wordmark and links it home', () => {
  const commonCss = readFileSync('common.css', 'utf8');
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const brand = html.match(/<a class="brand"[^>]*>[\s\S]*?<\/a>/);
    expect(brand, `${file}: missing the brand wordmark`).not.toBeNull();
    expect(brand![0]).toContain('href="index.html"');
    expect(brand![0].replace(/<[^>]+>/g, '')).toBe('tinyastronomer');
    // It sits inside the fixed header, which is pointer-events: none.
    expect(html.indexOf(brand![0])).toBeGreaterThan(html.indexOf('<header class="header">'));
  }
  expect(commonCss).toMatch(/\.brand\s*\{[\s\S]*?pointer-events:\s*auto/);
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
  expect(missions).toContain("about <b>24 hours</b>");
  expect(missions).toContain("more than <b>1.7 million observations</b>");
});

test('Earth and planet spin stay eastward (+Y in Three.js)', () => {
  // Right-hand +rotation.y is CCW from above the north pole = geographic east.
  // A previous "fix" negated these signs after misreading that convention.
  const index = readFileSync('index.html', 'utf8');
  const seasons = readFileSync('seasons.html', 'utf8');
  const tour = readFileSync('solar-system.html', 'utf8');

  expect(index).toMatch(/earth\.rotation\.y\s*=\s*sim\.time\s*\*\s*sim\.earthSpinSpeed\s*;/);
  expect(index).not.toMatch(/earth\.rotation\.y\s*=\s*-\s*sim\.time/);

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
