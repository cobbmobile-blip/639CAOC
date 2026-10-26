"""Check the pipeline in other theaters and with other unit types: builds test jobs, fetches ground, renders, post-processes.

    python theater_test.py            # all sites
    python theater_test.py SYR        # one site

Each site is a made-up but plausible layout around real ground in that DCS theater; unit types are DCS type names.
"""
import json, math, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"

SITES = {
    "SYR": ("TSYR01", "SA-11 BATTERY DUMAYR (SYRIA)", 33.60, 36.70, [          # open desert east of Damascus
        ("SA-11 Buk SR 9S18M1", 0, 0, 0), ("SA-11 Buk CC 9S470M1", -60, 40, 90),
        ("SA-11 Buk LN 9A310M1", 120, 90, 30), ("SA-11 Buk LN 9A310M1", 130, -100, 150), ("SA-11 Buk LN 9A310M1", -140, -80, 240),
        ("ZSU-23-4 Shilka", 40, 160, 0), ("Ural-375", -90, 120, 270)]),
    "NEV": ("TNEV01", "ARMOR COLUMN TOLICHA PEAK (NEVADA)", 37.28, -116.20, [  # NTTR range ground
        ("T-72B", -150, 0, 90), ("T-72B", -110, 0, 90), ("T-72B", -70, 0, 90), ("BMP-2", -30, 5, 90), ("BMP-2", 10, 5, 90),
        ("Ural-375", 60, 10, 90), ("ATZ-10", 100, 10, 90), ("ZSU-23-4 Shilka", 140, 0, 90)]),
    "PG": ("TPG01", "SA-6 BATTERY QESHM (PERSIAN GULF)", 26.80, 55.85, [        # coastal island ground
        ("Kub 1S91 str", 0, 0, 0), ("Kub 2P25 ln", 110, 60, 45), ("Kub 2P25 ln", 100, -90, 135),
        ("Kub 2P25 ln", -120, -50, 225), ("ZU-23 Emplacement", 30, 140, 0), ("Grad-URAL", -150, 120, 300)]),
}


def offset(lat, lon, dx, dy):
    return lat + math.degrees(dy / 6378137), lon + math.degrees(dx / (6378137 * math.cos(math.radians(lat))))


def run(key):
    tgt, name, lat, lon, units = SITES[key]
    cdir = os.path.join(HERE, "cache", tgt); os.makedirs(cdir, exist_ok=True)
    subprocess.run([sys.executable, os.path.join(HERE, "fetch_area.py"), tgt, str(lat), str(lon), "--size", "1200"], check=True)
    job = {"target": tgt, "name": name, "lat": lat, "lon": lon,
           "units": [dict(zip(("lat", "lon"), offset(lat, lon, dx, dy)), name=f"{tgt}-{i}", type=t, heading_deg=h) for i, (t, dx, dy, h) in enumerate(units, 1)],
           "shots": [{"name": "close", "kind": "ortho", "width_m": 420, "px": [2400, 1800]},
                     {"name": "orientation", "kind": "ortho", "width_m": 1100, "px": [3200, 2400]},
                     {"name": "tgp", "kind": "oblique", "bearing_deg": 200, "slant_m": 9260, "altitude_m": 4572, "fov_deg": 2.4}]}
    jp = os.path.join(cdir, "job.json"); json.dump(job, open(jp, "w"), indent=2)
    r = subprocess.run([BLENDER, "-b", "-P", os.path.join(HERE, "render.py"), "--", jp], capture_output=True, text=True)
    print("\n".join(l for l in r.stdout.splitlines() if l.startswith("rendered") or "Error" in l or "Traceback" in l))
    if r.returncode: print(r.stderr[-1500:])
    subprocess.run([sys.executable, os.path.join(HERE, "post.py"), jp], check=True)


if __name__ == "__main__":
    for k in (sys.argv[1:] or SITES): run(k)
