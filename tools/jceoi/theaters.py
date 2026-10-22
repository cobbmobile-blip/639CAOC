"""Theater keys, DCS data files and approximate map extents (S, N, W, E in degrees).

The extents decide which real-world airfields count as "in theater". They are generous
rectangles around each DCS map, checked against the positions of the map's own DCS beacons
(check_theaters.py). A real-world frequency just outside a map can still be heard inside it,
so erring large is the safe side for deconfliction.
"""
THEATERS = [
    # key, DCS data file stem, (S, N, W, E), status
    ("Caucasus", "Caucasus", (40.3, 47.7, 29.0, 46.8), "released"),
    ("Nevada", "Nevada", (34.4, 39.6, -119.6, -111.8), "released"),
    ("Persian Gulf", "PersianGulf", (22.5, 33.8, 48.0, 62.6), "released"),
    ("Syria", "Syria", (30.4, 38.6, 30.4, 42.6), "released"),
    ("Marianas", "MarianaIslands", (12.5, 21.0, 143.5, 147.5), "released"),
    ("Sinai", "Sinai", (26.8, 33.2, 28.6, 36.4), "released"),
    ("Kola", "Kola", (63.8, 71.6, 12.5, 37.5), "released"),
    ("Afghanistan", "Afghanistan", (29.0, 38.8, 60.0, 74.8), "released"),
    ("Iraq", "iraq", (30.0, 37.6, 38.6, 48.6), "released"),
    ("Germany (Cold War)", "germanycoldwar", (48.8, 55.2, 5.4, 16.0), "released"),
    ("Falklands", "falklands", (-56.2, -46.0, -76.0, -56.0), "released"),
    # announced / in development: no in-game data yet. Real-world data is gathered so the
    # tab is ready; the DCS register is added when the map ships.
    ("Balkans", None, (39.5, 46.6, 13.0, 23.2), "in development"),
    ("Iraq South", None, (28.5, 33.6, 42.0, 49.5), "in development"),
    ("Afghanistan North", None, (34.5, 40.5, 62.0, 72.5), "in development"),
]
