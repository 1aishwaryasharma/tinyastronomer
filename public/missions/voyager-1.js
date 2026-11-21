/* Voyager 1 — a scroll-driven story on three kinds of 3D set:
     craft    the spacecraft itself, in metres
     system   the Sun, planets and Voyager's real path, in astronomical units
     flyby    Jupiter or Saturn with the real path past it, in planet radii
   Scroll position picks the chapter and its progress (mission-story.js);
   each chapter turns progress into a mission date and a camera pose. Every
   position Voyager takes comes from trajectory.json (JPL Horizons). */
import { SPACE } from '/common.bundle.js?v=20261121-1';
import { PLANETS, clockTime, formatDate, formatLightTime, lerp, smooth } from '/mission-orbits.js?v=20261121-1';
import { createMissionKit } from '/mission-scene.js?v=20261121-2';
import { createClipButtons, createMissionAudio } from '/mission-audio.js?v=20261121-1';
import { createChart, createPartPicker, createStory } from '/mission-story.js?v=20261121-2';
import { BEDS, GREETINGS, PARTS, createFlight } from '/missions/voyager-1-mission.js?v=20261121-2';

const ASSETS = '/assets/missions/voyager-1/';
const $ = (id) => document.getElementById(id);
const km = (value) => Math.round(value).toLocaleString('en-US');
const titled = (name) => name[0].toUpperCase() + name.slice(1);

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const flight = createFlight(data);
const { DAYS, chapterDay } = flight;

/* ──── Live figures: these run with or without the 3D scene ──── */
function tickLive() {
  const now = flight.live(Date.now());
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
  const seconds = flight.live(Date.now()).lightSeconds;
  const when = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  $('hello-out').innerHTML = 'Sent at the speed of light. Voyager hears it on <strong>' + when(Date.now() + seconds * 1000)
    + '</strong>. If it answered straight away, the reply would reach you on <strong>'
    + when(Date.now() + seconds * 2000) + '</strong>.';
  helloSentAt = performance.now();
});

const picker = createPartPicker(PARTS);

/* ──── Sound: off until asked for, and it works without the 3D scene ──── */
const sound = createMissionAudio({
  beds: BEDS,
  clips: {
    plasma: { url: ASSETS + 'audio/plasma-waves.mp3', gain: 0.5 },
    ...Object.fromEntries(GREETINGS.map((g) => [g.key, { url: ASSETS + 'audio/greeting-' + g.key + '.mp3' }])),
  },
  button: $('sound-toggle'),
});
$('greetings-box').hidden = $('plasma-box').hidden = !sound.supported;
createClipButtons($('plasma'), [{ key: 'plasma', label: 'Hear interstellar space' }], sound);
createClipButtons($('greetings'), GREETINGS, sound, (greeting) => {
  $('greeting-out').innerHTML = '“' + greeting.said + '” <strong>' + greeting.label + '</strong>';
});

const drawJupiterChart = createChart($('chart-jupiter'), data.speed.jupiter, { events: [{ day: DAYS.jupiter, label: 'closest approach' }] });
drawJupiterChart(data.speed.jupiter[0][0]);

/* ──── 3D scene ──── */
const kit = createMissionKit();
if (kit) {
  startScene(kit);
} else {
  const story = createStory($('story'), { onChapter: sound.stop });
  const hear = () => sound.follow(story.read());
  addEventListener('scroll', hear, { passive: true });
  hear();
}

function buildCraft(kit) {
  const craft = new kit.THREE.Group();
  // The model's dish points along +Z; stand it up so the dish faces the
  // light and the record wall faces the default camera.
  craft.rotation.x = -Math.PI / 2;
  kit.scene.add(craft);
  kit.loadModel(ASSETS + 'voyager.glb', (gltf) => {
    craft.add(gltf.scene);
    kit.addHotspots(gltf.scene, picker);
  });
  return craft;
}

// The heliosphere. Its real shape is not known; this is a blunt nose toward
// the incoming interstellar wind and a longer tail, sized so each surface
// passes through the point where Voyager 1 actually crossed it.
function buildHeliosphere(kit, parent, shockPoint, pausePoint) {
  const { THREE } = kit;
  const noseLon = 255.4 * Math.PI / 180, noseLat = 5.2 * Math.PI / 180;
  const nose = kit.E([Math.cos(noseLat) * Math.cos(noseLon), Math.cos(noseLat) * Math.sin(noseLon), Math.sin(noseLat)]).normalize();
  const stretch = (cosNose) => Math.min(2.4, Math.pow(2 / (1 + cosNose + 1e-4), 0.6));
  const STRETCH_GLSL = 'float stretch(float c) { return min(2.4, pow(2.0 / (1.0 + c + 0.0001), 0.6)); }';
  const radiusThrough = (point) => point.length() / stretch(point.clone().normalize().dot(nose));
  const shockR = radiusThrough(shockPoint), pauseR = radiusThrough(pausePoint);

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
    const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uStrength: { value: strength }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
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
    parent.add(mesh);
    return mesh;
  }
  const bubbles = [bubble(shockR, 0xf4a24a, 0.6), bubble(pauseR, 0x6ab0ff, 1.5)];

  const windUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uNose: { value: nose }, uShock: { value: shockR }, uPause: { value: pauseR }, uPixel: { value: 1 } };
  function particles(count, color, vertexShader) {
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
      uniforms: { ...windUniforms, uColor: { value: new THREE.Color(color) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader,
      fragmentShader: `
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor * vAlpha * (1.0 - smoothstep(0.1, 0.5, d)), 1.0);
        }`,
    }));
    points.frustumCulled = false;
    parent.add(points);
  }
  // Solar wind streaming out to the shock.
  particles(1500, 0xffb860, `
    attribute vec2 seed; uniform float uTime; uniform float uOpacity; uniform vec3 uNose; uniform float uShock; uniform float uPixel;
    varying float vAlpha; ${STRETCH_GLSL}
    void main() {
      float f = fract(seed.x + uTime * 0.035 * seed.y);
      vec3 p = position * f * uShock * stretch(dot(position, uNose));
      vAlpha = uOpacity * smoothstep(0.02, 0.2, f) * (1.0 - smoothstep(0.82, 1.0, f)) * 0.9;
      gl_PointSize = 2.6 * uPixel;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`);
  // Interstellar gas flowing past the outside of the bubble.
  particles(1700, 0x7fb4ff, `
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
    }`);

  return function show(opacity) {
    for (const mesh of bubbles) {
      mesh.material.uniforms.uOpacity.value = opacity;
      mesh.material.uniforms.uTime.value = kit.time;
      mesh.visible = opacity > 0.01;
    }
    windUniforms.uOpacity.value = opacity;
    windUniforms.uTime.value = kit.time;
    windUniforms.uPixel.value = kit.renderer.getPixelRatio();
  };
}

function buildSystem(kit) {
  const { THREE, addGlow, place } = kit;
  const ORIGIN = new THREE.Vector3();
  const group = new THREE.Group();
  kit.scene.add(group);
  const planets = kit.planets(group, PLANETS, Date.UTC(1985, 0, 1));
  const earth = planets.dots.get('earth');
  const sun = addGlow(group, 0xffc060, 0.075, 7);
  addGlow(group, 0xfff2cc, 0.03, 9);

  const track = kit.track(flight.rows);
  const flown = kit.trail(group, track, { width: 2.4, ahead: 0.16 });
  const voyager = flown.here;
  const voyagerDot = addGlow(group, 0xffe7b0, 0.03, 4);
  const pulse = addGlow(group, 0x9fd0ff, 0.035, 5);
  const earthLine = kit.thinLine([ORIGIN, ORIGIN], 0x6ab0ff, 0.5);
  // How far above the plane of the planets the path has climbed.
  const drop = kit.thinLine([ORIGIN, ORIGIN, ORIGIN], 0xaebbd0, 0.3);
  const foot = new THREE.Vector3();
  group.add(earthLine, drop);
  const rings = [50, 100, 150].map((radius) => {
    const points = [];
    for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
    const loop = kit.thinLoop(points, 0xaebbd0, 0.14);
    group.add(loop);
    return { radius, loop, labelAt: new THREE.Vector3(-radius * 0.7, 0, radius * 0.714) };
  });
  const milestones = [
    { day: DAYS.portrait, text: '1990 · Pale Blue Dot' },
    { day: DAYS.shock, text: '2004 · Solar wind slows' },
    { day: DAYS.pause, text: '2012 · Interstellar space' },
    { day: DAYS.lightDay, text: '2026 · One light-day' },
  ].map((m) => {
    const dot = addGlow(group, 0x6ab0ff, 0.012, 3);
    track.at(m.day, dot.position);
    return { ...m, dot };
  });
  const showHeliosphere = buildHeliosphere(kit, group, milestones[1].dot.position, milestones[2].dot.position);
  const INNER = ['mercury', 'venus', 'earth', 'mars'];

  return {
    group, planets, voyager, ORIGIN,
    // Put everything where it was on mission day `day`.
    show(day) {
      flown.update(day);
      voyagerDot.position.copy(voyager);
      planets.moveTo(flight.msOf(day));
      drop.geometry.setFromPoints([voyager, foot.set(voyager.x, 0, voyager.z), ORIGIN]);
      drop.visible = voyager.length() > 11;
      const sunAu = voyager.length();
      kit.setClock(formatDate(flight.msOf(day)),
        '<b>' + sunAu.toFixed(sunAu < 20 ? 2 : 1) + '</b> AU from the Sun',
        '<b>' + flight.at(day)[4].toFixed(1) + '</b> km/s');
    },
    labelMilestones(shown) {
      for (const m of milestones) if (shown(m)) place('m' + m.day, m.text, m.dot.position, { cls: 'is-event', dx: 12, dy: 6 });
    },
    // The radio link, and a day of light-travel played in a few seconds: out,
    // then back.
    signal(cycle) {
      earthLine.geometry.setFromPoints([earth.position, voyager]);
      pulse.position.lerpVectors(earth.position, voyager, cycle < 1 ? cycle : 2 - cycle);
    },
    // What depends on how far out the camera is, and on `lookBack`: 0 for
    // the usual view from outside, 1 for the view from Voyager's own camera,
    // where its path and marker would only be in the way.
    dress(state, lookBack) {
      const reach = kit.camera.position.length();
      const far = smooth(45, 130, reach);
      const portrait = state.id === 'portrait';
      flown.done.material.opacity = flown.lead.material.opacity = voyagerDot.material.opacity = 1 - lookBack;
      flown.ahead.material.opacity = 0.16 * (1 - lookBack);
      drop.material.opacity = 0.3 * (1 - lookBack);
      // From out there Earth really is a speck: let its dot shrink to one.
      earth.userData.fraction = lerp(0.018, 0.007, lookBack);
      sun.userData.fraction = lerp(0.075, 0.045, far) * lerp(1, 0.5, lookBack);
      earthLine.visible = pulse.visible = state.id === 'lightday';
      showHeliosphere(far);
      const outer = 0.34 * lerp(0.5, 1, 1 - smooth(60, 220, reach));
      for (const [name, loop] of planets.loops) {
        loop.material.opacity = INNER.includes(name) ? outer * (1 - smooth(18, 50, reach)) : outer;
        loop.visible = loop.material.opacity > 0.01;
      }
      for (const name of ['mercury', 'venus', 'mars']) planets.dots.get(name).visible = reach < 70 || portrait;
      for (const ring of rings) {
        ring.loop.material.opacity = 0.16 * far;
        ring.loop.visible = far > 0.01;
        if (far > 0.5) place('ring' + ring.radius, ring.radius + ' AU', ring.labelAt, { cls: 'is-dim', dx: 4, dy: 4, alpha: far * 0.8 });
      }
      for (const m of milestones) m.dot.visible = far > 0.3 && !portrait;
    },
  };
}

// Jupiter or Saturn, the moon Voyager passed on the way in, and the path
// past both, seen from above the plane of the pass.
function buildFlyby(kit, cfg) {
  const { THREE, addGlow, pose } = kit;
  const group = new THREE.Group();
  kit.scene.add(group);
  const planet = kit.globe(group, cfg);
  const path = kit.track(cfg.path, cfg.radiusKm);
  const flown = kit.trail(group, path, { width: 2.8, ahead: 0.22 });
  const marker = addGlow(group, 0xffe7b0, 0.03, 4);
  const moonPath = kit.track(cfg.moon.rows, cfg.radiusKm);
  group.add(kit.fatLine(moonPath.points, cfg.moon.color, 1, 0.3));
  const moon = addGlow(group, cfg.moon.color, 0.016, 2.2);

  const closest = path.at(cfg.closestDay, new THREE.Vector3()).normalize();
  const normal = path.point(0, new THREE.Vector3()).cross(path.point(path.count - 1, new THREE.Vector3())).normalize();
  if (normal.y < 0) normal.negate();
  const toSun = kit.E(flight.at(cfg.closestDay).slice(1, 4)).normalize().negate();
  const swing = new THREE.Vector3(), centre = new THREE.Vector3();
  return {
    group,
    load: planet.load,
    play(p) {
      const day = chapterDay[cfg.key](p), ms = flight.msOf(day);
      const here = flown.update(day);
      marker.position.copy(here);
      moonPath.at(day, moon.position);
      planet.turnTo(day);
      kit.aimSun(toSun);
      // Look down on the plane of the pass and swing a little with it.
      swing.copy(closest).applyAxisAngle(normal, lerp(0.7, -0.5, p));
      const near = 1 - Math.abs(p - 0.5) * 2;
      pose.position.copy(normal).multiplyScalar(0.5).addScaledVector(swing, 0.87).normalize()
        .multiplyScalar(lerp(cfg.far, cfg.near, smooth(0, 1, near)));
      pose.target.copy(here).multiplyScalar(0.25);
      kit.fit([centre, here]);
      kit.setClock(formatDate(ms), clockTime(ms), '<b>' + km(here.length() * cfg.radiusKm) + '</b> km from ' + cfg.name + '’s centre');
      kit.place('fly-voyager', 'Voyager 1', here, { cls: 'is-craft' });
      kit.place('fly-moon', cfg.moon.name, moon.position);
      if (cfg.chart) cfg.chart(day);
    },
  };
}

function craftChapters(kit) {
  const { anchors, orbit, drag } = kit;
  const CENTRE = new kit.THREE.Vector3(0, 1.2, 0), at = new kit.THREE.Vector3();
  return {
    hero: { play(p) { orbit(CENTRE, 0.75 + kit.time * 0.07 + drag.yaw, 0.2 + drag.pitch, lerp(21, 17, p)); } },
    craft: {
      play(p) {
        const anchor = anchors.get(picker.selected);
        if (anchor) {
          anchor.getWorldPosition(at);
          const azimuth = Math.atan2(at.x, at.z) + 0.5 + drag.yaw;
          orbit(at.multiplyScalar(0.85), azimuth, 0.3 + drag.pitch, 11 + at.length() * 0.8);
        } else {
          orbit(CENTRE, 0.75 + p * 2.4 + drag.yaw, 0.24 + drag.pitch, 18);
        }
        kit.showHotspots();
      },
    },
    record: {
      play(p) {
        const anchor = anchors.get('GoldenRecord');
        if (!anchor) return orbit(at.set(0, 0, 0), 0, 0.1, 6);
        anchor.getWorldPosition(at);
        const azimuth = Math.atan2(at.x, at.z) + lerp(0.5, -0.35, p) + drag.yaw;
        orbit(at, azimuth, 0.12 + drag.pitch * 0.5, lerp(3.4, 2.1, smooth(0, 0.7, p)));
      },
    },
    future: { play(p) { orbit(CENTRE, 2.6 + kit.time * 0.04 + drag.yaw, 0.16, 22 * Math.pow(26, smooth(0.1, 1, p))); } },
  };
}

// How far the Pale Blue Dot chapter has turned from the outside view (0) to
// the view from Voyager's own camera (1).
const lookBack = (state) => (state.id === 'portrait' ? smooth(0.36, 0.6, state.progress) : 0);

function systemChapters(kit, system) {
  const { orbit, fit, place, pose } = kit;
  const { voyager, planets, ORIGIN } = system;
  const dot = (name) => planets.dots.get(name).position;
  const focus = new kit.THREE.Vector3();
  const VOYAGER = { cls: 'is-craft', dx: 10, dy: -18 };
  return {
    launch: {
      play(p) {
        system.show(chapterDay.launch(p));
        orbit(focus.copy(voyager).multiplyScalar(0.45), -0.9 + p * 0.5, lerp(1.05, 0.8, p), 3.4 + voyager.length() * 2.1);
        fit([ORIGIN, voyager, dot('jupiter')]);
        place('earth', 'Earth', dot('earth'), { cls: 'is-home' });
        place('jupiter', 'Jupiter', dot('jupiter'));
        place('voyager', 'Voyager 1', voyager, VOYAGER);
      },
    },
    cruise: {
      play(p) {
        system.show(chapterDay.cruise(p));
        orbit(focus.copy(voyager).multiplyScalar(0.5), -0.4 + p * 0.4, 0.8, 4 + voyager.length() * 2);
        fit([ORIGIN, voyager, dot('jupiter'), dot('saturn')]);
        place('jupiter', 'Jupiter', dot('jupiter'));
        place('saturn', 'Saturn', dot('saturn'));
        place('voyager', 'Voyager 1', voyager, VOYAGER);
      },
    },
    portrait: {
      play(p, state) {
        const eye = lookBack(state);
        system.show(chapterDay.portrait(p));
        orbit(focus.copy(voyager).multiplyScalar(0.5), 0.1 + p * 0.5, 0.5, 14 + voyager.length() * 2.3);
        fit([ORIGIN, voyager]);
        // Slide to Voyager's own position and look back at the Sun.
        pose.position.lerp(focus.copy(voyager).multiplyScalar(1.004), eye);
        pose.target.lerp(ORIGIN, eye);
        pose.fov *= Math.pow(0.11, smooth(0.72, 0.98, p));
        if (eye < 0.5) {
          place('saturn', 'Saturn', dot('saturn'), { alpha: 1 - eye * 2 });
          place('voyager', 'Voyager 1', voyager, { ...VOYAGER, alpha: 1 - eye * 2 });
        } else {
          const alpha = smooth(0.6, 0.68, p);
          for (const name of ['venus', 'jupiter', 'saturn', 'uranus', 'neptune']) place(name, titled(name), dot(name), { cls: 'is-dim', alpha });
          place('earth', 'Earth · less than one pixel', dot('earth'), { cls: 'is-home', dx: 12, alpha });
          place('sun', 'The Sun', ORIGIN, { cls: 'is-dim', dx: 14, dy: 16, alpha });
        }
      },
    },
    edge: {
      play(p) {
        const day = chapterDay.edge(p);
        system.show(day);
        orbit(focus.copy(voyager).multiplyScalar(0.42), -1.1 - p * 0.6, lerp(0.42, 0.2, p), 70 + voyager.length() * 2.5);
        fit([ORIGIN, voyager]);
        place('voyager', 'Voyager 1', voyager, VOYAGER);
        place('sun', 'Sun & planets', ORIGIN, { cls: 'is-dim', dx: 12, dy: 14 });
        system.labelMilestones((m) => m.day <= day && m.day > DAYS.portrait);
        if (day >= DAYS.pause) sound.cue('plasma');
      },
    },
    lightday: {
      play() {
        system.show(chapterDay.lightday());
        orbit(focus.copy(voyager).multiplyScalar(0.5), -1.75 + (kit.reduced ? 0 : Math.sin(kit.time * 0.08) * 0.2), 0.2, voyager.length() * 2.2);
        fit([ORIGIN, voyager]);
        place('voyager', 'Voyager 1 · now', voyager, VOYAGER);
        place('sun', 'Sun & Earth', ORIGIN, { cls: 'is-home', dx: 12, dy: 14 });
        system.labelMilestones((m) => m.day !== DAYS.lightDay);
        const sinceHello = helloSentAt < 0 ? Infinity : (performance.now() - helloSentAt) / 1000;
        system.signal(sinceHello < 9 ? sinceHello / 4.5 : (kit.reduced ? 0.6 : (kit.time * 0.16) % 2));
      },
    },
  };
}

function startScene(kit) {
  const craft = buildCraft(kit);
  const system = buildSystem(kit);
  const jupiter = buildFlyby(kit, {
    key: 'jupiter', name: 'Jupiter', radiusKm: 71492, color: 0xc9a27e, pole: [268.057, 64.495], periodDays: 0.41354,
    path: data.jupiter.path, closestDay: DAYS.jupiter, far: 46, near: 24, chart: drawJupiterChart,
    moon: { name: 'Io', rows: data.jupiter.io, color: 0xf2d66b },
  });
  const saturn = buildFlyby(kit, {
    key: 'saturn', name: 'Saturn', radiusKm: 60268, color: 0xd8c690, pole: [40.589, 83.537], periodDays: 0.44401,
    path: data.saturn.path, closestDay: DAYS.saturn, far: 72, near: 26,
    moon: { name: 'Titan', rows: data.saturn.titan, color: 0xe8a04a },
  });

  kit.run({
    sets: { craft: [craft], system: [system.group], jupiter: [jupiter.group], saturn: [saturn.group] },
    chapters: {
      ...craftChapters(kit),
      ...systemChapters(kit, system),
      jupiter: { play: jupiter.play },
      saturn: { play: saturn.play },
    },
    onChapter(chapter) {
      sound.stop();
      // Fetch each planet a chapter early so it is there when the cut lands.
      if (chapter.id === 'launch' || chapter.id === 'jupiter') jupiter.load();
      if (chapter.id === 'jupiter' || chapter.id === 'cruise' || chapter.id === 'saturn') saturn.load();
    },
    frame(state) {
      sound.follow(state);
      // Light scattered inside the camera when it looked back at the Sun.
      $('sunbeams').style.opacity = state.id === 'portrait' ? (smooth(0.62, 0.9, state.progress) * 0.9).toFixed(3) : 0;
      if (kit.stage === 'system') system.dress(state, lookBack(state));
    },
  });
}
