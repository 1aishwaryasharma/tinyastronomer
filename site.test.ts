import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const pages = readdirSync(".").filter((file) => file.endsWith(".html"));

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
});

test('sky tonight keeps its planet list visible on small screens', () => {
  const sky = readFileSync('sky-tonight.html', 'utf8');
  const chromeJs = readFileSync('chrome.js', 'utf8');
  expect(sky).toContain('data-keep-open');
  expect(chromeJs).toContain('data-keep-open');
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
