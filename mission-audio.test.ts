import { expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOUND_KEY, createMissionAudio, mountMissionSound } from "./public/mission-audio.js";
import { RECORDINGS, createFlight } from "./public/missions/voyager-1-mission.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const page = read("missions/voyager-1.html");
const AUDIO = "assets/missions/voyager-1/audio/";

// A browser with just enough Web Audio to follow what the page asks of it.
// `gesture` is whether the browser currently counts the reader as having
// touched the page: without it a context stays suspended, as on a phone
// between a finger landing and lifting.
function browser({ stored = null as string | null, hasAudio = true, refuses = false } = {}) {
  // `late`: the context starts a moment after it is asked to, as real ones do.
  const policy = { gesture: true, late: false };
  const contexts: any[] = [], fetched: string[] = [], sources: any[] = [];
  const listeners = new Map<string, Function>();
  const param = () => ({ value: 0, target: 0, setTargetAtTime(v: number) { this.target = v; }, setValueAtTime(v: number) { this.target = this.value = v; } });
  const node = (extra = {}) => ({ connect: (to: unknown) => to, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), ...extra });
  class AudioContext {
    state = "suspended"; currentTime = 0; sampleRate = 8000; destination = {}; onstatechange = () => {};
    constructor() { if (refuses) throw new Error("NotSupportedError"); contexts.push(this); }
    resume() {
      if (!policy.gesture) return;
      const run = () => { this.state = "running"; this.onstatechange(); };
      if (policy.late) setTimeout(run, 0); else run();
    }
    suspend() { this.state = "suspended"; this.onstatechange(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { return node(); }
    createBuffer(_: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { const source = node({ onended: null as null | (() => void), stopped: false, stop() { this.stopped = true; } }); sources.push(source); return source; }
    decodeAudioData(bytes: unknown) { return Promise.resolve({ bytes }); }
  }
  const store = new Map<string, string>(stored ? [[SOUND_KEY, stored]] : []);
  const button = {
    hidden: true, textContent: "Sound off", pressed: "false", waiting: "false", name: "", click: () => {},
    setAttribute(name: string, value: string) { if (name === "aria-pressed") this.pressed = value; else if (name === "aria-label") this.name = value; else this.waiting = value; },
    addEventListener(_: string, handler: () => void) { this.click = handler; },
  };
  const env = {
    AudioContext: hasAudio ? AudioContext : undefined,
    localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
    fetch: (url: string) => { fetched.push(url); return Promise.resolve({ ok: !url.includes("missing"), status: 404, arrayBuffer: () => Promise.resolve(url) }); },
    addEventListener: (type: string, handler: Function) => void listeners.set(type, handler),
    removeEventListener: (type: string) => void listeners.delete(type),
    document: { hidden: false, addEventListener() {} },
  };
  // The hum's hiss is a looping source too; these are the recordings.
  const played = () => sources.filter((source) => source.buffer?.bytes);
  return { env, button, contexts, fetched, played, store, listeners, policy };
}
const clips = { hello: { url: "/hello.mp3" }, other: { url: "/other.mp3" }, gone: { url: "/missing.mp3" } };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("nothing sounds, and no audio is set up, until the reader asks", () => {
  const { env, button, contexts, store } = browser();
  const audio = createMissionAudio({ clips, button, env });
  expect(contexts).toHaveLength(0);
  expect(button).toMatchObject({ hidden: false, textContent: "Sound off", pressed: "false" });
  button.click();
  expect(contexts).toHaveLength(1);
  expect(button).toMatchObject({ textContent: "Sound on", pressed: "true" });
  expect(store.get(SOUND_KEY)).toBe("on");
  button.click();
  expect(button.textContent).toBe("Sound off");
  expect(store.get(SOUND_KEY)).toBe("off");
  // One context for the visit, however often the switch is flipped.
  button.click();
  expect(contexts).toHaveLength(1);
});

test("a remembered 'on' waits for the first touch of the visit", () => {
  const { env, button, contexts, listeners } = browser({ stored: "on" });
  createMissionAudio({ clips, button, env });
  expect(contexts).toHaveLength(0);
  expect(button).toMatchObject({ textContent: "Tap for sound", pressed: "true", waiting: "true" });
  expect([...listeners.keys()].sort()).toEqual(["keydown", "pointerdown", "pointerup"]);
  listeners.get("pointerdown")!({ target: {} });
  expect(contexts).toHaveLength(1);
  expect(button).toMatchObject({ textContent: "Sound on", waiting: "false" });
  expect(listeners.size).toBe(0);
});

test("pressing the waiting switch starts the sound instead of turning it off", () => {
  const { env, button, contexts, listeners, store } = browser({ stored: "on" });
  createMissionAudio({ clips, button, env });
  // A real press arrives as a pointerdown on the switch, then its click.
  listeners.get("pointerdown")!({ target: button });
  button.click();
  expect(contexts).toHaveLength(1);
  expect(button).toMatchObject({ textContent: "Sound on", pressed: "true" });
  expect(store.get(SOUND_KEY)).toBe("on");
  button.click();
  expect(button.textContent).toBe("Sound off");
});

test("the opening card offers sound until it is playing", () => {
  const { env, button } = browser();
  const start = { hidden: true, click: () => {}, addEventListener(_: string, handler: () => void) { this.click = handler; } };
  createMissionAudio({ clips, button, start, env });
  expect(start.hidden).toBe(false);
  start.click();
  expect(start.hidden).toBe(true);
  expect(button.textContent).toBe("Sound on");
  button.click();
  expect(start.hidden).toBe(false);
});

test("a browser without Web Audio never shows the switch", async () => {
  const { env, button } = browser({ hasAudio: false });
  const audio = createMissionAudio({ clips, button, env });
  expect(audio.supported).toBe(false);
  expect(button.hidden).toBe(true);
  expect(await audio.play("hello")).toBe("failed");
});

test("a recording plays on its button whatever the switch says, one at a time", async () => {
  const { env, button, fetched, played } = browser();
  const audio = createMissionAudio({ clips, button, env });
  const heard: (string | null)[] = [];
  audio.listen(() => { if (heard.at(-1) !== audio.playing) heard.push(audio.playing); });
  const first = audio.play("hello");
  expect(audio.playing).toBe("hello");
  expect(audio.on).toBe(false);
  await settle();
  expect(fetched).toEqual(["/hello.mp3"]);
  // Starting another cuts the first short.
  const second = audio.play("other");
  expect(await first).toBe("stopped");
  expect(played()[0].stopped).toBe(true);
  await settle();
  played()[1].onended();
  expect(await second).toBe("ended");
  expect(audio.playing).toBe(null);
  expect(heard.slice(-4)).toEqual(["hello", null, "other", null]);
  // Pressing the one that is playing stops it; a second listen needs no second download.
  const third = audio.play("hello");
  await settle();
  expect(await audio.play("hello")).toBe("stopped");
  expect(await third).toBe("stopped");
  expect(fetched).toEqual(["/hello.mp3", "/other.mp3"]);
  expect(await audio.play("gone")).toBe("failed");
  expect(audio.playing).toBe(null);
});

test("a cue plays only with sound on, and never over another recording", async () => {
  const { env, button, played } = browser();
  const audio = createMissionAudio({ clips, button, env });
  expect(audio.cue("hello")).toBe(null);
  expect(audio.playing).toBe(null);
  button.click();
  const cued = audio.cue("hello");
  expect(audio.playing).toBe("hello");
  expect(audio.cue("other")).toBe(null);
  await settle();
  played()[0].onended();
  expect(await cued).toBe("ended");
});

test("a touch starts remembered sound when the finger lifts, not when it lands", () => {
  const { env, button, contexts, listeners, policy } = browser({ stored: "on" });
  createMissionAudio({ clips, button, env });
  policy.gesture = false;
  listeners.get("pointerdown")!({ target: {} });
  expect(contexts[0].state).toBe("suspended");
  expect(button.textContent).toBe("Tap for sound");
  // Still listening: the same touch ending is what the browser accepts.
  policy.gesture = true;
  listeners.get("pointerup")!({ target: {} });
  expect(contexts[0].state).toBe("running");
  expect(button.textContent).toBe("Sound on");
  expect(listeners.size).toBe(0);
});

test("after a scroll has woken a silent context, pressing the waiting switch still starts the sound", () => {
  const { env, button, contexts, listeners, policy, store } = browser({ stored: "on" });
  createMissionAudio({ clips, button, env });
  // A touch that turns into a scroll: the finger lands, and never "lifts" as far as the page is told.
  policy.gesture = false;
  listeners.get("pointerdown")!({ target: {} });
  expect(contexts[0].state).toBe("suspended");
  expect(button.textContent).toBe("Tap for sound");
  policy.gesture = true;
  button.click();
  expect(button).toMatchObject({ textContent: "Sound on", pressed: "true" });
  expect(store.get(SOUND_KEY)).toBe("on");
});

test("sound off stops a recording too, and a browser that refuses audio leaves the switch usable", async () => {
  const { env, button, played } = browser();
  const audio = createMissionAudio({ clips, button, env });
  button.click();
  const cued = audio.cue("hello");
  await settle();
  button.click();
  expect(await cued).toBe("stopped");
  expect(played()[0].stopped).toBe(true);

  const refused = browser({ refuses: true });
  const silent = createMissionAudio({ clips, button: refused.button, env: refused.env });
  refused.button.click();
  expect(refused.button).toMatchObject({ textContent: "Sound off", pressed: "false" });
  expect(refused.store.get(SOUND_KEY)).toBe("off");
  expect(await silent.play("hello")).toBe("failed");

  // Remembered as on, but the context never runs: every second press turns it off.
  const stuck = browser({ stored: "on" });
  createMissionAudio({ clips, button: stuck.button, env: stuck.env });
  stuck.policy.gesture = false;
  const texts = [1, 2, 3, 4].map(() => { stuck.button.click(); return stuck.button.textContent; });
  expect(texts).toEqual(["Tap for sound", "Sound off", "Tap for sound", "Sound off"]);
});

// The page around the player: just enough DOM for mountMissionSound.
function page_(env: ReturnType<typeof browser>["env"], button: unknown) {
  const nodes = new Map<string, any>([["sound-toggle", button]]);
  const element = () => ({
    hidden: true, innerHTML: "", textContent: "", pressed: "false", children: [] as any[], click: () => {},
    setAttribute(_: string, value: string) { this.pressed = value; },
    addEventListener(_: string, handler: () => void) { this.click = handler; },
    appendChild(child: unknown) { this.children.push(child); },
  });
  Object.assign(env.document, {
    createElement: element,
    getElementById: (id: string) => { if (!nodes.has(id) && id !== "sound-start") nodes.set(id, element()); return nodes.get(id) ?? null; },
  });
  return nodes;
}
const story = { hall: [{ key: "a", label: "A", text: "<b>A</b>", at: 0.2 }, { key: "b", label: "B", text: "B", at: 0.2 }, { key: "c", label: "C", text: "C" }], yard: [{ key: "d", label: "D", text: "D", at: 0.5 }] };
const at = (id: string, progress: number) => ({ id, progress, dim: 0, past: false });

test("the story plays a chapter's recordings in order, one at a time, once", async () => {
  const { env, button, fetched, played } = browser();
  const nodes = page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  expect(nodes.get("hall-sounds-box").hidden).toBe(false);
  expect(nodes.get("hall-sounds").children.map((b: any) => b.textContent)).toEqual(["A", "B", "C"]);
  // Nothing with sound off, however far the reader scrolls.
  sound.follow(at("hall", 0.9));
  await settle();
  expect(fetched).toEqual([]);
  button.click();
  sound.follow(at("hall", 0.1));
  expect(fetched).toEqual([]);
  // Arriving late still starts with the first.
  sound.follow(at("hall", 0.9));
  await settle();
  expect(fetched).toEqual(["/assets/x/audio/a.mp3"]);
  expect(nodes.get("hall-heard").innerHTML).toBe("<b>A</b>");
  expect(nodes.get("hall-sounds").children.map((b: any) => b.pressed)).toEqual(["true", "false", "false"]);
  // The next follows without another scroll; the one with no `at` never does.
  played()[0].onended();
  await settle();
  expect(fetched).toEqual(["/assets/x/audio/a.mp3", "/assets/x/audio/b.mp3"]);
  expect(nodes.get("hall-heard").innerHTML).toBe("B");
  played()[1].onended();
  await settle();
  sound.follow(at("hall", 0.95));
  await settle();
  expect(fetched).toHaveLength(2);
  // Each plays once per visit.
  sound.follow(at("yard", 0.1));
  sound.follow(at("hall", 0.9));
  await settle();
  expect(fetched).toHaveLength(2);
});

test("leaving a chapter stops its recording, and a press takes the chapter over from the story", async () => {
  const { env, button, fetched, played } = browser();
  const nodes = page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  button.click();
  sound.follow(at("yard", 0.6));
  await settle();
  sound.follow(at("hall", 0.1));
  expect(played()[0].stopped).toBe(true);
  // The reader picks C before the story reaches A: A and B are theirs to press now.
  nodes.get("hall-sounds").children[2].click();
  await settle();
  expect(nodes.get("hall-heard").innerHTML).toBe("C");
  played()[1].onended();
  await settle();
  sound.follow(at("hall", 0.9));
  await settle();
  expect(fetched).toEqual(["/assets/x/audio/d.mp3", "/assets/x/audio/c.mp3"]);
});

test("turning sound on mid-chapter plays what is due without waiting for a scroll", async () => {
  const { env, button, fetched, played } = browser();
  page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  sound.follow(at("hall", 0.9));
  button.click();
  await settle();
  expect(fetched).toEqual(["/assets/x/audio/a.mp3"]);
  // One that fails to load does not hold up the next.
  const failing = browser();
  page_(failing.env, failing.button);
  const other = mountMissionSound({ recordings: { hall: [{ key: "missing", label: "M", text: "M", at: 0 }, { key: "b", label: "B", text: "B", at: 0 }] }, assets: "/x/", env: failing.env });
  failing.button.click();
  other.follow(at("hall", 0.5));
  await settle();
  await settle();
  expect(failing.fetched).toEqual(["/x/audio/missing.mp3", "/x/audio/b.mp3"]);
  expect(played()).toHaveLength(1);
});

test("a context that starts a moment late still plays what is due, with no scroll", async () => {
  const { env, button, fetched, policy } = browser();
  page_(env, button);
  policy.late = true;
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  sound.follow(at("hall", 0.9));
  button.click();
  await settle();
  await settle();
  expect(button.textContent).toBe("Sound on");
  expect(fetched).toEqual(["/assets/x/audio/a.mp3"]);
});

test("replaying the story's recording makes it the reader's: it plays on past the chapter", async () => {
  const { env, button, played } = browser();
  const nodes = page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  button.click();
  sound.follow(at("yard", 0.6));
  await settle();
  const replay = nodes.get("yard-sounds").children[0];
  replay.click();
  await settle();
  replay.click();
  await settle();
  sound.follow(at("hall", 0.05));
  expect(played().at(-1).stopped).toBe(false);
});

test("a recording the reader pressed plays on into the next chapter", async () => {
  const { env, button, played } = browser();
  const nodes = page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  sound.follow(at("hall", 0.1));
  nodes.get("hall-sounds").children[2].click();
  await settle();
  sound.follow(at("yard", 0.1));
  expect(played()[0].stopped).toBe(false);
  expect(nodes.get("hall-sounds").children[2].pressed).toBe("true");
});

test("without Web Audio the page keeps its recordings hidden", () => {
  const { env, button } = browser({ hasAudio: false });
  const nodes = page_(env, button);
  const sound = mountMissionSound({ recordings: story, assets: "/assets/x/", env });
  expect(sound.supported).toBe(false);
  expect(nodes.has("hall-sounds-box")).toBe(false);
  sound.follow(at("hall", 0.9));
});

test("every recording the page offers is shipped, small, and credited", () => {
  const readme = read("assets/missions/voyager-1/README.md");
  const files = readdirSync(root + AUDIO).sort();
  const recordings = Object.values(RECORDINGS).flat();
  expect(files).toEqual(recordings.map((r) => `${r.key}.mp3`).sort());
  expect(RECORDINGS.record).toHaveLength(10);
  for (const file of files) expect(statSync(root + AUDIO + file).size, file).toBeLessThan(file.startsWith("greeting") ? 60 * 1024 : 160 * 1024);
  // Each is fetched only when it plays, so this is a ceiling on a visit that hears everything.
  expect(files.reduce((sum, file) => sum + statSync(root + AUDIO + file).size, 0)).toBeLessThan(760 * 1024);
  // Every chapter with recordings has its box, and every recording a dated account of what it is.
  for (const [chapter, list] of Object.entries(RECORDINGS)) {
    expect(page).toMatch(new RegExp(`id="${chapter}-sounds-box" hidden>\\s*<p class="clip-note"><span class="science-kind">Real (measurements|recordings)</span>`));
    expect(page).toContain(`id="${chapter}-heard"`);
    expect(page).toContain(`id="${chapter}-sounds"`);
    if (chapter !== "record") for (const recording of list) expect(recording.text, recording.key).toMatch(/\b(19|20)\d\d\b/);
  }
  // The story plays the two crossings where its chapter reaches their dates.
  const flight = createFlight(JSON.parse(read("assets/missions/voyager-1/trajectory.json")));
  const [shock, pause] = RECORDINGS.edge;
  for (const [recording, day] of [[shock, flight.DAYS.shock], [pause, flight.DAYS.pause]] as const) {
    expect(flight.chapterDay.edge(recording.at!) - day, recording.key).toBeGreaterThanOrEqual(0);
    expect(flight.chapterDay.edge(recording.at!) - day, recording.key).toBeLessThan(120);
  }
  expect(readme).toContain("https://space-audio.org/");
  expect(readme).toContain("Creative Commons Attribution 4.0");
  // NASA's own translations, word for word apart from one capital.
  expect(RECORDINGS.record[0]).toMatchObject({ key: "greeting-english", text: "“Hello from the children of planet Earth.” <strong>English</strong>" });
  expect(RECORDINGS.record.find((r) => r.key === "greeting-hindi")!.text).toContain("Greetings from the inhabitants of this world.");
  expect(readme).toContain("https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/");
  expect(readme).toContain("PIA17045");
  expect(page).toContain('<span class="clip-credit">NASA/JPL</span>');
  expect(page).toContain('<span class="clip-credit">NASA/JPL-Caltech/University of Iowa</span>');
  expect(page).toContain('<span class="clip-credit">NASA/University of Iowa</span>');
});

test("the page says which sounds are real, and ships silent", () => {
  expect(page).toContain('<button type="button" class="sound-toggle" id="sound-toggle" aria-pressed="false" hidden>Sound off</button>');
  expect(page).toContain("Not sound, but electric ripples felt by Voyager's antennas and played through a speaker.");
  expect(page).toContain("Space is silent, so this page makes no sound of its own. With Sound on, everything you hear is real");
  // No made-up sound: the player has no oscillators or noise in it.
  expect(read("mission-audio.js")).not.toMatch(/createOscillator|Math\.random/);
  expect(page).not.toMatch(/<audio|autoplay/i);
  // Sound starts from a press, so the site-wide ban on autoplay stays.
  expect(read("_headers")).toContain("autoplay=()");
  expect(read("_headers")).toContain("media-src 'self'");
});
