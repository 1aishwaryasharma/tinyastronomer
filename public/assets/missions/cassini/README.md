# Cassini spacecraft model, stills and trajectory

`cassini.glb`, `og-cover.png`, `poster.webp` and `poster-800.webp` are built by
`tools/build-cassini-model.py` from NASA's own Cassini model.
`trajectory.json` and `tour.bin` are built by
`tools/build-cassini-trajectory.ts` from JPL Horizons; their layout is
described at the top of that file.

## Source and credit

- [Cassini 3D model](https://science.nasa.gov/resource/cassini-3d-model/),
  NASA Science, Visualization Technology Applications and Development (VTAD).
  Direct file: `https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Cassini.glb`
  (5,852,640 bytes, SHA-256 `cacdca3279b28e64280ff8e823f572311f67a83bde2d0435b26f515a1b7926be`).
- Credit: NASA/JPL-Caltech (model by NASA VTAD). The raw download is not kept
  in this repository.
- Trajectory: NASA/JPL Horizons, targets `-82` (Cassini) and `-150` (Huygens).

NASA's mesh was chosen over building one from scratch: it loads cleanly, is
26,020 triangles, is already at true size, and carries every major assembly
in the right place with the Huygens probe as a separate shell. This is a
hybrid: NASA's geometry and textures, with our part split, orientation,
materials, label anchors and antenna rods.

## What was changed

- **Split into named parts.** NASA groups its eleven meshes by material, not
  by assembly. Their connected pieces are sorted by position into the eight
  nodes listed below. No vertex was moved and no triangle removed, apart from
  the antennas.
- **Huygens is its own node** (`HuygensProbe`: NASA's `foil_gold_h` shell and
  its `huygens_strip` marking), so the page can spin it and move it away. The
  support ring it sat on stays with `Bus`.
- **RPWS antennas rebuilt.** NASA draws the three rods as flat strips 30 mm
  wide. They are replaced by round tapered rods between NASA's own end
  points, a little over twice the real 28.6 mm thickness so they do not
  vanish at page size.
- **Not rescaled.** The dish is 4.00 m across as delivered. NASA's origin, on
  the axis at mid-height of the stack, is kept as the centre of the body.
- **Re-oriented** to the axes below.
- **Materials.** NASA's foil and bare metal are fully metallic, which renders
  black under one hard light with no environment map. Every material was
  re-set to be mostly dielectric and fairly rough (metallic 0 to 0.45,
  roughness 0.45 to 0.6). NASA's two foil normal maps and two base-colour
  textures are kept; its duplicate images and its transparent helper cube
  (`_root`) are dropped.
- **Textures** re-encoded as WebP (quality 80): the dish and detail maps at
  1024 px, the two foil normal maps at 512 px (one was 1024 px).
- **Geometry** quantized and Meshopt-packed with
  `gltf-transform meshopt --level medium`, as the planet models are.

## Fidelity

Accurate (from NASA's mesh, checked against the published configuration):

| | Model | Published |
| --- | --- | --- |
| High-gain antenna diameter | 4.00 m | 4 m |
| Height, engine nozzles to antenna tip | 6.54 m | 6.7 to 6.8 m |
| Magnetometer boom, canister to tip | 10.2 m | 11 m |
| RPWS antennas | 9.8 to 9.9 m each, three | 10 m, three |
| Huygens probe across | 2.62 m | 2.7 m |
| RTGs | three, at the foot of the stack | three |
| Main engines | two, side by side | two (one a spare) |

The layout is right: dish on top with its feed and low-gain antenna; the
twelve-bay electronics ring under it; the remote-sensing pallet (cameras and
spectrometers, all looking one way) on the side opposite Huygens; the fields
and particles instruments on the Huygens side; the magnetometer boom leaving
its canister under the dish rim; propellant tanks under blankets; three RTGs
with their shades; two engine nozzles.

Simplified or not exact:

- The stack is about 0.2 m short and the boom about 0.8 m short of the
  published figures; NASA's proportions were left alone.
- The antenna rods are drawn thicker than life (see above).
- The blankets are one flat gold colour with a crinkle normal map; the real
  ones vary from amber to black.
- `RemoteSensingPallet` is everything mounted outboard on that side of the
  body, which includes the two star trackers next to the instruments.
- `Bus` is everything else: both equipment modules, the tanks, the four
  thruster clusters, the fields and particles pallet and the probe's support
  ring.
- The split is by position. A few brackets where assemblies meet could belong
  to either neighbour.

## Axes and units

glTF space, right-handed, 1 unit = 1 metre, origin on the axis at the middle
of the body.

- `+Z`: high-gain antenna boresight (the way the dish points). The engines
  point along `-Z`.
- `+X`: magnetometer boom; its tip is near (11.1, 0, 1.2).
- `-Y`: the Huygens probe, centred near (0, -1.4, -1.1). It separates along
  `-Y`. `+Y`: the remote-sensing pallet.
- The antenna rods root near (1.6, ±0.45, 0.35) and (1.5, -0.06, -0.34).
- Bounding box: (-2.04, -8.98, -8.27) to (11.07, 9.00, 3.40).

## Nodes

All 16 nodes are children of the scene root.

Parts: `HighGainAntenna`, `Bus`, `RemoteSensingPallet`, `MagnetometerBoom`,
`RPWSAntennas`, `RTG`, `MainEngines`, `HuygensProbe`.

Label anchors (empty nodes, each on the outer surface of its part):
`Hotspot_HighGainAntenna`, `Hotspot_Bus`, `Hotspot_RemoteSensingPallet`,
`Hotspot_MagnetometerBoom`, `Hotspot_RPWSAntennas`, `Hotspot_RTG`,
`Hotspot_MainEngines`, `Hotspot_HuygensProbe`.

Two things to know when reading them in three.js:

- Parts that use more than one material come back from `GLTFLoader` as a
  `Group` with child meshes. Traverse the node rather than expecting a `Mesh`.
- Quantization puts a scale and offset on the part nodes. Use world-space
  positions and bounds, not the nodes' local `position`. To move Huygens,
  parent it to a pivot at its world-space centre (the page does) and move the
  pivot. The hotspot nodes are untouched; their `position` is the anchor in
  metres.

Materials: `Foil`, `FoilPanels`, `DishWhite`, `Detail`, `Metal`, `Black`,
`Antenna`. Core metallic-roughness only.

Extensions: `EXT_meshopt_compression`, `KHR_mesh_quantization`,
`EXT_texture_webp` (all three required to read the file).

## Rebuild

Needs Blender 5.x and `bunx` on PATH. Download NASA's file anywhere outside
the repository, then:

    curl -L -o /tmp/Cassini.glb \
      https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Cassini.glb
    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python tools/build-cassini-model.py -- /tmp/Cassini.glb

That writes all four files. `--out DIR` writes them to another folder,
`--no-renders` exports the GLB only, `--no-glb` renders only, `--previews DIR`
adds quick check renders from six angles, and `--part-colours` paints each
part a flat colour in those previews to check the split. The script imports
`tools/mission_model_kit.py`, which holds what the three mission model
builders share. The Meshopt pass runs there as `bunx @gltf-transform/cli@4.2.1
meshopt <raw> cassini.glb --level medium`.

The stills are Cycles renders (160 samples, denoised, AgX) of the same scene:
one hard Sun, a weak blue fill and a rim light, composited over a flat
`#050810` sky with a seeded star field.

The trajectory:

    bun tools/build-cassini-trajectory.ts --cache /tmp/cassini-horizons

It makes about forty requests to Horizons and takes a few minutes the first
time; `--cache` keeps the replies (about 100 MB) for the next run.

## Sizes

| File | Size | Notes |
| --- | --- | --- |
| `cassini.glb` | 661 KB | 26,042 triangles, 4 textures (247 KB of the file) |
| `og-cover.png` | 189 KB | 1200 x 630 |
| `poster.webp` | 32 KB | 1600 x 1000 |
| `poster-800.webp` | 15 KB | 800 x 500 |
| `trajectory.json` | 103 KB | cruise, flybys, orbit insertion, Titan, Enceladus |
| `tour.bin` | 108 KB | 11,515 samples of the tour and 1,949 of the last 22 orbits |

## Recordings (`audio/`)

Built by `tools/build-mission-audio.ts` from University of Iowa and NASA/JPL
originals. Nothing is changed but length, level and encoding (mono MP3).

The first five are what Cassini's Radio and Plasma Wave Science instrument
picked up, from the University of Iowa group that built it:
<https://space-audio.org/>. They are electric and radio waves turned into
sound, not sound, and each is sped up or lowered in pitch; the page says by
how much where its source does.

| File | Source file | What and when | SHA-256 of the source |
| --- | --- | --- | --- |
| `saturn-bow-shock.mp3` | `https://space-audio.org/cassini/bow-shock/t2004_179_oneshock.wav` | Bow shock crossing, 09:45 UT 27 June 2004, 49.2 Saturn radii out; 28 minutes in 10 s. Whole file. | `d745dd768837eeb5bbc3483b86c665ae26a4c0f20036f28abc217af3292c0add` |
| `saturn-radio.mp3` | `https://space-audio.org/cassini/SKR1/SKR-03-324.wav` | Saturn kilometric radiation, 20 November 2003 (day 324); 22 times real time, 44 times lower. Seconds 6 to 20. | `54b2e2a15edf1e65e5771c7d74422e9c158d0aa87b11fc5730c7a085d49ebdfb` |
| `saturn-lightning.mp3` | `https://space-audio.org/cassini/cas-sed-06-023-2hr/cas-sed-06-023-twohour.wav` | Lightning radio bursts, storm beginning 23 January 2006; two hours in 28 s. Seconds 4 to 16. | `9e4e237125a926e5acd98aa4b2e704d2ea9796308c7ff23e46ea8ac1f19bc8f9` |
| `ring-gap.mp3` | `https://space-audio.org/cassini/rev271rpx/cas-Rev271-RPXNG-10kHz-17-116-085820-0901.wav` | First dive under the rings, "the big empty", 08:58 to 09:01 UT 26 April 2017; about four times real time. Seconds 22 to 36, either side of the ring-plane crossing. | `ee89e5bcfe0ca49ffd148caedd15a73c902da91ebe1d597fdd71a2b57fd722e3` |
| `enceladus-waves.mp3` | `https://d2pn8kiwq2w21t.cloudfront.net/media/videoscassini20180709JPL-20180709-CASSINf-0001-720cc.m4v` | Plasma waves between Saturn and Enceladus, 2 September 2017; sixteen minutes in 28.5 s, five times lower. The video's soundtrack, seconds 33 to 47 (the recording starts at 28 s, after the titles). | `f42f3981943147b366cbf01c9c1ea9eaf2a9e1d04ce8f117fcf9e8dee3bd42af` |

- Landing pages: <https://space-audio.org/cassini/bow-shock/>,
  <https://space-audio.org/cassini/SKR1/>,
  <https://space-audio.org/cassini/cas-sed-06-023-2hr/>,
  <https://space-audio.org/cassini/rev271rpx/>, and JPL's "Sounds of Saturn:
  Hear Radio Emissions of the Planet and Its Moon Enceladus" (9 July 2018),
  <https://www.jpl.nasa.gov/videos/sounds-of-saturn-hear-radio-emissions-of-the-planet-and-its-moon-enceladus/>.
- Licence: the Iowa clip pages say Creative Commons Attribution 3.0
  Unported; the site's citation page (<https://space-audio.org/citation.html>)
  says Creative Commons Attribution 4.0 International. Either asks for credit:
  "Original space audio recordings provided courtesy of NASA and The
  University of Iowa." The page credits NASA/JPL-Caltech/University of Iowa
  beside each set of buttons and links to space-audio.org in its sources. The
  Enceladus clip is the same group's data as released by NASA/JPL.

`loss-of-signal.mp3` is a sound recording, made on Earth: the room at JPL as
Cassini's signal stopped on 15 September 2017, from JPL's "Final Moments in
Cassini Mission Control",
<https://www.jpl.nasa.gov/videos/final-moments-in-cassini-mission-control/>.
File used:
`https://d2pn8kiwq2w21t.cloudfront.net/media/videoscassini20170915JPL-20170915-CASSINf-0001-720cc.m4v`
(51,282,219 bytes, SHA-256
`fc28a4e3b600355fa0a71c782e387d50d63bf7a65d909371fbfecf82599f25f7`), seconds
17 to 35.3: the call of loss of signal at 11:55:46 UTC, and the next sentence,
"the signal from the spacecraft is gone, and within the next 45 seconds, so
will be the spacecraft." Credit NASA/JPL-Caltech. The speakers are not named
on the page.

Left out on purpose:

- Huygens' "sounds of Titan" (ESA, 2005). ESA calls the file "a laboratory
  reconstruction of the sounds heard by Huygens' microphones", put together
  from samples across the descent, and ESA's website terms do not allow
  redistribution. The Titan chapter stays silent.
- The ring-plane dust impacts at Saturn arrival on space-audio.org: those
  pages say "All rights reserved", with no Creative Commons licence.

Rebuild, with ffmpeg on PATH (every source is read from its URL):

    bun tools/build-mission-audio.ts cassini

The six files total about 650 KB. None is fetched until it plays.
