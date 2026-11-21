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
OUT = ROOT / 'public' / 'assets' / 'missions' / 'cassini'
GLTF_TRANSFORM = '@gltf-transform/cli@4.2.1'

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


def build_antennas(ends, to_final):
    """Three tapered rods along the lines NASA drew, root to tip."""
    bm = bmesh.new()
    placed = []
    for root, tip in ends:
        root, tip = to_final @ root, to_final @ tip
        length = (tip - root).length
        direction = (tip - root).normalized()
        made = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8, radius1=ANTENNA_RADIUS_ROOT,
            radius2=ANTENNA_RADIUS_TIP, depth=length)
        place = (Matrix.Translation(root + direction * length / 2)
                 @ Vector((0, 0, 1)).rotation_difference(direction).to_matrix().to_4x4())
        bmesh.ops.transform(bm, matrix=place, verts=made['verts'])
        placed.append((root, direction, length))
    for f in bm.faces:
        f.smooth = True
    mesh = bpy.data.meshes.new('RPWSAntennas')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(make_material('Antenna'))
    obj = bpy.data.objects.new('RPWSAntennas', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, placed


def build_model(source_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    scene = bpy.context.scene

    role_materials = {}
    pieces = {part: [] for part in PARTS}
    antenna_ends = []
    sources = [o for o in scene.objects if o.type == 'MESH' and o.name != '_root']
    for src in sources:
        world = src.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(src.data)
        bm.faces.ensure_lookup_table()
        part_of_face = {}
        for faces in islands(bm):
            points = [world @ v.co for f in faces for v in f.verts]
            lo = [min(p[i] for p in points) for i in range(3)]
            hi = [max(p[i] for p in points) for i in range(3)]
            part = classify(src.name, lo, hi)
            if part == 'RPWSAntennas':
                by_reach = sorted(points, key=lambda c: c.length)
                antenna_ends.append((sum(by_reach[:4], Vector()) / 4,
                                     sum(by_reach[-4:], Vector()) / 4))
                continue
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
                role = ROLE_OF[old.name]
                if role not in role_materials:
                    role_materials[role] = make_material(role)
                piece.data.materials[i] = role_materials[role]
            pieces[part].append(piece)

    for obj in list(scene.objects):
        if not any(obj in group for group in pieces.values()):
            bpy.data.objects.remove(obj)

    # NASA's model is already at true size (the dish is 4.00 m across) with
    # its origin on the axis at mid-height of the stack.
    to_final = REORIENT.to_4x4()

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

    antenna_ends.sort(key=lambda pair: -pair[1].x)
    parts['RPWSAntennas'], placed = build_antennas(antenna_ends, to_final)

    hotspots = {}
    for part, target in HOTSPOT_TARGETS.items():
        goal = to_final @ Vector(target)
        hotspots[part] = min((v.co for v in parts[part].data.vertices),
                             key=lambda c: (c - goal).length_squared).copy()
    root, direction, length = placed[0]
    hotspots['RPWSAntennas'] = root + direction * length * 0.22
    for part in PARTS:
        empty = bpy.data.objects.new('Hotspot_' + part, None)
        empty.empty_display_size = 0.1
        empty.location = hotspots[part]
        scene.collection.objects.link(empty)
    for (root, direction, length) in placed:
        print(f'ANTENNA length {length:.2f} m')
    return parts


def export_glb(target):
    raw = Path(tempfile.mkdtemp(prefix='cassini-glb-')) / 'cassini-raw.glb'
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
    sun('Sun', (-0.7, 0.45, -0.55), 5.0, (1.0, 0.97, 0.92), 0.6)
    sun('Fill', (-0.5, -0.6, 0.6), 0.25, (0.55, 0.7, 1.0), 20)
    sun('Rim', (0.2, -0.8, 0.5), 0.8, (0.6, 0.75, 1.0), 4)


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
    path = Path(tempfile.mkdtemp(prefix='cassini-still-')) / 'craft.png'
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
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args or args[0].startswith('--'):
        sys.exit(__doc__)
    source = Path(args[0]).resolve()
    samples = int(args[args.index('--samples') + 1]) if '--samples' in args else 160
    previews = Path(args[args.index('--previews') + 1]) if '--previews' in args else None

    parts = build_model(source)
    if '--no-glb' not in args:
        export_glb(OUT / 'cassini.glb')

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
    if '--no-renders' not in args:
        cover = render_still(scene, camera, SHOT_COVER, 1200, 630, samples, 1997)
        save_pixels(cover, OUT / 'og-cover.png', 'PNG')
        poster = render_still(scene, camera, SHOT_POSTER, 1600, 1000, samples, 1997)
        save_pixels(poster, OUT / 'poster.webp', 'WEBP', quality=82)
        save_pixels(halve(poster), OUT / 'poster-800.webp', 'WEBP', quality=84)
    if previews:
        previews.mkdir(parents=True, exist_ok=True)
        if '--part-colours' in args:
            for part, colour in PART_COLOURS.items():
                flat = bpy.data.materials.new('Check' + part)
                flat.use_nodes = True
                flat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*colour, 1)
                parts[part].data.materials.clear()
                parts[part].data.materials.append(flat)
        for name, shot in PREVIEW_SHOTS.items():
            pixels = render_still(scene, camera, shot, 1000, 700, 24, 1)
            save_pixels(pixels, previews / f'{name}.png', 'PNG')

    for part in PARTS:
        mesh = parts[part].data
        mesh.calc_loop_triangles()
        points = [v.co for v in mesh.vertices]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        # Blender's (x, y, z) is glTF's (x, z, -y).
        print(f'PART {part}: {len(mesh.loop_triangles)} triangles, glTF bounds '
              f'({lo[0]:.2f}, {lo[2]:.2f}, {-hi[1]:.2f}) to ({hi[0]:.2f}, {hi[2]:.2f}, {-lo[1]:.2f})')


main()
