/* ─────────────────────────────────────────────────────────
   Grand Tour procedural planet / ring textures.
   Isolated from solar-system.html so the page script stays
   scene orchestration, not canvas paint routines.
   ───────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { SPACE } from './common.bundle.js?v=20260907-2';
import { loadEarthTextureSet } from './earth-visuals.js?v=20260907-2';

export function createTourTextures(renderer, { earthDetails = true } = {}) {
  const clamp = SPACE.clamp;
  const seededRandom = SPACE.seededRandom;

  const loadingManager = new THREE.LoadingManager();
  const earthTextures = loadEarthTextureSet(renderer, loadingManager, earthDetails ? ['day', 'normal', 'specular', 'lights'] : ['day'], { compact: true });
  const earthDay = earthTextures.day;
  const earthNormal = earthTextures.normal;
  const earthSpecular = earthTextures.specular;
  const earthLights = earthTextures.lights;
  const earthNightUniforms = {
    nightMap: { value: earthLights },
    sunDirView: { value: new THREE.Vector3(1, 0, 0) }
  };

  const textureLoader = new THREE.TextureLoader(loadingManager);
  const planetTextures = new Map();
  function planetTexture(p) {
    if (p.type === 'earth') return earthDay;
    if (!planetTextures.has(p.key)) {
      // Eris has no resolved global map: its baked image is a plain color.
      const path = p.key === 'eris' ? 'eris' : p.key;
      const tex = textureLoader.load(`assets/teaching-textures/${path}.webp`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      planetTextures.set(p.key, tex);
    }
    return planetTextures.get(p.key);
  }

  function planetMaterial(p) {
    if (p.type !== 'earth') {
      return new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 1, metalness: 0 });
    }

    const material = new THREE.MeshPhongMaterial({
      map: earthDay,
      normalMap: earthNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      specularMap: earthSpecular,
      specular: new THREE.Color(0x52657a),
      shininess: 12
    });
    material.onBeforeCompile = shader => {
      shader.uniforms.nightMap = earthNightUniforms.nightMap;
      shader.uniforms.sunDirView = earthNightUniforms.sunDirView;
      shader.fragmentShader =
        'uniform sampler2D nightMap;\nuniform vec3 sunDirView;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float dayMix = smoothstep(-0.08, 0.22, dot(normalize(vNormal), sunDirView));
          vec3 cityLights = texture2D(nightMap, vMapUv).rgb;
          totalEmissiveRadiance += cityLights * (1.0 - dayMix) * 1.35;`
        );
    };
    material.customProgramCacheKey = () => 'grand-tour-earth-night-v1';
    return material;
  }

  function updateEarthLighting(sunDirectionView) {
    earthNightUniforms.sunDirView.value.copy(sunDirectionView);
  }

  function makeRingTexture() {
    const W = 512;
    const H = 16;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const rand = seededRandom(2024);
    for (let x = 0; x < W; x++) {
      const t = x / W;
      let a = 0.55 + 0.35 * Math.sin(t * 40) * 0.4;
      if (t > 0.62 && t < 0.68) a *= 0.15;
      if (t < 0.06 || t > 0.98) a *= 0.2;
      a = clamp(a + (rand() - 0.5) * 0.15, 0, 0.85);
      const shade = 200 + Math.floor(rand() * 40);
      ctx.fillStyle = 'rgba(' + shade + ',' + (shade - 20) + ',' + (shade - 60) + ',' + a + ')';
      ctx.fillRect(x, 0, 1, H);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  return { loadingManager, makeRingTexture, planetMaterial, planetTexture, updateEarthLighting };
}

window.createTourTextures = createTourTextures;
