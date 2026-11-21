"""Build the Voyager 1 deep-dive spacecraft model and its hero stills.

Imports NASA's own Voyager model (NASA Science / VTAD, see
public/assets/missions/voyager-1/README.md for the download link), splits its
fused meshes into the named parts the page highlights, rebuilds the two whip
antennas at their true 10 m length, adds label anchors, re-orients and scales
the craft to the page contract, exports a web-sized GLB, and renders the
social card and poster in Cycles.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/build-voyager-model.py -- /path/to/Voyager.glb

Options after the source path:
    --no-renders        export the GLB only
    --no-glb            render only
    --previews DIR      also write low-sample check renders from several angles
    --samples N         Cycles samples for the finals (default 160)
    --out DIR           write there instead of public/assets/missions/voyager-1

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
    'HighGainAntenna', 'LowGainAntenna', 'Bus', 'GoldenRecord', 'RTG',
    'ScienceBoom', 'ScanPlatform', 'MagnetometerBoom', 'PlasmaWaveAntennas',
]

# Published dimensions the NASA mesh is checked against or corrected to.
DISH_DIAMETER = 3.7
WHIP_LENGTH = 10.0
WHIP_ANGLE = math.radians(90)
# Real whips are 12.7 mm tubes; that is a fraction of a pixel at any framing
# that shows the whole craft, so they are drawn about twice as thick.
WHIP_RADIUS_ROOT, WHIP_RADIUS_TIP = 0.015, 0.009

# NASA's file has the dish boresight on Blender +Z, the science boom on +Y and
# the RTG boom on -Y. The page wants boresight on glTF +Z (Blender -Y), the
# science boom on +X and the RTG boom on -X.
REORIENT = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0)))
# Height of the middle of the ten-sided bus in NASA's frame (its side panels
# run from z = -0.17 to z = 0.20); the dish axis gives the other two.
BUS_MID_Z = 0.015

# metallic, roughness per material. No environment map on the page, so nothing
# is a mirror: metals stay partly dielectric and fairly rough.
MATERIALS = {
    'DishWhite': (0.0, 0.6),
    'DishStructure': (0.1, 0.6),
    'Blanket': (0.1, 0.65),
    'Instruments': (0.2, 0.55),
    'BoomMetal': (0.45, 0.45),
    'RTG': (0.35, 0.5),
    'GoldenRecord': (0.7, 0.42),
}
WHIP_COLOR = (0.78, 0.56, 0.24, 1.0)
WHIP_PBR = (0.6, 0.45)
TEXTURE_SIZES = {'tex_01': 1024, 'tex_02_AO': 512, 'tex_02_AO_other': 512}
TEXTURE_QUALITY = 80

# Where each callout line attaches: a point in NASA's frame, snapped to the
# nearest vertex of the finished part.
HOTSPOT_TARGETS = {
    'HighGainAntenna': (1.0, -0.9, 1.3),
    'LowGainAntenna': (0.0, 0.0, 2.4),
    'Bus': (-0.75, -0.75, 0.05),
    'RTG': (0.25, -3.55, 0.2),
    'ScienceBoom': (0.0, 2.3, 1.25),
    'ScanPlatform': (0.4, 3.9, -0.15),
    'MagnetometerBoom': (0.0, -5.6, 3.8),
}


def classify(source, bb_min, bb_max):
    """Name the part an island of NASA's mesh belongs to, from its bounds."""
    cx, cy, cz = ((a + b) / 2 for a, b in zip(bb_min, bb_max))
    reach = max(abs(bb_min[0]), abs(bb_max[0]), abs(bb_min[1]), abs(bb_max[1]))
    if source == 'tex_02_AO':
        return 'LowGainAntenna' if bb_min[2] > 2.25 else 'HighGainAntenna'
    if source == 'tex_02_AO_dark':
        return 'HighGainAntenna'
    if bb_min[2] >= 1.95 and reach < 0.15:
        return 'LowGainAntenna'
    if cz > 0.95 and reach < 0.5:
        return 'HighGainAntenna'
    if bb_min[2] > 0.8 and reach > 1.0 and abs(cy) < 0.5:
        # The Sun sensor looks out through a hole in the dish.
        return 'HighGainAntenna'
    if cy < -0.95:
        # The magnetometer boom leaves its canister above the RTG truss and
        # climbs away from it.
        above = 0.42 + max(0.0, -cy - 1.5) * 0.6
        return 'MagnetometerBoom' if cz > above else 'RTG'
    if cy > 0.85 and bb_max[1] > 1.0:
        truss = (bb_min[0] > -0.115 and bb_max[0] < 0.105
                 and bb_min[2] > 0.73 and bb_max[2] < 0.94 and bb_max[1] < 3.33)
        return 'ScanPlatform' if cy > 3.1 and not truss else 'ScienceBoom'
    if (bb_min[0] > 0.93 and bb_max[0] - bb_min[0] < 0.03
            and abs(cy) < 0.05 and abs(cz) < 0.05):
        return 'GoldenRecord'
    return 'Bus'


def material_role(source_material, part):
    if source_material == 'tex_02_AO':
        return 'DishWhite'
    if source_material == 'tex_02_AO_other':
        return 'DishStructure'
    return {
        'Bus': 'Blanket',
        'GoldenRecord': 'GoldenRecord',
        'RTG': 'RTG',
        'ScienceBoom': 'BoomMetal',
        'MagnetometerBoom': 'BoomMetal',
    }.get(part, 'Instruments')


def source_image(material):
    for node in material.node_tree.nodes:
        if node.type == 'TEX_IMAGE':
            return node.image
    return None


def make_material(name, image=None, color=None, pbr=None):
    metallic, roughness = pbr or MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if color:
        bsdf.inputs['Base Color'].default_value = color
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def whip_rods(roots, tips, to_final):
    """The two whips from NASA's root points, in the plane NASA drew them."""
    root_l, root_r = (to_final @ r for r in roots)
    dir_l, dir_r = ((to_final @ t - r).normalized()
                    for t, r in zip(tips, (root_l, root_r)))
    bisector = (dir_l + dir_r).normalized()
    across = (dir_r - dir_l).normalized()
    return [(root, bisector * math.cos(WHIP_ANGLE / 2) + across * sign * math.sin(WHIP_ANGLE / 2), WHIP_LENGTH)
            for root, sign in ((root_l, -1), (root_r, 1))]


def build_model(source_path):
    scene = kit.open_source(source_path)

    for image in bpy.data.images:
        stem = image.name.replace('voyager_', '').split('.')[0]
        size = TEXTURE_SIZES.get(stem)
        if size and image.size[0] > size:
            image.scale(size, size)

    role_materials = {}
    whip_roots, whip_tips = [], []
    dish = {}

    def part_of(src, faces, points, lo, hi):
        if src.data.materials[faces[0].material_index].name == 'brass':
            # NASA's whips are 4.7 m long and 108 degrees apart; keep only
            # where they attach and which way they lean.
            xs = sorted(points, key=lambda c: abs(c.x))
            whip_roots.append(sum(xs[:4], Vector()) / 4)
            whip_tips.append(sum(xs[-4:], Vector()) / 4)
            return None
        if src.name == 'tex_02_AO' and hi[0] - lo[0] > 3:
            dish['lo'], dish['hi'] = lo, hi
        return classify(src.name, lo, hi)

    def material_for(old, part):
        role = material_role(old.name, part)
        if role not in role_materials:
            role_materials[role] = make_material(role, source_image(old))
        return role_materials[role]

    pieces = kit.split_by_island(scene, PARTS, part_of, material_for)

    lo, hi = dish['lo'], dish['hi']
    scale = DISH_DIAMETER / (hi[0] - lo[0])
    bus_centre = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, BUS_MID_Z))
    to_final = (REORIENT.to_4x4() @ Matrix.Scale(scale, 4)
                @ Matrix.Translation(-bus_centre))
    parts = kit.settle_parts(pieces, to_final)

    whip_roots.sort(key=lambda c: c.x)
    whip_tips.sort(key=lambda c: c.x)
    whips = whip_rods(whip_roots, whip_tips, to_final)
    parts['PlasmaWaveAntennas'] = kit.tapered_rods(
        'PlasmaWaveAntennas', whips, WHIP_RADIUS_ROOT, WHIP_RADIUS_TIP,
        make_material('WhipAntenna', color=WHIP_COLOR, pbr=WHIP_PBR))

    hotspots = {part: kit.nearest_vertex(parts[part], to_final @ Vector(target))
                for part, target in HOTSPOT_TARGETS.items()}
    record = parts['GoldenRecord'].data.vertices
    centre = sum((v.co for v in record), Vector()) / len(record)
    outward = (REORIENT @ Vector((1, 0, 0)))
    hotspots['GoldenRecord'] = centre + outward * 0.01
    root, direction, length = whips[1]
    hotspots['PlasmaWaveAntennas'] = root + direction * length * 0.3
    for part in PARTS:
        kit.add_hotspot(part, hotspots[part])
    return parts


def from_nasa(vector):
    """A direction or camera position given boresight-up, as NASA drew it."""
    return REORIENT @ Vector(vector)


def view(shot):
    position, target, up, *lens = shot
    return (from_nasa(position), from_nasa(target), from_nasa(up), *lens)


# name, direction the light travels (NASA frame), energy, colour, angular size
LAMPS = [
    ('Sun', (-0.75, -0.25, -0.6), 5.5, (1.0, 0.97, 0.92), 0.6),
    ('Fill', (0.6, -0.5, 0.6), 0.22, (0.55, 0.7, 1.0), 20),
    ('Rim', (0.75, -0.1, 0.65), 0.9, (0.6, 0.75, 1.0), 4),
]

# position, target, up (NASA frame: +Z boresight, +Y science boom, -Y RTG and
# magnetometer booms), lens mm, shift x, shift y
SHOT_COVER = ((12.1, 11.0, 5.5), (0.0, -0.6, 0.6), (0, 0, 1), 50, -0.12, 0.0)
SHOT_POSTER = ((12.1, 11.0, 5.5), (0.0, -0.6, 0.6), (0, 0, 1), 50, -0.05, 0.03)
PREVIEW_SHOTS = {
    'whole': ((17, 13, 12), (0, -3.5, 2.0), (0, 0, 1), 35, 0, 0),
    'dish': ((4, 3.5, 5.5), (0, 0, 0.8), (0, 0, 1), 50, 0, 0),
    'record': ((5.5, -3.0, 0.9), (0, 0, 0.4), (0, 0, 1), 50, 0, 0),
    'scan': ((3.5, 7.5, 1.5), (0, 2.4, 0.5), (0, 0, 1), 50, 0, 0),
    'rtg': ((-4.5, -7.5, 2.5), (0, -2.6, 0.4), (0, 0, 1), 50, 0, 0),
    'below': ((-9, 9, -9), (0, -2, 0.5), (0, 0, 1), 35, 0, 0),
}


def main():
    opts = kit.options(__doc__, 'voyager-1')
    parts = build_model(opts.source)
    if opts.glb:
        kit.export_glb(opts.out / 'voyager.glb', export_image_format='WEBP',
                       export_image_quality=TEXTURE_QUALITY, export_animations=False)

    scene = bpy.context.scene
    if opts.previews or opts.renders:
        lamps = [(name, from_nasa(toward), *rest) for name, toward, *rest in LAMPS]
        camera = kit.stage(scene, lamps, from_nasa((0, 0.3, 1)), sky_strength=0.25)
    if opts.previews:
        opts.previews.mkdir(parents=True, exist_ok=True)
        for name, shot in PREVIEW_SHOTS.items():
            pixels = kit.render_still(scene, camera, view(shot), 1000, 700, 24, 1)
            kit.save_pixels(pixels, opts.previews / f'{name}.png', 'PNG')
    if opts.renders:
        kit.render_finals(scene, camera, opts.out, view(SHOT_COVER), view(SHOT_POSTER), opts.samples, 1977)

    for part in PARTS:
        print(f'PART {part}: {kit.triangles(parts[part])} triangles')


main()
