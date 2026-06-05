import fitz
import csv
from geopy.geocoders import Nominatim
import time

doc = fitz.open('rede_gravimetrica/tese_embasamento.pdf')
geolocator = Nominatim(user_agent="gravity_app")

def get_coords(city_name):
    # Some overrides because geopy might fail or give wrong coords for tiny cities without context
    search_query = f"{city_name}, Paraná, Brazil"
    # Overrides for outside Paraná
    if 'Teresina' in city_name: search_query = f"Teresina, Piauí, Brazil"
    elif 'Brasília' in city_name: search_query = f"Brasília, Distrito Federal, Brazil"
    elif 'Viçosa' in city_name: search_query = f"Viçosa, Minas Gerais, Brazil" # Thesis says (RJ), let's just search Viçosa, RJ
    if 'Viçosa (RJ)' in city_name: search_query = f"Viçosa, Rio de Janeiro, Brazil" # wait, Viçosa (RJ)? Actually there's no Viçosa in RJ, it's probably Viçosa do Ceará or Viçosa MG, but thesis says RJ, so let's try. Actually Viçosa is in MG. Let's just use city_name, Brazil.
    if 'Vassouras' in city_name: search_query = "Vassouras, Rio de Janeiro, Brazil"
    if 'Valinhos' in city_name: search_query = "Valinhos, São Paulo, Brazil"
    if 'Santa Maria' in city_name: search_query = "Santa Maria, Rio Grande do Sul, Brazil"

    if '(' in city_name:
        state = city_name.split('(')[1].split(')')[0]
        name = city_name.split('(')[0].strip()
        search_query = f"{name}, {state}, Brazil"

    try:
        location = geolocator.geocode(search_query)
        if location:
            return location.latitude, location.longitude

        # fallback
        location = geolocator.geocode(f"{city_name.split('(')[0].strip()}, Brazil")
        if location:
            return location.latitude, location.longitude

    except Exception as e:
        print(f"Error geocoding {city_name}: {e}")
    return "", ""

# 1. Cities List
all_cities = set()

# RENEGA
page3_tabs = doc[2].find_tables()
renega_cities = []
for tab in page3_tabs:
    data = tab.extract()
    if 'Teresina' in str(data):
        for row in data:
            if 'Teresina (PI)' in str(row[0]):
                cities_list = row[0].split('\n')
                grav_list = row[-1].split('\n')
                for c, g in zip(cities_list, grav_list):
                    name = c.strip()
                    renega_cities.append((name, g.strip().replace(',', '.')))
                    all_cities.add(name)

# LINES
page38_tabs = doc[37].find_tables()
lines = []
for tab in page38_tabs:
    data = tab.extract()
    if 'Estações Pertencentes à Rede' in str(data):
        for row in data:
            if 'Linha' in str(row[0]): continue
            linha = row[0]
            estacoes = row[1]
            if '→' in estacoes:
                parts = estacoes.split('→')
                orig = parts[0].strip()
                dest = parts[1].strip()
            elif '←' in estacoes:
                parts = estacoes.split('←')
                dest = parts[0].strip()
                orig = parts[1].strip()
            else:
                continue
            lines.append((linha, orig, dest))
            all_cities.add(orig)
            all_cities.add(dest)

# Ajustamento
page121_tabs = doc[121].find_tables()
ajustamento_cities = []
for tab in page121_tabs:
    data = tab.extract()
    for row in data:
        if len(row) >= 5 and row[0] and row[0] not in ['parâmetros', 'None', 'gravidade\nmGal']:
            city = row[0].replace('\n', ' ').strip()
            gravity = row[4].replace(',', '.')
            if gravity and city and not city.startswith('gravidade') and not city.startswith('None'):
                ajustamento_cities.append((city, gravity))
                all_cities.add(city)


# Write CSV 1: Cities
with open('rede_gravimetrica/cities.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['City Name', 'Latitude', 'Longitude'])
    for city in sorted(all_cities):
        lat, lon = get_coords(city)
        writer.writerow([city, lat, lon])
        time.sleep(1) # rate limit

# Write CSV 2: Absolute Gravity
# Known absolute gravities: RENEGA and AJUSTAMENTOINTEGRADO
with open('rede_gravimetrica/absolute_gravity.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['City Name', 'Latitude', 'Longitude', 'Absolute Gravimetric Value'])

    # RENEGA
    for city, grav in renega_cities:
        lat, lon = get_coords(city)
        writer.writerow([city, lat, lon, grav])
        time.sleep(1)

    # AJUSTAMENTOINTEGRADO
    for city, grav in ajustamento_cities:
        lat, lon = get_coords(city)
        writer.writerow([city, lat, lon, grav])
        time.sleep(1)

# Let's get the relative gravimetric values for the lines.
# The text says that the adjusted gravity value of the cities is determined, and lines represent differences.
# But are there tables with the relative gravities for each line?
# In Table 4.88 (page 122) we have the absolute gravities for the network.
# Is there a table with adjusted desníveis (relative gravities)?
# On page 48-49 there are tables with "∇l0i" but those are estimated gross errors.
# The goals say: "The gravimetric value column should contain the value of the gravimetric line between the two cities. If there's no information about the gravimetric value, you leave it blank."

with open('rede_gravimetrica/gravimetric_lines.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['line name', 'city from', 'city to', 'relative gravimetric value'])
    for linha, orig, dest in lines:
        writer.writerow([linha, orig, dest, '']) # Leave blank for now, will check if we can calculate or find them.
