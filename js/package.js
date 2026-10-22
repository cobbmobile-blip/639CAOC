// The campaign package: deadlines and the single PUBLISH that releases everything.
// The CAOC only builds products. The host unit builds and runs the .miz, readiness and the mass brief.
// PUBLISH releases the approved products to the groups and, as options, exports to DKS:
//   - ACO + theater map -> DKS Overlay (drawn on the DKS theater map; never written into the .miz)
//   - Comm Plan -> DKS Manage Agencies (persistent theater frequencies; normally only tankers and JTACs change)
(function () {
  const { Store, Auth, PRODUCTS, MILESTONES, COMM } = window.AOC;
  const DAY = 864e5;
  // internal working products: built and approved by the CAOC, never released to groups
  const INTERNAL = new Set(["pcon"]);
  // agencies expected to change during a campaign
  const VOLATILE = /TANK|BOOM|DROGUE|MPRS|KC-|JTAC|FAC\(A\)/i;

  const wanted = c => (c.productsWanted || Object.keys(PRODUCTS)).filter(id => PRODUCTS[id] && !INTERNAL.has(id));
  const isDone = (cid, pid) => ["approved", "published"].includes(Store.status(cid, pid));
  const mode = c => (c.atoDay > 0 ? "cycle" : "build");
  // T-0: the first mission while building, the next mission once the campaign is running
  const t0 = (c, m) => new Date(m === "build" ? `${c.dday}T${c.firstMissionTime || "20:00:00Z"}` : c.nextEvent);
  // offsets are in days; inside the last 3 days they read in hours (PUBLISH is due T-72h)
  const tlabel = o => o === 0 ? "T-0" : Math.abs(o) <= 3 ? `T${o > 0 ? "+" : "-"}${Math.round(Math.abs(o) * 24)}h` : `T${o > 0 ? "+" : ""}${o}d`;

  function milestones(cid, m) {
    const c = Store.campaign(cid), off = c.milestoneOffsets?.[m] || {}, base = t0(c, m), now = Date.now();
    const lines = AOC.ATO ? AOC.ATO.lines(cid) : [];
    const checks = {
      proposal: () => true,
      pcon: () => isDone(cid, "pcon") || ((Store.content(cid, "pcon")?.items || []).length > 0 && Store.content(cid, "pcon").items.every(i => i.done)),
      mizDraft: () => !!c.missionFiles?.length,
      lineReq: () => lines.length > 0,
      lineCommit: () => lines.length > 0 && lines.every(l => l.status !== "open"),
      publish: () => !!c.packageRelease && (m === "build" || c.packageRelease.atoDay === c.atoDay),
      debrief: () => !!c.debriefs?.[m === "build" ? 1 : c.atoDay - 1]
    };
    return MILESTONES[m].map(ms => {
      const offset = off[ms.id] ?? ms.offset, due = new Date(base.getTime() + offset * DAY);
      const done = ms.check ? (checks[ms.check] || (() => isDone(cid, ms.check)))() : null;
      const left = (due - now) / DAY;
      const state = done ? "done" : done === null ? (left < 0 ? "past" : "host") : left < 0 ? "overdue" : left <= 1 ? "soon" : "upcoming";
      return { ...ms, offset, due, done, state };
    });
  }

  // What PUBLISH can send to DKS
  function dksExports(cid) {
    const c = Store.campaign(cid), acp = Store.content(cid, "acp"), map = Store.content(cid, "map") || {}, aco = Store.content(cid, "aco");
    // agencies without a callsign are named role + channel (e.g. "BOOM BLUE 1") so they stay distinct in DKS
    const agencies = COMM.channels(acp?.matrix).filter(ch => ch.freq).map(ch => ({ name: ch.callsign || `${ch.role} ${ch.id}`, role: ch.role || "", channel: ch.id,
      net: ch.col.title, freq: ch.freq, volatile: VOLATILE.test(`${ch.col.title} ${ch.role}`) }));
    // changes against what DKS last received (none received yet = everything is new)
    const last = c.dks?.agencies?.list, byCh = Object.fromEntries((last || []).map(a => [a.channel, a]));
    const changes = !last ? null : [
      ...agencies.filter(a => !byCh[a.channel]).map(a => ({ kind: "added", ...a })),
      ...agencies.filter(a => byCh[a.channel] && (byCh[a.channel].freq !== a.freq || byCh[a.channel].name !== a.name)).map(a => ({ kind: "changed", was: `${byCh[a.channel].name} ${byCh[a.channel].freq}`, ...a })),
      ...last.filter(a => !agencies.some(x => x.channel === a.channel)).map(a => ({ kind: "removed", ...a }))];
    return {
      overlay: { measures: aco?.measures || [], points: map.points || [], shapes: map.shapes || [],
        ready: isDone(cid, "aco"), last: c.dks?.overlay || null },
      agencies: { list: agencies, changes, ready: isDone(cid, "acp"), last: c.dks?.agencies || null }
    };
  }

  // One PUBLISH: approved products to every active campaign group, plus the DKS exports that were ticked
  function publish(cid, opts = { products: true, overlay: true, agencies: true }) {
    const c = Store.campaign(cid), groups = c.groups.filter(g => Store.group(g)?.status === "active");
    const released = [], when = new Date().toISOString(), by = Auth.user()?.callsign, ex = dksExports(cid);
    if (opts.products) wanted(c).filter(pid => Store.status(cid, pid) === "approved").forEach(pid => {
      Store.publish(cid, pid, groups, Store.content(cid, pid));
      Store.setStatus(cid, pid, "published");
      released.push({ pid, v: Store.shared(cid, pid).version });
    });
    c.packageRelease = { version: (c.packageRelease?.version || 0) + 1, atoDay: c.atoDay, when, by, products: released,
      current: wanted(c).filter(pid => Store.shared(cid, pid)).map(pid => ({ pid, v: Store.shared(cid, pid).version })), dks: [] };
    // DKS exports (payload formats still to be agreed with the DKS developer; the prototype records them)
    const d = Store.db; d.dksOutbox = d.dksOutbox || []; c.dks = c.dks || {};
    const ev = (event, payload) => d.dksOutbox.unshift({ when, event, campaign_id: cid, operation: c.opName, ato_day: c.atoDay, package: c.packageRelease.version, ...payload });
    if (opts.overlay) {
      c.dks.overlay = { v: (c.dks.overlay?.v || 0) + 1, when, by };
      ev("overlay.update", { overlay_version: c.dks.overlay.v, measures: ex.overlay.measures, points: ex.overlay.points, shapes: ex.overlay.shapes });
      c.packageRelease.dks.push(`Overlay v${c.dks.overlay.v}`);
    }
    if (opts.agencies) {
      c.dks.agencies = { v: (c.dks.agencies?.v || 0) + 1, when, by, list: structuredClone(ex.agencies.list) };
      ev("agencies.update", { agencies_version: c.dks.agencies.v, agencies: ex.agencies.list.map(({ volatile, ...a }) => a), changes: ex.agencies.changes });
      c.packageRelease.dks.push(`Agencies v${c.dks.agencies.v}`);
    }
    if (released.length) ev("package.published", { products: c.packageRelease.current });
    d.dksOutbox = d.dksOutbox.slice(0, 50);
    Store.save();
    Store.log(cid, `PUBLISH package v${c.packageRelease.version}: ${released.length ? released.map(r => `${PRODUCTS[r.pid].code} v${r.v}`).join(", ") : "no new products"} → ${groups.length} groups${c.packageRelease.dks.length ? ` · DKS ${c.packageRelease.dks.join(", ")}` : ""}`);
    return c.packageRelease;
  }

  // After the host's debrief: next ATO day, daily products back to draft for the new cycle
  const DAILY = ["aod", "jiptl", "tdp", "maap", "ato", "bda"];
  function cycle(cid, nextWhen) {
    const c = Store.campaign(cid), from = c.atoDay;
    c.atoDay = (+c.atoDay || 0) + 1;
    if (nextWhen) c.nextEvent = nextWhen;
    DAILY.forEach(pid => { if (Store.content(cid, pid) != null) Store.setStatus(cid, pid, "draft"); });
    Store.save();
    Store.log(cid, `Cycled from ATO day ${from} to ATO day ${c.atoDay}; daily products back to draft`);
  }

  window.AOC.PACKAGE = { INTERNAL, DAILY, wanted, mode, t0, tlabel, milestones, dksExports, publish, cycle };
})();
