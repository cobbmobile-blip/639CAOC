"""Render target-folder imagery in Blender: real terrain and satellite imagery, with the mission's units as DCS models.

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P render.py -- cache/T10001/job.json

Reads the job (target, units with DCS shape names, positions and headings, shots) and cache/<target>/ from
fetch_area.py. Models are parsed from the DCS install with the vendored EDM parser (edm_patch.py) and stay there; only
rendered images are written, to out/<target>_<shot>.png. The TGP shot uses DCS's own FLIR textures on the vehicles and a
dark grayscale ground, for a white-hot look; capture post-processing (noise, crosshair, data block) is done after.
"""
import json, math, os, sys, zipfile

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import edm_patch  # noqa: E402  (vendored ndevenish parser, patched for DCS EDM v10)
import shapes  # noqa: E402  (DCS unit type -> readable model file)

DCS = r"C:\Program Files\Eagle Dynamics\DCS World"
SHAPES = os.path.join(DCS, "Bazar", "World", "Shapes")
TEXZIPS = os.path.join(DCS, "Bazar", "World", "textures")
TEXCACHE = os.path.join(HERE, "cache", "_textures")
OUT = os.path.join(HERE, "out")
R_EARTH = 6378137.0


# ---------- textures: index every DCS texture zip once, extract on demand ----------
_tex_index = None
def texture_file(name, flir=False):
    global _tex_index
    if _tex_index is None:
        _tex_index = {}
        for z in os.listdir(TEXZIPS):
            if z.lower().endswith(".zip"):
                try:
                    for n in zipfile.ZipFile(os.path.join(TEXZIPS, z)).namelist():
                        _tex_index.setdefault(os.path.splitext(os.path.basename(n))[0].lower(), (z, n))
                except zipfile.BadZipFile:
                    pass
    base = os.path.splitext(os.path.basename(name))[0].lower()
    hit = (_tex_index.get(base + "_flir") if flir else None) or _tex_index.get(base)
    if not hit: return None
    z, member = hit
    dst = os.path.join(TEXCACHE, os.path.basename(member))
    if not os.path.exists(dst):
        os.makedirs(TEXCACHE, exist_ok=True)
        with zipfile.ZipFile(os.path.join(TEXZIPS, z)) as zf, open(dst, "wb") as f: f.write(zf.read(member))
    return dst


def image_material(name, path, fallback=(0.25, 0.27, 0.18), flir=False):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]; bsdf.inputs["Roughness"].default_value = 0.85
    if path:
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(path, check_existing=True)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if flir:                                              # DCS FLIR textures carry the heat in alpha: white-hot emission from it
            tex.image.alpha_mode = "CHANNEL_PACKED"
            gain = nt.nodes.new("ShaderNodeMath"); gain.operation = "MULTIPLY"; gain.inputs[1].default_value = 3.2; gain.use_clamp = True
            em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1, 1, 1, 1)
            nt.links.new(tex.outputs["Alpha"], gain.inputs[0]); nt.links.new(gain.outputs["Value"], em.inputs["Strength"])
            nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    else:
        bsdf.inputs["Base Color"].default_value = (*fallback, 1)
        if flir:
            em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.75, 0.75, 0.75, 1); em.inputs["Strength"].default_value = 1.3
            nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    return mat


# ---------- EDM model -> Blender object ----------
def local_matrix(node):
    if hasattr(node, "base"):                                  # ArgAnimationNode family: the static base pose
        b = node.base
        return b.matrix @ Matrix.Translation(b.position) @ b.quat_1.to_matrix().to_4x4() @ Matrix.Diagonal((*b.scale, 1))
    if hasattr(node, "matrix"): return node.matrix
    return Matrix.Identity(4)


def world_matrix(node):
    m = Matrix.Identity(4)
    while node is not None:
        m = local_matrix(node) @ m; node = getattr(node, "parent", None)
        if isinstance(node, int): node = None
    return m


# effects, damage and helper meshes that DCS only shows in certain states (material or texture name contains one of these)
SKIP_PARTS = ("shadow", "lines_material", "glass", "flame", "fire", "smoke", "dym", "dust", "blick", "flare", "exhaust", "muzzle",
              "damage", "destr", "crush", "broken", "lamp", "light", "collision")
MAX_PART_M = 45.0          # nothing on a ground unit reaches further (the 40V6M radar mast is ~25 m); misread parts land 100 m+ away

TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # EDM (x fwd, y up, z right) -> Blender z up


def node_at(e, p):
    """A render node's parent: an index into e.nodes, or (in some files) the node itself."""
    return e.nodes[p] if isinstance(p, int) and 0 <= p < len(e.nodes) else p if hasattr(p, "name") else None


def visible(node, arg_value=0.0):
    """False if any ArgVisibilityNode above the part hides it at the default argument value (DCS shows a part only
    while its argument lies inside one of the node's ranges)."""
    while node is not None and hasattr(node, "name"):
        for _arg, ranges in getattr(node, "visData", []) or []:
            if ranges and not any(lo <= arg_value < hi for lo, hi in ranges): return False
        node = getattr(node, "parent", None)
    return True


def animated(node):
    while node is not None and hasattr(node, "name"):
        if hasattr(node, "base"): return True
        node = getattr(node, "parent", None)
    return False


def lod_level(node):
    """0 for the closest level of detail (or no LOD), else the level: the child of a LodNode the part hangs from."""
    while node is not None and hasattr(node, "name"):
        par = getattr(node, "parent", None)
        if type(par).__name__ == "LodNode":
            kids = [c for c in getattr(par, "children", [])]
            return kids.index(node) if node in kids else (int(node.name[3:]) if node.name[:3].upper() == "LOD" and node.name[3:].isdigit() else 0)
        node = par
    return 0


def build_model(shape, flir, cache):
    key = (shape, flir)
    if key in cache: return cache[key]
    e = edm_patch.EDMFile(os.path.join(SHAPES, shape + ".edm"))
    objs = []
    for rn in e.renderNodes:
        if not getattr(rn, "vertexData", None) or not getattr(rn, "indexData", None): continue
        fmt = rn.material.vertex_format if getattr(rn, "material", None) else rn.vertex_format
        name = (getattr(rn.material, "name", "") or "").lower()
        texs = getattr(rn.material, "textures", []) if getattr(rn, "material", None) else []
        # material name and main (diffuse) texture only: intact skins also list damage / light-map layers
        main_tex = next((t for t in texs if t.index == 0), None)
        tags = name + " " + (main_tex.name.lower() if main_tex else "")
        if any(k in tags for k in SKIP_PARTS): continue
        p = getattr(rn, "parent", None)                         # an index into e.nodes, or (in some files) the node itself
        if lod_level(e.nodes[p] if isinstance(p, int) and p < len(e.nodes) else p) > 0: continue   # only the most detailed LOD
        node = node_at(e, p)
        if not visible(node): continue                          # hidden in the default state (covers, chutes, damage)
        used = sorted(set(rn.indexData)); remap = {v: i for i, v in enumerate(used)}
        pos, uv = fmt.position_indices, fmt.texture_indices
        vp = getattr(rn, "vertex_parents", None)               # multi-parent mesh: each vertex names its parent (4th value)
        mats = {}
        def mat_for(v):
            k = int(round(rn.vertexData[v][3])) if vp else -1
            if k not in mats:
                mats[k] = TO_BLENDER @ world_matrix(node_at(e, vp[k]) if vp and 0 <= k < len(vp) else node)
            return mats[k]
        verts = [(mat_for(v) @ Vector([rn.vertexData[v][i] for i in pos])).to_tuple() for v in used]
        # a part whose pose this reader gets wrong lands far from the vehicle: drop it rather than draw a giant
        if max(max(abs(v[0]), abs(v[1])) for v in verts) > MAX_PART_M or max(v[2] for v in verts) > MAX_PART_M:
            print(f"  {shape}: dropped part '{name}' (posed {MAX_PART_M:.0f} m+ from the vehicle)"); continue
        tris = [tuple(remap[x] for x in rn.indexData[i:i + 3]) for i in range(0, len(rn.indexData) - 2, 3)]
        me = bpy.data.meshes.new(f"{shape}_{len(objs)}"); me.from_pydata(verts, [], tris); me.update()
        if uv:
            layer = me.uv_layers.new()
            for poly in me.polygons:
                for li in poly.loop_indices:
                    vd = rn.vertexData[used[me.loops[li].vertex_index]]; layer.data[li].uv = (vd[uv[0]], 1 - vd[uv[1]])
        diffuse = next((t for t in texs if t.index == 0), texs[0] if texs else None)
        path = texture_file(diffuse.name, flir) if diffuse else None
        me.materials.append(image_material(f"{shape}_{name}_{'flir' if flir else 'day'}", path, flir=flir))
        ob = bpy.data.objects.new(me.name, me); objs.append(ob)
    cache[key] = objs
    return objs


# ---------- scene ----------
def enu(lat0, lon0, lat, lon):
    return (math.radians(lon - lon0) * R_EARTH * math.cos(math.radians(lat0)), math.radians(lat - lat0) * R_EARTH)


def build_terrain(area, ortho_path, height, flir):
    n_y, n_x = height.shape; half = area["size_m"] / 2
    z0 = float(height[n_y // 2, n_x // 2])
    xs = np.linspace(-half, half, n_x); ys = np.linspace(half, -half, n_y)
    verts = [(float(x), float(y), float(height[j, i] - z0)) for j, y in enumerate(ys) for i, x in enumerate(xs)]
    faces = [(j * n_x + i, j * n_x + i + 1, (j + 1) * n_x + i + 1, (j + 1) * n_x + i) for j in range(n_y - 1) for i in range(n_x - 1)]
    me = bpy.data.meshes.new("terrain"); me.from_pydata(verts, [], faces); me.update()
    layer = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            x, y, _ = verts[me.loops[li].vertex_index]; layer.data[li].uv = ((x + half) / (2 * half), (y + half) / (2 * half))
    mat = bpy.data.materials.new("ground"); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(ortho_path)
    if flir:                                                     # white-hot ground: dark, grayscale
        bw = nt.nodes.new("ShaderNodeRGBToBW"); em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 0.45
        nt.links.new(tex.outputs["Color"], bw.inputs["Color"]); nt.links.new(bw.outputs["Val"], em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    else:
        bsdf.inputs["Roughness"].default_value = 1.0; nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        em = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if em is not None:                                       # imagery already has sun and shade in it: keep it bright
            nt.links.new(tex.outputs["Color"], em); bsdf.inputs["Emission Strength"].default_value = 0.6
    me.materials.append(mat)
    ob = bpy.data.objects.new("terrain", me); bpy.context.scene.collection.objects.link(ob)
    return z0, (xs, ys)


def ground_z(height, z0, half, x, y):
    n_y, n_x = height.shape
    i = min(max(int(round((x + half) / (2 * half) * (n_x - 1))), 0), n_x - 1); j = min(max(int(round((half - y) / (2 * half) * (n_y - 1))), 0), n_y - 1)
    return float(height[j, i] - z0)


def render(job_path):
    job = json.load(open(job_path)); tgt = job["target"]; cdir = os.path.dirname(os.path.abspath(job_path))
    area = json.load(open(os.path.join(cdir, "area.json"))); height = np.load(os.path.join(cdir, "height.npy")); half = area["size_m"] / 2
    os.makedirs(OUT, exist_ok=True)
    for flir in (False, True):
        shots = [s for s in job["shots"] if (s["kind"] == "oblique") == flir]
        if not shots: continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.use_denoising = True
        sc.view_settings.view_transform = "Standard"
        z0, _ = build_terrain(area, os.path.join(cdir, "ortho.png"), height, flir)
        cache = {}
        for u in job["units"]:
            x, y = enu(job["lat"], job["lon"], u["lat"], u["lon"])
            shape = u.get("shape") or shapes.resolve(u["type"])
            if abs(x) > half or abs(y) > half or not shape: continue          # no readable model: annotated only
            for src in build_model(shape, flir, cache):
                ob = bpy.data.objects.new(f"{u['name']}_{src.name}", src.data); sc.collection.objects.link(ob)
                ob.location = (x, y, ground_z(height, z0, half, x, y))
                ob.rotation_euler = (0, 0, math.radians(90 - u["heading_deg"]))   # DCS heading: clockwise from north
        if not flir:
            sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.2; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
            so.rotation_euler = (math.radians(40), 0, math.radians(135))
            sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.5, 0.55, 0.6)
        else:
            sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.02, 0.02, 0.02)
        for s in shots:
            cam = bpy.data.cameras.new(s["name"]); co = bpy.data.objects.new(s["name"], cam); sc.collection.objects.link(co); sc.camera = co
            cam.clip_end = 50000
            if s["kind"] == "ortho":
                cam.type = "ORTHO"; cam.ortho_scale = s["width_m"]; co.location = (0, 0, 3000); co.rotation_euler = (0, 0, 0)
            else:
                b = math.radians(s["bearing_deg"]); gz = ground_z(height, z0, half, 0, 0)
                horiz = math.sqrt(max(s["slant_m"] ** 2 - (s["altitude_m"] - (z0 + gz)) ** 2, 1))
                co.location = (horiz * math.sin(b), horiz * math.cos(b), s["altitude_m"] - z0)
                d = Vector((0, 0, gz)) - co.location; co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
                cam.angle = math.radians(s["fov_deg"])
            sc.render.resolution_x, sc.render.resolution_y = s.get("px", [1600, 1200])
            sc.render.filepath = os.path.join(OUT, f"{tgt}_{s['name']}.png")
            bpy.ops.render.render(write_still=True)
            # where each unit lands in the image (0-1 from top left) and its ground elevation, for the folder's markup
            spots = {}
            for u in job["units"]:
                x, y = enu(job["lat"], job["lon"], u["lat"], u["lon"]); z = ground_z(height, z0, half, x, y)
                v = world_to_camera_view(sc, co, Vector((x, y, z + 1.5)))
                spots[u["name"]] = {"fx": round(v.x, 5), "fy": round(1 - v.y, 5), "elev_m": round(z + z0, 1)}
            json.dump({"target": tgt, "shot": s, "camera": list(co.location), "ground_z0_msl": z0, "attribution": area["attribution"],
                       "m_per_px": (s["width_m"] / sc.render.resolution_x) if s["kind"] == "ortho" else None, "units": spots},
                      open(os.path.join(OUT, f"{tgt}_{s['name']}.json"), "w"), indent=2)
            print(f"rendered {tgt}_{s['name']}.png")


if __name__ == "__main__":
    render(sys.argv[sys.argv.index("--") + 1])
