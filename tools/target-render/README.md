# target-render

Imagery for the TDP target folders (`folder.html`), made outside DCS: real satellite imagery and terrain with the
mission's units drawn as DCS's own 3D models, rendered in Blender.

## Setup (once)

- Blender 5.2 at `C:\Program Files\Blender Foundation\Blender 5.2\` (paths are at the top of `build_folders.py` and `render.py`).
- DCS World installed at `C:\Program Files\Eagle Dynamics\DCS World` (models and textures are read from it, never copied).
- The EDM parser: download the [ndevenish/Blender_ioEDM](https://github.com/ndevenish/Blender_ioEDM) source zip (MIT)
  and extract it to `vendor/ioedm/` so that `vendor/ioedm/Blender_ioEDM-master/io_EDM` exists. `edm_patch.py` fixes it
  up for current EDM files.
- Python 3 with `numpy` and `Pillow`.

## Each cycle

1. TDP book → **Export imagery jobs** (one file with every JIPTL target's .miz units).
2. `python tools/target-render/build_folders.py "<OP>-imagery-jobs.json"` (about a minute per target; `--only T10001,T10002` to redo some).
3. Commit `img/targets/` with the site. Each folder's **Open target folder** page picks the images up.

The JOG is the DCS F10 map's own chart layer, read from the terrain's `RasterCharts` (`dcs_charts.py`, placed with a
projection fitted to the terrain's `Beacons.lua`); where a terrain has no chart the Esri topographic map is used.

Tested on Caucasus, Persian Gulf, Syria, Afghanistan, Kola and Nevada. Where Esri has no imagery at the finest zoom
(Kola), the next coarser zoom fills in.

`cache/`, `out/` and `vendor/` stay local. Imagery: Esri World Imagery and World Topographic Map (attribution printed
on every page); elevation: AWS Terrain Tiles.

Checks: `verify_models.py` (model sizes) and `contact_sheet.py` (each model top and side) after adding unit types to `shapes.py`.
