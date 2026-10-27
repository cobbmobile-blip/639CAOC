# CLAUDE.md — 639 vCAOC website

Context for Claude (and people) working in this repo. Read `docs/vCAOC_Process_for_DKS.txt` for the full
process brief, `docs/ATO_Discord_Integration.md` for the Discord bot contract and `docs/PR_DKS_Integration.md` for the
personnel recovery (DKS Debrief ejection) contract.

## What this is

A clickable **prototype** of the 639th virtual Combined Air Operations Center (CAOC) website for DCS World campaigns
run across many independent squadrons ("groups"). CAOC staff build planning products; groups pull the released
products from an Op Status portal and plan in **DKS (Digital Kneeboard Simulator)**, the primary mission-planning
software. DKS integration is being built by a separate developer.

- Static HTML/CSS/JS at the repo root, no build step, no framework, no backend.
- Data lives in browser `localStorage` (`js/app.js` `Store`, key `aoc.db.vNN`); logins are a client-side demo gate.
- DKS exports go only through PUBLISH on the Dashboard and are queued in `db.dksOutbox` (payloads in the brief); the
  only other DKS buttons are the PRCC's live rescue ones. Never add per-page "Send to DKS" or publish buttons.
- `OLD/` is the earlier repo content (docs, tool snapshots, the Python JIPTL pipeline, scripts), archived unchanged.
  Old paths moved: `tools/…` → `OLD/tools/…`, `docs/…` → `OLD/docs/…`, `scripts/…` → `OLD/scripts/…`.

Run: `python -m http.server 8765` at the repo root, open `http://localhost:8765/login.html`.
Demo staff: ATLAS (CFC), OVERLORD (CFACC), SPARTAN, CHALICE, WIZARD, DARKSTAR, GUARDIAN (PRCC) — password `aoc-demo`.
Demo groups: viper (JFACC group for OP IRON TRIDENT), hornet, eagle, hawg, knights, tomcat, harrier, mistral,
thunder, keepers, ridge, support, rqs55 (55th RQS, MH-60L CSAR helicopters) — code `unit-demo`.

## Pages and files

| Page | Purpose |
|---|---|
| `login.html`, `index.html` | Staff sign-in; campaign dashboard: the one **PUBLISH** (`PACKAGE.publishDialog`) and **Cycle to next ATO** (`PACKAGE.cycleDialog`), products wanted, Discord post preview, deadline timeline (`PACKAGE.milestones`), products, ATO line requests, host mission file, debriefs, DKS export detail, groups, activity. The old rollup page was merged into it; there is no `rollup.html`. `AOC.COMMS` (products.js) groups the Comm Plan, OPTASKLINK, JCEOI and IFF / SIF as "Comm / Datalink / IFF": one dashboard group and a link strip on each of those pages; no JCEOI in the top nav |
| `product.html?p=<id>` | Product builder + live document preview: `pcon ci aod jiptl tdp maap ato aco spins acp bda optasklink` (`tdp`, `maap` are built on their own pages). Save = ready for approval |
| `tdp.html`, `maap.html` | TDP book (folder per JIPTL target; Export imagery jobs; Open target folder); MAAP (checks at the top, packages with support lines, Apply to ATO) |
| `folder.html?t=<target>` | AFLG-style printable target folder, markup drawn from `img/targets/<cid>/<t>/meta.json` (imagery from `tools/target-render`) |
| `grg.html` | GRGs, the groups' own tool (unit portal; each group sees its own sheets, staff all): DCS ALT map (DCS Olympus tiles), fixed grid, map dragged and wheel-zoomed under it, DCS buildings numbered per cell |
| `prcc.html` | vPRCC: DKS ejection reports → PR steps → CSAR task force package (`js/pr.js`) |
| `isoprep.html` | Unit portal: pilots' ISOPREPs and an EPA per ATO line (`db.isopreps`, `db.epas`) |
| `jceoi.html` | JCEOI: standard Blue net plan, NTTR plan, IFF, clear-channel pool, frequency check, .xlsx export (registers feed the checks, not shown) |
| `map.html` | Theater map (opened from the ACO) |
| `targeting.html` | Target nomination — browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py` |
| `campaign-review.html` | CFC review of campaign proposals |
| `unit-login.html`, `unit.html` | Group sign-in; Op Status (status, plus Request a line for participating squadrons) |
| `ato-request.html` | Host Group JFACC/LNO creates ATO lines from a `.miz` or a form, and approves / denies squadron line requests (`ATO.askLine` / `ATO.decide`, `db.lineRequests`; both forms come from `ATO.lineFormHtml`) |
| `mission-file.html` | Host mission file intake: versioned draft .miz → BLUE flights (ATO requests), REDFOR (target nomination), theater calibration, TACAN/ICLS scrub (`js/tacan.js`) |
| `debrief.html` | Host unit enters the post-mission debrief |
| `campaign-submit.html` | Group submits a campaign proposal |

`js/app.js` storage/auth/roles/chrome, `AOC.keyTasks` / `keyTaskOf` · `js/data.js` seed data · `js/products.js` product schemas + renderers,
`COMM.findChannel` / `commIssues` (a table
field may set `show(row, group)` to edit a subset of its array, `newRow` defaults, and `iffPanel`; the ATO uses two
fields on `missions`, human then AI)
(product registry: add a product = add an entry) · `js/proposal.js` proposal wizard · `js/targeting.js` JIPTL
pipeline, CI key-task mapping · `js/ato.js` ATO lines, `.miz` reader, Discord payloads, commit · `js/package.js` deadlines, DKS
exports, PUBLISH, cycle · `js/miz.js` mission file intake, theater projections · `js/pr.js` personnel recovery ·
`js/tdl.js` OPTASKLINK · `js/iff.js` IFF · `js/tacan.js` TACAN scrub · `js/mizlog.js` host .miz change log · `js/jceoi.js` JCEOI · `css/styles.css` 3 themes.
Deadline defaults: `MILESTONES` in `js/products.js`.

When the seed data's shape changes, bump `KEY` in `js/app.js` so browsers reload the seed. New seed users, ISOPREPs,
groups (and their campaign membership) and products merge into saved data without a bump (`mergeNewSeed`); changed
seed content does not reach a browser that already saved data.

## Roles and workflow (decided — keep)

- **CFC** manages the CAOC; decides on campaign proposals; may assist the CFACC (approve/publish).
- **CFACC** makes sure every deliverable is built and approved; approves and publishes. Does **not** manage campaigns.
- **CAOC staff** build products; saving one makes it ready for the CFACC's approval.
- **Group JFACC / LNO** is elected by the sponsoring group, manages the campaign, is the CAOC's single POC, and
  requests ATO lines.
- Product flow: Not started → (Draft = back in work after a cycle) → **Ready for approval** (status `review`, set by any
  save) → Approved → Published. Publishing freezes a versioned snapshot; groups only ever see released versions. Any
  saved edit needs re-approval. The CFACC approves on the product page or, per product, in the PUBLISH dialog.
- **Products apply to a whole group**, never to individual flights.
- **The CAOC only builds products.** It does not play in the campaign and never edits the host's `.miz`.
  Readiness, the mass brief and running the mission are the **host unit's alone** — the site only shows their dates.
- Process order: proposal → planning conference (PCON checklist) → host draft .miz + ATO line requests → CI → AOD →
  JIPTL → TDPs → MAAP → Human lines committed → **ACO + theater map** (after commits, before the ATO is final; airspace
  from the conference) → ATO final → SPINS → **Comm Plan last** →
  CFACC approvals → one **PUBLISH** on the Dashboard, **no later than T-72h** (approve what's ready, release to all
  active groups, DKS exports, the pilot package zip to Discord) → host builds .miz / runs the mission → host **debrief**
  → CAOC **cycles** to the next ATO (Dashboard).
- **Products wanted** (`PACKAGE.wanted`, from `campaign.productsWanted`, set by the proposal or the Dashboard's
  `PACKAGE.wantedDialog`): the host picks the products it wants. **The ATO is always produced** (`PACKAGE.ALWAYS`) so the
  ATO line / Discord process works with nothing else picked; TDPs bring the JIPTL; internal products are always built; no
  list = the full set. Unwanted products are marked Not requested, have no milestones, aren't released or packaged, and
  their DKS exports are disabled. The **pilot package** (`PACKAGE.PILOT`: CI, AOD, ATO, SPINS + Addendum A + ROE, ACP,
  ACO, OPTASKLINK, and TDPs only for INT targets) is one zip of printable HTML pages (`packageZip`), posted to every
  group's Discord and downloadable from the Dashboard and Op Status. GRGs are not in it: they are the groups' own.
- DKS exports are options of PUBLISH: **ACO + theater map → DKS Overlay** (drawn on the DKS theater map; never written
  into the .miz) and **Comm Plan → DKS Manage Agencies** (persistent theater frequencies for the whole campaign;
  normally only tankers and JTACs change — the Dashboard shows changes since the last export) and **SPINS Addendum A → DKS
  kneeboards** (`PACKAGE.sendKneeboard`, released SPINS only). No host ".miz sheet". PUBLISH also checks the SPINS
  bullseye against the host's latest .miz (`bullseyeCheck`) and offers to update and release it.
- Mission cycle assumes weekly missions: ~4 days from mission to the next PUBLISH (deadlines in `MILESTONES`).
- **PRCC** (personnel recovery coordination cell, staff role) works each ejection DKS Debrief reports; the PRCC can request
  ATO lines like a JFACC (posted to Discord), and publishes the CSAR task force package to the groups flying the rescue.
- PCON (planning conference), MAAP and BDA are internal staff functions (`PACKAGE.INTERNAL`): approved, never released to groups, not in the pilot package, never shown on Op Status; they stay on the staff Dashboard (marked internal). Product requests from groups were retired (every group gets every product).
- **Op Status is status-only** — no request/submission forms on it.

## Product decisions (keep unless the user says otherwise)

- **Comm Plan** is a campaign-long **comm matrix**: colored columns (nets), rows numbered top-down; a channel is
  `<COLOR> <row>` (e.g. RAZOR 290.050 = WHITE 1). Channel list columns: NET, CHANNEL, CALLSIGN, ROLE, FREQ.
  No TACAN/navaids section. **Check-in & comm procedures live in SPINS**, not the Comm Plan.
  Template nets: TAC ADMIN (TAC COORD, TAC ADMIN, C2/AWACS, GCI, host C2), TANKERS, TACTICAL AIR, RESCUE, GROUND COORD,
  SPARES. **Guard is standard and not listed**; airfield/ATC frequencies stay out.
- **JCEOI** (`jceoi.html`, data generated by `tools/jceoi/build.py` into `js/jceoi-data.js` — never edit that file):
  Blue nets only, theater-agnostic (clear in every theater). **The net list is `COMM_TEMPLATE` in `js/products.js`**
  (single source): the build reads it and stops on any mismatch with its frequency policy; `build.py --check` says
  whether the data is current. New Comm Plans (`blankMatrix`) start with the JCEOI UHF primaries filled in, but only
  when the data was built from the same template. RAZOR = WHITE 1 TAC COORD (callsign fixed; frequency picked clear, 290.050). Existing campaign Comm Plans
  are never changed automatically. The demo IRON TRIDENT Comm Plan is the JCEOI standard plan with the campaign's callsigns
  (SCAR ATHENA in YELLOW 6 and SAR-B BADGER in GREEN 5, spare rows, because the ATO and SPINS PR section use them).
- **Comm hierarchy** (decided): 1 SPINS (procedures, PR frequencies) → 2 JCEOI (standard nets) → 3 Comm Plan → 4 special
  plans (CSAR comm plan, MAAP support, ATO CONTROLA, OPTASKLINK JICO voice). Lower levels read from the one above and
  find channels **by purpose** with `COMM.findChannel(matrix, purpose)` — never by a role string of their own. The
  survivor's frequencies come from the SPINS release the crew took off with. `COMM.commIssues` (shown on the SPINS and
  Comm Plan editors) lists disconnects; keep it clean.
- **Nevada / NTTR is a pre-decided theater**: official NTTR/Nellis assignments are in its register; Nevada campaigns use
  the CAOC NTTR comm matrix (`tools/jceoi/data/nttr.json`, from NTTR_COMM_PLAN.xlsx) as the Comm Plan. The CAOC's
  2026-10-22 revisions (RAZOR off 293.500 = ROULETTE, preset 5 385.400 typo fix, APOLLO, SNIPER, JTACs from the range JTAC
  sheet, assigned AR-230V/AR-231V frequencies) are applied by `revise_nttr` in build.py, not in the CAOC's spreadsheet. Every register entry keeps its source and confidence; unverified data is kept (it only blocks
  frequencies). The Comm Plan check uses the campaign theater's register.
  The Manage Agencies export (PUBLISH) sends every channel with a frequency as a selectable default agency
  (name = callsign, else `<ROLE> <CHANNEL>`).
- **SPINS** includes a Weapons Restrictions section. SPINS text is **directive** ("All flights will check in …"): no
  explanations, worked examples or training material. Check-in is MNPOPCA with the controlling authority. 1.2 defines
  **TACON** (default delegated to C2 = the ATO's AEW line; must resolve, else NOT DEFINED). 3.3 authentication: aircrew
  discretion, method briefed (sequential, RAMROD, AET table). **Addendum A** (doc `auth`) prints an AET table and RAMROD
  per ATO, a week ahead; `P.spins.kneeboard` builds the DKS kneeboard payload from it. Code words and RAMRODs come only
  from the codeword reference list (`CODEWORDS`, `RAMRODS` in `js/pr.js`) — never invent words. The bullseye position
  comes from the host .miz **BLUE** coalition bullseye (`MIZ.bullseye`; never RED's) and is code-worded with a beer
  (`BULLSEYES`), never called "bullseye" on the radio.
- **Mission sets**: INT = pre-planned interdiction, always a JIPTL target; XINT = on-call interdiction. CAS = fragged to a
  known movement to contact; XCAS = on-call. Pre-planned SCAR names an ACO area (usually a kill box); ad-hoc SCAR is a C2
  re-role, never on the ATO. `AOC.targetIssue(cid, target, rows, role)` flags INT / SCAR lines that break this. Never use
  "AI" for interdiction (AI = AI-crewed lines).
- **ATO designators**: ATOs are AA, AB, AC … (day 1 = AA, `AOC.atoId(n)`), never "ATO Day 8" in anything shown. The
  numeric `atoDay` stays internal (mission numbers 8xxx). Payloads carry both `ato_day` and `ato`.
- **Seed changes reach saved browsers** through `mergeNewSeed` in `js/app.js`: `retiredGroups` (dropped groups; their ATO
  lines become AI lines — the AOC Support Cell is retired this way), `renamedMissions` ({AI: "INT"}) and `supersededText`
  (example text the seed rewrote, replaced only where a saved product still holds it word for word).
- **product.html fields**: top-level `select` fields render as dropdowns; `options` and `hint` may be functions
  `(data, cid, row)`; a table field with `prefill(data, cid)` is filled with generated rows when the editor opens.
- **Theater map** point types: Nav point, Spider point, Dest point, Threat (DCS system + editable range ring).
  **Waypoints, IPs, targets and bullseye are done in DKS — do not add them back.**
  Shapes: FLOT, FSCL, MRR, tanker track, HVAA orbit, artillery ROZ (floor + MAXORD), plain box/circle/polygon/line.
- **FLOT**: friendly line with semicircles bulging toward the enemy, "FLOT" label at both ends, flip-side option.
  **FSCL**: solid black line, "FSCL" with establishing HQ and effective DTG at both ends.
- **Tanker track** = USAF AR anchor: left-hand racetrack, default 50 × 20 NM (adjustable), **no centerline**;
  ARCP at the start of the refuel leg; **ARIP optional, ~10 NM before the orbit ENTRY**; ENTRY and EXIT points.
- **Target nomination**: the area is called the **AO (Area of Operations)** and is labelled "AO" on the map; it is a
  **box (drag / resize / double-click to rotate) or point + radius defined on that page** — it is **not** taken
  from the ACO, theater map or any BMA. REDFOR comes from Coalition Parser CSVs or the host's mission file (`js/miz.js`).
  .miz x/y → lat/lon with the built-in projections for Caucasus, Persian Gulf, Syria, Afghanistan, Kola, Nevada and
  Marianas, each fitted to the terrain's `Beacons.lua` (max 0.52 m; the fit is `tools/target-render/dcs_charts.py`), with a
  Newton refinement of the inverse. Other theaters are fitted once from a Coalition Parser CSV of the same mission (max
  25 m). **Never hand-enter or guess a projection.** (`OLD/tools/jiptl_pipeline/theater_projection.py`'s Persian Gulf
  constants are ~97 km off; superseded.) Units keep their .miz heading.
- **Key tasks** come from the campaign's **Commander's Intent**, in its order of priority (`TG.keyTasksFromCI`); each is
  mapped to target categories from its wording (editable, edits kept while the wording is unchanged); a target is
  scored under the first key task covering its category; none = watchlist. Every product reads key tasks through
  `AOC.keyTasks` / `keyTaskOf`: JIPTL, AOD objectives, TDP / target folder, MAAP coverage, ATO `AMPN … KEY TASK:n`,
  BDA key task assessment. Score = key-task weight + tier weight; cap per task; numbers T10001+; SAM sites are named
  after their doctrinally-critical unit.
- **Target folders** (`folder.html`): AFLG layout; every vehicle is its own CE and DPI (A001…); the DMPI is the vehicles'
  mean point, reference only, never a targeting aimpoint; no caps on boxes or list rows; a true-north compass on every
  graphic; page subject as the title, target as the subtitle. Imagery is built offline (`tools/target-render`, Blender
  + the DCS install); the JOG is the DCS F10 chart (`RasterCharts`).
- **GRGs** (`grg.html`): the groups' own tool, made only when requested for an op they fly (not a CAOC product, not in
  PUBLISH; sheets carry `owner`). For kneeboards (pilots, JTACs, controllers), so no talk-on tool on the page. Only
  the larger grid (keypads off by default); every building numbered in its cell, white number centred on it. Background
  is the DCS F10 ALT map from DCS Olympus's tile server (no public DCS SAT tiles exist); buildings are detected off those
  tiles, trees / roads / lettering excluded (bump `BLDG_V` when detection changes). Grid fixed on the page, map dragged
  under it and zoomed with the mouse wheel (no slider); the scale bar follows. Sharp type: black grid lines, no halos or shadows,
  grid labels plain black text. Real-world imagery + OpenStreetMap buildings only where a theater has no ALT export.
- **Personnel recovery** (`prcc.html`, `js/pr.js`): SPINS section 5 values (SARNEG, SARDOT, duress word, word / letter /
  number of the day, PR frequencies, contact, signals) are generated per campaign unless the SPINS set them. The CSAR
  force: RESCORT (OSC = the lead, Sandy 1), rescue helo (MH-60L, 55th RQS), optional CH-47F lift (no group yet), SARCAP,
  SEAD when a SAM ring covers the survivor, HC-130 King, AWACS, ISR, tanker. AMC defaults to the King, else the AWACS,
  else the SARCAP lead. Requested human lines use an airframe an active group flies, or are flagged. ATO roles include
  RESCORT and SARCAP. `.miz` types `UH-60L` / `UH-60L_DAP` (the UH-60L mod) read as MH-60L / MH-60L DAP.
- **MAAP support lines**: each package's tankers, AWACS / GCI, TAC C2 and JTAC are suggested (only when needed) from the
  ATO, theater map, ACO and Comm Plan; planners edit, remove or add rows. The checks sit at the top, errors first.
- **Layout**: every page stacks its panels full width; no side columns or asides.
- **IFF plan** (`tools/jceoi/data/iff.json` → `js/jceoi-data.js` `iff`; `js/iff.js`): reserved codes (and any slot
  holding one) are never assigned; a line's Mode 3/A block is its Mode 1 code (`IFF.slotsOf`), because the F-16C sends
  its first two code wheels as Mode 1; `campaign.iff.blocks` is no longer used; ATO rows carry `m1`, `m3` (lead), `m3last`,
  optional `m2`. The Mode 1 table is the vCAOC's own scheme (real assignments are not public).
- **SPINS & ROE** (product `spins`): one approval, two documents via `P.docs` (product.html shows document tabs; `render`
  prints both for released copies). The ROE is the standing ROE (`tools/jceoi/data/roe.json`, `AOC_JCEOI.roe`) plus the
  campaign's `wcs`, `declaredHostile`, `roeMeasures` ({id: on}; unset = the measure's default), `idCriteria`, `weapons`,
  `restricted` and `roe` remarks. Keep ROE content out of the SPINS document; the SPINS only point to it.
- **OPTASKLINK** (`js/tdl.js`, `tools/jceoi/data/tdl.json`) is fully automatic: `TDL.build` runs every time it opens
  (period, moniker/JICO, NTR, network settings, mission file participants via `TDL.pull`, ATO human lines via
  `TDL.assign`); the form is only notes. The minimal-staff rule: never add fields the CAOC must fill in. Mission file
  content (AI AWACS donors, warships/EWR with notional C2 STNs, AI aircraft STNs, F/A-18C setup) is printed as read;
  F-16C / A-10C / AH-64D numbers are assigned because pilots set them in the cockpit. The AH-64D link is the IDM, not
  SADL. All STNs are unique across the network; campaigns own STN blocks and a moniker (`campaign.tdl`).
- **TACAN scrub** reports only (the CAOC never edits the .miz). Planned values: tanker tracks on the theater map
  (`tacanCh`, `tacanMode`, `tacanCs`) and the SPINS `naval` table. Map TACANs come from the JCEOI DCS beacon list.
  Check 6 flags TACAN 1X / ICLS 1 (DCS defaults).
- **Host .miz change log** (`MIZLOG.build`): ADD (ATO lines not in the .miz), SET (CAOC-assigned values that live in the
  .miz: tanker / carrier TACAN, ICLS, AI support radios, tanker altitude), FIX (scrub, .miz datalinks, tanker airspeed
  300 ± 5 KCAS (KC-130: 100, helo AAR) from TAS + altitude, JIPTL targets with no RED within 1 NM, start after first TOT, line mismatches),
  REMOVE (cancelled lines, BDA-destroyed targets); passed checks listed. Never cockpit / DKS items (radio presets,
  STNs, TNs, IDM, IFF). **Tanker callsigns come from the .miz** (`syncTankers` on upload). Posted as `miz.changes` to
  the host's registered channel after an upload that changes it and with PUBLISH (`opts.mizlog`); state in
  `campaign.mizLog` (posts, ack). CAOC-side issues (two tankers on one track) stay on the Dashboard.
- **ATO lines**: the JFACC/LNO requests lines (from the group's `.miz`: player slots → Human, others → AI, or a form).
  AI lines go straight on the ATO. Human lines are posted via the existing Discord bot to every active registered
  group flying that airframe, with a Commit button; **first commit wins**, the line fills on the ATO and the JFACC
  sees it filled. Contract: `docs/ATO_Discord_Integration.md` (names there are proposals to align with the bot).

## Open items

- DKS sections for Dest points and Threats are TBC (Nav/Spider confirmed).
- DKS formats for the comm page push, overlay import and group pack are not defined yet.
- No backend yet: real sign-in (vcaoc.com has Discord sign-in), shared database, server-side approval/commit rules,
  the commit endpoint for the bot, file uploads.
- Threat ring defaults are approximate; commit deadlines are displayed, not enforced.
- DKS Debrief `pr.ejection` and the `pr.csar_route` / `pr.csartf_package` events are proposals (`docs/PR_DKS_Integration.md`).
- No group flies the CH-47F yet. ISOPREP answers are visible to any staff login (lock down with a backend).

## Conventions

- Match the existing code style: plain functions, template-literal HTML, `esc()` for every interpolated value,
  `try/catch` around storage access, short comments only where intent isn't obvious.
- Coordinates are shown in DCS degrees + decimal minutes; GeoJSON exports use `[lon, lat]`.
- Keep all demo data fictional.
