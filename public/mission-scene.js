/* The 3D kit the mission pages share: everything a scroll-driven scene needs
   that is not about one particular mission. A page builds its own sets
   (groups of objects), then hands `run` one function per chapter; each turns
   scroll progress into object positions and a camera pose.

   Loaded only once WebGL is wanted. Scroll state comes from mission-story.js. */
import * as THREE from 'three';
import { SPACE } from './common.bundle.js?v=20260909-2';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createStory } from './mission-story.js?v=20261121-1';

export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Returns null when the device cannot run WebGL; SPACE.createScene has
// already said so in the loader chip, and the story reads on without it.
export function createMissionKit(sceneOptions = {}) {
  const setup = SPACE.createScene({
    fov: 35, near: 0.05, far: 4000, bloom: { strength: 0.7, radius: 0.55, threshold: 3.2 }, ...sceneOptions,
  });
  if (!setup) return null;
  const { scene, camera, renderer, render, quality } = setup;
  const reduced = SPACE.prefersReducedMotion;
  const container = document.getElementById('canvas-container');
  const labelLayer = document.getElementById('scene-labels');
  const clock = document.getElementById('clock');
  let loop = null;
  const invalidate = () => { if (loop) loop.invalidate(); };

  // Ecliptic (x toward the equinox, z north) to the scene's y-up frame.
  const E = (p, out = new THREE.Vector3()) => out.set(p[0], p[2], -p[1]);

  const dot = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  // A glowing dot that keeps its size on screen whatever the zoom or lens.
  // `fraction` is its width as a share of the viewport height.
  const sprites = [];
  function addGlow(parent, color, fraction, boost = 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dot, color: new THREE.Color(color).multiplyScalar(boost), transparent: true,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: false,
    }));
    sprite.userData.fraction = fraction;
    sprite.renderOrder = 5;
    parent.add(sprite);
    sprites.push(sprite);
    return sprite;
  }
  // A line with a width in pixels. `points` is a flat [x, y, z, …] array.
  // Draw part of it with `line.geometry.instanceCount = segments`.
  function fatLine(points, color, width, opacity = 1) {
    const geometry = new LineGeometry();
    geometry.setPositions(points);
    const material = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, depthTest: false });
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    return line;
  }
  // Move a two-point wide line in place. LineGeometry.setPositions would
  // allocate a fresh GPU buffer on every call, which leaks at frame rate.
  function setSegment(line, from, to) {
    const buffer = line.geometry.attributes.instanceStart.data;
    buffer.array.set([from.x, from.y, from.z, to.x, to.y, to.z]);
    buffer.needsUpdate = true;
  }
  function thinLoop(points, color, opacity) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  }

  const stars = SPACE.createStarfield({ count: 3800, innerR: 1500, outerR: 2400 });
  scene.add(stars.points);
  const sunLight = new THREE.DirectionalLight(0xfff3df, 4.6);
  scene.add(sunLight, sunLight.target);
  const skyLight = new THREE.HemisphereLight(0x9db4dd, 0x10131f, 0.9);
  scene.add(skyLight);
  // Out here real shadows are pitch black. A faint light riding with the
  // camera keeps the side of a spacecraft facing the reader legible. Pages
  // switch it off where a true night side matters.
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.9);
  fill.position.set(0.4, 0.5, 1);
  camera.add(fill);
  scene.add(camera);

  /* ── Labels: a pool of HTML tags placed on projected points each frame ── */
  const labels = new Map();
  const projected = new THREE.Vector3();
  const size = new THREE.Vector2();
  function project(world) {
    projected.copy(world).project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return [(projected.x * 0.5 + 0.5) * size.x, (projected.y * -0.5 + 0.5) * size.y];
  }
  // Call every frame the label should show; one not placed is hidden.
  function place(key, text, world, cls = '', dx = 10, dy = -6, alpha = 1) {
    let label = labels.get(key);
    if (!label) {
      label = { el: document.createElement('span'), used: false };
      label.el.className = 'scene-label';
      labelLayer.appendChild(label.el);
      labels.set(key, label);
    }
    const at = alpha > 0.02 && project(world);
    if (!at) return;
    label.used = true;
    label.el.className = 'scene-label ' + cls;
    SPACE.setText(label.el, text);
    label.el.style.opacity = alpha;
    label.el.style.transform = 'translate(' + (at[0] + dx).toFixed(1) + 'px,' + (at[1] + dy).toFixed(1) + 'px)';
  }

  /* ── Models ── */
  const manager = new THREE.LoadingManager();
  const hideLoader = SPACE.createLoader(manager, 12000);
  const loaders = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]).then(([{ GLTFLoader }, { MeshoptDecoder }]) => (mgr) => {
    const loader = new GLTFLoader(mgr);
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  });
  // `tracked` models drive the loader chip; the rest arrive quietly.
  function loadModel(url, onLoad, { tracked = false } = {}) {
    loaders.then((make) => make(tracked ? manager : undefined).load(url, (gltf) => {
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      gltf.scene.traverse((node) => {
        if (node.isMesh && node.material.map) node.material.map.anisotropy = anisotropy;
      });
      onLoad(gltf);
      if (tracked) container.style.backgroundImage = 'none';
      invalidate();
    }, undefined, (error) => {
      console.warn('Model unavailable: ' + url, error);
      if (tracked) hideLoader();
    }));
  }
  // One of the Grand Tour's planet models, scaled so the globe (not any
  // rings) has a radius of one unit, as planet-models.js does.
  function loadPlanet(key, onLoad) {
    loadModel('/assets/planet-models/' + key + '.glb', (gltf) => {
      const root = gltf.scene;
      const body = root.children.find((child) => !/ring/i.test(child.name)) || root;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(body);
      const extent = box.getSize(new THREE.Vector3());
      const k = 2 / (Math.cbrt(extent.x * extent.y * extent.z) || 1);
      root.scale.setScalar(k);
      root.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-k);
      root.traverse((node) => {
        if (!node.isMesh) return;
        node.material.metalness = 0;
        if ('roughness' in node.material) node.material.roughness = Math.max(node.material.roughness, 0.82);
      });
      onLoad(root);
    });
  }

  /* ── Part markers: one button per `Hotspot_<key>` node in a model ── */
  const anchors = new Map();
  const hotspots = new Map();
  const anchorAt = new THREE.Vector3();
  function addHotspots(model, parts, onSelect) {
    for (const part of parts) {
      const anchor = model.getObjectByName('Hotspot_' + part.key);
      if (!anchor) continue;
      anchors.set(part.key, anchor);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot';
      btn.tabIndex = -1;
      btn.addEventListener('click', () => onSelect(part.key));
      btn.style.display = 'none';
      labelLayer.appendChild(btn);
      hotspots.set(part.key, btn);
    }
  }
  // Call from a chapter that wants the markers; they hide again otherwise.
  let hotspotsWanted = false;
  function showHotspots(activeKey) {
    hotspotsWanted = true;
    for (const [key, btn] of hotspots) {
      anchors.get(key).getWorldPosition(anchorAt);
      const at = project(anchorAt);
      btn.style.display = at ? '' : 'none';
      if (at) btn.style.transform = 'translate(' + at[0].toFixed(1) + 'px,' + at[1].toFixed(1) + 'px)';
      btn.classList.toggle('is-active', key === activeKey);
    }
  }

  /* ── Mission clock ── */
  const clockLines = ['clock-date', 'clock-a', 'clock-b'].map((id) => document.getElementById(id));
  function setClock(date, a, b) {
    SPACE.setText(clockLines[0], date);
    [a, b].forEach((html, i) => {
      const el = clockLines[i + 1];
      if (el.__html !== html) { el.__html = html; el.innerHTML = html; }
    });
  }

  /* ── Camera ── */
  const pose = { position: new THREE.Vector3(0, 6, 30), target: new THREE.Vector3(), fov: 35 };
  const current = { position: pose.position.clone(), target: new THREE.Vector3(), fov: 35 };
  function orbit(target, azimuth, elevation, distance) {
    pose.target.copy(target);
    pose.position.set(
      target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      target.y + distance * Math.sin(elevation),
      target.z + distance * Math.cos(elevation) * Math.cos(azimuth));
    pose.fov = 35;
  }

  const kit = {
    THREE, scene, camera, renderer, reduced, clock,
    E, addGlow, fatLine, setSegment, thinLoop, stars, sunLight, skyLight, fill,
    project, place, loadModel, loadPlanet, anchors, addHotspots, showHotspots,
    setClock, pose, orbit, invalidate,
    time: 0, stage: '', wide: true,
    // Drag turns the subject while `dragEnabled()` allows it. Vertical drags
    // stay with the page scroll on touch screens (touch-action: pan-y), so
    // only the yaw is taken there.
    drag: { yaw: 0, pitch: 0, active: false, x: 0, y: 0 },
  };
  const drag = kit.drag;
  let dragEnabled = () => false;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!dragEnabled()) return;
    drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    drag.yaw -= (e.clientX - drag.x) * 0.006;
    if (e.pointerType === 'mouse') drag.pitch = Math.max(-0.9, Math.min(0.9, drag.pitch + (e.clientY - drag.y) * 0.004));
    drag.x = e.clientX; drag.y = e.clientY;
    invalidate();
  });
  const endDrag = () => { drag.active = false; };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  // Start the story.
  //   chapters     { id: (progress, state) => void } sets kit.pose and objects
  //   enterStage   (stage) => void, show that set and light it
  //   before       (state) => void, reset what only some chapters touch
  //   after        (state) => void, once the camera is final for the frame
  //   offset       (state, wide) => [x, y], where the subject sits on screen
  //                as a share of the viewport, clear of the card
  //   canDrag      () => boolean
  kit.run = function run({ chapters, enterStage, before, after, offset, canDrag, onChapter }) {
    if (canDrag) dragEnabled = canDrag;
    const story = createStory(document.getElementById('story'), { onChapter });
    const shift = { x: 0, y: 0 };
    let snap = true, past = false;

    function frame(now, dt) {
      const state = story.read();
      past = state.past;
      if (!reduced) kit.time += dt;
      if (state.stage !== kit.stage) {
        kit.stage = state.stage;
        enterStage(state.stage);
        // The cut is hidden by the dim, so the camera jumps rather than flies.
        snap = true;
      }
      renderer.getSize(size);
      kit.wide = size.x > 860;
      hotspotsWanted = false;
      if (before) before(state);

      chapters[state.id](state.progress, state);

      const [tx, ty] = offset ? offset(state, kit.wide) : [0, 0];
      const k = snap || reduced ? 1 : 1 - Math.exp(-dt * 6);
      snap = false;
      current.position.lerp(pose.position, k);
      current.target.lerp(pose.target, k);
      current.fov = lerp(current.fov, pose.fov, k);
      shift.x = lerp(shift.x, tx, k);
      shift.y = lerp(shift.y, ty, k);
      camera.position.copy(current.position);
      camera.lookAt(current.target);
      camera.fov = current.fov;
      camera.setViewOffset(size.x, size.y, -shift.x * size.x, shift.y * size.y, size.x, size.y);

      const lens = 2 * Math.tan((camera.fov * Math.PI) / 360);
      for (const sprite of sprites) sprite.scale.setScalar(sprite.userData.fraction * lens);
      stars.points.position.copy(camera.position);
      stars.uniforms.uTime.value = kit.time;

      if (after) after(state);

      if (!hotspotsWanted) for (const btn of hotspots.values()) btn.style.display = 'none';
      for (const label of labels.values()) {
        label.el.style.display = label.used ? '' : 'none';
        label.used = false;
      }
      container.style.opacity = (1 - state.dim).toFixed(3);
      labelLayer.style.opacity = (1 - state.dim).toFixed(3);
      clock.style.visibility = state.dim > 0.6 ? 'hidden' : '';
      quality.frame(dt, drag.active);
      render();
    }

    loop = SPACE.createFrameLoop(frame, { fps: 60, animated: () => !past, element: container });
    addEventListener('scroll', invalidate, { passive: true });
  };

  return kit;
}
