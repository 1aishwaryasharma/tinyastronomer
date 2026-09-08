import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (name: string) => readFileSync(new URL(`./public/${name}`, import.meta.url), 'utf8');

function launch(deepLink: boolean) {
  const html = read('index.html');
  const source = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)][0][1];
  const window = new EventTarget();
  const imports: string[] = [];
  const document = { body: { classList: { contains: () => deepLink } } };
  new Function('window', 'document', 'importModule', source.replace(/\bimport\(/g, 'importModule('))(
    window, document, (path: string) => { imports.push(path); return new Promise(() => {}); }
  );
  return { imports, open: () => window.dispatchEvent(new Event('light-study-open')) };
}

test('home does not start 3D imports until requested and repeated opens share one startup', () => {
  const h = launch(false);
  expect(h.imports).toEqual([]);
  h.open();
  expect(h.imports).toContain('three');
  const first = [...h.imports];
  h.open();
  expect(h.imports).toEqual(first);
  expect(read('index.html')).not.toContain('rel="modulepreload"');
});

test('a direct Light Study link starts 3D without another click', () => {
  expect(launch(true).imports).toContain('three');
});

test('Scale Walk loads only its day map and reuses pre-rendered planet textures', () => {
  const requests: string[] = [];
  let earthKeys: string[] = [];
  const THREE = {
    LoadingManager: class {},
    TextureLoader: class { load(path: string) { requests.push(path); return {}; } },
    Vector3: class {},
  };
  const source = read('tour-textures.js').replace(/^import .*;$/gm, '').replace('export function', 'function');
  const factory = new Function('THREE', 'SPACE', 'loadEarthTextureSet', 'window',
    source + ';return createTourTextures;')(
    THREE, {}, (_renderer: unknown, _manager: unknown, keys: string[]) => { earthKeys = keys; return { day: {} }; }, {}
  );
  const textures = factory({ capabilities: { getMaxAnisotropy: () => 16 } }, { earthDetails: false });
  expect(earthKeys).toEqual(['day']);
  const first = textures.planetTexture({ key: 'mars', type: 'rock' });
  expect(textures.planetTexture({ key: 'mars', type: 'rock' })).toBe(first);
  expect(requests).toEqual(['assets/teaching-textures/mars.webp']);
});

test('every page uses local fonts instead of a third-party stylesheet chain', () => {
  for (const name of ['index', 'solar-system', 'seasons', 'scale-walk', 'sky-tonight', 'missions']) {
    expect(read(name + '.html')).not.toContain('https://fonts.googleapis.com');
    expect(read(name + '.html')).toContain('as="font"');
  }
});

test('model loader code is deferred until selection and shared between requests', async () => {
  const imports: string[] = [];
  const models: string[] = [];
  const source = read('planet-models.js').replace(/^import .*;$/gm, '')
    .replace('export function', 'function').replace(/\bimport\(/g, 'importModule(');
  const factory = new Function('THREE', 'importModule', source + ';return createPlanetModelLoader;')({},
    async (path: string) => {
      imports.push(path);
      return { GLTFLoader: class { load(path: string) { models.push(path); } } };
    });
  const loader = factory({ capabilities: { getMaxAnisotropy: () => 8 } });
  expect(imports).toEqual([]);
  expect(loader.load('unknown')).toBe(false);
  expect(imports).toEqual([]);
  loader.load('mars');
  loader.load('saturn');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(imports).toEqual(['three/addons/loaders/GLTFLoader.js']);
  expect(models).toEqual(['assets/planet-models/mars.glb', 'assets/planet-models/saturn.glb']);
});

test('Grand Tour defers Earth detail maps until selection and updates the existing material once', () => {
  const batches: string[][] = [];
  const THREE = {
    LoadingManager: class {}, TextureLoader: class {},
    Vector3: class {}, Vector2: class {}, Color: class {},
    MeshPhongMaterial: class { constructor(options: object) { Object.assign(this, options); } },
  };
  const source = read('tour-textures.js').replace(/^import .*;$/gm, '').replace('export function', 'function');
  const factory = new Function('THREE', 'SPACE', 'loadEarthTextureSet', 'window',
    source + ';return createTourTextures;')(
    THREE, {}, (_renderer: unknown, _manager: unknown, keys: string[]) => {
      batches.push(keys);
      return Object.fromEntries(keys.map(key => [key, { key }]));
    }, {}
  );
  const textures = factory({}, { earthDetails: false });
  const material = textures.planetMaterial({ type: 'earth' });
  expect(batches).toEqual([['day']]);
  expect(material.onBeforeCompile).toBeUndefined();
  textures.loadEarthDetails();
  expect(batches).toEqual([['day'], ['normal', 'specular', 'lights']]);
  expect(material.normalMap.key).toBe('normal');
  expect(material.specularMap.key).toBe('specular');
  expect(material.needsUpdate).toBe(true);
  const shader = { uniforms: {}, fragmentShader: '#include <emissivemap_fragment>' };
  material.onBeforeCompile(shader);
  expect(shader.uniforms.nightMap.value.key).toBe('lights');
  textures.loadEarthDetails();
  expect(batches).toHaveLength(2);
});

test('Saturn upgrades its overview silhouette and tracks the deferred import through completion', async () => {
  const html = read('solar-system.html');
  const start = html.indexOf('  w.loadDetail = () => {');
  const source = html.slice(start, html.indexOf('  // moons orbit', start));
  for (const fail of [false, true]) {
    const events: string[] = [];
    let complete: (value?: object) => void = () => {};
    const fallbackMesh = { visible: true }, fallbackRing = { visible: true };
    const w = { key: 'saturn', mesh: { add: () => events.push('model added') }, loadDetail: () => {} };
    new Function('w', 'hasScientificModel', 'loadingManager', 'planetModels',
      'fallbackMesh', 'fallbackRing', 'console', 'renderer', 'composer', 'camera', 'scene', source)(
      w, true,
      { itemStart: () => events.push('start'), itemEnd: () => events.push('end') },
      { load: (_key: string, onLoad: typeof complete, onError: typeof complete) => {
        events.push('request'); complete = fail ? onError : onLoad;
      } }, fallbackMesh, fallbackRing, { warn: () => {} },
      { getRenderTarget: () => null, setRenderTarget: () => {}, compileAsync: () => Promise.resolve() },
      null, {}, {}
    );
    expect(html).toContain("WORLDS.find(w => w.key === 'saturn').loadDetail();");
    w.loadDetail();
    expect(events).toEqual(['start', 'request']);
    expect(fallbackRing.visible).toBe(true);
    w.loadDetail();
    expect(events).toEqual(['start', 'request']);
    await complete({});
    expect(events).toEqual(fail ? ['start', 'request', 'end'] : ['start', 'request', 'model added', 'end']);
    expect(fallbackMesh.visible).toBe(fail);
    expect(fallbackRing.visible).toBe(fail);
  }
});
