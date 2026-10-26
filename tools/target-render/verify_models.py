"""Check that common unit models come out the right size; writes cache/model_check.json (used by render.py).

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P verify_models.py

A model is 'good' when its length is within 30% of the real vehicle's; others still render but are flagged. Length alone
misses parts that are misplaced but inside the outline (MiG-29), so check new types on the contact sheet too.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render, shapes  # noqa: E402

LENGTH_M = {  # approximate real overall lengths (guns forward; tractor-trailers, revetments and the 40B6M mast stays included)
    "T-72B": 10.0, "BMP-2": 6.7, "BTR_D": 5.9, "ZSU-23-4 Shilka": 6.5, "Ural-375": 7.4, "ATZ-10": 7.4, "UAZ-469": 4.0, "Grad-URAL": 7.4,
    "SA-11 Buk LN 9A310M1": 9.3, "SA-11 Buk SR 9S18M1": 9.6, "SA-11 Buk CC 9S470M1": 9.5, "Kub 1S91 str": 7.4, "Kub 2P25 ln": 7.0,
    "Osa 9A33 ln": 9.1, "Tor 9A331": 7.5, "S-300PS 5P85C ln": 11.5, "S-300PS 40B6M tr": 20.0, "S-300PS 64H6E sr": 20.0,
    "S-300PS 54K6 cp": 11.5, "SAU Msta": 11.9, "ZU-23 Emplacement": 8.5, "Su-25": 15.3, "MiG-29S": 17.3,
}


def main():
    out = {}
    for t, real in LENGTH_M.items():
        shape = shapes.resolve(t)
        if not shape: out[t] = {"shape": None, "status": "no model"}; continue
        try:
            objs = render.build_model(shape, False, {})
            vs = [v.co for o in objs for v in o.data.vertices]
            L = max(max(v.x for v in vs) - min(v.x for v in vs), max(v.y for v in vs) - min(v.y for v in vs))
            ok = abs(L - real) / real <= 0.30
            out[t] = {"shape": shape, "length_m": round(L, 1), "real_m": real, "status": "good" if ok else "check"}
        except Exception as ex:
            out[t] = {"shape": shape, "status": f"failed: {type(ex).__name__}"}
        r = out[t]; print(f"{t:24} {str(r.get('shape')):10} {str(r.get('length_m', '')):>6} m (real {real}) {r['status']}")
    json.dump(out, open(os.path.join(render.HERE, "cache", "model_check.json"), "w"), indent=1)
    good = sum(1 for r in out.values() if r["status"] == "good"); print(f"{good} of {len(out)} good")


main()
