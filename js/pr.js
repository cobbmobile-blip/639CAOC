// Personnel recovery (the vPRCC): DKS Debrief reports an ejection -> an incident the PRCC works through the PR steps
// (report, locate, support, recover, reintegrate) -> a CSAR task force package. Contract: docs/PR_DKS_Integration.md.
// Everything the rescue force needs is assembled from what the site already holds: the SPINS release the pilot took off
// with, the pilot's ISOPREP and EPA, the Comm Plan, the theater map, the ATO and the JIPTL. Nothing is typed twice.
(function () {
  const { Store } = window.AOC;
  const STEPS = [["report", "Report"], ["locate", "Locate & authenticate"], ["support", "Support"], ["recover", "Recover"], ["reintegrate", "Reintegrate"]];
  const up = s => String(s ?? "").toUpperCase().trim();

  // ---------- geometry ----------
  const R = Math.PI / 180;
  const nm = (a, b, c, d) => { const h = Math.sin((c - a) * R / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin((d - b) * R / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.sqrt(h)); };
  const brg = (a, b, c, d) => (Math.atan2(Math.sin((d - b) * R) * Math.cos(c * R), Math.cos(a * R) * Math.sin(c * R) - Math.sin(a * R) * Math.cos(c * R) * Math.cos((d - b) * R)) / R + 360) % 360;
  const pad = (n, w, d = 0) => n.toFixed(d).padStart(w + (d ? d + 1 : 0), "0");
  const ddm = (lat, lon) => { const f = (v, w, p, q) => { const a = Math.abs(v), g = Math.floor(a); return `${v >= 0 ? p : q}${pad(g, w)}°${pad((a - g) * 60, 2, 3)}'`; };
    return `${f(lat, 2, "N", "S")} ${f(lon, 3, "E", "W")}`; };
  // WGS84 lat/lon -> MGRS (UTM zones, no Norway/Svalbard exceptions)
  function mgrs(lat, lon) {
    const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = 0.9996;
    const zone = Math.floor((lon + 180) / 6) + 1, l0 = ((zone - 1) * 6 - 180 + 3) * R, p = lat * R;
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * (lon * R - l0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
    const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let Y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) Y += 10000000;
    const band = "CDEFGHJKLMNPQRSTUVWXX"[Math.floor((lat + 80) / 8)];
    const col = ["STUVWXYZ", "ABCDEFGH", "JKLMNPQR"][zone % 3][Math.floor(E / 100000) - 1];
    const row = "ABCDEFGHJKLMNPQRSTUV"[(Math.floor(Y / 100000) + (zone % 2 ? 0 : 5)) % 20];
    return `${zone}${band} ${col}${row} ${String(Math.floor(E % 100000)).padStart(5, "0")} ${String(Math.floor(Y % 100000)).padStart(5, "0")}`;
  }

  // ---------- SPINS personnel-recovery data ----------
  // Generated per campaign (deterministic, so every page and product agrees) unless the SPINS sets a value.
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // SARNEG: a 10-letter word with no repeated letter; its letters stand for the digits 0-9
  const SARNEGS = ["BLACKHORSE", "CUMBERLAND", "DUMBWAITER", "FLASHPOINT", "HYDROMATIC", "LUMBERJACK", "PATHFINDER", "TRAMPOLINE",
    "WORKPLACES", "CLOTHESPIN", "DOWNSTREAM", "PALINDROME"].filter(w => new Set(w).size === 10);
  const WODS = ["ANVIL", "BADGER", "CANYON", "DYNAMO", "EMBER", "FALCON", "GRANITE", "HARBOR", "IVORY", "JUNIPER", "KESTREL", "LANTERN", "MARBLE",
    "NECTAR", "ORCHID", "PEPPER", "QUARTZ", "RIVET", "SADDLE", "TIMBER", "UMBRA", "VELVET", "WALNUT", "YARROW", "ZEPHYR"];
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";            // no I or O (read as 1 / 0)
  const DURESS = ["CORNFLOWER", "TEACUP", "HONEYBEE", "SNOWDROP", "PINWHEEL", "MOLASSES"];
  const comm = cid => { const m = Store.content(cid, "acp")?.matrix;
    return (m?.columns || []).flatMap(c => (c.cells || []).slice(0, m.rows).map((cell, i) => ({ id: `${c.color} ${i + 1}`, net: c.title, ...cell }))).filter(ch => ch.role || ch.callsign || ch.freq); };
  const chan = (cid, re) => comm(cid).find(ch => re.test(ch.role || "") || re.test(ch.callsign || ""));
  const chanTxt = ch => ch ? `${ch.id}${ch.freq ? ` (${ch.freq})` : ""}` : "";
  function spinsPR(cid, spins) {
    const s = spins || Store.content(cid, "spins") || {}, c = Store.campaign(cid), h = hash(cid);
    const area = Store.content(cid, "targeting")?.area, pts = Store.content(cid, "map")?.points || [];
    const named = pts.find(p => /SARDOT/i.test(p.name));
    // SARDOT: the theater map's SARDOT point, else the AO centre to the whole minute
    const [sLat, sLon] = String(s.sardotLat || "").split(/[\s,;]+/).map(Number);
    const sardot = isFinite(sLat) && isFinite(sLon) && s.sardotLat ? { name: s.sardotName || "SARDOT", lat: sLat, lon: sLon }
      : named ? { name: named.name, lat: named.lat, lon: named.lng }
      : area?.lat ? { name: "SARDOT", lat: Math.round(+area.lat * 60) / 60, lon: Math.round(+area.lon * 60) / 60 } : null;
    const days = Array.from({ length: Math.max(7, (+c.atoDay || 1) + 3) }, (_, i) => ({ day: String(i + 1),
      wod: WODS[(h + i * 7) % WODS.length], lod: LETTERS[(h + i * 5) % LETTERS.length], nod: String((h + i * 3) % 10) }));
    const prim = chan(cid, /^SAR-?A|SURVIVOR|ISOLATED/i) || chan(cid, /RESCORT|SANDY/i), alt = chan(cid, /^SAR-?B/i), prcc = chan(cid, /PRCC|CSARTF/i);
    return {
      sarneg: up(s.sarneg) || SARNEGS[h % SARNEGS.length], sardot, duress: up(s.duress) || DURESS[h % DURESS.length],
      days: s.prDays?.length ? s.prDays : days,
      guard: "243.000 UHF / 121.500 VHF",
      primary: s.prPrimary || chanTxt(prim) || "282.800", alternate: s.prAlternate || chanTxt(alt) || "", prcc: chanTxt(prcc),
      contact: s.prContact || "Initial call on Guard when safe, then monitor the PR primary. After that listen for 5 minutes on the hour and half hour (H+00, H+30); transmit only when you hear or see friendly aircraft.",
      signals: s.prSignals || "Day: signal mirror, orange smoke. Night: IR strobe, then flare on the rescue helo's call. Never mark while a threat is overhead.",
      safe: s.prSafe || [], code: s.prCode || ""
    };
  }
  // the letters for a string of digits, e.g. grid "2021 8205" with BLACKHORSE -> "CBCL RBCK"
  const sarnegEncode = (digits, word) => String(digits).replace(/\d/g, d => word[+d]);
  // the SPINS day a time falls in: ATO day N covers ato.period start + (N - atoDay) days (falls back to the campaign's ATO day)
  const dayOf = (cid, when) => { const c = Store.campaign(cid); return String(c.atoDay || 1); };

  // ---------- the SPINS release a pilot took off with ----------
  function spinsAt(cid, when) {
    const s = Store.shared(cid, "spins"); if (!s) return null;
    const hist = s.history?.length ? s.history : [{ version: s.version, when: s.when, data: s.data }];
    const t = Date.parse(when || ""), ok = hist.filter(h => !isFinite(t) || Date.parse(h.when) <= t);
    const h = ok.at(-1); if (!h) return { version: null, note: `No SPINS release before ${when}` };
    return { version: h.version, label: h.data?.version || `v${h.version}`, when: h.when, data: h.data || s.data, latest: h === hist.at(-1) };
  }

  // ---------- ISOPREP and EPA ----------
  const isopreps = gid => (Store.db.isopreps || []).filter(p => !gid || p.gid === gid);
  const normName = s => up(s).replace(/[^A-Z0-9]/g, "");
  // a pilot is matched by DCS player name, then by callsign, preferring the reporting group
  function isoprepFor(pilot = {}, gid) {
    const all = isopreps(), n = normName(pilot.player_name), cs = normName(pilot.callsign);
    return all.find(p => n && normName(p.player) === n) || all.find(p => cs && normName(p.callsign) === cs && (!gid || p.gid === gid)) || null;
  }
  function saveIsoprep(p) {
    const d = Store.db; d.isopreps = d.isopreps || [];
    if (!p.id) p.id = "ISO" + Date.now().toString(36);
    const i = d.isopreps.findIndex(x => x.id === p.id); p.updated = new Date().toISOString();
    if (i >= 0) d.isopreps[i] = p; else d.isopreps.push(p); Store.save(); return p;
  }
  const epas = cid => (Store.db.epas || []).filter(e => !cid || e.cid === cid);
  const epaFor = (cid, msn) => epas(cid).filter(e => e.msn === msn).at(-1) || null;
  function saveEpa(e) {
    const d = Store.db; d.epas = d.epas || [];
    if (!e.id) e.id = "EPA" + Date.now().toString(36);
    const i = d.epas.findIndex(x => x.id === e.id); e.updated = new Date().toISOString();
    if (i >= 0) d.epas[i] = e; else d.epas.push(e); Store.save(); return e;
  }
  // the standing EPA every crew flies with when they file none
  const standardEpa = pr => ({ intent: "Move away from the wreck and any road at once; hide within 1 km until contact is made.",
    hide: "Thick cover, high ground with a view of the approach, away from settlements and water sources.",
    travel: "Move only at night toward the nearest SAFE area; stay off ridgelines.",
    contact: pr.contact, signals: pr.signals, dar: pr.safe[0]?.name || "", standard: true });

  // ---------- incidents (db.prIncidents) ----------
  const incidents = cid => (Store.db.prIncidents || []).filter(i => !cid || i.cid === cid).sort((a, b) => b.received.localeCompare(a.received));
  const incident = id => (Store.db.prIncidents || []).find(i => i.id === id);
  const log = (inc, text, by) => { inc.log.unshift({ when: new Date().toISOString(), by: by || window.AOC.Auth.user()?.callsign || "PRCC", text }); };
  // DKS Debrief -> site. Returns the incident, or { error }.
  function intake(payload) {
    const p = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (p.event !== "pr.ejection") return { error: `Not a pr.ejection event (${p.event || "no event"})` };
    const c = Store.db.campaigns.find(x => x.id === p.campaign_id) || Store.db.campaigns.find(x => up(x.opName) === up(p.operation));
    if (!c) return { error: `Unknown campaign ${p.campaign_id || p.operation}` };
    if (!isFinite(+p.position?.lat) || !isFinite(+p.position?.lon)) return { error: "No ejection position" };
    const d = Store.db; d.prIncidents = d.prIncidents || [];
    if (p.event_id && d.prIncidents.some(i => i.eventId === p.event_id)) return { error: `Already received (${p.event_id})` };
    const n = d.prIncidents.filter(i => i.cid === c.id).length + 1;
    const line = (Store.content(c.id, "ato")?.missions || []).find(m => m.msn === String(p.aircraft?.msn || ""));
    const inc = { id: `PR-${String(n).padStart(3, "0")}`, cid: c.id, eventId: p.event_id || "", received: new Date().toISOString(), source: p.source || "DKS Debrief",
      step: "report", status: "open", report: p, msn: line?.msn || String(p.aircraft?.msn || ""), gid: p.pilot?.group_id || line?.group || "",
      isoprepId: isoprepFor(p.pilot, p.pilot?.group_id || line?.group)?.id || "", position: { lat: +p.position.lat, lon: +p.position.lon, source: "DKS ejection position" },
      auth: {}, forces: [], route: [], outcome: "", log: [] };
    log(inc, `Ejection reported by ${inc.source}: ${p.pilot?.callsign || "unknown"} (${p.aircraft?.type || "?"}, MSN ${inc.msn || "?"})`, "DKS");
    d.prIncidents.push(inc); Store.log(c.id, `PR ${inc.id}: ${p.pilot?.callsign || "aircrew"} ejected — PRCC notified`, "DKS"); Store.save();
    return inc;
  }
  function setStep(inc, step) { inc.step = step; log(inc, `Step: ${STEPS.find(s => s[0] === step)?.[1]}`); Store.save(); }

  // ---------- support: threats around the survivor, and the CSAR comm plan ----------
  function threats(cid, lat, lon, within = 40) {
    const pts = (Store.content(cid, "map")?.points || []).filter(p => p.type === "THREAT").map(p => ({ name: p.name, system: p.system || "", ring: +p.range || 0, lat: p.lat, lon: p.lng }));
    const nom = Store.content(cid, "targeting")?.results;
    const sams = nom ? [...nom.jiptl, ...nom.watchlist, ...nom.outOfBMA].filter(g => /SAM|AAA/.test(g.category))
      .map(g => ({ name: `${g.targetNumber} ${g.unitName}`, system: g.category, ring: /long/.test(g.category) ? 40 : /medium/.test(g.category) ? 15 : /short/.test(g.category) ? 6 : 2, lat: g.lat, lon: g.lon })) : [];
    // a nominated SAM the theater map already shows as a threat is the same site: keep the map's (its ring is set by hand)
    const merged = [...pts, ...sams.filter(g => !pts.some(p => nm(p.lat, p.lon, g.lat, g.lon) < 0.5))];
    return merged.map(t => ({ ...t, nm: nm(lat, lon, t.lat, t.lon), brg: brg(lat, lon, t.lat, t.lon) }))
      .filter(t => t.nm <= Math.max(within, t.ring)).sort((a, b) => a.nm - b.nm).map(t => ({ ...t, covers: t.ring && t.nm <= t.ring }));
  }
  function commPlan(cid, inc) {
    const pr = spinsPR(cid), ato = Store.content(cid, "ato")?.missions || [], rows = [];
    const add = (role, callsign, channel, freq, notes = "") => rows.push({ role, callsign, channel, freq, notes });
    const ch = re => chan(cid, re);
    const surv = inc ? `${inc.report?.pilot?.callsign || "SURVIVOR"}` : "SURVIVOR";
    add("Survivor — initial", surv, "GUARD", pr.guard, "Initial call only");
    const p = ch(/^SAR-?A|SURVIVOR|ISOLATED/i) || ch(/RESCORT|SANDY/i); add("Survivor — PR primary", surv, p?.id || "", p?.freq || pr.primary, pr.contact.split(".")[1]?.trim() || "");
    const a = ch(/^SAR-?B/i); if (a) add("Survivor — PR alternate", surv, a.id, a.freq);
    const prcc = ch(/PRCC|CSARTF/i); add("PRCC / CSARTF commander", prcc?.callsign || "GUARDIAN", prcc?.id || "", prcc?.freq || "");
    const res = ch(/RESCORT|SANDY/i); add("RESCORT (Sandy) — on-scene commander", res?.callsign || "SANDY", res?.id || "", res?.freq || "");
    const forceCs = key => inc?.forces?.find(f => f.key === key)?.callsign || "";
    add("Rescue vehicle", forceCs("rv") || "JOLLY", p?.id || "", p?.freq || "", "Talks to the survivor on the PR primary");
    const dca = ch(/^DCA/i); add("SARCAP / RESCAP", forceCs("sarcap") || dca?.callsign || "", dca?.id || "", dca?.freq || "");
    const sead = ch(/^SEAD/i); add("SEAD", forceCs("sead") || sead?.callsign || "", sead?.id || "", sead?.freq || "");
    const aew = ato.find(m => m.role === "AEW"), c2 = ch(/^C2|AWACS|GCI|CHECK IN/i); add("AWACS / GCI", aew?.callsign || c2?.callsign || "", c2?.id || "", c2?.freq || "");
    const isr = ch(/MQ-9|ISR|RQ-/i); add("ISR", isr?.callsign || "", isr?.id || "", isr?.freq || "", "Eyes on the survivor");
    const tk = ato.find(m => m.role === "AR"), boom = ch(/BOOM|MPRS|KC-130/i); if (tk) add("Tanker", tk.callsign, boom?.id || "", boom?.freq || "", tk.target || "");
    return rows;
  }

  // ---------- recover: the CSAR force — retask an ATO line or request one (posted to Discord for a unit to commit) ----------
  const HELOS = /UH-1|Mi-8|CH-47|UH-60|HH-60|MH-60|Mi-24|SA342|Ka-27/i;
  const FORCES = [
    { key: "rmc", label: "RESCORT — Sandy (on-scene commander)", role: "RESCORT", airframe: "A-10C II", alt: ["A-10C", "AH-64D", "AV-8B"], num: 2, need: "always",
      fits: m => /RESCORT|CSAR|CAS/.test(m.role) && /A-10|AH-64|AV-8|Ka-50/.test(m.type) },
    { key: "rv", label: "Rescue vehicle (helicopter)", role: "CSAR", airframe: "MH-60L", alt: ["UH-1H", "Mi-8"], num: 2, need: "always", fits: m => /CSAR|Airlift/.test(m.role) && HELOS.test(m.type) },
    // CH-47s fragged when the rescue needs lift beyond the MH-60s (several survivors, a long range or a recovery team)
    { key: "rv2", label: "Additional lift (CH-47F)", role: "CSAR", airframe: "CH-47F", num: 1, need: "optional", fits: m => /CSAR|Airlift/.test(m.role) && /CH-47/.test(m.type) },
    { key: "sarcap", label: "SARCAP / RESCAP (air cover)", role: "SARCAP", airframe: "F-16C", alt: ["F/A-18C", "F-15C", "F-14B", "M-2000C"], num: 2, need: "always", fits: m => /SARCAP|DCA|OCA|Escort/.test(m.role) },
    { key: "sead", label: "SEAD", role: "SEAD", airframe: "F-16C", alt: ["F/A-18C"], num: 2, need: "threat", fits: m => /SEAD|DEAD/.test(m.role) },
    { key: "aew", label: "AWACS / GCI", role: "AEW", airframe: "E-3A", num: 1, crew: "AI", need: "always", fits: m => m.role === "AEW" },
    { key: "isr", label: "ISR (MQ-9)", role: "ISR", airframe: "MQ-9", num: 1, crew: "AI", need: "optional", fits: m => m.role === "ISR" },
    { key: "ar", label: "Tanker", role: "AR", airframe: "KC-135 MPRS", num: 1, crew: "AI", need: "optional", fits: m => m.role === "AR" }];
  function forceNeeds(inc) {
    const th = threats(inc.cid, inc.position.lat, inc.position.lon);
    return FORCES.map(f => ({ ...f, required: f.need === "always" || (f.need === "threat" && th.some(t => t.covers)),
      why: f.need === "threat" ? (th.filter(t => t.covers).map(t => t.name).join(", ") || "no SAM ring covers the survivor") : "" }));
  }
  // replacing an element cancels the line the PRCC requested for it, if no unit has committed yet
  function dropOld(inc, key) {
    const old = inc.forces.find(f => f.key === key), l = old?.lineId && window.AOC.ATO.line(old.lineId);
    if (l && l.status !== "committed" && window.AOC.ATO.cancel(l.id)) log(inc, `Cancelled requested line ${l.msn} (replaced)`);
  }
  function assignLine(inc, key, msn) {
    const m = (Store.content(inc.cid, "ato")?.missions || []).find(x => x.msn === msn); if (!m) return;
    dropOld(inc, key);
    inc.forces = inc.forces.filter(f => f.key !== key).concat({ key, msn, callsign: m.callsign, type: `${m.num}× ${m.type}`, how: "retasked ATO line" });
    log(inc, `${FORCES.find(f => f.key === key).label}: retasked ATO line ${msn} ${m.callsign}`); Store.save();
  }
  function requestLine(inc, key, by) {
    const f = FORCES.find(x => x.key === key), A = window.AOC.ATO;
    // a human line goes to the first airframe an active group actually flies, so the Discord post reaches someone
    dropOld(inc, key);
    const airframe = f.crew === "AI" ? f.airframe : [f.airframe, ...(f.alt || [])].find(a => A.recipients(a).length) || f.airframe;
    const l = A.request(inc.cid, { airframe, num: f.num, role: f.role, crew: f.crew || "Human", target: `${inc.id} survivor`, pkg: "CSAR",
      notes: `${inc.id} personnel recovery — ${f.label}`, source: "PRCC" }, by);
    if (l.status === "draft") A.postLine(l.id);
    inc.forces = inc.forces.filter(x => x.key !== key).concat({ key, msn: l.msn, lineId: l.id, callsign: l.callsign || "TBD", type: `${l.num}× ${l.airframe}`, how: l.crew === "AI" ? "new AI line" : "new line — posted to Discord" });
    log(inc, `${f.label}: requested new ATO line ${l.msn} (${l.num}× ${l.airframe}${l.crew === "AI" ? ", AI" : ", posted for commitment"})`); Store.save();
    return l;
  }
  // a requested line shows who committed to it once a unit does
  function forceState(inc, f) {
    if (!f.lineId) return f;
    const l = window.AOC.ATO.line(f.lineId); if (!l) return f;
    const state = l.status === "committed" ? `committed — ${Store.group(l.committedBy)?.name || ""}` : l.status === "ai" ? "AI line"
      : l.status === "open" ? (l.recipients.length ? `open — posted to ${l.recipients.length} group${l.recipients.length > 1 ? "s" : ""}, awaiting commit` : `open — NO active group flies the ${l.airframe}`) : l.status;
    return { ...f, callsign: l.callsign || f.callsign, state, unfilled: l.status === "open" && !l.recipients.length };
  }

  // ---------- recover: the CSAR route over the theater map's spider / nav / destination points ----------
  const routePoints = cid => (Store.content(cid, "map")?.points || []).filter(p => /SPIDER|NAV|DEST/.test(p.type)).map(p => ({ id: p.id, name: p.name, type: p.type, lat: p.lat, lon: p.lng }));
  // DKS: the route as spider points (the survivor is the objective), sent with the package
  function routePayload(inc) {
    return { event: "pr.csar_route", incident_id: inc.id, campaign_id: inc.cid, name: `${inc.id} CSAR`,
      points: inc.route.map((p, i) => ({ seq: i + 1, name: p.name, lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), dks_section: "Spider points", role: p.role || "" })) };
  }

  window.AOC.PR = { STEPS, spinsPR, sarnegEncode, spinsAt, dayOf, isopreps, isoprepFor, saveIsoprep, epas, epaFor, saveEpa, standardEpa,
    incidents, incident, intake, setStep, log, threats, commPlan, FORCES, forceNeeds, assignLine, requestLine, forceState, routePoints, routePayload,
    nm, brg, ddm, mgrs, chan };
})();
