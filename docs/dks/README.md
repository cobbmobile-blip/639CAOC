# CAOC ↔ DKS integration — start here

This folder is written for the DKS developer and for the Claude that works on DKS with him. It is the
integration contract between the **639 vCAOC website** (this repo) and **Digital Kneeboard Simulator (DKS)**. Read it
in this order:

| File | What it is |
|---|---|
| [`CONTRACT.md`](CONTRACT.md) | The contract: roles, the data flow, every message (direction, trigger, key, fields → DKS field), locking and drift rules. |
| [`ownership.json`](ownership.json) | Machine-readable: who owns each piece of data (CAOC or the squadron in DKS) and whether DKS must lock it. |
| [`schemas/caoc-dks.schema.json`](schemas/caoc-dks.schema.json) | JSON Schema (draft 2020-12) for every message, one `$defs` entry each. |
| [`examples/`](examples/) | One example payload per message, with real values from the demo campaign (OP IRON TRIDENT, Caucasus) where it has them (a `$comment` marks the illustrative ones). They validate against the schema. |
| [`QUESTIONS.md`](QUESTIONS.md) | What the CAOC needs DKS to confirm or build, numbered. Answer in place. |
| [`validate.py`](validate.py) | `python docs/dks/validate.py` checks every example against the schema (no dependencies). Run it after changing either. |

Older, wider context (not needed to build the integration): `docs/vCAOC_Process_for_DKS.txt` (the full process brief;
its section 4.9 is the same contract in prose), `docs/ATO_Discord_Integration.md` (the Discord bot contract),
`docs/PR_DKS_Integration.md` (personnel recovery: DKS Debrief ejections → the CAOC's PRCC).

## The idea in five lines

1. **The CAOC manages the mission** for the JFACC: it builds the missions and ATO lines, shares them with squadrons from
   many groups, and owns the base documents (ACP, ACO, JCEOI, IFF/SIF, JIPTL, target folders, SPINS, ROE).
2. **DKS is where flights plan.** It is the flights' main interface. The CAOC **pre-fills** the DKS campaign so crews
   have the data at once, and those CAOC values are **locked** in DKS.
3. A squadron commits to an ATO line (Discord). **The CAOC creates the flight in DKS**; the squadron plans it there.
4. **The CAOC reads the planned flights back** from DKS onto its ATO. The final ATO goes out automatically at T-3h.
5. The SPINS, ROE and Commander's Intent **do not go to DKS** (crews read them outside the mission). Only SPINS
   Addendum A (the AET table and the RAMROD per ATO) goes to DKS kneeboards.

## Ground rules for whoever implements this

- **CAOC names are canonical.** Payloads use the CAOC's field names, which are real-world correct. Each field's DKS
  destination is listed in `CONTRACT.md`. Map on the DKS side, or tell us the field you want and we add it to the
  payload; we don't rename or drop CAOC fields to fit DKS.
- **Every item carries provenance**: `sourceType: "caoc"`, a stable `sourceId`, the CAOC product `version`, and
  `locked`. A repeat `sourceId` is an **update**, never a duplicate. DKS already has `sourceType`/`sourceId` on threats
  and DMPIs, which is where this came from.
- **Units are fixed** (see "Conventions" in `CONTRACT.md`): WGS84 decimal degrees, feet MSL, MHz strings, ISO-8601 UTC,
  ATO designators `AA`, `AB` …
- **Status: proposed.** Nothing here is built on either side yet. The CAOC prototype queues its current exports in
  `db.dksOutbox`, and they will move to these shapes once the questions are answered.

The DKS side was seen read-only, as a signed-in squadron user, on 28 Oct 2026. The DKS field names in `CONTRACT.md` come
from that look (marked **seen**) or are guesses (marked **guess**). Correct them in `QUESTIONS.md`.
