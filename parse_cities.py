import csv

def clean(name):
    if '(' in name:
        return name.split('(')[0].strip()
    return name

cities_map = {}
with open('rede_gravimetrica/cities.csv', 'r') as f:
    reader = csv.reader(f)
    header = next(reader)
    for row in reader:
        name = row[0]
        cleaned = clean(name)
        if cleaned not in cities_map:
            cities_map[cleaned] = row

with open('rede_gravimetrica/cities.csv', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    for k, row in cities_map.items():
        row[0] = k # Replace name with cleaned name
        writer.writerow(row)

abs_grav = []
with open('rede_gravimetrica/absolute_gravity.csv', 'r') as f:
    reader = csv.reader(f)
    header = next(reader)
    for row in reader:
        row[0] = clean(row[0])
        abs_grav.append(row)

with open('rede_gravimetrica/absolute_gravity.csv', 'w') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    for row in abs_grav:
        writer.writerow(row)
