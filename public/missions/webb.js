/* James Webb Space Telescope — a scroll-driven story on three 3D sets:
     craft    the telescope itself, in metres, with its unfolding clip
     l2       Earth, the Moon, the L2 point and Webb's real path, in the
              frame that turns with the Sun-Earth line
     nebula   a made-up dust cloud seen in visible light or infrared
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a date, a pose of the telescope and a
   camera. Every position Webb takes on the l2 set comes from
   trajectory.json (JPL Horizons). */
import { SPACE } from '/common.bundle.js?v=20261121-3';
import { clamp01, formatDate, lerp, smooth } from '/mission-orbits.js?v=20261121-2';
import { createMissionKit } from '/mission-scene.js?v=20261121-4';
import { createChart, createPartPicker } from '/mission-story.js?v=20261121-3';
import {
  CLIP, PARTS, SHIELD_C, alignmentCaption, celsius, createFlight, infraredCaption,
} from '/missions/webb-mission.js?v=20261121-2';

const ASSETS = '/assets/missions/webb/';
const $ = (id) => document.getElementById(id);
const km = (value) => Math.round(value).toLocaleString('en-US');
const thousands = (value) => km(Math.round(value / 1000) * 1000);

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const flight = createFlight(data);
const { DAYS, chapterDay, msOf } = flight;

/* ──── Live figures: these run with or without the 3D scene ──── */
function tickLive() {
  const now = flight.live(Date.now());
  SPACE.setText($('hero-earth-km'), km(now.earthKm));
  SPACE.setText($('hero-light'), now.lightSeconds.toFixed(1) + ' seconds');
  SPACE.setText($('hero-asof'), 'Worked out for ' + formatDate(now.ms) + ' from JPL Horizons data');
  SPACE.setText($('halo-earth-km'), km(now.earthKm));
  SPACE.setText($('halo-laps'), String(now.laps));
}
tickLive();
setInterval(tickLive, 1000);

const picker = createPartPicker(PARTS);

const stepItems = [...$('steps').children];
function showStep(index) {
  $('steps').classList.add('is-live');
  stepItems.forEach((item, i) => {
    item.classList.toggle('is-on', i === index);
    item.classList.toggle('is-done', i < index);
  });
}

const drawSpeedChart = createChart($('chart-speed'), flight.speedRows, { events: [{ day: DAYS.arrive, label: 'arrives' }] });
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
  $('align-out').textContent = alignmentCaption(u);
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
  SPACE.setText($('ir-out'), infraredCaption(infrared));
}
$('ir-slider').addEventListener('input', () => setInfrared(Number($('ir-slider').value) / 100, true));

/* Model axes, in metres: +Y is the cold side, +Z the way the mirror looks.
   The Sun is always somewhere below. */
const CENTRE = [0, 3.4, 0], MIRROR = [0, 5.38, 0.95];
const lightFrom = ([x, y, z], levels) => ({ sun: [CENTRE[0] + x, CENTRE[1] + y, CENTRE[2] + z], target: CENTRE, ...levels });
// Two ways to light it. `SHOWN`: from the front, so the mirror can be seen.
// `TRUE`: the Sun where it really is, under the shield.
const SHOWN = lightFrom([16, 30, 40], { sunIntensity: 3.4, fill: 0.55, sky: 0.7 });
const TRUE = lightFrom([5, -52, 9], { sunIntensity: 5.2, fill: 0.6, sky: 0.18 });

// How far the clip has run: it plays through the unfolding chapter, and the
// telescope is open everywhere else.
const unfolded = (state) => (state.id === 'unfold' ? flight.unfoldAt(state.progress).second : CLIP.seconds);
// How far the mirror chapter's yardsticks have grown in, 0 to 1.
const yardsticksIn = (state) => (state.id === 'mirror' ? smooth(0, 0.2, state.progress) : 0);

/* ──── 3D scene ──── */
const kit = createMissionKit({ shadowMap: true });
if (kit) startScene(kit);

function buildTelescope(kit) {
  const { THREE, sunLight } = kit;
  const group = new THREE.Group();
  kit.scene.add(group);
  let mixer = null, deploy = null, posed = -1;
  kit.loadModel(ASSETS + 'webb.glb', (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = node.receiveShadow = true;
      // The membranes are single sheets seen from both sides.
      if (/^Shield/.test(node.material.name)) { node.material.side = THREE.DoubleSide; node.material.shadowSide = THREE.DoubleSide; }
    });
    group.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    deploy = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, CLIP.name));
    deploy.setLoop(THREE.LoopOnce);
    deploy.clampWhenFinished = true;
    deploy.play();
    kit.addHotspots(gltf.scene, picker);
  });
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 140 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.06;

  // The mirror chapter's yardsticks, to scale: Hubble's 2.4 m mirror and a
  // child 1.35 m tall, standing in the plane of Webb's mirror.
  const yardsticks = new THREE.Group();
  group.add(yardsticks);
  const hubble = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 1.2, 64),
    new THREE.MeshStandardMaterial({ color: 0xc3ccdc, metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }),
  );
  hubble.position.set(5.2, 6.2, 1.3);
  const figure = kit.canvasTexture(128, 256, (g) => {
    g.fillStyle = '#9fd0ff';
    g.beginPath(); g.arc(64, 34, 24, 0, Math.PI * 2); g.fill();
    for (const [x, y, w, h, r] of [[38, 64, 52, 96, 18], [14, 68, 20, 78, 10], [94, 68, 20, 78, 10], [40, 150, 22, 104, 10], [66, 150, 22, 104, 10]]) {
      g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
    }
  });
  const child = new THREE.Mesh(new THREE.PlaneGeometry(0.675, 1.35), new THREE.MeshBasicMaterial({ map: figure, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  child.position.set(-4.4, 4.2 + 0.675, 1.3);
  yardsticks.add(hubble, child);

  return {
    group, hubble: hubble.position, child: child.position,
    // Pose the telescope at a second of its clip.
    unfoldTo(second) {
      if (!mixer || second === posed) return;
      posed = second;
      deploy.time = Math.min(second, CLIP.seconds - 1e-3);
      mixer.update(0);
    },
    showYardsticks(grown) {
      yardsticks.visible = grown > 0.01;
      hubble.scale.setScalar(grown);
      child.scale.setScalar(grown);
    },
  };
}

// Earth, the Moon, L2 and the real path. One unit is 100,000 km.
function buildFlight(kit) {
  const { THREE, addGlow } = kit;
  const UNIT = 100000;
  const group = new THREE.Group();
  kit.scene.add(group);
  const track = kit.track(flight.rows, UNIT);
  const { halo, measured } = flight.spans;
  const outbound = kit.trail(group, track, { width: 2.4, ahead: 0.18, to: halo });
  // The loop around L2: NASA's forecast, faint and blue, under what has
  // been flown.
  const loop = new THREE.Group();
  group.add(loop);
  loop.add(kit.fatLine(track.points.subarray((measured - 1) * 3), 0x9fd0ff, 1, 0.22));
  const lapped = kit.trail(loop, track, { width: 2, ahead: 0.16, from: halo, to: measured });

  const moonTrack = kit.track(data.moon, UNIT);
  const month = moonTrack.indexAt(moonTrack.days[0] + 27.6) + 1;
  const moonLine = kit.fatLine(moonTrack.points.subarray(0, month * 3), 0xaebbd0, 1, 0.4);
  // The Sun-Earth line: sunward of Earth, and on through L2.
  group.add(moonLine, kit.thinLine([new THREE.Vector3(-7, 0, 0), new THREE.Vector3(19, 0, 0)], 0xaebbd0, 0.22));
  addGlow(group, 0x6ab0ff, 0.03, 2.4);
  const moonDot = addGlow(group, 0xd8dce6, 0.012, 1.6);
  const webbDot = addGlow(group, 0xffe7b0, 0.026, 4);
  const l2Dot = addGlow(group, 0x9fd0ff, 0.012, 2);
  const ringPoints = [];
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; ringPoints.push(new THREE.Vector3(0, Math.sin(a) * 0.45, Math.cos(a) * 0.45)); }
  const l2Ring = kit.thinLoop(ringPoints, 0x9fd0ff, 0.7);
  group.add(l2Ring);
  const milestones = [
    { day: DAYS.sunshieldOpen, text: '4 Jan · Sunshield open' },
    { day: DAYS.mirrorOpen, text: '8 Jan · Mirror unfolded' },
  ].map((m) => {
    const dot = addGlow(group, 0x6ab0ff, 0.011, 3);
    track.at(m.day, dot.position);
    return { ...m, dot };
  });

  const webb = webbDot.position, moon = moonDot.position, l2 = l2Dot.position;
  return {
    group, webb, moon, l2, milestones, EARTH: new THREE.Vector3(),
    // Put everything where it was on mission day `day`. `atL2` picks the
    // look: the way out from Earth, or the years of laps since.
    show(day, atL2) {
      outbound.update(day);
      lapped.update(day);
      track.at(day, webb);
      l2.set(flight.l2Km(msOf(day)) / UNIT, 0, 0);
      l2Ring.position.copy(l2);
      // Over years only the size of the Moon's month-long loop matters, so
      // it is parked on the ring.
      if (atL2) moonTrack.point(40, moon);
      else moonTrack.at(day, moon);
      loop.visible = atL2;
      moonLine.material.opacity = atL2 ? 0.3 : 0.4;
      for (const m of milestones) m.dot.visible = !atL2;
    },
  };
}

/* A dust cloud in two kinds of light. A made-up scene that follows one real
   rule: dust dims short waves far more than long ones. */
function buildNebula(kit) {
  const { THREE } = kit;
  const uniforms = { uInfrared: { value: 0 }, uAspect: { value: 1 }, uTime: { value: 0 }, uShift: { value: new THREE.Vector2() } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SPACE.GLSL_NOISE + `
      varying vec2 vUv;
      uniform float uInfrared; uniform float uAspect; uniform float uTime; uniform vec2 uShift;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // The star that lives in grid cell 'cell', as seen from grid point g.
      vec3 star(vec2 g, vec2 cell, float cells, float seed, float spikes) {
        vec2 id = cell + seed;
        vec2 at = vec2(hash(id), hash(id + 17.3)) * 0.6 + 0.2;
        vec2 d = (g - cell - at) / cells;
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
        // A star sits at least 0.2 of a cell inside its own cell, so any
        // star outside the four cells stars() adds up is 0.7 cells away or
        // more: the glow is gone by there and never ends at an edge.
        float reach = 1.0 - smoothstep(0.35, 0.7, length(d) * cells);
        return tint * bright * (core * 5.0 + rays * 2.2) * reach;
      }
      // One star per grid cell: xyz colour, scaled by brightness. A bright
      // star's glow and spikes spill past its own cell, so each point adds
      // up the four cells nearest to it (nine cost a third of the frame).
      vec3 stars(vec2 p, float cells, float seed, float spikes) {
        vec2 g = p * cells; vec2 cell = floor(g) + step(0.5, fract(g)) - 1.0;
        return star(g, cell, cells, seed, spikes) + star(g, cell + vec2(1.0, 0.0), cells, seed, spikes)
          + star(g, cell + vec2(0.0, 1.0), cells, seed, spikes) + star(g, cell + vec2(1.0, 1.0), cells, seed, spikes);
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
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  kit.scene.add(mesh);
  const viewport = new THREE.Vector2();
  return {
    mesh,
    // `amount` is 0 for visible light, 1 for infrared.
    show(amount) {
      kit.renderer.getSize(viewport);
      uniforms.uInfrared.value = amount;
      uniforms.uAspect.value = viewport.x / viewport.y;
      uniforms.uTime.value = kit.time;
      // On a phone the card covers the lower half, so the top of the cloud
      // is lifted into the half that shows.
      uniforms.uShift.value.set(kit.wide ? -0.12 : 0, kit.wide ? 0 : -0.2);
    },
  };
}

function craftChapters(kit, telescope) {
  const { THREE, anchors, orbit, place, drag } = kit;
  const centre = new THREE.Vector3(...CENTRE), mirror = new THREE.Vector3(...MIRROR);
  const at = new THREE.Vector3(), focus = new THREE.Vector3();
  // A phone sees a much thinner slice of the telescope.
  const phoneBack = 1.45;
  return {
    hero: {
      phoneBack,
      // A slow sway, not a full turn: the back of the telescope is in the dark.
      play(p) { orbit(centre, 0.55 + Math.sin(kit.time * 0.11) * 0.4 + drag.yaw, 0.3 + drag.pitch, lerp(40, 35, p)); },
    },
    telescope: {
      phoneBack,
      play(p) {
        const anchor = anchors.get(picker.selected);
        if (anchor) {
          anchor.getWorldPosition(at);
          const azimuth = Math.atan2(at.x, at.z + 0.001) + 0.45 + drag.yaw;
          // Parts under the shield are seen from the Sun's side, by its light.
          const below = at.y < 1.2;
          if (below) kit.light(TRUE);
          orbit(focus.copy(at).lerp(centre, 0.5), azimuth, (below ? -0.42 : 0.3) + drag.pitch, 32 + at.distanceTo(centre) * 0.8);
        } else {
          orbit(centre, 0.3 + p * 1.5 + drag.yaw, 0.3 + drag.pitch, 44);
        }
        kit.showHotspots();
      },
    },
    unfold: {
      phoneBack, clock: true,
      play(p) {
        const now = flight.unfoldAt(p);
        const open = smooth(1.8, 3, now.second);
        orbit(focus.copy(centre).setY(lerp(4.4, 3.4, open)), 0.45 + p * 0.9 + drag.yaw, lerp(0.22, 0.34, open) + drag.pitch, lerp(27, 48, open));
        showStep(now.index);
        kit.setClock(formatDate(msOf(now.dateDay)), now.label, '<b>' + thousands(flight.earthKm(now.day)) + '</b> km from Earth');
      },
    },
    sunshield: {
      phoneBack,
      play(p) {
        kit.light(TRUE);
        // From under the shield, where the Sun is, up over the edge into its
        // shadow.
        const elevation = lerp(-0.62, 0.5, smooth(0.12, 0.8, p));
        orbit(focus.copy(centre).setY(2.6), 0.95 + p * 0.5 + drag.yaw, elevation, 42);
        const side = smooth(-0.14, 0.14, elevation);
        SPACE.setText($('temp-value'), celsius(Math.round(lerp(SHIELD_C.sun, SHIELD_C.mirror, side))));
        SPACE.setText($('temp-side'), side < 0.03 ? 'Sun side' : side > 0.97 ? 'Mirror side' : 'Between the layers');
        place('hot', 'Sun side · ' + celsius(SHIELD_C.sun), at.set(0, -1.6, 3.5), { cls: 'is-craft', dx: 12, dy: 0, alpha: 1 - side });
        place('cold', 'Mirror side · ' + celsius(SHIELD_C.mirror), at.copy(mirror).setY(9), { cls: 'is-home', dx: 12, dy: -8, alpha: side });
      },
    },
    mirror: {
      phoneBack: 1.8,
      play(p, state) {
        const closer = smooth(0, 0.5, p), alpha = yardsticksIn(state);
        orbit(focus.copy(mirror).setX(0.3), lerp(0.5, -0.12, closer) + drag.yaw, 0.1 + drag.pitch, lerp(34, 27, closer));
        place('webb-mirror', 'Webb · 6.5 m', at.copy(mirror).setY(8.9), { cls: 'is-craft', dx: -34, dy: -16, alpha });
        place('hubble-mirror', 'Hubble · 2.4 m', at.copy(telescope.hubble).setY(7.6), { dx: -50, dy: -8, alpha });
        place('child', 'Age 9 · 1.35 m', at.copy(telescope.child).setY(5.7), { cls: 'is-home', dx: -50, dy: -16, alpha });
      },
    },
    future: {
      phoneBack,
      play(p) { orbit(centre, 0.75 + Math.sin(kit.time * 0.09) * 0.35 + drag.yaw, 0.3, lerp(44, 72, smooth(0.25, 1, p))); },
    },
  };
}

function flightChapters(kit, set) {
  const { orbit, place } = kit;
  const { webb, moon, l2, EARTH } = set;
  const focus = new kit.THREE.Vector3();
  const fromEarth = (day) => '<b>' + thousands(flight.earthKm(day)) + '</b> km from Earth';
  return {
    journey: {
      phoneBack: 1.75,
      play(p) {
        const day = chapterDay.journey(p);
        set.show(day, false);
        const reach = webb.length();
        orbit(focus.copy(webb).multiplyScalar(0.5), lerp(-0.25, 0.2, p), lerp(0.95, 0.7, p), 9 + reach * 2.3);
        place('earth', 'Earth', EARTH, { cls: 'is-home', dy: 8 });
        place('moon', 'Moon', moon, { dx: 8, dy: -4 });
        place('webb', 'Webb', webb, { cls: 'is-craft', dy: -18 });
        place('l2', 'L2', l2, { cls: 'is-event', dy: 10, alpha: smooth(6, 9, reach) });
        set.milestones.forEach((m, i) => { if (m.day <= day) place('m' + i, m.text, m.dot.position, { cls: 'is-event', dx: 12, dy: i ? 8 : -16 }); });
        kit.setClock(formatDate(msOf(day)), fromEarth(day), '<b>' + flight.kmPerSec(day).toFixed(2) + '</b> km/s');
        drawSpeedChart(day);
      },
    },
    halo: {
      phoneBack: 1.65,
      play(p) {
        const day = chapterDay.halo(p);
        set.show(day, true);
        // From above the orbit, round to the view from Earth, looking out
        // along the Sun-Earth line at the loop face-on.
        const turn = smooth(0.25, 0.85, p);
        orbit(focus.copy(l2).multiplyScalar(lerp(0.75, 1, turn)), lerp(0.1, -1.25, turn), lerp(1.0, 0.16, turn), lerp(52, 46, turn));
        place('earth', 'Earth', EARTH, { cls: 'is-home', dy: 8 });
        place('moon', 'Moon’s orbit', moon, { cls: 'is-dim', dx: 8, dy: -4 });
        place('webb', 'Webb', webb, { cls: 'is-craft', dy: -18 });
        place('l2', 'L2 · nothing here', l2, { cls: 'is-event', dx: 12, dy: 10 });
        kit.setClock(formatDate(msOf(day)), fromEarth(day), 'Lap <b>' + (flight.lapsBy(day) + 1) + '</b> around L2');
      },
    },
  };
}

function startScene(kit) {
  const telescope = buildTelescope(kit);
  const flightSet = buildFlight(kit);
  const nebula = buildNebula(kit);

  kit.run({
    sets: { craft: [telescope.group, kit.stars.points], l2: [flightSet.group, kit.stars.points], nebula: [nebula.mesh] },
    chapters: {
      ...craftChapters(kit, telescope),
      ...flightChapters(kit, flightSet),
      infrared: {
        clock: false,
        play(p) {
          if (!readerHasSlider) setInfrared(smooth(0.3, 0.7, p), false);
          nebula.show(infrared);
        },
      },
    },
    studio: SHOWN,
    frame(state) {
      kit.sunLight.castShadow = kit.stage === 'craft';
      telescope.unfoldTo(unfolded(state));
      telescope.showYardsticks(yardsticksIn(state));
    },
  });
}
