/* Sound for a mission page: real recordings, and nothing else. Space is
   silent, so the page makes no sound of its own.

     mountMissionSound({ recordings, assets })

   is all a page calls: it finds the page's sound controls and follows the
   page's story (mission-story.js) itself, with the 3D scene or without it. Underneath is the
   player, createMissionAudio({ clips, button, start }), exported for the
   tests.

   A recording is fetched when first played. One plays when the reader
   presses its button, whatever the sound switch says: the press is the
   request. With the switch on, the story also plays each chapter's
   recordings as the reader reaches them.

   The switch starts off and is remembered. Browsers let a page make sound
   only after the reader has touched it, and scrolling does not count, so a
   remembered "on" waits for the first tap or key press of the visit and the
   switch asks for one until then.

   Markup a page provides, all of it shipped `hidden` where it needs sound:
     #sound-toggle                 the switch
     #sound-start                  the opening card's invitation (optional)
     #<chapter>-sounds-box         a chapter's recordings, holding
     #<chapter>-sounds               the group their buttons go in, and
     #<chapter>-heard                the line that says what is playing */
import { theStory } from './mission-story.js?v=20261127-1';

export const SOUND_KEY = 'ta-sound';
const CLIP_GAIN = 0.8;

// `clips` are { url, gain } by key. `button` is the sound switch and `start`
// the opening card's invitation to turn it on, which goes once sound is
// playing. `env` is the browser, or a stand-in for the tests.
export function createMissionAudio({ clips = {}, button = null, start = null, env = globalThis } = {}) {
  const Context = env.AudioContext || env.webkitAudioContext;
  const listeners = new Set();
  // `listen(fn)`: fn runs whenever what is playing, or whether sound can
  // play, has changed.
  const audio = { supported: Boolean(Context), on: false, playing: null, listen: (fn) => void listeners.add(fn) };
  if (!Context) return Object.assign(audio, { play: async () => 'failed', cue: () => null, stop() {} });
  const changed = () => { for (const fn of listeners) fn(); };

  let ctx = null, clipGain = null;
  // True once a press on the waiting switch has asked for sound and the
  // browser has not delivered it.
  let refused = false;
  // The clip in hand: { key, source, resolve }. `source` is null while the
  // recording is still downloading.
  let inHand = null;
  const buffers = new Map();
  const stored = () => { try { return env.localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } };
  const store = (on) => { try { env.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

  // A browser that refuses to start or pause the sound has nothing to report:
  // the switch shows what state it is in.
  const unheard = (promise) => promise?.catch?.(() => {});

  // False when the browser will not give the page an audio context at all.
  function ensure() {
    if (!ctx) {
      try { ctx = new Context(); } catch { return false; }
      clipGain = ctx.createGain();
      clipGain.connect(ctx.destination);
      ctx.onstatechange = () => {
        if (ctx.state === 'running') { refused = false; disarm(); }
        report();
      };
    }
    if (ctx.state === 'suspended' && !env.document?.hidden) unheard(ctx.resume());
    return true;
  }

  const isWaiting = () => audio.on && (!ctx || ctx.state !== 'running');
  function show() {
    const waiting = isWaiting();
    if (start) start.hidden = audio.on && !waiting;
    if (!button) return;
    button.hidden = false;
    button.setAttribute('aria-pressed', String(audio.on));
    button.setAttribute('data-waiting', String(waiting));
    // The name stays put for screen readers, which announce the pressed
    // state themselves; the visible text spells the state out.
    button.setAttribute('aria-label', waiting ? 'Sound, waiting for a tap' : 'Sound');
    button.textContent = !audio.on ? 'Sound off' : waiting ? 'Tap for sound' : 'Sound on';
  }
  const report = () => { show(); changed(); };

  // Start the remembered sound on the reader's first touch of the page. A
  // touch only counts with the browser once the finger lifts, so listen for
  // both ends of it, and keep listening until the sound is running. A press
  // on the switch itself is the switch's to handle.
  const wake = (event) => {
    if (button && event?.target === button) return;
    if (!audio.on) return disarm();
    if (ensure()) report();
    if (ctx?.state === 'running') disarm();
  };
  const GESTURES = ['pointerdown', 'pointerup', 'keydown'];
  const arm = () => { for (const type of GESTURES) env.addEventListener?.(type, wake, { passive: true }); };
  function disarm() { for (const type of GESTURES) env.removeEventListener?.(type, wake); }

  function setSound(on) {
    audio.on = on && ensure();
    store(audio.on);
    // Off means silence: whatever is playing stops.
    if (!audio.on) audio.stop();
    report();
  }

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
    changed();
  }

  function finish(ticket, how) {
    if (!ticket || inHand !== ticket) return;
    inHand = null;
    if (ticket.source) {
      ticket.source.onended = null;
      if (how === 'stopped') ticket.source.stop();
    }
    setPlaying(null);
    ticket.resolve(how);
  }
  audio.stop = () => finish(inHand, 'stopped');

  // Resolves 'ended', 'stopped' (another clip or stop() cut it short) or
  // 'failed'. Playing the clip that is already playing stops it.
  audio.play = (key) => {
    const again = audio.playing === key;
    audio.stop();
    if (again || !clips[key]) return Promise.resolve('stopped');
    if (!ensure()) return Promise.resolve('failed');
    return new Promise((resolve) => {
      const ticket = inHand = { key, source: null, resolve };
      setPlaying(key);
      load(key).then((buffer) => {
        if (inHand !== ticket) return;
        const source = ticket.source = ctx.createBufferSource();
        source.buffer = buffer;
        clipGain.gain.value = clips[key].gain ?? CLIP_GAIN;
        source.connect(clipGain);
        source.onended = () => finish(ticket, 'ended');
        source.start();
      }, (error) => {
        console.warn('Sound unavailable: ' + clips[key].url, error);
        finish(ticket, 'failed');
      });
    });
  };

  // Play a clip on the story's cue rather than a press: only with the sound
  // switch on and running, and never over a clip that is playing. Returns
  // play()'s promise, or null when the cue is not taken.
  audio.cue = (key) => {
    if (!audio.on || !ctx || ctx.state !== 'running' || audio.playing) return null;
    return audio.play(key);
  };

  env.document?.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (env.document.hidden) return unheard(ctx.suspend());
    if (audio.on || audio.playing) unheard(ctx.resume());
    // Some phones will not resume without a fresh touch.
    if (audio.on) arm();
  });

  audio.on = stored();
  if (audio.on) arm();
  // A press on the switch while it waits for a touch starts the sound, rather
  // than turning off what the reader has not heard yet. If the browser still
  // will not run it, the next press is a plain "off", so the switch can
  // always be told to stop asking.
  if (button) {
    button.addEventListener('click', () => {
      const ask = isWaiting() && !refused;
      disarm();
      setSound(ask || !audio.on);
      refused = isWaiting();
    });
  }
  if (start) start.addEventListener('click', () => { disarm(); setSound(true); });
  show();
  return audio;
}

// One button per recording in `container`. `items` are { key, label };
// `onPress(item)` runs when the reader presses one.
function createClipButtons(container, items, audio, onPress, doc) {
  const buttons = new Map();
  for (const item of items) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'part-btn clip-btn';
    btn.textContent = item.label;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => { onPress(item); audio.play(item.key); });
    container.appendChild(btn);
    buttons.set(item.key, btn);
  }
  audio.listen(() => { for (const [key, btn] of buttons) btn.setAttribute('aria-pressed', String(key === audio.playing)); });
}

// Everything a mission page needs for sound.
//   recordings  { chapterId: [{ key, label, text, gain, at }] }. `key` names
//               <assets>audio/<key>.mp3, `text` is the HTML the chapter's card
//               shows while it plays, and `at` is the scroll progress, 0 to
//               1, from which the story plays it; without `at` it has a
//               button only.
//   assets      the page's asset folder, ending in a slash
//   story       the story to follow, the page's own unless given; one with
//               just follow(onState) will do
// With the sound switch on, a chapter's recordings play in the order listed,
// one at a time, each once per visit, as the reader passes their `at`. The
// reader pressing a recording's button takes over that chapter from the
// story. A recording the story started stops when the reader leaves its
// chapter; one the reader pressed plays out.
export function mountMissionSound({ recordings, assets, env = globalThis, story = theStory() }) {
  const doc = env.document;
  const byKey = new Map(), queued = new Map();
  for (const [chapter, list] of Object.entries(recordings)) {
    for (const recording of list) byKey.set(recording.key, { ...recording, chapter });
    queued.set(chapter, list.filter((recording) => recording.at != null));
  }
  const audio = createMissionAudio({
    env,
    clips: Object.fromEntries([...byKey.values()].map((r) => [r.key, { url: assets + 'audio/' + r.key + '.mp3', gain: r.gain }])),
    button: doc.getElementById('sound-toggle'),
    start: doc.getElementById('sound-start'),
  });
  if (audio.supported) {
    for (const [chapter, list] of Object.entries(recordings)) {
      doc.getElementById(chapter + '-sounds-box').hidden = false;
      createClipButtons(doc.getElementById(chapter + '-sounds'), list, audio, () => queued.set(chapter, []), doc);
    }
  }

  let last = null, cued = null;
  function offer() {
    const queue = last && queued.get(last.id);
    if (!queue?.length || last.progress < queue[0].at) return;
    if (audio.cue(queue[0].key)) cued = queue.shift().key;
  }
  let captioned = null;
  audio.listen(() => {
    // Only the play the story started is the story's to stop: the reader
    // pressing the same recording later makes it theirs.
    if (audio.playing !== cued) cued = null;
    const recording = byKey.get(audio.playing);
    // A recording has ended, or sound has just come on: the next one may
    // already be due, and nothing else will ask while the reader sits still.
    // Wait a beat, so a recording the reader has just pressed starts first.
    if (!recording) return queueMicrotask(offer);
    // Sound-state changes arrive here too; rewriting the same caption would
    // have a screen reader announce it again.
    if (recording !== captioned) {
      doc.getElementById(recording.chapter + '-heard').innerHTML = recording.text;
      captioned = recording;
    }
  });

  function follow(state) {
    if (cued && last && state.id !== last.id) audio.stop();
    last = state;
    offer();
  }
  story.follow(follow);
  return { follow };
}
