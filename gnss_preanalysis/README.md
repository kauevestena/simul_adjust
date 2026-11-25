# GNSS Network Pre-Analysis / Pré-análise de Redes GNSS

[Português](README.pt-BR.md) · English

A PT-BR/EN classroom tool for **designing GNSS baseline networks before fieldwork**. Points are
placed on a MapLibre map (OpenFreeMap basemap); new points take their height from the AWS
Terrarium DEM, and RBMC stations can be snapped to and used as control. For every vector the
tool builds the a priori variance–covariance matrix from the receiver's nominal precision, then
propagates it through the network (parametric method) to predict coordinate precision,
redundancy and reliability.

Serve the monorepo root and open `gnss_preanalysis/`:

```sh
python -m http.server 8000   # then http://localhost:8000/gnss_preanalysis/
```

No build step or runtime package install. ES modules require HTTP, not `file://`. The basemap
(`tiles.openfreemap.org`) and the DEM (`s3.amazonaws.com/elevation-tiles-prod`) are fetched at
runtime; without them the computation, the panels and JSON files still work.

## Explore

- **+ Point**: click the map. Within the snap radius of an RBMC station the click snaps to it, and
  the station joins as fixed control with its catalogue coordinates. Otherwise a new point is
  created and its height sampled from the DEM.
- **↔ Baseline**: click two points (or an RBMC station, which joins automatically). The baseline
  goes to the **active session**; `+ S` creates a session. Each session has a name and a duration.
- **Select / move**: inspect points, vectors and stations; drag new points to redesign. Undo/redo,
  `Delete` and `Esc` work from the keyboard.
- Precision model, setup errors, session options, display and reliability settings are in the
  side panel. **Theory** summarises the formulas; **Matrices** shows A, Σ_Lb, P, N and Σxx.
- Four examples: a network with two RBMC stations and four points in four sessions; a radial
  survey without redundancy; a four-receiver session with three trivial baselines; and long
  baselines against the IBGE session-time guide. Projects are saved/opened as versioned JSON.

## Stochastic model of one vector

Nominal precision is specified per component of the local frame, for a baseline of length D (km):

```text
σH = aH + bH·D          (linear, default; conservative)
σH = √(aH² + (bH·D)²)   (quadratic alternative)         same for σV
σE = σN = σH            (per component, default)  or  σE = σN = σH/√2  (2D radial spec)
Σ_ENU = diag(σE² + σc,i² + σc,j², σN² + σc,i² + σc,j², σU² + σh,i² + σh,j²)
Σ_ΔXYZ = Rᵀ Σ_ENU R      (R at the geodetic midpoint, Navipedia ENU rotation)
```

σc and σh are the centering and antenna-height errors of each occupation (defaults 1 mm and
2 mm for new points; 0 for CORS, which have forced centering). A point may override them.

| Preset | Horizontal | Vertical | Source |
|---|---|---|---|
| Static / fast static | 3 mm + 0.5 ppm | 5 mm + 0.5 ppm | typical catalogue (e.g. Trimble R10/R12), RMS |
| High-precision static | 3 mm + 0.1 ppm | 3.5 mm + 0.4 ppm | same; > 30 km needs precise ephemerides, up to 24 h |
| RTK (single baseline < 30 km) | 8 mm + 1 ppm | 15 mm + 1 ppm | same |
| IBGE (2008), Table 3.2 | 10 mm + 1 ppm (≤ 20 km), 5 mm + 1 ppm (> 20 km) | same | IBGE does not separate H and V; 10 mm is the conservative end of 5–10 mm |

XYZ correlations appear only because σU ≠ σH; an isotropic ENU matrix stays diagonal (tested).

## Network, datum and rank

Observations are ΔX, ΔY, ΔZ of each active vector; unknowns are X, Y, Z of every non-fixed point
used by a vector. **A is the incidence matrix ⊗ I₃** (−I at the origin, +I at the end) and does not
depend on coordinates: geometry enters only through Σ_Lb. P = Σ_Lb⁻¹ (σ₀² = 1 a priori) and
Σxx = (AᵀPA)⁻¹. N is accumulated from the sparse rows of A (at most two ±1 each). After column
equilibration, a Cholesky factorization is used when every pivot exceeds 1e-10 (each pivot is ≥ the
smallest eigenvalue, so the network is clearly full rank); otherwise the rank is decided as in
`network_preanalysis`, by the SVD of the whitened, equilibrated design matrix with the relative
threshold `100·eps·max(n,u)·s_max`. Both paths are tested to agree. A rank-deficient network never
reports absolute precision. The largest networks allowed (150 points, 600 vectors) compute in about
0.3 s when they have a datum. Fixed control is eliminated; stochastic control adds three pseudo-observations with
diagonal ENU σ rotated to XYZ. Baselines carry scale and orientation, so each connected part needs
only its 3 translations; parts without control are reported (`datumMissing`), as are disconnected
parts and points without vectors (left out of the computation).

Per point, Σ_XYZ is rotated to the point's ENU for σE, σN, σU and the horizontal ellipse (1σ: 39.35 %
joint probability; 95 %: ×2.44774683). Ellipses and MDB effect vectors are drawn with an explicit
exaggeration; "automatic" picks a 1-2-5 value so the largest ellipse is about 10 % of the network
extent. The panel also shows the adjusted relative precision of each vector.

## Sessions

- **Trivial baselines.** In drawing order, a vector whose two receivers are already connected
  through earlier vectors of the same session is dependent (r receivers give r − 1 independent
  vectors). By default they stay in the adjustment and are flagged (the precision is optimistic,
  Craymer & Beck 1992); "exclude" drops them.
- **Session correlation (optional).** Σ_session = D·blkdiag(Σ_station)·Dᵀ + blkdiag(Σ_length): each
  station contributes half the constant term plus its setup, shared by every vector at that station
  (ρ = ±0.5 for two equal radial or chained vectors); the ppm term stays independent. Each vector
  keeps the variance of the independent model (to the rotation difference between station and
  midpoint, tested). For the IBGE preset the shared constant is the table's 5 mm.
- **IBGE (2008) guide.** Each vector's length is checked against the minimum session duration
  (0–5 km: 5 min; 5–10 km: 10; 10–20 km: 10; 20–50 km: 120; 50–100 km: 180; > 100 km: 240) and,
  for L1-only receivers, against the 20 km limit. These are warnings: the nominal model does not
  depend on time.

## Reliability

R = I − A Σxx AᵀP. The **redundancy of a vector** is the trace of its 3 × 3 block (frame invariant;
shown divided by 3). The **MDB along E, N and U** of a vector solves the two-sided single-observation
test with known a priori covariance: ∇ = δ₀ / √(eᵀ M e) with M = P − PAΣxxAᵀP restricted to the
vector and e the unit E, N or U direction at its midpoint (δ₀ = 4.13 for α = 0.001, power 0.8;
`network_preanalysis/network/reliability.mjs`). Unobservable biases are labelled undetectable. The
external effect of an MDB on the points can be drawn on the map. No multiple-testing correction.

## Heights and stations

- **DEM.** `shared/terrarium.mjs` samples AWS Terrain Tiles (Terrarium, z14, floored nearest pixel).
  The value is taken as an orthometric-like height H and **h = H + N₀**, with N₀ a constant you set
  (0 m by default, a didactic approximation like `network_preanalysis`). While a tile is loading,
  or if it fails, the point keeps an approximate height and a `heightAssumed` warning; it is never
  presented as DEM data. Heights barely affect the covariance (only through D), but the warning
  keeps the record honest.
- **RBMC.** `data/rbmc-stations.json` is a pinned snapshot of 141 active/inactive RBMC stations
  (removed ones excluded). Coordinates are **approximate** (decimetres; 134 from NGL, others from site
  logs and IBGE reports): fine for design, not for computing. See [data/README.md](data/README.md).
- **Your own stations.** "Import stations" reads CSV (`id,lat,lon,h[,city,status]`, decimal degrees,
  ellipsoidal h; `;` with decimal commas also accepted) or GeoJSON points (`properties.id`, `h` or
  the third coordinate). IDs have 4 characters; imported stations replace bundled ones with the same ID.

## Validation

```sh
npm test --prefix gnss_preanalysis
npm ci --prefix gnss_preanalysis
npx --prefix gnss_preanalysis playwright install chromium
npm run test:browser --prefix gnss_preanalysis
```

`tests/generate_reference.py` is an independent NumPy/SciPy implementation (matrix form of the
session model, dense least squares, SciPy normal quantiles) whose fixture covers nine cases:
independent and correlated sessions, quadratic/radial/high-precision settings, stochastic control,
a radial survey, trivial baselines kept/excluded/correlated and the IBGE preset with long vectors.
The Node tests compare rank, redundancy, Σxx, σ, ellipses, a priori and adjusted vector σ and MDB.
They also check the 5 km worked example (σX 6.60, σY 6.87, σZ 6.16 mm; ρXY −0.29), the RBMC
snapshot (checksums, Brazil bounds, agreement with official IBGE coordinates), CSV/GeoJSON import,
JSON round trips and the dictionaries. The browser test drives the real page with mouse clicks
(placing, snapping, drawing, dragging, sessions, settings, files, phone layout, DEM failure) with
OpenFreeMap and Terrarium answered by local fixtures; `GNSS_SCREENSHOTS=/tmp/dir` keeps screenshots
and `CHROME_PATH` selects a local Chrome.

```sh
python gnss_preanalysis/tests/generate_reference.py
```

## Structure and dependencies

`model/` is UI-independent (`stochastic.mjs`, `analysis.mjs`, `network.mjs`, `cors.mjs`,
`examples.mjs`). `app.mjs` holds state, history and events, `map.mjs` the MapLibre view,
`inspector.mjs` the panels, `geometry.mjs` the map drawings and `i18n.mjs` the PT-BR/EN dictionary
(URL `lang`, then `monorepo_lang` in storage, then the browser; switching updates text, URL and the
portal link). Reused without copies: MapLibre GL JS 4.7.1 from `channel_tunnel_story/vendor`, the
ml-matrix SVD bundle and the WGS84/ENU, covariance and reliability helpers from
`network_preanalysis`, and `shared/terrarium.mjs`.

## Limits

Nominal precision under good conditions; no satellite geometry (DOP/RDOP), multipath, obstruction,
ionospheric scintillation or processing strategy. The formal covariance of real baseline
processing is usually optimistic and needs a variance factor: after a campaign, test σ̂₀² and
estimate a and b from repeated vectors. Station and DEM coordinates are design values. Limits: 150
points, 600 vectors, 60 sessions.

References: IBGE (2008) *Recomendações para levantamentos relativos estáticos – GPS*; Craymer, M. R.
& Beck, N. (1992) *Session versus baseline GPS processing*, Proc. ION GPS-92, 995–1004; Gemael, C. et al.
*Introdução ao ajustamento de observações: aplicações geodésicas*; Monico, J. F. G. (2008) *Posicionamento pelo GNSS*.
