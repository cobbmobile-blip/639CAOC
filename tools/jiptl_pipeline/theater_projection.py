#!/usr/bin/env python3
"""
Converts DCS mission-editor native x/y coordinates to lat/lon, per theater.

DCS stores unit positions in a theater-specific planar projection (x = roughly
north, y = roughly east, in meters) rather than lat/lon directly. Converting
requires per-theater Transverse Mercator parameters (central meridian, false
easting/northing, scale factor) that DCS/pydcs don't publish in an obviously
citable spot -- a community forum post claims values for Persian Gulf, but
they do NOT reproduce real mission data (tested: >100km of error), so they
are not used here.

Instead, PERSIAN_GULF below was fit empirically: extract x/y for ~650 units
directly from OP_VENOM_MOCHA_v1.2.miz's mission Lua, pair each with its
already-trusted lat/lon from a DCS Coalition Parser export of the same
mission, and run a nonlinear least-squares fit (WGS84 ellipsoid, standard
Snyder Transverse Mercator) against all pairs at once, spread across the
whole map. Residual: 1.2m max, 0.7m RMS across all 657 points. That's a real
calibration against ground truth, not a guess -- but it rests on ONE mission
file. If a mission on this theater (or any new theater) produces target
coordinates that look clearly wrong, that's the first thing to suspect.

Adding a new theater: export a Coalition Parser CSV for any mission on that
map, pull x/y for the same named units out of its mission Lua, and re-run the
fit in scripts/calibrate_theater.py (same method as above). Do NOT hand-enter
a projection you haven't validated this way -- that's exactly the mistake
this module exists to avoid.
"""

import math

# WGS84 ellipsoid
_A = 6378137.0
_F = 1 / 298.257223563
_E2 = _F * (2 - _F)
_EP2 = _E2 / (1 - _E2)

# Empirically fit (see module docstring). DCS convention: x ~ northing, y ~ easting.
THEATERS = {
    "PersianGulf": {
        "central_meridian_deg": 56.9999597,
        "scale_factor": 0.999600019,
        "false_easting": 104910.012,
        "false_northing": -2986832.08,
        "calibration": "657-point fit vs OP_VENOM_MOCHA_v1.2.miz Coalition Parser export, "
                       "max residual 1.2m, RMS 0.7m",
    },
    # Add other theaters here once calibrated against a real mission -- see
    # scripts/calibrate_theater.py. Uncalibrated theaters are refused in
    # xy_to_latlon() below rather than silently guessed.
}


def _tm_inverse(easting, northing, lon0_deg, k0):
    """Standard Snyder inverse Transverse Mercator. Returns (lat_deg, lon_deg)."""
    lon0 = math.radians(lon0_deg)
    e1 = (1 - math.sqrt(1 - _E2)) / (1 + math.sqrt(1 - _E2))
    M = northing / k0
    mu = M / (_A * (1 - _E2 / 4 - 3 * _E2 ** 2 / 64 - 5 * _E2 ** 3 / 256))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    sin_p1, cos_p1, tan_p1 = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    C1 = _EP2 * cos_p1 ** 2
    T1 = tan_p1 ** 2
    N1 = _A / math.sqrt(1 - _E2 * sin_p1 ** 2)
    R1 = _A * (1 - _E2) / (1 - _E2 * sin_p1 ** 2) ** 1.5
    D = easting / (N1 * k0)

    phi = phi1 - (N1 * tan_p1 / R1) * (
        D ** 2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * _EP2) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * _EP2 - 3 * C1 ** 2) * D ** 6 / 720
    )
    lon = lon0 + (
        D - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * _EP2 + 24 * T1 ** 2) * D ** 5 / 120
    ) / cos_p1

    return math.degrees(phi), math.degrees(lon)


def is_calibrated(theater):
    return theater in THEATERS


def xy_to_latlon(theater, x, y):
    """Convert DCS native (x, y) meters to (lat, lon) decimal degrees.

    Raises KeyError for an uncalibrated theater -- callers must handle this
    (refuse the intake and say which theater needs calibration) rather than
    falling back to a guess.
    """
    if theater not in THEATERS:
        raise KeyError(
            f"No calibrated projection for theater {theater!r}. "
            f"Calibrated theaters: {sorted(THEATERS)}. "
            f"See theater_projection.py docstring to add one."
        )
    p = THEATERS[theater]
    northing = x - p["false_northing"]
    easting = y - p["false_easting"]
    return _tm_inverse(easting, northing, p["central_meridian_deg"], p["scale_factor"])
