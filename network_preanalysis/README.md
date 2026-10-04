# Topographic Network Pre-Analysis / Pré-análise de Redes Topográficas

[Português](README.pt-BR.md) · English

A PT-BR/EN classroom laboratory for **designing** total-station networks before
fieldwork. A mostly full-screen 2D canvas controls one generic 3D ENU engine.
Open `network_preanalysis/` from the repository portal. Serve the monorepo root:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000/network_preanalysis/`. No build or runtime package
install is needed. Level 0 runs without external requests; Level 1 fetches public
AWS Terrarium elevation tiles. ES modules require HTTP, not `file://`.

## Explore

- **Select / move:** click a point or arrow for properties; drag points to redesign.
  Recompute occurs on drag end. Wheel zooms; right-drag pans; Fit frames the network.
- Add **Stations** or **Sighted-only points**. A directed sight begins at a station
  and ends at either point type. Reciprocal sights remain separate observations
  and are drawn with separate parallel arrows.
- Toggle direction, zenith and slope distance independently per sight. Set HI on
  the station and HT on each target; optionally override HT on an individual sight.
- Change each point between unknown, fixed and stochastic control. The ordinary
  start/finish buttons assign fixed control roles, not special point classes.
- Edit instrument presets, control standard deviations, confidence and graphical
  exaggeration. Inspect sigma E/N/U, orientation sigma, ellipses and component-wise
  redundancy/MDB. Select an MDB to show the coordinate disturbance vectors.
- Pin a before/after comparison, undo/redo edits, and save/load versioned JSON.
  Imported rural networks have heights and LOS re-evaluated; saved LOS is not trusted.
- The matrix dialog shows A, P, N and Sigma xx with labelled row/column ordering.
  Its preview is capped at 40 rows/columns; the JSON export contains full matrices.

There are five Level 0 examples: a GNSS start/finish traverse, deliberately weak
elongated geometry, resection, angular intersection and a mixed network. They are
graphs consumed by the same solver. The intersection includes control-to-control
direction sights that determine the two station orientations; two free orientations
and only one target direction each would not determine that target.

## Observation model and coordinates

Units are metres and radians internally; angular standard deviations are entered
in arcseconds, distance constant in mm, scale in ppm. All floating point is double
precision. Coordinates are **E, N, U of the ground point**. For i -> j:

```text
v = [Ej - Ei, Nj - Ni, Uj + HTj - Ui - HIi]
rho = hypot(vE, vN)
s = hypot(rho, vU)
d = atan2(vE, vN) - omega_i
z = atan2(rho, vU)
sigma_s = hypot(a/1000, b*1e-6*s)
```

Directions are clockwise from North. `wrapPi` handles angular differences across
zero. Analytic Jacobians are independent of the UI and checked against centered
finite differences. Purely vertical sights cannot supply direction/zenith
derivatives and are diagnosed. Zero-length, self, coincident and non-station-origin
sights are also diagnosed and excluded.

**xi = eta = 0**: the observation frame uses parallel local ENU Up. HI/HT are exact
offsets in this milestone; their measurement uncertainties are not yet propagated.
There is no curvature/refraction correction to the straight sight equations, no
station/prism centering, atmosphere, vertical deflection or GNSS baseline processing.
The observation-frame assumption is isolated in `network/observations.mjs`.

Level 0 initializes ground U = 0, but U remains an unknown coordinate in the
pre-analysis for every non-fixed point. Terrain elevations similarly provide
design coordinates, **not exact vertical constraints** on those unknowns.

For real terrain the WGS84 LLH -> ECEF -> ENU transformation uses an explicit local
origin, with tested inverses. The educational globe in `sistemas_coordenadas` uses
exaggerated scene geometry, so it cannot serve as a numerical transformation library.
The new functions use actual WGS84 dimensions and have equator/pole/axis/round-trip
regressions. Reference: [ESA Navipedia, ECEF/ENU transformations](https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates).

## Covariance, rank and datum

The unknown vector contains ENU coordinates of non-fixed active points and one
orientation per active station supplying usable direction observations. Fixed
coordinates are eliminated. Stochastic coordinates remain unknowns with three
pseudo-observations, including their full 3x3 ENU covariance when supplied in JSON.
The UI exposes diagonal control standard deviations; editing those explicitly
replaces imported off-diagonal terms, as the property panel explains.

No observation vector L or posterior variance factor is needed. With the a priori
observation covariance C = L L^T, whiten B = L^-1 A. Column equilibration S makes
metre/radian parameter scales comparable for numerical rank. Decompose B S by SVD:

```text
B S = U D V^T
Sigma_xx = S V D^-2 V^T S         (full column rank only)
N = A^T C^-1 A
```

The relative singular-value threshold is `100 * eps * max(n, u) * largest_sv`.
The right null space identifies affected points/orientations; disconnected graph
components are reported independently. If rank is deficient, no absolute coordinate
covariance, error ellipses or external displacement is reported. The residual-space
projector still supports redundancy/MDB. There is no hidden datum fixing or rule
requiring a second starting GNSS point. Regression: one fixed 3D start and one
fixed 3D finish, three intermediate stations, eight reciprocal sights, 24 components,
14 unknowns, rank 14, redundancy 10.

Covariance units reflect actual a priori variances (variance factor 1); calling it
Qxx would assume that convention. 1-sigma **2D** ellipses contain approximately
39.35% joint probability. The 95% ellipse factor is `sqrt(-2 ln .05) = 2.44774683`.
Ellipse azimuth is clockwise from North modulo 180 degrees. Footer uncertainties
always remain at 1 sigma; the display confidence only scales the ellipses/semiaxes.

## Reliability

P = C^-1, K = Sigma_xx A^T P and R = I - A K. Each **original observation component**
has redundancy `r_i = R_ii`; the total is `n - rank(A)`, including stochastic-control
coordinate rows. The interface reports sight-component and control-row counts
separately. With correlated observations, individual original-coordinate redundancy
numbers are not guaranteed to lie in [0,1]; their sum still has the stated trace.

MDB is a two-sided single-observation normal test with known a priori covariance.
The defaults are alpha = .001 and power = .8. Solve for delta >= 0 satisfying:

```text
P(|Z + delta| > Phi^-1(1 - alpha/2)) = power
w_i = [P - P A Sigma_xx A^T P]_ii
MDB_i = delta / sqrt(w_i)
```

For independent observations this is `delta * sigma_i / sqrt(r_i)`.
Unobservable gross errors (`w_i / P_ii <= 1e-10`) are labelled undetectable, never
displayed as a finite bias. External reliability is `dx = K[:, i] * MDB_i`, shown
with the same explicitly labelled graphical exaggeration as ellipses. This is a
single-bias sensitivity calculation, not simulated residuals, outlier detection,
family-wise multiple-testing control or a posterior hypothesis test.

## Shared rural terrain

`shared/terrarium.mjs` extracts the original `nivelamento` tile path, z=14 mapping,
RGB decode and floored nearest-pixel sampling. Both simulators call this loader.
It caches in-flight tiles, retries failures and rejects missing/nodata pixels.
The leveling UI now reports an elevation-loading failure rather than inserting a
fabricated 100 m height; its adjustment mathematics and presets are unchanged.

The rural scenario is centred at **25.454 S, 49.070 W**, with a 1300 x 1000 m local
working area. It uses the same dataset as leveling, without street constraints.
Source: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/),
[Tilezen format and encoding documentation](https://github.com/tilezen/joerd/blob/master/docs/formats.md).
No terrain tile assets are duplicated in the repository.

The scenario preserves terrain elevation **H**, assumed to be an orthometric
source height, separately from ellipsoidal **h** and local **U**. It explicitly
uses `h = H + N0`, with **N0 = 0 m as a didactic constant approximation**, not a
validated geoid model or an assertion that H and h are equivalent. Origin h0 is
the sampled origin H0 + N0. JSON can provide a different constant N0. The source
datum and vertical accuracy are insufficient for a survey-grade conversion;
the simulator is for geometry/design teaching. ECEF/ENU surface geometry is retained,
even though the local observation model uses parallel Up and straight sights.

For placement, intersect a local ENU vertical with the sampled terrain using the
inverse geographic transformation, iterating U. LOS samples the instrument-to-prism
segment at **half the z14 pixel spacing** (about 4.3 m here), including endpoints.
It reports minimum clearance and the approximate lowest-clearance location. A
clearance below -0.02 m is blocked; this is a numerical tolerance, **not DEM accuracy**.
Missing or blocked sights are excluded from A. The displayed background is a
coarser preview only; LOS samples the original shared loader. Features below the
DEM resolution and buildings/vegetation are not resolved by this exercise.

## Scope and extension points

This implements **Level 0, Level 1 and the reliability milestone**. The full Level 2
Pato Branco exercise is intentionally deferred as Part 2 of the supplied spec.
`validatePointPlacement` already separates placement from canvas handling and
supports a tested <=3 m street-distance rule for future metre-based street lines.
It does not download or pretend to supply a completed urban scenario.

Future work: full Pato Branco streets/scenario, building obstruction, centering and
HI/HT uncertainties, curvature/refraction/vertical deflection, scenario challenge
targets and richer candidate-sight comparison. Existing comparison is deterministic
before/after metrics. This is not a field-observation adjustment application.

The serializable version-1 model includes points, roles, controls/covariance, HI/HT,
directed sights and components, instrument, statistics, scenario and ENU origin.
Optional `observationCovariance` represents correlated raw sight components in
active/valid sight order and direction/zenith/distance order. It must be updated
when topology changes; a mismatched or non-positive-definite matrix is rejected.
Limits: 100 points, 500 directed sights; practical target is tens of points and
up to roughly 500 observation components. Computation happens on release/change,
not on every pixel of dragging. Imported labels are rendered as text.

## Validation

```sh
npm test --prefix network_preanalysis
npm ci --prefix network_preanalysis
npx --prefix network_preanalysis playwright install chromium
npm run test:browser --prefix network_preanalysis
node test.js
```

The numerical tests require only Node 20+ and the checked-in SVD bundle. Independent
reference covariance is generated with centered differences and NumPy LAPACK QR;
MDB is computed independently with SciPy's normal CDF and root solver. The fixture
records dependency versions. Regenerate it with NumPy/SciPy installed:

```sh
python network_preanalysis/tests/generate_reference.py
```

Tests cover LLH/ECEF/ENU, observation geometry and HI/HT, Jacobians, the two-GNSS-point
traverse, generic resection and angular intersection, deficient/disconnected and
distance-only networks, closed-form polar covariance, full control correlations,
confidence ellipses, redundancy sums, MDB, external reliability, invalid inputs,
JSON, terrain decode/LOS and localization. Browser tests exercise actual mouse and
form actions, JSON downloads/imports, rural decoding, rapid scenario changes and
mobile layout. CI uses the clearly synthetic `tests/synthetic-terrain.png` for
determinism; no outside service is needed for that test.

## Dependencies and structure

`network/` is UI-independent. `app.mjs` coordinates state and async terrain work,
`canvas.mjs` renders and handles pointers, `inspector.mjs` renders properties, and
`i18n.mjs` follows the existing camera simulator's PT-BR/EN dictionary-pair and
`data-t` conventions. Language follows the current monorepo rule: URL `lang`,
then shared `monorepo_lang` storage, then the browser preference. Switching
updates the URL, storage, all text and the portal link immediately. Network
state is not shared between simulators.

`vendor/ml-matrix.mjs` bundles **ml-matrix 6.12.1** with its transitive dependencies;
MIT license notices are included. Only Matrix and SingularValueDecomposition are
exported. The numerical API was inspected from that pinned distribution. To rebuild
outside the repository (no runtime CDN dependency):

```sh
mkdir -p /tmp/network-preanalysis-deps
npm install --prefix /tmp/network-preanalysis-deps ml-matrix@6.12.1 esbuild@0.25.10
echo "export { Matrix, SingularValueDecomposition } from 'ml-matrix';" > /tmp/network-preanalysis-deps/entry.mjs
/tmp/network-preanalysis-deps/node_modules/.bin/esbuild /tmp/network-preanalysis-deps/entry.mjs --bundle --format=esm --minify --outfile=network_preanalysis/vendor/ml-matrix.mjs
```
