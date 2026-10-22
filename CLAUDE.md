# CLAUDE.md — 639 vCAOC website

Context for Claude (and people) working in this repo. Read `docs/vCAOC_Process_for_DKS.txt` for the full
process brief and `docs/ATO_Discord_Integration.md` for the Discord bot contract.

## What this is

A clickable **prototype** of the 639th virtual Combined Air Operations Center (CAOC) website for DCS World campaigns
run across many independent squadrons ("groups"). CAOC staff build planning products; groups pull the released
products from an Op Status portal and plan in **DKS (Digital Kneeboard Simulator)**, the primary mission-planning
software. DKS integration is being built by a separate developer.

- Static HTML/CSS/JS at the repo root, no build step, no framework, no backend.
- Data lives in browser `localStorage` (`js/app.js` `Store`, key `aoc.db.vNN`); logins are a client-side demo gate.
- Every "Send/Publish/Export to DKS" button is a placeholder; the payloads are already defined (see the brief).
- `OLD/` is the earlier repo content (docs, tool snapshots, the Python JIPTL pipeline, scripts), archived unchanged.
  Old paths moved: `tools/…` → `OLD/tools/…`, `docs/…` → `OLD/docs/…`, `scripts/…` → `OLD/scripts/…`.

Run: `python -m http.server 8765` at the repo root, open `http://localhost:8765/login.html`.
Demo staff: ATLAS (CFC), OVERLORD (CFACC), SPARTAN, CHALICE, WIZARD, DARKSTAR — password `aoc-demo`.
Demo groups: viper (JFACC group for OP IRON TRIDENT), hornet, eagle, hawg, knights, tomcat, harrier, mistral,
thunder, keepers, ridge, support — code `unit-demo`.

## Pages and files

| Page | Purpose |
|---|---|
| `login.html`, `index.html` | Staff sign-in; campaign dashboard (products, CFACC deliverables tracker, ATO line requests, requests, groups) |
| `rollup.html` | CAOC rollup: deadline timeline, readiness, the single PUBLISH (+ DKS Overlay / Agencies exports), Cycle to next mission |
| `product.html?p=<id>` | Product builder + live document preview: `pcon ci aod jiptl tdp maap ato aco spins acp bda` (`tdp`, `maap` are built on their own pages) |
| `tdp.html`, `maap.html` | TDP book (folder per JIPTL target); MAAP (packages, checks, Apply to ATO) |
| `jceoi.html` | JCEOI: per-theater frequency registers, standard Blue net plan, clear-channel pool, .xlsx export |
| `map.html` | Theater map (opened from the ACO) |
| `targeting.html` | Target nomination — browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py` |
| `campaign-review.html` | CFC review of campaign proposals |
| `unit-login.html`, `unit.html` | Group sign-in; Op Status (status only) |
| `ato-request.html` | Group JFACC/LNO requests ATO lines from a `.miz` or a form |
| `mission-file.html` | Host mission file intake: versioned draft .miz → BLUE flights (ATO requests), REDFOR (target nomination), theater calibration, TACAN/ICLS scrub (`js/tacan.js`) |
| `debrief.html` | Host unit enters the post-mission debrief |
| `campaign-submit.html` | Group submits a campaign proposal |

`js/app.js` storage/auth/roles/chrome · `js/data.js` seed data · `js/products.js` product schemas + renderers
(product registry: add a product = add an entry) · `js/proposal.js` proposal wizard · `js/targeting.js` JIPTL
pipeline · `js/ato.js` ATO lines, `.miz` reader, Discord payloads, commit · `js/package.js` deadlines, DKS
exports, PUBLISH, cycle · `css/styles.css` 3 themes. Deadline defaults: `MILESTONES` in `js/products.js`.

When the seed data's shape changes, bump `KEY` in `js/app.js` so browsers reload the seed.

## Roles and workflow (decided — keep)

- **CFC** manages the CAOC; decides on campaign proposals; may assist the CFACC (approve/publish).
- **CFACC** makes sure every deliverable is built and approved; approves and publishes. Does **not** manage campaigns.
- **CAOC staff** build products and submit them for review.
- **Group JFACC / LNO** is elected by the sponsoring group, manages the campaign, is the CAOC's single POC, and
  requests ATO lines.
- Product flow: Draft → Review → Approved → Published. Publishing freezes a versioned snapshot; groups only ever see
  released versions. Any saved edit returns the product to Draft and needs re-approval.
- **Products apply to a whole group**, never to individual flights.
- **The CAOC only builds products.** It does not play in the campaign and never edits the host's `.miz`.
  Readiness, the mass brief and running the mission are the **host unit's alone** — the site only shows their dates.
- Process order: proposal → planning conference (PCON checklist) → host draft .miz + ATO line requests → CI → AOD →
  JIPTL → TDPs → MAAP → Human lines committed → **ACO + theater map** (after commits, before the ATO is final; airspace
  from the conference) → ATO final → SPINS → **Comm Plan last** →
  CFACC approvals → one **PUBLISH** on the rollup, **no later than T-72h** (products to all active groups + optional
  DKS exports) → host builds .miz / runs the mission → host **debrief** → CAOC **cycles** to the next mission.
- DKS exports are options of PUBLISH: **ACO + theater map → DKS Overlay** (drawn on the DKS theater map; never written
  into the .miz) and **Comm Plan → DKS Manage Agencies** (persistent theater frequencies for the whole campaign;
  normally only tankers and JTACs change — the rollup shows changes since the last export). No host ".miz sheet".
- Mission cycle assumes weekly missions: ~4 days from mission to the next PUBLISH (deadlines in `MILESTONES`).
- PCON (planning conference) is internal: approved, never released to groups.
- **Op Status is status-only** — no request/submission forms on it.

## Product decisions (keep unless the user says otherwise)

- **Comm Plan** is a campaign-long **comm matrix**: colored columns (nets), rows numbered top-down; a channel is
  `<COLOR> <row>` (e.g. RAZOR 293.500 = WHITE 1). Channel list columns: NET, CHANNEL, CALLSIGN, ROLE, FREQ.
  No TACAN/navaids section. **Check-in & comm procedures live in SPINS**, not the Comm Plan.
  Template nets: TAC ADMIN (TAC COORD, TAC ADMIN, C2/AWACS, GCI, host C2), TANKERS, TACTICAL AIR, RESCUE, GROUND COORD,
  SPARES. **Guard is standard and not listed**; airfield/ATC frequencies stay out.
- **JCEOI** (`jceoi.html`, data generated by `tools/jceoi/build.py` into `js/jceoi-data.js` — never edit that file):
  Blue nets only, theater-agnostic (clear in every theater). **The net list is `COMM_TEMPLATE` in `js/products.js`**
  (single source): the build reads it and stops on any mismatch with its frequency policy; `build.py --check` says
  whether the data is current. New Comm Plans (`blankMatrix`) start with the JCEOI UHF primaries filled in, but only
  when the data was built from the same template. RAZOR 293.500 = WHITE 1 is fixed. Existing campaign Comm Plans
  (IRON TRIDENT's v366) are left as they are. Every register entry keeps its source and confidence; unverified data is kept (it only blocks
  frequencies). The Comm Plan check uses the campaign theater's register.
  "Publish to DKS Agencies" sends every channel with a frequency as a selectable default agency
  (name = callsign, else `<ROLE> <CHANNEL>`).
- **SPINS** includes a Weapons Restrictions section.
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
  .miz x/y → lat/lon only for **calibrated** theaters (Persian Gulf built in; others fitted once from a Coalition
  Parser CSV of the same mission, max 25 m). **Never hand-enter or guess a projection.** Score = key-task weight + tier
  weight; cap per task; numbers T10001+; SAM sites are named after their doctrinally-critical unit.
- **TACAN scrub** reports only (the CAOC never edits the .miz). Planned values: tanker tracks on the theater map
  (`tacanCh`, `tacanMode`, `tacanCs`) and the SPINS `naval` table. Map TACANs come from the JCEOI DCS beacon list.
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

## Conventions

- Match the existing code style: plain functions, template-literal HTML, `esc()` for every interpolated value,
  `try/catch` around storage access, short comments only where intent isn't obvious.
- Coordinates are shown in DCS degrees + decimal minutes; GeoJSON exports use `[lon, lat]`.
- Keep all demo data fictional.
