"""Load the vendored ndevenish EDM parser, patched for current DCS EDM v10 files.

The RootNode header in current files is laid out differently from the 2016 parser's expectation, so after the base node
we resync on the material list (count, property count, then the 'BLENDING' string index) instead of trusting fixed
offsets. Only geometry is needed for rendering, so the skipped header fields (bounding boxes) are not used.
"""
import os, struct, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "ioedm", "Blender_ioEDM-master", "io_EDM"))
import edm.typereader as TR
import edm.types as T
import edm.material_types as MT
from edm.material_types import Material

# newer material property, one byte (found by trial: every model with it parses fully this way)
MT._material_entry_lookup.setdefault("DECAL", lambda x: x.read_uchar())


def _root_read(stream):
    self = T.BaseNode.read.__func__(T.RootNode, stream)
    blending = stream.strings.index("BLENDING") if stream.strings and "BLENDING" in stream.strings else None
    start = stream.tell()
    raw = stream.stream.read(512)
    for off in range(0, len(raw) - 12):
        n, m, s = struct.unpack_from("<III", raw, off)
        if 0 < n < 200 and 0 < m < 40 and s == blending:
            stream.stream.seek(start + off)
            break
    else:
        stream.stream.seek(start)
        raise ValueError(f"material list not found after RootNode header at {start}")
    self.materials = stream.read_list(Material.read)
    stream.materials = self.materials
    self.unknownD = stream.read_uints(2)
    return self


_orig_split = T.RenderNode.split


def _split(self):
    # v10 files record parent ranges as 0: instead each vertex names its parent in the 4th position value, an index into
    # parentData. Keep the mesh whole and the per-vertex parent list (render.py places every vertex under its own parent).
    if self.parentData and len(self.parentData) > 1 and self.parentData[-1][-2] != len(self.indexData):
        self.parent, self.damage_argument = self.parentData[0][0], self.parentData[0][1]
        self.vertex_parents = [pd[0] for pd in self.parentData]
        return [self]
    return _orig_split(self)


TR._typeReaders["model::RootNode"] = _root_read
T.RenderNode.split = _split
EDMFile = T.EDMFile
