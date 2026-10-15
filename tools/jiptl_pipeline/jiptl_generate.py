#!/usr/bin/env python3
"""
JIPTL Generator for 639 CAOC
=============================
Pipeline: DCS Coalition Parser CSV(s) -> classify -> geofilter (BMA) -> score/rank -> JIPTL output

Input: one or more CSVs exported by the DCS Coalition Parser, each with columns:
    Group, Unit, Type, Latitude, Longitude, Altitude (ft)
Latitude/Longitude are DMS strings like  34° 25.744' N  /  38° 58.586' E

Config:
    config/unit_classification.json  - DCS Type -> {category, task, tier, nominate}
    config/cycle_config.json         - Key Task weights, BMA, grading, per-task caps

Output (written next to --out-prefix):
    <prefix>_jiptl.csv / .json   - ranked, capped target list (the JIPTL)
    <prefix>_watchlist.csv       - in-BMA, classified, nominate-eligible, but cut by the per-task cap
    <prefix>_unclassified.csv   - DCS Type strings with no entry in unit_classification.json
    <prefix>_out_of_bma.csv      - groups that were classified/nominate-eligible but fell outside the BMA

Usage:
    python3 jiptl_generate.py --input red_ground.csv [red_air.csv ...] \\
        --classification config/unit_classification.json \\
        --cycle-config config/cycle_config.json \\
        --out-prefix output/cycle01
"""

import argparse
import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

DMS_RE = re.compile(r"(\d+)\s*°\s*([\d.]+)\s*'?\s*([NSEWnsew])")

# Raw DCS Type string (exact, as it appears in the Coalition Parser export / mission
# file) -> a human-readable system/unit name for display. This is purely cosmetic --
# it never feeds classification (category/task/tier come from unit_classification.json
# as before) -- it only answers "what do I call this thing on the review page" so a
# target reads as "MIM-23 Hawk Search Radar" instead of a location-based group label
# like "SAM BANDAR ABBAS 1". Keyed on the *representative* member of the group (the
# same unit whose tier/task decided the group's category), so the name and category
# always describe the same system. Add entries here as new raw Types show up in
# unclassified.csv or in a fresh mission; unmapped types fall back to _clean_fallback_name.
UNIT_DISPLAY_NAMES = {
    "Hawk sr": "MIM-23 Hawk Search Radar",
    "Hawk tr": "MIM-23 Hawk Track Radar",
    "Hawk pcp": "MIM-23 Hawk Platoon Command Post",
    "Hawk cwar": "MIM-23 Hawk CWAR",
    "Hawk ln": "MIM-23 Hawk Launcher",
    "SA-11 Buk CC 9S470M1": "9S470 Buk (SA-11) Command Post",
    "SA-11 Buk LN 9A310M1": "9A310 Buk (SA-11) TEL",
    "SA-11 Buk SR 9S18M1": "9S18 Buk (SA-11) Search Radar",
    "S-300PS 40B6M tr": "S-300PS (SA-10) Tracking Radar",
    "S-300PS 40B6MD sr": "S-300PS (SA-10) Search Radar",
    "S-300PS 40B6MD sr_19J6": "S-300PS (SA-10) Search Radar",
    "S-300PS 54K6 cp": "S-300PS (SA-10) Command Post",
    "S-300PS 5H63C 30H6_tr": "S-300PS (SA-10) Tracking Radar",
    "S-300PS 5P85C ln": "S-300PS (SA-10) TEL",
    "S-300PS 5P85D ln": "S-300PS (SA-10) TEL",
    "S-300PS 64H6E sr": "S-300PS (SA-10) Search Radar",
    "Tor 9A331": "9K330 Tor (SA-15) TEL",
    "CHAP_TorM2": "Tor-M2 (SA-15) TEL",
    "RPC_5N62V": "S-200 (SA-5) Tracking Radar",
    "S-200_Launcher": "S-200 (SA-5) Launcher",
    "P14_SR": "P-14 (SA-5) Early Warning Radar",
    "RLS_19J6": "S-200 (SA-5) Acquisition Radar",
    "p-19 s-125 sr": "P-19 Search Radar (SA-3 support)",
    "Kub 1S91 str": "2K12 Kub (SA-6) Target Radar",
    "Kub 2P25 ln": "2K12 Kub (SA-6) TEL",
    "SNR_75V": "SA-2 Fire Control Radar",
    "S_75M_Volhov": "S-75 Volkhov (SA-2) Launcher",
    "rapier_fsa_blindfire_radar": "Rapier Blindfire Tracking Radar",
    "rapier_fsa_launcher": "Rapier SAM Launcher",
    "rapier_fsa_optical_tracker_unit": "Rapier Optical Tracker",
    "NASAMS_Command_Post": "NASAMS Command Post",
    "NASAMS_LN_B": "NASAMS Launcher",
    "NASAMS_LN_C": "NASAMS Launcher",
    "NASAMS_Radar_MPQ64F1": "NASAMS AN/MPQ-64 Radar",
    "Patriot cp": "MIM-104 Patriot Command Post",
    "Patriot ln": "MIM-104 Patriot Launcher",
    "Patriot AMG": "MIM-104 Patriot Antenna Mast Group",
    "Patriot ECS": "MIM-104 Patriot Engagement Control Station",
    "Patriot EPP": "MIM-104 Patriot Power Plant",
    "Patriot str": "MIM-104 Patriot Tracking Radar",
    "CHAP_PantsirS1": "Pantsir-S1 (SA-22)",
    "2S6 Tunguska": "2S6 Tunguska (SA-19)",
    "KILO": "Kilo-class Submarine",
    "IMPROVED_KILO": "Improved Kilo-class Submarine",
    "La_Combattante_II": "La Combattante II Missile Boat",
    "MOLNIYA": "Molniya-class Missile Boat",
    "hy_launcher": "HY-2 Silkworm Launcher",
    "Silkworm_SR": "Silkworm Target Acquisition Radar",
    "Scud_B": "Scud-B TEL",
    "KS-19": "KS-19 100mm AAA",
    "MiG-29A": "MiG-29A Fulcrum",
    "BTR-80": "BTR-80 APC",
    "ERO Ammunition Bunker B": "Ammunition Bunker",
    "ERO_Gate2": "Perimeter Gate",
    "Shelter": "Hardened Aircraft Shelter",
    "Tech hangar A": "Maintenance Hangar",
    "Military staff": "Command Post Building",
    "Comms tower M": "Communications Tower",
    "outpost_road_l": "Road Outpost",
    "house2arm": "Armed Watchtower",
    ".Ammunition depot": "Ammunition Depot",
    "ammo_cargo": "Ammunition Stack",
    "Workshop A": "Maintenance Workshop",
    "TV tower": "Broadcast Tower",
}


def _clean_fallback_name(raw_type: str) -> str:
    """Best-effort display name for a raw DCS Type not yet in UNIT_DISPLAY_NAMES --
    never used for classification, only so an unmapped type still reads as a name
    rather than a bare identifier. Replace separators with spaces and title-case;
    deliberately does not try to strip role suffixes (sr/tr/ln/...), since that's
    exactly the kind of guess that belongs in an explicit table entry instead."""
    cleaned = raw_type.replace("_", " ").replace(".", " ").strip()
    return cleaned if cleaned else raw_type


def display_unit_name(raw_type: str) -> str:
    return UNIT_DISPLAY_NAMES.get(raw_type, _clean_fallback_name(raw_type))


# --- Mission-kill targeting doctrine -----------------------------------------------
#
# This exists to pick the right unit to NAME a SAM group's JIPTL entry after -- not
# to print a how-to-kill-it explainer on the review page (the CFACC/ATO cell knows
# how to kill an SA-11; they don't need a note saying so). A group's "category" and
# "unit_name" answer what the group *is*, and that answer has to point at the thing
# that's actually doctrinally critical, not whichever vehicle happened to classify
# first -- naming a Buk site after its search radar when the TELARs are the real
# kill criterion is just a wrong target on the JIPTL. Two patterns show up:
#
#   single_point_radar   One radar/C2 node is the sole guidance source for every
#                        launcher in the group (the launchers are "dumb" -- no
#                        onboard engagement radar). Destroying that one node is a
#                        confirmed kill even if every launcher survives untouched.
#                        SA-6/Kub (1S91 Straight Flush), S-300/SA-10 (40B6M/30N6
#                        engagement radar), SA-5/S-200 (5N62V), SA-2/S-75 (Fan Song),
#                        Patriot (MPQ-53/65), Hawk (the HPI/track radar -- the PCP
#                        and search/CWAR radars are not the guidance source), and
#                        NASAMS (radar + command post together, since its launchers
#                        have no organic sensor either) all follow this pattern.
#
#   distributed_shooters Every launcher is a self-contained engagement system (its
#                        own onboard radar, or optical tracking that doesn't depend
#                        on a shared radar), so there is no single node to take out.
#                        All of them have to be destroyed for a confirmed kill, and
#                        killing only the group's shared sensor/C2 element (if any)
#                        leaves it capable. SA-11/Buk is the example the CFACC
#                        flagged: each 9A310 TELAR carries its own engagement radar
#                        and can self-guide without the 9S18 search radar or 9S470
#                        command post, so *all* TELARs must go down, not just the SR.
#                        Tor, Pantsir, and Tunguska are the trivial case of this --
#                        each vehicle already is the whole engagement system. Rapier
#                        also falls here: its primary guidance is optical, so the
#                        Blindfire radar is a weather/night aid, not the linchpin.
#
# This is real-world/doctrinal SAM engagement logic, not a DCS game-mechanics
# claim -- individual DCS modules don't all model "does the TEL need the radar"
# the same way, so treat targeting_note as targeting *guidance* for the ATO cell,
# not a guarantee of what the sim will actually do if only the listed element dies.
SAM_FAMILY_DOCTRINE = [
    {
        "id": "hawk",
        "match": ["hawk"],
        "mode": "single_point_radar",
        "critical_types": ["Hawk tr"],
        "note": "MIM-23 Hawk launchers (Hawk ln) have no onboard guidance radar -- missiles "
                "are guided by the High-Power Illuminator (Hawk tr). Destroying every Hawk tr "
                "is a confirmed mission kill even if the launchers, PCP, and CWAR survive.",
    },
    {
        "id": "buk_sa11",
        "match": ["sa-11", "buk"],
        "mode": "distributed_shooters",
        "shooter_types": ["SA-11 Buk LN 9A310M1"],
        "note": "Each 9A310 Buk TELAR carries its own engagement radar and can self-guide "
                "without the 9S18 search radar or 9S470 command post. All TELARs must be "
                "destroyed for a confirmed kill -- killing the SR or CC alone leaves the "
                "battery capable.",
    },
    {
        "id": "kub_sa6",
        "match": ["kub"],
        "mode": "single_point_radar",
        "critical_types": ["Kub 1S91 str"],
        "note": "The 1S91 Straight Flush is the sole fire-control radar for the whole Kub "
                "battery -- the 2P25 TELs have no independent guidance. Destroying the radar "
                "alone is a confirmed kill.",
    },
    {
        "id": "s300_sa10",
        "match": ["s-300"],
        "mode": "single_point_radar",
        "critical_types": ["S-300PS 40B6M tr", "S-300PS 5H63C 30H6_tr"],
        "note": "S-300PS TELs are cold-launch tubes with no organic guidance -- all are "
                "command-guided off the single engagement/tracking radar. Destroying that "
                "radar is a confirmed kill of the whole battalion even if TELs and the "
                "search radar survive.",
    },
    {
        "id": "s200_sa5",
        "match": ["s-200", "rpc_5n62v", "p14_sr", "rls_19j6"],
        "mode": "single_point_radar",
        "critical_types": ["RPC_5N62V"],
        "note": "S-200 is guided entirely by the single 5N62V (Square Pair) engagement "
                "radar. Destroying it is a confirmed kill regardless of how many launchers "
                "remain.",
    },
    {
        "id": "s75_sa2",
        "match": ["snr_75", "s_75", "75m_volhov"],
        "mode": "single_point_radar",
        "critical_types": ["SNR_75V"],
        "note": "An SA-2 battalion's launchers share one Fan Song (SNR-75) fire-control "
                "radar -- destroying it is a confirmed kill of the whole battalion.",
    },
    {
        "id": "patriot",
        "match": ["patriot"],
        "mode": "single_point_radar",
        "critical_types": ["Patriot str"],
        "note": "The AN/MPQ-53/65 (Patriot str) performs search, track, and illumination for "
                "the whole battery -- the launchers have no independent guidance. Destroying "
                "the radar is a confirmed kill.",
    },
    {
        "id": "nasams",
        "match": ["nasams"],
        "mode": "single_point_radar",
        "critical_types": ["NASAMS_Radar_MPQ64F1", "NASAMS_Command_Post"],
        "note": "NASAMS launchers have no onboard sensor -- both the AN/MPQ-64 radar and the "
                "Command Post must be destroyed to deny engagement; leaving either one alive "
                "lets it keep cueing launches.",
    },
    {
        "id": "tor_sa15",
        "match": ["tor 9a331", "tor_m2", "chap_torm2"],
        "mode": "distributed_shooters",
        "shooter_types": [],  # filled in dynamically -- every composition member is a shooter
        "note": "Each Tor TELAR is a self-contained search/track/launch vehicle with no "
                "shared radar node -- every TELAR in the group must be destroyed "
                "individually.",
    },
    {
        "id": "pantsir_sa22",
        "match": ["pantsirs1"],
        "mode": "distributed_shooters",
        "shooter_types": [],
        "note": "Each Pantsir-S1 is a self-contained gun/missile system with its own radar -- "
                "every vehicle must be destroyed individually.",
    },
    {
        "id": "tunguska_sa19",
        "match": ["tunguska"],
        "mode": "distributed_shooters",
        "shooter_types": [],
        "note": "Each Tunguska is a self-contained gun/missile system with its own radar -- "
                "every vehicle must be destroyed individually.",
    },
    {
        "id": "rapier",
        "match": ["rapier"],
        "mode": "distributed_shooters",
        "shooter_types": ["rapier_fsa_launcher"],
        "note": "Rapier's primary guidance is optical and works independently of the "
                "Blindfire radar -- all launchers must be destroyed for a confirmed kill; "
                "the Blindfire radar alone is not a kill.",
    },
]


def determine_kill_criteria(composition: dict):
    """Given a group's composition ({raw DCS Type: count}), return mission-kill
    targeting guidance, or None for groups this doctrine table doesn't cover
    (non-SAM categories, or a SAM family not yet added above -- see the module
    docstring for how to add one)."""
    keys_lower = [k.lower() for k in composition]

    for spec in SAM_FAMILY_DOCTRINE:
        if not any(any(m in k for k in keys_lower) for m in spec["match"]):
            continue

        if spec["mode"] == "single_point_radar":
            critical = [t for t in spec["critical_types"] if t in composition]
            if not critical:
                # The named radar type isn't in this particular group (e.g. destroyed
                # already, or this export just didn't include it) -- still flag the
                # doctrine so the ATO cell knows what to look for.
                critical = list(spec["critical_types"])
            return {
                "kill_mode": spec["mode"],
                "critical_elements": critical,
                "targeting_note": spec["note"],
            }

        if spec["mode"] == "distributed_shooters":
            shooters = [t for t in spec.get("shooter_types", []) if t in composition]
            if not shooters:
                # No named shooter list (Tor/Pantsir/Tunguska) -- every member present
                # is itself a complete engagement system, so all of them are "critical".
                shooters = list(composition.keys())
            return {
                "kill_mode": spec["mode"],
                "critical_elements": shooters,
                "targeting_note": spec["note"],
            }

    return None


def parse_dms(value: str) -> float:
    """Parse '34° 25.744' N' -> decimal degrees (negative for S/W)."""
    value = value.strip()
    m = DMS_RE.search(value)
    if not m:
        # fall back: maybe it's already a plain decimal
        try:
            return float(value)
        except ValueError:
            raise ValueError(f"Could not parse coordinate: {value!r}")
    deg = float(m.group(1))
    minutes = float(m.group(2))
    hemi = m.group(3).upper()
    dec = deg + minutes / 60.0
    if hemi in ("S", "W"):
        dec = -dec
    return dec


def haversine_nm(lat1, lon1, lat2, lon2) -> float:
    R_nm = 3440.065
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R_nm * math.asin(math.sqrt(a))


def point_in_polygon(lat, lon, polygon):
    """polygon: list of [lat, lon]. Standard ray-casting."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        lat_i, lon_i = polygon[i]
        lat_j, lon_j = polygon[j]
        if ((lon_i > lon) != (lon_j > lon)) and (
            lat < (lat_j - lat_i) * (lon - lon_i) / (lon_j - lon_i + 1e-15) + lat_i
        ):
            inside = not inside
        j = i
    return inside


def in_bma(lat, lon, bma: dict):
    if bma["shape"] == "circle":
        return haversine_nm(lat, lon, bma["center_lat"], bma["center_lon"]) <= bma["radius_nm"]
    elif bma["shape"] == "polygon":
        return point_in_polygon(lat, lon, bma["polygon"])
    raise ValueError(f"Unknown BMA shape: {bma['shape']}")


def load_classification(path: str):
    data = json.loads(Path(path).read_text())
    return data["units"]


def classify_type(type_name: str, units_table: dict):
    return units_table.get(type_name, units_table["DEFAULT"])


def load_airfields(path: str):
    """Airfields JSON: a list of {id, name, coalition, lat, lon, ...}, as produced
    by exporting the DCS MCP server's list_airfields for the campaign's miz (any
    theater -- the file is whatever that call returned, nothing theater-specific
    is hardcoded here)."""
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "result" in data:
        data = data["result"]  # tolerate a raw list_airfields tool-result dump
    return data


def cluster_aircraft_to_airfields(air_rows, airfields, units_table, radius_nm):
    """Associate red aircraft with the nearest airfield within radius_nm.
    Returns (airfield_targets, leftover_rows) -- leftover_rows are aircraft that
    had no airfield within range (e.g. an airborne CAP/orbit) and should fall
    back through the normal group-by-Group-field path."""
    by_airfield = defaultdict(list)
    leftover = []

    for r in air_rows:
        best_field, best_dist = None, None
        for af in airfields:
            d = haversine_nm(r["lat"], r["lon"], af["lat"], af["lon"])
            if d <= radius_nm and (best_dist is None or d < best_dist):
                best_field, best_dist = af, d
        if best_field is not None:
            by_airfield[best_field["id"]].append((r, best_field))
        else:
            leftover.append(r)

    airfield_targets = []
    for field_id, members in by_airfield.items():
        field = members[0][1]
        composition = defaultdict(int)
        for r, _ in members:
            composition[r["type"]] += 1

        # Represent the occupied airfield as a single Task 1 target, regardless
        # of which individual aircraft types are present -- a real ATO strikes
        # the field (runway, parking, POL), not one tail number at a time.
        airfield_targets.append({
            "group": f"AIRFIELD: {field.get('name', field_id)}",
            "unit_name": field.get("name", str(field_id)),
            "category": "Air - Airbase (occupied)",
            "task": 1,
            "tier": "HIGH",
            "lat": field["lat"],
            "lon": field["lon"],
            "unit_count": len(members),
            "composition": dict(composition),
            "source_file": "airfield_association",
        })

    return airfield_targets, leftover


def read_rows(csv_paths):
    rows = []
    for p in csv_paths:
        with open(p, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                try:
                    lat = parse_dms(r["Latitude"])
                    lon = parse_dms(r["Longitude"])
                except ValueError as e:
                    print(f"  WARNING: skipping row (bad coordinate) in {p}: {e}", file=sys.stderr)
                    continue
                rows.append({
                    "group": r["Group"],
                    "unit": r["Unit"],
                    "type": r["Type"],
                    "lat": lat,
                    "lon": lon,
                    "alt_ft": r.get("Altitude (ft)", ""),
                    "source_file": Path(p).name,
                })
    return rows


def split_air_rows(rows, units_table):
    """Split rows into (air_rows, other_rows) using each type's _dcs_category
    from the classification table (plane/helicopter -> air). Unclassified types
    are left in other_rows so the normal unclassified-logging path still sees them."""
    air_rows, other_rows = [], []
    for r in rows:
        entry = units_table.get(r["type"])
        if entry and entry.get("_dcs_category") in ("plane", "helicopter"):
            air_rows.append(r)
        else:
            other_rows.append(r)
    return air_rows, other_rows


def build_groups(rows, units_table):
    """Aggregate individual unit rows into one target entry per DCS Group."""
    by_group = defaultdict(list)
    for r in rows:
        by_group[r["group"]].append(r)

    groups = []
    unclassified_counter = defaultdict(int)

    for group_name, members in by_group.items():
        classified_members = []
        for m in members:
            entry = classify_type(m["type"], units_table)
            if entry["category"] == "Unclassified":
                unclassified_counter[m["type"]] += 1
            classified_members.append((m, entry))

        composition = defaultdict(int)
        for m, _ in classified_members:
            composition[m["type"]] += 1
        composition = dict(composition)

        # Which unit in this group is the one that actually has to die -- the TELAR
        # for an SA-11 (each one self-guides; the search radar alone isn't a kill),
        # the single fire-control radar for an SA-6 (the TELs have no independent
        # guidance), etc. See SAM_FAMILY_DOCTRINE. This decides which member names
        # and categorizes the group, so a Buk site is identified by its TELAR, not
        # by whichever radar/C2 vehicle happened to sort first.
        critical_types = set()
        kill_criteria = determine_kill_criteria(composition)
        if kill_criteria:
            critical_types = set(kill_criteria["critical_elements"])

        # Representative member: the doctrinally-critical type wins outright over
        # everything else in the group; among non-critical members (or when no
        # doctrine entry applies), highest tier_weight wins, ties broken by lowest
        # task number.
        tier_rank = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "IGNORE": 0}
        best_member, best_entry = max(
            classified_members,
            key=lambda pair: (
                1 if pair[0]["type"] in critical_types else 0,
                tier_rank.get(pair[1]["tier"], 0),
                -(pair[1]["task"] or 99),
            ),
        )

        if not best_entry.get("nominate", False) or best_entry["tier"] == "IGNORE":
            continue  # whole group is below the floor -- not a target

        lat_c = sum(m["lat"] for m, _ in classified_members) / len(classified_members)
        lon_c = sum(m["lon"] for m, _ in classified_members) / len(classified_members)

        groups.append({
            "group": group_name,
            "unit_name": display_unit_name(best_member["type"]),
            "category": best_entry["category"],
            "task": best_entry["task"],
            "tier": best_entry["tier"],
            "lat": lat_c,
            "lon": lon_c,
            "unit_count": len(classified_members),
            "composition": composition,
            "source_file": members[0]["source_file"],
        })

    return groups, unclassified_counter


def score_and_rank(groups, cycle_cfg):
    key_tasks = cycle_cfg["key_tasks"]
    tier_weight = cycle_cfg["tier_weight"]
    default_grade = cycle_cfg["default_grade_by_tier"]
    bma = cycle_cfg["battle_management_area"]

    in_area, out_area = [], []
    for g in groups:
        if in_bma(g["lat"], g["lon"], bma):
            in_area.append(g)
        else:
            out_area.append(g)

    for g in in_area:
        task_key = str(g["task"])
        task_def = key_tasks.get(task_key, {"name": "Unknown", "weight": 0})
        g["task_name"] = task_def["name"]
        g["score"] = task_def["weight"] + tier_weight.get(g["tier"], 0)
        g["grade"] = default_grade.get(g["tier"], "D")

    # Task 5 (CAS/TST) is continuous per doctrine -- never ranked into the JIPTL.
    in_area = [g for g in in_area if g["task"] != 5]

    in_area.sort(key=lambda g: g["score"], reverse=True)
    return in_area, out_area


def apply_caps(ranked, cycle_cfg):
    caps = cycle_cfg.get("max_targets_per_task", {})
    kept, overflow = [], []
    count_by_task = defaultdict(int)
    for g in ranked:
        task_key = str(g["task"])
        cap = caps.get(task_key)
        if cap is None or count_by_task[task_key] < cap:
            kept.append(g)
            count_by_task[task_key] += 1
        else:
            overflow.append(g)
    return kept, overflow


def assign_target_numbers(ordered_groups, start=10001):
    """Stamp each group with a unique ATO-referenceable target number (T10001, T10002, ...).

    Numbering follows the order the caller passes groups in -- by convention, call this
    with the JIPTL (highest priority) first, then the watchlist, then out-of-BMA drops,
    so the lowest numbers land on the targets the ATO cell actually works first. Numbers
    are only stable within one run of this script against one input set: re-running with
    different data, a different BMA, or different caps will re-sequence them. If targets
    need to keep the same number across cycles (e.g. a watchlist item later gets promoted
    into the JIPTL and should keep its designator), that requires a persistent registry
    keyed on group name -- not implemented here.
    """
    for i, g in enumerate(ordered_groups):
        g["target_number"] = f"T{start + i}"


def write_csv(path, rows, fieldnames):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            row = {k: r.get(k, "") for k in fieldnames}
            for k, v in list(row.items()):
                if isinstance(v, dict):
                    row[k] = "; ".join(f"{kk} x{vv}" for kk, vv in v.items())
                elif isinstance(v, list):
                    row[k] = "; ".join(str(x) for x in v)
            w.writerow(row)


def main():
    ap = argparse.ArgumentParser(description="Generate a Combined JIPTL from DCS Coalition Parser CSV exports.")
    ap.add_argument("--input", nargs="+", required=True, help="One or more Coalition Parser CSV files")
    ap.add_argument("--classification", default="config/unit_classification.json")
    ap.add_argument("--cycle-config", default="config/cycle_config.json")
    ap.add_argument("--out-prefix", default="output/jiptl")
    ap.add_argument("--airfields", default=None,
                     help="Airfields JSON (any theater) to enable Task 1 airbase association for aircraft rows")
    ap.add_argument("--airfield-radius-nm", type=float, default=3.0,
                     help="Max distance from an airfield for an aircraft to count as based there (default 3nm)")
    args = ap.parse_args()

    units_table = load_classification(args.classification)
    cycle_cfg = json.loads(Path(args.cycle_config).read_text())

    rows = read_rows(args.input)
    print(f"Read {len(rows)} unit rows from {len(args.input)} file(s).")

    airfield_targets = []
    if args.airfields:
        airfields = load_airfields(args.airfields)
        air_rows, rows = split_air_rows(rows, units_table)
        print(f"{len(air_rows)} aircraft rows found; matching against {len(airfields)} airfields "
              f"(radius {args.airfield_radius_nm}nm)...")
        airfield_targets, leftover_air = cluster_aircraft_to_airfields(
            air_rows, airfields, units_table, args.airfield_radius_nm)
        print(f"{len(airfield_targets)} airfields occupied by red aircraft; "
              f"{len(leftover_air)} aircraft rows had no airfield in range (treated as airborne flights).")
        rows = rows + leftover_air  # airborne flights still go through normal group-by-Group handling

    groups, unclassified = build_groups(rows, units_table)
    groups = airfield_targets + groups
    print(f"Formed {len(groups)} nominate-eligible target groups "
          f"({len(airfield_targets)} airfields + {len(groups) - len(airfield_targets)} other groups; "
          f"dismounts/unarmed/ignored types dropped).")

    ranked, out_of_bma = score_and_rank(groups, cycle_cfg)
    print(f"{len(ranked)} groups inside the BMA and ranked; {len(out_of_bma)} dropped as outside the BMA.")

    kept, overflow = apply_caps(ranked, cycle_cfg)
    print(f"{len(kept)} groups made the JIPTL after per-task caps; {len(overflow)} held on the watchlist.")

    # Stamp ATO-referenceable target numbers across the whole cycle's target universe --
    # JIPTL first so the top-priority targets get the lowest numbers, then watchlist,
    # then out-of-BMA drops (kept around for traceability even though they're excluded).
    assign_target_numbers(kept + overflow + out_of_bma)

    jiptl_fields = ["target_number", "group", "unit_name", "task", "task_name", "grade", "category", "tier", "score",
                     "unit_count", "composition", "lat", "lon", "source_file"]

    write_csv(f"{args.out_prefix}_jiptl.csv", kept, jiptl_fields)
    Path(f"{args.out_prefix}_jiptl.json").write_text(json.dumps(kept, indent=2))

    write_csv(f"{args.out_prefix}_watchlist.csv", overflow, jiptl_fields)
    write_csv(f"{args.out_prefix}_out_of_bma.csv", out_of_bma,
              ["target_number", "group", "unit_name", "category", "tier", "unit_count", "composition",
               "lat", "lon", "source_file"])

    if unclassified:
        unc_rows = [{"type": t, "count": c} for t, c in sorted(unclassified.items(), key=lambda x: -x[1])]
        write_csv(f"{args.out_prefix}_unclassified.csv", unc_rows, ["type", "count"])
        print(f"{len(unclassified)} unmapped unit Type(s) logged to {args.out_prefix}_unclassified.csv "
              f"-- add these to unit_classification.json.")

    print(f"\nJIPTL written to {args.out_prefix}_jiptl.csv / .json")


if __name__ == "__main__":
    main()
