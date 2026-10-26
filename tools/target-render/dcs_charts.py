"""The DCS F10 map's Chart layer, read from the terrain files: a JOG-style chart around a point.

    python dcs_charts.py Caucasus 42.27 42.82 out.png        # quick look, 40 km across

Each terrain ships its raster charts as DDS tiles (Mods/terrains/<theater>/RasterCharts, plain zips) and an index,
rasterCharts.sup5, whose geometry block holds one quad per tile in DCS map coordinates (x north, z east, metres) in the
same order as the tile names in its material list. Lat/lon -> map x/z uses a Transverse Mercator fitted to the
terrain's own Beacons.lua, where every beacon has both. The chart is drawn in the map grid (grid north up, as on the
F10 map); north_deg says where true north points in it.
"""
import io, json, math, os, re, struct, sys, zipfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TERRAINS = r"C:\Program Files\Eagle Dynamics\DCS World\Mods\terrains"
CACHE = os.path.join(HERE, "cache", "charts")
A, F = 6378137.0, 1 / 298.257223563
E2 = F * (2 - F); EP2 = E2 / (1 - E2)


# ---------- projection: TM fitted to the terrain's beacons ----------
def tm(lat, lon, lon0):
    """Snyder forward Transverse Mercator, unit scale, no offsets -> (northing, easting) metres."""
    p = np.radians(lat); s, c, t = np.sin(p), np.cos(p), np.tan(p)
    N = A / np.sqrt(1 - E2 * s * s); T = t * t; C = EP2 * c * c; a = np.radians(lon - lon0) * c
    M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * p - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * np.sin(2 * p)
             + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * np.sin(4 * p) - (35 * E2 ** 3 / 3072) * np.sin(6 * p))
    e = N * (a + (1 - T + C) * a ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * a ** 5 / 120)
    n = M + N * t * (a * a / 2 + (5 - T + 9 * C + 4 * C * C) * a ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * a ** 6 / 720)
    return n, e


def beacons(theater):
    txt = open(os.path.join(TERRAINS, theater, "Beacons.lua"), encoding="utf-8", errors="replace").read()
    pts = re.findall(r"position\s*=\s*\{\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\}\s*;.*?positionGeo\s*=\s*\{\s*latitude\s*=\s*([-\d.]+)\s*,\s*longitude\s*=\s*([-\d.]+)", txt, re.S)
    return np.array([[float(v) for v in q] for q in pts])          # x, z, lat, lon


def projection(theater):
    os.makedirs(CACHE, exist_ok=True); path = os.path.join(CACHE, "projections.json")
    known = json.load(open(path)) if os.path.exists(path) else {}
    if theater in known: return known[theater]
    b = beacons(theater)
    if len(b) < 4: raise RuntimeError(f"{theater}: not enough beacons with geographic positions to place its charts")
    x, z, lat, lon = b.T
    def solve(lon0):        # x = FN + k*n, z = FE + k*e, least squares in k, FN, FE together
        n, e = tm(lat, lon, lon0)
        M = np.zeros((2 * len(x), 3)); M[:len(x), 0] = n; M[:len(x), 1] = 1; M[len(x):, 0] = e; M[len(x):, 2] = 1
        sol, *_ = np.linalg.lstsq(M, np.concatenate([x, z]), rcond=None)
        res = np.hypot(sol[0] * n + sol[1] - x, sol[0] * e + sol[2] - z)
        return sol, float(np.sqrt((res ** 2).mean())), float(res.max())
    lo, hi = float(lon.mean()) - 15, float(lon.mean()) + 15
    for _ in range(80):                                            # golden-section search on the central meridian
        m1, m2 = lo + (hi - lo) * 0.382, lo + (hi - lo) * 0.618
        if solve(m1)[1] < solve(m2)[1]: hi = m2
        else: lo = m1
    lon0 = (lo + hi) / 2; (k, fn, fe), rms, worst = solve(lon0)
    known[theater] = p = {"lon0": lon0, "k": k, "fn": fn, "fe": fe, "rms_m": round(rms, 2), "max_m": round(worst, 2), "beacons": len(x)}
    json.dump(known, open(path, "w"), indent=1)
    return p


def to_map(p, lat, lon):
    n, e = tm(np.asarray(lat, float), np.asarray(lon, float), p["lon0"])
    return p["fn"] + p["k"] * n, p["fe"] + p["k"] * e


# ---------- chart index ----------
def chart_index(theater):
    """[(tile name, metres per px, xmin, xmax, zmin, zmax)] for every chart tile, plus {tile name: zip path}."""
    rc = os.path.join(TERRAINS, theater, "RasterCharts")
    b = open(os.path.join(rc, "rasterCharts.sup5"), "rb").read()
    names = [m.decode() for m in re.findall(rb"([0-9A-Za-z_\-]+)\.tif", b)]
    # geometry: per tile 4 vertices (x, y, z floats), 4 uv pairs, then the indices 0 1 2 0 2 3; one record per tile name,
    # in the same order, in blocks with headers between them, so records are found by their index signature
    sig = struct.pack("<6i", 0, 1, 2, 0, 2, 3)
    recs = [m.start() - 80 for m in re.finditer(re.escape(sig), b)]
    if len(recs) != len(names): raise RuntimeError(f"{theater}: {len(names)} chart tiles but {len(recs)} quads in rasterCharts.sup5")
    quads = []
    for off in recs:
        f = struct.unpack_from("<12f", b, off); xs, zs = f[0:12:3], f[2:12:3]
        quads.append((min(xs), max(xs), min(zs), max(zs)))
    zips = {}
    for root, _, files in os.walk(rc):
        for fn in files:
            if fn.lower().endswith(".zip"):
                for n in zipfile.ZipFile(os.path.join(root, fn)).namelist(): zips[n.lower()[:-len(".tif.dds")]] = os.path.join(root, fn)
    tiles = []
    for nm, (x0, x1, z0, z1) in zip(names, quads):
        mpp = (z1 - z0) / 1024                                     # tiles are 1024 px square
        tiles.append((nm, mpp, x0, x1, z0, z1))
    return tiles, zips


_open = {}
def tile_image(zips, name):
    zp = zips.get(name.lower())
    if not zp: return None
    if zp not in _open: _open[zp] = zipfile.ZipFile(zp)
    return Image.open(io.BytesIO(_open[zp].read(name.lower() + ".tif.dds"))).convert("RGB")


def chart(theater, lat, lon, width_m, height_m, out_w=2400):
    """North-grid-up chart image centred on lat/lon from the finest scale that covers it; returns (image, info)."""
    p = projection(theater); cx, cz = (float(v) for v in to_map(p, lat, lon))
    nx, nz = (float(v) for v in to_map(p, lat + 1000 / 111320, lon))
    rm = A * (1 - E2) / (1 - E2 * math.sin(math.radians(lat)) ** 2) ** 1.5    # meridian radius of curvature
    k = math.hypot(nx - cx, nz - cz) / (rm * math.radians(1000 / 111320))      # grid metres per ground metre here
    width_m, height_m = width_m * k, height_m * k
    tiles, zips = chart_index(theater)
    bx0, bx1, bz0, bz1 = cx - height_m / 2, cx + height_m / 2, cz - width_m / 2, cz + width_m / 2
    have = lambda t, x, z: t[2] <= x <= t[3] and t[4] <= z <= t[5]
    scales = sorted({round(t[1]) for t in tiles})
    for s in scales:        # finest scale whose tiles cover the box's centre and corners
        ts = [t for t in tiles if round(t[1]) == s and t[0].lower() in zips]
        if all(any(have(t, x, z) for t in ts) for x, z in ((cx, cz), (bx0, bz0), (bx0, bz1), (bx1, bz0), (bx1, bz1))): break
    else:
        s = scales[-1]; ts = [t for t in tiles if round(t[1]) == s]
        if not any(have(t, cx, cz) for t in ts): raise RuntimeError(f"{theater}: no chart covers {lat:.3f}, {lon:.3f}")
    W, H = round(width_m / s), round(height_m / s)
    canvas = Image.new("RGB", (W, H), (235, 235, 230))
    for t in ts:
        nm, mpp, x0, x1, z0, z1 = t
        if x1 < bx0 or x0 > bx1 or z1 < bz0 or z0 > bz1: continue
        im = tile_image(zips, nm)
        if im is None: continue
        # tile: column 0 at z0 (west), row 0 at x1 (grid north)
        px, py = (z0 - bz0) / s, (bx1 - x1) / s
        tw, th = round((z1 - z0) / s), round((x1 - x0) / s)
        if (tw, th) != im.size: im = im.resize((tw, th), Image.LANCZOS)
        canvas.paste(im, (round(px), round(py)))
    if out_w and W != out_w: canvas = canvas.resize((out_w, round(H * out_w / W)), Image.LANCZOS)
    # true north in the grid: direction to a point 1 km north, degrees clockwise from grid-up
    north = math.degrees(math.atan2(nz - cz, nx - cx)) % 360
    north = north - 360 if north > 180 else north
    return canvas, {"scale_m_per_px": s, "north_deg": round(north, 2), "map_x": round(cx, 1), "map_z": round(cz, 1),
                    "projection_rms_m": p["rms_m"]}


def theater_for(lat, lon):
    """The installed terrain whose beacons surround the point (nearest beacon within 300 km)."""
    best = None
    for t in sorted(os.listdir(TERRAINS)):
        if not os.path.exists(os.path.join(TERRAINS, t, "RasterCharts", "rasterCharts.sup5")): continue
        try: b = beacons(t)
        except OSError: continue
        if not len(b): continue
        d = np.hypot((b[:, 2] - lat) * 111.3, (b[:, 3] - lon) * 111.3 * math.cos(math.radians(lat))).min()
        if d < 300 and (best is None or d < best[1]): best = (t, d)
    return best[0] if best else None


if __name__ == "__main__":
    th, la, lo, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
    im, info = chart(th, la, lo, 40000, 25000)
    im.save(out); print(info, projection(th))
