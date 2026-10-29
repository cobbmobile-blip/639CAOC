"""Check every example in docs/dks/examples against schemas/caoc-dks.schema.json.

No dependencies: a small validator for the JSON Schema keywords the schema uses ($ref, allOf, oneOf, type, required,
properties, items, enum, const, pattern, min/max, exclusiveMinimum, minItems/maxItems, minLength/maxLength).
Each example must match its own $defs entry and exactly one branch of the root oneOf.

    python docs/dks/validate.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = json.load(open(os.path.join(HERE, "schemas", "caoc-dks.schema.json"), encoding="utf-8"))
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}

def resolve(ref):
    node = SCHEMA
    for part in ref.lstrip("#/").split("/"):
        node = node[part]
    return node

def is_type(v, t):
    if t == "integer": return isinstance(v, int) and not isinstance(v, bool)
    if t == "number": return isinstance(v, (int, float)) and not isinstance(v, bool)
    return isinstance(v, TYPES[t])

def errors(v, s, path="$"):
    out = []
    if "$ref" in s: out += errors(v, resolve(s["$ref"]), path)
    for sub in s.get("allOf", []): out += errors(v, sub, path)
    if "oneOf" in s:
        n = sum(1 for sub in s["oneOf"] if not errors(v, sub, path))
        if n != 1: out.append(f"{path}: matches {n} of oneOf, expected 1")
    if "type" in s:
        ts = s["type"] if isinstance(s["type"], list) else [s["type"]]
        if not any(is_type(v, t) for t in ts): return out + [f"{path}: {json.dumps(v)[:40]} is not {s['type']}"]
    if "const" in s and v != s["const"]: out.append(f"{path}: {v!r} != const {s['const']!r}")
    if "enum" in s and v not in s["enum"]: out.append(f"{path}: {v!r} not in {s['enum']}")
    if isinstance(v, str):
        if "pattern" in s and not re.search(s["pattern"], v): out.append(f"{path}: {v!r} does not match {s['pattern']}")
        if "minLength" in s and len(v) < s["minLength"]: out.append(f"{path}: shorter than {s['minLength']}")
        if "maxLength" in s and len(v) > s["maxLength"]: out.append(f"{path}: longer than {s['maxLength']}")
    if is_type(v, "number"):
        if "minimum" in s and v < s["minimum"]: out.append(f"{path}: {v} < {s['minimum']}")
        if "maximum" in s and v > s["maximum"]: out.append(f"{path}: {v} > {s['maximum']}")
        if "exclusiveMinimum" in s and v <= s["exclusiveMinimum"]: out.append(f"{path}: {v} <= {s['exclusiveMinimum']}")
    if isinstance(v, dict):
        for k in s.get("required", []):
            if k not in v: out.append(f"{path}: missing {k}")
        for k, sub in s.get("properties", {}).items():
            if k in v: out += errors(v[k], sub, f"{path}.{k}")
    if isinstance(v, list):
        if "minItems" in s and len(v) < s["minItems"]: out.append(f"{path}: fewer than {s['minItems']} items")
        if "maxItems" in s and len(v) > s["maxItems"]: out.append(f"{path}: more than {s['maxItems']} items")
        if "items" in s:
            for i, x in enumerate(v): out += errors(x, s["items"], f"{path}[{i}]")
    return out

bad = 0
ex = os.path.join(HERE, "examples")
for name in sorted(os.listdir(ex)):
    doc = json.load(open(os.path.join(ex, name), encoding="utf-8"))
    msg = doc.get("message")
    errs = (errors(doc, SCHEMA["$defs"][msg]) if msg in SCHEMA["$defs"] else [f"unknown message {msg!r}"]) + errors(doc, SCHEMA)
    print(("OK   " if not errs else "FAIL ") + name)
    for e in errs: print("       " + e)
    bad += bool(errs)
print(f"{len(os.listdir(ex)) - bad} of {len(os.listdir(ex))} examples valid")
sys.exit(1 if bad else 0)
