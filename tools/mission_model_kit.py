"""What the build-*-model.py scripts share: reading the command line, loading
NASA's file, splitting meshes into named parts, label anchors, the GLB export
with its Meshopt pass, and the Cycles stills.

Not run on its own. Each script puts this folder on sys.path and imports it.
"""
import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

MISSIONS = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'missions'
GLTF_TRANSFORM = '@gltf-transform/cli@4.2.1'


def options(usage, mission):
    """The arguments after `--`; `usage` is printed when the source is missing."""
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args or args[0].startswith('--'):
        sys.exit(usage)

    def value(flag, default=None):
        return args[args.index(flag) + 1] if flag in args else default

    previews = value('--previews')
    return SimpleNamespace(
        source=Path(args[0]).resolve(),
        out=Path(value('--out', MISSIONS / mission)).resolve(),
        glb='--no-glb' not in args,
        renders='--no-renders' not in args,
        previews=Path(previews) if previews else None,
        samples=int(value('--samples', 160)),
        flags=args)


def open_source(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return bpy.context.scene


def override(obj, others=None):
    objects = others or [obj]
    return bpy.context.temp_override(active_object=obj, object=obj, selected_objects=objects,
                                     selected_editable_objects=objects)


def join(objects, name):
    if len(objects) > 1:
        with override(objects[0], objects):
            bpy.ops.object.join()
    objects[0].name = objects[0].data.name = name
    return objects[0]


def drop_unused_slots(obj):
    with override(obj):
        bpy.ops.object.material_slot_remove_unused()


def bounds(points):
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


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


def split_by_island(scene, part_names, part_of, material_for):
    """Sort the connected pieces of every imported mesh into parts.

    `part_of(src, faces, points, lo, hi)` names the part an island belongs to
    from its world-space points and bounds, or returns None to leave it out.
    `material_for(old, part)` gives the material that replaces one of NASA's.
    Returns {part: [objects]}; everything else is removed from the scene.
    """
    pieces = {part: [] for part in part_names}
    # NASA's VTAD exports carry a transparent helper cube, `_root`.
    for src in [o for o in scene.objects if o.type == 'MESH' and o.name != '_root']:
        world = src.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(src.data)
        bm.faces.ensure_lookup_table()
        part_of_face = {}
        for faces in islands(bm):
            points = [world @ v.co for f in faces for v in f.verts]
            part = part_of(src, faces, points, *bounds(points))
            if part:
                for f in faces:
                    part_of_face[f.index] = part
        bm.free()

        for part in part_names:
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
                piece.data.materials[i] = material_for(old, part)
            pieces[part].append(piece)

    for obj in list(scene.objects):
        if not any(obj in group for group in pieces.values()):
            bpy.data.objects.remove(obj)
    return pieces


def settle_parts(pieces, to_final):
    """One mesh per part, moved by `to_final` with the move baked in."""
    parts = {}
    for part, group in pieces.items():
        if not group:
            continue
        obj = join(group, part)
        obj.matrix_world = to_final @ obj.matrix_world
        with override(obj):
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        drop_unused_slots(obj)
        parts[part] = obj
    return parts


def nearest_vertex(obj, goal):
    return min((v.co for v in obj.data.vertices), key=lambda c: (c - goal).length_squared).copy()


def add_hotspot(part, location, parent=None):
    empty = bpy.data.objects.new('Hotspot_' + part, None)
    empty.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(empty)
    empty.parent = parent
    empty.location = location


def tapered_rods(name, rods, radius_root, radius_tip, material):
    """One mesh of round rods, each given as (root, unit direction, length)."""
    bm = bmesh.new()
    for root, direction, length in rods:
        made = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8, radius1=radius_root,
            radius2=radius_tip, depth=length)
        place = (Matrix.Translation(root + direction * length / 2)
                 @ Vector((0, 0, 1)).rotation_difference(direction).to_matrix().to_4x4())
        bmesh.ops.transform(bm, matrix=place, verts=made['verts'])
    for f in bm.faces:
        f.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def export_glb(target, **settings):
    """Export the scene and pack it; `settings` are extra glTF exporter options."""
    raw = Path(tempfile.mkdtemp(prefix='mission-glb-')) / 'raw.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(raw), export_format='GLB', export_yup=True,
        export_apply=False, export_cameras=False, export_lights=False,
        export_extras=False, export_tangents=False, export_vertex_color='NONE',
        **settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['bunx', GLTF_TRANSFORM, 'meshopt', str(raw), str(target),
                    '--level', 'medium'], check=True)
    print(f'RAW {raw.stat().st_size} bytes, PACKED {target.stat().st_size} bytes')
    shutil.rmtree(raw.parent)


def look_at(obj, position, target, up):
    forward = (Vector(target) - Vector(position)).normalized()
    right = forward.cross(Vector(up)).normalized()
    true_up = right.cross(forward)
    obj.matrix_world = Matrix.Translation(position) @ Matrix(
        (right, true_up, -forward)).transposed().to_4x4()


def stage(scene, lamps, lamp_up, sky_strength):
    """Set the scene up for stills and return its camera.

    `lamps` are (name, direction the light travels, energy, colour, angular
    size in degrees), all Sun lamps, in Blender's frame.
    """
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
    background.inputs['Strength'].default_value = sky_strength
    scene.world = world

    for name, toward, energy, color, angle in lamps:
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        light.color = color
        light.angle = math.radians(angle)
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        look_at(obj, toward * -1, (0, 0, 0), lamp_up)

    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    camera.data.sensor_width = 36
    camera.data.clip_end = 500
    scene.collection.objects.link(camera)
    scene.camera = camera
    for empty in [o for o in scene.objects if o.type == 'EMPTY']:
        empty.hide_render = True
    return camera


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


def render_still(scene, camera, view, width, height, samples, seed):
    """Render the craft over the star field; returns bottom-up sRGB pixels.

    `view` is (position, target, up, lens mm, shift x, shift y) in Blender's
    frame.
    """
    position, target, up, lens, shift_x, shift_y = view
    look_at(camera, position, target, up)
    camera.data.lens = lens
    camera.data.shift_x, camera.data.shift_y = shift_x, shift_y
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    path = Path(tempfile.mkdtemp(prefix='mission-still-')) / 'craft.png'
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


def render_finals(scene, camera, out, cover, poster, samples, seed):
    """The social card and the poster at both sizes, from two views."""
    out.mkdir(parents=True, exist_ok=True)
    save_pixels(render_still(scene, camera, cover, 1200, 630, samples, seed), out / 'og-cover.png', 'PNG')
    pixels = render_still(scene, camera, poster, 1600, 1000, samples, seed)
    save_pixels(pixels, out / 'poster.webp', 'WEBP', quality=82)
    h, w = pixels.shape[0] // 2, pixels.shape[1] // 2
    half = pixels[:h * 2, :w * 2].reshape(h, 2, w, 2, 3).mean(axis=(1, 3))
    save_pixels(half, out / 'poster-800.webp', 'WEBP', quality=84)
