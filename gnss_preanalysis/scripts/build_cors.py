#!/usr/bin/env python3
"""Build data/rbmc-stations.json for gnss_preanalysis (Python standard library only).

Inputs (see data/README.md for provenance):
  * the SIRGAS station-list rows for Brazil (status and network membership);
  * NGL approximate positions, either the gnssrefl SQLite copy
    (station_pos_2024.db, table stations(station, lat, lon, ht)) or NGL's own
    llh.out text file (``ID lat lon h`` per line);
  * supplementary coordinates for stations whose four-character ID is absent from
    NGL or collides with an unrelated NGL station elsewhere in the world.

Every NGL match must fall inside the bounding box of the station's Brazilian state;
four-character IDs are not unique worldwide (CORU, MSGR, SCBL... are other stations
in NGL), so an unchecked join would silently put Brazilian stations abroad.

Usage:
  python gnss_preanalysis/scripts/build_cors.py \
      --ngl /path/to/station_pos_2024.db \
      --out gnss_preanalysis/data/rbmc-stations.json
"""
import argparse
import csv
import hashlib
import json
import math
import re
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SOURCES = HERE / 'data' / 'sources'
SIRGAS_LIST = SOURCES / 'sirgas-station-list-BRA-2026-11-24.txt'
SUPPLEMENT = SOURCES / 'supplementary-coordinates.csv'
DATASET_ID = 'rbmc-sirgas-ngl-2026-11-24'
RETRIEVED = '2026-11-24'
NETWORKS = {'RBMC', 'RMBC', 'ITRF2020', 'IGS', 'IGS20', 'RIBaC', 'TIGA'}

# Approximate state bounding boxes (lat_min, lat_max, lon_min, lon_max), degrees.
STATE_BOX = {
    'AC': (-11.2, -7.1, -74.0, -66.6), 'AL': (-10.5, -8.8, -38.3, -35.1), 'AM': (-9.9, 2.3, -73.8, -56.1),
    'AP': (-1.3, 4.5, -54.9, -49.8), 'BA': (-18.4, -8.5, -46.7, -37.3), 'CE': (-7.9, -2.7, -41.5, -37.2),
    'DF': (-16.1, -15.45, -48.3, -47.3), 'ES': (-21.4, -17.9, -41.9, -39.6), 'GO': (-19.5, -12.4, -53.3, -45.9),
    'MA': (-10.3, -1.0, -48.8, -41.8), 'MG': (-22.95, -14.2, -51.1, -39.8), 'MS': (-24.1, -17.1, -58.2, -50.9),
    'MT': (-18.1, -7.3, -61.7, -50.2), 'PA': (-9.9, 2.6, -58.9, -46.0), 'PB': (-8.4, -6.0, -38.8, -34.7),
    'PE': (-9.5, -7.3, -41.4, -34.8), 'PI': (-10.95, -2.7, -45.99, -40.4), 'PR': (-26.75, -22.5, -54.65, -48.0),
    'RJ': (-23.4, -20.75, -44.9, -40.9), 'RN': (-6.99, -4.8, -38.6, -34.9), 'RO': (-13.7, -7.9, -66.9, -59.7),
    'RR': (-1.6, 5.3, -64.9, -58.8), 'RS': (-33.8, -27.0, -57.7, -49.6), 'SC': (-29.4, -25.9, -53.9, -48.3),
    'SE': (-11.6, -9.5, -38.3, -36.4), 'SP': (-25.4, -19.7, -53.2, -44.1), 'TO': (-13.5, -5.1, -50.8, -45.6),
}
# Station state when the first two letters are not the state code (checked by hand against the city).
STATE_OF = {
    'CEFE': 'ES', 'MABA': 'PA', 'ROSA': 'SP', 'SAGA': 'AM', 'SALU': 'MA', 'SAVO': 'BA', 'SMAR': 'RS', 'SJRP': 'SP',
    'SJSP': 'SP', 'POAL': 'RS', 'POLI': 'SP', 'POVE': 'RO', 'PPTE': 'SP', 'BELE': 'PA', 'BEPA': 'PA', 'BOAV': 'RR',
    'BRAZ': 'DF', 'BRFT': 'CE', 'CHPI': 'SP', 'CORU': 'MS', 'CRAT': 'CE', 'CUIB': 'MT', 'EACH': 'SP', 'EESC': 'SP',
    'GUAI': 'PR', 'IFSC': 'SC', 'ILHA': 'SP', 'IMPZ': 'MA', 'ITAI': 'PR', 'NAUS': 'AM', 'NEIA': 'SP', 'ONRJ': 'RJ',
    'UBA1': 'SP', 'UFPR': 'PR', 'VICO': 'MG', 'SSA1': 'BA', 'SEAJ': 'SE', 'RIOB': 'AC', 'APS1': 'AP', 'SPC1': 'SP',
    'SPS1': 'SP', 'STHA': 'PR', 'PRPI': 'PR',
}
MARGIN = 0.5


def state_of(sid):
    return STATE_OF.get(sid, sid[:2])


def inside_state(sid, lat, lon):
    box = STATE_BOX.get(state_of(sid))
    if box is None:
        return False
    a, b, c, d = box
    return a - MARGIN <= lat <= b + MARGIN and c - MARGIN <= lon <= d + MARGIN


def num(x):
    """Integral floats as ints, so Python and JavaScript serialize them identically (436, not 436.0)."""
    return int(x) if float(x).is_integer() else x


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dms(text):
    d, m, s = text.split()
    sign = -1 if d.strip().startswith('-') else 1
    return sign * (abs(int(d)) + int(m) / 60 + float(s) / 3600)


def split_network_agency(cell):
    networks, agencies = [], []
    for token in [t.strip() for t in cell.split(',') if t.strip()]:
        if agencies:
            agencies.append(token)
            continue
        if token in NETWORKS:
            networks.append(token)
            continue
        head, _, tail = token.partition(' ')
        if head in NETWORKS and tail:
            networks.append(head)
            agencies.append(tail.strip())
        else:
            agencies.append(token)
    networks = ['RBMC' if n == 'RMBC' else n for n in networks]  # RMBC is a typo on the page
    return sorted(set(networks), key=networks.index), agencies


def read_sirgas(path):
    rows = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        name9, city, status, rest = [c.strip() for c in line.split('|')]
        if not re.fullmatch(r'[A-Z0-9]{4}00BRA', name9) or status not in {'active', 'inactive', 'removed'}:
            raise SystemExit(f'unexpected row: {line}')
        networks, agencies = split_network_agency(rest)
        rows.append({'id': name9[:4], 'name9': name9, 'city': city.rsplit(',', 1)[0].strip(), 'status': status,
                     'networks': networks, 'agencies': agencies})
    if len({r['id'] for r in rows}) != len(rows):
        raise SystemExit('duplicate station IDs in the SIRGAS list')
    return rows


def read_ngl(path):
    path = Path(path)
    if path.suffix == '.db':
        con = sqlite3.connect(path)
        data = {s.upper(): (lat, lon, h) for s, lat, lon, h in con.execute('select station, lat, lon, ht from stations')}
        con.close()
        return data
    data = {}
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        parts = line.split()
        if len(parts) >= 4:
            try:
                lat, lon, h = map(float, parts[1:4])
            except ValueError:
                continue
            data[parts[0].upper()] = (lat, (lon + 180) % 360 - 180, h)
    return data


def read_supplement(path):
    with open(path, newline='', encoding='utf-8') as f:
        return {r['id']: r for r in csv.DictReader(f)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ngl', required=True, help='station_pos_2024.db (gnssrefl) or NGL llh.out')
    ap.add_argument('--ngl-label', default='gnssrefl/station_pos_2024.db @ f3f5e14f79ddbf5a9f6eb986d83a48a77e47857e')
    ap.add_argument('--out', default=str(HERE / 'data' / 'rbmc-stations.json'))
    args = ap.parse_args()
    sirgas = read_sirgas(SIRGAS_LIST)
    ngl = read_ngl(args.ngl)
    supplement = read_supplement(SUPPLEMENT)
    stations, excluded = [], []
    for row in sirgas:
        if row['status'] == 'removed':
            continue
        sid = row['id']
        if sid in supplement:
            s = supplement[sid]
            lat, lon, h, source, frame = dms(s['lat_dms']), dms(s['lon_dms']), float(s['h_m']), s['kind'], s['frame']
            ref = s['source']
        elif sid in ngl and inside_state(sid, ngl[sid][0], ngl[sid][1]):
            lat, lon, h = ngl[sid]
            source, frame, ref = 'ngl', 'NGL approximate position (ITRF-aligned)', args.ngl_label
        else:
            reason = 'collision' if sid in ngl else 'missing'
            excluded.append({'id': sid, 'city': row['city'], 'status': row['status'], 'reason': reason})
            continue
        if not inside_state(sid, lat, lon):
            raise SystemExit(f'{sid}: coordinates outside state {state_of(sid)}')
        stations.append({**row, 'lat': num(round(lat, 8)), 'lon': num(round(lon, 8)), 'h': num(round(h, 3)),
                         'coordSource': source, 'frame': frame, 'reference': ref})
    listed = {r['id'] for r in sirgas}
    for sid, s in supplement.items():
        if sid in listed:
            continue
        lat, lon, h = dms(s['lat_dms']), dms(s['lon_dms']), float(s['h_m'])
        if not inside_state(sid, lat, lon):
            raise SystemExit(f'{sid}: supplementary coordinates outside state')
        stations.append({'id': sid, 'name9': f'{sid}00BRA', 'city': s['city'], 'status': s['status'] or 'unverified',
                         'networks': ['RBMC'], 'agencies': ['IBGE'], 'lat': num(round(lat, 8)), 'lon': num(round(lon, 8)),
                         'h': num(round(h, 3)), 'coordSource': s['kind'], 'frame': s['frame'], 'reference': s['source']})
    stations.sort(key=lambda r: r['id'])
    canonical = json.dumps(stations, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    counts = {k: sum(1 for s in stations if s['status'] == k) for k in ('active', 'inactive', 'unverified')}
    metadata = {
        'id': DATASET_ID, 'retrieved': RETRIEVED, 'count': len(stations), 'statusCounts': counts,
        'bySource': {k: sum(1 for s in stations if s['coordSource'] == k) for k in ('ngl', 'site_log', 'ibge_report')},
        'removedSkipped': sum(1 for r in sirgas if r['status'] == 'removed'), 'excluded': excluded,
        'sources': {
            'stationList': {'url': 'https://www.sirgas.org/en/stations/station-list', 'file': f'data/sources/{SIRGAS_LIST.name}',
                            'sha256': sha256(SIRGAS_LIST)},
            'ngl': {'label': args.ngl_label, 'sha256': sha256(args.ngl),
                    'citation': 'Blewitt, G., W. C. Hammond, and C. Kreemer (2018), Harnessing the GPS data explosion for '
                                'interdisciplinary science, Eos, 99, doi:10.1029/2018EO104623'},
            'supplement': {'file': f'data/sources/{SUPPLEMENT.name}', 'sha256': sha256(SUPPLEMENT)},
        },
        'stationsSha256': hashlib.sha256(canonical.encode('utf-8')).hexdigest(),
        'note': 'Design coordinates for pre-analysis only. Official SIRGAS2000 coordinates are in the IBGE station reports.',
    }
    lines = ['{', '"metadata": ' + json.dumps(metadata, ensure_ascii=False, indent=1) + ',', '"stations": [']
    lines += [json.dumps(s, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + (',' if i < len(stations) - 1 else '')
              for i, s in enumerate(stations)]
    lines += [']', '}']
    Path(args.out).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(stations)} stations written to {args.out}; excluded {len(excluded)}: {[e["id"] for e in excluded]}')


if __name__ == '__main__':
    main()
