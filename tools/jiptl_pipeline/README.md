# JIPTL Pipeline

Turns a DCS REDFOR order of battle into a ranked, capped JIPTL (Joint Integrated
Prioritized Target List) for the CFACC to review -- classify units, geofence to
the cycle's Battle Management Area, score against the cycle's Key Tasks, cap per
task, and stamp ATO-referenceable target numbers (`T10001`, `T10002`, ...).

The companion review page is `../jiptl_review.html` -- it's built from this
pipeline's JSON/CSV output (see "Building the review page" below).

## Two ways to run it

**From Coalition Parser CSV exports** (`jiptl_generate.py`) -- the original path.
Export Group/Unit/Type/Latitude/Longitude/Altitude CSVs from the Coalition
Parser for each coalition/category you need, then:

```
python3 jiptl_generate.py --input red_ground.csv red_air.csv red_static.csv \
    --classification config/unit_classification.json \
    --cycle-config config/cycle_config.json \
    --out-prefix output/cycle01
```

**Directly from a `.miz`** (`miz_intake.py`) -- no Coalition Parser step, reads
the mission file's Lua table and converts each unit's native x/y to lat/lon
itself:

```
python3 miz_intake.py YourMission.miz --coalition red \
    --classification config/unit_classification.json \
    --cycle-config config/cycle_config.json \
    --out-prefix output/cycle01
```

`miz_intake.py` only works for a theater `theater_projection.py` has a
calibrated coordinate projection for. It refuses outright rather than guess --
see that file's docstring for how to calibrate a new theater (it takes one
mission on that map with a trusted lat/lon source, e.g. a Coalition Parser
export, to fit against).

## Config

- `config/unit_classification.json` -- DCS unit Type -> {category, task, tier,
  nominate}. Regenerate from a fresh DCS unit catalog with
  `build_classification.py`; re-run it after a DCS update adds new modules/unit
  types. Anything the rules can't confidently place is written to
  `unit_classification_REVIEW.csv` instead of silently guessing.
- `config/cycle_config.json` -- the file the CFACC/board edits every cycle: Key
  Task weights, the Battle Management Area (circle or polygon), default grade
  by tier, and per-task caps. Copy and edit this per cycle -- the example here
  has placeholder values, not a real BMA.

## Output (per `--out-prefix`)

- `<prefix>_jiptl.csv` / `.json` -- the ranked, capped JIPTL
- `<prefix>_watchlist.csv` -- in-BMA, classified, nominate-eligible, but cut by
  the per-task cap
- `<prefix>_out_of_bma.csv` -- classified/nominate-eligible groups outside the
  BMA (kept for traceability, not actionable this cycle)
- `<prefix>_unclassified.csv` -- DCS Type strings with no entry in
  `unit_classification.json` (add these to the classification table)

Each JIPTL/watchlist/out-of-BMA row carries a `unit_name` -- the actual
weapon system/unit, e.g. "9A310 Buk (SA-11) TEL" or "Kilo-class Submarine" --
picked to be the doctrinally-correct representative of the group: for a SAM
site made up of several unit types (search radar, TEL, command post...), the
one the row is named/categorized after is the one that actually has to die for
a confirmed kill, not whichever happened to classify first. See the
`SAM_FAMILY_DOCTRINE` table and `determine_kill_criteria()` in
`jiptl_generate.py` for the logic (e.g. an SA-11 Buk TELAR self-guides and must
be destroyed individually; an SA-6 Kub battery is blind -- and a confirmed
kill -- the moment its single fire-control radar dies). This only affects which
unit a group is named after on the JIPTL, not any separate "how to kill it"
guidance -- the CFACC/ATO cell doesn't need that spelled out.

`data/test_fixtures/` has small synthetic CSV/JSON files for exercising the
pipeline without a real mission file.

## Building the review page

`../jiptl_review.html` is spliced together from this template + one run's
JSON/CSV output -- it's a static snapshot (like the rest of `/tools`), so
there's no live backend wiring it to a fresh pipeline run yet. To refresh it
after a new cycle's run, replace the `var DATA = {...}` assignment near the top
of the page's `<script>` block with `{cycle: <cycle_config.json>, jiptl:
<prefix>_jiptl.json, watchlist: <prefix>_watchlist.csv as rows, out_of_bma:
<prefix>_out_of_bma.csv as rows}`.
