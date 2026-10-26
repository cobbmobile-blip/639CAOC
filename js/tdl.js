// OPTASKLINK, built automatically: the network, JICO, NTR and effective period, everything the host's .miz puts on the
// network (AI AWACS as donors, warships and EWR/GCI as C2, other AI Link 16 aircraft, the F/A-18C setup), then the human
// flights from the ATO whose datalinks are set in the cockpit — F-16C Link 16 STNs, A-10C II SADL TNs, AH-64D IDM nets.
// Every number is deconflicted against the rest. Plan data: tools/jceoi/data/tdl.json.
(function () {
  const { Store, zulu } = window.AOC;
  const D = window.AOC_JCEOI?.tdl;
  if (!D) return;
  const octal = (c, n) => typeof c === "string" && c.length === n && /^[0-7]+$/.test(c);
  const o2 = n => n.toString(8).padStart(2, "0"), o3 = n => n.toString(8).padStart(3, "0"), o5 = n => n.toString(8).padStart(5, "0");
  const reservedStn = s => octal(s, 5) ? D.stn.reserved.find(r => parseInt(s, 8) >= parseInt(r.from, 8) && parseInt(s, 8) <= parseInt(r.to, 8)) || null : null;
  const isViper = t => /F-16/i.test(t || ""), isHog = t => /A-10/i.test(t || ""), isApache = t => /AH-64/i.test(t || "");
  const size = m => Math.min(Math.max(1, parseInt(m.num) || 1), D.stn.maxFlightSize);
  const byMsn = (a, b) => (a.msn + String(a.member).padStart(2, "0")).localeCompare(b.msn + String(b.member).padStart(2, "0"));
  const byStn = (a, b) => String(a.stn ?? "").localeCompare(String(b.stn ?? ""));
  const HORNET_CH = ["AIC", "FF1", "FF2", "VOCA", "VOCB"];

  // ---------- campaign STN blocks (like the IFF Mode 3/A blocks) ----------
  const allBlocks = () => Array.from({ length: 512 }, (_, i) => o3(i)).filter(b => !D.stn.blocksExcluded.includes(b));
  function blocks(cid, ensure) {
    const c = Store.campaign(cid);
    if (c.tdl?.blocks?.length || !ensure) return c.tdl?.blocks || [];
    const taken = new Set(Store.db.campaigns.filter(x => x.id !== cid).flatMap(x => x.tdl?.blocks || []));
    const free = allBlocks().filter(b => !taken.has(b)), n = D.stn.blocksPerCampaignDefault;
    const start = (Store.db.campaigns.findIndex(x => x.id === cid) * 16) % Math.max(1, free.length);
    c.tdl = { ...(c.tdl || {}), blocks: [...free.slice(start), ...free.slice(0, start)].slice(0, n) };
    Store.save(); return c.tdl.blocks;
  }
  // the campaign's network moniker (also the JICO callsign): picked once, never another campaign's
  function moniker(cid) {
    const c = Store.campaign(cid); if (c.tdl?.moniker) return c.tdl.moniker;
    const taken = new Set(Store.db.campaigns.filter(x => x.id !== cid).map(x => x.tdl?.moniker)), w = D.monikers;
    const h = [...cid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const pick = w.map((_, i) => w[(h + i) % w.length]).find(x => !taken.has(x)) || `${w[h % w.length]} ${Store.db.campaigns.length}`;
    c.tdl = { ...(c.tdl || {}), moniker: pick }; Store.save(); return pick;
  }
  // effective period: the ATO day (0300Z–0259Z) holding the mission's vul time — the .miz start, else the campaign's next event
  function period(cid, mf) {
    const c = Store.campaign(cid), t = window.AOC.MIZ?.startUtc(mf) || new Date(c.nextEvent || `${c.dday}T${c.firstMissionTime || "20:00:00Z"}`);
    if (!isFinite(t)) return "";
    const day = 864e5, off = D.atoDayStartZ * 36e5, s = Math.floor((t - off) / day) * day + off;
    return `${zulu(new Date(s))} – ${zulu(new Date(s + day - 6e4))}`;
  }
  // voice callsign as DCS shows it: 2 letters (first + last of the callsign word) + flight and member number
  function voiceFor(callsign, member) {
    const m = String(callsign || "").toUpperCase().match(/^([A-Z]+)\s*(\d)?/); if (!m || m[1] === "TBD") return "";
    return `${m[1][0]}${m[1].at(-1)}${m[2] || 1}${member}`;
  }

  // the host's mission file, as the network sees it: a snapshot, so the released document reads on its own
  function pull(mf) {
    const t = (mf.tdl || []).filter(x => x.side === "blue"), l16 = t.filter(x => x.link === "Link16");
    const name = id => { const u = t.find(x => x.unitId === id); return u ? u.callsign || u.unit : `unit ${id}`; };
    // warships and radars have no STN in the Mission Editor: give them notional C2 STNs clear of everything in the file
    const used = new Set(l16.map(x => x.stn).filter(Boolean)); let n = parseInt(D.stn.reserved.find(r => r.from === "00001").from, 8);
    const nextC2 = () => { while (used.has(o5(n))) n++; used.add(o5(n)); return o5(n); };
    const c2 = [...t.filter(x => x.awacs).map(x => ({ callsign: x.callsign || x.unit, type: x.type, role: "AWACS — donor", stn: x.stn || nextC2(), voice: x.voice, unitId: x.unitId }))];
    t.filter(x => x.link === "C2").forEach(x => { if (!c2.some(y => y.callsign === x.callsign && y.role === x.role)) c2.push({ callsign: x.callsign, type: x.type, role: x.role, stn: nextC2(), voice: "", unitId: x.unitId }); });
    return {
      from: `${mf.name} v${mf.v}`, when: new Date().toISOString(), c2,
      // AI aircraft the host gave an STN (fighters, tankers, bombers); client F-16C slots are set in the cockpit instead
      ai: l16.filter(x => x.ai && !x.awacs && x.type !== "FA-18C_hornet" && x.stn).map(x => ({ callsign: x.callsign || x.unit, type: x.type, stn: x.stn, voice: x.voice })).sort(byStn),
      hornet: l16.filter(x => x.type === "FA-18C_hornet").map(x => ({ unitId: x.unitId, group: x.group, unit: x.unit, callsign: x.callsign, voice: x.voice, stn: x.stn, ai: x.ai,
        ch: HORNET_CH.map(k => x.settings?.[`${k}_Channel`] ?? "").join("/"), team: x.team.map(name), teamIds: x.team, donors: x.donors.map(name), donorIds: x.donors })).sort(byStn),
      units: t.filter(x => x.link !== "C2").map(x => ({ unitId: x.unitId, type: x.type, callsign: x.callsign }))
    };
  }
  // the F/A-18C Link 16 channels the host already set (the most common set), else the defaults
  function hornetChannels(m) {
    const counts = {}; (m?.hornet || []).forEach(h => { if (h.ch.split("/").every(Boolean)) counts[h.ch] = (counts[h.ch] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || HORNET_CH.map(k => D.defaults.hornet[`${k}_Channel`]).join("/");
  }
  const mizStns = m => m ? [...m.c2, ...m.ai, ...m.hornet].map(r => r.stn).filter(Boolean) : [];

  // human flights from the ATO, set in the cockpit. A line keeps its numbers while its callsign and size are unchanged
  // and none of them collides with the mission file; otherwise (or with all) it is assigned afresh.
  function assign(cid, d, missions, { all = false } = {}) {
    const taken = new Set(mizStns(d.miz));
    const live = (rows, key) => all ? [] : (rows || []).filter(r => { const m = missions.find(x => x.msn === r.msn), mine = rows.filter(x => x.msn === r.msn);
      return m && (m.callsign || "") === r.callsign && size(m) === mine.length && !mine.some(x => key && taken.has(x[key])); });
    // F-16C: one STN slot of 8 per flight (lead BBBS1), never a slot holding a mission file STN
    const viper = live(d.viper, "stn"), usedSlots = new Set([...viper.map(r => r.stn), ...taken].map(s => s?.slice(0, 4)));
    const slots = blocks(cid, true).flatMap(b => Array.from({ length: D.stn.slotsPerBlock }, (_, i) => `${b}${i + 1}`)).filter(s => !usedSlots.has(s));
    missions.filter(m => isViper(m.type) && !viper.some(r => r.msn === m.msn)).forEach(m => {
      const slot = slots.shift(); if (!slot) return;
      for (let i = 1; i <= size(m); i++) viper.push({ msn: m.msn, callsign: m.callsign || "", member: String(i), stn: o5(parseInt(`${slot}0`, 8) + i), voice: voiceFor(m.callsign, i), lead: i === 1 ? "yes" : "" });
    });
    // A-10C II SADL: TN 0FFM — FF = the flight's number in the campaign (octal), M = member
    const sadl = live(d.sadl), usedF = new Set(sadl.map(r => r.tn?.slice(1, 3)));
    let f = 1; const nextF = () => { while (usedF.has(o2(f))) f++; usedF.add(o2(f)); return o2(f); };
    missions.filter(m => isHog(m.type) && !sadl.some(r => r.msn === m.msn)).forEach(m => {
      const ff = nextF();
      for (let i = 1; i <= size(m); i++) sadl.push({ msn: m.msn, callsign: m.callsign || "", member: String(i), tn: `0${ff}${i}`, voice: voiceFor(m.callsign, i), lead: i === 1 ? "yes" : "" });
    });
    // AH-64D IDM: each flight on its own net (preset), every Apache on the common net; originator IDs run across the campaign
    const idm = live(d.idm), usedIds = new Set(idm.map(r => +r.id)), usedP = new Set(idm.map(r => +r.preset));
    let id = 1, p = 1; const nextId = () => { while (usedIds.has(id)) id++; usedIds.add(id); return id; };
    const nextP = () => { while (usedP.has(p) || p === D.idm.commonPreset) p++; usedP.add(p); return p; };
    missions.filter(m => isApache(m.type) && !idm.some(r => r.msn === m.msn)).forEach(m => {
      const preset = nextP(), net = String(m.callsign || m.msn).toUpperCase();
      for (let i = 1; i <= size(m); i++) idm.push({ msn: m.msn, callsign: m.callsign || "", member: String(i), id: String(nextId()), preset: String(preset), net, common: String(D.idm.commonPreset) });
    });
    return { viper: viper.sort(byMsn), sadl: sadl.sort(byMsn), idm: idm.sort(byMsn) };
  }

  // the whole plan from the ATO and the latest mission file; staff only add notes
  function build(cid, d = {}, { all = false } = {}) {
    const c = Store.campaign(cid), mf = window.AOC.MIZ?.current(cid), nevada = window.AOC.JCEOI?.theaterKey(c.theater) === "Nevada";
    const miz = mf?.tdl ? pull(mf) : d.miz || null;
    if (miz && d.miz && miz.from === d.miz.from) miz.when = d.miz.when;     // same file: keep the read time so nothing looks changed
    const word = moniker(cid), aew = (Store.content(cid, "ato")?.missions || []).find(m => m.role === "AEW");
    const awacs = miz?.c2.find(r => r.role.startsWith("AWACS"));
    const hornet = hornetChannels(miz).split("/");
    const out = { ...d, miz, period: period(cid, mf), network: `${word} LINK`, jico: nevada ? "JUICE" : word, jicoVoice: nevada ? "231.100" : (c2 => c2 ? `${c2.id} ${c2.freq}` : "")(window.AOC.COMM?.findChannel(Store.content(cid, "acp")?.matrix, "c2")),
      ntr: awacs ? `${awacs.callsign} (AWACS)` : aew ? `${aew.msn} ${aew.callsign}` : `${nevada ? "JUICE" : word} (JICO)`,
      ...Object.fromEntries(HORNET_CH.map((k, i) => [`h${k}`, hornet[i]])),
      vMission: String(D.defaults.viper.missionChannel), vFighter: String(D.defaults.viper.fighterChannel), vSpecial: String(D.defaults.viper.specialChannel),
      sadlAir: String(D.defaults.sadl.AirKey), sadlGateway: String(D.defaults.sadl.GatewayKey) };
    delete out.c2;
    return Object.assign(out, assign(cid, out, Store.content(cid, "ato")?.missions || [], { all }));
  }

  // ---------- checks ----------
  function check(cid, d) {
    const out = [], add = (sev, text) => out.push({ sev, text }), m = d.miz;
    const hornetPlan = hornetChannels(m);
    // Link 16: every STN on the network must be valid and unique
    const stns = [...(m?.c2 || []).map(r => ({ stn: r.stn, who: `${r.role.split(" ")[0]} ${r.callsign}`, c2: true })), ...(m?.ai || []).map(r => ({ stn: r.stn, who: `AI ${r.type} ${r.callsign}` })),
      ...(m?.hornet || []).map(r => ({ stn: r.stn, who: `F/A-18C ${r.callsign || r.unit}` })), ...(d.viper || []).map(r => ({ stn: r.stn, who: `F-16C ${r.msn} #${r.member} ${r.callsign}`, viper: true }))];
    const bl = blocks(cid), seen = {};
    const none = stns.filter(x => !x.stn).map(x => x.who);
    if (none.length) add("warn", `${none.length} on the network ha${none.length === 1 ? "s" : "ve"} no STN set in the Mission Editor: ${none.join(", ")}.`);
    stns.filter(x => x.stn).forEach(({ stn, who, c2, viper }) => {
      if (!octal(stn, 5)) { add("error", `${who}: STN ${stn} is not 5 octal digits.`); return; }
      const r = reservedStn(stn);
      if (r && !(c2 && r.from === "00001")) add("error", `${who}: STN ${stn} is reserved (${r.use}).`);
      if (viper && bl.length && !bl.includes(stn.slice(0, 3))) add("warn", `${who}: STN ${stn} is outside the campaign's blocks (${bl.join(", ")}).`);
      (seen[stn] = seen[stn] || []).push(who);
    });
    Object.entries(seen).filter(([, w]) => w.length > 1).forEach(([s, w]) => add("error", `STN ${s} is used by ${w.join("; ")} — duplicate STNs break the link for both.`));
    Store.db.campaigns.filter(x => x.id !== cid).forEach(x => { const o = Store.content(x.id, "optasklink"), theirs = new Set((o?.viper || []).map(r => r.stn));
      stns.filter(s => s.viper && theirs.has(s.stn)).forEach(s => add("error", `${s.who}: STN ${s.stn} is also used by OP ${x.opName}.`)); });
    // what the host set in the Mission Editor
    if (m) {
      const ids = new Set((m.units || []).map(u => u.unitId)), awx = m.c2.filter(r => r.role.startsWith("AWACS"));
      m.hornet.forEach(r => {
        if (r.ch !== hornetPlan) add("warn", `F/A-18C ${r.callsign || r.unit}: Link 16 channels AIC/FF1/FF2/VOCA/VOCB ${r.ch} differ from the rest (${hornetPlan}).`);
        r.teamIds.concat(r.donorIds).filter(id => !ids.has(id)).forEach(id => add("warn", `F/A-18C ${r.callsign || r.unit}: team member / donor unit ${id} is not a datalink aircraft in the mission.`));
      });
      awx.forEach(a => { const no = m.hornet.filter(r => !r.donorIds.includes(a.unitId)).map(r => r.callsign || r.unit);
        if (no.length) add("warn", `AWACS ${a.callsign} is not a Link 16 donor on ${no.length === m.hornet.length ? "any" : no.length} F/A-18C${no.length === m.hornet.length ? "" : ` (${no.join(", ")})`} — the host sets donors in the Mission Editor.`); });
    } else add("info", "No host mission file yet — the plan has only the ATO's human flights.");
    // A-10C II SADL and AH-64D IDM
    const tns = {};
    (d.sadl || []).forEach(r => { if (!octal(r.tn, 4)) add("error", `A-10C ${r.msn} #${r.member}: SADL TN ${r.tn || "missing"} is not 4 octal digits.`); else (tns[r.tn] = tns[r.tn] || []).push(`${r.msn} #${r.member}`); });
    Object.entries(tns).filter(([, w]) => w.length > 1).forEach(([t, w]) => add("error", `SADL TN ${t} is used by ${w.join("; ")}.`));
    const nets = {};
    (d.idm || []).forEach(r => [r.preset, r.common].forEach(pr => { if (+pr < 1 || +pr > D.idm.presets) add("error", `AH-64D ${r.msn} #${r.member}: IDM preset ${pr} is outside 1–${D.idm.presets}.`); (nets[pr] = nets[pr] || []).push(r); }));
    Object.entries(nets).forEach(([pr, ms]) => { const c = {}; ms.forEach(x => (c[x.id] = c[x.id] || []).push(`${x.msn} #${x.member}`));
      Object.entries(c).filter(([, w]) => w.length > 1).forEach(([i, w]) => add("error", `IDM preset ${pr}: originator ID ${i} is used by ${w.join("; ")}.`)); });
    const order = { error: 0, warn: 1, info: 2 };
    return [...new Map(out.map(f => [f.text, f])).values()].sort((a, b) => order[a.sev] - order[b.sev]);
  }

  window.AOC.TDL = { data: D, octal, reservedStn, blocks, allBlocks, moniker, period, voiceFor, pull, assign, build, check, isViper, isHog, isApache };
})();
