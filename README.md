# 639 CAOC — Virtual CAOC pages

Clickable prototype of the 639th virtual Combined Air Operations Center (CAOC) website for DCS World campaigns.
Static HTML/CSS/JS — no build step. Data is stored in the browser (localStorage) and logins are a
client-side demo gate only; a real deployment needs server-side auth and a shared database.

> **Earlier material is archived in [`OLD/`](OLD/)** — the original docs (charter, TTP 1-1, AOD, glossary…), the static
> tool snapshots, the JIPTL pipeline (Python) and scripts. Everything kept its history; only the paths changed,
> e.g. `tools/jiptl_pipeline/…` is now `OLD/tools/jiptl_pipeline/…`. See [Moved files](#moved-files) below.

## Run it

Serve the repo root with any static web server and open `login.html`, for example:

```
python -m http.server 8765
```

then browse to http://localhost:8765/login.html. (The theater map and target nomination pages load Leaflet and map tiles from the internet.)

## Pages

| Page | Who | What |
|---|---|---|
| `login.html` | CAOC staff | Staff sign-in |
| `index.html` | CAOC staff | Campaign dashboard: products, deliverables tracker (CFACC), requests, groups |
| `rollup.html` | CAOC staff (CFACC/CFC publish) | CAOC rollup: deadline timeline (campaign build / mission cycle), product readiness, ATO lines, host debriefs, DKS export preview (Overlay, Agencies changes), the one **PUBLISH** button and **Cycle to next mission** |
| `product.html?p=<id>` | CAOC staff | Product builder + live preview (Planning Conference, CI, AOD, JIPTL, TDP, MAAP, ATO, ACO, SPINS, Comm Plan, BDA) |
| `tdp.html` | CAOC staff | TDP book: one target folder per JIPTL target, drafted from the nomination data |
| `maap.html` | CAOC staff | MAAP: packages of ATO lines against JIPTL targets, with coverage and deconfliction checks; Apply to ATO |
| `jceoi.html` | CAOC staff | vCAOC JCEOI 26-1: standard Blue net plan (the Comm Plan matrix, clear in every theater), preset load, per-theater frequency registers (DCS in-game + real-world), clear-channel pool, frequency check, `.xlsx` export |
| `map.html` | CAOC staff | Theater map from the ACO: nav/spider/dest points, threats with DCS range rings, FLOT, FSCL, MRR, AR tracks, HVAA orbits, artillery ROZ |
| `targeting.html` | CAOC staff | Target nomination (from the JIPTL): REDFOR order of battle → JIPTL, ported from the JIPTL pipeline |
| `campaign-review.html` | CAOC staff (CFC decides) | Campaign proposal review queue |
| `unit-login.html` | Participating groups | Group sign-in |
| `unit.html` | Groups (staff can observe) | Op Status: product board, distribution matrix, ATO lines, group pack download; the JFACC group also sees its ATO line requests filling |
| `mission-file.html` | Host unit (staff can read) | Host mission file intake: upload the draft `.miz` (and every new version); BLUE flights → ATO requests, REDFOR → target nomination; per-theater coordinate calibration; TACAN / ICLS scrub |
| `debrief.html` | Host unit (campaign's JFACC group) | Post-mission debrief: lines flown, BDA, losses, progress — feeds the CAOC's next cycle |
| `ato-request.html` | Campaign's Group JFACC / LNO | Request ATO lines from the group's `.miz` (player slots → Human, rest → AI) or a form; Human lines are posted on Discord for commitment |
| `campaign-submit.html` | Groups | Campaign proposal wizard (JFACC, intent, win/loss, REDFOR, schedule…) |

## Demo accounts (prototype only)

- Staff: ATLAS (CFC), OVERLORD (CFACC), SPARTAN, CHALICE, WIZARD, DARKSTAR — password `aoc-demo`
- Groups: viper, hornet, eagle, hawg, knights, tomcat, harrier, mistral, thunder, keepers, ridge, support — code `unit-demo`

## Roles

- **CFC** — manages the CAOC, decides on campaign proposals, can assist the CFACC.
- **CFACC** — makes sure every deliverable is built and approved; approves and publishes.
- **Group JFACC** — elected by the sponsoring group; manages the campaign and is the CAOC's single POC.

## Campaign process

The CAOC builds products only. The host unit builds and runs its own `.miz`, readiness, the mass brief and the mission.
Default deadlines (editable per campaign on the rollup), T-0 = first mission:

| T | Step | Owner |
|---|---|---|
| T-42 | Proposal approved (CFC) | CAOC |
| T-35 | Planning conference — PCON checklist | CAOC + host JFACC |
| T-30 | Draft `.miz` with REDFOR to the CAOC | Host |
| T-28 | ATO line requests | Host |
| T-26 / T-24 | Commander's Intent / AOD (with the host JFACC) | CAOC |
| T-21 | JIPTL (target nomination) | CAOC |
| T-18 | TDP book (grade A/B folders ready) | CAOC |
| T-16 | MAAP | CAOC |
| T-10 | Human ATO lines committed | Groups |
| T-8 | ACO + theater map (after line commits, from the conference airspace) | CAOC |
| T-7 / T-6 | ATO final / SPINS | CAOC |
| T-5 | Comm Plan — built last | CAOC |
| **T-72h** | CFACC approvals → **PUBLISH**, no later than 72 hours out: products to groups, optional DKS exports (ACO → DKS Overlay, Comm Plan → DKS Manage Agencies) | CAOC |
| T-24h → T-0 | Final `.miz`, readiness, mass brief, first mission | Host |
| T+1 | Debrief | Host |

Between missions (weekly missions, about 4 days from one mission to the next PUBLISH; T-0 = next mission): debrief T-6.5,
BDA + AOD T-6, JIPTL T-5.5, TDP T-5, MAAP T-4.5, commits T-4, ATO + tanker/JTAC frequency changes T-3.5, **PUBLISH T-72h**,
host `.miz` update T-24h.

The ACO overlay is drawn in DKS on the theater map and is never written into the `.miz`. The Comm Plan agencies are
persistent for the campaign; normally only tankers and JTACs change, and the rollup lists what changed since the last export. **Cycle to next mission** moves the ATO day on and returns the daily products to Draft.

## IFF / SIF plan

The JCEOI carries an IFF code plan (`tools/jceoi/data/iff.json`, checked by the build; `js/iff.js` on the site):

- **Reserved Mode 3/A codes** never assigned: 0000, 1200, 1202, 1255, 1277, 2000, 4000, 7000, 7400, 7500, the 7600 and
  7700 series, 7777 (FAA AIM 4-1-20, ICAO practice). Their blocks (00, 12, 20, 40, 70, 74–77) are never given out.
- **Mode 3/A campaign blocks**: each campaign takes its own 2-digit blocks (BB00–BB77; four by default, editable on
  the ATO, never another campaign's). Each ATO line takes a slot: the lead squawks BBC1, the last member of a
  non-standard flight BBC1 + (n − 1), others standby — the NELLISAFBI 11-250 §4.3.2 pattern.
- **Mode 1 by mission type** (the vCAOC's own scheme): first digit = family (1 counter-air, 2 strike/AI, 3 SEAD/DEAD,
  4 CAS/FAC(A), 5 AR, 6 C2/ISR/AEW, 7 rescue/airlift), second digit 0–3 = sub-role; optional daily rotation.
- **Mode 2** optional per airframe (group number + aircraft), for full-IFF modules only.
- **Mode 4 and IFF procedures** default into SPINS section 11 (with IFF-off areas); the Comm Plan prints the campaign's
  blocks and the Mode 1 table; Nevada adds the NTTR rules (tactical Mode 3 on range, never 1200).
- **Checks** on the ATO (live) and on the Comm Plan: octal, Mode 1 second digit 0–3, reserved and non-discrete codes,
  last-member code and slot, outside the campaign's blocks, duplicates within the ATO and with other campaigns.
- The JCEOI page has an **IFF / SIF** tab (reserved register, blocks per campaign, Mode 1 table, code checker) and three
  IFF sheets in the `.xlsx`.
- In DCS, Mode 4 is coalition-based for most aircraft; SRS's transponder overlay and LotATC carry Mode 1 / 3 to GCIs.

## TACAN / ICLS scrub (mission file)

Every host `.miz` version is scrubbed for beacons (`js/tacan.js`). It reports only — the host fixes their own file:

1. **Duplicates** — the same TACAN channel + mode on two units; the same ICLS channel on two ships.
2. **Map clashes** — channels the theater's own DCS TACAN stations use (from the JCEOI's DCS beacon data; DCS seldom
   records their mode, so both X and Y are treated as taken).
3. **Callsigns** — one ident on different channels, one channel with different idents, a TACAN with no ident.
4. **CAOC products** — tanker TACAN and radio against the tanker track on the theater map (matched by callsign, e.g.
   TEXACO 1 = DCS Texaco11), carrier TACAN/ICLS against the SPINS carrier table, tanker radios that are not a Comm
   Plan channel; planned tankers/carriers missing from the `.miz` and ones with no plan.
5. **Likely to fail** — no channel or mode, channel outside 1–126, ICLS outside 1–20, disabled task, beacon on a later
   waypoint, late-activated group, task pointing at a unit not in the group.

Findings new since the previous version are marked; fixed ones are listed. The rollup shows the count. Tanker tracks
have optional TACAN channel / X-Y / ident fields; SPINS has a Carriers & ships table (TACAN, ident, ICLS).

## JCEOI (frequency registers and standard net plan)

`jceoi.html` documents every known frequency in each DCS theater and gives a standard Blue net plan that is clear of
all of them:

- **Registers** for Caucasus, Nevada, Persian Gulf, Syria, Marianas, Sinai, Kola, Afghanistan, Iraq, Germany (Cold
  War), Falklands, plus Balkans, Iraq South and Afghanistan North (in development — real-world data only so far).
  In-game ATC radios and beacons come from the DCS install (or pydcs for maps not installed); real-world civil
  frequencies from OurAirports; military UHF from FAA data (AirNav) for US bases and third-party listings, each marked
  official / public / unverified / hobbyist.
- **Net plan**: the Comm Plan (ACP) template itself — its 36 channels (TAC ADMIN, TANKERS, TACTICAL AIR, RESCUE, GROUND
  COORD, SPARES) are read by the build, which stops on any mismatch. A new Comm Plan starts with these frequencies. Each
  with UHF primary and alternate, a VHF-AM backup, and VHF-FM / HF where needed. RAZOR stays WHITE 1 (now 290.050, clear in every theater). Guard is
  standard and not a net.
- The **Comm Plan** editor checks every channel against the campaign theater's register (and flags duplicates), and
  can fill empty channels or reset the matrix from the JCEOI. Existing Comm Plans are never changed automatically.

- **Nevada (NTTR) is pre-decided.** The Nevada register adds every official NTTR / Nellis assignment (AFMAN 13-212V1
  NTTR Addendum A Attachment 14; NELLISAFBI 11-250 Attachment 20): range tactical frequencies, agencies, local
  standard channelization, controlling agencies and AR track control, squadron commons. Nevada campaigns use the CAOC
  NTTR comm matrix as their Comm Plan, checked against it and the official assignments; the JCEOI page has a "Nevada
  (NTTR plan)" tab with the matrix, comm card vs Nellis channelization, tankers, AR tracks, range JTACs and a plan check.

Rebuild the data with `tools/jceoi` (see its README); the build refuses to write a plan with any conflict (fixed
channels excepted — they are kept and reported).

## Target nomination (JIPTL pipeline)

Browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py`:

1. **Key tasks & priorities** — the cycle config: Key Task weights and per-task caps, tier weights, default grades.
   Task 5 (CAS/TST) is continuous and never ranked.
2. **AO (Area of Operations)** — set on the page's map and labelled "AO" there: a box (drag it to move, drag a corner to resize, double-click it to
   rotate with the yellow handle) or a point + radius (drag the centre and the edge handle, or type the radius).
   Defined on this page only; it is independent of the ACO and the theater map.
3. **REDFOR order of battle** — Coalition Parser CSV exports (`Group, Unit, Type, Latitude, Longitude, Altitude (ft)`;
   DMS or decimal). `samples/iron_trident_redfor.csv` is an example.
4. **Run** — classify each DCS type, group by DCS group, name the group after its doctrinally-critical unit
   (e.g. an SA-11 by its TELARs, an SA-6 by its 1S91 radar), keep groups inside the AO,
   score = task weight + tier weight, rank, cap per task, number `T10001…`.
5. **Review** — tabs for JIPTL / Watchlist (cut by caps) / Outside AO / Unclassified types / Not targets;
   re-grade, re-order, cut or promote lines, then **Send to JIPTL** (the JIPTL returns to Draft for CFACC approval).

The built-in unit table covers ~130 common DCS types. Load the full
`OLD/tools/jiptl_pipeline/config/unit_classification.json` on the page to use the complete catalogue.
REDFOR can also come from the host's mission file (*Use REDFOR from it* on step 3). A `.miz` stores positions as map x/y, so
conversion needs a calibrated theater projection — the browser port of `OLD/tools/jiptl_pipeline/theater_projection.py`.
Persian Gulf is calibrated (657-point fit, ~1 m). Any other theater is **refused, never guessed**, until it is calibrated
once on the Mission file page from a Coalition Parser CSV of the same mission (units paired by group + unit name,
Transverse Mercator fit; accepted only if the worst unit is within 25 m).

## ATO line requests (Discord commit)

1. The campaign's **Group JFACC / LNO** opens *ATO requests* in the unit portal and loads their group's `.miz`
   (read in the browser: BLUE flights, player slots → **Human**, others → **AI**) or fills in the request form
   (airframe, number of aircraft, mission, Human/AI, TOT, JIPTL target, package, commit-by, notes).
2. **AI** lines go straight onto the ATO for the sponsor to build in the `.miz`.
   **Human** lines get a mission number and are posted — via the existing Discord bot — to every registered group
   whose airframes include that type, with a **Commit** button.
3. The first unit to press **Commit** fills the line: it becomes the tasked unit on the ATO, joins the campaign, and the
   JFACC sees "Filled by …" on the request page and Op Status. Later commits are rejected.
4. The JFACC can cancel an open line or release a commitment (the line is re-posted).

The bot contract (event payloads, the `ato_commit:<line_id>` button and the commit endpoint) is in
[`docs/ATO_Discord_Integration.md`](docs/ATO_Discord_Integration.md). The prototype can't receive real Discord
commits, so the request page's *Discord post* preview has "Commit as …" buttons that run the same commit logic.
`samples/iron_trident_viper.miz` is a sample sponsor mission.

## Files

- `js/data.js` — seed data (fictional groups, campaigns, sample products, proposals, map)
- `js/app.js` — storage, auth gates, roles/permissions, shared chrome
- `js/products.js` — product schemas and document renderers (incl. comm matrix)
- `js/proposal.js` — campaign proposal questions and renderer
- `js/targeting.js` — JIPTL nomination pipeline, built-in DCS unit table, SAM kill doctrine
- `js/ato.js` — ATO line registry, `.miz` reader (zip + Lua table parser), Discord payloads, commit logic
- `samples/iron_trident_redfor.csv` — sample Coalition Parser export for the demo campaign
- `samples/iron_trident_viper.miz` — sample sponsor `.miz` for ATO line requests
- `samples/iron_trident_host_draft_v2.miz` — v2 of the host draft with tankers, a carrier group and a ground TACAN, carrying deliberate TACAN/ICLS problems for the scrub (synthetic)
- `samples/iron_trident_host_draft.miz` — sample host draft `.miz` (BLUE flights + REDFOR) for the Mission file page. **Synthetic:** its x/y were generated from the sample CSV with a made-up projection, so use it with `iron_trident_redfor.csv` to demo calibration — never as a real Caucasus calibration
- `docs/ATO_Discord_Integration.md` — contract for the Discord bot (post, commit, filled/cancelled)
- `css/styles.css` — three visual styles (Ops Floor, Night Vision, Staff Paper)

DKS (Digital Kneeboard Simulator) export buttons are placeholders until that integration is built.

## Moved files

Everything that was at the top of this repo before now lives one level down in `OLD/`:

| Was | Now |
|---|---|
| `README.md` | `OLD/README.md` |
| `docs/…` | `OLD/docs/…` |
| `scripts/…` | `OLD/scripts/…` |
| `tools/…` (incl. `tools/jiptl_pipeline/…`) | `OLD/tools/…` |

If anything links to a file by its old path (for example an integration reading
`tools/jiptl_pipeline/config/unit_classification.json`), update it to the `OLD/` path.
