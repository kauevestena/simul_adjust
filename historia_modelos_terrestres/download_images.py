import urllib.request
import json
import os
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

os.makedirs('img/figures', exist_ok=True)

figures = {
    'pitagoras': 'Pythagoras',
    'aristoteles': 'Aristotle',
    'ptolomeu': 'Ptolemy',
    'eratostenes': 'Eratosthenes',
    'newton': 'Isaac_Newton',
    'clairaut': 'Alexis_Clairaut',
    'maupertuis': 'Pierre_Louis_Maupertuis',
    'bessel': 'Friedrich_Bessel',
    'listing': 'Johann_Benedict_Listing',
    'stokes': 'Sir_George_Stokes,_1st_Baronet',
    'helmert': 'Friedrich_Robert_Helmert',
    'molodensky': 'Mikhail_Molodenskii',
    'heiskanen': 'Veikko_Aleksanteri_Heiskanen',
    'moritz': 'Helmut_Moritz',
    'mercator': 'Gerardus_Mercator',
    'lambert': 'Johann_Heinrich_Lambert',
    'gauss': 'Carl_Friedrich_Gauss',
    'kruger': 'Johann_Heinrich_Louis_Krüger'
}

illustrations = {
    'pitagoras': 'Harmony_of_the_spheres',
    'aristoteles': 'Lunar_eclipse',
    'ptolomeu': 'Ptolemaic_system',
    'eratostenes': 'Eratosthenes',
    'newton': 'Equatorial_bulge',
    'clairaut': 'Gravity_of_Earth',
    'maupertuis': 'French_Geodesic_Mission',
    'bessel': 'Reference_ellipsoid',
    'listing': 'Geoid',
    'stokes': 'Geodesy',
    'helmert': 'Physical_geodesy',
    'molodensky': 'Reference_elevation_model',
    'heiskanen': 'Isostasy',
    'moritz': 'Geodesy',
    'mercator': 'Mercator_projection',
    'lambert': 'Lambert_conformal_conic_projection',
    'gauss': 'Transverse_Mercator_projection',
    'kruger': 'Universal_Transverse_Mercator_coordinate_system'
}

def get_wiki_image(title, filename):
    url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages&format=json&pithumbsize=600"
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Bot/1.0'})
            response = urllib.request.urlopen(req, context=ctx)
            data = json.loads(response.read().decode('utf-8'))
            pages = data['query']['pages']
            for page_id in pages:
                if 'thumbnail' in pages[page_id]:
                    img_url = pages[page_id]['thumbnail']['source']
                    print(f"Downloading {title} to {filename}")
                    img_req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Bot/1.0'})
                    img_resp = urllib.request.urlopen(img_req, context=ctx)
                    with open(filename, 'wb') as f:
                        f.write(img_resp.read())
                    return True
            print(f"No thumbnail found for {title}")
            return False
        except urllib.error.HTTPError as e:
            if e.code == 429:
                sleep_time = 2 ** attempt
                print(f"Rate limited on {title}. Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                print(f"HTTP Error {e.code} for {title}")
                return False
        except Exception as e:
            print(f"Error fetching {title}: {e}")
            return False
    return False

print("Downloading missing portraits...")
for key, title in figures.items():
    filename = f"img/figures/{key}_portrait.webp"
    # only download if not exists or if it's the dummy svg
    if not os.path.exists(filename) or os.path.getsize(filename) < 1000:
        get_wiki_image(title, filename)
        time.sleep(0.5)

print("\nDownloading missing illustrations...")
for key, title in illustrations.items():
    filename = f"img/figures/{key}_illust.webp"
    if not os.path.exists(filename) or os.path.getsize(filename) < 1000:
        get_wiki_image(title, filename)
        time.sleep(0.5)

print("\nDone downloading.")
