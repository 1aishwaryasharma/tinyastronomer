"""Build the Cassini deep-dive spacecraft model and its hero stills.

Imports NASA's own Cassini model (NASA Science / VTAD, see
public/assets/missions/cassini/README.md for the download link), splits its
meshes (which NASA groups by material) into the named parts the page
highlights, with the Huygens probe as a node of its own so the page can let it
go, adds label anchors, re-orients the craft to the page contract, exports a
web-sized GLB, and renders the social card and poster in Cycles.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/build-cassini-model.py -- /path/to/Cassini.glb

Options after the source path:
    --no-renders        export the GLB only
    --no-glb            render only
    --previews DIR      also write low-sample check renders from several angles
    --part-colours      with --previews: flat colour per part, to check the split
    --samples N         Cycles samples for the finals (default 160)
    --out DIR           write there instead of public/assets/missions/cassini

Needs Blender 5.x; `bunx` (for the gltf-transform Meshopt pass) on PATH.
Runs against the unmodified NASA file and is deterministic.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

# The kit sits beside this file; importing it must not leave a __pycache__ here.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mission_model_kit as kit

PARTS = [
    'HighGainAntenna', 'Bus', 'RemoteSensingPallet', 'MagnetometerBoom',
    'RPWSAntennas', 'RTG', 'MainEngines', 'HuygensProbe',
]

# NASA's file has the dish boresight on Blender +Z, the magnetometer boom on
# +Y and the Huygens probe on +X. The page wants boresight on glTF +Z
# (Blender -Y), the boom on +X and the probe on glTF -Y (Blender -Z).
REORIENT = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0)))

# The three RTGs stand out from the foot of the craft along these bearings
# (degrees from NASA's +X toward +Y).
RTG_BEARINGS = (90, -90, 150)

# base colour, metallic, roughness per material. No environment map on the
# page, so nothing is a mirror: NASA's fully metallic foil would render black
# under one light, and is made mostly dielectric and fairly rough instead.
MATERIALS = {
    'Foil': ((1.0, 0.62, 0.12, 1.0), 0.45, 0.48),
    'FoilPanels': ((1.0, 0.62, 0.12, 1.0), 0.45, 0.48),
    'DishWhite': (None, 0.0, 0.6),
    'Detail': (None, 0.0, 0.55),
    'Metal': ((0.78, 0.79, 0.82, 1.0), 0.4, 0.45),
    'Black': ((0.02, 0.02, 0.022, 1.0), 0.0, 0.6),
    'Antenna': ((0.86, 0.87, 0.9, 1.0), 0.3, 0.5),
}
ROLE_OF = {
    'aluminum': 'Metal', 'Vents': 'Metal', 'black_krinkle': 'Black',
    'plastic_dark': 'Black', 'foil_gold': 'Foil', 'foil_gold_2': 'FoilPanels',
    'dish_AO': 'DishWhite', 'Material *': 'DishWhite', 'tex_01': 'Detail',
}
# Which NASA image each role keeps, and at what size.
ROLE_IMAGES = {
    'Foil': ('normal', 'foil_n.jpg', 512),
    'FoilPanels': ('normal', 'cassini_foil_n_2.jpg', 512),
    'DishWhite': ('base', 'cassini_dish_AO.jpg', 1024),
    'Detail': ('base', 'cassini_tex_01.jpg', 1024),
}
TEXTURE_QUALITY = 80

# Real RPWS antennas are 28.6 mm tubes, a fraction of a pixel at any framing
# that shows the whole craft; NASA draws them 30 mm wide and they are rebuilt
# here as round rods a little over twice that.
ANTENNA_RADIUS_ROOT, ANTENNA_RADIUS_TIP = 0.036, 0.022

# Where each callout attaches: a point in NASA's frame, snapped to the nearest
# vertex of the finished part.
HOTSPOT_TARGETS = {
    'HighGainAntenna': (1.5, -1.3, 2.3),
    'Bus': (1.1, -0.2, 0.75),
    'RemoteSensingPallet': (-1.75, -0.4, 0.3),
    'MagnetometerBoom': (0.31, 4.2, 1.2),
    'RTG': (0.0, -2.03, -2.3),
    'MainEngines': (0.18, -0.42, -3.2),
    'HuygensProbe': (1.85, 0.0, -1.1),
}


def classify(source, lo, hi):
    """Name the part an island of NASA's mesh belongs to, from its bounds."""
    cx, cy, cz = ((a + b) / 2 for a, b in zip(lo, hi))
    if source in ('foil_gold_h', 'huygens_strip'):
        return 'HuygensProbe'
    if source == 'dish':
        return 'HighGainAntenna'
    if source == 'foil_gold_2':
        return 'Bus'
    if source == 'aluminum' and max(h - l for l, h in zip(lo, hi)) > 5:
        return 'RPWSAntennas'
    if lo[1] > 0.7 and lo[2] > 0.89 and hi[2] < 1.46 and abs(cx) < 0.36 and hi[1] > 1.6:
        # The boom and the canister it unfolded from.
        return 'MagnetometerBoom'
    if lo[2] >= 1.39 and max(abs(lo[0]), abs(hi[0]), abs(lo[1]), abs(hi[1])) < 2.1:
        return 'HighGainAntenna'
    if hi[2] < -2.77 and abs(cx) < 0.3 and abs(cy) < 0.5:
        return 'MainEngines'
    if lo[2] > -2.6 and hi[2] < -1.7:
        for bearing in RTG_BEARINGS:
            ux, uy = math.cos(math.radians(bearing)), math.sin(math.radians(bearing))
            along, across = cx * ux + cy * uy, abs(cx * uy - cy * ux)
            if 0.3 < along < 2.2 and across < 0.3:
                return 'RTG'
    if cx < -1.05 and lo[2] > -1.1 and hi[2] < 1.2 and abs(cy) < 0.9:
        return 'RemoteSensingPallet'
    return 'Bus'


def make_material(role):
    color, metallic, roughness = MATERIALS[role]
    mat = bpy.data.materials.new(role)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if color:
        bsdf.inputs['Base Color'].default_value = color
    if role in ROLE_IMAGES:
        slot, image_name, size = ROLE_IMAGES[role]
        image = bpy.data.images[image_name]
        if image.size[0] > size:
            image.scale(size, size)
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        if slot == 'base':
            links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            image.colorspace_settings.name = 'Non-Color'
            bump = nodes.new('ShaderNodeNormalMap')
            bump.inputs['Strength'].default_value = 0.8
            links.new(tex.outputs['Color'], bump.inputs['Color'])
            links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def build_model(source_path):
    scene = kit.open_source(source_path)

    role_materials = {}
    antenna_ends = []

    def part_of(src, faces, points, lo, hi):
        part = classify(src.name, lo, hi)
        if part == 'RPWSAntennas':
            by_reach = sorted(points, key=lambda c: c.length)
            antenna_ends.append((sum(by_reach[:4], Vector()) / 4,
                                 sum(by_reach[-4:], Vector()) / 4))
            return None
        return part

    def material_for(old, part):
        role = ROLE_OF[old.name]
        if role not in role_materials:
            role_materials[role] = make_material(role)
        return role_materials[role]

    pieces = kit.split_by_island(scene, PARTS, part_of, material_for)

    # NASA's model is already at true size (the dish is 4.00 m across) with
    # its origin on the axis at mid-height of the stack.
    to_final = REORIENT.to_4x4()
    parts = kit.settle_parts(pieces, to_final)

    # Rods along the lines NASA drew, root to tip.
    antenna_ends.sort(key=lambda pair: -pair[1].x)
    placed = []
    for root, tip in antenna_ends:
        root, tip = to_final @ root, to_final @ tip
        placed.append((root, (tip - root).normalized(), (tip - root).length))
    parts['RPWSAntennas'] = kit.tapered_rods(
        'RPWSAntennas', placed, ANTENNA_RADIUS_ROOT, ANTENNA_RADIUS_TIP, make_material('Antenna'))

    hotspots = {part: kit.nearest_vertex(parts[part], to_final @ Vector(target))
                for part, target in HOTSPOT_TARGETS.items()}
    root, direction, length = placed[0]
    hotspots['RPWSAntennas'] = root + direction * length * 0.22
    for part in PARTS:
        kit.add_hotspot(part, hotspots[part])
    for (root, direction, length) in placed:
        print(f'ANTENNA length {length:.2f} m')
    return parts


def from_nasa(vector):
    """A direction or camera position given boresight-up, as NASA drew it."""
    return REORIENT @ Vector(vector)


def view(shot):
    position, target, up, *lens = shot
    return (from_nasa(position), from_nasa(target), from_nasa(up), *lens)


# name, direction the light travels (NASA frame), energy, colour, angular size
LAMPS = [
    ('Sun', (-0.7, 0.45, -0.55), 5.0, (1.0, 0.97, 0.92), 0.6),
    ('Fill', (-0.5, -0.6, 0.6), 0.25, (0.55, 0.7, 1.0), 20),
    ('Rim', (0.2, -0.8, 0.5), 0.8, (0.6, 0.75, 1.0), 4),
]

# position, target, up (NASA frame: +Z boresight, +Y magnetometer boom, +X
# Huygens), lens mm, shift x, shift y
SHOT_COVER = ((20.0, -17.0, 7.5), (0.0, 2.2, -0.3), (0, 0, 1), 50, -0.08, 0.0)
SHOT_POSTER = ((20.0, -17.0, 7.5), (0.0, 2.2, -0.3), (0, 0, 1), 50, -0.12, 0.04)
PREVIEW_SHOTS = {
    'whole': ((20, -16, 11), (0, 3.0, -0.5), (0, 0, 1), 35, 0, 0),
    'huygens': ((9, -3, 0.5), (0.5, 0, -0.6), (0, 0, 1), 50, 0, 0),
    'pallet': ((-8, -5, 1.5), (-0.5, 0, 0), (0, 0, 1), 50, 0, 0),
    'engines': ((4, -6, -7), (0, 0, -1.5), (0, 0, 1), 50, 0, 0),
    'dish': ((5, -5, 7), (0, 0, 1.5), (0, 0, 1), 50, 0, 0),
    'boom': ((7, 14, 6), (0, 5, 0.5), (0, 0, 1), 35, 0, 0),
}
PART_COLOURS = {
    'HighGainAntenna': (0.9, 0.9, 0.9), 'Bus': (0.9, 0.6, 0.1),
    'RemoteSensingPallet': (0.1, 0.8, 0.9), 'MagnetometerBoom': (0.2, 0.9, 0.2),
    'RPWSAntennas': (1.0, 0.2, 0.9), 'RTG': (0.9, 0.1, 0.1),
    'MainEngines': (0.2, 0.3, 1.0), 'HuygensProbe': (0.6, 0.3, 0.9),
}


def main():
    opts = kit.options(__doc__, 'cassini')
    parts = build_model(opts.source)
    if opts.glb:
        kit.export_glb(opts.out / 'cassini.glb', export_image_format='WEBP',
                       export_image_quality=TEXTURE_QUALITY, export_animations=False)

    scene = bpy.context.scene
    if opts.previews or opts.renders:
        lamps = [(name, from_nasa(toward), *rest) for name, toward, *rest in LAMPS]
        camera = kit.stage(scene, lamps, from_nasa((0, 0.3, 1)), sky_strength=0.25)
    if opts.renders:
        kit.render_finals(scene, camera, opts.out, view(SHOT_COVER), view(SHOT_POSTER), opts.samples, 1997)
    if opts.previews:
        opts.previews.mkdir(parents=True, exist_ok=True)
        if '--part-colours' in opts.flags:
            for part, colour in PART_COLOURS.items():
                flat = bpy.data.materials.new('Check' + part)
                flat.use_nodes = True
                flat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*colour, 1)
                parts[part].data.materials.clear()
                parts[part].data.materials.append(flat)
        for name, shot in PREVIEW_SHOTS.items():
            pixels = kit.render_still(scene, camera, view(shot), 1000, 700, 24, 1)
            kit.save_pixels(pixels, opts.previews / f'{name}.png', 'PNG')

    for part in PARTS:
        lo, hi = kit.bounds([v.co for v in parts[part].data.vertices])
        # Blender's (x, y, z) is glTF's (x, z, -y).
        print(f'PART {part}: {kit.triangles(parts[part])} triangles, glTF bounds '
              f'({lo[0]:.2f}, {lo[2]:.2f}, {-hi[1]:.2f}) to ({hi[0]:.2f}, {hi[2]:.2f}, {-lo[1]:.2f})')


main()
