"""Regenerate independent projection references with OpenCV 4.13.0.

python -m pip install opencv-python-headless==4.13.0.92
python camera_proj/tests/generate_opencv_fixture.py
"""
import json
from pathlib import Path
import cv2
import numpy as np

if cv2.__version__ != "4.13.0":
    raise RuntimeError(f"Expected OpenCV 4.13.0, found {cv2.__version__}")

def photogrammetric_rotation(angles):
    w, p, k = np.deg2rad(angles)
    rw = np.array([[1, 0, 0], [0, np.cos(w), np.sin(w)], [0, -np.sin(w), np.cos(w)]])
    rp = np.array([[np.cos(p), 0, -np.sin(p)], [0, 1, 0], [np.sin(p), 0, np.cos(p)]])
    rk = np.array([[np.cos(k), np.sin(k), 0], [-np.sin(k), np.cos(k), 0], [0, 0, 1]])
    return rk @ rp @ rw

cases = []
for pose, center, angles in [("canonical", [0, 0, 0], [0, 0, 0]), ("translated_rotated", [1, -.5, 2], [18, -25, 12])]:
    rotation = photogrammetric_rotation(angles)
    center = np.asarray(center, dtype=np.float64)
    camera_points = np.asarray([[0, 0, 3], [.4, .3, 3], [-.5, -.2, 4], [.8, -.6, 5], [-.6, .55, 2], [.01, -.01, 1]], dtype=np.float64)
    points = camera_points @ rotation + center
    for model, distortion in [("none", [0, 0, 0, 0, 0]), ("radial", [-.25, .07, 0, 0, 0]), ("tangential", [.18, -.03, .012, -.008, 0]), ("full", [-.15, .04, -.01, .007, .012])]:
        for width, offset in [(700, [0, 0]), (1400, [2, -1.5]), (791, [-.8, .9])]:
            sensor = [35, 24]
            height = int(np.floor(width * sensor[1] / sensor[0] + .5))
            focal = 50
            fx, fy = focal * width / sensor[0], focal * height / sensor[1]
            cx, cy = (width - 1) / 2 + offset[0] * width / sensor[0], (height - 1) / 2 + offset[1] * height / sensor[1]
            intrinsics = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]], dtype=np.float64)
            rvec, _ = cv2.Rodrigues(rotation)
            image, _ = cv2.projectPoints(points, rvec, -rotation @ center, intrinsics, np.array(distortion, dtype=np.float64))
            cases.append(dict(name=f"{pose}/{model}/{width}", center=center.tolist(), angles=angles,
                              rotation=rotation.reshape(-1).tolist(), width=width, height=height, sensor=sensor,
                              offset=offset, focal=focal, distortion=model, coefficients=distortion,
                              world=points.tolist(), camera=camera_points.tolist(), expected=image.reshape(-1, 2).tolist()))

output = dict(provenance=dict(library="OpenCV", version=cv2.__version__, wheel="opencv-python-headless==4.13.0.92",
                             function="cv2.projectPoints", reference="https://docs.opencv.org/4.13.0/d9/d0c/group__calib3d.html",
                             generator="generate_opencv_fixture.py", convention="Rwc = Rkappa Rphi Romega; t = -Rwc C"), cases=cases)
path = Path(__file__).with_name("opencv-4.13-reference.json")
path.write_text(json.dumps(output, indent=2) + "\n")
print(f"Wrote {len(cases)} cases / {sum(len(c['world']) for c in cases)} projections to {path}")
