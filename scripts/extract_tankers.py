#!/usr/bin/env python3
"""
extract_tankers.py — Pull tanker net/callsign/frequency/TACAN data out of a
DCS .miz mission file and format it to populate the Tankers column of the
639 CAOC Theater Comm Plan grid.

Usage:
    python3 extract_tankers.py path/to/mission.miz [--json out.json] [--csv out.csv]

With no --json/--csv, prints a human-readable table and a ready-to-paste
block matching the Comm Grid's "net / callsign / freq" cell layout.

Requires: slpp (pure-Python Lua table parser)
    pip install slpp

How it finds tankers:
    A group counts as a tanker if its group-level ["task"] == "Refueling"
    (the authoritative DCS tasking) OR its unit type matches a known tanker
    airframe (fallback, in case task was hand-edited). For each match it
    pulls:
      - group name / callsign (voice family + number, e.g. "Shell 1-1")
      - group radio frequency + modulation (AM/FM)
      - TACAN info from the first ActivateBeacon WrappedAction found on the
        route (channel, mode X/Y, beacon callsign) — present on most AI
        tanker flights, absent on some hand-built ones.
"""

import argparse
import csv
import json
import re
import sys
import zipfile
from pathlib import Path

try:
    from slpp import slpp as lua
except ImportError:
    sys.exit("Missing dependency. Install with:  pip install slpp")

TANKER_TYPE_FALLBACK = {
    "KC-135", "KC135MPRS", "KC130", "KC130J", "KC-130", "KC_10", "KC10",
    "IL-78M", "IL78M", "S-3B Tanker", "S-3B_Tanker",
}


def load_mission_table(miz_path: Path) -> dict:
    """Unzip the .miz and parse its /mission file into a Python dict."""
    with zipfile.ZipFile(miz_path) as zf:
        raw = zf.read("mission").decode("utf-8", errors="replace")
    # file is a Lua assignment: "mission = { ... } -- end of mission"
    table_text = re.sub(r"^\s*mission\s*=\s*", "", raw, count=1)
    return lua.decode(table_text)


def callsign_name(unit_callsign):
    """DCS stores callsign as a dict with a 'name' key (e.g. 'Shell11')."""
    if isinstance(unit_callsign, dict):
        return unit_callsign.get("name", "")
    if isinstance(unit_callsign, str):
        return unit_callsign
    return ""


def split_callsign(name: str) -> str:
    """'Shell11' -> 'Shell 1-1' (family name + flight-ship numbers)."""
    m = re.match(r"^([A-Za-z]+)(\d)(\d)$", name or "")
    if m:
        family, flight, ship = m.groups()
        return f"{family} {flight}-{ship}"
    return name or ""


def find_beacon(route: dict):
    """Walk every waypoint's ComboTask looking for an ActivateBeacon action."""
    points = (route or {}).get("points", {}) or {}
    for _, wp in points.items():
        tasks = (((wp.get("task") or {}).get("params") or {}).get("tasks") or {})
        for _, t in tasks.items():
            action = (t.get("params") or {}).get("action") or {}
            if action.get("id") == "ActivateBeacon":
                p = action.get("params", {})
                return {
                    "channel": p.get("channel"),
                    "mode": p.get("modeChannel"),
                    "callsign": p.get("callsign"),
                    "freq_mhz": round((p.get("frequency") or 0) / 1_000_000, 3) or None,
                }
    return None


def extract_tankers(mission: dict):
    rows = []
    for coal_name in ("blue", "red", "neutrals"):
        coalition = mission.get("coalition", {}).get(coal_name)
        if not coalition:
            continue
        countries = coalition.get("country", {}) or {}
        for _, country in countries.items():
            plane = country.get("plane")
            if not plane:
                continue
            groups = plane.get("group", {}) or {}
            for _, g in groups.items():
                units = g.get("units", {}) or {}
                first_unit = next(iter(units.values()), {}) if units else {}
                unit_type = first_unit.get("type", "")
                is_tanker = (
                    g.get("task") == "Refueling"
                    or unit_type in TANKER_TYPE_FALLBACK
                )
                if not is_tanker:
                    continue

                freq_mhz = g.get("frequency")
                modulation = "FM" if g.get("modulation") == 1 else "AM"
                beacon = find_beacon(g.get("route", {}))
                cs = split_callsign(callsign_name(first_unit.get("callsign")))

                rows.append({
                    "coalition": coal_name,
                    "group_name": g.get("name", ""),
                    "aircraft_type": unit_type,
                    "callsign": cs,
                    "freq_mhz": freq_mhz,
                    "modulation": modulation,
                    "tacan_channel": beacon["channel"] if beacon else None,
                    "tacan_mode": beacon["mode"] if beacon else None,
                    "tacan_callsign": beacon["callsign"] if beacon else None,
                })
    # stable order: by callsign family, then group name
    rows.sort(key=lambda r: (r["callsign"], r["group_name"]))
    return rows


def to_grid_cells(rows):
    """Format each tanker as the Comm Grid's net / callsign / freq triple."""
    cells = []
    for r in rows:
        if r["tacan_channel"]:
            net = f"{r['group_name']} — TACAN {r['tacan_channel']}{r['tacan_mode'] or ''}"
        else:
            net = r["group_name"]
        freq = f"{r['freq_mhz']:.3f} {r['modulation']}" if r["freq_mhz"] else ""
        cells.append({"net": net, "callsign": r["callsign"], "freq": freq})
    return cells


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("miz", type=Path, help="Path to the .miz file")
    ap.add_argument("--json", type=Path, help="Write results as JSON")
    ap.add_argument("--csv", type=Path, help="Write results as CSV")
    args = ap.parse_args()

    mission = load_mission_table(args.miz)
    rows = extract_tankers(mission)

    if not rows:
        print("No tanker groups found (looked for task=='Refueling' or known tanker types).")
        return

    print(f"Found {len(rows)} tanker flight(s) in {args.miz.name}:\n")
    for r in rows:
        tacan = f"  TACAN {r['tacan_channel']}{r['tacan_mode']} ({r['tacan_callsign']})" if r["tacan_channel"] else "  TACAN: none set"
        print(f"  {r['callsign']:<14} {r['group_name']:<14} {r['aircraft_type']:<14} "
              f"{r['freq_mhz']:.3f} {r['modulation']}{tacan}")

    cells = to_grid_cells(rows)
    print("\nComm Grid Tankers column (net / callsign / freq) — paste in order:\n")
    for c in cells:
        print(f"  net: {c['net']}")
        print(f"  callsign: {c['callsign']}")
        print(f"  freq: {c['freq']}")
        print()

    if args.json:
        args.json.write_text(json.dumps({"tankers": rows, "grid_cells": cells}, indent=2))
        print(f"Wrote {args.json}")

    if args.csv:
        with args.csv.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["net", "callsign", "freq"])
            w.writeheader()
            w.writerows(cells)
        print(f"Wrote {args.csv}")


if __name__ == "__main__":
    main()
