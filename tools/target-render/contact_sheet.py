"""Contact sheet: each model rendered alone, top and side, two ways, to see whether distortion is the model or this reader.

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P contact_sheet.py
    python contact_sheet.py --assemble

'pipeline' = render.build_model (node transforms applied). 'raw' = the file's vertices with only the EDM -> Blender axis
swap and no node transforms. Same camera and scale for every tile (grid lines every metre), real length noted.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(HERE, "out", "_sheet")
MODELS = [  # (unit type, real length m); first two are references that look right in the renders
    ("BMP-2", 6.7), ("T-72B", 9.5),
    ("Kub 2P25 ln", 7.4), ("Kub 1S91 str", 7.4), ("SA-11 Buk LN 9A310M1", 9.3), ("SA-11 Buk SR 9S18M1", 9.6),
    ("Osa 9A33 ln", 9.1), ("Tor 9A331", 7.5), ("S-300PS 40B6M tr", 12.0), ("S-300PS 64H6E sr", 12.0),
    ("ZU-23 Emplacement", 4.6), ("ATZ-10", 7.4), ("Grad-URAL", 7.4), ("Su-25", 15.3), ("MiG-29S", 17.3),
]


def blender_main():
    import bpy
    sys.path.insert(0, HERE)
    import render, shapes, edm_patch
    from mathutils import Vector

    def raw_model(shape):
        e = edm_patch.EDMFile(os.path.join(render.SHAPES, shape + ".edm")); objs = []
        for rn in e.renderNodes:
            if not getattr(rn, "vertexData", None) or not getattr(rn, "indexData", None): continue
            m = getattr(rn, "material", None); name = (getattr(m, "name", "") or "").lower()
            texs = getattr(m, "textures", []) if m else []
            if any(k in name + " " + " ".join(t.name.lower() for t in texs) for k in render.SKIP_PARTS): continue
            p = rn.parent; node = e.nodes[p] if isinstance(p, int) and p < len(e.nodes) else p if hasattr(p, "name") else None
            if render.lod_level(node) > 0: continue
            fmt = m.vertex_format if m else rn.vertex_format
            used = sorted(set(rn.indexData)); remap = {v: i for i, v in enumerate(used)}
            verts = [(render.TO_BLENDER @ Vector([rn.vertexData[v][k] for k in fmt.position_indices])).to_tuple() for v in used]
            tris = [tuple(remap[x] for x in rn.indexData[i:i + 3]) for i in range(0, len(rn.indexData) - 2, 3)]
            me = bpy.data.meshes.new(f"raw_{shape}_{len(objs)}"); me.from_pydata(verts, [], tris); me.update(); objs.append(bpy.data.objects.new(me.name, me))
        return objs

    os.makedirs(TILES, exist_ok=True)
    ip = os.path.join(TILES, "info.json"); info = json.load(open(ip)) if os.path.exists(ip) else {}
    only = [x for x in os.environ.get("SHEET_ONLY", "").split(";") if x]   # re-render just these types
    for t, real in MODELS:
        if only and t not in only: continue
        shape = shapes.resolve(t)
        for mode in ("pipeline", "raw"):
            bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
            sc.render.engine = "BLENDER_WORKBENCH"; sc.render.resolution_x = sc.render.resolution_y = 360
            sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "SINGLE"; sc.display.shading.single_color = (0.55, 0.6, 0.45)
            sc.display.shading.show_cavity = True
            try:
                objs = render.build_model(shape, False, {}) if mode == "pipeline" else raw_model(shape)
            except Exception as ex:
                info[f"{t}|{mode}"] = f"failed {type(ex).__name__}"; continue
            for o in objs: sc.collection.objects.link(o)
            vs = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
            if not vs: continue
            ext = [round(max(c) - min(c), 1) for c in zip(*vs)]
            info[f"{t}|{mode}"] = {"size": ext, "parts": len(objs)}
            span = 22.0                                               # same scale on every tile: 22 m across
            for i in range(-11, 12):                                  # 1 m ground grid
                for a, b in (((i, -11, 0), (i, 11, 0)), ((-11, i, 0), (11, i, 0))):
                    cu = bpy.data.curves.new("g", "CURVE"); cu.dimensions = "3D"; sp = cu.splines.new("POLY"); sp.points.add(1)
                    sp.points[0].co = (*a, 1); sp.points[1].co = (*b, 1); cu.bevel_depth = 0.015 if i % 5 else 0.04
                    sc.collection.objects.link(bpy.data.objects.new("g", cu))
            for view, loc, rot in (("top", (0, 0, 60), (0, 0, 0)), ("side", (0, -60, 2), (math.pi / 2, 0, 0))):
                cam = bpy.data.cameras.new(view); cam.type = "ORTHO"; cam.ortho_scale = span
                co = bpy.data.objects.new(view, cam); sc.collection.objects.link(co); co.location = loc; co.rotation_euler = rot; sc.camera = co
                sc.render.filepath = os.path.join(TILES, f"{shapes.resolve(t)}_{mode}_{view}.png"); bpy.ops.render.render(write_still=True)
            print(f"{t}: {mode} size {ext}")
    json.dump(info, open(os.path.join(TILES, "info.json"), "w"), indent=1)


def assemble():
    from PIL import Image, ImageDraw, ImageFont
    sys.path.insert(0, HERE); import shapes
    info = json.load(open(os.path.join(TILES, "info.json")))
    try: f = ImageFont.truetype("consola.ttf", 15); fb = ImageFont.truetype("consolab.ttf", 16)
    except OSError: f = fb = ImageFont.load_default()
    T, head, rowh = 360, 30, 360 + 60
    sheet = Image.new("RGB", (220 + 4 * T, head + rowh * len(MODELS)), (250, 250, 250)); d = ImageDraw.Draw(sheet)
    for k, lab in enumerate(("PIPELINE top", "PIPELINE side", "RAW top", "RAW side")): d.text((220 + k * T + 10, 8), lab, fill=(0, 0, 0), font=fb)
    for r, (t, real) in enumerate(MODELS):
        y = head + r * rowh; shape = shapes.resolve(t)
        d.text((10, y + 10), t, fill=(0, 0, 0), font=fb); d.text((10, y + 34), f"model {shape}", fill=(60, 60, 60), font=f)
        d.text((10, y + 56), f"real length {real} m", fill=(60, 60, 60), font=f)
        for j, mode in enumerate(("pipeline", "raw")):
            s = info.get(f"{t}|{mode}")
            txt = f"{mode}: {s['size'][0]}x{s['size'][1]}x{s['size'][2]} m" if isinstance(s, dict) else f"{mode}: {s}"
            d.text((10, y + 84 + j * 22), txt, fill=(0, 0, 0), font=f)
            for k, view in enumerate(("top", "side")):
                p = os.path.join(TILES, f"{shape}_{mode}_{view}.png")
                if os.path.exists(p): sheet.paste(Image.open(p).convert("RGB"), (220 + (2 * j + k) * T, y))
        d.line([(0, y + rowh - 4), (sheet.size[0], y + rowh - 4)], fill=(200, 200, 200), width=1)
    out = os.path.join(HERE, "out", "model_contact_sheet.png"); sheet.save(out); print("wrote", out)


if __name__ == "__main__":
    if "--assemble" in sys.argv: assemble()
    else: blender_main()
