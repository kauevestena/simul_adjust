import json
import math
import requests
from io import BytesIO
from PIL import Image

with open('initial_points.geojson', 'r') as f:
    data = json.load(f)

points = []
for i, feature in enumerate(data['features']):
    lon, lat = feature['geometry']['coordinates']
    zoom = 14
    x = math.floor((lon + 180.0) / 360.0 * (2.0 ** zoom))
    y = math.floor((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * (2.0 ** zoom))
    
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png"
    resp = requests.get(url)
    img = Image.open(BytesIO(resp.content))
    
    n = 2.0 ** zoom
    x_pixel = int(((lon + 180.0) / 360.0 * n - x) * 256)
    y_pixel = int(((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n - y) * 256)
    
    x_pixel = max(0, min(255, x_pixel))
    y_pixel = max(0, min(255, y_pixel))
    
    r, g, b, *a = img.getpixel((x_pixel, y_pixel))
    elev = (r * 256 + g + b / 256.0) - 32768
    points.append({
        'id': f'P{i+1}',
        'lon': lon,
        'lat': lat,
        'elev': round(elev, 3)
    })

# P3 is the centermost. We'll name it RN1
points[2]['id'] = 'RN1'
points[2]['fixed'] = True

for p in points:
    if 'fixed' not in p:
        p['fixed'] = False

js_content = "const defaultNetwork = " + json.dumps(points, indent=4) + ";\n"
with open('default_network.js', 'w') as f:
    f.write(js_content)

print("Generated default_network.js")
