// Campaign proposal: the questions a sponsoring group answers when submitting a campaign to the CAOC.
// Shared by the submission wizard (campaign-submit.html) and staff review (campaign-review.html).
(function () {
  const { esc } = window.AOC;

  const isPvP = d => d.mode && d.mode !== "PvE";
  const namedRed = d => ["Our group provides one", "Another group provides one"].includes(d.redCmdr);

  const STEPS = [
    { id: "sponsor", title: "Sponsor & JFACC", desc: "Who is submitting the campaign, and who your group's JFACC is.", fields: [
      // The group's JFACC runs the campaign and is the CAOC's single POC (distinct from the CAOC's own CFACC)
      { key: "leadCallsign", label: "Group JFACC callsign", type: "text", required: true, half: true,
        hint: "Elected by your group to manage the campaign. The JFACC is the CAOC's single point of contact." },
      { key: "leadDiscord", label: "JFACC Discord handle", type: "text", required: true, half: true },
      { key: "jfaccChosen", label: "How was the JFACC chosen?", type: "select", half: true,
        options: ["Elected by the group", "Appointed by group leadership", "Interim — election pending"] },
      { key: "backup", label: "Deputy JFACC / backup POC", type: "text", half: true, hint: "Covers when the JFACC is unavailable." },
      { key: "tz", label: "Primary time zone", type: "text", hint: "e.g. US East, UK, Australia" },
      { key: "serverHost", label: "Who hosts the DCS server?", type: "select", required: true, options: ["Sponsor group", "CAOC", "Another group", "Not decided"] },
      { key: "infra", label: "Server, SRS and Discord details", type: "textarea", hint: "Share passwords separately, never here." }
    ]},
    { id: "overview", title: "Overview", desc: "The scenario at a glance.", fields: [
      { key: "opName", label: "Proposed operation name", type: "text", required: true, half: true },
      { key: "theater", label: "Map / theater", type: "select", required: true, half: true,
        options: ["Caucasus", "Syria", "Persian Gulf", "Sinai", "Kola", "Marianas", "Afghanistan", "Iraq", "South Atlantic", "Nevada", "Normandy", "Channel", "Germany (Cold War)", "Other"] },
      { key: "era", label: "Era", type: "select", required: true, half: true, options: ["Modern (2000+)", "Cold War (1970–1990)", "Korea / early jet", "WWII"] },
      { key: "style", label: "Campaign style", type: "select", required: true, half: true, options: ["Scripted mission series", "Dynamic / persistent", "Single large event"] },
      { key: "framework", label: "Scripts / framework", type: "text", hint: "e.g. MOOSE, MIST, Skynet IADS, DCS Liberation, Foothold" },
      { key: "scenario", label: "Scenario background", type: "textarea", required: true, hint: "Who is fighting whom, and why." }
    ]},
    { id: "redfor", title: "Mode & REDFOR", desc: "How Red is played, and who commands it.", fields: [
      { key: "mode", label: "Game mode", type: "select", required: true,
        options: ["PvE", "PvP", "Mixed (AI Red + human Red players)"], hint: "PvE = all Red forces are AI. PvP = human pilots fly for Red." },
      { key: "redCmdr", label: "Will there be a REDFOR commander?", type: "select", required: true,
        options: ["Our group provides one", "Another group provides one", "Request a CAOC-appointed REDFOR commander", "None — Red runs on scripts / AI only"],
        hint: "A REDFOR commander plans and directs Red forces — human players, AI, or both — and is kept separate from Blue planning." },
      { key: "redName", label: "REDFOR commander callsign", type: "text", half: true, showIf: namedRed, required: true },
      { key: "redContact", label: "REDFOR commander Discord", type: "text", half: true, showIf: namedRed },
      { key: "redGroup", label: "Red sponsor group", type: "text", showIf: d => d.redCmdr === "Another group provides one", required: true },
      { key: "redIntent", label: "Red objectives (if known)", type: "textarea", showIf: isPvP,
        hint: "Optional. The REDFOR commander can submit these to the CAOC separately to keep them hidden from Blue." }
    ]},
    { id: "intent", title: "Commander's Intent", desc: "Your JFACC's intent for the campaign. This pre-fills the campaign's CI product.", fields: [
      { key: "purpose", label: "Purpose", type: "textarea", required: true },
      { key: "method", label: "Method (phases)", type: "textarea", required: true },
      { key: "endstate", label: "Desired end state", type: "textarea", required: true },
      { key: "keytasks", label: "Key tasks", type: "list" },
      { key: "constraints", label: "Constraints (must do)", type: "textarea" },
      { key: "restraints", label: "Restraints (must not do)", type: "textarea" },
      { key: "risk", label: "Acceptable risk", type: "textarea" }
    ]},
    { id: "outcome", title: "Win / Loss", desc: "Measurable conditions the CAOC can track.", fields: [
      { key: "blueWin", label: "Blue wins when…", type: "textarea", required: true, hint: "e.g. capture airfields X and Y, destroy 80% of the IADS by event 8" },
      { key: "blueLoss", label: "Blue loses (Red wins) when…", type: "textarea", required: true, hint: "e.g. carrier sunk, more than 40 airframes lost, deadline missed" },
      { key: "draw", label: "Time limit / draw", type: "textarea", required: true },
      { key: "attrition", label: "Attrition model", type: "select", half: true,
        options: ["None — unlimited respawns", "Limited airframes per base", "Pilot lives", "Full logistics / warehouses"] },
      { key: "results", label: "How results are recorded", type: "checks", options: ["MISREPs", "Tacview", "Server stats", "Persistence save file"] }
    ]},
    { id: "schedule", title: "Schedule", desc: "How long the campaign runs.", fields: [
      { key: "start", label: "First event date", type: "date", required: true, half: true },
      { key: "events", label: "Planned number of events", type: "number", required: true, half: true },
      { key: "cadence", label: "Cadence", type: "text", required: true, half: true, hint: "e.g. Weekly, Saturdays" },
      { key: "sessionTime", label: "Start time (Zulu)", type: "text", required: true, half: true, hint: "e.g. 1900Z" },
      { key: "sessionLength", label: "Session length", type: "text", half: true },
      { key: "timeMap", label: "Campaign time per event", type: "select", half: true, options: ["One event = one ATO day", "One event = several ATO days", "Real-time / persistent server"] },
      { key: "blackout", label: "Blackout dates", type: "text" }
    ]},
    { id: "forces", title: "Forces", desc: "Order of battle and who can fly.", fields: [
      { key: "blueOob", label: "Blue order of battle", type: "textarea", hint: "Squadrons, bases, carrier" },
      { key: "support", label: "Support assets wanted", type: "checks", options: ["AWACS / GCI", "Tankers", "JTAC", "CSAR", "Airlift"] },
      { key: "supportBy", label: "Support flown by", type: "select", half: true, options: ["AI", "Players", "Mixed"] },
      { key: "threat", label: "Red threat level", type: "select", half: true, options: ["Low", "Medium", "High", "Very high"] },
      { key: "redOob", label: "Red order of battle / IADS", type: "textarea" },
      { key: "slots", label: "Player slots wanted", type: "table", columns: [
        { key: "role", label: "Role" }, { key: "airframe", label: "Airframe" }, { key: "n", label: "Slots", w: 80 }] },
      { key: "minPlayers", label: "Minimum players", type: "number", required: true, half: true },
      { key: "maxPlayers", label: "Maximum players", type: "number", required: true, half: true },
      { key: "openToGroups", label: "Open to other groups volunteering?", type: "select", options: ["Yes", "Invite only", "No — sponsor group only"] }
    ]},
    { id: "rules", title: "Rules & Server", desc: "Realism and technical requirements.", fields: [
      { key: "realism", label: "Realism settings", type: "checks", options: ["Labels off", "F10 map: own aircraft only", "External views off", "Padlock off", "Easy comms off"] },
      { key: "respawn", label: "Respawn rules", type: "text" },
      { key: "mods", label: "Required mods", type: "text" },
      { key: "weapons", label: "Weapon / era restrictions", type: "text" },
      { key: "comms", label: "Comms", type: "checks", options: ["SRS required", "LotATC GCI", "Discord voice for briefings"] }
    ]},
    { id: "support", title: "CAOC Support", desc: "What you want the CAOC to provide.", fields: [
      { key: "products", label: "Products wanted", type: "checks",
        options: ["Commander's Intent", "AOD", "ATO", "ACO", "SPINS", "JIPTL", "TDPs", "Comm Plan", "BDA / MISREP rollup"] },
      { key: "leadTime", label: "Lead time needed before each event", type: "text", half: true },
      { key: "dks", label: "Want DKS mission-planning support?", type: "select", half: true, options: ["Yes", "No", "Maybe"],
        hint: "DKS integration is coming — we'll note your interest." },
      { key: "build", label: "Who builds the .miz files?", type: "select", options: ["Sponsor group", "CAOC", "Shared"] },
      { key: "attachments", label: "Attachments / links", type: "textarea", hint: "Links to a draft .miz, maps, OOB spreadsheet. File upload comes later." }
    ]},
    { id: "review", title: "Review & Submit", desc: "Check the proposal, then submit it to the CAOC.", fields: [
      { key: "ackConduct", label: "Our group agrees to the CAOC code of conduct", type: "check", required: true },
      { key: "ackReport", label: "We will report results after each event (MISREPs / Tacview)", type: "check", required: true },
      { key: "ackTasking", label: "We accept the CAOC as tasking authority for this campaign", type: "check", required: true }
    ]}
  ];

  const visible = (f, d) => !f.showIf || f.showIf(d);
  const empty = v => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && !v.length);

  // Missing required fields per step, plus cross-field warnings
  function validate(d) {
    const missing = [];
    STEPS.forEach((s, i) => s.fields.forEach(f => {
      if (f.required && visible(f, d) && empty(d[f.key])) missing.push({ step: i, label: f.label });
    }));
    const warnings = [];
    if (d.mode === "PvP" && (d.redCmdr || "").startsWith("None")) warnings.push("PvP campaigns need a REDFOR commander — provide one or request a CAOC-appointed one.");
    if (+d.minPlayers && +d.maxPlayers && +d.minPlayers > +d.maxPlayers) warnings.push("Minimum players is higher than maximum.");
    return { missing, warnings };
  }

  // Formatted proposal document
  function render(d, group) {
    const kv = pairs => `<div class="kv">${pairs.filter(p => !empty(p[1])).map(([k, v]) => `<div>${esc(k)}</div><div>${esc(Array.isArray(v) ? v.join(", ") : v)}</div>`).join("")}</div>`;
    const para = (h, t) => empty(t) ? "" : `<h2>${esc(h)}</h2><p>${esc(t)}</p>`;
    const slots = (d.slots || []).filter(r => r.role || r.airframe);
    return `<div class="cls">UNCLASSIFIED // EXERCISE</div>
      <h1>CAMPAIGN PROPOSAL</h1>
      <div class="sub">OPERATION ${esc((d.opName || "UNNAMED").toUpperCase())}<br>Submitted by ${esc(group?.name || "—")}</div>
      <h2>1. SPONSOR & JFACC</h2>${kv([["Group JFACC", d.leadCallsign], ["JFACC Discord", d.leadDiscord], ["JFACC chosen", d.jfaccChosen],
        ["Deputy JFACC", d.backup], ["Time zone", d.tz], ["Server host", d.serverHost]])}
      ${para("Infrastructure", d.infra)}
      <h2>2. OVERVIEW</h2>${kv([["Theater", d.theater], ["Era", d.era], ["Style", d.style], ["Framework", d.framework]])}
      ${para("Scenario", d.scenario)}
      <h2>3. MODE & REDFOR</h2>${kv([["Game mode", d.mode], ["REDFOR commander", d.redCmdr], ["Red commander", namedRed(d) || d.redCmdr === "CAOC-appointed" ? d.redName : ""],
        ["Red contact", namedRed(d) ? d.redContact : ""], ["Red sponsor group", d.redCmdr === "Another group provides one" ? d.redGroup : ""]])}
      ${isPvP(d) ? para("Red objectives", d.redIntent) : ""}
      <h2>4. COMMANDER'S INTENT</h2>${para("Purpose", d.purpose)}${para("Method", d.method)}${para("End state", d.endstate)}
      ${(d.keytasks || []).filter(Boolean).length ? `<h2>Key tasks</h2><ol>${d.keytasks.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
      ${para("Constraints", d.constraints)}${para("Restraints", d.restraints)}${para("Acceptable risk", d.risk)}
      <h2>5. WIN / LOSS CONDITIONS</h2>${para("Blue wins when", d.blueWin)}${para("Blue loses when", d.blueLoss)}${para("Time limit / draw", d.draw)}
      ${kv([["Attrition", d.attrition], ["Results recorded by", d.results]])}
      <h2>6. SCHEDULE</h2>${kv([["First event", d.start], ["Events", d.events], ["Cadence", d.cadence], ["Start time", d.sessionTime],
        ["Session length", d.sessionLength], ["Campaign time", d.timeMap], ["Blackout dates", d.blackout]])}
      <h2>7. FORCES & PARTICIPATION</h2>${para("Blue OOB", d.blueOob)}${kv([["Support", d.support], ["Support flown by", d.supportBy], ["Threat level", d.threat]])}
      ${para("Red OOB / IADS", d.redOob)}
      ${slots.length ? `<table><thead><tr><th>ROLE</th><th>AIRFRAME</th><th>SLOTS</th></tr></thead><tbody>${slots.map(r => `<tr><td>${esc(r.role)}</td><td>${esc(r.airframe)}</td><td>${esc(r.n)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${kv([["Players", d.minPlayers || d.maxPlayers ? `${d.minPlayers || "?"}–${d.maxPlayers || "?"}` : ""], ["Open to groups", d.openToGroups]])}
      <h2>8. RULES & SERVER</h2>${kv([["Realism", d.realism], ["Respawns", d.respawn], ["Mods", d.mods], ["Weapon limits", d.weapons], ["Comms", d.comms]])}
      <h2>9. CAOC SUPPORT</h2>${kv([["Products", d.products], ["Lead time", d.leadTime], ["DKS support", d.dks], ["Mission build", d.build]])}
      ${para("Attachments", d.attachments)}
      <h2>10. ACKNOWLEDGEMENTS</h2>${kv([["Code of conduct", d.ackConduct ? "Agreed" : "Not yet"], ["Results reporting", d.ackReport ? "Agreed" : "Not yet"], ["CAOC tasking authority", d.ackTasking ? "Agreed" : "Not yet"]])}
      <div class="cls bottom">UNCLASSIFIED // EXERCISE</div>`;
  }

  const STATUS = {
    draft: ["Draft", "draft"], submitted: ["Submitted — under review", "review"], returned: ["Returned for changes", "draft"],
    accepted: ["Accepted", "published"], declined: ["Declined", "none"]
  };

  window.AOC.PROPOSAL = { STEPS, validate, render, visible, STATUS };
})();
