# JCEOI build

Builds `js/jceoi-data.js` for the site's JCEOI page (`jceoi.html`) and the Comm Plan's JCEOI check.

```
python -I fetch_sources.py      # OurAirports CSVs -> src/ (not committed, ~15 MB)
python -I extract_dcs.py        # in-game ATC + beacons from your DCS install -> data/dcs_<map>.json
python -I extract_pydcs.py      # maps not installed locally (Iraq, Germany CW, Falklands), from pydcs
python -I extract_nttr.py [dir] # Nevada / NTTR pre-decided plan -> data/nttr.json (dir = the CAOC's Nellis_NTTR folder)
python -I build.py              # registers + Blue net plan -> ../../js/jceoi-data.js
```

`build.py` exits non-zero, and writes nothing, if any plan frequency is off its channel grid or within one channel of
anything documented in any theater, or if its frequency policy no longer matches the Comm Plan template.

**The net list is the Comm Plan (ACP) template** — `COMM_TEMPLATE` in `js/products.js`. Change nets, colours or roles
there, then run `build.py`; `python -I build.py --check` tells you whether `js/jceoi-data.js` is still current. The
build stops if a template colour has no UHF slice (or a slice has no colour), if WHITE 1 is no longer TAC COORD
(RAZOR is named there), or if an FM/HF rule names a role the template no longer has. The site also compares
the template it runs with the one the data was built from: if they differ, the JCEOI page shows "Out of date" and new
Comm Plans start without frequencies.

| File | What |
|---|---|
| `theaters.py` | theater keys, DCS data file, map rectangle (S, N, W, E), released / in development |
| `data/dcs_*.json` | in-game ATC radios (HF, VHF-FM, VHF-AM, UHF), nav beacons, TACAN channels |
| `data/military.json` | real-world military frequencies with source and confidence, plus common/standard ones |
| `extract_nttr.py`, `data/nttr.json` | Nevada's pre-decided plan: official NTTR / Nellis assignments (AFMAN 13-212V1 NTTR Add A Att 14; NELLISAFBI 11-250 Att 20, transcribed with table references) and the CAOC's NTTR comm matrix, comm card, tankers and range JTACs (read from NTTR_COMM_PLAN.xlsx and the Playground sheets) |
| `data/iff.json` | IFF/SIF plan: reserved Mode 3/A codes, Mode 3/A slot scheme (block = the line's Mode 1 code), Mode 1 by mission type, Mode 2/4 notes and procedures, theater rules (Nevada). The build checks it (octal, Mode 1 second digit 0–3, every Mode 1 code keeps at least `minSlotsPerCode` slots clear of reserved codes) |
| `data/roe.json` | vCAOC standing ROE for the SPINS & ROE product: general, surface and air ROE text, the CDE levels and rules (ROE) and the ALR levels (SPINS), classification terms, hostile act / intent, enemy indications, weapons control statuses, the campaign measures catalogue (id, group, default on/off) and theater rules. The build checks measure ids are unique and every measure has a group, text and default |
| `data/tdl.json` | OPTASKLINK plan: Link 16 STN reserved ranges (00000, C2 00001–00177, 77777) and excluded blocks, slot scheme, network defaults (F/A-18C channels, F-16C channels, A-10C SADL keys), the SADL TN scheme, the AH-64D IDM presets (flight nets 1–9, common net 10), the ATO day start (0300Z) and the network monikers (the build refuses duplicates). The build checks every reserved range sits in an excluded block |
| `build.py` | reads the ACP template, merges everything, generates the net plan, checks it |

Re-run `extract_dcs.py` after a DCS update or when Balkans / Iraq South / Afghanistan North ship (add their DCS
folder to `THEATERS` in `extract_dcs.py` and their stem in `theaters.py`). Add verified military frequencies to
`data/military.json`; mark anything not checked against an AIP as `unverified`.

**Nevada is a special case.** At the NTTR much of the frequency plan is pre-decided, so the Nevada register also
holds every official NTTR / Nellis assignment (`kind: nttr`), and Nevada campaigns use the CAOC NTTR comm matrix as
their Comm Plan (new plans start from it; the check compares against it and the official assignments; the TACAN scrub
plans tankers from the NTTR tanker table). The JCEOI page's "Nevada (NTTR plan)" tab shows it all with a plan check.
The standard plan is still built clear of the NTTR assignments. Fixed channels are kept even when something documented
sits on them and are listed in `fixedConflicts` (none now: RAZOR moved off 293.500, ROULETTE in Nevada, on 2026-10-22).

The CAOC's 2026-10-22 decisions on its NTTR plan (RAZOR, the preset 5 typo, APOLLO, SNIPER, the JTACs from the range JTAC
sheet, frequencies for AR-230V / AR-231V) are applied in `build.py` (`revise_nttr`) on top of NTTR_COMM_PLAN.xlsx and
listed on the NTTR tab; assigned frequencies are picked clear of everything documented and of the rest of the plan.

Plan rules: 25 kHz channels in VHF/UHF (1 kHz HF); a plan frequency must be at least one channel away from every
documented one, and 100 kHz from Guard. WHITE 1 TAC COORD is RAZOR (callsign fixed, frequency picked).
