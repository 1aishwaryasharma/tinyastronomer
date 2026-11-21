/* Cassini–Huygens — a scroll-driven story on six 3D sets:
     craft      the spacecraft and its probe, in metres
     system     the Sun, planets and Cassini's real path to Saturn, in AU
     saturn     Saturn with the real path around it, in Saturn radii: orbit
                insertion (soi), all 13 years (tour) and the last 22 orbits
                (finale) each play on it as a stage of their own
     titan      Titan with Huygens falling to it, in Titan radii
     enceladus  Enceladus and the dive through its plume, in Enceladus radii
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a mission date and a camera pose. Every
   position Cassini or Huygens takes comes from trajectory.json and tour.bin
   (JPL Horizons). */
import { SPACE } from '/common.bundle.js?v=20260909-2';
import {
  AU_KM, DAY_MS, LIGHT_KM_PER_SEC, equatorialToEcliptic, formatDate,
  formatLightTime, planetOrbit, planetPosition, sampleRows,
} from '/mission-orbits.js?v=20261121-1';
import { createMissionKit, lerp, smooth } from '/mission-scene.js?v=20261121-1';
import { createChart } from '/mission-story.js?v=20261121-1';

const ASSETS = '/assets/missions/cassini/';
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const km = (value) => Math.round(value).toLocaleString('en-US');
const pad = (n) => String(n).padStart(2, '0');

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const EPOCH_MS = Date.parse(data.epoch);
const msOf = (day) => EPOCH_MS + day * DAY_MS;
const dayOn = (y, m, d, h = 0, min = 0) => (Date.UTC(y, m - 1, d, h, min) - EPOCH_MS) / DAY_MS;
const clockTime = (ms, seconds = false) => {
  const d = new Date(ms);
  return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + (seconds ? ':' + pad(d.getUTCSeconds()) : '') + ' UTC';
};
const DAYS = {
  arrival: data.cruise[data.cruise.length - 1][0],
  soi: data.soi.closestDay,
  // NASA: the engine fired for 96 minutes from 01:12 UTC at Saturn.
  burnStart: dayOn(2004, 7, 1, 1, 12),
  burnEnd: dayOn(2004, 7, 1, 2, 48),
  entry: data.titan.entryDay,
  landed: data.titan.landDay,
  plume: data.enceladus.closestDay,
  equinoxMission: dayOn(2008, 7, 1),
  solsticeMission: dayOn(2010, 9, 27),
  finale: dayOn(2017, 4, 22),
  end: data.end.day,
};

/* ──── Live figures: these run with or without the 3D scene ──── */
// How far a radio message has to travel between Saturn and Earth this
// second. Cassini's last signal took 83 minutes.
function tickLive() {
  const now = Date.now();
  const saturn = planetPosition('saturn', now), earth = planetPosition('earth', now);
  const gapKm = Math.hypot(saturn[0] - earth[0], saturn[1] - earth[1], saturn[2] - earth[2]) * AU_KM;
  SPACE.setText($('hero-saturn-km'), km(gapKm / 1e6));
  SPACE.setText($('hero-signal'), formatLightTime(gapKm / LIGHT_KM_PER_SEC));
}
tickLive();
setInterval(tickLive, 1000);

/* ──── Spacecraft parts ──── */
const PARTS = [
  { key: 'HighGainAntenna', label: 'Big dish', title: 'High-gain antenna',
    text: 'A 4-metre dish built in Italy. It sent every picture home, and worked as a radar to see through Titan’s haze. In risky spots Cassini flew dish-first and used it as a shield.' },
  { key: 'HuygensProbe', label: 'Huygens', title: 'The Huygens probe',
    text: 'Europe’s Titan lander, 2.7 metres across, rode on Cassini’s side for seven years. The gold shell is a heat shield. Inside were six instruments and three parachutes.' },
  { key: 'RTG', label: 'Power', title: 'Nuclear batteries',
    text: 'Sunlight at Saturn is about a hundred times weaker than at Earth. Three generators turned the heat of decaying plutonium into electricity instead.' },
  { key: 'MagnetometerBoom', label: 'Long boom', title: 'Magnetometer boom',
    text: 'An 11-metre arm that unfolded after the Earth flyby. It held magnetic sensors far from the spacecraft’s own electronics. They found the first hint of Enceladus’s plume.' },
  { key: 'RemoteSensingPallet', label: 'Cameras', title: 'Cameras and telescopes',
    text: 'Two cameras and three other telescopes, all bolted to one platform and all looking the same way. To aim them, the whole spacecraft had to turn.' },
  { key: 'RPWSAntennas', label: 'Whiskers', title: 'Radio and plasma antennas',
    text: 'Three 10-metre rods that listened to radio waves from Saturn’s lightning and auroras, and felt ring dust pattering against the spacecraft.' },
  { key: 'MainEngines', label: 'Engines', title: 'Main engines',
    text: 'Two engines, one of them a spare. A single 96-minute burn slowed Cassini enough for Saturn to catch it. More than half of Cassini’s launch weight was fuel.' },
  { key: 'Bus', label: 'Body', title: 'The body',
    text: 'A stack nearly 7 metres tall: computers and radios in the ring under the dish, then the fuel tanks, wrapped in gold-coloured blankets against the cold.' },
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

/* ──── Speed chart: one trace, four flybys ──── */
const FLYBYS = ['venus1', 'venus2', 'earth', 'jupiter'].map((key) => ({ key, ...data.flybys[key] }));
const chartCanvas = $('chart-cruise');
const drawSpeed = createChart(chartCanvas, data.speed, FLYBYS[3].day, { eventLabel: '' });
// The shared chart labels one event. Mark all four on top of it, using the
// same horizontal scale (30 px of axis on the left, 4 px on the right).
let chartKey = '';
function drawCruiseChart(day) {
  drawSpeed(day);
  const w = chartCanvas.clientWidth, h = chartCanvas.clientHeight;
  const key = w + ':' + h + ':' + day.toFixed(3);
  if (!w || !h || key === chartKey) return;
  chartKey = key;
  const ctx = chartCanvas.getContext('2d');
  const t0 = data.speed[0][0], t1 = data.speed[data.speed.length - 1][0];
  ctx.font = '10px "Fragment Mono", monospace';
  ctx.textAlign = 'center';
  for (const flyby of FLYBYS) {
    const x = 30 + ((flyby.day - t0) / (t1 - t0)) * (w - 34);
    const passed = day >= flyby.day;
    ctx.fillStyle = passed ? '#f4c560' : 'rgba(232,236,244,0.5)';
    ctx.fillRect(Math.round(x), h - 17, 1, 4);
    ctx.fillText(flyby.name[0], x, h - 3);
  }
  ctx.textAlign = 'left';
}
drawCruiseChart(data.speed[0][0]);

/* ──── 3D scene ──── */
const kit = createMissionKit();
if (kit) startScene(kit);

function startScene(kit) {
  const { THREE, scene, renderer, E, addGlow, fatLine, setSegment, thinLoop, sunLight, skyLight, fill, place, anchors, setClock, pose, orbit, drag } = kit;
  const GOLD = new THREE.Color(0xf4c560);
  const bright = (color) => new THREE.Color(color).multiplyScalar(1.5);
  const scratch = new THREE.Vector3(), scratch2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // A sampled path: `days` ascending, `points` flat scene coordinates.
  function makeTrack(days, points) {
    const count = days.length;
    const indexAt = (day) => {
      if (day <= days[0]) return 0;
      if (day >= days[count - 1]) return count - 1;
      let lo = 0, hi = count - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (days[mid] <= day) lo = mid; else hi = mid; }
      return lo;
    };
    const point = (i, out) => out.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
    const next = new THREE.Vector3();
    function at(day, out) {
      const i = indexAt(day);
      if (i >= count - 1) return point(count - 1, out);
      const f = clamp01((day - days[i]) / (days[i + 1] - days[i]));
      return point(i, out).lerp(point(i + 1, next), f);
    }
    return { days, points, count, indexAt, point, at };
  }
  // Rows of [day, x, y, z] in km, into scene units of `unitKm`.
  function trackFromRows(rows, unitKm) {
    const points = new Float32Array(rows.length * 3);
    rows.forEach((row, i) => { points[i * 3] = row[1] / unitKm; points[i * 3 + 1] = row[3] / unitKm; points[i * 3 + 2] = -row[2] / unitKm; });
    return makeTrack(Float64Array.from(rows, (row) => row[0]), points);
  }
  // tour.bin: x, y, z as signed 16-bit and the time since the last sample.
  function trackFromBin(buffer, meta, unitKm) {
    const view = new DataView(buffer, meta.byteOffset, meta.count * 8);
    const days = new Float64Array(meta.count), points = new Float32Array(meta.count * 3);
    const k = meta.unitKm / unitKm;
    let tick = 0;
    for (let i = 0; i < meta.count; i++) {
      tick += view.getUint16(i * 8 + 6, true);
      days[i] = meta.startDay + (tick * meta.stepSeconds) / 86400;
      points[i * 3] = view.getInt16(i * 8, true) * k;
      points[i * 3 + 1] = view.getInt16(i * 8 + 4, true) * k;
      points[i * 3 + 2] = -view.getInt16(i * 8 + 2, true) * k;
    }
    return makeTrack(days, points);
  }
  // A path drawn in two strengths: faint for what is still ahead, bright for
  // what has been flown, with one more segment out to the exact position.
  function trail(parent, track, { color = GOLD, width = 2.6, ahead = 0.2, from = 0, to = track.count - 1 } = {}) {
    const flat = track.points.subarray(from * 3, (to + 1) * 3);
    const aheadLine = ahead ? fatLine(flat, color, 1.1, ahead) : null;
    const done = fatLine(flat, bright(color), width);
    const lead = fatLine([0, 0, 0, 0, 0, 1], bright(color), width);
    if (aheadLine) parent.add(aheadLine);
    parent.add(done, lead);
    const here = new THREE.Vector3(), start = new THREE.Vector3();
    return {
      here, done, lead, ahead: aheadLine,
      lines: aheadLine ? [aheadLine, done, lead] : [done, lead],
      update(day) {
        const index = Math.max(from, Math.min(to, track.indexAt(day)));
        done.geometry.instanceCount = index - from;
        track.at(Math.max(track.days[from], Math.min(track.days[to], day)), here);
        setSegment(lead, track.point(index, start), here);
        lead.visible = day >= track.days[from];
        return here;
      },
    };
  }
  const occludable = (object) => { object.material.depthTest = true; object.renderOrder = 3; return object; };
  const toSunAt = (ms, out) => E(planetPosition('saturn', ms), out).normalize().negate();
  function aimSun(direction) {
    sunLight.position.copy(direction).multiplyScalar(200);
    sunLight.target.position.set(0, 0, 0);
  }
  const SATURN_POLE = E(equatorialToEcliptic(40.589, 83.537)).normalize();
  function canvasTexture(width, height, paint) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    paint(c.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /* ════ Set 1: the spacecraft ════ */
  const craft = new THREE.Group();
  // The model's dish points along +Z; stand it up so the dish is on top and
  // the Huygens probe faces the default camera.
  const craftModel = new THREE.Group();
  craftModel.rotation.x = -Math.PI / 2;
  craft.add(craftModel);
  scene.add(craft);
  // Huygens gets a pivot at its own centre so it can spin and drift away.
  const probe = new THREE.Group();
  kit.loadModel(ASSETS + 'cassini.glb', (gltf) => {
    craftModel.add(gltf.scene);
    craft.updateMatrixWorld(true);
    const shell = gltf.scene.getObjectByName('HuygensProbe');
    if (shell) {
      new THREE.Box3().setFromObject(shell).getCenter(probe.position);
      gltf.scene.worldToLocal(probe.position);
      gltf.scene.add(probe);
      probe.userData.home = probe.position.clone();
      probe.attach(shell);
      const anchor = gltf.scene.getObjectByName('Hotspot_HuygensProbe');
      if (anchor) probe.attach(anchor);
    }
    kit.addHotspots(gltf.scene, PARTS, selectPart);
  }, { tracked: true });
  // Where the probe sits `metres` out along its own axis (the model's -Y),
  // after `turns` of spin.
  function setProbe(metres, turns, visible = true) {
    if (!probe.userData.home) return;
    probe.position.copy(probe.userData.home);
    probe.position.y -= metres;
    probe.rotation.y = turns * Math.PI * 2;
    probe.visible = visible;
  }

  /* ════ Set 2: the solar system ════ */
  const sys = new THREE.Group();
  scene.add(sys);
  const SYSTEM_PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn'];
  const PLANET_COLORS = { mercury: 0x9a9088, venus: 0xe6cf9a, earth: 0x6ab0ff, mars: 0xd0674a, jupiter: 0xd9b38c, saturn: 0xe6d3a0 };
  const orbitDate = Date.UTC(2001, 0, 1);
  for (const name of SYSTEM_PLANETS) sys.add(thinLoop(planetOrbit(name, orbitDate).map((p) => E(p)), PLANET_COLORS[name], 0.34));
  const planetDots = new Map(SYSTEM_PLANETS.map((name) => [name, addGlow(sys, PLANET_COLORS[name], 0.018, 1.6)]));
  addGlow(sys, 0xffc060, 0.042, 5);
  addGlow(sys, 0xfff2cc, 0.02, 8);
  const cruiseTrack = (() => {
    const points = new Float32Array(data.cruise.length * 3);
    data.cruise.forEach((row, i) => { points[i * 3] = row[1]; points[i * 3 + 1] = row[3]; points[i * 3 + 2] = -row[2]; });
    return makeTrack(Float64Array.from(data.cruise, (row) => row[0]), points);
  })();
  const cruiseTrail = trail(sys, cruiseTrack, { width: 2.4, ahead: 0.16 });
  const cruiseDot = addGlow(sys, 0xffe7b0, 0.03, 4);
  const flybyMarks = FLYBYS.map((flyby, i) => {
    const dot = addGlow(sys, 0x6ab0ff, 0.012, 3);
    cruiseTrack.at(flyby.day, dot.position);
    const year = new Date(msOf(flyby.day)).getUTCFullYear();
    return { ...flyby, dot, text: flyby.name + ' flyby · ' + year, dy: i === 1 ? -20 : 6 };
  });

  /* ════ Set 3: Saturn ════ */
  const sat = new THREE.Group();
  scene.add(sat);
  const saturnTilt = new THREE.Group(), saturnSpin = new THREE.Group();
  saturnTilt.quaternion.setFromUnitVectors(UP, SATURN_POLE);
  saturnTilt.add(saturnSpin);
  sat.add(saturnTilt);
  const saturnStand = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 0.9, metalness: 0 }));
  saturnStand.scale.y = 0.902;
  saturnSpin.add(saturnStand);
  let saturnRequested = false;
  function loadSaturn() {
    if (saturnRequested) return;
    saturnRequested = true;
    kit.loadPlanet('saturn', (root) => {
      // The kit sizes a planet by its mean radius. The dives of the Grand
      // Finale clear the equator by a few per cent of it, so here one unit
      // has to be the equatorial radius exactly.
      const body = root.children.find((child) => !/ring/i.test(child.name)) || root;
      root.updateMatrixWorld(true);
      const k = 2 / new THREE.Box3().setFromObject(body).getSize(scratch).x;
      root.scale.multiplyScalar(k);
      root.position.multiplyScalar(k);
      root.traverse((node) => {
        if (!node.isMesh || !/ring/i.test(node.name)) return;
        node.material.side = THREE.DoubleSide;
        node.material.depthWrite = false;
      });
      saturnSpin.remove(saturnStand);
      saturnSpin.add(root);
    });
  }
  const SATURN_KM = data.saturnKm;
  // Height above the level where Saturn's air is as thick as Earth's at the
  // sea, which is what "the cloud tops" means; Saturn bulges at its equator.
  function aboveClouds(position) {
    const r = position.length(), sinLat = position.dot(SATURN_POLE) / r;
    const polar = 54364 / SATURN_KM;
    return (r - polar / Math.sqrt(polar * polar * (1 - sinLat * sinLat) + sinLat * sinLat)) * SATURN_KM;
  }
  const titanLoop = data.titanOrbit.path, titanPeriod = data.titanOrbit.periodDays;
  // Titan on any day of the tour: the one measured lap, repeated.
  function titanAt(day, out) {
    const start = titanLoop[0][0];
    const row = sampleRows(titanLoop, start + ((((day - start) % titanPeriod) + titanPeriod) % titanPeriod));
    return out.set(row[1] / SATURN_KM, row[3] / SATURN_KM, -row[2] / SATURN_KM);
  }

  // Stage: orbit insertion.
  const soiSet = new THREE.Group();
  sat.add(soiSet);
  const soiTrack = trackFromRows(data.soi.path, SATURN_KM);
  const soiTrail = trail(soiSet, soiTrack, { width: 2.8, ahead: 0.24 });
  soiTrail.lines.forEach(occludable);
  const burnFrom = soiTrack.indexAt(DAYS.burnStart) + 1, burnTo = soiTrack.indexAt(DAYS.burnEnd);
  const burnLine = occludable(fatLine(soiTrack.points.subarray(burnFrom * 3, (burnTo + 1) * 3), new THREE.Color(0xff7a3c).multiplyScalar(1.6), 5));
  soiSet.add(burnLine);
  const soiDot = addGlow(soiSet, 0xffe7b0, 0.03, 4);
  const crossings = data.soi.crossings.map((crossing) => soiTrack.at(crossing.day, new THREE.Vector3()));
  const soiPeri = soiTrack.at(DAYS.soi, new THREE.Vector3()).normalize();
  const soiSun = toSunAt(msOf(DAYS.soi), new THREE.Vector3());
  // The view direction in the ring plane: between the Sun and the point of
  // closest approach, so both the lit face and the pass are in sight.
  const soiView = soiSun.clone().addScaledVector(SATURN_POLE, -soiSun.dot(SATURN_POLE)).normalize().multiplyScalar(0.8).add(soiPeri).normalize();

  // Stage: the whole tour. Filled in when tour.bin arrives.
  const tourSet = new THREE.Group();
  sat.add(tourSet);
  const PHASES = [
    { name: 'Prime mission', from: -Infinity, color: 0xf4c560 },
    { name: 'Equinox mission', from: DAYS.equinoxMission, color: 0x6fd6c4 },
    { name: 'Solstice mission', from: DAYS.solsticeMission, color: 0x8fb0ff },
    { name: 'Grand Finale', from: DAYS.finale, color: 0xff8f6b },
  ];
  const phaseAt = (day) => PHASES.findLast((phase) => day >= phase.from);
  tourSet.add(thinLoop(titanLoop.map((row) => new THREE.Vector3(row[1] / SATURN_KM, row[3] / SATURN_KM, -row[2] / SATURN_KM)), 0xe8a04a, 0.5));
  const tourTitan = addGlow(tourSet, 0xe8a04a, 0.016, 2.2);
  const tourDot = addGlow(tourSet, 0xffe7b0, 0.026, 4);
  const tourPos = new THREE.Vector3(), titanPos = new THREE.Vector3();
  let tourTrack = null, tourTrails = [];

  // Stage: the Grand Finale.
  const finaleSet = new THREE.Group();
  sat.add(finaleSet);
  const finaleDot = addGlow(finaleSet, 0xffe7b0, 0.03, 4);
  finaleDot.material.depthTest = true;
  const finaleFlash = addGlow(finaleSet, 0xffb070, 0.05, 5);
  const dives = data.finale.periapses;
  const finaleSun = toSunAt(msOf(DAYS.end), new THREE.Vector3());
  const finaleGap = new THREE.Vector3(), finaleSide = new THREE.Vector3(), finaleEnd = new THREE.Vector3();
  let finaleTrack = null, finaleTrail = null, finaleGapRadius = 1.05;

  fetch(ASSETS + 'tour.bin').then((response) => response.arrayBuffer()).then((buffer) => {
    tourTrack = trackFromBin(buffer, data.tour, SATURN_KM);
    tourTrails = PHASES.map((phase, i) => {
      const from = i ? tourTrack.indexAt(phase.from) : 0;
      const to = i < PHASES.length - 1 ? tourTrack.indexAt(PHASES[i + 1].from) : tourTrack.count - 1;
      const line = trail(tourSet, tourTrack, { color: phase.color, width: 1.3, ahead: 0, from, to });
      line.done.material.opacity = 0.62;
      return line;
    });
    finaleTrack = trackFromBin(buffer, data.finale, SATURN_KM);
    finaleTrail = trail(finaleSet, finaleTrack, { color: 0xff8f6b, width: 1.8, ahead: 0.14 });
    finaleTrail.lines.forEach(occludable);
    // Every dive crosses the ring plane at nearly the same place: the gap.
    let crossed = 0;
    for (let i = 1; i < finaleTrack.count; i++) {
      const a = finaleTrack.point(i - 1, scratch).dot(SATURN_POLE), b = finaleTrack.point(i, scratch2).dot(SATURN_POLE);
      if (a * b > 0 || scratch2.length() > 1.3) continue;
      finaleGap.add(scratch.lerp(scratch2, a / (a - b)));
      crossed++;
    }
    finaleGap.divideScalar(crossed);
    finaleGapRadius = finaleGap.length();
    finaleGap.normalize();
    finaleSide.crossVectors(SATURN_POLE, finaleGap).normalize();
    finaleTrack.at(DAYS.end, finaleEnd);
    kit.invalidate();
  }).catch((error) => console.warn('Tour data unavailable', error));

  /* ════ Set 4: Titan ════ */
  const TITAN_KM = data.titanKm;
  const titanSet = new THREE.Group();
  scene.add(titanSet);
  const titanGlobe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshStandardMaterial({
    roughness: 1, metalness: 0,
    map: canvasTexture(512, 256, (g, w, h) => {
      // No surface: from outside, Titan is a ball of orange smog with a
      // slightly darker northern half.
      const bands = g.createLinearGradient(0, 0, 0, h);
      bands.addColorStop(0, '#b9792f'); bands.addColorStop(0.42, '#cf8f3c'); bands.addColorStop(0.5, '#dba04a'); bands.addColorStop(1, '#d99a45');
      g.fillStyle = bands; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(' + (i % 2 ? '255,214,150' : '120,70,20') + ',0.035)';
        g.fillRect(0, Math.random() * h, w, 3 + Math.random() * 12);
      }
    }),
  }));
  titanGlobe.quaternion.setFromUnitVectors(UP, SATURN_POLE);
  titanSet.add(titanGlobe);
  // The haze reaches far above the surface; a thin detached layer sits on top.
  function hazeShell(radius, color, strength, power) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uPower: { value: power }, uSun: { value: new THREE.Vector3(1, 0, 0) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: `
        varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          vW = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vV; varying vec3 vW;
        uniform vec3 uColor; uniform float uStrength; uniform float uPower; uniform vec3 uSun;
        void main() {
          // Seen from inside-out (back faces): brightest where the line of
          // sight grazes the shell, and only on the sunlit side.
          float facing = abs(dot(normalize(vN), normalize(vV)));
          float rim = pow(1.0 - facing, uPower) * smoothstep(0.0, 0.3, facing);
          float lit = smoothstep(-0.35, 0.5, dot(normalize(vW), uSun));
          gl_FragColor = vec4(uColor * rim * lit * uStrength, 1.0);
        }`,
    }));
    titanSet.add(mesh);
    return mesh;
  }
  const hazes = [hazeShell(1.1, 0xe09a45, 0.9, 2.0), hazeShell(1.2, 0x7d8fd9, 0.45, 3.0)];
  const huygensTrack = trackFromRows(data.titan.huygens, TITAN_KM);
  const cassiniTitanTrack = trackFromRows(data.titan.cassini, TITAN_KM);
  const huygensTrail = trail(titanSet, huygensTrack, { color: 0xfff0c8, width: 2.6, ahead: 0.24 });
  const cassiniTitanTrail = trail(titanSet, cassiniTitanTrack, { width: 2.2, ahead: 0.18 });
  [...huygensTrail.lines, ...cassiniTitanTrail.lines].forEach(occludable);
  const huygensDot = addGlow(titanSet, 0xffffff, 0.026, 4);
  const cassiniTitanDot = addGlow(titanSet, 0xffe7b0, 0.026, 4);
  const relay = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  relay.frustumCulled = false;
  titanSet.add(relay);
  const landingSite = huygensTrack.at(DAYS.landed, new THREE.Vector3()).normalize();
  const titanSun = toSunAt(msOf(DAYS.entry), new THREE.Vector3());
  hazes.forEach((haze) => haze.material.uniforms.uSun.value.copy(titanSun));

  /* ════ Set 5: Enceladus ════ */
  const ENCELADUS_KM = data.enceladusKm;
  const enceladusSet = new THREE.Group();
  scene.add(enceladusSet);
  const enceladusTilt = new THREE.Group();
  enceladusTilt.quaternion.setFromUnitVectors(UP, SATURN_POLE);
  enceladusSet.add(enceladusTilt);
  const STRIPES = [-0.2, -0.07, 0.06, 0.19];
  const enceladusGlobe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({
    roughness: 0.85, metalness: 0,
    map: canvasTexture(1024, 512, (g, w, h) => {
      g.fillStyle = '#eef3f8'; g.fillRect(0, 0, w, h);
      let state = 21;
      const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
      // Old cratered ground in the north, smooth young ice in the south.
      for (let i = 0; i < 520; i++) {
        const y = Math.pow(random(), 1.6) * h * 0.62, r = 1.5 + random() * 6;
        g.strokeStyle = 'rgba(120,140,165,' + (0.1 + random() * 0.16) + ')';
        g.beginPath(); g.ellipse(random() * w, y, r / Math.max(0.25, Math.sin((y / h) * Math.PI)), r, 0, 0, Math.PI * 2); g.stroke();
      }
      g.strokeStyle = 'rgba(140,160,185,0.16)';
      for (let i = 0; i < 70; i++) {
        const x = random() * w, y = h * (0.3 + random() * 0.5);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (random() - 0.5) * 120, y + (random() - 0.5) * 50); g.stroke();
      }
      // Four cracks across the south pole: the "tiger stripes".
      g.fillStyle = 'rgba(70,150,200,0.85)';
      for (const offset of STRIPES) {
        for (let t = -0.3; t <= 0.3; t += 0.004) {
          const across = offset + Math.sin(t * 9 + offset * 20) * 0.012;
          const fromPole = Math.hypot(across, t), longitude = Math.atan2(t, across);
          g.fillRect((longitude / (Math.PI * 2) + 0.5) * w - 1.5, h * (1 - fromPole / Math.PI) - 1, 3 / Math.max(0.05, Math.sin(fromPole)), 2);
        }
      }
    }),
  }));
  enceladusGlobe.scale.set(data.enceladus.equatorKm / ENCELADUS_KM, data.enceladus.polarKm / ENCELADUS_KM, data.enceladus.equatorKm / ENCELADUS_KM);
  enceladusTilt.add(enceladusGlobe);
  // The plume: ice grains thrown from points along the four cracks, mostly
  // straight down from the pole, slowing and thinning as they climb.
  const plumeUniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uOpacity: { value: 1 } };
  const plume = (() => {
    const count = 4200;
    const start = new Float32Array(count * 3), aim = new Float32Array(count * 3), seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const across = STRIPES[i % 4] + (Math.random() - 0.5) * 0.02, along = (Math.random() - 0.5) * 0.5;
      const fromPole = Math.hypot(across, along), longitude = Math.atan2(along, across);
      const ground = new THREE.Vector3(Math.sin(fromPole) * Math.cos(longitude), -Math.cos(fromPole), Math.sin(fromPole) * Math.sin(longitude));
      const lean = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      const direction = ground.clone().multiplyScalar(0.35).add(new THREE.Vector3(0, -1, 0)).add(lean).normalize();
      ground.multiplyScalar(0.985).toArray(start, i * 3);
      direction.toArray(aim, i * 3);
      seed.set([Math.random(), 0.45 + Math.random() * 0.9], i * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(start, 3));
    geometry.setAttribute('aim', new THREE.BufferAttribute(aim, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms: { ...plumeUniforms, uColor: { value: new THREE.Color(0xbfe0ff) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aim; attribute vec2 seed; uniform float uTime; uniform float uPixel; uniform float uOpacity;
        varying float vAlpha;
        void main() {
          float f = fract(seed.x + uTime * 0.045 * seed.y);
          float reach = 3.4 * seed.y;
          vec3 p = position + aim * (f * (2.0 - f)) * 0.5 * reach;
          vAlpha = uOpacity * smoothstep(0.0, 0.04, f) * pow(1.0 - f, 1.6) * 0.26;
          gl_PointSize = (1.6 + f * 2.6) * uPixel;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor * vAlpha * (1.0 - smoothstep(0.1, 0.5, d)), 1.0);
        }`,
    }));
    points.frustumCulled = false;
    enceladusTilt.add(points);
    return points;
  })();
  const plumeTrack = trackFromRows(data.enceladus.path, ENCELADUS_KM);
  const plumeTrail = trail(enceladusSet, plumeTrack, { width: 2.8, ahead: 0.26 });
  plumeTrail.lines.forEach(occludable);
  const plumeDot = addGlow(enceladusSet, 0xffe7b0, 0.028, 4);
  plumeDot.material.depthTest = true;
  const plumeSun = toSunAt(msOf(DAYS.plume), new THREE.Vector3());
  const southPole = SATURN_POLE.clone().negate();
  // Look from the sunlit side, square to both the pole and the flight path.
  const plumeView = (() => {
    const a = plumeTrack.at(DAYS.plume - 0.002, new THREE.Vector3()), b = plumeTrack.at(DAYS.plume + 0.002, new THREE.Vector3());
    const view = b.sub(a).normalize().cross(SATURN_POLE).normalize();
    if (view.dot(plumeSun) < 0) view.negate();
    return view;
  })();
  function enceladusGround(position) {
    const sinLat = position.dot(SATURN_POLE) / position.length();
    const a = data.enceladus.equatorKm, c = data.enceladus.polarKm;
    return 1 / Math.sqrt((1 - sinLat * sinLat) / (a * a) + (sinLat * sinLat) / (c * c));
  }

  /* ──── Chapters: progress → mission date and camera pose ──── */
  const cassini = new THREE.Vector3();

  // The inner flybys take a third of the days but most of the story.
  const cruiseDay = (p) => (p < 0.56 ? lerp(1, 720, p / 0.56) : lerp(720, DAYS.arrival, (p - 0.56) / 0.44));
  // Twenty-two quick laps, then the last half-lap with its final hours
  // stretched out.
  const lastDive = dives[dives.length - 1].day;
  function finaleDay(p) {
    if (p < 0.7) return lerp(dives[0].day - 2.2, lastDive + 0.6, p / 0.7);
    return lerp(lastDive + 0.6, DAYS.end, 1 - Math.pow(1 - (p - 0.7) / 0.3, 3));
  }

  // The picture dims at each change of set, over the first and last fifteenth
  // or so of a chapter. Play the chapter inside what is left, so nothing
  // happens in the dark.
  const lit = (p, margin = 0.07) => clamp01((p - margin) / (1 - 2 * margin));

  const CHAPTERS = {
    hero(p) {
      setProbe(0, 0);
      orbit(scratch.set(1.2, 0, 0), 0.5 + kit.time * 0.07 + drag.yaw, 0.16 + drag.pitch, lerp(27, 23, p));
    },
    craft(p) {
      setProbe(0, 0);
      const anchor = selectedPart && anchors.get(selectedPart);
      if (anchor) {
        anchor.getWorldPosition(scratch);
        const out = scratch.clone().setY(0);
        const azimuth = (out.lengthSq() > 0.2 ? Math.atan2(out.x, out.z) : 0.6) + 0.5 + drag.yaw;
        orbit(scratch.multiplyScalar(0.85), azimuth, 0.26 + Math.sign(scratch.y) * 0.1 + drag.pitch, 10 + scratch.length() * 0.9);
      } else {
        orbit(scratch.set(1.2, 0, 0), 0.5 + p * 2.6 + drag.yaw, 0.2 + drag.pitch, 24);
      }
      kit.showHotspots(selectedPart);
    },
    cruise(raw) {
      const p = lit(raw);
      const day = cruiseDay(p), ms = msOf(day);
      cruiseTrail.update(day);
      cassini.copy(cruiseTrail.here);
      cruiseDot.position.copy(cassini);
      for (const name of SYSTEM_PLANETS) E(planetPosition(name, ms), planetDots.get(name).position);
      const reach = cassini.length();
      orbit(scratch.copy(cassini).multiplyScalar(0.42), -0.5 + p * 0.9, lerp(1.05, 0.72, p), 3.6 + reach * 2.3);
      const row = sampleRows(data.cruise, day);
      setClock(formatDate(ms), '<b>' + reach.toFixed(2) + '</b> AU from the Sun', '<b>' + row[4].toFixed(1) + '</b> km/s');
      place('cassini', 'Cassini', cassini, 'is-craft', 10, -18);
      place('earth', 'Earth', planetDots.get('earth').position, 'is-home');
      place('venus', 'Venus', planetDots.get('venus').position, '', 10, 8);
      if (reach > 2.2) {
        place('jupiter', 'Jupiter', planetDots.get('jupiter').position);
        place('saturn', 'Saturn', planetDots.get('saturn').position);
      }
      for (const mark of flybyMarks) {
        mark.dot.visible = day >= mark.day;
        if (day >= mark.day && (reach < 2.2 || mark.key === 'jupiter')) place('fly-' + mark.key, mark.text, mark.dot.position, 'is-event', 12, mark.dy);
      }
      drawCruiseChart(day);
    },
    arrival(raw) {
      const p = lit(raw);
      const day = lerp(DAYS.soi - 0.34, DAYS.soi + 0.3, smooth(0, 1, p) * 0.4 + p * 0.6);
      const here = soiTrail.update(day);
      soiDot.position.copy(here);
      saturnSpin.rotation.y = (day / 0.44401) * Math.PI * 2;
      aimSun(soiSun);
      const burnIndex = soiTrack.indexAt(day);
      burnLine.geometry.instanceCount = Math.max(0, Math.min(burnTo, burnIndex) - burnFrom);
      // From the sunlit south side, a little below the rings, swinging with
      // the pass.
      const near = 1 - Math.abs(p - 0.5) * 2;
      pose.position.copy(soiView).applyAxisAngle(SATURN_POLE, lerp(0.45, -0.35, p))
        .multiplyScalar(Math.cos(0.3)).addScaledVector(SATURN_POLE, -Math.sin(0.3))
        .multiplyScalar(lerp(15, 9.5, smooth(0, 1, near)));
      pose.target.copy(here).multiplyScalar(0.3);
      pose.fov = 35;
      const ms = msOf(day);
      setClock(formatDate(ms), clockTime(ms), '<b>' + km(here.length() * SATURN_KM) + '</b> km from Saturn’s centre');
      const burning = day >= DAYS.burnStart && day <= DAYS.burnEnd;
      place('soi-cassini', burning ? 'Cassini · engine firing' : 'Cassini', here, 'is-craft', 12, -18);
      data.soi.crossings.forEach((crossing, i) => {
        if (day >= crossing.day - 0.05) place('cross' + i, 'Through the ring plane', crossings[i], 'is-event', 12, 8);
      });
    },
    release(raw) {
      const p = lit(raw, 0.1);
      // Illustration: Huygens left at about a third of a metre per second,
      // turning seven times a minute to stay steady.
      const out = smooth(0.18, 1, p);
      setProbe(out * 11, p * 5);
      orbit(scratch.set(1.5, -0.6, 1 + out * 4.5), lerp(-0.7, -1.0, p) + drag.yaw, 0.14 + drag.pitch * 0.5, 21 + out * 9);
      if (probe.userData.home && out > 0.04) place('probe', 'Huygens', probe.getWorldPosition(scratch2), 'is-craft', kit.wide ? 64 : -24, kit.wide ? -6 : 44);
    },
    titan(raw) {
      const p = lit(raw);
      aimSun(titanSun);
      const falling = clamp01(p / 0.46), descent = clamp01((p - 0.46) / 0.32), after = clamp01((p - 0.78) / 0.22);
      const day = p < 0.46 ? lerp(DAYS.entry - 0.22, DAYS.entry, 1 - Math.pow(1 - falling, 1.6))
        : p < 0.78 ? lerp(DAYS.entry, DAYS.landed, descent) : lerp(DAYS.landed, DAYS.landed + 0.05, after);
      const here = huygensTrail.update(day);
      huygensDot.position.copy(here);
      const ship = cassiniTitanTrail.update(day);
      cassiniTitanDot.position.copy(ship);
      const azimuth = Math.atan2(landingSite.x, landingSite.z) + 0.75;
      const reach = here.length();
      if (p < 0.78) {
        orbit(scratch.copy(here).multiplyScalar(reach > 2 ? 0.5 : 0.75), azimuth - falling * 0.25 + descent * 0.2, 0.22, Math.max(4.6 - descent * 1.2, 3 + reach * 2.4));
      } else {
        orbit(scratch.copy(ship).multiplyScalar(0.42), azimuth - 0.05 + after * 0.15, 0.3, lerp(3.4, 62, smooth(0, 0.75, after)));
      }
      // The radio link needs Cassini above Huygens's horizon.
      const overhead = scratch2.copy(ship).sub(landingSite).dot(landingSite) > 0;
      relay.visible = day >= DAYS.landed && overhead;
      if (relay.visible) {
        const line = relay.geometry.attributes.position;
        line.setXYZ(0, here.x, here.y, here.z); line.setXYZ(1, ship.x, ship.y, ship.z);
        line.needsUpdate = true;
      }
      const ms = msOf(day), heightKm = Math.max(0, reach * TITAN_KM - TITAN_KM);
      setClock(formatDate(ms), clockTime(ms), day >= DAYS.landed ? 'Huygens is <b>on the ground</b>'
        : '<b>' + km(heightKm) + '</b> km above Titan');
      place('huygens', day >= DAYS.landed ? 'Huygens · landed' : 'Huygens', here, 'is-craft', 12, -18);
      if (p >= 0.78 || reach > 12) place('titan-cassini', 'Cassini', ship, 'is-craft', 12, 10);
      if (p >= 0.78 && after > 0.3) place('titan-name', 'Titan', scratch2.set(0, 0, 0), '', 16, 16);
    },
    tour(raw) {
      const p = lit(raw);
      const day = lerp(data.tour.startDay, DAYS.end, smooth(0, 1, p) * 0.3 + p * 0.7);
      aimSun(toSunAt(msOf(day), scratch2));
      if (tourTrack) {
        for (const line of tourTrails) line.update(day);
        tourTrack.at(day, tourPos);
      }
      tourDot.position.copy(tourPos);
      titanAt(day, titanPos);
      tourTitan.position.copy(titanPos);
      // Pull in from the huge first orbit, then drift around the tangle.
      orbit(scratch.set(0, 0, 0), 0.4 + p * 2.2 + (kit.reduced ? 0 : Math.sin(kit.time * 0.05) * 0.1), lerp(1.0, 0.42, smooth(0, 0.9, p)), lerp(430, lerp(210, 270, p), smooth(0.02, 0.2, p)));
      const passes = data.periapses.filter((d) => d <= day).length;
      const ms = msOf(day);
      setClock(formatDate(ms), '<b>' + Math.max(0, passes - 1) + '</b> orbits completed', phaseAt(day).name);
      place('tour-cassini', 'Cassini', tourPos, 'is-craft', 10, -18);
      place('tour-titan', 'Titan', titanPos, '', 10, 8);
      if (tourPos.length() > 14) place('tour-saturn', 'Saturn', scratch2.set(0, 0, 0), 'is-dim', 10, 12);
    },
    enceladus(raw) {
      const p = lit(raw);
      aimSun(plumeSun);
      const day = lerp(DAYS.plume - 0.0028, DAYS.plume + 0.0028, p);
      const here = plumeTrail.update(day);
      plumeDot.position.copy(here);
      const turn = lerp(-0.35, 0.3, p);
      pose.position.copy(plumeView).applyAxisAngle(SATURN_POLE, turn).addScaledVector(southPole, 0.2).normalize()
        .multiplyScalar(lerp(13, 10.5, smooth(0, 0.5, p)));
      pose.position.addScaledVector(southPole, 0.9);
      pose.target.copy(southPole).multiplyScalar(0.9);
      pose.fov = 35;
      const ms = msOf(day);
      setClock(formatDate(ms), clockTime(ms, true), '<b>' + km(here.length() * ENCELADUS_KM - enceladusGround(here)) + '</b> km above the ice');
      place('plume-cassini', 'Cassini', here, 'is-craft', 12, -18);
      place('plume-pole', 'South pole', scratch2.copy(southPole).multiplyScalar(0.99), 'is-dim', -84, -16);
    },
    finale(raw) {
      const p = lit(raw);
      const day = finaleDay(p), ms = msOf(day);
      aimSun(finaleSun);
      saturnSpin.rotation.y = (day / 0.44401) * Math.PI * 2;
      if (!finaleTrack) return orbit(scratch.set(0, 0, 0), 0.6, 0.3, 8);
      const here = finaleTrail.update(day);
      finaleDot.position.copy(here);
      const last = smooth(0.7, 0.97, p);
      // Hold on the gap from just above the sunlit rings, then follow
      // Cassini down.
      const angle = lerp(0.95, 0.55, p);
      pose.position.copy(finaleGap).multiplyScalar(Math.cos(angle)).addScaledVector(finaleSide, Math.sin(angle))
        .multiplyScalar(Math.cos(0.26)).addScaledVector(SATURN_POLE, Math.sin(0.26))
        .multiplyScalar(lerp(7.2, 5.2, last));
      pose.target.copy(finaleGap).multiplyScalar(0.8).lerp(finaleEnd, last * 0.85);
      pose.fov = 35;
      const over = p >= 0.995;
      finaleDot.visible = !over;
      finaleFlash.position.copy(finaleEnd);
      finaleFlash.material.opacity = smooth(0.975, 0.995, p) * 0.9;
      const reach = here.length();
      const dive = dives.filter((d) => d.day - 0.5 <= day).length;
      setClock(formatDate(ms), day > lastDive + 0.6 ? clockTime(ms) + ' · final approach' : dive ? 'Dive <b>' + dive + '</b> of 22' : 'Lining up',
        reach < 2.6 ? '<b>' + km(Math.max(0, aboveClouds(here))) + '</b> km above the cloud tops' : '<b>' + km(reach * SATURN_KM) + '</b> km from Saturn');
      if (!over && reach < 9) place('finale-cassini', 'Cassini', here, 'is-craft', 12, -18);
      if (p > 0.97) place('finale-end', 'Signal lost · 15 Sep 2017', finaleEnd, 'is-event', kit.wide ? -238 : -150, kit.wide ? -4 : -34, smooth(0.97, 0.995, p));
      else place('finale-gap', 'The gap', scratch2.copy(finaleGap).multiplyScalar(finaleGapRadius), 'is-event', -76, -4, 1 - smooth(0.6, 0.7, p));
    },
    legacy(p) {
      // Cassini flew its last twelve years without the probe.
      setProbe(0, 0, false);
      orbit(scratch.set(1.2, 0, 0), 2.5 + kit.time * 0.04 + drag.yaw, 0.14, 26 * Math.pow(22, smooth(0.15, 1, p)));
    },
  };

  const SATURN_STAGES = ['soi', 'tour', 'finale'];
  function enterStage(next) {
    craft.visible = next === 'craft';
    sys.visible = next === 'system';
    sat.visible = SATURN_STAGES.includes(next);
    soiSet.visible = next === 'soi';
    tourSet.visible = next === 'tour';
    finaleSet.visible = next === 'finale';
    titanSet.visible = next === 'titan';
    enceladusSet.visible = next === 'enceladus';
    kit.clock.classList.toggle('is-on', next !== 'craft');
    // The planet and moons keep their true night side: no fill light there.
    fill.visible = next === 'craft';
    skyLight.intensity = next === 'craft' ? 0.9 : 0.08;
    if (next === 'craft') {
      sunLight.position.set(-10, 20, 18);
      sunLight.target.position.set(0, 0, 0);
    }
  }

  // A phone held upright sees a much narrower slice of the scene than a
  // laptop does. Step the camera back along its own line of sight there, by
  // however much each chapter's subject needs to fit.
  const PHONE_STEP_BACK = { hero: 1.5, craft: 1.5, cruise: 1.6, arrival: 2.2, release: 1.8, titan: 1.7, tour: 2, enceladus: 1.7, finale: 1.9, legacy: 1 };
  const framed = {};
  for (const [id, play] of Object.entries(CHAPTERS)) {
    framed[id] = (progress, state) => {
      play(progress, state);
      if (!kit.wide) pose.position.sub(pose.target).multiplyScalar(PHONE_STEP_BACK[id]).add(pose.target);
    };
  }

  kit.run({
    chapters: framed,
    enterStage,
    canDrag: () => kit.stage === 'craft',
    onChapter(chapter) {
      // Fetch Saturn a chapter early so it is there when the cut lands.
      if (chapter.id !== 'hero' && chapter.id !== 'craft') loadSaturn();
    },
    // Keep the subject clear of the card: beside it on wide screens, above
    // it on phones.
    offset(state, wide) {
      const cardOnRight = state.id === 'arrival' || state.id === 'titan' || state.id === 'enceladus';
      return wide ? [cardOnRight ? -0.18 : 0.15, 0] : [0, 0.2];
    },
    before() {
      finaleDot.visible = true;
      finaleFlash.material.opacity = 0;
      relay.visible = false;
    },
    after() {
      plumeUniforms.uTime.value = kit.time;
      plumeUniforms.uPixel.value = renderer.getPixelRatio();
    },
  });
}
