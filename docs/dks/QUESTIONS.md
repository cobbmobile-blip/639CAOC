# Questions for DKS

Answer under each question (or open a PR against this file). `CONTRACT.md` refers to these by number. Status:
**open** until answered.

| # | Topic | Question | Status |
|---|---|---|---|
| Q1 | Points | Which DKS section should NAV, SPIDER and DEST points and THREATs (with range rings) go to? Preset points, the theater overlay, or another section? | open |
| Q2 | API | Can the CAOC create and update DKS campaign objects through an API (turns, agencies, graphics, support assets, preset points, targets / JIPTL, DMPIs, flights, kneeboard pages)? How does it authenticate (boards carry an `importPartnerId`)? Is there a sandbox to test against? | open |
| Q3 | Provenance | Will DKS store `provenance` (`sourceType: "caoc"`, `sourceId`, `version`, `locked`) on every object, treat a repeat `sourceId` as an update, and remove CAOC objects missing from a full `.upsert` set? | open |
| Q4 | Locking | Can items with `locked: true` be read-only for planners, an inheritance level above the package (`caoc`), shown with their `version` ("per ACP v4"), with a "request a change" action that sends `change.request`? | open |
| Q5 | Squadrons | Can one DKS campaign hold flights from several squadrons of different groups (designs have a `coalitionId`)? If not, should the CAOC create one DKS campaign per squadron, each pre-filled the same? | open |
| Q6 | Flights | Can the CAOC create a flight in a campaign's current turn with members' Mode 3, STN and SADL filled, and get the DKS flight id back? | open |
| Q7 | Airspace | Can battlefield graphics take an ACO type (CAP, kill box, ROZ, FLOT, FSCL, MRR …), altitude limits and active times as fields? Until they can, the CAOC puts them in `description`. | open |
| Q8 | Support assets | Units for support asset `speed` and `altitude`: KCAS, TAS or ground speed? A single altitude, or can it take a band (FL220–FL240)? The CAOC plans tankers at 300 KCAS (KC-130 100). | open |
| Q9 | Read-back | Can the CAOC read a turn's flights with every planned field (`flights.readback`)? Can DKS push `flight.changed` (webhook) when a planner edits a flight, so the CAOC doesn't poll? | open |
| Q10 | Flight fields | Where should the CAOC's mission number, package and vul (TOT) go on a DKS flight? On `flight.remove`, should a flight with planning in it be deleted or marked inactive? | open |
| Q11 | Kneeboards | SPINS Addendum A: does DKS want the page data (`aet`, `ramrod`), the rendered PNG, or both? Which kneeboard section? | open |
| Q12 | Discord | DKS campaigns post their own Discord events (FRAGO issued, turn published). Should those stay off for CAOC campaigns? The CAOC posts the ATO, the final ATO at T-3h and the host's `.miz` change log. | open |
| Q13 | .miz | DKS regenerates a `.miz` per turn. Could that file carry late DKS additions after the host's final build (T-24h), or does the host keep building the `.miz` by hand? | open |
| Q14 | Assign Target | When `targets.upsert` lists `assignedLines`, can DKS show the target (and its DPIs) already assigned in that flight's "Assign Target"? (Brief section 4.7.) | open |
| Q15 | Target numbers | DKS `targetNumber` is an integer; CAOC target ids are `T10001`. Is sending 10001 with the name prefixed "T10001" acceptable? | open |
| Q16 | Personnel recovery | Unchanged from `docs/PR_DKS_Integration.md`: can DKS Debrief send `pr.ejection` (seat / parachute position, player name), and load a `pr.csar_route` as spider points? | open |
