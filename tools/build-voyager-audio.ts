// Cuts the Voyager 1 page's recordings out of NASA's originals.
//
//   bun tools/build-voyager-audio.ts GREETINGS.mp3 PIA17045.mp4
//
// Needs ffmpeg on PATH. Download the two sources anywhere outside the
// repository; public/assets/missions/voyager-1/README.md says where from.
//
// GREETINGS.mp3 is the Golden Record's "Greetings in 55 Languages" as one
// track. The cut times below were found by silence detection and each slice
// was checked against the phrase its speaker is recorded as saying, so a
// different transfer of the track needs them found again. PIA17045.mp4 is
// NASA's "Voyager Captures Sounds of Interstellar Space"; its soundtrack
// plays the same twelve seconds twice, and the first is taken.
//
// Nothing is changed but length, level and encoding: each clip is brought to
// the same peak, given a short fade at both ends so it does not click, and
// written as mono MP3, which every browser's Web Audio can decode.
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GREETINGS } from "../public/missions/voyager-1-mission.js";

const [greetings, plasma] = process.argv.slice(2);
if (!greetings || !plasma) throw new Error("usage: bun tools/build-voyager-audio.ts GREETINGS.mp3 PIA17045.mp4");
const out = fileURLToPath(new URL("../public/assets/missions/voyager-1/audio/", import.meta.url));
mkdirSync(out, { recursive: true });

// Seconds into the greetings track, in the order they are on the record.
const CUTS: Record<string, [number, number]> = {
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
const PAD = 0.12, FADE = 0.04, PEAK_DB = -2;

function ffmpeg(args: string[]) {
  const run = Bun.spawnSync(["ffmpeg", "-hide_banner", "-nostdin", "-y", ...args], { stderr: "pipe" });
  const log = run.stderr.toString();
  if (run.exitCode !== 0) throw new Error(log);
  return log;
}

function cut(source: string, from: number, to: number, name: string, kbps: number) {
  const start = Math.max(0, from - PAD), length = to + PAD - start;
  const slice = ["-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", source, "-vn", "-ac", "1"];
  const peak = Number(ffmpeg([...slice, "-af", "volumedetect", "-f", "null", "-"]).match(/max_volume: (-?[\d.]+) dB/)![1]);
  const filters = [
    `volume=${(PEAK_DB - peak).toFixed(1)}dB`,
    `afade=t=in:d=${FADE}`,
    `afade=t=out:st=${(length - FADE).toFixed(3)}:d=${FADE}`,
  ].join(",");
  ffmpeg([...slice, "-af", filters, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", kbps + "k", "-map_metadata", "-1", out + name]);
  console.log(name.padEnd(24), (statSync(out + name).size / 1024).toFixed(1) + " KB", length.toFixed(2) + " s");
}

for (const { key } of GREETINGS) {
  if (!CUTS[key]) throw new Error("No cut times for the greeting in " + key);
  cut(greetings, ...CUTS[key], `greeting-${key}.mp3`, 64);
}
cut(plasma, 12.12, 23.88, "plasma-waves.mp3", 96);
