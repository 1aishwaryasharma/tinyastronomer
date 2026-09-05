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
  specular: 'assets/earth/specular.jpg',
  clouds: 'assets/earth/clouds-1k.png'
});

const COLOR_TEXTURES = new Set(['day', 'lights', 'clouds']);

export function createEarthGeometry(meanRadius, widthSegments = 96, heightSegments = 64) {
  const geometry = new THREE.SphereGeometry(meanRadius, widthSegments, heightSegments);
  geometry.scale(EARTH_SHAPE.equatorialScale, EARTH_SHAPE.polarScale, EARTH_SHAPE.equatorialScale);
  return geometry;
}

// A separate, sunlit shell preserves the surface detail and moves with its
// own small drift. Cloud altitude/opacity are visual aids, not weather data.
export function createEarthClouds(radius, texture) {
  const clouds = new THREE.Mesh(
    createEarthGeometry(radius * 1.008, 64, 48),
    new THREE.MeshPhongMaterial({
      map: texture,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      specular: new THREE.Color(0x000000),
      shininess: 1
    })
  );
  clouds.receiveShadow = true;
  return clouds;
}

export function createEarthAtmosphere(radius) {
  const atmosphere = new THREE.Mesh(
    createEarthGeometry(radius * 1.025, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { sunDir: { value: new THREE.Vector3(-1, 0, 0) } },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }`,
      fragmentShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        uniform vec3 sunDir;
        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float facing = abs(dot(normal, viewDir));
          float rim = pow(1.0 - facing, 3.0) * smoothstep(0.0, 0.22, facing);
          float sunHeight = dot(normal, sunDir);
          float daylight = smoothstep(-0.22, 0.45, sunHeight);
          float twilight = exp(-pow(sunHeight * 6.0, 2.0));
          vec3 scatter = mix(vec3(0.08, 0.28, 0.85), vec3(0.28, 0.58, 1.0), daylight);
          scatter = mix(scatter, vec3(0.8, 0.3, 0.12), twilight * 0.25);
          gl_FragColor = vec4(scatter, rim * (0.06 + daylight * 0.9));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  atmosphere.renderOrder = 2;
  return atmosphere;
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
