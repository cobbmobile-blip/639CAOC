#!/usr/bin/env python3
"""Download the OurAirports CSVs (public domain) into src/ via the GitHub API. Run before build.py."""
import base64, json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "davidmegginson/ourairports-data"
FILES = ["airport-frequencies.csv", "airports.csv", "navaids.csv", "LICENSE"]


def main():
    os.makedirs(os.path.join(HERE, "src"), exist_ok=True)
    tree = {t["path"]: t for t in json.load(urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/git/trees/main"))["tree"]}
    for f in FILES:
        blob = json.load(urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/git/blobs/{tree[f]['sha']}"))
        path = os.path.join(HERE, "src", f"ourairports_{f}")
        open(path, "wb").write(base64.b64decode(blob["content"]))
        print(f, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
