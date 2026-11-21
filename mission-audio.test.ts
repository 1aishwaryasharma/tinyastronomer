import { expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOUND_KEY, bedLevel, createMissionAudio } from "./public/mission-audio.js";
import { BEDS, GREETINGS, RECORDINGS } from "./public/missions/voyager-1-mission.js";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const read = (path: string) => readFileSync(root + path, "utf8");
const page = read("missions/voyager-1.html");
const AUDIO = "assets/missions/voyager-1/audio/";

// A browser with just enough Web Audio to follow what the page asks of it.
function browser({ stored = null as string | null, hasAudio = true } = {}) {
  const contexts: any[] = [], fetched: string[] = [], sources: any[] = [];
  const listeners = new Map<string, Function>();
  const param = () => ({ value: 0, target: 0, setTargetAtTime(v: number) { this.target = v; }, setValueAtTime(v: number) { this.target = this.value = v; } });
  const node = (extra = {}) => ({ connect: (to: unknown) => to, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), ...extra });
  class AudioContext {
    state = "suspended"; currentTime = 0; sampleRate = 8000; destination = {}; onstatechange = () => {};
    constructor() { contexts.push(this); }
    resume() { this.state = "running"; this.onstatechange(); }
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
    hidden: true, textContent: "Sound off", pressed: "false", waiting: "false", click: () => {},
    setAttribute(name: string, value: string) { if (name === "aria-pressed") this.pressed = value; else this.waiting = value; },
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
  return { env, button, contexts, fetched, played, store, listeners };
}
const clips = { hello: { url: "/hello.mp3" }, other: { url: "/other.mp3" }, gone: { url: "/missing.mp3" } };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("nothing sounds, and no audio is set up, until the reader asks", () => {
  const { env, button, contexts, store } = browser();
  const audio = createMissionAudio({ beds: BEDS, clips, button, env });
  audio.follow({ id: "hero", progress: 0.5, dim: 0, past: false });
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
  createMissionAudio({ beds: BEDS, clips, button, env });
  expect(contexts).toHaveLength(0);
  expect(button).toMatchObject({ textContent: "Tap for sound", pressed: "true", waiting: "true" });
  expect([...listeners.keys()].sort()).toEqual(["keydown", "pointerdown"]);
  listeners.get("pointerdown")!({ target: {} });
  expect(contexts).toHaveLength(1);
  expect(button).toMatchObject({ textContent: "Sound on", waiting: "false" });
  expect(listeners.size).toBe(0);
});

test("pressing the waiting switch starts the sound instead of turning it off", () => {
  const { env, button, contexts, listeners, store } = browser({ stored: "on" });
  createMissionAudio({ beds: BEDS, clips, button, env });
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
  createMissionAudio({ beds: BEDS, clips, button, start, env });
  expect(start.hidden).toBe(false);
  start.click();
  expect(start.hidden).toBe(true);
  expect(button.textContent).toBe("Sound on");
  button.click();
  expect(start.hidden).toBe(false);
});

test("a browser without Web Audio never shows the switch", async () => {
  const { env, button } = browser({ hasAudio: false });
  const audio = createMissionAudio({ beds: BEDS, clips, button, env });
  expect(audio.supported).toBe(false);
  expect(button.hidden).toBe(true);
  expect(await audio.play("hello")).toBe("failed");
});

test("a recording plays on its button whatever the switch says, one at a time", async () => {
  const { env, button, fetched, played } = browser();
  const audio = createMissionAudio({ beds: BEDS, clips, button, env });
  const heard: (string | null)[] = [];
  audio.onClip = (key: string | null) => heard.push(key);
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
  expect(heard).toEqual(["hello", null, "other", null]);
  // Pressing the one that is playing stops it; a second listen needs no second download.
  const third = audio.play("hello");
  await settle();
  expect(await audio.play("hello")).toBe("stopped");
  expect(await third).toBe("stopped");
  expect(fetched).toEqual(["/hello.mp3", "/other.mp3"]);
  expect(await audio.play("gone")).toBe("failed");
  expect(audio.playing).toBe(null);
});

test("the story cues a recording once, and only with sound on", async () => {
  const { env, button, played } = browser();
  const audio = createMissionAudio({ beds: BEDS, clips, button, env });
  expect(audio.cue("hello")).toBe(null);
  expect(audio.playing).toBe(null);
  button.click();
  const cued = audio.cue("hello");
  expect(audio.playing).toBe("hello");
  // A cue never talks over a clip that is playing.
  expect(audio.cue("other")).toBe(null);
  await settle();
  played()[0].onended();
  expect(await cued).toBe("ended");
  expect(audio.cue("hello")).toBe(null);
  expect(audio.playing).toBe(null);
});

test("the hum follows the story and is gone below it", () => {
  const at = (id: keyof typeof BEDS, more = {}) => bedLevel(BEDS[id], { progress: 0.5, dim: 0, past: false, ...more });
  expect(at("jupiter")).toBe(0.6);
  expect(at("record")).toBeLessThan(0.5);
  expect(at("jupiter", { dim: 1 })).toBe(0);
  expect(at("jupiter", { past: true })).toBe(0);
  // The last chapter goes quiet as Voyager does.
  expect(at("future", { progress: 0 })).toBeCloseTo(0.7, 9);
  expect(at("future", { progress: 1 })).toBe(0);
  expect(bedLevel(undefined, { progress: 0, past: false })).toBe(0);
  // Inside a chapter the sound moves with the scroll: a flyby swells to its
  // closest approach, the launch roars first, the wind rises at the bubble's edge.
  expect(BEDS.jupiter.swell(0)).toBe(0);
  expect(BEDS.jupiter.swell(0.5)).toBe(1);
  expect(BEDS.saturn.swell(1)).toBe(0);
  expect(BEDS.launch.swell(0)).toBe(1);
  expect(BEDS.launch.swell(0.5)).toBe(0);
  expect(BEDS.edge.swell(0.5)).toBe(0);
  expect(BEDS.edge.swell(0.9)).toBe(1);
  const chapters = [...page.matchAll(/<section class="chapter[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  expect(Object.keys(BEDS)).toEqual(chapters);
  for (const bed of Object.values(BEDS)) {
    expect(bed.root).toBeGreaterThan(60);
    expect(bed.root).toBeLessThan(200);
    expect(bed.air).toBeLessThanOrEqual(0.15);
  }
});

test("every recording the page offers is shipped, small, and credited", () => {
  const readme = read("assets/missions/voyager-1/README.md");
  const files = readdirSync(root + AUDIO).sort();
  const recordings = Object.values(RECORDINGS).flat();
  expect(files).toEqual([...GREETINGS.map((g) => `greeting-${g.key}.mp3`), ...recordings.map((r) => `${r.key}.mp3`)].sort());
  for (const file of files) expect(statSync(root + AUDIO + file).size, file).toBeLessThan(file.startsWith("greeting") ? 60 * 1024 : 160 * 1024);
  // Each is fetched only when it plays, so this is a ceiling on a visit that hears everything.
  expect(files.reduce((sum, file) => sum + statSync(root + AUDIO + file).size, 0)).toBeLessThan(760 * 1024);
  // Every chapter with recordings has its box, and every recording a dated account of what it is.
  for (const [chapter, list] of Object.entries(RECORDINGS)) {
    expect(page).toMatch(new RegExp(`id="${chapter}-sounds-box" hidden>\\s*<p class="clip-note"><span class="science-kind">Real measurements</span>`));
    expect(page).toContain(`id="${chapter}-heard"`);
    expect(page).toContain(`id="${chapter}-sounds"`);
    for (const recording of list) expect(recording.text, recording.key).toMatch(/\b(19|20)\d\d\b/);
  }
  expect(readme).toContain("https://space-audio.org/");
  expect(readme).toContain("Creative Commons Attribution 4.0");
  // NASA's own translations, word for word apart from one capital.
  expect(GREETINGS.find((g) => g.key === "english")!.said).toBe("Hello from the children of planet Earth.");
  expect(GREETINGS.find((g) => g.key === "hindi")!.said).toBe("Greetings from the inhabitants of this world.");
  expect(readme).toContain("https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/");
  expect(readme).toContain("PIA17045");
  expect(page).toContain('<span class="clip-credit">NASA/JPL</span>');
  expect(page).toContain('<span class="clip-credit">NASA/JPL-Caltech/University of Iowa</span>');
  expect(page).toContain('<span class="clip-credit">NASA/University of Iowa</span>');
});

test("the page says which sounds are real, and ships silent", () => {
  expect(page).toContain('<button type="button" class="sound-toggle" id="sound-toggle" aria-pressed="false" hidden>Sound off</button>');
  expect(page).toMatch(/id="greetings-box" hidden>\s*<p class="clip-note"><span class="science-kind">Real recordings<\/span>/);
  expect(page).toContain("Not sound, but electric ripples felt by Voyager's antennas and played through a speaker.");
  expect(page).toContain("Space is silent. With Sound on, the quiet hum behind the story is made on your device as scenery, not recorded.");
  expect(page).not.toMatch(/<audio|autoplay/i);
  // Sound starts from a press, so the site-wide ban on autoplay stays.
  expect(read("_headers")).toContain("autoplay=()");
  expect(read("_headers")).toContain("media-src 'self'");
});
