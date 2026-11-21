/* James Webb Space Telescope — a scroll-driven story on three 3D sets:
     craft    the telescope itself, in metres, with its unfolding clip
     l2       Earth, the Moon, the L2 point and Webb's real path, in the
              frame that turns with the Sun-Earth line
     nebula   a made-up dust cloud seen in visible light or infrared
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a date, a pose of the telescope and a
   camera. Every position Webb takes on the l2 set comes from
   trajectory.json (JPL Horizons). */
import { SPACE } from '/common.bundle.js?v=20260909-2';
import {
  AU_KM, DAY_MS, LIGHT_KM_PER_SEC, formatDate, planetPosition, sampleRows,
} from '/mission-orbits.js?v=20261121-1';
import { createMissionKit, lerp, smooth } from '/mission-scene.js?v=20261121-1';
import { createChart } from '/mission-story.js?v=20261121-1';

const ASSETS = '/assets/missions/webb/';
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const km = (value) => Math.round(value).toLocaleString('en-US');

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const epochMs = Date.parse(data.epoch);
const dayOf = (ms) => (ms - epochMs) / DAY_MS;
const msOf = (day) => epochMs + day * DAY_MS;
const dayOn = (y, m, d, h = 0) => dayOf(Date.UTC(y, m - 1, d, h));
// One lookup over the whole flight: the fine transfer rows, then the halo.
const haloStart = data.halo[0][0];
const path = data.transfer.filter((row) => row[0] < haloStart).map((row) => row.slice(0, 4)).concat(data.halo);
const lastDay = path[path.length - 1][0];
const DAYS = {
  first: data.transfer[0][0],
  arrive: dayOn(2022, 1, 24, 19),
};
const today = () => Math.min(dayOf(Date.now()), lastDay);

// L2 sits a fixed share of the Sun's distance beyond Earth, so it breathes
// in and out by about 50,000 km as Earth's orbit carries it nearer the Sun
// and farther away.
const l2Km = (ms) => Math.hypot(...planetPosition('earth', ms)) * AU_KM * data.l2Ratio;
// Each time Webb crosses from behind Earth's motion to ahead of it, it has
// gone once more around L2.
const lapStarts = [];
for (let i = 1; i < data.halo.length; i++) {
  if (data.halo[i - 1][2] < 0 && data.halo[i][2] >= 0) lapStarts.push(data.halo[i][0]);
}
const lapsBy = (day) => Math.max(0, lapStarts.filter((start) => start <= day).length - 1);
function webbAt(ms) {
  const [, x, y, z] = sampleRows(path, dayOf(ms));
  const earthKm = Math.hypot(x, y, z);
  return { x, y, z, earthKm, lightSeconds: earthKm / LIGHT_KM_PER_SEC, laps: lapsBy(dayOf(ms)) };
}

/* ──── Live figures: these run with or without the 3D scene ──── */
function tickLive() {
  const ms = Math.min(Date.now(), msOf(lastDay));
  const now = webbAt(ms);
  SPACE.setText($('hero-earth-km'), km(now.earthKm));
  SPACE.setText($('hero-light'), now.lightSeconds.toFixed(1) + ' seconds');
  SPACE.setText($('hero-asof'), 'Worked out for ' + formatDate(ms) + ' from JPL Horizons data');
  SPACE.setText($('halo-earth-km'), km(now.earthKm));
  SPACE.setText($('halo-laps'), String(now.laps));
}
tickLive();
setInterval(tickLive, 1000);

/* ──── Telescope parts ──── */
const PARTS = [
  { key: 'PrimaryMirror', label: 'Big mirror', title: 'Primary mirror',
    text: 'Eighteen gold-coated hexagons that work as one mirror 6.5 metres across. It gathers faint light and bounces it to the small mirror out in front.' },
  { key: 'SecondaryMirror', label: 'Small mirror', title: 'Secondary mirror',
    text: 'A round mirror 74 centimetres wide, held out on three legs more than 7 metres long. It sends the light back through the hole in the middle of the big mirror.' },
  { key: 'Sunshield', label: 'Sunshield', title: 'Sunshield',
    text: 'Five silvery layers, each about as thin as a hair, 21 metres long and 14 wide. They keep the heat of the Sun, Earth and Moon off the telescope.' },
  { key: 'InstrumentModule', label: 'Instruments', title: 'Science instruments',
    text: 'Four instruments sit behind the mirror: cameras that take pictures, and spectrographs that spread light into its colours to show what things are made of.' },
  { key: 'Bus', label: 'Body', title: 'Spacecraft bus',
    text: 'The warm side. Computers, radio, fuel and thrusters live here below the sunshield, where their heat cannot reach the mirror.' },
  { key: 'SolarArray', label: 'Solar panel', title: 'Solar panel',
    text: 'It always faces the Sun and makes all of Webb’s electricity. It was the first thing to open, about half an hour after launch.' },
  { key: 'Antenna', label: 'Antenna', title: 'High-gain antenna',
    text: 'A small dish that points at Earth. Twice a day it sends home at least 28.6 gigabytes of pictures and measurements.' },
  { key: 'MomentumFlap', label: 'Trim flap', title: 'Momentum flap',
    text: 'Sunlight pushes very gently on the huge sunshield, like wind on a sail. This flap balances the push so Webb does not slowly tip over, which saves fuel.' },
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

/* ──── Unfolding steps: clip second N is the start of step N ──── */
const STEPS = [
  { date: [2021, 12, 25, 13], label: 'Solar panel opens' },
  { date: [2021, 12, 26, 15], label: 'Antenna swings out' },
  { date: [2021, 12, 28, 18], label: 'Sunshield pallets fold down' },
  { date: [2021, 12, 29, 15], label: 'Tower lifts the telescope' },
  { date: [2021, 12, 30, 14], label: 'Trim flap springs open' },
  { date: [2021, 12, 31, 20], label: 'Booms pull the shield wide' },
  { date: [2022, 1, 4, 17], label: 'Five layers pulled tight' },
  { date: [2022, 1, 5, 17], label: 'Small mirror swings out' },
  { date: [2022, 1, 7, 19], label: 'First mirror wing locks' },
  { date: [2022, 1, 8, 18], label: 'Second mirror wing locks' },
].map((step) => ({ ...step, day: dayOn(...step.date) }));
const stepItems = [...$('steps').children];
function showStep(index) {
  $('steps').classList.add('is-live');
  stepItems.forEach((item, i) => {
    item.classList.toggle('is-on', i === index);
    item.classList.toggle('is-done', i < index);
  });
}

/* ──── The speed chart, the alignment toy and the infrared slider ──── */
const speedRows = data.transfer.map((row) => [row[0], row[4]]);
const drawSpeedChart = createChart($('chart-speed'), speedRows, DAYS.arrive, { eventLabel: 'arrives' });
drawSpeedChart(DAYS.first);

// Where each of the 18 unaligned images starts, as a share of the canvas.
const scatter = [];
for (let i = 0, seed = 7; i < 18; i++) {
  seed = (seed * 16807) % 2147483647;
  const angle = (i / 18) * Math.PI * 2 + (seed % 1000) / 1000;
  seed = (seed * 16807) % 2147483647;
  scatter.push([Math.cos(angle) * (0.35 + 0.6 * ((seed % 1000) / 1000)), Math.sin(angle) * (0.3 + 0.6 * ((seed % 997) / 997))]);
}
function drawAlignment() {
  const canvas = $('align-canvas');
  const u = Number($('align-slider').value) / 100;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#03050b';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  const cx = w / 2, cy = h / 2;
  const gather = u * u * (3 - 2 * u);
  const blur = lerp(Math.min(w, h) * 0.085, 3.2, gather);
  for (const [sx, sy] of scatter) {
    const x = cx + sx * (w * 0.46) * (1 - gather), y = cy + sy * (h * 0.46) * (1 - gather);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, blur * 2.4);
    const strength = lerp(0.5, 0.2, gather);
    glow.addColorStop(0, 'rgba(255,214,150,' + strength + ')');
    glow.addColorStop(0.4, 'rgba(255,170,90,' + strength * 0.4 + ')');
    glow.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - blur * 2.4, y - blur * 2.4, blur * 4.8, blur * 4.8);
  }
  // Six spikes from the edges of the hexagons, and a fainter level pair
  // from the leg that holds the small mirror straight above the big one.
  const sharp = smooth(0.82, 1, u);
  if (sharp > 0) {
    const spike = (angle, length, alpha) => {
      const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
      const line = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      line.addColorStop(0, 'rgba(255,200,130,0)');
      line.addColorStop(0.5, 'rgba(255,232,190,' + alpha * sharp + ')');
      line.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
    };
    for (let i = 0; i < 3; i++) spike(Math.PI / 2 + (i * Math.PI) / 3, h * 0.46, 0.9);
    spike(0, h * 0.2, 0.5);
  }
  $('align-out').textContent = u < 0.08 ? 'Eighteen separate pictures of the same star.'
    : u < 0.82 ? 'Each mirror segment is tipped and shifted until its picture lands on the others.'
      : 'One sharp star. The spikes come from the mirror’s hexagon edges and the legs of the small mirror.';
}
$('align-slider').addEventListener('input', drawAlignment);
addEventListener('resize', drawAlignment);
drawAlignment();

// 0 is visible light, 1 is infrared. Scrolling through the chapter moves the
// slider until the reader takes hold of it.
let infrared = 0, readerHasSlider = false;
function setInfrared(value, fromReader) {
  infrared = clamp01(value);
  if (fromReader) readerHasSlider = true;
  else $('ir-slider').value = String(Math.round(infrared * 100));
  const text = infrared < 0.25 ? 'Visible light: the dust cloud is a dark wall, and the stars behind it are hidden.'
    : infrared < 0.75 ? 'Longer waves: the dust is thinning, and stars begin to shine through.'
      : 'Infrared: the dust is almost clear. Stars inside and behind the cloud appear.';
  if ($('ir-out').textContent !== text) $('ir-out').textContent = text;
}
$('ir-slider').addEventListener('input', () => setInfrared(Number($('ir-slider').value) / 100, true));

/* ──── 3D scene ──── */
const kit = createMissionKit({ shadowMap: true });
if (kit) startScene(kit);

function startScene(kit) {
  const { THREE, scene, camera, renderer, E, addGlow, fatLine, setSegment, thinLoop, sunLight, skyLight, fill, place, anchors, setClock, pose, orbit, drag } = kit;
  const scratch = new THREE.Vector3(), scratch2 = new THREE.Vector3(), viewport = new THREE.Vector2();
  const far = () => (kit.wide ? 1 : 1.45);
  // On a phone a label that would run off the right edge hangs to the left
  // of its point instead. Mono capitals here are about 7.4 px wide.
  const hang = (text, dx) => (kit.wide ? dx : -(text.length * 7.4 + dx));

  /* ════ Set 1: the telescope ════
     Model axes: +Y is the cold side, +Z the way the mirror looks. The Sun
     is always somewhere below. */
  const craft = new THREE.Group();
  const craftSpin = new THREE.Group();
  craft.add(craftSpin);
  scene.add(craft);
  const CENTRE = new THREE.Vector3(0, 3.4, 0);
  const MIRROR = new THREE.Vector3(0, 5.38, 0.95);
  const CLIP_END = 10;
  let mixer = null, deploy = null, posed = -1;
  kit.loadModel(ASSETS + 'webb.glb', (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      // The membranes are single sheets seen from both sides.
      if (/^Shield/.test(node.material.name)) { node.material.side = THREE.DoubleSide; node.material.shadowSide = THREE.DoubleSide; }
    });
    craftSpin.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    deploy = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Deploy'));
    deploy.setLoop(THREE.LoopOnce);
    deploy.clampWhenFinished = true;
    deploy.play();
    kit.addHotspots(gltf.scene, PARTS, selectPart);
  }, { tracked: true });
  function poseTelescope(second) {
    if (!mixer || second === posed) return;
    posed = second;
    deploy.time = Math.min(second, CLIP_END - 1e-3);
    mixer.update(0);
  }
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 140 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.06;
  // Two ways to light it. `shown`: from the front, so the mirror can be
  // seen. `true`: the Sun where it really is, under the shield.
  const SUN_SHOWN = new THREE.Vector3(16, 30, 40), SUN_TRUE = new THREE.Vector3(5, -52, 9);
  function light(real) {
    sunLight.position.copy(real ? SUN_TRUE : SUN_SHOWN).add(CENTRE);
    sunLight.target.position.copy(CENTRE);
    sunLight.intensity = real ? 5.2 : 3.4;
    fill.intensity = real ? 0.6 : 0.55;
    skyLight.intensity = real ? 0.18 : 0.7;
  }

  // The mirror chapter's yardsticks, to scale: Hubble's 2.4 m mirror and a
  // child 1.35 m tall, standing in the plane of Webb's mirror.
  const compare = new THREE.Group();
  craft.add(compare);
  const hubble = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 1.2, 64),
    new THREE.MeshStandardMaterial({ color: 0xc3ccdc, metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }),
  );
  hubble.position.set(5.2, 6.2, 1.3);
  const child = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#9fd0ff';
    g.beginPath(); g.arc(64, 34, 24, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.roundRect(38, 64, 52, 96, 18); g.fill();
    g.beginPath(); g.roundRect(14, 68, 20, 78, 10); g.fill();
    g.beginPath(); g.roundRect(94, 68, 20, 78, 10); g.fill();
    g.beginPath(); g.roundRect(40, 150, 22, 104, 10); g.fill();
    g.beginPath(); g.roundRect(66, 150, 22, 104, 10); g.fill();
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.675, 1.35), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(-4.4, 4.2 + 0.675, 1.3);
    return mesh;
  })();
  compare.add(hubble, child);

  /* ════ Set 2: Earth, the Moon, L2 and the real path ════
     One unit is 100,000 km. Data axes: x away from the Sun, y the way Earth
     moves, z north; kit.E stands that up as x, north, -y. */
  const UNIT = 100000;
  const l2set = new THREE.Group();
  scene.add(l2set);
  const P = (row, out = new THREE.Vector3()) => E([row[1] / UNIT, row[2] / UNIT, row[3] / UNIT], out);
  const flat = (rows) => { const points = []; for (const row of rows) { const v = P(row); points.push(v.x, v.y, v.z); } return points; };
  const GOLD = new THREE.Color(0xf4c560).multiplyScalar(1.5);
  const measuredHalo = data.halo.filter((row) => row[0] <= data.measuredUntil);
  const forecastHalo = data.halo.filter((row) => row[0] >= data.measuredUntil - 2);
  const transferLine = fatLine(flat(data.transfer), GOLD, 2.4);
  const transferAhead = fatLine(flat(data.transfer), 0xf4c560, 1, 0.18);
  const haloLine = fatLine(flat(measuredHalo), GOLD, 2);
  const haloAhead = fatLine(flat(measuredHalo), 0xf4c560, 1, 0.16);
  const forecastLine = fatLine(flat(forecastHalo), 0x9fd0ff, 1, 0.22);
  const tip = fatLine([0, 0, 0, 0, 0, 1], GOLD, 2.4);
  l2set.add(transferAhead, haloAhead, forecastLine, transferLine, haloLine, tip);
  const moonLine = fatLine(flat(data.moon.filter((row) => row[0] < data.moon[0][0] + 27.6)), 0xaebbd0, 1, 0.4);
  l2set.add(moonLine);
  const earthDot = addGlow(l2set, 0x6ab0ff, 0.03, 2.4);
  const moonDot = addGlow(l2set, 0xd8dce6, 0.012, 1.6);
  const webbDot = addGlow(l2set, 0xffe7b0, 0.026, 4);
  const l2Dot = addGlow(l2set, 0x9fd0ff, 0.012, 2);
  const ring = (radius, color, opacity) => {
    const points = [];
    for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; points.push(new THREE.Vector3(0, Math.sin(a) * radius, Math.cos(a) * radius)); }
    return thinLoop(points, color, opacity);
  };
  const l2Ring = ring(0.45, 0x9fd0ff, 0.7);
  l2set.add(l2Ring);
  // The Sun-Earth line: sunward of Earth, and on through L2.
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7, 0, 0), new THREE.Vector3(19, 0, 0)]),
    new THREE.LineBasicMaterial({ color: 0xaebbd0, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  l2set.add(axis);
  const milestones = [
    { day: dayOn(2022, 1, 4, 17), text: '4 Jan · Sunshield open' },
    { day: dayOn(2022, 1, 8, 18), text: '8 Jan · Mirror unfolded' },
  ].map((m) => ({ ...m, at: P(sampleRows(data.transfer, m.day)), dot: addGlow(l2set, 0x6ab0ff, 0.011, 3) }));
  for (const m of milestones) m.dot.position.copy(m.at);

  const webb = new THREE.Vector3(), moon = new THREE.Vector3(), l2 = new THREE.Vector3(), origin = new THREE.Vector3();
  function drawn(line, rows, day) {
    const next = rows.findIndex((row) => row[0] > day);
    const index = next === -1 ? rows.length - 1 : Math.max(0, next - 1);
    line.geometry.instanceCount = index;
    return rows[index];
  }
  function showFlight(day) {
    const ms = msOf(day);
    const row = sampleRows(path, day);
    P(row, webb);
    webbDot.position.copy(webb);
    l2.set(l2Km(ms) / UNIT, 0, 0);
    l2Dot.position.copy(l2);
    l2Ring.position.copy(l2);
    const inTransfer = day < data.transfer[data.transfer.length - 1][0];
    const from = inTransfer ? drawn(transferLine, data.transfer, day) : drawn(haloLine, measuredHalo, day);
    if (!inTransfer) transferLine.geometry.instanceCount = Infinity;
    else haloLine.geometry.instanceCount = 0;
    tip.visible = day <= data.measuredUntil;
    setSegment(tip, P(from, scratch), webb);
    return row;
  }

  /* ════ Set 3: a dust cloud in two kinds of light ════
     A made-up scene that follows one real rule: dust dims short waves far
     more than long ones. */
  const nebulaUniforms = { uInfrared: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uShift: { value: new THREE.Vector2() } };
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: nebulaUniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SPACE.GLSL_NOISE + `
      varying vec2 vUv;
      uniform float uInfrared; uniform float uAspect; uniform float uTime; uniform vec2 uShift;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // One star per grid cell: xyz colour, scaled by brightness.
      vec3 stars(vec2 p, float cells, float seed, float spikes) {
        vec2 g = p * cells; vec2 id = floor(g) + seed;
        vec2 at = vec2(hash(id), hash(id + 17.3)) * 0.6 + 0.2;
        vec2 d = (fract(g) - at) / cells;
        float bright = pow(hash(id + 5.1), 7.0);
        float size = 0.0011 + 0.0022 * bright;
        float core = exp(-dot(d, d) / (size * size));
        float rays = 0.0;
        if (spikes > 0.0 && bright > 0.42) {
          for (int i = 0; i < 3; i++) {
            float a = 1.5708 + float(i) * 1.0472;
            vec2 dir = vec2(cos(a), sin(a));
            float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
            rays += exp(-abs(across) / 0.0005) * exp(-abs(along) / (0.012 + 0.03 * bright));
          }
          rays *= 0.5 * spikes;
        }
        vec3 tint = mix(vec3(1.0, 0.72, 0.5), vec3(0.72, 0.84, 1.0), hash(id + 9.7));
        return tint * bright * (core * 5.0 + rays * 2.2);
      }
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5) + uShift;
        float drift = uTime * 0.004;
        // The cloud: a ragged wall rising from the bottom of the frame.
        float edge = 0.02 + 0.2 * fbm(vec3(p.x * 1.3, 0.4, 2.0 + drift)) + 0.07 * snoise(vec3(p.x * 5.0, 1.0, drift));
        float wall = smoothstep(0.1, -0.16, p.y - edge);
        float clumps = 0.5 + 0.5 * fbm(vec3(p * 2.6, 5.0 + drift));
        float dust = wall * (0.55 + 0.75 * clumps) + 0.2 * smoothstep(0.45, 0.9, 0.5 + 0.5 * fbm(vec3(p * 1.7 + 4.0, 8.0)));
        // Dust is ten times clearer in this infrared than in visible light,
        // and always dims blue more than red.
        float depth = dust * mix(7.0, 0.55, uInfrared);
        vec3 through = exp(-depth * vec3(1.0, 1.25, 1.6));
        vec3 behind = stars(p, 34.0, 1.0, uInfrared) + stars(p, 70.0, 40.0, 0.0) * 0.7 + stars(p, 16.0, 80.0, uInfrared) * 1.3;
        // Newborn stars inside the cloud: buried deeper, and far too faint
        // in visible light to notice.
        vec3 inside = stars(p, 22.0, 120.0, uInfrared) * wall * exp(-depth * 0.6) * mix(0.0, 2.4, uInfrared);
        vec3 front = stars(p, 9.0, 200.0, uInfrared) * 0.9;
        float haze = 0.5 + 0.5 * fbm(vec3(p * 1.1 + 9.0, 3.0 + drift));
        vec3 sky = mix(vec3(0.012, 0.03, 0.06), vec3(0.02, 0.012, 0.03), uInfrared) * (0.5 + haze) * smoothstep(-0.5, 0.5, p.y);
        // Starlight catching the top of the wall, and the dust's own glow.
        float rim = smoothstep(0.1, 0.0, abs(p.y - edge + 0.03)) * (0.4 + 0.6 * clumps);
        vec3 lit = mix(vec3(0.5, 0.2, 0.07), vec3(0.75, 0.4, 0.16), uInfrared) * rim * 0.5;
        vec3 body = mix(vec3(0.055, 0.03, 0.02), vec3(0.34, 0.15, 0.06), uInfrared) * dust * (0.3 + 0.7 * clumps) * 0.5;
        vec3 color = (sky + behind) * through + inside + lit + body + front;
        gl_FragColor = vec4(color, 1.0);
      }`,
  }));
  nebula.frustumCulled = false;
  nebula.renderOrder = -1;
  scene.add(nebula);

  /* ──── Chapters: progress → pose, date and camera ──── */
  const earthKmAt = (day) => { const [, x, y, z] = sampleRows(path, day); return Math.hypot(x, y, z); };

  const CHAPTERS = {
    hero(p) {
      // A slow sway, not a full turn: the back of the telescope is in the dark.
      orbit(CENTRE, 0.55 + Math.sin(kit.time * 0.11) * 0.4 + drag.yaw, 0.3 + drag.pitch, lerp(40, 35, p) * far());
    },
    telescope(p) {
      const anchor = selectedPart && anchors.get(selectedPart);
      if (anchor) {
        anchor.getWorldPosition(scratch);
        const azimuth = Math.atan2(scratch.x, scratch.z + 0.001) + 0.45 + drag.yaw;
        // Parts under the shield are seen from the Sun's side, by its light.
        const below = scratch.y < 1.2;
        if (below) light(true);
        orbit(scratch2.copy(scratch).lerp(CENTRE, 0.5), azimuth, (below ? -0.42 : 0.3) + drag.pitch, (32 + scratch.distanceTo(CENTRE) * 0.8) * far());
      } else {
        orbit(CENTRE, 0.3 + p * 1.5 + drag.yaw, 0.3 + drag.pitch, 44 * far());
      }
      kit.showHotspots(selectedPart);
    },
    unfold(p) {
      // Hold folded, play, hold open. Each step eases in and out.
      const t = clamp01((p - 0.07) / 0.83) * CLIP_END;
      const index = Math.min(STEPS.length - 1, Math.floor(t));
      const second = index + smooth(0, 1, t - index);
      poseTelescope(second);
      const open = smooth(1.8, 3, second);
      orbit(scratch.copy(CENTRE).setY(lerp(4.4, 3.4, open)), 0.45 + p * 0.9 + drag.yaw, lerp(0.22, 0.34, open) + drag.pitch, lerp(27, 48, open) * far());
      const started = p > 0.07;
      const step = STEPS[index];
      showStep(index);
      const day = started ? lerp(step.day - 0.3, step.day, clamp01(t - index)) : DAYS.first;
      setClock(started ? formatDate(msOf(step.day)) : '25 Dec 2021',
        started ? step.label : 'Folded for launch',
        '<b>' + km(Math.round(earthKmAt(Math.max(day, DAYS.first)) / 1000) * 1000) + '</b> km from Earth');
    },
    journey(p) {
      const day = lerp(DAYS.first, DAYS.arrive, smooth(0.04, 0.92, p) * 0.6 + clamp01((p - 0.04) / 0.88) * 0.4);
      const row = showFlight(day);
      const [, mx, my, mz] = sampleRows(data.moon, Math.max(day, data.moon[0][0]));
      moon.set(mx / UNIT, mz / UNIT, -my / UNIT);
      moonDot.position.copy(moon);
      const reach = webb.length();
      orbit(scratch.copy(webb).multiplyScalar(0.5), lerp(-0.25, 0.2, p), lerp(0.95, 0.7, p), (9 + reach * 2.3) * (kit.wide ? 1 : 1.75));
      place('earth', 'Earth', origin, 'is-home', 10, 8);
      place('moon', 'Moon', moon, '', 8, -4);
      place('webb', 'Webb', webb, 'is-craft', 10, -18);
      if (reach > 6) place('l2', 'L2', l2, 'is-event', 10, 10, smooth(6, 9, reach));
      milestones.forEach((m, i) => { if (m.day <= day) place('m' + i, m.text, m.at, 'is-event', hang(m.text, 12), i ? 8 : -16); });
      setClock(formatDate(msOf(day)),
        '<b>' + km(Math.round(Math.hypot(row[1], row[2], row[3]) / 1000) * 1000) + '</b> km from Earth',
        '<b>' + sampleRows(data.transfer, day)[4].toFixed(2) + '</b> km/s');
      drawSpeedChart(day);
    },
    halo(p) {
      const day = lerp(DAYS.arrive, today(), smooth(0.04, 0.82, p));
      const row = showFlight(day);
      // The Moon keeps its month-long loop; only the date along it matters
      // for scale here, so it is parked on the ring.
      moonDot.position.copy(P(data.moon[40], moon));
      // From above the orbit, round to the view from Earth, looking out
      // along the Sun-Earth line at the loop face-on.
      const turn = smooth(0.25, 0.85, p);
      orbit(scratch.copy(l2).multiplyScalar(lerp(0.75, 1, turn)), lerp(0.1, -1.25, turn), lerp(1.0, 0.16, turn), lerp(52, 46, turn) * (kit.wide ? 1 : 1.65));
      place('earth', 'Earth', origin, 'is-home', 10, 8);
      place('moon', 'Moon’s orbit', moon, 'is-dim', 8, -4);
      place('webb', 'Webb', webb, 'is-craft', 10, -18);
      place('l2', 'L2 · nothing here', l2, 'is-event', hang('L2 · nothing here', 12), 10);
      setClock(formatDate(msOf(day)),
        '<b>' + km(Math.round(Math.hypot(row[1], row[2], row[3]) / 1000) * 1000) + '</b> km from Earth',
        'Lap <b>' + (lapsBy(day) + 1) + '</b> around L2');
    },
    sunshield(p) {
      light(true);
      // From under the shield, where the Sun is, up over the edge into its
      // shadow.
      const elevation = lerp(-0.62, 0.5, smooth(0.12, 0.8, p));
      orbit(scratch.copy(CENTRE).setY(2.6), 0.95 + p * 0.5 + drag.yaw, elevation, 42 * far());
      const side = smooth(-0.14, 0.14, elevation);
      const degrees = Math.round(lerp(85, -233, side));
      SPACE.setText($('temp-value'), (degrees > 0 ? '+' : '−') + Math.abs(degrees) + ' °C');
      SPACE.setText($('temp-side'), side < 0.03 ? 'Sun side' : side > 0.97 ? 'Mirror side' : 'Between the layers');
      place('hot', 'Sun side · +85 °C', scratch.set(0, -1.6, 3.5), 'is-craft', 12, 0, 1 - side);
      place('cold', 'Mirror side · −233 °C', scratch.copy(MIRROR).setY(9), 'is-home', 12, -8, side);
    },
    mirror(p) {
      const show = smooth(0.02, 0.2, p);
      compare.visible = show > 0.01;
      hubble.scale.setScalar(show);
      child.scale.setScalar(show);
      orbit(scratch.copy(MIRROR).setX(0.3), lerp(0.5, -0.12, smooth(0, 0.5, p)) + drag.yaw, 0.1 + drag.pitch, lerp(34, 27, smooth(0, 0.5, p)) * (kit.wide ? 1 : 1.8));
      place('webb-mirror', 'Webb · 6.5 m', scratch.copy(MIRROR).setY(8.9), 'is-craft', -34, -16, show);
      place('hubble-mirror', 'Hubble · 2.4 m', scratch.copy(hubble.position).setY(7.6), '', -50, -8, show);
      place('child', 'Age 9 · 1.35 m', scratch.copy(child.position).setY(5.7), 'is-home', -50, -16, show);
    },
    infrared(p) {
      if (!readerHasSlider) setInfrared(smooth(0.3, 0.7, p), false);
      nebulaUniforms.uInfrared.value = infrared;
    },
    future(p) {
      orbit(CENTRE, 0.75 + Math.sin(kit.time * 0.09) * 0.35 + drag.yaw, 0.3, lerp(44, 72, smooth(0.25, 1, p)) * far());
    },
  };

  function enterStage(next) {
    craft.visible = next === 'craft';
    l2set.visible = next === 'l2';
    nebula.visible = next === 'nebula';
    kit.stars.points.visible = next !== 'nebula';
    sunLight.castShadow = next === 'craft';
    if (next === 'l2') {
      transferAhead.material.opacity = 0.18;
    }
  }

  kit.run({
    chapters: CHAPTERS,
    enterStage,
    canDrag: () => kit.stage === 'craft',
    // Keep the subject clear of the card: beside it on wide screens, above
    // it on phones. The dust cloud fills the whole frame.
    offset(state, wide) {
      if (state.stage === 'nebula') return [0, 0];
      return wide ? [0.15, 0] : [0, state.stage === 'l2' ? 0.13 : 0.2];
    },
    before(state) {
      light(false);
      compare.visible = false;
      if (state.id !== 'unfold') poseTelescope(CLIP_END);
      kit.clock.classList.toggle('is-on', state.stage === 'l2' || state.id === 'unfold');
      const onHalo = state.id === 'halo';
      haloLine.visible = haloAhead.visible = forecastLine.visible = onHalo;
      transferAhead.visible = !onHalo;
      for (const m of milestones) m.dot.visible = !onHalo;
      moonLine.material.opacity = onHalo ? 0.3 : 0.4;
      renderer.getSize(viewport);
      nebulaUniforms.uAspect.value = viewport.x / viewport.y;
      nebulaUniforms.uTime.value = kit.time;
      // On a phone the card covers the lower half, so the top of the cloud
      // is lifted into the half that shows.
      nebulaUniforms.uShift.value.set(kit.wide ? -0.12 : 0, kit.wide ? 0 : -0.2);
    },
  });
}
