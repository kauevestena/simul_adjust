import csv
import json
import math

def generate_network():
    nodes = []
    links = []

    # Read absolute gravity data
    gravity_stations = {}
    with open('rede_gravimetrica/data/absolute_gravity.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            city_name = row['City Name']
            gravity_stations[city_name] = {
                'id': city_name,
                'lat': float(row['Latitude']),
                'lng': float(row['Longitude']),
                'g': float(row['Absolute Gravimetric Value (mGal)']),
                'fixed': row['to_use'].strip().lower() == 'true'
            }

    # Add nodes
    # We want to add all cities that are in the absolute_gravity as nodes
    # but maybe only the ones that are part of lines or 'to_use' are true? Let's add all cities that appear in lines
    cities_in_lines = set()

    with open('rede_gravimetrica/data/gravimetric_lines.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            city_from = row['city from']
            city_to = row['city to']
            dg_str = row['relative gravimetric value (mGal)']

            if not dg_str.strip():
                continue # Skip empty lines

            dg = float(dg_str)
            weight_str = row['weight']
            heuristic_weight_str = row['heuristic_weight']

            if not weight_str.strip():
                continue

            weight = float(weight_str) # this is variance in our instructions
            heuristic_weight = float(heuristic_weight_str)

            cities_in_lines.add(city_from)
            cities_in_lines.add(city_to)

            links.append({
                'source': city_from,
                'target': city_to,
                'dg': dg,
                'variance': weight,
                'heuristic_weight': heuristic_weight
            })

    for city in cities_in_lines:
        if city in gravity_stations:
            stat = gravity_stations[city]
            nodes.append({
                'id': stat['id'],
                'lat': stat['lat'],
                'lng': stat['lng'],
                'g': stat['g'],
                'fixed': stat['fixed']
            })
        else:
            print(f"Warning: City {city} not found in absolute_gravity.csv")

    network_data = {
        'nodes': nodes,
        'links': links
    }

    with open('rede_gravimetrica/default_network.js', 'w') as f:
        f.write('const defaultNetworkData = ' + json.dumps(network_data, indent=2) + ';\n')

if __name__ == '__main__':
    generate_network()
