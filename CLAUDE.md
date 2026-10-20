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
| `product.html?p=<id>` | Product builder + live document preview: `ci aod jiptl tdp ato aco spins acp bda` |
| `map.html` | Theater map (opened from the ACO) |
| `targeting.html` | Target nomination — browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py` |
| `campaign-review.html` | CFC review of campaign proposals |
| `unit-login.html`, `unit.html` | Group sign-in; Op Status (status only) |
| `ato-request.html` | Group JFACC/LNO requests ATO lines from a `.miz` or a form |
| `campaign-submit.html` | Group submits a campaign proposal |

`js/app.js` storage/auth/roles/chrome · `js/data.js` seed data · `js/products.js` product schemas + renderers
(product registry: add a product = add an entry) · `js/proposal.js` proposal wizard · `js/targeting.js` JIPTL
pipeline · `js/ato.js` ATO lines, `.miz` reader, Discord payloads, commit · `css/styles.css` 3 themes.

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
- **Op Status is status-only** — no request/submission forms on it.

## Product decisions (keep unless the user says otherwise)

- **Comm Plan** is a campaign-long **comm matrix**: colored columns (nets), rows numbered top-down; a channel is
  `<COLOR> <row>` (e.g. RAZOR 293.500 = WHITE 1). Channel list columns: NET, CHANNEL, CALLSIGN, ROLE, FREQ.
  No TACAN/navaids section. **Check-in & comm procedures live in SPINS**, not the Comm Plan.
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
- **Target nomination**: area of interest is a **box or point + radius defined on that page** — it is **not** taken
  from the ACO, theater map or any BMA. REDFOR comes from Coalition Parser CSVs. Score = key-task weight + tier
  weight; cap per task; numbers T10001+; SAM sites are named after their doctrinally-critical unit.
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
