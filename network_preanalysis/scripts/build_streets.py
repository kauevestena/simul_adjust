#!/usr/bin/env python3
"""Convert an OSM API XML extract into the pinned, attributed street snapshot.
Converte um extrato XML da API OSM no recorte de ruas com atribuição.
Usage / uso: python build_streets.py input.osm output.geojson --retrieved-at UTC
"""
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET

BBOX = [-52.680, -26.237, -52.662, -26.222]
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, BBOX))
HIGHWAYS = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified',
            'living_street', 'pedestrian', 'primary_link', 'secondary_link', 'tertiary_link']


def convert(raw, retrieved_at):
    root = ET.fromstring(raw)
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])]
             for n in root.findall('node')}
    features = []
    for way in root.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        if tags.get('highway') not in HIGHWAYS or tags.get('area') == 'yes':
            continue
        refs = [n.attrib['ref'] for n in way.findall('nd')]
        coords = [nodes[n] for n in refs]
        if len(coords) < 2:
            continue
        features.append({'type': 'Feature', 'id': 'way/' + way.attrib['id'],
                         'properties': {k: tags[k] for k in ['name', 'highway', 'access', 'bridge', 'tunnel', 'layer'] if k in tags} |
                         {'osm_version': int(way.attrib['version']), 'osm_timestamp': way.attrib['timestamp'], 'osm_nodes': refs},
                         'geometry': {'type': 'LineString', 'coordinates': coords}})
    features.sort(key=lambda f: int(f['id'].split('/')[1]))
    digest = hashlib.sha256(json.dumps(features, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    return {'type': 'FeatureCollection', 'metadata': {
        'id': 'pato-branco-streets-v1', 'source': SOURCE, 'retrieved_at': retrieved_at,
        'source_sha256': hashlib.sha256(raw).hexdigest(), 'features_sha256': digest,
        'bbox': BBOX, 'highway_filter': HIGHWAYS,
        'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0',
        'license_url': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'copyright_url': 'https://www.openstreetmap.org/copyright'}, 'features': features}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input'); p.add_argument('output'); p.add_argument('--retrieved-at', required=True)
    a = p.parse_args()
    with open(a.input, 'rb') as f:
        data = convert(f.read(), a.retrieved_at)
    with open(a.output, 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':')); f.write('\n')
    print(f"{len(data['features'])} streets / ruas; SHA-256 {data['metadata']['features_sha256']}")
