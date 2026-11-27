/* The 3D kit the mission pages share: everything a scroll-driven scene needs
   that is not about one particular mission. Loaded only once WebGL is wanted;
   scroll state comes from mission-story.js.

   const kit = createMissionKit(sceneOptions)   null when WebGL is unavailable

   Drawing
     kit.E(ecliptic, out?)                 [x, y, z] with z north → scene Vector3 (y up)
     kit.canvasTexture(w, h, paint)        an sRGB texture painted on a 2D canvas
     kit.addGlow(parent, color, fraction, boost?)   a dot of constant screen size
     kit.fatLine(flat, color, width, opacity?)      a line with a width in pixels
     kit.setSegment(line, from, to)        move a two-point fatLine
     kit.thinLine / kit.thinLoop(points, color, opacity)   hairlines
   Paths
     kit.track(rows, unit?)                rows of [day, x, y, z] → { days, points, count,
                                           indexAt(day), point(i, out), at(day, out) }
     kit.trail(parent, track, { color, width, ahead, from, to })
                                           the path flown so far → { here, done, lead,
                                           ahead, lines, update(day) }
   Worlds
     kit.planets(parent, names, orbitDate) orbit loops and dots → { loops, dots, moveTo(ms) }
     kit.globe(parent, { key, color, pole, periodDays, radius })
                                           a planet model on its true axis →
                                           { axis, load(), turnTo(day) }
     kit.aimSun(direction)                 sunlight from a direction, onto the origin
     kit.light({ sun, target, sunIntensity, fill, sky })   set the three lights
     kit.sunLight, kit.stars               the Sun's DirectionalLight (for shadows); the starfield
   Overlays
     kit.place(key, text, world, { cls, dx, dy, alpha, rank })   a label, for this frame; it hangs
                                           left of its point rather than run off screen.
                                           Ranked labels fade out for a higher-ranked one
                                           they would print over; see yieldingLabels
     kit.setClock(date, a, b)              the mission clock's three lines
     kit.loadModel(url, onLoad)            the spacecraft; drives the loader chip, which
                                           says so if the model cannot load
     kit.addHotspots(model, picker)        a marker per `Hotspot_<key>` node
     kit.showHotspots()                    show them, for this frame
     kit.anchors                           Map of part key → that node
   Camera
     kit.pose { position, target, fov }    where the camera should be; fov is reset
                                           before each chapter
     kit.orbit(target, azimuth, elevation, distance)   set the pose around a point
     kit.fit(points)                       then step back until these are all on
                                           screen, clear of the card
     kit.drag { yaw, pitch }               the reader's drag, live on the `craft` set
   State, read-only: kit.time, kit.stage, kit.wide, kit.reduced
   kit.run({ sets, chapters, studio, frame, onChapter })   start the story; see below */
import * as THREE from 'three';
import { SPACE } from './common.bundle.js?v=20261121-3';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  approach, clamp01, equatorialToEcliptic, indexAt, lerp, planetOrbit, planetPosition,
} from './mission-orbits.js?v=20261121-2';
import { follow, theStory, yieldingLabels } from './mission-story.js?v=20261127-1';
import { createPlanetModelLoader } from './planet-models.js?v=20261121-1';

const FOV = 35;
// Matches the phone layout's breakpoint in mission-page.css.
const WIDE_PX = 860;
// Where the subject sits to stay clear of the card (`shift`, [x, y] from the
// middle of the screen) and how far from there the screen is free to either
// side, above and below, all as shares of the viewport. The card is beside
// the subject on wide screens; on phones it is below, and the mission clock,
// when it shows, is above.
const LAYOUTS = {
  left: { shift: [0.15, 0], free: { across: 0.27, up: 0.38, down: 0.38 } },
  right: { shift: [-0.2, 0], free: { across: 0.27, up: 0.38, down: 0.38 } },
  phone: { shift: [0, 0.2], free: { across: 0.42, up: 0.17, down: 0.17 } },
  phoneClock: { shift: [0, 0.15], free: { across: 0.42, up: 0.1, down: 0.12 } },
};
const GOLD = 0xf4c560;
// How fast a label that has to give way fades out, and back, per second.
const LABEL_FADE = 5;
// How long the "model could not load" notice stays up.
const MODEL_NOTICE_MS = 10000;
const UP = new THREE.Vector3(0, 1, 0);
const PLANET_COLORS = {
  mercury: 0x9a9088, venus: 0xe6cf9a, earth: 0x6ab0ff, mars: 0xd0674a,
  jupiter: 0xd9b38c, saturn: 0xe6d3a0, uranus: 0xa9e0e2, neptune: 0x6f8fe8,
};
// The spacecraft is lit like a studio model. Everywhere else shadows are as
// black as they are in space, so planets keep their true night side.
const STUDIO = { sun: [-14, 22, 16], target: [0, 0, 0], sunIntensity: 4.6, fill: 0.9, sky: 0.9 };
const DEEP_SPACE = { sunIntensity: 4.6, fill: 0, sky: 0.08 };

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Returns null when the device cannot run WebGL; SPACE.createScene has
// already said so in the loader chip, and the story reads on without it.
export function createMissionKit(sceneOptions = {}) {
  // The story runs whether or not the 3D view can start, so the chapter rail
  // works either way.
  const story = theStory();
  const setup = SPACE.createScene({
    fov: FOV, near: 0.05, far: 4000, bloom: { strength: 0.7, radius: 0.55, threshold: 3.2 }, ...sceneOptions,
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

  /* ── Drawing ── */
  const dot = canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
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
  const hairline = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  // Move one with `line.geometry.setFromPoints(samePointCount)`.
  function thinLine(points, color, opacity) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), hairline(color, opacity));
    line.frustumCulled = false;
    return line;
  }
  function thinLoop(points, color, opacity) {
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), hairline(color, opacity));
  }

  /* ── Paths ── */
  // A sampled path: rows of [day, x, y, z, …] in the ecliptic frame, sorted by
  // day, scaled so `unit` of their length is one scene unit.
  function track(rows, unit = 1) {
    const count = rows.length;
    const days = Float64Array.from(rows, (row) => row[0]);
    const points = new Float32Array(count * 3);
    const corner = new THREE.Vector3();
    rows.forEach((row, i) => E([row[1] / unit, row[2] / unit, row[3] / unit], corner).toArray(points, i * 3));
    const point = (i, out) => out.fromArray(points, i * 3);
    function at(day, out) {
      const i = indexAt(days, day);
      if (i === count - 1) return point(i, out);
      return point(i, out).lerp(point(i + 1, corner), clamp01((day - days[i]) / (days[i + 1] - days[i])));
    }
    return { days, points, count, indexAt: (day) => indexAt(days, day), point, at };
  }
  // A track drawn in two strengths: faint for what is still ahead (`ahead` is
  // its opacity, 0 for none), bright for what has been flown, and one more
  // segment out to the exact position, which `update(day)` returns.
  function trail(parent, path, { color = GOLD, width = 2.6, ahead = 0.2, from = 0, to = path.count - 1 } = {}) {
    const flat = path.points.subarray(from * 3, (to + 1) * 3);
    const bright = new THREE.Color(color).multiplyScalar(1.5);
    const aheadLine = ahead ? fatLine(flat, color, 1.1, ahead) : null;
    const done = fatLine(flat, bright, width);
    const lead = fatLine([0, 0, 0, 0, 0, 1], bright, width);
    const lines = aheadLine ? [aheadLine, done, lead] : [done, lead];
    parent.add(...lines);
    const here = new THREE.Vector3(), start = new THREE.Vector3();
    return {
      here, done, lead, ahead: aheadLine, lines,
      update(day) {
        const index = Math.max(from, Math.min(to, path.indexAt(day)));
        done.geometry.instanceCount = index - from;
        path.at(Math.max(path.days[from], Math.min(path.days[to], day)), here);
        setSegment(lead, path.point(index, start), here);
        lead.visible = day >= path.days[from];
        return here;
      },
    };
  }

  /* ── Lights ── */
  const stars = SPACE.createStarfield({ count: 3800, innerR: 1500, outerR: 2400 });
  scene.add(stars.points);
  const sunLight = new THREE.DirectionalLight(0xfff3df);
  scene.add(sunLight, sunLight.target);
  const skyLight = new THREE.HemisphereLight(0x9db4dd, 0x10131f);
  scene.add(skyLight);
  // A faint light riding with the camera keeps the side of a spacecraft
  // facing the reader legible.
  const fill = new THREE.DirectionalLight(0xbfd2ff);
  fill.position.set(0.4, 0.5, 1);
  camera.add(fill);
  scene.add(camera);
  // `sun` and `target` are [x, y, z]; leave them out to keep the Sun where
  // it is.
  function light({ sun, target, sunIntensity, fill: fillIntensity, sky }) {
    if (sun) sunLight.position.fromArray(sun);
    if (target) sunLight.target.position.fromArray(target);
    sunLight.intensity = sunIntensity;
    fill.intensity = fillIntensity;
    skyLight.intensity = sky;
  }
  function aimSun(direction) {
    sunLight.position.copy(direction).multiplyScalar(200);
    sunLight.target.position.set(0, 0, 0);
  }

  /* ── Models ── */
  const manager = new THREE.LoadingManager();
  const hideLoader = SPACE.createLoader(manager, 12000);
  const models = createPlanetModelLoader(renderer, manager);
  function loadModel(url, onLoad) {
    models.loadGltf(url, (gltf) => {
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      gltf.scene.traverse((node) => {
        if (node.isMesh && node.material.map) node.material.map.anisotropy = anisotropy;
      });
      onLoad(gltf);
      container.style.backgroundImage = 'none';
      invalidate();
    }, (error) => {
      console.warn('Model unavailable: ' + url, error);
      // The story reads without the spacecraft, so this is a passing notice
      // in the loader chip, not a failure of the page.
      const clear = SPACE.showSceneNotice('3D model unavailable. The story carries on.', { passing: true });
      if (clear) setTimeout(clear, MODEL_NOTICE_MS);
      hideLoader();
    });
  }

  /* ── Worlds ── */
  function planets(parent, names, orbitDate) {
    const loops = new Map(), dots = new Map();
    for (const name of names) {
      loops.set(name, thinLoop(planetOrbit(name, orbitDate).map((p) => E(p)), PLANET_COLORS[name], 0.34));
      parent.add(loops.get(name));
      dots.set(name, addGlow(parent, PLANET_COLORS[name], 0.018, 1.6));
    }
    return {
      loops, dots,
      moveTo(ms) { for (const [name, planet] of dots) E(planetPosition(name, ms), planet.position); },
    };
  }
  // One of the Grand Tour's planet models, one unit in radius (`radius` is
  // 'mean' or 'equatorial'), tilted to its pole (right ascension and
  // declination in degrees). A plain ball of `color` stands in until
  // `load()` has fetched the model.
  function globe(parent, { key, color, pole, periodDays, radius = 'mean' }) {
    const tilt = new THREE.Group(), spin = new THREE.Group();
    const axis = E(equatorialToEcliptic(pole[0], pole[1])).normalize();
    tilt.quaternion.setFromUnitVectors(UP, axis);
    tilt.add(spin);
    parent.add(tilt);
    const stand = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }));
    spin.add(stand);
    let requested = false;
    function load() {
      if (requested) return;
      requested = true;
      models.load(key, (root) => {
        root.traverse((node) => {
          if (!node.isMesh || !/ring/i.test(node.name)) return;
          // Rings are a sheet seen from both faces, with the globe showing
          // through their gaps.
          node.material.side = THREE.DoubleSide;
          node.material.depthWrite = false;
        });
        spin.remove(stand);
        spin.add(root);
        invalidate();
      }, (error) => {
        console.warn('Planet model unavailable: ' + key, error);
        requested = false;
      }, { radius });
    }
    return { axis, load, turnTo(day) { spin.rotation.y = (day / periodDays) * Math.PI * 2; } };
  }

  /* ── Labels: a pool of HTML tags, placed once the camera is final ── */
  const labels = new Map();
  const projected = new THREE.Vector3();
  const size = new THREE.Vector2();
  function project(world) {
    projected.copy(world).project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return [(projected.x * 0.5 + 0.5) * size.x, (projected.y * -0.5 + 0.5) * size.y];
  }
  // Call every frame the label should show; one not placed is hidden.
  // `rank` (any number) opts a label into giving way: it fades out while a
  // higher-ranked label would print over it. Without one it never moves.
  function place(key, text, world, { cls = '', dx = 10, dy = -6, alpha = 1, rank = null } = {}) {
    let label = labels.get(key);
    if (!label) {
      label = { el: document.createElement('span'), world: new THREE.Vector3(), width: 0, height: 0, x: 0, y: 0, fade: 1, wanted: false };
      labelLayer.appendChild(label.el);
      labels.set(key, label);
    }
    Object.assign(label, { text, cls, dx, dy, alpha, rank, wanted: alpha > 0.02 });
    label.world.copy(world);
  }
  function drawLabels(dt, jump) {
    const shown = [];
    for (const label of labels.values()) {
      const at = label.wanted && project(label.world);
      label.wanted = false;
      label.el.style.display = at ? '' : 'none';
      if (!at) continue;
      label.el.className = 'scene-label ' + label.cls;
      if (label.text !== label.el.textContent) {
        label.el.textContent = label.text;
        label.width = label.el.offsetWidth;
        label.height = label.el.offsetHeight;
      }
      label.x = at[0] + label.dx + label.width > size.x ? at[0] - label.dx - label.width : at[0] + label.dx;
      label.y = at[1] + label.dy;
      shown.push(label);
    }
    const gives = yieldingLabels(shown.map((l) => ({ x: l.x, y: l.y, w: l.width, h: l.height, rank: l.rank })));
    shown.forEach((label, i) => {
      const target = gives.has(i) ? 0 : 1;
      label.fade = jump ? target : approach(label.fade, target, dt * LABEL_FADE);
      label.el.style.opacity = label.alpha * label.fade;
      label.el.style.transform = 'translate(' + label.x.toFixed(1) + 'px,' + label.y.toFixed(1) + 'px)';
    });
  }

  /* ── Part markers: one button per `Hotspot_<key>` node in a model ── */
  const anchors = new Map();
  const hotspots = new Map();
  const anchorAt = new THREE.Vector3();
  let picker = null, hotspotsWanted = false;
  function addHotspots(model, partPicker) {
    picker = partPicker;
    for (const part of picker.parts) {
      const anchor = model.getObjectByName('Hotspot_' + part.key);
      if (!anchor) continue;
      anchors.set(part.key, anchor);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot';
      btn.tabIndex = -1;
      btn.addEventListener('click', () => picker.select(part.key));
      btn.style.display = 'none';
      labelLayer.appendChild(btn);
      hotspots.set(part.key, btn);
    }
  }
  // Call from a chapter that wants the markers; they hide again otherwise.
  function showHotspots() { hotspotsWanted = true; }
  function drawHotspots() {
    for (const [key, btn] of hotspots) {
      const at = hotspotsWanted && project(anchors.get(key).getWorldPosition(anchorAt));
      btn.style.display = at ? '' : 'none';
      if (!at) continue;
      btn.style.transform = 'translate(' + at[0].toFixed(1) + 'px,' + at[1].toFixed(1) + 'px)';
      btn.classList.toggle('is-active', key === picker.selected);
    }
    hotspotsWanted = false;
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
  const pose = { position: new THREE.Vector3(0, 6, 30), target: new THREE.Vector3(), fov: FOV };
  const current = { position: pose.position.clone(), target: new THREE.Vector3(), fov: FOV };
  function orbit(target, azimuth, elevation, distance) {
    pose.target.copy(target);
    pose.position.set(
      target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      target.y + distance * Math.sin(elevation),
      target.z + distance * Math.cos(elevation) * Math.cos(azimuth));
  }
  let layout = LAYOUTS.left;
  const forward = new THREE.Vector3(), across = new THREE.Vector3(), upward = new THREE.Vector3(), toPoint = new THREE.Vector3();
  // Call after posing the camera: steps it back along its line of sight
  // until every point is in the part of the screen the card leaves free.
  function fit(points) {
    forward.subVectors(pose.target, pose.position).normalize();
    across.crossVectors(forward, UP).normalize();
    upward.crossVectors(across, forward);
    const tan = Math.tan((pose.fov * Math.PI) / 360);
    const { free } = layout;
    let back = 0;
    for (const point of points) {
      toPoint.subVectors(point, pose.position);
      const depth = toPoint.dot(forward), x = Math.abs(toPoint.dot(across)), y = toPoint.dot(upward);
      back = Math.max(back, x / (tan * (size.x / size.y) * free.across * 2) - depth, Math.abs(y) / (tan * (y > 0 ? free.up : free.down) * 2) - depth);
    }
    pose.position.addScaledVector(forward, -back);
  }

  const kit = {
    THREE, scene, camera, renderer, reduced, stars, sunLight,
    E, canvasTexture, addGlow, fatLine, setSegment, thinLine, thinLoop, track, trail,
    planets, globe, aimSun, light, place, setClock, loadModel, addHotspots, showHotspots, anchors,
    pose, orbit, fit, invalidate,
    time: 0, stage: '', wide: true,
    // Vertical drags stay with the page scroll on touch screens
    // (touch-action: pan-y), so only the yaw is taken there.
    drag: { yaw: 0, pitch: 0, active: false, x: 0, y: 0 },
  };
  const drag = kit.drag;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (kit.stage !== 'craft') return;
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
  //   sets       { stage: [objects] }: what is visible on each `data-stage`.
  //              The set named `craft` is the studio: lit by `studio`,
  //              turned by dragging, with the mission clock off.
  //   chapters   { id: { play, phoneBack, clock } }, one per `.chapter`.
  //              play(progress, state) moves objects and sets kit.pose;
  //              phoneBack steps the camera that many times farther from
  //              its target on a narrow screen, which sees a much thinner
  //              slice of the scene; clock overrides the set's default.
  //   studio     overrides for the craft set's lighting, as kit.light takes.
  //   frame      (state) => void, every frame once the camera is final.
  //   onChapter  (chapter) => void, when the active chapter changes.
  // The subject is kept clear of the card: beside it on wide screens, on the
  // side the chapter's markup leaves free, and above it on phones.
  kit.run = function run({ sets, chapters, studio, frame: onFrame, onChapter }) {
    if (onChapter) story.onChapter(onChapter);
    for (const { id, stage } of story.chapters) {
      if (!chapters[id] || !sets[stage]) throw new Error('Chapter #' + id + ' has no scene, or its set "' + stage + '" is unknown');
    }
    const members = new Set(Object.values(sets).flat());
    const studioLight = { ...STUDIO, ...studio };
    const shift = { x: 0, y: 0 };
    let cut = true, past = false;

    function step(now, dt) {
      const state = story.read();
      const chapter = chapters[state.id];
      past = state.past;
      if (!reduced) kit.time += dt;
      if (state.stage !== kit.stage) {
        kit.stage = state.stage;
        for (const object of members) object.visible = sets[kit.stage].includes(object);
        // The cut is hidden by the dim, so the camera jumps rather than flies.
        cut = true;
      }
      const studioSet = kit.stage === 'craft';
      renderer.getSize(size);
      kit.wide = size.x > WIDE_PX;
      pose.fov = FOV;
      light(studioSet ? studioLight : DEEP_SPACE);
      const clockOn = chapter.clock ?? !studioSet;
      clock.classList.toggle('is-on', clockOn);
      layout = kit.wide ? LAYOUTS[state.side] : clockOn ? LAYOUTS.phoneClock : LAYOUTS.phone;

      chapter.play(state.progress, state);
      if (!kit.wide && chapter.phoneBack) pose.position.sub(pose.target).multiplyScalar(chapter.phoneBack).add(pose.target);

      const jumped = cut || reduced;
      const k = follow(dt, jumped);
      cut = false;
      current.position.lerp(pose.position, k);
      current.target.lerp(pose.target, k);
      current.fov = lerp(current.fov, pose.fov, k);
      shift.x = lerp(shift.x, layout.shift[0], k);
      shift.y = lerp(shift.y, layout.shift[1], k);
      camera.position.copy(current.position);
      camera.lookAt(current.target);
      camera.fov = current.fov;
      camera.setViewOffset(size.x, size.y, -shift.x * size.x, shift.y * size.y, size.x, size.y);
      camera.updateMatrixWorld();

      if (onFrame) onFrame(state);

      const lens = 2 * Math.tan((camera.fov * Math.PI) / 360);
      for (const sprite of sprites) sprite.scale.setScalar(sprite.userData.fraction * lens);
      stars.points.position.copy(camera.position);
      stars.uniforms.uTime.value = kit.time;
      drawLabels(dt, jumped);
      drawHotspots();
      container.style.opacity = (1 - state.dim).toFixed(3);
      labelLayer.style.opacity = (1 - state.dim).toFixed(3);
      clock.style.visibility = state.dim > 0.6 ? 'hidden' : '';
      quality.frame(dt, drag.active);
      render();
    }

    loop = SPACE.createFrameLoop(step, { fps: 60, animated: () => !past, element: container });
    addEventListener('scroll', invalidate, { passive: true });
  };

  return kit;
}
