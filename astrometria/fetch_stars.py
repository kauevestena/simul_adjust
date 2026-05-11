import json
import urllib.request
import math

# Original named stars
original_stars = [
    {"name": "Sirius", "ra": 101.287, "dec": -16.716, "mag": -1.46},
    {"name": "Canopus", "ra": 95.987, "dec": -52.695, "mag": -0.74},
    {"name": "Rigil Kentaurus", "ra": 219.902, "dec": -60.833, "mag": -0.27},
    {"name": "Arcturus", "ra": 213.915, "dec": 19.182, "mag": -0.05},
    {"name": "Vega", "ra": 279.234, "dec": 38.783, "mag": 0.03},
    {"name": "Capella", "ra": 79.172, "dec": 45.997, "mag": 0.08},
    {"name": "Rigel", "ra": 78.634, "dec": -8.201, "mag": 0.18},
    {"name": "Procyon", "ra": 114.825, "dec": 5.224, "mag": 0.40},
    {"name": "Achernar", "ra": 24.428, "dec": -57.236, "mag": 0.45},
    {"name": "Betelgeuse", "ra": 88.792, "dec": 7.407, "mag": 0.45},
    {"name": "Hadar", "ra": 210.955, "dec": -60.373, "mag": 0.61},
    {"name": "Altair", "ra": 297.695, "dec": 8.868, "mag": 0.76},
    {"name": "Acrux", "ra": 186.649, "dec": -63.099, "mag": 0.77},
    {"name": "Aldebaran", "ra": 68.980, "dec": 16.509, "mag": 0.87},
    {"name": "Antares", "ra": 247.351, "dec": -26.432, "mag": 0.96},
    {"name": "Spica", "ra": 201.298, "dec": -11.161, "mag": 0.97},
    {"name": "Pollux", "ra": 116.328, "dec": 28.026, "mag": 1.16},
    {"name": "Fomalhaut", "ra": 344.412, "dec": -29.622, "mag": 1.17},
    {"name": "Deneb", "ra": 310.357, "dec": 45.280, "mag": 1.25},
    {"name": "Regulus", "ra": 152.092, "dec": 11.967, "mag": 1.36},
    {"name": "Polaris", "ra": 37.954, "dec": 89.264, "mag": 1.97},
    {"name": "Castor", "ra": 113.649, "dec": 31.888, "mag": 1.58},
    {"name": "Bellatrix", "ra": 81.282, "dec": 6.349, "mag": 1.64},
    {"name": "Elnath", "ra": 81.573, "dec": 28.607, "mag": 1.65},
    {"name": "Miaplacidus", "ra": 138.300, "dec": -69.717, "mag": 1.67},
    {"name": "Alnilam", "ra": 84.053, "dec": -1.201, "mag": 1.69},
    {"name": "Alnair", "ra": 332.058, "dec": -46.960, "mag": 1.73},
    {"name": "Alioth", "ra": 193.507, "dec": 55.959, "mag": 1.76},
    {"name": "Dubhe", "ra": 165.932, "dec": 61.751, "mag": 1.79},
    {"name": "Mirfak", "ra": 51.080, "dec": 49.861, "mag": 1.79}
]

url = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json"
req = urllib.request.urlopen(url)
data = json.loads(req.read().decode('utf-8'))

# We will collect stars here
final_stars = []
final_stars.extend(original_stars)

def is_duplicate(ra, dec, mag):
    for s in original_stars:
        # if distance is less than 1 degree, consider it duplicate
        d_ra = abs(s['ra'] - ra)
        d_ra = min(d_ra, 360 - d_ra)
        d_dec = abs(s['dec'] - dec)
        if d_ra < 1.0 and d_dec < 1.0:
            return True
    return False

# Append bright stars from catalog
features = data.get('features', [])
for f in features:
    props = f.get('properties', {})
    geom = f.get('geometry', {})
    
    mag = props.get('mag', 10)
    if mag > 5.5: # Include up to 5.5, which is ~2800 stars
        continue
        
    coords = geom.get('coordinates', [0, 0])
    ra_raw = coords[0]
    dec = coords[1]
    
    # Map RA
    ra = ra_raw + 360 if ra_raw < 0 else ra_raw
    
    if is_duplicate(ra, dec, mag):
        continue
        
    star_id = f.get('id', 'Unknown')
    final_stars.append({
        "name": f"HIP {star_id}",
        "ra": round(ra, 3),
        "dec": round(dec, 3),
        "mag": round(mag, 2)
    })

# Write to stars.js
with open('/home/kaue/tests/simul_adjust/astrometria/stars.js', 'w') as f:
    f.write("const GLOBAL_STARS_DATA = [\n")
    for i, s in enumerate(final_stars):
        comma = "," if i < len(final_stars) - 1 else ""
        f.write(f'    {{"name": "{s["name"]}", "ra": {s["ra"]}, "dec": {s["dec"]}, "mag": {s["mag"]}}}{comma}\n')
    f.write("];\n")

print(f"Generated stars.js with {len(final_stars)} stars.")
