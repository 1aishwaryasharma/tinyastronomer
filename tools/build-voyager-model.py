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

Needs Blender 5.x; `bunx` (for the gltf-transform Meshopt pass) on PATH.
Runs against the unmodified NASA file and is deterministic.
"""
import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'missions' / 'voyager-1'
GLTF_TRANSFORM = '@gltf-transform/cli@4.2.1'

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


def islands(bm):
    """Group faces into connected pieces, welding coincident vertices."""
    parent = {}

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    key_of = {}
    for v in bm.verts:
        key = (round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))
        key_of[v.index] = key
        parent.setdefault(key, key)
    for f in bm.faces:
        first = find(key_of[f.verts[0].index])
        for v in f.verts[1:]:
            parent[find(key_of[v.index])] = first
    groups = {}
    for f in bm.faces:
        groups.setdefault(find(key_of[f.verts[0].index]), []).append(f)
    return list(groups.values())


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


def join(objects, name):
    with bpy.context.temp_override(active_object=objects[0], object=objects[0],
                                   selected_objects=objects,
                                   selected_editable_objects=objects):
        bpy.ops.object.join()
    objects[0].name = name
    objects[0].data.name = name
    return objects[0]


def apply_transform(obj):
    with bpy.context.temp_override(active_object=obj, object=obj,
                                   selected_objects=[obj],
                                   selected_editable_objects=[obj]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def build_whips(roots, tips, to_final):
    """Two tapered rods from NASA's root points, in the plane NASA drew them."""
    root_l, root_r = (to_final @ r for r in roots)
    dir_l, dir_r = ((to_final @ t - r).normalized()
                    for t, r in zip(tips, (root_l, root_r)))
    bisector = (dir_l + dir_r).normalized()
    across = (dir_r - dir_l).normalized()
    bm = bmesh.new()
    ends = []
    for root, sign in ((root_l, -1), (root_r, 1)):
        direction = (bisector * math.cos(WHIP_ANGLE / 2)
                     + across * sign * math.sin(WHIP_ANGLE / 2))
        made = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8, radius1=WHIP_RADIUS_ROOT,
            radius2=WHIP_RADIUS_TIP, depth=WHIP_LENGTH)
        place = (Matrix.Translation(root + direction * WHIP_LENGTH / 2)
                 @ Vector((0, 0, 1)).rotation_difference(direction).to_matrix().to_4x4())
        bmesh.ops.transform(bm, matrix=place, verts=made['verts'])
        ends.append((root, direction))
    for f in bm.faces:
        f.smooth = True
    mesh = bpy.data.meshes.new('PlasmaWaveAntennas')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(make_material('WhipAntenna', color=WHIP_COLOR, pbr=WHIP_PBR))
    obj = bpy.data.objects.new('PlasmaWaveAntennas', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, ends


def build_model(source_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    scene = bpy.context.scene

    for image in bpy.data.images:
        stem = image.name.replace('voyager_', '').split('.')[0]
        size = TEXTURE_SIZES.get(stem)
        if size and image.size[0] > size:
            image.scale(size, size)

    role_materials = {}
    pieces = {part: [] for part in PARTS}
    whip_roots, whip_tips = [], []
    dish_bounds = None
    sources = [o for o in scene.objects if o.type == 'MESH' and o.name != '_root']
    for src in sources:
        world = src.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(src.data)
        bm.faces.ensure_lookup_table()
        part_of_face = {}
        for faces in islands(bm):
            if src.data.materials[faces[0].material_index].name == 'brass':
                # NASA's whips are 4.7 m long and 108 degrees apart; keep
                # only where they attach and which way they lean.
                xs = sorted((world @ v.co for f in faces for v in f.verts),
                            key=lambda c: abs(c.x))
                whip_roots.append(sum(xs[:4], Vector()) / 4)
                whip_tips.append(sum(xs[-4:], Vector()) / 4)
                continue
            points = [world @ v.co for f in faces for v in f.verts]
            lo = [min(p[i] for p in points) for i in range(3)]
            hi = [max(p[i] for p in points) for i in range(3)]
            part = classify(src.name, lo, hi)
            if src.name == 'tex_02_AO' and hi[0] - lo[0] > 3:
                dish_bounds = (lo, hi)
            for f in faces:
                part_of_face[f.index] = part
        bm.free()

        for part in PARTS:
            if part not in part_of_face.values():
                continue
            piece = src.copy()
            piece.data = src.data.copy()
            scene.collection.objects.link(piece)
            piece.parent = None
            piece.matrix_world = world
            bm = bmesh.new()
            bm.from_mesh(piece.data)
            doomed = [f for f in bm.faces if part_of_face.get(f.index) != part]
            bmesh.ops.delete(bm, geom=doomed, context='FACES')
            bm.to_mesh(piece.data)
            bm.free()
            for i, old in enumerate(piece.data.materials):
                role = material_role(old.name, part)
                if role not in role_materials:
                    role_materials[role] = make_material(role, source_image(old))
                piece.data.materials[i] = role_materials[role]
            pieces[part].append(piece)

    for obj in list(scene.objects):
        if not any(obj in group for group in pieces.values()):
            bpy.data.objects.remove(obj)

    lo, hi = dish_bounds
    scale = DISH_DIAMETER / (hi[0] - lo[0])
    bus_centre = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, BUS_MID_Z))
    to_final = (REORIENT.to_4x4() @ Matrix.Scale(scale, 4)
                @ Matrix.Translation(-bus_centre))

    parts = {}
    for part, group in pieces.items():
        if not group:
            continue
        obj = join(group, part) if len(group) > 1 else group[0]
        obj.name = obj.data.name = part
        obj.matrix_world = to_final @ obj.matrix_world
        apply_transform(obj)
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.material_slot_remove_unused()
        parts[part] = obj

    whip_roots.sort(key=lambda c: c.x)
    whip_tips.sort(key=lambda c: c.x)
    parts['PlasmaWaveAntennas'], whip_ends = build_whips(whip_roots, whip_tips, to_final)

    hotspots = {}
    for part, target in HOTSPOT_TARGETS.items():
        goal = to_final @ Vector(target)
        hotspots[part] = min((v.co for v in parts[part].data.vertices),
                             key=lambda c: (c - goal).length_squared).copy()
    record = parts['GoldenRecord'].data.vertices
    centre = sum((v.co for v in record), Vector()) / len(record)
    outward = (REORIENT @ Vector((1, 0, 0)))
    hotspots['GoldenRecord'] = centre + outward * 0.01
    root, direction = whip_ends[1]
    hotspots['PlasmaWaveAntennas'] = root + direction * WHIP_LENGTH * 0.3
    for part in PARTS:
        empty = bpy.data.objects.new('Hotspot_' + part, None)
        empty.empty_display_size = 0.1
        empty.location = hotspots[part]
        scene.collection.objects.link(empty)
    return parts


def export_glb(target):
    raw = Path(tempfile.mkdtemp(prefix='voyager-glb-')) / 'voyager-raw.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(raw), export_format='GLB', export_yup=True,
        export_apply=False, export_image_format='WEBP',
        export_image_quality=TEXTURE_QUALITY, export_cameras=False,
        export_lights=False, export_animations=False, export_extras=False,
        export_tangents=False, export_vertex_color='NONE')
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['bunx', GLTF_TRANSFORM, 'meshopt', str(raw), str(target),
                    '--level', 'medium'], check=True)
    shutil.rmtree(raw.parent)


def look_at(obj, position, target, up):
    forward = (Vector(target) - Vector(position)).normalized()
    right = forward.cross(Vector(up)).normalized()
    true_up = right.cross(forward)
    obj.matrix_world = Matrix.Translation(position) @ Matrix(
        (right, true_up, -forward)).transposed().to_4x4()


def from_nasa(vector):
    """A direction or camera position given boresight-up, as NASA drew it."""
    return REORIENT @ Vector(vector)


def setup_lighting(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.use_denoising = True
    scene.cycles.use_adaptive_sampling = True
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    world = bpy.data.worlds.new('Space')
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (0.02, 0.03, 0.06, 1)
    background.inputs['Strength'].default_value = 0.25
    scene.world = world

    def sun(name, toward, energy, color, angle):
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        light.color = color
        light.angle = math.radians(angle)
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        look_at(obj, from_nasa(toward) * -1, (0, 0, 0), from_nasa((0, 0.3, 1)))
        return obj

    # `toward` is the direction the light travels, in NASA's frame.
    sun('Sun', (-0.75, -0.25, -0.6), 5.5, (1.0, 0.97, 0.92), 0.6)
    sun('Fill', (0.6, -0.5, 0.6), 0.22, (0.55, 0.7, 1.0), 20)
    sun('Rim', (0.75, -0.1, 0.65), 0.9, (0.6, 0.75, 1.0), 4)


def star_field(width, height, seed):
    rng = random.Random(seed)
    sky = np.empty((height, width, 3), dtype=np.float32)
    sky[:] = np.array([0x05, 0x08, 0x10], dtype=np.float32) / 255
    ys, xs = np.mgrid[0:height, 0:width]
    for _ in range(int(width * height / 3200)):
        x, y = rng.uniform(0, width), rng.uniform(0, height)
        brightness = 0.12 + 0.88 * rng.random() ** 4
        radius = (0.55 + 1.0 * brightness) * width / 1200
        tint = rng.choice(((1.0, 0.96, 0.9), (0.86, 0.92, 1.0), (1.0, 1.0, 1.0)))
        x0, x1 = max(0, int(x - 6)), min(width, int(x + 7))
        y0, y1 = max(0, int(y - 6)), min(height, int(y + 7))
        glow = np.exp(-((xs[y0:y1, x0:x1] - x) ** 2 + (ys[y0:y1, x0:x1] - y) ** 2)
                      / (2 * radius * radius)) * brightness
        sky[y0:y1, x0:x1] += glow[..., None] * np.array(tint, dtype=np.float32)
    return np.clip(sky, 0, 1)


def save_pixels(pixels, path, file_format, quality=90):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new('still', width, height, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[..., :3] = pixels
    image.pixels.foreach_set(rgba.ravel())
    image.file_format = file_format
    image.filepath_raw = str(path)
    image.save(quality=quality)
    bpy.data.images.remove(image)


def halve(pixels):
    h, w = pixels.shape[0] // 2, pixels.shape[1] // 2
    return pixels[:h * 2, :w * 2].reshape(h, 2, w, 2, 3).mean(axis=(1, 3))


def render_still(scene, camera, shot, width, height, samples, seed):
    """Render the craft over the star field; returns bottom-up sRGB pixels."""
    position, target, up, lens, shift_x, shift_y = shot
    look_at(camera, from_nasa(position), from_nasa(target), from_nasa(up))
    camera.data.lens = lens
    camera.data.shift_x, camera.data.shift_y = shift_x, shift_y
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    path = Path(tempfile.mkdtemp(prefix='voyager-still-')) / 'craft.png'
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path))
    image.colorspace_settings.name = 'Non-Color'
    image.alpha_mode = 'CHANNEL_PACKED'
    craft = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(craft)
    craft = craft.reshape(height, width, 4)
    bpy.data.images.remove(image)
    shutil.rmtree(path.parent)
    alpha = craft[..., 3:4]
    return craft[..., :3] * alpha + star_field(width, height, seed) * (1 - alpha)


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
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args or args[0].startswith('--'):
        sys.exit(__doc__)
    source = Path(args[0]).resolve()
    samples = int(args[args.index('--samples') + 1]) if '--samples' in args else 160
    previews = Path(args[args.index('--previews') + 1]) if '--previews' in args else None

    parts = build_model(source)
    if '--no-glb' not in args:
        export_glb(OUT / 'voyager.glb')

    scene = bpy.context.scene
    if previews or '--no-renders' not in args:
        setup_lighting(scene)
        camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
        camera.data.sensor_width = 36
        camera.data.clip_end = 500
        scene.collection.objects.link(camera)
        scene.camera = camera
        for empty in [o for o in scene.objects if o.type == 'EMPTY']:
            empty.hide_render = True
    if previews:
        previews.mkdir(parents=True, exist_ok=True)
        for name, shot in PREVIEW_SHOTS.items():
            pixels = render_still(scene, camera, shot, 1000, 700, 24, 1)
            save_pixels(pixels, previews / f'{name}.png', 'PNG')
    if '--no-renders' not in args:
        cover = render_still(scene, camera, SHOT_COVER, 1200, 630, samples, 1977)
        save_pixels(cover, OUT / 'og-cover.png', 'PNG')
        poster = render_still(scene, camera, SHOT_POSTER, 1600, 1000, samples, 1977)
        save_pixels(poster, OUT / 'poster.webp', 'WEBP', quality=82)
        save_pixels(halve(poster), OUT / 'poster-800.webp', 'WEBP', quality=84)

    for part in PARTS:
        mesh = parts[part].data
        mesh.calc_loop_triangles()
        print(f'PART {part}: {len(mesh.loop_triangles)} triangles')


main()
