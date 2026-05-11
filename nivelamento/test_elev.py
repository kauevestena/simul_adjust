import math
import requests
from io import BytesIO
from PIL import Image

lat = -25.45025
lon = -49.306555
zoom = 12

x = math.floor((lon + 180.0) / 360.0 * (2.0 ** zoom))
y = math.floor((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * (2.0 ** zoom))

url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png"
print(f"URL: {url}")
resp = requests.get(url)
img = Image.open(BytesIO(resp.content))

# calculate pixel
n = 2.0 ** zoom
x_pixel = int(((lon + 180.0) / 360.0 * n - x) * 256)
y_pixel = int(((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n - y) * 256)

r, g, b, *a = img.getpixel((x_pixel, y_pixel))
elev = (r * 256 + g + b / 256.0) - 32768
print(f"RGB: ({r}, {g}, {b}), Elevation: {elev}")
