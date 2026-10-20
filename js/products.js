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
      ${d.cycle ? kv([["AREA OF INTEREST", d.cycle.bma || "Whole theater"], ["NOMINATED", d.cycle.generated ? window.AOC.zulu(new Date(d.cycle.generated)) : ""]]) : ""}
      ${kt ? `<h2>KEY TASKS</h2>${table([["k", "TASK"], ["name", "KEY TASK"], ["weight", "WEIGHT"], ["cap", "CAP"]],
        Object.entries(kt).filter(([k]) => k !== "5").map(([k, t]) => ({ k, ...t })))}` : ""}
      <h2>TARGETS</h2>
      ${table([["_r", "RANK", r => r._r], ["id", "TGT #"], ["name", "TARGET"], ["task", "TASK"], ["grade", "GRADE"], ["cat", "CATEGORY"], ["loc", "LOCATION"], ["effect", "EFFECT"]], rows)}
      <p>Grades: A = must service this cycle, B = service if capacity allows, C/D = opportunity. Task 5 (CAS/TST) is continuous and not ranked.</p>${sig(ctx)}`;
    }
  };

  P.tdp = {
    code: "TDP", name: "Target Development Package", owner: "ISR & Targeting", stage: 3,
    desc: "Detailed target folder: description, DMPIs, threats, weaponeering and CDE notes.",
    fields: [
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
    ],
    render: (d, ctx) => `${head("TARGET DEVELOPMENT PACKAGE", ctx, `${esc(d.targetId)} — ${esc(d.name)}`)}
      <h2>1. TARGET DATA</h2>${kv([["TARGET ID", d.targetId], ["NAME", d.name], ["CATEGORY", d.category], ["LAT/LONG", d.coords], ["MGRS", d.mgrs], ["ELEVATION", d.elev]])}
      ${para("2. DESCRIPTION", d.description)}${para("3. DESIRED EFFECT", d.effect)}
      <h2>4. DMPIs</h2>${table([["id", "DMPI"], ["desc", "DESCRIPTION"], ["coords", "COORDINATES"], ["weapon", "WEAPON"]], d.dmpis)}
      <h2>5. THREATS</h2>${table([["sys", "SYSTEM"], ["loc", "LOCATION"], ["range", "RANGE/ALT"]], d.threats)}
      ${para("6. COLLATERAL / RESTRICTIONS", d.collateral)}${para("7. IMAGERY & SOURCES", d.imagery)}${para("8. BDA REQUIREMENTS", d.bda)}${sig(ctx)}`
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
        { key: "role", label: "Mission", type: "select", options: ["DCA", "OCA", "SEAD", "DEAD", "AI", "CAS", "Escort", "Strike", "ISR", "AR", "AEW", "CSAR", "Airlift"] },
        { key: "tot", label: "TOT / On-sta", w: 90 }, { key: "target", label: "Target / Area", type: "jiptl" }, { key: "tanker", label: "Tanker" }] }
    ],
    render: (d, ctx) => {
      const rows = d.missions || [];
      const byGroup = {};
      rows.forEach(r => { (byGroup[r.group] = byGroup[r.group] || []).push(r); });
      return `${head("AIR TASKING ORDER", ctx, `ATO DAY ${esc(d.atoDay)}`)}
      ${kv([["EFFECTIVE", d.period], ["SORTIES", String(rows.reduce((s, r) => s + (parseInt(r.num) || 0), 0))]])}
      ${para("GENERAL INSTRUCTIONS", d.general)}
      <h2>MASTER MISSION LIST</h2>${table([["msn", "MSN"], ["pkg", "PKG"], ["group", "UNIT", r => r.group ? ctx.group(r.group)?.name || r.group : "OPEN"], ["callsign", "CALLSIGN"], ["type", "ACFT"], ["num", "#"], ["role", "MSN TYPE"], ["tot", "TOT"], ["target", "TGT/AREA"], ["tanker", "AR"]], rows)}
      ${Object.entries(byGroup).map(([g, rs]) => `<h2>${g ? `TASKED UNIT: ${esc((ctx.group(g)?.name || g).toUpperCase())}` : "OPEN LINES — VOLUNTEERS REQUESTED"}</h2>
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
      { key: "tanker", label: "Air refuelling procedures", type: "textarea" },
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
      ${para("5. AUTHENTICATION", d.auth)}${para("6. CHECK-IN & COMM PROCEDURES", d.checkin)}${para("7. AIR REFUELLING", d.tanker)}${para("8. CSAR", d.csar)}
      <h2>9. DIVERT AIRFIELDS</h2>${table([["field", "AIRFIELD"], ["tacan", "TACAN"], ["freq", "TWR"], ["rwy", "RWY"], ["notes", "NOTES"]], d.diverts)}
      ${para("10. EMERGENCY / LOST COMMS", d.emergency)}${sig(ctx)}`
  };

  // Comm matrix colors: [background, ink]. Fixed so the printed product looks the same in every theme.
  const COMM_COLORS = {
    WHITE: ["#ffffff", "#000000"], BLUE: ["#2e5f98", "#ffffff"], YELLOW: ["#ffff00", "#000000"], GREEN: ["#00a83c", "#ffffff"],
    PURPLE: ["#7030a0", "#ffffff"], RED: ["#c00000", "#ffffff"], ORANGE: ["#f28c28", "#000000"], GRAY: ["#a6a6a6", "#000000"], BLACK: ["#1a1a1a", "#ffffff"]
  };
  const cellStyle = color => { const [bg, ink] = COMM_COLORS[color] || COMM_COLORS.WHITE; return `background:${bg};color:${ink}`; };
  const blankMatrix = () => ({ rows: 6, columns: [
    ["TAC ADMIN", "WHITE"], ["TANKERS", "BLUE"], ["TACTICAL AIR", "YELLOW"], ["RESCUE", "GREEN"], ["GROUND COORD", "PURPLE"]
  ].map(([title, color]) => ({ title, color, cells: Array.from({ length: 6 }, () => ({})) })) });
  // Every filled cell as a named channel, e.g. WHITE 1 = RAZOR, TAC COORD, 293.500
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
  const FUTURE = [
    { code: "MAAP", name: "Master Air Attack Plan", stage: 4, desc: "Packaging and timing of sorties against JIPTL targets." }
  ];

  window.AOC.PRODUCTS = P;
  window.AOC.COMM = { COLORS: COMM_COLORS, cellStyle, blankMatrix, channels };
  window.AOC.FUTURE = FUTURE;
  window.AOC.STAGES = STAGES;
})();
