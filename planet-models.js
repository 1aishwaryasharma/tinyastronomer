/* NASA Visualization Technology Applications and Development (VTAD)
   planet models. The GLBs retain their original UV layouts, proportions,
   and mission-derived texture composites; they are only transmission-
   compressed for this site. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_PATHS = Object.freeze({
  mercury: 'assets/planet-models/mercury.glb',
  venus: 'assets/planet-models/venus.glb',
  mars: 'assets/planet-models/mars.glb',
  jupiter: 'assets/planet-models/jupiter.glb',
  saturn: 'assets/planet-models/saturn.glb',
  uranus: 'assets/planet-models/uranus.glb',
  neptune: 'assets/planet-models/neptune.glb',
  ceres: 'assets/planet-models/ceres.glb',
  pluto: 'assets/planet-models/pluto.glb'
});

export function createPlanetModelLoader(renderer, loadingManager) {
  const loader = new GLTFLoader(loadingManager);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  function prepare(root) {
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
    const meanDiameter = Math.cbrt(size.x * size.y * size.z) || 1;
    const modelScale = 2 / meanDiameter;

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

  function load(key, onLoad, onError) {
    const path = MODEL_PATHS[key];
    if (!path) return false;
    loader.load(path, gltf => onLoad(prepare(gltf.scene)), undefined, onError);
    return true;
  }

  return { load, paths: MODEL_PATHS };
}
