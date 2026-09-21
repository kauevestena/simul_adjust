A plane-fitting simulation using the **combined least squares model** (Gemael's "método
combinado"), applied to reflectorless total station point clouds — the classic wall
verticality / floor flatness check.

Raw observations are azimuth and zenith angle in DMS plus slope distance (see
`about_samples.md` and the CSVs in `samples/`). They are converted to XYZ and their
covariance is propagated with the Jacobian of that transformation, using the nominal 1σ
precisions (2" for the angles, 2 mm + 2 ppm for the EDM, all editable in the Settings tab).

## The samples

Six planes of one room — four walls, floor and ceiling — all observed from the same station,
so they share a coordinate frame: the instrument is the origin and its distance to each plane
reads directly off `|D|` after normalization. Azimuth zero is not aligned with the room, which
is why the wall names do not line up with the axes.

| sample | pts | plane | `|D|` | out of plumb / tilt | σ̂₀ |
|---|---|---|---|---|---|
| `parede_frontal.csv` | 53 | vertical, −Y | 3.247 m | 5.03 mm/m | 2.35 |
| `parede_traseira_7col.csv` | 32 | vertical, −X | 7.223 m | 2.43 mm/m | 0.51 |
| `parede_esquerda_7col.csv` | 51 | vertical, +X | 3.858 m | 0.97 mm/m | 0.66 |
| `parede_direita_7col.csv` | 26 | vertical, +Y | 4.055 m | 11.84 mm/m | 3.07 |
| `piso_7col.csv` | 50 | horizontal, below | 1.609 m | 0.79 mm/m | 3.92 |
| `teto_7col.csv` | 33 | horizontal, above | 1.745 m | 0.76 mm/m | 5.18 |

The box closes: 11.08 m along X, 7.30 m along Y, 3.354 m high. `σ̂₀` is the achieved precision
over the nominal 2 mm + 2″ — under 1 means the data beat the nominal figures, above 1 means the
surface itself is rougher than the instrument, which is the interesting case: the floor and the
ceiling are not instrument noise, they are the slab.

Two are worth loading on purpose. `parede_direita_7col.csv` is the worst surface in the set,
11.84 mm/m out of plumb over 26 points, so the global test fails loudly and the residual map has
structure rather than noise. `piso_7col.csv` is where the reduction gauge misbehaves if you
freeze the wrong parameter (see below), and where 22 of the 50 error ellipsoids used to be drawn
misoriented.

### Raw files and the conversion

`samples/raw/` holds the instrument's own export, one file per plane: alternating `SS` (point
number) and `SD` (azimuth, zenith angle, slope distance) records, with the angles packed as
`DDD.MMSS` — `316.2342` is 316° 23′ 42″. `samples/raw_to_csv.js` converts a raw file to the
7-column CSV, and with no argument it checks every CSV against its raw file byte for byte:

```
node ajusta_planos/samples/raw_to_csv.js              # check all six
node ajusta_planos/samples/raw_to_csv.js piso.txt     # print one conversion
```

That check also runs inside `test_adjust.js`, because it is how a real mix-up was caught:
`parede_frontal.csv` used to be a byte-identical copy of `parede_esquerda_7col.csv`, and the
actual frontal wall — 53 observations, job `AJ3C` — had never been converted. It has been
regenerated from the raw file; the other five matched their raw exactly, in the same order.

### Horizontal or vertical, and why not by spread

`classifyPlane` decides from the **direction of the normal**: `|n_z| > cos 45°` means
horizontal. It takes the adjusted normal when the caller has one and falls back to a PCA of the
points otherwise, so both paths agree.

This deliberately departs from `specs.md`, which prescribed comparing the Z spread of the
internal displacement vectors against the horizontal spread. That rule breaks on a wall measured
as a wide, low band: `parede_frontal.csv` spans 3.07 m in X but only 0.42 m in Z, so the spread
rule called it *horizontal*. The spread is still computed and reported — the interface shows it —
it just no longer decides.

The classification picks the reference axis used to fix the **sense** of the normal (+Z for
horizontal planes, +X for vertical ones), so getting it wrong risks flipping the sign of the whole
parameter vector. Changing the rule did not move any result on the six samples: every plane came
back identical to machine precision, only the label changed.

## The singularity, and the three ways out

The plane equation `Ax + By + Cz + D = 0` is homogeneous, so the four parameters are only
defined up to scale. With them left entirely free the combined model is degenerate: since
`W = A·X₀` exactly, the normal equations give `X = -X₀` and the solution collapses to
`(0,0,0,0)`. This is not a numerical accident — it happens in exact arithmetic, and the
reference implementation (`leasqPlane2` in kauevestena/smmt) has the same flaw.

The simulator lets you pick which classical remedy to apply, because that choice is worth
seeing rather than hiding:

| strategy | how | system solved | `‖n‖` on output |
|---|---|---|---|
| `constraint` | extra condition `A²+B²+C²=1`, Lagrange multiplier | KKT 5×5 | exactly 1 |
| `reduction` (default) | freeze one parameter, `X[k] ≡ 0` | `N_r` 3×3, non-singular | free |
| `pseudoinverse` | minimum constraint `EᵀX = 0`, `E = X₀` | `UᵀNU` 3×3 | free |

Two things hold in all three: **dof = m − 3**, and **`Σ_Xa` has rank 3**. What changes is
*which* direction is null — the scale direction for the constraint and the pseudo-inverse, the
axis of the frozen parameter for the reduction.

**The gauge is a convention, not modelling.** The three converge to the same plane, the same
residuals, the same `σ̂₀²` and the same MVC once normalized — agreement at machine precision
(`max|ΔX̂| ≈ 1e-16`). Only the raw parameter representation and the conditioning differ. The
*Comparar Gauges* tab runs all three side by side and prints the divergences, which is the
whole point of offering the choice.

Two traps the implementation deliberately avoids:

- **Do not detect the rank numerically.** An eigenvalue threshold for the pseudo-inverse
  collapses the solution: `λmin/λmax` of N runs from ~1e-7 on the first iteration to ~1e-17 at
  convergence, so no fixed cutoff works at both ends, and keeping the small eigenvalue makes
  `N⁺ = N⁻¹` and reproduces the original degeneracy. The null space is imposed analytically.
- **Not every reduction is equally good.** Freezing a near-zero parameter is still a valid
  gauge — it just sits almost orthogonal to the scale direction. On `piso_7col.csv`, freezing
  B (≈ −5.6e-4 against C ≈ 1) sends `cond(N_r)` from 19 to 3.3e6 and convergence from 4
  iterations to 49, so the default 20-iteration limit stops short of the answer. The simulator
  reports the gauge quality `|X₀[k]|/‖X₀‖` and warns; the automatic rule picks the largest
  normal component (never D), which is always ≥ 1/√3.

The optional normalization step then fixes the *sense* of the normal (nearer +Z for horizontal
planes, nearer +X for vertical ones, classified by the Z spread of the internal displacement
vectors) and rescales to `‖n‖ = 1`, propagating the MVC through the Jacobian of that
transformation. It is what makes results from different gauges directly comparable.

## Volume estimation

`volume.html` (reachable from the **Estimativa de Volume** button in the simulator header) closes
the six faces into a polyhedron and estimates the room's volume **with its uncertainty**. The
point of the page is that the volume is an *algebraic* function of the 24 parameters, so the
uncertainty comes from covariance propagation rather than simulation.

Opposing faces are paired by their **normals**, not by filename — the names mislead: `frontal`
(−Y) opposes `direita` (+Y), and `esquerda` (+X) opposes `traseira` (−X). Each of the 8 vertices
solves `M v = -d` for one plane per pair; the six faces are planar by construction, so the
divergence theorem over the triangulated boundary is exact:

```
V = (1/6) | sum_{t=1..12} det[ p_t1  p_t2  p_t3 ] |
```

The Jacobian is analytic — differentiating `M v = -d` gives
`dv/dx_i = -M^-1 e_r [v_x, v_y, v_z, 1]` — and `sigma_V^2 = J S J^T` with `S` block-diagonal,
since the six faces are independent surveys. All faces use the **unitary constraint** gauge, the
one whose MVC propagates directly.

`Sigma_Xa` has rank 3 in that gauge, and it does not matter: the null direction is the parameter
scale, stretching a plane's parameters does not move the plane, so that direction sits exactly in
the null space of `J`. `test_volume.js` asserts it.

On the six samples: **V = 271.3049 m³, sigma_V = 0.0849 m³** (0.031 %). The naive product of the
three face separations gives 271.3384 m³ — off by 0.033 m³, because the room is not a perfect box
and only the polyhedron formula accounts for that.

The confidence intervals are shown in both the normal and the Student-t columns. The t column
uses **Welch–Satterthwaite effective degrees of freedom** (81.7 here), not the 227 of the naive
sum: the six faces have very different `sigma_0`, and whichever dominates the variance also
dominates the dof. The ceiling alone carries 54 % of the variance because it is the roughest
surface in the set — which is the page's real lesson about where an uncertainty comes from.

## Files

| File | Role |
|---|---|
| `io.js` | CSV parsing, DMS→XYZ, MVC propagation, synthetic generator, blunder injection |
| `adjustment.js` | combined model + constraint, statistics, outlier detection, normalization |
| `viewer3d.js` | three.js scene: points, error ellipsoids, fitted plane, residual stems |
| `surface2d.js` | residual surface: TIN / IDW / ordinary kriging, heatmap and contours |
| `app.js` | state, tabs, tables, workflow |
| `volume.js` | face pairing, vertices, volume, analytic Jacobian, covariance propagation |
| `volume.html` + `volume_app.js` | the volume page and its five panels |
| `room3d.js` | three.js view of the reconstructed room |
| `test_adjust.js` | `node ajusta_planos/test_adjust.js` — checked against an independent numpy run |
| `test_volume.js` | `node ajusta_planos/test_volume.js` — analytic boxes, Jacobian vs finite differences, gauge invariance |

The page needs to be served over HTTP (the sample CSVs are read with `fetch`):
`python3 -m http.server` from the repository root.

## Classroom material

Two slide decks in `explanations/`, in Portuguese, aimed at high-school students, each with a
technical appendix. They are meant to be shown in this order:

1. **`metodo_combinado.pdf`** — the combined model from scratch: why measuring too much is a
   resource rather than a nuisance, least squares, weights, and the matrices `A`, `B`, `W`, `M`,
   `N` introduced one at a time, then quality control (σ̂₀², the χ² global test, the MVC and
   Baarda's *w* test). It teaches the whole recipe on a deliberately tiny, non-degenerate
   example — a stair handrail measured with a tape, where *both* coordinates carry error, so
   `F = a·x + b − z = 0` needs the combined model. The plane only appears at the end, as the
   cliffhanger.
2. **`quatro_parametros.pdf`** — why the four plane parameters cannot simply be computed, and
   the three gauge strategies.

Rebuild either from `explanations/` with `latexmk -pdf <name>.tex`. Every number the second
deck quotes comes from this simulator run on the sample CSVs; every number the first one quotes
comes from `explanations/corrimao.js`, which redoes the handrail adjustment with the same
sequence as `adjustPlane` and prints all of it:

```
node ajusta_planos/explanations/corrimao.js
```
