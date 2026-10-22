#!/usr/bin/env python3
"""
Build the vCAOC JCEOI data file (js/jceoi-data.js) from:
  data/dcs_*.json            in-game ATC radios and nav beacons (extract_dcs.py, extract_pydcs.py)
  src/ourairports_*.csv      real-world civil frequencies and navaids (OurAirports, public domain)
  data/military.json         real-world military frequencies with source and confidence

and generate the standard Blue net plan: every channel of the Comm Plan (ACP) template in js/products.js, each with
UHF primary/alternate, VHF-AM backup, and VHF-FM / HF where the net needs them, every one clear
of every documented frequency in every theater.

Run:  python -I build.py           writes ../../js/jceoi-data.js (refuses on any conflict or template mismatch)
      python -I build.py --check   only checks that js/jceoi-data.js is current with the ACP template
"""
import csv, json, os, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from theaters import THEATERS  # noqa: E402

VERSION = "26-1"
OUT = os.path.join(HERE, "..", "..", "js", "jceoi-data.js")

# assignable ranges (what DCS aircraft radios tune: ARC-164/210 UHF, ARC-186 VHF AM/FM, Jadro/ARC-220 HF)
BANDS = {"HF": (2.0, 29.999, 0.001), "VHF-FM": (30.0, 87.975, 0.025), "VHF-AM": (116.0, 151.975, 0.025), "UHF": (225.0, 399.975, 0.025)}
# a plan frequency must be at least this far from anything documented (same or adjacent channel = conflict)
SEP = {"HF": 0.003, "VHF-FM": 0.025, "VHF-AM": 0.025, "UHF": 0.025}
GUARD_ZONE = 0.1   # keep 100 kHz either side of 121.5 and 243.0


def band_of(f):
    if 2.0 <= f < 30: return "HF"
    if 30 <= f < 88: return "VHF-FM"
    if 108 <= f < 118: return "VHF-NAV"
    if 118 <= f < 156: return "VHF-AM"
    if 156 <= f < 174: return "VHF-MAR"
    if 225 <= f < 400: return "UHF"
    if f < 2.0: return "LF/MF"
    return "OTHER"


def inside(box, lat, lon):
    S, N, W, E = box
    return S <= lat <= N and W <= lon <= E


def load_ourairports():
    ap = {r["ident"]: r for r in csv.DictReader(open(os.path.join(HERE, "src", "ourairports_airports.csv"), encoding="utf-8"))}
    fr = list(csv.DictReader(open(os.path.join(HERE, "src", "ourairports_airport-frequencies.csv"), encoding="utf-8")))
    nv = list(csv.DictReader(open(os.path.join(HERE, "src", "ourairports_navaids.csv"), encoding="utf-8")))
    return ap, fr, nv


def register_for(key, stem, box, ap, fr, nv, mil):
    reg, tacan = [], []
    def add(**e):
        e["band"] = band_of(e["mhz"]); reg.append(e)
    if stem:
        d = json.load(open(os.path.join(HERE, "data", f"dcs_{stem}.json"), encoding="utf-8"))
        for r in d["radios"]:
            add(site=r["site"], icao="", use=f"DCS ATC ({r['band']})", mhz=r["mhz"], kind="dcs", src="DCS", conf="official")
        for b in d["beacons"]:
            if b["mhz"] and b["type"] not in ("TACAN",):
                add(site=b["site"], icao="", use=f"DCS beacon {b['type'].replace('_', ' ').lower()} {b['callsign']}".strip(), mhz=b["mhz"], kind="dcs-nav", src="DCS", conf="official")
            if b["tacan"]:
                tacan.append({"site": b["site"], "ch": b["tacan"], "callsign": b["callsign"], "type": b["type"]})
    for f in fr:
        a = ap.get(f["airport_ident"])
        if not a or not f["frequency_mhz"]: continue
        try: lat, lon = float(a["latitude_deg"]), float(a["longitude_deg"])
        except ValueError: continue
        if inside(box, lat, lon):
            add(site=a["name"], icao=a["gps_code"] or a["ident"], use=" ".join(x for x in (f["type"], f["description"]) if x),
                mhz=round(float(f["frequency_mhz"]), 4), kind="civil", src="OurAirports", conf="public")
    for n in nv:
        if not n["frequency_khz"]: continue
        try: lat, lon = float(n["latitude_deg"]), float(n["longitude_deg"])
        except ValueError: continue
        if inside(box, lat, lon):
            add(site=n["name"], icao=n["ident"], use=f"navaid {n['type']}", mhz=round(float(n["frequency_khz"]) / 1000, 4), kind="nav", src="OurAirports", conf="public")
    for t, icao, site, use, fs, src, conf in mil["entries"]:
        if t == key:
            for m in fs:
                add(site=site, icao=icao, use=use, mhz=m, kind="military", src=src, conf=conf)
    reg.sort(key=lambda e: (e["mhz"], e["site"]))
    return reg, tacan


# ---------- the standard Blue net plan ----------
# The net list (colour, net name, roles per row) comes from the Comm Plan (ACP) template, COMM_TEMPLATE in
# js/products.js -- the single source. This file only adds frequency policy: where each colour's UHF primaries live,
# which roles get FM / HF, and the fixed RAZOR channel. Anything here that no longer matches the template stops the build.
PRODUCTS_JS = os.path.join(HERE, "..", "..", "js", "products.js")
UHF_SLICE = {"WHITE": (290.0, 304.975), "BLUE": (305.0, 319.975), "YELLOW": (230.0, 259.975), "GREEN": (260.0, 274.975),
             "PURPLE": (320.0, 339.975), "GRAY": (340.0, 359.975)}
FIXED = {("WHITE", 1): {"role": "TAC COORD", "uhf": 293.5, "callsign": "RAZOR"}}   # CAOC decision: RAZOR = WHITE 1 = 293.500


def read_template():
    import re
    src = open(PRODUCTS_JS, encoding="utf-8").read()
    m = re.search(r"const COMM_TEMPLATE = (\[.*?\n  \]);", src, re.S)
    if not m:
        raise SystemExit("build stopped: COMM_TEMPLATE not found in js/products.js")
    try:
        tpl = json.loads(m.group(1))
    except ValueError as e:
        raise SystemExit(f"build stopped: COMM_TEMPLATE in js/products.js is not a plain array of strings ({e})")
    return [(title, color, roles) for title, color, roles in tpl]


def check_policy(tpl):
    """Every rule here must still point at something in the template."""
    errs, colors, roles = [], {c for _, c, _ in tpl}, {r for _, _, rs in tpl for r in rs}
    errs += [f"template colour {c} has no UHF slice in build.py" for c in colors if c not in UHF_SLICE]
    errs += [f"UHF slice for {c} but the template has no {c} column" for c in UHF_SLICE if c not in colors]
    for (color, row), fx in FIXED.items():
        col = next((rs for _, c, rs in tpl if c == color), None)
        if not col or len(col) < row or col[row - 1] != fx["role"]:
            errs.append(f"fixed channel {color} {row} expects role {fx['role']!r}, template has {(col[row - 1] if col and len(col) >= row else None)!r}")
    errs += [f"{name} lists role {r!r}, which is not in the template" for name, group in (("FM_NETS", FM_NETS), ("HF_NETS", HF_NETS)) for r in group if r not in roles]
    if errs:
        raise SystemExit("build stopped: the ACP template and the JCEOI policy disagree:\n  " + "\n  ".join(errs))


FM_NETS = {"CSAR / PRCC", "RESCORT", "SAR", "ASOC", "JTAC/FAC(A) 1", "JTAC/FAC(A) 2", "JTAC/FAC(A) 3", "CAS COORD"}
HF_NETS = {"C2 / AWACS", "HOST C2", "CSAR / PRCC"}
ALT_SLICE = (360.0, 399.975)   # every alternate lives up here, away from the primaries


def grid(lo, hi, step):
    # channels only: snap the slice edges onto the band's step (25 kHz VHF/UHF, 1 kHz HF)
    import math
    a, b = math.ceil(round(lo / step, 6)), math.floor(round(hi / step, 6))
    return [round(i * step, 3) for i in range(a, b + 1)]


def check_only():
    """Is js/jceoi-data.js still built from today's ACP template? Needs no downloaded sources."""
    tpl = read_template(); check_policy(tpl)
    try:
        old = json.loads(open(OUT, encoding="utf-8").read().split("window.AOC_JCEOI = ", 1)[1].rstrip().rstrip(";"))
    except (OSError, IndexError, ValueError):
        print("check: js/jceoi-data.js missing or unreadable"); return 1
    want = [(f"{color} {i + 1}", net, role) for net, color, roles in tpl for i, role in enumerate(roles)]
    have = [(n["id"], n["net"], n["role"]) for n in old.get("nets", [])]
    stale = old.get("template") != [list(t) for t in tpl] or want != have
    print("check: js/jceoi-data.js is " + ("OUT OF DATE with the ACP template -- run build.py" if stale else "up to date with the ACP template"))
    return 1 if stale else 0


def main():
    if "--check" in sys.argv:
        return check_only()
    ap, fr, nv = load_ourairports()
    mil = json.load(open(os.path.join(HERE, "data", "military.json"), encoding="utf-8"))
    common = [{"mhz": m, "use": u, "src": s, "conf": c, "band": band_of(m)} for m, u, s, c in mil["common"]]
    for name, fs, s, c in mil["commonBlocks"]:
        common += [{"mhz": m, "use": name, "src": s, "conf": c, "band": band_of(m)} for m in fs]
    theaters, every = [], []
    for key, stem, box, status in THEATERS:
        reg, tacan = register_for(key, stem, box, ap, fr, nv, mil)
        theaters.append({"key": key, "status": status, "box": box, "dcs": bool(stem), "register": reg, "tacan": tacan})
        every += [e["mhz"] for e in reg]
        print(f"{key:20} {len(reg):5} documented ({sum(e['kind'].startswith('dcs') for e in reg)} DCS), {len(tacan)} TACAN")
    every += [c["mhz"] for c in common]
    documented = sorted(set(every))

    def clear(f, b, taken, min_gap):
        if any(abs(f - g) < GUARD_ZONE for g in (121.5, 243.0)): return False
        if any(abs(f - d) < SEP[b] - 1e-9 for d in documented if band_of(d) == b or (b == "VHF-AM" and band_of(d) == "VHF-NAV")): return False
        return all(abs(f - t) >= min_gap for t in taken)

    # readable frequencies first: x.x00 / x.x50 in VHF/UHF, whole 5 kHz in HF
    def candidates(lo, hi, b):
        step = BANDS[b][2]
        g = grid(lo, hi, step)
        nice = [f for f in g if (round(f * 1000) % 50 == 0 if b != "HF" else round(f * 1000) % 5 == 0)]
        return nice + [f for f in g if f not in nice]

    taken = {b: [] for b in BANDS}
    def pick(lo, hi, b, gap):
        for f in candidates(lo, hi, b):
            if clear(f, b, taken[b], gap):
                taken[b].append(f); return f
        raise SystemExit(f"no clear {b} frequency left in {lo}-{hi}")

    tpl = read_template(); check_policy(tpl)
    nets = []
    for net, color, roles in tpl:
        lo, hi = UHF_SLICE[color]
        # spread a net's primaries across its slice: one sub-slice per row
        span = (hi - lo + 0.025) / len(roles)
        for i, role in enumerate(roles):
            fx = FIXED.get((color, i + 1), {})
            if fx.get("uhf"):
                if not clear(fx["uhf"], "UHF", taken["UHF"], 0.1): print(f"WARNING fixed {color} {i+1} {fx['uhf']} is not clear")
                uhf = fx["uhf"]; taken["UHF"].append(uhf)
            else:
                uhf = pick(round(lo + i * span, 3), round(lo + (i + 1) * span - 0.025, 3), "UHF", 0.5)
            nets.append({"id": f"{color} {i + 1}", "color": color, "net": net, "row": i + 1, "role": role, "callsign": fx.get("callsign", ""), "uhf": uhf})
    # alternates, VHF-AM backups, FM and HF, spread through their slices in plan order
    n = len(nets); a_span = (ALT_SLICE[1] - ALT_SLICE[0] + 0.025) / n
    v_lo, v_hi = 138.0, 151.975; v_span = (v_hi - v_lo + 0.025) / n
    fm = [x for x in nets if x["role"] in FM_NETS]; hf = [x for x in nets if x["role"] in HF_NETS]
    for i, x in enumerate(nets):
        x["uhfAlt"] = pick(round(ALT_SLICE[0] + i * a_span, 3), round(ALT_SLICE[0] + (i + 1) * a_span - 0.025, 3), "UHF", 0.2)
        x["vhf"] = pick(round(v_lo + i * v_span, 3), round(v_lo + (i + 1) * v_span - 0.025, 3), "VHF-AM", 0.1)
    # FM: 30-37.975 and 43-87.975 (DCS airfield FM sits at 38-42.4 MHz); one 5 MHz-wide step per net
    for i, x in enumerate(fm):
        x["fm"] = pick(43.0 + i * 5.0, 43.0 + i * 5.0 + 4.975, "VHF-FM", 1.0)
    # HF: 5-9 MHz, well clear of the 3.75-4.75 MHz DCS airfield HF and maritime distress
    for i, x in enumerate(hf):
        x["hf"] = pick(5.0 + i * 1.3, 5.0 + i * 1.3 + 1.2, "HF", 0.1)

    # independent check: every plan frequency against every theater register and the common list
    problems = []
    for x in nets:
        for k in ("uhf", "uhfAlt", "vhf", "fm", "hf"):
            f = x.get(k)
            if f is None: continue
            b = band_of(f)
            if abs(round(f / BANDS[b][2]) * BANDS[b][2] - f) > 1e-6:
                problems.append((x["id"], k, f, "grid", "off the channel grid", None))
            for t in theaters:
                for e in t["register"]:
                    if (e["band"] == b or (b == "VHF-AM" and e["band"] == "VHF-NAV")) and abs(e["mhz"] - f) < SEP[b] - 1e-9:
                        problems.append((x["id"], k, f, t["key"], e["site"], e["mhz"]))
            for c in common:
                if c["band"] == b and abs(c["mhz"] - f) < SEP[b] - 1e-9:
                    problems.append((x["id"], k, f, "common", c["use"], c["mhz"]))
    total = sum(len(t["register"]) for t in theaters) + len(common)
    print(f"net plan: {len(nets)} channels, {sum(1 for x in nets for k in ('uhf','uhfAlt','vhf','fm','hf') if x.get(k) is not None)} frequencies; "
          f"checked against {total} documented entries ({len(documented)} distinct frequencies): {len(problems)} conflicts")
    for p in problems[:20]: print("  CONFLICT", p)

    # compact rows for the browser: [site, icao, use, mhz, kind, src, conf]; the page derives the band
    REG_COLS = ["site", "icao", "use", "mhz", "kind", "src", "conf"]
    slim = [{**{k: v for k, v in t.items() if k != "register"}, "register": [[e[c] for c in REG_COLS] for e in t["register"]]} for t in theaters]
    data = {"version": VERSION, "title": f"vCAOC JCEOI {VERSION}", "generated": datetime.date.today().isoformat(), "regCols": REG_COLS,
            "template": [list(t) for t in tpl],
            "bands": BANDS, "sep": SEP, "guardZone": GUARD_ZONE, "theaters": slim, "common": common, "nets": nets,
            "sources": mil["sources"], "sourceNotes": mil["_note"]}
    if problems:
        print("build stopped: conflicts above -- js/jceoi-data.js not written"); return 1
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// GENERATED by tools/jceoi/build.py -- do not edit by hand.\n")
        f.write("window.AOC_JCEOI = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"wrote {os.path.relpath(OUT, HERE)} ({os.path.getsize(OUT) // 1024} KB)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
