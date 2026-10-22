# JCEOI build

Builds `js/jceoi-data.js` for the site's JCEOI page (`jceoi.html`) and the Comm Plan's JCEOI check.

```
python -I fetch_sources.py      # OurAirports CSVs -> src/ (not committed, ~15 MB)
python -I extract_dcs.py        # in-game ATC + beacons from your DCS install -> data/dcs_<map>.json
python -I extract_pydcs.py      # maps not installed locally (Iraq, Germany CW, Falklands), from pydcs
python -I build.py              # registers + Blue net plan -> ../../js/jceoi-data.js
```

`build.py` exits non-zero, and writes nothing, if any plan frequency is off its channel grid or within one channel of
anything documented in any theater, or if its frequency policy no longer matches the Comm Plan template.

**The net list is the Comm Plan (ACP) template** — `COMM_TEMPLATE` in `js/products.js`. Change nets, colours or roles
there, then run `build.py`; `python -I build.py --check` tells you whether `js/jceoi-data.js` is still current. The
build stops if a template colour has no UHF slice (or a slice has no colour), if WHITE 1 is no longer TAC COORD
(RAZOR 293.500 is fixed there), or if an FM/HF rule names a role the template no longer has. The site also compares
the template it runs with the one the data was built from: if they differ, the JCEOI page shows "Out of date" and new
Comm Plans start without frequencies.

| File | What |
|---|---|
| `theaters.py` | theater keys, DCS data file, map rectangle (S, N, W, E), released / in development |
| `data/dcs_*.json` | in-game ATC radios (HF, VHF-FM, VHF-AM, UHF), nav beacons, TACAN channels |
| `data/military.json` | real-world military frequencies with source and confidence, plus common/standard ones |
| `build.py` | reads the ACP template, merges everything, generates the net plan, checks it |

Re-run `extract_dcs.py` after a DCS update or when Balkans / Iraq South / Afghanistan North ship (add their DCS
folder to `THEATERS` in `extract_dcs.py` and their stem in `theaters.py`). Add verified military frequencies to
`data/military.json`; mark anything not checked against an AIP as `unverified`.

Plan rules: 25 kHz channels in VHF/UHF (1 kHz HF); a plan frequency must be at least one channel away from every
documented one, and 100 kHz from Guard. WHITE 1 TAC COORD is fixed at RAZOR 293.500.
