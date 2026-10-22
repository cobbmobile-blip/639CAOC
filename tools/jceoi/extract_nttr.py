#!/usr/bin/env python3
"""
The Nevada (NTTR) pre-decided frequency plan -> data/nttr.json.

Two layers:
  official  NTTR / Nellis assignments transcribed from public Air Force publications (no releasability
            restrictions): AFMAN 13-212V1 NTTR Addendum A, 24 July 2020, Attachment 14; NELLISAFBI 11-250,
            17 June 2022, Attachment 20. Cross-checked against the RED FLAG NELLIS 2014 In-Flight Guide.
  caoc      the CAOC's NTTR comm matrix, comm card (presets), tanker table and range JTACs, read from the
            CAOC's own files (NTTR_COMM_PLAN.xlsx, NTTR Playground JTACS.ods), plus the hobbyist scanner list
            (NTTR Comms listing.ods) as extra register entries.

Run:  python -I extract_nttr.py ["D:/Users/cobbm/Documents/DCS Files/Nellis_NTTR"]
The official tables are constants below (with page references) so the build does not depend on PDF parsing.
"""
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else r"D:\Users\cobbm\Documents\DCS Files\Nellis_NTTR"

AFMAN = "AFMAN 13-212V1 NTTR Addendum A (24 Jul 2020) Att 14"
AFBI = "NELLISAFBI 11-250 (17 Jun 2022) Att 20"
RFN = "RED FLAG NELLIS 2014 IFG"

# ---------- official (transcribed) ----------
# Table A14.1 Tactical Frequencies (MHz): range/function, primary, secondary, tertiary
TACTICAL = [
    ("R-61", [341.925]), ("R-62", [234.25, 274.875, 122.9]), ("R-63", [361.6, 274.875, 122.9]), ("R-64", [288.8]),
    ("R-65", [225.45, 288.225]), ("R-71", [335.45, 288.225]), ("R-74", [228.0, 288.225]), ("R-75", [363.9, 288.225]),
    ("R-76", [354.3, 379.65]), ("R-77, ECE, ECW and TPECR", [293.5]), ("Alamo MOA", [238.8, 294.9]),
    ("Caliente MOA", [289.3, 370.825]), ("Coyote MOA", [234.325, 268.2]), ("Elgin MOA", [281.025, 255.95]),
    ("NTTR spare", [357.1]), ("HAVE QUICK time of day (TOD)", [369.0]),
]
# Table A14.2 Agency Frequencies (MHz). The PDF text sets each agency's name one row below its values; the order
# here is checked against the RFN 2014 IFG p.2-2 and AirNav (Creech Tower 360.625/118.3, Silverbow 257.95/124.75).
AGENCIES = [
    ("NATCF East (Nellis Control, SALLY)", [317.525, 126.65]), ("NATCF West (Nellis Control, LEE)", [254.4, 119.35]),
    ("NTTR Range Monitoring (BLACKJACK)", [377.8, 123.55]), ("DML (Dreamland)", [261.1, 126.15]),
    ("Creech AFB SOF", [226.1, 148.175]), ("Creech AFB SFA", [285.525, 118.3]), ("Creech Tower (KINS)", [360.625, 118.3]),
    ("Silverbow Tower (KTNX)", [257.95, 124.75]), ("NTTR Threat Systems (ROULETTE)", [293.5, 379.65]),
    ("JICO (JUICE)", [231.1]),
]
# Table A20.1 Local Standard Channelization: channel, UHF, VHF, agency (ATIS VHF and Creech per RFN 2014 p.1-6)
CHANNELS = [
    (1, None, None, "Squadron common"), (2, 289.4, 120.9, "Nellis Clearance Delivery"), (3, 275.8, 121.8, "Nellis Ground"),
    (4, 327.0, 132.55, "Nellis Tower"), (5, 385.4, 135.1, "Nellis Approach/Departure West"),
    (6, 273.55, 124.95, "Nellis Approach/Departure East"), (7, 317.525, 126.65, "Nellis Control - Sally"),
    (8, 254.4, 119.35, "Nellis Control - Lee"), (9, 305.6, 142.75, "SOF (Bullseye SOF)"),
    (10, 343.725, None, "Emergency Single Frequency Approach"), (11, 270.1, None, "ATIS"), (12, 360.625, 118.3, "Creech AFB Tower"),
    (13, None, None, "Not used"), (14, 300.05, None, "Unit option"), (15, None, None, "HAVE QUICK or unit option (15-19)"),
    (20, None, None, "HAVE QUICK"),
]
# Table A20.3 Controlling Agency Frequencies, incl. refuelling-track control
CONTROL = [
    ("BLACKJACK", [377.8, 123.55]), ("LA Center West", [377.1, 124.625]), ("LA Center East", [343.6, 124.2]),
    ("Las Vegas Approach", [353.7, 307.25, 282.2, 133.95, 118.4, 125.9]), ("Las Vegas Tower", [257.8, 119.9]),
    ("FSS Radio", [255.4, 122.4]), ("Dreamland Approach Control", [261.1, 126.15]), ("Tonopah Test Site Tower", [257.95, 124.75]),
    ("Creech AFB SOF", [148.175]), ("Creech AFB SFA", [285.525]), ("Nellis Pilot to Metro", [323.9]),
    ("Nellis Pilot to Dispatch", [372.2, 139.3]), ("Nellis AFB CP (RAYMOND 22)", [381.3]),
    ("AR-624 control (LA Center)", [306.2, 323.2]), ("AR-625 control (Nellis Control)", [324.05, 126.95]),
    ("AR-625 control (Oakland) HI / LO", [319.8]), ("AR-635 control (Salt Lake)", [360.8]),
    ("AR-230V / AR-231V control (LA Center)", [343.6, 124.2]),
]
# Table A20.2 Squadron Common Frequencies (unit attribution follows the PDF's reading order; frequencies are exact)
SQUADRON = [
    ("WS Duty Desk", [361.5]), ("Adversary Support", [328.5]),
    ("66 WPS", [138.375, 140.275, 139.4, 143.375, 225.5, 326.8, 255.3, 140.975, 148.85]),
    ("16 WPS (F-16, F-35)", [138.25, 139.125, 141.625, 131.875, 139.55, 140.15, 229.0, 349.1, 360.25, 376.15]),
    ("433 WPS (F-15C, F-22)", [260.1, 322.25, 266.6, 262.65, 323.85, 140.175, 140.4, 140.7]),
    ("17 WPS (F-15E)", [326.775, 292.1, 257.1, 140.325]), ("34 WPS (HH-60)", [141.775, 32.35, 233.6, 239.7]),
    ("26 WPS (MQ-9)", [138.95, 230.025, 258.675, 355.1, 149.875]), ("422 Ops Desk", [379.0]),
    ("422 A-10", [143.6, 138.0125, 149.125, 40.15, 41.45, 41.95, 324.85, 342.2]),
    ("422 F-16", [139.6, 140.95, 369.4, 371.05, 373.55]), ("422 F-15C", [315.8, 318.0, 141.65]),
    ("422 F-15E", [278.4, 323.35, 140.45, 141.925]), ("422 F-22A", [141.025, 305.65, 266.6, 140.825, 141.95, 150.5, 262.65]),
    ("422 F-35", [326.125]), ("64 AGRS (F-16)", [252.1, 123.475, 139.75, 139.85, 141.675, 143.825, 149.525, 283.8, 262.75, 284.55]),
    ("GREEN FLAG West", [139.575, 139.95, 140.1, 140.225, 141.05, 141.4, 46.85, 46.775, 251.2, 395.15, 395.85, 397.25, 399.5, 399.85, 366.15, 138.1]),
    ("RED FLAG ops", [234.9]), ("66 RQS (HH-60)", [140.375, 142.55, 150.675, 32.15, 34.05, 245.65, 318.9, 259.0, 251.9, 236.0]),
    ("USAFADS (Thunderbirds)", [139.8, 148.175, 322.95, 235.25, 141.175]),
]


# ---------- the CAOC's own files ----------
def xlsx_cells(path):
    z = zipfile.ZipFile(path); M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    ss = [("".join(t.text or "" for t in si.iter(M + "t"))) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
    wb = ET.fromstring(z.read("xl/workbook.xml")); rel = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    out = {}
    for s in wb.find(M + "sheets"):
        cells = {}
        for c in ET.fromstring(z.read("xl/" + rel[s.get(R + "id")].replace("/xl/", ""))).iter(M + "c"):
            v = c.find(M + "v")
            txt = ss[int(v.text)] if c.get("t") == "s" and v is not None else (v.text if v is not None else "".join(x.text or "" for x in c.iter(M + "t")))
            if txt: cells[c.get("r")] = txt.replace("\u2013", "-").strip()
        out[s.get("name")] = cells
    return out


def ods_rows(path):
    T = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"; X = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"
    root = ET.fromstring(zipfile.ZipFile(path).read("content.xml")); rows = []
    for row in root.iter(T + "table-row"):
        cells = [" ".join("".join(p.itertext()) for p in c.iter(X + "p")).strip() for c in row]
        if any(cells): rows.append(cells)
    return rows


num = lambda s: float(re.match(r"[\d.]+", s).group()) if s and re.match(r"[\d.]+", s) else None


def caoc_plan(path):
    sh = xlsx_cells(path); m = sh["Matrix"]
    cols = [c for c in "CDFHJ" if m.get(f"{c}3")]
    matrix = {"name": m.get("B2", "NTTR Comm Matrix"), "rows": 6, "columns": []}
    for c in cols:
        cells = []
        for r in range(6):
            base = 6 + r * 3
            role, cs, fr = m.get(f"{c}{base}", ""), m.get(f"{c}{base + 1}", ""), m.get(f"{c}{base + 2}", "")
            # TANKERS rows: the sheet puts the aircraft type where other nets put the role
            cells.append({k: v for k, v in (("role", role), ("callsign", cs), ("freq", f"{num(fr):.3f}" if num(fr) else "")) if v})
        matrix["columns"].append({"title": m[f"{c}3"].strip(), "color": m[f"{c}4"].strip().upper(), "cells": cells})
    tankers = []
    for r in range(34, 45):
        if m.get(f"C{r}"):
            f = m.get(f"J{r}", "")
            tankers.append({"callsign": m[f"C{r}"], "type": m.get(f"D{r}", ""), "tacan": m.get(f"E{r}", ""), "track": m.get(f"F{r}", ""),
                            "arcp": m.get(f"G{r}", ""), "alt": m.get(f"I{r}", ""), "freq": f"{num(f):.3f}" if num(f) else "", "channel": " ".join(f.split()[1:])})
    cm = sh["Comm"]; presets = []
    for r in range(3, 23):
        if cm.get(f"D{r}"):
            presets.append({"preset": int(num(cm[f"D{r}"])), "uhfAgency": cm.get(f"B{r}", ""), "uhf": f"{num(cm[f'C{r}']):.3f}" if num(cm.get(f"C{r}")) else "",
                            "vhf": f"{num(cm[f'E{r}']):.3f}" if num(cm.get(f"E{r}")) else "", "vhfAgency": cm.get(f"F{r}", "")})
    tracks = []
    tk = sh.get("Tankers", {})
    for r in range(6, 14):
        if tk.get(f"C{r}") and tk.get(f"E{r}"):
            tracks.append({"track": tk[f"C{r}"], "alt": tk.get(f"D{r}", ""), "freq": f"{num(tk[f'E{r}']):.3f}"})
    return matrix, tankers, presets, tracks


def caoc_jtacs(path):
    out, block = [], ""
    for row in ods_rows(path)[1:]:
        cells = [c for c in row if c]
        if cells and cells[0].startswith("-"): block = cells[0].strip("- ").replace("\u2019", "'"); cells = cells[1:]
        if len(cells) >= 5:
            out.append({"range": cells[0], "callsign": cells[1], "fm": f"{num(cells[2]):.3f}", "laser": cells[3], "loc": cells[4], "block": block})
    return out


def scanner(path):
    # "freq desc" pairs laid out in several columns; take every cell that starts with a frequency
    out = []
    for row in ods_rows(path):
        for cell in row:
            mm = re.match(r"^(\d{2,3}\.\d+)\s*\|?\s*(.*)$", cell.strip())
            if mm and mm.group(2): out.append([round(float(mm.group(1)), 4), mm.group(2).strip()])
        # the first column holds the frequency and the description in separate cells
        if len(row) > 1 and re.match(r"^\d{2,3}\.\d+$", row[0].strip() or "x") and row[1] and not re.match(r"^\d", row[1]):
            out.append([round(float(row[0]), 4), row[1].strip()])
    seen, uniq = set(), []
    for f, d in out:
        if (f, d) not in seen: seen.add((f, d)); uniq.append([f, d])
    return uniq


def main():
    p = lambda *a: os.path.join(SRC, *a)
    matrix, tankers, presets, tracks = caoc_plan(p("NTTR_COMM_PLAN.xlsx"))
    jtacs = caoc_jtacs(p("Cobbs Playground NTTR IFG", "NTTR Playground JTACS.ods"))
    scan = scanner(p("Cobbs Playground NTTR IFG", "NTTR Comms listing.ods"))
    official = ([{"agency": a, "mhz": f, "table": "A14.1 Tactical", "src": AFMAN} for a, fs in TACTICAL for f in fs]
                + [{"agency": a, "mhz": f, "table": "A14.2 Agency", "src": AFMAN} for a, fs in AGENCIES for f in fs]
                + [{"agency": f"Ch {ch} {a}", "mhz": f, "table": "A20.1 Local channelization", "src": AFBI} for ch, u, v, a in CHANNELS for f in (u, v) if f]
                + [{"agency": a, "mhz": f, "table": "A20.3 Controlling agencies", "src": AFBI} for a, fs in CONTROL for f in fs]
                + [{"agency": a, "mhz": f, "table": "A20.2 Squadron common", "src": AFBI} for a, fs in SQUADRON for f in fs])
    data = {
        "theater": "Nevada",
        "summary": "At the NTTR much of the frequency plan is pre-decided: range, agency, ATC and squadron frequencies are assigned "
                   "by the NTTR and Nellis AFB, and the CAOC's NTTR comm matrix builds on them. Nevada campaigns use this plan.",
        "sources": {AFMAN: "https://static.e-publishing.af.mil/production/1/nellisafb/publication/afi13-212v1_accsup_nttrsup_add_a/afman13-212v1_nttr_add_a.pdf",
                    AFBI: "https://static.e-publishing.af.mil/production/1/nellisafb/publication/nellisafbi11-250/nellisafbi11-250.pdf",
                    RFN: "local copy (RFN14IFG Red flag Nellis 2014.pdf), cross-check only",
                    "CAOC NTTR comm plan": "NTTR_COMM_PLAN.xlsx / NTTR IFG 200-201 (CAOC)", "CAOC range JTACs": "NTTR Playground JTACS.ods (CAOC)",
                    "Scanner list": "NTTR Comms listing.ods / NTTR and Area 51 Scanner Frequencies.pdf (hobbyist)"},
        "channels": [{"ch": ch, "uhf": u, "vhf": v, "agency": a} for ch, u, v, a in CHANNELS],
        "tactical": [{"agency": a, "freqs": fs} for a, fs in TACTICAL],
        "agencies": [{"agency": a, "freqs": fs} for a, fs in AGENCIES],
        "control": [{"agency": a, "freqs": fs} for a, fs in CONTROL],
        "squadron": [{"unit": a, "freqs": fs} for a, fs in SQUADRON],
        "official": official,
        "caoc": {"matrix": matrix, "presets": presets, "tankers": tankers, "tracks": tracks, "jtacs": jtacs},
        "scanner": scan,
    }
    with open(os.path.join(HERE, "data", "nttr.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print(f"official {len(official)} frequencies · matrix {sum(len([c for c in col['cells'] if c.get('freq')]) for col in matrix['columns'])} channels with a frequency "
          f"in {len(matrix['columns'])} nets · {len(presets)} presets · {len(tankers)} tankers · {len(tracks)} AR tracks · {len(jtacs)} JTACs · {len(scan)} scanner entries")


if __name__ == "__main__":
    main()
