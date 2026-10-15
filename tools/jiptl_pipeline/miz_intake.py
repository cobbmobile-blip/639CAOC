#!/usr/bin/env python3
"""
Miz Intake -- drop a raw .miz, get a classified/geolocated REDFOR picture out.

Replaces the manual "run Coalition Parser, export CSV, feed jiptl_generate.py"
step: this reads the .miz directly (unzip -> parse the mission Lua with slpp
-> convert each unit's native x/y to lat/lon via theater_projection.py) and
produces rows in the exact shape jiptl_generate.py already consumes, then
calls the same classify/geofilter/score/rank/cap pipeline so the output is
identical in format to a normal jiptl_generate.py run.

Only works for theaters theater_projection.py has a calibrated projection
for (currently: PersianGulf). An uncalibrated theater is refused outright --
see that module's docstring for how to add one.

Usage:
    python3 miz_intake.py OP_VENOM_MOCHA_v1.2.miz \\
        --coalition red \\
        --classification config/unit_classification.json \\
        --cycle-config data/op_venom_mocha/cycle_config.json \\
        --out-prefix output/venom_mocha

Everything downstream of --input in jiptl_generate.py (classification,
BMA geofilter, scoring, caps, target numbering, CSV/JSON output) is reused
as-is by importing that module, so the two tools always stay in sync.
"""

import argparse
import sys
import zipfile
from pathlib import Path

from slpp import slpp as lua

import jiptl_generate as jg
import theater_projection as proj


def _iter_values(x):
    if isinstance(x, dict):
        return x.values()
    if isinstance(x, list):
        return x
    return []


def load_miz(miz_path):
    """Returns (theater_name, mission_lua_dict)."""
    with zipfile.ZipFile(miz_path) as z:
        theater = z.read("theatre").decode("utf-8", errors="ignore").strip()
        mission_text = z.read("mission").decode("utf-8", errors="ignore")
    idx = mission_text.find("=")
    mission = lua.decode(mission_text[idx + 1:])
    return theater, mission


def extract_rows(mission, theater, coalition_name, source_file):
    """Walk the mission Lua and return rows in jiptl_generate's row shape:
    {group, unit, type, lat, lon, alt_ft, source_file}.

    Only units with a usable x/y are emitted; anything theater_projection
    can't convert (uncalibrated theater) raises immediately rather than
    silently skipping or guessing -- a half-converted target list is worse
    than no list."""
    if not proj.is_calibrated(theater):
        raise SystemExit(
            f"Refusing to continue: no calibrated coordinate projection for theater "
            f"{theater!r}. Calibrated theaters: {sorted(proj.THEATERS)}. "
            f"See theater_projection.py to add this one (needs a Coalition Parser "
            f"export of one mission on this map to calibrate against)."
        )

    rows = []
    coal = mission.get("coalition", {}).get(coalition_name)
    if coal is None:
        raise SystemExit(
            f"No coalition named {coalition_name!r} in this mission. "
            f"Available: {sorted(mission.get('coalition', {}).keys())}"
        )

    for country in _iter_values(coal.get("country")):
        for cat in ("vehicle", "ship", "plane", "helicopter", "static"):
            grp_cat = country.get(cat)
            if not grp_cat:
                continue
            for g in _iter_values(grp_cat.get("group")):
                group_name = g.get("name", "")
                for u in _iter_values(g.get("units")):
                    x, y = u.get("x"), u.get("y")
                    if x is None or y is None:
                        continue
                    lat, lon = proj.xy_to_latlon(theater, x, y)
                    rows.append({
                        "group": group_name,
                        "unit": u.get("name", ""),
                        "type": u.get("type", ""),
                        "lat": lat,
                        "lon": lon,
                        "alt_ft": "",
                        "source_file": source_file,
                    })
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("miz", help="Path to the .miz mission file")
    ap.add_argument("--coalition", default="red", choices=["red", "blue"],
                     help="Which coalition's order of battle to extract (default: red)")
    ap.add_argument("--classification", default="config/unit_classification.json")
    ap.add_argument("--cycle-config", default="config/cycle_config.json")
    ap.add_argument("--out-prefix", default="output/intake")
    ap.add_argument("--airfields", default=None,
                     help="Airfields JSON to enable Task 1 airbase association for aircraft rows")
    ap.add_argument("--airfield-radius-nm", type=float, default=3.0)
    args = ap.parse_args()

    miz_path = Path(args.miz)
    theater, mission = load_miz(miz_path)
    print(f"Theater: {theater}")

    rows = extract_rows(mission, theater, args.coalition, miz_path.name)
    print(f"Extracted {len(rows)} {args.coalition}-coalition unit rows directly from {miz_path.name}.")

    units_table = jg.load_classification(args.classification)
    cycle_cfg = __import__("json").loads(Path(args.cycle_config).read_text())

    airfield_targets = []
    if args.airfields:
        airfields = jg.load_airfields(args.airfields)
        air_rows, rows = jg.split_air_rows(rows, units_table)
        print(f"{len(air_rows)} aircraft rows found; matching against {len(airfields)} airfields "
              f"(radius {args.airfield_radius_nm}nm)...")
        airfield_targets, leftover_air = jg.cluster_aircraft_to_airfields(
            air_rows, airfields, units_table, args.airfield_radius_nm)
        print(f"{len(airfield_targets)} airfields occupied; {len(leftover_air)} aircraft rows "
              f"had no airfield in range (treated as airborne flights).")
        rows = rows + leftover_air

    groups, unclassified = jg.build_groups(rows, units_table)
    groups = airfield_targets + groups
    print(f"Formed {len(groups)} nominate-eligible target groups "
          f"({len(airfield_targets)} airfields + {len(groups) - len(airfield_targets)} other groups).")

    ranked, out_of_bma = jg.score_and_rank(groups, cycle_cfg)
    print(f"{len(ranked)} groups inside the BMA and ranked; {len(out_of_bma)} dropped as outside the BMA.")

    kept, overflow = jg.apply_caps(ranked, cycle_cfg)
    print(f"{len(kept)} groups made the JIPTL after per-task caps; {len(overflow)} held on the watchlist.")

    jg.assign_target_numbers(kept + overflow + out_of_bma)

    jiptl_fields = ["target_number", "group", "unit_name", "task", "task_name", "grade", "category", "tier",
                     "score", "unit_count", "composition", "lat", "lon", "source_file"]

    jg.write_csv(f"{args.out_prefix}_jiptl.csv", kept, jiptl_fields)
    Path(f"{args.out_prefix}_jiptl.json").write_text(__import__("json").dumps(kept, indent=2))
    jg.write_csv(f"{args.out_prefix}_watchlist.csv", overflow, jiptl_fields)
    jg.write_csv(f"{args.out_prefix}_out_of_bma.csv", out_of_bma,
                 ["target_number", "group", "unit_name", "category", "tier", "unit_count", "composition",
                  "lat", "lon", "source_file"])

    if unclassified:
        unc_rows = [{"type": t, "count": c} for t, c in sorted(unclassified.items(), key=lambda x: -x[1])]
        jg.write_csv(f"{args.out_prefix}_unclassified.csv", unc_rows, ["type", "count"])
        print(f"{len(unclassified)} unmapped unit Type(s) logged to {args.out_prefix}_unclassified.csv")

    print(f"\nJIPTL written to {args.out_prefix}_jiptl.csv / .json -- direct from the .miz, no Coalition Parser step.")


if __name__ == "__main__":
    main()
