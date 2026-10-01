# camera_proj — Formação de imagens / Camera projection

Standalone PT-BR/EN photogrammetry teaching simulator. Runs entirely in the browser,
with local Three.js assets and no runtime network dependencies. Serve the monorepo
root over HTTP (for example `python -m http.server 8000`) and open
`http://localhost:8000/camera_proj/`. ES modules require HTTP; opening `index.html`
as a `file://` URL is not supported.

## Explore / Explore

- Passe o cursor sobre qualquer face do cubo para destacar um ponto, seu raio e sua
  projeção. Clique para fixar. A lista de vértices também permite selecionar pelo
  teclado. / Hover over any cube face to highlight a point, ray and projection.
  Click to pin; the vertex menu provides keyboard selection.
- Arraste o mundo 3D para inspecionar a geometria; isso não altera a pose da câmera
  simulada. / Orbit the inspection view without changing the simulated camera.
- Compare o plano físico invertido (padrão) ao plano virtual de OpenCV. /
  Compare the inverted physical plane (default) with OpenCV's virtual plane.
- Reduza a resolução e selecione a imagem pixelada. Altere a distorção separadamente.
  / Lower the resolution and select pixel sampling. Change distortion separately.
- Edite posição, orientação, sensor, focal, ponto principal e cubo. O botão para
  apontar ao objeto altera somente a orientação. / Edit camera pose, sensor, focal
  length, principal point and cube. The look-at button changes orientation only.

The image preview also supports hover/click selection. A camera detail inset shows
the sensor at its true geometric size without enlarging its physical dimensions.
Occluded projections use a hollow dashed overlay: the opaque image itself does
not contain hidden features. Points behind the camera or at zero depth are not
projected; off-sensor points remain available in the numeric readout.

## Model and conventions

Main reference: [OpenCV 4.13, Camera Calibration and 3D Reconstruction](https://docs.opencv.org/4.13.0/d9/d0c/group__calib3d.html).
Axes follow the [OpenCV camera convention](https://docs.opencv.org/4.13.0/d5/d1f/calib3d_solvePnP.html):
X right, Y down, Z forward. The world frame initially coincides with the camera.
World lengths are meters; focal length, sensor dimensions and principal-point
offsets are millimeters. Angles are degrees and distortion coefficients are
dimensionless.

The default camera center is C = (0, 0, 0) with identity rotation. The cube has six
distinct face colors, side 1 m, center (0, 0, 5 m), and active XYZ rotation
(20°, 30°, 0°). The sensor is exactly **35 × 24 mm**, focal length **50 mm**,
principal-point offset zero, and nominal resolution **700 × 480**.

### Pose

`Pc = Rwc (Pw − C)`, `t = −Rwc C`. The camera position controls edit **C**, never
OpenCV's `tvec`. Internal quaternions are normalized, scalar-first `[w,x,y,z]`,
and represent **camera → world**. The displayed/editable `Rwc` represents the
inverse, **world → camera**. Matrices are stored row-major.

Photogrammetric angles use the explicitly defined passive convention
`Rwc = Rκ Rφ Rω`, with elementary matrices:

```text
Rω = [[1, 0, 0], [0, cosω, sinω], [0, −sinω, cosω]]
Rφ = [[cosφ, 0, −sinφ], [0, 1, 0], [sinφ, 0, cosφ]]
Rκ = [[cosκ, sinκ, 0], [−sinκ, cosκ, 0], [0, 0, 1]]
```

Equivalently, camera-to-world orientation is the active product
`Qcw = Rx(ω) Ry(φ) Rz(κ)`. This convention is defined explicitly because axis
directions, signs and rotation order vary between photogrammetric packages.
At Euler gimbal lock, an equivalent representation with κ = 0 is displayed;
the stored orientation stays valid. Invalid rotation matrices are rejected
(orthogonality and determinant +1 checked to 1e−5). Nonzero quaternion inputs
are normalized. Look-at preserves the projected previous camera Y direction when
possible and uses a deterministic fallback at a parallel direction.

### Intrinsics, distortion and physical image

For `x = Xc/Zc`, `y = Yc/Zc`, `r² = x²+y²`:

```text
a  = 1 + k1 r² + k2 r⁴ + k3 r⁶
xd = x a + 2 p1 x y + p2 (r² + 2 x²)
yd = y a + p1 (r² + 2 y²) + 2 p2 x y
```

OpenCV coefficient order is `[k1,k2,p1,p2,k3]`. The two-radial-coefficient model
sets tangential coefficients and k3 to zero; the four-coefficient model sets k3
to zero. Disabling a coefficient preserves its entered value for later reuse.

`fx = f W / sensor_width`, `fy = f H / sensor_height`,
`cx = (W−1)/2 + Δx W/sensor_width`, and
`cy = (H−1)/2 + Δy H/sensor_height`.
Pixel centers use integer indices; image edges lie at −0.5 and N−0.5.
Height is `round(W × sensor_height/sensor_width)`, so aspect-ratio preservation
is subject to integer rounding. Actual horizontal and vertical pixel pitches
are shown, including any rounding difference.

The virtual image point is `(f xd, f yd, +f)` in camera coordinates. The physical
point is its negative, behind the pinhole. The displayed physical image uses
the same positive X/Y directions, exposing the 180° inversion:
`uphysical = W−1−uOpenCV`, `vphysical = H−1−vOpenCV`.
The physical sensor center is displaced by `(Δx,Δy,−f)`; the virtual center by
`(−Δx,−Δy,+f)`. Thus principal-point changes affect the image, sensor rectangle
and markers consistently. OpenCV coordinates remain visible in both modes.

The ideal ray is straight. A separate green segment on the plane illustrates
the distortion displacement; this is a coordinate mapping, not lens ray tracing.
FOV readouts and frustum lines describe the **undistorted** geometry, including
principal-point shift. Angular spans are computed from the two sensor edges
rather than assuming a centered sensor.

### Rendering and scope

The image shader inverse-maps each sample through the distortion model and
intersects an oriented opaque cube. It therefore distorts complete face boundaries
and handles occlusion, rather than just shifting vertices. Newton inversion uses
up to 20 iterations. Strong/non-invertible distortion can leave empty pixels;
sampled Jacobian/inversion checks warn about these regions, but are not a proof
of global bijectivity. Coefficients should describe a physically plausible lens.

Pixel mode samples pixel centers and uses nearest-neighbor display. Continuous
mode evaluates the same geometry on a finer display grid; a screen cannot show
a mathematically continuous image. Pixel sampling and distortion are independent.
There is no exposure, aperture, depth-of-field, blur, noise, demosaicing or
radiometric model. Sensor and focal controls are geometric parameters.

## Validation

Numerical tests need Node.js 20+ and no package install:

```sh
node --test camera_proj/tests/model.test.mjs
```

The checked-in reference contains **144 projections in 24 cases**, generated by
actual `cv2.projectPoints` from OpenCV 4.13.0, with canonical and translated/rotated
cameras, all distortion models, nonzero principal-point offsets and multiple
resolutions. Reference generation does not import the simulator implementation.
Agreement tolerance is 1e−8 pixels. Regenerate with:

```sh
python -m pip install opencv-python-headless==4.13.0.92
python camera_proj/tests/generate_opencv_fixture.py
```

Browser checks start their own local HTTP server and use Chromium:

```sh
npm ci --prefix camera_proj
npx --prefix camera_proj playwright install chromium
npm run test:browser --prefix camera_proj
```

Set `CAMERA_PROJ_SCREENSHOTS=/absolute/output/directory` to keep screenshots.
The checks exercise actual mouse picking and pinning, orbit independence, exact
physical/virtual image inversion, shader/CPU pixel agreement, each rotation
editor, invalid input, look-at, PT-BR/EN, and mobile layout. They also assert no
runtime external requests or browser errors. Software WebGL is enabled for CI.

## Files

- `model.mjs`: independent numerical model and geometry.
- `image-renderer.mjs`: image-formation shader.
- `viewer.mjs`: 3D inspection, true-scale inset and picking.
- `app.mjs`, `index.html`, `style.css`, `i18n.mjs`: interface and translations.
- `tests/`: OpenCV provenance, numerical references and regression checks.
- `vendor/`: Three.js **0.160.1** and matching OrbitControls, MIT license included.
  Files originate from the versioned npm distribution via jsDelivr. OrbitControls'
  import path points to the local `three.module.min.js`; trailing whitespace is trimmed.
