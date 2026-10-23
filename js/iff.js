// IFF / SIF code plan: reserved codes, Mode 1 by mission type, Mode 3/A assigned per ATO line inside the block named by the
// line's Mode 1 code (SEAD Mode 1 30 → 3011–3017, 3021–3027 …; lead + last-member code), optional Mode 2 per airframe, and
// the checks. Mode 3/A starts with Mode 1 because the F-16C sends its first two code wheels as Mode 1 (shared dials).
// Plan data comes from the JCEOI (tools/jceoi/data/iff.json).
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
  function settings(cid) { const c = Store.campaign(cid); return c.iff || {}; }

  // ---------- Mode 3/A slots: block = Mode 1 code, slot C covers BBC1–BBC7 ----------
  // a slot is never used when any of its member codes is reserved (block 12 loses 120, 125 and 127)
  const slotsOf = m1 => Array.from({ length: D.mode3.slotsPerBlock }, (_, i) => `${m1}${i + 1}`)
    .filter(slot => !Array.from({ length: D.mode3.maxFlightSize }, (_, k) => `${slot}${k + 1}`).some(reservedHit));
  // the line's own Mode 1 first, then the family's spare codes when that block is full
  const spares = m1 => D.mode1.families.find(f => f.digit === +m1[0])?.codes.filter(([c, r]) => c !== m1 && /^Spare/.test(r)).map(([c]) => c) || [];
  // every lead..last code a line takes
  const span = m => { if (!octal(m.m3, 4)) return []; const a = parseInt(m.m3, 8); return Array.from({ length: flightSize(m) }, (_, i) => o4(a + i)); };
  const slotOf = code => code.slice(0, 3);   // BBC
  const fits = m => octal(m.m1, 2) && octal(m.m3, 4) && m.m3.startsWith(m.m1) && slotsOf(m.m1).includes(slotOf(m.m3));

  // fill the IFF codes of lines that have none, or whose Mode 3/A doesn't start with their Mode 1 (all = reassign every line)
  function assign(cid, missions, { all = false } = {}) {
    const c = Store.campaign(cid), s = settings(cid);
    missions.forEach(m => { if (all || !m.m1) { const v = mode1For(m.role, c.atoDay, s.rotateMode1); if (v) m.m1 = v; } });
    const keep = missions.filter(m => !all && fits(m)), used = new Set(keep.map(m => slotOf(m.m3)));
    let n = 0;
    missions.filter(m => !keep.includes(m)).forEach(m => {
      if (!octal(m.m1, 2)) { m.m3 = ""; m.m3last = ""; return; }
      const code = [m.m1, ...spares(m.m1)].find(c1 => slotsOf(c1).some(x => !used.has(x)));
      if (!code) { m.m3 = ""; m.m3last = ""; return; }      // every slot of the mission family is taken
      const slot = slotsOf(code).find(x => !used.has(x)); used.add(slot);
      m.m1 = code; m.m3 = `${slot}1`; m.m3last = flightSize(m) > 1 ? o4(parseInt(m.m3, 8) + flightSize(m) - 1) : ""; n++;
    });
    if (s.mode2) missions.forEach(m => {
      if (!all && m.m2) return;
      const gi = Store.db.groups.findIndex(g => g.id === m.group);
      if (gi >= 0) m.m2 = `${o2(gi + 1)}01${flightSize(m) > 1 ? `–${o2(gi + 1)}${o2(flightSize(m))}` : ""}`;
    });
    return n;
  }

  // ---------- checks ----------
  function check(cid, missions, theater) {
    const out = [], add = (sev, msn, text) => out.push({ sev, msn, text });
    const seen = {};
    missions.forEach(m => {
      const id = m.msn || "?";
      if (m.m1) {
        if (!octal(m.m1, 2) || !"0123".includes(m.m1[1])) add("error", id, `Mode 1 ${m.m1} is not valid (2 octal digits, second 0–3).`);
        else { const want = m1Table[m.role]; if (want && m.m1[0] !== want[0]) add("info", id, `Mode 1 ${m.m1} is not in the ${m.role} family (${want[0]}x).`); }
      } else if (m.role) add("warn", id, "No Mode 1.");
      if (!m.m3) { add("warn", id, octal(m.m1, 2) ? `No Mode 3/A — reassign, or block ${m.m1} and its spare codes are full.` : "No Mode 3/A."); return; }
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
      if (octal(m.m1, 2) && !m.m3.startsWith(m.m1)) add("error", id, `Mode 3/A ${m.m3} should start with Mode 1 ${m.m1}.`);
      else if (octal(m.m1, 2) && !slotsOf(m.m1).includes(slotOf(m.m3))) add("error", id, `Mode 3/A slot ${slotOf(m.m3)} holds a reserved code.`);
      [m.m3, want].filter(Boolean).forEach(code => (seen[code] = seen[code] || []).push(id));
      if (m.m2) m.m2.split(/[–-]/).forEach(x => { if (!octal(x.trim(), 4)) add("error", id, `Mode 2 ${x.trim()} is not 4 octal digits.`); });
      if (theater === "Nevada" && m.m3 === "1200") add("error", id, "NTTR: tactical Mode 3 on range, never 1200.");
    });
    Object.entries(seen).filter(([, ids]) => new Set(ids).size > 1).forEach(([code, ids]) => add("error", ids.join(", "), `Mode 3/A ${code} is used by more than one line (${[...new Set(ids)].join(", ")}).`));
    const order = { error: 0, warn: 1, info: 2 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  window.AOC.IFF = { data: D, octal, reservedHit, mode1For, m1Table, slotsOf, assign, check, settings, theaterRules, flightSize };
})();
