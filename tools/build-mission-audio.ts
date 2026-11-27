// Cuts a mission page's recordings out of the originals.
//
//   bun tools/build-mission-audio.ts MISSION [DIR]
//
// MISSION is voyager-1, cassini or webb. Needs ffmpeg on PATH. A source is
// either a { file } in DIR, downloaded anywhere outside the repository, or a
// { url } ffmpeg reads directly, seeking to the excerpt so a two-hour
// broadcast is not downloaded whole. DIR is needed only by a mission with
// files. Each mission's README in public/assets/missions/ says where every
// source comes from.
//
// Voyager's greetings are the Golden Record's "Greetings in 55 Languages" as
// one track. Their cut times were found by silence detection and each slice
// was checked against the phrase its speaker is recorded as saying, so a
// different transfer of the track needs them found again. The broadcast and
// mission-control excerpts were found from NASA's captions and checked by
// transcribing each cut. The rest are excerpts chosen for the stretch where
// the thing the page describes can be heard.
//
// Nothing is changed but length, level and encoding: each clip is brought to
// the same peak, given a short fade at both ends so it does not click, and
// written as mono MP3, which every browser's Web Audio can decode.
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RECORDINGS as CASSINI } from "../public/missions/cassini-mission.js";
import { RECORDINGS as VOYAGER } from "../public/missions/voyager-1-mission.js";
import { RECORDINGS as WEBB } from "../public/missions/webb-mission.js";

// `from` and `to` are seconds into the source. `pad` widens the cut on both
// sides; `fade` is the length of the fade at each end, longer where a cut
// lands in the middle of a room's noise.
type Cut = { source: string; from: number; to: number; kbps?: number; pad?: number; fade?: number };
type Source = { file: string } | { url: string };
type Mission = { recordings: Record<string, { key: string }[]>; sources: Record<string, Source>; cuts: Record<string, Cut> };

const IOWA = "https://space-audio.org/cassini/";
const JPL = "https://d2pn8kiwq2w21t.cloudfront.net/media/videoscassini";
const NASA_LIBRARY = (id: string) => ({ url: `https://images-assets.nasa.gov/video/${encodeURIComponent(id)}/${encodeURIComponent(id)}~mobile.mp4` });
const ROOM = { kbps: 56, fade: 0.25 };

const MISSIONS: Record<string, Mission> = {
  "voyager-1": {
    recordings: VOYAGER,
    sources: {
      greetings: { file: "Voyager_Golden_Record_Greetings_In_55_Languages.mp3" },
      interstellar: { file: "PIA17045_20130906-640.mp4" },
      whistlers: { file: "jwhist.mp3" },
      chorus: { file: "jov-chor.mp3" },
      bowShock: { file: "jovbow.mp3" },
      terminationShock: { file: "vgertermshock4.wav" },
    },
    // The greetings are in the order they are on the record, and cut with a
    // little air around the speech. The interstellar soundtrack plays the
    // same twelve seconds twice; the bow shock excerpt starts in the quiet
    // solar wind so the crossing can be heard. The Iowa files hold nothing
    // above 5.5 kHz; the interstellar tone sits near 2.5 kHz and gets more
    // bits.
    cuts: {
      "greeting-russian": { source: "greetings", from: 22.55, to: 24.7, pad: 0.12 },
      "greeting-arabic": { source: "greetings", from: 32.5, to: 37.86, pad: 0.12 },
      "greeting-french": { source: "greetings", from: 41.99, to: 43.16, pad: 0.12 },
      "greeting-spanish": { source: "greetings", from: 50.64, to: 52.2, pad: 0.12 },
      "greeting-bengali": { source: "greetings", from: 68.51, to: 70.61, pad: 0.12 },
      "greeting-japanese": { source: "greetings", from: 105.28, to: 106.82, pad: 0.12 },
      "greeting-hindi": { source: "greetings", from: 108.17, to: 110.8, pad: 0.12 },
      "greeting-zulu": { source: "greetings", from: 120.2, to: 124.57, pad: 0.12 },
      "greeting-mandarin": { source: "greetings", from: 149.46, to: 154.18, pad: 0.12 },
      "greeting-english": { source: "greetings", from: 258.61, to: 261.02, pad: 0.12 },
      "jupiter-lightning": { source: "whistlers", from: 3, to: 12 },
      "jupiter-chorus": { source: "chorus", from: 28, to: 40 },
      "jupiter-bow-shock": { source: "bowShock", from: 21.5, to: 33 },
      "termination-shock": { source: "terminationShock", from: 0, to: 6.37 },
      "plasma-waves": { source: "interstellar", from: 12.12, to: 23.88, kbps: 96 },
    },
  },
  cassini: {
    recordings: CASSINI,
    sources: {
      bowShock: { url: IOWA + "bow-shock/t2004_179_oneshock.wav" },
      radio: { url: IOWA + "SKR1/SKR-03-324.wav" },
      lightning: { url: IOWA + "cas-sed-06-023-2hr/cas-sed-06-023-twohour.wav" },
      bigEmpty: { url: IOWA + "rev271rpx/cas-Rev271-RPXNG-10kHz-17-116-085820-0901.wav" },
      enceladus: { url: JPL + "20180709JPL-20180709-CASSINf-0001-720cc.m4v" },
      control: { url: JPL + "20170915JPL-20170915-CASSINf-0001-720cc.m4v" },
    },
    // The bow shock clip is whole: the crossing is at its fifth second. The
    // radio and lightning excerpts are their busiest stretch; the ring-gap
    // dive's is the plasma waves either side of the crossing, which its
    // spectrogram puts thirty seconds in. JPL's Enceladus video opens with
    // titles and plays the recording from 28 s; the excerpt is the pass
    // nearest the moon. The control-room cut runs from the call of loss of
    // signal to the end of the sentence that follows it.
    cuts: {
      "saturn-bow-shock": { source: "bowShock", from: 0, to: 10.78 },
      "saturn-radio": { source: "radio", from: 6, to: 20 },
      "saturn-lightning": { source: "lightning", from: 4, to: 16 },
      "ring-gap": { source: "bigEmpty", from: 22, to: 36 },
      "enceladus-waves": { source: "enceladus", from: 33, to: 47, fade: 0.25 },
      "loss-of-signal": { source: "control", from: 17, to: 35.3, ...ROOM },
    },
  },
  webb: {
    recordings: WEBB,
    sources: {
      launch: NASA_LIBRARY("Coverage of the launch of the James Webb Space Telescope on an Ariane 5 rocket from the Guiana Space Center in Kourou, French Guiana"),
      sunshield: NASA_LIBRARY("GSFC_20220104_Webb_SunShield_Tensioning"),
      mirror: NASA_LIBRARY("GSFC_M14070_Webb_Primary_Mirror_Deploy"),
    },
    // Times are into NASA's "mobile" renditions, which run a few seconds
    // apart from the captions NASA publishes beside them.
    cuts: {
      liftoff: { source: "launch", from: 4807, to: 4823.7, ...ROOM },
      separation: { source: "launch", from: 6448.4, to: 6466.6, ...ROOM },
      "sunshield-tensioned": { source: "sunshield", from: 8551.5, to: 8568.4, ...ROOM },
      "mirror-latched": { source: "mirror", from: 13571.9, to: 13585.4, ...ROOM },
    },
  },
};

const [name, dir] = process.argv.slice(2);
const mission = MISSIONS[name];
const usage = "usage: bun tools/build-mission-audio.ts " + Object.keys(MISSIONS).join("|") + " [DIR]";
if (!mission) throw new Error(usage);
if (!dir && Object.values(mission.sources).some((source) => "file" in source)) throw new Error(usage + "\n" + name + " needs DIR, the folder holding its source files");
// The cut table and the page's recordings name the same clips, each once.
const keys = Object.values(mission.recordings).flat().map(({ key }) => key);
for (const key of keys) if (!mission.cuts[key]) throw new Error("No cut times for " + key);
for (const key of Object.keys(mission.cuts)) if (!keys.includes(key)) throw new Error("Cut times for " + key + ", which the page does not play");
const out = fileURLToPath(new URL(`../public/assets/missions/${name}/audio/`, import.meta.url));
mkdirSync(out, { recursive: true });
const PEAK_DB = -2;

function ffmpeg(args: string[]) {
  const run = Bun.spawnSync(["ffmpeg", "-hide_banner", "-nostdin", "-y", ...args], { stderr: "pipe" });
  const log = run.stderr.toString();
  if (run.exitCode !== 0) throw new Error(log);
  return log;
}

function cut(file: string, { source, from, to, kbps = 64, pad = 0, fade = 0.04 }: Cut) {
  const origin = mission.sources[source];
  const input = "url" in origin ? origin.url : join(dir!, origin.file);
  const start = Math.max(0, from - pad), length = to + pad - start;
  const slice = ["-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", input, "-vn", "-ac", "1"];
  const peak = Number(ffmpeg([...slice, "-af", "volumedetect", "-f", "null", "-"]).match(/max_volume: (-?[\d.]+) dB/)![1]);
  const filters = [
    `volume=${(PEAK_DB - peak).toFixed(1)}dB`,
    `afade=t=in:d=${fade}`,
    `afade=t=out:st=${(length - fade).toFixed(3)}:d=${fade}`,
  ].join(",");
  ffmpeg([...slice, "-af", filters, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", kbps + "k", "-map_metadata", "-1", out + file]);
  console.log(file.padEnd(26), (statSync(out + file).size / 1024).toFixed(1) + " KB", length.toFixed(2) + " s");
}

for (const key of keys) cut(`${key}.mp3`, mission.cuts[key]);
