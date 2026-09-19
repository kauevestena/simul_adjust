A plane-fitting simulation using the **combined least squares model** (Gemael's "método
combinado"), applied to reflectorless total station point clouds — the classic wall
verticality / floor flatness check.

Raw observations are azimuth and zenith angle in DMS plus slope distance (see
`about_samples.md` and the CSVs in `samples/`). They are converted to XYZ and their
covariance is propagated with the Jacobian of that transformation, using the nominal 1σ
precisions (2" for the angles, 2 mm + 2 ppm for the EDM, all editable in the Settings tab).

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

## Files

| File | Role |
|---|---|
| `io.js` | CSV parsing, DMS→XYZ, MVC propagation, synthetic generator, blunder injection |
| `adjustment.js` | combined model + constraint, statistics, outlier detection, normalization |
| `viewer3d.js` | three.js scene: points, error ellipsoids, fitted plane, residual stems |
| `surface2d.js` | residual surface: TIN / IDW / ordinary kriging, heatmap and contours |
| `app.js` | state, tabs, tables, workflow |
| `test_adjust.js` | `node ajusta_planos/test_adjust.js` — checked against an independent numpy run |

The page needs to be served over HTTP (the sample CSVs are read with `fetch`):
`python3 -m http.server` from the repository root.
