/* Sound for a mission page.

     createMissionAudio({ beds, clips, button })   → audio
     createClipButtons(container, items, audio, onPlay)

   Two kinds of sound, kept apart because one is real and one is not:

     clips   recordings, fetched when first played. A clip plays when the
             reader presses its button, whatever the sound switch says: the
             press is the request.
     bed     a quiet hum made on the device, different in each chapter. Space
             is silent, so this is scenery, and the page says so. It plays
             only while the sound switch is on.

   The switch starts off and is remembered. Browsers let a page make sound
   only after the reader has touched it, so a remembered "on" waits for the
   first tap or key press of the visit. */
import { clamp01 } from './mission-orbits.js?v=20261121-1';

export const SOUND_KEY = 'ta-sound';
const BED_GAIN = 0.16, DUCKED = 0.25;

// How loud a chapter's bed is at a point in the story, 0 to 1. `fades` beds
// die away across their chapter.
export function bedLevel(bed, state) {
  if (!bed || state.past) return 0;
  return (bed.level ?? 1) * (bed.fades ? 1 - clamp01(state.progress) : 1) * (1 - clamp01(state.dim ?? 0));
}

// `beds` are { root, bright, air, level, fades, swell } by chapter id: the
// pitch of the hum in hertz, how open its filter is in hertz, and how much
// hiss of "wind" rides on it, 0 to 1. `swell(progress)`, 0 to 1, is how hard
// the chapter's event is pressing at that point of the scroll: it opens the
// filter, adds wind and lifts the level, so the sound moves with the reader. `clips` are { url } by key. `button` is the
// sound switch. `env` is the browser, or a stand-in for the tests.
export function createMissionAudio({ beds = {}, clips = {}, button = null, env = globalThis } = {}) {
  const Context = env.AudioContext || env.webkitAudioContext;
  const audio = { supported: Boolean(Context), on: false, playing: null, onClip: null };
  if (!Context) return Object.assign(audio, { setSound() {}, follow() {}, play: async () => 'failed', cue: () => null, stop() {} });

  let ctx = null, bed = null, clipGain = null;
  let bedId = null, level = 0, current = null, swell = 0;
  const buffers = new Map(), cued = new Set();
  const stored = () => { try { return env.localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } };
  const store = (on) => { try { env.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

  function buildBed() {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.4;
    filter.connect(out);
    // A root, the fifth above it and a slightly sharp octave: the mistuning
    // makes the hum beat slowly, so it never sounds like a held test tone.
    const voices = [[1, 'sine', 0.5], [1.498, 'sine', 0.22], [2.007, 'triangle', 0.1]].map(([ratio, type, gain]) => {
      const osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = type;
      amp.gain.value = gain;
      osc.connect(amp).connect(filter);
      osc.start();
      return { osc, ratio };
    });
    const swell = ctx.createOscillator(), depth = ctx.createGain();
    swell.frequency.value = 0.07;
    depth.gain.value = 0.25;
    swell.connect(depth).connect(out.gain);
    swell.start();

    const seconds = 2, noise = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource(), band = ctx.createBiquadFilter(), air = ctx.createGain();
    hiss.buffer = noise;
    hiss.loop = true;
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.6;
    air.gain.value = 0;
    hiss.connect(band).connect(air).connect(out);
    hiss.start();
    return { out, filter, voices, air, depth };
  }

  // A browser that refuses to start or pause the sound has nothing to report:
  // the switch shows what state it is in.
  const unheard = (promise) => promise?.catch?.(() => {});

  function ensure() {
    if (!ctx) {
      ctx = new Context();
      bed = buildBed();
      clipGain = ctx.createGain();
      clipGain.connect(ctx.destination);
      ctx.onstatechange = show;
      if (current) tune(current, 0);
    }
    if (ctx.state === 'suspended' && !env.document?.hidden) unheard(ctx.resume());
    return ctx;
  }

  const glide = (param, value, seconds) => (seconds ? param.setTargetAtTime(value, ctx.currentTime, seconds / 3) : param.setValueAtTime(value, ctx.currentTime));
  function mix() {
    if (!ctx) return;
    const loud = audio.on ? level * BED_GAIN * (audio.playing ? DUCKED : 1) : 0;
    glide(bed.out.gain, loud, 1.2);
    glide(bed.depth.gain, loud * 0.25, 1.2);
  }
  function tune(spec, seconds = 2.4) {
    for (const { osc, ratio } of bed.voices) glide(osc.frequency, spec.root * ratio, seconds);
    press(spec, seconds);
  }
  function press(spec, seconds) {
    glide(bed.filter.frequency, spec.bright * (1 + 3 * swell), seconds);
    glide(bed.air.gain, (spec.air ?? 0) + 0.2 * swell, seconds);
  }

  function show() {
    if (!button) return;
    const waiting = audio.on && (!ctx || ctx.state !== 'running');
    button.hidden = false;
    button.setAttribute('aria-pressed', String(audio.on));
    button.textContent = !audio.on ? 'Sound off' : waiting ? 'Sound on · tap to start' : 'Sound on';
  }

  // Start the remembered sound on the reader's first touch of the page.
  const wake = () => {
    disarm();
    if (audio.on) { ensure(); mix(); show(); }
  };
  const GESTURES = ['pointerdown', 'keydown'];
  const arm = () => { for (const type of GESTURES) env.addEventListener?.(type, wake, { passive: true }); };
  function disarm() { for (const type of GESTURES) env.removeEventListener?.(type, wake); }

  audio.setSound = (on) => {
    audio.on = on;
    store(on);
    if (on) ensure();
    mix();
    show();
  };

  // Call with the story's state whenever it changes; cheap when it has not.
  audio.follow = (state) => {
    const spec = beds[state.id] ?? beds.default ?? null;
    const pressing = clamp01(spec?.swell?.(state.progress) ?? 0);
    const next = bedLevel(spec, state) * (1 + 0.8 * pressing);
    if (state.id !== bedId && spec) {
      bedId = state.id;
      current = spec;
      swell = pressing;
      if (ctx) tune(spec);
    } else if (Math.abs(pressing - swell) > 0.03) {
      swell = pressing;
      if (ctx) press(spec, 0.4);
    }
    if (Math.abs(next - level) > 0.02 || (next === 0) !== (level === 0)) {
      level = next;
      mix();
    }
  };

  function load(key) {
    if (!buffers.has(key)) {
      buffers.set(key, env.fetch(clips[key].url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('HTTP ' + response.status))))
        .then((bytes) => ctx.decodeAudioData(bytes))
        .catch((error) => { buffers.delete(key); throw error; }));
    }
    return buffers.get(key);
  }

  function setPlaying(key) {
    audio.playing = key;
    mix();
    if (audio.onClip) audio.onClip(key);
  }

  // The clip in hand: { key, source, resolve }. `source` is null while the
  // recording is still downloading.
  let playing = null;
  function finish(ticket, how) {
    if (!ticket || playing !== ticket) return;
    playing = null;
    if (ticket.source) {
      ticket.source.onended = null;
      if (how === 'stopped') ticket.source.stop();
    }
    setPlaying(null);
    ticket.resolve(how);
  }
  audio.stop = () => finish(playing, 'stopped');

  // Resolves 'ended', 'stopped' (another clip or stop() cut it short) or
  // 'failed'. Playing the clip that is already playing stops it.
  audio.play = (key) => {
    const again = audio.playing === key;
    audio.stop();
    if (again || !clips[key]) return Promise.resolve('stopped');
    ensure();
    return new Promise((resolve) => {
      const ticket = playing = { key, source: null, resolve };
      setPlaying(key);
      load(key).then((buffer) => {
        if (playing !== ticket) return;
        const source = ticket.source = ctx.createBufferSource();
        source.buffer = buffer;
        clipGain.gain.value = clips[key].gain ?? 0.8;
        source.connect(clipGain);
        source.onended = () => finish(ticket, 'ended');
        source.start();
      }, (error) => {
        console.warn('Sound unavailable: ' + clips[key].url, error);
        finish(ticket, 'failed');
      });
    });
  };

  // Play a clip once per visit, on the story's cue rather than a press: only
  // with the sound switch on, and never over a clip the reader chose. Returns
  // play()'s promise, or null when the cue is not taken.
  audio.cue = (key) => {
    if (!audio.on || !ctx || ctx.state !== 'running' || audio.playing || cued.has(key)) return null;
    cued.add(key);
    return audio.play(key);
  };

  env.document?.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (env.document.hidden) unheard(ctx.suspend());
    else if (audio.on || audio.playing) unheard(ctx.resume());
  });

  audio.on = stored();
  if (audio.on) arm();
  if (button) button.addEventListener('click', () => { disarm(); audio.setSound(!audio.on); });
  show();
  return audio;
}

// One button per recording in `container`. `items` are { key, label };
// `onPlay(item)` runs when one starts, for the page to show what it says.
export function createClipButtons(container, items, audio, onPlay) {
  if (!audio.supported) return;
  const buttons = new Map();
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part-btn clip-btn';
    btn.textContent = item.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      audio.play(item.key);
      if (audio.playing === item.key && onPlay) onPlay(item);
    });
    container.appendChild(btn);
    buttons.set(item.key, btn);
  }
  const before = audio.onClip;
  audio.onClip = (key) => {
    if (before) before(key);
    for (const [k, btn] of buttons) btn.setAttribute('aria-pressed', String(k === key));
  };
}
