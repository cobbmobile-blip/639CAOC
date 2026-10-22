#!/usr/bin/env python3
"""
In-game airfield ATC radios for theaters that are not installed locally, from the pydcs
terrain data (DCS Retribution fork, which pydcs builds from DCS's own terrain files).
The airports.py sources are fetched once into src/ (see fetch below) and read as text.

Run:  python -I extract_pydcs.py [--fetch]
"""
import base64, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO, REF = "dcs-retribution/pydcs", "retribution"
THEATERS = {"iraq": "Iraq", "germanycoldwar": "Germany (Cold War)", "falklands": "Falklands"}
BAND = {"hf_hz": "HF", "vhf_low_hz": "VHF-FM", "vhf_high_hz": "VHF-AM", "uhf_hz": "UHF"}


def fetch(folder):
    # the contents API omits large files; the blob API returns them
    j = json.load(urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/contents/dcs/terrain/{folder}/airports.py?ref={REF}"))
    b = json.load(urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/git/blobs/{j['sha']}"))
    return base64.b64decode(b["content"]).decode("utf-8"), j["sha"]


def parse(text):
    out = []
    for cls in re.split(r"\nclass \w+\(Airport\):", text)[1:]:
        name = re.search(r'\n    name = "([^"]*)"', cls)
        tacan = re.search(r"\n    tacan = (?:'|\")?([^\n'\"]+)", cls)
        radio = re.search(r"atc_radio = AtcRadio\(([^)]*)\)", cls)
        if not radio:
            continue
        for k, v in re.findall(r"(\w+_hz)=(\d+)", radio.group(1)):
            out.append({"site": name.group(1) if name else "?", "callsigns": [], "band": BAND[k], "mod": "AM",
                        "mhz": round(int(v) / 1e6, 4), "use": "ATC (ground/tower/approach)",
                        "tacan": None if not tacan or tacan.group(1) == "None" else tacan.group(1)})
    return out


def main():
    os.makedirs(os.path.join(HERE, "src"), exist_ok=True)
    for folder, key in THEATERS.items():
        src = os.path.join(HERE, "src", f"pydcs_{folder}_airports.py")
        sha = ""
        if "--fetch" in sys.argv or not os.path.exists(src):
            text, sha = fetch(folder)
            open(src, "w", encoding="utf-8").write(text)
        radios = parse(open(src, encoding="utf-8").read())
        data = {"theater": key, "source": f"pydcs terrain data ({REPO}@{REF}, dcs/terrain/{folder}/airports.py{' blob ' + sha[:10] if sha else ''})",
                "radios": radios, "beacons": []}
        with open(os.path.join(HERE, "data", f"dcs_{folder}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
        print(f"{key}: {len(radios)} ATC frequencies at {len({r['site'] for r in radios})} airfields")


if __name__ == "__main__":
    main()
