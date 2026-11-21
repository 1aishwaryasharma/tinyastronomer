/* Voyager 1 — a scroll-driven story on three 3D sets:
     craft    the spacecraft itself, in metres
     system   the Sun, planets and Voyager's real path, in astronomical units
     flyby    Jupiter or Saturn with the real path past it, in planet radii
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a mission date and a camera pose. Every
   position Voyager takes comes from trajectory.json (JPL Horizons). */
import { SPACE } from '/common.bundle.js?v=20260909-2';
import {
  AU_KM, DAY_MS, PLANETS, createTrajectory, equatorialToEcliptic, formatDate,
  formatLightTime, planetOrbit, planetPosition, sampleRows,
} from '/mission-orbits.js?v=20261121-1';
import { createMissionKit, lerp, smooth } from '/mission-scene.js?v=20261121-1';
import { createChart } from '/mission-story.js?v=20261121-1';

const ASSETS = '/assets/missions/voyager-1/';
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
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

const drawJupiterChart = createChart($('chart-jupiter'), data.speed.jupiter, DAYS.jupiter);
drawJupiterChart(data.speed.jupiter[0][0]);

/* ──── 3D scene ──── */
const kit = createMissionKit();
if (kit) startScene(kit);

function startScene(kit) {
  const { THREE, scene, camera, renderer, E, addGlow, fatLine, setSegment, thinLoop, sunLight, skyLight, fill, place, anchors, setClock, pose, orbit, drag } = kit;

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
  kit.loadModel(ASSETS + 'voyager.glb', (gltf) => {
    craftModel.add(gltf.scene);
    kit.addHotspots(gltf.scene, PARTS, selectPart);
  }, { tracked: true });

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
          float rim = pow(max(0.0, 1.0 - abs(dot(normalize(vN), normalize(vV)))), 3.4);
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
      kit.loadPlanet(cfg.key, (root) => {
        spin.remove(stand);
        spin.add(root);
      });
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
        const next = cfg.path.findIndex((row) => row[0] > day);
        const index = next === -1 ? cfg.path.length - 1 : Math.max(0, next - 1);
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
  function cruiseClock(day, row) {
    const sunAu = Math.hypot(row[1], row[2], row[3]);
    setClock(formatDate(traj.msOf(day)),
      '<b>' + (sunAu < 20 ? sunAu.toFixed(2) : sunAu.toFixed(1)) + '</b> AU from the Sun',
      '<b>' + row[4].toFixed(1) + '</b> km/s');
  }

  /* ──── Chapters: progress → mission date and camera pose ──── */
  const voyager = new THREE.Vector3(), earth = new THREE.Vector3(), scratch = new THREE.Vector3();

  function showSystem(day, opts = {}) {
    const row = traj.at(day);
    E([row[1], row[2], row[3]], voyager);
    const ms = traj.msOf(day);
    for (const name of PLANETS) planetDots.get(name).position.copy(E(planetPosition(name, ms)));
    earth.copy(planetDots.get('earth').position);
    voyagerDot.position.copy(voyager);
    const next = traj.rows.findIndex((r) => r[0] > day);
    const index = next === -1 ? traj.rows.length - 1 : Math.max(0, next - 1);
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
      orbit(scratch.set(0, 1.2, 0), 0.75 + kit.time * 0.07 + drag.yaw, 0.2 + drag.pitch, lerp(21, 17, p));
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
      kit.showHotspots(selectedPart);
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
      orbit(scratch.copy(voyager).multiplyScalar(0.5), -1.75 + (kit.reduced ? 0 : Math.sin(kit.time * 0.08) * 0.2), 0.2, voyager.length() * 2.2);
      place('voyager', 'Voyager 1 · now', voyager, 'is-craft', 10, -18);
      place('sun', 'Sun & Earth', scratch.set(0, 0, 0), 'is-home', 12, 14);
      for (const m of milestones) if (m.day !== DAYS.lightDay) place('m' + m.day, m.text, m.at, 'is-event', 12, 6);
      const line = earthLine.geometry.attributes.position;
      line.setXYZ(0, earth.x, earth.y, earth.z); line.setXYZ(1, voyager.x, voyager.y, voyager.z);
      line.needsUpdate = true;
      // A day of light-travel, played in a few seconds: out, then back.
      const sinceHello = helloSentAt < 0 ? Infinity : (performance.now() - helloSentAt) / 1000;
      const cycle = sinceHello < 9 ? sinceHello / 4.5 : (kit.reduced ? 0.6 : (kit.time * 0.16) % 2);
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
      orbit(scratch.set(0, 1.2, 0), 2.6 + kit.time * 0.04 + drag.yaw, 0.16, 22 * Math.pow(26, smooth(0.1, 1, p)));
    },
  };

  function enterStage(next) {
    craft.visible = next === 'craft';
    sys.visible = next === 'system';
    flybys.jupiter.group.visible = next === 'jupiter';
    flybys.saturn.group.visible = next === 'saturn';
    kit.clock.classList.toggle('is-on', next !== 'craft');
    // The planets keep their true night side: no fill light in the flybys.
    fill.visible = next === 'craft';
    skyLight.intensity = next === 'craft' ? 0.9 : 0.08;
    if (next === 'craft') {
      sunLight.position.set(-14, 22, 16);
      sunLight.target.position.set(0, 0, 0);
    }
  }

  kit.run({
    chapters: CHAPTERS,
    enterStage,
    canDrag: () => kit.stage === 'craft',
    onChapter(chapter) {
      // Fetch each planet a chapter early so it is there when the cut lands.
      if (chapter.id === 'launch' || chapter.id === 'jupiter') flybys.jupiter.load();
      if (chapter.id === 'jupiter' || chapter.id === 'cruise' || chapter.id === 'saturn') flybys.saturn.load();
    },
    // Keep the subject clear of the card: beside it on wide screens, above
    // it on phones.
    offset(state, wide) {
      const cardOnRight = state.id === 'jupiter' || state.id === 'saturn' || state.id === 'record';
      return wide ? [cardOnRight ? -0.2 : 0.15, 0] : [0, 0.2];
    },
    before(state) {
      path.material.opacity = tip.material.opacity = 1;
      pathAhead.material.opacity = 0.16;
      voyagerDot.material.opacity = 1;
      drop.material.opacity = 0.3;
      planetDots.get('earth').userData.fraction = 0.018;
      $('sunbeams').style.opacity = 0;
      earthLine.visible = pulse.visible = state.id === 'lightday';
    },
    after(state) {
      if (kit.stage !== 'system') return;
      const lookingBack = state.id === 'portrait' ? smooth(0.36, 0.6, state.progress) : 0;
      const reach = camera.position.length();
      const far = smooth(45, 130, reach);
      shock.userData.uniforms.uOpacity.value = far;
      heliopause.userData.uniforms.uOpacity.value = far;
      shock.userData.uniforms.uTime.value = heliopause.userData.uniforms.uTime.value = kit.time;
      shock.visible = heliopause.visible = far > 0.01;
      windUniforms.uOpacity.value = far;
      windUniforms.uTime.value = kit.time;
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
    },
  });
}
