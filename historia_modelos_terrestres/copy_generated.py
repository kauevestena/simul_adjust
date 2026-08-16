import os
import shutil
import glob
import re

source_dir = '/home/kaue/.gemini/antigravity-ide/brain/73b7f342-dcb4-44eb-b19b-875cb7e4fef6'
target_dir = 'img/figures'
figures_js = 'figures.js'

# Read figures.js
with open(figures_js, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Find all generated images
jpg_files = glob.glob(os.path.join(source_dir, '*_illust_*.jpg'))

for file_path in jpg_files:
    basename = os.path.basename(file_path)
    # Extract the base name (e.g. pitagoras_illust)
    match = re.match(r'([a-z]+_illust)_\d+\.jpg', basename)
    if match:
        base_name = match.group(1)
        new_name = f"{base_name}.jpg"
        target_path = os.path.join(target_dir, new_name)
        
        # Copy file
        shutil.copy2(file_path, target_path)
        print(f"Copied to {target_path}")
        
        # Update figures.js
        # Replace occurrences of base_name + '.webp' or '.svg'
        js_content = re.sub(f"{base_name}\\.(webp|svg)", new_name, js_content)

# Write figures.js
with open(figures_js, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Done updating figures.js and copying images.")
