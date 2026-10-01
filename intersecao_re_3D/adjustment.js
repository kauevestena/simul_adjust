// --- Interseção a ré 3D: rede de estações livres pelo Modelo Combinado (GEMAEL) ---
// Cada visada (estação i -> ponto j) contribui com três equações de condição implícitas
// F(La, Xa) = 0, uma por componente do vetor irradiado:
//     F1 = Xj - Xi - S sinZ cos(Hz + ωi)
//     F2 = Yj - Yi - S sinZ sin(Hz + ωi)
//     F3 = Zj - Zi - S cosZ
// com as observações La = (Hz, Z, S) e as incógnitas Xa = coordenadas das estações e dos
// pontos livres mais a orientação ω de cada estação. Os pontos fixos entram como constantes.
// B = ∂F/∂La é a jacobiana da irradiação (a mesma do ajusta_planos), então M = B P⁻¹ Bᵀ é a
// MVC cartesiana de cada vetor irradiado. Em Ghilani (cap. 22, "general least squares") a
// mesma solução aparece com J = A, K = -W e We = M⁻¹.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NetAdjust = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const ARCSEC = Math.PI / (180 * 3600);
    const DEG = Math.PI / 180;
    const TWO_PI = 2 * Math.PI;

    // ---------------------------------------------------------------- álgebra linear
    // Copiada de ajusta_planos/adjustment.js: os simuladores não compartilham código.
    const linalg = {
        zeros(r, c) {
            const m = new Array(r);
            for (let i = 0; i < r; i++) m[i] = new Array(c).fill(0);
            return m;
        },
        identity(n) {
            const m = linalg.zeros(n, n);
            for (let i = 0; i < n; i++) m[i][i] = 1;
            return m;
        },
        transpose(A) {
            const r = A.length, c = A[0].length;
            const T = linalg.zeros(c, r);
            for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) T[j][i] = A[i][j];
            return T;
        },
        matmul(A, B) {
            const r = A.length, k = B.length, c = B[0].length;
            const C = linalg.zeros(r, c);
            for (let i = 0; i < r; i++) {
                for (let p = 0; p < k; p++) {
                    const a = A[i][p];
                    if (a === 0) continue;
                    for (let j = 0; j < c; j++) C[i][j] += a * B[p][j];
                }
            }
            return C;
        },
        matvec(A, v) {
            return A.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
        },
        scale(A, k) { return A.map(row => row.map(v => v * k)); },

        // Gauss-Jordan com pivoteamento parcial
        inv(Ain) {
            const n = Ain.length;
            const A = Ain.map(r => r.slice());
            const I = linalg.identity(n);
            for (let col = 0; col < n; col++) {
                let piv = col;
                for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
                if (Math.abs(A[piv][col]) < 1e-300) throw new Error('Matriz singular na inversão.');
                if (piv !== col) { [A[piv], A[col]] = [A[col], A[piv]]; [I[piv], I[col]] = [I[col], I[piv]]; }
                const d = A[col][col];
                for (let j = 0; j < n; j++) { A[col][j] /= d; I[col][j] /= d; }
                for (let r = 0; r < n; r++) {
                    if (r === col) continue;
                    const f = A[r][col];
                    if (f === 0) continue;
                    for (let j = 0; j < n; j++) { A[r][j] -= f * A[col][j]; I[r][j] -= f * I[col][j]; }
                }
            }
            return I;
        },
        solve(A, b) { return linalg.matvec(linalg.inv(A), b); },

        // Inversa 3×3 por cofatores (os blocos de M)
        inv3(m) {
            const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
            const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
            const det = a * A + b * B + c * C;
            if (!(Math.abs(det) > 1e-300)) throw new Error('Bloco 3×3 singular.');
            const k = 1 / det;
            return [
                [A * k, -(b * i - c * h) * k, (b * f - c * e) * k],
                [B * k, (a * i - c * g) * k, -(a * f - c * d) * k],
                [C * k, -(a * h - b * g) * k, (a * e - b * d) * k]
            ];
        },

        // Autovalores/autovetores de matriz simétrica pelo método cíclico de Jacobi.
        // Retorna { values, vectors } com as colunas de `vectors` alinhadas a `values`,
        // em ordem crescente de autovalor.
        eigSym(Ain, maxSweeps = 100) {
            const n = Ain.length;
            const A = Ain.map(r => r.slice());
            let V = linalg.identity(n);
            // Tolerância relativa à escala da matriz: as MVC aqui têm termos ~1e-8 m²
            let scale = 0;
            for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale += A[i][j] * A[i][j];
            const tiny = 1e-30 * Math.max(scale, 1e-300);
            for (let sweep = 0; sweep < maxSweeps; sweep++) {
                let off = 0;
                for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
                if (off <= tiny) break;
                for (let p = 0; p < n - 1; p++) {
                    for (let q = p + 1; q < n; q++) {
                        if (Math.abs(A[p][q]) < 1e-300) continue;
                        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
                        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
                        for (let k = 0; k < n; k++) {
                            const akp = A[k][p], akq = A[k][q];
                            A[k][p] = c * akp - s * akq;
                            A[k][q] = s * akp + c * akq;
                        }
                        for (let k = 0; k < n; k++) {
                            const apk = A[p][k], aqk = A[q][k];
                            A[p][k] = c * apk - s * aqk;
                            A[q][k] = s * apk + c * aqk;
                        }
                        for (let k = 0; k < n; k++) {
                            const vkp = V[k][p], vkq = V[k][q];
                            V[k][p] = c * vkp - s * vkq;
                            V[k][q] = s * vkp + c * vkq;
                        }
                    }
                }
            }
            const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
            return {
                values: idx.map(i => A[i][i]),
                vectors: Array.from({ length: n }, (_, r) => idx.map(i => V[r][i]))
            };
        },

        // Cópia de V (3×3, colunas ortonormais) com determinante +1. A ordenação por
        // autovalor pode deixar a base à esquerda, e quem monta uma rotação a partir dela
        // (THREE.Quaternion.setFromRotationMatrix) exige det = +1. Trocar o sinal de uma
        // coluna não altera o elipsoide.
        rightHanded(V) {
            const M = V.map(r => r.slice());
            const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
                - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
                + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
            if (det < 0) for (let i = 0; i < 3; i++) M[i][0] = -M[i][0];
            return M;
        },

        dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); },
        norm(a) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)); },

        // Número de condição de matriz simétrica (|λ|max / |λ|min)
        condSym(M) {
            const ev = linalg.eigSym(M).values.map(Math.abs);
            const mx = Math.max(...ev), mn = Math.min(...ev);
            return mn > 0 ? mx / mn : Infinity;
        }
    };

    // ---------------------------------------------------------------- estatística
    // Copiadas de ajusta_planos/adjustment.js (que por sua vez as trouxe do nivelamento).
    function logGamma(z) {
        const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
            -176.61502916214059, 12.507343278686905, -0.13857109526572012,
            9.9843695780195716e-6, 1.5056327351493116e-7];
        if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
        z -= 1;
        let x = 0.99999999999980993;
        for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
        const t = z + p.length - 0.5;
        return Math.log(Math.sqrt(2 * Math.PI)) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }

    function regularizedGammaP(a, x) {
        if (x <= 0) return 0;
        if (a <= 0) return NaN;
        const gln = logGamma(a);
        const EPS = 1e-14, ITMAX = 300;
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

    function chi2CDF(x, dof) { return regularizedGammaP(dof / 2, x / 2); }

    function chi2Inv(p, dof) {
        if (p <= 0) return 0;
        if (p >= 1) return Infinity;
        let lo = 0, hi = Math.max(dof, 1);
        while (chi2CDF(hi, dof) < p) hi *= 2;
        for (let i = 0; i < 100; i++) {
            const mid = (lo + hi) / 2;
            if (chi2CDF(mid, dof) < p) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

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

    function incompleteBeta(a, b, x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) +
            a * Math.log(x) + b * Math.log(1 - x));
        return (x < (a + 1) / (a + b + 2))
            ? front * betacf(a, b, x) / a
            : 1 - front * betacf(b, a, 1 - x) / b;
    }

    function tCDF(t, dof) {
        const x = dof / (dof + t * t);
        const p = 0.5 * incompleteBeta(dof / 2, 0.5, x);
        return t >= 0 ? 1 - p : p;
    }

    function tInv(p, dof) {
        if (p <= 0) return -Infinity;
        if (p >= 1) return Infinity;
        if (!(dof > 0)) return NaN;
        const chute = Math.abs(normInv(p)) + 1;
        let lo = -chute, hi = chute;
        while (tCDF(lo, dof) > p) lo *= 2;
        while (tCDF(hi, dof) < p) hi *= 2;
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            if (tCDF(mid, dof) < p) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

    function normInv(p) {
        const a1 = -39.69683028665376, a2 = 220.9460984245205, a3 = -275.9285104469687,
            a4 = 138.3577518672690, a5 = -30.66479806614716, a6 = 2.506628277459239;
        const b1 = -54.47609879822406, b2 = 161.5858368580409, b3 = -155.6989798598866,
            b4 = 66.80131188771972, b5 = -13.28068155288572;
        const c1 = -0.007784894002430293, c2 = -0.3223964580411365, c3 = -2.400758277161838,
            c4 = -2.549732539343734, c5 = 4.374664141464968, c6 = 2.938163982698783;
        const d1 = 0.007784695709041462, d2 = 0.3224671290700398, d3 = 2.445134137142996,
            d4 = 3.754408661907416;
        const p_low = 0.02425;
        let q, r;
        if (p < p_low) {
            q = Math.sqrt(-2 * Math.log(p));
            return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
        } else if (p <= 1 - p_low) {
            q = p - 0.5; r = q * q;
            return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
        }
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }

    // Valor crítico do teste tau de Pope: τ = t·√r / √(r - 1 + t²), t com r - 1 graus
    function tauCritical(alpha0, dof) {
        if (!(dof >= 2)) return NaN;
        const t = tInv(1 - alpha0 / 2, dof - 1);
        return t * Math.sqrt(dof) / Math.sqrt(dof - 1 + t * t);
    }

    // ---------------------------------------------------------------- geometria
    function wrap2Pi(rad) { return ((rad % TWO_PI) + TWO_PI) % TWO_PI; }
    function wrapPi(rad) { const w = wrap2Pi(rad); return w > Math.PI ? w - TWO_PI : w; }

    // Vetor irradiado, convenção do ajusta_planos (io.js, obsToXYZ) com α = Hz + ω
    function polarToDelta(hz, zen, s, omega) {
        const a = hz + omega, sz = Math.sin(zen);
        return [s * sz * Math.cos(a), s * sz * Math.sin(a), s * Math.cos(zen)];
    }

    // F(L, X) de uma visada
    function conditionF(L, st, omega, tg) {
        const d = polarToDelta(L[0], L[1], L[2], omega);
        return [tg[0] - st[0] - d[0], tg[1] - st[1] - d[1], tg[2] - st[2] - d[2]];
    }

    // B = ∂F/∂(Hz, Z, S): 3×3, linhas F1..F3
    function jacobianB(L, omega) {
        const [hz, zen, s] = L;
        const a = hz + omega;
        const sa = Math.sin(a), ca = Math.cos(a), sz = Math.sin(zen), cz = Math.cos(zen);
        return [
            [s * sz * sa, -s * cz * ca, -sz * ca],
            [-s * sz * ca, -s * cz * sa, -sz * sa],
            [0, s * sz, -cz]
        ];
    }

    // ∂F/∂ω da estação: igual à coluna de Hz em B, pois α = Hz + ω
    function omegaColumn(L, omega) {
        const a = L[0] + omega, ssz = L[2] * Math.sin(L[1]);
        return [ssz * Math.sin(a), -ssz * Math.cos(a), 0];
    }

    // ---------------------------------------------------------------- modelo estocástico
    // Desvios efetivos (rad, rad, m) de uma linha. O CSV traz os desvios angulares em
    // segundos (padrão) ou graus; vazio ou ≤ 0 cai no nominal.
    function obsSigmas(row, S) {
        const unit = S.sigmaAngUnit === 'deg' ? 3600 : 1;
        const nomAng = S.sigAngSec * ARCSEC;
        const nomD = S.edmMm / 1000 + S.edmPpm * 1e-6 * row.dist;
        const nom = [nomAng, nomAng, nomD];
        const csv = [row.sHz, row.sZen, row.sDist].map((v, i) =>
            (v !== null && v !== undefined && v > 0) ? (i < 2 ? v * unit * ARCSEC : v) : null);
        const nominalUsed = [false, false, false];
        const sig = csv.map((c, i) => {
            if (S.sigmaSource === 'nominal') return nom[i];
            if (c === null) { nominalUsed[i] = true; return nom[i]; }
            if (S.sigmaSource === 'max') return Math.max(c, nom[i]);
            return c;
        });
        return { sig, nominalUsed };
    }

    // ---------------------------------------------------------------- registro de avisos
    function makeLog() {
        const items = [];
        const add = level => msg => { items.push({ level, msg }); };
        return { items, info: add('info'), warn: add('aviso'), error: add('erro') };
    }

    class NetworkError extends Error {
        constructor(msg, log) {
            super(msg);
            this.name = 'NetworkError';
            this.log = log ? log.items : [];
        }
    }

    const unique = arr => Array.from(new Set(arr));
    const fmtLen = m => Math.abs(m) >= 1 ? `${m.toFixed(3)} m` : `${(m * 1000).toFixed(1)} mm`;
    const rowRad = r => [r.hzDeg * DEG, r.zenDeg * DEG, r.dist];

    // ---------------------------------------------------------------- pose de estação
    // Rotação em torno de Z + translação (Procrustes sem escala) entre os vetores locais da
    // estação (ω = 0, origem no instrumento) e as coordenadas conhecidas dos pontos visados.
    // Com a posição da estação já conhecida, só a orientação é estimada.
    function fitStationPose(pairs, ownXYZ) {
        let xyz, omega;
        if (ownXYZ) {
            let sx = 0, sy = 0;
            pairs.forEach(p => {
                const azK = Math.atan2(p.known[1] - ownXYZ[1], p.known[0] - ownXYZ[0]);
                const azL = Math.atan2(p.local[1], p.local[0]);
                sx += Math.cos(azK - azL); sy += Math.sin(azK - azL);
            });
            omega = Math.atan2(sy, sx);
            xyz = ownXYZ.slice();
        } else {
            const n = pairs.length;
            const lc = [0, 0], kc = [0, 0];
            pairs.forEach(p => { lc[0] += p.local[0]; lc[1] += p.local[1]; kc[0] += p.known[0]; kc[1] += p.known[1]; });
            lc[0] /= n; lc[1] /= n; kc[0] /= n; kc[1] /= n;
            let a = 0, b = 0;
            pairs.forEach(p => {
                const lx = p.local[0] - lc[0], ly = p.local[1] - lc[1];
                const kx = p.known[0] - kc[0], ky = p.known[1] - kc[1];
                a += lx * kx + ly * ky;
                b += lx * ky - ly * kx;
            });
            omega = Math.atan2(b, a);
            const c = Math.cos(omega), s = Math.sin(omega);
            let z = 0;
            pairs.forEach(p => { z += p.known[2] - p.local[2]; });
            xyz = [kc[0] - (c * lc[0] - s * lc[1]), kc[1] - (s * lc[0] + c * lc[1]), z / n];
        }
        omega = wrap2Pi(omega);
        const misfits = pairs.map(p => {
            const q = applyPose(xyz, omega, p.local);
            return Math.hypot(p.known[0] - q[0], p.known[1] - q[1], p.known[2] - q[2]);
        });
        return { xyz, omega, misfits };
    }

    function applyPose(xyz, omega, local) {
        const c = Math.cos(omega), s = Math.sin(omega);
        return [xyz[0] + c * local[0] - s * local[1], xyz[1] + s * local[0] + c * local[1], xyz[2] + local[2]];
    }

    // ---------------------------------------------------------------- montagem da rede
    function buildNetwork(rows, S) {
        const log = makeLog();
        const act = rows.filter(r => r.active);
        if (!act.length) throw new NetworkError('Nenhuma visada ativa.', log);

        // "Fixo" e X,Y,Z são propriedades do ponto: lidos de todas as linhas, ativas ou não
        const flags = new Map(), given = new Map();
        rows.forEach(r => {
            const f = flags.get(r.target) || { yes: 0, no: 0 };
            if (r.fixed) f.yes++; else f.no++;
            flags.set(r.target, f);
            if (r.fixed && r.xyz) {
                const prev = given.get(r.target);
                if (!prev) given.set(r.target, { xyz: r.xyz.slice(), line: r.line });
                else if (prev.xyz.some((v, i) => Math.abs(v - r.xyz[i]) > 1e-6)) {
                    log.warn(`Coordenadas diferentes para ${r.target} (linhas ${prev.line} e ${r.line}); usadas as da linha ${prev.line}.`);
                }
            }
        });
        flags.forEach((f, name) => {
            if (f.yes && f.no) log.warn(`${name} está marcado como fixo em ${f.yes} linha(s) e livre em ${f.no}; tratado como fixo.`);
        });
        const isFixed = name => { const f = flags.get(name); return !!f && f.yes > 0; };

        const stations = unique(act.map(r => r.station));
        const targets = unique(act.map(r => r.target));
        unique(rows.map(r => r.station)).filter(s => !stations.includes(s))
            .forEach(s => log.info(`Estação ${s} ficou sem visadas ativas e saiu do ajustamento.`));
        unique(rows.map(r => r.target)).filter(t => !targets.includes(t) && !stations.includes(t))
            .forEach(t => log.info(`Ponto ${t} ficou sem visadas ativas e saiu do ajustamento.`));

        const fixedPts = unique(targets.concat(stations)).filter(isFixed);
        if (!fixedPts.length) {
            throw new NetworkError('Nenhum ponto fixo entre as visadas ativas: marque os pontos de apoio com Fixo = sim.', log);
        }
        const fixedCoords = new Map();
        fixedPts.forEach(n => { if (given.has(n)) fixedCoords.set(n, given.get(n).xyz.slice()); });

        // Pontos fixos sem coordenadas: irradiados da única estação que os visa
        const missing = fixedPts.filter(n => !fixedCoords.has(n));
        const datum = { computed: missing.slice(), origins: [] };
        if (missing.length) {
            const asStation = missing.filter(n => stations.includes(n));
            if (asStation.length) {
                throw new NetworkError(`O ponto fixo ${asStation.join(', ')} também é estação e não tem coordenadas; informe X,Y,Z.`, log);
            }
            const obsBy = new Map(missing.map(n => [n, unique(act.filter(r => r.target === n).map(r => r.station))]));
            const multi = missing.filter(n => obsBy.get(n).length > 1);
            if (multi.length) {
                throw new NetworkError('Ponto fixo sem coordenadas visado de mais de uma estação: ' +
                    multi.map(n => `${n} (${obsBy.get(n).join(', ')})`).join('; ') +
                    '. Sem X,Y,Z só é possível uma estação de origem: informe as coordenadas ou mantenha as visadas desses pontos numa única estação.', log);
            }
            const origins = unique(missing.map(n => obsBy.get(n)[0]));
            const assumed = [];
            origins.forEach(st => {
                const known = act.filter(r => r.station === st && fixedCoords.has(r.target));
                let pose, method;
                if (unique(known.map(r => r.target)).length >= 2) {
                    pose = fitStationPose(known.map(r => ({ local: polarToDelta(...rowRad(r), 0), known: fixedCoords.get(r.target) })), null);
                    method = 'resseção';
                } else {
                    pose = { xyz: [S.datumX, S.datumY, S.datumZ], omega: wrap2Pi(S.datumOmegaDeg * DEG) };
                    method = 'datum assumido';
                    assumed.push(st);
                }
                datum.origins.push({ station: st, method, xyz: pose.xyz.slice(), omega: pose.omega });
            });
            if (assumed.length > 1) {
                throw new NetworkError(`Só uma estação pode ser a origem do datum local assumido, mas ${assumed.join(', ')} dependeriam dele. ` +
                    'Informe X,Y,Z de pontos fixos para as demais.', log);
            }
            missing.forEach(n => {
                const org = datum.origins.find(o => o.station === obsBy.get(n)[0]);
                const shots = act.filter(r => r.station === org.station && r.target === n);
                const acc = [0, 0, 0];
                shots.forEach(r => {
                    const q = applyPose(org.xyz, org.omega, polarToDelta(...rowRad(r), 0));
                    acc[0] += q[0]; acc[1] += q[1]; acc[2] += q[2];
                });
                fixedCoords.set(n, acc.map(v => v / shots.length));
            });
            datum.origins.forEach(o => {
                const pts = missing.filter(n => obsBy.get(n)[0] === o.station);
                const pose = o.method === 'datum assumido'
                    ? `datum local assumido em ${o.station}: X=${o.xyz[0]}, Y=${o.xyz[1]}, Z=${o.xyz[2]}, ω=${(o.omega / DEG).toFixed(4)}°`
                    : `pose de ${o.station} obtida por resseção nos fixos com coordenadas`;
                log.info(`Pontos fixos sem coordenadas no CSV (${pts.join(', ')}) foram irradiados de ${o.station} (${pose}).`);
                if (o.method === 'datum assumido') {
                    log.info(`As visadas de ${o.station} a ${pts.join(', ')} definem o datum: como as coordenadas saíram ` +
                        'delas mesmas, seus resíduos ficam nulos enquanto o resto da rede não as tensionar.');
                }
            });
        }

        // Incógnitas: estações (X, Y, Z, ω) na ordem de aparição, depois os pontos livres
        const unknowns = [];
        const index = new Map();
        const addXYZ = (name, e) => {
            e.x = unknowns.length; unknowns.push({ name: `X_${name}`, point: name, kind: 'X' });
            e.y = unknowns.length; unknowns.push({ name: `Y_${name}`, point: name, kind: 'Y' });
            e.z = unknowns.length; unknowns.push({ name: `Z_${name}`, point: name, kind: 'Z' });
        };
        stations.forEach(s => {
            const e = { x: null, y: null, z: null, w: null };
            if (!fixedCoords.has(s)) addXYZ(s, e);
            e.w = unknowns.length; unknowns.push({ name: `ω_${s}`, point: s, kind: 'w' });
            index.set(s, e);
        });
        targets.forEach(t => {
            if (index.has(t) || fixedCoords.has(t)) return;
            const e = { x: null, y: null, z: null, w: null };
            addXYZ(t, e);
            index.set(t, e);
        });

        const u = unknowns.length, nEq = 3 * act.length, dof = nEq - u;
        if (dof < 0) {
            throw new NetworkError(`Redundância negativa: ${nEq} equações para ${u} incógnitas. Adicione visadas.`, log);
        }
        if (dof === 0) log.warn('Redundância nula: solução única, sem controle de qualidade possível.');

        return { rows: act, stations, targets, fixedCoords, isFixed, datum, unknowns, index, u, nEq, dof, log };
    }

    // ---------------------------------------------------------------- aproximações iniciais
    // A partir dos pontos conhecidos, cada estação que vê ao menos dois deles tem sua pose
    // calculada (resseção) e irradia os pontos ainda desconhecidos; repete até esgotar.
    // Visadas que destoam muito na resseção são deixadas de fora e reportadas, inclusive
    // quando a diferença some ao somar 180° à leitura horizontal (face II não reduzida).
    function approximate(net, S) {
        const log = net.log;
        const known = new Map(net.fixedCoords);
        const source = new Map();
        net.fixedCoords.forEach((_, n) => source.set(n, { kind: 'fixo' }));
        const omega = new Map();
        const pending = new Set(net.stations);
        const steps = [];
        const rowsBy = new Map(net.stations.map(s => [s, net.rows.filter(r => r.station === s)]));
        const local = r => polarToDelta(...rowRad(r), 0);
        const flip = l => [-l[0], -l[1], l[2]];

        while (pending.size) {
            let best = null;
            pending.forEach(st => {
                const own = known.has(st);
                const n = unique(rowsBy.get(st).filter(r => known.has(r.target)).map(r => r.target)).length;
                if (n >= (own ? 1 : 2) && (!best || n > best.n)) best = { st, n, own };
            });
            if (!best) {
                const why = Array.from(pending).map(st =>
                    `${st} (${unique(rowsBy.get(st).filter(r => known.has(r.target)).map(r => r.target)).length})`).join(', ');
                throw new NetworkError(`Não foi possível obter aproximações para as estações ${why}: cada uma precisa visar ` +
                    'ao menos 2 pontos já determinados (fixos ou irradiados de outra estação). Entre parênteses, quantos ela vê.', log);
            }
            const st = best.st;
            const ownXYZ = best.own ? known.get(st) : null;
            let pairs = rowsBy.get(st).filter(r => known.has(r.target))
                .map(r => ({ row: r, local: local(r), known: known.get(r.target) }));
            const meanDist = pairs.reduce((a, p) => a + p.row.dist, 0) / pairs.length;
            const tol = Math.max(0.05, 1e-3 * meanDist);
            let pose = fitStationPose(pairs, ownXYZ);
            const excluded = [];

            // Exclui a pior visada enquanto sobrar redundância para identificá-la
            while (pairs.length >= (best.own ? 2 : 3)) {
                let worst = 0;
                pose.misfits.forEach((m, i) => { if (m > pose.misfits[worst]) worst = i; });
                if (pose.misfits[worst] <= tol) break;
                const bad = pairs[worst];
                const rest = pairs.filter((_, i) => i !== worst);
                const refit = fitStationPose(rest, ownXYZ);
                // A dúvida pode estar na visada desta estação ou na que irradiou o ponto
                const predicted = applyPose(refit.xyz, refit.omega, bad.local);
                const flipped = applyPose(refit.xyz, refit.omega, flip(bad.local));
                let hint = '';
                const src = source.get(bad.row.target);
                if (Math.hypot(...flipped.map((v, i) => v - bad.known[i])) < tol) {
                    hint = ` A diferença desaparece somando 180° à leitura horizontal de ${st}→${bad.row.target}: leitura em face II não reduzida?`;
                } else if (src && src.kind === 'irradiado') {
                    const o = src.origin;
                    const alt = applyPose(known.get(o.station) || [0, 0, 0], omega.get(o.station), flip(local(src.row)));
                    if (Math.hypot(...alt.map((v, i) => v - predicted[i])) < tol) {
                        hint = ` A diferença desaparece somando 180° à leitura horizontal de ${src.row.station}→${bad.row.target}: leitura em face II não reduzida?`;
                        known.set(bad.row.target, predicted);
                        source.set(bad.row.target, { kind: 'irradiado', origin: { station: st }, row: bad.row });
                    }
                }
                log.warn(`Aproximações: ${bad.row.target} destoa ${fmtLen(pose.misfits[worst])} na resseção de ${st} e foi deixado de fora dela.${hint}`);
                excluded.push({ target: bad.row.target, misfit: pose.misfits[worst] });
                pairs = rest;
                pose = refit;
            }
            const maxMis = Math.max(...pose.misfits);
            if (maxMis > tol) {
                log.warn(`Aproximações: a resseção de ${st} só dispõe de ${pairs.length} ponto(s) e eles discordam ${fmtLen(maxMis)}; ` +
                    `confira as visadas ${pairs.map(p => `${st}→${p.row.target}`).join(', ')}.`);
            }
            if (!best.own) { known.set(st, pose.xyz); source.set(st, { kind: 'resseção' }); }
            omega.set(st, pose.omega);
            steps.push({ station: st, nKnown: pairs.length, misfit: maxMis, excluded, own: best.own });

            // Irradia os pontos ainda desconhecidos (média se visados mais de uma vez)
            const acc = new Map();
            rowsBy.get(st).forEach(r => {
                if (known.has(r.target)) return;
                const q = applyPose(known.get(st), pose.omega, local(r));
                const a = acc.get(r.target) || { s: [0, 0, 0], n: 0, row: r };
                a.s[0] += q[0]; a.s[1] += q[1]; a.s[2] += q[2]; a.n++;
                acc.set(r.target, a);
            });
            acc.forEach((a, name) => {
                known.set(name, a.s.map(v => v / a.n));
                source.set(name, { kind: 'irradiado', origin: { station: st }, row: a.row });
            });
            pending.delete(st);
        }
        return { coords: known, omega, steps, source };
    }

    // ---------------------------------------------------------------- linearização
    // Um bloco por visada: colunas não nulas de A (≤ 7), B, M = BΣBᵀ, M⁻¹ e W.
    function linearize(net, Xv, La, Lb, sig) {
        const idx = net.index;
        const coordOf = name => {
            const e = idx.get(name);
            if (e && e.x !== null) return [Xv[e.x], Xv[e.y], Xv[e.z]];
            return net.fixedCoords.get(name);
        };
        return net.rows.map((r, k) => {
            const L0 = La[k];
            const es = idx.get(r.station), et = idx.get(r.target);
            const om = Xv[es.w];
            const st = coordOf(r.station), tg = coordOf(r.target);
            const F = conditionF(L0, st, om, tg);
            const B = jacobianB(L0, om);
            const dL = [Lb[k][0] - L0[0], Lb[k][1] - L0[1], Lb[k][2] - L0[2]];
            const W = [0, 1, 2].map(i => F[i] + B[i][0] * dL[0] + B[i][1] * dL[1] + B[i][2] * dL[2]);
            const s2 = sig[k].map(v => v * v);
            const M = linalg.zeros(3, 3);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                M[i][j] = B[i][0] * s2[0] * B[j][0] + B[i][1] * s2[1] * B[j][1] + B[i][2] * s2[2] * B[j][2];
            }
            const Minv = linalg.inv3(M);

            const cols = [], Acols = [];
            if (et && et.x !== null) {
                cols.push(et.x, et.y, et.z);
                Acols.push([1, 0, 0], [0, 1, 0], [0, 0, 1]);
            }
            if (es.x !== null) {
                cols.push(es.x, es.y, es.z);
                Acols.push([-1, 0, 0], [0, -1, 0], [0, 0, -1]);
            }
            cols.push(es.w);
            Acols.push(omegaColumn(L0, om));
            return { cols, Acols, B, M, Minv, W, F };
        });
    }

    // ---------------------------------------------------------------- ajustamento
    function adjustNetwork(rows, S) {
        const net = buildNetwork(rows, S);
        const log = net.log;
        const approx = approximate(net, S);
        const { u, dof } = net;
        const m = net.rows.length;

        const Lb = net.rows.map(rowRad);
        const sigInfo = net.rows.map(r => obsSigmas(r, S));
        const sig = sigInfo.map(s => s.sig);
        const nomRows = net.rows.filter((r, i) => sigInfo[i].nominalUsed.some(Boolean));
        if (nomRows.length) {
            log.warn(`${nomRows.length} visada(s) sem desvio-padrão válido no CSV usaram o nominal: ` +
                nomRows.slice(0, 8).map(r => r.id).join(', ') + (nomRows.length > 8 ? '…' : '') + '.');
        }

        const X0 = new Array(u).fill(0);
        net.index.forEach((e, name) => {
            const c = approx.coords.get(name);
            if (e.x !== null) { X0[e.x] = c[0]; X0[e.y] = c[1]; X0[e.z] = c[2]; }
            if (e.w !== null) X0[e.w] = approx.omega.get(name);
        });
        const Xinit = X0.slice();

        let La = Lb.map(r => r.slice());
        let V = Lb.map(() => [0, 0, 0]);
        const history = [];
        let iterations = 0, converged = false;
        let lin = null, N = null, Ninv = null, U = null, X = null, K = null, VtPV = 0;
        const tolLin = S.tolLinMm / 1000, tolAng = S.tolAngSec * ARCSEC;

        for (let it = 0; it < S.maxIter; it++) {
            iterations = it + 1;
            lin = linearize(net, X0, La, Lb, sig);

            // N = Aᵀ M⁻¹ A e U = Aᵀ M⁻¹ W, acumulados visada a visada
            N = linalg.zeros(u, u);
            U = new Array(u).fill(0);
            lin.forEach(b => {
                const nc = b.cols.length;
                const AtMi = b.Acols.map(a => [0, 1, 2].map(j => a[0] * b.Minv[0][j] + a[1] * b.Minv[1][j] + a[2] * b.Minv[2][j]));
                for (let p = 0; p < nc; p++) {
                    const cp = b.cols[p], g = AtMi[p];
                    U[cp] += g[0] * b.W[0] + g[1] * b.W[1] + g[2] * b.W[2];
                    for (let q = 0; q < nc; q++) {
                        const a = b.Acols[q];
                        N[cp][b.cols[q]] += g[0] * a[0] + g[1] * a[1] + g[2] * a[2];
                    }
                }
            });
            try { Ninv = linalg.inv(N); }
            catch (e) {
                throw new NetworkError('Sistema normal singular: a geometria não determina todas as incógnitas ' +
                    '(estação com visadas insuficientes ou pontos alinhados).', log);
            }
            X = linalg.matvec(Ninv, U).map(v => -v);

            // K = -M⁻¹(AX + W),  V = Σ Bᵀ K,  La = Lb + V
            K = []; VtPV = 0;
            let normW = 0;
            V = lin.map((b, k) => {
                const t = [0, 1, 2].map(i => b.W[i] + b.cols.reduce((s, c, q) => s + b.Acols[q][i] * X[c], 0));
                const Kk = [0, 1, 2].map(i => -(b.Minv[i][0] * t[0] + b.Minv[i][1] * t[1] + b.Minv[i][2] * t[2]));
                K.push(Kk);
                const s2 = sig[k].map(v => v * v);
                const Vk = [0, 1, 2].map(c => s2[c] * (b.B[0][c] * Kk[0] + b.B[1][c] * Kk[1] + b.B[2][c] * Kk[2]));
                for (let c = 0; c < 3; c++) VtPV += Vk[c] * Vk[c] / s2[c];
                normW += b.W[0] * b.W[0] + b.W[1] * b.W[1] + b.W[2] * b.W[2];
                return Vk;
            });
            La = Lb.map((l, k) => [l[0] + V[k][0], l[1] + V[k][1], l[2] + V[k][2]]);

            let maxLin = 0, maxAng = 0;
            net.unknowns.forEach((unk, i) => {
                X0[i] += X[i];
                if (unk.kind === 'w') maxAng = Math.max(maxAng, Math.abs(X[i]));
                else maxLin = Math.max(maxLin, Math.abs(X[i]));
            });
            history.push({ iter: iterations, maxLin, maxAng, VtPV, normW: Math.sqrt(normW) });
            if (![maxLin, maxAng, VtPV].every(Number.isFinite)) {
                throw new NetworkError(`O ajustamento divergiu na iteração ${iterations} (valores não finitos).`, log);
            }
            if (maxLin < tolLin && maxAng < tolAng) { converged = true; break; }
        }
        net.unknowns.forEach((unk, i) => { if (unk.kind === 'w') X0[i] = wrap2Pi(X0[i]); });

        if (!converged) {
            const h = history[history.length - 1];
            log.warn(`Não convergiu em ${S.maxIter} iterações: última correção ${fmtLen(h.maxLin)} / ` +
                `${(h.maxAng / ARCSEC).toFixed(4)}″ (critério ${S.tolLinMm} mm / ${S.tolAngSec}″).`);
        }

        // ---- controle de qualidade
        const sigma02 = dof > 0 ? VtPV / dof : NaN;
        const sigma0 = Math.sqrt(sigma02);
        const varScale = (S.sigmaXaScale === 'priori' || !(dof > 0)) ? 1 : sigma02;
        const Q = Ninv;
        const SigmaXa = linalg.scale(Q, varScale);

        const alpha = S.alphaPct / 100, alpha0 = S.alpha0Pct / 100;
        const chi2low = dof > 0 ? chi2Inv(alpha / 2, dof) : NaN;
        const chi2upp = dof > 0 ? chi2Inv(1 - alpha / 2, dof) : NaN;
        const globalPass = dof > 0 ? (VtPV >= chi2low && VtPV <= chi2upp) : null;
        const critW = normInv(1 - alpha0 / 2);
        const delta0 = critW + normInv(S.powerPct / 100);
        const tauCrit = tauCritical(alpha0, dof);

        // Diagonal de Q_V por visada: Σ Bᵀ (M⁻¹ - M⁻¹ A Q Aᵀ M⁻¹) B Σ
        const obsData = lin.map((b, k) => {
            const nc = b.cols.length;
            const AQA = linalg.zeros(3, 3);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                let s = 0;
                for (let p = 0; p < nc; p++) {
                    const ai = b.Acols[p][i];
                    if (ai === 0) continue;
                    for (let q = 0; q < nc; q++) s += ai * Q[b.cols[p]][b.cols[q]] * b.Acols[q][j];
                }
                AQA[i][j] = s;
            }
            const MiAQAMi = linalg.matmul(linalg.matmul(b.Minv, AQA), b.Minv);
            const QK = b.Minv.map((row, i) => row.map((v, j) => v - MiAQAMi[i][j]));
            const s2 = sig[k].map(v => v * v);
            const qv = [0, 1, 2].map(c => {
                let s = 0;
                for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += b.B[i][c] * QK[i][j] * b.B[j][c];
                return Math.max(0, s2[c] * s2[c] * s);
            });
            const r = qv.map((q, c) => Math.min(1, q / s2[c]));
            const controlled = r.map(x => x > 1e-6);
            const v = V[k];
            const w = v.map((x, c) => controlled[c] ? x / Math.sqrt(qv[c]) : NaN);
            const tau = v.map((x, c) => (controlled[c] && dof > 0) ? x / (sigma0 * Math.sqrt(qv[c])) : NaN);
            const mdb = r.map((x, c) => controlled[c] ? delta0 * sig[k][c] / Math.sqrt(x) : null);
            return {
                row: net.rows[k], k,
                Lb: Lb[k], La: La[k], v, sigma: sig[k], qv, r, w, tau, mdb, controlled,
                nominalUsed: sigInfo[k].nominalUsed,
                isOutlier: w.some(x => Number.isFinite(x) && Math.abs(x) > critW)
            };
        });
        const redundancySum = obsData.reduce((a, o) => a + o.r[0] + o.r[1] + o.r[2], 0);

        // ---- resultados por ponto
        const conf = S.ellipsoidConf || '1sigma';
        const confK3 = confidenceK(conf, 3);
        const pointResults = [];
        const pushPoint = (name, isStation) => {
            const e = net.index.get(name);
            const fixed = net.fixedCoords.has(name);
            let xyz, Sig = linalg.zeros(3, 3);
            if (e && e.x !== null) {
                xyz = [X0[e.x], X0[e.y], X0[e.z]];
                const ii = [e.x, e.y, e.z];
                Sig = ii.map(a => ii.map(b2 => SigmaXa[a][b2]));
            } else xyz = net.fixedCoords.get(name).slice();
            const omega = isStation ? X0[e.w] : null;
            pointResults.push({
                name, isStation, fixed,
                tipo: isStation ? (fixed ? 'estação (fixa)' : 'estação') : (fixed ? 'fixo' : 'livre'),
                origem: fixed ? (net.datum.computed.includes(name) ? 'irradiado (datum)' : 'CSV') : null,
                xyz, Sigma: Sig,
                sigma: [0, 1, 2].map(i => Math.sqrt(Math.max(Sig[i][i], 0))),
                omega, sigmaOmega: isStation ? Math.sqrt(Math.max(SigmaXa[e.w][e.w], 0)) : null,
                ellipsoid: fixed ? null : ellipsoid3D(Sig, confK3),
                initial: approx.coords.get(name) ? approx.coords.get(name).slice() : null,
                nObs: net.rows.filter(r => r.target === name).length
            });
        };
        net.stations.forEach(s => pushPoint(s, true));
        net.targets.forEach(t => { if (!net.stations.includes(t)) pushPoint(t, false); });

        // ---- avisos de qualidade
        let condN = null;
        if (u <= 400) {
            condN = linalg.condSym(N);
            if (condN > 1e12) log.warn(`Sistema normal mal condicionado: cond(N) = ${condN.toExponential(2)}.`);
        }
        if (dof > 0) {
            if (!globalPass) {
                log.warn(`Teste global (χ², α = ${S.alphaPct}%) reprovado: VᵀPV = ${VtPV.toFixed(3)} fora de ` +
                    `[${chi2low.toFixed(3)}; ${chi2upp.toFixed(3)}], σ̂₀² = ${sigma02.toFixed(3)}. ` +
                    (VtPV > chi2upp ? 'As observações discordam mais do que os desvios informados preveem (desvios otimistas ou erros grosseiros).'
                        : 'Os desvios informados parecem pessimistas.'));
            } else {
                log.info(`Teste global (χ², α = ${S.alphaPct}%) aprovado: σ̂₀² = ${sigma02.toFixed(3)}.`);
            }
        }
        const free = obsData.filter(o => o.r.every(x => x <= 1e-6));
        if (free.length) {
            log.warn(`${free.length} visada(s) sem controle (r ≈ 0): ${free.map(o => o.row.id).join(', ')}. ` +
                'São pontos irradiados de uma só estação: o ajustamento reproduz a medida e nenhum erro grosseiro nelas é detectável.');
        }
        const weak = obsData.filter(o => o.r.some(x => x > 1e-6 && x < 0.1));
        if (weak.length) {
            log.warn(`${weak.length} visada(s) com controle fraco (alguma componente com r < 0,1): ` +
                weak.map(o => o.row.id).join(', ') + '.');
        }

        return {
            net, approx, settings: Object.assign({}, S),
            log: log.items,
            iterations, converged, history,
            m, u, nEq: net.nEq, dof,
            VtPV, sigma02, sigma0, varScale,
            alpha, alpha0, chi2low, chi2upp, globalPass, critW, delta0, tauCrit,
            Xa: X0.slice(), Xinit, unknowns: net.unknowns,
            N, Ninv: Q, U, X, SigmaXa, condN,
            lin, K, V, Lb, La, sig,
            obsData, redundancySum, pointResults,
            confLabel: CONF_LABELS[conf] || conf, confK3
        };
    }

    // ---------------------------------------------------------------- matrizes completas
    // Montadas sob demanda (aba Matrizes / exportação): B, P, M, Σ_La e Σ_V têm 3m × 3m.
    function fullMatrices(result) {
        const m = result.m, u = result.u, n3 = 3 * m;
        if (n3 > 1800) throw new Error(`Rede grande demais para montar as matrizes completas (${n3} equações).`);
        const Z = linalg.zeros;
        const A = Z(n3, u), B = Z(n3, n3), M = Z(n3, n3), SigLb = Z(n3, n3), P = Z(n3, n3);
        const W = [], K = [], V = [], Lb = [], La = [];
        result.lin.forEach((b, k) => {
            for (let i = 0; i < 3; i++) {
                const ri = 3 * k + i;
                b.cols.forEach((c, q) => { A[ri][c] += b.Acols[q][i]; });
                for (let j = 0; j < 3; j++) {
                    B[ri][3 * k + j] = b.B[i][j];
                    M[ri][3 * k + j] = b.M[i][j];
                }
                const s2 = result.sig[k][i] * result.sig[k][i];
                SigLb[ri][ri] = s2;
                P[ri][ri] = 1 / s2;
                W.push(b.W[i]); K.push(result.K[k][i]); V.push(result.V[k][i]);
                Lb.push(result.Lb[k][i]); La.push(result.La[k][i]);
            }
        });
        // Q_V = Σ Bᵀ Q_K B Σ, com Q_K = M⁻¹ - M⁻¹ A Q Aᵀ M⁻¹ (M⁻¹ bloco-diagonal)
        const Minv = Z(n3, n3);
        result.lin.forEach((b, k) => {
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Minv[3 * k + i][3 * k + j] = b.Minv[i][j];
        });
        const MiA = linalg.matmul(Minv, A);
        const QK = linalg.matmul(linalg.matmul(MiA, result.Ninv), linalg.transpose(MiA));
        for (let i = 0; i < n3; i++) for (let j = 0; j < n3; j++) QK[i][j] = Minv[i][j] - QK[i][j];
        const SBt = linalg.matmul(SigLb, linalg.transpose(B));
        const QV = linalg.matmul(linalg.matmul(SBt, QK), linalg.transpose(SBt));
        const s = result.varScale;
        const SigmaV = linalg.scale(QV, s);
        const SigmaLa = SigLb.map((row, i) => row.map((v, j) => s * v - SigmaV[i][j]));
        return { A, B, M, Minv, SigLb, P, W, K, V, Lb, La, QV, SigmaV, SigmaLa };
    }

    function observationLabels(result) {
        const out = [];
        result.net.rows.forEach(r => { out.push(`Hz ${r.id}`, `Zen ${r.id}`, `D ${r.id}`); });
        return out;
    }

    // ---------------------------------------------------------------- detecção de outliers
    // As marcações são por componente; a desativação é por visada, porque as três equações
    // de condição de uma visada compartilham as suas três observações.
    const COMP = ['Hz', 'Zen', 'D'];

    // Regra kσ: resíduo contra o desvio a priori da PRÓPRIA observação, |v| > k·σ
    function detectSigmaRule(result, S) {
        const k = S.sigmaRuleK;
        const comps = [];
        result.obsData.forEach(o => o.v.forEach((v, c) => {
            const ratio = Math.abs(v) / o.sigma[c];
            if (ratio > k) comps.push({ idx: o.row.idx, id: o.row.id, comp: COMP[c], value: ratio });
        }));
        return {
            method: 'ksigma', label: `Regra ${k}σ`,
            flagged: unique(comps.map(c => c.idx)), comps,
            detail: `|v| / σ(a priori) > ${k.toFixed(1)}`
        };
    }

    // Teste tau de Pope: resíduo padronizado pela variância a posteriori, numa única rodada
    function detectPope(result, S) {
        const crit = result.tauCrit;
        if (!Number.isFinite(crit)) {
            return { method: 'tau', label: 'Teste τ de Pope', flagged: [], comps: [], detail: 'redundância insuficiente (r < 2)' };
        }
        const comps = [];
        result.obsData.forEach(o => o.tau.forEach((t, c) => {
            if (Number.isFinite(t) && Math.abs(t) > crit) comps.push({ idx: o.row.idx, id: o.row.id, comp: COMP[c], value: t });
        }));
        return {
            method: 'tau', label: 'Teste τ de Pope',
            flagged: unique(comps.map(c => c.idx)), comps,
            detail: `|τ| > ${crit.toFixed(3)} (α₀ = ${S.alpha0Pct}%, r = ${result.dof})`
        };
    }

    // Data snooping iterativo (Baarda): desativa a visada de maior |w| e reajusta. Se a rede
    // deixa de ter solução sem ela, a visada é essencial: volta, fica de fora das marcadas
    // (desativá-la quebraria o ajustamento) e o processo para, com o motivo no detalhe.
    function detectDataSnooping(rows, S) {
        const saved = rows.map(r => r.active);
        const flagged = [], comps = [], history = [], essential = [];
        let last = null, stop = '';
        try {
            for (let round = 0; round < rows.length; round++) {
                let res;
                try { res = adjustNetwork(rows, S); }
                catch (e) {
                    if (flagged.length) {
                        rows[flagged.pop()].active = true;
                        history.pop();
                        const c = comps.pop();
                        essential.push(c);
                        stop = `${c.id} também excede (|w| = ${Math.abs(c.value).toFixed(2)} em ${c.comp}), ` +
                            'mas sem ela a rede fica sem solução: visada essencial, não marcada';
                    } else stop = `interrompido: ${e.message}`;
                    break;
                }
                last = res;
                let worst = null;
                res.obsData.forEach(o => o.w.forEach((w, c) => {
                    if (!Number.isFinite(w)) return;
                    if (!worst || Math.abs(w) > Math.abs(worst.w)) worst = { o, c, w };
                }));
                if (!worst || Math.abs(worst.w) <= res.critW) break;
                const r = worst.o.row;
                flagged.push(r.idx);
                comps.push({ idx: r.idx, id: r.id, comp: COMP[worst.c], value: worst.w });
                history.push({ round: round + 1, id: r.id, comp: COMP[worst.c], w: worst.w, crit: res.critW, sigma02: res.sigma02 });
                r.active = false;
            }
        } finally {
            rows.forEach((r, i) => { r.active = saved[i]; });
        }
        const crit = last ? last.critW.toFixed(3) : '—';
        return {
            method: 'snooping', label: 'Data snooping (Baarda)',
            flagged, comps, history, essential,
            detail: `|w| > ${crit} (α₀ = ${S.alpha0Pct}%)` + (stop ? ` — ${stop}` : '')
        };
    }

    function detectOutliers(rows, result, method, S) {
        if (method === 'snooping') return detectDataSnooping(rows, S);
        if (method === 'tau') return detectPope(result, S);
        return detectSigmaRule(result, S);
    }

    // ---------------------------------------------------------------- elipsoides e elipses
    const CONF_LABELS = { '1sigma': '1σ', '95': '95%', '99': '99%' };

    // Fator de escala do elipsoide (dim = 3) ou da elipse (dim = 2) para o nível pedido
    function confidenceK(conf, dim) {
        if (conf === '95') return Math.sqrt(chi2Inv(0.95, dim));
        if (conf === '99') return Math.sqrt(chi2Inv(0.99, dim));
        return 1;
    }

    // Semieixos (crescentes, alinhados às colunas de R) e rotação de mão direita
    function ellipsoid3D(Sigma, k) {
        const { values, vectors } = linalg.eigSym(Sigma);
        const axesAsc = values.map(v => k * Math.sqrt(Math.max(v, 0)));
        return { axesAsc, R: linalg.rightHanded(vectors), axes: axesAsc.slice().reverse() };
    }

    // Elipse de uma MVC 2×2: semieixos e ângulo do maior, a partir do 1º eixo.
    // Aplicada ao bloco marginal de Σ (3×3) com o MESMO k do elipsoide, é exatamente o
    // contorno da sombra do elipsoide no plano coordenado: para toda direção d do plano,
    // max dᵀx sobre o elipsoide = k √(dᵀΣd), que só depende do bloco marginal.
    function ellipse2D(S2, k) {
        const a = S2[0][0], b = S2[0][1], c = S2[1][1];
        const mid = (a + c) / 2, rad = Math.sqrt(((a - c) / 2) ** 2 + b * b);
        return {
            a: k * Math.sqrt(Math.max(mid + rad, 0)),
            b: k * Math.sqrt(Math.max(mid - rad, 0)),
            theta: 0.5 * Math.atan2(2 * b, a - c)
        };
    }

    return {
        ARCSEC, DEG, TWO_PI, COMP, CONF_LABELS,
        linalg,
        logGamma, regularizedGammaP, chi2CDF, chi2Inv, normInv, tCDF, tInv, tauCritical,
        wrap2Pi, wrapPi, polarToDelta, conditionF, jacobianB, omegaColumn, obsSigmas,
        NetworkError, fitStationPose, applyPose, buildNetwork, approximate, linearize,
        adjustNetwork, fullMatrices, observationLabels,
        detectSigmaRule, detectPope, detectDataSnooping, detectOutliers,
        confidenceK, ellipsoid3D, ellipse2D
    };
});
