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

**Test run:** open http://localhost:8765/tests.html after every change. It runs the CAOC process end to end on its own
fresh copy of the demo data (the site's data is never touched) and the sample `.miz` files: parsers, every product's
render, ATO line post and commit, the host `.miz` change log (upload, post, acknowledge, a slow tanker fixed), the
PUBLISH check list, PUBLISH (approve, release, DKS, the pilot package zip), the go/no-go and Cycle, and real pages
loaded in a hidden frame (the proposal form's buttons). **Also check .miz
files…** runs the change log on any mission files you pick (against an empty scratch campaign).

## Pages

| Page | Who | What |
|---|---|---|
| `login.html` | CAOC staff | Staff sign-in |
| `index.html` | CAOC staff | Campaign dashboard, every panel full width: the one **PUBLISH** (see [PUBLISH and the pilot package](#publish-and-the-pilot-package)), **Cycle to next ATO**, products wanted and the **Discord post** preview of the last PUBLISH; the deadline timeline (campaign build / mission cycle, editable); products (tiles, battle rhythm, or a table with who approved and what's released); ATO line requests; host mission file; host debriefs; DKS export detail (Overlay, Agencies changes, kneeboards); groups; activity. The Comm Plan, OPTASKLINK, JCEOI and IFF / SIF sit together as one **Comm / Datalink / IFF** group (built at the same sitting); the JCEOI is reached from there, not the top nav |
| `product.html?p=optasklink` | CAOC staff | OPTASKLINK: built automatically from the ATO and the host mission file — nothing to fill in but notes |
| `product.html?p=<id>` | CAOC staff | Product builder + live preview (Planning Conference, CI, AOD, JIPTL, TDP, MAAP, ATO, ACO, SPINS & ROE, Comm Plan, OPTASKLINK, BDA). **Save** makes a product ready for the CFACC, who approves it there or in PUBLISH |
| `tdp.html` | CAOC staff | TDP book: one target folder per JIPTL target, drafted from the nomination data; **Export imagery jobs** for the render tool; **Open target folder** |
| `folder.html?t=<target>` | CAOC staff | AFLG-style printable target folder (see [Target folders](#target-folders-and-imagery)) |
| `maap.html` | CAOC staff | MAAP: checks at the top (errors first), packages of ATO lines against JIPTL targets with each package's **support** (tankers, AWACS / GCI, TAC C2, JTAC), coverage per target and per key task; Apply to ATO |
| `grg.html` | Groups (staff can see all) | A group's own gridded reference graphics, made when they want one for an op they fly: DCS F10 ALT map, fixed grid, every DCS building numbered in its cell (see [GRGs](#grgs-gridded-reference-graphics)) |
| `prcc.html` | CAOC staff (PRCC) | vPRCC — personnel recovery: DKS ejection reports worked through report, locate & authenticate, support, recover, reintegrate, then the CSAR task force package (see [Personnel recovery](#personnel-recovery-vprcc)) |
| `jceoi.html` | CAOC staff | JCEOI: standard Blue net plan (the Comm Plan matrix, clear in every theater), Nevada (NTTR) plan, IFF / SIF, clear-channel pool, frequency check, `.xlsx` export. The per-theater registers are used for every check but not shown |
| `map.html` | CAOC staff | Theater map from the ACO: nav/spider/dest points, threats with DCS range rings, FLOT, FSCL, MRR, AR tracks, HVAA orbits, artillery ROZ |
| `targeting.html` | CAOC staff | Target nomination (from the JIPTL): REDFOR order of battle → JIPTL scored by the Commander's Intent key tasks, ported from the JIPTL pipeline |
| `campaign-review.html` | CAOC staff (CFC decides) | Campaign proposal review queue |
| `unit-login.html` | Participating groups | Group sign-in |
| `unit.html` | Groups (staff can observe) | Op Status: product board, distribution matrix, ATO lines, group pack and **pilot package (zip)** download. A participating squadron can **Request a line** from the host (same questions as Create an ATO Line) and follow its approval; the host JFACC group sees its lines filling and the requests waiting for it |
| `isoprep.html` | Groups (staff can read) | ISOPREP / EPA: each pilot's ISOPREP (4 authentication statements, a 4-digit number, description) and an evasion plan per ATO line, read by the PRCC |
| `mission-file.html` | Host unit (staff can read) | Host mission file intake: upload the draft `.miz` (and every new version); BLUE flights → ATO requests, REDFOR → target nomination; per-theater coordinate calibration; TACAN / ICLS scrub; the **.miz change log** (the host acknowledges it here) |
| `debrief.html` | Host unit (campaign's JFACC group) | Post-mission debrief: lines flown, BDA, losses, progress — feeds the CAOC's next cycle |
| `ato-request.html` | Campaign's Group JFACC / LNO (the host) | ATO lines: **Create an ATO line** from the group's `.miz` (player slots → Human, rest → AI) or the form; Human lines are saved as drafts (Edit, Remove) and go out only when the host presses **Post to Discord**. **Line requests from squadrons** with Approve / Deny (deny takes a reason); an approved request goes on the ATO assigned to that squadron |
| `campaign-submit.html` | Groups | Campaign proposal wizard (JFACC, intent, win/loss, REDFOR, schedule…) |

## Demo accounts (prototype only)

- Staff: ATLAS (CFC), OVERLORD (CFACC), SPARTAN, CHALICE, WIZARD, DARKSTAR, GUARDIAN (PRCC) — password `aoc-demo`
- Groups: viper, hornet, eagle, hawg, knights, tomcat, harrier, mistral, thunder, keepers, ridge, support, rqs55 (55th RQS,
  MH-60L — the CSAR helicopter unit) — code `unit-demo`

## Roles

- **CFC** — manages the CAOC, decides on campaign proposals, can assist the CFACC.
- **CFACC** — makes sure every deliverable is built and approved; approves (on the product page or in PUBLISH) and publishes.
- **Group JFACC** — elected by the sponsoring group; manages the campaign and is the CAOC's single POC.
- **PRCC** — the personnel recovery coordination cell: works each ejection DKS reports and builds the CSAR task force.

## Campaign process

The CAOC builds products only. The host unit builds and runs its own `.miz`, readiness, the mass brief and the mission.
Default deadlines (editable per campaign on the Dashboard), T-0 = first mission:

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
| T-7 / T-6 | ATO final / SPINS & ROE | CAOC |
| T-5 | Comm Plan — built last | CAOC |
| **T-72h** | CFACC approvals → **PUBLISH** on the Dashboard, no later than 72 hours out: products to groups, DKS exports (ACO → DKS Overlay, Comm Plan → DKS Manage Agencies, SPINS Addendum A → DKS kneeboards), the pilot package zip to every group's Discord | CAOC |
| T-24h → T-0 | Final `.miz`, readiness, mass brief, first mission | Host |
| T+1 | Debrief | Host |

Between missions (weekly missions, about 4 days from one mission to the next PUBLISH; T-0 = next mission): debrief T-6.5,
BDA + AOD T-6, JIPTL T-5.5, TDP T-5, MAAP T-4.5, commits T-4, ATO + tanker/JTAC frequency changes T-3.5, **PUBLISH T-72h**,
host `.miz` update T-24h.

The ACO overlay is drawn in DKS on the theater map and is never written into the `.miz`. The Comm Plan agencies are
persistent for the campaign; normally only tankers and JTACs change, and the Dashboard lists what changed since the last export. The **kneeboard** export sends SPINS Addendum A (AET tables and RAMRODs, one page per ATO) from the released SPINS; it is due again when the SPINS are re-released or the ATO cycles. **Cycle to next ATO** (Dashboard) moves the ATO day on and returns the daily products to work.

## PUBLISH and the pilot package

Two people can run a campaign: products are built (most of it generated) and **saved**, which makes them *ready for
approval*; the CFACC approves them on the product page or in PUBLISH. There is one release path, the **PUBLISH** button
on the Dashboard (CFACC or CFC). Its dialog:

0. **Check list** — the CAOC's products against each other (also shown in the Dashboard's PUBLISH panel). **Errors
   block PUBLISH**: an INT line off the JIPTL, SCAR with no ACO area, a tanker line on a track that is on neither the ACO
   nor the theater map, a TOT outside the ATO period, IFF / SIF errors, datalink (STN / TN / IDM) errors, an empty ATO.
   **Warnings** need a tick ("reviewed") before PUBLISH goes: DCA / CAS / XCAS / XINT / AEW / ISR lines fragged to an
   area not on the ACO or map (one line per area), a tanker or AWACS with no frequency (track, orbit or Comm Plan
   callsign), two tankers on one track at one time, uncommitted human lines, no SPINS bullseye, IFF warnings, Comm Plan
   problems.
1. **Approve** — every product saved and ready, one tick each (untick to hold one back), plus the SPINS bullseye if the
   host's latest mission file moved the BLUE bullseye (the SPINS are updated and released).
2. **Release** — every approved product to every active group's Op Status (versioned).
3. **DKS** — Overlay (ACO + theater map), Manage Agencies (Comm Plan), Kneeboards (SPINS Addendum A); each pre-ticked when
   it changed, including a product this PUBLISH approves.
4. **Discord** — one post per group with the **pilot package**: one zip of printable pages (an index, then CI, AOD, ATO,
   SPINS, Addendum A, ROE, Comm Plan, ACO, OPTASKLINK and the TDPs of the targets the ATO strikes with INT lines).
   Internal products (Planning Conference, JIPTL, MAAP, BDA) never go; the JIPTL is on Op Status for line requests.

The same zip downloads from the Dashboard and from each group's Op Status. There are no per-page publish or "Send to DKS"
buttons; the PRCC's DKS buttons are the live rescue workflow and stay. IFF codes are assigned whenever the ATO is saved.

**Products wanted.** The campaign proposal asks which products the host wants (CI, AOD, ACO, SPINS & ROE, JIPTL, TDPs,
Comm Plan, OPTASKLINK); TDPs bring the JIPTL with them. **The ATO is always produced**: it is how groups get and commit
their mission lines, so the ATO line requests, commits and the Discord post work the same with nothing else ticked. A
product the host didn't ask for shows as *Not requested* on the Dashboard, has no deadline on the timeline, isn't released,
isn't on Op Status and isn't in the pilot package; its DKS export is greyed out in PUBLISH. The CFACC or CFC can change
the list on the Dashboard (**Products wanted → Change…**). Internal products (Planning Conference, MAAP, BDA) are always
built. A campaign with no list (older ones) gets the full set.

ATOs are designated by letters, not day numbers: day 1 = **ATO AA**, day 2 = AB … day 26 = AZ, day 27 = BA (`AOC.atoId`). Every page, product header, the USMTF `MSGID` and the Discord / DKS payloads (`ato: "AH"` beside `ato_day`) use the letters; the day number stays underneath because mission numbers (8101, 8601 …) are built from it.

## IFF / SIF plan

The JCEOI carries an IFF code plan (`tools/jceoi/data/iff.json`, checked by the build; `js/iff.js` on the site):

- **Reserved Mode 3/A codes** never assigned: 0000, 1200, 1202, 1255, 1277, 2000, 4000, 7000, 7400, 7500, the 7600 and
  7700 series, 7777 (FAA AIM 4-1-20, ICAO practice). A slot holding any of them is skipped (block 12 loses 120, 125, 127).
- **Mode 3/A starts with the line's Mode 1 code**: SEAD (Mode 1 30) flies 3011–3017, 3021–3027 … Each ATO line takes
  a slot of its Mode 1 block: the lead squawks BBC1, the last member of a non-standard flight BBC1 + (n − 1), others
  standby (the NELLISAFBI 11-250 §4.3.2 pattern). A full block spills into the family's spare Mode 1 code (Escort 12 →
  13). Why: the F-16C's IFF panel shares its four code wheels, and SRS sends the first two as Mode 1, so Mode 1 has to
  be the first two digits of Mode 3/A. Campaigns use the same blocks; they never fly together. The build checks every
  Mode 1 code keeps at least three clear slots.
- **Mode 1 by mission type** (the vCAOC's own scheme): first digit = family (1 counter-air, 2 strike/AI, 3 SEAD/DEAD,
  4 CAS/FAC(A), 5 AR, 6 C2/ISR/AEW, 7 rescue/airlift), second digit 0–3 = sub-role; optional daily rotation.
- **Mode 2** optional per airframe (group number + aircraft), for full-IFF modules only.
- **Mode 4 and IFF procedures** default into SPINS section 3.5 (with IFF-off areas); the Comm Plan prints how Mode 3/A follows
  Mode 1 and the Mode 1 table; SPINS tells F-16C pilots to use the M1/M3 enable switch; Nevada adds the NTTR rules (tactical Mode 3 on range, never 1200).
- **Checks** on the ATO (live) and on the Comm Plan: octal, Mode 1 second digit 0–3, reserved and non-discrete codes,
  last-member code and slot, Mode 3/A not starting with its Mode 1, reserved slots, duplicates within the ATO.
  Saving the ATO fills lines with no codes and re-assigns any whose Mode 3/A doesn't match its Mode 1 (**Reassign all lines** redoes every line).
- The JCEOI page has an **IFF / SIF** tab: a rollup of the selected campaign's codes by ATO line (human lines first,
  Mode 1 / Mode 3/A lead–last / Mode 2, a ✓ / ! / ✕ per line and the findings; codes are still assigned on the ATO),
  then the reserved register, the Mode 1 table with each code's Mode 3/A slots, and the code checker. The `.xlsx` has
  three IFF sheets, including that campaign's codes.
- In DCS, Mode 4 is coalition-based for most aircraft. SRS carries Mode 1 and Mode 3/A codes (Mode 2 and Mode 4 are
  on/off in its overlay; a few cockpits export a real Mode 2) and LotATC shows them to GCIs.

## OPTASKLINK (datalinks)

Product `optasklink` (`js/tdl.js`; plan data `tools/jceoi/data/tdl.json`, checked by the build). A datalink plan, much like
the Comm Plan, built automatically every time it opens from the ATO and the latest host mission file; staff only save,
submit and approve it (a note says when it changed).

- **Header**: effective period = the ATO day 0300Z–0259Z holding the mission's vul time (the .miz start time, converted
  from theater local time; e.g. a 0800Z start on 13 Jul runs 130300Z–140259Z); a network moniker picked once per
  campaign and never reused (`COBALT LINK`), which is also the JICO callsign (Nevada keeps JUICE on 231.100); NTR = the
  mission file's AWACS, else the ATO AEW line. Network settings: the F/A-18C channels the host already set (most
  common), F-16C channels and A-10C SADL keys from the defaults.
- **Mission file participants** (printed as read, report only): AI AWACS (AWACS-task group or E-3A / E-2C / A-50 /
  KJ-2000) as the Link 16 donors; warships and EWR/GCI radars as C2, with notional STNs from 00001–00177 (they have
  none in the Mission Editor); every other AI aircraft with an STN; the F/A-18C setup (STN, voice, channels, donors).
  Older missions' dictionary names (`DictKey_…`) are resolved.
- **Human flights from the ATO, set in the cockpit**: F-16C STNs (campaign STN blocks, one slot of 8 per flight, lead
  BBBS1, never a slot holding a mission file STN); A-10C II SADL TNs `0FFM`; AH-64D IDM nets (each flight its own
  preset 1–9, all on the common net 10, originator IDs unique across the campaign). Voice callsigns are first + last
  letter, flight and member (VIPER 1 → VR11). A line keeps its numbers while its callsign and size are unchanged and
  nothing in the mission file collides; "Reassign every number" starts over.
- **Checks** (product page, mission file page, Dashboard): every STN valid, unique across the whole network and not
  reserved; F-16C STNs unique across campaigns; F/A-18C channels consistent; every AWACS a donor on every F/A-18C;
  missing STNs listed once; SADL TNs and IDM IDs unique.

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
6. **Left at the DCS default** — a TACAN on 1X or an ICLS on channel 1 (the Mission Editor's starting values).

Findings new since the previous version are marked; fixed ones are listed. The Dashboard shows the count. Tanker tracks
have optional TACAN channel / X-Y / ident fields; SPINS has a Carriers & ships table (TACAN, ident, ICLS).

## Host .miz change log

**T-24h go/no-go** (heads the change log on the Dashboard and mission file page, in the log text, and is the check on the
timeline's "Host builds / updates the .miz" deadline): **NO-GO** while there is no `.miz`, no `.miz` since the last
PUBLISH, or any ADD / SET / FIX item open; **GO** otherwise, with notes for REMOVE items and an unacknowledged log.
Due 24 hours before T-0; shown overdue after that.

`js/mizlog.js` builds, from the host's current `.miz`, the ATO and the CAOC products, the list of what the host JFACC
must change in the mission file so it matches the CAOC's documents. Nobody fills it in, and the CAOC never edits the
`.miz`. Items:

- **ADD** — ATO lines the `.miz` doesn't have: requested lines (awaiting commit or committed) and CAOC support lines.
  ATO rows match `.miz` flights by the line's own `.miz` group, then by callsign. **Tanker callsigns come from the
  `.miz`**: a tanker line matches an unclaimed `.miz` tanker of the same airframe, and the ATO (and the theater map's
  track) take its callsign when the host uploads (or with **Use .miz tanker callsigns** on the Dashboard). Only a
  tanker the CAOC added that the `.miz` doesn't have is an ADD.
- **SET** — values the CAOC assigned that live in the `.miz`: tanker TACAN and radio (tanker tracks), carrier TACAN and
  ICLS (SPINS), the radios of AI support assets the Comm Plan names by callsign (AWACS, tankers, ships), tanker orbit
  altitude when the track gives one.
- **FIX** — what the checks found: TACAN / ICLS scrub checks 1–3, 5 and 6, datalink settings in the `.miz` (AI STNs,
  F/A-18C channels, team and donors), a tanker radio outside the Comm Plan, airframe / number / crew differences on a
  matched line, **tanker airspeed** (± 5 KCAS of 300 for the KC-135, KC-135 MPRS, KC-10 and S-3B, of 100 for the KC-130, which refuels helicopters; the Mission Editor speed is true airspeed, so the log gives the
  number to type for the orbit altitude, about 430 kt at 25,000 ft), JIPTL targets with no RED unit within 1 NM in the
  `.miz`, and a mission start after the ATO's first TOT.
- **REMOVE** — groups of cancelled lines; targets BDA rates destroyed (when the campaign carries damage).

Every check that ran clean is listed as passed; one that couldn't run says why. Not `.miz` changes, so never listed:
human-flight radio presets, Link 16 STNs, SADL TNs, IDM and IFF / SIF (cockpit or DKS). **CAOC-side** problems (two
tankers fragged to one track at one time, a tanker callsign the ATO hasn't taken) show on the Dashboard only.

The log goes to the **host's registered Discord channel** (`miz.changes`): after every `.miz` upload that changes it,
and with PUBLISH (a tick, pre-ticked when it changed since the last post). Each post marks new items and lists what
the new version fixed; an item closes itself when the next upload passes its check. The host acknowledges it on the
mission file page (or the Discord button). It shows on the Dashboard and the mission file page and downloads as text.

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
- The **Comm Plan** editor checks every channel against the campaign theater's register (and flags duplicates and
  channels holding a different net from the standard), and can fill empty channels or reset the matrix from the JCEOI.
  Existing Comm Plans are never changed automatically. The demo campaign's Comm Plan is the JCEOI standard plan with
  the campaign's callsigns (SCAR and SAR-B in spare rows).

- **Nevada (NTTR) is pre-decided.** The Nevada register adds every official NTTR / Nellis assignment (AFMAN 13-212V1
  NTTR Addendum A Attachment 14; NELLISAFBI 11-250 Attachment 20): range tactical frequencies, agencies, local
  standard channelization, controlling agencies and AR track control, squadron commons. Nevada campaigns use the CAOC
  NTTR comm matrix as their Comm Plan, checked against it and the official assignments; the JCEOI page has a "Nevada
  (NTTR plan)" tab with the matrix, comm card vs Nellis channelization, tankers, AR tracks, range JTACs and a plan check.

Rebuild the data with `tools/jceoi` (see its README); the build refuses to write a plan with any conflict (fixed
channels excepted — they are kept and reported).

## Target nomination (JIPTL pipeline)

JIPTL target numbers are `T10001`, `T10002` … in rank order (the demo seed uses the same scheme). A new nomination
renumbers the list, so the ATO editor, the MAAP, Create an ATO line and Request a line flag any target number that is
no longer on the current JIPTL ("renumbered or removed?"). Areas such as CAP KNIFE or AO HAMMER are never flagged, except on
an **INT** line (pre-planned interdiction always has a JIPTL target; on-call is XINT) and a **SCAR** line (pre-planned SCAR
names its ACO area, usually a kill box; ad-hoc SCAR is a re-role by C2 and never on the ATO).

Browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py`:

1. **Key tasks & priorities** — the campaign's **Commander's Intent key tasks**, in their order of priority (see
   [Key tasks](#key-tasks-through-the-products)), each mapped to the target categories it attacks; weights, caps,
   tier weights and default grades. CAS / TST is continuous and never ranked.
2. **AO (Area of Operations)** — set on the page's map and labelled "AO" there: a box (drag it to move, drag a corner to resize, double-click it to
   rotate with the yellow handle) or a point + radius (drag the centre and the edge handle, or type the radius).
   Defined on this page only; it is independent of the ACO and the theater map.
3. **REDFOR order of battle** — Coalition Parser CSV exports (`Group, Unit, Type, Latitude, Longitude, Altitude (ft)`;
   DMS or decimal). `samples/iron_trident_redfor.csv` is an example.
4. **Run** — classify each DCS type, group by DCS group, name the group after its doctrinally-critical unit
   (e.g. an SA-11 by its TELARs, an SA-6 by its 1S91 radar), keep groups inside the AO,
   score each group under the first key task that covers its category (task weight + tier weight), rank, cap per
   task, number `T10001…`. A group no key task covers goes to the watchlist ("task: none").
5. **Review** — tabs for JIPTL / Watchlist (cut by caps, or no key task) / Outside AO / Unclassified types / Not targets;
   re-grade, re-order, cut or promote lines, then **Send to JIPTL** (the JIPTL returns to Draft for CFACC approval).

The built-in unit table covers ~130 common DCS types. Load the full
`OLD/tools/jiptl_pipeline/config/unit_classification.json` on the page to use the complete catalogue.
REDFOR can also come from the host's mission file (*Use REDFOR from it* on step 3). A `.miz` stores positions as map x/y,
so conversion needs the theater's projection. **Caucasus, Persian Gulf, Syria, Afghanistan, Kola, Nevada and the
Marianas are built in**, each a Transverse Mercator fitted to the terrain's own `Beacons.lua` (every DCS beacon has map x/z
and lat/lon), so every beacon lands within 0.5 m (`js/miz.js`; the fit is `tools/target-render/dcs_charts.py`). The
earlier Persian Gulf constants were about 97 km off: re-run nomination for any Persian Gulf campaign nominated before.
A theater not built in is **refused, never guessed**, until it is calibrated once on the Mission file page from a
Coalition Parser CSV of the same mission (worst unit within 25 m). Unit headings are kept for the target-folder renders.

## ATO document

The ATO renders in USMTF message format (after the AIR TASKING ORDER guide and the 510th vFS ATO / SPINS / ACO example
format), then a quick summary: one table of human lines, one of AI lines (no M3-last or M2 columns). The message is built from the ATO
lines plus what the site already holds, so staff type nothing extra:

- `OPER`, `MSGID`, `AMPN`, `TIMEFRAM`; one `TASKUNIT` per unit (open and AI lines get their own).
- Per line `AMSNDAT` and `MSNACFT` (number, type, callsign as VIPER11, lead STN from the OPTASKLINK, then Mode 1 / 2 / 3
  as `1xx` / `2xxxx` / `3xxxx`), `PKGCMD` (the first striker in the package), `CONTROLA` (the AEW line, with the
  line's mission net from the Comm Plan as primary and check-in as secondary, found by purpose — see
  [Comm hierarchy](#comm-hierarchy-and-the-comm-check)), `GTGTLOC` + `TGTS` for JIPTL targets or
  `AMSNLOC` for areas (altitudes from the theater-map shape), `REFTSK` (tanker track frequency and TACAN), `ASACSDAT`
  for the AWACS, `ASUPTFOR` / `ASUPTBY` linking receivers and tankers.
- `AMPN` carries the ALR, the target's CDE level and its **KEY TASK** number; the summary lists the key tasks the ATO serves.
- Mission sets: **INT** (pre-planned interdiction against a JIPTL target) and **XINT** (on-call interdiction); **CAS**
  (fragged to a known movement to contact) and **XCAS** (on-call, holding until needed); **SCAR** against an ACO area. There
  is no "AI" mission set: AI means AI-crewed lines. Saved ATOs, ATO lines and AODs renamed AI → INT on load.
- Mission types include **RESCORT** (Sandy) and **SARCAP** for the rescue force.
- General instructions are not part of the ATO; they belong in the SPINS.

## SPINS & ROE

One product, one approval, three documents: the SPINS, **Addendum A — Authentication** and the ROE. The preview has a tab
for each; copy, download and print take the tab on screen; released copies carry all three, with page breaks between.
The SPINS are **directive**: they state what aircrew will do, with no explanations or worked examples (that is what
training sorties are for). The layout follows the Operation Mountain Sentinel and
Red Flag SPINS, with the ROE as its own document instead of a SPINS chapter.

- **SPINS** (the JFACC's procedures): 1 General information (validity, Zulu, ATO period 0300Z–0259Z, the bullseye — read from the **BLUE** coalition bullseye of
  the host's current `.miz` (RED's is never used) and code-worded with a beer (picked per campaign, or chosen), and the
  acceptable level of risk: a standing Extreme / High / Medium / Low table with the campaign's default, which the ATO
  prints on every line as `AMPN/ALR:`), **1.2 Command and control** (who holds TACON of the day's missions: delegated to C2
  by default — the ATO's AWACS line or a C2 callsign set — or retained by the JFACC, or delegated to the CAOC SODO; printed
  NOT DEFINED if it cannot be resolved), 2 ROE (a
  pointer to the ROE and its default WCS), 3 Communication (**MNPOPCA check-in** with the controlling authority; code words
  typed Action / GEOREF / OPFOR, picked from the codeword reference list; **3.3 authentication** at aircrew discretion, the
  method — sequential, RAMROD or AET table — briefed, with the RAMROD of each ATO; CSAR — pointing to section 5 — and IFF / SIF),
  4 Airspace & safety (air refuelling, carriers, diverts, emergency / lost comms), **5 Personnel recovery**: SARDOT,
  SARNEG (with its digit key), duress word, ISOPREP, the word / letter / number of the day per ATO day, position
  reporting (SARNEG-encoded MGRS or bearing true / range from the SARDOT), PR frequencies and contact schedule, signals,
  the EPA rule and SAFE areas. Every PR value is generated for the campaign unless the SPINS sets it.
- **Addendum A — Authentication**: one kneeboard page per ATO from the current one, a week ahead, each with its AET table
  (rows A–M, columns N–Z, generated per campaign and ATO) and its RAMROD (a 10-letter word, no letter twice, for 0–9),
  effective 0300Z. Goes to DKS kneeboards with PUBLISH (released SPINS only).
- The editor picks rather than types: TACON, ALR and WCS are dropdowns; SARNEG and the duress word are dropdowns (blank =
  the generated value, named in the hint); the daily table pre-fills each ATO's word, letter and number of the day and
  RAMROD with the generated values, each a dropdown. RAMRODs and code words come from the 639th codeword reference list
  (Action = heroes, GEOREF = rock bands, OPFOR = cars, RAMROD = 10-letter words) in `js/pr.js`.
- **ROE**: built from the vCAOC standing ROE (`tools/jceoi/data/roe.json`: law of armed conflict, self-defense,
  precedence; surface ROE — PID, protected structures, planned / dynamic / time-sensitive / troops-in-contact
  authority, and the collateral damage estimate: five CDE levels with who clears each (the campaign sets the CDE 4 and
  CDE 5 authorities and the CDE 5 authentication word), assessment, upgrade, SAM self-defense and danger-close rules;
  each TDP folder carries its target's CDE level, which the ATO prints with the line; air ROE — classification terms, hostile act and intent, enemy indications, commit
  authority, formal order; weapons control statuses) plus the campaign's choices: default WCS, declared hostile forces,
  on/off campaign measures (defaults from the standing data; the AWACS callsign comes from the ATO's AEW line), ID and
  commit criteria, weapons restrictions, restricted / no-strike targets, theater rules (Nevada: NTTR ranges) and remarks.
- The ATO editor shows the missions as two grids, human lines then AI lines, with aircraft as "2xF-16C". IFF codes
  are assigned when the ATO is saved and shown in the ATO document and on the IFF / SIF page, not in the grids.

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

## Key tasks through the products

The Commander's Intent key tasks (from the accepted proposal) are the campaign's priorities, and every product reads
them from one place (`AOC.keyTasks`, `AOC.keyTaskOf`):

- **Target nomination** maps each key task to the target categories it attacks, read from its wording (SAMs, LOCs and
  depots, C2, armor, naval…; DCA and "protect" tasks have no planned targets, CAS is continuous). The mapping is
  editable on the page and kept while the task's wording is unchanged.
- **JIPTL**: each target's key task, and a key task table with what each covers and how many targets it has.
- **AOD**: the objectives are the key tasks in priority order, with their missions and JIPTL targets.
- **TDP** folders and the target folder name the target's key task. **MAAP**: key tasks per package, coverage per key
  task, and a warning when a key task's targets are in no package. **ATO**: `KEY TASK:n` on each line.
  **BDA rollup**: a key task assessment (targets, attacked, destroyed, damaged, re-attack).

## Target folders and imagery

`folder.html` is a printable AFLG-style target folder for each JIPTL target: cover, target summary, joint operations
graphic, orientation view, critical element graphic (every vehicle its own CE), desired point of impact graphic (one
DPI per vehicle, with coordinates, MGRS, elevation; the DMPI — the vehicles' mean point — shown for reference only),
targeting pod view, DPI list, CDE graphic, collateral damage information, acronyms. Every graphic has a compass turned
to true north. Markup is drawn by the page from `img/targets/<campaign>/<target>/meta.json`, so editing a folder never
needs a re-render.

The imagery is made offline by `tools/target-render` (Blender, the DCS install, Python): TDP book → **Export imagery
jobs**, then `python tools/target-render/build_folders.py "<OP>-imagery-jobs.json"` (about a minute per target), then
commit `img/targets/`. It renders the .miz units as the DCS 3D models on Esri satellite imagery and terrain (site view
and a simulated white-hot TGP view), and the JOG is the **DCS F10 map's own chart** read from the terrain's
`RasterCharts` (1:250,000 where DCS has it; the Esri topographic map where a terrain has none). Tested on Caucasus,
Persian Gulf, Syria, Afghanistan, Kola and Nevada. See `tools/target-render/README.md` for setup.

## GRGs (gridded reference graphics)

`grg.html` builds the one-page GRGs that go in the kneeboards of the pilots, JTACs and controllers flying an op. GRGs are
**the groups' own**, not a CAOC product and not in PUBLISH: a group makes one in the unit portal (**GRGs**) when it wants
one, and sees and saves only its own sheets (staff see every group's). A sheet is a
lettered / numbered grid (A1 = north-west, rows counting south) with every building numbered in its cell, 1 upward,
north-west to south-east, so a talk-on is "D5 building 3".

- **Background**: the **DCS F10 map's Alt layer**, as web tiles exported from DCS by the
  [DCS Olympus](https://github.com/Pax1601/DCSOlympus) project (`maps.dcsolympus.com`): Caucasus, Syria, Nevada,
  Persian Gulf, Marianas, Normandy, Germany (Cold War). Theaters without an export (Kola, Afghanistan, …) use real-world
  imagery instead.
- **Buildings**: on the ALT map they are the sim's own, read off the tiles (near-black blobs; trees, roads and map
  lettering are left out), at zoom 16 or deeper. On real-world imagery they come from OpenStreetMap. Numbers are white on
  each building.
- **Making a sheet**: from a point, from a kill box / ROZ on the theater map, or **Zoom to settlement** (the settlement's
  core, sized to the page). The **mouse wheel** over the map zooms it (1:N on letter); the grid stays fixed on the page and
  the map is **dragged** under it. Moving the map, the scale or the cells renumbers the buildings and makes a new version
  on save.
- **Out**: Print / PDF (letter landscape) and GeoJSON (grid, cells, numbered buildings) to load into DKS.

## Personnel recovery (vPRCC)

DKS Debrief reports each ejection (`pr.ejection`, contract in [`docs/PR_DKS_Integration.md`](docs/PR_DKS_Integration.md));
`prcc.html` opens an incident and matches it to the ATO line, the pilot's ISOPREP and the **SPINS release the crew took
off with** (every product release is kept). The PRCC works five steps:

1. **Report** — what DKS sent, and what is missing (no ISOPREP, line not on the ATO, older SPINS).
2. **Locate & authenticate** — position in lat/long, MGRS, SARNEG and from the SARDOT; word / letter / number of the
   day and duress word from the take-off SPINS; the ISOPREP statements (answers hidden until clicked).
3. **Support** — threats around the survivor (SAM rings that cover them), the CSAR comm plan, the survivor's EPA.
4. **Recover** — command (PRCC; AMC: the HC-130 King if tasked, else the AWACS, else the SARCAP lead, or the PRCC's
   choice; OSC: the RESCORT lead, Sandy 1) and the force: RESCORT, rescue helicopter (MH-60L, 55th RQS), optional
   CH-47F lift, SARCAP, SEAD (when a SAM ring covers the survivor), HC-130 King, AWACS, ISR, tanker. Each element
   retasks an ATO line or **requests a new one** (posted to Discord in an airframe an active group flies; flagged when
   none does). The route is built from theater-map spider points and sent to DKS, or downloaded as GeoJSON.
5. **Reintegrate** — the outcome, and close the incident.

The **CSAR task force package** puts it on one printable sheet and publishes it to the groups flying the rescue. Groups
file ISOPREPs and EPAs on `isoprep.html`. "Simulate ejection" on the PRCC page shows how a report arrives.

## Comm hierarchy and the comm check

The levels, top down: **1 SPINS** (procedures and PR frequencies), **2 JCEOI** (the standard net plan), **3 Comm
Plan** (the theater's channels), **4 special plans** (the CSAR comm plan, MAAP package support, ATO control lines,
OPTASKLINK JICO voice). Lower levels read from the one above: every page asks for a channel by **purpose** (check-in,
strike, SEAD, DCA, SCAR, CAS, ASOC, JTAC, AWACS / C2, PRCC, RESCORT, SAR, SAR-B, ISR, tanker — `COMM.findChannel`), so
the JCEOI template's role names and a hand-built matrix's both resolve. The survivor's frequencies come from the SPINS
they took off with; with no SAR-B net the PR alternate is the all-services SAR common, 282.800.

The **comm check** on the SPINS and Comm Plan editors lists disconnects: channels the SPINS name that are not on the
plan, "X Common" nets that do not exist, differences from the JCEOI standard, nets the products need but cannot find,
theater-map tracks and orbits off the plan, tankers without a frequency.

## Files

- `js/data.js` — seed data (fictional groups, campaigns, sample products, proposals, map)
- `js/app.js` — storage, auth gates, roles/permissions, shared chrome
- `js/products.js` — product schemas and document renderers (incl. comm matrix)
- `js/proposal.js` — campaign proposal questions and renderer
- `js/targeting.js` — JIPTL nomination pipeline, built-in DCS unit table, SAM kill doctrine
- `js/ato.js` — ATO line registry, `.miz` reader (zip + Lua table parser), Discord payloads, commit logic
- `js/miz.js` — host mission file intake, theater projections (beacon-fitted), REDFOR rows with headings
- `js/pr.js` — personnel recovery: incidents, DKS intake, SPINS PR data, ISOPREP / EPA, CSAR comm plan, forces, route
- `js/jceoi.js`, `js/jceoi-data.js` — JCEOI registers, net plan, IFF and TDL data (built by `tools/jceoi`)
- `js/iff.js`, `js/tdl.js`, `js/tacan.js`, `js/package.js` — IFF / SIF plan and checks, OPTASKLINK, TACAN / ICLS scrub, group pack and DKS exports
- `tests.html` — the test run (its own data copy: `window.AOC_DB_KEY`)
- `js/mizlog.js` — the host's `.miz` change log (ADD / SET / FIX / REMOVE, checks passed) and its Discord post
- `tools/target-render/` — offline target-folder imagery (Blender pipeline, DCS chart JOG); `img/targets/` holds its output
- `samples/iron_trident_redfor.csv` — sample Coalition Parser export for the demo campaign
- `samples/iron_trident_viper.miz` — sample sponsor `.miz` for ATO line requests
- `samples/iron_trident_host_draft_v2.miz` — v2 of the host draft with tankers, a carrier group and a ground TACAN, carrying deliberate TACAN/ICLS problems for the scrub (synthetic)
- `samples/iron_trident_host_draft.miz` — sample host draft `.miz` (BLUE flights + REDFOR) for the Mission file page. **Synthetic:** its x/y were generated from the sample CSV with a made-up projection, so use it with `iron_trident_redfor.csv` to demo calibration — never as a real Caucasus calibration
- `docs/ATO_Discord_Integration.md` — contract for the Discord bot (post, commit, filled/cancelled)
- `docs/PR_DKS_Integration.md` — contract for DKS Debrief ejection reports and the CSAR route / package events
- `docs/vCAOC_Process_for_DKS.txt` — the process brief for the DKS developer
- `css/styles.css` — three visual styles (Ops Floor, Night Vision, Staff Paper). Pages stack their panels full width.

DKS (Digital Kneeboard Simulator) exports are queued in the prototype's DKS outbox (`db.dksOutbox`) until that integration
is built; the formats are in `docs/vCAOC_Process_for_DKS.txt` section 4.6.

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
