# Webb telescope model, unfolding clip and stills

`webb.glb`, `og-cover.png`, `poster.webp` and `poster-800.webp` are built by
`tools/build-webb-model.py` from NASA's own James Webb Space Telescope model.
(`trajectory.json` in this folder has its own builder,
`tools/build-webb-trajectory.ts`.)

## Source and credit

- [James Webb Space Telescope (A)](https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/),
  NASA Science 3D Resources.
  Direct file: `https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/james-webb-space-telescope-(a)/James%20Webb%20Space%20Telescope%20(A).glb`
  (4,710,016 bytes, SHA-256 `ea4a53f71f1e7477d8b90e30d1299b2cb33faea18acdcaf831dc9d3ebf1b7750`).
- Credit: NASA/Goddard Space Flight Center. The raw download is not kept in
  this repository.

NASA's mesh was chosen over building one from scratch: it is the fully open
telescope at true size, 493,785 triangles in 1,600 meshes, still arranged in
the animation rig it was made with, so the moving assemblies are already
separate. This is a hybrid: NASA's geometry, with our part grouping,
thinning, materials, pivots, unfolding clip and label anchors.

## What was changed

- **Grouped into 18 named meshes** by each mesh's place in NASA's rig. No
  vertex was moved.
- **Dropped:** wiring looms, the membrane-cover cleats along both pallets,
  and every mesh under 7 cm (nuts, washers, screws): well over 100,000
  triangles that are specks at page size. The duplicate under-surfaces of the two
  lowest membranes are dropped too; each membrane is one double-sided sheet.
- **Thinned** with Blender's collapse decimation, part by part, to 64,106
  triangles. The 18 mirror segments, the secondary mirror and its struts are
  untouched.
- **Momentum flap repaired.** NASA's export leaves one of the flap's two outer
  panels about 6 m behind the telescope. It is replaced by a mirror image of
  the other outer panel.
- **Sunshield cut in three** along the two pallet hinge lines, so the fore and
  aft parts can ride their pallets as they fold.
- **Re-oriented and re-centred** to the axes below. Not rescaled.
- **Materials.** NASA's 46 untextured materials are tuned for a reflection
  map and are nearly black without one. They are mapped onto 12 flat
  materials that read under one hard light with no environment map (nothing
  is a mirror; the gold is mostly diffuse). There are no textures.
- **Geometry** quantized and Meshopt-packed with
  `gltf-transform meshopt --level medium`, as the planet models are.

## Fidelity

Accurate (from NASA's mesh, checked against the published configuration):

| | Model | Published |
| --- | --- | --- |
| Primary mirror, gold surface | 6.6 m tall, 6.1 m wide, 18 segments | 6.5 m across, 18 segments |
| Mirror segment, flat to flat | 1.32 m | 1.32 m |
| Secondary mirror | about 0.7 m | 0.74 m |
| Sunshield membranes | 19.7 m x 14.3 m | 21.197 m x 14.162 m |
| Whole observatory, flap to forward tip | 21.2 m | about 21 m |
| Tower lift in the clip | 1.22 m | 1.22 m |

The layout is right: five separated membranes on fore and aft pallets and two
mid-booms; the bus, solar array, antenna and star trackers on the Sun side;
the tower, instrument module, radiators and backplane behind the mirror; the
secondary mirror on three struts.

Simplified or not exact:

- Thinning has rounded off small parts of the bus, pallets and instrument
  module. Thrusters and brackets are rough shapes.
- Colours are ours. The real blankets and membranes are shinier and their
  colour depends on what they reflect.
- The unfolding clip is a simplified sequence, described below.
- Which mirror wing is port and which starboard was not checked against the
  flight hardware; they are named A and B.

## Axes and units

glTF space, right-handed, 1 unit = 1 metre, origin at the centre of the
spacecraft bus.

- `+Z`: the way the telescope looks (the primary mirror faces `+Z`).
- `+Y`: the cold side. The telescope stands on this side of the sunshield;
  the Sun is always somewhere toward `-Y`.
- `+X`: mid-boom A and mirror wing A.
- The sunshield's long axis is `Z`: forward tip near `z = +9.7`, momentum
  flap near `z = -11.5`.
- Bounding box, open: (-7.39, -1.66, -11.53) to (7.39, 10.34, 9.67).
  Folded: about 6.4 m x 10.9 m x 10.0 m.
- Primary mirror centre: (0, 5.38, 0.95).

## Nodes

Meshes (the first eight are the parts the page's picker names):
`PrimaryMirror`, `SecondaryMirror`, `Sunshield`, `InstrumentModule`, `Bus`,
`SolarArray`, `Antenna`, `MomentumFlap`, then `MirrorWingA`, `MirrorWingB`,
`SecondaryStrutA`, `SecondaryStrutB`, `SunshieldFwd`, `SunshieldAft`,
`FwdPallet`, `AftPallet`, `MidBoomA`, `MidBoomB`.

`PrimaryMirror` is the twelve fixed segments and the baffle in front of them;
the other six segments are in the two wings. `SecondaryMirror` is the mirror
and the two lower struts; the upper strut is the two `SecondaryStrut` halves.
`Sunshield` is the middle of the five membranes; the rest is `SunshieldFwd`
and `SunshieldAft`.

Label anchors (empty nodes on the outer surface of each named part):
`Hotspot_PrimaryMirror`, `Hotspot_SecondaryMirror`, `Hotspot_Sunshield`,
`Hotspot_InstrumentModule`, `Hotspot_Bus`, `Hotspot_SolarArray`,
`Hotspot_Antenna`, `Hotspot_MomentumFlap`.

Pivots (empty nodes; these are the only nodes the clip moves):

    Pivot_SolarArray        > SolarArray
    Pivot_Antenna           > Antenna
    Pivot_FwdPallet         > FwdPallet, Scale_SunshieldFwd > SunshieldFwd
    Pivot_AftPallet         > AftPallet, Scale_SunshieldAft > SunshieldAft,
                              Pivot_MomentumFlap > MomentumFlap
    Scale_Sunshield         > Sunshield
    Pivot_MidBoomA, Pivot_MidBoomB > MidBoomA, MidBoomB
    Pivot_Tower             > InstrumentModule, PrimaryMirror,
                              Pivot_MirrorWingA > MirrorWingA,
                              Pivot_MirrorWingB > MirrorWingB,
                              Pivot_SecondaryMirror > SecondaryMirror,
                                Pivot_SecondaryStrutB > SecondaryStrutB,
                              Pivot_SecondaryStrutA > SecondaryStrutA

`Bus` hangs straight off the scene. Things to know when reading the file in
three.js:

- Most meshes use more than one material, so `GLTFLoader` returns each as a
  `Group` with child meshes (`Bus_1` ...). Traverse the node.
- Quantization puts a scale and offset on the mesh nodes. Use world-space
  positions and bounds, not a mesh node's local `position`. The pivot and
  hotspot nodes are untouched.

Materials: `Gold`, `GoldTrim`, `Silver`, `ShieldHot`, `ShieldCold`, `Kapton`,
`SilverBlanket`, `Black`, `Aluminium`, `SolarCells`, `White`, `Grey`. Core
metallic-roughness only; metallic runs from 0 to 0.45, roughness from 0.35 to
0.6. The two `Shield` materials are double-sided.

Extensions: `EXT_meshopt_compression`, `KHR_mesh_quantization` (both required
to read the file).

## The `Deploy` clip

One animation, `Deploy`, 10 seconds long, 19 channels, linear keys. The node
rest transforms are the open telescope; time 0 is folded for launch and time
10 is open. Second N is the start of step N, so the page can scrub it by
scroll and ease each step itself.

| Seconds | Step | Real date |
| --- | --- | --- |
| 0 - 1 | Solar array unfolds | 25 Dec 2021 |
| 1 - 2 | Antenna assembly swings out | 26 Dec 2021 |
| 2 - 3 | Forward, then aft pallet lowers | 28 Dec 2021 |
| 3 - 4 | Tower lifts the telescope 1.22 m | 29 Dec 2021 |
| 4 - 5 | Aft momentum flap | 30 Dec 2021 |
| 5 - 6 | Mid-booms pull the sunshield to full width | 31 Dec 2021 |
| 6 - 7 | Five layers tensioned | 3 - 4 Jan 2022 |
| 7 - 8 | Secondary mirror support | 5 Jan 2022 |
| 8 - 9 | First primary mirror wing | 7 Jan 2022 |
| 9 - 10 | Second primary mirror wing | 8 Jan 2022 |

The order and dates are NASA's. The motion is a sketch of each step, not the
flight mechanism:

- The folded membranes are the open ones squeezed thin and flat on their
  pallets, then stretched to full width and lifted apart. The real ones
  unroll from folded stacks.
- The solar array is squeezed along its length rather than folding as five
  hinged panels. The mid-booms stretch rather than telescoping.
- The pallets and antenna swing on single hinges. The real pallets ride
  four-bar linkages.
- The secondary mirror support is hinged where the real one is: the lower
  struts at the base of the mirror, the upper strut at the top and folding in
  its middle. Its folded angle is chosen to clear the model, not measured.
- The sunshield covers, instrument radiator and other small releases are not
  shown.

## Rebuild

Needs Blender 5.x and `bunx` on PATH. Download NASA's file anywhere outside
the repository, then:

    curl -L -o /tmp/webb.glb \
      "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/james-webb-space-telescope-(a)/James%20Webb%20Space%20Telescope%20(A).glb"
    /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python tools/build-webb-model.py -- /tmp/webb.glb

That writes all four files. `--out DIR` writes them to another folder,
`--no-renders` exports the GLB only, `--no-glb` renders only, and `--previews
DIR` adds quick check renders of the clip at thirteen moments from two sides.
The script imports `tools/mission_model_kit.py`, which holds what the three
mission model builders share. The Meshopt pass runs there as `bunx
@gltf-transform/cli@4.2.1 meshopt <raw> webb.glb --level medium`.
`missions-webb.test.ts` loads the packed file with the vendored three.js and
plays the clip, so a rebuild that loses the animation fails the tests.

The stills are Cycles renders (160 samples, denoised, AgX) of the open
telescope, composited over a flat `#050810` sky with a seeded star field. The
real Sun only ever lights the underside of the shield, so a second lamp
lights the mirror side; in space it is in permanent shadow.

## Sizes

| File | Size | Notes |
| --- | --- | --- |
| `webb.glb` | 818 KB | 64,106 triangles, no textures, one 10 s clip |
| `og-cover.png` | 217 KB | 1200 x 630 |
| `poster.webp` | 25 KB | 1600 x 1000 |
| `poster-800.webp` | 12 KB | 800 x 500 |
| `trajectory.json` | 75 KB | see `tools/build-webb-trajectory.ts` |

## Recordings (`audio/`)

Webb carries no microphone and no instrument that picks up waves, so it has
no sounds of its own. Everything the page plays was recorded on Earth, from
NASA's coverage. Built by `tools/build-mission-audio.ts`, which reads each
excerpt straight from NASA's file. Nothing is changed but length, level and
encoding (mono MP3). Each cut was checked by transcribing it.

| File | NASA video (`images.nasa.gov`) | Seconds into the "mobile" file | What is heard |
| --- | --- | --- | --- |
| `liftoff.mp3` | [Launch coverage, 25 December 2021](https://images.nasa.gov/details/Coverage%20of%20the%20launch%20of%20the%20James%20Webb%20Space%20Telescope%20on%20an%20Ariane%205%20rocket%20from%20the%20Guiana%20Space%20Center%20in%20Kourou%2C%20French%20Guiana) | 4807 to 4823.7 | Engine start and liftoff, with the commentary "Liftoff from a tropical rainforest to the edge of time itself. James Webb begins a voyage back to the birth of the universe." |
| `separation.mp3` | the same | 6448.4 to 6466.6 | Confirmation of observatory separation, about 27 minutes after launch, over applause in the control centre |
| `sunshield-tensioned.mp3` | [Sunshield tensioning, 4 January 2022](https://images.nasa.gov/details/GSFC_20220104_Webb_SunShield_Tensioning) | 8551.5 to 8568.4 | The call that all five layers are fully tensioned, and the room's response |
| `mirror-latched.mp3` | [Primary mirror final deployment, 8 January 2022](https://images.nasa.gov/details/GSFC_M14070_Webb_Primary_Mirror_Deploy) | 13571.9 to 13585.4 | "We have a fully deployed JWST observatory", and the cheering |

The files used are NASA's `~mobile.mp4` renditions of each video (345,980,229;
388,598,102 and 623,266,522 bytes). Their times run a few seconds off the
captions NASA publishes beside them; the cut times above are into the mobile
files.

- Rights: NASA coverage, released through the NASA Image and Video Library.
  NASA's media guidelines (<https://www.nasa.gov/nasa-brand-center/images-and-media/>)
  say NASA material is generally not subject to copyright in the United
  States and ask that NASA be credited. The page credits NASA beside the
  buttons and links each video in its sources. It names no speaker.
- Left out on purpose: the NASA/Chandra sonifications of Webb's images
  (Cosmic Cliffs, Southern Ring Nebula, WASP-96 b). A sonification turns a
  picture into music, with notes and instruments chosen by people, so it is
  not a recording, and this page plays only recordings.

Rebuild, with ffmpeg on PATH:

    bun tools/build-mission-audio.ts webb

The four files total about 460 KB. None is fetched until it plays.
