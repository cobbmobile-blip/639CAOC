// JIPTL nomination pipeline — a browser port of the 639CAOC jiptl_pipeline (jiptl_generate.py):
//   REDFOR order of battle -> classify each DCS unit type -> group by DCS group -> pick the
//   doctrinally-critical unit to name the group -> keep groups inside the Battle Management Area
//   -> score = Key Task weight + value-tier weight -> rank -> cap per task -> T10001… numbers.
// The built-in unit table is a starting set; load the full unit_classification.json from the
// 639CAOC repo on the nomination page to use the complete DCS catalogue.
(function () {
  // ---------- cycle settings (mirrors config/cycle_config.json) ----------
  const DEFAULT_CYCLE = {
    keyTasks: {
      1: { name: "Achieve and maintain air superiority", weight: 100, cap: 10 },
      2: { name: "Interdict lines of communication", weight: 80, cap: 8 },
      3: { name: "Destroy command and control nodes", weight: 60, cap: 6 },
      4: { name: "Attrit rear echelon elements", weight: 40, cap: 6 },
      5: { name: "Assist front-line units (CAS/TST) — continuous, not ranked", weight: 0, cap: 0 }
    },
    tierWeight: { HIGH: 30, MEDIUM: 20, LOW: 10, IGNORE: 0 },
    defaultGrade: { HIGH: "A", MEDIUM: "B", LOW: "C" }
  };
  const EXCLUDED_TASKS = ["5"]; // CAS/TST is continuous per doctrine — never ranked into the JIPTL

  // ---------- built-in unit classification: DCS type -> [display name, category, task, tier, nominate] ----------
  const U = (name, category, task, tier, nominate = true) => ({ name, category, task, tier, nominate });
  const SAM_L = "SAM (long range)", SAM_M = "SAM (medium range)", SHORAD = "SAM (short range)";
  const BUILTIN_UNITS = {
    // long-range SAM
    "S-300PS 40B6M tr": U("S-300PS (SA-10) Tracking Radar", SAM_L, 1, "HIGH"),
    "S-300PS 5H63C 30H6_tr": U("S-300PS (SA-10) Tracking Radar", SAM_L, 1, "HIGH"),
    "S-300PS 40B6MD sr": U("S-300PS (SA-10) Search Radar", SAM_L, 1, "HIGH"),
    "S-300PS 40B6MD sr_19J6": U("S-300PS (SA-10) Search Radar", SAM_L, 1, "HIGH"),
    "S-300PS 64H6E sr": U("S-300PS (SA-10) Search Radar", SAM_L, 1, "HIGH"),
    "S-300PS 54K6 cp": U("S-300PS (SA-10) Command Post", SAM_L, 1, "HIGH"),
    "S-300PS 5P85C ln": U("S-300PS (SA-10) TEL", SAM_L, 1, "HIGH"),
    "S-300PS 5P85D ln": U("S-300PS (SA-10) TEL", SAM_L, 1, "HIGH"),
    "RPC_5N62V": U("S-200 (SA-5) Tracking Radar", SAM_L, 1, "HIGH"),
    "S-200_Launcher": U("S-200 (SA-5) Launcher", SAM_L, 1, "HIGH"),
    "RLS_19J6": U("S-200 (SA-5) Acquisition Radar", SAM_L, 1, "HIGH"),
    "Patriot str": U("MIM-104 Patriot Tracking Radar", SAM_L, 1, "HIGH"),
    "Patriot ln": U("MIM-104 Patriot Launcher", SAM_L, 1, "HIGH"),
    "Patriot cp": U("MIM-104 Patriot Command Post", SAM_L, 1, "HIGH"),
    "Patriot ECS": U("MIM-104 Patriot Engagement Control Station", SAM_L, 1, "HIGH"),
    "Patriot AMG": U("MIM-104 Patriot Antenna Mast Group", SAM_L, 1, "MEDIUM"),
    "Patriot EPP": U("MIM-104 Patriot Power Plant", SAM_L, 1, "MEDIUM"),
    // medium-range SAM
    "SNR_75V": U("SA-2 Fire Control Radar", SAM_M, 1, "HIGH"),
    "S_75M_Volhov": U("S-75 Volkhov (SA-2) Launcher", SAM_M, 1, "HIGH"),
    "snr s-125 tr": U("S-125 (SA-3) Low Blow Radar", SAM_M, 1, "HIGH"),
    "5p73 s-125 ln": U("S-125 (SA-3) Launcher", SAM_M, 1, "HIGH"),
    "p-19 s-125 sr": U("P-19 Search Radar (SA-3 support)", SAM_M, 1, "MEDIUM"),
    "Kub 1S91 str": U("2K12 Kub (SA-6) Target Radar", SAM_M, 1, "HIGH"),
    "Kub 2P25 ln": U("2K12 Kub (SA-6) TEL", SAM_M, 1, "HIGH"),
    "SA-11 Buk LN 9A310M1": U("9A310 Buk (SA-11) TEL", SAM_M, 1, "HIGH"),
    "SA-11 Buk SR 9S18M1": U("9S18 Buk (SA-11) Search Radar", SAM_M, 1, "HIGH"),
    "SA-11 Buk CC 9S470M1": U("9S470 Buk (SA-11) Command Post", SAM_M, 1, "HIGH"),
    "HQ-7_STR_SP": U("HQ-7 Search/Track Radar", SAM_M, 1, "MEDIUM"),
    "HQ-7_LN_SP": U("HQ-7 Launcher", SAM_M, 1, "MEDIUM"),
    "Hawk tr": U("MIM-23 Hawk Track Radar", SAM_M, 1, "HIGH"),
    "Hawk sr": U("MIM-23 Hawk Search Radar", SAM_M, 1, "HIGH"),
    "Hawk cwar": U("MIM-23 Hawk CWAR", SAM_M, 1, "MEDIUM"),
    "Hawk pcp": U("MIM-23 Hawk Platoon Command Post", SAM_M, 1, "MEDIUM"),
    "Hawk ln": U("MIM-23 Hawk Launcher", SAM_M, 1, "HIGH"),
    "NASAMS_Radar_MPQ64F1": U("NASAMS AN/MPQ-64 Radar", SAM_M, 1, "HIGH"),
    "NASAMS_Command_Post": U("NASAMS Command Post", SAM_M, 1, "HIGH"),
    "NASAMS_LN_B": U("NASAMS Launcher", SAM_M, 1, "HIGH"),
    "NASAMS_LN_C": U("NASAMS Launcher", SAM_M, 1, "HIGH"),
    // short-range SAM / SHORAD
    "Tor 9A331": U("9K330 Tor (SA-15) TEL", SHORAD, 1, "MEDIUM"),
    "CHAP_TorM2": U("Tor-M2 (SA-15) TEL", SHORAD, 1, "MEDIUM"),
    "Osa 9A33 ln": U("9K33 Osa (SA-8) TELAR", SHORAD, 1, "MEDIUM"),
    "2S6 Tunguska": U("2S6 Tunguska (SA-19)", SHORAD, 1, "MEDIUM"),
    "CHAP_PantsirS1": U("Pantsir-S1 (SA-22)", SHORAD, 1, "MEDIUM"),
    "Strela-10M3": U("9K35 Strela-10 (SA-13)", SHORAD, 1, "LOW"),
    "Strela-1 9P31": U("9K31 Strela-1 (SA-9)", SHORAD, 1, "LOW"),
    "Roland ADS": U("Roland SAM", SHORAD, 1, "MEDIUM"),
    "Roland Radar": U("Roland Search Radar", SHORAD, 1, "MEDIUM"),
    "rapier_fsa_launcher": U("Rapier SAM Launcher", SHORAD, 1, "MEDIUM"),
    "rapier_fsa_blindfire_radar": U("Rapier Blindfire Tracking Radar", SHORAD, 1, "MEDIUM"),
    "rapier_fsa_optical_tracker_unit": U("Rapier Optical Tracker", SHORAD, 1, "MEDIUM"),
    "M48 Chaparral": U("M48 Chaparral", SHORAD, 1, "LOW"),
    "M1097 Avenger": U("M1097 Avenger", SHORAD, 1, "LOW"),
    // early warning
    "1L13 EWR": U("1L13 Early Warning Radar", "Early warning radar", 1, "MEDIUM"),
    "55G6 EWR": U("55G6 Early Warning Radar", "Early warning radar", 1, "MEDIUM"),
    "P14_SR": U("P-14 Early Warning Radar", "Early warning radar", 1, "MEDIUM"),
    "FPS-117": U("AN/FPS-117 Early Warning Radar", "Early warning radar", 1, "MEDIUM"),
    // AAA
    "ZSU-23-4 Shilka": U("ZSU-23-4 Shilka", "AAA", 1, "LOW"),
    "ZU-23 Emplacement": U("ZU-23-2 AAA", "AAA", 1, "LOW"),
    "ZU-23 Emplacement Closed": U("ZU-23-2 AAA", "AAA", 1, "LOW"),
    "Ural-375 ZU-23": U("ZU-23-2 on Ural truck", "AAA", 1, "LOW"),
    "KS-19": U("KS-19 100mm AAA", "AAA", 1, "LOW"),
    "S-60_Type59_Artillery": U("S-60 57mm AAA", "AAA", 1, "LOW"),
    "Gepard": U("Gepard SPAAG", "AAA", 1, "LOW"),
    // MANPADS / dismounts — not targets
    "SA-18 Igla manpad": U("SA-18 Igla MANPADS", "Dismounts", 1, "IGNORE", false),
    "SA-18 Igla-S manpad": U("SA-18 Igla-S MANPADS", "Dismounts", 1, "IGNORE", false),
    "Soldier stinger": U("Stinger MANPADS", "Dismounts", 1, "IGNORE", false),
    "Infantry AK": U("Infantry", "Dismounts", 4, "IGNORE", false),
    "Soldier AK": U("Infantry", "Dismounts", 4, "IGNORE", false),
    // aircraft (parked or airborne)
    "MiG-29A": U("MiG-29A Fulcrum", "Aircraft", 1, "HIGH"), "MiG-29S": U("MiG-29S Fulcrum", "Aircraft", 1, "HIGH"),
    "Su-27": U("Su-27 Flanker", "Aircraft", 1, "HIGH"), "Su-30": U("Su-30 Flanker", "Aircraft", 1, "HIGH"),
    "MiG-31": U("MiG-31 Foxhound", "Aircraft", 1, "HIGH"), "MiG-23MLD": U("MiG-23 Flogger", "Aircraft", 1, "MEDIUM"),
    "MiG-21Bis": U("MiG-21 Fishbed", "Aircraft", 1, "MEDIUM"), "A-50": U("A-50 Mainstay AEW", "Aircraft", 1, "HIGH"),
    "Su-24M": U("Su-24 Fencer", "Aircraft", 1, "MEDIUM"), "Su-25": U("Su-25 Frogfoot", "Aircraft", 1, "MEDIUM"),
    "Su-34": U("Su-34 Fullback", "Aircraft", 1, "MEDIUM"), "Tu-22M3": U("Tu-22M3 Backfire", "Aircraft", 1, "HIGH"),
    "IL-76MD": U("Il-76 Candid transport", "Aircraft", 2, "MEDIUM"), "Mi-24V": U("Mi-24 Hind", "Aircraft", 4, "MEDIUM"),
    "Mi-8MT": U("Mi-8 Hip", "Aircraft", 2, "LOW"), "Ka-50": U("Ka-50 Hokum", "Aircraft", 4, "MEDIUM"),
    // airfield infrastructure
    "Shelter": U("Hardened Aircraft Shelter", "Airfield", 1, "MEDIUM"),
    "Tech hangar A": U("Maintenance Hangar", "Airfield", 1, "LOW"),
    // surface-to-surface missiles / coastal defence
    "Scud_B": U("Scud-B TEL", "Surface-to-surface missile", 4, "HIGH"),
    "hy_launcher": U("HY-2 Silkworm Launcher", "Coastal anti-ship missile", 2, "HIGH"),
    "Silkworm_SR": U("Silkworm Target Acquisition Radar", "Coastal anti-ship missile", 2, "HIGH"),
    // naval
    "KILO": U("Kilo-class Submarine", "Naval", 2, "HIGH"), "IMPROVED_KILO": U("Improved Kilo-class Submarine", "Naval", 2, "HIGH"),
    "MOLNIYA": U("Molniya-class Missile Boat", "Naval", 2, "MEDIUM"), "La_Combattante_II": U("La Combattante II Missile Boat", "Naval", 2, "MEDIUM"),
    "ALBATROS": U("Grisha-class Corvette", "Naval", 2, "MEDIUM"), "REZKY": U("Krivak-class Frigate", "Naval", 2, "HIGH"),
    "NEUSTRASH": U("Neustrashimy-class Frigate", "Naval", 2, "HIGH"), "MOSCOW": U("Slava-class Cruiser", "Naval", 2, "HIGH"),
    // command and control
    "Military staff": U("Command Post Building", "C2", 3, "HIGH"),
    "SKP-11": U("SKP-11 Mobile Command Post", "C2", 3, "HIGH"),
    "Ural-375 PBU": U("Ural-375 Command Vehicle", "C2", 3, "HIGH"),
    "Comms tower M": U("Communications Tower", "C2", 3, "MEDIUM"),
    "TV tower": U("Broadcast Tower", "C2", 3, "LOW"),
    // logistics / lines of communication
    ".Ammunition depot": U("Ammunition Depot", "Ammo / POL", 2, "MEDIUM"),
    "ERO Ammunition Bunker B": U("Ammunition Bunker", "Ammo / POL", 2, "MEDIUM"),
    "ammo_cargo": U("Ammunition Stack", "Ammo / POL", 2, "LOW"),
    "Fuel tank": U("Fuel Storage Tank", "Ammo / POL", 2, "MEDIUM"),
    "ATZ-10": U("ATZ-10 Fuel Truck", "Logistics", 2, "MEDIUM"), "ATMZ-5": U("ATMZ-5 Fuel Truck", "Logistics", 2, "MEDIUM"),
    "Ural-375": U("Ural-375 Truck", "Logistics", 2, "LOW"), "Ural-4320T": U("Ural-4320 Truck", "Logistics", 2, "LOW"),
    "KAMAZ Truck": U("KAMAZ Truck", "Logistics", 2, "LOW"), "GAZ-66": U("GAZ-66 Truck", "Logistics", 2, "LOW"),
    "ZIL-131 KUNG": U("ZIL-131 Truck", "Logistics", 2, "LOW"),
    // ground forces (rear echelon)
    "T-90": U("T-90 MBT", "Armor", 4, "MEDIUM"), "T-80UD": U("T-80 MBT", "Armor", 4, "MEDIUM"), "T-72B": U("T-72 MBT", "Armor", 4, "MEDIUM"),
    "T-55": U("T-55 MBT", "Armor", 4, "LOW"), "BMP-3": U("BMP-3 IFV", "Armor", 4, "LOW"), "BMP-2": U("BMP-2 IFV", "Armor", 4, "LOW"),
    "BMP-1": U("BMP-1 IFV", "Armor", 4, "LOW"), "BTR-80": U("BTR-80 APC", "Armor", 4, "LOW"), "BTR-82A": U("BTR-82A APC", "Armor", 4, "LOW"),
    "BRDM-2": U("BRDM-2 Scout", "Armor", 4, "LOW"), "MTLB": U("MT-LB Carrier", "Armor", 4, "LOW"),
    "SAU Msta": U("2S19 Msta SP Howitzer", "Artillery", 4, "MEDIUM"), "SAU Akatsia": U("2S3 Akatsiya SP Howitzer", "Artillery", 4, "MEDIUM"),
    "SAU Gvozdika": U("2S1 Gvozdika SP Howitzer", "Artillery", 4, "MEDIUM"), "Grad-URAL": U("BM-21 Grad MLRS", "Artillery", 4, "MEDIUM"),
    "Uragan_BM-27": U("BM-27 Uragan MLRS", "Artillery", 4, "HIGH"), "Smerch": U("BM-30 Smerch MLRS", "Artillery", 4, "HIGH"),
    // site clutter — not targets
    "outpost_road_l": U("Road Outpost", "Ground forces", 4, "LOW"), "Workshop A": U("Maintenance Workshop", "Logistics", 4, "LOW"),
    "house2arm": U("Armed Watchtower", "Ground forces", 4, "IGNORE", false), "ERO_Gate2": U("Perimeter Gate", "Infrastructure", 4, "IGNORE", false)
  };

  // ---------- mission-kill doctrine: which unit names a SAM group (ported from SAM_FAMILY_DOCTRINE) ----------
  const SAM_DOCTRINE = [
    { match: ["hawk"], mode: "single_point_radar", critical: ["Hawk tr"] },
    { match: ["sa-11", "buk"], mode: "distributed_shooters", shooters: ["SA-11 Buk LN 9A310M1"] },
    { match: ["kub"], mode: "single_point_radar", critical: ["Kub 1S91 str"] },
    { match: ["s-300"], mode: "single_point_radar", critical: ["S-300PS 40B6M tr", "S-300PS 5H63C 30H6_tr"] },
    { match: ["s-200", "rpc_5n62v", "p14_sr", "rls_19j6"], mode: "single_point_radar", critical: ["RPC_5N62V"] },
    { match: ["snr_75", "s_75", "75m_volhov"], mode: "single_point_radar", critical: ["SNR_75V"] },
    { match: ["s-125"], mode: "single_point_radar", critical: ["snr s-125 tr"] },
    { match: ["patriot"], mode: "single_point_radar", critical: ["Patriot str"] },
    { match: ["nasams"], mode: "single_point_radar", critical: ["NASAMS_Radar_MPQ64F1", "NASAMS_Command_Post"] },
    { match: ["tor 9a331", "tor_m2", "chap_torm2"], mode: "distributed_shooters", shooters: [] },
    { match: ["pantsirs1"], mode: "distributed_shooters", shooters: [] },
    { match: ["tunguska"], mode: "distributed_shooters", shooters: [] },
    { match: ["rapier"], mode: "distributed_shooters", shooters: ["rapier_fsa_launcher"] }
  ];
  function criticalTypes(composition) {
    const keys = Object.keys(composition), lower = keys.map(k => k.toLowerCase());
    for (const d of SAM_DOCTRINE) {
      if (!d.match.some(m => lower.some(k => k.includes(m)))) continue;
      if (d.mode === "single_point_radar") return new Set(d.critical.filter(t => composition[t]).length ? d.critical.filter(t => composition[t]) : d.critical);
      const shooters = d.shooters.filter(t => composition[t]);
      return new Set(shooters.length ? shooters : keys);
    }
    return new Set();
  }

  // ---------- geometry ----------
  const toRad = d => d * Math.PI / 180;
  function haversineNM(a, b, c, d) {
    const R = 3440.065, dLat = toRad(c - a), dLon = toRad(d - b);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pointInPolygon(lat, lon, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // bma: { shape: "circle", lat, lon, radiusNM } | { shape: "polygon", polygon: [[lat, lon], …] } | null (whole theater)
  function inBMA(lat, lon, bma) {
    if (!bma) return true;
    if (bma.shape === "circle") return haversineNM(lat, lon, bma.lat, bma.lon) <= bma.radiusNM;
    return pointInPolygon(lat, lon, bma.polygon);
  }

  // Coalition Parser lat/lon: "34° 25.744' N" (DMS/DDM), or plain decimal degrees
  const DMS_RE = /(\d+)\s*°\s*([\d.]+)\s*'?\s*([NSEW])/i;
  function parseCoord(s) {
    const t = String(s ?? "").trim(), m = t.match(DMS_RE);
    if (m) { const v = +m[1] + +m[2] / 60; return /[SW]/i.test(m[3]) ? -v : v; }
    const n = parseFloat(t); return isFinite(n) ? n : NaN;
  }
  // CSV with columns Group, Unit, Type, Latitude, Longitude[, Altitude (ft)] (header row required)
  function parseCSV(text, sourceName = "CSV import") {
    const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
    if (!lines.length) return { rows: [], error: "The file is empty." };
    const split = l => { const out = []; let cur = "", q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; }
      out.push(cur); return out.map(x => x.trim()); };
    const head = split(lines[0]).map(h => h.toLowerCase());
    const col = n => head.findIndex(h => h.startsWith(n));
    const iG = col("group"), iU = col("unit"), iT = col("type"), iLa = col("lat"), iLo = col("lon");
    if ([iG, iT, iLa, iLo].some(i => i < 0)) return { rows: [], error: "Expected a header row with Group, Unit, Type, Latitude and Longitude columns (Coalition Parser export)." };
    const rows = [], bad = [];
    lines.slice(1).forEach((l, n) => { const c = split(l), lat = parseCoord(c[iLa]), lon = parseCoord(c[iLo]);
      if (!c[iT] || !isFinite(lat) || !isFinite(lon)) { bad.push(n + 2); return; }
      rows.push({ group: c[iG] || `Unit ${n + 1}`, unit: iU >= 0 ? c[iU] : "", type: c[iT], lat, lon, source: sourceName }); });
    return { rows, bad };
  }

  // ---------- the pipeline (build_groups -> score_and_rank -> apply_caps -> assign_target_numbers) ----------
  function classify(type, table) { return table[type] || null; }

  function run(units, { cycle, bma, table, start = 10001 }) {
    const tierRank = { HIGH: 3, MEDIUM: 2, LOW: 1, IGNORE: 0 };
    const byGroup = {};
    units.forEach(u => (byGroup[u.group] = byGroup[u.group] || []).push(u));
    const unclassified = {}, groups = [], dropped = [];
    Object.entries(byGroup).forEach(([group, members]) => {
      const comp = {};
      members.forEach(m => { comp[m.type] = (comp[m.type] || 0) + 1; });
      const classified = members.map(m => [m, classify(m.type, table)]);
      classified.forEach(([m, e]) => { if (!e) unclassified[m.type] = (unclassified[m.type] || 0) + 1; });
      const known = classified.filter(([, e]) => e);
      if (!known.length) return;
      // representative: the doctrinally-critical unit, then highest tier, then lowest task number
      const crit = criticalTypes(comp);
      const [best, entry] = known.reduce((a, b) => {
        const k = ([m, e]) => [crit.has(m.type) ? 1 : 0, tierRank[e.tier] || 0, -(+e.task || 99)];
        const ka = k(a), kb = k(b);
        for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] > ka[i] ? b : a;
        return a;
      });
      const g = { group, unitName: entry.name || best.type, repType: best.type, category: entry.category, task: String(entry.task),
        tier: entry.tier, lat: members.reduce((s, m) => s + m.lat, 0) / members.length, lon: members.reduce((s, m) => s + m.lon, 0) / members.length,
        unitCount: members.length, composition: comp, source: members[0].source, refId: members[0].refId };
      if (!entry.nominate || entry.tier === "IGNORE") { dropped.push(g); return; }
      groups.push(g);
    });

    const inArea = [], outOfBMA = [];
    groups.forEach(g => (inBMA(g.lat, g.lon, bma) ? inArea : outOfBMA).push(g));
    inArea.forEach(g => {
      const kt = cycle.keyTasks[g.task] || { name: "Unknown", weight: 0 };
      g.taskName = kt.name;
      g.score = (+kt.weight || 0) + (+cycle.tierWeight[g.tier] || 0);
      g.grade = cycle.defaultGrade[g.tier] || "D";
    });
    const ranked = inArea.filter(g => !EXCLUDED_TASKS.includes(g.task)).sort((a, b) => b.score - a.score);
    const continuous = inArea.filter(g => EXCLUDED_TASKS.includes(g.task));

    const jiptl = [], watchlist = [], count = {};
    ranked.forEach(g => {
      const cap = cycle.keyTasks[g.task]?.cap;
      if (cap == null || cap === "" || (count[g.task] || 0) < +cap) { jiptl.push(g); count[g.task] = (count[g.task] || 0) + 1; }
      else watchlist.push(g);
    });
    // number the whole universe: JIPTL first so top priorities get the lowest numbers
    [...jiptl, ...watchlist, ...outOfBMA].forEach((g, i) => { g.targetNumber = `T${start + i}`; });
    return { jiptl, watchlist, outOfBMA, continuous, dropped, unclassified };
  }

  window.AOC.TARGETING = { DEFAULT_CYCLE, BUILTIN_UNITS, EXCLUDED_TASKS, run, parseCSV, parseCoord, inBMA, haversineNM };
})();
