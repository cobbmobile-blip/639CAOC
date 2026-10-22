// TACAN / ICLS scrub of a host mission file. Reports only -- the host fixes their own .miz; the CAOC never edits it.
// Checks: 1 duplicates in the .miz · 2 clashes with the map's own TACANs · 3 callsign problems ·
// 4 mismatches with what the CAOC published (tanker tracks, SPINS carriers, Comm Plan) · 5 beacons likely to fail in flight.
(function () {
  const { Store } = window.AOC;
  const TANKER = /KC-?135|KC135|KC-?130|KC130|S-3B Tanker|IL-78|KC-?10\b|KC_10/i;
  const CARRIER = /^(CVN_7\d|CVN-7\d|Stennis|CV_1143_5|KUZNECOW|LHA_Tarawa|Forrestal|CV_59|hms_invincible)/i;
  const CHECK = { 1: "Duplicate in the mission", 2: "Clash with a map TACAN", 3: "Callsign", 4: "Differs from CAOC products", 5: "Likely to fail in flight" };
  const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // flight key: "TEXACO 1" and DCS's "Texaco11" (Texaco 1-1) both become TEXACO1
  const flightKey = s => { const m = norm(s).match(/^([A-Z]+)(\d)/); return m ? m[1] + m[2] : norm(s); };
  const tacanStr = (ch, mode) => ch == null ? "—" : `${ch}${mode || "?"}`;
  const who = b => `${b.group}${b.unit && b.unit !== b.group ? ` / ${b.unit}` : ""}`;

  function scrub(cid, mf) {
    if (!mf?.beacons) return null;   // versions sent before the scrub existed
    const c = Store.campaign(cid), out = [];
    const add = (check, sev, key, text) => out.push({ check, sev, key: `${check}|${key}`, text });
    const groups = mf.beacons.filter(b => b.kind === "group");
    const tacans = mf.beacons.filter(b => b.kind === "ActivateBeacon"), icls = mf.beacons.filter(b => b.kind === "ActivateICLS");
    const live = tacans.filter(b => b.enabled && b.channel != null && b.mode);

    // 1 -- the same channel and mode on more than one unit; the same ICLS channel on two ships
    const byCh = {};
    live.forEach(b => (byCh[`${b.channel}${b.mode}`] = byCh[`${b.channel}${b.mode}`] || []).push(b));
    Object.entries(byCh).forEach(([k, bs]) => { const u = [...new Set(bs.map(who))];
      if (u.length > 1) add(1, "error", `tacan${k}`, `TACAN ${k} is set on ${u.length} units: ${u.join("; ")}.`); });
    const byIcls = {};
    icls.filter(b => b.enabled && b.channel != null).forEach(b => (byIcls[b.channel] = byIcls[b.channel] || []).push(b));
    Object.entries(byIcls).forEach(([k, bs]) => { const u = [...new Set(bs.map(who))];
      if (u.length > 1) add(1, "error", `icls${k}`, `ICLS ${k} is set on ${u.length} ships: ${u.join("; ")}.`); });

    // 2 -- the map's own TACAN stations (DCS beacon data via the JCEOI); DCS seldom records their mode, so treat them as both
    const X = window.AOC.JCEOI, tk = X?.theaterKey(mf.theatre) || X?.theaterKey(c.theater);
    const mapT = tk ? (X.theaters.find(t => t.key === tk)?.tacan || []) : [];
    if (!mapT.length) add(2, "info", `nomap${tk}`, `No map TACAN data for ${mf.theatre || c.theater}${tk && !X.theaters.find(t => t.key === tk)?.dcs ? " (no DCS data yet)" : ""}, so map clashes were not checked.`);
    live.forEach(b => mapT.filter(m => +m.ch === b.channel).forEach(m => add(2, "warn", `map${b.channel}${b.mode}${m.callsign}${m.site}`,
      `${who(b)} TACAN ${b.channel}${b.mode} (${b.callsign || "no ident"}) shares channel ${m.ch} with the map's ${m.site} ${m.type} (${m.callsign}). DCS does not record that station's mode, so it may be ${m.ch}X or ${m.ch}Y — pick a channel the map does not use.`)));

    // 3 -- one ident on different channels, one channel with different idents, no ident
    const byCs = {};
    live.filter(b => b.callsign).forEach(b => (byCs[norm(b.callsign)] = byCs[norm(b.callsign)] || new Set()).add(`${b.channel}${b.mode}`));
    Object.entries(byCs).forEach(([cs, chs]) => { if (chs.size > 1) add(3, "warn", `cs${cs}`, `TACAN ident ${cs} is used on ${[...chs].join(", ")}.`); });
    Object.entries(byCh).forEach(([k, bs]) => { const ids = [...new Set(bs.map(b => norm(b.callsign)).filter(Boolean))];
      if (ids.length > 1) add(3, "warn", `ids${k}`, `TACAN ${k} carries different idents: ${ids.join(", ")}.`); });
    tacans.filter(b => !b.callsign).forEach(b => add(3, "warn", `noid${b.group}${b.unit}`, `${who(b)} TACAN ${tacanStr(b.channel, b.mode)} has no ident, so aircraft cannot confirm the station.`));

    // 4 -- against the theater map's tanker tracks, the SPINS carrier table and the Comm Plan
    const map = Store.content(cid, "map") || {}, spins = Store.content(cid, "spins") || {}, acp = Store.content(cid, "acp");
    const planFreqs = window.AOC.COMM.channels(acp?.matrix).map(ch => parseFloat(ch.freq)).filter(isFinite);
    const tankerGroups = groups.filter(g => g.side === "blue" && g.cat === "plane" && g.units.some(u => TANKER.test(u.type)));
    const tracks = (map.shapes || []).filter(s => s.type === "TANKER TRACK" && s.callsign);
    const tacanOf = g => tacans.filter(b => b.group === g.group);
    const cmp = (label, planned, b, add4) => {
      if (!planned.ch) return;
      if (!b) { add4("warn", "notacan", `has no TACAN; ${label} plans ${planned.ch}${planned.mode || ""}${planned.cs ? ` ${planned.cs}` : ""}.`); return; }
      if (+planned.ch !== b.channel || (planned.mode && norm(planned.mode) !== b.mode))
        add4("warn", "ch", `TACAN is ${tacanStr(b.channel, b.mode)}; ${label} plans ${planned.ch}${planned.mode || ""}.`);
      if (planned.cs && norm(planned.cs) !== norm(b.callsign)) add4("warn", "id", `TACAN ident is ${b.callsign || "blank"}; ${label} plans ${norm(planned.cs)}.`);
    };
    tracks.forEach(t => {
      const g = tankerGroups.find(g => g.units.some(u => flightKey(u.callsign) === flightKey(t.callsign)));
      if (!g) { add(4, "info", `track${t.name}`, `${t.name}: planned tanker ${t.callsign} is not in the mission file.`); return; }
      const a4 = (sev, k, txt) => add(4, sev, `track${t.name}${k}`, `${g.group} (${t.callsign}): ${txt}`);
      cmp(`the theater map (${t.name})`, { ch: t.tacanCh, mode: t.tacanMode, cs: t.tacanCs }, tacanOf(g)[0], a4);
      if (t.freq && g.freq != null && Math.abs(parseFloat(t.freq) - g.freq) > 0.0005) a4("warn", "freq", `radio is ${g.freq.toFixed(3)}; the theater map (${t.name}) plans ${t.freq}.`);
    });
    tankerGroups.forEach(g => {
      if (!tracks.some(t => g.units.some(u => flightKey(u.callsign) === flightKey(t.callsign))))
        add(4, "info", `untracked${g.group}`, `Tanker ${g.group} (${g.units[0]?.callsign || g.units[0]?.type}) has no tanker track on the theater map, so its TACAN and frequency are not checked against a plan.`);
      if (g.freq != null && planFreqs.length && !planFreqs.some(f => Math.abs(f - g.freq) < 0.0005))
        add(4, "warn", `acp${g.group}`, `Tanker ${g.group} is on ${g.freq.toFixed(3)}, which is not a channel in the Comm Plan.`);
    });
    const ships = groups.filter(g => g.cat === "ship").flatMap(g => g.units.filter(u => CARRIER.test(u.type) || icls.some(b => b.unitId === u.unitId)).map(u => ({ g, u })));
    const naval = (spins.naval || []).filter(r => r.ship || r.hull);
    naval.forEach(r => {
      const hit = ships.find(({ u }) => (r.hull && norm(u.type) === norm(r.hull)) || (r.ship && (norm(r.ship).includes(norm(u.name)) || norm(u.name).includes(norm(r.ship)))));
      if (!hit) { add(4, "info", `ship${r.ship}${r.hull}`, `SPINS carrier ${r.ship || r.hull} is not in the mission file.`); return; }
      const lbl = norm(hit.u.name) === norm(r.ship) ? hit.u.name : `${hit.u.name} (${r.ship || r.hull})`;
      const a4 = (sev, k, txt) => add(4, sev, `ship${r.ship}${k}`, `${lbl}: ${txt}`);
      cmp("SPINS", { ch: r.tacanCh, mode: r.tacanMode, cs: r.tacanCs }, tacans.find(b => b.unitId === hit.u.unitId) || tacanOf(hit.g)[0], a4);
      const ib = icls.find(b => b.unitId === hit.u.unitId) || icls.find(b => b.group === hit.g.group);
      if (r.icls && !ib) a4("warn", "noicls", `has no ICLS; SPINS plans ICLS ${r.icls}.`);
      else if (r.icls && ib && +r.icls !== ib.channel) a4("warn", "icls", `ICLS is ${ib.channel}; SPINS plans ${r.icls}.`);
    });
    ships.filter(({ u }) => !naval.some(r => (r.hull && norm(u.type) === norm(r.hull)) || (r.ship && (norm(r.ship).includes(norm(u.name)) || norm(u.name).includes(norm(r.ship))))))
      .forEach(({ g, u }) => add(4, "info", `unplanned${u.name}`, `Carrier ${u.name} (${u.type}) has no row in the SPINS carrier table.`));

    // 5 -- things that look fine in the editor and break in the air
    tacans.forEach(b => {
      const k = `${b.group}${b.unit}${b.waypoint}`;
      if (b.channel == null || !b.mode) add(5, "error", `incomplete${k}`, `${who(b)}: TACAN task has ${b.channel == null ? "no channel" : "no X/Y mode"}.`);
      else if (b.channel < 1 || b.channel > 126) add(5, "error", `range${k}`, `${who(b)}: TACAN channel ${b.channel} is outside 1–126.`);
      if (b.unitId != null && !b.unit) add(5, "error", `unit${k}`, `${b.group}: TACAN task points at unit id ${b.unitId}, which is not in the group.`);
      if (!b.enabled) add(5, "warn", `off${k}`, `${who(b)}: TACAN task ${tacanStr(b.channel, b.mode)} is disabled, so it never transmits.`);
      if (b.waypoint > 1) add(5, "info", `wp${k}`, `${who(b)}: TACAN ${tacanStr(b.channel, b.mode)} starts only when the group reaches waypoint ${b.waypoint}.`);
      if (b.lateActivation) add(5, "info", `late${k}`, `${who(b)}: group is late-activated, so TACAN ${tacanStr(b.channel, b.mode)} is off until it is activated.`);
    });
    icls.forEach(b => {
      const k = `${b.group}${b.unit}${b.waypoint}`;
      if (b.channel == null || b.channel < 1 || b.channel > 20) add(5, "error", `iclsrange${k}`, `${who(b)}: ICLS channel ${b.channel ?? "missing"} is outside 1–20.`);
      if (!b.enabled) add(5, "warn", `iclsoff${k}`, `${who(b)}: ICLS task is disabled.`);
    });

    const order = { error: 0, warn: 1, info: 2 };
    out.sort((a, b) => order[a.sev] - order[b.sev] || a.check - b.check);
    return { findings: out, tacans, icls, counts: { error: out.filter(f => f.sev === "error").length, warn: out.filter(f => f.sev === "warn").length, info: out.filter(f => f.sev === "info").length } };
  }

  // the current version's scrub, with findings that were not there in the previous version marked new
  function scrubWithChanges(cid, mf, prev) {
    const r = scrub(cid, mf); if (!r) return null;
    const before = prev ? scrub(cid, prev) : null;
    if (before) { const keys = new Set(before.findings.map(f => f.key)); r.findings.forEach(f => { f.isNew = !keys.has(f.key); });
      r.resolved = before.findings.filter(f => !r.findings.some(x => x.key === f.key) && f.sev !== "info"); }
    return r;
  }

  window.AOC.TACAN = { CHECK, scrub, scrubWithChanges, tacanStr };
})();
