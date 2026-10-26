"""DCS unit type -> readable model file in Bazar\\World\\Shapes.

Legacy unit models have short code names (9a310m1, 2p25, 5p85c); the type names mostly contain them, so the longest
model name found inside the type name wins. OVERRIDES covers types whose model name doesn't appear in the type name.
Destroyed (_p_1), collision and LOD models are never used.
"""
import os, re

SHAPES = r"C:\Program Files\Eagle Dynamics\DCS World\Bazar\World\Shapes"
OVERRIDES = {
    "SAU Msta": "2-c19", "SAU Gvozdika": "2-c1", "SAU Akatsia": "2-c3", "SAU 2-C9": "2-c9",
    "ZSU-23-4 Shilka": "zsu-23-4", "Ural-375": "ural-375-f", "Ural-375 PBU": "ural-375-f", "Ural-375 ZU-23": "ural_zu-23",
    "Grad-URAL": "bm-21-40", "UAZ-469": "uaz-469", "ATZ-10": "ural_atz-10", "Comms tower M": "tele_bash_m",
    ".Ammunition depot": "sklad", "Fuel tank": "bak", "Strela-1 9P31": "9p31", "Strela-10M3": "9a35",
    "SA-18 Igla manpad": "igla", "Infantry AK": "soldier_ak", "SKP-11": "skp-11", "BTR_D": "btr-d",
    "S-300PS 64H6E sr": "64h6e", "S-300PS 54K6 cp": "54k6", "SA-11 Buk CC 9S470M1": "9s470m1", "SA-11 Buk SR 9S18M1": "9s18m1",
    "Kub 1S91 str": "1s91", "Tor 9A331": "9a331", "Osa 9A33 ln": "9a33", "T-72B": "t-72", "T-80UD": "t-80ud", "T-55": "t-55",
}
_norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
_shapes = None


def _load():
    global _shapes
    if _shapes is None:
        _shapes = {}
        for f in os.listdir(SHAPES):
            base, ext = os.path.splitext(f)
            if ext.lower() != ".edm": continue
            b = base.lower()
            if b.endswith(("_p_1", "_p_2", "_p_3")) or any(k in b for k in ("collision", "colliison", "lod", "oblomok", "_dstr")): continue
            _shapes[b] = base
    return _shapes


def resolve(unit_type):
    s = _load()
    o = OVERRIDES.get(unit_type)
    if o and o.lower() in s: return s[o.lower()]
    t = _norm(unit_type)
    best = max((k for k in s if len(_norm(k)) >= 4 and _norm(k) in t), key=lambda k: len(_norm(k)), default=None)
    return s[best] if best else None


if __name__ == "__main__":
    import sys, zipfile
    miz = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "samples", "iron_trident_host_draft_v2.miz")
    m = zipfile.ZipFile(miz).read("mission").decode("utf-8", "replace")
    types = sorted(set(re.findall(r'\["type"\]\s*=\s*"([^"]+)"', m[m.find('["red"]'):])) - {"Turning Point", "TakeOffParking", "TakeOff", "Land"})
    for t in types: print(f"  {t:26} -> {resolve(t)}")
