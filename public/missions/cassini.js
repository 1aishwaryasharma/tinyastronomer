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
import { SPACE } from '/common.bundle.js?v=20261121-3';
import {
  clockTime, formatDate, formatLightTime, lerp, planetPosition, smooth, unpackRows,
} from '/mission-orbits.js?v=20261121-2';
import { createMissionKit } from '/mission-scene.js?v=20261121-4';
import { createChart, createPartPicker } from '/mission-story.js?v=20261121-3';
import { PARTS, SATURN, createFlight } from '/missions/cassini-mission.js?v=20261121-2';

const ASSETS = '/assets/missions/cassini/';
const $ = (id) => document.getElementById(id);
const km = (value) => Math.round(value).toLocaleString('en-US');

SPACE.buildNav('missions');

const data = await (await fetch(ASSETS + 'trajectory.json')).json();
const flight = createFlight(data);
const { DAYS, chapterDay } = flight;

/* ──── Live figures: these run with or without the 3D scene ──── */
function tickLive() {
  const now = flight.live(Date.now());
  SPACE.setText($('hero-saturn-km'), km(now.earthKm / 1e6));
  SPACE.setText($('hero-signal'), formatLightTime(now.lightSeconds));
}
tickLive();
setInterval(tickLive, 1000);

const picker = createPartPicker(PARTS);

const drawCruiseChart = createChart($('chart-cruise'), data.speed, { events: flight.flybys.map((flyby) => ({ day: flyby.day, label: flyby.name[0] })) });
drawCruiseChart(data.speed[0][0]);

/* ──── 3D scene ──── */
const CRAFT_TAG = { cls: 'is-craft', dx: 12, dy: -18 };
// Lets a globe hide what passes behind it.
const occludable = (object) => { object.material.depthTest = true; object.renderOrder = 3; return object; };
// Which way the Sun lay from Saturn, and so from its moons, on a mission day.
const sunward = (kit, day, out) => kit.E(planetPosition('saturn', flight.msOf(day)), out).normalize().negate();
const sinLatitude = (position, pole) => position.dot(pole) / position.length();
const upright = (kit, object, pole) => { object.quaternion.setFromUnitVectors(new kit.THREE.Vector3(0, 1, 0), pole); return object; };

function buildCraft(kit) {
  const { THREE } = kit;
  const group = new THREE.Group();
  // The model's dish points along +Z; stand it up so the dish is on top and
  // the Huygens probe faces the default camera.
  const model = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  group.add(model);
  kit.scene.add(group);
  // Huygens gets a pivot at its own centre so it can spin and drift away.
  const probe = new THREE.Group();
  let home = null;
  kit.loadModel(ASSETS + 'cassini.glb', (gltf) => {
    model.add(gltf.scene);
    group.updateMatrixWorld(true);
    const shell = gltf.scene.getObjectByName('HuygensProbe');
    if (shell) {
      new THREE.Box3().setFromObject(shell).getCenter(probe.position);
      gltf.scene.worldToLocal(probe.position);
      gltf.scene.add(probe);
      home = probe.position.clone();
      probe.attach(shell);
      const anchor = gltf.scene.getObjectByName('Hotspot_HuygensProbe');
      if (anchor) probe.attach(anchor);
    }
    kit.addHotspots(gltf.scene, picker);
  });
  return {
    group,
    // Put the probe `metres` out along its own axis (the model's -Y), after
    // `turns` of spin. Returns where it is, or null until the model is in.
    setProbe(metres, turns, visible = true) {
      if (!home) return null;
      probe.position.copy(home);
      probe.position.y -= metres;
      probe.rotation.y = turns * Math.PI * 2;
      probe.visible = visible;
      return probe;
    },
  };
}

function craftChapters(kit, craft) {
  const { anchors, orbit, drag } = kit;
  const CENTRE = new kit.THREE.Vector3(1.2, 0, 0), at = new kit.THREE.Vector3();
  return {
    hero: {
      phoneBack: 1.5,
      play(p) {
        craft.setProbe(0, 0);
        orbit(CENTRE, 0.5 + kit.time * 0.07 + drag.yaw, 0.16 + drag.pitch, lerp(27, 23, p));
      },
    },
    craft: {
      phoneBack: 1.5,
      play(p) {
        craft.setProbe(0, 0);
        const anchor = anchors.get(picker.selected);
        if (anchor) {
          anchor.getWorldPosition(at);
          const azimuth = (at.x * at.x + at.z * at.z > 0.2 ? Math.atan2(at.x, at.z) : 0.6) + 0.5 + drag.yaw;
          orbit(at.multiplyScalar(0.85), azimuth, 0.26 + Math.sign(at.y) * 0.1 + drag.pitch, 10 + at.length() * 0.9);
        } else {
          orbit(CENTRE, 0.5 + p * 2.6 + drag.yaw, 0.2 + drag.pitch, 24);
        }
        kit.showHotspots();
      },
    },
    release: {
      phoneBack: 1.8,
      play(p) {
        // Illustration: Huygens left at about a third of a metre per second,
        // turning seven times a minute to stay steady.
        const out = smooth(0.18, 1, p);
        const probe = craft.setProbe(out * 11, p * 5);
        orbit(at.set(1.5, -0.6, 1 + out * 4.5), lerp(-0.7, -1.0, p) + drag.yaw, 0.14 + drag.pitch * 0.5, 21 + out * 9);
        if (probe && out > 0.04) kit.place('probe', 'Huygens', probe.getWorldPosition(at), { cls: 'is-craft', dx: kit.wide ? 64 : -24, dy: kit.wide ? -6 : 44 });
      },
    },
    legacy: {
      play(p) {
        // Cassini flew its last twelve years without the probe.
        craft.setProbe(0, 0, false);
        orbit(CENTRE, 2.5 + kit.time * 0.04 + drag.yaw, 0.14, 26 * Math.pow(22, smooth(0.15, 1, p)));
      },
    },
  };
}

// The seven years from Earth to Saturn, past Venus twice, Earth and Jupiter.
function buildSystem(kit) {
  const { addGlow, place } = kit;
  const group = new kit.THREE.Group();
  kit.scene.add(group);
  const planets = kit.planets(group, ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn'], Date.UTC(2001, 0, 1));
  addGlow(group, 0xffc060, 0.042, 5);
  addGlow(group, 0xfff2cc, 0.02, 8);
  const flown = kit.trail(group, kit.track(data.cruise), { width: 2.4, ahead: 0.16 });
  const cassini = flown.here;
  const marker = addGlow(group, 0xffe7b0, 0.03, 4);
  const marks = flight.flybys.map((flyby) => ({ flyby, dot: addGlow(group, 0x6ab0ff, 0.012, 3) }));
  for (const mark of marks) kit.E(mark.flyby.at, mark.dot.position);
  const focus = new kit.THREE.Vector3();
  // Where two tags would print over each other, the lower rank fades: a
  // planet's name gives way to a flyby tag, and both to Cassini's.
  const name = (planet, text, day, options) => place(planet, text, planets.dots.get(planet).position, { ...options, alpha: flight.nameTagAlpha(planet, day), rank: 1 });
  return {
    group,
    play(p) {
      const day = chapterDay.cruise(p), ms = flight.msOf(day);
      const { sunAu, kmPerSec, inner } = flight.cruise(day);
      flown.update(day);
      marker.position.copy(cassini);
      planets.moveTo(ms);
      kit.orbit(focus.copy(cassini).multiplyScalar(0.42), -0.5 + p * 0.9, lerp(1.05, 0.72, p), 3.6 + sunAu * 2.3);
      kit.setClock(formatDate(ms), '<b>' + sunAu.toFixed(2) + '</b> AU from the Sun', '<b>' + kmPerSec.toFixed(1) + '</b> km/s');
      place('cassini', 'Cassini', cassini, { cls: 'is-craft', dy: -18, rank: 3 });
      name('earth', 'Earth', day, { cls: 'is-home' });
      name('venus', 'Venus', day, { dy: 8 });
      if (!inner) {
        name('jupiter', 'Jupiter', day);
        name('saturn', 'Saturn', day);
      }
      for (const { flyby, dot } of marks) {
        dot.visible = day >= flyby.day;
        // The second Venus tag sits above its mark, clear of the first's.
        if (flight.flybyTagged(flyby, day)) place('fly-' + flyby.key, flyby.text, dot.position, { cls: 'is-event', dx: 12, dy: flyby.key === 'venus2' ? -20 : 6, rank: 2 });
      }
      drawCruiseChart(day);
    },
  };
}

// Saturn alone. Each of the three stages played around it adds its own group.
function buildSaturn(kit) {
  const group = new kit.THREE.Group();
  kit.scene.add(group);
  // The dives of the Grand Finale clear the equator by a few per cent of
  // Saturn's radius, so one unit has to be the equatorial radius exactly.
  const globe = kit.globe(group, { key: 'saturn', color: 0xd8c690, pole: SATURN.pole, periodDays: SATURN.periodDays, radius: 'equatorial' });
  return { group, ...globe };
}

function buildInsertion(kit, saturn) {
  const { THREE, addGlow, place, pose } = kit;
  const pole = saturn.axis;
  const group = new THREE.Group();
  saturn.group.add(group);
  const path = kit.track(data.soi.path, data.saturnKm);
  const flown = kit.trail(group, path, { width: 2.8, ahead: 0.24 });
  flown.lines.forEach(occludable);
  const burnFrom = path.indexAt(DAYS.burnStart) + 1, burnTo = path.indexAt(DAYS.burnEnd);
  const burn = occludable(kit.fatLine(path.points.subarray(burnFrom * 3, (burnTo + 1) * 3), new THREE.Color(0xff7a3c).multiplyScalar(1.6), 5));
  group.add(burn);
  const marker = addGlow(group, 0xffe7b0, 0.03, 4);
  const crossings = data.soi.crossings.map((crossing) => ({ day: crossing.day, at: path.at(crossing.day, new THREE.Vector3()) }));
  const closest = path.at(DAYS.soi, new THREE.Vector3()).normalize();
  const toSun = sunward(kit, DAYS.soi);
  // The view direction in the ring plane: between the Sun and the point of
  // closest approach, so both the lit face and the pass are in sight.
  const view = toSun.clone().addScaledVector(pole, -toSun.dot(pole)).normalize().multiplyScalar(0.8).add(closest).normalize();
  return {
    group,
    play(p) {
      const day = chapterDay.arrival(p), ms = flight.msOf(day);
      const here = flown.update(day);
      marker.position.copy(here);
      saturn.turnTo(day);
      kit.aimSun(toSun);
      burn.geometry.instanceCount = Math.max(0, Math.min(burnTo, path.indexAt(day)) - burnFrom);
      // From the sunlit south side, a little below the rings, swinging with
      // the pass.
      const near = 1 - Math.abs(p - 0.5) * 2;
      pose.position.copy(view).applyAxisAngle(pole, lerp(0.45, -0.35, p))
        .multiplyScalar(Math.cos(0.3)).addScaledVector(pole, -Math.sin(0.3))
        .multiplyScalar(lerp(15, 9.5, smooth(0, 1, near)));
      pose.target.copy(here).multiplyScalar(0.3);
      kit.setClock(formatDate(ms), clockTime(ms), '<b>' + km(here.length() * data.saturnKm) + '</b> km from Saturn’s centre');
      const burning = day >= DAYS.burnStart && day <= DAYS.burnEnd;
      place('soi-cassini', burning ? 'Cassini · engine firing' : 'Cassini', here, CRAFT_TAG);
      crossings.forEach((crossing, i) => {
        if (day >= crossing.day - 0.05) place('cross' + i, 'Through the ring plane', crossing.at, { cls: 'is-event', dx: 12, dy: 8 });
      });
    },
  };
}

const PHASE_COLORS = [0xf4c560, 0x6fd6c4, 0x8fb0ff, 0xff8f6b];

// All thirteen years of orbits, with Titan, whose pull shaped every one.
function buildTour(kit, saturn) {
  const { THREE, addGlow, place } = kit;
  const group = new THREE.Group();
  saturn.group.add(group);
  const titanPath = kit.track(data.titanOrbit.path, data.saturnKm);
  group.add(kit.thinLoop(Array.from({ length: titanPath.count }, (_, i) => titanPath.point(i, new THREE.Vector3())), 0xe8a04a, 0.5));
  const titan = addGlow(group, 0xe8a04a, 0.016, 2.2);
  const marker = addGlow(group, 0xffe7b0, 0.026, 4);
  const ORIGIN = new THREE.Vector3(), toSun = new THREE.Vector3();
  let path = null, flown = [];
  return {
    group,
    // `track` is the whole tour, from tour.bin; until it arrives Cassini
    // waits at Saturn.
    fly(track) {
      path = track;
      flown = flight.PHASES.map((phase, i) => {
        const line = kit.trail(group, track, {
          color: PHASE_COLORS[i], width: 1.3, ahead: 0,
          from: track.indexAt(phase.from), to: track.indexAt(flight.PHASES[i + 1]?.from ?? Infinity),
        });
        line.done.material.opacity = 0.62;
        return line;
      });
    },
    play(p) {
      const day = chapterDay.tour(p);
      kit.aimSun(sunward(kit, day, toSun));
      saturn.turnTo(day);
      for (const line of flown) line.update(day);
      if (path) path.at(day, marker.position);
      titanPath.at(flight.titanLapDay(day), titan.position);
      // Pull in from the huge first orbit, then drift around the tangle.
      kit.orbit(ORIGIN, 0.4 + p * 2.2 + (kit.reduced ? 0 : Math.sin(kit.time * 0.05) * 0.1), lerp(1.0, 0.42, smooth(0, 0.9, p)), lerp(430, lerp(210, 270, p), smooth(0.02, 0.2, p)));
      kit.setClock(formatDate(flight.msOf(day)), '<b>' + flight.orbitsCompleted(day) + '</b> orbits completed', flight.phaseAt(day).name);
      place('tour-cassini', 'Cassini', marker.position, { cls: 'is-craft', dy: -18 });
      place('tour-titan', 'Titan', titan.position, { dy: 8 });
      if (marker.position.length() > 14) place('tour-saturn', 'Saturn', ORIGIN, { cls: 'is-dim', dy: 12 });
    },
  };
}

// The last 22 orbits, through the gap between the rings and the planet.
function buildFinale(kit, saturn) {
  const { THREE, addGlow, place, pose } = kit;
  const pole = saturn.axis;
  const group = new THREE.Group();
  saturn.group.add(group);
  const marker = addGlow(group, 0xffe7b0, 0.03, 4);
  marker.material.depthTest = true;
  const flash = addGlow(group, 0xffb070, 0.05, 5);
  marker.visible = flash.visible = false;
  const toSun = sunward(kit, DAYS.end);
  const ORIGIN = new THREE.Vector3(), gapAt = new THREE.Vector3(), gap = new THREE.Vector3(), side = new THREE.Vector3(), end = new THREE.Vector3();
  let flown = null;
  return {
    group,
    // `track` is the finale's own finer path, from tour.bin.
    fly(track) {
      flown = kit.trail(group, track, { color: 0xff8f6b, width: 1.8, ahead: 0.14 });
      flown.lines.forEach(occludable);
      // Every dive crosses the ring plane at nearly the same place: the gap.
      const before = new THREE.Vector3(), after = new THREE.Vector3();
      let crossed = 0;
      for (let i = 1; i < track.count; i++) {
        const a = track.point(i - 1, before).dot(pole), b = track.point(i, after).dot(pole);
        if (a * b > 0 || after.length() > 1.3) continue;
        gapAt.add(before.lerp(after, a / (a - b)));
        crossed++;
      }
      gapAt.divideScalar(crossed);
      gap.copy(gapAt).normalize();
      side.crossVectors(pole, gap).normalize();
      track.at(DAYS.end, end);
      flash.position.copy(end);
      flash.visible = true;
    },
    play(p) {
      const day = chapterDay.finale(p), ms = flight.msOf(day);
      kit.aimSun(toSun);
      saturn.turnTo(day);
      if (!flown) return kit.orbit(ORIGIN, 0.6, 0.3, 8);
      const here = flown.update(day);
      marker.position.copy(here);
      const last = smooth(0.7, 0.97, p);
      // Hold on the gap from just above the sunlit rings, then follow
      // Cassini down.
      const angle = lerp(0.95, 0.55, p);
      pose.position.copy(gap).multiplyScalar(Math.cos(angle)).addScaledVector(side, Math.sin(angle))
        .multiplyScalar(Math.cos(0.26)).addScaledVector(pole, Math.sin(0.26))
        .multiplyScalar(lerp(7.2, 5.2, last));
      pose.target.copy(gap).multiplyScalar(0.8).lerp(end, last * 0.85);
      const over = p >= 0.995;
      marker.visible = !over;
      flash.material.opacity = smooth(0.975, 0.995, p) * 0.9;
      const reach = here.length();
      const dive = flight.diveNumber(day);
      kit.setClock(formatDate(ms),
        flight.finalApproach(day) ? clockTime(ms) + ' · final approach' : dive ? 'Dive <b>' + dive + '</b> of ' + flight.dives.length : 'Lining up',
        reach < 2.6 ? '<b>' + km(Math.max(0, flight.cloudAltitudeKm(reach * data.saturnKm, sinLatitude(here, pole)))) + '</b> km above the cloud tops'
          : '<b>' + km(reach * data.saturnKm) + '</b> km from Saturn');
      if (!over && reach < 9) place('finale-cassini', 'Cassini', here, CRAFT_TAG);
      if (p > 0.97) place('finale-end', 'Signal lost · 15 Sep 2017', end, { cls: 'is-event', dx: kit.wide ? -238 : -150, dy: kit.wide ? -4 : -34, alpha: smooth(0.97, 0.995, p) });
      else place('finale-gap', 'The gap', gapAt, { cls: 'is-event', dx: -76, dy: -4, alpha: 1 - smooth(0.6, 0.7, p) });
    },
  };
}

// No surface: from outside, Titan is a ball of orange smog with a slightly
// darker northern half.
function paintTitan(g, w, h) {
  const bands = g.createLinearGradient(0, 0, 0, h);
  bands.addColorStop(0, '#b9792f'); bands.addColorStop(0.42, '#cf8f3c'); bands.addColorStop(0.5, '#dba04a'); bands.addColorStop(1, '#d99a45');
  g.fillStyle = bands; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = 'rgba(' + (i % 2 ? '255,214,150' : '120,70,20') + ',0.035)';
    g.fillRect(0, Math.random() * h, w, 3 + Math.random() * 12);
  }
}

// One layer of Titan's haze, lit from `toSun`.
function hazeShell(kit, radius, color, strength, power, toSun) {
  const { THREE } = kit;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uPower: { value: power }, uSun: { value: toSun } },
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
        float rim = pow(max(0.0, 1.0 - facing), uPower) * smoothstep(0.0, 0.3, facing);
        float lit = smoothstep(-0.35, 0.5, dot(normalize(vW), uSun));
        gl_FragColor = vec4(uColor * rim * lit * uStrength, 1.0);
      }`,
  }));
}

// Huygens's fall to Titan, with Cassini passing overhead to hear it.
function buildTitan(kit, pole) {
  const { THREE, addGlow, place, orbit } = kit;
  const group = new THREE.Group();
  kit.scene.add(group);
  group.add(upright(kit, new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshStandardMaterial({
    roughness: 1, metalness: 0, map: kit.canvasTexture(512, 256, paintTitan),
  })), pole));
  const toSun = sunward(kit, DAYS.entry);
  // The haze reaches far above the surface; a thin detached layer sits on top.
  group.add(hazeShell(kit, 1.1, 0xe09a45, 0.9, 2.0, toSun), hazeShell(kit, 1.2, 0x7d8fd9, 0.45, 3.0, toSun));
  const huygensPath = kit.track(data.titan.huygens, data.titanKm);
  const huygensFlown = kit.trail(group, huygensPath, { color: 0xfff0c8, width: 2.6, ahead: 0.24 });
  const cassiniFlown = kit.trail(group, kit.track(data.titan.cassini, data.titanKm), { width: 2.2, ahead: 0.18 });
  [...huygensFlown.lines, ...cassiniFlown.lines].forEach(occludable);
  const huygens = addGlow(group, 0xffffff, 0.026, 4);
  const cassini = addGlow(group, 0xffe7b0, 0.026, 4);
  const ORIGIN = new THREE.Vector3(), focus = new THREE.Vector3(), above = new THREE.Vector3();
  const relay = kit.thinLine([ORIGIN, ORIGIN], 0x9fd0ff, 0.55);
  group.add(relay);
  const landingSite = huygensPath.at(DAYS.landed, new THREE.Vector3()).normalize();
  const azimuth = Math.atan2(landingSite.x, landingSite.z) + 0.75;
  return {
    group,
    play(p) {
      kit.aimSun(toSun);
      const { day, falling, descent, after } = flight.titanDescent(p);
      const landed = day >= DAYS.landed, ms = flight.msOf(day);
      const here = huygensFlown.update(day), ship = cassiniFlown.update(day);
      huygens.position.copy(here);
      cassini.position.copy(ship);
      const reach = here.length();
      if (landed) {
        // Pull back from the landing site to take in Cassini, which is far
        // off by now: the aim and the distance have to move together.
        // A phone's narrow slice needs the pull-back done sooner, so Cassini
        // is in view before the card rises over Titan.
        const out = smooth(0, kit.wide ? 0.75 : 0.45, after);
        focus.copy(here).multiplyScalar(0.75).lerp(above.copy(ship).multiplyScalar(0.42), out);
        orbit(focus, azimuth - 0.05 + after * 0.15, lerp(0.22, 0.3, out), lerp(5.4, 62, out));
      } else {
        orbit(focus.copy(here).multiplyScalar(reach > 2 ? 0.5 : 0.75), azimuth - falling * 0.25 + descent * 0.2, 0.22, Math.max(4.6 - descent * 1.2, 3 + reach * 2.4));
      }
      // The radio link needs Cassini above Huygens's horizon.
      relay.visible = landed && above.copy(ship).sub(landingSite).dot(landingSite) > 0;
      if (relay.visible) relay.geometry.setFromPoints([here, ship]);
      kit.setClock(formatDate(ms), clockTime(ms), landed ? 'Huygens is <b>on the ground</b>'
        : '<b>' + km(Math.max(0, reach * data.titanKm - data.titanKm)) + '</b> km above Titan');
      place('huygens', landed ? 'Huygens · landed' : 'Huygens', here, CRAFT_TAG);
      if (landed || reach > 12) place('titan-cassini', 'Cassini', ship, { cls: 'is-craft', dx: 12, dy: 10 });
      if (after > 0.3) place('titan-name', 'Titan', ORIGIN, { dx: 16, dy: 16 });
    },
  };
}

// Where the four cracks across Enceladus's south pole, the "tiger stripes",
// run: their offsets from the pole, in radians.
const STRIPES = [-0.2, -0.07, 0.06, 0.19];

function paintEnceladus(g, w, h) {
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
  g.fillStyle = 'rgba(70,150,200,0.85)';
  for (const offset of STRIPES) {
    for (let t = -0.3; t <= 0.3; t += 0.004) {
      const across = offset + Math.sin(t * 9 + offset * 20) * 0.012;
      const fromPole = Math.hypot(across, t), longitude = Math.atan2(t, across);
      g.fillRect((longitude / (Math.PI * 2) + 0.5) * w - 1.5, h * (1 - fromPole / Math.PI) - 1, 3 / Math.max(0.05, Math.sin(fromPole)), 2);
    }
  }
}

// The plume: ice grains thrown from points along the four cracks, mostly
// straight down from the pole, slowing and thinning as they climb.
function buildPlume(kit) {
  const { THREE } = kit;
  const count = 4200;
  const start = new Float32Array(count * 3), aim = new Float32Array(count * 3), seed = new Float32Array(count * 2);
  const down = new THREE.Vector3(0, -1, 0), ground = new THREE.Vector3(), direction = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const across = STRIPES[i % 4] + (Math.random() - 0.5) * 0.02, along = (Math.random() - 0.5) * 0.5;
    const fromPole = Math.hypot(across, along), longitude = Math.atan2(along, across);
    ground.set(Math.sin(fromPole) * Math.cos(longitude), -Math.cos(fromPole), Math.sin(fromPole) * Math.sin(longitude));
    direction.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5).addScaledVector(ground, 0.35).add(down).normalize();
    ground.multiplyScalar(0.985).toArray(start, i * 3);
    direction.toArray(aim, i * 3);
    seed.set([Math.random(), 0.45 + Math.random() * 0.9], i * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(start, 3));
  geometry.setAttribute('aim', new THREE.BufferAttribute(aim, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
  const uniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: new THREE.Color(0xbfe0ff) } };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aim; attribute vec2 seed; uniform float uTime; uniform float uPixel;
      varying float vAlpha;
      void main() {
        float f = fract(seed.x + uTime * 0.045 * seed.y);
        float reach = 3.4 * seed.y;
        vec3 p = position + aim * (f * (2.0 - f)) * 0.5 * reach;
        vAlpha = smoothstep(0.0, 0.04, f) * pow(max(0.0, 1.0 - f), 1.6) * 0.26;
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
  return { points, uniforms };
}

// Enceladus and the pass through its plume on 28 October 2015.
function buildEnceladus(kit, pole) {
  const { THREE, addGlow, place, pose } = kit;
  const { equatorKm, polarKm } = data.enceladus, unitKm = data.enceladusKm;
  const group = new THREE.Group();
  kit.scene.add(group);
  const tilt = upright(kit, new THREE.Group(), pole);
  group.add(tilt);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({
    roughness: 0.85, metalness: 0, map: kit.canvasTexture(1024, 512, paintEnceladus),
  }));
  globe.scale.set(equatorKm / unitKm, polarKm / unitKm, equatorKm / unitKm);
  const plume = buildPlume(kit);
  tilt.add(globe, plume.points);
  const path = kit.track(data.enceladus.path, unitKm);
  const flown = kit.trail(group, path, { width: 2.8, ahead: 0.26 });
  flown.lines.forEach(occludable);
  const marker = addGlow(group, 0xffe7b0, 0.028, 4);
  marker.material.depthTest = true;
  const toSun = sunward(kit, DAYS.plume);
  const south = pole.clone().negate();
  const poleTag = south.clone().multiplyScalar(0.99), target = south.clone().multiplyScalar(0.9);
  // Look from the sunlit side, square to both the pole and the flight path.
  const view = path.at(DAYS.plume + 0.002, new THREE.Vector3()).sub(path.at(DAYS.plume - 0.002, new THREE.Vector3())).normalize()
    .cross(pole).normalize();
  if (view.dot(toSun) < 0) view.negate();
  return {
    group,
    play(p) {
      kit.aimSun(toSun);
      const day = chapterDay.enceladus(p), ms = flight.msOf(day);
      const here = flown.update(day);
      marker.position.copy(here);
      plume.uniforms.uTime.value = kit.time;
      plume.uniforms.uPixel.value = kit.renderer.getPixelRatio();
      pose.position.copy(view).applyAxisAngle(pole, lerp(-0.35, 0.3, p)).addScaledVector(south, 0.2).normalize()
        .multiplyScalar(lerp(13, 10.5, smooth(0, 0.5, p))).addScaledVector(south, 0.9);
      pose.target.copy(target);
      kit.setClock(formatDate(ms), clockTime(ms, true), '<b>' + km(flight.iceAltitudeKm(here.length() * unitKm, sinLatitude(here, pole))) + '</b> km above the ice');
      place('plume-cassini', 'Cassini', here, CRAFT_TAG);
      place('plume-pole', 'South pole', poleTag, { cls: 'is-dim', dx: -84, dy: -16 });
    },
  };
}

function startScene(kit) {
  const craft = buildCraft(kit);
  const system = buildSystem(kit);
  const saturn = buildSaturn(kit);
  const insertion = buildInsertion(kit, saturn);
  const tour = buildTour(kit, saturn);
  const finale = buildFinale(kit, saturn);
  const titan = buildTitan(kit, saturn.axis);
  const enceladus = buildEnceladus(kit, saturn.axis);

  fetch(ASSETS + 'tour.bin').then((response) => response.arrayBuffer()).then((buffer) => {
    tour.fly(kit.track(unpackRows(buffer, data.tour), data.saturnKm));
    finale.fly(kit.track(unpackRows(buffer, data.finale), data.saturnKm));
    kit.invalidate();
  }).catch((error) => console.warn('Tour data unavailable', error));

  // `phoneBack` is however much each chapter's subject needs to fit the
  // narrow slice of the scene a phone held upright sees.
  kit.run({
    sets: {
      craft: [craft.group], system: [system.group], titan: [titan.group], enceladus: [enceladus.group],
      soi: [saturn.group, insertion.group], tour: [saturn.group, tour.group], finale: [saturn.group, finale.group],
    },
    chapters: {
      ...craftChapters(kit, craft),
      cruise: { play: system.play, phoneBack: 1.6 },
      arrival: { play: insertion.play, phoneBack: 2.2 },
      titan: { play: titan.play, phoneBack: 1.7 },
      tour: { play: tour.play, phoneBack: 2 },
      enceladus: { play: enceladus.play, phoneBack: 1.7 },
      finale: { play: finale.play, phoneBack: 1.9 },
    },
    studio: { sun: [-10, 20, 18] },
    onChapter(chapter) {
      // Fetch Saturn a chapter early so it is there when the cut lands.
      if (chapter.id !== 'hero' && chapter.id !== 'craft') saturn.load();
    },
  });
}

const kit = createMissionKit();
if (kit) startScene(kit);
