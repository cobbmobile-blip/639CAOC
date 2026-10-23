// Host mission files: read a .miz in the browser, keep its BLUE flights and its REDFOR units, and convert
// REDFOR positions from DCS map x/y to lat/lon. Port of OLD/tools/jiptl_pipeline/theater_projection.py:
// only theaters with a calibrated projection are converted -- no guessed coordinates. A theater is calibrated
// once, from a Coalition Parser CSV of the same mission (units paired by name, Transverse Mercator fit).
(function () {
  const { Store, ATO } = window.AOC;

  // WGS84
  const A = 6378137.0, F = 1 / 298.257223563, E2 = F * (2 - F), EP2 = E2 / (1 - E2), RAD = Math.PI / 180;

  // Calibrated against real mission data (see theater_projection.py). DCS convention: x ~ northing, y ~ easting.
  const BUILTIN = {
    PersianGulf: { central_meridian_deg: 56.9999597, scale_factor: 0.999600019, false_easting: 104910.012, false_northing: -2986832.08,
      calibration: "657-point fit vs OP_VENOM_MOCHA_v1.2.miz Coalition Parser export, max residual 1.2m, RMS 0.7m" }
  };
  const projection = theatre => BUILTIN[theatre] || Store.db.projections?.[theatre] || null;

  // Snyder inverse Transverse Mercator -> [lat, lon] degrees
  function tmInverse(easting, northing, lon0, k0) {
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const mu = northing / k0 / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1), C1 = EP2 * c * c, T1 = t * t;
    const N1 = A / Math.sqrt(1 - E2 * s * s), R1 = A * (1 - E2) / (1 - E2 * s * s) ** 1.5, D = easting / (N1 * k0);
    const phi = p1 - (N1 * t / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6 / 720);
    const lon = lon0 * RAD + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5 / 120) / c;
    return [phi / RAD, lon / RAD];
  }
  // Snyder forward Transverse Mercator at unit scale -> [easting, northing] / k0 (used only for calibration)
  function tmForward1(lat, lon, lon0) {
    const p = lat * RAD, s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
    const N = A / Math.sqrt(1 - E2 * s * s), T = t * t, C = EP2 * c * c, a = (lon - lon0) * RAD * c;
    const M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * p - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * p)
      + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * p) - (35 * E2 ** 3 / 3072) * Math.sin(6 * p));
    return [N * (a + (1 - T + C) * a ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * a ** 5 / 120),
      M + N * t * (a * a / 2 + (5 - T + 9 * C + 4 * C * C) * a ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * a ** 6 / 720)];
  }
  function xyToLatLon(p, x, y) { return tmInverse(y - p.false_easting, x - p.false_northing, p.central_meridian_deg, p.scale_factor); }
  const metres = (a, b) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos(a[0] * RAD));

  // Fit a theater projection from pairs { x, y, lat, lon }. For a given central meridian the model is linear:
  // x = FN + k0·n(lat,lon), y = FE + k0·e(lat,lon), so k0/FE/FN come from least squares; the meridian by a 1-D search.
  function fit(pairs) {
    const solve = lon0 => {
      const f = pairs.map(q => tmForward1(q.lat, q.lon, lon0)), n = pairs.length;
      // unknowns [k0, FE, FN]: normal equations over both x and y rows
      let See = 0, Se = 0, Sn = 0, Snn = 0, Sey = 0, Snx = 0, Sy = 0, Sx = 0;
      f.forEach(([e, no], i) => { See += e * e; Snn += no * no; Se += e; Sn += no; Sey += e * pairs[i].y; Snx += no * pairs[i].x; Sy += pairs[i].y; Sx += pairs[i].x; });
      // k0 = [Σe·y + Σn·x − (Σe·Σy + Σn·Σx)/n] / [Σe² + Σn² − ((Σe)² + (Σn)²)/n]
      const k0 = (Sey + Snx - (Se * Sy + Sn * Sx) / n) / (See + Snn - (Se * Se + Sn * Sn) / n);
      const p = { central_meridian_deg: lon0, scale_factor: k0, false_easting: (Sy - k0 * Se) / n, false_northing: (Sx - k0 * Sn) / n };
      const res = pairs.map(q => metres(xyToLatLon(p, q.x, q.y), [q.lat, q.lon]));
      return { p, rms: Math.sqrt(res.reduce((s, r) => s + r * r, 0) / n), max: Math.max(...res) };
    };
    const mid = pairs.reduce((s, q) => s + q.lon, 0) / pairs.length;
    let lo = Math.floor(mid) - 15, hi = Math.floor(mid) + 15;
    for (let i = 0; i < 120; i++) { const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618; if (solve(a).rms < solve(b).rms) hi = b; else lo = a; }
    return solve((lo + hi) / 2);
  }

  const arr = x => !x ? [] : Array.isArray(x) ? x.filter(Boolean) : Object.values(x);
  // every unit of one coalition with its native x/y (vehicles, ships, aircraft, statics)
  function coalitionUnits(mission, coalition) {
    const out = [];
    arr(mission?.coalition?.[coalition]?.country).forEach(ct => ["vehicle", "ship", "plane", "helicopter", "static"].forEach(cat =>
      arr(ct?.[cat]?.group).forEach(g => arr(g.units).forEach(u => {
        if (u.x == null || u.y == null) return;
        out.push({ group: g.name || "", unit: u.name || "", type: u.type || "", x: +u.x, y: +u.y, cat, country: ct.name || "" });
      }))));
    return out;
  }

  // Every beacon the mission sets up: route tasks "Activate beacon" (TACAN), "Activate ICLS" and "Activate Link 4 / ACLS",
  // on any coalition's aircraft, ships or vehicles. Found wherever they sit in a waypoint's task tree.
  const BEACON_ACTIONS = new Set(["ActivateBeacon", "ActivateICLS", "ActivateLink4", "ActivateACLS"]);
  // DCS beacon systems that carry their own X/Y mode
  const SYSTEM_MODE = { 4: "X", 5: "Y", 13: "X", 14: "Y" };
  function beaconsOf(mission) {
    const out = [];
    ["blue", "red", "neutrals"].forEach(side => arr(mission?.coalition?.[side]?.country).forEach(ct =>
      ["plane", "helicopter", "ship", "vehicle"].forEach(cat => arr(ct?.[cat]?.group).forEach(g => {
        const units = arr(g.units), cs = u => u && typeof u.callsign === "object" ? u.callsign.name || "" : String(u?.callsign ?? "");
        const base = { side, cat, group: g.name || "", groupId: g.groupId, lateActivation: !!g.lateActivation, freq: g.frequency != null ? +g.frequency : null,
          units: units.map(u => ({ name: u.name || "", type: u.type || "", unitId: u.unitId, callsign: cs(u) })) };
        out.push({ ...base, kind: "group" });   // every group, so tankers and carriers without a beacon are still seen
        arr(g.route?.points).forEach((pt, wi) => {
          (function walk(node, enabled) {
            if (!node || typeof node !== "object") return;
            const on = enabled && node.enabled !== false;
            if (BEACON_ACTIONS.has(node.id) && node.params) {
              const p = node.params, unit = units.find(u => u.unitId === p.unitId);
              out.push({ ...base, kind: node.id, waypoint: wi + 1, enabled: on, unitId: p.unitId ?? null, unit: unit?.name || null, unitType: unit?.type || units[0]?.type || "",
                channel: p.channel != null ? +p.channel : null, mode: p.modeChannel || SYSTEM_MODE[p.system] || null, callsign: p.callsign || "",
                aa: p.AA === true, system: p.system ?? null, hz: p.frequency != null ? +p.frequency : null });
              return;
            }
            Object.values(node).forEach(v => walk(v, on));
          })(pt.task, true);
        });
      }))));
    return out;
  }

  // Datalink setup the host puts in the .miz: F/A-18C and F-16C Link 16 (STN_L16, voice callsign, channels, team, donors),
  // A-10C II SADL (SADL_TN, Air/Gateway keys, team, donors), AH-64D IDM (TN_IDM_LB, IDM presets with their members),
  // every other aircraft with an STN_L16 (AI AWACS — an AWACS-task group or an AWACS type — are the Link 16 donors),
  // and the C2 surface units, which have no STN in the Mission Editor: warships and EWR/GCI radars.
  const TDL_TYPES = { "FA-18C_hornet": "Link16", "F-16C_50": "Link16", "A-10C_2": "SADL", "AH-64D_BLK_II": "IDM" };
  const AWACS_TYPES = ["E-3A", "E-2C", "A-50", "KJ-2000"];
  const CIVIL_SHIP = /seawise|cargo|dry-?cargo|tanker|ferry|zwezdny|handywind|container|speedboat|trawler|yacht|santafe|ship_tilde|bulker|lst_|higgins|veritas|barge/i;
  const EWR = /EWR|FPS-117|p-19|55G6|1L13|Dog Ear/i;
  function tdlOf(mission) {
    const out = [];
    ["blue", "red", "neutrals"].forEach(side => arr(mission?.coalition?.[side]?.country).forEach(ct => ["plane", "helicopter", "ship", "vehicle"].forEach(cat =>
      arr(ct?.[cat]?.group).forEach(g => arr(g.units).forEach(u => {
        if (cat === "ship" || cat === "vehicle") {
          const role = cat === "ship" ? (CIVIL_SHIP.test(u.type) ? null : "Ship") : EWR.test(u.type) ? "EWR / GCI" : null;
          if (role) out.push({ side, group: g.name || "", unit: u.name || "", unitId: u.unitId, type: u.type, link: "C2", role, callsign: g.name || u.name || "", ai: true });
          return;
        }
        const ap = u.AddPropAircraft || {}, awacs = !TDL_TYPES[u.type] && (g.task === "AWACS" || AWACS_TYPES.includes(u.type));
        const link = TDL_TYPES[u.type] || (awacs || ap.STN_L16 != null ? "Link16" : null); if (!link) return;
        const dl = u.datalinks?.[link] || {};
        const members = n => arr(n?.teamMembers).map(m => m.missionUnitId).filter(x => x != null);
        const rec = { side, group: g.name || "", unit: u.name || "", unitId: u.unitId, type: u.type, link, skill: u.skill || "",
          callsign: typeof u.callsign === "object" ? u.callsign?.name || "" : String(u.callsign ?? ""),
          voice: ap.VoiceCallsignLabel || ap.VoiceCallsignNumber ? `${ap.VoiceCallsignLabel || ""}${ap.VoiceCallsignNumber || ""}` : "", awacs, ai: !/^(Client|Player)$/.test(u.skill || "") };
        if (link === "Link16") Object.assign(rec, { stn: ap.STN_L16 ?? null, settings: dl.settings || {}, team: members(dl.network), donors: arr(dl.network?.donors).map(m => m.missionUnitId) });
        if (link === "SADL") Object.assign(rec, { tn: ap.SADL_TN ?? null, settings: dl.settings || {}, team: members(dl.network), donors: arr(dl.network?.donors).map(m => m.missionUnitId) });
        if (link === "IDM") {
          const np = dl.network?.presets || {}, sp = dl.settings?.presets || {};
          rec.id = ap.TN_IDM_LB ?? null; rec.ownship = ap.OwnshipCallSign || "";
          rec.presets = Object.keys({ ...sp, ...np }).map(k => ({ preset: +k, name: sp[k]?.presetName || "", callSign: sp[k]?.callSign || "", freq: sp[k]?.primaryFreq ?? null,
            longbow: !!sp[k]?.LB_Net, members: arr(np[k]?.members).map(m => m.missionUnitId).filter(x => x != null) })).sort((a, b) => a.preset - b.preset);
        }
        out.push(rec);
      })))));
    return out;
  }

  async function read(file) {
    if (!window.JSZip) throw new Error("the zip reader didn't load");
    const zip = await JSZip.loadAsync(file), entry = zip.file("mission");
    if (!entry) throw new Error("no 'mission' file inside — is this a DCS .miz?");
    const mission = ATO.parseLuaTable(await entry.async("string"));
    // older missions keep names in the l10n dictionary (DictKey_…): put the text back in place
    const dictEntry = zip.file("l10n/DEFAULT/dictionary");
    if (dictEntry) {
      const dict = ATO.parseLuaTable(await dictEntry.async("string")) || {};
      const fix = o => { if (o && typeof o === "object") for (const k in o) { const v = o[k]; if (typeof v === "string" && v.startsWith("DictKey_") && dict[v] != null) o[k] = dict[v]; else fix(v); } };
      fix(mission);
    }
    return { theatre: mission.theatre || "", start: mission.start_time ?? null, date: mission.date ? `${mission.date.Year}-${String(mission.date.Month).padStart(2, "0")}-${String(mission.date.Day).padStart(2, "0")}` : "",
      flights: ATO.mizFlights(mission, "blue"), red: coalitionUnits(mission, "red"), beacons: beaconsOf(mission), tdl: tdlOf(mission) };
  }

  // mission start time (DCS start_time is theater local time, seconds after midnight) as a UTC Date
  const UTC_OFFSET = { Caucasus: 4, Nevada: -7, PersianGulf: 4, Syria: 3, MarianaIslands: 10, MarianaIslandsWWII: 10, Normandy: 1, TheChannel: 1,
    Falklands: -3, SinaiMap: 2, Kola: 3, Afghanistan: 4.5, Iraq: 3, GermanyCW: 1 };
  function startUtc(mf) {
    if (!mf?.date || mf.start == null) return null;
    const t = Date.parse(`${mf.date}T00:00:00Z`) + (mf.start - (UTC_OFFSET[mf.theatre] ?? 0) * 3600) * 1000;
    return isFinite(t) ? new Date(t) : null;
  }

  // REDFOR rows in the target-nomination shape, or null when the theater has no calibrated projection
  function redRows(mf) {
    const p = projection(mf.theatre); if (!p) return null;
    return mf.red.map(u => { const [lat, lon] = xyToLatLon(p, u.x, u.y); return { group: u.group, unit: u.unit, type: u.type, lat, lon, source: `${mf.name} v${mf.v}` }; });
  }

  // host mission file versions: campaign.missionFiles [{ v, name, size, when, by, user, notes, theatre, date, flights, red, beacons }]
  const files = cid => Store.campaign(cid).missionFiles || [];
  const current = cid => files(cid).at(-1) || null;
  function submit(cid, mf) {
    const c = Store.campaign(cid); c.missionFiles = c.missionFiles || [];
    const rec = { ...mf, v: c.missionFiles.length + 1, when: new Date().toISOString() };
    c.missionFiles.push(rec); Store.save();
    Store.log(cid, `Host mission file v${rec.v} received: ${rec.name} (${rec.flights.length} BLUE flights, ${rec.red.length} RED units)`, rec.user);
    return rec;
  }
  // what changed against the previous version, by group name
  function diff(a, b) {
    if (!a) return null;
    const names = (m, k) => new Set((k === "flights" ? m.flights : m.red).map(x => x.group));
    const fa = names(a, "flights"), fb = names(b, "flights"), ra = names(a, "red"), rb = names(b, "red");
    const moved = b.red.filter(u => { const o = a.red.find(x => x.unit === u.unit && x.group === u.group); return o && Math.hypot(o.x - u.x, o.y - u.y) > 50; }).length;
    return { flightsAdded: [...fb].filter(g => !fa.has(g)), flightsRemoved: [...fa].filter(g => !fb.has(g)),
      redAdded: [...rb].filter(g => !ra.has(g)), redRemoved: [...ra].filter(g => !rb.has(g)), redMoved: moved };
  }
  function saveProjection(theatre, p, note) {
    const d = Store.db; d.projections = d.projections || {};
    d.projections[theatre] = { ...p, calibration: note, when: new Date().toISOString() }; Store.save();
  }

  window.AOC.MIZ = { tdlOf, startUtc, UTC_OFFSET, BUILTIN, projection, xyToLatLon, fit, metres, read, redRows, files, current, submit, diff, saveProjection };
})();
