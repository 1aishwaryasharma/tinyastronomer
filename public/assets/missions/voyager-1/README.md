# Voyager 1 spacecraft model, stills and recordings

`voyager.glb`, `og-cover.png`, `poster.webp` and `poster-800.webp` are built by
`tools/build-voyager-model.py` from NASA's own Voyager model. (`trajectory.json`
in this folder has its own builder, `tools/build-voyager-trajectory.ts`.)

## Source and credit

- [Voyager 3D model](https://science.nasa.gov/resource/voyager-3d-model/),
  NASA Science, Visualization Technology Applications and Development (VTAD).
  Direct file: `https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Voyager.glb`
  (3,128,204 bytes, SHA-256 `5338241f2e89e9cfe3ebb82f519b4cad64c97e66883cccba6fdda98667aec731`).
- Credit: NASA/JPL-Caltech (model by NASA VTAD). The raw download is not kept
  in this repository.

NASA's mesh was chosen over building one from scratch: it loads cleanly, is
only 20,390 triangles, already carries every major assembly in the right place,
and its texture atlas is made from photographs of the flight hardware,
including the real Golden Record cover. This is a hybrid: NASA's geometry and
textures, with our part split, orientation, materials, label anchors and whip
antennas.

## What was changed

- **Split into named parts.** NASA ships three fused meshes. Their connected
  pieces are sorted by position into the nine nodes listed below. No vertex
  was moved and no triangle removed, apart from the whips.
- **Whip antennas rebuilt.** NASA draws the two PWS/PRA whips 4.7 m long and
  108 degrees apart. They are replaced by two 10 m rods at 90 degrees, rooted
  at NASA's attachment points and in the same plane NASA leans them in.
- **Scaled by 0.971** so the dish is 3.70 m across (NASA's is 3.81 m). At that
  scale the magnetometer boom and bus also land on their published sizes.
- **Re-oriented and re-centred** to the axes below.
- **Materials.** NASA's base-colour textures are kept; metallic and roughness
  were re-set per part so the craft reads under one hard light with no
  environment map (nothing is a mirror). NASA's transparent helper cube
  (`_root`) is dropped.
- **Textures** re-encoded as WebP (quality 80): the main atlas at 1024 px, the
  two dish maps at 512 px (down from 1024 px; they are smooth shading maps).
- **Geometry** quantized and Meshopt-packed with
  `gltf-transform meshopt --level medium`, as the planet models are.

## Fidelity

Accurate (from NASA's mesh, checked against the published configuration):

| | Model | Published |
| --- | --- | --- |
| High-gain antenna diameter | 3.70 m | 3.7 m |
| Magnetometer boom, canister to tip | 13.1 m | 13 m |
| Whip antennas | 10.0 m each, 90 degrees apart | 10 m, 90 degrees |
| Bus across | about 1.8 m, ten-sided | 1.8 m |
| Golden Record cover | 0.30 m disc on the bus wall | 30 cm |

The layout is right: subreflector and feed on struts with the low-gain antenna
on top; three stacked RTGs on their own boom; the science boom opposite, with
the cosmic-ray, low-energy particle and plasma instruments along it and the
scan platform (cameras, IRIS, UVS, PPS) at its end; the magnetometer boom
leaving its canister beside the RTG truss.

Simplified or not exact:

- The bus side walls are 0.36 m tall in NASA's mesh; the real bus is 0.47 m.
- The whips are drawn about twice their real 12.7 mm thickness so they do not
  vanish at page size.
- The dish rim is a 32-sided polygon and the lattice booms are flat-sided.
- Texture detail is photographic, so some shading is baked in; the Golden
  Record engraving is a photograph of the real cover, not a normal map.
- The launch-adapter truss stubs under the bus are part of `Bus`.
- The split is by position. A few members of the truss the RTG and
  magnetometer booms share near the bus could belong to either.

## Axes and units

glTF space, right-handed, 1 unit = 1 metre, origin at the centre of the bus.

- `+Z`: high-gain antenna boresight (the way the dish points).
- `+X`: science boom and scan platform. `-X`: RTG boom.
- The magnetometer boom leaves on the `-X` side and climbs toward `+Z`; its tip
  is near (-12.3, 0, 8.7).
- The Golden Record is on the bus wall facing `-Y`.
- The whips root near (-1.06, 0, 0.18) and run toward `-X`, `-Z` and `+Y`/`-Y`.
- Bounding box: (-12.33, -7.14, -5.52) to (4.09, 7.14, 8.72).

## Nodes

All 18 nodes are children of the scene root.

Parts: `HighGainAntenna`, `LowGainAntenna`, `Bus`, `GoldenRecord`, `RTG`,
`ScienceBoom`, `ScanPlatform`, `MagnetometerBoom`, `PlasmaWaveAntennas`.

Label anchors (empty nodes, each on the outer surface of its part):
`Hotspot_HighGainAntenna`, `Hotspot_LowGainAntenna`, `Hotspot_Bus`,
`Hotspot_GoldenRecord`, `Hotspot_RTG`, `Hotspot_ScienceBoom`,
`Hotspot_ScanPlatform`, `Hotspot_MagnetometerBoom`,
`Hotspot_PlasmaWaveAntennas`.

Two things to know when reading them in three.js:

- `HighGainAntenna` and `LowGainAntenna` use more than one material, so
  `GLTFLoader` returns each as a `Group` with child meshes
  (`HighGainAntenna_1` ...). Traverse the node rather than expecting a `Mesh`.
- Quantization puts a scale and offset on the part nodes. Use world-space
  positions and bounds, not the nodes' local `position`. The hotspot nodes are
  untouched; their `position` is the anchor in metres.

Materials: `DishWhite`, `DishStructure`, `Blanket`, `Instruments`, `BoomMetal`,
`RTG`, `GoldenRecord`, `WhipAntenna`. Core metallic-roughness only; metallic
runs from 0 to 0.7, roughness from 0.42 to 0.65.

Extensions: `EXT_meshopt_compression`, `KHR_mesh_quantization`,
`EXT_texture_webp` (all three required to read the file).

## Rebuild

Needs Blender 5.x and `bunx` on PATH. Download NASA's file anywhere outside
the repository, then:

    curl -L -o /tmp/Voyager.glb \
      https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Voyager.glb
    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python tools/build-voyager-model.py -- /tmp/Voyager.glb

That writes all four files. `--out DIR` writes them to another folder,
`--no-renders` exports the GLB only, `--no-glb` renders only, and `--previews
DIR` adds quick check renders from six angles. The script imports
`tools/mission_model_kit.py`, which holds what the three mission model
builders share. The Meshopt pass runs there as `bunx @gltf-transform/cli@4.2.1
meshopt <raw> voyager.glb --level medium`.

The stills are Cycles renders (160 samples, denoised, AgX) of the same scene:
one hard Sun, a weak blue fill and a rim light, composited over a flat
`#050810` sky with a seeded star field.

## Sizes

| File | Size | Notes |
| --- | --- | --- |
| `voyager.glb` | 466 KB | 20,402 triangles, 3 textures (108 KB of the file) |
| `og-cover.png` | 216 KB | 1200 x 630 |
| `poster.webp` | 40 KB | 1600 x 1000 |
| `poster-800.webp` | 17 KB | 800 x 500 |

## Recordings (`audio/`)

Built by `tools/build-mission-audio.ts` from NASA and University of Iowa originals. Nothing is
changed but length, level and encoding (mono MP3).

- `greeting-<language>.mp3`: ten of the Golden Record's fifty-five spoken
  greetings, each cut from the single "Greetings in 55 Languages" track.
  - NASA's page, with the translations the site quotes:
    <https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/>.
    NASA plays the track there through a SoundCloud embed and offers no file.
  - File used: the same track as held by Wikimedia Commons,
    `https://commons.wikimedia.org/wiki/File:Voyager_Golden_Record_-_Greetings_In_55_Languages.mp3`
    (6,366,073 bytes, SHA-256
    `72e19421515a4ee1debbd5595c90140a739e300805443303d1b485be73cd3630`).
    NASA also offers the English greeting as a download:
    <https://science.nasa.gov/resource/sounds-of-mars-hello-from-the-children-of-planet-earth/>.
  - Credit on the page: NASA/JPL-Caltech, 1977. The greetings were recorded
    at Cornell University by volunteer speakers.
  - Each cut was checked by transcribing it and comparing the words with the
    greeting the record's documentation gives for that language.
  - **Rights: used under the licence NASA publishes them with.** NASA's
    verified SoundCloud account offers each greeting as its own track,
    marked Creative Commons Attribution-NonCommercial (`cc-by-nc`) and
    downloadable: <https://soundcloud.com/nasa/sets/golden-record-greetings-to-the>.
    All ten languages used here were checked on 2026-11-21. That licence
    asks for three things, and the site meets them: credit (NASA/JPL-Caltech
    beside the buttons), a pointer to the licence with a note that the audio
    was changed (the page's Sources list says "shortened here"; the clips are
    trimmed and re-encoded, nothing else), and non-commercial use (the site
    is free, with no advertising or sales; if that ever changes, this needs
    looking at again).
  - What that does not settle: who owned the 1977 recordings. The speakers
    were not federal employees and no release or assignment is published, so
    this is not relied on as public domain, whatever the Commons tag says.
    Also on record: NASA says it obtained releases for what it presents
    online (<https://science.nasa.gov/mission/voyager/frequently-asked-questions/>),
    and the Library of Congress presents the same recordings "courtesy of
    the NASA Jet Propulsion Laboratory". The file the clips were cut from is
    the Commons copy of the same NASA track, not a SoundCloud download.
  - If a rights holder objects, remove `greeting-*.mp3`, the `record` entry
    of `RECORDINGS` and the greeting assertions in `mission-audio.test.ts`;
    the page's Sources list still links to NASA's greetings page.
- `plasma-waves.mp3`: twelve seconds from the soundtrack of PIA17045, "Voyager
  Captures Sounds of Interstellar Space",
  <https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space>.
  File used:
  `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia17/pia17045/PIA17045_20130906-640.mp4`
  (3,532,551 bytes, SHA-256
  `fcdec8d93dacfbe61d4282fff1f3dc896a4cbce0849e64838aff35b6287c3bdf`).
  Credit: NASA/JPL-Caltech/University of Iowa. It is plasma-wave data from
  October 2012 to May 2013 played at its own frequencies with the time
  compressed, not a sound recording, and the page says so.
- Four more excerpts of what Voyager 1's plasma wave instrument picked up,
  from the University of Iowa's Radio and Plasma Wave Group, which built it:
  <https://space-audio.org/>. All four are Voyager 1's own data.

  | File | Source file | What and when | SHA-256 of the source |
  | --- | --- | --- | --- |
  | `jupiter-lightning.mp3` | `https://space-audio.org/sounds/JupiterWhistlers/jwhist.mp3` | Whistlers from lightning, Jupiter flyby, March 1979 | `1ab57a4d6e1ec859107c19abe7b8d3bf27c0f31ba60e2639ede04fb8adf8acba` |
  | `jupiter-chorus.mp3` | `https://space-audio.org/sounds/JupiterChorus/jov-chor.mp3` | Chorus in the radiation belts, 5 March 1979 | `122c90b25b4806364f9411c56c3a298d674841a124b0dafb9e25a253beb06505` |
  | `jupiter-bow-shock.mp3` | `https://space-audio.org/sounds/JupiterBowShock/jovbow.mp3` | Bow shock crossing on approach, 1 March 1979 | `b5a2801d398bd101cfc62cb8deffc84fe8c41d5295f413d1a1e1fa8219df8683` |
  | `termination-shock.mp3` | `https://space.physics.uiowa.edu/space-audio/voyager/termination-shock/vgertermshock4.wav` | Plasma oscillations before the termination shock, 18:00 to 21:00 on 15 December 2004, compressed to six seconds | `4e0f2fe9158be96d1e492bb7eb231730d172373f11235171827a033d0073c15c` |

  Licence: Creative Commons Attribution 4.0 International
  (<https://space-audio.org/citation.html>), which asks for the credit
  "Original space audio recordings provided courtesy of NASA and The
  University of Iowa." The page credits them beside each set of buttons and
  links to space-audio.org in its sources. These too are electric waves played
  through a speaker, not sound.

The Golden Record's music is a different matter: it belongs to its performers
and publishers, and none of it is used here.

Rebuild, with ffmpeg on PATH and the six source files downloaded into one
folder outside the repository, under the names the script lists:

    bun tools/build-mission-audio.ts voyager-1 /tmp/voyager-audio

The fifteen files total about 690 KB. None is fetched until it plays: on its
button, or, with Sound on, when the story reaches its moment. The page makes
no sound of its own: there is no background track.
