#!/usr/bin/env python3
"""Independent UTM oracle for distorcao_utm/tests/model.test.mjs.

Oráculo independente de UTM: E, N, fator de escala e convergência meridiana calculados
pelo PROJ (pyproj, Transverse Mercator estendido de Poder/Engsager) para pontos nos dois
hemisférios, nas bordas das zonas e fora delas (zona vizinha forçada).

Usage / Uso:  pip install pyproj && python3 distorcao_utm/tests/generate_pyproj_fixture.py
"""
import json
import random
from pathlib import Path

import pyproj
from pyproj import Proj, Transformer

rng = random.Random(32722)
cases = []
for i in range(240):
    zone = rng.randint(1, 60)
    cm = -183 + 6 * zone
    reach = 3.0 if i < 160 else 9.0  # inside the zone, then up to a neighbouring zone
    lat = rng.uniform(-80, 84)
    lon = cm + rng.uniform(-reach, reach)
    cases.append((lat, lon, zone))
cases += [(0, -51, 22), (0, -48, 22), (-26.229, -52.671, 22), (84, 3, 31), (-80, 177, 60), (45, 9, 32), (-0.0001, -51.5, 22)]

rows = []
for lat, lon, zone in cases:
    south = lat < 0
    epsg = (32700 if south else 32600) + zone
    tr = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    e, n = tr.transform(lon, lat)
    f = Proj(f"EPSG:{epsg}").get_factors(lon, lat)
    rows.append({"lat": lat, "lon": lon, "zone": zone, "south": south, "E": e, "N": n,
                 "k": f.meridional_scale, "k2": f.parallel_scale, "convergence": f.meridian_convergence})
out = Path(__file__).with_name("pyproj-utm-reference.json")
out.write_text(json.dumps({"generator": f"pyproj {pyproj.__version__} / PROJ {pyproj.proj_version_str}", "cases": rows}, indent=0) + "\n")
print(len(rows), "cases ->", out)
