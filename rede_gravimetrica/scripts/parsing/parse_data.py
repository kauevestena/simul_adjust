import fitz
import re
import csv
from geopy.geocoders import Nominatim
from time import sleep

def get_coords(city_name):
    geolocator = Nominatim(user_agent="gravity_app")
    location = geolocator.geocode(f"{city_name}, Brazil")
    if location:
        return location.latitude, location.longitude
    return "", ""

doc = fitz.open('../../source_info/tese_embasamento.pdf')

# Table 1.1 - Estações da RENEGA (page 3)
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
                    renega_cities.append((c.strip(), g.strip().replace(',', '.')))

# Let's extract the Table 3.1 - Linhas de Desnível (page 38)
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

print("RENEGA:")
for c in renega_cities:
    print(c)

print("\nLINES:")
for l in lines:
    print(l)

# Let's extract Table 4.88 from Page 122 - AJUSTAMENTOINTEGRADO gravities
page121_tabs = doc[120].find_tables()
ajustamento_cities = []
for tab in page121_tabs:
    data = tab.extract()
    if 'São Mateus\ndo Sul' in str(data) or 'São Mateus do Sul' in str(data):
        for row in data:
            if len(row) >= 5 and row[0] and row[0] not in ['parâmetros', 'None', 'gravidade\nmGal']:
                city = row[0].replace('\n', ' ').strip()
                gravity = row[4].replace(',', '.')
                if gravity and city and not city.startswith('gravidade'):
                    ajustamento_cities.append((city, gravity))

print("\nAJUSTAMENTOINTEGRADO:")
for c in ajustamento_cities:
    print(c)
