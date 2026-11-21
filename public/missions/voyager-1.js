/* Voyager 1 — a scroll-driven story on three 3D sets:
     craft    the spacecraft itself, in metres
     system   the Sun, planets and Voyager's real path, in astronomical units
     flyby    Jupiter or Saturn with the real path past it, in planet radii
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a mission date and a camera pose. Every
   position Voyager takes comes from trajectory.json (JPL Horizons). */
import * as THREE from 'three';
import { SPACE } from '/common.bundle.js?v=20260909-2';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  AU_KM, DAY_MS, PLANETS, createTrajectory, equatorialToEcliptic, formatDate,
  formatLightTime, planetOrbit, planetPosition, sampleRows,
} from '/mission-orbits.js?v=20261121-1';
import { createStory } from '/mission-story.js?v=20261121-1';

const ASSETS = '/assets/missions/voyager-1/';
const reduced = SPACE.prefersReducedMotion;
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const km = (value) => Math.round(value).toLocaleString('en-US');

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const traj = createTrajectory(data);
const dayOn = (y, m, d, h = 0) => (Date.UTC(y, m - 1, d, h) - traj.epochMs) / DAY_MS;
const DAYS = {
  jupiter: data.jupiter.closestDay,
  saturn: data.saturn.closestDay,
  portrait: dayOn(1990, 2, 14),
  shock: dayOn(2004, 12, 16),
  pause: dayOn(2012, 8, 25),
  lightDay: dayOn(2026, 11, 18, 10),
};
const today = () => Math.min(traj.dayOf(Date.now()), traj.lastDay);

/* ──── Live figures: these run with or without the 3D scene ──── */
function tickLive() {
  const now = traj.live(Date.now());
  SPACE.setText($('hero-earth-km'), km(now.earthKm));
  SPACE.setText($('hero-light'), formatLightTime(now.lightSeconds));
  SPACE.setText($('ld-earth-km'), km(now.earthKm));
  SPACE.setText($('ld-sun-km'), km(now.sunKm));
  SPACE.setText($('ld-light'), formatLightTime(now.lightSeconds));
  SPACE.setText($('ld-speed'), now.kmPerSec.toFixed(1));
}
tickLive();
setInterval(tickLive, 1000);

let helloSentAt = -1;
$('hello-btn').addEventListener('click', () => {
  const seconds = traj.live(Date.now()).lightSeconds;
  const when = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  $('hello-out').innerHTML = 'Sent at the speed of light. Voyager hears it on <strong>' + when(Date.now() + seconds * 1000)
    + '</strong>. If it answered straight away, the reply would reach you on <strong>'
    + when(Date.now() + seconds * 2000) + '</strong>.';
  helloSentAt = performance.now();
});

/* ──── Spacecraft parts ──── */
const PARTS = [
  { key: 'HighGainAntenna', label: 'Big dish', title: 'High-gain antenna',
    text: 'A 3.7-metre dish that always points at Earth. Its radio is about as powerful as a fridge light bulb, and by the time the signal arrives it is billions of times fainter than a watch battery.' },
  { key: 'RTG', label: 'Power', title: 'Nuclear batteries',
    text: 'Three generators turn the heat of decaying plutonium into electricity. They sit out on a boom so their radiation does not confuse the instruments.' },
  { key: 'ScanPlatform', label: 'Cameras', title: 'Scan platform',
    text: 'A turning mount for two cameras and other light sensors. It took the close-ups of Jupiter and Saturn, and the Pale Blue Dot. Switched off since 1990.' },
  { key: 'MagnetometerBoom', label: 'Long boom', title: 'Magnetometer boom',
    text: 'Thirteen metres long, folded into a can for launch. It holds magnetic sensors far from the spacecraft, and is still measuring the magnetism between the stars.' },
  { key: 'PlasmaWaveAntennas', label: 'Whiskers', title: 'Plasma wave antennas',
    text: 'Two 10-metre rods that feel ripples in the thin gas around the spacecraft. In 2012 they picked up the hum that proved Voyager had reached interstellar space.' },
  { key: 'GoldenRecord', label: 'Golden Record', title: 'The Golden Record',
    text: 'A gold-plated record of pictures, music and greetings from Earth, under a cover engraved with instructions for playing it.' },
  { key: 'ScienceBoom', label: 'Particle detectors', title: 'Science boom',
    text: 'Detectors for cosmic rays and charged particles ride here. Most have been switched off to save power as the batteries fade.' },
  { key: 'Bus', label: 'Body', title: 'The bus',
    text: 'A ten-sided box holding three pairs of computers, a tape recorder and the fuel tank. All its computers together have about 70 kilobytes of memory, far less than one phone photo.' },
];
let selectedPart = null;
const partButtons = new Map();
function selectPart(key) {
  selectedPart = selectedPart === key ? null : key;
  for (const [k, btn] of partButtons) btn.setAttribute('aria-pressed', String(k === selectedPart));
  const part = PARTS.find((p) => p.key === selectedPart);
  if (part) {
    $('part-title').textContent = part.title;
    $('part-text').textContent = part.text;
  }
}
for (const part of PARTS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'part-btn';
  btn.textContent = part.label;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => selectPart(part.key));
  $('parts').appendChild(btn);
  partButtons.set(part.key, btn);
}

/* ──── Speed chart (2D canvas inside the Jupiter card) ──── */
function createChart(canvas, rows, eventDay) {
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue('--ink-faint').trim(), accent = style.getPropertyValue('--accent').trim();
  const t0 = rows[0][0], t1 = rows[rows.length - 1][0];
  const top = Math.ceil(Math.max(...rows.map((r) => r[1])) / 10) * 10;
  let lastDrawn = null;
  return function draw(day) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const key = w + ':' + h + ':' + day.toFixed(3);
    if (key === lastDrawn) return;
    lastDrawn = key;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 30, padB = 18, padT = 6;
    const X = (t) => padL + ((t - t0) / (t1 - t0)) * (w - padL - 4);
    const Y = (v) => padT + (1 - v / top) * (h - padT - padB);
    ctx.font = '10px "Fragment Mono", monospace';
    ctx.fillStyle = ink;
    ctx.strokeStyle = 'rgba(232,236,244,0.12)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= top; v += 10) {
      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - 4, Y(v)); ctx.stroke();
      ctx.fillText(String(v), 4, Y(v) + 3);
    }
    ctx.fillText('km/s', 4, h - 4);
    ctx.textAlign = 'center';
    ctx.fillText('closest approach', X(eventDay), h - 4);
    ctx.textAlign = 'left';
    const trace = (until, color, width) => {
      ctx.beginPath();
      rows.forEach((r, i) => { if (r[0] <= until) ctx[i ? 'lineTo' : 'moveTo'](X(r[0]), Y(r[1])); });
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    trace(t1, 'rgba(232,236,244,0.28)', 1);
    trace(day, accent, 2);
    const now = sampleRows(rows, day);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(X(now[0]), Y(now[1]), 3.5, 0, Math.PI * 2); ctx.fill();
  };
}
const drawJupiterChart = createChart($('chart-jupiter'), data.speed.jupiter, DAYS.jupiter);
drawJupiterChart(data.speed.jupiter[0][0]);

/* ──── 3D scene ──── */
const setup = SPACE.createScene({ fov: 35, near: 0.05, far: 4000, bloom: { strength: 0.7, radius: 0.55, threshold: 3.2 } });
if (setup) startScene(setup);

function startScene({ scene, camera, renderer, render, quality }) {
  const container = $('canvas-container');
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
  // A sprite that keeps its size on screen whatever the zoom or lens.
  function glow(color, fraction, boost = 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dot, color: new THREE.Color(color).multiplyScalar(boost), transparent: true,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: false,
    }));
    sprite.userData.fraction = fraction;
    sprite.renderOrder = 5;
    return sprite;
  }
  const sprites = [];
  const addGlow = (parent, color, fraction, boost) => { const s = glow(color, fraction, boost); parent.add(s); sprites.push(s); return s; };
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
  // camera keeps the side of the spacecraft facing the reader legible. The
  // planets keep their true night side: it is off during the flybys.
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.9);
  fill.position.set(0.4, 0.5, 1);
  camera.add(fill);
  scene.add(camera);

  /* ── Labels: a pool of HTML tags placed on projected points each frame ── */
  const labelLayer = $('scene-labels');
  const labels = new Map();
  const projected = new THREE.Vector3();
  const size = new THREE.Vector2();
  function project(world) {
    projected.copy(world).project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return [(projected.x * 0.5 + 0.5) * size.x, (projected.y * -0.5 + 0.5) * size.y];
  }
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
  function flushLabels() {
    for (const label of labels.values()) {
      label.el.style.display = label.used ? '' : 'none';
      label.used = false;
    }
  }

  /* ════ Set 1: the spacecraft ════ */
  const craft = new THREE.Group();
  const craftSpin = new THREE.Group();
  // The model's dish points along +Z; stand it up so the dish faces the
  // light and the record wall faces the default camera.
  const craftModel = new THREE.Group();
  craftModel.rotation.x = -Math.PI / 2;
  craftSpin.add(craftModel);
  craft.add(craftSpin);
  scene.add(craft);
  const anchors = new Map();
  const hotspots = new Map();
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
  loaders.then((make) => make(manager).load(ASSETS + 'voyager.glb', (gltf) => {
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((node) => {
      if (node.isMesh && node.material.map) node.material.map.anisotropy = anisotropy;
    });
    craftModel.add(gltf.scene);
    for (const part of PARTS) {
      const anchor = gltf.scene.getObjectByName('Hotspot_' + part.key);
      if (!anchor) continue;
      anchors.set(part.key, anchor);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot';
      btn.tabIndex = -1;
      btn.addEventListener('click', () => selectPart(part.key));
      btn.style.display = 'none';
      labelLayer.appendChild(btn);
      hotspots.set(part.key, btn);
    }
    container.style.backgroundImage = 'none';
    loop.invalidate();
  }, undefined, (error) => { console.warn('Voyager model unavailable.', error); hideLoader(); }));

  // Drag turns the spacecraft. Vertical drags stay with the page scroll on
  // touch screens (touch-action: pan-y), so only the yaw is taken there.
  const drag = { yaw: 0, pitch: 0, active: false, x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (stage !== 'craft') return;
    drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    drag.yaw -= (e.clientX - drag.x) * 0.006;
    if (e.pointerType === 'mouse') drag.pitch = Math.max(-0.9, Math.min(0.9, drag.pitch + (e.clientY - drag.y) * 0.004));
    drag.x = e.clientX; drag.y = e.clientY;
    loop.invalidate();
  });
  const endDrag = () => { drag.active = false; };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  /* ════ Set 2: the solar system ════ */
  const sys = new THREE.Group();
  scene.add(sys);
  const PLANET_COLORS = { mercury: 0x9a9088, venus: 0xe6cf9a, earth: 0x6ab0ff, mars: 0xd0674a, jupiter: 0xd9b38c, saturn: 0xe6d3a0, uranus: 0xa9e0e2, neptune: 0x6f8fe8 };
  const NAMES = { mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' };
  const orbitDate = Date.UTC(1985, 0, 1);
  const orbitLines = PLANETS.map((name) => {
    const line = thinLoop(planetOrbit(name, orbitDate).map((p) => E(p)), PLANET_COLORS[name], 0.34);
    sys.add(line);
    return line;
  });
  const planetDots = new Map(PLANETS.map((name) => [name, addGlow(sys, PLANET_COLORS[name], 0.018, 1.6)]));
  const sunDot = addGlow(sys, 0xffc060, 0.075, 7);
  const sunCore = addGlow(sys, 0xfff2cc, 0.03, 9);

  const pathPoints = [];
  for (const row of traj.rows) { const v = E([row[1], row[2], row[3]]); pathPoints.push(v.x, v.y, v.z); }
  const path = fatLine(pathPoints, new THREE.Color(0xf4c560).multiplyScalar(1.5), 2.4);
  const pathAhead = fatLine(pathPoints, 0xf4c560, 1, 0.16);
  sys.add(pathAhead, path);
  // The drawn path ends on a sample; this one segment carries it on to the
  // spacecraft's exact position between samples.
  const tip = fatLine([0, 0, 0, 0, 0, 1], new THREE.Color(0xf4c560).multiplyScalar(1.5), 2.4);
  sys.add(tip);
  const voyagerDot = addGlow(sys, 0xffe7b0, 0.03, 4);
  const pulse = addGlow(sys, 0x9fd0ff, 0.035, 5);
  const earthLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0x6ab0ff, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  earthLine.frustumCulled = false;
  sys.add(earthLine);
  // How far above the plane of the planets the path has climbed.
  const drop = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xaebbd0, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  drop.frustumCulled = false;
  sys.add(drop);
  const rings = [50, 100, 150].map((radius) => {
    const points = [];
    for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
    const ring = thinLoop(points, 0xaebbd0, 0.14);
    ring.userData.radius = radius;
    sys.add(ring);
    return ring;
  });
  const milestones = [
    { day: DAYS.portrait, text: '1990 · Pale Blue Dot' },
    { day: DAYS.shock, text: '2004 · Solar wind slows' },
    { day: DAYS.pause, text: '2012 · Interstellar space' },
    { day: DAYS.lightDay, text: '2026 · One light-day' },
  ].map((m) => {
    const row = traj.at(m.day);
    return { ...m, at: E([row[1], row[2], row[3]]), dot: addGlow(sys, 0x6ab0ff, 0.012, 3) };
  });
  for (const m of milestones) m.dot.position.copy(m.at);

  // The heliosphere. Its real shape is not known; this is a blunt nose
  // toward the incoming interstellar wind and a longer tail, sized so each
  // surface passes through the point where Voyager 1 actually crossed it.
  const nose = E([Math.cos(5.2 * Math.PI / 180) * Math.cos(255.4 * Math.PI / 180), Math.cos(5.2 * Math.PI / 180) * Math.sin(255.4 * Math.PI / 180), Math.sin(5.2 * Math.PI / 180)]).normalize();
  const stretch = (cosNose) => Math.min(2.4, Math.pow(2 / (1 + cosNose + 1e-4), 0.6));
  const radiusThrough = (day) => {
    const row = traj.at(day);
    const p = E([row[1], row[2], row[3]]);
    return p.length() / stretch(p.clone().normalize().dot(nose));
  };
  const shockR = radiusThrough(DAYS.shock), pauseR = radiusThrough(DAYS.pause);
  function bubble(radius, color, strength) {
    const geometry = new THREE.SphereGeometry(1, 72, 48);
    const position = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).normalize();
      v.multiplyScalar(radius * stretch(v.dot(nose)));
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    const uniforms = { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uStrength: { value: strength }, uTime: { value: 0 } };
    const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: SPACE.GLSL_NOISE + `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        uniform vec3 uColor; uniform float uOpacity; uniform float uStrength; uniform float uTime;
        void main() {
          // Added in linear light, where a little goes a long way: keep the
          // face of the bubble almost clear and let only its edge glow.
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.4);
          float shimmer = 0.75 + 0.25 * fbm(vP * 0.035 + vec3(uTime * 0.05));
          gl_FragColor = vec4(uColor * (0.004 + rim * shimmer * 0.4) * uStrength * uOpacity, 1.0);
        }`,
    }));
    mesh.userData.uniforms = uniforms;
    sys.add(mesh);
    return mesh;
  }
  const shock = bubble(shockR, 0xf4a24a, 0.6);
  const heliopause = bubble(pauseR, 0x6ab0ff, 1.5);

  // Solar wind streaming out to the shock, and interstellar gas flowing
  // past the outside of the bubble.
  function particles(count, uniforms, vertexShader, color) {
    const geometry = new THREE.BufferGeometry();
    const dir = new Float32Array(count * 3), seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      dir.set([r * Math.cos(a), z, r * Math.sin(a)], i * 3);
      seed.set([Math.random(), 0.5 + Math.random()], i * 2);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(dir, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uColor: { value: new THREE.Color(color) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader,
      fragmentShader: `
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor * vAlpha * (1.0 - smoothstep(0.1, 0.5, d)), 1.0);
        }`,
    }));
    points.frustumCulled = false;
    sys.add(points);
    return points;
  }
  const windUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uNose: { value: nose }, uShock: { value: shockR }, uPause: { value: pauseR }, uPixel: { value: 1 } };
  const STRETCH_GLSL = 'float stretch(float c) { return min(2.4, pow(2.0 / (1.0 + c + 0.0001), 0.6)); }';
  particles(1500, windUniforms, `
    attribute vec2 seed; uniform float uTime; uniform float uOpacity; uniform vec3 uNose; uniform float uShock; uniform float uPixel;
    varying float vAlpha; ${STRETCH_GLSL}
    void main() {
      float f = fract(seed.x + uTime * 0.035 * seed.y);
      vec3 p = position * f * uShock * stretch(dot(position, uNose));
      vAlpha = uOpacity * smoothstep(0.02, 0.2, f) * (1.0 - smoothstep(0.82, 1.0, f)) * 0.9;
      gl_PointSize = 2.6 * uPixel;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`, 0xffb860);
  particles(1700, windUniforms, `
    attribute vec2 seed; uniform float uTime; uniform float uOpacity; uniform vec3 uNose; uniform float uPause; uniform float uPixel;
    varying float vAlpha; ${STRETCH_GLSL}
    void main() {
      // A box of gas drifting from the nose side toward the tail, wrapped.
      vec3 side = normalize(cross(uNose, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(side, uNose);
      float along = (fract(seed.x - uTime * 0.012 * seed.y) - 0.5) * 900.0;
      vec3 p = uNose * along + side * position.x * 420.0 + up * position.z * 420.0;
      float r = length(p);
      float inside = uPause * stretch(dot(p / max(r, 0.001), uNose));
      vAlpha = uOpacity * smoothstep(inside * 1.02, inside * 1.25, r) * 0.55;
      gl_PointSize = 2.2 * uPixel;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`, 0x7fb4ff);

  /* ════ Set 3: the flybys ════ */
  function createFlyby(cfg) {
    const group = new THREE.Group();
    scene.add(group);
    const scale = 1 / cfg.radiusKm;
    const toScene = (row) => E([row[1] * scale, row[2] * scale, row[3] * scale]);
    const tilt = new THREE.Group(), spin = new THREE.Group();
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), E(equatorialToEcliptic(cfg.pole[0], cfg.pole[1])).normalize());
    tilt.add(spin);
    group.add(tilt);
    const stand = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.9, metalness: 0 }));
    spin.add(stand);
    let requested = false;
    function load() {
      if (requested) return;
      requested = true;
      loaders.then((make) => make().load('/assets/planet-models/' + cfg.key + '.glb', (gltf) => {
        const root = gltf.scene;
        // The planet-model files keep NASA's proportions; normalise the
        // globe (not the rings) to one unit radius, as the Grand Tour does.
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
        spin.remove(stand);
        spin.add(root);
        loop.invalidate();
      }, undefined, (error) => console.warn(cfg.key + ' model unavailable.', error)));
    }
    const points = [];
    for (const row of cfg.path) { const v = toScene(row); points.push(v.x, v.y, v.z); }
    const ahead = fatLine(points, 0xf4c560, 1.2, 0.22);
    const done = fatLine(points, new THREE.Color(0xf4c560).multiplyScalar(1.5), 2.8);
    const lead = fatLine([0, 0, 0, 0, 0, 1], new THREE.Color(0xf4c560).multiplyScalar(1.5), 2.8);
    const marker = addGlow(group, 0xffe7b0, 0.03, 4);
    const moonPoints = [];
    for (const row of cfg.moon.rows) { const v = toScene(row); moonPoints.push(v.x, v.y, v.z); }
    const moonPath = fatLine(moonPoints, cfg.moon.color, 1, 0.3);
    const moon = addGlow(group, cfg.moon.color, 0.016, 2.2);
    group.add(ahead, done, lead, moonPath);

    const first = toScene(cfg.path[0]), last = toScene(cfg.path[cfg.path.length - 1]);
    const peri = toScene(sampleRows(cfg.path, cfg.closestDay)).normalize();
    const normal = first.clone().cross(last).normalize();
    if (normal.y < 0) normal.negate();
    const toSun = E(traj.at(cfg.closestDay).slice(1, 4)).normalize().negate();
    // A day and a half either side of closest approach, so the middle of the
    // chapter is the moment of the pass.
    const t0 = cfg.closestDay - 1.5, t1 = cfg.closestDay + 1.5;
    const here = new THREE.Vector3(), moonHere = new THREE.Vector3(), swing = new THREE.Vector3();
    return {
      group, load,
      update(progress, pose) {
        const day = lerp(t0, t1, smooth(0, 1, progress) * 0.5 + progress * 0.5);
        here.copy(toScene(sampleRows(cfg.path, day)));
        moonHere.copy(toScene(sampleRows(cfg.moon.rows, day)));
        marker.position.copy(here);
        moon.position.copy(moonHere);
        const index = Math.max(0, cfg.path.findIndex((row) => row[0] > day) - 1);
        done.geometry.instanceCount = index;
        setSegment(lead, toScene(cfg.path[index]), here);
        spin.rotation.y = (day / cfg.periodDays) * Math.PI * 2;
        sunLight.position.copy(toSun).multiplyScalar(200);
        sunLight.target.position.set(0, 0, 0);
        // Look down on the plane of the pass and swing a little with it.
        swing.copy(peri).applyAxisAngle(normal, lerp(0.7, -0.5, progress));
        const near = 1 - Math.abs(progress - 0.5) * 2;
        pose.position.copy(normal).multiplyScalar(0.5).addScaledVector(swing, 0.87).normalize()
          .multiplyScalar(lerp(cfg.far, cfg.near, smooth(0, 1, near)));
        pose.target.copy(here).multiplyScalar(0.25);
        pose.fov = 35;
        const ms = traj.msOf(day);
        const clock = new Date(ms);
        setClock(formatDate(ms),
          String(clock.getUTCHours()).padStart(2, '0') + ':' + String(clock.getUTCMinutes()).padStart(2, '0') + ' UTC',
          '<b>' + km(here.length() * cfg.radiusKm) + '</b> km from ' + cfg.name + '’s centre');
        place('fly-voyager', 'Voyager 1', here, 'is-craft');
        place('fly-moon', cfg.moon.name, moonHere, '');
        if (cfg.chart) cfg.chart(day);
      },
    };
  }
  const flybys = {
    jupiter: createFlyby({
      key: 'jupiter', name: 'Jupiter', radiusKm: 71492, color: 0xc9a27e, pole: [268.057, 64.495], periodDays: 0.41354,
      path: data.jupiter.path, closestDay: DAYS.jupiter, far: 46, near: 24, chart: drawJupiterChart,
      moon: { name: 'Io', rows: data.jupiter.io, color: 0xf2d66b },
    }),
    saturn: createFlyby({
      key: 'saturn', name: 'Saturn', radiusKm: 60268, color: 0xd8c690, pole: [40.589, 83.537], periodDays: 0.44401,
      path: data.saturn.path, closestDay: DAYS.saturn, far: 72, near: 26,
      moon: { name: 'Titan', rows: data.saturn.titan, color: 0xe8a04a },
    }),
  };

  /* ──── Mission clock ──── */
  const clockEl = $('clock');
  function setClock(date, a, b) {
    SPACE.setText($('clock-date'), date);
    if ($('clock-a').__html !== a) { $('clock-a').__html = a; $('clock-a').innerHTML = a; }
    if ($('clock-b').__html !== b) { $('clock-b').__html = b; $('clock-b').innerHTML = b; }
  }
  function cruiseClock(day, row) {
    const sunAu = Math.hypot(row[1], row[2], row[3]);
    setClock(formatDate(traj.msOf(day)),
      '<b>' + (sunAu < 20 ? sunAu.toFixed(2) : sunAu.toFixed(1)) + '</b> AU from the Sun',
      '<b>' + row[4].toFixed(1) + '</b> km/s');
  }

  /* ──── Chapters: progress → mission date and camera pose ──── */
  const pose = { position: new THREE.Vector3(0, 6, 30), target: new THREE.Vector3(), fov: 35 };
  const current = { position: pose.position.clone(), target: new THREE.Vector3(), fov: 35 };
  const voyager = new THREE.Vector3(), earth = new THREE.Vector3(), scratch = new THREE.Vector3();
  const orbit = (target, azimuth, elevation, distance) => {
    pose.target.copy(target);
    pose.position.set(
      target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      target.y + distance * Math.sin(elevation),
      target.z + distance * Math.cos(elevation) * Math.cos(azimuth));
    pose.fov = 35;
  };
  let time = 0, stage = '', wide = true;
  // Where the subject sits on screen: clear of the card.
  const offset = { x: 0, y: 0, tx: 0, ty: 0 };

  function showSystem(day, opts = {}) {
    const row = traj.at(day);
    E([row[1], row[2], row[3]], voyager);
    const ms = traj.msOf(day);
    for (const name of PLANETS) planetDots.get(name).position.copy(E(planetPosition(name, ms)));
    earth.copy(planetDots.get('earth').position);
    voyagerDot.position.copy(voyager);
    const index = Math.max(0, traj.rows.findIndex((r) => r[0] > day) - 1);
    path.geometry.instanceCount = index;
    const start = traj.rows[index];
    E([start[1], start[2], start[3]], scratch);
    setSegment(tip, scratch, voyager);
    const d = drop.geometry.attributes.position;
    d.setXYZ(0, voyager.x, voyager.y, voyager.z); d.setXYZ(1, voyager.x, 0, voyager.z);
    d.setXYZ(2, voyager.x, 0, voyager.z); d.setXYZ(3, 0, 0, 0);
    d.needsUpdate = true;
    drop.visible = voyager.length() > 11;
    cruiseClock(day, row);
    return row;
  }

  const CHAPTERS = {
    hero(p) {
      orbit(scratch.set(0, 1.2, 0), 0.75 + time * 0.07 + drag.yaw, 0.2 + drag.pitch, lerp(21, 17, p));
    },
    craft(p) {
      const anchor = selectedPart && anchors.get(selectedPart);
      if (anchor) {
        anchor.getWorldPosition(scratch);
        const out = scratch.clone().setY(scratch.y * 0.4);
        const azimuth = Math.atan2(out.x, out.z) + 0.5 + drag.yaw;
        orbit(scratch.multiplyScalar(0.85), azimuth, 0.3 + drag.pitch, 11 + scratch.length() * 0.8);
      } else {
        orbit(scratch.set(0, 1.2, 0), 0.75 + p * 2.4 + drag.yaw, 0.24 + drag.pitch, 18);
      }
      for (const [key, btn] of hotspots) {
        anchors.get(key).getWorldPosition(scratch);
        const at = project(scratch);
        btn.style.display = at ? '' : 'none';
        if (at) btn.style.transform = 'translate(' + at[0].toFixed(1) + 'px,' + at[1].toFixed(1) + 'px)';
        btn.classList.toggle('is-active', key === selectedPart);
      }
    },
    launch(p) {
      showSystem(lerp(1, DAYS.jupiter - 4, p));
      orbit(scratch.copy(voyager).multiplyScalar(0.45), -0.9 + p * 0.5, lerp(1.05, 0.8, p), 3.4 + voyager.length() * 2.1);
      place('earth', 'Earth', earth, 'is-home');
      place('jupiter', 'Jupiter', planetDots.get('jupiter').position);
      place('voyager', 'Voyager 1', voyager, 'is-craft', 10, -18);
    },
    jupiter(p) { flybys.jupiter.update(p, pose); },
    cruise(p) {
      showSystem(lerp(DAYS.jupiter + 4, DAYS.saturn - 4, p));
      orbit(scratch.copy(voyager).multiplyScalar(0.5), -0.4 + p * 0.4, 0.8, 4 + voyager.length() * 2);
      place('jupiter', 'Jupiter', planetDots.get('jupiter').position);
      place('saturn', 'Saturn', planetDots.get('saturn').position);
      place('voyager', 'Voyager 1', voyager, 'is-craft', 10, -18);
    },
    saturn(p) { flybys.saturn.update(p, pose); },
    portrait(p) {
      const day = lerp(DAYS.saturn + 4, DAYS.portrait, smooth(0, 0.32, p));
      showSystem(day);
      const eye = smooth(0.36, 0.6, p);
      orbit(scratch.copy(voyager).multiplyScalar(0.5), 0.1 + p * 0.5, 0.5, 14 + voyager.length() * 2.3);
      // Slide to Voyager's own position and look back at the Sun.
      pose.position.lerp(scratch.copy(voyager).multiplyScalar(1.004), eye);
      pose.target.lerp(scratch.set(0, 0, 0), eye);
      pose.fov = 35 * Math.pow(0.11, smooth(0.72, 0.98, p));
      path.material.opacity = tip.material.opacity = 1 - eye;
      pathAhead.material.opacity = 0.16 * (1 - eye);
      voyagerDot.material.opacity = 1 - eye;
      drop.material.opacity = 0.3 * (1 - eye);
      // From out here Earth really is a speck: let its dot shrink to one.
      planetDots.get('earth').userData.fraction = lerp(0.018, 0.007, eye);
      $('sunbeams').style.opacity = (smooth(0.62, 0.9, p) * 0.9).toFixed(3);
      if (eye < 0.5) {
        place('saturn', 'Saturn', planetDots.get('saturn').position, '', 10, -6, 1 - eye * 2);
        place('voyager', 'Voyager 1', voyager, 'is-craft', 10, -18, 1 - eye * 2);
      } else {
        const a = smooth(0.6, 0.68, p);
        for (const name of ['venus', 'jupiter', 'saturn', 'uranus', 'neptune']) place(name, NAMES[name], planetDots.get(name).position, 'is-dim', 10, -6, a);
        place('earth', 'Earth · less than one pixel', earth, 'is-home', 12, -6, a);
        place('sun', 'The Sun', scratch.set(0, 0, 0), 'is-dim', 14, 16, a);
      }
    },
    edge(p) {
      showSystem(lerp(DAYS.portrait, DAYS.pause + 420, smooth(0.05, 0.95, p)));
      orbit(scratch.copy(voyager).multiplyScalar(0.42), -1.1 - p * 0.6, lerp(0.42, 0.2, p), 70 + voyager.length() * 2.5);
      place('voyager', 'Voyager 1', voyager, 'is-craft', 10, -18);
      place('sun', 'Sun & planets', scratch.set(0, 0, 0), 'is-dim', 12, 14);
      const day = lerp(DAYS.portrait, DAYS.pause + 420, smooth(0.05, 0.95, p));
      for (const m of milestones) if (m.day <= day && m.day > DAYS.portrait) place('m' + m.day, m.text, m.at, 'is-event', 12, 6);
    },
    lightday() {
      showSystem(today());
      orbit(scratch.copy(voyager).multiplyScalar(0.5), -1.75 + (reduced ? 0 : Math.sin(time * 0.08) * 0.2), 0.2, voyager.length() * 2.2);
      place('voyager', 'Voyager 1 · now', voyager, 'is-craft', 10, -18);
      place('sun', 'Sun & Earth', scratch.set(0, 0, 0), 'is-home', 12, 14);
      for (const m of milestones) if (m.day !== DAYS.lightDay) place('m' + m.day, m.text, m.at, 'is-event', 12, 6);
      const line = earthLine.geometry.attributes.position;
      line.setXYZ(0, earth.x, earth.y, earth.z); line.setXYZ(1, voyager.x, voyager.y, voyager.z);
      line.needsUpdate = true;
      // A day of light-travel, played in a few seconds: out, then back.
      const sinceHello = helloSentAt < 0 ? Infinity : (performance.now() - helloSentAt) / 1000;
      const cycle = sinceHello < 9 ? sinceHello / 4.5 : (reduced ? 0.6 : (time * 0.16) % 2);
      pulse.position.lerpVectors(earth, voyager, cycle < 1 ? cycle : 2 - cycle);
    },
    record(p) {
      const anchor = anchors.get('GoldenRecord');
      if (!anchor) return orbit(scratch.set(0, 0, 0), 0, 0.1, 6);
      anchor.getWorldPosition(scratch);
      const azimuth = Math.atan2(scratch.x, scratch.z) + lerp(0.5, -0.35, p) + drag.yaw;
      orbit(scratch, azimuth, 0.12 + drag.pitch * 0.5, lerp(3.4, 2.1, smooth(0, 0.7, p)));
    },
    future(p) {
      orbit(scratch.set(0, 1.2, 0), 2.6 + time * 0.04 + drag.yaw, 0.16, 22 * Math.pow(26, smooth(0.1, 1, p)));
    },
  };

  function enterStage(next) {
    stage = next;
    craft.visible = next === 'craft';
    sys.visible = next === 'system';
    flybys.jupiter.group.visible = next === 'jupiter';
    flybys.saturn.group.visible = next === 'saturn';
    clockEl.classList.toggle('is-on', next !== 'craft');
    fill.visible = next === 'craft';
    skyLight.intensity = next === 'craft' ? 0.9 : 0.08;
    if (next === 'craft') {
      sunLight.position.set(-14, 22, 16);
      sunLight.target.position.set(0, 0, 0);
    }
    snap = true;
  }
  let snap = true;

  const story = createStory($('story'), {
    onChapter(chapter) {
      // Fetch each planet a chapter early so it is there when the cut lands.
      if (chapter.id === 'launch' || chapter.id === 'jupiter') flybys.jupiter.load();
      if (chapter.id === 'jupiter' || chapter.id === 'cruise' || chapter.id === 'saturn') flybys.saturn.load();
    },
  });
  let past = false;

  function frame(now, dt) {
    const state = story.read();
    past = state.past;
    if (!reduced) time += dt;
    if (state.stage !== stage) enterStage(state.stage);
    renderer.getSize(size);
    wide = size.x > 860;

    // Reset what only some chapters touch.
    path.material.opacity = tip.material.opacity = 1;
    pathAhead.material.opacity = 0.16;
    voyagerDot.material.opacity = 1;
    drop.material.opacity = 0.3;
    planetDots.get('earth').userData.fraction = 0.018;
    $('sunbeams').style.opacity = 0;
    for (const btn of hotspots.values()) if (state.id !== 'craft') btn.style.display = 'none';
    const signal = state.id === 'lightday';
    earthLine.visible = pulse.visible = signal;

    CHAPTERS[state.id](state.progress);

    const lookingBack = state.id === 'portrait' ? smooth(0.36, 0.6, state.progress) : 0;
    const side = state.id === 'jupiter' || state.id === 'saturn' || state.id === 'record' ? -1 : 1;
    offset.tx = wide ? (side < 0 ? -0.2 : 0.15) : 0;
    offset.ty = wide ? 0 : 0.2;

    const k = snap || reduced ? 1 : 1 - Math.exp(-dt * 6);
    snap = false;
    current.position.lerp(pose.position, k);
    current.target.lerp(pose.target, k);
    current.fov = lerp(current.fov, pose.fov, k);
    offset.x = lerp(offset.x, offset.tx, k);
    offset.y = lerp(offset.y, offset.ty, k);
    camera.position.copy(current.position);
    camera.lookAt(current.target);
    camera.fov = current.fov;
    camera.setViewOffset(size.x, size.y, -offset.x * size.x, offset.y * size.y, size.x, size.y);

    // Dots hold their size on screen whatever the lens.
    const lens = 2 * Math.tan((camera.fov * Math.PI) / 360);
    for (const sprite of sprites) sprite.scale.setScalar(sprite.userData.fraction * lens);
    stars.points.position.copy(camera.position);
    stars.uniforms.uTime.value = time;

    if (stage === 'system') {
      const reach = camera.position.length();
      const far = smooth(45, 130, reach);
      shock.userData.uniforms.uOpacity.value = far;
      heliopause.userData.uniforms.uOpacity.value = far;
      shock.userData.uniforms.uTime.value = heliopause.userData.uniforms.uTime.value = time;
      shock.visible = heliopause.visible = far > 0.01;
      windUniforms.uOpacity.value = far;
      windUniforms.uTime.value = time;
      windUniforms.uPixel.value = renderer.getPixelRatio();
      const inner = 1 - smooth(60, 220, reach);
      orbitLines.forEach((line, i) => { line.material.opacity = (i < 4 ? 0.34 * (1 - smooth(18, 50, reach)) : 0.34) * lerp(0.5, 1, inner); line.visible = line.material.opacity > 0.01; });
      for (const name of ['mercury', 'venus', 'mars']) planetDots.get(name).visible = reach < 70 || state.id === 'portrait';
      for (const ring of rings) {
        ring.material.opacity = 0.16 * far;
        ring.visible = far > 0.01;
        if (far > 0.5) place('ring' + ring.userData.radius, ring.userData.radius + ' AU', scratch.set(-ring.userData.radius * 0.7, 0, ring.userData.radius * 0.714), 'is-dim', 4, 4, far * 0.8);
      }
      for (const m of milestones) m.dot.visible = far > 0.3 && state.id !== 'portrait';
      sunDot.userData.fraction = lerp(0.075, 0.045, far) * lerp(1, 0.5, lookingBack);
    }

    flushLabels();
    container.style.opacity = (1 - state.dim).toFixed(3);
    labelLayer.style.opacity = (1 - state.dim).toFixed(3);
    clockEl.style.visibility = state.dim > 0.6 ? 'hidden' : '';
    quality.frame(dt, drag.active);
    render();
  }

  const loop = SPACE.createFrameLoop(frame, { fps: 60, animated: () => !past, element: container });
  addEventListener('scroll', () => loop.invalidate(), { passive: true });
}
