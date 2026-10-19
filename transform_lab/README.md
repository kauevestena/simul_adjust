# transform_lab

[Português](README.pt-BR.md) · English

A bilingual (PT-BR / EN) laboratory for the course *Ajustamento de Observações 2*: transform
between **two sets of the same points in different frames** with 3 rotations, 3 translations
and an optional scale factor, adjusted by the **combined** (Gauss–Helmert) and the
**parametric** (Gauss–Markov) methods, and compare the results.

- **Reference set**: the printed A4 grid of [`foundation/target_grid`](foundation/target_grid)
  (70 vertices A0…R2, 3 cm apart, in **centimetres**), stuck on a rigid, flat surface.
- **Second set**: the same vertices measured **reflectorless** with a total station, in **metres**
  (raw azimuth, zenith angle and slope distance → local coordinates with the propagated VCM, as in
  [`shared/total_station.mjs`](../shared/total_station.mjs)).

Open `index.html` through a web server (`python3 -m http.server` from the repository root, then
`http://localhost:8000/transform_lab/`); ES modules do not load from `file://`.

## Pages

| Page | What it does |
|---|---|
| `index.html` | The simulator: data (simulation or import), model, check points, distance constraints; 2D sheet view, 3D station view, residual histogram, results, per-point table |
| `teoria.html` | Theory: both models in matrix **and** algebraic form, rotation parametrizations, constraints, statistics, propagation, references |
| `comparacao.html` | Any two configurations A × B on the same data and draws; ready-made pairs and an edit dialog |

The top bar has ← Simulators (back to the portal), Theory and Comparison, and the PT/EN switch.
Language: `?lang=` → shared `localStorage['monorepo_lang']` → `navigator.language`; every link
keeps `?lang=`.

## Model

`x_T = t + λ R(p) x_S`, with `x_S` the printed coordinates and `x_T` the total-station ones.

- **Frames: all right-handed.** Sheet: `x` right, `y` up, `z` out of the sheet. Total station:
  `X` at `Hz = 90°`, `Y` at `Hz = 0°` (the circle zero, which is arbitrary: a different origin only rotates the frame about `Z`, and the transformation rotation absorbs it), `Z` up; `X = S sinZ sinHz`,
  `Y = S sinZ cosHz`, `Z = S cosZ`. (Until October 2026 `intersecao_re_3D` and `ajusta_planos`
  used the left-handed swap of this frame; they were fixed together with this lab and their tests
  check agreement with `shared/total_station.mjs`.)
- **Units and scale.** Choose the unit of each set and of the output. With `λ` estimated, the unit
  ratio is absorbed by the scale (cm → m gives `λ ≈ 0.01`) and `δλ = λ/λ₀ − 1` is reported in ppm;
  alternatively convert the reference first (`λ ≈ 1`), or fix `λ` (rigid motion, 6 parameters).
- **Combined vs parametric.** Parametric: the reference is a constant, only the total-station
  points are observed. Combined: both sets are observed, each with its own variance–covariance
  matrix (the reference may even be dense, through the uncertain printer scale). Expect `σ̂₀² ≈ 1`
  in the combined model and `> 1` in the parametric one when the sheet has printing error.
- **Rotation parametrizations**: Euler angles ω-φ-κ (default, no constraints), quaternion (`‖q‖ = 1`),
  rotation matrix (6 orthonormality constraints), axis–angle (`‖n‖ = 1`). Each can be run without its
  constraints to see the singularity. Presets show the Euler **gimbal lock** (sheet in landscape on
  a wall) and the axis–angle singularity (`θ = 0`).
- **Total-station stochastic model**: `σ_S = a + b·S` (2 mm + 2 ppm), angles 2″ by default, full 3×3
  covariance per point (a “cigar” along the line of sight), or its diagonal only.
- **Reference stochastic model**: `σ = 0.1 mm` per point (an educated guess) plus an optional
  printer-scale uncertainty in ppm. The simulation can use a *true* printing error different from
  the declared one.

**Import format.** Columns: *Point ID; Azimuth; Zenith Angle; Slope Distance* (optional σ columns after them). The azimuth origin is arbitrary. An ID with no match in the reference is only transformed (never in the adjustment, never a check point); the option "numeric IDs follow the grid order" is off by default.

**Data source.** *Import a file* is the default and the sample file (`data/sample_ts_raw.csv`) is preloaded; options that only make sense for simulated data (scenario, seed, geometry, collected %, extra points, true printing error) are hidden until you choose *Simulation*. Changing units or instrument precision re-parses the loaded file.

### Constraint equations (*injunções*)

Distances between sheet points are known very well (`d_ij`, with `σ_d` propagated from the
reference VCM). `data/reference_distances.csv` (also downloadable in the app) lists all 2415 pairs.
They act as equations on the **total-station points** during the adjustment:

- sets: all pairs · neighbours with diagonals (231) · horizontal and vertical neighbours (123) ·
  a random percentage;
- **relative** (the distance is an observation with `σ_D = factor · σ_d`) or **absolute** (exact,
  Lagrange multipliers);
- dependent equations are removed (only `2m − 3` distances of a planar set are independent; the
  neighbour network already fixes the shape, so “all pairs” adds nothing).

What they do: in the **parametric** model the adjusted points are a copy of the reference, so all
absolute constraints reduce to `λ = λ₀` (and are satisfied automatically in rigid mode). In the
**combined** model they lock the shape of the adjusted reference, pulling it towards the parametric
result. See `teoria.html` §8 for the caveats (information counted twice, bias with a true scale error).

### Check points and unmatched points

A random 0–90 % (5 % steps), plus click-to-toggle in the 2D view, are kept out of the adjustment and
of the constraints and validated with the full joint covariance (in-plane and normal parts reported).
Reference points that were not collected are only transformed, and total-station points with no
counterpart are transformed back to the sheet, both with propagated covariance.

## About the printed precision

Nothing normative exists for an A4 laser print, so the defaults are didactic. What was found: image
placement is specified at about ±5 mm with ≈ 1 mm page to page; the random placement of dots is limited
by the 21–42 µm pixels (1200–600 dpi); the paper shrinks in the fuser by roughly 0.1–0.5 %
(≈ 600–700 µm on light paper), more across the feed; a hobbyist measured 0.4 mm and ≈ 1 mm over a
laser-printed A4. So 0.1 mm random error is reasonable, but a **systematic scale error of
1000–5000 ppm** would dominate it: that is why the scale is estimated and why the lab has a dense `Σ_S`.
Sources are in `teoria.html` §11.

## Validation

```sh
npm install --prefix transform_lab                      # playwright only
npm test --prefix transform_lab                         # node:test (unit, oracle, i18n)
npm run test:browser --prefix transform_lab             # Playwright (CHROME_PATH=… for a system Chrome)
python3 transform_lab/tests/generate_reference.py       # regenerate the NumPy oracle
npm run data --prefix transform_lab                     # regenerate data/*.csv
```

- `tests/oracle.test.mjs` compares nine cases (both methods, Euler and quaternion, rigid, dense `Σ_S`,
  absolute and relative constraints) with `tests/numerical-reference.json`, produced by
  `generate_reference.py`: an independent NumPy implementation with finite-difference Jacobians, cross-checked
  by a plain weighted Gauss–Newton.
- `tests/core.test.mjs`: noise-free recovery for every parametrization × method × scale mode,
  parametrization invariance, combined → parametric when `Σ_S → 0`, constraint behaviour, gimbal lock and
  singular cases, Monte Carlo (`E[σ̂₀²] ≈ 1`, check-point coverage).
- `tests/browser.cjs`: all pages, zero external requests, language behaviour, downloads, import, 390 px.

## Structure

```
index.html teoria.html comparacao.html  pages          app.mjs compare.mjs theory.mjs
i18n.mjs words.mjs                       PT/EN dictionary
core/                                    pure maths (no DOM): linalg, lsq (Gauss–Helmert), transform, rotations,
                                         reference, simulate, propagate, pipeline, io, stats, rng, units
views/                                   2D canvas, 3D (three.js), histogram
vendor/                                  three.js r160, KaTeX 0.16.9 (see THIRD_PARTY.txt); no CDN
data/ scripts/ tests/ foundation/        sample data, generators, tests, the printable target
```

## Not modelled

Instrument and target heights, refraction and curvature, centring and levelling errors, the incidence
angle effect on reflectorless distances (the table preset warns it grows at grazing incidence), and
anisotropic printer scale (`x` and `y` can differ, but not skew).
