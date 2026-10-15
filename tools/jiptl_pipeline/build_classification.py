#!/usr/bin/env python3
"""
Builds config/unit_classification.json from data/dcs_unit_catalog.json (the
full DCS/pydcs unit catalog, pulled via the DCS MCP server's list_unit_types).

This covers every unit type DCS ships with at the time the catalog was
pulled -- both coalitions, since pydcs doesn't tag country. Classification
is rule-based off each unit's pydcs "name" field, which already carries a
role prefix (SAM, EWR, MBT, IFV, APC, Truck, Infantry, MANPADS, AAA, SPAAA,
MLRS, SSM/SRBM, ATGM, Scout, Refueler, etc.) -- that prefix is pydcs's own
convention, not something this script invents.

Specific named high-value systems (S-300/SA-10, SA-11, SA-5/S-200, Patriot,
NASAMS, Hawk, etc.) get explicit id-level overrides so they land at HIGH
tier instead of falling into the generic "SAM -> MEDIUM" bucket.

Re-run this after re-exporting the catalog (new DCS modules add new unit
types from time to time). Anything the rules can't confidently place is
written to <out>_REVIEW.csv instead of silently guessing -- check that file
and add overrides below, or edit the generated JSON directly afterward.
"""

import json
import re
from pathlib import Path

CATALOG = Path(__file__).parent / "data" / "dcs_unit_catalog.json"
OUT = Path(__file__).parent / "config" / "unit_classification.json"
REVIEW_OUT = Path(__file__).parent / "config" / "unit_classification_REVIEW.csv"

# id -> explicit override (checked BEFORE the generic rules below)
ID_OVERRIDES = {
    # Strategic / high-value SAM systems -> HIGH regardless of generic SAM rule
    "S-300PS 40B6M tr": {"category": "SAM - Strategic (SA-10 TR)", "task": 1, "tier": "HIGH"},
    "S-300PS 40B6MD sr": {"category": "SAM - Strategic (SA-10 SR)", "task": 1, "tier": "HIGH"},
    "S-300PS 40B6MD sr_19J6": {"category": "SAM - Strategic (SA-10 SR)", "task": 1, "tier": "HIGH"},
    "S-300PS 54K6 cp": {"category": "SAM - Strategic (SA-10 C2)", "task": 1, "tier": "HIGH"},
    "S-300PS 5H63C 30H6_tr": {"category": "SAM - Strategic (SA-10 TR)", "task": 1, "tier": "HIGH"},
    "S-300PS 5P85C ln": {"category": "SAM - Strategic (SA-10 TEL)", "task": 1, "tier": "HIGH"},
    "S-300PS 5P85D ln": {"category": "SAM - Strategic (SA-10 TEL)", "task": 1, "tier": "HIGH"},
    "S-300PS 64H6E sr": {"category": "SAM - Strategic (SA-10 SR)", "task": 1, "tier": "HIGH"},
    "SA-11 Buk CC 9S470M1": {"category": "SAM - Medium Range (SA-11 C2)", "task": 1, "tier": "HIGH"},
    "SA-11 Buk LN 9A310M1": {"category": "SAM - Medium Range (SA-11 TEL)", "task": 1, "tier": "HIGH"},
    "SA-11 Buk SR 9S18M1": {"category": "SAM - Medium Range (SA-11 SR)", "task": 1, "tier": "HIGH"},
    "P14_SR": {"category": "SAM - Strategic (SA-5 SR)", "task": 1, "tier": "HIGH"},
    "RLS_19J6": {"category": "SAM - Strategic (SA-5 SR)", "task": 1, "tier": "HIGH"},
    "RPC_5N62V": {"category": "SAM - Strategic (SA-5 TR)", "task": 1, "tier": "HIGH"},
    "S-200_Launcher": {"category": "SAM - Strategic (SA-5 TEL)", "task": 1, "tier": "HIGH"},
    "Patriot AMG": {"category": "SAM - Strategic (Patriot)", "task": 1, "tier": "HIGH"},
    "Patriot ECS": {"category": "SAM - Strategic (Patriot)", "task": 1, "tier": "HIGH"},
    "Patriot EPP": {"category": "SAM - Strategic (Patriot)", "task": 1, "tier": "HIGH"},
    "Patriot cp": {"category": "SAM - Strategic (Patriot C2)", "task": 1, "tier": "HIGH"},
    "Patriot ln": {"category": "SAM - Strategic (Patriot TEL)", "task": 1, "tier": "HIGH"},
    "Patriot str": {"category": "SAM - Strategic (Patriot)", "task": 1, "tier": "HIGH"},
    "Hawk cwar": {"category": "SAM - Medium Range (Hawk)", "task": 1, "tier": "HIGH"},
    "Hawk ln": {"category": "SAM - Medium Range (Hawk TEL)", "task": 1, "tier": "HIGH"},
    "Hawk pcp": {"category": "SAM - Medium Range (Hawk C2)", "task": 1, "tier": "HIGH"},
    "Hawk sr": {"category": "SAM - Medium Range (Hawk)", "task": 1, "tier": "HIGH"},
    "Hawk tr": {"category": "SAM - Medium Range (Hawk)", "task": 1, "tier": "HIGH"},
    "NASAMS_Command_Post": {"category": "SAM - Medium Range (NASAMS C2)", "task": 1, "tier": "HIGH"},
    "NASAMS_LN_B": {"category": "SAM - Medium Range (NASAMS TEL)", "task": 1, "tier": "HIGH"},
    "NASAMS_LN_C": {"category": "SAM - Medium Range (NASAMS TEL)", "task": 1, "tier": "HIGH"},
    "NASAMS_Radar_MPQ64F1": {"category": "SAM - Medium Range (NASAMS)", "task": 1, "tier": "HIGH"},
    "CHAP_PantsirS1": {"category": "SAM - Short Range (SA-22 Pantsir)", "task": 1, "tier": "HIGH"},
    "2S6 Tunguska": {"category": "SAM/AAA - Short Range (SA-19 Tunguska)", "task": 1, "tier": "HIGH"},
    "CHAP_TorM2": {"category": "SAM - Short Range (SA-15 Tor-M2)", "task": 1, "tier": "HIGH"},
    "Tor 9A331": {"category": "SAM - Short Range (SA-15 Tor)", "task": 1, "tier": "HIGH"},
    # EWR specifically -- all HIGH, they're IADS nervous-system nodes
    "1L13 EWR": {"category": "EWR / GCI Radar", "task": 1, "tier": "HIGH"},
    "55G6 EWR": {"category": "EWR / GCI Radar", "task": 1, "tier": "HIGH"},
    "FPS-117": {"category": "EWR / GCI Radar", "task": 1, "tier": "HIGH"},
    "FPS-117 Dome": {"category": "EWR / GCI Radar", "task": 1, "tier": "HIGH"},
    "FPS-117 ECS": {"category": "EWR / GCI Radar", "task": 1, "tier": "HIGH"},
    "Dog Ear radar": {"category": "EWR / GCI Radar (mobile)", "task": 1, "tier": "MEDIUM"},
    "p-19 s-125 sr": {"category": "EWR / GCI Radar (mobile)", "task": 1, "tier": "MEDIUM"},
    # Theater ballistic / cruise missile launchers -- high value, time-sensitive
    "Scud_B": {"category": "SSM - Theater Ballistic Missile", "task": 1, "tier": "HIGH"},
    "CHAP_9K720_Cluster": {"category": "SRBM - Theater Ballistic Missile (Iskander)", "task": 1, "tier": "HIGH"},
    "CHAP_9K720_HE": {"category": "SRBM - Theater Ballistic Missile (Iskander)", "task": 1, "tier": "HIGH"},
    "CHAP_M142_ATACMS_M39A1": {"category": "SRBM - Theater Ballistic Missile (ATACMS)", "task": 1, "tier": "HIGH"},
    "CHAP_M142_ATACMS_M48": {"category": "SRBM - Theater Ballistic Missile (ATACMS)", "task": 1, "tier": "HIGH"},
    "hy_launcher": {"category": "AShM - Coastal Defense (Silkworm)", "task": 1, "tier": "HIGH"},
    "Silkworm_SR": {"category": "AShM - Coastal Defense Radar (Silkworm)", "task": 1, "tier": "HIGH"},
    # UAV ground segments are C2/ISR nodes, not logistics
    "Predator GCS": {"category": "C2 - UAV Ground Control Station", "task": 3, "tier": "MEDIUM"},
    "Predator TrojanSpirit": {"category": "C2 - UAV Comms Relay", "task": 3, "tier": "MEDIUM"},
    # ADA/JTAC dismount -- track, don't nominate as a strike target
    "JTAC": {"category": "Ground - JTAC (dismount)", "task": 5, "tier": "IGNORE", "nominate": False},
    # pydcs loadout placeholder entries, not real units -- exclude
    "PL5EII Loadout": {"category": "Not a unit (pydcs loadout entry)", "task": None, "tier": "IGNORE", "nominate": False},
    "PL8 Loadout": {"category": "Not a unit (pydcs loadout entry)", "task": None, "tier": "IGNORE", "nominate": False},
    "SD10 Loadout": {"category": "Not a unit (pydcs loadout entry)", "task": None, "tier": "IGNORE", "nominate": False},
    # Naval exceptions the generic rules would misfile
    "Type_021_1": {"category": "Naval - Missile Boat (combatant)", "task": 1, "tier": "MEDIUM"},
    "SH-60B": {"category": "Air - ASW Helicopter", "task": 1, "tier": "MEDIUM"},
    "SH-3W": {"category": "Air - ASW Helicopter", "task": 1, "tier": "MEDIUM"},

    # --- vehicle entries with no role-prefix in pydcs's name field ---
    "2B11 mortar": {"category": "Ground - Artillery (mortar)", "task": 2, "tier": "LOW"},
    "HEMTT_C-RAM_Phalanx": {"category": "SAM/AAA - Counter-RAM Point Defense (C-RAM)", "task": 1, "tier": "MEDIUM"},
    "HQ-7_LN_P": {"category": "SAM - Short Range (HQ-7)", "task": 1, "tier": "MEDIUM"},
    "HQ-7_LN_SP": {"category": "SAM - Short Range (HQ-7)", "task": 1, "tier": "MEDIUM"},
    "HQ-7_STR_SP": {"category": "SAM - Short Range (HQ-7)", "task": 1, "tier": "MEDIUM"},
    "Infantry AK Ins": {"category": "Ground - Dismounted Infantry", "task": 5, "tier": "IGNORE", "nominate": False},
    "L118_Unit": {"category": "Ground - Artillery (towed)", "task": 2, "tier": "LOW"},
    "PLZ05": {"category": "Ground - Artillery (self-propelled)", "task": 2, "tier": "MEDIUM"},
    "SK_C_28_naval_gun": {"category": "Ground - Coastal Defense Gun", "task": 1, "tier": "LOW"},
    "ZBD04A": {"category": "Ground - Armor (IFV)", "task": 2, "tier": "MEDIUM"},
    "ZTZ96B": {"category": "Ground - Armor (MBT)", "task": 2, "tier": "MEDIUM"},
    "house1arm": {"category": "Fortification / Defended Structure", "task": 3, "tier": "LOW"},
    "house2arm": {"category": "Fortification / Defended Structure", "task": 3, "tier": "LOW"},
    "houseA_arm": {"category": "Fortification / Defended Structure", "task": 3, "tier": "LOW"},
    "v1_launcher": {"category": "SSM - Theater Missile (WWII era)", "task": 1, "tier": "LOW"},
    "Allies_Director": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "DR_50Ton_Flat_Wagon": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "Flakscheinwerfer_37": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "GD-20": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "Grad_FDDM": {"category": "Ground - MLRS/Rocket Artillery", "task": 2, "tier": "HIGH"},
    "Maschinensatz_33": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "S_75_ZIL": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "Suidae": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},
    "Trolley bus": {"category": "Ground - Logistics/Support (unarmed)", "task": 4, "tier": "IGNORE", "nominate": False},

    # --- ships: pydcs "name" is a proper/hull name with no role prefix, so every one gets an explicit entry ---
    "ALBATROS": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "BDK-775": {"category": "Naval - Amphibious/Landing", "task": 2, "tier": "MEDIUM"},
    "CHAP_Project22160": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "CHAP_Project22160_TorM2KM": {"category": "Naval - Surface Combatant (SAM-equipped)", "task": 1, "tier": "HIGH"},
    "CVN_71": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "CVN_72": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "CVN_73": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "CVN_75": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "CV_1143_5": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "CastleClass_01": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "Dry-cargo ship-1": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "Dry-cargo ship-2": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "ELNYA": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "Essex": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "Forrestal": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "HandyWind": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "HarborTug": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "IGNORE", "nominate": False},
    "Higgins_boat": {"category": "Naval - Amphibious/Landing (small craft)", "task": 2, "tier": "LOW"},
    "IMPROVED_KILO": {"category": "Naval - Submarine", "task": 2, "tier": "HIGH"},
    "KILO": {"category": "Naval - Submarine", "task": 2, "tier": "HIGH"},
    "KUZNECOW": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "LHA_Tarawa": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "LST_Mk2": {"category": "Naval - Amphibious/Landing", "task": 2, "tier": "MEDIUM"},
    "La_Combattante_II": {"category": "Naval - Surface Combatant (missile boat)", "task": 2, "tier": "MEDIUM"},
    "MOLNIYA": {"category": "Naval - Surface Combatant (missile boat)", "task": 2, "tier": "MEDIUM"},
    "MOSCOW": {"category": "Naval - Surface Combatant (S-300F area air defense)", "task": 1, "tier": "HIGH"},
    "NEUSTRASH": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "PERRY": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "PIOTR": {"category": "Naval - Surface Combatant (S-300F area air defense)", "task": 1, "tier": "HIGH"},
    "REZKY": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "SOM": {"category": "Naval - Submarine", "task": 2, "tier": "MEDIUM"},
    "Schnellboot_type_S130": {"category": "Naval - Surface Combatant (small craft, WWII)", "task": 2, "tier": "LOW"},
    "Seawise_Giant": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "Ship_Tilde_Supply": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "Stennis": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "TICONDEROG": {"category": "Naval - Surface Combatant (Aegis area air defense)", "task": 1, "tier": "HIGH"},
    "Type_052B": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "Type_052C": {"category": "Naval - Surface Combatant (HQ-9 area air defense)", "task": 1, "tier": "HIGH"},
    "Type_054A": {"category": "Naval - Surface Combatant", "task": 2, "tier": "MEDIUM"},
    "Type_071": {"category": "Naval - Amphibious/Landing", "task": 2, "tier": "MEDIUM"},
    "Type_093": {"category": "Naval - Submarine", "task": 1, "tier": "HIGH"},
    "USS_Arleigh_Burke_IIa": {"category": "Naval - Surface Combatant (Aegis area air defense)", "task": 1, "tier": "HIGH"},
    "USS_Samuel_Chase": {"category": "Naval - Amphibious/Landing", "task": 2, "tier": "LOW"},
    "Uboat_VIIC": {"category": "Naval - Submarine (WWII)", "task": 2, "tier": "MEDIUM"},
    "VINSON": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "ZWEZDNY": {"category": "Naval - Surface Combatant (small craft)", "task": 2, "tier": "LOW"},
    "ara_vdm": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "MEDIUM"},
    "atconveyor": {"category": "Naval - Logistics/Non-combatant", "task": 4, "tier": "LOW"},
    "hms_invincible": {"category": "Naval - Carrier/Amphibious Assault", "task": 1, "tier": "HIGH"},
    "leander-gun-achilles": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "leander-gun-andromeda": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "leander-gun-ariadne": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "leander-gun-condell": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "leander-gun-lynch": {"category": "Naval - Surface Combatant", "task": 2, "tier": "LOW"},
    "santafe": {"category": "Naval - Submarine", "task": 2, "tier": "MEDIUM"},
    "speedboat": {"category": "Naval - Small Craft (armed)", "task": 2, "tier": "LOW"},

    # --- static objects worth nominating as real targets ---
    "Shelter": {"category": "Air - Aircraft Shelter (HAS)", "task": 1, "tier": "HIGH"},
    "Shelter B": {"category": "Air - Aircraft Shelter (HAS)", "task": 1, "tier": "HIGH"},
    "Shelter01": {"category": "Air - Aircraft Shelter (HAS)", "task": 1, "tier": "MEDIUM"},
    "Shelter02": {"category": "Air - Aircraft Shelter (HAS)", "task": 1, "tier": "MEDIUM"},
    "Tech hangar A": {"category": "Air - Maintenance Hangar", "task": 1, "tier": "MEDIUM"},
    "Hangar A": {"category": "Air - Maintenance Hangar", "task": 1, "tier": "MEDIUM"},
    "Hangar B": {"category": "Air - Maintenance Hangar", "task": 1, "tier": "MEDIUM"},
    ".Ammunition depot": {"category": "Ground - Ammunition Depot", "task": 4, "tier": "MEDIUM"},
    "ERO Ammunition Bunker B": {"category": "Ground - Ammunition Bunker", "task": 4, "tier": "MEDIUM"},
    "FARP Ammo Dump Coating": {"category": "Ground - Ammunition Storage (FARP)", "task": 4, "tier": "MEDIUM"},
    "ammo_cargo": {"category": "Ground - Ammunition Stack", "task": 4, "tier": "LOW"},
    "M92_Ammo_Pallet": {"category": "Ground - Ammunition Stack", "task": 4, "tier": "LOW"},
    "m117_cargo": {"category": "Ground - Ammunition Stack (bombs)", "task": 4, "tier": "LOW"},
    "FARP Fuel Depot": {"category": "Ground - Fuel Storage (FARP)", "task": 4, "tier": "MEDIUM"},
    "Fuel tank": {"category": "Ground - Fuel Storage", "task": 4, "tier": "MEDIUM"},
    "fueltank_cargo": {"category": "Ground - Fuel Storage", "task": 4, "tier": "MEDIUM"},
    "APFC fuel": {"category": "Ground - Fuel Storage", "task": 4, "tier": "MEDIUM"},
    "Chemical tank A": {"category": "Ground - Chemical Storage", "task": 4, "tier": "MEDIUM"},
    ".Command Center": {"category": "C2 - Command Center", "task": 3, "tier": "HIGH"},
    "af_hq": {"category": "C2 - Airfield HQ", "task": 3, "tier": "HIGH"},
    "FARP CP Blindage": {"category": "C2 - Command Post (FARP)", "task": 3, "tier": "MEDIUM"},
    "Military staff": {"category": "C2 - Command Building", "task": 3, "tier": "MEDIUM"},
    "Fire Control Bunker": {"category": "C2 - Fire Control Bunker", "task": 1, "tier": "HIGH"},
    "Comms tower M": {"category": "C2 - Communications Node", "task": 3, "tier": "MEDIUM"},
    "TV tower": {"category": "Infrastructure - Comms/Broadcast Tower", "task": 3, "tier": "LOW"},
    "Railway station": {"category": "Ground - Infrastructure (rail)", "task": 2, "tier": "LOW"},
    "Bridge": {"category": "Ground - Infrastructure (bridge, LOC choke point)", "task": 2, "tier": "MEDIUM"},
    "Pump station": {"category": "Ground - Infrastructure (POL pumping)", "task": 4, "tier": "LOW"},
    "Oil derrick": {"category": "Ground - Infrastructure (oil)", "task": 4, "tier": "LOW"},
    "Oil platform": {"category": "Ground - Infrastructure (oil, offshore)", "task": 4, "tier": "LOW"},
    "Repair workshop": {"category": "Ground - Maintenance Workshop", "task": 4, "tier": "LOW"},
    "Workshop A": {"category": "Ground - Maintenance Workshop", "task": 4, "tier": "LOW"},
    "Warehouse": {"category": "Ground - Logistics Warehouse", "task": 4, "tier": "LOW"},
    "Small werehouse 1": {"category": "Ground - Logistics Warehouse", "task": 4, "tier": "LOW"},
    "Small werehouse 2": {"category": "Ground - Logistics Warehouse", "task": 4, "tier": "LOW"},
    "Small werehouse 3": {"category": "Ground - Logistics Warehouse", "task": 4, "tier": "LOW"},
    "Small werehouse 4": {"category": "Ground - Logistics Warehouse", "task": 4, "tier": "LOW"},
    "Barracks 2": {"category": "Ground - Barracks", "task": 4, "tier": "LOW"},
    "house2arm": {"category": "Fortification - Watchtower (armed)", "task": 3, "tier": "LOW"},
    "outpost_road_l": {"category": "Fortification - Road Outpost", "task": 3, "tier": "LOW"},
    "gbu_43b_airdrop": {"category": "Not a unit (weapon-effect prop)", "task": None, "tier": "IGNORE", "nominate": False},
    "ERO_Gate2": {"category": "Infrastructure - Gate/Fence (non-target)", "task": 4, "tier": "IGNORE", "nominate": False},
    "Airshow_Crowd": {"category": "Non-target (decorative prop)", "task": None, "tier": "IGNORE", "nominate": False},
    "White_Tyre": {"category": "Marker (operator-placed target reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
    "Black_Tyre": {"category": "Marker (operator-placed reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
    "Black_Tyre_RF": {"category": "Marker (operator-placed reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
    "Black_Tyre_WF": {"category": "Marker (operator-placed reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
    "Red_Flag": {"category": "Marker (operator-placed reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
    "White_Flag": {"category": "Marker (operator-placed reference point, not hardware)", "task": None, "tier": "IGNORE", "nominate": False},
}

# (regex on pydcs "name" field, category label, task, tier, nominate) -- first match wins.
# Applied only when the id has no ID_OVERRIDES entry.
NAME_RULES = [
    (r"^MANPADS", "Ground - MANPADS (dismount)", 1, "LOW", False),
    (r"^SAM", "SAM (generic)", 1, "MEDIUM", True),
    (r"^EWR", "EWR / GCI Radar", 1, "HIGH", True),
    (r"^SPAAA|^AAA", "Ground - AAA", 1, "LOW", True),  # radar-guided SPAAA upgraded below
    (r"^MLRS|^MRLS", "Ground - MLRS/Rocket Artillery", 2, "HIGH", True),
    (r"^SSM|^SRBM", "SSM/SRBM - Theater Missile", 1, "HIGH", True),
    (r"^AShM", "AShM - Anti-Ship Missile", 1, "HIGH", True),
    (r"^ATGM", "Ground - ATGM (point defense)", 2, "MEDIUM", True),
    (r"^MBT|^MT\b", "Ground - Armor (MBT)", 2, "MEDIUM", True),
    (r"^LT\b", "Ground - Armor (Light Tank)", 2, "LOW", True),
    (r"^Tk\b", "Ground - Armor (vintage tank)", 2, "LOW", True),
    (r"^IFV", "Ground - Armor (IFV)", 2, "MEDIUM", True),
    (r"^APC", "Ground - Armor (APC, lightly armed)", 2, "LOW", True),
    (r"^SPH|^SPG|^SPM|^FH\b", "Ground - Artillery (self-propelled/towed)", 2, "MEDIUM", True),
    (r"^Scout", "Ground - Recon/Scout", 3, "LOW", True),
    (r"^MCC", "C2 - Mobile Command/Control Node", 3, "MEDIUM", True),
    (r"^Bunker|arm$|^Outpost|outpost", "Fortification / C2 Node", 3, "LOW", True),
    (r"^Refueler|^Truck|^Tractor|^Firefighter|^Bus\b|^Car\b|^LUV|^Ammo|^GPU|^Rwy\.", "Ground - Logistics/Support (unarmed)", 4, "IGNORE", False),
    (r"^Infantry|^Paratrooper", "Ground - Dismounted Infantry", 5, "IGNORE", False),
    (r"^Beacon|^Diesel|GPS Spoofer|^PRMG|^RSBN|drivable", "Infrastructure - Misc (non-target)", 4, "IGNORE", False),
    # --- planes ---
    (r"^(A-50|E-3A|E-2C|KJ-2000)$", "Air - AEW&C", 1, "HIGH", True),
    (r"^(Tu-22M3|Tu-95MS|Tu-160|B-1B|B-52H|H-6J|B-17G)$", "Air - Bomber", 1, "HIGH", True),
    (r"^(IL-78M|KC-135|KC130|KC135MPRS|S-3B Tanker)$", "Air - Tanker", 1, "MEDIUM", True),
    (r"^(An-26B|An-30M|C-130|C-130J-30|C-17A|C-47|IL-76MD|Yak-40)$", "Air - Transport", 4, "LOW", True),
    (r"^(MQ-9 Reaper|RQ-1A Predator|WingLoong-I)$", "Air - UAV (ISR/Strike)", 3, "MEDIUM", True),
    (r"^(L-39C|L-39ZA|MB-339A|MB-339APAN|C-101CC|C-101EB|Hawk|Yak-52|Christen Eagle II|Falcon_Gyrocopter|F-86F Sabre|F-86F_FC|MiG-15bis|MiG-15bis_FC|F-100D|I-16|La-7|Bf-109K-4|FW-190A8|FW-190D9|Ju-88A4|P-47D-30|P-47D-30bl1|P-47D-40|P-51D|P-51D-30-NA|TF-51D|SpitfireLFMkIX|SpitfireLFMkIXCW|F4U-1D|F4U-1D_CW|MosquitoFBMkVI|QF-4E)$",
     "Air - Trainer/Vintage (low operational value)", 1, "LOW", True),
    # everything else still in the plane category = modern fighter/attack airframe
    # --- helicopters ---
    (r"^(AH-1W|AH-64A|AH-64D|AH-64D_BLK_II|CHAP_TigerUHT|Ka-50|Ka-50_3|Mi-24P|Mi-24V|Mi-28N|SA342Minigun|SA342Mistral)$",
     "Air - Attack Helicopter", 1, "HIGH", True),
    (r"^(CH-47D|CH-47Fbl1|CH-53E|Ka-27|Mi-26|Mi-8MT|UH-1H|UH-60A)$", "Air - Transport Helicopter", 4, "LOW", True),
    (r"^(OH-58D|OH58D|SA342L|SA342M)$", "Air - Scout Helicopter", 3, "MEDIUM", True),
    # Ships are all handled via ID_OVERRIDES above -- pydcs ship "name" fields are hull
    # names with no consistent role prefix, so per-id entries are more reliable than regex here.
]

AIR_CATEGORY_FALLBACK = {"plane": "Air - Fighter/Multirole (unclassified subtype)", "helicopter": "Air - Helicopter (unclassified subtype)"}

# Community mod-pack unit types encountered in real missions that DO NOT exist in the
# stock DCS/pydcs catalog at all (list_unit_types never returns them), so ID_OVERRIDES
# above has no catalog entry to attach to. Added here as their own entries so they
# survive a rebuild instead of silently falling back to "unclassified" every time.
# Append to this dict as new mod-pack types turn up in unclassified_types.csv.
MOD_PACK_UNITS = {
    "ERO_Toyota_Red": {"category": "Ground - Light Vehicle (unarmed technical, ERO mod pack)", "task": 4, "tier": "IGNORE", "nominate": False},
    "ERO_Toyota_Camo": {"category": "Ground - Light Vehicle (unarmed technical, ERO mod pack)", "task": 4, "tier": "IGNORE", "nominate": False},
    "ERO_Toyota_White": {"category": "Ground - Light Vehicle (unarmed technical, ERO mod pack)", "task": 4, "tier": "IGNORE", "nominate": False},
    "ERO_ZU23_Toyota_armored": {"category": "Ground - AAA (technical, visual, ERO mod pack)", "task": 1, "tier": "LOW", "nominate": True},
    "ERO_Gate2": {"category": "Infrastructure - Gate/Fence (non-target, ERO mod pack)", "task": 4, "tier": "IGNORE", "nominate": False},
    "ERO Ammunition Bunker B": {"category": "Ground - Ammunition Bunker (ERO mod pack)", "task": 4, "tier": "MEDIUM", "nominate": True},
}


def classify(unit_id, name, source_category):
    if unit_id in ID_OVERRIDES:
        o = ID_OVERRIDES[unit_id]
        return {
            "category": o["category"],
            "task": o["task"],
            "tier": o["tier"],
            "nominate": o.get("nominate", o["tier"] != "IGNORE"),
            "_source": "override",
        }

    for pattern, category, task, tier, nominate in NAME_RULES:
        if re.search(pattern, name, re.IGNORECASE):
            # radar-guided SPAAA bump: Shilka/Gepard/Vulcan/ZSU are MEDIUM not LOW
            if category == "Ground - AAA" and re.search(r"Shilka|Gepard|Vulcan|ZSU|Tunguska", name, re.IGNORECASE):
                tier = "MEDIUM"
            return {"category": category, "task": task, "tier": tier, "nominate": nominate, "_source": "rule"}

    # No rule matched. For plane/helicopter default to a reasonable fighter/attack
    # bucket (most unmatched entries in those categories are combat airframes);
    # for vehicle/ship, default to IGNORE and flag for review.
    if source_category == "plane":
        return {"category": "Air - Fighter/Attack (default)", "task": 1, "tier": "HIGH", "nominate": True, "_source": "default-plane"}
    if source_category == "helicopter":
        return {"category": "Air - Helicopter (default)", "task": 1, "tier": "MEDIUM", "nominate": True, "_source": "default-heli"}
    if source_category == "static":
        # Most unlisted statics are decorative scenery (containers, sandbags, tents, farms,
        # cafes...) with no military value -- default to IGNORE rather than HIGH. The named
        # overrides above catch the statics that ARE real targets (shelters, bunkers, C2).
        return {"category": "Static - scenery/decorative (default, not a target)", "task": None, "tier": "IGNORE", "nominate": False, "_source": "default-static"}
    return {"category": "Unclassified", "task": None, "tier": "IGNORE", "nominate": False, "_source": "unmatched"}


def main():
    catalog = json.loads(CATALOG.read_text())
    units = {}
    review_rows = []

    for source_category in ("vehicle", "plane", "helicopter", "ship", "static"):
        for entry in catalog.get(source_category, []):
            uid, name = entry["id"], entry["name"]
            result = classify(uid, name, source_category)
            units[uid] = {
                "category": result["category"],
                "task": result["task"],
                "tier": result["tier"],
                "nominate": result["nominate"],
                "_dcs_category": source_category,
                "_dcs_name": name,
            }
            if result["_source"] in ("unmatched", "default-plane", "default-heli"):
                review_rows.append((uid, name, source_category, result["category"], result["tier"]))

    # Community mod-pack unit types (e.g. ERO_* objects) that don't exist in the
    # stock DCS/pydcs catalog at all, so the catalog loop above never reaches them.
    # Hand-added here from unclassified_types.csv as they turn up -- not reviewed
    # the same way since they're intentional, hand-checked entries.
    for uid, entry in MOD_PACK_UNITS.items():
        units[uid] = {
            "category": entry["category"],
            "task": entry["task"],
            "tier": entry["tier"],
            "nominate": entry.get("nominate", entry["tier"] != "IGNORE"),
            "_dcs_category": "mod_pack",
            "_dcs_name": uid,
        }

    units["DEFAULT"] = {
        "category": "Unclassified",
        "task": None,
        "tier": "IGNORE",
        "nominate": False,
        "note": "Type not in table -- logged to unclassified_types.csv on each jiptl_generate.py run",
    }

    out_data = {
        "_comment": "Auto-generated by build_classification.py from data/dcs_unit_catalog.json. "
                    "Safe to hand-edit afterward -- re-running this script OVERWRITES the file, "
                    "so move hand overrides into ID_OVERRIDES in build_classification.py if you want them to survive a rebuild.",
        "_tier_scale": "HIGH, MEDIUM, LOW, IGNORE. IGNORE types are dropped before scoring regardless of Key Task match.",
        "_key_task_scale": "1=Air Superiority, 2=Interdict LOCs, 3=Destroy C2, 4=Attrit Rear Echelon, 5=CAS/TST (continuous, excluded from JIPTL ranking).",
        "units": units,
    }
    OUT.write_text(json.dumps(out_data, indent=2))
    print(f"Wrote {len(units)} classified unit types to {OUT}")

    if review_rows:
        with open(REVIEW_OUT, "w") as f:
            f.write("id,name,dcs_category,assigned_category,assigned_tier\n")
            for row in review_rows:
                f.write(",".join(f'"{x}"' for x in row) + "\n")
        print(f"{len(review_rows)} entries used a fallback/default rule -- review {REVIEW_OUT}")


if __name__ == "__main__":
    main()
