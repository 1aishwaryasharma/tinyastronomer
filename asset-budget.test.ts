import { expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('./public', import.meta.url)));
const size = (path: string) => statSync(path).size;
const KB = 1024;

// Measured in docs/texture-variants.md. The budgets below are ceilings a
// regenerated asset must stay under, not the exact sizes.
test('the Light Study payload has a compact tier for phones', () => {
  const earth = readFileSync('earth-visuals.js', 'utf8');
  const index = readFileSync('index.html', 'utf8');
  expect(earth).toContain("window.matchMedia('(max-width: 820px), (pointer: coarse)').matches");
  expect(index).toContain('const compact = prefersCompactTextures();');
  expect(index).toContain("['day', 'normal', 'specular', 'lights', 'clouds'], { compact })");
  expect(index).toContain('const moonPaths = compact ? COMPACT_MOON_TEXTURE_PATHS : MOON_TEXTURE_PATHS;');

  const compact = ['earth/day-2k.webp', 'earth/normal-1k.webp', 'earth/specular-1k.webp', 'earth/lights-1k.webp',
    'earth/clouds-512.webp', 'moon/color-1k.webp', 'moon/height-512.webp'];
  const full = ['earth/day-4k.jpg', 'earth/normal-2k.webp', 'earth/specular-2k.webp', 'earth/lights-2k.webp',
    'earth/clouds-1k.webp', 'moon/color-2k.webp', 'moon/height-1k.webp'];
  for (const path of [...compact, ...full]) {
    expect(earth, `${path} must be a declared texture path`).toContain(`assets/${path}`);
  }
  // three.module.min.js imports three.core.min.js, which the review's 2.49 MB
  // figure left out; the study really downloaded about 2.88 MB before.
  const runtime = size('vendor/three/three.module.min.js') + size('vendor/three/three.core.min.js') + size('common.bundle.js');
  const compactTotal = compact.reduce((sum, path) => sum + size(`assets/${path}`), 0);
  const fullTotal = full.reduce((sum, path) => sum + size(`assets/${path}`), 0);
  expect(compactTotal, 'phone textures').toBeLessThan(560 * KB);
  expect(runtime + compactTotal, 'phone payload').toBeLessThan(1400 * KB);
  expect(runtime + fullTotal, 'laptop payload').toBeLessThan(2550 * KB);
  // Nothing still points at the heavier source encodings.
  for (const legacy of ['normal.jpg', 'specular.jpg', 'clouds-1k.png', 'color-2k.jpg', 'height-1k.jpg']) {
    expect(earth).not.toContain(legacy);
    expect(index).not.toContain(legacy);
  }
});

test('planet models are Meshopt-compressed and the decoder is vendored', () => {
  const total = ['ceres', 'jupiter', 'mars', 'mercury', 'neptune', 'pluto', 'saturn', 'uranus', 'venus']
    .reduce((sum, key) => sum + size(`assets/planet-models/${key}.glb`), 0);
  expect(total).toBeLessThan(2000 * KB);
  const saturn = readFileSync('assets/planet-models/saturn.glb');
  // The JSON chunk of a GLB starts at byte 20; the extensions it requires are listed there.
  expect(saturn.toString('utf8', 20, 2000)).toContain('EXT_meshopt_compression');
  expect(readFileSync('planet-models.js', 'utf8')).toContain('loader.setMeshoptDecoder(MeshoptDecoder)');
  const decoder = readFileSync('vendor/three/addons/libs/meshopt_decoder.module.js', 'utf8');
  expect(decoder).toContain('MIT License');
  expect(decoder).toContain('export { MeshoptDecoder };');
  expect(size('vendor/three/addons/libs/meshopt_decoder.module.js')).toBeLessThan(40 * KB);
  expect(readFileSync('assets/planet-models/README.md', 'utf8')).toContain('Meshopt');
});

test('loading screens show real progress', () => {
  const common = readFileSync('common.js', 'utf8');
  expect(common).toContain("loadingManager.onProgress = (url, loaded, total) => progress(loaded, total);");
  expect(common).toContain("bar.setAttribute('aria-valuenow'");
  for (const page of ['solar-system.html', 'index.html', 'scale-walk.html', 'seasons.html']) {
    const html = readFileSync(page, 'utf8');
    expect(html, page).toMatch(/<div class="loader-bar" role="progressbar" aria-label="[^"]+" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="loader-bar-fill"><\/span><\/div>/);
  }
});

test('the home preview is served at the size it is shown', () => {
  const index = readFileSync('index.html', 'utf8');
  const img = index.match(/<img class="earth-preview"[^>]*>/)![0];
  expect(img).toContain('srcset="assets/earth/home-preview-320.webp 320w, assets/earth/home-preview-480.webp 480w, assets/earth/home-preview-720.webp 720w, assets/earth/home-preview.webp 922w"');
  expect(img).toContain('sizes="(min-width: 60rem) 36vw, 40vw"');
  expect(size('assets/earth/home-preview-480.webp')).toBeLessThan(40 * KB);
});
