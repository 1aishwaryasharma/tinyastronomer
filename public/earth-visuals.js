import * as THREE from 'three';

// WGS 84 reference ellipsoid, expressed relative to Earth's volumetric mean
// radius. Keeping the volume-equivalent radius at 1 lets every scene retain
// its existing display scale while representing Earth's real flattening.
const EQUATORIAL_RADIUS_KM = 6378.137;
const POLAR_RADIUS_KM = 6356.752314245;
const VOLUMETRIC_MEAN_RADIUS_KM = Math.cbrt(
  EQUATORIAL_RADIUS_KM * EQUATORIAL_RADIUS_KM * POLAR_RADIUS_KM
);

export const EARTH_SHAPE = Object.freeze({
  equatorialScale: EQUATORIAL_RADIUS_KM / VOLUMETRIC_MEAN_RADIUS_KM,
  polarScale: POLAR_RADIUS_KM / VOLUMETRIC_MEAN_RADIUS_KM
});

const EARTH_TEXTURE_PATHS = Object.freeze({
  day: 'assets/earth/day-4k.jpg',
  lights: 'assets/earth/lights-2k.png',
  normal: 'assets/earth/normal.jpg',
  specular: 'assets/earth/specular.jpg'
});

const COLOR_TEXTURES = new Set(['day', 'lights']);

export function createEarthGeometry(meanRadius, widthSegments = 96, heightSegments = 64) {
  const geometry = new THREE.SphereGeometry(meanRadius, widthSegments, heightSegments);
  geometry.scale(EARTH_SHAPE.equatorialScale, EARTH_SHAPE.polarScale, EARTH_SHAPE.equatorialScale);
  return geometry;
}

export function loadEarthTextureSet(renderer, loadingManager, keys) {
  const loader = new THREE.TextureLoader(loadingManager);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  return Object.fromEntries(keys.map(key => {
    const path = EARTH_TEXTURE_PATHS[key];
    if (!path) throw new Error(`Unknown Earth texture: ${key}`);
    const texture = loader.load(path);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = anisotropy;
    if (COLOR_TEXTURES.has(key)) texture.colorSpace = THREE.SRGBColorSpace;
    return [key, texture];
  }));
}
