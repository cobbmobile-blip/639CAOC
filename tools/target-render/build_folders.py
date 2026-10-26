"""Build the imagery for every target folder in one go, from the TDP book's "Export imagery jobs" file.

    python build_folders.py "OP NAME-imagery-jobs.json"

For each target: satellite imagery and elevation around it (fetch_area), the site and TGP views rendered in Blender with
the mission's units (render.py), plus a wide orientation image, a topographic JOG and a locator map from map tiles.
Writes web-ready JPEGs and meta.json to <site>/img/targets/<campaign>/<target>/, where folder.html picks them up; the
site markup (callouts, CEs, JDPIs, CER) is drawn by the page from meta.json, so re-editing a folder never needs a
re-render. Commit img/targets/ with the site to publish the images.
"""
import argparse, datetime, json, math, os, subprocess, sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fetch_area as FA  # noqa: E402
import post  # noqa: E402

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
SITE = os.path.normpath(os.path.join(HERE, "..", ".."))
TOPO = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
SAT_ATTR = "Esri, Maxar, Earthstar Geographics"
TOPO_ATTR = "Esri, HERE, Garmin, USGS, NGA"
ASPECT = 1.6                      # folder graphics are 16:10
TILES = os.path.join(HERE, "cache", "_tiles")


def enu(lat0, lon0, lat, lon):
    return (math.radians(lon - lon0) * FA.R * math.cos(math.radians(lat0)), math.radians(lat - lat0) * FA.R)


def save_jpg(im, path, width=None):
    if width and im.size[0] > width: im = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
    im.convert("RGB").save(path, quality=84, optimize=True)


def tile_image(dst, template, z, lat, lon, width_m, kind, attribution):
    """A north-up tile mosaic centred on the target, width_m across at 16:10; returns its meta entry."""
    im = FA.mosaic(template, z, lat, lon, width_m / 2, TILES, kind, half_y=width_m / ASPECT / 2)
    save_jpg(im, dst, 2400)
    return {"file": os.path.basename(dst), "width_m": width_m, "height_m": round(width_m / ASPECT), "attribution": attribution}


def build(t, out_dir, cache_root, keep):
    tgt, lat, lon = t["target"], t["lat"], t["lon"]
    units = [u for u in t["units"] if u.get("lat") is not None]
    off = [enu(lat, lon, u["lat"], u["lon"]) for u in units] or [(0, 0)]
    se, sn = max(abs(e) for e, _ in off), max(abs(n) for _, n in off)
    # every unit in view on both axes (16:10 frame), never closer than 160 m across
    site_w = min(max(2 * se * 1.3 + 80, (2 * sn * 1.3 + 80) * ASPECT, 160), 1600)
    area = max(1200, site_w + 500)
    cdir = os.path.join(cache_root, tgt); os.makedirs(cdir, exist_ok=True); os.makedirs(out_dir, exist_ok=True)
    print(f"{tgt} {t['name']}: {len(units)} units, site view {site_w:.0f} m")

    # ground for the 3D views
    ortho = FA.mosaic(FA.IMAGERY, 18, lat, lon, area / 2, TILES, "esri"); ortho.save(os.path.join(cdir, "ortho.png"))
    dem = np.asarray(FA.mosaic(FA.TERRAIN, 15, lat, lon, area / 2, TILES, "terrarium")).astype(np.float32)
    height = dem[..., 0] * 256 + dem[..., 1] + dem[..., 2] / 256 - 32768
    np.save(os.path.join(cdir, "height.npy"), height)
    json.dump({"target": tgt, "lat": lat, "lon": lon, "size_m": area, "attribution": SAT_ATTR}, open(os.path.join(cdir, "area.json"), "w"))

    slant = 9260                                                   # TGP: 5 NM slant from 15,000 ft, framed on the site
    job = {"target": tgt, "name": t["name"], "lat": lat, "lon": lon,
           "units": [{"name": u["name"], "type": u["type"], "lat": u["lat"], "lon": u["lon"], "heading_deg": u.get("heading") or 0} for u in units],
           "shots": [{"name": "site", "kind": "ortho", "width_m": round(site_w), "px": [2400, round(2400 / ASPECT)]},
                     {"name": "tgp", "kind": "oblique", "bearing_deg": int(t.get("tgp_bearing", 225)), "slant_m": slant, "altitude_m": 4572,
                      "fov_deg": 2.2, "px": [1600, 1000]}]}       # narrow-field stare on the critical element
    jp = os.path.join(cdir, "job.json"); json.dump(job, open(jp, "w"), indent=1)
    r = subprocess.run([BLENDER, "-b", "-P", os.path.join(HERE, "render.py"), "--", jp], capture_output=True, text=True)
    if r.returncode or "rendered" not in r.stdout:
        print(r.stdout[-2000:], r.stderr[-2000:]); raise RuntimeError(f"{tgt}: Blender render failed")

    meta = {"target": tgt, "name": t["name"], "lat": lat, "lon": lon, "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "images": {}, "units": [{k: u.get(k) for k in ("name", "type", "lat", "lon", "heading")} for u in units]}
    for s in job["shots"]:
        src = os.path.join(post.OUT, f"{tgt}_{s['name']}.png"); side = json.load(open(src[:-4] + ".json"))
        im = Image.open(src).convert("RGB")
        if s["kind"] == "oblique": im = post.tgp(im, job, s)       # sensor look + data block; markings come from the page
        save_jpg(im, os.path.join(out_dir, f"{s['name']}.jpg"))
        meta["images"][s["name"]] = {"file": f"{s['name']}.jpg", "attribution": SAT_ATTR, **{k: s[k] for k in s if k not in ("name", "px")},
                                     "spots": side["units"]}
        if s["kind"] == "ortho": meta["images"][s["name"]]["height_m"] = round(s["width_m"] / ASPECT)
    for u in meta["units"]: u["elev_m"] = meta["images"]["site"]["spots"].get(u["name"], {}).get("elev_m")
    meta["elev_m"] = round(float(height[height.shape[0] // 2, height.shape[1] // 2]), 1)

    meta["images"]["orient"] = tile_image(os.path.join(out_dir, "orient.jpg"), FA.IMAGERY, 16, lat, lon, 6000, "esri", SAT_ATTR)
    meta["images"]["jog"] = tile_image(os.path.join(out_dir, "jog.jpg"), TOPO, 12, lat, lon, 40000, "topo", TOPO_ATTR)
    meta["images"]["locator"] = tile_image(os.path.join(out_dir, "locator.jpg"), TOPO, 6, lat, lon, 900000, "topo", TOPO_ATTR)
    json.dump(meta, open(os.path.join(out_dir, "meta.json"), "w"), indent=1)
    if not keep:
        for s in job["shots"]:
            for ext in (".png", ".json"):
                try: os.remove(os.path.join(post.OUT, f"{tgt}_{s['name']}{ext}"))
                except OSError: pass
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs", help="imagery jobs file exported from the TDP book")
    ap.add_argument("--site", default=SITE, help="site folder that holds img/ (default: this repo)")
    ap.add_argument("--only", help="comma-separated target numbers to (re)build")
    ap.add_argument("--keep", action="store_true", help="keep the raw renders in out/")
    a = ap.parse_args()
    jobs = json.load(open(a.jobs, encoding="utf-8")); cid = jobs["campaign"]
    root = os.path.join(a.site, "img", "targets", cid); os.makedirs(root, exist_ok=True)
    idx_path = os.path.join(root, "index.json")
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    only = set(a.only.split(",")) if a.only else None
    done, failed = 0, []
    for t in jobs["targets"]:
        if only and t["target"] not in only: continue
        try:
            m = build(t, os.path.join(root, t["target"]), os.path.join(HERE, "cache", cid), a.keep)
            index[t["target"]] = {"name": m["name"], "generated": m["generated"]}; done += 1
            json.dump(index, open(idx_path, "w"), indent=1)
        except Exception as ex:
            failed.append(t["target"]); print(f"  {t['target']} failed: {ex}")
    print(f"{done} folder image set{'s' if done != 1 else ''} written to {root}" + (f"; failed: {', '.join(failed)}" if failed else ""))


if __name__ == "__main__":
    main()
