// Bundle the render helpers without duplicating the shared Three.js runtime
// or the lightweight chrome module that can initialize before the 3D scene.
import { resolve } from 'node:path';
const result = await Bun.build({
  entrypoints: ['./public/common.js'],
  outdir: './public',
  naming: 'common.bundle.js',
  target: 'browser',
  minify: true,
  external: ['three', './chrome.js?v=20260907-2'],
  plugins: [{
    name: 'three-addons',
    setup(build) {
      build.onResolve({ filter: /chrome\.js/ }, ({ path }) => ({ path, external: true }));
      build.onResolve({ filter: /^three\/addons\// }, ({ path }) => ({
        path: resolve('public/vendor/three', path.slice('three/'.length)),
      }));
    },
  }],
});
if (!result.success) throw new AggregateError(result.logs, 'Render helper build failed');
console.log('Built public/common.bundle.js');
