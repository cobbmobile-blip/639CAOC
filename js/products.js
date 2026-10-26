// Product registry. Each product is a schema (drives the builder form) plus a render
// function (drives the formatted document). Adding a new product = adding one entry here.
(function () {
  const { esc } = window.AOC;

  // Battle-rhythm stages used by the dashboard's "Battle rhythm" layout
  const STAGES = [
    { id: 1, name: "Guidance", desc: "JFACC intent" },
    { id: 2, name: "Strategy", desc: "Objectives & apportionment" },
    { id: 3, name: "Targeting", desc: "Prioritise & develop" },
    { id: 4, name: "Plans", desc: "MAAP / packaging" },
    { id: 5, name: "Tasking", desc: "ATO / ACO / SPINS" },
    { id: 6, name: "Assessment", desc: "BDA & feedback" }
  ];

  // ----- document render helpers -----
  const cls = (bottom) => `<div class="cls${bottom ? " bottom" : ""}">UNCLASSIFIED // EXERCISE</div>`;
  const head = (title, ctx, sub) => `${cls()}
    <h1>${esc(title)}</h1>
    <div class="sub">OPERATION ${esc(ctx.campaign.opName)} — ${esc(ctx.campaign.theater.toUpperCase())}${sub ? "<br>" + sub : ""}</div>`;
  const kv = pairs => `<div class="kv">${pairs.filter(p => p[1]).map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v)}</div>`).join("")}</div>`;
  const para = (h, t) => t ? `<h2>${esc(h)}</h2><p>${esc(t)}</p>` : "";
  const table = (cols, rows) => rows && rows.length ? `<table><thead><tr>${cols.map(c => `<th>${esc(c[1])}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(typeof c[2] === "function" ? c[2](r) : r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p>None.</p>`;
  // Signature block: who released it, and the CFACC (or CFC) approval stamp
  const sig = ctx => `<div class="sig">//SIGNED//<br>${esc(ctx.user?.callsign || "")} — ${esc(ctx.user?.role || "")}<br>CAOC, OPERATION ${esc(ctx.campaign.opName)}
    ${ctx.approval ? `<br><br>APPROVED: ${esc(ctx.approval.by)} (${esc(ctx.approval.role || "CFACC")}) ${esc(window.AOC.zulu(new Date(ctx.approval.when)))}` : "<br><br>NOT YET APPROVED — DRAFT"}</div>${cls(true)}`;

  const P = {};

  // Initial planning conference: CAOC leads + the host Group JFACC, held right after the CFC accepts a campaign.
  // Its decisions drive everything after it — the ACO is built straight from the airspace section.
  const PCON_ITEMS = [
    ["Campaign basics", ["Operation name, theater/map and era confirmed", "First mission date (T-0), start time (Z) and event cadence",
      "Number of events / ATO days and campaign end condition", "Planning timeline and deadlines agreed (see CAOC rollup)"]],
    ["People and channels", ["Group JFACC and deputy confirmed as the CAOC's points of contact", "CAOC leads named for each product (CFACC owns approval)",
      "REDFOR commander (own / other group / CAOC-appointed / none)", "Discord channels for planning, ATO line posts and debrief"]],
    ["Intent and objectives", ["Commander's Intent draft reviewed (purpose, method, end state)", "Key tasks and their priority / weights for targeting",
      "Win, loss and draw conditions are measurable", "ROE posture and default weapons control status"]],
    ["Forces and ATO lines", ["BLUE order of battle, bases / carrier", "Which flights are Human (posted for commitment) vs AI",
      "ATO line request plan: airframes, numbers, mission types", "Support assets: AWACS/GCI, tankers, JTAC, CSAR — Human or AI"]],
    ["REDFOR and threat", ["REDFOR order of battle source (the host .miz)", "Threat level, IADS laydown, Red air (AI / human)"]],
    ["Airspace (feeds the ACO)", ["Area of operations and initial FLOT / FSCL trace", "CAP stations and HVAA (AWACS) orbits",
      "Tanker tracks: locations, size (default 50 × 20 NM), altitudes", "Kill boxes, ROZs, MRR corridors, restricted areas",
      "Artillery / fire support areas and MAXORDs"]],
    ["Targeting", ["AO (Area of Operations) for target nomination (box or point + radius)", "Target priorities and collateral restrictions",
      "TDP depth: which grades get full target folders"]],
    ["Comms (built last)", ["SRS server and tactical nets needed (TAC COORD, TAC ADMIN, C2, A/A, tankers, JTAC, rescue)",
      "Spare channels per net; airfield / ATC frequencies stay out of the comm plan", "Datalink / IFF conventions"]],
    ["SPINS inputs", ["Weapons restrictions", "Code words and authentication", "CSAR plan and divert fields"]],
    ["Mission file and products", ["Host .miz due date and version (CAOC extracts BLUE flights and REDFOR from it)",
      "Mods / scripts required", "Products wanted (default: all CAOC products)", "Publish date and how the host receives the package"]]
  ];
  P.pcon = {
    code: "PCON", name: "Planning Conference", owner: "CFACC / host JFACC", stage: 1,
    desc: "Initial planning conference checklist with the host JFACC — its airspace decisions build the ACO.",
    fields: [
      { type: "section", label: "Conference" },
      { key: "date", label: "Held (DTG)", type: "text", half: true },
      { key: "attendees", label: "Attendees", type: "text", half: true, hint: "Host JFACC, deputy, CFACC, product leads" },
      { key: "items", label: "Checklist", type: "checklist", items: PCON_ITEMS },
      { key: "actions", label: "Action items", type: "table", columns: [
        { key: "action", label: "Action" }, { key: "owner", label: "Owner", w: 120 }, { key: "due", label: "Due", w: 110 }] },
      { key: "notes", label: "Other notes", type: "textarea" }
    ],
    render: (d, ctx) => {
      const items = d.items || [], done = items.filter(x => x.done).length;
      const bySec = {}; items.forEach(x => (bySec[x.section] = bySec[x.section] || []).push(x));
      return `${head("INITIAL PLANNING CONFERENCE", ctx, esc(d.date))}
      ${kv([["ATTENDEES", d.attendees], ["COVERED", `${done} of ${items.length} items`]])}
      ${Object.entries(bySec).map(([s, xs]) => `<h2>${esc(s.toUpperCase())}</h2><table><tbody>${xs.map(x =>
        `<tr><td style="width:24px;text-align:center">${x.done ? "☑" : "☐"}</td><td>${esc(x.item)}</td><td>${esc(x.notes)}</td></tr>`).join("")}</tbody></table>`).join("")}
      <h2>ACTION ITEMS</h2>${table([["action", "ACTION"], ["owner", "OWNER"], ["due", "DUE"]], d.actions)}
      ${para("NOTES", d.notes)}${sig(ctx)}`;
    }
  };

  P.ci = {
    code: "CI", name: "Commander's Intent", owner: "Campaign JFACC / Strategy", stage: 1,
    desc: "JFACC purpose, method and end state that frames every other product.",
    fields: [
      { type: "section", label: "Header" },
      { key: "commander", label: "Issuing commander", type: "text", half: true },
      { key: "dtg", label: "Date-time group", type: "text", half: true, hint: "e.g. 121200ZOCT26" },
      { type: "section", label: "Intent" },
      { key: "purpose", label: "Purpose", type: "textarea" },
      { key: "method", label: "Method", type: "textarea" },
      { key: "endstate", label: "End state", type: "textarea" },
      { key: "keytasks", label: "Key tasks", type: "list" },
      { type: "section", label: "Limitations & risk" },
      { key: "constraints", label: "Constraints (must do)", type: "textarea" },
      { key: "restraints", label: "Restraints (must not do)", type: "textarea" },
      { key: "risk", label: "Acceptable risk", type: "textarea" }
    ],
    render: (d, ctx) => `${head("JFACC COMMANDER'S INTENT", ctx, esc(d.dtg))}
      ${kv([["FROM", d.commander], ["TO", "All participating groups"], ["CAMPAIGN PHASE", ctx.campaign.phase]])}
      ${para("1. PURPOSE", d.purpose)}${para("2. METHOD", d.method)}${para("3. END STATE", d.endstate)}
      ${d.keytasks?.length ? `<h2>4. KEY TASKS</h2><ol>${d.keytasks.map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
      ${para("5. CONSTRAINTS", d.constraints)}${para("6. RESTRAINTS", d.restraints)}${para("7. ACCEPTABLE RISK", d.risk)}
      ${sig(ctx)}`
  };

  // AOD objectives: the CI key tasks in priority order (effect from the task's verb, missions from what it attacks, and
  // its JIPTL targets), then any objectives the JFACC adds by hand
  const VERB = [[/destroy|sink/i, "Destroy"], [/neutrali[sz]e|suppress/i, "Neutralise"], [/disrupt/i, "Disrupt"], [/deny/i, "Deny"], [/interdict|isolate|turn back/i, "Interdict"],
    [/attrit|degrade/i, "Attrit"], [/protect|defend|maintain|establish/i, "Protect"], [/support|provide|cas/i, "Support"]];
  const MSN_FOR = [[/SAM|AAA|Early warning/, "SEAD/DEAD"], [/Airfield|Aircraft/, "OCA"], [/Infrastructure|Logistics|Ammo/, "AI"], [/Naval|anti-ship/, "Maritime strike"],
    [/C2/, "Strike"], [/Armor|Ground|Dismounts|Artillery|Surface-to-surface/, "AI"]];
  function aodObjectives(d, ctx) {
    const cid = ctx.campaign.id, rows = window.AOC.Store.content(cid, "jiptl")?.rows || [];
    const auto = window.AOC.keyTasks(cid).map(t => {
      const tg = rows.filter(r => String(r.task) === t.n).map(r => r.id);
      const msn = [...new Set((t.cats || []).map(c => MSN_FOR.find(([re]) => re.test(c))?.[1]).filter(Boolean))];
      const kind = t.kind || ((t.cats || []).length ? "targets" : /cas|close air/i.test(t.name) ? "continuous" : /dca|defend|protect/i.test(t.name) ? "no targets" : "");
      return { pri: `KT ${t.n}`, objective: t.name, effect: VERB.find(([re]) => re.test(t.name))?.[1] || "",
        tasks: kind === "continuous" ? "CAS, XCAS (continuous)" : kind === "no targets" ? "DCA" : `${msn.join(", ")}${tg.length ? ` — ${tg.join(", ")}` : ""}` };
    });
    return [...auto, ...(d.objectives || []).filter(o => o.objective && !auto.some(a => a.objective === o.objective))];
  }
  P.aod = {
    code: "AOD", name: "Air Operations Directive", owner: "Strategy", stage: 2,
    desc: "Daily JFACC guidance: objectives, priorities and apportionment for an ATO period.",
    fields: [
      { type: "section", label: "Period" },
      { key: "atoDay", label: "ATO day", type: "text", half: true },
      { key: "period", label: "Effective period", type: "text", half: true },
      { key: "guidance", label: "JFACC guidance", type: "textarea" },
      { type: "section", label: "Objectives & priorities" },
      { key: "objectives", label: "Objectives", type: "table", columns: [
        { key: "pri", label: "Pri", w: 50 }, { key: "objective", label: "Objective" },
        { key: "effect", label: "Effect", type: "select", options: ["Destroy", "Neutralise", "Disrupt", "Deny", "Interdict", "Support", "Protect"] },
        { key: "tasks", label: "Tasks" }] },
      { key: "apportionment", label: "Apportionment (weight of effort)", type: "table", columns: [
        { key: "mission", label: "Mission", type: "select", options: ["DCA", "OCA", "SEAD/DEAD", "AI", "CAS", "ISR", "AR", "CSAR", "Airlift"] },
        { key: "pct", label: "% of sorties", w: 110 }] },
      { type: "section", label: "Guidance" },
      { key: "targeting", label: "Targeting guidance", type: "textarea" },
      { key: "notes", label: "Additional notes / SPINS references", type: "textarea" }
    ],
    render: (d, ctx) => {
      const total = (d.apportionment || []).reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
      return `${head("AIR OPERATIONS DIRECTIVE", ctx, `ATO DAY ${esc(d.atoDay)}`)}
      ${kv([["EFFECTIVE", d.period]])}
      ${para("1. JFACC GUIDANCE", d.guidance)}
      <h2>2. OBJECTIVES (PRIORITY ORDER)</h2>${table([["pri", "PRI"], ["objective", "OBJECTIVE"], ["effect", "EFFECT"], ["tasks", "TASKS"]], aodObjectives(d, ctx))}
      <h2>3. APPORTIONMENT</h2>${table([["mission", "MISSION"], ["pct", "% SORTIES"]], d.apportionment)}
      <p>TOTAL: ${total}%${total !== 100 ? "  *** DOES NOT SUM TO 100% ***" : ""}</p>
      ${para("4. TARGETING GUIDANCE", d.targeting)}${para("5. NOTES", d.notes)}${sig(ctx)}`;
    }
  };

  // Rows are usually generated on the Target nomination page (targeting.html, the 639CAOC pipeline):
  // ranked by Key Task weight + value tier, capped per task, numbered T10001…, then re-graded here.
  P.jiptl = {
    code: "JIPTL", name: "Joint Integrated Prioritized Target List", owner: "ISR & Targeting", stage: 3, nomination: true,
    desc: "Ranked targets for the cycle, scored by key task and value tier from the REDFOR order of battle.",
    fields: [
      { key: "rows", label: "Targets (top row = highest priority — use ↑ ↓ to re-rank)", type: "table", rank: true, columns: [
        { key: "id", label: "Target #", w: 80 }, { key: "name", label: "Target" },
        { key: "task", label: "Key task", type: "select", w: 70,
          get options() { const A = window.AOC; return A.keyTasks(new URLSearchParams(location.search).get("c") || A.Store.currentCampaignId()).map(t => t.n); } },
        { key: "grade", label: "Grade", type: "select", options: ["A", "B", "C", "D"], w: 60 },
        { key: "cat", label: "Category" },
        { key: "loc", label: "Location" },
        { key: "effect", label: "Desired effect", w: 110 }] }
    ],
    render: (d, ctx) => {
      const rows = (d.rows || []).map((r, i) => ({ ...r, task: r.task || r.obj, _r: i + 1 }));
      const kt = d.cycle?.keyTasks;
      return `${head("JOINT INTEGRATED PRIORITIZED TARGET LIST", ctx, `ATO DAY ${esc(ctx.campaign.atoDay)}`)}
      ${d.cycle ? kv([["AO (AREA OF OPERATIONS)", d.cycle.bma || "Whole theater"], ["NOMINATED", d.cycle.generated ? window.AOC.zulu(new Date(d.cycle.generated)) : ""]]) : ""}
      ${(() => { const ks = window.AOC.keyTasks(ctx.campaign.id); if (!ks.length) return "";
        const covers = t => t.cats?.length ? t.cats.join(", ") : t.kind === "continuous" ? "Continuous (CAS/TST) — not ranked" : t.kind === "no targets" ? "No planned targets" : "";
        const live = (t, v) => !t.kind || t.kind === "targets" ? String(v ?? "") : "—";
        return `<h2>KEY TASKS (COMMANDER'S INTENT)</h2>${table([["n", "KT"], ["name", "KEY TASK"], ["_c", "TARGETS IT COVERS", covers], ["weight", "WEIGHT", t => live(t, t.weight)], ["cap", "CAP", t => live(t, t.cap)],
          ["_t", "ON JIPTL", t => String(rows.filter(r => String(r.task) === t.n).length)]], ks)}`; })()}
      <h2>TARGETS</h2>
      ${table([["_r", "RANK", r => r._r], ["id", "TGT #"], ["name", "TARGET"], ["task", "KT", r => r.task ? `KT ${r.task}` : "—"], ["grade", "GRADE"], ["cat", "CATEGORY"], ["loc", "LOCATION"], ["effect", "EFFECT"]], rows)}
      <p>Grades: A = must service this cycle, B = service if capacity allows, C/D = opportunity. KT = the Commander's Intent key task the target serves. CAS/TST is continuous and not ranked.</p>${sig(ctx)}`;
    }
  };

  // TDP book: one target folder per JIPTL target (content.tdp.folders[targetId]), built on tdp.html.
  // TDP_FOLDER lists the fields of one folder; the book is approved and released as one product.
  const TDP_FOLDER = [
      { type: "section", label: "Target" },
      { key: "targetId", label: "Target ID", type: "jiptl", half: true, hint: "Pick from the JIPTL or type a new ID" },
      { key: "name", label: "Target name", type: "text", half: true },
      { key: "category", label: "Category", type: "text", half: true },
      { key: "elev", label: "Elevation", type: "text", half: true },
      { key: "coords", label: "Lat / Long", type: "text", half: true },
      { key: "mgrs", label: "MGRS", type: "text", half: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "effect", label: "Desired effect", type: "textarea" },
      { type: "section", label: "Weaponeering" },
      { key: "dmpis", label: "Desired mean points of impact (DMPIs)", type: "table", columns: [
        { key: "id", label: "DMPI", w: 60 }, { key: "desc", label: "Description" }, { key: "coords", label: "Coordinates" }, { key: "weapon", label: "Weapon" }] },
      { key: "threats", label: "Threats in target area", type: "table", columns: [
        { key: "sys", label: "System" }, { key: "loc", label: "Location" }, { key: "range", label: "Range / alt" }] },
      { type: "section", label: "Considerations" },
      { key: "cde", label: "CDE level", type: "select", options: ["1", "2", "3", "4", "5"], half: true, hint: "Per the ROE; printed on the ATO line" },
      { key: "collateral", label: "Collateral / attack restrictions", type: "textarea" },
      { key: "imagery", label: "Imagery & intel sources", type: "textarea" },
      { key: "bda", label: "BDA requirements", type: "textarea" }
  ];
  // older single-folder TDPs (targetId at the top level) read as a one-folder book
  const tdpFolders = d => d.folders ? Object.values(d.folders) : d.targetId ? [d] : [];
  const folderHtml = f => `<h2>TP ${esc(f.targetId)} — ${esc((f.name || "").toUpperCase())}${f.grade ? ` · GRADE ${esc(f.grade)}` : ""}</h2>
      ${kv([["TARGET ID", f.targetId], ["CATEGORY", f.category], ["LAT/LONG", f.coords], ["MGRS", f.mgrs], ["ELEVATION", f.elev], ["CDE", f.cde ? `CDE ${f.cde}` : "Not assessed"], ["STATUS", f.status === "ready" ? "Ready" : "Draft"]])}
      ${para("Description", f.description)}${para("Desired effect", f.effect)}
      <h2>DMPIs</h2>${table([["id", "DMPI"], ["desc", "DESCRIPTION"], ["coords", "COORDINATES"], ["weapon", "WEAPON"]], f.dmpis)}
      <h2>Threats in target area</h2>${table([["sys", "SYSTEM"], ["loc", "LOCATION"], ["range", "RANGE/ALT"]], f.threats)}
      ${para("Collateral / restrictions", f.collateral)}${para("Imagery & sources", f.imagery)}${para("BDA requirements", f.bda)}`;
  P.tdp = {
    code: "TDP", name: "Target Development Packages", owner: "ISR & Targeting", stage: 3, page: { href: "tdp.html", label: "Open TDP book" },
    desc: "Target folders for the JIPTL's priority targets: description, DMPIs, threats, weaponeering and restrictions.",
    folderFields: TDP_FOLDER, fields: [],
    render: (d, ctx) => {
      const fs = tdpFolders(d).sort((a, b) => (a.status === "ready" ? 0 : 1) - (b.status === "ready" ? 0 : 1));
      return `${head("TARGET DEVELOPMENT PACKAGES", ctx, `${fs.length} target folder${fs.length === 1 ? "" : "s"}`)}
      ${table([["targetId", "TGT #"], ["name", "TARGET"], ["grade", "GRADE"], ["category", "CATEGORY"], ["_s", "STATUS", f => f.status === "ready" ? "Ready" : "Draft"]], fs)}
      ${fs.map(folderHtml).join("")}${sig(ctx)}`;
    }
  };

  // ATO in USMTF message format (after the AIR TASKING ORDER guide and the 510th vFS ATO example), built from the
  // ATO lines plus what the site already holds: JIPTL targets, theater-map tanker tracks, the AEW line, OPTASKLINK STNs.
  // Sets: TASKUNIT per unit; AMSNDAT / MSNACFT per line (MSNACFT ends STN / Mode 1 / Mode 2 / Mode 3 as 1xx, 2xxxx, 3xxxx).
  const NET_OF = { SEAD: "SEAD", DEAD: "SEAD", Strike: "STRIKE", AI: "STRIKE", DCA: "DCA", OCA: "DCA", Escort: "DCA", CAS: "CAS COORD", SCAR: "SCAR", CSAR: "PRCC" };
  const LEAD_ORDER = ["Strike", "AI", "DEAD", "SEAD", "CAS", "SCAR"];
  function atoMessage(d, ctx) {
    const S = window.AOC.Store, cid = ctx.campaign.id, rows = d.missions || [];
    const up = v => String(v ?? "").toUpperCase().trim(), dash = v => up(v) && up(v) !== "—" ? up(v) : "-";
    const cs = c => { const m = up(c).match(/^([A-Z]+)\s*(\d)$/); return m ? `${m[1]}${m[2]}1` : dash(up(c).replace(/\s+/g, "")); };
    const unit = r => r.group ? up(ctx.group(r.group)?.name || r.group) : r.crew === "AI" ? "AI - HOST MISSION FILE" : "OPEN - NOT YET COMMITTED";
    const jiptl = S.content(cid, "jiptl")?.rows || [], shapes = S.content(cid, "map")?.shapes || [];
    // ALR: the line's own, else the SPINS default; CDE: the target's TDP folder
    const alr = S.content(cid, "spins")?.alr || "Medium", tdpOf = id => S.content(cid, "tdp")?.folders?.[id];
    // the theater-map shape a line flies in: its tanker track / orbit by callsign, else an area (CAP, kill box) by name
    const areaOf = r => (["AR", "AEW"].includes(r.role) && shapes.find(t => t.callsign && up(t.callsign) === up(r.callsign))) || shapes.find(t => up(t.name) === up(r.target));
    const viper = S.content(cid, "optasklink")?.viper || [], awacs = rows.find(r => r.role === "AEW");
    // control nets from the Comm Plan: the mission's own net as primary, check-in as secondary
    const chans = channels(S.content(cid, "acp")?.matrix), net = role => NET_OF[role] && chans.find(c => up(c.role).startsWith(NET_OF[role]));
    const desig = c => c ? `${up(c.id)} ${dash(c.callsign)}`.replace(/ -$/, "") : "-", checkIn = chans.find(c => up(c.role) === "CHECK IN");
    const times = t => { const [a, b] = String(t || "").split(/[–-]/).map(x => x.trim()); return [dash(a && (/Z$/i.test(a) ? a : `${a}Z`)), dash(b)]; };
    const byCs = c => rows.find(x => up(x.callsign) === up(c));
    // package commander: the first striker in the package (strike, AI, DEAD, SEAD, CAS), else the lowest mission number
    const pkgLead = p => rows.filter(x => x.pkg === p).sort((x, y) => (LEAD_ORDER.indexOf(x.role) + 1 || 99) - (LEAD_ORDER.indexOf(y.role) + 1 || 99) || String(x.msn).localeCompare(String(y.msn)))[0];
    const [from, to] = String(d.period || "").split(/\s*[–-]\s*(?=\d)/);
    const out = [`OPER/OPERATION ${up(ctx.campaign.opName)}//`, `MSGID/ATO/639TH VCAOC/DAY ${dash(d.atoDay)}//`, "AMPN/ALL TIMES ARE Z//",
      to ? `TIMEFRAM/${up(from)}/TO:${up(to)}//` : `TIMEFRAM/${dash(d.period)}//`];
    [...new Set(rows.map(unit))].forEach(u => {
      out.push("", `TASKUNIT/${u}//`);
      rows.filter(r => unit(r) === u).forEach(r => {
        const pkg = r.pkg && r.pkg !== "—" ? up(r.pkg) : "", stn = viper.find(v => v.msn === r.msn && v.lead)?.stn;
        out.push("", `AMSNDAT/N/${dash(r.msn)}/-/${pkg || "-"}/-/${dash(r.role)}/-/-/DEPLOC:-/ARRLOC:-//`,
          `MSNACFT/${dash(r.num)}/${dash(r.type)}/${cs(r.callsign)}/-/-/${stn || "-"}/${r.m1 ? `1${r.m1}` : "-"}/${r.m2 ? `2${r.m2.split(/[–-]/)[0]}` : "-"}/${r.m3 ? `3${r.m3}` : "-"}//`);
        if (pkg) { const l = pkgLead(r.pkg); out.push(`PKGCMD/${pkg}/${unit(l)}/${l.msn}/${cs(l.callsign)}//`); }
        if (awacs && r !== awacs && r.role !== "AR") out.push(`CONTROLA/AWAC/${cs(awacs.callsign)}/PDESIG:${desig(net(r.role))}/SDESIG:${desig(checkIn)}//`);
        const tgt = jiptl.find(t => t.id === r.target), tk = !tgt && areaOf(r);
        const [t1, t2] = times(r.tot);
        if (tgt) out.push(`GTGTLOC/P/TOT:${t1}/-/-/${up(tgt.name)}//`, `TGTS/${up(tgt.id)}/${dash(tgt.cat)}/${dash(tgt.loc)}/${dash(tgt.effect)}//`);
        else out.push(`AMSNLOC/${t1}/${t2}/${dash(tk?.name || r.target)}/${tk?.altLo ? `${dash(tk.altLo)}${tk.altHi ? `-${dash(tk.altHi)}` : ""}` : "-"}//`);
        const cde = tgt && tdpOf(tgt.id)?.cde;
        const kt = tgt && window.AOC.keyTaskOf(cid, tgt.id);
        out.push(`AMPN/ALR:${up(alr)}${cde ? ` CDE:${cde}` : ""}${kt ? ` KEY TASK:${kt.n}` : ""}//`);
        if (tk?.type === "TANKER TRACK") out.push(`REFTSK/-/-/-/PFREQ:${dash(tk.freq)}/-/${tk.tacanCh ? `${tk.tacanCh}${up(tk.tacanMode)}` : "-"}//`);
        if (r.role === "AEW") out.push(`ASACSDAT/AWAC/${cs(r.callsign)}/AWACS/AEW//`);
        const tanker = r.tanker && r.tanker !== "—" ? byCs(r.tanker) : null;
        if (r.tanker && r.tanker !== "—") out.push(`ASUPTFOR/REFUELING/${tanker ? unit(tanker) : "-"}/${tanker?.msn || "-"}/${cs(r.tanker)}/1/${dash(tanker?.type)}//`);
        if (r.role === "AR") rows.filter(x => x.tanker && up(x.tanker) === up(r.callsign)).forEach(x => out.push(`ASUPTBY/${dash(x.role)}/${unit(x)}/${x.msn}/${cs(x.callsign)}/${dash(x.num)}/${dash(x.type)}//`));
      });
    });
    return out.join("\n");
  }

  // quick summary of the same ATO: human lines first, then AI. Crew = the line's own, else flown by a group = human
  // (unless the group is an AI support cell); open lines with no group are human lines waiting for a unit.
  function atoSummary(d, ctx) {
    const rows = d.missions || [], n = rows.reduce((s, r) => s + (parseInt(r.num) || 0), 0);
    const human = r => atoHuman(r, ctx.group);
    const pkgs = [...new Set(rows.map(r => r.pkg).filter(p => p && p !== "—"))].sort();
    const cols = [["msn", "MSN #"], ["callsign", "CALLSIGN", r => r.callsign || "TBD"], ["group", "UNIT", r => r.group ? ctx.group(r.group)?.name || r.group : human(r) ? "OPEN" : "AI"],
      ["type", "ACFT", r => `${r.num || ""}x${r.type || ""}`], ["role", "MISSION"], ["pkg", "PKG", r => r.pkg && r.pkg !== "—" ? r.pkg : ""], ["tot", "TOT / ON-STA"], ["target", "TGT / AREA"],
      ["tanker", "TANKER", r => r.tanker && r.tanker !== "—" ? r.tanker : ""], ["m1", "M1"], ["m3", "M3"]];
    const h = rows.filter(human), ai = rows.filter(r => !human(r));
    // which key tasks this ATO's strike lines serve
    const A = window.AOC, byKt = {};
    rows.forEach(r => { const t = r.target && A.keyTaskOf(ctx.campaign.id, r.target); if (t) (byKt[t.n] = byKt[t.n] || { t, n: 0 }).n++; });
    const kts = Object.values(byKt).sort((a, b) => a.t.n - b.t.n);
    return `<h2>SUMMARY</h2><p>ATO day ${esc(d.atoDay)}, ${esc(d.period)}: ${rows.length} missions, ${n} aircraft${pkgs.length ? `, packages ${pkgs.map(esc).join(", ")}` : ""}.</p>
      ${kts.length ? `<p>Key tasks served: ${kts.map(k => `${esc(A.keyTaskLabel(k.t))} (${k.n} line${k.n > 1 ? "s" : ""})`).join("; ")}.</p>` : ""}
      <h2>HUMAN (${h.length})</h2>${table(cols, h)}<h2>AI (${ai.length})</h2>${table(cols, ai)}`;
  }

  // human line: its own crew, else flown by a group (unless the group is an AI support cell); open lines are human
  const atoHuman = (r, group) => r.crew ? r.crew === "Human" : !r.group || !/\(AI\)/.test(group(r.group)?.airframes || "");
  const ATO_COLS = [
    { key: "msn", label: "Msn #", w: 70 }, { key: "pkg", label: "Pkg", w: 50 },
    { key: "group", label: "Group", type: "groups" }, { key: "callsign", label: "Callsign" },
    { key: "type", label: "Acft", type: "acft", w: 110 },
    { key: "role", label: "Mission", type: "select", options: ["DCA", "OCA", "SEAD", "DEAD", "AI", "CAS", "SCAR", "Escort", "Strike", "ISR", "AR", "AEW", "CSAR", "Airlift"] },
    { key: "tot", label: "TOT / On-sta", w: 90 }, { key: "target", label: "Target / Area", type: "jiptl" }];
  P.ato = {
    code: "ATO", name: "Air Tasking Order", owner: "Combat Plans", stage: 5,
    desc: "Mission-by-mission tasking for each participating group for one ATO day.",
    fields: [
      { type: "section", label: "Period" },
      { key: "atoDay", label: "ATO day", type: "text", half: true },
      { key: "period", label: "Effective period", type: "text", half: true },
      // one list of missions, edited as two grids: human lines, then AI lines. Crew comes from the grid a line was added in
      // (newRow); IFF codes are set by "Assign IFF codes" and shown on the ATO and the IFF / SIF page
      { type: "section", label: "Missions" },
      { key: "missions", label: "Human lines", type: "table", columns: ATO_COLS, show: (r, group) => atoHuman(r, group), newRow: { crew: "Human" } },
      { key: "missions", label: "AI lines", type: "table", columns: ATO_COLS, show: (r, group) => !atoHuman(r, group), newRow: { crew: "AI" }, iffPanel: true }
    ],
    render: (d, ctx) => `${head("AIR TASKING ORDER", ctx, `ATO DAY ${esc(d.atoDay)}`)}
      <pre class="msg">${esc(atoMessage(d, ctx))}</pre>
      ${atoSummary(d, ctx)}${sig(ctx)}`
  };

  P.aco = {
    code: "ACO", name: "Airspace Control Order", owner: "Airspace", stage: 5, mapLink: true,
    desc: "Airspace coordination measures (CAPs, AR tracks, ROZs, kill boxes) for the ATO period.",
    fields: [
      { key: "period", label: "Effective period", type: "text" },
      { key: "measures", label: "Airspace coordination measures", type: "table", columns: [
        { key: "name", label: "Name" },
        { key: "type", label: "Type", type: "select", options: ["CAP", "AR Track", "Kill Box", "ROZ", "HIDACZ", "MRR", "SAAFR", "Restricted Area", "FSCL", "Corridor"] },
        { key: "geo", label: "Geometry" }, { key: "alt", label: "Altitudes" },
        { key: "time", label: "Effective" }, { key: "ctrl", label: "Controlling agency" }] }
    ],
    render: (d, ctx) => `${head("AIRSPACE CONTROL ORDER", ctx, `ATO DAY ${esc(ctx.campaign.atoDay)}`)}
      ${kv([["EFFECTIVE", d.period]])}
      <h2>AIRSPACE COORDINATION MEASURES</h2>
      ${table([["name", "NAME"], ["type", "TYPE"], ["geo", "GEOMETRY"], ["alt", "ALTITUDE"], ["time", "EFFECTIVE"], ["ctrl", "CONTROL"]], d.measures)}
      ${sig(ctx)}`
  };

  // ---------- SPINS and ROE: two documents, one approval ----------
  // The ROE is the vCAOC standing ROE (tools/jceoi/data/roe.json) plus the campaign's declared hostile forces, default WCS,
  // measures, ID / commit criteria, weapons restrictions, restricted targets, theater rules and remarks. The SPINS are the
  // JFACC's procedures and point to it. Both follow the OMS / Red Flag SPINS layout.
  const ROE = () => window.AOC_JCEOI?.roe;
  const roeMeasureOn = (d, m) => d.roeMeasures?.[m.id] ?? m.on;
  const alrOf = d => d.alr || "Medium";
  // CDE level text with the campaign's approval authorities and authentication word filled in
  const cdeFill = (d, t) => { const def = ROE()?.cde?.defaults || {};
    return t.replace("{cde4}", d.cde4Auth || def.cde4).replace("{cde5}", d.cde5Auth || def.cde5).replace("{auth}", d.cdeAuth || def.auth); };
  const roeAwacs = ctx => (window.AOC.Store.content(ctx.campaign.id, "ato")?.missions || []).find(m => m.role === "AEW")?.callsign || "the AWACS";
  function spinsDoc(d, ctx) {
    const day = window.AOC_JCEOI?.tdl?.atoDayStartZ ?? 3, z = h => `${String(h).padStart(2, "0")}00Z`, zEnd = h => `${String((h + 23) % 24).padStart(2, "0")}59Z`;
    const iff = d.mode4 || d.iffProc || (d.iffOff || []).length || iffRules(ctx).length;
    return `${head("SPECIAL INSTRUCTIONS (SPINS)", ctx, esc(d.version))}
      <h2>1. GENERAL INFORMATION</h2>${kv([["VALIDITY", d.period], ["TIME ZONE", "Zulu (Z) throughout"], ["ATO DAY", `${z(day)} to ${zEnd(day)}`], ["BULLSEYE", d.bullseye], ["DEFAULT ALR", alrOf(d).toUpperCase()]])}
      ${ROE()?.alr ? `<h2>1.1 ACCEPTABLE LEVEL OF RISK (ALR)</h2><p>Applies to every ATO line; the ATO prints it with each mission.</p>
        ${table([["l", "ALR"], ["t", "MEANING"]], ROE().alr.levels.map(x => ({ l: x.level === alrOf(d) ? `${x.level.toUpperCase()} (DEFAULT)` : x.level.toUpperCase(), t: x.text })))}` : ""}
      <h2>2. RULES OF ENGAGEMENT</h2><p>Per the OP ${esc(ctx.campaign.opName)} ROE${d.version ? ` ${esc(d.version)}` : ""}, published with these SPINS. Default weapons control status: ${esc((d.wcs || "Weapons Tight").toUpperCase())}.</p>
      <h2>3. COMMUNICATION</h2>${para("3.1 CHECK-IN & COMM PROCEDURES", d.checkin)}
      <h2>3.2 CODE WORDS</h2>${table([["word", "CODE WORD"], ["meaning", "MEANING / ACTION"]], d.codewords)}
      ${para("3.3 AUTHENTICATION", d.auth)}${para("3.4 CSAR", d.csar)}
      ${iff ? `<h2>3.5 IFF / SIF</h2>${kv([["MODE 4", d.mode4]])}${d.iffProc ? `<p>${esc(d.iffProc)}</p>` : ""}
        ${iffRules(ctx).length ? `<p><b>${esc(ctx.campaign.theater.toUpperCase())}:</b> ${iffRules(ctx).map(esc).join(" ")}</p>` : ""}
        ${(d.iffOff || []).length ? table([["area", "IFF-OFF AREA"], ["alt", "ALTITUDES"], ["time", "TIMES"], ["notes", "NOTES"]], d.iffOff) : ""}` : ""}
      <h2>4. AIRSPACE &amp; SAFETY</h2>${para("4.1 AIR REFUELLING", d.tanker)}
      ${(d.naval || []).length ? `<h2>4.2 CARRIERS &amp; SHIPS — TACAN / ICLS</h2>${table([["ship", "SHIP"], ["hull", "TYPE"], ["tacan", "TACAN"], ["tacanCs", "IDENT"], ["icls", "ICLS"], ["notes", "NOTES"]],
        d.naval.map(r => ({ ...r, tacan: r.tacanCh ? `${r.tacanCh}${r.tacanMode || ""}` : "" })))}` : ""}
      <h2>4.3 DIVERT AIRFIELDS</h2>${table([["field", "AIRFIELD"], ["tacan", "TACAN"], ["freq", "TWR"], ["rwy", "RWY"], ["notes", "NOTES"]], d.diverts)}
      ${para("4.4 EMERGENCY / LOST COMMS", d.emergency)}${sig(ctx)}`;
  }
  function roeDoc(d, ctx) {
    const R = ROE(); if (!R) return `${head("RULES OF ENGAGEMENT (ROE)", ctx, esc(d.version))}<p>The standing ROE did not load.</p>${sig(ctx)}`;
    const fill = t => t.replace("{awacs}", roeAwacs(ctx)), wcs = d.wcs || "Weapons Tight";
    const on = R.measures.filter(m => roeMeasureOn(d, m)), groups = [...new Set(on.map(m => m.group))];
    const theater = R.theaterRules?.[window.AOC.JCEOI?.theaterKey(ctx.campaign.theater)];
    const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`, paras = (n, a) => a.map((x, i) => `<p><b>${n}.${i + 1} ${esc(x.title.toUpperCase())}.</b> ${esc(fill(x.text))}</p>`).join("");
    const terms = (h, a) => table([["t", h], ["m", "MEANING"]], a.map(([t, m]) => ({ t, m })));
    let n = 5;
    return `${head("RULES OF ENGAGEMENT (ROE)", ctx, esc(d.version))}
      ${kv([["EFFECTIVE", d.period], ["DEFAULT WCS", wcs.toUpperCase()]])}
      <h2>1. GENERAL</h2>${paras(1, R.general)}
      <h2>2. SURFACE ROE</h2><p><b>DECLARED HOSTILE FORCES:</b> ${esc(d.declaredHostile || R.declaredHostileDefault)}</p>${paras(2, R.surface)}
      ${R.cde ? `<p><b>2.${R.surface.length + 1} COLLATERAL DAMAGE ESTIMATE (CDE).</b></p>
        ${table([["l", "CDE"], ["t", "MEANING"], ["a", "CLEARED BY"]], R.cde.levels.map(x => ({ l: x.level, t: x.text, a: cdeFill(d, x.authority) })))}
        ${R.cde.rules.map(x => `<p><b>${esc(x.title.toUpperCase())}.</b> ${esc(cdeFill(d, x.text))}</p>`).join("")}` : ""}
      <p><b>RESTRICTED / NO-STRIKE TARGETS:</b></p>${(d.restricted || []).length ? table([["target", "TARGET / AREA"], ["restriction", "RESTRICTION"]], d.restricted) : "<p>None designated beyond the protected structures above.</p>"}
      <p><b>WEAPONS RESTRICTIONS:</b></p>${table([["weapon", "WEAPON / CATEGORY"], ["status", "STATUS"], ["applies", "APPLIES TO"], ["conditions", "CONDITIONS"]], d.weapons)}${d.weaponsNotes ? `<p>${esc(d.weaponsNotes)}</p>` : ""}
      <h2>3. AIR ROE</h2>${terms("CLASSIFICATION", R.idTerms)}
      <p><b>HOSTILE ACT / HOSTILE INTENT — CRITERIA TO DECLARE HOSTILE.</b> ${esc(R.declareNote || "")}</p>
      <p><b>HOSTILE ACT:</b></p>${list(R.hostileAct)}<p><b>HOSTILE INTENT:</b></p>${list(R.hostileIntent)}
      <p><b>ENEMY INDICATIONS:</b></p>${terms("INDICATION", R.enemyIndications)}
      ${d.idCriteria ? `<p><b>ID AND COMMIT CRITERIA:</b> ${esc(d.idCriteria)}</p>` : ""}
      ${paras(3, R.air)}
      <h2>4. WEAPONS CONTROL STATUS</h2>${table([["t", "STATUS"], ["m", "MEANING"]], R.wcs.map(([t, m]) => ({ t: t === wcs ? `${t.toUpperCase()} (DEFAULT)` : t.toUpperCase(), m })))}
      <h2>5. CAMPAIGN MEASURES</h2>${on.length ? groups.map(g => `<p><b>${esc(g.toUpperCase())}</b></p>${list(on.filter(m => m.group === g).map(m => fill(m.text)))}`).join("") : "<p>None.</p>"}
      ${theater ? `<h2>${++n}. ${esc(ctx.campaign.theater.toUpperCase())}</h2>${list(theater.rules)}` : ""}
      ${d.roe ? para(`${++n}. REMARKS`, d.roe) : ""}${sig(ctx)}`;
  }

  P.spins = {
    code: "SPINS", name: "SPINS & ROE", owner: "Combat Plans", stage: 5,
    desc: "Special instructions (procedures) and the rules of engagement: two documents, one approval.",
    docs: [{ id: "spins", label: "SPINS", code: "SPINS", render: spinsDoc }, { id: "roe", label: "ROE", code: "ROE", render: roeDoc }],
    fields: [
      { type: "section", label: "Both documents" },
      { key: "version", label: "Version", type: "text", half: true, hint: "e.g. v3" },
      { key: "period", label: "Effective period", type: "text", half: true },
      { type: "section", label: "SPINS — general & communication" },
      { key: "bullseye", label: "Bullseye", type: "text", half: true },
      { key: "alr", label: "Default acceptable level of risk (ALR)", type: "select", options: ["Low", "Medium", "High", "Extreme"], half: true, hint: "Blank = Medium; printed on every ATO line" },
      { key: "checkin", label: "Check-in & comm procedures", type: "textarea", hint: "Refer to channels by Comm Plan matrix ID, e.g. YELLOW 1" },
      { key: "codewords", label: "Code words", type: "table", columns: [
        { key: "word", label: "Code word", w: 160 }, { key: "meaning", label: "Meaning / action" }] },
      { key: "auth", label: "Authentication procedures", type: "textarea" },
      { key: "csar", label: "CSAR procedures", type: "textarea" },
      { key: "mode4", label: "Mode 4", type: "text", hint: "Default from the JCEOI IFF plan: code A until 0000Z, then code B" },
      { key: "iffProc", label: "IFF procedures", type: "textarea", hint: "Mode 1 / Mode 3 codes are on each ATO line" },
      { key: "iffOff", label: "IFF-off areas", type: "table", columns: [
        { key: "area", label: "Area" }, { key: "alt", label: "Altitudes", w: 120 }, { key: "time", label: "Times", w: 120 }, { key: "notes", label: "Notes / authority" }] },
      { type: "section", label: "SPINS — airspace & safety" },
      { key: "tanker", label: "Air refuelling procedures", type: "textarea", hint: "Tanker TACANs are set on each tanker track on the theater map" },
      { key: "naval", label: "Carriers & ships — TACAN / ICLS", type: "table", columns: [
        { key: "ship", label: "Ship" }, { key: "hull", label: "DCS type / hull", w: 120 }, { key: "tacanCh", label: "TACAN ch", w: 80 },
        { key: "tacanMode", label: "X/Y", w: 50 }, { key: "tacanCs", label: "Ident", w: 70 }, { key: "icls", label: "ICLS", w: 60 }, { key: "notes", label: "Notes" }] },
      { key: "diverts", label: "Divert airfields", type: "table", columns: [
        { key: "field", label: "Airfield" }, { key: "tacan", label: "TACAN", w: 80 }, { key: "freq", label: "Tower freq", w: 100 },
        { key: "rwy", label: "Runway", w: 80 }, { key: "notes", label: "Notes" }] },
      { key: "emergency", label: "Emergency / lost comms", type: "textarea" },
      { type: "section", label: "ROE — the standing rules apply; set the campaign's choices" },
      { key: "wcs", label: "Default weapons control status", type: "select", options: ["Weapons Tight", "Weapons Hold", "Weapons Free"], half: true },
      { key: "declaredHostile", label: "Declared hostile forces", type: "text", half: true, hint: "Blank = all RED coalition military forces in the AO" },
      { key: "roeMeasures", label: "Campaign measures", type: "measures" },
      { key: "cde4Auth", label: "CDE 4 cleared by", type: "text", half: true, hint: "Blank = the controlling agency" },
      { key: "cde5Auth", label: "CDE 5 cleared by", type: "text", half: true, hint: "Blank = the JFACC" },
      { key: "cdeAuth", label: "CDE 5 authentication word", type: "text", hint: "e.g. the JFACC's initials; blank = passed by the controlling agency" },
      { key: "idCriteria", label: "ID / commit criteria", type: "textarea" },
      { key: "weapons", label: "Restricted / prohibited weapons", type: "table", columns: [
        { key: "weapon", label: "Weapon / category" },
        { key: "status", label: "Status", type: "select", options: ["Prohibited", "Restricted", "JFACC approval required", "Authorised"], w: 150 },
        { key: "applies", label: "Applies to", w: 120 },
        { key: "conditions", label: "Conditions / when" }] },
      { key: "weaponsNotes", label: "Additional weapons guidance", type: "textarea", hint: "e.g. jettison areas, hung ordnance, minimum release altitudes" },
      { key: "restricted", label: "Restricted / no-strike targets", type: "table", columns: [{ key: "target", label: "Target / area" }, { key: "restriction", label: "Restriction" }] },
      { key: "roe", label: "ROE remarks", type: "textarea", hint: "Anything the standing ROE and measures do not cover" }
    ],
    render: (d, ctx) => `${spinsDoc(d, ctx)}<div class="pagebreak"></div>${roeDoc(d, ctx)}`
  };

  // theater IFF rules (e.g. NTTR) from the JCEOI IFF plan, when the page has it
  const iffRules = ctx => window.AOC.IFF ? window.AOC.IFF.theaterRules(window.AOC.JCEOI?.theaterKey(ctx.campaign.theater)) : [];
  // the campaign's IFF plan for the Comm Plan document: how Mode 3/A follows Mode 1, and the Mode 1 table
  const iffPlanHtml = ctx => {
    const I = window.AOC.IFF; if (!I) return "";
    return `<h2>IFF / SIF</h2>${kv([["MODE 3/A", "Starts with the line's Mode 1 code: SEAD 30 → 3011–3017, 3021–3027 …"],
      ["MODE 3/A PER LINE", "Lead = slot code ending in 1; last member of a non-standard flight = lead + (n − 1); others standby"],
      ["MODE 1", ctx.campaign.iff?.rotateMode1 ? "By mission type, sub-role digit rotates each ATO day" : "By mission type"], ["MODE 4", "Per SPINS"]])}
      ${table([["family", "MISSION FAMILY"], ["codes", "MODE 1 CODES"]], I.data.mode1.families.map(f => ({ family: `${f.digit}x ${f.family}`, codes: f.codes.map(([c, r]) => `${c} ${r}`).join(" · ") })))}`;
  };

  // Comm matrix colors: [background, ink]. Fixed so the printed product looks the same in every theme.
  const COMM_COLORS = {
    WHITE: ["#ffffff", "#000000"], BLUE: ["#2e5f98", "#ffffff"], YELLOW: ["#ffff00", "#000000"], GREEN: ["#00a83c", "#ffffff"],
    PURPLE: ["#7030a0", "#ffffff"], RED: ["#c00000", "#ffffff"], ORANGE: ["#f28c28", "#000000"], GRAY: ["#a6a6a6", "#000000"], BLACK: ["#1a1a1a", "#ffffff"]
  };
  const cellStyle = color => { const [bg, ink] = COMM_COLORS[color] || COMM_COLORS.WHITE; return `background:${bg};color:${ink}`; };
  // New comm plans start from the tactical-spectrum template: no Guard (standard everywhere) and no airfield/ATC
  // frequencies; every net keeps spare rows, plus a whole spare net.
  const COMM_TEMPLATE = [
    ["TAC ADMIN", "WHITE", ["TAC COORD", "TAC ADMIN", "C2 / AWACS", "GCI", "HOST C2", "SPARE"]],
    ["TANKERS", "BLUE", ["BOOM 1", "BOOM 2", "DROGUE 1", "DROGUE 2", "MPRS", "SPARE"]],
    ["TACTICAL AIR", "YELLOW", ["CHECK IN", "PKG COMMON", "STRIKE", "SEAD", "DCA", "SPARE"]],
    ["RESCUE", "GREEN", ["CSAR / PRCC", "RESCORT", "SAR", "ISR", "SPARE", "SPARE"]],
    ["GROUND COORD", "PURPLE", ["ASOC", "JTAC/FAC(A) 1", "JTAC/FAC(A) 2", "JTAC/FAC(A) 3", "CAS COORD", "SPARE"]],
    ["SPARES", "GRAY", ["SPARE", "SPARE", "SPARE", "SPARE", "SPARE", "SPARE"]]
  ];
  // A new Comm Plan is the template with the JCEOI standard frequencies filled in (when the JCEOI is loaded and was
  // built from this same template); campaign-specific changes are made from there.
  const blankMatrix = theater => {
    const J = window.AOC.JCEOI?.inSync ? window.AOC.JCEOI : null, tp = J?.plan(J.theaterKey(theater));
    if (tp) return structuredClone(tp.caoc.matrix);   // e.g. Nevada: the CAOC's NTTR comm matrix, built on the NTTR assignments
    return { rows: Math.max(...COMM_TEMPLATE.map(t => t[2].length)), columns: COMM_TEMPLATE.map(([title, color, roles]) => ({ title, color, cells: roles.map((role, i) => {
      const n = J?.net(`${color} ${i + 1}`);
      return n ? { role, ...(n.callsign ? { callsign: n.callsign } : {}), freq: n.uhf.toFixed(3) } : { role };
    }) })) };
  };
  // Every filled cell as a named channel, e.g. WHITE 1 = RAZOR, TAC COORD, 290.050
  const channels = m => (m?.columns || []).flatMap(c => (c.cells || []).slice(0, m.rows).map((cell, i) => ({ id: `${c.color} ${i + 1}`, col: c, ...cell })))
    .filter(ch => ch.role || ch.callsign || ch.freq);

  P.acp = {
    code: "ACP", name: "Comm Plan", owner: "Combat Plans", stage: 5,
    desc: "Campaign comm matrix: colour-coded, numbered channels (e.g. WHITE 1 = RAZOR). Valid for the whole campaign.",
    fields: [
      { type: "section", label: "Header" },
      { key: "matrixName", label: "Matrix name", type: "text", half: true, hint: "Shown as “<name> Comm Matrix”" },
      { key: "srs", label: "SRS server / channel", type: "text", half: true, hint: "Server address shared separately with groups" },
      { type: "section", label: "Comm matrix" },
      { key: "matrix", label: "Channels — columns are colours, rows are numbered top-down", type: "matrix" }
    ],
    render: (d, ctx) => {
      const m = d.matrix || blankMatrix(), cols = m.columns || [];
      const grid = `<table class="cm"><colgroup><col style="width:34px">${cols.map(() => "<col>").join("")}</colgroup><thead>
          <tr><th class="cm-title" colspan="${cols.length + 1}">${esc(d.matrixName || ctx.campaign.opName)} Comm Matrix</th></tr>
          <tr><th class="cm-corner"></th>${cols.map(c => `<th style="${cellStyle(c.color)}">${esc(c.title)}<small>${esc(c.color)}</small></th>`).join("")}</tr></thead>
        <tbody>${Array.from({ length: m.rows }, (_, i) => `<tr><th class="cm-n">${i + 1}</th>${cols.map(c => {
          const x = c.cells?.[i] || {};
          return `<td style="${cellStyle(c.color)}"><div class="r">${esc(x.role)}</div><div class="c">${esc(x.callsign)}</div><div class="f">${esc(x.freq)}</div></td>`;
        }).join("")}</tr>`).join("")}</tbody></table>`;
      return `${head("COMMUNICATIONS PLAN", ctx, "VALID FOR THE DURATION OF THE CAMPAIGN")}
      ${kv([["SRS", d.srs]])}
      <h2>1. COMM MATRIX</h2><div class="cm-wrap">${grid}</div>
      <h2>2. CHANNEL LIST</h2>${table([["_c", "NET", r => r.col.title], ["id", "CHANNEL"], ["callsign", "CALLSIGN"], ["role", "ROLE"], ["freq", "FREQ"]], channels(m))}
      <p>Check-in and comm procedures: see SPINS.</p>${iffPlanHtml(ctx)}${sig(ctx)}`;
    }
  };

  const RESULTS = ["Hit — destroyed", "Hit — damaged", "Hit — unknown", "Miss", "No drop", "Aborted", "Not flown"];
  // BDA against the Commander's Intent: per key task, its JIPTL targets, how many were attacked, and their assessed state
  function bdaByKeyTask(m, b, ctx) {
    const A = window.AOC, cid = ctx.campaign.id, rows = A.Store.content(cid, "jiptl")?.rows || [];
    const ks = A.keyTasks(cid).filter(t => rows.some(r => String(r.task) === t.n));
    if (!ks.length) return "";
    const last = id => [...b].reverse().find(x => x.target === id)?.status || "";
    return `<h2>3. KEY TASK ASSESSMENT</h2>${table([["n", "KT"], ["name", "KEY TASK"], ["_j", "JIPTL TGTS"], ["_a", "ATTACKED"], ["_d", "DESTROYED"], ["_g", "DAMAGED"], ["_r", "RE-ATK"]],
      ks.map(t => { const ids = rows.filter(r => String(r.task) === t.n).map(r => r.id), st = ids.map(last);
        return { ...t, _j: String(ids.length), _a: String(ids.filter(id => m.some(x => x.target === id)).length), _d: String(st.filter(s => s === "Destroyed").length),
          _g: String(st.filter(s => /damage/i.test(s) && s !== "No damage").length), _r: ids.filter(id => b.some(x => x.target === id && x.reattack === "Yes")).join(", ") || "—" }; }))}`;
  }
  P.bda = {
    code: "BDA", name: "BDA / MISREP Rollup", owner: "ISR & Targeting", stage: 6,
    desc: "Mission reports from groups rolled up into target assessments for the next cycle.",
    fields: [
      { type: "section", label: "Period" },
      { key: "atoDay", label: "ATO day assessed", type: "text", half: true },
      { key: "period", label: "Reporting period", type: "text", half: true },
      { type: "section", label: "Mission reports (MISREPs)" },
      { key: "misreps", label: "MISREPs received", type: "table", columns: [
        { key: "msn", label: "Msn #", type: "msn", w: 80 }, { key: "callsign", label: "Callsign" },
        { key: "target", label: "Target", type: "jiptl" }, { key: "tot", label: "Actual TOT", w: 90 },
        { key: "ord", label: "Ordnance expended" }, { key: "result", label: "Result", type: "select", options: RESULTS },
        { key: "remarks", label: "Remarks" }] },
      { type: "section", label: "Target assessment" },
      { key: "bda", label: "BDA by target", type: "table", columns: [
        { key: "target", label: "Target", type: "jiptl", w: 100 },
        { key: "phase", label: "BDA phase", type: "select", options: ["Phase 1 — Physical", "Phase 2 — Functional", "Phase 3 — Target system"] },
        { key: "status", label: "Assessed status", type: "select", options: ["Destroyed", "Severe damage", "Moderate damage", "Light damage", "No damage", "Unknown"] },
        { key: "source", label: "Source" },
        { key: "reattack", label: "Re-attack?", type: "select", options: ["No", "Yes", "Pending"], w: 90 }] },
      { key: "threats", label: "New threats observed", type: "textarea" },
      { key: "recommendations", label: "Recommendations for next ATO", type: "textarea" }
    ],
    render: (d, ctx) => {
      const m = d.misreps || [], b = d.bda || [];
      const hits = m.filter(r => (r.result || "").startsWith("Hit")).length;
      const reattack = b.filter(r => r.reattack === "Yes").map(r => r.target).filter(Boolean);
      return `${head("BDA / MISREP ROLLUP", ctx, `ATO DAY ${esc(d.atoDay)}`)}
      ${kv([["PERIOD", d.period], ["MISREPS RECEIVED", String(m.length)], ["MISSIONS WITH HITS", `${hits} of ${m.length}`], ["RE-ATTACK", reattack.join(", ") || "None"]])}
      <h2>1. MISSION REPORTS</h2>${table([["msn", "MSN"], ["callsign", "CALLSIGN"], ["target", "TGT"], ["tot", "TOT"], ["ord", "ORDNANCE"], ["result", "RESULT"], ["remarks", "REMARKS"]], m)}
      <h2>2. TARGET ASSESSMENT</h2>${table([["target", "TGT"], ["phase", "PHASE"], ["status", "STATUS"], ["source", "SOURCE"], ["reattack", "RE-ATK"]], b)}
      ${bdaByKeyTask(m, b, ctx)}
      ${para("4. NEW THREATS OBSERVED", d.threats)}${para("5. RECOMMENDATIONS FOR NEXT ATO", d.recommendations)}${sig(ctx)}`;
    }
  };

  // Placeholders for products to be defined later (shown on the dashboard as "planned")
  // MAAP: packages built on maap.html from the JIPTL (what to hit) and the ATO lines (who flies);
  // "Apply to ATO" writes each line's package, target and TOT onto the ATO.
  P.maap = {
    code: "MAAP", name: "Master Air Attack Plan", owner: "Combat Plans", stage: 4, page: { href: "maap.html", label: "Open MAAP" },
    desc: "Packages: which ATO lines strike which JIPTL targets, with support, tankers and TOTs.",
    fields: [],
    render: (d, ctx) => {
      // line labels are stored with the MAAP when it's saved, so the released document reads on its own
      const pk = d.packages || [], L = msn => (d.lineLabels || {})[msn] || msn;
      return `${head("MASTER AIR ATTACK PLAN", ctx, `ATO DAY ${esc(ctx.campaign.atoDay)}`)}
      ${kv([["PACKAGES", String(pk.length)], ["JIPTL TARGETS COVERED", d.coverage || ""]])}
      ${pk.map(p => `<h2>PACKAGE ${esc(p.name)} — TOT ${esc(p.tot || "TBD")}${p.push ? ` · PUSH ${esc(p.push)}` : ""}</h2>
        ${kv([["TARGETS", (p.targets || []).join(", ")], ["KEY TASKS", [...new Set((p.targets || []).map(t => window.AOC.keyTaskLabel(window.AOC.keyTaskOf(ctx.campaign.id, t))).filter(Boolean))].join("; ")],
          ["STRIKE", (p.strike || []).map(L).join("; ")], ["SEAD / DEAD", (p.sead || []).map(L).join("; ")],
          ["ESCORT / SWEEP", (p.escort || []).map(L).join("; ")], ["TANKER", (p.tanker || []).map(L).join("; ")], ["NOTES", p.notes]])}`).join("") || "<p>No packages yet.</p>"}
      ${(() => { const A = window.AOC, cid = ctx.campaign.id, rows = A.Store.content(cid, "jiptl")?.rows || [], ks = A.keyTasks(cid).filter(t => rows.some(r => String(r.task) === t.n));
        return ks.length ? `<h2>KEY TASK COVERAGE</h2>${table([["n", "KT"], ["name", "KEY TASK"], ["_j", "JIPTL TARGETS"], ["_p", "IN A PACKAGE"]], ks.map(t => {
          const ids = rows.filter(r => String(r.task) === t.n).map(r => r.id);
          return { ...t, _j: ids.join(", "), _p: ids.filter(id => pk.some(p => (p.targets || []).includes(id))).join(", ") || "NONE" }; }))}` : ""; })()}
      ${sig(ctx)}`;
    }
  };

  P.optasklink = {
    code: "OPTASKLINK", name: "OPTASKLINK", owner: "Combat Plans / JICO", stage: 5,
    desc: "Datalink plan: STNs, SADL and IDM nets, built from the ATO and the host mission file.",
    fields: [
      { type: "section", label: "Built from the ATO and the host mission file" },
      { key: "notes", label: "Notes (optional)", type: "textarea" }
    ],
    render: (d, ctx) => {
      // flight callsign + member: VIPER 1 #2 → VIPER 12
      const m = d.miz, ship = r => { const c = String(r.callsign || "").match(/^(.*\D)\s*(\d)$/); return c ? `${c[1].trim()} ${c[2]}${r.member}` : `${r.callsign || r.msn} ${r.member}`; };
      return `${head("OPTASKLINK", ctx, esc(d.network || "LINK 16"))}
      ${kv([["EFFECTIVE", d.period], ["NETWORK", d.network], ["JICO", [d.jico, d.jicoVoice].filter(Boolean).join(" on ")], ["NTR", d.ntr]])}
      <h2>1. NETWORK SETTINGS</h2>${table([["ac", "AIRCRAFT"], ["set", "SETTINGS"]], [
        { ac: "F/A-18C", set: `AIC ${d.hAIC} · FF1 ${d.hFF1} · FF2 ${d.hFF2} · VOC A ${d.hVOCA} · VOC B ${d.hVOCB}` },
        { ac: "F-16C", set: `MISSION ${d.vMission} · FIGHTER ${d.vFighter} · SPECIAL ${d.vSpecial}` },
        { ac: "A-10C II", set: `SADL AIR KEY ${d.sadlAir} · GATEWAY KEY ${d.sadlGateway}` }])}
      <h2>2. C2 AND DONORS${m ? ` (${esc(m.from)})` : ""}</h2>
      ${m?.c2.length ? table([["callsign", "C2 / DONOR"], ["type", "TYPE"], ["role", "ROLE"], ["stn", "STN"], ["voice", "VOICE C/S"]], m.c2) : ""}
      <h2>3. HUMAN FLIGHTS</h2>
      ${(d.viper || []).length ? table([["msn", "MSN #"], ["callsign", "F-16C", ship], ["stn", "STN"], ["voice", "VOICE C/S"], ["lead", "LEAD"]], d.viper) : ""}
      ${(d.sadl || []).length ? table([["msn", "MSN #"], ["callsign", "A-10C II", ship], ["tn", "SADL TN"], ["voice", "VOICE C/S"], ["lead", "LEAD"]], d.sadl) : ""}
      ${(d.idm || []).length ? table([["msn", "MSN #"], ["callsign", "AH-64D", ship], ["id", "IDM ID"], ["net", "FLIGHT NET"], ["preset", "PRESET"], ["common", "COMMON NET"]], d.idm) : ""}
      ${m?.hornet.length ? table([["callsign", "F/A-18C"], ["stn", "STN"], ["voice", "VOICE C/S"], ["ch", "AIC/FF1/FF2/VOCA/VOCB"], ["donors", "DONORS", r => r.donors.join(", ")]], m.hornet) : ""}
      ${m?.ai.length ? `<h2>4. AI AIRCRAFT</h2>${table([["callsign", "AI AIRCRAFT"], ["type", "TYPE"], ["stn", "STN"], ["voice", "VOICE C/S"]], m.ai)}` : ""}
      ${para("NOTES", d.notes)}${sig(ctx)}`;
    }
  };

  const FUTURE = [];

  // Deadlines, in days relative to T-0. Build: T-0 = first mission (campaign.dday). Cycle: T-0 = next mission (campaign.nextEvent).
  // PUBLISH is due no later than T-72h, leaving the host three days to build the .miz and brief.
  // The mission cycle assumes weekly missions: about 4 days from one mission to the next PUBLISH.
  // owner CAOC = staff builds it; HOST = host unit / its JFACC only (the CAOC tracks the date, never does the work).
  // check: a product id (done once approved or published) or a special key handled by the rollup page.
  const MILESTONES = {
    build: [
      { id: "proposal", label: "Campaign proposal approved by the CFC", owner: "CAOC", offset: -42, check: "proposal" },
      { id: "pcon", label: "Planning conference held (checklist complete)", owner: "CAOC", offset: -35, check: "pcon" },
      { id: "mizDraft", label: "Host sends the draft .miz (REDFOR laid in) to the CAOC", owner: "HOST", offset: -30, check: "mizDraft" },
      { id: "lineReq", label: "Host JFACC requests ATO lines", owner: "HOST", offset: -28, check: "lineReq" },
      { id: "ci", label: "Commander's Intent", owner: "CAOC", offset: -26, check: "ci" },
      { id: "aod", label: "AOD (with the host JFACC)", owner: "CAOC", offset: -24, check: "aod" },
      { id: "jiptl", label: "JIPTL (target nomination)", owner: "CAOC", offset: -21, check: "jiptl" },
      { id: "tdp", label: "TDP book — grade A/B folders ready", owner: "CAOC", offset: -18, check: "tdp" },
      { id: "maap", label: "MAAP — packages built", owner: "CAOC", offset: -16, check: "maap" },
      { id: "lineCommit", label: "Human ATO lines committed by groups", owner: "GROUPS", offset: -10, check: "lineCommit" },
      { id: "aco", label: "ACO + theater map (lines committed; from the planning conference airspace)", owner: "CAOC", offset: -8, check: "aco" },
      { id: "ato", label: "ATO finalised", owner: "CAOC", offset: -7, check: "ato" },
      { id: "spins", label: "SPINS & ROE (with the host JFACC)", owner: "CAOC", offset: -6, check: "spins" },
      { id: "optasklink", label: "OPTASKLINK (built from the ATO and the host .miz)", owner: "CAOC", offset: -6, check: "optasklink" },
      { id: "acp", label: "Comm Plan — built last", owner: "CAOC", offset: -5, check: "acp" },
      { id: "publish", label: "CFACC approvals → PUBLISH (products, DKS Overlay, DKS Agencies) — no later than T-72h", owner: "CAOC", offset: -3, check: "publish" },
      { id: "mizBuild", label: "Host builds the final .miz", owner: "HOST", offset: -1 },
      { id: "brief", label: "Readiness, mass brief and first mission", owner: "HOST", offset: 0 },
      { id: "debrief", label: "Host enters the mission debrief", owner: "HOST", offset: 1, check: "debrief" }
    ],
    cycle: [
      { id: "debrief", label: "Host enters the last mission's debrief", owner: "HOST", offset: -6.5, check: "debrief" },
      { id: "bda", label: "BDA / MISREP rollup", owner: "CAOC", offset: -6, check: "bda" },
      { id: "aod", label: "AOD for the next ATO day", owner: "CAOC", offset: -6, check: "aod" },
      { id: "jiptl", label: "JIPTL update (re-attacks, new targets)", owner: "CAOC", offset: -5.5, check: "jiptl" },
      { id: "tdp", label: "TDP updates", owner: "CAOC", offset: -5, check: "tdp" },
      { id: "maap", label: "MAAP", owner: "CAOC", offset: -4.5, check: "maap" },
      { id: "lineCommit", label: "Human ATO lines committed", owner: "GROUPS", offset: -4, check: "lineCommit" },
      { id: "ato", label: "ATO finalised", owner: "CAOC", offset: -3.5, check: "ato" },
      { id: "acp", label: "Tanker / JTAC frequency changes and SPINS changes (if any)", owner: "CAOC", offset: -3.5 },
      { id: "optasklink", label: "OPTASKLINK update (rebuilt from the ATO and the host .miz)", owner: "CAOC", offset: -3.5, check: "optasklink" },
      { id: "publish", label: "PUBLISH (products, DKS exports if changed) — no later than T-72h", owner: "CAOC", offset: -3, check: "publish" },
      { id: "mizBuild", label: "Host updates the .miz", owner: "HOST", offset: -1 },
      { id: "brief", label: "Mass brief and mission", owner: "HOST", offset: 0 }
    ]
  };

  // Comm, datalink and IFF/SIF are planned together, at the same sitting: the dashboard shows them as one group.
  // pages: the campaign-wide reference pages that go with the two products.
  const COMMS = { name: "Comm / Datalink / IFF", desc: "Frequencies, datalinks and IFF/SIF codes — built together, at the same time",
    products: ["acp", "optasklink"],
    pages: [{ code: "JCEOI", name: "JCEOI", desc: "Standard Blue net plan, preset load, NTTR plan, clear channels, frequency check.", href: "jceoi.html#plan" },
      { code: "IFF / SIF", name: "IFF / SIF code plan", desc: "Reserved codes, campaign Mode 3/A blocks, Mode 1 table, code check. Codes are assigned on the ATO.", href: "jceoi.html#iff" }] };
  // the group's links, shown on each of its pages; here = the product id or page code being viewed
  COMMS.strip = (cid, here) => `<div class="small" style="margin-top:4px">${esc(COMMS.name)}: ${[
    ...COMMS.products.map(id => [id, P[id].code === "ACP" ? "Comm Plan" : P[id].code, `product.html?p=${id}&c=${encodeURIComponent(cid)}`]),
    ...COMMS.pages.map(pg => [pg.code, pg.code, pg.href])].map(([k, l, h]) => k === here ? `<b>${esc(l)}</b>` : `<a href="${h}">${esc(l)}</a>`).join(" · ")}</div>`;

  // a target field that looks like a JIPTL number (T10001, or an older IT-0012) but is not on the campaign's current JIPTL:
  // renumbered by a new target nomination, or removed. Areas (CAP KNIFE, AO HAMMER, Pkg B) are never flagged.
  const TARGET_NO = /^(T\d{4,}|IT-\d{3,})$/i;
  function targetIssue(cid, target, rows) {
    const t = String(target || "").trim(); if (!TARGET_NO.test(t)) return null;
    const S = window.AOC.Store, list = rows || S.content(cid, "jiptl")?.rows || S.shared(cid, "jiptl")?.data?.rows || [];
    return list.some(r => String(r.id).toUpperCase() === t.toUpperCase()) ? null : `${t} is not on the JIPTL (renumbered or removed?)`;
  }

  window.AOC.PRODUCTS = P;
  window.AOC.targetIssue = targetIssue;
  window.AOC.COMMS = COMMS;
  window.AOC.COMM = { COLORS: COMM_COLORS, TEMPLATE: COMM_TEMPLATE, cellStyle, blankMatrix, channels };
  window.AOC.FUTURE = FUTURE;
  window.AOC.MILESTONES = MILESTONES;
  window.AOC.STAGES = STAGES;
})();
