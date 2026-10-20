// χ², normal and Student t distributions and the critical values of the outlier tests
// (logGamma, incomplete gamma/beta, χ² and t inverses and Pope's τ ported from
// intersecao_re_3D/adjustment.js, which took them from ajusta_planos and nivelamento).

export function logGamma(z) {
  const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function regularizedGammaP(a, x) {
  if (x <= 0) return 0;
  if (a <= 0) return NaN;
  const gln = logGamma(a), EPS = 1e-14, ITMAX = 500;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 1; n <= ITMAX; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

export const chi2CDF = (x, dof) => regularizedGammaP(dof / 2, x / 2);

export function chi2Inv(p, dof) {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  let lo = 0, hi = Math.max(dof, 1);
  while (chi2CDF(hi, dof) < p) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (chi2CDF(mid, dof) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Two-tailed global test of Ω = VᵀPV against χ²(r) at significance α
export function globalTest(Omega, r, alpha = 0.05) {
  if (!(r > 0)) return { r, low: NaN, high: NaN, pass: null };
  const low = chi2Inv(alpha / 2, r), high = chi2Inv(1 - alpha / 2, r);
  return { r, low, high, pass: Omega >= low && Omega <= high };
}

export function normInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

export const normPdf = x => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// Continued fraction of the regularized incomplete beta function (Numerical Recipes betacf)
function betacf(a, b, x) {
  const EPS = 1e-14, FPMIN = 1e-300, ITMAX = 300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= ITMAX; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// I_x(a, b), the regularized incomplete beta function
export function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? front * betacf(a, b, x) / a : 1 - front * betacf(b, a, 1 - x) / b;
}

export function tCDF(t, dof) {
  const p = 0.5 * incompleteBeta(dof / 2, 0.5, dof / (dof + t * t));
  return t >= 0 ? 1 - p : p;
}

export function tInv(p, dof) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (!(dof > 0)) return NaN;
  const guess = Math.abs(normInv(p)) + 1;
  let lo = -guess, hi = guess;
  while (tCDF(lo, dof) > p) lo *= 2;
  while (tCDF(hi, dof) < p) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, dof) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- outlier tests
// Baarda's w-test: |w| > z(1 − α0/2), σ0 known a priori
export const wCritical = alpha0 => normInv(1 - alpha0 / 2);

// Pope's τ-test (σ0 estimated by σ̂0 from r degrees of freedom): τ_c = t √r / √(r − 1 + t²),
// t the Student quantile with r − 1 degrees of freedom
export function tauCritical(alpha0, r) {
  if (!(r >= 2)) return NaN;
  const t = tInv(1 - alpha0 / 2, r - 1);
  return t * Math.sqrt(r) / Math.sqrt(r - 1 + t * t);
}

// Non-centrality δ0 = z(1 − α0/2) + z(β0): the shift of w that the test detects with power β0
export const delta0 = (alpha0, power = 0.8) => wCritical(alpha0) + normInv(power);

// Histogram with equal bins over [min, max]; values outside are clamped into the end bins
export function histogram(values, { bins = 15, min, max } = {}) {
  const v = values.filter(Number.isFinite);
  const lo = min ?? Math.min(...v), hi = max ?? Math.max(...v);
  const width = hi > lo ? (hi - lo) / bins : 1;
  const counts = new Array(bins).fill(0);
  v.forEach(x => { counts[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / width)))]++; });
  return { lo, hi: lo + width * bins, width, counts, n: v.length };
}

export function describe(values) {
  const v = values.filter(Number.isFinite), n = v.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, rms: NaN, maxAbs: NaN };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const rms = Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n);
  return { n, mean, sd, rms, maxAbs: Math.max(...v.map(Math.abs)) };
}
