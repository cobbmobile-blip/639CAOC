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


NTTR_JSON = os.path.join(HERE, "data", "nttr.json")
NTTR = json.load(open(NTTR_JSON, encoding="utf-8")) if os.path.exists(NTTR_JSON) else None


IFF_JSON = os.path.join(HERE, "data", "iff.json")


def load_iff():
    """The IFF/SIF code plan (data/iff.json), checked before it goes to the site."""
    iff = json.load(open(IFF_JSON, encoding="utf-8")); errs = []
    octal = lambda c, n: len(c) == n and all(ch in "01234567" for ch in c)
    for r in iff["reserved"]:
        if not (octal(r["from"], 4) and octal(r["to"], 4) and int(r["from"], 8) <= int(r["to"], 8)): errs.append(f"reserved {r['from']}-{r['to']} is not a 4-digit octal range")
    for b in iff["blocksExcluded"]["blocks"]:
        if not octal(b, 2): errs.append(f"excluded block {b} is not 2-digit octal")
    codes = [c for f in iff["mode1"]["families"] for c, _ in f["codes"]]
    for c in codes:
        if not octal(c, 2) or c[1] not in "0123": errs.append(f"Mode 1 code {c}: first digit 0-7, second 0-3")
    if len(codes) != len(set(codes)): errs.append("Mode 1 codes repeat")
    # every reserved code must sit in an excluded block, so campaign blocks can never reach one
    for r in iff["reserved"]:
        for blk in {r["from"][:2], r["to"][:2]}:
            if blk not in iff["blocksExcluded"]["blocks"]: errs.append(f"reserved {r['from']}-{r['to']} is in block {blk}, which is not excluded")
    if errs: raise SystemExit("build stopped: data/iff.json:" + "".join("\n  " + e for e in errs))
    return iff


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
    # Nevada: the NTTR / Nellis assignments (official) and the scanner list (hobbyist), from extract_nttr.py
    if key == "Nevada" and NTTR:
        for o in NTTR["official"]:
            add(site=o["agency"], icao="NTTR", use=f"NTTR assigned ({o['table']})", mhz=o["mhz"], kind="nttr", src=o["src"], conf="official")
        for m, d in NTTR["scanner"]:
            add(site=d, icao="", use="NTTR scanner list", mhz=m, kind="military", src="Scanner list", conf="hobbyist")
    reg.sort(key=lambda e: (e["mhz"], e["site"]))
    return reg, tacan


# ---------- the standard Blue net plan ----------
# The net list (colour, net name, roles per row) comes from the Comm Plan (ACP) template, COMM_TEMPLATE in
# js/products.js -- the single source. This file only adds frequency policy: where each colour's UHF primaries live,
# which roles get FM / HF, and the fixed RAZOR channel. Anything here that no longer matches the template stops the build.
PRODUCTS_JS = os.path.join(HERE, "..", "..", "js", "products.js")
UHF_SLICE = {"WHITE": (290.0, 304.975), "BLUE": (305.0, 319.975), "YELLOW": (230.0, 259.975), "GREEN": (260.0, 274.975),
             "PURPLE": (320.0, 339.975), "GRAY": (340.0, 359.975)}
# CAOC decision: RAZOR is WHITE 1 TAC COORD. Its frequency is picked like any other (293.500 was dropped on 2026-10-22:
# it is ROULETTE / R-77 EC at the NTTR); a "uhf" here would pin it.
FIXED = {("WHITE", 1): {"role": "TAC COORD", "callsign": "RAZOR"}}


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


# CAOC revisions to its NTTR plan (NTTR_COMM_PLAN.xlsx), decided 2026-10-22. "assign" picks a frequency clear of every
# documented one in every theater and of everything the NTTR plan already uses.
NTTR_REVISIONS_DATE = "2026-10-22"


def revise_nttr(nets, clear, candidates, nttr_freqs):
    import copy
    plan = copy.deepcopy(NTTR); c = plan["caoc"]; log = []
    cell = lambda cid: next((x for col in c["matrix"]["columns"] for i, x in enumerate(col["cells"]) if f"{col['color']} {i + 1}" == cid), None)
    def assign(b, lo, hi):
        used = nttr_freqs(b, plan) + [x[k] for x in nets for k in ("uhf", "uhfAlt", "vhf", "fm", "hf") if x.get(k) is not None and band_of(x[k]) == b]
        for f in candidates(lo, hi, b):
            if clear(f, b, used, 0.1): return f
        raise SystemExit(f"NTTR revision: no clear {b} frequency in {lo}-{hi}")
    def note(what, old, new, why): log.append({"what": what, "old": old, "new": new, "why": why})
    fmt = lambda f: f"{f:.3f}"

    # RAZOR: the standard WHITE 1 (picked clear of the NTTR assignments and this plan); comm card follows
    razor = fmt(next(x["uhf"] for x in nets if x["id"] == "WHITE 1")); x = cell("WHITE 1")
    note("WHITE 1 TAC COORD RAZOR", x.get("freq"), razor, "293.500 is ROULETTE / R-77, ECE, ECW and TPECR (NTTR Add A Tables A14.1, A14.2)"); x["freq"] = razor
    for p in c["presets"]:
        if "RAZOR" in p["uhfAgency"].upper(): note(f"Comm card preset {p['preset']} {p['uhfAgency']}", p["uhf"], razor, "follows RAZOR"); p["uhf"] = razor
    # preset 5 typo
    for p in c["presets"]:
        if p["preset"] == 5 and p["uhf"] == "285.400":
            note("Comm card preset 5 NELLIS DEPARTURE", p["uhf"], "385.400", "typo; Nellis channel 5 is 385.400 (NELLISAFBI 11-250 Table A20.1)"); p["uhf"] = "385.400"
    # APOLLO (TAC 4) shared 315.250 with SWORD (TAC 2)
    x = cell("YELLOW 5"); new = fmt(assign("UHF", 230.0, 259.975))
    note("YELLOW 5 TAC 4 APOLLO", x.get("freq"), new, "shared 315.250 with YELLOW 3 TAC 2 SWORD"); x["freq"] = new
    # RQ-7 SNIPER sat on a 422 F-22A squadron frequency
    x = cell("GREEN 6"); new = fmt(assign("VHF-AM", 138.0, 151.975))
    note("GREEN 6 RQ-7 SNIPER", x.get("freq"), new, "150.500 is a 422 F-22A squadron frequency (NELLISAFBI 11-250 Table A20.2)"); x["freq"] = new
    # JTACs follow the CAOC range JTAC sheet (first three JTACs) instead of sharing 30.000
    for i, j in enumerate(c["jtacs"][:3]):
        x = cell(f"PURPLE {i + 2}")
        note(f"PURPLE {i + 2} {x.get('role')}", x.get("freq"), f"{j['fm']} {j['callsign']}", f"range JTAC sheet: {j['callsign']}, range {j['range']}, {j['loc']}, laser {j['laser']}")
        x["freq"], x["callsign"] = j["fm"], j["callsign"]
    # AR-230V / AR-231V: no published frequency; assign one each and move every use of the old placeholder
    for track in ("AR230V", "AR231V"):
        new = fmt(assign("UHF", 228.0, 240.0))
        olds = {t["freq"] for t in c["tankers"] if t["track"] == track} | {t["freq"] for t in c["tracks"] if t["track"] == track}
        for t in c["tracks"]:
            if t["track"] == track: note(f"{track} track frequency", t["freq"], new, "no published frequency for this track; assigned clear"); t["freq"] = new
        for t in c["tankers"]:
            if t["track"] == track: note(f"Tanker {t['callsign']} ({track})", t["freq"], new, f"follows {track}"); t["freq"] = new
        for col in c["matrix"]["columns"]:
            for i, x in enumerate(col["cells"]):
                if x.get("freq") in olds and col["title"] == "TANKERS":
                    note(f"{col['color']} {i + 1} {x.get('role')} {x.get('callsign')}", x["freq"], new, f"tanker on {track}"); x["freq"] = new
    # the JTAC sheet's own FM frequencies stay as the CAOC set them; the site's Nevada plan check flags any that clash there
    plan["revisions"] = {"date": NTTR_REVISIONS_DATE, "changes": log}
    for r in log: print(f"  NTTR revision: {r['what']}: {r['old']} -> {r['new']} ({r['why']})")
    return plan


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

    def nttr_freqs(b, plan=None):
        """Every frequency the CAOC NTTR plan already uses in band b (matrix, comm card, tankers, tracks, JTACs)."""
        c = (plan or NTTR or {}).get("caoc")
        if not c: return []
        fs = [float(x["freq"]) for col in c["matrix"]["columns"] for x in col["cells"] if x.get("freq")]
        fs += [float(p[k]) for p in c["presets"] for k in ("uhf", "vhf") if p.get(k)]
        fs += [float(t["freq"]) for t in c["tankers"] + c["tracks"] if t.get("freq")] + [float(j["fm"]) for j in c["jtacs"]]
        return sorted({f for f in fs if band_of(f) == b})
    tpl = read_template(); check_policy(tpl)
    nets = []
    for net, color, roles in tpl:
        lo, hi = UHF_SLICE[color]
        # spread a net's primaries across its slice: one sub-slice per row
        span = (hi - lo + 0.025) / len(roles)
        for i, role in enumerate(roles):
            fx = FIXED.get((color, i + 1), {})
            if fx.get("uhf"):
                if not clear(fx["uhf"], "UHF", taken["UHF"], 0.1): print(f"NOTE fixed {color} {i+1} {fx['uhf']} is kept although something documented sits on it (see fixedConflicts)")
                uhf = fx["uhf"]; taken["UHF"].append(uhf)
            elif fx:
                # a named CAOC channel is used in every theater, Nevada's NTTR plan included: keep it off that plan too
                held = nttr_freqs("UHF"); taken["UHF"] += held
                uhf = pick(round(lo + i * span, 3), round(lo + (i + 1) * span - 0.025, 3), "UHF", 0.5)
                for f in held: taken["UHF"].remove(f)
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

    nttr_plan = revise_nttr(nets, clear, candidates, nttr_freqs) if NTTR else None

    # independent check: every plan frequency against every theater register and the common list
    problems, fixed_conflicts = [], []
    fixed_ids = {f"{c} {r}": fx["uhf"] for (c, r), fx in FIXED.items() if fx.get("uhf")}
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
                        hit = (x["id"], k, f, t["key"], e["site"], e["mhz"])
                        (fixed_conflicts if k == "uhf" and fixed_ids.get(x["id"]) == f else problems).append(hit)
            for c in common:
                if c["band"] == b and abs(c["mhz"] - f) < SEP[b] - 1e-9:
                    problems.append((x["id"], k, f, "common", c["use"], c["mhz"]))
    total = sum(len(t["register"]) for t in theaters) + len(common)
    print(f"net plan: {len(nets)} channels, {sum(1 for x in nets for k in ('uhf','uhfAlt','vhf','fm','hf') if x.get(k) is not None)} frequencies; "
          f"checked against {total} documented entries ({len(documented)} distinct frequencies): {len(problems)} conflicts")
    for p in problems[:20]: print("  CONFLICT", p)
    for p in fixed_conflicts: print("  fixed channel, kept:", p)

    # compact rows for the browser: [site, icao, use, mhz, kind, src, conf]; the page derives the band
    REG_COLS = ["site", "icao", "use", "mhz", "kind", "src", "conf"]
    slim = [{**{k: v for k, v in t.items() if k != "register"}, "register": [[e[c] for c in REG_COLS] for e in t["register"]]} for t in theaters]
    data = {"version": VERSION, "title": f"vCAOC JCEOI {VERSION}", "generated": datetime.date.today().isoformat(), "regCols": REG_COLS,
            "template": [list(t) for t in tpl],
            "bands": BANDS, "sep": SEP, "guardZone": GUARD_ZONE, "theaters": slim, "common": common, "nets": nets,
            "sources": mil["sources"], "sourceNotes": mil["_note"],
            "iff": load_iff(),
            "fixedConflicts": [{"id": a, "mhz": f, "theater": t, "site": site, "documented": m} for a, _, f, t, site, m in fixed_conflicts],
            # theater plans: where a theater's frequency plan is pre-decided (NTTR), campaigns there follow it
            "theaterPlans": {"Nevada": {k: nttr_plan[k] for k in ("summary", "sources", "channels", "tactical", "agencies", "control", "squadron", "caoc", "revisions")}} if NTTR else {}}
    if problems:
        print("build stopped: conflicts above -- js/jceoi-data.js not written"); return 1
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// GENERATED by tools/jceoi/build.py -- do not edit by hand.\n")
        f.write("window.AOC_JCEOI = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"wrote {os.path.relpath(OUT, HERE)} ({os.path.getsize(OUT) // 1024} KB)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
