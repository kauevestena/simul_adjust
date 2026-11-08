#!/usr/bin/env python3
"""Build the EGM2008 5' geoid tiles used by distorcao_utm (standard library only).

Gera os tiles do geoide EGM2008 (grade de 5') usados por distorcao_utm.

Source / Fonte: GeographicLib geoid grid ``egm2008-5.pgm`` (C. F. F. Karney), a
point-registered 4320 x 2161 grid of EGM2008 undulations (NGA, public domain),
stored as big-endian uint16 with N = Offset + Scale * value.

Output / Saída (``distorcao_utm/data/egm2008-5/``):
  * ``rRRcCC.bin``: 10 deg x 10 deg tiles, 123 x 123 nodes (one node of margin before
    and two after each axis, enough for bicubic interpolation inside the tile).
    Row 0 is the northern edge (lat = 90 - 10*RR), column 0 is lon = -180 + 10*CC.
    Values are coded with a planar predictor (int16 little-endian residuals:
    r[0][0] = v - 32768, first row/column differences, elsewhere
    v[i][j] - v[i][j-1] - v[i-1][j] + v[i-1][j-1]) and the whole tile is gzipped.
  * ``index.json``: metadata (offset, scale, tile layout, source, checksums).
  * ``../../tests/geoid-node-fixture.json``: node values for the unit tests.

Usage / Uso:
  python3 distorcao_utm/scripts/build_geoid_tiles.py [--tarball egm2008-5.tar.bz2]
"""
import argparse
import bz2
import gzip
import hashlib
import io
import json
import random
import struct
import tarfile
import urllib.request
from array import array
from pathlib import Path

URL = "https://sourceforge.net/projects/geographiclib/files/geoids-distrib/egm2008-5.tar.bz2/download"
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "data" / "egm2008-5"
FIXTURE = HERE.parent / "tests" / "geoid-node-fixture.json"
TILE_DEG = 10
PER_DEG = 12            # 5' grid
CELLS = TILE_DEG * PER_DEG  # 120 cells per tile side
MARGIN_BEFORE, MARGIN_AFTER = 1, 2
NODES = CELLS + 1 + MARGIN_BEFORE + MARGIN_AFTER - 1  # -1 .. 121 -> 123 nodes


def read_pgm(raw):
    """Parse a binary 16-bit PGM with GeographicLib '# Offset' / '# Scale' comments."""
    pos, tokens, meta = 0, [], {}
    while len(tokens) < 4:
        while raw[pos:pos + 1].isspace():
            pos += 1
        if raw[pos:pos + 1] == b"#":
            end = raw.index(b"\n", pos)
            parts = raw[pos + 1:end].decode().split(None, 1)
            if len(parts) == 2:
                meta[parts[0]] = parts[1].strip()
            pos = end + 1
            continue
        end = pos
        while not raw[end:end + 1].isspace():
            end += 1
        tokens.append(raw[pos:end].decode())
        pos = end
    pos += 1  # single whitespace after maxval
    magic, width, height, maxval = tokens[0], int(tokens[1]), int(tokens[2]), int(tokens[3])
    assert magic == "P5" and maxval == 65535, (magic, maxval)
    data = array("H")
    data.frombytes(raw[pos:pos + 2 * width * height])
    if struct.pack("=H", 1) == b"\x01\x00":  # little-endian host: PGM is big-endian
        data.byteswap()
    return width, height, data, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tarball", type=Path, help="local copy of egm2008-5.tar.bz2")
    args = ap.parse_args()
    if args.tarball:
        blob = args.tarball.read_bytes()
    else:
        print("downloading", URL)
        with urllib.request.urlopen(URL, timeout=300) as r:
            blob = r.read()
    sha_tar = hashlib.sha256(blob).hexdigest()
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:bz2") as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("egm2008-5.pgm"))
        raw = tar.extractfile(member).read()
    width, height, grid, meta = read_pgm(raw)
    assert (width, height) == (360 * PER_DEG, 180 * PER_DEG + 1), (width, height)
    offset, scale = float(meta["Offset"]), float(meta["Scale"])

    def node(row, col):
        """Global node: row 0 = 90N, col 0 = 0E; rows clamped at the poles, cols wrap."""
        row = min(max(row, 0), height - 1)
        return grid[row * width + col % width]

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.bin"):
        old.unlink()
    files, total = {}, 0
    for tr in range(180 // TILE_DEG):
        for tc in range(360 // TILE_DEG):
            row0 = tr * CELLS - MARGIN_BEFORE
            col0 = (tc * CELLS - 180 * PER_DEG) - MARGIN_BEFORE  # lon -180 + 10*tc
            v = [[node(row0 + i, col0 + j) for j in range(NODES)] for i in range(NODES)]
            coded = array("h")
            for i in range(NODES):
                for j in range(NODES):
                    if i == 0 and j == 0:
                        coded.append(v[0][0] - 32768)
                    elif i == 0:
                        coded.append(v[0][j] - v[0][j - 1])
                    elif j == 0:
                        coded.append(v[i][0] - v[i - 1][0])
                    else:  # planar predictor: residual of v[i][j-1] + v[i-1][j] - v[i-1][j-1]
                        coded.append(v[i][j] - v[i][j - 1] - v[i - 1][j] + v[i - 1][j - 1])
            if struct.pack("=H", 1) != b"\x01\x00":
                coded.byteswap()
            payload = gzip.compress(coded.tobytes(), compresslevel=9, mtime=0)
            name = f"r{tr:02d}c{tc:02d}.bin"
            (OUT / name).write_bytes(payload)
            files[name] = len(payload)
            total += len(payload)

    index = {
        "model": "EGM2008",
        "grid": "5' (1/12 deg), point registered",
        "source": "GeographicLib egm2008-5.pgm (https://geographiclib.sourceforge.io/C++/doc/geoid.html)",
        "sourceArchive": "egm2008-5.tar.bz2",
        "sourceSha256": sha_tar,
        "license": "EGM2008 by the U.S. National Geospatial-Intelligence Agency (public domain); grid packaging by C. F. F. Karney (GeographicLib, MIT)",
        "offset": offset,
        "scale": scale,
        "perDegree": PER_DEG,
        "tileDegrees": TILE_DEG,
        "nodes": NODES,
        "marginBefore": MARGIN_BEFORE,
        "rows": 180 // TILE_DEG,
        "cols": 360 // TILE_DEG,
        "origin": "tile rRRcCC: north edge lat = 90 - 10*RR, west edge lon = -180 + 10*CC; node (i, j) at lat = north - (i - 1)/12, lon = west + (j - 1)/12",
        "encoding": "gzip of int16 little-endian residuals of a planar predictor: r00 = v00 - 32768; first row r0j = v0j - v0(j-1); first column ri0 = vi0 - v(i-1)0; elsewhere rij = vij - vi(j-1) - v(i-1)j + v(i-1)(j-1); N = offset + scale * v",
        "pgmMeta": {k: meta[k] for k in ("Description", "MaxBilinearError", "RMSBilinearError", "MaxCubicError", "RMSCubicError") if k in meta},
        "totalBytes": total,
    }
    (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")

    rng = random.Random(2008)
    samples = []
    for _ in range(400):
        row, col = rng.randrange(height), rng.randrange(width)
        samples.append([90 - row / PER_DEG, (col / PER_DEG + 180) % 360 - 180, round(offset + scale * node(row, col), 6)])
    for lat, lon in [(80, -180), (-80, 170), (0, 0), (10, -170), (-26.25, -52.75), (40, 10)]:
        row, col = round((90 - lat) * PER_DEG), round(lon * PER_DEG)
        samples.append([lat, lon, round(offset + scale * node(row, col), 6)])
    FIXTURE.write_text(json.dumps({"source": "egm2008-5.pgm nodes", "samples": samples}) + "\n")
    print(f"{len(files)} tiles, {total / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
