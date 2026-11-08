#!/usr/bin/env python3
"""Independent geoid oracle: pygeodesy.GeoidKarney (GeographicLib's 12-point cubic) on egm2008-5.pgm.

Oráculo independente do geoide: interpolação cúbica do GeographicLib (via pygeodesy) sobre a
mesma grade egm2008-5.pgm usada para gerar os tiles.

Usage / Uso:
  pip install pygeodesy
  python3 distorcao_utm/tests/generate_geoid_fixture.py path/to/egm2008-5.pgm
"""
import json
import random
import sys
from pathlib import Path

import pygeodesy
from pygeodesy import GeoidKarney

geoid = GeoidKarney(sys.argv[1])
rng = random.Random(96)
points = [(16 + 46 / 60 + 33 / 3600, -(3 + 34 / 3600)),  # Timbuktu (GeographicLib docs example)
          (-26.229, -52.671), (45.0, 9.0), (0.0, 0.0), (-80.0, -179.99), (83.9, 179.99),
          (30.0, -170.0), (30.0001, -169.9999), (-10.0, 20.0), (60.0, 0.0001)]  # incl. tile seams
points += [(rng.uniform(-80, 84), rng.uniform(-180, 180)) for _ in range(80)]
rows = [[lat, lon, round(geoid.height(lat, lon), 6)] for lat, lon in points]
out = Path(__file__).with_name("geoid-cubic-reference.json")
out.write_text(json.dumps({"generator": f"pygeodesy {pygeodesy.version} GeoidKarney egm2008-5.pgm", "samples": rows}) + "\n")
print(len(rows), "samples ->", out)
