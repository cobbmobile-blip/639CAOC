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

When the CFACC or CFC presses **PUBLISH** on the rollup (with "Discord post" ticked, the default), the site emits one
`package.posted` event. The bot posts it to the registered channel of every recipient: the host unit (the campaign
JFACC's group, flagged `host: true`) and every active participating group, using the same group registration it uses for
ATO lines. No channel is set per campaign.

The post carries every released product that is **not** a DKS export: CI, AOD, JIPTL, TDP, MAAP, ATO, SPINS & ROE
(two files), OPTASKLINK, BDA. The ACO and Comm Plan go to DKS (Overlay, Manage Agencies) and are only named in a line.
Each product is a `.txt` file with the same text as the product page's "Download .txt". `change` is `new` (first
release), `changed` (released in this PUBLISH) or `unchanged`. Discord allows ten files per message: send `files` in
`messages` messages, `content` on the first.

```json
{
  "event": "package.posted",
  "campaign_id": "iron-trident",
  "operation": "IRON TRIDENT",
  "ato_day": 8,
  "package": 5,
  "published_at": "2026-10-24T18:00:00Z",
  "published_by": "OVERLORD",
  "title": "OP IRON TRIDENT — PUBLISH v5 · ATO day 8",
  "content": "**OP IRON TRIDENT — PUBLISH v5 · ATO day 8**\n• CI v1\n• ATO v4 — **CHANGED**\n• SPINS & ROE v3\nIn DKS: Overlay v2\nFull set on Op Status. Files attached.",
  "recipients": [ { "group_id": "g1", "group": "Viper Ops Group", "host": true }, { "group_id": "g2", "group": "Hornet Bay vCVW", "host": false } ],
  "products": [ { "product": "ato", "code": "ATO", "name": "Air Tasking Order", "version": 4, "change": "changed", "files": ["IRON_TRIDENT_ATO_D8_v4.txt"] } ],
  "dks": ["Overlay v2"],
  "op_status": "unit.html",
  "messages": 1,
  "files": [ { "filename": "IRON_TRIDENT_ATO_D8_v4.txt", "content": "UNCLASSIFIED // EXERCISE\nAIR TASKING ORDER\n…" } ]
}
```

`op_status` is the Op Status page; production should send its absolute URL. The prototype records the event in
`db.discordOutbox` with each file's name and size instead of its text (the text is rebuilt from the released versions;
the rollup's **Discord post** button shows the post with the files).

## Not in the prototype yet

- A real backend: the prototype stores lines in the browser and records outgoing events in `db.discordOutbox`.
- Commit deadlines (`commit_by`) are shown but not enforced; an expiry job could re-post or escalate unfilled lines.
- A withdrawal window for the committing unit (the JFACC can release a commitment today).
