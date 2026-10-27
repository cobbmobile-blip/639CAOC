# ATO line requests ↔ Discord — integration contract

How the vCAOC site and the existing CAOC Discord bot work together to fill ATO lines.
The site side is prototyped in `js/ato.js` (`AOC.ATO`) and `ato-request.html`; this document is the contract the
bot needs. Names below are proposals — adjust to match the bot that's already been tested.

## Flow

1. The campaign's **Group JFACC / LNO** (the host) creates ATO lines on `ato-request.html` — from their group's `.miz`
   (player slots become **Human** lines, other flights **AI**) or with the Create an ATO line form.
2. Each **Human** line starts as a `draft`: not on the ATO, nothing posted. The host can **Edit** or **Remove** it.
   When it is right the host presses **Post to Discord** (or "Post all drafts"); the line becomes `open`, goes on the
   ATO, and the site emits **`ato_line.open`** to the bot with the list of recipient groups: every *active registered
   group* whose registered airframes include the line's airframe. **AI** lines go straight onto the ATO; nothing is
   posted. Nothing reaches Discord until the host posts it.
3. The bot posts the line to each recipient group's channel with a **Commit** button.
4. A member of a recipient group presses **Commit** → the bot calls the site's **commit** endpoint.
   **First commit wins.** The site marks the line `committed`, sets that group as the tasked unit on the ATO,
   adds the group to the campaign if it wasn't already, and emits **`ato_line.filled`**.
5. The bot edits every copy of the post: "Filled by <group>", Commit disabled.
6. The Group JFACC sees the line as filled on `ato-request.html` and on Op Status (`unit.html`); CAOC staff see it on
   the dashboard's *ATO line requests* panel and on the ATO.

The JFACC can **cancel** an open line (→ `ato_line.cancelled`) or **release** a commitment, which re-opens the line and
emits a fresh `ato_line.open` (same `line_id`) so the bot re-enables Commit.

## Site → bot events

### `ato_line.open`

```json
{
  "event": "ato_line.open",
  "line_id": "L8601",
  "campaign_id": "iron-trident",
  "operation": "IRON TRIDENT",
  "ato_day": 8,
  "ato": "AH",
  "msn": "8601",
  "airframe": "F-15E",
  "aircraft": 4,
  "mission": "Strike",
  "crew": "Human",
  "tot": "0722Z",
  "target": "T10005",
  "package": "A",
  "callsign": "RUNNER 1",
  "base": "Ramp",
  "notes": "Pkg A Strike Eagles",
  "commit_by": "211800Z OCT 26",
  "requested_by": { "group_id": "g1", "group": "Viper Ops Group", "jfacc": "SABRE" },
  "recipients": [ { "group_id": "g3", "group": "Strike Eagle Det" }, { "group_id": "g9", "group": "Ridgerunner Det" } ],
  "components": [ { "type": "button", "label": "Commit", "style": "success", "custom_id": "ato_commit:L8601" } ]
}
```

### `ato_line.filled` / `ato_line.cancelled`

```json
{
  "event": "ato_line.filled",
  "line_id": "L8601",
  "msn": "8601",
  "filled_by": { "group_id": "g9", "group": "Ridgerunner Det", "user": "RUNNER" },
  "recipients": [ { "group_id": "g3" }, { "group_id": "g9" } ]
}
```

`ato_line.cancelled` has the same shape with `filled_by: null`.

## Squadron line requests

Any participating squadron other than the host can ask the host for a line on its Op Status page (`unit.html`, "Request
a line"), with the same questions as the host's "Create an ATO line". The site records the request (`pending`) and emits
`ato_line.requested`; the bot posts it to the **host's** registered channel with **Approve** and **Deny** buttons.
The host decides there or on `ato-request.html`. An approved request becomes an ATO line assigned to the requesting
squadron (a Human line is not posted for commitment; it is already theirs); a denied one carries the host's reason.
Either way the site emits `ato_line.request_decided` and the bot tells the requesting squadron.

```json
{
  "event": "ato_line.requested",
  "request_id": "Rmh3k2x9ab",
  "campaign_id": "iron-trident",
  "operation": "IRON TRIDENT",
  "ato_day": 8,
  "ato": "AH",
  "requested_by": { "group_id": "g2", "group": "Hornet Bay vCVW", "user": "Rhino" },
  "airframe": "F/A-18C", "aircraft": "2", "mission": "SEAD", "crew": "Human", "tot": "1100Z", "target": "T10001",
  "pkg": "B", "callsign": "SPRINGFIELD 3", "base": "CVN-71", "commit_by": null, "notes": "Extra SEAD pair for Pkg B",
  "recipients": [ { "group_id": "g1", "group": "Viper Ops Group", "host": true } ],
  "components": [
    { "type": "button", "label": "Approve", "style": "success", "custom_id": "ato_req_approve:Rmh3k2x9ab" },
    { "type": "button", "label": "Deny", "style": "danger", "custom_id": "ato_req_deny:Rmh3k2x9ab" }
  ]
}
```

```json
{
  "event": "ato_line.request_decided",
  "request_id": "Rmh3k2x9ab",
  "campaign_id": "iron-trident",
  "approved": true,
  "reason": null,
  "msn": "8606",
  "decided_by": "SABRE",
  "recipients": [ { "group_id": "g2", "group": "Hornet Bay vCVW" } ]
}
```

Bot → site, when the host presses a button (only a member of the host group may decide; Deny should open a modal for the
reason):

```
POST /api/line-requests/{request_id}/approve   { "discord_user_id": "…", "discord_username": "SABRE" }
POST /api/line-requests/{request_id}/deny      { "discord_user_id": "…", "discord_username": "SABRE", "reason": "…" }
```

| Result | HTTP | Body |
|---|---|---|
| Decided | 200 | `{ "ok": true, "request": { … } }` |
| Already decided | 409 | `{ "ok": false, "error": "request_approved" }` or `request_denied` |
| Unknown request | 404 | `{ "ok": false, "error": "unknown_request" }` |

## Bot → site: commit

Button `custom_id` is `ato_commit:<line_id>`. On press, the bot resolves which registered group the Discord user
belongs to (from the group registration — e.g. guild/role → `group_id`) and calls:

```
POST /api/ato-lines/{line_id}/commit
{ "group_id": "g9", "discord_user_id": "…", "discord_username": "RUNNER" }
```

| Result | HTTP | Body |
|---|---|---|
| Committed | 200 | `{ "ok": true, "line": { … } }` |
| Already filled | 409 | `{ "ok": false, "error": "already_committed", "committedBy": "g3" }` |
| Group doesn't fly that airframe | 422 | `{ "ok": false, "error": "airframe_mismatch" }` |
| Line cancelled / AI | 409 | `{ "ok": false, "error": "line_cancelled" }` |
| Unknown line or group | 404 | `{ "ok": false, "error": "unknown_line" }` / `unknown_group` |

The bot should answer the button press ephemerally with the result (e.g. "Line 8601 is yours" / "Already filled by
Strike Eagle Det"). The prototype implements exactly this logic in `AOC.ATO.commit(lineId, groupId, user)`; the
request page's *Discord post* preview has "Commit as <group>" buttons that call it, standing in for the bot.

## Data the site keeps per line

`id, cid, msn, airframe, num, role, crew (Human|AI), tot, target, pkg, callsign, base, notes, commitBy,
source (.miz name or "Request form"), mizGroup, requestedBy (group), requestedByUser (JFACC), recipients[],
status (open | committed | ai | cancelled), postedAt, committedBy, committedAt, committedByUser`.

## Airframe matching

Lines carry the airframe name groups register with (`F-15E`, `F/A-18C`, `A-10C II`, `AH-64D` …). `.miz` unit types
are mapped to those names (`F-15ESE` → `F-15E`, `FA-18C_hornet` → `F/A-18C`, `A-10C_2` → `A-10C II` …) in
`DCS_AIRFRAMES` in `js/ato.js`. Matching ignores spaces, dashes and slashes.

## PUBLISH product post (`package.posted`)

When the CFACC or CFC presses **PUBLISH** on the Dashboard (with the Discord post ticked, the default), the site emits one
`package.posted` event. The bot posts it to the registered channel of every recipient: the host unit (the campaign
JFACC's group, flagged `host: true`) and every active participating group, using the same group registration it uses for
ATO lines. No channel is set per campaign.

The post goes out with every PUBLISH, whatever products the host asked for: the ATO is always produced, so a campaign
that wants only the ATO still gets the post, with the ATO alone in the zip. The post carries **one attachment, the pilot
package**: a zip of printable HTML pages, `00_INDEX.html` then one page
per document in order: CI, AOD, ATO, SPINS, SPINS Addendum A, ROE, Comm Plan, ACO, OPTASKLINK, and the TDPs of the
targets the released ATO strikes with INT lines, each only when the host asked for it. Internal staff products (Planning Conference, JIPTL, MAAP, BDA) are
never in it. `change` is `new` (first release), `changed` (released in this PUBLISH) or `unchanged`. The bot builds the
zip with the site's `AOC.PACKAGE.packageZip(campaign_id)` (or receives it from the backend) and attaches it to one
message; the same zip downloads from the Dashboard and from Op Status.

```json
{
  "event": "package.posted",
  "campaign_id": "iron-trident",
  "operation": "IRON TRIDENT",
  "ato_day": 8,
  "ato": "AH",
  "package": 5,
  "published_at": "2026-10-24T18:00:00Z",
  "published_by": "OVERLORD",
  "title": "OP IRON TRIDENT — PUBLISH v5 · ATO AH",
  "content": "**OP IRON TRIDENT — PUBLISH v5 · ATO AH**\n• CI v1\n• ATO v4 — **CHANGED**\n• SPINS & ROE v3\nIn DKS: Overlay v2\nPilot package attached (zip). Also on Op Status.",
  "recipients": [ { "group_id": "g1", "group": "Viper Ops Group", "host": true }, { "group_id": "g2", "group": "Hornet Bay vCVW", "host": false } ],
  "products": [ { "product": "ato", "code": "ATO", "name": "Air Tasking Order", "version": 4, "change": "changed", "files": ["03_ATO_v4.html"] } ],
  "dks": ["Overlay v2"],
  "op_status": "unit.html",
  "attachment": { "filename": "OP_IRON_TRIDENT_ATO_AH_PUBLISH_v5.zip", "documents": ["00_INDEX.html", "01_CI_v1.html", "02_AOD_v1.html", "03_ATO_v4.html", "04_SPINS_v3.html", "05_SPINS-ADD-A_v3.html", "06_ROE_v3.html", "07_ACP_v1.html", "08_ACO_v2.html"] }
}
```

`op_status` is the Op Status page; production should send its absolute URL. The prototype records the event in
`db.discordOutbox` with the zip's name and contents list, not the zip (it is rebuilt from the released versions; the
Dashboard's **Discord post** button shows the post and downloads the zip).

## Host .miz change log (`miz.changes`)

What the host JFACC must change in their `.miz` to match the CAOC's documents (built by `js/mizlog.js`). The bot posts
it to the **host's registered channel** only, never to the other groups. It is sent after a `.miz` upload that changes
the log and with PUBLISH (when ticked). `content` is the log as text (also attached as a `.txt`), headed by the T-24h go/no-go (GO / NO-GO and why): items marked `[NEW]`
since the last post, a FIXED section for what the new version fixed, the checks that passed and any that could not run.

```json
{
  "event": "miz.changes", "campaign_id": "iron-trident", "operation": "IRON TRIDENT", "ato": "AH", "log": 2,
  "reason": "host mission file v5",
  "mission_file": { "version": 5, "name": "iron_trident_viper.miz" },
  "recipients": [ { "group_id": "g1", "group": "Viper Ops Group", "host": true } ],
  "counts": { "add": 3, "set": 1, "fix": 2, "remove": 0 }, "new": 1, "fixed": 3,
  "title": "OP IRON TRIDENT — .miz change log #2",
  "content": "MIZ CHANGE LOG #2 — OP IRON TRIDENT — ATO AH\nAgainst host mission file v5 …\n\nREQUIRED ADDITIONS\n  ADD    8115 2× F-16C SEAD …",
  "attachment": { "filename": "OP_IRON_TRIDENT_MIZ_CHANGES_2.txt" }
}
```

An **Acknowledge** button on the post should call back with `{ "campaign_id", "log", "by" }` (the site records it as
`campaign.mizLog.ack`, the same as the mission file page's button). Items are not ticked off: they close when the next
`.miz` upload passes the check.

## Not in the prototype yet

- A real backend: the prototype stores lines in the browser and records outgoing events in `db.discordOutbox`.
- Commit deadlines (`commit_by`) are shown but not enforced; an expiry job could re-post or escalate unfilled lines.
- A withdrawal window for the committing unit (the JFACC can release a commitment today).

## Lines the PRCC requests

The PRCC (`prcc.html`) requests rescue-force lines through the same `ato_line.open` event. They have `source: "PRCC"`,
`package: "CSAR"`, a target such as `"PR-001 survivor"`, mission types including `RESCORT`, `SARCAP`, `CSAR`, `SEAD`, and
`requested_by: { "group_id": "", "jfacc": "<callsign> (PRCC)" }` — no requesting group. The airframe is one an active
group flies (e.g. MH-60L → the 55th RQS); commits work as for any line. Human rescue lines need the same first-commit-wins
handling; AI lines (HC-130 King, AWACS, ISR, tanker) are not posted.

