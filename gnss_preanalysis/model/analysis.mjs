// Pre-analysis of a GNSS baseline network (Gauss–Markov, parametric). Observations are the
// baseline vectors ΔX, ΔY, ΔZ; unknowns are the geocentric X, Y, Z of non-fixed points.
// A is the incidence matrix ⊗ I3, independent of the coordinates: the geometry enters
// only through Σ_Lb. No observation vector, residuals or a posteriori variance factor.
import { Matrix, SingularValueDecomposition } from '../../network_preanalysis/vendor/ml-matrix.mjs';
import { covarianceBlock, zeros, dot } from '../../network_preanalysis/network/stochastic.mjs';
import { noncentrality, errorEllipse } from '../../network_preanalysis/network/reliability.mjs';
import { validateProject } from './network.mjs';
import { baselineGeometry, baselineCovariance, sessionCovariance, rotateEnuToXyz, rotateXyzToEnu,
  unitVectors, ibgeGuide, nominalSigma } from './stochastic.mjs';

export const AXES = ['X', 'Y', 'Z'];
const ENU = ['E', 'N', 'U'];
const block3 = (m, r, c) => [0, 1, 2].map(i => [0, 1, 2].map(j => m[r + i][c + j]));
const quad = (u, m) => u.reduce((s, ui, i) => s + ui * m[i].reduce((t, mij, j) => t + mij * u[j], 0), 0);

/** Inverse of a symmetric positive-definite matrix by Cholesky, or null if a pivot falls below minPivot. */
export function choleskyInverse(a, minPivot) {
  const n = a.length, L = zeros(n, n);
  for (let j = 0; j < n; j++) {
    let d = a[j][j];
    for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k];
    if (!(d > minPivot)) return null;
    L[j][j] = Math.sqrt(d);
    for (let i = j + 1; i < n; i++) {
      let v = a[i][j];
      for (let k = 0; k < j; k++) v -= L[i][k] * L[j][k];
      L[i][j] = v / L[j][j];
    }
  }
  const W = zeros(n, n); // L⁻¹ (lower triangular)
  for (let k = 0; k < n; k++) for (let i = k; i < n; i++) {
    let v = i === k ? 1 : 0;
    for (let j = k; j < i; j++) v -= L[i][j] * W[j][k];
    W[i][k] = v / L[i][i];
  }
  const out = zeros(n, n); // (L⁻¹)ᵀ L⁻¹
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let v = 0;
    for (let k = i; k < n; k++) v += W[k][i] * W[k][j];
    out[i][j] = out[j][i] = v;
  }
  return out;
}

function unionFind() {
  const parent = new Map();
  const find = x => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) x = parent.get(x); return x; };
  return { find, union: (a, b) => parent.set(find(a), find(b)) };
}

export function analyze(project, { forceSvd = false } = {}) {
  const result = { solvable: false, diagnostics: [], parameters: [], rows: [], baselines: Object.create(null),
    sessions: Object.create(null), points: Object.create(null), precision: Object.create(null), rank: 0, defect: 0,
    dof: 0, observationCount: 0, controlCount: 0, includedCount: 0, trivialCount: 0, components: [] };
  try { validateProject(project); } catch (error) { result.diagnostics.push({ code: error.message }); return result; }
  const s = project.settings, byId = new Map(project.points.map(p => [p.id, p]));
  const diag = (code, extra = {}) => result.diagnostics.push({ code, ...extra });

  // 1. Geometry, IBGE guide and dependent ("trivial") baselines, session by session, in drawing order.
  const included = [];
  for (const session of project.sessions) {
    const list = project.baselines.filter(b => b.active && b.session === session.id);
    const { find, union } = unionFind(), receivers = new Set(), dependent = [];
    for (const b of list) {
      const from = byId.get(b.from), to = byId.get(b.to);
      let geometry;
      try { geometry = baselineGeometry(from, to); } catch (error) {
        result.baselines[b.id] = { id: b.id, invalid: error.message, session: session.id, from: b.from, to: b.to };
        diag('invalidBaseline', { id: b.id, reason: error.message }); continue;
      }
      receivers.add(b.from); receivers.add(b.to);
      const trivial = find(b.from) === find(b.to);
      if (trivial) dependent.push(b.id); else union(b.from, b.to);
      const guide = ibgeGuide(geometry.km), apriori = baselineCovariance(from, to, s, geometry);
      const info = { id: b.id, session: session.id, from: b.from, to: b.to, km: geometry.km, length: geometry.length,
        mid: geometry.mid, trivial, included: !(trivial && s.trivial === 'exclude'), guideMinutes: guide.minMinutes,
        shortSession: session.duration < guide.minMinutes,
        singleFrequencyTooLong: s.frequency === 'single' && !guide.singleFrequency,
        nominal: nominalSigma(geometry.km, s), apriori: { enu: apriori.enu, xyz: apriori.xyz },
        sigmaENU: [0, 1, 2].map(i => Math.sqrt(apriori.enu[i][i])), sigmaXYZ: [0, 1, 2].map(i => Math.sqrt(apriori.xyz[i][i])) };
      result.baselines[b.id] = info;
      if (info.shortSession) diag('sessionShort', { id: b.id, session: session.label ?? session.id, km: geometry.km,
        minutes: session.duration, needed: guide.minMinutes });
      if (info.singleFrequencyTooLong) diag('singleFrequencyLong', { id: b.id, km: geometry.km });
      if (info.included) included.push({ baseline: b, from, to, geometry, info });
    }
    result.sessions[session.id] = { receivers: [...receivers], baselines: list.length, dependent,
      independent: list.length - dependent.length };
    if (dependent.length) diag(s.trivial === 'exclude' ? 'trivialExcluded' : 'trivialBaselines',
      { session: session.label ?? session.id, count: dependent.length, receivers: receivers.size });
    result.trivialCount += dependent.length;
  }
  if (included.some(x => x.geometry.km > 30) && ['static', 'hpStatic'].includes(s.preset)) diag('longBaselinePrecise');
  result.includedCount = included.length;

  // 2. Points used by included baselines; graph components and their datum.
  const used = new Set(included.flatMap(x => [x.from.id, x.to.id]));
  for (const p of project.points) result.points[p.id] = { used: used.has(p.id), control: p.control };
  const isolated = project.points.filter(p => !used.has(p.id)).map(p => p.id);
  if (isolated.length) diag('isolatedPoints', { count: isolated.length, ids: isolated.join(', ') });
  const assumed = project.points.filter(p => used.has(p.id) && ['pending', 'missing'].includes(p.hSource)).map(p => p.id);
  if (assumed.length) diag('heightAssumed', { ids: assumed.join(', ') });
  const graph = unionFind();
  included.forEach(x => graph.union(x.from.id, x.to.id));
  const groups = new Map();
  for (const p of project.points) if (used.has(p.id)) {
    const root = graph.find(p.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p.id);
  }
  result.components = [...groups.values()];
  if (result.components.length > 1) diag('disconnected', { count: result.components.length });
  for (const group of result.components)
    if (!group.some(id => byId.get(id).control !== 'free')) diag('datumMissing', { ids: group.join(', ') });
  if (!included.length) { diag('noObservations'); return result; }

  // 3. Parameters, design matrix and covariance blocks.
  for (const p of project.points) if (used.has(p.id) && p.control !== 'fixed')
    for (const axis of AXES) result.parameters.push({ id: p.id, axis });
  const u = result.parameters.length, index = new Map(result.parameters.map((p, i) => [`${p.id}\0${p.axis}`, i]));
  const A = [], blocks = [];
  const addRows = (item, rowStart) => {
    for (let k = 0; k < 3; k++) {
      const row = Array(u).fill(0), to = index.get(`${item.to.id}\0${AXES[k]}`), from = index.get(`${item.from.id}\0${AXES[k]}`);
      if (to !== undefined) row[to] += 1;
      if (from !== undefined) row[from] -= 1;
      A.push(row);
      result.rows.push({ source: 'baseline', baselineId: item.baseline.id, session: item.baseline.session,
        from: item.from.id, to: item.to.id, axis: AXES[k], start: rowStart });
    }
  };
  try {
    if (s.sessionCorrelation) {
      for (const session of project.sessions) {
        const items = included.filter(x => x.baseline.session === session.id);
        if (!items.length) continue;
        const start = A.length;
        items.forEach(item => addRows(item, A.length));
        let q;
        try { q = sessionCovariance(items, s); blocks.push({ start, size: q.length, ...covarianceBlock(q, q.length), session: session.id }); }
        catch { throw Object.assign(Error('singularSession'), { session: session.label ?? session.id }); }
        items.forEach((item, i) => { result.baselines[item.baseline.id].covXYZ = block3(q, 3 * i, 3 * i); });
      }
    } else {
      for (const item of included) {
        const start = A.length, cov = baselineCovariance(item.from, item.to, s, item.geometry);
        addRows(item, start);
        blocks.push({ start, size: 3, ...covarianceBlock(cov.xyz, 3) });
        result.baselines[item.baseline.id].covXYZ = cov.xyz;
      }
    }
    result.observationCount = A.length;
    for (const p of project.points) if (used.has(p.id) && p.control === 'stochastic') {
      const enu = [0, 1, 2].map(i => [0, 1, 2].map(j => i === j ? (p.sigmaControl[i] / 1000) ** 2 : 0));
      const q = rotateEnuToXyz(enu, p.lat, p.lon), start = A.length;
      blocks.push({ start, size: 3, ...covarianceBlock(q, 3) });
      AXES.forEach(axis => {
        const row = Array(u).fill(0); row[index.get(`${p.id}\0${axis}`)] = 1; A.push(row);
        result.rows.push({ source: 'control', pointId: p.id, axis, start });
      });
      result.controlCount += 3;
    }
  } catch (error) { diag(error.message, error.session ? { session: error.session } : {}); return result; }
  for (const info of Object.values(result.baselines)) if (info.covXYZ) info.covENU = rotateXyzToEnu(info.covXYZ, info.mid.lat, info.mid.lon);
  // A has at most two ±1 per row: build P·A row by row as sparse maps, and N = Σ Aᵢᵀ (PA)ᵢ.
  const m = A.length, blockOfRow = Array(m), nzA = A.map(row => row.flatMap((v, j) => (v ? [[j, v]] : [])));
  const PA = Array(m);
  for (const block of blocks) for (let i = 0; i < block.size; i++) {
    blockOfRow[block.start + i] = block;
    const acc = new Map();
    for (let j = 0; j < block.size; j++) {
      const pij = block.p[i][j];
      if (pij) for (const [c, v] of nzA[block.start + j]) acc.set(c, (acc.get(c) || 0) + pij * v);
    }
    PA[block.start + i] = [...acc];
  }
  const N = zeros(u, u);
  for (let i = 0; i < m; i++) for (const [c1, v1] of nzA[i]) for (const [c2, w] of PA[i]) N[c1][c2] += v1 * w;
  for (let i = 0; i < u; i++) for (let j = 0; j < i; j++) { const x = (N[i][j] + N[j][i]) / 2; N[i][j] = N[j][i] = x; }
  result.A = A; result.N = N; result.blocks = blocks.map(({ start, size, q, p, session }) => ({ start, size, q, p, session }));

  // 4. Rank and Σxx. Column equilibration S (‖(W A S)_j‖ = 1, i.e. unit diagonal of S N S). Fast path:
  // Cholesky of S N S (unit diagonal) when every pivot exceeds 1e-10: every pivot is ≥ λ_min, so such a
  // network is full rank with cond(W A S) below ~1e5–1e6. Singular or weaker networks go to the SVD of
  // W A S with the rank rule of network_preanalysis (σ_k > 100·eps·max(m,u)·σ_max).
  const scale = Array.from({ length: u }, (_, j) => (N[j][j] > 0 ? 1 / Math.sqrt(N[j][j]) : 1));
  const tau = Math.max(m, u, 1) * Number.EPSILON * 100;
  let q = null, rank = 0, V = null, singularValues = null;
  if (u) {
    const Ns = N.map((row, i) => row.map((x, j) => x * scale[i] * scale[j]));
    const inverse = forceSvd ? null : choleskyInverse(Ns, 1e-10);
    if (inverse) {
      rank = u;
      q = inverse.map((row, i) => row.map((x, j) => x * scale[i] * scale[j]));
      const norm1 = M => Math.max(...M.map((_, j) => M.reduce((t, r) => t + Math.abs(r[j]), 0)));
      result.condition = Math.sqrt(norm1(Ns) * norm1(inverse)); // 1-norm estimate of cond(W A S)
    } else {
      const B = zeros(m, u);
      for (const block of blocks) for (let i = 0; i < block.size; i++) for (let j = 0; j < block.size; j++) {
        const wij = block.w[i][j];
        if (wij) for (const [c, v] of nzA[block.start + j]) B[block.start + i][c] += wij * v * scale[c];
      }
      while (B.length < u) B.push(Array(u).fill(0));
      const svd = new SingularValueDecomposition(new Matrix(B), { autoTranspose: false, computeLeftSingularVectors: false });
      singularValues = svd.diagonal; V = svd.rightSingularVectors.to2DArray();
      const tolerance = (singularValues[0] || 1) * tau;
      rank = singularValues.filter(x => x > tolerance).length;
      result.rankTolerance = tolerance;
      result.condition = rank ? singularValues[0] / singularValues[rank - 1] : Infinity;
      q = zeros(u, u);
      for (let k = 0; k < rank; k++) for (let i = 0; i < u; i++) {
        const left = scale[i] * V[i][k] / singularValues[k];
        for (let j = 0; j <= i; j++) q[i][j] += left * scale[j] * V[j][k] / singularValues[k];
      }
      for (let i = 0; i < u; i++) for (let j = 0; j < i; j++) q[j][i] = q[i][j];
    }
  } else q = [];
  Object.assign(result, { rank, defect: u - rank, dof: m - rank, singularValues });
  if (result.defect) {
    diag('rankDefect', { count: result.defect });
    const affected = new Set();
    result.parameters.forEach((p, i) => { if (V[i].slice(rank).reduce((t, x) => t + x * x, 0) > 1e-7) affected.add(p.id); });
    if (affected.size) diag('pointUndetermined', { ids: [...affected].join(', ') });
  } else if (result.condition > 1e7) diag('weakGeometry');
  // K = Σxx Aᵀ P (u × m), column i = Σxx (PA)ᵢᵀ, using the sparsity of (PA)ᵢ.
  const gain = Array.from({ length: u }, () => new Float64Array(m));
  for (let i = 0; i < m; i++) for (const [c, w] of PA[i]) for (let k = 0; k < u; k++) gain[k][i] += q[k][c] * w;
  result.solvable = !result.defect && m > 0 && u > 0;
  const sparseDot = (nz, column) => nz.reduce((t, [c, v]) => t + v * gain[c][column], 0);

  // 5. Internal reliability: redundancy numbers r_i = (I − A K)_ii and MDB along E, N, U of each vector.
  const delta = noncentrality(s.statistics.alpha, s.statistics.power);
  result.rows.forEach((row, i) => {
    row.redundancy = 1 - sparseDot(nzA[i], i);
    if (Math.abs(row.redundancy) < 1e-10) row.redundancy = 0;
  });
  const rowsOf = id => result.rows.map((r, i) => r.baselineId === id ? i : -1).filter(i => i >= 0);
  for (const item of included) {
    const info = result.baselines[item.baseline.id], rows = rowsOf(item.baseline.id), block = blockOfRow[rows[0]];
    const offset = rows[0] - block.start, P = block3(block.p, offset, offset);
    // M = P − P A Σxx Aᵀ P restricted to this vector's rows (only its diagonal 3 × 3 block is needed).
    const M = [0, 1, 2].map(a => [0, 1, 2].map(b => P[a][b] - sparseDot(PA[rows[a]], rows[b])));
    info.rows = rows;
    info.redundancy = rows.reduce((t, r) => t + result.rows[r].redundancy, 0); // trace: frame invariant, 0…3
    info.redundancyMean = info.redundancy / 3;
    const e = unitVectors(info.mid.lat, info.mid.lon);
    info.mdb = ENU.map((axis, k) => {
      const w = quad(e[k], M), p = quad(e[k], P);
      return w > p * 1e-10 ? delta / Math.sqrt(w) : Infinity;
    });
  }
  result.minimumRedundancy = included.length ? Math.min(...included.map(x => result.baselines[x.baseline.id].redundancyMean)) : null;
  result.delta = delta; result.gain = gain; result.covariance = q;
  result.PA = PA;

  // 6. Coordinate precision (only for a determinable network) and adjusted vector precision.
  if (result.solvable) {
    for (const p of project.points) {
      if (!used.has(p.id) || p.control === 'fixed') continue;
      const ix = AXES.map(axis => index.get(`${p.id}\0${axis}`)), covXYZ = ix.map(i => ix.map(j => q[i][j]));
      const covENU = rotateXyzToEnu(covXYZ, p.lat, p.lon);
      result.precision[p.id] = { covXYZ, covENU, sigma: [0, 1, 2].map(i => Math.sqrt(Math.max(0, covENU[i][i]))),
        ellipse: errorEllipse(covENU) };
    }
    for (const info of Object.values(result.baselines)) if (!info.invalid) info.adjusted = relativePrecision(result, project, info.from, info.to);
  }
  const values = Object.values(result.precision);
  result.worstHorizontal = result.solvable ? Math.max(0, ...values.map(p => p.ellipse.major)) : null;
  result.worstVertical = result.solvable ? Math.max(0, ...values.map(p => p.sigma[2])) : null;
  return result;
}

/** Σ of X_b − X_a from Σxx, in ENU at the midpoint. Fixed points contribute zero. */
export function relativePrecision(result, project, a, b) {
  if (!result.solvable) return null;
  const pa = project.points.find(p => p.id === a), pb = project.points.find(p => p.id === b);
  if (!pa || !pb || !result.points[a]?.used || !result.points[b]?.used) return null;
  const idx = id => AXES.map(axis => result.parameters.findIndex(p => p.id === id && p.axis === axis));
  const ia = idx(a), ib = idx(b), cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], q = result.covariance;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const get = (r, c) => (r >= 0 && c >= 0 ? q[r][c] : 0);
    cov[i][j] = get(ib[i], ib[j]) + get(ia[i], ia[j]) - get(ib[i], ia[j]) - get(ia[i], ib[j]);
  }
  const g = baselineGeometry(pa, pb), enu = rotateXyzToEnu(cov, g.mid.lat, g.mid.lon);
  return { covXYZ: cov, covENU: enu, sigma: [0, 1, 2].map(i => Math.sqrt(Math.max(0, enu[i][i]))) };
}

/** External reliability: effect on the unknown points of an MDB along E, N or U of one vector. */
export function externalEffect(result, project, baselineId, axisIndex) {
  const info = result.baselines[baselineId];
  if (!result.solvable || !info?.rows || !Number.isFinite(info.mdb?.[axisIndex])) return null;
  const e = unitVectors(info.mid.lat, info.mid.lon)[axisIndex], size = info.mdb[axisIndex];
  const dx = result.gain.map(row => info.rows.reduce((t, r, k) => t + row[r] * e[k], 0) * size);
  const points = Object.create(null);
  result.parameters.forEach((p, i) => { points[p.id] ??= [0, 0, 0]; points[p.id][AXES.indexOf(p.axis)] = dx[i]; });
  for (const [id, xyz] of Object.entries(points)) {
    const p = project.points.find(x => x.id === id), r = unitVectors(p.lat, p.lon);
    points[id] = r.map(row => dot(row, xyz)); // ENU displacement (m)
  }
  return { mdb: size, axis: ENU[axisIndex], points };
}
