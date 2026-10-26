"""Parse every model in Bazar\World\Shapes and report how many the patched EDM parser reads. Writes cache/coverage.json."""
import json, os, sys, time, io, contextlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import edm_patch
SH = r"C:\Program Files\Eagle Dynamics\DCS World\Bazar\World\Shapes"
ok, bad = {}, {}
t0 = time.time()
for f in sorted(os.listdir(SH)):
    if not f.lower().endswith(".edm"): continue
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            e = edm_patch.EDMFile(os.path.join(SH, f))
        ok[f[:-4].lower()] = sum(len(getattr(r, "vertexData", []) or []) for r in e.renderNodes)
    except Exception as ex:
        bad[f[:-4].lower()] = f"{type(ex).__name__}: {str(ex)[:80]}"
json.dump({"ok": ok, "bad": bad}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "coverage.json"), "w"), indent=1)
from collections import Counter
print(f"{len(ok)} parsed, {len(bad)} failed of {len(ok) + len(bad)} in {time.time() - t0:.0f}s")
for k, n in Counter(v.split(":")[0] + ":" + v.split(":")[1][:50] for v in bad.values()).most_common(6): print(f"  {n}x {k}")
