// Cuts the Voyager 1 page's recordings out of the originals.
//
//   bun tools/build-voyager-audio.ts DIR
//
// Needs ffmpeg on PATH. DIR holds the sources under the names in SOURCES,
// downloaded anywhere outside the repository;
// public/assets/missions/voyager-1/README.md says where each comes from.
//
// The greetings are the Golden Record's "Greetings in 55 Languages" as one
// track. Their cut times were found by silence detection and each slice was
// checked against the phrase its speaker is recorded as saying, so a
// different transfer of the track needs them found again. The rest are
// excerpts chosen for the stretch where the thing the page describes can be
// heard.
//
// Nothing is changed but length, level and encoding: each clip is brought to
// the same peak, given a short fade at both ends so it does not click, and
// written as mono MP3, which every browser's Web Audio can decode.
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GREETINGS, RECORDINGS } from "../public/missions/voyager-1-mission.js";

const dir = process.argv[2];
if (!dir) throw new Error("usage: bun tools/build-voyager-audio.ts DIR");
const out = fileURLToPath(new URL("../public/assets/missions/voyager-1/audio/", import.meta.url));
mkdirSync(out, { recursive: true });

const SOURCES = {
  greetings: "Voyager_Golden_Record_Greetings_In_55_Languages.mp3",
  interstellar: "PIA17045_20130906-640.mp4",
  whistlers: "jwhist.mp3",
  chorus: "jov-chor.mp3",
  bowShock: "jovbow.mp3",
  terminationShock: "vgertermshock4.wav",
};

// Seconds into the greetings track, in the order they are on the record.
const GREETING_CUTS: Record<string, [number, number]> = {
  russian: [22.55, 24.7],
  arabic: [32.5, 37.86],
  french: [41.99, 43.16],
  spanish: [50.64, 52.2],
  bengali: [68.51, 70.61],
  japanese: [105.28, 106.82],
  hindi: [108.17, 110.8],
  zulu: [120.2, 124.57],
  mandarin: [149.46, 154.18],
  english: [258.61, 261.02],
};
// The interstellar soundtrack plays the same twelve seconds twice; the bow
// shock excerpt starts in the quiet solar wind so the crossing can be heard.
const RECORDING_CUTS: Record<string, [keyof typeof SOURCES, number, number]> = {
  "jupiter-lightning": ["whistlers", 3, 12],
  "jupiter-chorus": ["chorus", 28, 40],
  "jupiter-bow-shock": ["bowShock", 21.5, 33],
  "termination-shock": ["terminationShock", 0, 6.37],
  "plasma-waves": ["interstellar", 12.12, 23.88],
};
const PAD = 0.12, FADE = 0.04, PEAK_DB = -2;

function ffmpeg(args: string[]) {
  const run = Bun.spawnSync(["ffmpeg", "-hide_banner", "-nostdin", "-y", ...args], { stderr: "pipe" });
  const log = run.stderr.toString();
  if (run.exitCode !== 0) throw new Error(log);
  return log;
}

function cut(source: keyof typeof SOURCES, from: number, to: number, name: string, kbps: number, pad = 0) {
  const start = Math.max(0, from - pad), length = to + pad - start;
  const slice = ["-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", join(dir, SOURCES[source]), "-vn", "-ac", "1"];
  const peak = Number(ffmpeg([...slice, "-af", "volumedetect", "-f", "null", "-"]).match(/max_volume: (-?[\d.]+) dB/)![1]);
  const filters = [
    `volume=${(PEAK_DB - peak).toFixed(1)}dB`,
    `afade=t=in:d=${FADE}`,
    `afade=t=out:st=${(length - FADE).toFixed(3)}:d=${FADE}`,
  ].join(",");
  ffmpeg([...slice, "-af", filters, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", kbps + "k", "-map_metadata", "-1", out + name]);
  console.log(name.padEnd(26), (statSync(out + name).size / 1024).toFixed(1) + " KB", length.toFixed(2) + " s");
}

for (const { key } of GREETINGS) {
  if (!GREETING_CUTS[key]) throw new Error("No cut times for the greeting in " + key);
  cut("greetings", ...GREETING_CUTS[key], `greeting-${key}.mp3`, 64, PAD);
}
for (const { key } of Object.values(RECORDINGS).flat()) {
  if (!RECORDING_CUTS[key]) throw new Error("No cut times for " + key);
  // The Iowa files hold nothing above 5.5 kHz, and the interstellar tone sits near 2.5 kHz.
  cut(...RECORDING_CUTS[key], `${key}.mp3`, key === "plasma-waves" ? 96 : 64);
}
