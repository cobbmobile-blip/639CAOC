#!/usr/bin/env python3
"""
Read the in-game ATC radios and navigation beacons of every installed DCS terrain
(Mods/terrains/<theater>/radio.lua and beacons.lua) into data/dcs_<theater>.json.

The Lua files are read as text and pattern-matched -- nothing from the DCS install is
executed. Run:  python -I extract_dcs.py ["C:/Program Files/Eagle Dynamics/DCS World"]
"""
import json, os, re, sys

DCS = sys.argv[1] if len(sys.argv) > 1 else r"C:\Program Files\Eagle Dynamics\DCS World"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
# folder name -> theater key used by the site (matches the campaign "theater" names)
THEATERS = {"Caucasus": "Caucasus", "Nevada": "Nevada", "PersianGulf": "Persian Gulf", "Syria": "Syria",
            "MarianaIslands": "Marianas", "Sinai": "Sinai", "Kola": "Kola", "Afghanistan": "Afghanistan"}
BAND = {"HF": "HF", "VHF_LOW": "VHF-FM", "VHF_HI": "VHF-AM", "UHF": "UHF"}


def find(folder, name):
    for f in os.listdir(folder):
        if f.lower() == name:
            return os.path.join(folder, f)
    return None


def blocks(text, start_key):
    """Top-level { ... } entries of the radio / beacons table."""
    i = text.index(start_key + " = {") + len(start_key) + 4
    depth, cur, out = 0, [], []
    for ch in text[i:]:
        if ch == "{":
            depth += 1
        if depth >= 1:
            cur.append(ch)
        if ch == "}":
            depth -= 1
            if depth == 0 and cur:
                out.append("".join(cur)); cur = []
            if depth < 0:
                break
    return out


def radios(path):
    out = []
    for b in blocks(open(path, encoding="utf-8", errors="replace").read(), "radio"):
        comment = re.search(r"--\s*(.+)", b)
        names = re.findall(r'\["(common|nato|ussr)"\]\s*=\s*\{_\("([^"]*)"\)', b)
        name = (comment.group(1).strip() if comment else None) or (names[0][1] if names else "?")
        rid = re.search(r"radioId\s*=\s*'([^']*)'", b)
        for band, mod, hz in re.findall(r"\[(HF|VHF_LOW|VHF_HI|UHF)\]\s*=\s*\{MODULATIONTYPE_(\w+),\s*([\d.]+)\}", b):
            out.append({"site": name, "callsigns": sorted({n for _, n in names}), "radioId": rid.group(1) if rid else "",
                        "band": BAND[band], "mod": mod, "mhz": round(float(hz) / 1e6, 4), "use": "ATC (ground/tower/approach)"})
    return out


def beacons(path):
    out = []
    for b in blocks(open(path, encoding="utf-8", errors="replace").read(), "beacons"):
        g = lambda k, pat=r"([^;\n]+)": (re.search(rf"\b{k}\s*=\s*{pat}", b) or [None, None])[1]
        name = re.search(r"display_name\s*=\s*_\('([^']*)'\)", b)
        geo = re.search(r"latitude\s*=\s*([-\d.]+),\s*longitude\s*=\s*([-\d.]+)", b)
        hz, ch = g("frequency", r"([\d.]+)"), g("channel", r"(\d+)")
        out.append({"site": name.group(1) if name else "?", "type": (g("type", r"BEACON_TYPE_(\w+)") or ""),
                    "callsign": (g("callsign", r"'([^']*)'") or ""), "mhz": round(float(hz) / 1e6, 4) if hz else None,
                    "tacan": int(ch) if ch else None, "lat": float(geo.group(1)) if geo else None, "lon": float(geo.group(2)) if geo else None})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    root = os.path.join(DCS, "Mods", "terrains")
    for folder, key in THEATERS.items():
        d = os.path.join(root, folder)
        if not os.path.isdir(d):
            print(f"{key}: not installed"); continue
        r, b = find(d, "radio.lua"), find(d, "beacons.lua")
        data = {"theater": key, "source": f"DCS World install, Mods/terrains/{folder}", "radios": radios(r) if r else [], "beacons": beacons(b) if b else []}
        with open(os.path.join(OUT, f"dcs_{folder}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
        print(f"{key}: {len(data['radios'])} ATC frequencies, {len(data['beacons'])} beacons")


if __name__ == "__main__":
    main()
