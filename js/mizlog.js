// The host's .miz change log: everything the host JFACC must change in their mission file so it matches the CAOC's
// documents. Built automatically from the host's current .miz, the ATO and the CAOC products; never edits the .miz.
//   ADD     ATO lines the .miz doesn't have (requested lines, CAOC support lines)
//   SET     values the CAOC assigned that live in the .miz (tanker and carrier TACAN / ICLS / radio, AI support radios)
//   FIX     discrepancies the checks found (beacons, defaults, datalinks in the .miz, tanker speed, targets, start time)
//   REMOVE  cancelled lines still in the .miz; targets destroyed per BDA (when the campaign carries damage)
// Not a .miz change, so never listed: human-flight radio presets, Link 16 STNs, SADL TNs, IDM, IFF / SIF (cockpit or DKS).
// Each check that ran clean is listed as passed. An item closes itself when the next .miz upload passes that check.
// The log goes to the host's registered Discord channel with PUBLISH and after a .miz upload (docs/ATO_Discord_Integration.md).
(function () {
  const { Store } = window.AOC;
  const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // "TEXACO 1", "Texaco1-1" and "TEXACO 1-1" are all TEXACO1
  const flightKey = s => { const m = norm(s).match(/^([A-Z]+)(\d)/); return m ? m[1] + m[2] : norm(s); };
  // an ATO callsign with no number (AWACS "DARKSTAR") matches on the word alone
  const sameCallsign = (ato, miz) => /\d/.test(ato) ? flightKey(ato) === flightKey(miz) : word(ato) === word(miz);
  const word = s => (norm(s).match(/^[A-Z]+/) || [""])[0];
  // the .miz callsign as the ATO writes it: "Shell1-1" -> "SHELL 1"
  const atoCallsign = s => { const m = String(s || "").match(/^([A-Za-z]+)\s*(\d)/); return m ? `${m[1].toUpperCase()} ${m[2]}` : String(s || "").toUpperCase(); };
  const isTanker = m => m.role === "AR" || /KC-?1|S-3B Tanker|IL-78|KC-?10/i.test(m.type || m.airframe || "");
  const kt = ms => ms * 1.943844, ft = m => m * 3.28084;
  const KIND = { add: "ADD", set: "SET", fix: "FIX", remove: "REMOVE" };
  const ORDER = { add: 0, set: 1, fix: 2, remove: 3 };

  // ---------- airspeed: the Mission Editor's speed is true airspeed; tankers fly 300 KCAS ---------- (ISA, troposphere)
  // KC-135, KC-135 MPRS, KC-10 and S-3B: 300 KCAS; the KC-130 refuels helicopters at 100 KCAS
  const TANKER_KCAS = 300, HELO_TANKER_KCAS = 100, TANKER_TOL = 5;
  const kcasFor = type => /KC-?130/i.test(type || "") ? HELO_TANKER_KCAS : TANKER_KCAS;
  const atm = h => { const T = 288.15 - 0.0065 * Math.min(h, 11000), p = 101325 * (T / 288.15) ** 5.25588; return { T, p, a: Math.sqrt(1.4 * 287.053 * T) }; };
  function casFromTas(tas, h) {   // m/s, m -> m/s
    const { p, a } = atm(h), M = tas / a, qc = p * ((1 + 0.2 * M * M) ** 3.5 - 1);
    return 340.294 * Math.sqrt(5 * ((qc / 101325 + 1) ** (2 / 7) - 1));
  }
  function tasFromCas(cas, h) {
    const { p, a } = atm(h), qc = 101325 * ((1 + 0.2 * (cas / 340.294) ** 2) ** 3.5 - 1);
    return a * Math.sqrt(5 * ((qc / p + 1) ** (2 / 7) - 1));
  }

  // ---------- target coordinates (JIPTL loc: DDM from the nomination, or MGRS) ----------
  function utmToLatLon(zone, E, N, south) {
    const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = 0.9996, e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const x = E - 500000, y = south ? N - 10000000 : N, M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2, R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = x / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
    return [lat * 180 / Math.PI, (zone - 1) * 6 - 180 + 3 + lon * 180 / Math.PI];
  }
  function parseLoc(s) {
    s = String(s || "").toUpperCase();
    let m = s.match(/([NS])\s*(\d{1,2})[°\s]+(\d+(?:\.\d+)?)'?\s*([EW])\s*(\d{1,3})[°\s]+(\d+(?:\.\d+)?)/);
    if (m) return [(m[1] === "S" ? -1 : 1) * (+m[2] + m[3] / 60), (m[4] === "W" ? -1 : 1) * (+m[5] + m[6] / 60)];
    m = s.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
    if (m) return [+m[1], +m[2]];
    m = s.match(/(\d{1,2})\s*([C-HJ-NP-X])\s*([A-HJ-NP-Z])([A-HJ-NP-V])\s*(\d+)\s+(\d+)/);
    if (!m || m[5].length !== m[6].length) return null;
    const zone = +m[1], band = m[2], k = m[5].length, scale = 10 ** (5 - k);
    const col = ["STUVWXYZ", "ABCDEFGH", "JKLMNPQR"][zone % 3].indexOf(m[3]) + 1, rowI = "ABCDEFGHJKLMNPQRSTUV".indexOf(m[4]);
    if (col < 1 || rowI < 0) return null;
    const E = col * 1e5 + +m[5] * scale, south = band < "N";
    let N = (((rowI - (zone % 2 ? 0 : 5)) % 20 + 20) % 20) * 1e5 + +m[6] * scale;
    // the band's southern edge fixes which 2,000 km cycle the northing is in
    const bandLat = -80 + 8 * "CDEFGHJKLMNPQRSTUVWX".indexOf(band), minN = (south ? 10000000 : 0) + bandLat * 110946 - 1e5;
    while (N < minN) N += 2e6;
    return utmToLatLon(zone, E, N, south);
  }

  // ---------- the checks: each returns items, and says whether it could run ----------
  function build(cid) {
    const c = Store.campaign(cid), MIZ = window.AOC.MIZ, mf = MIZ?.current(cid);
    if (!mf) return { cid, mf: null, items: [], passed: [], notChecked: [], caoc: caocChecks(cid, null) };
    const items = [], passed = [], notChecked = [];
    const run = (label, fn) => { const out = fn(); if (out === null) return; if (typeof out === "string") { notChecked.push({ label, why: out }); return; }
      out.forEach(x => items.push({ ...x, check: label })); if (!out.length) passed.push(label); };
    const ato = Store.content(cid, "ato") || {}, missions = (ato.missions || []).filter(m => m.msn);
    const lines = window.AOC.ATO?.lines(cid) || [], flights = mf.flights || [];
    const scrub = window.AOC.TACAN?.scrub(cid, mf), sf = scrub?.findings || [];
    const fromScrub = (pred, kind) => sf.filter(f => f.sev !== "info" && pred(f)).map(f => ({ key: f.key, kind: f.sev === "error" ? "fix" : kind, text: f.text }));

    // ATO lines against the .miz flights
    const match = matchFlights(cid, mf);
    run("ATO lines in the .miz", () => {
      if (!missions.length && !lines.length) return "the ATO has no lines yet";
      const out = [];
      match.rows.forEach(({ m, f, line, by }) => {
        const what = `${m.msn} ${m.num}× ${m.type} ${m.role}${m.crew === "AI" ? " (AI)" : " (client slots)"}${m.callsign && m.callsign !== "TBD" ? `, ${m.callsign}` : ""}${m.target ? `, ${m.target}` : ""}${m.tot && m.tot !== "TBD" ? `, ${m.tot}` : ""}`;
        if (!f) { const st = line ? (line.status === "open" ? " — awaiting commit" : line.status === "committed" ? ` — committed by ${Store.group(line.committedBy)?.name || line.committedBy}` : "") : " — CAOC line";
          out.push({ key: `ato|${m.msn}`, kind: "add", text: `${what}${st}${line?.mizGroup ? ` (group ${line.mizGroup} is no longer in the .miz)` : ""}.` }); return; }
        if (by === "group" && norm(f.airframe) !== norm(m.type)) out.push({ key: `atotype|${m.msn}`, kind: "fix", text: `Group ${f.group} is ${f.num}× ${f.airframe}; ATO ${m.msn} is ${m.num}× ${m.type}.` });
        else if (+f.num !== +m.num) out.push({ key: `atonum|${m.msn}`, kind: "fix", text: `Group ${f.group} has ${f.num} aircraft; ATO ${m.msn} has ${m.num}.` });
        if (m.crew && f.crew !== m.crew) out.push({ key: `atocrew|${m.msn}`, kind: "fix", text: `Group ${f.group} is ${f.crew === "AI" ? "AI" : "client slots"}; ATO ${m.msn} is a ${m.crew === "AI" ? "AI" : "human"} line.` });
      });
      lines.filter(l => l.status === "cancelled" && l.mizGroup && flights.some(f => f.group === l.mizGroup) && !match.used.has(l.mizGroup))
        .forEach(l => out.push({ key: `atocx|${l.msn}`, kind: "remove", text: `Group ${l.mizGroup}: ATO line ${l.msn} was cancelled.` }));
      return out;
    });

    // CAOC assignments that live in the .miz
    if (!scrub) notChecked.push({ label: "TACAN, ICLS and tanker radios", why: "this .miz was sent before beacons were read; the host sends it again" });
    else {
      // a check with nothing planned to compare against is "not checked", never "OK"
      const X = window.AOC.JCEOI, tk = X?.theaterKey(mf.theatre) || X?.theaterKey(c.theater);
      const tracks = (Store.content(cid, "map")?.shapes || []).some(x => x.type === "TANKER TRACK" && x.callsign) || (X?.plan(tk)?.caoc.tankers || []).length > 0;
      const naval = (Store.content(cid, "spins")?.naval || []).some(r => r.ship || r.hull);
      const plan = window.AOC.COMM.channels(Store.content(cid, "acp")?.matrix).some(ch => ch.freq);
      run("Tanker TACAN and radio against the tanker tracks", () => tracks ? fromScrub(f => f.check === 4 && /^4\|track/.test(f.key), "set") : "no tanker tracks on the theater map");
      run("Carrier TACAN and ICLS against the SPINS", () => naval ? fromScrub(f => f.check === 4 && /^4\|ship/.test(f.key), "set") : "the SPINS have no carriers");
      run("Tanker radios in the Comm Plan", () => plan ? fromScrub(f => f.check === 4 && /^4\|acp/.test(f.key), "fix") : "no Comm Plan yet");
    }
    run("AI support radios against the Comm Plan", () => supportRadios(cid, mf));
    run(`Tanker airspeed (${TANKER_KCAS} ± ${TANKER_TOL} KCAS; KC-130 ${HELO_TANKER_KCAS})`, () => tankerSpeed(mf));
    run("Tanker altitude against the tanker tracks", () => tankerAltitude(cid, mf));

    // the checks the CAOC already runs, as host fixes
    // a channel left at the default is already covered when the CAOC assigned that unit a value to set
    const setFor = unit => items.some(i => i.kind === "set" && i.text.startsWith(unit));
    if (scrub) Object.entries(window.AOC.TACAN.CHECK).filter(([k]) => +k !== 4).forEach(([k, label]) =>
      run(`TACAN / ICLS: ${label[0].toLowerCase()}${label.slice(1)}`, () => fromScrub(f => f.check === +k, "fix")
        .filter(i => !(+k === 6 && i.text.split(":")[0].split(" / ").some(setFor)))));
    run("Datalinks set in the .miz", () => {
      if (!window.AOC.TDL || !mf.tdl) return "this .miz was sent before datalinks were read";
      return window.AOC.TDL.check(cid, { miz: window.AOC.TDL.pull(mf) }).filter(f => f.sev !== "info").map(f => ({ key: `tdl|${f.text}`, kind: "fix", text: f.text }));
    });
    run("JIPTL targets in the .miz", () => targets(cid, mf));
    run("Mission start time against the ATO", () => startTime(cid, mf, missions));

    items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    return { cid, mf, items, passed, notChecked, caoc: caocChecks(cid, mf, match) };
  }

  // ATO rows to .miz flights: the line's own .miz group, then the callsign, then (tankers only) an unclaimed tanker of the
  // same airframe -- the ATO takes tanker callsigns from the .miz, so a different callsign there is not a change
  function matchFlights(cid, mf) {
    const ato = Store.content(cid, "ato") || {}, lines = window.AOC.ATO?.lines(cid) || [], flights = mf?.flights || [];
    const used = new Set(), rows = (ato.missions || []).filter(m => m.msn).map(m => ({ m, line: m.lineId ? lines.find(l => l.id === m.lineId) : lines.find(l => l.msn === m.msn && l.status !== "cancelled") }));
    const take = f => { if (f) used.add(f.group); return f; };
    rows.forEach(r => { const g = r.line?.mizGroup; if (g) { r.f = take(flights.find(f => f.group === g && !used.has(f.group))); if (r.f) r.by = "group"; } });
    rows.filter(r => !r.f).forEach(r => { r.f = take(flights.find(f => !used.has(f.group) && r.m.callsign && r.m.callsign !== "TBD" && sameCallsign(r.m.callsign, f.callsign) && norm(f.airframe) === norm(r.m.type))); if (r.f) r.by = "callsign"; });
    rows.filter(r => !r.f && isTanker(r.m)).forEach(r => { r.f = take(flights.find(f => !used.has(f.group) && isTanker(f) && norm(f.airframe) === norm(r.m.type))); if (r.f) r.by = "tanker"; });
    return { rows, used };
  }

  // the radios of AI support assets (AWACS, tankers, ships) the Comm Plan names by callsign: these are set in the .miz,
  // since no player sets them
  function supportRadios(cid, mf) {
    if (!mf.beacons) return "this .miz was sent before radios were read";
    const chans = window.AOC.COMM.channels(Store.content(cid, "acp")?.matrix).filter(ch => ch.callsign && ch.freq && isFinite(parseFloat(ch.freq)));
    if (!chans.length) return "the Comm Plan names no support callsigns";
    const out = [], groups = mf.beacons.filter(b => b.kind === "group" && b.side === "blue" && ["plane", "helicopter", "ship"].includes(b.cat));
    groups.forEach(g => {
      const ai = g.cat === "ship" || !mf.flights.some(f => f.group === g.group && f.crew === "Human"); if (!ai) return;
      const names = new Set([word(g.units[0]?.callsign), word(g.group), ...g.units.map(u => word(u.name))].filter(x => x.length > 2));
      const ch = chans.find(ch => names.has(word(ch.callsign))); if (!ch) return;
      const want = parseFloat(ch.freq), have = g.cat === "ship" ? g.units.find(u => u.freq != null)?.freq ?? null : g.freq;
      if (have == null || Math.abs(have - want) > 0.0005)
        out.push({ key: `radio|${g.group}`, kind: "set", text: `Group ${g.group} (${g.units[0]?.type || g.cat}): radio ${have == null ? "not set" : have.toFixed(3)} → ${want.toFixed(3)} (Comm Plan ${ch.id} ${ch.role}${ch.callsign ? ` ${ch.callsign}` : ""}).` });
    });
    return out;
  }

  // tanker orbits at 300 KCAS (KC-130 100): the Mission Editor speed is TAS, so the right number depends on altitude (about 430 kt at FL250)
  function tankerSpeed(mf) {
    if (!mf.routes) return "this .miz was sent before routes were read; the host sends it again";
    const tankers = mf.routes.filter(r => isTanker({ type: r.type }) || r.task === "Refueling");
    if (!tankers.length) return "no tankers in the .miz";
    const out = [];
    tankers.forEach(r => {
      const want = kcasFor(r.type);
      const legs = r.points.filter(p => p.orbit).length ? r.points.filter(p => p.orbit) : r.points.filter(p => !/^(TakeOff|Land)/i.test(p.type) && p.n > 1), bad = {};
      legs.forEach(p => {
        const tas = p.orbit?.speed ?? p.speed, alt = p.orbit?.alt ?? p.alt; if (tas == null || alt == null) return;
        const cas = kt(casFromTas(tas, alt)), k = `${Math.round(ft(alt) / 100) * 100}|${Math.round(kt(tas))}`;
        if (Math.abs(cas - want) > TANKER_TOL) (bad[k] = bad[k] || { alt, tas, cas, wps: [], orbit: !!p.orbit }).wps.push(p.n);
      });
      Object.entries(bad).forEach(([k, b]) => out.push({ key: `spd|${r.group}|${k}`, kind: "fix",
        text: `Group ${r.group}: ${b.wps.length > 1 ? `waypoints ${b.wps.join(", ")}` : `waypoint ${b.wps[0]}`}${b.orbit ? " orbit" : ""} at ${Math.round(ft(b.alt) / 100) * 100} ft ${b.wps.length > 1 ? "are" : "is"} ${Math.round(kt(b.tas))} kt (${Math.round(b.cas)} KCAS). Set ${Math.round(kt(tasFromCas(want / 1.943844, b.alt)))} kt in the Mission Editor for ${want} KCAS.` }));
    });
    return out;
  }

  // the orbit altitude against the theater map's tanker track (when the track has one), within 500 ft
  function tankerAltitude(cid, mf) {
    if (!mf.routes) return "this .miz was sent before routes were read";
    const tracks = (Store.content(cid, "map")?.shapes || []).filter(s => s.type === "TANKER TRACK" && s.callsign && (s.altLo || s.alt));
    if (!tracks.length) return "no tanker track gives an altitude";
    const feet = s => { const m = String(s).toUpperCase().match(/FL\s*(\d{2,3})|(\d{4,5})/); return m ? (m[1] ? +m[1] * 100 : +m[2]) : null; };
    const out = [];
    tracks.forEach(t => {
      const r = mf.routes.find(r => flightKey(r.callsign) === flightKey(t.callsign)), lo = feet(t.altLo || t.alt), hi = feet(t.altHi || t.altLo || t.alt); if (!r || lo == null) return;
      const p = r.points.find(p => p.orbit) || r.points.find(p => p.n > 1); const alt = p && (p.orbit?.alt ?? p.alt); if (alt == null) return;
      const band = t.altHi && t.altHi !== t.altLo ? `${t.altLo}–${t.altHi}` : t.altLo || t.alt;
      if (ft(alt) < lo - 200 || ft(alt) > hi + 200) out.push({ key: `alt|${r.group}`, kind: "set", text: `Group ${r.group}: orbit altitude ${Math.round(ft(alt) / 100) * 100} ft → ${band} (${t.name}).` });
    });
    return out;
  }

  // every JIPTL target needs RED forces at its location in the .miz; BDA-destroyed targets may need removing
  function targets(cid, mf) {
    const rows = Store.content(cid, "jiptl")?.rows || []; if (!rows.length) return "the JIPTL has no targets";
    const red = window.AOC.MIZ.redRows(mf); if (!red) return `the ${mf.theatre} map is not calibrated, so target positions can't be compared`;
    const PR = window.AOC.PR, out = [], c = Store.campaign(cid);
    const dead = new Map(Object.entries(c.debriefs || {}).flatMap(([day, d]) => (d.bda || []).filter(b => /destroy/i.test(b.status || "") && b.reattack !== "Yes").map(b => [b.target, day])));
    rows.forEach(t => {
      const grp = String(t.name || "").split(" — ")[1], ll = parseLoc(t.loc);
      const here = (grp && red.some(u => u.group === grp)) || (ll && red.some(u => PR.nm(ll[0], ll[1], u.lat, u.lon) <= 1));
      if (dead.has(t.id)) { if (here) out.push({ key: `dead|${t.id}`, kind: "remove", text: `${t.id} ${t.name} was destroyed on ATO ${window.AOC.atoId(dead.get(t.id))}: remove or replace it if the campaign carries damage between missions.` }); return; }
      if (!ll && !grp) out.push({ key: `tgtloc|${t.id}`, kind: "fix", text: `${t.id} ${t.name}: the JIPTL location "${t.loc || ""}" can't be read, so the target couldn't be found in the .miz (CAOC to correct).` });
      else if (!here) out.push({ key: `tgt|${t.id}`, kind: "fix", text: `${t.id} ${t.name} at ${t.loc}: no RED unit within 1 NM in the .miz. Place the target there (or the CAOC moves the target).` });
    });
    return out;
  }

  // the mission must be running before the first TOT of the ATO period
  function startTime(cid, mf, missions) {
    const start = window.AOC.MIZ.startUtc(mf); if (!start) return "the .miz has no start time";
    const tots = missions.map(m => (String(m.tot || "").match(/(\d{2})(\d{2})Z/) || []).slice(1).map(Number)).filter(x => x.length === 2);
    if (!tots.length) return "the ATO has no TOTs yet";
    const p0 = +((Store.campaign(cid).atoPeriod || "").match(/^(\d{2})/) || [0, 0])[1] * 60;
    const rel = min => (min - p0 + 1440) % 1440, s = start.getUTCHours() * 60 + start.getUTCMinutes();
    const first = tots.map(([h, mm]) => h * 60 + mm).sort((a, b) => rel(a) - rel(b))[0];
    const hhmm = x => `${String(Math.floor(x / 60)).padStart(2, "0")}${String(x % 60).padStart(2, "0")}Z`;
    return rel(s) > rel(first) ? [{ key: "start", kind: "fix", text: `The mission starts at ${hhmm(s)}, after the first TOT on the ATO (${hhmm(first)}). Start it before ${hhmm(first)}.` }] : [];
  }

  // CAOC-side problems: ours to fix before anything goes out, never sent to the host
  function caocChecks(cid, mf, match) {
    const ato = Store.content(cid, "ato") || {}, out = [];
    const ar = (ato.missions || []).filter(m => isTanker(m) && m.target), by = {};
    ar.forEach(m => { const k = `${norm(m.target)}|${m.tot || ""}`; (by[k] = by[k] || []).push(m); });
    Object.values(by).filter(ms => ms.length > 1).forEach(ms => out.push(`${ms.map(m => `${m.msn} ${m.callsign}`).join(" and ")} are both fragged to ${ms[0].target} at ${ms[0].tot || "the same time"}.`));
    (match?.rows || []).filter(r => r.by === "tanker" && flightKey(r.f.callsign) !== flightKey(r.m.callsign))
      .forEach(r => out.push(`ATO ${r.m.msn} calls the tanker ${r.m.callsign}; the .miz tanker ${r.f.group} is ${atoCallsign(r.f.callsign)}. Use .miz tanker callsigns takes it.`));
    return out;
  }
  // the ATO (and the theater map's tanker tracks) take tanker callsigns from the host's .miz
  function syncTankers(cid) {
    const mf = window.AOC.MIZ?.current(cid); if (!mf) return [];
    const ato = Store.content(cid, "ato"), map = Store.content(cid, "map"), done = [];
    matchFlights(cid, mf).rows.filter(r => r.by === "tanker" && flightKey(r.f.callsign) !== flightKey(r.m.callsign)).forEach(r => {
      const was = r.m.callsign, now = atoCallsign(r.f.callsign), m = ato.missions.find(x => x.msn === r.m.msn); if (!m) return;
      m.callsign = now; done.push(`${m.msn} ${was} → ${now}`);
      (map?.shapes || []).filter(s => s.type === "TANKER TRACK" && flightKey(s.callsign) === flightKey(was)).forEach(s => { s.callsign = now; });
    });
    if (done.length) { Store.setContent(cid, "ato", ato); if (map) Store.setContent(cid, "map", map); Store.log(cid, `Tanker callsigns from host mission file v${mf.v}: ${done.join(", ")}`); }
    return done;
  }

  // ---------- T-24h go/no-go: is the host's .miz ready to fly? ----------
  // NO-GO: no .miz, none since the last PUBLISH, or ADD / SET / FIX items open. GO with notes: only REMOVE items, or the
  // host hasn't acknowledged the last log. Due 24 h before T-0 (PACKAGE.t0).
  function gonogo(cid) {
    const c = Store.campaign(cid), PK = window.AOC.PACKAGE, log = build(cid), mf = log.mf, rel = c.packageRelease, st = state(cid);
    const due = PK ? new Date(PK.t0(c, PK.mode(c)).getTime() - 864e5) : null, no = [], notes = [];
    if (!mf) no.push("The host hasn't sent a .miz.");
    else {
      if (rel?.when && new Date(mf.when) < new Date(rel.when)) no.push(`No .miz since PUBLISH v${rel.version} (${window.AOC.zulu(new Date(rel.when))}); the latest is v${mf.v}.`);
      const open = log.items.filter(i => i.kind !== "remove");
      if (open.length) no.push(`${open.length} .miz change${open.length === 1 ? "" : "s"} open (${["add", "set", "fix"].map(k => [k, open.filter(i => i.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${KIND[k]}`).join(", ")}).`);
      const rm = log.items.filter(i => i.kind === "remove").length; if (rm) notes.push(`${rm} REMOVE item${rm === 1 ? "" : "s"} (only if the campaign carries damage).`);
      if (st.posts[0] && st.ack?.n !== st.posts[0].n) notes.push(`The host hasn't acknowledged log #${st.posts[0].n}.`);
    }
    const state_ = no.length ? "no-go" : notes.length ? "go-notes" : "go";
    return { state: state_ === "go-notes" ? "go" : state_, notes: state_ === "go-notes", reasons: no, info: notes, due, late: !!due && Date.now() > due.getTime() && !!no.length };
  }
  function gonogoHtml(cid, g = gonogo(cid)) {
    const { esc, zulu } = window.AOC, go = g.state === "go";
    return `<p class="small" style="margin:0 0 8px"><b style="font:600 12px var(--mono);padding:2px 8px;border-radius:4px;border:1px solid;color:${go ? "var(--ok)" : "var(--danger,#e5484d)"}">${go ? "GO" : "NO-GO"}</b>
      T-24h .miz go/no-go${g.due ? `, due ${esc(zulu(g.due))}` : ""}${g.late ? ' · <span style="color:var(--danger,#e5484d);font-weight:600">overdue</span>' : ""}
      ${[...g.reasons, ...g.info].length ? `<br>${[...g.reasons.map(r => `<span style="color:var(--danger,#e5484d)">${esc(r)}</span>`), ...g.info.map(r => `<span class="muted">${esc(r)}</span>`)].join(" · ")}` : " · the .miz matches the CAOC's documents."}</p>`;
  }

  // ---------- posting: the host's registered Discord channel ----------
  const state = cid => { const c = Store.campaign(cid); return (c.mizLog = c.mizLog || { posts: [] }); };
  const last = cid => state(cid).posts[0] || null;
  // what's new and what's fixed against the last post
  function delta(cid, log = build(cid)) {
    const prev = last(cid), before = new Set(prev?.items.map(i => i.key) || []), now = new Set(log.items.map(i => i.key));
    return { log, prev, fresh: log.items.filter(i => !before.has(i.key)), fixed: (prev?.items || []).filter(i => !now.has(i.key)) };
  }
  // due when the log changed since the last post (or was never posted while it has items)
  const due = cid => { const d = delta(cid); return !!d.log.mf && (d.fresh.length > 0 || d.fixed.length > 0 || (!d.prev && d.log.items.length > 0)); };
  function text(cid, log = build(cid), n = (last(cid)?.n || 0) + 1, extra = {}) {
    const c = Store.campaign(cid), mf = log.mf, L = [];
    L.push(`MIZ CHANGE LOG #${n} — OP ${c.opName} — ATO ${window.AOC.atoId(c.atoDay)}`);
    if (!mf) { L.push("No host mission file yet."); return L.join("\n"); }
    L.push(`Against host mission file v${mf.v} ${mf.name}`);
    L.push(log.items.length ? `${log.items.length} change${log.items.length === 1 ? "" : "s"} required in the .miz.` : "No changes required: every check passed.");
    const g = gonogo(cid); L.push(`T-24h go/no-go: ${g.state === "go" ? "GO" : "NO-GO"}${g.due ? ` (due ${window.AOC.zulu(g.due)})` : ""}${g.reasons.length ? ` — ${g.reasons.join(" ")}` : ""}`);
    ["add", "set", "fix", "remove"].forEach(k => { const xs = log.items.filter(i => i.kind === k); if (!xs.length) return;
      L.push("", { add: "REQUIRED ADDITIONS", set: "CAOC ASSIGNMENTS TO SET", fix: "DISCREPANCIES TO FIX", remove: "TO REMOVE" }[k]);
      xs.forEach(i => L.push(`  ${KIND[k].padEnd(6)} ${i.text}${extra.fresh?.has(i.key) ? "  [NEW]" : ""}`)); });
    if (extra.fixed?.length) { L.push("", "FIXED SINCE THE LAST LOG"); extra.fixed.forEach(i => L.push(`  DONE   ${i.text}`)); }
    if (log.passed.length) { L.push("", "CHECKED — NO CONFLICTS"); log.passed.forEach(p => L.push(`  OK     ${p}`)); }
    if (log.notChecked.length) { L.push("", "NOT CHECKED"); log.notChecked.forEach(x => L.push(`  —      ${x.label}: ${x.why}`)); }
    L.push("", "Not .miz changes: human-flight radio presets, Link 16 STNs, SADL TNs, IDM and IFF / SIF are set in the cockpit or by DKS.");
    return L.join("\n");
  }
  function post(cid, reason) {
    const d = delta(cid); if (!d.log.mf) return null;
    const c = Store.campaign(cid), host = c.jfacc?.group, st = state(cid), n = (d.prev?.n || 0) + 1, when = new Date().toISOString();
    const fresh = new Set(d.fresh.map(i => i.key));
    const content = text(cid, d.log, n, { fresh, fixed: d.fixed });
    const rec = { n, when, reason, v: d.log.mf.v, items: d.log.items.map(({ key, kind, text: t, check }) => ({ key, kind, text: t, check })), fixed: d.fixed.map(i => i.text), passed: d.log.passed };
    st.posts.unshift(rec); st.posts = st.posts.slice(0, 30); st.ack = null;
    const db = Store.db; db.discordOutbox = db.discordOutbox || [];
    db.discordOutbox.unshift({ when, payload: { event: "miz.changes", campaign_id: cid, operation: c.opName, ato: window.AOC.atoId(c.atoDay), log: n, reason,
      mission_file: { version: d.log.mf.v, name: d.log.mf.name }, recipients: host ? [{ group_id: host, group: Store.group(host)?.name || host, host: true }] : [],
      counts: Object.fromEntries(Object.keys(KIND).map(k => [k, d.log.items.filter(i => i.kind === k).length])), new: d.fresh.length, fixed: d.fixed.length,
      title: `OP ${c.opName} — .miz change log #${n}`, content, attachment: { filename: `OP_${c.opName.replace(/\s+/g, "_")}_MIZ_CHANGES_${n}.txt` } } });
    db.discordOutbox = db.discordOutbox.slice(0, 50);
    Store.save(); Store.log(cid, `.miz change log #${n} to ${Store.group(host)?.name || "the host"} (${d.log.items.length} open${d.fixed.length ? `, ${d.fixed.length} fixed` : ""})`);
    return rec;
  }
  function acknowledge(cid, by) { const st = state(cid); if (!st.posts[0]) return; st.ack = { n: st.posts[0].n, when: new Date().toISOString(), by }; Store.save(); Store.log(cid, `.miz change log #${st.posts[0].n} acknowledged by ${by}`, by); }

  // ---------- the log as a panel (Dashboard, mission file page) ----------
  function html(cid, { staff = true } = {}) {
    const { esc, zulu } = window.AOC, log = build(cid), d = delta(cid, log), st = state(cid), fresh = new Set(d.fresh.map(i => i.key));
    const tag = k => `<span class="mlk ${k}">${KIND[k]}</span>`;
    const caoc = staff && log.caoc.length ? `<div class="section-h" style="color:var(--warn)">CAOC to fix first (not sent to the host)</div><ul class="finds">${log.caoc.map(t => `<li><span class="sev warn">CAOC</span> ${esc(t)}</li>`).join("")}</ul>` : "";
    if (!log.mf) return `${caoc}<p class="muted small">No host mission file yet, so there is no change log.</p>`;
    const p = st.posts[0];
    const head = `<p class="small">${p ? `Last sent: log #${p.n}, ${esc(zulu(new Date(p.when)))} (${esc(p.reason)})${st.ack?.n === p.n ? ` · <span style="color:var(--ok)">acknowledged by ${esc(st.ack.by)}</span>` : " · not acknowledged"}` : "Not sent yet."}
      ${staff && due(cid) ? ` · <span style="color:var(--warn)">changed since — goes with the next PUBLISH</span>` : ""}</p>`;
    const sec = (k, h) => { const xs = log.items.filter(i => i.kind === k); return xs.length ? `<div class="section-h">${h}</div><ul class="finds">${xs.map(i => `<li>${tag(k)} ${esc(i.text)}${fresh.has(i.key) && p ? `<span class="newb">NEW</span>` : ""}</li>`).join("")}</ul>` : ""; };
    return `${caoc}${gonogoHtml(cid)}${head}
      ${log.items.length ? "" : `<p class="small" style="color:var(--ok)">✓ No .miz changes required against v${log.mf.v}.</p>`}
      ${sec("add", "Required additions — ATO lines not in the .miz")}${sec("set", "CAOC assignments to set in the .miz")}${sec("fix", "Discrepancies to fix")}${sec("remove", "To remove")}
      ${d.fixed.length && p ? `<div class="section-h">Fixed since log #${p.n}</div><ul class="finds">${d.fixed.map(i => `<li><span class="sev info">fixed</span> ${esc(i.text)}</li>`).join("")}</ul>` : ""}
      ${log.passed.length ? `<div class="section-h">Checked — no conflicts</div><p class="small">${log.passed.map(x => `<span style="color:var(--ok)">✓</span> ${esc(x)}`).join(" · ")}</p>` : ""}
      ${log.notChecked.length ? `<p class="small muted">Not checked: ${log.notChecked.map(x => `${esc(x.label)} (${esc(x.why)})`).join("; ")}.</p>` : ""}
      <p class="small muted">Not .miz changes: human-flight radio presets, Link 16 STNs, SADL TNs, IDM and IFF / SIF are set in the cockpit or by DKS.</p>`;
  }
  const CSS = `.mlk{display:inline-block;min-width:52px;text-align:center;font:600 10px var(--mono);padding:1px 4px;border-radius:4px;margin-right:6px;border:1px solid currentColor}
    .mlk.add{color:var(--info)}.mlk.set{color:var(--warn)}.mlk.fix{color:var(--danger,#e5484d)}.mlk.remove{color:var(--muted)}
    .finds{padding-left:0}.finds li{margin:5px 0;font-size:13px;list-style:none}.newb{font:600 10px var(--mono);color:var(--accent);margin-left:6px}
    .sev{font:600 10px var(--mono);text-transform:uppercase;padding:1px 6px;border-radius:999px;border:1px solid;white-space:nowrap}
    .sev.error{color:var(--danger,#e5484d)}.sev.warn{color:var(--warn)}.sev.info{color:var(--muted)}`;
  if (document?.head && !document.getElementById("mlk-css")) { const st = document.createElement("style"); st.id = "mlk-css"; st.textContent = CSS; document.head.appendChild(st); }

  window.AOC.MIZLOG = { gonogo, gonogoHtml, TANKER_KCAS, HELO_TANKER_KCAS, TANKER_TOL, kcasFor, build, matchFlights, syncTankers, delta, due, text, post, acknowledge, html, parseLoc, casFromTas, tasFromCas };
})();
