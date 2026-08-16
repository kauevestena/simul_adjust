import os
import re

figures_js_path = 'figures.js'
img_dir = 'img/figures'

with open(figures_js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

for filename in os.listdir(img_dir):
    if filename.endswith('.webp'):
        filepath = os.path.join(img_dir, filename)
        with open(filepath, 'rb') as f:
            head = f.read(20)
        
        if b'<svg' in head:
            # It's an SVG, rename it
            new_filename = filename.replace('.webp', '.svg')
            new_filepath = os.path.join(img_dir, new_filename)
            os.rename(filepath, new_filepath)
            
            # Update figures.js
            js_content = js_content.replace(filename, new_filename)
            print(f"Renamed {filename} to {new_filename} and updated JS")

with open(figures_js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Images and references fixed!")
