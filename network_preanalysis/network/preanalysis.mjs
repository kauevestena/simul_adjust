import { Matrix, SingularValueDecomposition } from '../vendor/ml-matrix.mjs';
import { validateNetwork } from './model.mjs';
import { validateNetworkPlacement } from './constraints.mjs';
import { COMPONENTS, sightGeometry, sightJacobian, observationSigma } from './observations.mjs';
import { zeros, dot, covarianceBlock, controlCovariance } from './stochastic.mjs';
import { noncentrality, errorEllipse } from './reliability.mjs';

function connectedComponents(points, edges) {
  const adj = new Map(points.map(p => [p.id, []]));
  edges.forEach(s => { adj.get(s.from).push(s.to); adj.get(s.to).push(s.from); });
  const visited = new Set(), components = [];
  for (const p of points) {
    if (visited.has(p.id)) continue;
    const group = [], queue = [p.id];
    visited.add(p.id);
    while (queue.length) {
      const id = queue.pop(); group.push(id);
      for (const next of adj.get(id)) if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    components.push(group);
  }
  return components;
}

/** Pure deterministic pre-analysis. visibility is required for EVERY terrain sight.
 * No observations/residuals, no posterior variance estimate, no hidden datum fixing.
 * Fixed coordinates eliminated; stochastic coordinates remain unknowns with priors.
 */
export function analyze(network, visibility = {}, scenario = null) {
  const result = { solvable: false, diagnostics: [], invalidSights: [], rows: [], parameters: [],
    rank: 0, defect: 0, dof: 0, observationCount: 0, controlCount: 0, precision: Object.create(null), covariance: null };
  try {
    validateNetwork(network);
    if (network.level === 2) validateNetworkPlacement(network, scenario);
  } catch (error) { result.diagnostics.push({ code: error.message }); return result; }
  const points = network.points.filter(p => p.active !== false), byId = new Map(points.map(p => [p.id, p]));
  const candidates = [], orientations = new Set(), A = [], blocks = [];
  for (const sight of network.sights) {
    if (sight.active === false) continue;
    const from = byId.get(sight.from), to = byId.get(sight.to);
    if (!from || !to) continue;
    const components = COMPONENTS.filter(k => sight.components[k]);
    if (!components.length) continue;
    try {
      if (from.id === to.id) throw Error('selfSight');
      if (from.type !== 'station') throw Error('stationOrigin');
      if (Math.hypot(to.E - from.E, to.N - from.N, to.U - from.U) < 1e-8) throw Error('coincident');
      if (network.level > 0 && visibility[sight.id]?.status !== 'visible')
        throw Error(visibility[sight.id]?.status === 'blocked' ? 'terrainBlocked' : 'terrainMissing');
      const geometry = sightGeometry(from, to, sight);
      components.forEach(c => sightJacobian(geometry, c));
      candidates.push({ sight, from, to, components, geometry });
      if (components.includes('direction')) orientations.add(from.id);
    } catch (error) { result.invalidSights.push({ id: sight.id, code: error.message }); }
  }
  for (const p of points) if (p.control !== 'fixed')
    for (const axis of ['E', 'N', 'U']) result.parameters.push({ id: p.id, axis });
  for (const id of orientations) result.parameters.push({ id, axis: 'omega' });
  const index = new Map(result.parameters.map((p, i) => [`${p.id}\0${p.axis}`, i]));
  const u = result.parameters.length;
  const addCoordinate = (row, id, deriv, sign = 1) => ['E', 'N', 'U'].forEach((axis, j) => {
    const i = index.get(`${id}\0${axis}`); if (i !== undefined) row[i] += sign * deriv[j];
  });
  try {
    for (const { sight, from, to, components, geometry } of candidates) {
      for (const component of components) {
        const row = Array(u).fill(0), deriv = sightJacobian(geometry, component);
        addCoordinate(row, from.id, deriv, -1); addCoordinate(row, to.id, deriv);
        if (component === 'direction') row[index.get(`${from.id}\0omega`)] = -1;
        const sigma = observationSigma(component, geometry.distance, network.instrument);
        if (!(sigma > 0 && Number.isFinite(sigma))) throw Error('invalidSigma');
        blocks.push({ start: A.length, ...covarianceBlock([[sigma * sigma]], 1) });
        A.push(row);
        result.rows.push({ sightId: sight.id, from: from.id, to: to.id, component, sigma, geometry, source: 'sight' });
      }
    }
    result.observationCount = A.length;
    // Optional correlated raw observation covariance, in enabled component order.
    if (network.observationCovariance && A.length) {
      blocks.splice(0, blocks.length, { start: 0, ...covarianceBlock(network.observationCovariance, A.length) });
      result.rows.forEach((r, i) => { r.sigma = Math.sqrt(network.observationCovariance[i][i]); });
    }
    for (const p of points) if (p.control === 'stochastic') {
      const block = controlCovariance(p); blocks.push({ start: A.length, ...block });
      ['E', 'N', 'U'].forEach((axis, j) => {
        const row = Array(u).fill(0); row[index.get(`${p.id}\0${axis}`)] = 1; A.push(row);
        result.rows.push({ pointId: p.id, component: axis, sigma: Math.sqrt(block.q[j][j]), source: 'control' });
      });
      result.controlCount += 3;
    }
  } catch (error) { result.diagnostics.push({ code: error.message }); return result; }
  const m = A.length, B = zeros(m, u), PA = zeros(m, u), Pdiag = Array(m).fill(0);
  for (const { start, w, p } of blocks) {
    for (let i = 0; i < w.length; i++) {
      Pdiag[start + i] = p[i][i];
      for (let j = 0; j < w.length; j++) for (let k = 0; k < u; k++) {
        B[start + i][k] += w[i][j] * A[start + j][k];
        PA[start + i][k] += p[i][j] * A[start + j][k];
      }
    }
  }
  result.A = A; result.blocks = blocks.map(({ start, q, p }) => ({ start, q, p }));
  result.components = connectedComponents(points, candidates.map(c => c.sight));
  if (result.components.length > 1) result.diagnostics.push({ code: 'disconnected', count: result.components.length });
  const scale = Array.from({ length: u }, (_, j) => {
    const norm = Math.sqrt(B.reduce((s, r) => s + r[j] * r[j], 0));
    return norm > 0 ? 1 / norm : 1;
  });
  let singularValues = [], V = zeros(u, u);
  if (u && m) {
    // Column equilibration prevents metres/radians from controlling the rank test.
    // Pad short matrices so the full right null space is available for diagnostics.
    const scaled = B.map(row => row.map((x, j) => x * scale[j]));
    while (scaled.length < u) scaled.push(Array(u).fill(0));
    const svd = new SingularValueDecomposition(new Matrix(scaled), { autoTranspose: false });
    singularValues = svd.diagonal; V = svd.rightSingularVectors.to2DArray();
  }
  const tolerance = (singularValues[0] || 1) * Math.max(m, u, 1) * Number.EPSILON * 100;
  const rank = singularValues.filter(s => s > tolerance).length;
  Object.assign(result, { rank, defect: u - rank, dof: m - rank, singularValues, rankTolerance: tolerance,
    condition: rank ? singularValues[0] / singularValues[rank - 1] : Infinity });
  if (result.defect) {
    result.diagnostics.push({ code: 'rankDefect', count: result.defect });
    const affected = new Set();
    result.parameters.forEach((p, i) => {
      const nullEnergy = singularValues.length ? V[i].slice(rank).reduce((s, x) => s + x * x, 0) : 1;
      if (nullEnergy > 1e-7) {
        if (p.axis === 'omega') result.diagnostics.push({ code: 'orientationUnknown', id: p.id });
        else affected.add(p.id);
      }
    });
    for (const id of affected) result.diagnostics.push({ code: 'pointUndetermined', id });
    if (!points.some(p => p.control !== 'unknown')) result.diagnostics.push({ code: 'datumMissing' });
  } else if (result.condition > 1e7) result.diagnostics.push({ code: 'weakGeometry' });
  if (!m) result.diagnostics.push({ code: 'noObservations' });

  // SVD covariance / estimable-subspace projector. A deficient covariance is NEVER
  // exposed as absolute coordinate precision; only its residual projector is used.
  const q = zeros(u, u);
  for (let k = 0; k < rank; k++) for (let i = 0; i < u; i++) {
    const left = scale[i] * V[i][k] / singularValues[k];
    for (let j = 0; j <= i; j++) q[i][j] += left * scale[j] * V[j][k] / singularValues[k];
  }
  for (let i = 0; i < u; i++) for (let j = 0; j < i; j++) q[j][i] = q[i][j];
  const gain = q.map(row => PA.map(pa => dot(row, pa)));
  const delta = noncentrality(network.statistics.alpha, network.statistics.power);
  result.rows.forEach((row, i) => {
    const g = gain.map(r => r[i]);
    row.redundancy = 1 - dot(A[i], g);
    if (Math.abs(row.redundancy) < 1e-10) row.redundancy = 0;
    const detectability = Pdiag[i] - dot(PA[i], g);
    row.mdb = detectability > Pdiag[i] * 1e-10 ? delta / Math.sqrt(detectability) : Infinity;
  });
  result.solvable = !result.defect && m > 0;
  result.N = zeros(u, u);
  for (let i = 0; i < u; i++) for (let j = 0; j <= i; j++) {
    result.N[i][j] = A.reduce((s, row, k) => s + row[i] * PA[k][j], 0);
    result.N[j][i] = result.N[i][j];
  }
  if (result.solvable) {
    result.covariance = q; result.gain = gain;
    for (const p of points) {
      if (p.control === 'fixed') continue;
      const indices = ['E', 'N', 'U'].map(axis => index.get(`${p.id}\0${axis}`));
      const covariance = indices.map(i => indices.map(j => q[i][j]));
      result.precision[p.id] = { covariance, sigma: indices.map(i => Math.sqrt(Math.max(0, q[i][i]))), ellipse: errorEllipse(covariance) };
    }
  }
  result.worstHorizontal = result.solvable ? Math.max(0, ...Object.values(result.precision).map(p => p.ellipse.major)) : null;
  result.worstVertical = result.solvable ? Math.max(0, ...Object.values(result.precision).map(p => p.sigma[2])) : null;
  result.minimumRedundancy = result.rows.filter(r => r.source === 'sight').length ? Math.min(...result.rows.filter(r => r.source === 'sight').map(r => r.redundancy)) : null;
  return result;
}
