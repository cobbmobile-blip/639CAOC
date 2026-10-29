# CAOC ↔ DKS integration contract

Status: **proposed**, 28 Oct 2026. Schema: [`schemas/caoc-dks.schema.json`](schemas/caoc-dks.schema.json).
Examples: [`examples/`](examples/). Open points: [`QUESTIONS.md`](QUESTIONS.md).

## 1. Roles and layers

| Layer | Owner | Lives | In DKS |
|---|---|---|---|
| **Theater**: lasts across campaigns | CAOC | ACP agencies and frequencies (built for the theater and kept), JCEOI nets, permanent airspace | pre-filled, **locked** |
| **Campaign / ATO** | CAOC | ATO line (mission number, type, target or area, package, vul window, tanker plan), IFF/SIF, Link 16 STNs / SADL TNs / IDM, ACO measures, tanker tracks and AWACS orbits, bullseye, JIPTL targets, DMPIs and DPIs, BDA | pre-filled, **locked** |
| **Flight** | the squadron, in DKS | pilots and seats, flight callsign as flown, tail numbers, loadout, route and waypoints, push/TOT inside the vul, timeline, DTC/CMDS, intraflight and squadron nets | the planner's |

The full field-by-field list is [`ownership.json`](ownership.json). **Not sent to DKS at all**: the SPINS (except
Addendum A), ROE, Commander's Intent, AOD, MAAP, target folder text, Planning Conference. Crews read those on the CAOC
site and in the Discord pilot package.

## 2. The flow

```
CAOC builds the campaign ──PUBLISH (NLT T-72h)──▶ DKS campaign pre-filled (locked):
                                                    campaign, turn, agencies, airspace,
                                                    support assets (units), points,
                                                    targets/JIPTL, packages, kneeboard
CAOC posts ATO line ──▶ Discord ──Commit──▶ CAOC site (first commit wins)
                                              └──flight.create──▶ DKS flight in the current turn
                                                                   (CAOC fields locked)
squadron plans in DKS ──flight.changed / read──▶ CAOC adds the planned fields to its ATO line
T-3h, automatic ──read all flights──▶ CAOC posts the FINAL ATO (Discord + CAOC Op Status)
planner needs a locked value changed ──change.request──▶ CAOC changes JCEOI/ACP ──▶ re-sent to DKS
```

Late DKS additions after the host builds the final `.miz` (T-24h) go on the host's `.miz` change log as required ADD
items (CAOC side, already built).

## 3. Conventions (every message)

- **Envelope**: `{ message, message_id, sent_at, source: "caoc", campaign: { caoc_id, dks_id }, ato, ato_day, items }`.
  `message_id` is unique per send (use it to drop duplicates); `dks_id` is `null` until DKS has returned one.
- **Provenance on every item**: `provenance: { sourceType: "caoc", sourceId, version, locked }`.
  - `sourceId` is stable for the life of the object, e.g. `acp:WHITE 3`, `aco:CAP KNIFE`, `map:m4`,
    `jiptl:T10001`, `dpi:T10004/A`, `line:8115`, `turn:iron-trident/8`.
  - A repeat `sourceId` **updates** (upsert). An `.upsert` message is the **full set**: items DKS holds with
    `sourceType: "caoc"` that are missing from the set are removed.
  - `version` is the CAOC release, e.g. `ACP v4`, `JCEOI v2`. DKS shows it next to locked values ("per ACP v4").
- **Units**:
  - positions: WGS84 decimal degrees, `lat`/`lng`;
  - altitudes: integer feet MSL (`altFt`, or `altLoFt`/`altHiFt`), plus the original text (`alt`, e.g. `FL220–FL240`);
  - frequencies: MHz strings with 3 decimals (`"305.000"`) and a `band`;
  - TACAN: `{ channel: 41, mode: "Y", ident: "TEX" }` (DKS's `"41Y"` string is `channel + mode`);
  - times: ISO-8601 UTC; clock times in text keep the CAOC form (`0715Z`, `0600Z–1800Z`);
  - ATO designators: `AA` = day 1, `AB` = day 2 … (the CAOC never writes "Day N").
- **CAOC names are canonical.** Each table below gives the CAOC field and its DKS destination (**seen** = observed in
  DKS, **guess** = to confirm). Extra CAOC fields DKS has nowhere for go in the item's `description`.

## 4. CAOC → DKS messages

### 4.1 `campaign.upsert`: when a campaign is accepted, and with every PUBLISH
One per CAOC campaign. Key: `campaign:<caoc_id>`. Example: [`campaign.upsert.json`](examples/campaign.upsert.json).

| CAOC field | DKS field |
|---|---|
| `opName` (`IRON TRIDENT`) | campaign `name` (**seen**: "Operation VENOM MOCHA") |
| `theater` | campaign `theater` (**seen**) |
| `dday` | campaign `startDate` (**seen**) |
| `keyTasks[]` (Commander's Intent key tasks) | campaign `objectives[]` (**seen**: `text`, `order`) |
| `bullseye { lat, lng, codeWord }` | theater picture / preset point (**guess**) |
| `squadrons[]` (group ids flying) | squadrons on the campaign (see Q5) |

### 4.2 `turn.upsert`: with every PUBLISH and on Cycle to next ATO
Key: `turn:<caoc_id>/<ato_day>`. Example: [`turn.upsert.json`](examples/turn.upsert.json).

| CAOC field | DKS field |
|---|---|
| `ato_day` (8) | turn `number` (**seen**) |
| `ato` (`AH`) | turn `atoDayCode` (**seen**: free text, e.g. "ATO XB - Day 2"); send `"ATO AH"` |
| `period` (`0600Z–0559Z`), `windowStart`, `windowEnd` | turn `windowStart` / `windowEnd` (**seen**) |
| `guidance` (AOD summary line) | turn `guidance` (**seen**) |

### 4.3 `agencies.upsert`: ACP, the theater layer, with PUBLISH when the ACP changed
One item per Comm Plan channel that has a frequency. Key: `acp:<channel>`. Example:
[`agencies.upsert.json`](examples/agencies.upsert.json). This is DKS **Manage Agencies**, **locked**.

| CAOC field | DKS field |
|---|---|
| `role` (`C2 / AWACS`) | agency `name` (**seen**: "ASOC") |
| `callsign` (`DARKSTAR`; empty for some channels) | agency `shortname` (**seen**: "CHAOS") |
| `channel` (`WHITE 3`) | agency `description` (**seen**: "Purple 1") |
| `net` (`TAC ADMIN`) | `description` (append) |
| `freq` (`295.000`), `band` (`UHF`) | agency `frequency` and `frequencies.{UHF\|VHF\|FM}` (**seen**) |
| `volatile` (true for tanker / JTAC channels) | none (CAOC-side warning only) |

### 4.4 `airspace.upsert`: the ACO, with PUBLISH when the ACO changed
Every ACO measure and theater-map shape, **including AR tracks and AWACS / HVAA orbits** (the airspace a support asset
flies, not the asset). Key: `aco:<name>` (ACO measure) or `map:<id>` (theater map shape). Example:
[`airspace.upsert.json`](examples/airspace.upsert.json). **Locked.** Never written into the `.miz`.

| CAOC field | DKS field |
|---|---|
| `name` (`CAP KNIFE`) | graphic `name` (**seen**) |
| `type` (`CAP`, `Kill Box`, `ROZ`, `FLOT`, `FSCL`, `MRR`, `AR Track`, `HVAA Orbit` …) | graphic `kind` (**seen**: `airspace_boundary`); keep `type` in `description` until DKS has kinds (Q7) |
| `track { arcp, heading, lengthNm, widthNm }` (AR tracks) | `points` (the leg); the rest in `description` (**guess**) |
| `geometry { shape: area\|circle\|line, points[], radiusNm }` | `shape`, `points[{lat,lng}]`, `radiusNm` (**seen**) |
| `alt`, `altLoFt`, `altHiFt`, `time`, `ctrl` | `description` (**guess**; DKS has no fields for these yet, Q7) |
| `color` (CAOC colour name) | `color` hex (**seen**); the CAOC sends both |

### 4.5 `support_assets.upsert`: the tanker, AWACS and carrier UNITS, with PUBLISH
The support assets themselves: each tanker (one item per unit, with its boom / drogue role), each AWACS, each carrier.
Their tracks and orbits are airspace (§4.4); each asset names the station it flies with `station` (that airspace's
`sourceId`). Key: `line:<msn>` for an ATO line (tanker, AWACS), `ship:<hull>` for a carrier. Example:
[`support_assets.upsert.json`](examples/support_assets.upsert.json). **Locked.**

| CAOC field | DKS field |
|---|---|
| `kind` (`tanker` \| `awacs` \| `carrier`) | overlay support asset `type` (**seen**: `tanker`, `awacs`, `carrier`) |
| `role` (`BOOM` \| `DROGUE` \| `MPRS` \| `AWACS`) | `supportAssets[].role` (**seen**: `BOOM`, `DROGUE`, `AWACS`) |
| `callsign` (`TEXACO 1`; a carrier's name) | `callsign` (**seen**) |
| `aircraft` (`KC-135`) or `hull` (`CVN_71`) | `variant` / `aircraftType` (**seen**) |
| `line` (ATO mission number) | none (in `description`) |
| `freq`, `band` | `frequency` (**seen**) |
| `tacan { channel, mode, ident }` | `tacan` string, e.g. `"41Y"` (**seen**) |
| `icls` (carriers) | none yet (**guess**, Q8) |
| `station` (`aco:AR TRACK ALPHA`, `map:m5`) | link to the airspace graphic (**guess**); DKS `trackPoints` come from the asset's `.miz` route |
| `altLoFt`, `altHiFt` (planned orbit band) | `altitude` (**seen**, one value; the CAOC sends the band) |
| `speedKcas` (300; KC-130 100) | `speed` (**seen**, unit unclear, Q8) |
| `onStation` (`0630Z`) | none (in `description`) |

### 4.6 `points.upsert`: navigation, spider and destination points, with PUBLISH
Key: `map:<id>`. Example: [`points.upsert.json`](examples/points.upsert.json). DKS preset points (**seen**: `name`,
`latitude`, `longitude`, `elevation`). The point `kind` (`NAV`, `SPIDER`, `DEST`) goes in `description` (Q1).

### 4.7 `targets.upsert`: the JIPTL and its aimpoints, with PUBLISH
Key: `jiptl:<targetId>`, DPIs `dpi:<targetId>/<dpiId>`. Example: [`targets.upsert.json`](examples/targets.upsert.json).
**Locked.**

| CAOC field | DKS field |
|---|---|
| `targetId` (`T10001`) | target `targetNumber` (**seen**, integer: send 10001) and the name prefix |
| `name`, `category` | `name`, `category` (**seen**) |
| `lat`, `lng`, `elevFt` (converted from the CAOC's DDM/MGRS `loc`) | `latitude`, `longitude`, `elevationFeet` (**seen**) |
| `mgrs` | `description` |
| `rank`, `aboveCutLine`, `grade`, `keyTask` | turn JIPTL entry `rank`, `aboveCutLine` (**seen**); target `objectiveId` = key task (**seen**) |
| `effect` (`Destroy`), `effectDetail` | `desiredEffect`, `effectDetail` (**seen**) |
| `restriction` (CDE / collateral) | `restrictionNote` (**seen**) |
| `listStatus` (`jtl`, `rtl`, `retired`) | `listStatus` (**seen**) |
| `dmpi { lat, lng }` (reference only, never an aimpoint) | theater DMPI (**seen**) |
| `dpis[] { dpiId, desc, lat, lng, elevFt, weapon }` | DMPI `dpis[]`: `weaponeeringNotes` = weapon (**seen**) |
| `assignedLines[]` (ATO lines striking it) | DPI `assignedFlightCallsign` (**seen**); also brief §4.7 "Assign Target" |

### 4.8 `assessments.upsert`: BDA, after the host's debrief
Key: `bda:<targetId>/<ato_day>`. Example: [`assessments.upsert.json`](examples/assessments.upsert.json).

| CAOC field | DKS field |
|---|---|
| `status` (`Destroyed`, `Moderate damage` …) | `lastAssessment.physical` (**seen**) |
| `reattack` (Yes/No) | `recommendation` (`reattack` \| `close`) (**seen**) |
| `notes` | `summary` (**seen**) |

### 4.9 `kneeboard.upsert`: SPINS Addendum A, with PUBLISH (released SPINS only)
One page per ATO from the current one, a week ahead. Key: `kneeboard:addendum-a/<ato>`. Example:
[`kneeboard.upsert.json`](examples/kneeboard.upsert.json). **Locked.** Each page comes as data (`aet`, `ramrod`) and
as a rendered image (`pageUrl`, PNG), because DKS squadron documents are page images (**seen**: `AET-101.png`).

### 4.11 `packages.upsert`: supported assets, the package each flight belongs to, with PUBLISH (proposed)
The package composition from the MAAP: which ATO lines fly together, in which role, against which targets, at which
push and TOT, and which support assets serve them. **Only the composition goes**; the MAAP document stays internal.
Key: `package:<name>`. Example: [`packages.upsert.json`](examples/packages.upsert.json). **Locked.** DKS has packages of
flights (**seen**) but no "supported assets" object was found (Q17).

| CAOC field | DKS field |
|---|---|
| `name` (`A`) | package name (**seen**) |
| `push`, `tot` | none (in `description`), or the package timeline (**guess**) |
| `targets[]` (JIPTL ids) | the targets of §4.7 |
| `lines[] { msn, callsign, role, packageRole }` (`packageRole`: strike, SEAD, escort, tanker …) | the package's flights (**seen**) |
| `support[] { sourceId }` (support assets serving the package) | `supportAssets` (**seen**) or a supported-assets link (Q17) |
| `notes` | `description` |

### 4.10 `flight.create` / `flight.update` / `flight.remove`: on commit, CAOC change, release or cancel
Key: `line:<msn>`. Examples: [`flight.create.json`](examples/flight.create.json),
[`flight.remove.json`](examples/flight.remove.json). The CAOC creates the flight in the campaign's current turn once a
squadron has committed (Discord → CAOC). DKS returns its flight id, which the CAOC stores on the line.

| CAOC field (locked) | DKS field |
|---|---|
| `msn` (`8115`), `role` (`SEAD`), `package` | flight `missionType` (**seen**); `msn` and `package` in the name / notes (Q10) |
| `squadron` (the committed group) | flight's squadron / `flownBySquadronId` (**seen**) |
| `aircraft` (`F-16C`), `num` (2) | `aircraft` / `plane` (**seen**), members count |
| `callsign` (CAOC-assigned, may be `TBD`) | `callsign` (**seen**); the squadron may set it if `TBD` |
| `vul` (`1058Z`), `target` / `area` | target from §4.7; vul window in notes (**guess**) |
| `tanker` (`TEXACO 1`) | tanker plan (**seen**: `inheritanceConfig.tanker`) |
| `members[] { seat, mode1, mode2, mode3, stn, sadlTn, idm }` | members `mode3`, `stn`, `sadl` (**seen**) |
| `agencies` | the campaign agencies (§4.3) |

`flight.update` sends only changed CAOC fields. `flight.remove` (line released or cancelled) removes the flight, or
marks it inactive if it has planning in it (Q10). If DKS is unreachable the CAOC queues the message and retries; the
`sourceId` makes a retry safe.

## 5. DKS → CAOC messages

### 5.1 `flights.readback`: DKS answers a read, or pushes `flight.changed`
The CAOC reads the turn's flights when a flight changes (webhook, preferred) or on a schedule, and always at **T-3h** for
the final ATO. Example: [`flights.readback.json`](examples/flights.readback.json). **Send every field you have.** The
CAOC puts them on the ATO next to its own.

Per flight: `dks_flight_id`, `sourceId` (`line:<msn>`), `callsign`, `aircraft`, `tailNumbers[]`, `members[] { seat,
callsign, pilot, mode3, stn, sadl }`, `loadout[]`, `route[] { n, name, lat, lng, altFt, tot }`, `push`, `tot`,
`updatedAt`, `version`.

**Drift**: if a CAOC-locked value comes back different (say `mode3`), the CAOC keeps its own value on the ATO, shows the
difference on its Dashboard and tells that squadron's Discord channel. A locked value never silently changes the ATO.

### 5.2 `change.request`: a planner asks for a locked value to change
From a "request a change" action on any CAOC-locked value. Example:
[`change.request.json`](examples/change.request.json). The CAOC answers by changing its document and re-sending (the
next `.upsert` or `flight.update`). DKS never applies the change itself.

### 5.3 Personnel recovery
`pr.ejection` and follow-ups: see `docs/PR_DKS_Integration.md` (unchanged).

## 6. Locking and drift (what keeps DKS and the documents the same)

1. **Lock** (needs DKS): any item with `provenance.locked: true` is read-only for planners and shows its `version`.
   DKS already locks theater overlays (`isLocked`, **seen**) and lets flight sections inherit from the package or go
   custom (`inheritanceConfig`, **seen**). The ask is one level above the package, `caoc`.
2. **Re-assert** (CAOC): every PUBLISH and the T-3h final read re-send all CAOC-owned values.
3. **Drift report** (CAOC, needs §5.1): differences on locked fields are flagged, never adopted.
4. **Version stamps**: every locked value and kneeboard page names its CAOC release.
5. **Change requests** (§5.2). The SPINS direct: "CAOC-assigned IFF/SIF codes, STNs and frequencies (ATO, JCEOI and
   Comm Plan) will not be changed. Changes will be requested from the CAOC."

## 7. Timing

| When | What | Message |
|---|---|---|
| Campaign accepted | DKS campaign created | `campaign.upsert` |
| PUBLISH, NLT T-72h | full pre-fill | `campaign`, `turn`, `agencies`, `airspace`, `support_assets`, `points`, `targets`, `packages`, `kneeboard` `.upsert` |
| Squadron commits (any time) | flight created | `flight.create` |
| Planner edits a flight | CAOC told | `flight.changed` → `flights.readback` |
| **T-3h, automatic** | final ATO from DKS, posted to Discord and Op Status | read → `flights.readback` |
| After the host's debrief | BDA | `assessments.upsert` |
| Cycle to next ATO | next turn | `turn.upsert` |
