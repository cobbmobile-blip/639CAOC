// ATO line requests: the campaign's Group JFACC/LNO requests lines (from their .miz or by hand); Human lines are
// posted to every registered group flying that airframe via the Discord integration; a unit's Commit (from the
// Discord button) comes back through commit() and fills the line on the ATO.
(function () {
  const { Store } = window.AOC;

  // ---------- airframes ----------
  // DCS unit type (as written in a .miz) -> the airframe name groups register with
  const DCS_AIRFRAMES = {
    "F-15ESE": "F-15E", "F-15C": "F-15C", "FA-18C_hornet": "F/A-18C", "F-16C_50": "F-16C", "A-10C_2": "A-10C II", "A-10C": "A-10C",
    "F-14B": "F-14B", "F-14A-135-GR": "F-14A", "AV8BNA": "AV-8B", "M-2000C": "M-2000C", "JF-17": "JF-17", "F-5E-3": "F-5E",
    "AH-64D_BLK_II": "AH-64D", "UH-1H": "UH-1H", "Ka-50_3": "Ka-50", "Ka-50": "Ka-50", "Mi-24P": "Mi-24P", "Mi-8MT": "Mi-8",
    "CH-47Fbl1": "CH-47F", "KC-135": "KC-135", "KC135MPRS": "KC-135 MPRS", "KC130": "KC-130J", "S-3B Tanker": "S-3B Tanker",
    "E-3A": "E-3A", "E-2C": "E-2C", "C-130": "C-130", "MQ-9 Reaper": "MQ-9"
  };
  const AIRFRAMES = [...new Set(Object.values(DCS_AIRFRAMES))].sort();
  const ROLES = ["DCA", "OCA", "Escort", "SEAD", "DEAD", "Strike", "AI", "CAS", "SCAR", "ISR", "AR", "AEW", "CSAR", "Airlift"];
  // DCS group task -> ATO mission type
  const TASK_TO_ROLE = { "CAP": "DCA", "Intercept": "DCA", "Fighter Sweep": "OCA", "Escort": "Escort", "SEAD": "SEAD", "CAS": "CAS",
    "Ground Attack": "Strike", "Runway Attack": "Strike", "Pinpoint Strike": "Strike", "Antiship Strike": "Strike",
    "Refueling": "AR", "AWACS": "AEW", "Reconnaissance": "ISR", "Transport": "Airlift", "AFAC": "SCAR" };
  const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // groups registered with an airframe ("F-16C" matches "F-16C", "F-16C, F/A-18C" …); compares letters/digits only
  function flies(group, airframe) {
    return String(group.airframes || "").split(/[,;]| and /).map(norm).filter(Boolean).some(a => a === norm(airframe));
  }
  const recipients = airframe => Store.db.groups.filter(g => g.status === "active" && flies(g, airframe));

  // ---------- registry (db.atoLines) ----------
  const lines = cid => (Store.db.atoLines || []).filter(l => !cid || l.cid === cid);
  const line = id => (Store.db.atoLines || []).find(l => l.id === id);
  // mission numbers for the campaign's ATO day: day 8 -> 8601, 8602 … (6xx = requested lines)
  function nextMsn(cid) {
    const c = Store.campaign(cid), day = c.atoDay || 1;
    const used = new Set([...(Store.content(cid, "ato")?.missions || []).map(m => m.msn), ...lines(cid).map(l => l.msn)]);
    for (let n = 1; n < 100; n++) { const m = `${day}6${String(n).padStart(2, "0")}`; if (!used.has(m)) return m; }
    return `${day}6${Date.now() % 100}`;
  }

  // keep the ATO product (draft content + released copy) in step with the registry
  function syncToAto(l) {
    const toMission = () => ({ msn: l.msn, pkg: l.pkg || "—", group: l.committedBy || "", callsign: l.callsign || "TBD", type: l.airframe,
      num: String(l.num), role: l.role, tot: l.tot || "TBD", target: l.target || "", tanker: l.tanker || "—", crew: l.crew, lineId: l.id });
    const apply = list => {
      const i = list.findIndex(m => m.lineId === l.id || m.msn === l.msn);
      if (l.status === "cancelled") { if (i >= 0) list.splice(i, 1); return; }
      if (i >= 0) list[i] = { ...list[i], ...toMission() }; else list.push(toMission());
    };
    const ato = Store.content(l.cid, "ato") || { missions: [] };
    ato.missions = ato.missions || []; apply(ato.missions); Store.setContent(l.cid, "ato", ato);
    // assignments also update the released ATO so groups see who flies what without waiting for a re-release
    const shared = Store.shared(l.cid, "ato");
    if (shared?.data?.missions && (l.status !== "cancelled" || shared.data.missions.some(m => m.lineId === l.id))) { apply(shared.data.missions); Store.save(); }
  }

  // Discord post the bot sends for an open Human line (see docs/ATO_Discord_Integration.md)
  function discordPayload(l) {
    const c = Store.campaign(l.cid), req = Store.group(l.requestedBy);
    return {
      event: "ato_line.open",
      line_id: l.id, campaign_id: l.cid, operation: c.opName, ato_day: c.atoDay, msn: l.msn,
      airframe: l.airframe, aircraft: l.num, mission: l.role, crew: l.crew, tot: l.tot || null, target: l.target || null,
      package: l.pkg || null, callsign: l.callsign || null, base: l.base || null, notes: l.notes || null,
      commit_by: l.commitBy || null, requested_by: { group_id: l.requestedBy, group: req?.name, jfacc: l.requestedByUser },
      recipients: l.recipients.map(id => ({ group_id: id, group: Store.group(id)?.name })),
      components: [{ type: "button", label: "Commit", style: "success", custom_id: `ato_commit:${l.id}` }]
    };
  }
  // events the site hands the Discord integration (the prototype just records them in db.discordOutbox)
  function emit(payload) {
    const d = Store.db; d.discordOutbox = d.discordOutbox || [];
    d.discordOutbox.unshift({ when: new Date().toISOString(), payload }); d.discordOutbox = d.discordOutbox.slice(0, 50);
  }
  function post(l) {
    l.recipients = recipients(l.airframe).map(g => g.id);
    l.postedAt = new Date().toISOString();
    emit(discordPayload(l));
  }
  // filled / cancelled: the bot edits every copy of the post (shows who filled it, disables Commit)
  const closeEvent = (event, l) => emit({ event, line_id: l.id, msn: l.msn,
    filled_by: l.committedBy ? { group_id: l.committedBy, group: Store.group(l.committedBy)?.name, user: l.committedByUser } : null,
    recipients: l.recipients.map(id => ({ group_id: id })) });

  // JFACC/LNO request -> ATO line. Human lines are posted for commitment; AI lines go straight on the ATO.
  function request(cid, fields, by) {
    const d = Store.db; d.atoLines = d.atoLines || [];
    const l = { id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cid, msn: fields.msn || nextMsn(cid),
      airframe: fields.airframe, num: +fields.num || 2, role: fields.role, crew: fields.crew === "AI" ? "AI" : "Human",
      tot: fields.tot || "", target: fields.target || "", pkg: fields.pkg || "", callsign: fields.callsign || "", base: fields.base || "",
      notes: fields.notes || "", commitBy: fields.commitBy || "", source: fields.source || "Request form", mizGroup: fields.mizGroup || "",
      requestedBy: by.gid, requestedByUser: by.user, requestedAt: new Date().toISOString(), recipients: [],
      status: fields.crew === "AI" ? "ai" : "open", committedBy: "", committedAt: "", committedByUser: "" };
    d.atoLines.push(l);
    if (l.status === "open") post(l);
    syncToAto(l);
    Store.log(cid, `ATO line ${l.msn} requested: ${l.num}× ${l.airframe} ${l.role} (${l.crew})${l.status === "open" ? ` — posted to ${l.recipients.length} groups` : ""}`, Store.group(by.gid)?.name);
    Store.save();
    return l;
  }

  // Called by the Discord integration when a unit presses Commit. First commit wins.
  function commit(lineId, gid, user) {
    const l = line(lineId);
    if (!l) return { ok: false, error: "unknown_line" };
    if (l.status === "committed") return { ok: false, error: "already_committed", committedBy: l.committedBy };
    if (l.status !== "open") return { ok: false, error: `line_${l.status}` };
    const g = Store.group(gid);
    if (!g || g.status !== "active") return { ok: false, error: "unknown_group" };
    if (!flies(g, l.airframe)) return { ok: false, error: "airframe_mismatch" };
    Object.assign(l, { status: "committed", committedBy: gid, committedAt: new Date().toISOString(), committedByUser: user || g.contact });
    const c = Store.campaign(l.cid);
    if (!c.groups.includes(gid)) c.groups.push(gid); // committing brings the unit into the campaign
    syncToAto(l); closeEvent("ato_line.filled", l);
    Store.log(l.cid, `${g.name} committed to ATO line ${l.msn} (${l.num}× ${l.airframe} ${l.role})`, g.name);
    Store.save();
    return { ok: true, line: l };
  }
  // JFACC actions: cancel an open line, or release a commitment and re-post the line
  function cancel(lineId) { const l = line(lineId); if (!l || l.status === "committed") return false;
    const wasPosted = l.status === "open"; l.status = "cancelled"; syncToAto(l); if (wasPosted) closeEvent("ato_line.cancelled", l); Store.log(l.cid, `ATO line ${l.msn} cancelled`); Store.save(); return true; }
  function release(lineId) { const l = line(lineId); if (!l || l.status !== "committed") return false;
    const was = Store.group(l.committedBy)?.name;
    Object.assign(l, { status: "open", committedBy: "", committedAt: "", committedByUser: "" }); post(l); syncToAto(l);
    Store.log(l.cid, `ATO line ${l.msn} released by the JFACC (was ${was}) and re-posted`); Store.save(); return true; }

  // ---------- .miz reader: a .miz is a zip whose "mission" entry is a Lua table ----------
  function parseLuaTable(src) {
    let i = 0;
    const ws = () => { for (;;) { while (/\s/.test(src[i])) i++; if (src[i] === "-" && src[i + 1] === "-") { while (i < src.length && src[i] !== "\n") i++; } else break; } };
    function str() {
      const q = src[i++]; let out = "";
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") { const n = src[++i]; out += n === "n" ? "\n" : n === "t" ? "\t" : n === "\n" ? "\n" : n; i++; }
        else out += src[i++];
      }
      i++; return out;
    }
    function value() {
      ws(); const ch = src[i];
      if (ch === "{") return table();
      if (ch === '"' || ch === "'") return str();
      const m = /^-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)/i.exec(src.slice(i, i + 40));
      if (m) { i += m[0].length; return Number(m[0]); }
      const w = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 40));
      if (w) { i += w[0].length; return w[0] === "true" ? true : w[0] === "false" ? false : w[0] === "nil" ? null : w[0]; }
      throw new Error(`Unexpected "${ch}" at ${i}`);
    }
    function table() {
      i++; const obj = {}; let n = 1;
      for (;;) {
        ws();
        if (src[i] === "}") { i++; return obj; }
        if (src[i] === "[") { i++; const k = value(); ws(); i++; ws(); i++; obj[k] = value(); }          // [key] = value
        else {
          const save = i, w = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 80));
          if (w) { i += w[0].length; ws(); if (src[i] === "=") { i++; obj[w[0]] = value(); } else { i = save; obj[n++] = value(); } }
          else obj[n++] = value();
        }
        ws(); if (src[i] === "," || src[i] === ";") i++;
      }
    }
    ws(); const name = /^[A-Za-z_]\w*/.exec(src.slice(i))?.[0];
    if (name) { i += name.length; ws(); if (src[i] === "=") i++; }
    return value();
  }
  const arr = t => (t && typeof t === "object" ? Object.keys(t).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => t[k]) : []);

  // flights for one coalition: [{ group, airframe, dcsType, num, crew, role, task, callsign, frequency, start, country }]
  function mizFlights(mission, coalition = "blue") {
    const out = [], countries = arr(mission?.coalition?.[coalition]?.country);
    countries.forEach(ct => ["plane", "helicopter"].forEach(cat => arr(ct?.[cat]?.group).forEach(g => {
      const units = arr(g.units); if (!units.length) return;
      const human = units.some(u => ["Client", "Player"].includes(u.skill));
      const first = units[0], pt = arr(g.route?.points)[0] || {};
      const cs = first.callsign && typeof first.callsign === "object" ? first.callsign.name : first.callsign;
      out.push({ group: g.name, dcsType: first.type, airframe: DCS_AIRFRAMES[first.type] || first.type, num: units.length,
        crew: human ? "Human" : "AI", task: g.task || "", role: TASK_TO_ROLE[g.task] || "", callsign: cs ? String(cs).replace(/(\d)(\d)$/, "$1-$2") : "",
        frequency: g.frequency ? `${(+g.frequency).toFixed(3)}` : "", start: pt.type === "TakeOffParking" || pt.type === "TakeOffParkingHot" ? "Ramp" : pt.type === "TakeOff" ? "Runway" : pt.type ? "Air" : "",
        country: ct.name || "", category: cat });
    })));
    return out;
  }
  async function readMiz(file) {
    if (!window.JSZip) throw new Error("the zip reader didn't load");
    const zip = await JSZip.loadAsync(file), entry = zip.file("mission");
    if (!entry) throw new Error("no 'mission' file inside — is this a DCS .miz?");
    const mission = parseLuaTable(await entry.async("string"));
    return { theatre: mission.theatre || "", date: mission.date ? `${mission.date.Year}-${String(mission.date.Month).padStart(2, "0")}-${String(mission.date.Day).padStart(2, "0")}` : "",
      flights: mizFlights(mission, "blue"), redFlights: mizFlights(mission, "red").length };
  }

  const STATUS = { open: ["Open — awaiting commit", "warn"], committed: ["Committed", "ok"], ai: ["AI — sponsor builds", "off"], cancelled: ["Cancelled", "off"] };

  window.AOC.ATO = { AIRFRAMES, ROLES, STATUS, lines, line, recipients, flies, nextMsn, request, commit, cancel, release, discordPayload, readMiz, parseLuaTable };
})();
