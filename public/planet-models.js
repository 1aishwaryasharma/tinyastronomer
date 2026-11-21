/* NASA Visualization Technology Applications and Development (VTAD)
   planet models. The GLBs retain their original UV layouts, proportions,
   and mission-derived texture composites; they are only transmission-
   compressed for this site: quantized attributes packed with Meshopt
   (EXT_meshopt_compression), decoded by the vendored meshoptimizer module. */
import * as THREE from 'three';

const MODEL_PATHS = Object.freeze({
  mercury: '/assets/planet-models/mercury.glb',
  venus: '/assets/planet-models/venus.glb',
  mars: '/assets/planet-models/mars.glb',
  jupiter: '/assets/planet-models/jupiter.glb',
  saturn: '/assets/planet-models/saturn.glb',
  uranus: '/assets/planet-models/uranus.glb',
  neptune: '/assets/planet-models/neptune.glb',
  ceres: '/assets/planet-models/ceres.glb',
  pluto: '/assets/planet-models/pluto.glb'
});

export function createPlanetModelLoader(renderer, loadingManager) {
  let loaderPromise;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  // One unit is the globe's radius: its volumetric mean radius, or with
  // `radius: 'equatorial'` the radius at its equator.
  function prepare(root, radius) {
    // Saturn's first child is the globe; later children are its rings. Using
    // the globe for normalization preserves NASA's ring-to-planet proportion.
    const body = root.children.find(child => !/ring/i.test(child.name)) || root;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // Catalog radii are volumetric mean radii. Normalizing by the geometric
    // mean of the three diameters preserves oblateness while keeping the
    // parent scene's physical radius scale consistent across planets.
    const diameter = radius === 'equatorial' ? size.x : Math.cbrt(size.x * size.y * size.z);
    const modelScale = 2 / (diameter || 1);

    root.scale.setScalar(modelScale);
    root.position.copy(center).multiplyScalar(-modelScale);
    root.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        if (!material) return;
        material.metalness = 0;
        if ('roughness' in material) material.roughness = Math.max(material.roughness, 0.82);
        if (material.map) material.map.anisotropy = anisotropy;
      });
    });
    return root;
  }

  // Any Meshopt-packed GLB. The overview uses small neutral globes; do not
  // fetch or parse the GLTF loader until a model is actually requested.
  function loadGltf(url, onLoad, onError) {
    loaderPromise ||= Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js')
    ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => {
      const loader = new GLTFLoader(loadingManager);
      loader.setMeshoptDecoder(MeshoptDecoder);
      return loader;
    }).catch(error => {
      // Let the next planet retry after a dropped connection.
      loaderPromise = undefined;
      throw error;
    });
    loaderPromise.then(loader => {
      loader.load(url, onLoad, undefined, onError);
    }).catch(error => {
      if (onError) onError(error);
      else console.warn('Planet model loader unavailable.', error);
    });
  }

  function load(key, onLoad, onError, { radius = 'mean' } = {}) {
    const path = MODEL_PATHS[key];
    if (!path) return false;
    loadGltf(path, gltf => onLoad(prepare(gltf.scene, radius)), onError);
    return true;
  }

  return { load, loadGltf, paths: MODEL_PATHS };
}
