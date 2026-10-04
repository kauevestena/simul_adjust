**English** · [Português (BR)](readme.pt-BR.md)

A 3D free-station network (interseção a ré 3D) adjusted by least squares. Total-station
sightings — horizontal reading, zenith angle and slope distance, each with its own standard
deviation — tie free stations to each other and to fixed points. Students pick the model and the
datum:

- **combined** (Gemael's "método combinado", Ghilani's "general least squares") or
  **parametric** (Gauss–Markov);
- **fixed points**, **free network** (inner constraints) or **minimal constraints** (the first
  station's pose held fixed).

The simulator computes initial approximations, adjusts the network, tests it and reports
coordinates, error ellipsoids, residuals, every matrix of the adjustment and a PDF report. The
**Explicação dos Modelos** button opens `modelos.html`, which derives the equations and the
Jacobians A and B of all four variants.

Serve the repository root over HTTP (`python3 -m http.server`) and open
`intersecao_re_3D/index.html`; the sample is read with `fetch`.

**Language:** the interface, the report (PDF/text), messages, the output CSVs and the models page
are bilingual (PT-BR and EN). The language comes from `?lang=`, then `localStorage`
(`monorepo_lang`), then the browser, and the PT/EN button switches it on the spot.

## The model

Each sighting from station *i* to point *j* gives three implicit condition equations, one per
component of the radiated vector:

```
F1 = Xj − Xi − S·sinZ·cos(Hz + ωi) = 0
F2 = Yj − Yi − S·sinZ·sin(Hz + ωi) = 0
F3 = Zj − Zi − S·cosZ              = 0
```

Observations `La = (Hz, Z, S)` and unknowns `Xa` (station and free-point coordinates plus one
orientation `ω` per station) are mixed inside `F(La, Xa) = 0`, which is what calls for the
combined model. Fixed points enter as constants.

| matrix | what it is here |
|---|---|
| `A = ∂F/∂Xa` | +I at the target (if free), −I at the station, and the `ω` column `[S sinZ sinα, −S sinZ cosα, 0]` |
| `B = ∂F/∂La` | block-diagonal 3×3: the Jacobian of the polar → Cartesian radiation, the same one `ajusta_planos` uses |
| `M = B P⁻¹ Bᵀ` | block 3×3 per sighting: the Cartesian MVC of the radiated vector (`Σ_XYZ` in `ajusta_planos`) |
| `W` | Gemael's iterated misclosure `F(L0, X0) + B(Lb − L0)` |

`N = AᵀM⁻¹A`, `U = AᵀM⁻¹W`, `X = −N⁻¹U`, `K = −M⁻¹(AX + W)`, `V = P⁻¹BᵀK`, `La = Lb + V`, then
relinearise at `(La, Xa)`. In Ghilani's notation (ch. 22) the same solution reads `J = A`,
`K = −W`, `We = M⁻¹`.

Convergence: max |Δcoordinate| < 0.01 mm **and** max |Δω| < 0.01″ (both editable), at most 25
iterations. Every iteration's corrections, `VᵀPV` and ‖W‖ are kept and reported.

### The parametric alternative

The parametric model writes each observation as an explicit function of the unknowns:
`Hz = atan2(ΔY, ΔX) − ω`, `Z = atan2(h, ΔZ)`, `S = |Δ|`, with `V = AX + L`, `L = L0 − Lb`,
`N = AᵀPA`, `U = AᵀPL`, `X = −N⁻¹U`. It is the combined model with `F = f(Xa) − La`, that is
`B = −I`, `M = P⁻¹`, `W = L`, so `adjustment.js` runs both through the same iteration loop:
only the per-sighting blocks differ.

At convergence the two describe the same least squares problem
(`A_par = −B⁻¹A_comb ⇒ AᵀPA = AᵀM⁻¹A`), and they agree to ~1e-13 in coordinates and residuals.
`test_adjust.js` checks this both through the app's parametric model and against an
independent Gauss–Markov solve written in the test.

### Datum: fixed points, free network or minimal constraints

The observations are blind to a translation of the whole network and to a rotation about the
vertical, with every ω turning along. Distances fix the scale and zenith angles the vertical.
So with every point unknown, N has a **rank defect of 4**.

- **Fixed points** enter as constants, so their columns leave A. At least 2 are needed: one
  fixes the translations, not the rotation. `dof = n − u`.
- **Free network**: every point is an unknown, including the support points. Their coordinates
  serve only as approximations; with none, the first station seeds them at the assumed datum.
  - The defect is removed by **inner constraints** `GᵀX = 0`, where G is the null space with the
    ω rows zeroed. The bordered system `[N G; Gᵀ 0]` is solved, and Q, the top-left block of its
    inverse, gives `Σ_Xa = σ̂₀²Q`. `dof = n − u + 4`.
  - Among all datum choices, this solution has the minimum trace of Σ_Xa over the coordinates.
  - G is built once at the approximations, so the adjusted network keeps their centroid and mean
    orientation exactly, whichever model is used.
- **Minimal constraints**: exactly the 4 constraints of the rank defect, no surplus. The first
  station (the origin) has `X, Y, Z` and `ω` held constant at the "Datum local assumido" values
  (default `0, 0, 0, 0`); every other point, support points included, is an unknown. N has full
  rank, `dof = n − u`.
  - Same solution as the free network under the constraint `CᵀX = 0` (C selects the origin's
    `X, Y, Z, ω`): an S-transformation `S = I − H(CᵀH)⁻¹Cᵀ`. Residuals, VᵀPV, redundancy numbers,
    point-to-point distances (and their precision) agree with the free network; coordinates, σ and
    ellipsoids change — the origin has σ = 0 and the Σ trace is larger than the free network's
    minimum.
  - Unlike two fixed points there are no extra constraints, so no sighting loses redundancy and no σ
    is cut by coordinates that actually came from the observations.
  - CSV coordinates of "Fixo" points are not used; approximations start from the origin station.

The **Comparar Modelos** tab runs the four variants side by side.
- Between models with the same datum, everything agrees.
- Between datums, residuals, VᵀPV and point-to-point distances agree, while coordinates, σ,
  ellipsoids and dof change.
- It also runs the fixed-point compatibility test, `ΔVᵀPV = VᵀPV_fixed − VᵀPV_free ~ χ²` with
  `dof_fixed − dof_free` degrees of freedom.

On the sample, the free network has dof 13 (72 − 63 + 4) against 15, and the minimal constraints
also 13 (72 − 59, A fixed at the origin). VᵀPV is the same 193.585 in all three, and ΔVᵀPV = 0,
because M01/M02 come from A's own sightings.

### Conventions

The radiation follows `ajusta_planos/io.js`: `X` along the circle zero, `Y` along Hz = 90°
(clockwise), `Z` up. Angles are decimal degrees, distances metres. That frame is left-handed;
the 3D view draws `(Y, X, Z)` and the plan view puts X up and Y right so the network is not
mirrored. Instrument and target heights are not modelled — the sightings are taken as
instrument centre to target point. Earth curvature and refraction are ignored, which is right
for local networks like the sample (≤ 15 m); for long sightings see Ghilani ch. 23.

## Input CSV

```
Estacao,Ponto Visado,Leitura Horizontal,desvio padrão H,Ângulo Zenital,desvio padrão V,Distância Incinada,desvio padrão D,Fixo,X,Y,Z
```

- Headers are matched ignoring case and accents ("Incinada" and "Inclinada" both work); without
  a recognisable header the columns are read in this order. `;` with decimal comma also works.
- Angular standard deviations are in **arcseconds** by default (a Settings switch accepts
  degrees); the distance one is in metres. Blank or ≤ 0 falls back to the nominal value, with a
  warning.
- `Fixo` accepts `sim/não`, `true/false`, `1/0`. It is a property of the *point*; if rows
  disagree the point is treated as fixed and a warning is logged.
- `X,Y,Z` are optional and only read on fixed-point rows. Blank means "not given".

### Fixed points without coordinates: the datum rule

A fixed point with no X,Y,Z is computed **by radiation from the single station that observes
it** — the 3D surveying equations above, as in `ajusta_planos`. Only one such origin station is
supported, and a coordinate-less fixed point seen from two stations is rejected, because there
would be no way to choose. The origin station's pose comes from a resection when it sees at
least two fixed points that do have coordinates; otherwise from the **assumed local datum** in
Settings (default X = Y = Z = 0, ω = 0: the instrument at the origin, as in `ajusta_planos`).

Two fixed points are enough. Distances fix the scale and zenith angles the vertical, so the
datum defect of a total-station network is 4 (three translations and the rotation about the
vertical), and two known points remove all of it.

When the datum comes from those same sightings, their residuals are zero by construction: the
coordinates were derived from them and nothing else in the network pulls on that station's pose.
The log says so.

## The sample

`inputs/observations.csv`: stations A, B, C chained through shared points, 24 sightings. A sees
the fixed points M01, M02 and the points M03, 00d, 00e, 00f; B sees 00d, 00e, 00f and six more;
C shares 17, 37, 16, 12 with B and adds five. That is 72 equations, 57 unknowns,
**15 degrees of freedom**.

Two edits were made to the file as delivered:

- **`A,00f` Hz: 227.578240740741° → 47.578240740741°.** The reading was 180° off — an unreduced
  face II reading. Reduced by 180°, the 00d–00f and 00e–00f distances seen from A match those
  seen from B within 2 mm; as delivered they disagreed by 19.5 m. The approximation stage now
  detects exactly this and points at the right sighting ("a diferença desaparece somando 180° à
  leitura horizontal de A→00f"), so the same mistake in a user file is caught before adjusting.
- **M03 is free** (`Fixo = não`); M01 and M02 are the fixed points. Empty `X,Y,Z` columns were
  appended to document the format.

Results with the default settings:

| σ source | σ̂₀² | global test | data snooping |
|---|---|---|---|
| CSV (default) | 12.91 | fails | flags B→16 (D, w = 9.46) and C→12 (Zen, w = 5.99) |
| max(CSV, nominal) | 0.78 | passes | nothing |
| nominal (2″, 2 mm + 2 ppm) | 0.90 | passes | nothing |

The CSV standard deviations are standard deviations of the mean of repeated readings —
0.15 mm on a distance, 0.3″ on an angle. As absolute precision they are optimistic. The same
points seen from B and C disagree by 2–4 mm, so the global test rejects the CSV figures and
accepts the nominal ones. That makes a good classroom case.

Seven points (00c, 36, 33, 30, 34, 39, 03a) and M03 are seen from a single station: three
observations, three unknowns, redundancy r = 0. The adjustment reproduces them exactly and no
blunder in them can ever be detected. The log lists them.

## Outlier detection

Run after the adjustment, then deactivate and re-run as often as needed:

- **Data snooping (Baarda)**, iterative: removes the sighting with the largest |w| and readjusts.
  If the network has no solution without that sighting (on the sample, B→17: without it C can
  no longer be resected), the sighting is **essential**. It is restored, reported in the detail
  and *not* flagged, so "Desativar marcadas" can never break the network.
- **Pope's τ test**: residuals standardised with σ̂₀ (a posteriori), single pass.
- **kσ rule**: |v| against the a priori σ of the observation itself.

RANSAC, offered in `ajusta_planos`, has no meaning for a network and is not offered here.

Flags are per component (Hz, Z, S) but deactivation is per sighting, because a sighting's three
condition equations share its three observations.

## Views

- **3D** (three.js): stations, fixed and free points, sightings (dashed when inactive, red when
  flagged), error ellipsoids from the 3×3 blocks of `Σ_Xa`. Exaggeration and confidence level
  (1σ, 95 %, 99 %, with χ² on 3 degrees of freedom) are adjustable. On each new data set the
  exaggeration is set so the largest ellipsoid spans about 5 % of the network.
- **2D** XY (plan), XZ and YZ. The ellipses are the **projections of the 3D ellipsoids**: the
  2×2 marginal block of Σ with the *same* k as the ellipsoid, which is exactly the outline of
  the ellipsoid's shadow. Along any in-plane direction both have the same support function
  `k√(dᵀΣd)`, and the tests check this. So at 95 % the factor is 2.796, not the 2.448 of a
  stand-alone 2D ellipse. The cuts can exaggerate Z, chosen automatically for flat networks;
  the ellipses follow (`DΣD`) and the Z labels stay in true metres.

## Outputs

- `coordenadas_ajustadas.csv`: point, type, X, Y, Z, σX, σY, σZ, ω and σω for stations, ellipsoid
  semi-axes and their confidence level.
- `residuos_observacoes.csv`: per sighting, adjusted Hz/Z/S, v, w, r and MDB for each component;
  units are in the column names.
- `matriz_<nome>.csv`: any matrix, with unknown/observation labels.
- `relatorio_ajustamento.pdf`: problem size, datum, stochastic model, approximation steps, the
  iteration table with the convergence criterion and outcome, global test, warnings and errors,
  every adjustment attempt in the session (failed ones too), coordinates, orientations,
  residuals, outlier detection, and the 3D and 2D views. It uses jsPDF + autotable and embeds
  DejaVu Sans from the CDN, because jsPDF's built-in fonts cannot print σ, ω, χ² or ″. Without
  that font it transliterates to ASCII; without jsPDF it offers the plain-text report.

File names and the observation-CSV headers stay in Portuguese so an export can be read back; the
coordinate and residual CSVs and the reports follow the UI language.

## Files

| File | Role |
|---|---|
| `io.js` | CSV parsing, settings, synthetic network generator, blunder injection, CSV writers |
| `adjustment.js` | network building, datum rule, approximations, combined and parametric models, fixed or free datum, model comparison, quality control, outlier detection, ellipsoids |
| `viewer3d.js` | three.js view |
| `views2d.js` | XY / XZ / YZ canvases |
| `report.js` | report model (pure data), text and PDF renderers |
| `modelos.html` | static page: models, equations, Jacobians, datum theory |
| `modelos_en.js` | English translation of the content of `modelos.html` |
| `i18n.js` | PT-BR / EN dictionary for the interface and the static HTML of `index.html` |
| `app.js` | state, tabs, tables, workflow |
| `test_adjust.js` | `node intersecao_re_3D/test_adjust.js` |

## References

- Gemael, C.; Machado, A. M. L.; Wandresen, R. *Introdução ao ajustamento de observações:
  aplicações geodésicas*, 2nd ed., Editora UFPR, 2015 — parametric and combined models, the
  iterated form.
- Ghilani, C. D.; Wolf, P. R. *Adjustment Computations: Spatial Data Analysis*, 4th ed., Wiley,
  2006 — ch. 19 (error ellipses), ch. 21 (blunder detection, internal reliability), ch. 22
  (general least squares), ch. 23 (3D geodetic networks).
- Caspary, W. F. *Concepts of Network and Deformation Analysis*, Monograph 11, School of
  Surveying, UNSW, 1987 — free networks, inner constraints, S-transformations.
