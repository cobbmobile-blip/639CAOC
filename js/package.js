// The campaign package: deadlines and the single PUBLISH that releases everything.
// The CAOC only builds products. The host unit builds and runs the .miz, readiness and the mass brief.
// PUBLISH releases the approved products to the groups and, as options, exports to DKS:
//   - ACO + theater map -> DKS Overlay (drawn on the DKS theater map; never written into the .miz)
//   - Comm Plan -> DKS Manage Agencies (persistent theater frequencies; normally only tankers and JTACs change)
//   - SPINS Addendum A (AET tables, RAMRODs) -> DKS kneeboards, from the released SPINS (also sent from the SPINS page)
// and posts the pilot package to Discord: the host unit and every active group get one post with one zip of printable pages
// (docs/ATO_Discord_Integration.md, package.posted). The same zip downloads from the Dashboard and from Op Status.
// PUBLISH is the only release path: products are built and approved on their pages, and released here, on the Dashboard.
(function () {
  const { Store, Auth, PRODUCTS, MILESTONES, COMM } = window.AOC;
  const DAY = 864e5;
  // internal working products (staff functions): built and approved by the CAOC, never released to groups or shown on Op Status
  const INTERNAL = new Set(["pcon", "maap", "bda"]);
  // the pilot package: what aircrew get, in this order. JIPTL stays on Op Status (groups request lines against it) but is not
  // in the package; TDPs go only for the targets the released ATO strikes with INT lines
  const PILOT = ["ci", "aod", "ato", "spins", "acp", "aco", "optasklink", "tdp"];
  // agencies expected to change during a campaign
  const VOLATILE = /TANK|BOOM|DROGUE|MPRS|KC-|JTAC|FAC\(A\)/i;

  // every campaign gets the full standard set (older campaigns may still carry a productsWanted list from the proposal; ignored)
  const wanted = c => Object.keys(PRODUCTS).filter(id => !INTERNAL.has(id));
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

  // the BLUE bullseye of the host's current mission file, when it differs from the SPINS' (a .miz uploaded after the SPINS were built)
  function bullseyeCheck(cid) {
    const b = window.AOC.MIZ?.bullseye(cid), PR = window.AOC.PR, sp = Store.content(cid, "spins"); if (!b || !PR || !sp) return null;
    const text = `${PR.ddm(b.lat, b.lon)} (${PR.mgrs(b.lat, b.lon)})`;
    return sp.bullseye === text ? null : { text, v: b.v, was: sp.bullseye || "" };
  }

  // One PUBLISH: approved products to every active campaign group, plus the DKS exports that were ticked
  function publish(cid, opts = { products: true, overlay: true, agencies: true, discord: true }) {
    const c = Store.campaign(cid), groups = c.groups.filter(g => Store.group(g)?.status === "active");
    const released = [], when = new Date().toISOString(), by = Auth.user()?.callsign, ex = dksExports(cid);
    // the SPINS bullseye follows the host's latest mission file (the CFACC approves the change as part of this PUBLISH)
    const bull = opts.bullseye && bullseyeCheck(cid);
    if (bull) { const sp = Store.content(cid, "spins"); sp.bullseye = bull.text; sp.bullseyeSrc = `host mission file v${bull.v}`; Store.setContent(cid, "spins", sp);
      Store.setStatus(cid, "spins", Auth.can("approve") ? "approved" : "review"); Store.log(cid, `SPINS bullseye updated from host mission file v${bull.v}`); }
    // the CFACC approves the products ticked in the dialog in the same step (true = every one ready for approval)
    if (opts.approve) wanted(c).filter(pid => Store.status(cid, pid) === "review" && (opts.approve === true || opts.approve.includes(pid))).forEach(pid => Store.setStatus(cid, pid, "approved"));
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
    // Discord: the prototype records the post and the zip's contents, not the zip itself (it is rebuilt from the released versions)
    if (opts.discord) {
      const post = discordPost(cid, c.packageRelease);
      d.discordOutbox = d.discordOutbox || [];
      d.discordOutbox.unshift({ when, payload: post });
      d.discordOutbox = d.discordOutbox.slice(0, 50);
      c.packageRelease.discord = { recipients: post.recipients.length, products: post.products.length, zip: post.attachment.filename, documents: post.attachment.documents.length };
    }
    Store.save();
    Store.log(cid, `PUBLISH package v${c.packageRelease.version}: ${released.length ? released.map(r => `${PRODUCTS[r.pid].code} v${r.v}`).join(", ") : "no new products"} → ${groups.length} groups${c.packageRelease.dks.length ? ` · DKS ${c.packageRelease.dks.join(", ")}` : ""}${c.packageRelease.discord ? ` · Discord post to ${c.packageRelease.discord.recipients} groups (${c.packageRelease.discord.files} files)` : ""}`);
    return c.packageRelease;
  }

  // ---------- the pilot package zip: one printable page per document, from the released versions ----------
  const opSlug = c => c.opName.replace(/\s+/g, "_");
  const intTargets = cid => new Set((Store.shared(cid, "ato")?.data?.missions || []).filter(m => m.role === "INT" && m.target).map(m => String(m.target).trim().toUpperCase()));
  // the site's document styles, so a page in the zip prints like the preview
  function docCss() {
    let css = "";
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; }
      for (const r of rules) if (/\.doc\b|\.cm-wrap/.test(r.cssText)) css += r.cssText + "\n"; }
    return `:root{--mono:Consolas,"Courier New",monospace;--doc-bg:#fff;--doc-ink:#000;--line:#bbb}body{margin:24px;background:#fff;color:#000}\n${css}
.doc{max-height:none;overflow:visible;border:0;max-width:980px;margin:0 auto}`;
  }
  // [{ pid, code, title, version, filename, html }] in package order
  function packageDocs(cid) {
    const c = Store.campaign(cid), want = wanted(c), id = window.AOC.atoId(c.atoDay), css = docCss(), out = [];
    PILOT.filter(pid => want.includes(pid) && Store.shared(cid, pid)).forEach(pid => {
      const P = PRODUCTS[pid], s = Store.shared(cid, pid), u = Store.db.users.find(x => x.callsign === s.by);
      const ctx = { campaign: c, user: { callsign: s.by || "AOC", role: u?.role || "AOC staff" }, approval: s.approval, group: g => Store.group(g) };
      let data = s.data;
      if (pid === "tdp") {
        const t = intTargets(cid), fs = Object.entries(data?.folders || {}).filter(([k, f]) => t.has(String(f.targetId || k).trim().toUpperCase()));
        if (!fs.length) return; data = { ...data, folders: Object.fromEntries(fs) };
      }
      (P.docs || [{ code: P.code, label: P.name, render: P.render }]).forEach(x => {
        const n = String(out.length + 1).padStart(2, "0"), title = `OP ${c.opName} — ${x.label === x.code ? P.name : x.label} (ATO ${id})`;
        out.push({ pid, code: x.code, title, version: s.version, filename: `${n}_${x.code.replace(/[^\w-]+/g, "_")}_v${s.version}.html`,
          html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${window.AOC.esc(title)}</title><style>${css}</style></head><body><article class="doc">${x.render(data, ctx)}</article></body></html>` });
      });
    });
    return out;
  }
  const zipName = (cid, rel) => { const c = Store.campaign(cid); return `OP_${opSlug(c)}_ATO_${window.AOC.atoId(c.atoDay)}_PUBLISH_v${rel?.version ?? 0}.zip`; };
  // the zip itself (needs JSZip on the page): every package document plus an index page
  async function packageZip(cid, rel = Store.campaign(cid).packageRelease) {
    if (!window.JSZip) throw new Error("the zip writer didn't load");
    const c = Store.campaign(cid), docs = packageDocs(cid), zip = new JSZip(), esc = window.AOC.esc;
    docs.forEach(d => zip.file(d.filename, d.html));
    zip.file("00_INDEX.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OP ${esc(c.opName)} pilot package</title>
<style>body{font:15px/1.6 Arial,sans-serif;margin:32px;color:#000}li{margin:4px 0}</style></head><body>
<h1>OP ${esc(c.opName)} — pilot package, ATO ${window.AOC.atoId(c.atoDay)}</h1><p>PUBLISH v${rel?.version ?? "—"}${rel?.when ? `, ${esc(window.AOC.zulu(new Date(rel.when)))}` : ""}. Open any page and print it for the kneeboard.</p>
<ol>${docs.map(d => `<li><a href="${d.filename}">${esc(d.title)}</a> v${d.version}</li>`).join("")}</ol></body></html>`);
    return { filename: zipName(cid, rel), blob: await zip.generateAsync({ type: "blob" }), docs };
  }
  async function downloadZip(cid) {
    const z = await packageZip(cid), a = document.createElement("a");
    a.href = URL.createObjectURL(z.blob); a.download = z.filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return z;
  }
  // the post for a release (default: the last one). Recipients: the host (the campaign JFACC's group) and every active group.
  function discordPost(cid, rel = Store.campaign(cid).packageRelease) {
    const c = Store.campaign(cid), host = c.jfacc?.group;
    const ids = [...new Set([host, ...c.groups.filter(g => Store.group(g)?.status === "active")].filter(Boolean))];
    const fresh = new Set((rel?.products || []).map(r => r.pid));
    const docs = packageDocs(cid), pids = [...new Set(docs.map(x => x.pid))];
    const products = pids.map(pid => {
      const s = Store.shared(cid, pid);
      return { product: pid, code: PRODUCTS[pid].docs ? PRODUCTS[pid].name : PRODUCTS[pid].code, name: PRODUCTS[pid].name, version: s.version,
        change: fresh.has(pid) ? (s.version === 1 ? "new" : "changed") : "unchanged", files: docs.filter(x => x.pid === pid).map(x => x.filename) };
    });
    const title = `OP ${c.opName} — PUBLISH v${rel?.version ?? "—"} · ATO ${window.AOC.atoId(c.atoDay)}`;
    const tag = { new: "NEW", changed: "CHANGED", unchanged: "" };
    const content = [`**${title}**`, ...products.map(p => `• ${p.code} v${p.version}${tag[p.change] ? ` — **${tag[p.change]}**` : ""}`),
      rel?.dks?.length ? `In DKS: ${rel.dks.join(", ")}` : "", "Pilot package attached (zip). Also on Op Status."].filter(Boolean).join("\n");
    return { event: "package.posted", campaign_id: cid, operation: c.opName, ato_day: c.atoDay, ato: window.AOC.atoId(c.atoDay), package: rel?.version ?? null,
      published_at: rel?.when ?? null, published_by: rel?.by ?? null, title, content,
      recipients: ids.map(g => ({ group_id: g, group: Store.group(g)?.name || g, host: g === host })),
      products, dks: rel?.dks || [], op_status: "unit.html",
      attachment: { filename: zipName(cid, rel), documents: ["00_INDEX.html", ...docs.map(x => x.filename)] } };
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

  // ---------- the PUBLISH dialog (Dashboard): approve what's waiting, release, DKS exports, the Discord zip ----------
  function publishDialog(cid, done) {
    const { esc, toast } = window.AOC, c = Store.campaign(cid), want = wanted(c), st = pid => Store.status(cid, pid);
    const review = want.filter(pid => st(pid) === "review"), approved = want.filter(pid => st(pid) === "approved");
    const notReady = want.filter(pid => ["none", "draft"].includes(st(pid))), ex = dksExports(cid), canApprove = Auth.can("approve");
    const agChanged = ex.agencies.changes == null || ex.agencies.changes.length > 0, late = Date.now() > t0(c, mode(c)).getTime() - 3 * DAY;
    const codes = ids => ids.map(p => PRODUCTS[p].code).join(", "), last = l => l ? ` <span class="muted small">(last v${l.v})</span>` : "";
    // a DKS export is ready when its product is approved, or waits for the approval this PUBLISH gives
    const bull = bullseyeCheck(cid);
    const ok = (pid, ready) => ready || (canApprove && review.includes(pid)), rel0 = canApprove ? [...new Set([...approved, ...review, ...(bull ? ["spins"] : [])])] : approved;
    const ovOk = ok("aco", ex.overlay.ready), agOk = ok("acp", ex.agencies.ready), kbOk = ok("spins", ex.kneeboard.ready);
    const back = document.createElement("div"); back.className = "modal-back";
    back.innerHTML = `<div class="panel modal" style="max-width:640px"><h2>PUBLISH package v${(c.packageRelease?.version || 0) + 1} · ATO ${window.AOC.atoId(c.atoDay)}</h2>
      ${late ? `<p class="small" style="color:var(--warn)">Inside T-72h — the host has less than three days to build and brief.</p>` : ""}
      ${review.length && canApprove ? `<div class="section-h">Approve (CFACC) — saved and ready</div>${review.map(p => `<label class="check-row"><input type="checkbox" data-approve="${p}" checked> ${esc(PRODUCTS[p].code)} — ${esc(PRODUCTS[p].name)} <a class="small" href="product.html?p=${p}&c=${encodeURIComponent(cid)}" target="_blank">review →</a></label>`).join("")}`
        : review.length ? `<p class="small" style="color:var(--warn)">${esc(codes(review))} wait for CFACC approval and stay back.</p>` : ""}
      ${bull ? `<label class="check-row"><input type="checkbox" id="oBull" ${canApprove ? "checked" : "disabled"}> <span style="color:var(--warn)">Host mission file v${bull.v} moved the BLUE bullseye.</span> Update the SPINS to ${esc(bull.text)}${bull.was ? ` (was ${esc(bull.was)})` : ""} and release them</label>` : ""}
      <div class="section-h" style="margin-top:12px">Release</div>
      <label class="check-row"><input type="checkbox" id="oProd" ${approved.length || review.length ? "checked" : "disabled"}> Release to every active group (Op Status) — <span id="relList">${esc(codes(rel0)) || "none approved yet"}</span></label>
      ${notReady.length ? `<p class="small muted" style="margin:0 0 8px 26px">Not ready, stays back: ${esc(codes(notReady))}</p>` : ""}
      <div class="section-h" style="margin-top:12px">DKS</div>
      <label class="check-row"><input type="checkbox" id="oOv" ${ovOk ? (ex.overlay.last && !review.includes("aco") && !approved.includes("aco") ? "" : "checked") : "disabled"}> Overlay — ACO + theater map${ovOk ? last(ex.overlay.last) : ` <span class="muted small">(ACO not approved)</span>`}</label>
      <label class="check-row"><input type="checkbox" id="oAg" ${agOk ? (agChanged ? "checked" : "") : "disabled"}> Manage Agencies — Comm Plan <span class="muted small">${!agOk ? "(Comm Plan not approved)" : ex.agencies.changes == null ? "(first export)" : ex.agencies.changes.length ? `(${ex.agencies.changes.length} changed)` : "(no changes)"}</span></label>
      <label class="check-row"><input type="checkbox" id="oKb" ${kbOk ? (ex.kneeboard.changed || bull || approved.includes("spins") || review.includes("spins") ? "checked" : "") : "disabled"}> Kneeboards — SPINS Addendum A (AET tables, RAMRODs)${kbOk ? last(ex.kneeboard.last) : ` <span class="muted small">(SPINS not approved)</span>`}</label>
      <div class="section-h" style="margin-top:12px">Discord</div>
      <label class="check-row"><input type="checkbox" id="oDisc" checked> Post the pilot package (zip) to the host and every active group</label>
      <p class="small muted" style="margin:0 0 0 26px">${esc(PILOT.map(p => PRODUCTS[p]?.code).filter(Boolean).join(", "))} as printable pages; TDPs only for INT targets. Internal products never go.</p>
      <div class="toolbar" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>PUBLISH</button></div></div>`;
    document.body.appendChild(back);
    const ck = id => !!back.querySelector("#" + id)?.checked;
    const picked = () => [...back.querySelectorAll("[data-approve]:checked")].map(x => x.dataset.approve);
    back.addEventListener("change", e => { if (!e.target.matches("[data-approve], #oBull")) return;
      back.querySelector("#relList").textContent = codes([...new Set([...approved, ...picked(), ...(ck("oBull") ? ["spins"] : [])])]) || "none approved yet"; });
    back.querySelector("[data-x]").onclick = () => back.remove();
    back.querySelector("[data-ok]").onclick = () => {
      const opts = { approve: picked(), bullseye: ck("oBull"), products: ck("oProd"), overlay: ck("oOv"), agencies: ck("oAg"), kneeboard: ck("oKb"), discord: ck("oDisc") };
      if (!opts.products && !opts.overlay && !opts.agencies && !opts.kneeboard && !opts.discord) { toast("Nothing selected"); return; }
      const rel = publish(cid, opts); back.remove();
      toast(`Package v${rel.version}: ${rel.products.length} products${rel.dks.length ? ", DKS " + rel.dks.join(", ") : ""}${rel.discord ? `, zip to ${rel.discord.recipients} groups` : ""}`);
      done?.(rel);
    };
  }

  // ---------- Cycle to the next ATO (Dashboard): after the host's debrief, the daily products go back to work ----------
  function cycleDialog(cid, done) {
    const { esc, toast } = window.AOC, c = Store.campaign(cid), have = c.debriefs?.[c.atoDay], id = window.AOC.atoId;
    const back = document.createElement("div"); back.className = "modal-back";
    const next = new Date(new Date(c.nextEvent || Date.now()).getTime() + 7 * DAY).toISOString().slice(0, 16);
    back.innerHTML = `<div class="panel modal"><h2>Cycle to ATO ${id(+c.atoDay + 1)}</h2>
      <p class="small">${have ? `The host's debrief for ATO ${id(c.atoDay)} is in.` : `<span style="color:var(--warn)">No host debrief for ATO ${id(c.atoDay)} yet.</span> Usually you wait for it — it drives BDA and the next JIPTL.`}</p>
      <p class="muted small">${esc(DAILY.map(p => PRODUCTS[p]?.code).filter(Boolean).join(", "))} go back to work for the new ATO. Released versions stay with the groups until the next PUBLISH.</p>
      <div class="field"><label>Next mission (UTC)</label><input type="datetime-local" id="nx" value="${next}"></div>
      <div class="toolbar" style="justify-content:flex-end"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Cycle</button></div></div>`;
    document.body.appendChild(back);
    back.querySelector("[data-x]").onclick = () => back.remove();
    back.querySelector("[data-ok]").onclick = () => { cycle(cid, new Date(back.querySelector("#nx").value + "Z").toISOString()); back.remove();
      toast(`Now planning ATO ${id(Store.campaign(cid).atoDay)}`); done?.(); };
  }

  window.AOC.PACKAGE = { INTERNAL, PILOT, DAILY, wanted, mode, t0, tlabel, milestones, dksExports, sendKneeboard, packageDocs, packageZip, downloadZip, discordPost, publish, publishDialog, bullseyeCheck, cycle, cycleDialog };
})();
