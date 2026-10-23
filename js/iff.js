// IFF / SIF code plan: reserved codes, Mode 1 by mission type, Mode 3/A campaign blocks assigned per ATO line (lead +
// last-member code), optional Mode 2 per airframe, and the checks. Plan data comes from the JCEOI (tools/jceoi/data/iff.json).
(function () {
  const { Store } = window.AOC;
  const D = window.AOC_JCEOI?.iff;
  if (!D) return;
  const octal = (c, n) => typeof c === "string" && c.length === n && /^[0-7]+$/.test(c);
  const o2 = n => n.toString(8).padStart(2, "0"), o4 = n => n.toString(8).padStart(4, "0");
  const reservedHit = code => octal(code, 4) ? D.reserved.find(r => parseInt(code, 8) >= parseInt(r.from, 8) && parseInt(code, 8) <= parseInt(r.to, 8)) || null : null;
  const m1Table = Object.fromEntries(D.mode1.families.flatMap(f => f.codes.map(([c, role]) => [role, c])));
  // the CAOC's own scheme; rotation shifts the sub-role digit with the ATO day, like codes that change each ATO period
  function mode1For(role, atoDay, rotate) {
    const c = m1Table[role]; if (!c) return "";
    return rotate ? `${c[0]}${(+c[1] + (+atoDay || 0)) % 4}` : c;
  }
  const flightSize = m => Math.max(1, parseInt(m.num) || 1);
  const theaterRules = key => D.theaterRules?.[key]?.rules || [];

  // ---------- campaign blocks ----------
  const allBlocks = () => Array.from({ length: 64 }, (_, i) => o2(i)).filter(b => !D.blocksExcluded.blocks.includes(b));
  function settings(cid) { const c = Store.campaign(cid); return c.iff || {}; }
  // the campaign's Mode 3/A blocks; a campaign without any takes the next free ones (never another campaign's)
  function blocks(cid, ensure) {
    const c = Store.campaign(cid);
    if (c.iff?.blocks?.length || !ensure) return c.iff?.blocks || [];
    const taken = new Set(Store.db.campaigns.filter(x => x.id !== cid).flatMap(x => x.iff?.blocks || []));
    const free = allBlocks().filter(b => !taken.has(b)), n = D.mode3.blocksPerCampaignDefault;
    // spread campaigns across the code space: start at a different block for each campaign
    const start = (Store.db.campaigns.findIndex(x => x.id === cid) * 8) % Math.max(1, free.length);
    c.iff = { ...(c.iff || {}), blocks: [...free.slice(start), ...free.slice(0, start)].slice(0, n) };
    Store.save(); return c.iff.blocks;
  }
  // every lead..last code a line takes
  const span = m => { if (!octal(m.m3, 4)) return []; const a = parseInt(m.m3, 8); return Array.from({ length: flightSize(m) }, (_, i) => o4(a + i)); };
  const slotOf = code => code.slice(0, 3);   // BBC

  // fill the IFF codes of lines that have none (all = reassign every line)
  function assign(cid, missions, { all = false } = {}) {
    const c = Store.campaign(cid), s = settings(cid), bl = blocks(cid, true);
    const used = new Set(missions.filter(m => !all && m.m3).map(m => slotOf(m.m3)));
    const slots = bl.flatMap(b => Array.from({ length: D.mode3.slotsPerBlock }, (_, i) => `${b}${i + 1}`)).filter(x => !used.has(x));
    let n = 0;
    missions.forEach(m => {
      if (all || !m.m1) { const v = mode1For(m.role, c.atoDay, s.rotateMode1); if (v) m.m1 = v; }
      if (all || !m.m3) {
        const slot = slots.shift();
        if (!slot) return;
        m.m3 = `${slot}1`; m.m3last = flightSize(m) > 1 ? o4(parseInt(m.m3, 8) + flightSize(m) - 1) : ""; n++;
      }
      if (s.mode2 && (all || !m.m2)) {
        const gi = Store.db.groups.findIndex(g => g.id === m.group);
        if (gi >= 0) m.m2 = `${o2(gi + 1)}01${flightSize(m) > 1 ? `–${o2(gi + 1)}${o2(flightSize(m))}` : ""}`;
      }
    });
    return n;
  }

  // ---------- checks ----------
  function check(cid, missions, theater) {
    const out = [], add = (sev, msn, text) => out.push({ sev, msn, text });
    const bl = blocks(cid), seen = {};
    missions.forEach(m => {
      const id = m.msn || "?";
      if (m.m1) {
        if (!octal(m.m1, 2) || !"0123".includes(m.m1[1])) add("error", id, `Mode 1 ${m.m1} is not valid (2 octal digits, second 0–3).`);
        else { const want = m1Table[m.role]; if (want && m.m1[0] !== want[0]) add("info", id, `Mode 1 ${m.m1} is not in the ${m.role} family (${want[0]}x).`); }
      } else if (m.role) add("warn", id, "No Mode 1.");
      if (!m.m3) { add("warn", id, "No Mode 3/A."); return; }
      if (!octal(m.m3, 4)) { add("error", id, `Mode 3/A ${m.m3} is not 4 octal digits.`); return; }
      const n = flightSize(m), r = reservedHit(m.m3);
      if (r) add("error", id, `Mode 3/A ${m.m3} is reserved: ${r.use}.`);
      if (m.m3.endsWith("00")) add("error", id, `Mode 3/A ${m.m3} is a non-discrete code (ends in 00).`);
      if (n > D.mode3.maxFlightSize) add("error", id, `${n}-ship does not fit one slot (max ${D.mode3.maxFlightSize}); split the line.`);
      const want = n > 1 ? o4(parseInt(m.m3, 8) + n - 1) : "";
      if (n > 1 && m.m3last !== want) add("warn", id, `Last-member code should be ${want} (lead ${m.m3} + ${n - 1}); line has ${m.m3last || "none"}.`);
      if (want && slotOf(want) !== slotOf(m.m3)) add("error", id, `Last-member code ${want} runs out of the lead's slot.`);
      const bad = span(m).slice(1).filter(code => reservedHit(code));
      if (bad.length && !r) add("error", id, `Flight codes ${bad.join(", ")} are reserved (${reservedHit(bad[0]).use}).`);
      if (bl.length && !bl.includes(m.m3.slice(0, 2))) add("warn", id, `Mode 3/A ${m.m3} is outside the campaign's blocks (${bl.join(", ")}).`);
      [m.m3, want].filter(Boolean).forEach(code => (seen[code] = seen[code] || []).push(id));
      if (m.m2) m.m2.split(/[–-]/).forEach(x => { if (!octal(x.trim(), 4)) add("error", id, `Mode 2 ${x.trim()} is not 4 octal digits.`); });
      if (theater === "Nevada" && m.m3 === "1200") add("error", id, "NTTR: tactical Mode 3 on range, never 1200.");
    });
    Object.entries(seen).filter(([, ids]) => new Set(ids).size > 1).forEach(([code, ids]) => add("error", ids.join(", "), `Mode 3/A ${code} is used by more than one line (${[...new Set(ids)].join(", ")}).`));
    // codes another campaign's ATO already uses
    Store.db.campaigns.filter(x => x.id !== cid).forEach(x => {
      const theirs = new Set((Store.content(x.id, "ato")?.missions || []).flatMap(o => [o.m3, o.m3last]).filter(Boolean));
      missions.forEach(m => [m.m3, m.m3last].filter(c => c && theirs.has(c)).forEach(c => add("error", m.msn, `Mode 3/A ${c} is also used by OP ${x.opName}.`)));
    });
    const order = { error: 0, warn: 1, info: 2 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  window.AOC.IFF = { data: D, octal, reservedHit, mode1For, m1Table, blocks, allBlocks, assign, check, settings, theaterRules, flightSize };
})();
