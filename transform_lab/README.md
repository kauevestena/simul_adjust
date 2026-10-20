# transform_lab

[Português](README.pt-BR.md) · English

A bilingual (PT-BR / EN) laboratory for the course *Ajustamento de Observações 2*: transform
between **two sets of the same points in different frames** with 3 rotations, 3 translations
and an optional scale factor, adjusted by the **combined** (Gauss–Helmert) and the
**parametric** (Gauss–Markov) methods. The lab also hunts **gross errors** (data snooping,
Pope's τ, the kσ rule, RANSAC) and fits the **plane of the sheet** to show the total-station error.

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
| `index.html` | The simulator: observations, the workflow (adjust → detect outliers → deactivate → adjust again), the global test; 2D sheet, 3D station, sheet plane, 1D residuals, points, results and settings tabs |
| `teoria.html` | Theory: the 3D transformation in matrix **and** scalar form (elements of R for every parametrization, small angles, partial derivatives), both methods per point, constraints, statistics, propagation, the sheet plane, outlier detection, references |
| `comparacao.html` | Any two configurations A × B on the same data and draws; ready-made pairs (applied at once) and an edit dialog (applied with ▶ Compare) |

The look follows `ajusta_planos` (stone/teal palette, Inter and JetBrains Mono, cards, numbered
workflow, pill tabs), in plain CSS with the fonts vendored: the pages make **no external requests**.
The top bar has ← Simulators (back to the portal), Theory and Comparison, and the PT/EN switch.
Language: `?lang=` → shared `localStorage['monorepo_lang']` → `navigator.language`; every link
keeps `?lang=`. Dark mode follows the system.

## Workflow

As in `ajusta_planos`, **nothing is computed until ▶ Run adjustment** is pressed. Changing the data
or any setting discards the previous result ("Waiting for the adjustment…"); the views keep showing
the data and step 1 of the workflow turns amber.

1. **Model**: method, rotation parametrization, scale, check-point percentage, distance constraints → ▶.
2. **Outlier detection**: choose the method → ⚠ Detect outliers. It only *flags* points (rose).
3. **Deactivate flagged** (or untick *Active* in the ☰ Points tab) / **Reactivate all**.
4. Run the adjustment again.
5. Export the per-point results and the parameters with their VCM (CSV).

Secondary settings (instrument σ, reference VCM, advanced model options, seeds, test levels, RANSAC,
output unit) are in the ⚙ Settings tab.

## Data

The sample buttons load `data/ATV-AJ_56.csv` (the **default**), `data/ATV-AJ.csv` (70 points, with
the shifted block) or the simulated `data/sample_ts_raw.csv`; *Load your own file* reads the same
formats. The *Synthetic generator* (collapsed) holds the simulation scenario and applies it with
↻ Generate observations. ⚠ Simulate a gross error adds kσ to one raw observation (S, Hz or Z) of the
chosen points without telling the stochastic model; *Remove injected errors* undoes it.

**Import format.** Columns: *Point ID; Azimuth; Zenith Angle; Slope Distance* (optional σ columns after them). The azimuth origin is arbitrary. An ID with no match in the reference is only transformed (never in the adjustment, never a check point); the option "numeric IDs follow the grid order" is off by default. Changing units, file options or instrument precision re-parses the loaded file.

**Real example.** `data/ATV-AJ.csv` is the original job file `foundation/inputs/ATV-AJ.txt` converted with `node transform_lab/scripts/convert_job.mjs <job.txt> <out.csv>`: the grid was scanned in serpentine order from the bottom row (left→right, then right→left…), so the script assigns the names A0…R2 accordingly (a repeated job ID is a re-shot: the later reading is kept). `data/ATV-AJ_56.csv` keeps only the first 8 scan lines (`--rows 8`, 56 points): the last 14 points (IDs 57–70) sit about 10 mm away from the others as a block (the sheet or the instrument moved), so the 70-point file is a ready-made example of a gross error. The "numeric IDs follow the grid order" option assumes row-major order and does not fit such a file.

**Pointing error.** Reflectorless, 2″ at 8 m are only 0.08 mm across the line of sight, while a
printed cross is pointed to a few tenths of a millimetre. The instrument settings have a
*pointing σ* `p` (mm), added in quadrature as `p/S` (and `p/(S sinZ)` for Hz). The ATV-AJ buttons set
`p = 0.4 mm`, which gives `σ̂₀² ≈ 0.95` on the 56 clean points (with `p = 0` it would be 10.7).

## Model

`x_T = t + λ R(p) x_S`, with `x_S` the printed coordinates and `x_T` the total-station ones
(`teoria.html` §3 writes it in matrix and scalar form).

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
- **Total-station stochastic model**: `σ_S = a + b·S` (2 mm + 2 ppm), angles 2″ by default plus the
  pointing σ, full 3×3 covariance per point (a “cigar” along the line of sight), or its diagonal only.
- **Reference stochastic model**: `σ = 0.1 mm` per point (an educated guess) plus an optional
  printer-scale uncertainty in ppm. The simulation can use a *true* printing error different from
  the declared one.

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

## Outlier detection

Every method tests the **raw observations** (Hz, Z, S) of each control point and flags the whole
point (as `intersecao_re_3D` does). From the adjustment, `g_i = (BᵀK)_i` and `H_i = B_iᵀ Q_K B_i` for
the three station coordinates of point `i`, and with the polar Jacobian `J_i`:
`w_k = (J_iᵀg_i)_k / √(J_iᵀH_iJ_i)_kk`, the redundancy number `r_k = σ_k²(J_iᵀH_iJ_i)_kk` (they add up
to `r`) and the minimal detectable error `∇₀_k = δ₀ σ_k/√r_k`. Coordinate files (and the diagonal VCM)
test `x, y, z` instead.

| Method | Rule |
|---|---|
| Iterative data snooping (Baarda) | `σ₀` known a priori; adjust, remove the point with the largest `\|w\|` above `z(1 − α₀/2)` (3.29 for `α₀ = 0.1 %`), adjust again… An essential point is kept. |
| Pope's τ test | One pass, `\|τ\| = \|w\|/σ̂₀` above `τ_c = t√r/√(r − 1 + t²)`. |
| kσ rule | `\|v\|/σ > k` with the nominal σ. |
| RANSAC | Horn's closed form on 3 random control points (seeded); consensus by the Mahalanobis length of each discrepancy (< `k_R` σ, default 8); the largest consensus is re-adjusted and each point outside it is flagged if its discrepancy fails `χ²(3)` at `α₀`. |

**The ATV-AJ case** (70 points, all as control): `σ̂₀² ≈ 20`, `δλ ≈ −15 000 ppm`. RANSAC flags exactly
the 14 shifted points; iterative snooping removes those 14 first and then 6 good ones (swamping);
Pope's τ finds nothing because `σ̂₀` is inflated by the block (masking); the kσ rule flags almost
everything. Without the block, `δλ ≈ −3200 ppm` (the paper shrinkage) and `σ̂₀² ≈ 1.1`. With the
default 20 % of check points, 3 of the 14 are check points and fail the joint check test instead.

## The plane of the sheet

The sheet is flat, so a plane fitted **to the total-station observations alone** (every active point,
matched or not; combined model `n·xᵢ − d = 0` with `‖n‖ = 1`, full `Σ_T`) shows the station error in
depth: the distance `dᵢ` of each point to the plane, with `σ_d² = nᵀΣᵢn ≈ σ_S²` when the station faces
the sheet. The ▭ Sheet plane tab maps `d` (or `w`) as seen from the station, with an IDW surface; the
3D view draws the plane and the exaggerated deviations; the histogram compares `d` with the nominal
σ along the normal. On ATV-AJ (56): RMS `d ≈ 0.67 mm` against a nominal 1.90 mm — the EDM is much better
than 2 mm + 2 ppm at 8 m. The plane does not flag the ATV-AJ block: that shift happened within the
plane of the sheet. Deactivated points leave both adjustments.

## About the printed precision

Nothing normative exists for an A4 laser print, so the defaults are didactic. What was found: image
placement is specified at about ±5 mm with ≈ 1 mm page to page; the random placement of dots is limited
by the 21–42 µm pixels (1200–600 dpi); the paper shrinks in the fuser by roughly 0.1–0.5 %
(≈ 600–700 µm on light paper), more across the feed; a hobbyist measured 0.4 mm and ≈ 1 mm over a
laser-printed A4. So 0.1 mm random error is reasonable, but a **systematic scale error of
1000–5000 ppm** would dominate it: that is why the scale is estimated and why the lab has a dense `Σ_S`.
Sources are in `teoria.html` §13.

## Validation

```sh
npm install --prefix transform_lab                      # playwright only
npm test --prefix transform_lab                         # node:test (unit, oracle, plane, outliers, i18n)
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
- `tests/plane.test.mjs`: the plane equals the PCA plane for isotropic Σ, `Σrᵢ = m − 3`, Monte Carlo
  `σ̂₀² ≈ 1`, a 10σ blunder gives the largest `|w|`.
- `tests/outliers.test.mjs`: Student t and τ critical values, redundancy numbers add up to `r`, a 20σ
  distance blunder is found by snooping with `S` as the worst observation, RANSAC isolates the
  ATV-AJ block exactly, excluded points.
- `tests/rotations.test.mjs` also checks that the formulas printed on the theory page (elements of R,
  Euler derivatives, small angles) are the ones the code uses.
- `tests/browser.cjs`: all pages, the run-on-demand workflow, detection and deactivation, blunder
  injection, zero external requests, language behaviour, downloads, import, 390 px.

The adjustment inverts `M = BΣBᵀ` block by block (it is block diagonal unless distance constraints or
a dense `Σ_S` link the points) and works on the sparse rows of `B`, so one run on 70 points takes a
few tens of milliseconds on a laptop and iterative snooping can repeat it many times.

## Structure

```
index.html teoria.html comparacao.html  pages          app.mjs compare.mjs theory.mjs
i18n.mjs words.mjs                       PT/EN dictionary
core/                                    pure maths (no DOM): linalg, lsq (Gauss–Helmert), transform, rotations,
                                         reference, simulate, propagate, pipeline, io, stats, rng, units,
                                         plane (sheet plane), reliability (Hz/Z/S tests), outliers (detectors)
views/                                   2D sheet, 3D (three.js), sheet plane, histogram
vendor/                                  three.js r160, KaTeX 0.16.9, Inter, JetBrains Mono (see THIRD_PARTY.txt); no CDN
data/ scripts/ tests/ foundation/        sample data, generators, tests, the printable target
```

## Not modelled

Instrument and target heights, refraction and curvature, centring and levelling of the instrument, the
incidence angle effect on reflectorless distances (the app warns when it grows at grazing incidence), and
anisotropic printer scale (`x` and `y` can differ, but not skew).
