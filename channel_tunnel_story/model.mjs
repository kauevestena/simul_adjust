/** Pedagogical bearing-error model; NOT a reconstruction of the historical Eurotunnel survey. */
export const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
export function lateralErrorMeters(lengthKm, bearingErrorArcsec) {
  if (!Number.isFinite(lengthKm) || !Number.isFinite(bearingErrorArcsec) || lengthKm < 0 || Math.abs(bearingErrorArcsec) >= 324000)
    throw new RangeError("Expected non-negative finite distance and finite bearing error below 90 degrees");
  return lengthKm * 1000 * Math.tan(bearingErrorArcsec * ARCSEC_TO_RAD);
}
/** Approximate geographic portal locations, not survey-grade control points. */
export const PORTALS = Object.freeze({ uk:[1.1558,51.0971], fr:[1.7804,50.9228] });
/** Illustrative chord in plan view, NOT the surveyed three-bore alignment. */
export function illustrativeRoute(progress=1) {
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  return [PORTALS.uk,[PORTALS.uk[0]+(PORTALS.fr[0]-PORTALS.uk[0])*p,PORTALS.uk[1]+(PORTALS.fr[1]-PORTALS.uk[1])*p]];
}

/** Linearised transverse traverse: synthetic observations, known independent a-priori sigmas.
 * Unknowns are y1..y6 in metres; y0=0 is fixed. Each row observes (yi-yi-1)/L.
 * This is a 1D teaching adjustment, NOT the historical 3D Channel Tunnel network. */
export function adjustTraverse(biasArcsec = 5, withGyro = true) {
  if (!Number.isFinite(biasArcsec) || Math.abs(biasArcsec) > 20) throw new RangeError('Bearing bias outside ±20 arcseconds');
  const n = 6, length = 3000, scale = length * ARCSEC_TO_RAD;
  const opticalNoise = [0.8, -0.5, 1.2, -0.9, 0.3, -0.4];
  const gyroNoise = [0.2, -0.3, 0.1];
  const observations = opticalNoise.map((e, i) => ({ leg: i, kind: 'optical', value: (biasArcsec + e) * scale, sigma: 2 * scale }));
  if (withGyro) [1, 3, 5].forEach((leg, i) => observations.push({leg, kind:'gyro', value:gyroNoise[i] * scale, sigma:0.8 * scale}));
  const N = Array.from({length:n}, () => Array(n).fill(0)), rhs = Array(n).fill(0);
  for (const o of observations) {
    o.a = Array(n).fill(0); o.a[o.leg] = 1; if (o.leg) o.a[o.leg - 1] = -1;
    const w = 1 / o.sigma ** 2;
    for (let i=0;i<n;i++) { rhs[i] += o.a[i]*w*o.value; for(let j=0;j<n;j++) N[i][j] += o.a[i]*w*o.a[j]; }
  }
  // Gauss-Jordan on this small positive-definite system also yields its covariance.
  const aug = N.map((row,i) => [...row,...Array.from({length:n},(_,j)=>Number(i===j)),rhs[i]]);
  for(let k=0;k<n;k++) {
    const pivot = aug[k][k]; if (Math.abs(pivot)<1e-12) throw new Error('Singular traverse');
    for(let j=0;j<=2*n;j++) aug[k][j] /= pivot;
    for(let i=0;i<n;i++) if(i!==k) { const f=aug[i][k]; for(let j=0;j<=2*n;j++) aug[i][j] -= f*aug[k][j]; }
  }
  const y = aug.map(row=>row[2*n]), covariance=aug.map(row=>row.slice(n,2*n));
  const residuals=observations.map(o=>({...o,residual:o.a.reduce((s,a,i)=>s+a*y[i],0)-o.value}));
  return {y:[0,...y], x:Array.from({length:n+1},(_,i)=>i*length), covariance, observations:residuals,
    endpoint:y[n-1], sigma:Math.sqrt(covariance[n-1][n-1]), dof:observations.length-n,
    objective:residuals.reduce((s,o)=>s+(o.residual/o.sigma)**2,0)};
}

/** Two synthetic epochs; equal independent 1 mm observation SD at each point in each epoch. */
export function monitoringExercise(movementMm = 8, datumShiftMm = 5, unstableReference = false) {
  if (![movementMm,datumShiftMm].every(Number.isFinite)) throw new RangeError('Finite displacements required');
  const references = [0.4,-0.6,0.2].map((noise,i)=>datumShiftMm+noise+(unstableReference&&i===1?10:0));
  const datum = references.reduce((s,x)=>s+x,0)/references.length;
  const raw = datumShiftMm + movementMm + 0.3;
  const sigma = Math.sqrt(2 * (1 + 1 / references.length));
  return {references, datum, raw, corrected:raw-datum, sigma, limit95:1.96*sigma,
    referenceResiduals:references.map(x=>x-datum), unstable:unstableReference};
}
