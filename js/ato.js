// ATO lines: the campaign's Group JFACC/LNO (the host) creates lines (from their .miz or by hand). A Human line starts as a
// draft the host can edit or remove; "Post to Discord" (postLine) puts it on the ATO and posts it to every registered group
// flying that airframe; a unit's Commit (from the Discord button) comes back through commit() and fills the line.
// Line requests: any other participating squadron asks the host for a line (same questions). The host is notified
// (Discord post with Approve / Deny, and on the site); an approved request becomes a line assigned to that squadron.
(function () {
  const { Store } = window.AOC;

  // ---------- airframes ----------
  // DCS unit type (as written in a .miz) -> the airframe name groups register with
  const DCS_AIRFRAMES = {
    "F-15ESE": "F-15E", "F-15C": "F-15C", "FA-18C_hornet": "F/A-18C", "F-16C_50": "F-16C", "A-10C_2": "A-10C II", "A-10C": "A-10C",
    "F-14B": "F-14B", "F-14A-135-GR": "F-14A", "AV8BNA": "AV-8B", "M-2000C": "M-2000C", "JF-17": "JF-17", "F-5E-3": "F-5E",
    "AH-64D_BLK_II": "AH-64D", "UH-1H": "UH-1H", "Ka-50_3": "Ka-50", "Ka-50": "Ka-50", "Mi-24P": "Mi-24P", "Mi-8MT": "Mi-8",
    "CH-47Fbl1": "CH-47F", "UH-60L": "MH-60L", "UH-60L_DAP": "MH-60L DAP",   // UH-60L mod, flown as the MH-60L
    "KC-135": "KC-135", "KC135MPRS": "KC-135 MPRS", "KC130": "KC-130J", "S-3B Tanker": "S-3B Tanker",
    "E-3A": "E-3A", "E-2C": "E-2C", "C-130": "C-130", "MQ-9 Reaper": "MQ-9"
  };
  const AIRFRAMES = [...new Set(Object.values(DCS_AIRFRAMES))].sort();
  // the mission sets human crews fly (and squadrons list in their RTM). OCA includes escort and sweep; SEAD and DEAD are one
  // set; pre-planned attack is INT (against a JIPTL target), on-call XINT -- there is no separate "Strike"
  const ROLES = ["DCA", "OCA", "SEAD/DEAD", "INT", "XINT", "CAS", "XCAS", "SCAR", "CSAR", "Airlift"];
  // roles no DCS module flies: AI lines only (tankers, AWACS, ISR drones); a line with one of them is always an AI line
  const AI_ROLES = ["AR", "AEW", "ISR"];
  const isAiRole = role => AI_ROLES.includes(role);
  // Controller positions: C2, JTAC and ATC squadrons commit to ATO lines like flying units (the same Discord post and
  // first-commit-wins), but there is no aircraft. The line's "airframe" is the position and its mission the controller role;
  // a position line has no IFF / SIF, no datalink, no .miz group and (until DKS has a place for it) no DKS flight.
  const POSITIONS = { "C2": ["GCI", "AWACS ABM", "TAC C2"], "JTAC": ["JTAC"], "ATC": ["Tower", "Approach", "Ground"] };
  const isPosition = airframe => Object.prototype.hasOwnProperty.call(POSITIONS, String(airframe || "").trim().toUpperCase());
  const rolesFor = airframe => POSITIONS[String(airframe || "").trim().toUpperCase()] || ROLES;
  const POSITION_ROLES = [...new Set(Object.values(POSITIONS).flat())];
  // DCS group task -> ATO mission type
  const TASK_TO_ROLE = { "CAP": "DCA", "Intercept": "DCA", "Fighter Sweep": "OCA", "Escort": "OCA", "SEAD": "SEAD/DEAD", "CAS": "CAS",
    "Ground Attack": "INT", "Runway Attack": "INT", "Pinpoint Strike": "INT", "Antiship Strike": "INT",
    "Refueling": "AR", "AWACS": "AEW", "Reconnaissance": "ISR", "Transport": "Airlift", "AFAC": "SCAR" };
  const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // groups registered with an airframe ("F-16C" matches "F-16C", "F-16C, F/A-18C" …); compares letters/digits only
  function flies(group, airframe) {
    return String(group.airframes || "").split(/[,;]| and /).map(norm).filter(Boolean).some(a => a === norm(airframe));
  }
  // Squadron Expectations v0.2: a squadron joins Pending (Board vote), flies on Probation until three uneventful missions,
  // then is Active; Removed squadrons get nothing. Lines go only to squadrons whose RTM (readiness training memorandum:
  // mission types per airframe) lists the line's airframe and mission type; a squadron with no RTM gets none.
  const SQN_STATUS = { pending: "Pending Board vote", probation: "On probation", active: "Active", removed: "Removed" };
  const CAN_FLY = ["active", "probation"];
  const rtmFor = (g, airframe) => { const r = g.rtm || {}, k = Object.keys(r).find(a => norm(a) === norm(airframe)); return k ? r[k] : []; };
  const covers = (g, airframe, role) => !role || rtmFor(g, airframe).includes(role);
  const recipients = (airframe, role) => Store.db.groups.filter(g => CAN_FLY.includes(g.status) && flies(g, airframe) && covers(g, airframe, role));
  // uneventful missions: debriefed ATO days where every line the squadron flew for was flown, and nobody flagged it
  function missionsFlown(gid) {
    const out = [];
    Store.db.campaigns.forEach(c => Object.entries(c.debriefs || {}).forEach(([day, d]) => {
      const ato = Store.shared(c.id, "ato")?.data?.missions || Store.content(c.id, "ato")?.missions || [];
      const mine = (d.misreps || []).filter(r => r.group === gid || ato.some(m => m.msn === r.msn && m.group === gid) || lines(c.id).some(l => l.msn === r.msn && l.committedBy === gid));
      if (!mine.length) return;
      const key = `${c.id}/${day}`, flagged = (Store.group(gid)?.flagged || []).includes(key);
      out.push({ key, cid: c.id, op: c.opName, day: +day, lines: mine.map(r => r.msn), flown: mine.every(r => r.flown === "Yes"), flagged,
        uneventful: mine.every(r => r.flown === "Yes") && !flagged });
    }));
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }
  const uneventful = gid => missionsFlown(gid).filter(m => m.uneventful).length;
  // three uneventful missions on probation: Active, and the LNO takes a Board seat
  function promote(gid) {
    const g = Store.group(gid); if (!g || g.status !== "probation" || uneventful(gid) < 3) return false;
    g.status = "active"; g.boardSeat = true; Store.save();
    Store.log("_squadrons", `${g.name}: three uneventful missions — Active; LNO ${g.lno?.callsign || g.contact} takes a Board seat`);
    return true;
  }
  function setStatus(gid, status, note, by) {
    const g = Store.group(gid); if (!g || !SQN_STATUS[status]) return;
    const was = g.status; g.status = status; if (status !== "active") g.boardSeat = false; if (status === "active") g.boardSeat = true;
    (g.board = g.board || []).unshift({ when: new Date().toISOString(), from: was, to: status, note: note || "", by: by || "" }); Store.save();
    Store.log("_squadrons", `${g.name}: ${SQN_STATUS[was] || was} → ${SQN_STATUS[status]}${note ? ` (${note})` : ""}`, by);
  }

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
      if (l.status === "cancelled" || l.status === "draft") { if (i >= 0) list.splice(i, 1); return; }
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
      line_id: l.id, campaign_id: l.cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay), msn: l.msn,
      kind: isPosition(l.airframe) ? "position" : "flight", airframe: l.airframe, aircraft: l.num, mission: l.role, crew: l.crew, tot: l.tot || null, target: l.target || null,
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
    l.recipients = recipients(l.airframe, l.role).map(g => g.id);
    l.postedAt = new Date().toISOString();
    emit(discordPayload(l));
  }
  // filled / cancelled: the bot edits every copy of the post (shows who filled it, disables Commit)
  const closeEvent = (event, l) => emit({ event, line_id: l.id, msn: l.msn,
    filled_by: l.committedBy ? { group_id: l.committedBy, group: Store.group(l.committedBy)?.name, user: l.committedByUser } : null,
    recipients: l.recipients.map(id => ({ group_id: id })) });

  // JFACC/LNO request -> ATO line. Human lines are posted for commitment; AI lines go straight on the ATO.
  function request(cid, fields, by, { assignTo } = {}) {
    const d = Store.db; d.atoLines = d.atoLines || [];
    if (isAiRole(fields.role)) fields = { ...fields, crew: "AI" };   // no DCS module flies it
    const l = { id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cid, msn: fields.msn || nextMsn(cid),
      airframe: fields.airframe, num: +fields.num || 2, role: fields.role, crew: fields.crew === "AI" ? "AI" : "Human",
      tot: fields.tot || "", target: fields.target || "", pkg: fields.pkg || "", callsign: fields.callsign || "", base: fields.base || "",
      notes: fields.notes || "", commitBy: fields.commitBy || "", source: fields.source || "Request form", mizGroup: fields.mizGroup || "",
      requestedBy: by.gid, requestedByUser: by.user, requestedAt: new Date().toISOString(), recipients: [],
      status: fields.crew === "AI" ? "ai" : "draft", committedBy: "", committedAt: "", committedByUser: "" };
    if (assignTo && l.status === "draft") Object.assign(l, { status: "committed", committedBy: assignTo.gid, committedAt: l.requestedAt, committedByUser: assignTo.user || "" });
    d.atoLines.push(l);
    syncToAto(l);
    Store.log(cid, `ATO line ${l.msn} created: ${l.num}× ${l.airframe} ${l.role} (${l.crew})${l.status === "draft" ? " — draft, not posted" : l.status === "committed" ? ` — assigned to ${Store.group(l.committedBy)?.name}` : ""}`, Store.group(by.gid)?.name);
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
  // the host posts a draft: it goes on the ATO and out to every registered group flying the airframe
  function postLine(lineId) {
    const l = line(lineId); if (!l || l.status !== "draft") return false;
    l.status = "open"; post(l); syncToAto(l);
    Store.log(l.cid, `ATO line ${l.msn} posted to ${l.recipients.length} groups`); Store.save(); return true;
  }
  // the host edits a line that has not gone out yet (a draft) or an AI line; posted and committed lines are fixed
  function update(lineId, fields) {
    const l = line(lineId); if (!l || !["draft", "ai"].includes(l.status)) return false;
    ["airframe", "role", "tot", "target", "pkg", "callsign", "base", "notes", "commitBy"].forEach(k => { if (k in fields) l[k] = String(fields[k] ?? "").trim(); });
    if ("num" in fields) l.num = +fields.num || l.num;
    if ("crew" in fields) { l.crew = fields.crew === "AI" ? "AI" : "Human"; l.status = l.crew === "AI" ? "ai" : "draft"; }
    syncToAto(l); Store.log(l.cid, `ATO line ${l.msn} edited`); Store.save(); return true;
  }
  // JFACC actions: remove a draft / cancel an open or AI line, or release a commitment and re-post the line
  function cancel(lineId) { const l = line(lineId); if (!l || l.status === "committed") return false;
    const wasPosted = l.status === "open"; l.status = "cancelled"; syncToAto(l); if (wasPosted) closeEvent("ato_line.cancelled", l); Store.log(l.cid, `ATO line ${l.msn} cancelled`); Store.save(); return true; }
  function release(lineId) { const l = line(lineId); if (!l || l.status !== "committed") return false;
    const was = Store.group(l.committedBy)?.name;
    Object.assign(l, { status: "open", committedBy: "", committedAt: "", committedByUser: "" }); post(l); syncToAto(l);
    Store.log(l.cid, `ATO line ${l.msn} released by the JFACC (was ${was}) and re-posted`); Store.save(); return true; }

  // ---------- line requests from squadrons (db.lineRequests): pending -> approved (a line) | denied ----------
  const FIELDS = ["airframe", "num", "role", "crew", "tot", "target", "pkg", "callsign", "base", "commitBy", "notes"];
  const lineRequests = cid => (Store.db.lineRequests || []).filter(r => !cid || r.cid === cid);
  const lineRequest = id => (Store.db.lineRequests || []).find(r => r.id === id);
  function requestPayload(r) {
    const c = Store.campaign(r.cid), host = c.jfacc?.group;
    return { event: "ato_line.requested", request_id: r.id, campaign_id: r.cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay),
      requested_by: { group_id: r.gid, group: Store.group(r.gid)?.name, user: r.user }, ...Object.fromEntries(FIELDS.map(k => [k === "num" ? "aircraft" : k === "role" ? "mission" : k === "commitBy" ? "commit_by" : k, r.fields[k] || null])),
      recipients: [{ group_id: host, group: Store.group(host)?.name, host: true }],
      components: [{ type: "button", label: "Approve", style: "success", custom_id: `ato_req_approve:${r.id}` }, { type: "button", label: "Deny", style: "danger", custom_id: `ato_req_deny:${r.id}` }] };
  }
  // a participating squadron asks the host for a line
  function askLine(cid, fields, by) {
    const d = Store.db; d.lineRequests = d.lineRequests || [];
    const r = { id: "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cid, gid: by.gid, user: by.user || "",
      fields: Object.fromEntries(FIELDS.map(k => [k, String(fields[k] ?? "").trim()])), status: "pending", at: new Date().toISOString(),
      decidedAt: "", decidedBy: "", reason: "", lineId: "" };
    d.lineRequests.push(r); emit(requestPayload(r));
    Store.log(cid, `${Store.group(by.gid)?.name} requested an ATO line: ${r.fields.num}× ${r.fields.airframe} ${r.fields.role} — waiting for the host`, Store.group(by.gid)?.name);
    Store.save(); return r;
  }
  // the host's decision (site buttons, or the Discord Approve / Deny buttons through the same call)
  function decide(id, approve, by = {}, reason = "") {
    const r = lineRequest(id);
    if (!r) return { ok: false, error: "unknown_request" };
    if (r.status !== "pending") return { ok: false, error: `request_${r.status}` };
    const c = Store.campaign(r.cid), host = c.jfacc?.group, g = Store.group(r.gid);
    Object.assign(r, { status: approve ? "approved" : "denied", decidedAt: new Date().toISOString(), decidedBy: by.user || c.jfacc?.callsign || "", reason: reason.trim() });
    if (approve) {
      const l = request(r.cid, { ...r.fields, source: `Request from ${g?.name}` }, { gid: host, user: r.decidedBy }, { assignTo: { gid: r.gid, user: r.user } });
      r.lineId = l.id; if (!c.groups.includes(r.gid)) c.groups.push(r.gid);
    }
    emit({ event: "ato_line.request_decided", request_id: r.id, campaign_id: r.cid, approved: approve, reason: r.reason || null,
      msn: approve ? line(r.lineId).msn : null, decided_by: r.decidedBy, recipients: [{ group_id: r.gid, group: g?.name }] });
    Store.log(r.cid, `Host ${approve ? "approved" : "denied"} ${g?.name}'s line request (${r.fields.num}× ${r.fields.airframe} ${r.fields.role})${approve ? ` — line ${line(r.lineId).msn}` : r.reason ? `: ${r.reason}` : ""}`, Store.group(host)?.name);
    Store.save(); return { ok: true, request: r };
  }

  // the line questions, shared by the host's Create an ATO Line form and a squadron's Request a Line form
  function lineFormHtml({ id, submit, targetsList = "targets", defaults = {} }) {
    const esc = window.AOC.esc, v = k => esc(defaults[k] ?? ""), opt = (list, cur) => list.map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
    return `<form id="${id}">
      <div class="row2"><div class="field"><label>Airframe / position</label><select name="airframe" onchange="AOC.ATO.syncRoles(this)">${opt(AIRFRAMES, defaults.airframe || "F-15E")}
          <optgroup label="Controller positions">${opt(Object.keys(POSITIONS), defaults.airframe)}</optgroup></select></div>
        <div class="field"><label data-numlbl>${isPosition(defaults.airframe) ? "Controllers" : "Aircraft"}</label><select name="num">${opt(["1", "2", "3", "4"], defaults.num || (isPosition(defaults.airframe) ? "1" : "4"))}</select></div></div>
      <div class="row2"><div class="field"><label>Mission</label><select name="role">${opt(rolesFor(defaults.airframe), defaults.role || (isPosition(defaults.airframe) ? rolesFor(defaults.airframe)[0] : "INT"))}${isPosition(defaults.airframe) ? "" : `<optgroup label="AI only">${opt(AI_ROLES, defaults.role)}</optgroup>`}</select></div>
        <div class="field"><label>Crew</label><select name="crew">${opt(["Human", "AI"], defaults.crew || "Human")}</select></div></div>
      <div class="row2"><div class="field"><label>TOT / on-station</label><input name="tot" value="${v("tot")}" placeholder="e.g. 0720Z or 0600–1000Z"></div>
        <div class="field"><label>Target / area</label><input name="target" value="${v("target")}" list="${targetsList}" placeholder="JIPTL # or area"></div></div>
      <div class="row2"><div class="field"><label>Package</label><input name="pkg" value="${v("pkg")}" placeholder="e.g. A"></div>
        <div class="field"><label>Callsign (if set)</label><input name="callsign" value="${v("callsign")}" placeholder="from your .miz"></div></div>
      <div class="row2"><div class="field"><label>Base / start</label><input name="base" value="${v("base")}" placeholder="e.g. Kobuleti, ramp"></div>
        <div class="field"><label>Commit by</label><input name="commitBy" value="${v("commitBy")}" placeholder="e.g. 211800Z OCT 26"></div></div>
      <div class="field"><label>Notes</label><textarea name="notes" style="min-height:56px">${v("notes")}</textarea></div>
      <div class="rcpt" id="${id}Rcpt"></div>
      <button class="btn primary" type="submit" style="margin-top:10px">${esc(submit)}</button></form>`;
  }

  // the line form: a controller position offers its own roles, and counts controllers, not aircraft
  function syncRoles(sel) {
    const f = sel.form, role = f.elements.role, cur = role.value, list = rolesFor(sel.value), esc = window.AOC.esc;
    role.innerHTML = list.map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("")
      + (isPosition(sel.value) ? "" : `<optgroup label="AI only">${AI_ROLES.map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("")}</optgroup>`);
    const lbl = f.querySelector("[data-numlbl]"); if (lbl) lbl.textContent = isPosition(sel.value) ? "Controllers" : "Aircraft";
    if (isPosition(sel.value)) { f.elements.num.value = "1"; if (f.elements.crew) f.elements.crew.value = "Human"; }   // controllers are players
    sel.dispatchEvent(new CustomEvent("rolesync", { bubbles: true }));
  }

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

  const STATUS = { draft: ["Draft — not posted", "off"], open: ["Open — awaiting commit", "warn"], committed: ["Committed", "ok"], ai: ["AI — sponsor builds", "off"], cancelled: ["Cancelled", "off"] };

  window.AOC.ATO = { AIRFRAMES, ROLES, AI_ROLES, isAiRole, POSITIONS, POSITION_ROLES, isPosition, rolesFor, syncRoles, STATUS, SQN_STATUS, CAN_FLY, rtmFor, covers, missionsFlown, uneventful, promote, setStatus, lines, line, recipients, flies, nextMsn, request, postLine, update, commit, cancel, release, discordPayload,
    lineRequests, lineRequest, askLine, decide, requestPayload, lineFormHtml, readMiz, mizFlights, parseLuaTable };
})();
