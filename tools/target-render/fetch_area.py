"""Fetch the ground for one target: satellite imagery and elevation, stitched and cropped to a square around the target.

    python fetch_area.py T10001 42.27 42.82 --size 1200

Writes cache/<target>/ortho.png (imagery, north up), cache/<target>/height.npy (metres MSL, same extent, coarser grid)
and cache/<target>/area.json (extent in metres east/north of the target). Imagery: Esri World Imagery (attribution
"Esri, Maxar, Earthstar Geographics" must stay on every product image). Elevation: AWS Terrain Tiles (terrarium).
"""
import argparse, io, json, math, os, sys, time, urllib.error, urllib.request

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# blankTile=false: a missing tile is a 404 rather than a "Map data not yet available" picture, so mosaic() can fall back
IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false"
TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
UA = {"User-Agent": "vCAOC-target-render/0.1 (non-commercial DCS training)"}
R = 6378137.0


def merc(lat, lon):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def tile_of(mx, my, z):
    n = 2 ** z; span = 2 * math.pi * R
    return (mx + span / 2) / span * n, (span / 2 - my) / span * n


def fetch(url, cache):
    """The tile image, or None when the server has no tile there (404, remembered in the cache)."""
    if os.path.exists(cache): return Image.open(cache)
    if os.path.exists(cache + ".missing"): return None
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read()
            os.makedirs(os.path.dirname(cache), exist_ok=True); open(cache, "wb").write(data)
            return Image.open(io.BytesIO(data))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                os.makedirs(os.path.dirname(cache), exist_ok=True); open(cache + ".missing", "w").close(); return None
            if attempt == 2: raise RuntimeError(f"{url}: {e}")
        except Exception as e:
            if attempt == 2: raise RuntimeError(f"{url}: {e}")
        time.sleep(1.5)


def tile(template, z, x, y, cache_dir, kind, depth=0):
    """One 256 px tile; where the server has none at this zoom (Esri at high latitudes), the matching quarter of the
    parent tile, enlarged, down to 5 levels coarser. Returns (image, zoom actually used)."""
    im = fetch(template.format(z=z, x=x, y=y), os.path.join(cache_dir, kind, str(z), f"{x}_{y}.png"))
    if im is not None: return im.convert("RGB"), z
    if depth >= 5 or z == 0: return Image.new("RGB", (256, 256), (128, 128, 128)), z
    parent, used = tile(template, z - 1, x // 2, y // 2, cache_dir, kind, depth + 1)
    h = parent.size[0] // 2
    return parent.crop(((x % 2) * h, (y % 2) * h, (x % 2) * h + h, (y % 2) * h + h)).resize((h * 2, h * 2), Image.BICUBIC), used


def mosaic(template, z, lat, lon, half_m, cache_dir, kind, half_y=None):
    """Stitch the tiles covering +-half_m east-west by +-half_y north-south (ground metres; square by default) and crop it
    exactly; returns the image."""
    half_y = half_m if half_y is None else half_y
    mx, my = merc(lat, lon); k = 1 / math.cos(math.radians(lat))   # mercator metres per ground metre
    x0, y0 = tile_of(mx - half_m * k, my + half_y * k, z); x1, y1 = tile_of(mx + half_m * k, my - half_y * k, z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    size = None; canvas = None; coarsest = z
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            im, used = tile(template, z, tx, ty, cache_dir, kind); coarsest = min(coarsest, used)
            if canvas is None:
                size = im.size[0]; canvas = Image.new("RGB", ((tx1 - tx0 + 1) * size, (ty1 - ty0 + 1) * size))
            canvas.paste(im, ((tx - tx0) * size, (ty - ty0) * size))
    box = [round((x0 - tx0) * size), round((y0 - ty0) * size), round((x1 - tx0) * size), round((y1 - ty0) * size)]
    if coarsest < z: print(f"  {kind}: no z{z} tiles in part of the area, used down to z{coarsest}")
    return canvas.crop(box)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target"); ap.add_argument("lat", type=float); ap.add_argument("lon", type=float)
    ap.add_argument("--size", type=float, default=1200, help="side of the square area, metres")
    ap.add_argument("--zoom", type=int, default=18, help="imagery zoom (18 ~ 0.45 m/px at 42N)")
    a = ap.parse_args()
    out = os.path.join(HERE, "cache", a.target); tiles = os.path.join(HERE, "cache", "_tiles"); os.makedirs(out, exist_ok=True)
    half = a.size / 2
    print(f"{a.target}: imagery z{a.zoom}, {a.size:.0f} m square")
    ortho = mosaic(IMAGERY, a.zoom, a.lat, a.lon, half, tiles, "esri")
    ortho.save(os.path.join(out, "ortho.png"))
    hz = 15
    dem = mosaic(TERRAIN, hz, a.lat, a.lon, half, tiles, "terrarium")
    arr = np.asarray(dem).astype(np.float32)
    height = arr[..., 0] * 256 + arr[..., 1] + arr[..., 2] / 256 - 32768     # terrarium decoding
    np.save(os.path.join(out, "height.npy"), height)
    json.dump({"target": a.target, "lat": a.lat, "lon": a.lon, "size_m": a.size, "ortho_px": ortho.size, "height_px": list(height.shape[::-1]),
               "height_min": float(height.min()), "height_max": float(height.max()), "attribution": "Esri, Maxar, Earthstar Geographics"},
              open(os.path.join(out, "area.json"), "w"), indent=2)
    print(f"  ortho {ortho.size[0]}x{ortho.size[1]} px ({a.size / ortho.size[0]:.2f} m/px), height {height.shape[1]}x{height.shape[0]} "
          f"({height.min():.0f}-{height.max():.0f} m MSL)")


if __name__ == "__main__":
    main()
