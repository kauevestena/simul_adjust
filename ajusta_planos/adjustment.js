// --- Ajustamento de planos pelo Modelo Combinado (GEMAEL) ---
// F(Xa, La) = A*x + B*y + C*z + D = 0, uma equação de condição por ponto observado.
// A equação é homogênea, então as 4 incógnitas só ficam definidas a menos de escala e o
// sistema normal é singular (W = A·X0 leva a X = -X0 e Xa = 0). Três estratégias clássicas
// removem essa liberdade — injunção A²+B²+C²=1, redução de parâmetros e pseudo-inversa com
// injunção mínima — e o usuário escolhe qual usar. Todas convergem para o MESMO plano, com os
// mesmos resíduos e a mesma MVC depois de normalizada; o que muda é a representação dos
// parâmetros, o tamanho do sistema resolvido e qual direção fica nula em Sigma_Xa.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PlaneAdjust = api;
})(typeof self !== 'undefined' ? self : this, function () {

    // ---------------------------------------------------------------- álgebra linear
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

        // Autovalores/autovetores de matriz simétrica pelo método cíclico de Jacobi.
        // Retorna { values, vectors } com as colunas de `vectors` alinhadas a `values`,
        // em ordem crescente de autovalor.
        eigSym(Ain, maxSweeps = 100) {
            const n = Ain.length;
            const A = Ain.map(r => r.slice());
            let V = linalg.identity(n);
            for (let sweep = 0; sweep < maxSweeps; sweep++) {
                let off = 0;
                for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
                if (off < 1e-30) break;
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

        // Devolve uma cópia de V (3×3, colunas ortonormais) com determinante +1, invertendo o
        // sinal de uma coluna quando preciso. A ordenação por autovalor no fim de eigSym é uma
        // permutação das colunas, e as permutações ímpares deixam a base à esquerda. Quem monta
        // uma rotação a partir dela — THREE.Quaternion.setFromRotationMatrix, no viewer3d —
        // exige det = +1 e devolve uma rotação errada caso contrário. Trocar o sinal de uma
        // coluna não altera o elipsoide: V·diag(λ)·Vᵀ continua o mesmo.
        rightHanded(V) {
            const M = V.map(r => r.slice());
            const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
                - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
                + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
            if (det < 0) for (let i = 0; i < 3; i++) M[i][0] = -M[i][0];
            return M;
        },

        dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); },
        cross(a, b) {
            return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        },
        norm(a) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)); },

        // Base ortonormal n×(n-1) do complemento ortogonal de `e`, por refletor de Householder.
        // H = I - 2vvᵀ/vᵀv leva e em ∓‖e‖·ê₁, logo eᵀH = ∓‖e‖·ê₁ᵀ e as colunas 1..n-1 de H
        // são exatamente as direções ortogonais a e.
        nullComplementBasis(e) {
            const n = e.length;
            const nrm = linalg.norm(e);
            if (nrm < 1e-300) throw new Error('Direção de gauge degenerada (vetor nulo).');
            const v = e.map(c => c / nrm);
            v[0] += (v[0] >= 0 ? 1 : -1);
            const vtv = linalg.dot(v, v);
            const U = [];
            for (let i = 0; i < n; i++) {
                const row = [];
                for (let j = 1; j < n; j++) row.push((i === j ? 1 : 0) - 2 * v[i] * v[j] / vtv);
                U.push(row);
            }
            return U;
        },

        // Número de condição de matriz simétrica (|λ|max / |λ|min)
        condSym(M) {
            const ev = linalg.eigSym(M).values.map(Math.abs);
            const mx = Math.max(...ev), mn = Math.min(...ev);
            return mn > 0 ? mx / mn : Infinity;
        }
    };

    // ---------------------------------------------------------------- estatística
    // Reaproveitadas de nivelamento/app.js para manter os testes coerentes entre simuladores.
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

    // ---------------------------------------------------------------- geometria do plano

    // Plano por 3 pontos (produto vetorial), usado pelo RANSAC
    function plane3points(p1, p2, p3) {
        const u = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
        const v = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
        const n = linalg.cross(u, v);
        const nn = linalg.norm(n);
        if (nn < 1e-12) return null;
        const nv = n.map(c => c / nn);
        return [nv[0], nv[1], nv[2], -linalg.dot(nv, p1)];
    }

    // Aproximação inicial por PCA: normal = autovetor do menor autovalor da matriz de
    // dispersão dos pontos; D = -n · centróide. Já sai com ||n|| = 1.
    function initialPlanePCA(pts) {
        const m = pts.length;
        const c = [0, 0, 0];
        pts.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
        c[0] /= m; c[1] /= m; c[2] /= m;
        const S = linalg.zeros(3, 3);
        pts.forEach(p => {
            const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += d[i] * d[j];
        });
        const { vectors } = linalg.eigSym(S);
        const n = [vectors[0][0], vectors[1][0], vectors[2][0]]; // menor autovalor
        const nn = linalg.norm(n);
        const nv = n.map(v => v / nn);
        return [nv[0], nv[1], nv[2], -linalg.dot(nv, c)];
    }

    // Classificação horizontal/vertical pela direção da normal: |n_z| > cos 45° => horizontal.
    // A normal pode vir pronta (o ajustamento já a tem); sem ela, sai de uma PCA dos pontos.
    // Os vetores de deslocamento interno continuam sendo devolvidos porque a interface os
    // mostra, mas NÃO servem de critério: uma parede medida numa faixa larga e baixa varia
    // pouco em Z e seria tomada por horizontal. É o caso de samples/parede_frontal.csv, com
    // 3,07 m de extensão em X contra 0,42 m em Z. Diverge de propósito do specs.md, que
    // prescrevia a regra do espalhamento.
    function classifyPlane(pts, normal) {
        const m = pts.length;
        const c = [0, 0, 0];
        pts.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; });
        c[0] /= m; c[1] /= m; c[2] /= m;
        const sd = [0, 0, 0];
        pts.forEach(p => {
            for (let i = 0; i < 3; i++) { const d = p[i] - c[i]; sd[i] += d * d; }
        });
        for (let i = 0; i < 3; i++) sd[i] = Math.sqrt(sd[i] / m);

        const nv = normal || initialPlanePCA(pts);
        const n = [nv[0], nv[1], nv[2]];
        const nn = linalg.norm(n);
        if (nn < 1e-12) throw new Error('Vetor normal degenerado; classificação impossível.');
        const cosZ = Math.abs(n[2]) / nn;           // |cos| entre a normal e o eixo Z
        const isHorizontal = cosZ > Math.SQRT1_2;   // mais perto de Z do que de 45°

        return { spread: sd, cosZ, isHorizontal, tipo: isHorizontal ? 'horizontal' : 'vertical' };
    }

    // ---------------------------------------------------------------- ajustamento

    // A equação do plano é homogênea: (A,B,C,D) só fica definido a menos de escala, e é essa
    // liberdade que torna o sistema normal singular. Cada estratégia abaixo a remove de um jeito
    // diferente, devolvendo a correção X (4×1) e a inversa generalizada Q (4×4) que alimenta
    // Sigma_Xa e o cofator dos correlatos. Tudo o que vem depois no ajustamento é idêntico.

    const GAUGES = {
        constraint: 'Injunção A²+B²+C²=1',
        reduction: 'Redução de parâmetros',
        pseudoinverse: 'Pseudo-inversa (injunção mínima)'
    };

    const PARAM_NAMES = ['A', 'B', 'C', 'D'];

    // Qual parâmetro a redução mantém fixo. No automático escolhe-se a maior componente da
    // normal — nunca D: ao menos uma de A, B, C vale ≥ 1/√3, então a redução jamais degenera.
    function resolvePinIndex(X0, settings) {
        const choice = settings.pinParam || 'auto';
        const idx = PARAM_NAMES.indexOf(choice);
        if (idx >= 0) return idx;
        let k = 0;
        for (let j = 1; j < 3; j++) if (Math.abs(X0[j]) > Math.abs(X0[k])) k = j;
        return k;
    }

    // Quão bem a direção fixada controla a escala: |X0[k]| / ‖X0‖, ou seja, o cosseno entre o
    // eixo do parâmetro fixado e a direção de escala. Perto de zero o gauge quase não a
    // controla — o sistema fica mal condicionado e a iteração se arrasta.
    function pinQuality(X0, pinIndex) {
        const nrm = linalg.norm(X0);
        return nrm > 0 ? Math.abs(X0[pinIndex]) / nrm : 0;
    }

    function solveGauge(N, u, X0, gauge, pinIndex) {
        if (gauge === 'reduction') {
            // Fixa X[pinIndex]: o sistema normal cai para 3×3 e fica não-singular.
            const keep = [0, 1, 2, 3].filter(j => j !== pinIndex);
            const Nred = keep.map(a => keep.map(b => N[a][b]));
            const ured = keep.map(a => u[a]);
            const NredInv = linalg.inv(Nred);
            const xred = linalg.matvec(NredInv, ured);

            const X = [0, 0, 0, 0];
            const Q = linalg.zeros(4, 4);
            keep.forEach((a, ia) => {
                X[a] = xred[ia];
                keep.forEach((b, ib) => { Q[a][b] = NredInv[ia][ib]; });
            });
            return {
                X, Q,
                condSystem: linalg.condSym(Nred),
                artifacts: { Nred, NredInv, Xred: xred.map(v => [v]), keep }
            };
        }

        if (gauge === 'pseudoinverse') {
            // Injunção mínima EᵀX = 0 com o espaço nulo CONHECIDO: E = X0 (direção de escala).
            // Detectar o posto por limiar de autovalor não funciona aqui — a razão λmin/λmax cai
            // de ~1e-7 na primeira iteração para ~1e-17 na convergência, e qualquer corte fixo
            // erra numa das pontas, devolvendo Q = N⁻¹ e colapsando a solução para o vetor nulo.
            const U = linalg.nullComplementBasis(X0);          // 4×3
            const Ut = linalg.transpose(U);                    // 3×4
            const UNU = linalg.matmul(Ut, linalg.matmul(N, U));// 3×3
            const UNUinv = linalg.inv(UNU);
            const Q = linalg.matmul(U, linalg.matmul(UNUinv, Ut));
            return {
                X: linalg.matvec(Q, u), Q,
                condSystem: linalg.condSym(UNU),
                artifacts: { nullBasis: U, UNU, UNUinv, E: X0.map(v => [v]) }
            };
        }

        // Injunção de condição A²+B²+C²=1, via multiplicador de Lagrange (sistema aumentado)
        const Cc = [2 * X0[0], 2 * X0[1], 2 * X0[2], 0];
        const wc = X0[0] * X0[0] + X0[1] * X0[1] + X0[2] * X0[2] - 1;
        const KKT = linalg.zeros(5, 5);
        for (let a = 0; a < 4; a++) {
            for (let b = 0; b < 4; b++) KKT[a][b] = N[a][b];
            KKT[a][4] = Cc[a];
            KKT[4][a] = Cc[a];
        }
        const sol = linalg.solve(KKT, [u[0], u[1], u[2], u[3], -wc]);
        const KKTinv = linalg.inv(KKT);
        return {
            X: sol.slice(0, 4),
            Q: KKTinv.slice(0, 4).map(r => r.slice(0, 4)),
            condSystem: linalg.condSym(KKT),
            artifacts: { KKT, KKTinv, Cc: [Cc], wc, lambda: sol[4] }
        };
    }

    function adjustPlane(points, settings) {
        const act = points.filter(p => p.active);
        const m = act.length;
        if (m < 4) throw new Error(`São necessários ao menos 4 pontos ativos (há ${m}).`);

        const Lb = act.map(p => p.xyz.slice());
        const Sig = act.map(p => p.sigXYZ.map(r => r.slice()));
        const SigInv = Sig.map(S => linalg.inv(S));

        let X0 = initialPlanePCA(Lb);
        let La = Lb.map(r => r.slice());
        let V = linalg.zeros(m, 3);

        const initialX0 = X0.slice();
        const gauge = GAUGES[settings.gauge] ? settings.gauge : 'reduction';
        // O parâmetro fixado é escolhido uma única vez, na aproximação inicial: trocá-lo entre
        // iterações mudaria o gauge no meio do caminho.
        const pinIndex = resolvePinIndex(X0, settings);

        let Amat, Mdiag, W, N, X, K, Q, step, iterations = 0, converged = false;

        for (let it = 0; it < settings.maxIter; it++) {
            iterations = it + 1;
            const n0 = [X0[0], X0[1], X0[2]];

            // A: derivadas em relação aos parâmetros, avaliadas nas observações ajustadas
            Amat = La.map(p => [p[0], p[1], p[2], 1]);

            // M = B P^-1 B^T é diagonal: M_ii = n0^T * Sigma_XYZ,i * n0
            Mdiag = Sig.map(S => {
                const g = linalg.matvec(S, n0);
                return linalg.dot(n0, g);
            });

            // W_i = A_i·X0 - n0·V_i  (forma iterada de Gemael para o modelo combinado)
            W = Amat.map((row, i) => linalg.dot(row, X0) - linalg.dot(n0, V[i]));

            // N = A^T M^-1 A  e  u = -A^T M^-1 W
            N = linalg.zeros(4, 4);
            const u = [0, 0, 0, 0];
            for (let i = 0; i < m; i++) {
                const wI = 1 / Mdiag[i];
                for (let a = 0; a < 4; a++) {
                    u[a] -= Amat[i][a] * wI * W[i];
                    for (let b = a; b < 4; b++) N[a][b] += Amat[i][a] * wI * Amat[i][b];
                }
            }
            for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) N[a][b] = N[b][a];

            // Remoção da liberdade de escala conforme a estratégia escolhida
            step = solveGauge(N, u, X0, gauge, pinIndex);
            X = step.X;
            Q = step.Q;

            const Xa = [X0[0] + X[0], X0[1] + X[1], X0[2] + X[2], X0[3] + X[3]];

            // Correlatos e resíduos
            K = Amat.map((row, i) => -(linalg.dot(row, X) + W[i]) / Mdiag[i]);
            V = Sig.map((S, i) => linalg.matvec(S, n0).map(g => g * K[i]));
            La = Lb.map((p, i) => [p[0] + V[i][0], p[1] + V[i][1], p[2] + V[i][2]]);

            const maxCorr = Math.max(...X.map(Math.abs));
            X0 = Xa;
            if (maxCorr < settings.tol) { converged = true; break; }
        }

        // ---- controle de qualidade
        let VtPV = 0;
        for (let i = 0; i < m; i++) VtPV += linalg.dot(V[i], linalg.matvec(SigInv[i], V[i]));

        // Nos três gauges sobram 3 parâmetros efetivos: 4 incógnitas menos a liberdade de escala
        const dof = m - 3;
        const sigma02 = VtPV / dof;
        const sigma0 = Math.sqrt(sigma02);

        const SigmaXa = linalg.scale(Q, sigma02);

        const alpha = settings.alphaPct / 100;
        const chi2low = chi2Inv(alpha / 2, dof);
        const chi2upp = chi2Inv(1 - alpha / 2, dof);
        const globalPass = VtPV >= chi2low && VtPV <= chi2upp;

        const critW = normInv(1 - (settings.alpha0Pct / 100) / 2);
        const nrm = linalg.norm([X0[0], X0[1], X0[2]]);

        // Diagonal do cofator dos correlatos: Q_K = M^-1 - M^-1 A Q A^T M^-1
        const obsData = act.map((p, i) => {
            const AQA = linalg.dot(Amat[i], linalg.matvec(Q, Amat[i]));
            const qk = Math.max(0, 1 / Mdiag[i] - AQA / (Mdiag[i] * Mdiag[i]));
            const r = Math.min(1, Math.max(0, qk * Mdiag[i]));
            const w = qk > 1e-300 ? K[i] / Math.sqrt(qk) : NaN;
            const reliable = r > 1e-9 && Number.isFinite(r);
            const mdb = reliable ? settings.nonCentrality * Math.sqrt(Mdiag[i]) / Math.sqrt(r) : null;
            // Distância ortogonal assinada do ponto OBSERVADO ao plano ajustado
            const d = (X0[0] * Lb[i][0] + X0[1] * Lb[i][1] + X0[2] * Lb[i][2] + X0[3]) / nrm;
            return {
                point: p, i,
                v: V[i].slice(),
                vNorm: linalg.norm(V[i]),
                d,
                sigmaD: Math.sqrt(Mdiag[i]) / nrm,
                Mii: Mdiag[i],
                K: K[i],
                qk, r, w, mdb,
                isOutlier: Number.isFinite(w) && Math.abs(w) > critW
            };
        });

        return {
            Xa: X0.slice(),
            gauge, gaugeLabel: GAUGES[gauge],
            pinIndex: gauge === 'reduction' ? pinIndex : null,
            pinName: gauge === 'reduction' ? PARAM_NAMES[pinIndex] : null,
            pinQuality: gauge === 'reduction' ? pinQuality(initialX0, pinIndex) : null,
            iterations, converged,
            m, dof, VtPV, sigma02, sigma0,
            chi2low, chi2upp, globalPass, critW,
            normaN: nrm,
            SigmaXa, Q, N,
            eigN: linalg.eigSym(N).values,
            condN: linalg.condSym(N),
            condSystem: step.condSystem,
            gaugeArtifacts: step.artifacts,
            Amat, Mdiag, W, X, K, V, La, Lb, Sig, SigInv,
            obsData,
            activePoints: act,
            normalized: null
        };
    }

    // Roda as três estratégias sobre os mesmos pontos ativos e mede o quanto elas divergem
    // nas grandezas que NÃO deveriam depender do gauge. É a demonstração de que a escolha é
    // convenção de representação, não modelagem.
    function compareGauges(points, settings) {
        const order = ['constraint', 'reduction', 'pseudoinverse'];
        const runs = order.map(gauge => {
            const res = adjustPlane(points, Object.assign({}, settings, { gauge }));
            return { gauge, label: GAUGES[gauge], res, norm: normalizeParameters(res) };
        });

        const base = runs[0];
        let sigmaScale = 0;
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) sigmaScale = Math.max(sigmaScale, Math.abs(base.norm.SigmaXn[i][j]));
        }

        runs.forEach(r => {
            r.dXn = Math.max(...r.norm.Xn.map((v, i) => Math.abs(v - base.norm.Xn[i])));
            let mx = 0;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    mx = Math.max(mx, Math.abs(r.norm.SigmaXn[i][j] - base.norm.SigmaXn[i][j]));
                }
            }
            r.dSigmaXn = sigmaScale > 0 ? mx / sigmaScale : 0;
            r.dR = Math.max(...r.res.obsData.map((o, i) => Math.abs(o.r - base.res.obsData[i].r)));
            r.dVtPV = Math.abs(r.res.VtPV - base.res.VtPV) / Math.abs(base.res.VtPV || 1);
            // Direção do autovalor nulo de Sigma_Xa: escala nos dois gauges livres, eixo do
            // parâmetro fixado na redução.
            r.nullDirection = r.gauge === 'reduction'
                ? `eixo de ${r.res.pinName}`
                : 'escala';
        });

        return { runs, baseLabel: base.label };
    }

    // ---------------------------------------------------------------- detecção de outliers

    // Regra k-sigma sobre o resíduo ortogonal padronizado pela precisão NOMINAL (a priori).
    // Usar σ̂₀ (a posteriori) aqui mascararia justamente os outliers que se quer achar, pois
    // eles inflam a própria variância de referência — mesmo motivo pelo qual o teste de
    // Baarda exige variância a priori.
    function detectThreeSigma(result, settings) {
        const k = settings.sigmaRuleK;
        const flagged = [];
        result.obsData.forEach(o => {
            const ratio = o.sigmaD > 0 ? Math.abs(o.d) / o.sigmaD : 0;
            o.ruleRatio = ratio;
            o.ruleRatioPost = (result.sigma0 * o.sigmaD) > 0 ? Math.abs(o.d) / (result.sigma0 * o.sigmaD) : 0;
            if (ratio > k) flagged.push(o.point.idx);
        });
        return { method: '3sigma', flagged, detail: `|d| / \u03c3_d(nominal) > ${k.toFixed(1)}` };
    }

    // Data snooping iterativo: remove uma observação por rodada e reajusta
    function detectDataSnooping(points, settings) {
        const saved = points.map(p => p.active);
        const flagged = [];
        const history = [];
        let last = null;
        try {
            for (let round = 0; round < points.length; round++) {
                let res;
                try { res = adjustPlane(points, settings); }
                catch (e) { break; }
                last = res;
                let worst = null;
                res.obsData.forEach(o => {
                    if (!Number.isFinite(o.w)) return;
                    if (!worst || Math.abs(o.w) > Math.abs(worst.w)) worst = o;
                });
                if (!worst || Math.abs(worst.w) <= res.critW) break;
                flagged.push(worst.point.idx);
                history.push({ round: round + 1, id: worst.point.id, w: worst.w, crit: res.critW, sigma02: res.sigma02 });
                worst.point.active = false;
                if (points.filter(p => p.active).length < 5) break;
            }
        } finally {
            points.forEach((p, i) => { p.active = saved[i]; });
        }
        return {
            method: 'snooping', flagged, history,
            detail: `|w| > ${last ? last.critW.toFixed(3) : '—'} (α₀ = ${settings.alpha0Pct}%)`
        };
    }

    // RANSAC: amostras mínimas de 3 pontos, consenso por distância ortogonal
    function detectRANSAC(points, settings) {
        const act = points.filter(p => p.active);
        const pts = act.map(p => p.xyz);
        const thresh = settings.ransacThreshMm / 1000;
        let best = null;
        if (act.length < 4) return { method: 'ransac', flagged: [], detail: 'pontos insuficientes' };

        for (let it = 0; it < settings.ransacIters; it++) {
            const a = Math.floor(Math.random() * pts.length);
            let b = Math.floor(Math.random() * pts.length);
            let c = Math.floor(Math.random() * pts.length);
            if (a === b || b === c || a === c) continue;
            const plane = plane3points(pts[a], pts[b], pts[c]);
            if (!plane) continue;
            let count = 0, sse = 0;
            for (let i = 0; i < pts.length; i++) {
                const d = Math.abs(plane[0] * pts[i][0] + plane[1] * pts[i][1] + plane[2] * pts[i][2] + plane[3]);
                if (d < thresh) { count++; sse += d * d; }
            }
            if (!best || count > best.count || (count === best.count && sse < best.sse)) {
                best = { plane, count, sse };
            }
        }
        if (!best) return { method: 'ransac', flagged: [], detail: 'nenhum consenso encontrado' };

        const flagged = [];
        act.forEach((p, i) => {
            const d = Math.abs(best.plane[0] * pts[i][0] + best.plane[1] * pts[i][1] + best.plane[2] * pts[i][2] + best.plane[3]);
            if (d >= thresh) flagged.push(p.idx);
        });
        return {
            method: 'ransac', flagged, plane: best.plane, inliers: best.count,
            detail: `limiar ${settings.ransacThreshMm.toFixed(1)} mm · ${best.count}/${act.length} inliers · ${settings.ransacIters} iterações`
        };
    }

    function detectOutliers(points, result, method, settings) {
        if (method === 'snooping') return detectDataSnooping(points, settings);
        if (method === 'ransac') return detectRANSAC(points, settings);
        return detectThreeSigma(result, settings);
    }

    // ---------------------------------------------------------------- normalização

    // X̂ = s·X/||n||, com o sentido escolhido pela classificação do plano.
    // Σ_X̂ = J Σ_Xa Jᵀ, J = ∂X̂/∂X.
    function normalizeParameters(result) {
        const X = result.Xa;
        const n = [X[0], X[1], X[2]];
        const s = linalg.norm(n);
        if (s < 1e-12) throw new Error('Vetor normal degenerado; normalização impossível.');

        const cls = classifyPlane(result.Lb, n);
        const refAxis = cls.isHorizontal ? 2 : 0; // horizontal -> +Z; vertical -> +X
        const sign = (n[refAxis] < 0) ? -1 : 1;

        const Xn = [sign * X[0] / s, sign * X[1] / s, sign * X[2] / s, sign * X[3] / s];

        // Jacobiano da transformação
        const J = linalg.zeros(4, 4);
        const s3 = s * s * s;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                J[i][j] = sign * (((i === j) ? 1 / s : 0) - n[i] * n[j] / s3);
            }
            J[i][3] = 0;
            J[3][i] = -sign * X[3] * n[i] / s3;
        }
        J[3][3] = sign / s;

        const SigmaXn = linalg.matmul(linalg.matmul(J, result.SigmaXa), linalg.transpose(J));
        return { Xn, SigmaXn, J, scale: s, sign, classification: cls };
    }

    // ---------------------------------------------------------------- matrizes completas
    // Montadas apenas sob demanda (aba de matrizes / exportação), pois B, P, Σ_La e Σ_V
    // têm dimensão 3m.

    function fullMatrices(result) {
        const m = result.m;
        const n0 = [result.Xa[0], result.Xa[1], result.Xa[2]];

        const B = linalg.zeros(m, 3 * m);
        for (let i = 0; i < m; i++) for (let k = 0; k < 3; k++) B[i][3 * i + k] = n0[k];

        const P = linalg.zeros(3 * m, 3 * m);
        const SigLb = linalg.zeros(3 * m, 3 * m);
        for (let i = 0; i < m; i++) {
            for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
                P[3 * i + a][3 * i + b] = result.SigInv[i][a][b];
                SigLb[3 * i + a][3 * i + b] = result.Sig[i][a][b];
            }
        }

        const M = linalg.zeros(m, m);
        for (let i = 0; i < m; i++) M[i][i] = result.Mdiag[i];

        // g_i = Sigma_i * n
        const g = result.Sig.map(S => linalg.matvec(S, n0));
        const SigmaLa = linalg.zeros(3 * m, 3 * m);
        const SigmaV = linalg.zeros(3 * m, 3 * m);
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < m; j++) {
                const AQA = linalg.dot(result.Amat[i], linalg.matvec(result.Q, result.Amat[j]));
                const coef = AQA / (result.Mdiag[i] * result.Mdiag[j]);
                for (let a = 0; a < 3; a++) {
                    for (let b = 0; b < 3; b++) {
                        let val = g[i][a] * g[j][b] * coef;
                        if (i === j) val += result.Sig[i][a][b] - g[i][a] * g[i][b] / result.Mdiag[i];
                        const la = result.sigma02 * val;
                        SigmaLa[3 * i + a][3 * j + b] = la;
                        SigmaV[3 * i + a][3 * j + b] =
                            (i === j ? result.sigma02 * result.Sig[i][a][b] : 0) - la;
                    }
                }
            }
        }

        return {
            B, P, SigLb, M, SigmaLa, SigmaV,
            SigmaW: linalg.scale(M, result.sigma02)
        };
    }

    return {
        linalg,
        logGamma, regularizedGammaP, chi2CDF, chi2Inv, normInv,
        plane3points, initialPlanePCA, classifyPlane,
        GAUGES, PARAM_NAMES, resolvePinIndex, pinQuality, solveGauge, compareGauges,
        adjustPlane, detectOutliers, detectThreeSigma, detectDataSnooping, detectRANSAC,
        normalizeParameters, fullMatrices
    };
});
