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
      <h2>2. OBJECTIVES (PRIORITY ORDER)</h2>${table([["pri", "PRI"], ["objective", "OBJECTIVE"], ["effect", "EFFECT"], ["tasks", "TASKS"]], d.objectives)}
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
        { key: "task", label: "Task", type: "select", options: ["1", "2", "3", "4"], w: 60 },
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
      ${kt ? `<h2>KEY TASKS</h2>${table([["k", "TASK"], ["name", "KEY TASK"], ["weight", "WEIGHT"], ["cap", "CAP"]],
        Object.entries(kt).filter(([k]) => k !== "5").map(([k, t]) => ({ k, ...t })))}` : ""}
      <h2>TARGETS</h2>
      ${table([["_r", "RANK", r => r._r], ["id", "TGT #"], ["name", "TARGET"], ["task", "TASK"], ["grade", "GRADE"], ["cat", "CATEGORY"], ["loc", "LOCATION"], ["effect", "EFFECT"]], rows)}
      <p>Grades: A = must service this cycle, B = service if capacity allows, C/D = opportunity. Task 5 (CAS/TST) is continuous and not ranked.</p>${sig(ctx)}`;
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
      { key: "collateral", label: "Collateral / attack restrictions", type: "textarea" },
      { key: "imagery", label: "Imagery & intel sources", type: "textarea" },
      { key: "bda", label: "BDA requirements", type: "textarea" }
  ];
  // older single-folder TDPs (targetId at the top level) read as a one-folder book
  const tdpFolders = d => d.folders ? Object.values(d.folders) : d.targetId ? [d] : [];
  const folderHtml = f => `<h2>TP ${esc(f.targetId)} — ${esc((f.name || "").toUpperCase())}${f.grade ? ` · GRADE ${esc(f.grade)}` : ""}</h2>
      ${kv([["TARGET ID", f.targetId], ["CATEGORY", f.category], ["LAT/LONG", f.coords], ["MGRS", f.mgrs], ["ELEVATION", f.elev], ["STATUS", f.status === "ready" ? "Ready" : "Draft"]])}
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

  P.ato = {
    code: "ATO", name: "Air Tasking Order", owner: "Combat Plans", stage: 5,
    desc: "Mission-by-mission tasking for each participating group for one ATO day.",
    fields: [
      { type: "section", label: "Period" },
      { key: "atoDay", label: "ATO day", type: "text", half: true },
      { key: "period", label: "Effective period", type: "text", half: true },
      { key: "general", label: "General instructions", type: "textarea" },
      { type: "section", label: "Missions" },
      { key: "missions", label: "Tasked missions", type: "table", columns: [
        { key: "msn", label: "Msn #", w: 70 }, { key: "pkg", label: "Pkg", w: 50 },
        { key: "group", label: "Group", type: "groups" }, { key: "callsign", label: "Callsign" },
        { key: "type", label: "Acft", w: 90 }, { key: "num", label: "#", w: 40 },
        { key: "crew", label: "Crew", type: "select", options: ["Human", "AI"], w: 80 },
        { key: "role", label: "Mission", type: "select", options: ["DCA", "OCA", "SEAD", "DEAD", "AI", "CAS", "SCAR", "Escort", "Strike", "ISR", "AR", "AEW", "CSAR", "Airlift"] },
        { key: "tot", label: "TOT / On-sta", w: 90 }, { key: "target", label: "Target / Area", type: "jiptl" }, { key: "tanker", label: "Tanker" }] }
    ],
    render: (d, ctx) => {
      const rows = d.missions || [];
      // lines requested by the JFACC show as OPEN until a unit commits through the Discord post; AI lines are built by the sponsor
      const unitOf = r => r.group ? ctx.group(r.group)?.name || r.group : r.crew === "AI" ? "AI" : "OPEN";
      const byGroup = {};
      rows.forEach(r => { const k = r.group || (r.crew === "AI" ? "_ai" : ""); (byGroup[k] = byGroup[k] || []).push(r); });
      return `${head("AIR TASKING ORDER", ctx, `ATO DAY ${esc(d.atoDay)}`)}
      ${kv([["EFFECTIVE", d.period], ["SORTIES", String(rows.reduce((s, r) => s + (parseInt(r.num) || 0), 0))]])}
      ${para("GENERAL INSTRUCTIONS", d.general)}
      <h2>MASTER MISSION LIST</h2>${table([["msn", "MSN"], ["pkg", "PKG"], ["group", "UNIT", unitOf], ["callsign", "CALLSIGN"], ["type", "ACFT"], ["num", "#"], ["crew", "CREW", r => r.crew || "Human"], ["role", "MSN TYPE"], ["tot", "TOT"], ["target", "TGT/AREA"], ["tanker", "AR"]], rows)}
      ${Object.entries(byGroup).map(([g, rs]) => `<h2>${g === "_ai" ? "AI LINES — BUILT BY THE SPONSOR IN THE .MIZ" : g ? `TASKED UNIT: ${esc((ctx.group(g)?.name || g).toUpperCase())}` : "OPEN LINES — POSTED FOR COMMITMENT"}</h2>
        ${table([["msn", "MSN"], ["callsign", "CALLSIGN"], ["num", "#"], ["role", "TYPE"], ["tot", "TOT"], ["target", "TGT/AREA"], ["tanker", "AR"]], rs)}`).join("")}
      ${sig(ctx)}`;
    }
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

  P.spins = {
    code: "SPINS", name: "Special Instructions", owner: "Combat Plans", stage: 5,
    desc: "ROE, ID criteria, code words, tanker, CSAR and divert procedures.",
    fields: [
      { type: "section", label: "Header" },
      { key: "version", label: "Version", type: "text", half: true, hint: "e.g. v3" },
      { key: "period", label: "Effective period", type: "text", half: true },
      { key: "bullseye", label: "Bullseye", type: "text", half: true },
      { key: "wcs", label: "Default weapons control status", type: "select", options: ["Weapons Tight", "Weapons Hold", "Weapons Free"], half: true },
      { type: "section", label: "Rules of engagement" },
      { key: "roe", label: "ROE", type: "textarea" },
      { key: "idCriteria", label: "ID criteria / commit criteria", type: "textarea" },
      { type: "section", label: "Weapons restrictions" },
      { key: "weapons", label: "Restricted / prohibited weapons", type: "table", columns: [
        { key: "weapon", label: "Weapon / category" },
        { key: "status", label: "Status", type: "select", options: ["Prohibited", "Restricted", "JFACC approval required", "Authorised"], w: 150 },
        { key: "applies", label: "Applies to", w: 120 },
        { key: "conditions", label: "Conditions / when" }] },
      { key: "weaponsNotes", label: "Additional weapons guidance", type: "textarea", hint: "e.g. jettison areas, hung ordnance, minimum release altitudes" },
      { type: "section", label: "Brevity & authentication" },
      { key: "codewords", label: "Code words", type: "table", columns: [
        { key: "word", label: "Code word", w: 160 }, { key: "meaning", label: "Meaning / action" }] },
      { key: "auth", label: "Authentication procedures", type: "textarea" },
      { type: "section", label: "Procedures" },
      { key: "checkin", label: "Check-in & comm procedures", type: "textarea", hint: "Refer to channels by Comm Plan matrix ID, e.g. YELLOW 1" },
      { key: "tanker", label: "Air refuelling procedures", type: "textarea", hint: "Tanker TACANs are set on each tanker track on the theater map" },
      { key: "naval", label: "Carriers & ships — TACAN / ICLS", type: "table", columns: [
        { key: "ship", label: "Ship" }, { key: "hull", label: "DCS type / hull", w: 120 }, { key: "tacanCh", label: "TACAN ch", w: 80 },
        { key: "tacanMode", label: "X/Y", w: 50 }, { key: "tacanCs", label: "Ident", w: 70 }, { key: "icls", label: "ICLS", w: 60 }, { key: "notes", label: "Notes" }] },
      { key: "csar", label: "CSAR procedures", type: "textarea" },
      { key: "diverts", label: "Divert airfields", type: "table", columns: [
        { key: "field", label: "Airfield" }, { key: "tacan", label: "TACAN", w: 80 }, { key: "freq", label: "Tower freq", w: 100 },
        { key: "rwy", label: "Runway", w: 80 }, { key: "notes", label: "Notes" }] },
      { key: "emergency", label: "Emergency / lost comms", type: "textarea" }
    ],
    render: (d, ctx) => `${head("SPECIAL INSTRUCTIONS (SPINS)", ctx, esc(d.version))}
      ${kv([["EFFECTIVE", d.period], ["BULLSEYE", d.bullseye], ["DEFAULT WCS", d.wcs]])}
      ${para("1. RULES OF ENGAGEMENT", d.roe)}${para("2. ID / COMMIT CRITERIA", d.idCriteria)}
      <h2>3. WEAPONS RESTRICTIONS</h2>${table([["weapon", "WEAPON / CATEGORY"], ["status", "STATUS"], ["applies", "APPLIES TO"], ["conditions", "CONDITIONS"]], d.weapons)}
      ${d.weaponsNotes ? `<p>${esc(d.weaponsNotes)}</p>` : ""}
      <h2>4. CODE WORDS</h2>${table([["word", "CODE WORD"], ["meaning", "MEANING / ACTION"]], d.codewords)}
      ${para("5. AUTHENTICATION", d.auth)}${para("6. CHECK-IN & COMM PROCEDURES", d.checkin)}${para("7. AIR REFUELLING", d.tanker)}
      ${(d.naval || []).length ? `<h2>7a. CARRIERS &amp; SHIPS — TACAN / ICLS</h2>${table([["ship", "SHIP"], ["hull", "TYPE"], ["tacan", "TACAN"], ["tacanCs", "IDENT"], ["icls", "ICLS"], ["notes", "NOTES"]],
        d.naval.map(r => ({ ...r, tacan: r.tacanCh ? `${r.tacanCh}${r.tacanMode || ""}` : "" })))}` : ""}${para("8. CSAR", d.csar)}
      <h2>9. DIVERT AIRFIELDS</h2>${table([["field", "AIRFIELD"], ["tacan", "TACAN"], ["freq", "TWR"], ["rwy", "RWY"], ["notes", "NOTES"]], d.diverts)}
      ${para("10. EMERGENCY / LOST COMMS", d.emergency)}${sig(ctx)}`
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
      <p>Check-in and comm procedures: see SPINS.</p>${sig(ctx)}`;
    }
  };

  const RESULTS = ["Hit — destroyed", "Hit — damaged", "Hit — unknown", "Miss", "No drop", "Aborted", "Not flown"];
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
      ${para("3. NEW THREATS OBSERVED", d.threats)}${para("4. RECOMMENDATIONS FOR NEXT ATO", d.recommendations)}${sig(ctx)}`;
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
        ${kv([["TARGETS", (p.targets || []).join(", ")], ["STRIKE", (p.strike || []).map(L).join("; ")], ["SEAD / DEAD", (p.sead || []).map(L).join("; ")],
          ["ESCORT / SWEEP", (p.escort || []).map(L).join("; ")], ["TANKER", (p.tanker || []).map(L).join("; ")], ["NOTES", p.notes]])}`).join("") || "<p>No packages yet.</p>"}
      ${sig(ctx)}`;
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
      { id: "spins", label: "SPINS (with the host JFACC)", owner: "CAOC", offset: -6, check: "spins" },
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
      { id: "publish", label: "PUBLISH (products, DKS exports if changed) — no later than T-72h", owner: "CAOC", offset: -3, check: "publish" },
      { id: "mizBuild", label: "Host updates the .miz", owner: "HOST", offset: -1 },
      { id: "brief", label: "Mass brief and mission", owner: "HOST", offset: 0 }
    ]
  };

  window.AOC.PRODUCTS = P;
  window.AOC.COMM = { COLORS: COMM_COLORS, TEMPLATE: COMM_TEMPLATE, cellStyle, blankMatrix, channels };
  window.AOC.FUTURE = FUTURE;
  window.AOC.MILESTONES = MILESTONES;
  window.AOC.STAGES = STAGES;
})();
