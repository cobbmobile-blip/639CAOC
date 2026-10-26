# Personnel recovery: DKS Debrief ↔ vCAOC PRCC

How a pilot ejection in DCS reaches the vCAOC's Personnel Recovery Coordination Cell (PRCC), and what the site sends back
to DKS and to Discord. The prototype implements the site side (`prcc.html`, `js/pr.js`); every outbound event is
recorded in `db.discordOutbox` until the real integration exists.

## Flow

1. **Report.** DKS Debrief logs an ejection and posts a `pr.ejection` event to the site.
2. The site opens a PR incident (`PR-001`, …) and matches it to:
   - the ATO line, by `aircraft.msn`;
   - the pilot's ISOPREP, by `pilot.player_name`, else by callsign within the group;
   - the SPINS release in force at `takeoff_utc` (the site keeps every release).
3. The PRCC works the incident:
   - **Locate & authenticate:** the survivor's codes and their ISOPREP.
   - **Support:** threats, the CSAR comm plan and the survivor's EPA.
   - **Recover:** retask ATO lines or request new ones; build the route from spider points.
   - **Reintegrate:** record the outcome.
4. The site sends `pr.csar_route` to DKS, `ato_line.open` for each requested human line (the existing ATO contract, see
   `ATO_Discord_Integration.md`), and `pr.csartf_package` to the groups flying the rescue.

## DKS → site

### `pr.ejection`

`POST /api/pr/ejections` — one event per crew member who leaves the aircraft. A two-seat jet sends two events.

```json
{
  "event": "pr.ejection",
  "event_id": "dks-8f3c2a",
  "source": "DKS Debrief",
  "campaign_id": "iron-trident",
  "operation": "IRON TRIDENT",
  "time_utc": "2026-10-20T07:21:40Z",
  "takeoff_utc": "2026-10-20T06:05:00Z",
  "base": "Kobuleti",
  "pilot": { "callsign": "VIPER 11", "player_name": "Sabre", "group_id": "g1", "seat": "pilot" },
  "aircraft": { "type": "F-16C", "msn": "8101", "flight": "VIPER 1" },
  "position": { "lat": 42.24433, "lon": 42.74462, "alt_ft": 14500 },
  "status": "ejected",
  "chute": true,
  "injury": "",
  "cause": "Hit by SAM near T10001"
}
```

| Field | Required | Notes |
|---|---|---|
| `event_id` | yes | Unique per ejection; a repeat is rejected as already received. |
| `campaign_id` or `operation` | yes | The site campaign id, else the operation name. |
| `time_utc`, `takeoff_utc` | yes | ISO 8601 UTC. The take-off time chooses the SPINS release the crew flew with. |
| `pilot.player_name` | yes | The DCS player name; it matches the pilot's ISOPREP. |
| `pilot.callsign`, `pilot.group_id` | yes | The flight member callsign (VIPER 11) and the site group id, if DKS knows it. |
| `aircraft.msn` | yes | The ATO mission number the flight flew under. |
| `position.lat/lon` | yes | WGS84 decimal degrees, from the DCS ejection event (seat/parachute), not the wreck. |
| `status` | no | `ejected` \| `crashed` \| `landed_out` \| `ditched`. |
| `chute`, `injury`, `cause` | no | What DKS saw; shown to the PRCC. |

Responses: `201 { incident_id }`, `409 already_received`, `404 unknown_campaign`, `422 no_position`.

### Optional follow-ups (planned)

- `pr.position_update` `{ event_id, incident_id, lat, lon, source }`: the survivor's chute landed, or a player marked
  them on the F10 map.
- `pr.status` `{ event_id, incident_id, status: "picked_up" | "captured" | "killed" | "landed_friendly" }`: DKS saw the
  survivor board a rescue helicopter, etc. The PRCC still records the outcome.

## Site → DKS

### `pr.csar_route`

The CSAR route as **spider points**, in order. The survivor's position is the objective point.

```json
{ "event": "pr.csar_route", "incident_id": "PR-001", "campaign_id": "iron-trident", "name": "PR-001 CSAR",
  "points": [ { "seq": 1, "name": "SPIDER 1", "lat": 42.32, "lon": 42.52, "dks_section": "Spider points", "role": "" },
              { "seq": 2, "name": "VIPER 11 (survivor)", "lat": 42.24433, "lon": 42.74462, "dks_section": "Spider points", "role": "objective" } ] }
```

### `pr.csartf_package`

The CSAR task force package as text, its version, the route, and the groups that should get it: every group flying a
tasked element. The package carries the survivor's ISOPREP answers for the rescue force, so the bot should post it only
to those groups' leads, not to a public channel.

## What the pilot needs (SPINS section 5, generated for every campaign)

| Item | What it is for |
|---|---|
| **Word / letter / number of the day** | Authentication. They change with the ATO day; rescue forces challenge, the survivor answers only what is asked. |
| **SARNEG** | A 10-letter word with no repeated letter. Its letters stand for the digits 0–9, so a grid can go out without giving it away. Example: with DOWNSTREAM, grid 1392 5793 is sent as ONMW TEMN. |
| **SARDOT** | A reference point. The survivor reports a bearing in degrees true and a range in NM from it, never from bullseye. |
| **Duress word** | Said in any call, it means the survivor is under hostile control. |
| **ISOPREP** | Four personal statements and a 4-digit number. Filed by the pilot's group on the unit portal; the PRCC and the rescue force use them to confirm identity. |
| **EPA** | The crew's evasion plan for that mission: initial movement, hide site, travel, destination or DAR/SAFE area, contact plan, signals. Filed per ATO line on the unit portal; without one the standard EPA in the SPINS applies. |
| **PR frequencies and contact schedule** | Guard for the initial call, then the PR primary and alternate from the Comm Plan's rescue net. Listen on the hour and half hour. |
| **Signals** | How to mark: mirror or smoke by day, IR strobe then flare at night, only when the rescue force asks. |
