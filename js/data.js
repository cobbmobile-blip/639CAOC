// Seed data for the prototype. In production this lives in a database behind an API.
// DEMO ONLY: these staff accounts exist only in this prototype. Password for all: aoc-demo
window.AOC_SEED = {
  users: [
    // CAOC staff. The CFC manages the CAOC; the CFACC makes sure every deliverable is built and approved.
    // Neither manages a campaign: that is the sponsoring group's JFACC.
    { callsign: "ATLAS", name: "CFC / CAOC Commander", role: "CFC", password: "aoc-demo" },
    { callsign: "OVERLORD", name: "CFACC / Deliverables approval", role: "CFACC", password: "aoc-demo" },
    { callsign: "SPARTAN", name: "Strategy Division Chief", role: "Strategy", password: "aoc-demo" },
    { callsign: "CHALICE", name: "Combat Plans Chief", role: "Combat Plans", password: "aoc-demo" },
    { callsign: "WIZARD", name: "Targets / ISR Chief", role: "ISR & Targeting", password: "aoc-demo" },
    { callsign: "DARKSTAR", name: "Airspace Manager", role: "Airspace", password: "aoc-demo" },
    { callsign: "GUARDIAN", name: "PRCC Director (Personnel Recovery)", role: "PRCC", password: "aoc-demo" }
  ],

  // Pilot ISOPREPs, filed by each group on the unit portal (isoprep.html) and read by the PRCC. Fictional people.
  // Authentication statements are personal facts only the pilot knows; the number is a 4-digit personal number.
  isopreps: [
    { id: "ISO-V11", gid: "g1", callsign: "VIPER 11", player: "Sabre", name: "Sam \"Sabre\" Okafor", nationality: "USA",
      height: "5'11\"", weight: "180 lb", eyes: "Brown", hair: "Black, short", marks: "Scar on left forearm", blood: "O+",
      statements: [{ q: "First car", a: "Green 1994 Civic" }, { q: "Childhood pet", a: "Beagle named Rocket" },
        { q: "Street you grew up on", a: "Larch Lane" }, { q: "Favourite teacher", a: "Mrs Delgado" }],
      number: "4827", updated: "2026-10-15T18:00:00Z" },
    { id: "ISO-V12", gid: "g1", callsign: "VIPER 12", player: "Jinx", name: "Ana \"Jinx\" Petrova", nationality: "USA",
      height: "5'6\"", weight: "135 lb", eyes: "Green", hair: "Red, shoulder length", marks: "None", blood: "A-",
      statements: [{ q: "First concert", a: "A jazz trio in a park" }, { q: "Grandmother's town", a: "Plovdiv" },
        { q: "First job", a: "Bakery" }, { q: "Favourite book as a child", a: "The Hobbit" }],
      number: "1963", updated: "2026-10-15T18:00:00Z" }
  ],

  // Participating groups. DEMO ONLY: unit portal sign-in uses `login` + access code "unit-demo".
  // All groups here are fictional. Products are released to a whole group, never to single flights.
  groups: [
    { id: "g1", name: "Viper Ops Group", airframes: "F-16C", contact: "Sabre", members: 18, tz: "US East", status: "active", login: "viper", code: "unit-demo" },
    { id: "g2", name: "Hornet Bay vCVW", airframes: "F/A-18C", contact: "Rhino", members: 26, tz: "US West", status: "active", login: "hornet", code: "unit-demo" },
    { id: "g3", name: "Strike Eagle Det", airframes: "F-15E", contact: "Dude", members: 9, tz: "UK", status: "active", login: "eagle", code: "unit-demo" },
    { id: "g4", name: "Warthog Close Air", airframes: "A-10C II", contact: "Hawg", members: 12, tz: "US Central", status: "active", login: "hawg", code: "unit-demo" },
    { id: "g5", name: "Rotary Wing Det", airframes: "AH-64D, UH-1H", contact: "Gunfighter", members: 7, tz: "Germany", status: "pending", login: "rotary", code: "unit-demo" },
    { id: "g7", name: "Black Knights vFS", airframes: "F-16C", contact: "Lancer", members: 14, tz: "Netherlands", status: "active", login: "knights", code: "unit-demo" },
    { id: "g8", name: "Tomcat Heritage Sqn", airframes: "F-14B", contact: "Rogue", members: 11, tz: "US East", status: "active", login: "tomcat", code: "unit-demo" },
    { id: "g9", name: "Ridgerunner Det", airframes: "F-15E", contact: "Runner", members: 6, tz: "US Central", status: "active", login: "ridge", code: "unit-demo" },
    { id: "g10", name: "Harrier Assault Det", airframes: "AV-8B", contact: "Beast", members: 8, tz: "Australia", status: "active", login: "harrier", code: "unit-demo" },
    { id: "g11", name: "Escadron Virtuel Mistral", airframes: "M-2000C", contact: "Mistral", members: 10, tz: "France", status: "active", login: "mistral", code: "unit-demo" },
    { id: "g12", name: "Thunder Apache Co.", airframes: "AH-64D", contact: "Thunder", members: 9, tz: "UK", status: "active", login: "thunder", code: "unit-demo" },
    { id: "g13", name: "Eagle Keepers", airframes: "F-15C", contact: "Keeper", members: 13, tz: "Canada", status: "active", login: "keepers", code: "unit-demo" },
    // primary CSAR helicopter unit: the UH-60L mod flown as the MH-60L (the PRCC requests rescue lines in it)
    { id: "g14", name: "55th RQS", airframes: "MH-60L", contact: "Jolly", members: 10, tz: "US Central", status: "active", login: "rqs55", code: "unit-demo" }
  ],

  campaigns: [
    {
      id: "iron-trident",
      opName: "IRON TRIDENT",
      theater: "Caucasus",
      phase: "Phase II — Seize the Initiative",
      dday: "2026-10-12",
      atoDay: 8,
      atoPeriod: "0600Z–0559Z",
      nextEvent: "2026-10-22T20:00:00Z",
      jfacc: { callsign: "SABRE", group: "g1", discord: "sabre#1016" },
      // host debriefs by ATO day (entered on debrief.html by the host unit)
      debriefs: { "7": { by: "g1", user: "SABRE", when: "2026-10-20T00:30:00Z", progress: "On plan", tacview: "", objectives: "Phase II air superiority over the Rioni valley: SA-11 damaged, EWR destroyed.",
        redLosses: "New SA-15 reported 3 NM west of Samtredia (VIPER 3 RWR, 0718Z).", notes: "Fuel depot not attacked (weather) — needs a re-attack.",
        misreps: [{ msn: "7101", callsign: "VIPER 1", target: "T10002", flown: "Yes", result: "Hit — damaged", remarks: "" }, { msn: "7102", callsign: "DUDE 1", target: "T10003", flown: "Yes", result: "Hit — destroyed", remarks: "" },
          { msn: "7103", callsign: "SPRINGFIELD 3", target: "T10005", flown: "No — aborted", result: "", remarks: "Weather" }],
        bda: [{ target: "T10002", status: "Moderate damage", reattack: "Yes", notes: "" }, { target: "T10003", status: "Destroyed", reattack: "No", notes: "TGP video" }], losses: [] } },
      groups: ["g1", "g2", "g3", "g4", "g7", "g8", "g10", "g11", "g12", "g13", "g9", "g14"], // g9 joined by committing to line 8601; g14 the CSAR helos
      status: { pcon: "approved", ci: "published", aod: "published", jiptl: "approved", tdp: "draft", maap: "approved", ato: "published", aco: "review", spins: "published", acp: "published", grg: "draft", bda: "draft" },
      // seed release history (version + time) for products already published
      releases: {
        ci: { v: 1, when: "2026-10-12T12:00:00Z" },
        spins: { v: 3, when: "2026-10-18T09:00:00Z" },
        aod: { v: 1, when: "2026-10-19T08:00:00Z" },
        ato: { v: 2, when: "2026-10-19T22:30:00Z" },
        acp: { v: 1, when: "2026-10-19T23:00:00Z" }
      }
    },
    {
      id: "desert-lance",
      opName: "DESERT LANCE",
      theater: "Syria",
      phase: "Phase I — Deter",
      dday: "2026-11-02",
      atoDay: 0,
      atoPeriod: "0400Z–0359Z",
      nextEvent: "2026-11-02T19:00:00Z",
      jfacc: { callsign: "DUDE", group: "g3", discord: "dude#3015" },
      groups: ["g1", "g3", "g5", "g9", "g10", "g12"],
      status: { ci: "draft" }
    },
    {
      id: "arctic-veil",
      opName: "ARCTIC VEIL",
      theater: "Kola",
      phase: "Phase 0 — Shape",
      dday: "2026-12-07",
      atoDay: 0,
      atoPeriod: "0800Z–0759Z",
      groups: ["g2", "g8", "g13"],
      status: {}
    }
  ],

  // ATO lines requested by a campaign's Group JFACC; Human lines are posted on Discord to every registered group
  // flying that airframe and filled by the first unit to press Commit (see docs/ATO_Discord_Integration.md)
  atoLines: [
    { id: "L8115", cid: "iron-trident", msn: "8115", airframe: "F-16C", num: 2, role: "SEAD", crew: "Human", tot: "1058Z", target: "Pkg B", pkg: "B", callsign: "", base: "", notes: "", commitBy: "211800Z OCT 26",
      source: "Request form", mizGroup: "", requestedBy: "g1", requestedByUser: "SABRE", requestedAt: "2026-10-19T20:00:00Z", recipients: ["g1", "g7"],
      status: "open", postedAt: "2026-10-19T20:00:05Z", committedBy: "", committedAt: "", committedByUser: "" },
    { id: "L8203", cid: "iron-trident", msn: "8203", airframe: "F-14B", num: 2, role: "DCA", crew: "Human", tot: "1400–1800Z", target: "CAP KNIFE", pkg: "", callsign: "", base: "", notes: "", commitBy: "211800Z OCT 26",
      source: "Request form", mizGroup: "", requestedBy: "g1", requestedByUser: "SABRE", requestedAt: "2026-10-19T20:00:00Z", recipients: ["g8"],
      status: "open", postedAt: "2026-10-19T20:00:05Z", committedBy: "", committedAt: "", committedByUser: "" },
    { id: "L8305", cid: "iron-trident", msn: "8305", airframe: "A-10C II", num: 2, role: "CAS", crew: "Human", tot: "1400Z", target: "AO HAMMER", pkg: "", callsign: "", base: "", notes: "", commitBy: "211800Z OCT 26",
      source: "Request form", mizGroup: "", requestedBy: "g1", requestedByUser: "SABRE", requestedAt: "2026-10-19T20:00:00Z", recipients: ["g4"],
      status: "open", postedAt: "2026-10-19T20:00:05Z", committedBy: "", committedAt: "", committedByUser: "" },
    { id: "L8601", cid: "iron-trident", msn: "8601", airframe: "F-15E", num: 4, role: "Strike", crew: "Human", tot: "0722Z", target: "T10005", pkg: "A", callsign: "RUNNER 1", base: "", notes: "", commitBy: "211800Z OCT 26",
      source: "iron_trident_viper.miz", mizGroup: "Pkg A Strike Eagles", requestedBy: "g1", requestedByUser: "SABRE", requestedAt: "2026-10-19T20:00:00Z", recipients: ["g3", "g9"],
      status: "committed", postedAt: "2026-10-19T20:00:05Z", committedBy: "g9", committedAt: "2026-10-20T01:12:00Z", committedByUser: "RUNNER" },
    { id: "L8602", cid: "iron-trident", msn: "8602", airframe: "KC-135 MPRS", num: 1, role: "AR", crew: "AI", tot: "0630Z", target: "AR TRACK ALPHA", pkg: "", callsign: "SHELL 1", base: "", notes: "", commitBy: "211800Z OCT 26",
      source: "iron_trident_viper.miz", mizGroup: "Shell tanker", requestedBy: "g1", requestedByUser: "SABRE", requestedAt: "2026-10-19T20:00:00Z", recipients: [],
      status: "ai", postedAt: "", committedBy: "", committedAt: "", committedByUser: "" }
  ],

  // groups dropped from the seed: saved browsers remove them too and their ATO lines become AI lines
  retiredGroups: ["g6"],
  // mission sets renamed: saved ATOs, ATO lines and AODs follow (AI was air interdiction, now INT, so it is not read as AI crew)
  renamedMissions: { AI: "INT" },
  // example text the seed has since rewritten: a saved product still holding the old text takes the new (edited text is kept)
  supersededText: [
    { pid: "spins", key: "checkin", old: "Check in on YELLOW 1 (HOWDY) when airborne: callsign, mission number, number and type, playtime. Refer to channels by Comm Plan matrix ID on the net, e.g. “push BLUE 1”." },
    { pid: "spins", key: "auth", old: "Challenge/reply from the daily authentication table posted in #aoc-spins. Change at 0600Z." },
    { pid: "spins", key: "codewords", old: [
        { word: "BLUE MOON", meaning: "Abort all strikes, RTB" },
        { word: "RAIN DANCE", meaning: "SAM re-occupation detected — SEAD respond" },
        { word: "SANDY", meaning: "CSAR in progress — clear the area on Strike Common" },
        { word: "BIG TOP", meaning: "HVAA threatened — DCA commit" }
      ] }
  ],

  // Which version of each released product each group has pulled from the portal
  receipts: [
    ...["g1", "g2", "g3", "g4", "g7", "g8", "g10", "g12", "g13"].map(g => ({ cid: "iron-trident", gid: g, pid: "ci", v: 1 })),
    ...["g1", "g2", "g3", "g4", "g7", "g8", "g13"].map(g => ({ cid: "iron-trident", gid: g, pid: "spins", v: 3 })),
    ...["g10", "g12"].map(g => ({ cid: "iron-trident", gid: g, pid: "spins", v: 2 })),
    ...["g1", "g3", "g4", "g7", "g13"].map(g => ({ cid: "iron-trident", gid: g, pid: "aod", v: 1 })),
    ...["g1", "g3", "g7"].map(g => ({ cid: "iron-trident", gid: g, pid: "ato", v: 2 })),
    ...["g2", "g4", "g8", "g10", "g13"].map(g => ({ cid: "iron-trident", gid: g, pid: "ato", v: 1 })),
    ...["g1"].map(g => ({ cid: "iron-trident", gid: g, pid: "acp", v: 1 }))
  ],

  // Campaign proposals submitted by a sponsoring group for CAOC review
  submissions: [
    {
      // Fully worked example: a draft from Hornet Bay, ready to review and submit
      id: "s2", gid: "g2", status: "draft", created: "2026-10-20T01:00:00Z", updated: "2026-10-20T03:30:00Z", comments: [],
      data: {
        leadCallsign: "RHINO", leadDiscord: "rhino#2222", jfaccChosen: "Elected by the group", backup: "JESTER", tz: "US West", serverHost: "Sponsor group",
        infra: "Dedicated 64-slot server (Los Angeles) run by Hornet Bay. SRS on the same host. Briefings on the Hornet Bay Discord, #pacific-talon channel. Passwords sent to group liaisons by DM.",
        opName: "PACIFIC TALON", theater: "Marianas", era: "Modern (2000+)", style: "Scripted mission series",
        framework: "MOOSE (AI CAP, tankers, recovery tanker), Skynet IADS for Red island defences, CTLD for helicopter logistics",
        scenario: "Red has seized Saipan and Tinian in a surprise amphibious assault and is building up air and missile defences to threaten Guam. A coalition carrier strike group and land-based fighters at Andersen AFB must break the Red defences, cut their sea resupply, and support the recapture of both islands before Red can reinforce from the north.",
        mode: "Mixed (AI Red + human Red players)",
        redCmdr: "Request a CAOC-appointed REDFOR commander",
        redIntent: "We'd like Red to fly 4–6 human fighters (Su-27 / MiG-29) defending Saipan, with AI covering the IADS and naval forces. We prefer not to know Red's plan, so the appointed commander should send their objectives to the CAOC directly.",
        purpose: "Restore coalition control of the Northern Marianas and remove the Red threat to Guam and the sea lanes west of it.",
        method: "Phase I (events 1–2): defend Guam and the carrier group, and establish air superiority south of Rota. Phase II (events 3–5): roll back the Red IADS on Tinian and Saipan and sink the resupply convoys. Phase III (events 6–8): close air support for the amphibious recapture of Tinian, then Saipan.",
        endstate: "Saipan and Tinian back under coalition control, Red IADS in the islands destroyed, Red naval forces withdrawn north of 17°N, and Guam no longer within range of Red missile sites.",
        keytasks: [
          "Protect the carrier group and Andersen AFB from Red air and anti-ship missile attack",
          "Destroy the SA-10 and SA-11 sites on Saipan and Tinian",
          "Sink or turn back at least 4 Red resupply convoys",
          "Provide CAS for the Marine landings at Tinian and Saipan"
        ],
        constraints: "The carrier must stay at least 80 NM from Saipan until the Saipan SA-10 is destroyed. Every strike package needs an escort.",
        restraints: "No strikes on Saipan's civilian airport terminal or port facilities, which are needed after recapture. No attacks north of 17°N.",
        risk: "Accept moderate risk to strike and SEAD aircraft in Phase II. Accept low risk to the carrier, tankers and AWACS; keep them south of Rota.",
        blueWin: "Both Tinian and Saipan airfields captured (CTLD-deployed Blue ground units hold them) AND every Red SAM site on the islands destroyed, by the end of event 8.",
        blueLoss: "The carrier is sunk, OR Blue loses more than 30 player airframes in total, OR Red still holds both islands at the end of event 8.",
        draw: "If Blue captures one island but not both by event 8, the campaign ends in a negotiated ceasefire (draw). An optional event 9 decider may be added if both sides agree.",
        attrition: "Limited airframes per base", results: ["MISREPs", "Tacview", "Persistence save file"],
        start: "2026-11-21", events: "8", cadence: "Weekly, Saturdays", sessionTime: "0200Z", sessionLength: "3.5 hours (incl. 45 min brief)",
        timeMap: "One event = one ATO day", blackout: "2026-11-28 (US Thanksgiving weekend), 2026-12-26",
        blueOob: "CVN-73 with 2× F/A-18C squadrons (Hornet Bay) and 1× F-14B squadron (volunteers wanted). Andersen AFB: F-16C and F-15E detachments, KC-135 and KC-135 MPRS, E-3. Amphibious group with AH-64D and UH-1H for CTLD logistics.",
        support: ["AWACS / GCI", "Tankers", "JTAC", "CSAR"], supportBy: "Mixed",
        threat: "High",
        redOob: "Saipan: SA-10 battery, SA-15 point defence, ZSU-23-4s. Tinian: SA-11 battalion, SA-8s. Su-27 and MiG-29 at Saipan airfield (human and AI). Type 054 frigates and supply convoys running from the north.",
        slots: [
          { role: "CAP / Escort", airframe: "F/A-18C", n: "8" },
          { role: "Strike", airframe: "F/A-18C", n: "4" },
          { role: "Fleet defence", airframe: "F-14B", n: "4" },
          { role: "SEAD / DEAD", airframe: "F-16C", n: "4" },
          { role: "Strike", airframe: "F-15E", n: "4" },
          { role: "CAS / logistics", airframe: "AH-64D, UH-1H", n: "6" },
          { role: "Red air", airframe: "Su-27, MiG-29S", n: "6" },
          { role: "GCI / JTAC", airframe: "LotATC / CA", n: "2" }
        ],
        minPlayers: "16", maxPlayers: "38", openToGroups: "Yes",
        realism: ["Labels off", "F10 map: own aircraft only", "External views off", "Easy comms off"],
        respawn: "Respawn allowed, but every loss comes out of the base's airframe pool (carrier: 20 Hornets, 6 Tomcats per event)",
        mods: "None — official DCS content only",
        weapons: "No AIM-9X Block II and no AGM-154C on the Hornet until Phase II",
        comms: ["SRS required", "LotATC GCI", "Discord voice for briefings"],
        products: ["Commander's Intent", "AOD", "ATO", "ACO", "SPINS", "JIPTL", "TDPs", "Comm Plan", "BDA / MISREP rollup"],
        leadTime: "ATO, ACO and Comm Plan 72 hours before each event; SPINS once at start, updated as needed",
        dks: "Yes", build: "Shared",
        attachments: "Draft event 1 .miz and order of battle spreadsheet: Hornet Bay Discord, #pacific-talon-planning. Map overlay of the islands with proposed kill boxes to follow.",
        ackConduct: true, ackReport: true, ackTasking: true
      }
    },
    {
      id: "s1", gid: "g9", status: "submitted", created: "2026-10-17T19:00:00Z", updated: "2026-10-18T21:40:00Z", comments: [],
      data: {
        leadCallsign: "RUNNER", leadDiscord: "runner#0420", jfaccChosen: "Interim — election pending", backup: "SPUD", serverHost: "Sponsor group", tz: "US Central",
        infra: "Dedicated server in Dallas, SRS on the same box, Discord: Ridgerunner Det #ops",
        opName: "SILENT HAMMER", theater: "Persian Gulf", era: "Modern (2000+)", mode: "PvP",
        style: "Dynamic / persistent", framework: "MOOSE + Skynet IADS, persistence via our own save script",
        scenario: "Iran-backed forces have seized Abu Musa and the Tunbs and are threatening shipping through the Strait of Hormuz. A coalition air component deploys to Al Dhafra and a carrier group to reopen the strait.",
        redCmdr: "Another group provides one", redName: "VORTEX", redGroup: "Escadron Virtuel Mistral", redContact: "vortex#1180",
        purpose: "Reopen the Strait of Hormuz to commercial shipping and restore control of the disputed islands.",
        method: "Phase I: suppress the coastal IADS and anti-ship missile sites. Phase II: gain air superiority over the strait. Phase III: support amphibious seizure of Abu Musa.",
        endstate: "Coastal anti-ship threat neutralised; islands under coalition control; Red air unable to contest the strait.",
        keytasks: ["Destroy Silkworm and C-802 sites on Qeshm and Abu Musa", "Maintain 24-hour DCA over the carrier group", "Neutralise the SA-10 at Bandar Abbas"],
        constraints: "Carrier must remain south of 26°N until Phase II is complete.",
        restraints: "No strikes on mainland civilian ports.",
        risk: "Moderate risk to strike aircraft; low risk to the carrier and HVAA.",
        blueWin: "All anti-ship sites destroyed AND Abu Musa captured by event 8.",
        blueLoss: "Carrier sunk, OR Blue loses more than 40 airframes, OR Red still holds Abu Musa after event 10.",
        draw: "If neither condition is met after event 10, the campaign ends in a negotiated ceasefire (draw).",
        attrition: "Limited airframes per base", results: ["MISREPs", "Tacview", "Server stats"],
        start: "2026-11-14", events: "10", cadence: "Weekly, Saturdays", sessionTime: "1900Z", sessionLength: "3 hours",
        blackout: "2026-12-26, 2027-01-02", timeMap: "One event = one ATO day",
        blueOob: "2× F/A-18C sqn (CVN), 1× F-16C sqn and 1× F-15E sqn at Al Dhafra, KC-135 and E-3 (AI).",
        support: ["AWACS / GCI", "Tankers", "JTAC"], supportBy: "Mixed",
        threat: "High", redOob: "SA-10, SA-11, SA-15 belts; MiG-29 and Su-27 players; F-14A AI.",
        slots: [{ role: "Strike", airframe: "F-15E", n: "4" }, { role: "SEAD", airframe: "F-16C", n: "4" }, { role: "CAP", airframe: "F/A-18C", n: "8" }, { role: "Red air", airframe: "MiG-29S", n: "6" }],
        minPlayers: "16", maxPlayers: "40", openToGroups: "Yes",
        realism: ["Labels off", "F10 map: own aircraft only", "External views off"], respawn: "Limited by airframe pool",
        mods: "None required", weapons: "No AIM-120D, no GBU-53", comms: ["SRS required", "LotATC GCI"],
        products: ["Commander's Intent", "ATO", "ACO", "SPINS", "JIPTL", "Comm Plan"], leadTime: "72 hours before each event",
        dks: "Yes", build: "Sponsor group", attachments: "Draft .miz and OOB spreadsheet on our Discord #silent-hammer",
        ackConduct: true, ackReport: true, ackTasking: true
      }
    },
    // Notional proposals to populate the CFC review queue
    {
      id: "s3", gid: "g7", status: "submitted", created: "2026-10-18T10:00:00Z", updated: "2026-10-19T16:20:00Z", comments: [],
      data: {
        leadCallsign: "LANCER", leadDiscord: "lancer#5150", jfaccChosen: "Elected by the group", backup: "HOOK", tz: "Netherlands", serverHost: "Sponsor group",
        infra: "Server in Amsterdam, SRS on the same host, Discord: Black Knights #steel-dawn",
        opName: "STEEL DAWN", theater: "Germany (Cold War)", era: "Cold War (1970–1990)", style: "Dynamic / persistent",
        framework: "MOOSE A2A dispatcher, Skynet IADS, persistence script",
        scenario: "1986. Warsaw Pact forces push through the Fulda Gap. NATO air must blunt the second-echelon armour and hold the line until reinforcements arrive.",
        mode: "PvE", redCmdr: "None — Red runs on scripts / AI only",
        purpose: "Stop the Warsaw Pact advance east of the Rhine.",
        method: "Phase I: counter-air over the FEBA. Phase II: interdict second-echelon armour and bridges. Phase III: CAS to support the NATO counter-attack.",
        endstate: "Warsaw Pact offensive halted, bridges over the Weser destroyed, NATO holds Frankfurt.",
        keytasks: ["Destroy the Weser bridges", "Attrit second-echelon tank divisions by 50%", "Defend Ramstein and Hahn"],
        blueWin: "Red armour fails to reach the Frankfurt line by event 6.", blueLoss: "Red armour captures Frankfurt OR Ramstein is overrun.",
        draw: "Front stabilises east of Frankfurt after event 8 — ceasefire.",
        attrition: "Full logistics / warehouses", results: ["MISREPs", "Persistence save file"],
        start: "2026-11-07", events: "8", cadence: "Fortnightly, Sundays", sessionTime: "1400Z", sessionLength: "3 hours", timeMap: "Real-time / persistent server",
        blueOob: "F-16A-era Vipers (F-16C stand-in), F-4E, A-10A, F-5E, Mirage 2000C, AJS-37. AWACS and tankers AI.",
        support: ["AWACS / GCI", "Tankers", "JTAC"], supportBy: "AI", threat: "Very high",
        redOob: "Dense SA-2/3/6/8 belts, MiG-21/23/29 and Su-17 AI, ZSU-23-4 with every regiment.",
        slots: [{ role: "Counter-air", airframe: "F-16C / Mirage 2000C", n: "8" }, { role: "Interdiction", airframe: "F-4E / AJS-37", n: "8" }, { role: "CAS", airframe: "A-10A / A-10C", n: "6" }],
        minPlayers: "12", maxPlayers: "30", openToGroups: "Yes",
        realism: ["Labels off", "F10 map: own aircraft only", "External views off"], respawn: "Limited by warehouse stock",
        mods: "None", weapons: "No weapons fielded after 1986 (no AIM-120, no JDAM, no TGP)", comms: ["SRS required"],
        products: ["Commander's Intent", "ATO", "ACO", "SPINS", "JIPTL", "Comm Plan"], leadTime: "5 days before each event",
        dks: "Maybe", build: "Sponsor group", attachments: "Campaign map with FEBA trace on our Discord.",
        ackConduct: true, ackReport: true, ackTasking: true
      }
    },
    {
      id: "s4", gid: "g8", status: "submitted", created: "2026-10-19T22:00:00Z", updated: "2026-10-20T02:10:00Z", comments: [],
      data: {
        leadCallsign: "ROGUE", leadDiscord: "rogue#1987", jfaccChosen: "Appointed by group leadership", backup: "MERLIN", tz: "US East", serverHost: "CAOC",
        opName: "SOUTHERN CROSS", theater: "South Atlantic", era: "Cold War (1970–1990)", style: "Scripted mission series",
        framework: "MIST, custom scoring script",
        scenario: "A fictional 1982-style crisis: Red seizes the islands and bases strike aircraft on the main airstrip. A Blue carrier task force sails south to retake them.",
        mode: "PvP", redCmdr: "Another group provides one", redName: "CONDOR", redContact: "condor#0402", redGroup: "Escadron Virtuel Mistral",
        redIntent: "Red will fly Mirage 2000C and AI A-4s from the mainland against the task force.",
        purpose: "Retake the islands and protect the task force from air attack.",
        method: "Phase I: fleet air defence and an exclusion zone. Phase II: strike the airstrip. Phase III: support the landings.",
        endstate: "Islands retaken, airstrip closed, task force intact.",
        blueWin: "Airstrip closed for 2 events AND landing force ashore by event 6.",
        blueLoss: "Carrier OR both amphibious ships sunk.",
        draw: "No decision by event 7 — negotiated withdrawal.",
        attrition: "Pilot lives", results: ["MISREPs", "Tacview"],
        start: "2026-12-05", events: "7", cadence: "Weekly, Fridays", sessionTime: "0100Z", sessionLength: "3 hours", timeMap: "One event = one ATO day",
        blueOob: "CVN with F-14B and F/A-18C, AV-8B detachment on the amphibious ship.", support: ["AWACS / GCI", "Tankers", "CSAR"], supportBy: "Mixed", threat: "High",
        slots: [{ role: "Fleet defence", airframe: "F-14B", n: "8" }, { role: "Strike", airframe: "F/A-18C", n: "6" }, { role: "CAS", airframe: "AV-8B", n: "4" }, { role: "Red air", airframe: "M-2000C", n: "8" }],
        minPlayers: "14", maxPlayers: "32", openToGroups: "Invite only",
        realism: ["Labels off", "External views off", "Padlock off"], comms: ["SRS required", "LotATC GCI"],
        products: ["Commander's Intent", "ATO", "SPINS", "Comm Plan", "BDA / MISREP rollup"], leadTime: "72 hours",
        dks: "Yes", build: "CAOC",
        ackConduct: true, ackReport: true, ackTasking: true
      }
    },
    {
      id: "s5", gid: "g10", status: "submitted", created: "2026-10-15T08:00:00Z", updated: "2026-10-16T11:45:00Z", comments: [],
      data: {
        leadCallsign: "BEAST", leadDiscord: "beast#0808", jfaccChosen: "Interim — election pending", tz: "Australia", serverHost: "Not decided",
        opName: "NIGHT HARVEST", theater: "Afghanistan", era: "Modern (2000+)", style: "Dynamic / persistent",
        framework: "Foothold-style zone capture",
        scenario: "Insurgent forces control the Helmand valley. Coalition aviation supports ground operations from Camp Bastion and Kandahar.",
        mode: "Mixed (AI Red + human Red players)", redCmdr: "Request a CAOC-appointed REDFOR commander",
        purpose: "Clear insurgent strongholds in the valley and keep the main road open.",
        method: "Continuous CAS, armed overwatch and helicopter logistics, zone by zone from south to north.",
        endstate: "All valley zones under coalition control; road open for 3 consecutive events.",
        blueWin: "All 12 zones captured.", blueLoss: "Camp Bastion falls OR fewer than 4 zones held after event 10.", draw: "Ends after event 12 with the zone count deciding.",
        attrition: "None — unlimited respawns", results: ["Server stats"],
        start: "2026-11-15", events: "12", cadence: "Weekly, Sundays", sessionTime: "0900Z", sessionLength: "4 hours", timeMap: "Real-time / persistent server",
        support: ["JTAC", "Airlift"], supportBy: "Players", threat: "Low",
        slots: [{ role: "CAS", airframe: "AV-8B / A-10C", n: "8" }, { role: "Logistics", airframe: "UH-1H / CH-47F", n: "6" }, { role: "Red ground", airframe: "Combined Arms", n: "4" }],
        minPlayers: "6", maxPlayers: "20", openToGroups: "Yes",
        products: ["Commander's Intent", "SPINS", "Comm Plan"], dks: "No", build: "Shared",
        ackConduct: true, ackReport: true, ackTasking: true
      }
    },
    {
      id: "s6", gid: "g12", status: "returned", created: "2026-10-12T18:00:00Z", updated: "2026-10-14T20:30:00Z",
      comments: [{ by: "ATLAS", when: "2026-10-14T20:30:00Z", action: "Returned for changes",
        text: "Good concept. Please make the win/loss conditions measurable (which towns, how many convoys) and confirm who hosts the server before resubmitting." }],
      data: {
        leadCallsign: "THUNDER", leadDiscord: "thunder#6464", jfaccChosen: "Elected by the group", tz: "UK", serverHost: "Not decided",
        opName: "RIVER SERPENT", theater: "Iraq", era: "Modern (2000+)", style: "Scripted mission series",
        scenario: "Militia forces move weapons down the Euphrates. Attack helicopters and fast jets hunt the convoys.",
        mode: "PvE", redCmdr: "None — Red runs on scripts / AI only",
        purpose: "Cut militia supply lines along the Euphrates.", method: "Armed reconnaissance and convoy interdiction by night.",
        endstate: "Militia resupply stopped.", blueWin: "Stop the convoys.", blueLoss: "Lose too many helicopters.", draw: "Campaign ends after 6 events.",
        start: "2026-11-01", events: "6", cadence: "Weekly", sessionTime: "1900Z",
        minPlayers: "4", maxPlayers: "16", products: ["Commander's Intent", "ATO", "TDPs"],
        ackConduct: true, ackReport: true, ackTasking: true
      }
    }
  ],

  // Product requests from participating groups ("on user request")
  requests: [
    { id: "r1", campaign: "iron-trident", group: "g1", product: "ato", note: "ATO AI for Thursday 2000Z event", when: "2026-10-19T14:10Z", state: "open" },
    { id: "r2", campaign: "iron-trident", group: "g4", product: "tdp", note: "TDP for JIPTL #4 (Bridge LIMA)", when: "2026-10-19T09:42Z", state: "open" },
    { id: "r3", campaign: "iron-trident", group: "g2", product: "aco", note: "Updated ACO — need CAP KNIFE altitudes", when: "2026-10-18T21:05Z", state: "open" },
    { id: "r5", campaign: "iron-trident", group: "g11", product: "ato", note: "Volunteer for open line 8203 (DCA, CAP KNIFE 1400–1800Z) with 2× M-2000C", when: "2026-10-19T20:15Z", state: "open" },
    { id: "r4", campaign: "desert-lance", group: "g5", product: "ci", note: "Commander's Intent for squadron brief", when: "2026-10-18T17:30Z", state: "open" }
  ],

  // Pre-filled example content for IRON TRIDENT so the builders show realistic products
  content: {
    "iron-trident": {
      ci: {
        commander: "SABRE (JFACC, Viper Ops Group)",
        dtg: "121200ZOCT26",
        purpose: "Restore the territorial integrity of the Republic of Georgia by defeating Red air and ground forces west of the Kutaisi–Senaki line, enabling coalition ground forces to secure key terrain.",
        method: "Gain and maintain air superiority over the western Caucasus through sustained OCA and SEAD, then shift weight of effort to interdiction of Red reinforcements along the Rikoti Pass corridor while providing responsive CAS to friendly ground forces.",
        endstate: "Red IADS in the western sector rendered ineffective; Red air unable to contest coalition operations below FL300; Red ground forces west of Kutaisi isolated from reinforcement.",
        keytasks: [
          "Neutralise SA-10 and SA-11 sites covering Kutaisi and Senaki",
          "Establish 24-hour DCA over Batumi and Kobuleti",
          "Interdict Red LOCs through the Rikoti Pass",
          "Provide on-call CAS to Task Force BLUE in AO HAMMER"
        ],
        constraints: "Maintain 20 NM standoff from the Russian border. All strikes in urban areas require positive ID and JFACC approval.",
        restraints: "No strikes on dual-use infrastructure (power, water) without JFACC approval. No cluster munitions within 2 km of populated areas.",
        risk: "Accept moderate risk to aircraft during SEAD in Phase II. Accept low risk to HVAA (tankers, AWACS) — keep 60 NM behind the FLOT."
      },
      aod: {
        atoDay: "8",
        period: "200600Z OCT 26 – 210559Z OCT 26",
        guidance: "Weight of effort shifts from OCA/SEAD to air interdiction. Maintain DCA posture. Prioritise destruction of Red bridging and fuel along MSR TAMPA.",
        objectives: [
          { pri: "1", objective: "Suppress remaining Red SAM coverage in the western sector", effect: "Neutralise", tasks: "SEAD, DEAD" },
          { pri: "2", objective: "Isolate Red forces west of Kutaisi", effect: "Interdict", tasks: "INT, XINT" },
          { pri: "3", objective: "Support TF BLUE advance to Senaki", effect: "Support", tasks: "CAS, XCAS" }
        ],
        apportionment: [
          { mission: "DCA", pct: "15" }, { mission: "OCA", pct: "10" }, { mission: "SEAD/DEAD", pct: "25" },
          { mission: "INT", pct: "30" }, { mission: "CAS", pct: "15" }, { mission: "ISR", pct: "5" }
        ],
        targeting: "Strike only targets on the approved JIPTL. Dynamic targets require JFACC or delegated SODO approval.",
        notes: "SPINS v3 in effect. Code words: BLUE MOON = abort all strikes, RAIN DANCE = SAM re-occupation detected."
      },
      jiptl: {
        rows: [
          // hand-built example; "Target nomination" regenerates this list from the REDFOR order of battle
          { id: "T10001", name: "SA-10 Battery KUTAISI EAST", task: "1", grade: "A", cat: "SAM (long range)", loc: "38T LM 012 845", effect: "Destroy" },
          { id: "T10002", name: "SA-11 Battalion SENAKI", task: "1", grade: "A", cat: "SAM (medium range)", loc: "38T KM 645 712", effect: "Destroy" },
          { id: "T10003", name: "Early Warning Radar TSKALTUBO", task: "1", grade: "B", cat: "Early warning radar", loc: "38T LM 041 897", effect: "Disrupt" },
          { id: "T10004", name: "Road Bridge LIMA (Rioni)", task: "3", grade: "B", cat: "LOC", loc: "38T LM 102 811", effect: "Deny" },
          { id: "T10005", name: "Fuel Depot SAMTREDIA", task: "3", grade: "B", cat: "Ammo / POL", loc: "38T KM 911 790", effect: "Destroy" },
          { id: "T10006", name: "Armour Assembly Area GOLD", task: "3", grade: "C", cat: "Armor", loc: "38T KM 822 755", effect: "Attrit 30%" }
        ]
      },
      // TDP book: one folder per JIPTL target (built on tdp.html)
      tdp: { folders: {
        "T10004": { status: "ready", grade: "B", cde: "3",
        targetId: "T10004",
        name: "Road Bridge LIMA (Rioni)",
        category: "LOC — Bridge",
        coords: "N42°11.420' E042°39.610'",
        mgrs: "38T LM 102 811",
        elev: "112 ft MSL",
        description: "Two-span reinforced concrete road bridge over the Rioni River carrying MSR TAMPA. Approx. 180 m long, 12 m wide. Primary crossing for Red reinforcements moving west.",
        effect: "Deny use of the bridge to Red vehicle traffic for 72+ hours.",
        dmpis: [
          { id: "A", desc: "West abutment / span 1 joint", coords: "N42°11.418' E042°39.552'", weapon: "GBU-31(V)3" },
          { id: "B", desc: "Centre pier", coords: "N42°11.421' E042°39.611'", weapon: "GBU-31(V)3" }
        ],
        threats: [
          { sys: "ZSU-23-4", loc: "1.2 NM NE of bridge", range: "1.5 NM / 8,000 ft" },
          { sys: "SA-8", loc: "4 NM E (mobile, last seen 18 OCT)", range: "5.5 NM / 16,000 ft" }
        ],
        collateral: "Village 1.1 km south. Attack axis east-to-west, release no lower than 15,000 ft.",
        imagery: "Recon pod imagery from 18 OCT available on SRS/Discord #intel.",
        bda: "Post-strike TGP video required; request TARPS pass within 6 hours." },
        "T10001": { status: "draft", grade: "A", cde: "2", targetId: "T10001", name: "SA-10 Battery KUTAISI EAST", category: "SAM (long range)", coords: "N42°16.200' E042°49.200'",
          mgrs: "38T LM 012 845", elev: "", description: "SA-10 battery: 5P85 TELARs, 30N6 Flap Lid tracking radar, 64N6 Big Bird search radar, command post.",
          effect: "Destroy — supports key task 1 (air superiority over the Rioni valley)",
          dmpis: [{ id: "A", desc: "30N6 Flap Lid (critical — names the target)", coords: "N42°16.200' E042°49.200'", weapon: "AGM-88C / GBU-31" },
            { id: "B", desc: "64N6 Big Bird search radar", coords: "N42°16.260' E042°49.050'", weapon: "GBU-31" }],
          threats: [{ sys: "SA-15 Tor (point defence)", loc: "0.8 NM, 045°", range: "SAM (short range)" }], collateral: "", imagery: "", bda: "TGP video of every engagement / tracking radar; follow-up ISR within 6 h." }
      } },
      // Planning conference with the host JFACC (internal; feeds the ACO and every later product)
      pcon: {
        date: "2026-09-28 2000Z", attendees: "OVERLORD (CFACC), ATLAS (CFC), SABRE (host JFACC, Viper Sqn), CHALICE, WIZARD, DARKSTAR",
        items: [
          {section: "Campaign basics",item: "Operation name, theater/map and era confirmed",done: true,notes: ""},
          {section: "Campaign basics",item: "First mission date (T-0), start time (Z) and event cadence",done: true,notes: ""},
          {section: "Campaign basics",item: "Number of events / ATO days and campaign end condition",done: true,notes: ""},
          {section: "Campaign basics",item: "Planning timeline and deadlines agreed (see CAOC rollup)",done: true,notes: ""},
          {section: "People and channels",item: "Group JFACC and deputy confirmed as the CAOC's points of contact",done: true,notes: ""},
          {section: "People and channels",item: "CAOC leads named for each product (CFACC owns approval)",done: true,notes: ""},
          {section: "People and channels",item: "REDFOR commander (own / other group / CAOC-appointed / none)",done: true,notes: ""},
          {section: "People and channels",item: "Discord channels for planning, ATO line posts and debrief",done: true,notes: ""},
          {section: "Intent and objectives",item: "Commander's Intent draft reviewed (purpose, method, end state)",done: true,notes: ""},
          {section: "Intent and objectives",item: "Key tasks and their priority / weights for targeting",done: true,notes: ""},
          {section: "Intent and objectives",item: "Win, loss and draw conditions are measurable",done: true,notes: ""},
          {section: "Intent and objectives",item: "ROE posture and default weapons control status",done: true,notes: ""},
          {section: "Forces and ATO lines",item: "BLUE order of battle, bases / carrier",done: true,notes: ""},
          {section: "Forces and ATO lines",item: "Which flights are Human (posted for commitment) vs AI",done: true,notes: ""},
          {section: "Forces and ATO lines",item: "ATO line request plan: airframes, numbers, mission types",done: true,notes: ""},
          {section: "Forces and ATO lines",item: "Support assets: AWACS/GCI, tankers, JTAC, CSAR — Human or AI",done: true,notes: ""},
          {section: "REDFOR and threat",item: "REDFOR order of battle source (the host .miz)",done: true,notes: ""},
          {section: "REDFOR and threat",item: "Threat level, IADS laydown, Red air (AI / human)",done: true,notes: ""},
          {section: "Airspace (feeds the ACO)",item: "Area of operations and initial FLOT / FSCL trace",done: true,notes: ""},
          {section: "Airspace (feeds the ACO)",item: "CAP stations and HVAA (AWACS) orbits",done: true,notes: ""},
          {section: "Airspace (feeds the ACO)",item: "Tanker tracks: locations, size (default 50 × 20 NM), altitudes",done: true,notes: ""},
          {section: "Airspace (feeds the ACO)",item: "Kill boxes, ROZs, MRR corridors, restricted areas",done: true,notes: ""},
          {section: "Airspace (feeds the ACO)",item: "Artillery / fire support areas and MAXORDs",done: true,notes: ""},
          {section: "Targeting",item: "AO (Area of Operations) for target nomination (box or point + radius)",done: true,notes: ""},
          {section: "Targeting",item: "Target priorities and collateral restrictions",done: true,notes: ""},
          {section: "Targeting",item: "TDP depth: which grades get full target folders",done: true,notes: ""},
          {section: "Comms (built last)",item: "SRS server and tactical nets needed (TAC COORD, TAC ADMIN, C2, A/A, tankers, JTAC, rescue)",done: true,notes: ""},
          {section: "Comms (built last)",item: "Spare channels per net; airfield / ATC frequencies stay out of the comm plan",done: true,notes: ""},
          {section: "Comms (built last)",item: "Datalink / IFF conventions",done: true,notes: ""},
          {section: "SPINS inputs",item: "Weapons restrictions",done: true,notes: ""},
          {section: "SPINS inputs",item: "Code words and authentication",done: true,notes: ""},
          {section: "SPINS inputs",item: "CSAR plan and divert fields",done: true,notes: ""},
          {section: "Mission file and products",item: "Host .miz due date and version (CAOC extracts BLUE flights and REDFOR from it)",done: true,notes: ""},
          {section: "Mission file and products",item: "Mods / scripts required",done: true,notes: ""},
          {section: "Mission file and products",item: "Products wanted (default: all CAOC products)",done: true,notes: ""},
          {section: "Mission file and products",item: "Publish date and how the host receives the package",done: true,notes: ""}
        ],
        actions: [{ action: "Send the draft .miz with REDFOR laid in", owner: "SABRE", due: "2026-10-02" },
          { action: "Build the ACO and theater map from the agreed airspace", owner: "CHALICE", due: "2026-10-05" }],
        notes: "Host runs readiness, the mass brief and the mission. The CAOC builds and publishes the products only."
      },
      // MAAP: packages from the ATO lines against the JIPTL (built on maap.html)
      maap: {
        packages: [
          { name: "A", tot: "0720Z", push: "0650Z", targets: ["T10001", "T10002", "T10004", "T10005"], lines: ["8101", "8102", "8103", "8104", "8105", "8601"], notes: "SEAD/DEAD opens the corridor for the strikers",
            strike: ["8102", "8601"], sead: ["8101", "8104"], escort: ["8103", "8105"], tanker: [] },
          { name: "B", tot: "1100Z", push: "1030Z", targets: ["T10005"], lines: ["8111", "8112", "8113", "8114", "8115"], notes: "Re-attack of the fuel depot",
            strike: ["8112", "8113"], sead: ["8114", "8115"], escort: ["8111"], tanker: [] }
        ],
        lineLabels: { "8101": "8101 VIPER 1 (4× F-16C SEAD)", "8102": "8102 DUDE 1 (2× F-15E AI)", "8103": "8103 SPRINGFIELD 1 (4× F/A-18C Escort)",
          "8104": "8104 KNIGHT 1 (4× F-16C DEAD)", "8105": "8105 EAGLE 1 (4× F-15C OCA)", "8601": "8601 RUNNER 1 (4× F-15E Strike)",
          "8111": "8111 MISTRAL 1 (2× M-2000C Escort)", "8112": "8112 BEAST 1 (2× AV-8B AI)", "8113": "8113 DUDE 3 (2× F-15E AI)",
          "8114": "8114 VIPER 5 (2× F-16C SEAD)", "8115": "8115 TBD (2× F-16C SEAD)" },
        coverage: "4 of 6 (T10001, T10002, T10004, T10005)"
      },
      ato: {
        atoDay: "8",
        period: "200600Z OCT 26 – 210559Z OCT 26",
        // Lines with an empty group are open for volunteers
        missions: [
          { msn: "8101", pkg: "A", group: "g1", callsign: "VIPER 1", type: "F-16C", num: "4", role: "SEAD", tot: "0715Z", target: "T10001", tanker: "TEXACO 1" },
          { msn: "8102", pkg: "A", group: "g3", callsign: "DUDE 1", type: "F-15E", num: "2", role: "INT", tot: "0720Z", target: "T10004", tanker: "TEXACO 1" },
          { msn: "8103", pkg: "A", group: "g2", callsign: "SPRINGFIELD 1", type: "F/A-18C", num: "4", role: "Escort", tot: "0710Z", target: "Pkg A", tanker: "ARCO 1" },
          { msn: "8104", pkg: "A", group: "g7", callsign: "KNIGHT 1", type: "F-16C", num: "4", role: "DEAD", tot: "0718Z", target: "T10002", tanker: "TEXACO 2" },
          { msn: "8105", pkg: "A", group: "g13", callsign: "EAGLE 1", type: "F-15C", num: "4", role: "OCA", tot: "0705Z", target: "Pkg A sweep", tanker: "TEXACO 2" },
          { msn: "8111", pkg: "B", group: "g11", callsign: "MISTRAL 1", type: "M-2000C", num: "2", role: "Escort", tot: "1055Z", target: "Pkg B", tanker: "—" },
          { msn: "8112", pkg: "B", group: "g10", callsign: "BEAST 1", type: "AV-8B", num: "2", role: "INT", tot: "1100Z", target: "T10005", tanker: "ARCO 1" },
          { msn: "8113", pkg: "B", group: "g3", callsign: "DUDE 3", type: "F-15E", num: "2", role: "INT", tot: "1102Z", target: "T10005", tanker: "TEXACO 1" },
          { msn: "8114", pkg: "B", group: "g1", callsign: "VIPER 5", type: "F-16C", num: "2", role: "SEAD", tot: "1058Z", target: "Pkg B", tanker: "TEXACO 1" },
          { msn: "8115", pkg: "B", group: "", callsign: "TBD", type: "F-16C", num: "2", crew: "Human", role: "SEAD", tot: "1058Z", target: "Pkg B", tanker: "TEXACO 1", lineId: "L8115" },
          { msn: "8201", pkg: "—", group: "g8", callsign: "ROGUE 1", type: "F-14B", num: "2", role: "DCA", tot: "0600–1000Z", target: "CAP KNIFE", tanker: "ARCO 1" },
          { msn: "8202", pkg: "—", group: "g13", callsign: "EAGLE 5", type: "F-15C", num: "2", role: "DCA", tot: "1000–1400Z", target: "CAP KNIFE", tanker: "TEXACO 2" },
          { msn: "8203", pkg: "—", group: "", callsign: "TBD", type: "F-14B", num: "2", crew: "Human", role: "DCA", tot: "1400–1800Z", target: "CAP KNIFE", tanker: "TEXACO 2", lineId: "L8203" },
          { msn: "8301", pkg: "—", group: "g4", callsign: "HAWG 1", type: "A-10C II", num: "2", role: "CAS", tot: "0800Z", target: "AO HAMMER", tanker: "—" },
          { msn: "8302", pkg: "—", group: "g4", callsign: "HAWG 3", type: "A-10C II", num: "2", role: "CAS", tot: "1000Z", target: "AO HAMMER", tanker: "—" },
          { msn: "8303", pkg: "—", group: "g12", callsign: "THUNDER 1", type: "AH-64D", num: "2", role: "CAS", tot: "0830Z", target: "AO HAMMER", tanker: "—" },
          { msn: "8304", pkg: "—", group: "g10", callsign: "BEAST 3", type: "AV-8B", num: "2", role: "CAS", tot: "1200Z", target: "AO HAMMER", tanker: "—" },
          { msn: "8305", pkg: "—", group: "", callsign: "TBD", type: "A-10C II", num: "2", crew: "Human", role: "CAS", tot: "1400Z", target: "AO HAMMER", tanker: "—", lineId: "L8305" },
          { msn: "8401", pkg: "—", group: "", callsign: "TEXACO 1", type: "KC-135", num: "1", crew: "AI", role: "AR", tot: "0630Z", target: "AR TRACK ALPHA", tanker: "—" },
          { msn: "8402", pkg: "—", group: "", callsign: "ARCO 1", type: "KC-135 MPRS", num: "1", crew: "AI", role: "AR", tot: "0630Z", target: "AR TRACK BRAVO", tanker: "—" },
          { msn: "8403", pkg: "—", group: "", callsign: "DARKSTAR", type: "E-3A", num: "1", crew: "AI", role: "AEW", tot: "0600Z", target: "Orbit WEST", tanker: "—" },
          // requested by the JFACC from the sponsor .miz: a committed F-15E 4-ship and an AI tanker
          { msn: "8601", pkg: "A", group: "g9", callsign: "RUNNER 1", type: "F-15E", num: "4", crew: "Human", role: "Strike", tot: "0722Z", target: "T10005", tanker: "TEXACO 1", lineId: "L8601" },
          { msn: "8602", pkg: "—", group: "", callsign: "SHELL 1", type: "KC-135 MPRS", num: "1", crew: "AI", role: "AR", tot: "0630Z", target: "AR TRACK ALPHA", tanker: "—", lineId: "L8602" }
        ]
      },
      aco: {
        period: "200600Z OCT 26 – 210559Z OCT 26",
        measures: [
          { name: "CAP KNIFE", type: "CAP", geo: "Center N42°10' E041°40', R 15 NM", alt: "FL200–FL300", time: "0600Z–1800Z", ctrl: "DARKSTAR" },
          { name: "AR TRACK ALPHA", type: "AR Track", geo: "N41°55' E042°05' → N41°50' E042°35'", alt: "FL220–FL240", time: "0600Z–2200Z", ctrl: "DARKSTAR" },
          { name: "KILL BOX 38TLM", type: "Kill Box", geo: "38T LM 00/80 to 20/95", alt: "SFC–FL250", time: "0700Z–1000Z", ctrl: "CHALICE" },
          { name: "ROZ HAMMER", type: "ROZ", geo: "AO HAMMER boundary", alt: "SFC–15,000 ft", time: "0800Z–1400Z", ctrl: "JTAC MAGNUM" }
        ]
      },
      spins: {
        version: "v3",
        period: "180600Z OCT 26 until superseded",
        bullseye: "TBILISI (N41°41' E044°49')",
        wcs: "Weapons Tight", alr: "Medium",
        roe: "Hostile act or hostile intent required for engagement outside declared hostile forces. All Red military aircraft north of the FSCL are declared hostile. Self-defence is always authorised.",
        idCriteria: "Weapons Tight: two of — AWACS declaration HOSTILE, NCTR/visual ID, point of origin from Red airfield. Commit criteria for DCA: Red fighters within 40 NM of CAP KNIFE or heading toward HVAA.",
        codewords: [
          { type: "Action", word: "TERMINATOR", meaning: "Abort all strikes, RTB" },
          { type: "Action", word: "PREDATOR", meaning: "SAM re-occupation detected — SEAD respond" },
          { type: "Action", word: "ROBOCOP", meaning: "CSAR in progress — clear the area on Strike Common" },
          { type: "Action", word: "BATMAN", meaning: "HVAA threatened — DCA commit" },
          { type: "GEOREF", word: "AEROSMITH", meaning: "Package A push point" },
          { type: "GEOREF", word: "METALLICA", meaning: "Package B push point" },
          { type: "OPFOR", word: "MUSTANG", meaning: "SA-6" },
          { type: "OPFOR", word: "CORVETTE", meaning: "SA-11" }
        ],
        weapons: [
          { weapon: "Cluster munitions (CBU-87/97, Mk-20)", status: "Prohibited", applies: "All", conditions: "Within 2 km of populated areas" },
          { weapon: "Unguided bombs", status: "Restricted", applies: "All", conditions: "Not within 1 km of friendly troops or in urban areas; CAS only under JTAC Type 1 control" },
          { weapon: "AGM-88 HARM (PB mode)", status: "Restricted", applies: "F-16C, F/A-18C", conditions: "Pre-briefed mode only against JIPTL targets; no PB shots over the FLOT" },
          { weapon: "AIM-120 (BVR shots)", status: "Restricted", applies: "All fighters", conditions: "Weapons Tight — requires AWACS HOSTILE declaration per ID criteria" },
          { weapon: "Strikes on dual-use infrastructure", status: "JFACC approval required", applies: "All", conditions: "Power, water and bridges not on the JIPTL" },
          { weapon: "Laser-guided bombs", status: "Authorised", applies: "All", conditions: "Laser codes 1688 (strike), 1511 (CAS) — deconflict on the package frequency" }
        ],
        weaponsNotes: "Jettison area: over water west of Kobuleti, 20 NM offshore. Hung ordnance recovers to Kobuleti only, straight-in approach.",
        auth: "",
        checkin: "Check in on YELLOW 1 (HOWDY) when airborne. Channels will be referred to by Comm Plan matrix ID.",
        tanker: "Check in with tanker 10 NM from track on boom/drogue freq. Max 2 flights on the boom at once; others hold 1,000 ft above at the anchor.",
        csar: "Downed aircrew: initial call on Guard, then the PR primary (GREEN 3). SANDY lead is the on-scene commander. 55th RQS (MH-60L) on 15-min alert at Senaki once the area is secure.",
        diverts: [
          { field: "Kobuleti", tacan: "67X", freq: "262.000", rwy: "07", notes: "Primary divert, arresting gear" },
          { field: "Batumi", tacan: "16X", freq: "260.000", rwy: "13", notes: "Short runway, no arresting gear" },
          { field: "Vaziani", tacan: "22X", freq: "269.000", rwy: "13", notes: "Rear divert, tanker base" }
        ],
        naval: [{ ship: "CVN-71 Theodore Roosevelt", hull: "CVN_71", tacanCh: "71", tacanMode: "X", tacanCs: "TDR", icls: "11", notes: "Link 4 / ACLS on 336.000" }],
        emergency: "Lost comms: squawk 7600, proceed to the lost-comms holding point (Kobuleti overhead FL150), then recover via the published MRR."
      },
      // Target nomination settings: its own AO, Area of Operations (a box over Kutaisi–Senaki–Samtredia) and a sample
      // Coalition Parser export. Independent of the ACO / theater map.
      targeting: { area: { mode: "box", n: "42.45", s: "41.98", w: "41.85", e: "43.00", lat: "42.20", lon: "42.45", radius: "30" },
        sampleCsv: "samples/iron_trident_redfor.csv" },
      // Theater map (opened from the ACO): nav / spider / dest points and threats; shapes for the DKS Overlay.
      // Waypoints, IPs, targets and bullseye are built in DKS.
      map: {
        points: [
          { id: "p3", type: "NAV POINT", name: "NAV ALPHA", lat: 42.05, lng: 42.10, notes: "" },
          { id: "p4", type: "NAV POINT", name: "NAV BRAVO", lat: 42.17, lng: 42.33, notes: "" },
          { id: "p5", type: "SPIDER POINT", name: "SPIDER 1", lat: 42.32, lng: 42.52, notes: "Pkg A push point" },
          { id: "p6", type: "SPIDER POINT", name: "SPIDER 2", lat: 42.08, lng: 42.86, notes: "Pkg B push point" },
          { id: "p9", type: "THREAT", name: "SA-8 (MOBILE)", system: "SA-8 Gecko (Osa)", range: "5.5", lat: 42.21, lng: 42.74, notes: "Last seen 18 OCT" },
          { id: "p11", type: "THREAT", name: "SA-10 KUTAISI EAST", system: "SA-10 Grumble (S-300PS)", range: "40", lat: 42.27, lng: 42.82, notes: "JIPTL #1 (T10001)" },
          { id: "p12", type: "THREAT", name: "SA-11 SENAKI", system: "SA-11 Gadfly (Buk)", range: "19", lat: 42.24, lng: 42.06, notes: "JIPTL #2 (T10002)" },
          { id: "p10", type: "DEST POINT", name: "DP KOBULETI", lat: 41.86, lng: 41.78, elev: "59", notes: "Recovery / hung ordnance" }
        ],
        shapes: [
          // control measures (typed): Blue holds the coast to the south, Red is north of the FLOT
          // drawn west → east, so the enemy (north) is on the left: scallops bulge left, no flip needed
          { id: "m1", type: "FLOT", kind: "polyline", name: "FLOT", color: "BLUE", latlngs: [[42.02, 41.65], [41.99, 42.05], [42.03, 42.40], [41.98, 42.75], [42.00, 43.05]], time: "200600Z OCT 26", flip: "", notes: "" },
          { id: "m2", type: "FSCL", kind: "polyline", name: "FSCL", color: "BLACK", latlngs: [[42.27, 41.60], [42.26, 42.10], [42.28, 42.60], [42.25, 43.05]], hq: "TF BLUE", time: "200600Z OCT 26", notes: "Coordination required short of the FSCL" },
          { id: "m3", type: "MRR", kind: "polyline", name: "MRR 1", color: "BLUE", latlngs: [[41.80, 41.75], [41.93, 41.86], [42.05, 42.10]], width: "5", altLo: "5,000 ft", altHi: "15,000 ft", time: "0600Z–2200Z", notes: "Ingress/egress from Kobuleti" },
          // AR track: standard 50 × 20 NM left-hand anchor; ARCP is the start of the refuelling leg, orbit sits south of the leg
          // (away from the FLOT). ARIP is 10 NM before the orbit ENTRY (its offset is stored relative to the entry).
          { id: "m4", type: "TANKER TRACK", kind: "anchor", name: "AR TRACK ALPHA", color: "BLUE", aco: "AR TRACK ALPHA",
            arcp: [41.75, 42.70], heading: "280", length: "50", width: "20", aripOn: "Yes",
            rel: { entry: { a: -10, c: 20 }, exit: { a: 65, c: 0 }, arip: { a: -10, c: 0 } },
            altLo: "FL220", altHi: "FL240", callsign: "TEXACO 1", freq: "305.000", tacanCh: "41", tacanMode: "Y", tacanCs: "TEX", notes: "BOOM — BLUE 1" },
          { id: "m5", type: "HVAA ORBIT", kind: "track", name: "ORBIT WEST", color: "PURPLE", latlngs: [[41.22, 41.90], [41.12, 42.45]], width: "15", altLo: "FL290", altHi: "FL310", callsign: "DARKSTAR", freq: "295.000", notes: "E-3 orbit — keep 60 NM behind the FLOT" },
          { id: "m6", type: "ARTY ROZ", kind: "polygon", name: "ARTY ROZ 1", color: "ORANGE", latlngs: [[41.90, 42.28], [41.995, 42.28], [42.01, 42.52], [41.90, 42.52]], altLo: "SFC", maxord: "18,000 ft", unit: "2-14 FA (M109)", time: "0700Z–1100Z", notes: "Fires north across the FLOT — remain clear below MAXORD" },
          // plain overlay shapes linked to ACO measures
          { id: "s1", kind: "circle", name: "CAP KNIFE", color: "YELLOW", aco: "CAP KNIFE", lat: 42.1667, lng: 41.6667, radius: 27780, notes: "FL200–FL300" },
          { id: "s3", kind: "rectangle", name: "KILL BOX 38TLM", color: "RED", aco: "KILL BOX 38TLM", latlngs: [[42.05, 42.55], [42.25, 42.55], [42.25, 42.85], [42.05, 42.85]], notes: "SFC–FL250, 0700Z–1000Z" }
        ]
      },
      // an urban GRG over Kutaisi (built and printed on grg.html)
      grg: { sheets: [{ id: "G-KUT", name: "GRG KUTAISI CENTRE", lat: 42.2705, lon: 42.7035, cell: 100, cols: 8, rows: 6, keypads: false, measures: true, v: 1, from: "" }] },
      // the demo Comm Plan, built on the JCEOI standard net plan (roles and frequencies), with the campaign's callsigns.
      // SCAR (YELLOW 6) and SAR-B (GREEN 5) sit in spare rows: the ATO and the SPINS PR section use them. Named colour + row, e.g. WHITE 1 = RAZOR.
      acp: {
        matrixName: "IRON TRIDENT",
        srs: "Exercise SRS — channel AOC-IRON-TRIDENT",
        matrix: {
          rows: 6,
          columns: [
            { title: "TAC ADMIN", color: "WHITE", cells: [
              { role: "TAC COORD", callsign: "RAZOR", freq: "290.050" },
              { role: "TAC ADMIN", freq: "292.500" },
              { role: "C2 / AWACS", callsign: "DARKSTAR", freq: "295.000" },
              { role: "GCI", callsign: "KEYBOARD", freq: "297.500" },
              { role: "HOST C2", freq: "300.000" },
              { role: "SPARE", freq: "302.500" } ] },
            { title: "TANKERS", color: "BLUE", cells: [
              { role: "BOOM 1", freq: "305.000" },
              { role: "BOOM 2", freq: "307.500" },
              { role: "DROGUE 1", freq: "310.000" },
              { role: "DROGUE 2", freq: "312.500" },
              { role: "MPRS", freq: "315.000" },
              { role: "SPARE", freq: "317.550" } ] },
            { title: "TACTICAL AIR", color: "YELLOW", cells: [
              { role: "CHECK IN", callsign: "HOWDY", freq: "230.050" },
              { role: "PKG COMMON", freq: "235.100" },
              { role: "STRIKE", callsign: "ARIES", freq: "240.000" },
              { role: "SEAD", callsign: "SWORD", freq: "245.050" },
              { role: "DCA", callsign: "TAILBACK", freq: "254.750" },
              { role: "SCAR", callsign: "ATHENA", freq: "255.350" } ] },
            { title: "RESCUE", color: "GREEN", cells: [
              { role: "CSAR / PRCC", callsign: "GUARDIAN", freq: "260.050" },
              { role: "RESCORT", callsign: "SANDY", freq: "262.500" },
              { role: "SAR", callsign: "PANDA", freq: "265.050" },
              { role: "ISR", callsign: "GOGGLES", freq: "267.500" },
              { role: "SAR-B", callsign: "BADGER", freq: "270.050" },
              { role: "SPARE", freq: "272.500" } ] },
            { title: "GROUND COORD", color: "PURPLE", cells: [
              { role: "ASOC", callsign: "CHAOS", freq: "320.050" },
              { role: "JTAC/FAC(A) 1", freq: "323.400" },
              { role: "JTAC/FAC(A) 2", freq: "326.700" },
              { role: "JTAC/FAC(A) 3", freq: "330.000" },
              { role: "CAS COORD", callsign: "APOLLO", freq: "333.350" },
              { role: "SPARE", freq: "336.700" } ] },
            { title: "SPARES", color: "GRAY", cells: [
              { role: "SPARE", freq: "340.000" },
              { role: "SPARE", freq: "343.350" },
              { role: "SPARE", freq: "346.700" },
              { role: "SPARE", freq: "350.000" },
              { role: "SPARE", freq: "353.350" },
              { role: "SPARE", freq: "356.700" } ] }
          ]
        }
      },
      bda: {
        atoDay: "7",
        period: "190600Z OCT 26 – 200559Z OCT 26",
        misreps: [
          { msn: "7101", callsign: "VIPER 1", target: "T10002", tot: "0716Z", ord: "4× AGM-88C", result: "Hit — damaged", remarks: "Search radar off the air after the 2nd HARM" },
          { msn: "7102", callsign: "DUDE 1", target: "T10003", tot: "0722Z", ord: "4× GBU-12", result: "Hit — destroyed", remarks: "TGP video posted in #bda" },
          { msn: "7201", callsign: "HAWG 1", target: "T10006", tot: "0812Z", ord: "2× GBU-38, 600 rds 30mm", result: "Hit — damaged", remarks: "6 armoured vehicles destroyed per JTAC" },
          { msn: "7103", callsign: "SPRINGFIELD 3", target: "T10005", tot: "—", ord: "None", result: "Aborted", remarks: "Weather over target" }
        ],
        bda: [
          { target: "T10002", phase: "Phase 1 — Physical", status: "Moderate damage", source: "MISREP / ELINT", reattack: "Yes" },
          { target: "T10003", phase: "Phase 2 — Functional", status: "Destroyed", source: "TGP video", reattack: "No" },
          { target: "T10006", phase: "Phase 1 — Physical", status: "Light damage", source: "JTAC report", reattack: "Pending" },
          { target: "T10005", phase: "Phase 1 — Physical", status: "No damage", source: "Not attacked", reattack: "Yes" }
        ],
        threats: "New SA-15 reported 3 NM west of Samtredia (VIPER 3 RWR, 0718Z).",
        recommendations: "Re-attack T10002 with DEAD on ATO AH. Add the Samtredia SA-15 to the JIPTL as an emerging target. Re-task T10005 with an all-weather weapon (GBU-31)."
      }
    }
  }
};
