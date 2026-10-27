// The campaign package: deadlines and the single PUBLISH that releases everything.
// The CAOC only builds products. The host unit builds and runs the .miz, readiness and the mass brief.
// PUBLISH releases the approved products to the groups and, as options, exports to DKS:
//   - ACO + theater map -> DKS Overlay (drawn on the DKS theater map; never written into the .miz)
//   - Comm Plan -> DKS Manage Agencies (persistent theater frequencies; normally only tankers and JTACs change)
//   - SPINS Addendum A (AET tables, RAMRODs) -> DKS kneeboards, from the released SPINS (also sent from the SPINS page)
// and posts every released product that is not a DKS export to Discord: the host unit and every active group get one post
// with the products attached as text files (docs/ATO_Discord_Integration.md, package.posted).
(function () {
  const { Store, Auth, PRODUCTS, MILESTONES, COMM } = window.AOC;
  const DAY = 864e5;
  // internal working products (staff functions): built and approved by the CAOC, never released to groups or shown on Op Status
  const INTERNAL = new Set(["pcon", "maap"]);
  // products that go out as DKS exports (Overlay, Manage Agencies) and so are not attached to the Discord post
  const DKS_ONLY = new Set(["aco", "acp"]);
  const FILES_PER_MESSAGE = 10;   // Discord's attachment limit per message; the bot splits larger posts
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
      lineCommit: () => lines.length > 0 && lines.every(l => !["open", "draft"].includes(l.status)),
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
      agencies: { list: agencies, changes, ready: isDone(cid, "acp"), last: c.dks?.agencies || null },
      kneeboard: kneeboardState(cid)
    };
  }

  // DKS kneeboard: SPINS Addendum A from the released SPINS, one page per ATO from the current one. Re-send when the SPINS
  // are re-released or the ATO cycles (the pages start at the current ATO). Payload format still to be agreed with DKS
  function kneeboardState(cid) {
    const c = Store.campaign(cid), sh = Store.shared(cid, "spins"), last = c.dks?.kneeboard || null;
    return { ready: !!sh || Store.status(cid, "spins") === "approved", spins: sh?.version || null, last,
      changed: !last || last.spins !== sh?.version || last.atoDay !== c.atoDay };
  }
  function sendKneeboard(cid, extra = {}) {
    const c = Store.campaign(cid), sh = Store.shared(cid, "spins"), P = PRODUCTS.spins;
    const payload = sh && P.kneeboard?.(sh.data, { campaign: c, user: Auth.user(), group: id => Store.group(id) });
    if (!payload) return null;
    const d = Store.db, when = extra.when || new Date().toISOString(), by = Auth.user()?.callsign;
    c.dks = c.dks || {}; c.dks.kneeboard = { v: (c.dks.kneeboard?.v || 0) + 1, when, by, spins: sh.version, atoDay: c.atoDay };
    d.dksOutbox = d.dksOutbox || [];
    d.dksOutbox.unshift({ when, event: "kneeboard.update", campaign_id: cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay),
      ...(extra.package ? { package: extra.package } : {}), kneeboard_version: c.dks.kneeboard.v, section: "SPINS Addendum A", ...payload });
    d.dksOutbox = d.dksOutbox.slice(0, 50);
    Store.save();
    Store.log(cid, `SPINS Addendum A (SPINS v${sh.version}, ${payload.pages.length} ATOs) sent to DKS kneeboards, v${c.dks.kneeboard.v}`);
    return { ...c.dks.kneeboard, pages: payload.pages.map(p => p.ato) };
  }

  // One PUBLISH: approved products to every active campaign group, plus the DKS exports that were ticked
  function publish(cid, opts = { products: true, overlay: true, agencies: true, discord: true }) {
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
    const ev = (event, payload) => d.dksOutbox.unshift({ when, event, campaign_id: cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay), package: c.packageRelease.version, ...payload });
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
    // after the release, so newly approved SPINS go to the kneeboards in the same PUBLISH
    if (opts.kneeboard) { const k = sendKneeboard(cid, { when, package: c.packageRelease.version }); if (k) c.packageRelease.dks.push(`Kneeboard v${k.v}`); }
    if (released.length) ev("package.published", { products: c.packageRelease.current });
    d.dksOutbox = d.dksOutbox.slice(0, 50);
    // Discord: the prototype records the post without the file contents (they are rebuilt from the released versions)
    if (opts.discord) {
      const { files, ...post } = discordPost(cid, c.packageRelease);
      d.discordOutbox = d.discordOutbox || [];
      d.discordOutbox.unshift({ when, payload: { ...post, files: files.map(f => ({ filename: f.filename, bytes: f.content.length })) } });
      d.discordOutbox = d.discordOutbox.slice(0, 50);
      c.packageRelease.discord = { recipients: post.recipients.length, products: post.products.length, files: files.length };
    }
    Store.save();
    Store.log(cid, `PUBLISH package v${c.packageRelease.version}: ${released.length ? released.map(r => `${PRODUCTS[r.pid].code} v${r.v}`).join(", ") : "no new products"} → ${groups.length} groups${c.packageRelease.dks.length ? ` · DKS ${c.packageRelease.dks.join(", ")}` : ""}${c.packageRelease.discord ? ` · Discord post to ${c.packageRelease.discord.recipients} groups (${c.packageRelease.discord.files} files)` : ""}`);
    return c.packageRelease;
  }

  // ---------- Discord post: every released non-DKS product, as text files, to the host and every active group ----------
  // a released product as text files, the same text as "Download .txt" (SPINS & ROE gives two files)
  function productFiles(cid, pid) {
    const c = Store.campaign(cid), P = PRODUCTS[pid], s = Store.shared(cid, pid); if (!s) return [];
    const u = Store.db.users.find(x => x.callsign === s.by);
    const ctx = { campaign: c, user: { callsign: s.by || "AOC", role: u?.role || "AOC staff" }, approval: s.approval, group: id => Store.group(id) };
    const op = c.opName.replace(/\s+/g, "_"), day = s.data?.atoDay ? `_D${s.data.atoDay}` : "";
    return (P.docs || [{ code: P.code, render: P.render }]).map(x => ({
      filename: `${op}_${x.code.replace(/[^\w-]+/g, "_")}${day}_v${s.version}.txt`, content: window.AOC.htmlToText(x.render(s.data, ctx)) }));
  }
  // the post for a release (default: the last one). Recipients: the host (the campaign JFACC's group) and every active group.
  function discordPost(cid, rel = Store.campaign(cid).packageRelease) {
    const c = Store.campaign(cid), host = c.jfacc?.group;
    const ids = [...new Set([host, ...c.groups.filter(g => Store.group(g)?.status === "active")].filter(Boolean))];
    const fresh = new Set((rel?.products || []).map(r => r.pid));
    const products = wanted(c).filter(pid => !DKS_ONLY.has(pid) && Store.shared(cid, pid)).map(pid => {
      const s = Store.shared(cid, pid);
      return { product: pid, code: PRODUCTS[pid].docs ? PRODUCTS[pid].name : PRODUCTS[pid].code, name: PRODUCTS[pid].name, version: s.version,
        change: fresh.has(pid) ? (s.version === 1 ? "new" : "changed") : "unchanged", files: productFiles(cid, pid) };
    });
    const files = products.flatMap(p => p.files), title = `OP ${c.opName} — PUBLISH v${rel?.version ?? "—"} · ATO ${window.AOC.atoId(c.atoDay)}`;
    const tag = { new: "NEW", changed: "CHANGED", unchanged: "" };
    const content = [`**${title}**`, ...products.map(p => `• ${p.code} v${p.version}${tag[p.change] ? ` — **${tag[p.change]}**` : ""}`),
      rel?.dks?.length ? `In DKS: ${rel.dks.join(", ")}` : "", "Full set on Op Status. Files attached."].filter(Boolean).join("\n");
    return { event: "package.posted", campaign_id: cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay), package: rel?.version ?? null,
      published_at: rel?.when ?? null, published_by: rel?.by ?? null, title, content,
      recipients: ids.map(g => ({ group_id: g, group: Store.group(g)?.name || g, host: g === host })),
      products: products.map(({ files: f, ...p }) => ({ ...p, files: f.map(x => x.filename) })),
      dks: rel?.dks || [], op_status: "unit.html", messages: Math.max(1, Math.ceil(files.length / FILES_PER_MESSAGE)), files };
  }

  // After the host's debrief: next ATO day, daily products back to draft for the new cycle
  const DAILY = ["aod", "jiptl", "tdp", "maap", "ato", "bda"];
  function cycle(cid, nextWhen) {
    const c = Store.campaign(cid), from = c.atoDay;
    c.atoDay = (+c.atoDay || 0) + 1;
    if (nextWhen) c.nextEvent = nextWhen;
    DAILY.forEach(pid => { if (Store.content(cid, pid) != null) Store.setStatus(cid, pid, "draft"); });
    Store.save();
    Store.log(cid, `Cycled from ATO ${window.AOC.atoId(from)} to ATO ${window.AOC.atoId(c.atoDay)}; daily products back to draft`);
  }

  window.AOC.PACKAGE = { INTERNAL, DAILY, DKS_ONLY, wanted, mode, t0, tlabel, milestones, dksExports, sendKneeboard, discordPost, publish, cycle };
})();
