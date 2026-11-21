"""Build the Webb deep-dive telescope model, its unfolding clip and hero stills.

Imports NASA's own James Webb Space Telescope model (NASA Science 3D
Resources, see public/assets/missions/webb/README.md for the download link),
sorts its 1,600 meshes into the named parts the page highlights, drops the
fasteners and wiring, thins what is left to a phone-sized triangle count,
gives it materials that read under one hard light, hangs the moving parts on
pivot nodes, keys the simplified launch-to-unfolded sequence as one glTF
animation, exports a web-sized GLB, and renders the social card and poster in
Cycles.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/build-webb-model.py -- /path/to/webb.glb

Options after the source path:
    --no-renders        export the GLB only
    --no-glb            render only
    --previews DIR      also write quick check renders at several clip times
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
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'missions' / 'webb'
GLTF_TRANSFORM = '@gltf-transform/cli@4.2.1'
PREFIX = 'James_Webb_Space_Telescope:'
FPS = 24

# NASA's file, as Blender imports it: boresight (the way the mirror looks) on
# +X, the cold side of the sunshield on +Z, origin under the middle of the
# bus. The page wants boresight on glTF +Z and the cold side on glTF +Y,
# which in Blender's Z-up frame is boresight on -Y. Bus centre in NASA's frame:
BUS_CENTRE = Vector((0.05, 0.0, 0.90))
TURN = Matrix.Rotation(-math.pi / 2, 4, 'Z')
TO_FINAL = TURN @ Matrix.Translation(-BUS_CENTRE)


def F(x, y, z):
    """A point in NASA's frame, in the exported frame."""
    return TO_FINAL @ Vector((x, y, z))


def D(x, y, z):
    """A direction in NASA's frame, in the exported frame."""
    return (TURN.to_3x3() @ Vector((x, y, z))).normalized()


def S(sx, sy, sz):
    """Per-axis scale given along NASA's axes."""
    return Vector((sy, sx, sz))


# Mesh nodes. The first eight are the parts the page's picker names.
PARTS = [
    'PrimaryMirror', 'SecondaryMirror', 'Sunshield', 'InstrumentModule', 'Bus',
    'SolarArray', 'Antenna', 'MomentumFlap',
    'MirrorWingA', 'MirrorWingB', 'SecondaryStrutA', 'SecondaryStrutB',
    'SunshieldFwd', 'SunshieldAft', 'FwdPallet', 'AftPallet',
    'MidBoomA', 'MidBoomB',
]
HOTSPOT_PARTS = PARTS[:8]

# Triangles each part is thinned to. Mirrors and struts are already light.
BUDGET = {
    'InstrumentModule': 11000, 'Bus': 15000, 'SolarArray': 2400,
    'Antenna': 2600, 'MomentumFlap': 1200, 'FwdPallet': 5500,
    'AftPallet': 6500, 'MidBoomA': 1800, 'MidBoomB': 1800,
}
SHIELD_LAYER_TRIANGLES = 1500
# Nuts, washers and screws: anything smaller than this in every direction.
SMALLEST_KEPT = 0.07
# Sub-assemblies dropped whole: wiring looms and the hundreds of membrane
# cover cleats, 120,000 triangles that are specks at page size.
DROPPED = ('harness', 'harness_cntrpc', 'asm_covrcleats_hr_car_v001:aftcl.016',
           'asm_covrcleats_hr_car_v001:aftcleats', 'asm_covrcleats_hr_car_v001:fwdcl',
           'asm_covrcleats_hr_car_v001:fwdcleats', 'flap1_rot')

# base colour (sRGB, 0-255), metallic, roughness. The page lights the model
# with one hard Sun and no environment map, so nothing is a mirror: even the
# gold is mostly diffuse, or it would render black from most angles.
MATERIALS = {
    'Gold': ((242, 168, 44), 0.35, 0.42),
    'GoldTrim': ((200, 150, 70), 0.3, 0.5),
    'Silver': ((200, 204, 212), 0.4, 0.4),
    'ShieldHot': ((178, 124, 182), 0.3, 0.42),
    'ShieldCold': ((158, 163, 178), 0.35, 0.42),
    'Kapton': ((178, 132, 108), 0.25, 0.5),
    'SilverBlanket': ((150, 156, 172), 0.3, 0.48),
    'Black': ((26, 26, 30), 0.0, 0.6),
    'Aluminium': ((130, 140, 155), 0.45, 0.45),
    'SolarCells': ((20, 30, 72), 0.2, 0.35),
    'White': ((225, 225, 220), 0.0, 0.6),
    'Grey': ((120, 120, 125), 0.1, 0.6),
}


def linear(channel):
    c = channel / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material_role(name):
    n = name.replace(PREFIX, '').lower()
    if 'omnimirror' in n:
        return 'Silver'
    if 'mirror' in n:
        return 'Gold'
    if 'sacells' in n:
        return 'SolarCells'
    if 'gold' in n:
        return 'GoldTrim'
    if 'shld_pink' in n:
        return 'ShieldHot'
    if 'shld_silv' in n:
        return 'ShieldCold'
    if 'pink' in n or 'pmli' in n or 'pnkmli' in n:
        return 'Kapton'
    if 'silver' in n or 'smli' in n or 'ssm' in n:
        return 'SilverBlanket'
    if 'blk' in n or 'black' in n or 'carbon' in n or 'graphite' in n:
        return 'Black'
    if 'alu' in n:
        return 'Aluminium'
    if 'white' in n:
        return 'White'
    return 'Grey'


def classify(chain):
    """Name the part a mesh belongs to from its ancestors, nearest first."""
    for name in chain:
        if name in ('wing1_fins', 'wing2_fins'):
            return 'InstrumentModule'
        if name == 'wing1':
            return 'MirrorWingA'
        if name == 'wing2':
            return 'MirrorWingB'
        if name in ('mirrors', 'nu_baf'):
            return 'PrimaryMirror'
        if name == 'joint4':
            return 'SecondaryStrutA'
        if name == 'joint2 (1)':
            return 'SecondaryStrutB'
        if name == 'joint1':
            return 'SecondaryMirror'
        if name == 'mirror_asm_tranZ' or name == 'batwings':
            return 'InstrumentModule'
        if name == 'sa_panels':
            return 'SolarArray'
        if name == 'hga':
            return 'Antenna'
        if name == 'aft_flap_assy':
            return 'MomentumFlap'
        if name == 'aft_shield':
            return 'AftPallet'
        if name == 'fwd_shield':
            return 'FwdPallet'
        if name == 'mboom1_boom1_trany':
            return 'MidBoomA'
        if name == 'mboom2_boom1_trany':
            return 'MidBoomB'
        if name == 'shield':
            return 'Shield'
    return 'Bus'


def make_material(name):
    srgb, metallic, roughness = MATERIALS[name]
    color = (*(linear(c) for c in srgb), 1.0)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    mat.diffuse_color = color
    mat.use_backface_culling = not name.startswith('Shield')
    return mat


def override(obj, others=None):
    objects = others or [obj]
    return bpy.context.temp_override(active_object=obj, object=obj, selected_objects=objects,
                                     selected_editable_objects=objects)


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def tidy(obj, target=None, sharp_degrees=38):
    """Weld, thin to `target` triangles, and set which edges stay hard."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bm.to_mesh(obj.data)
    bm.free()
    if target and triangles(obj) > target:
        mod = obj.modifiers.new('thin', 'DECIMATE')
        mod.ratio = target / triangles(obj)
        with override(obj):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    limit = math.radians(sharp_degrees)
    for edge in bm.edges:
        edge.smooth = len(edge.link_faces) == 2 and edge.calc_face_angle(0) < limit
    for face in bm.faces:
        face.smooth = True
    bm.to_mesh(obj.data)
    bm.free()


def cut(obj, name, keep_min=None, keep_max=None):
    """A copy of `obj` keeping only NASA x between the two planes."""
    piece = obj.copy()
    piece.data = obj.data.copy()
    piece.name = piece.data.name = name
    bpy.context.scene.collection.objects.link(piece)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    for x, normal, clear_outer in ((keep_min, (1, 0, 0), False), (keep_max, (1, 0, 0), True)):
        if x is None:
            continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x, 0, 0), plane_no=normal,
                               clear_inner=not clear_outer, clear_outer=clear_outer)
    bm.to_mesh(piece.data)
    bm.free()
    return piece


# Where the fore and aft pallets hinge down from, along NASA x. The membrane
# between them stays over the bus.
SPLIT_FWD, SPLIT_AFT = 1.45, -1.55


def build_parts(source_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    scene = bpy.context.scene
    scene.render.fps = FPS
    materials = {name: make_material(name) for name in MATERIALS}

    groups = {}
    for obj in [o for o in scene.objects if o.type == 'MESH']:
        chain, node = [], obj
        while node:
            chain.append(node.name.replace(PREFIX, ''))
            node = node.parent
        if any(name in DROPPED for name in chain):
            continue
        part = classify(chain)
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        size = max(max(c[i] for c in corners) - min(c[i] for c in corners) for i in range(3))
        if size < SMALLEST_KEPT and part not in ('PrimaryMirror', 'SecondaryMirror'):
            continue
        if part == 'Shield':
            name = chain[0]
            if name.endswith('_bot'):
                continue
            part = 'Shield' + name[-1]
        groups.setdefault(part, []).append(obj)

    # Lift every kept mesh out of NASA's rig first, baking its place in the
    # world into its vertices, so that joining never depends on a parent
    # that has already been moved.
    for part, members in groups.items():
        for obj in members:
            world = obj.matrix_world.copy()
            obj.data = obj.data.copy()
            obj['world'] = [list(row) for row in world]
            for i, old in enumerate(obj.data.materials):
                if part.startswith('Shield'):
                    role = 'ShieldHot' if part == 'Shield1' else 'ShieldCold'
                else:
                    role = material_role(old.name)
                obj.data.materials[i] = materials[role]
    for members in groups.values():
        for obj in members:
            world = Matrix(obj['world'])
            obj.parent = None
            obj.data.transform(world)
            if world.determinant() < 0:
                obj.data.flip_normals()
            obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()

    parts = {}
    for part, members in groups.items():
        first = members[0]
        if len(members) > 1:
            with override(first, members):
                bpy.ops.object.join()
        with override(first):
            bpy.ops.object.material_slot_remove_unused()
        first.name = first.data.name = part
        parts[part] = first
    for obj in list(scene.objects):
        if obj not in parts.values():
            bpy.data.objects.remove(obj)

    # NASA's export leaves one of the two outer momentum-flap panels far
    # behind the telescope. The flap is symmetric, so the good outer panel
    # (on -y) is mirrored to replace it.
    flap = parts['MomentumFlap']
    bm = bmesh.new()
    bm.from_mesh(flap.data)
    side = [f for f in bm.faces if f.calc_center_median().y < -0.395]
    copied = bmesh.ops.duplicate(bm, geom=side)
    twins = [g for g in copied['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.scale(bm, vec=(1, -1, 1), verts=twins)
    bmesh.ops.reverse_faces(bm, faces=[g for g in copied['geom'] if isinstance(g, bmesh.types.BMFace)])
    bm.to_mesh(flap.data)
    bm.free()

    for part, obj in parts.items():
        if part.startswith('Shield'):
            tidy(obj, SHIELD_LAYER_TRIANGLES, sharp_degrees=180)
        else:
            tidy(obj, BUDGET.get(part))

    # The five membranes become three meshes: the middle over the bus and the
    # halves that ride the fore and aft pallets.
    layers = [parts.pop('Shield' + str(i)) for i in range(1, 6)]
    for name, lo, hi in (('SunshieldFwd', SPLIT_FWD, None), ('Sunshield', SPLIT_AFT, SPLIT_FWD),
                         ('SunshieldAft', None, SPLIT_AFT)):
        pieces = [cut(layer, name + str(i), lo, hi) for i, layer in enumerate(layers)]
        with override(pieces[0], pieces):
            bpy.ops.object.join()
        pieces[0].name = pieces[0].data.name = name
        parts[name] = pieces[0]
    for layer in layers:
        bpy.data.objects.remove(layer)

    for name in ('PrimaryMirror', 'MirrorWingA', 'Sunshield', 'SunshieldFwd', 'SunshieldAft', 'MomentumFlap'):
        xs = [v.co for v in parts[name].data.vertices]
        lo = [min(c[i] for c in xs) for i in range(3)]
        hi = [max(c[i] for c in xs) for i in range(3)]
    for obj in parts.values():
        obj.data.transform(TO_FINAL)
        obj.data.update()
    return parts


# ──── Pivots and the unfolding clip ────
#
# One clip, `Deploy`, ten seconds long: second N is the start of step N.
#   0-1  solar array unfolds            25 Dec 2021
#   1-2  antenna swings out             26 Dec
#   2-3  fore, then aft pallet lowers   28 Dec
#   3-4  tower lifts the telescope      29 Dec
#   4-5  momentum flap                  30 Dec
#   5-6  mid-booms pull the shield out  31 Dec
#   6-7  five layers pulled taut        3-4 Jan 2022
#   7-8  secondary mirror               5 Jan
#   8-9  first mirror wing              7 Jan
#   9-10 second mirror wing             8 Jan
CLIP_SECONDS = 10
TOWER_LIFT = 1.22
SM_KEYS = 12

# The secondary-mirror support, in NASA's x-z plane: the two lower struts
# swing about BASE carrying the mirror; the upper strut hinges at TOP and
# folds in the middle.
SM_BASE = Vector((1.21, 3.46))
SM_TOP = Vector((1.11, 10.24))
SM_ELBOW = Vector((4.45, 8.52))
SM_HEAD = Vector((8.38, 6.66))
SM_STOWED_SWING = math.radians(61)


def sm_pose(u):
    """Angles (about NASA -y) of the lower struts and both halves of the
    upper strut, `u` from 0 folded to 1 deployed."""
    swing = SM_STOWED_SWING * (1 - u)
    arm = SM_HEAD - SM_BASE
    c, s = math.cos(swing), math.sin(swing)
    head = SM_BASE + Vector((arm.x * c - arm.y * s, arm.x * s + arm.y * c))
    inner, outer = (SM_ELBOW - SM_TOP).length, (SM_HEAD - SM_ELBOW).length
    span = head - SM_TOP
    d = min(span.length, inner + outer - 1e-6)
    along = (inner * inner - outer * outer + d * d) / (2 * d)
    off = math.sqrt(max(0.0, inner * inner - along * along))
    axis = span.normalized()
    # The elbow folds toward the mirror's foot, below the line of the strut.
    side = Vector((-axis.y, axis.x))
    if side.y > 0:
        side = -side
    elbow = SM_TOP + axis * along + side * off
    angle = lambda v: math.atan2(v.y, v.x)
    inner_turn = angle(elbow - SM_TOP) - angle(SM_ELBOW - SM_TOP)
    outer_turn = angle(elbow - head) - angle(SM_ELBOW - SM_HEAD)
    return swing, inner_turn, outer_turn - swing


def build_rig(parts):
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 0, CLIP_SECONDS * FPS
    action = bpy.data.actions.new('Deploy')
    pivots = {}

    def pivot(name, origin, children=(), parent=None):
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_size = 0.3
        obj.rotation_mode = 'QUATERNION'
        scene.collection.objects.link(obj)
        world = F(*origin)
        obj['world'] = world
        if parent:
            obj.parent = pivots[parent]
            obj.location = world - Vector(pivots[parent]['world'])
        else:
            obj.location = world
        obj['rest'] = obj.location.copy()
        for child in children:
            mesh = parts[child]
            mesh.data.transform(Matrix.Translation(-world))
            mesh.parent = obj
            mesh['pivot'] = name
        pivots[name] = obj
        return obj

    def key(name, second, turn=None, shift=None, scale=None):
        """`turn` is (NASA axis, radians); `shift` and `scale` along NASA axes."""
        obj = pivots[name]
        frame = second * FPS
        if not obj.animation_data:
            obj.animation_data_create()
            obj.animation_data.action = action
        if turn is not None:
            obj.rotation_quaternion = Quaternion(D(*turn[0]), turn[1])
            obj.keyframe_insert('rotation_quaternion', frame=frame)
        if shift is not None:
            obj.location = Vector(obj['rest']) + TURN.to_3x3() @ Vector(shift)
            obj.keyframe_insert('location', frame=frame)
        if scale is not None:
            obj.scale = S(*scale)
            obj.keyframe_insert('scale', frame=frame)

    Y = (0, 1, 0)
    NEG_Y = (0, -1, 0)
    Z = (0, 0, 1)

    # Solar array: five panels folded like a fan against the back of the bus.
    # Drawn as the whole array squeezed along its length and tipped upright.
    pivot('Pivot_SolarArray', (-1.36, 0, 0.36), ['SolarArray'])
    key('Pivot_SolarArray', 0, turn=(NEG_Y, math.radians(-70)), scale=(0.2, 1, 1))
    key('Pivot_SolarArray', 1, turn=(NEG_Y, 0), scale=(1, 1, 1))

    pivot('Pivot_Antenna', (-1.2, -1.45, 0.45), ['Antenna'])
    key('Pivot_Antenna', 1, turn=((1, 0, 0), math.radians(-80)))
    key('Pivot_Antenna', 2, turn=((1, 0, 0), 0))

    # The pallets fold up either side of the telescope. Each carries its half
    # of the folded membranes, drawn squeezed thin and flat.
    FOLDED = (1, 0.16, 0.12)
    pivot('Pivot_FwdPallet', (1.5, 0, 0.72), ['FwdPallet'])
    pivot('Scale_SunshieldFwd', (1.5, 0, 0.95), ['SunshieldFwd'], parent='Pivot_FwdPallet')
    key('Pivot_FwdPallet', 2, turn=(NEG_Y, math.radians(88)), shift=(1.05, 0, 0.1))
    key('Pivot_FwdPallet', 2.5, turn=(NEG_Y, 0), shift=(0, 0, 0))

    pivot('Pivot_AftPallet', (-1.6, 0, 1.3), ['AftPallet'])
    pivot('Scale_SunshieldAft', (-1.6, 0, 1.6), ['SunshieldAft'], parent='Pivot_AftPallet')
    pivot('Pivot_MomentumFlap', (-10.5, 0, 4.42), ['MomentumFlap'], parent='Pivot_AftPallet')
    key('Pivot_AftPallet', 2.5, turn=(NEG_Y, math.radians(-71)), shift=(-0.75, 0, -0.35))
    key('Pivot_AftPallet', 3, turn=(NEG_Y, 0), shift=(0, 0, 0))
    key('Pivot_MomentumFlap', 4, turn=(NEG_Y, math.radians(118)))
    key('Pivot_MomentumFlap', 5, turn=(NEG_Y, 0))

    pivot('Scale_Sunshield', (0, 0, 1.75), ['Sunshield'])
    for name in ('Scale_SunshieldFwd', 'Scale_SunshieldAft', 'Scale_Sunshield'):
        key(name, 5, scale=FOLDED)
        key(name, 6, scale=(1, 1, FOLDED[2]))
        key(name, 7, scale=(1, 1, 1))

    pivot('Pivot_MidBoomA', (0, 1.9, 1.52), ['MidBoomA'])
    pivot('Pivot_MidBoomB', (0, -1.9, 1.52), ['MidBoomB'])
    for name in ('Pivot_MidBoomA', 'Pivot_MidBoomB'):
        key(name, 5, scale=(1, 0.12, 1))
        key(name, 6, scale=(1, 1, 1))

    # Everything above the bus rides the tower.
    pivot('Pivot_Tower', (0, 0, 3.1), ['InstrumentModule', 'PrimaryMirror'])
    key('Pivot_Tower', 3, shift=(0, 0, -TOWER_LIFT))
    key('Pivot_Tower', 4, shift=(0, 0, 0))

    pivot('Pivot_SecondaryMirror', (SM_BASE.x, 0, SM_BASE.y), ['SecondaryMirror'], parent='Pivot_Tower')
    pivot('Pivot_SecondaryStrutA', (SM_TOP.x, 0, SM_TOP.y), ['SecondaryStrutA'], parent='Pivot_Tower')
    pivot('Pivot_SecondaryStrutB', (SM_HEAD.x, 0, SM_HEAD.y), ['SecondaryStrutB'], parent='Pivot_SecondaryMirror')
    for i in range(SM_KEYS + 1):
        u = i / SM_KEYS
        eased = u * u * (3 - 2 * u)
        swing, inner, outer = sm_pose(eased)
        key('Pivot_SecondaryMirror', 7 + u, turn=(NEG_Y, swing))
        key('Pivot_SecondaryStrutA', 7 + u, turn=(NEG_Y, inner))
        key('Pivot_SecondaryStrutB', 7 + u, turn=(NEG_Y, outer))

    WING_FOLD = math.radians(103)
    pivot('Pivot_MirrorWingA', (0.93, 1.53, 6.28), ['MirrorWingA'], parent='Pivot_Tower')
    pivot('Pivot_MirrorWingB', (0.93, -1.53, 6.28), ['MirrorWingB'], parent='Pivot_Tower')
    key('Pivot_MirrorWingA', 8, turn=(Z, WING_FOLD))
    key('Pivot_MirrorWingA', 9, turn=(Z, 0))
    key('Pivot_MirrorWingB', 9, turn=(Z, -WING_FOLD))
    key('Pivot_MirrorWingB', 10, turn=(Z, 0))

    # Straight lines between keys; the page eases each step itself.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = 'LINEAR'

    # Parts that never move hang straight off the scene.
    for name in ('Bus',):
        parts[name]['pivot'] = ''
    return pivots


# Where each callout attaches: a point in NASA's frame, snapped to the
# nearest vertex of the finished part.
HOTSPOT_TARGETS = {
    'PrimaryMirror': (1.05, -1.15, 6.9),
    'SecondaryMirror': (8.3, 0.0, 6.3),
    'Sunshield': (0.6, -5.0, 2.9),
    'InstrumentModule': (-1.5, 0.6, 6.4),
    'Bus': (1.6, -1.42, 0.9),
    'SolarArray': (-4.6, -0.6, 1.5),
    'Antenna': (-1.35, -1.5, -0.7),
    'MomentumFlap': (-11.3, 0.0, 2.5),
}


def add_hotspots(parts, pivots):
    scene = bpy.context.scene
    for part, target in HOTSPOT_TARGETS.items():
        mesh = parts[part]
        parent = pivots.get(mesh.get('pivot', ''))
        offset = Vector(parent['world']) if parent else Vector()
        goal = F(*target) - offset
        spot = min((v.co for v in mesh.data.vertices), key=lambda c: (c - goal).length_squared).copy()
        empty = bpy.data.objects.new('Hotspot_' + part, None)
        empty.empty_display_size = 0.1
        scene.collection.objects.link(empty)
        if parent:
            empty.parent = parent
        empty.location = spot


def export_glb(target):
    raw = Path(tempfile.mkdtemp(prefix='webb-glb-')) / 'webb-raw.glb'
    # Node rest transforms are the open telescope; the clip folds it.
    bpy.context.scene.frame_set(CLIP_SECONDS * FPS)
    bpy.ops.export_scene.gltf(
        filepath=str(raw), export_format='GLB', export_yup=True,
        export_apply=False, export_cameras=False, export_lights=False,
        export_extras=False, export_tangents=False, export_vertex_color='NONE',
        export_texcoords=False, export_materials='EXPORT',
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=False, export_frame_range=False, export_current_frame=True,
        export_anim_slide_to_zero=False, export_optimize_animation_size=False)
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['bunx', GLTF_TRANSFORM, 'meshopt', str(raw), str(target),
                    '--level', 'medium'], check=True)
    print(f'RAW {raw.stat().st_size} bytes, PACKED {target.stat().st_size} bytes')
    shutil.rmtree(raw.parent)


# ──── Stills ────

def look_at(obj, position, target, up):
    forward = (Vector(target) - Vector(position)).normalized()
    right = forward.cross(Vector(up)).normalized()
    true_up = right.cross(forward)
    obj.matrix_world = Matrix.Translation(position) @ Matrix(
        (right, true_up, -forward)).transposed().to_4x4()


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
    background.inputs['Strength'].default_value = 0.3
    scene.world = world

    def sun(name, toward, energy, color, angle):
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        light.color = color
        light.angle = math.radians(angle)
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        look_at(obj, D(*toward) * -1, (0, 0, 0), D(0.3, 0, 1))
        return obj

    # `toward` is the direction the light travels, in NASA's frame. The real
    # Sun only ever lights the underside of the shield; the telescope side is
    # lit here by a second lamp so the mirror can be seen at all.
    sun('Sun', (-0.25, 0.35, 1.0), 5.0, (1.0, 0.96, 0.9), 0.6)
    sun('Key', (-0.8, 0.45, -0.55), 3.0, (1.0, 0.97, 0.93), 2)
    sun('Fill', (-0.3, -0.8, -0.3), 0.35, (0.55, 0.7, 1.0), 20)


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


def render_still(scene, camera, shot, width, height, samples, seed, second=CLIP_SECONDS):
    """Render the telescope over the star field; returns bottom-up sRGB pixels."""
    position, target, up, lens, shift_x, shift_y = shot
    scene.frame_set(int(second * FPS))
    look_at(camera, F(*position), F(*target), D(*up))
    camera.data.lens = lens
    camera.data.shift_x, camera.data.shift_y = shift_x, shift_y
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    path = Path(tempfile.mkdtemp(prefix='webb-still-')) / 'webb.png'
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


# position, target, up (NASA frame: +X boresight, +Z cold side), lens mm,
# shift x, shift y
SHOT_COVER = ((27.0, -17.0, 15.0), (-0.6, 0.0, 3.4), (0, 0, 1), 35, -0.15, 0.0)
SHOT_POSTER = ((27.0, -17.0, 15.0), (-0.6, 0.0, 3.4), (0, 0, 1), 35, -0.13, 0.03)
PREVIEW_SHOT = ((30.0, -24.0, 17.0), (-0.6, 0.0, 4.0), (0, 0, 1), 42, 0, 0)
PREVIEW_UNDER = ((22.0, -24.0, -16.0), (-0.6, 0.0, 2.0), (0, 0, 1), 42, 0, 0)
PREVIEW_SIDE = ((0.0, -44.0, 5.0), (-0.6, 0.0, 4.5), (0, 0, 1), 42, 0, 0)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args or args[0].startswith('--'):
        sys.exit(__doc__)
    source = Path(args[0]).resolve()
    samples = int(args[args.index('--samples') + 1]) if '--samples' in args else 160
    previews = Path(args[args.index('--previews') + 1]) if '--previews' in args else None

    parts = build_parts(source)
    pivots = build_rig(parts)
    add_hotspots(parts, pivots)
    total = 0
    for part in PARTS:
        count = triangles(parts[part])
        total += count
        print(f'PART {part}: {count} triangles')
    print(f'TOTAL {total} triangles')

    if '--no-glb' not in args:
        export_glb(OUT / 'webb.glb')

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
        for second in (0, 1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10):
            for view, shot in (('top', PREVIEW_SHOT), ('side', PREVIEW_SIDE)):
                pixels = render_still(scene, camera, shot, 800, 560, 12, 1, second)
                save_pixels(pixels, previews / f'{view}-{second}.png', 'PNG')
        save_pixels(render_still(scene, camera, PREVIEW_UNDER, 800, 560, 12, 1), previews / 'under.png', 'PNG')
    if '--no-renders' not in args:
        cover = render_still(scene, camera, SHOT_COVER, 1200, 630, samples, 2021)
        save_pixels(cover, OUT / 'og-cover.png', 'PNG')
        poster = render_still(scene, camera, SHOT_POSTER, 1600, 1000, samples, 2021)
        save_pixels(poster, OUT / 'poster.webp', 'WEBP', quality=82)
        save_pixels(halve(poster), OUT / 'poster-800.webp', 'WEBP', quality=84)


main()
