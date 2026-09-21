// Confere todos os números citados em metodo_combinado.tex.
// Execute com:  node ajusta_planos/explanations/corrimao.js
//
// O exemplo é um corrimão de escada medido com trena: para cada ponto mediu-se a distância
// horizontal x e a altura z, e AS DUAS medidas têm errinho — é por isso que o exemplo precisa
// do modelo combinado, e não de uma regressão comum. A sequência de contas aqui é a mesma de
// adjustPlane() em ../adjustment.js, inclusive a forma iterada W = F(X0, La) - B·V; só muda o
// tamanho: 2 parâmetros (a, b) e 2 observações por ponto, em vez de 4 e 3.

const A = require('../adjustment.js');

// ------------------------------------------------------------------ os dados
const x = [0.00, 0.62, 1.25, 1.91, 2.54, 3.18];      // distância horizontal, m
const z = [0.000, 0.372, 0.742, 1.155, 1.520, 1.915]; // altura, m
const m = x.length;

// A trena cede quanto mais esticada: 5 mm + 3 mm por metro. A altura sai de uma régua curta,
// sempre 5 mm. Precisões diferentes ponto a ponto são o que dá vida aos pesos.
const sx = x.map(v => 0.005 + 0.003 * v);
const sz = x.map(() => 0.005);

const ALFA = 0.05;     // nível de significância do teste global
const ALFA0 = 0.001;   // nível do teste w, por observação
const PROJETO = 0.60;  // inclinação de projeto da escada: 60 %

// ------------------------------------------------------------------ ferramentas 2x2
function solve2(N, u) {
    const det = N[0][0] * N[1][1] - N[0][1] * N[1][0];
    return [(u[0] * N[1][1] - u[1] * N[0][1]) / det, (N[0][0] * u[1] - N[1][0] * u[0]) / det];
}
function inv2(N) {
    const det = N[0][0] * N[1][1] - N[0][1] * N[1][0];
    return [[N[1][1] / det, -N[0][1] / det], [-N[1][0] / det, N[0][0] / det]];
}
function fmt(v, n = 6) { return v.toFixed(n); }

// Reta por mínimos quadrados comum, sem pesos e culpando só z: o que sai de uma planilha.
function trendline(xs, zs) {
    const n = xs.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const mz = zs.reduce((s, v) => s + v, 0) / n;
    let sxz = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxz += (xs[i] - mx) * (zs[i] - mz); sxx += (xs[i] - mx) ** 2; }
    const a = sxz / sxx;
    return [a, mz - a * mx];
}

// ------------------------------------------------------------------ o ajustamento combinado
function ajustar(zObs) {
    let X0 = trendline(x, zObs);
    const X0inicial = X0.slice();
    let V = x.map(() => [0, 0]);
    let La = x.map((v, i) => [v, zObs[i]]);
    let Amat, Mdiag, W, N, u, X, K, historico = [], iteracoes = 0, primeira = null;

    for (let it = 0; it < 50; it++) {
        iteracoes = it + 1;
        const a0 = X0[0];

        // A: derivadas de F em relação aos parâmetros, nas observações ajustadas
        Amat = La.map(p => [p[0], 1]);

        // B: derivadas de F em relação às observações — [a, -1] no bloco de cada ponto.
        // M = B P^-1 B^T é diagonal: M_ii = a²σx² + σz², o "Pitágoras dos errinhos".
        Mdiag = x.map((_, i) => a0 * a0 * sx[i] * sx[i] + sz[i] * sz[i]);

        // W na forma iterada de Gemael: F(X0, La) - B·V
        W = La.map((p, i) => (X0[0] * p[0] + X0[1] - p[1]) - (a0 * V[i][0] - V[i][1]));

        N = [[0, 0], [0, 0]];
        u = [0, 0];
        for (let i = 0; i < m; i++) {
            const w = 1 / Mdiag[i];
            for (let r = 0; r < 2; r++) {
                u[r] -= Amat[i][r] * w * W[i];
                for (let c = 0; c < 2; c++) N[r][c] += Amat[i][r] * w * Amat[i][c];
            }
        }

        X = solve2(N, u);
        // Guarda a 1ª iteração inteira: é ela que aparece slide a slide na aula
        if (it === 0) primeira = { A: Amat.map(r => r.slice()), Mdiag: Mdiag.slice(), W: W.slice(),
                                   N: N.map(r => r.slice()), u: u.slice(), X: X.slice() };
        K = Amat.map((row, i) => -(row[0] * X[0] + row[1] * X[1] + W[i]) / Mdiag[i]);
        V = K.map((k, i) => [sx[i] * sx[i] * a0 * k, -sz[i] * sz[i] * k]);
        La = x.map((v, i) => [v + V[i][0], zObs[i] + V[i][1]]);

        const maxCorr = Math.max(Math.abs(X[0]), Math.abs(X[1]));
        X0 = [X0[0] + X[0], X0[1] + X[1]];
        historico.push({ it: iteracoes, a: X0[0], b: X0[1], maxCorr });
        if (maxCorr < 1e-13) break;
    }

    let VtPV = 0;
    for (let i = 0; i < m; i++) {
        VtPV += V[i][0] * V[i][0] / (sx[i] * sx[i]) + V[i][1] * V[i][1] / (sz[i] * sz[i]);
    }
    const dof = m - 2;
    const sigma02 = VtPV / dof;
    const Q = inv2(N);
    const SigmaXa = [[Q[0][0] * sigma02, Q[0][1] * sigma02], [Q[1][0] * sigma02, Q[1][1] * sigma02]];

    // Redundância e teste w de cada observação (mesmas fórmulas de adjustPlane)
    const obs = Amat.map((row, i) => {
        const AQA = row[0] * (Q[0][0] * row[0] + Q[0][1] * row[1])
                  + row[1] * (Q[1][0] * row[0] + Q[1][1] * row[1]);
        const qk = 1 / Mdiag[i] - AQA / (Mdiag[i] * Mdiag[i]);
        return { r: qk * Mdiag[i], w: K[i] / Math.sqrt(qk), qk };
    });

    return {
        X0inicial, Xa: X0, iteracoes, historico, primeira, Amat, Mdiag, W, N, u, X, K, V,
        VtPV, dof, sigma02, sigma0: Math.sqrt(sigma02), Q, SigmaXa, obs,
        chi2low: A.chi2Inv(ALFA / 2, dof), chi2upp: A.chi2Inv(1 - ALFA / 2, dof),
        critW: A.normInv(1 - ALFA0 / 2)
    };
}

// ------------------------------------------------------------------ relatório
function relatorio(titulo, R) {
    console.log(`\n=== ${titulo} ===`);
    console.log(`chute inicial (trendline)  a = ${fmt(R.X0inicial[0])}  (${fmt(R.X0inicial[0] * 100, 3)} %)`);
    console.log(`                            b = ${fmt(R.X0inicial[1], 5)} m`);
    console.log(`iterações                   ${R.iteracoes}`);
    console.log('correção máxima por iteração:');
    R.historico.forEach(h => console.log(`   ${h.it}: |X|max = ${h.maxCorr.toExponential(3)}   a = ${fmt(h.a, 9)}`));
    console.log(`ajustado                    a = ${fmt(R.Xa[0])}  (${fmt(R.Xa[0] * 100, 3)} %)  = ${fmt(Math.atan(R.Xa[0]) * 180 / Math.PI, 3)}°`);
    console.log(`                            b = ${fmt(R.Xa[1], 5)} m`);
    console.log(`M_ii (mm)                   ${R.Mdiag.map(v => fmt(Math.sqrt(v) * 1000, 2)).join('  ')}`);
    console.log(`N                           [${fmt(R.N[0][0], 1)}  ${fmt(R.N[0][1], 1)}]`);
    console.log(`                            [${fmt(R.N[1][0], 1)}  ${fmt(R.N[1][1], 1)}]`);
    console.log(`cond(N)                     ${fmt(condSym2(R.N), 2)}`);
    console.log(`resíduos vx (mm)            ${R.V.map(v => fmt(v[0] * 1000, 2)).join('  ')}`);
    console.log(`resíduos vz (mm)            ${R.V.map(v => fmt(v[1] * 1000, 2)).join('  ')}`);
    console.log(`VtPV                        ${fmt(R.VtPV, 4)}      dof = ${R.dof}`);
    console.log(`sigma0^2 ; sigma0           ${fmt(R.sigma02, 4)} ; ${fmt(R.sigma0, 4)}`);
    console.log(`faixa qui-quadrado (5%)     [${fmt(R.chi2low, 3)} ; ${fmt(R.chi2upp, 3)}]  -> ${R.VtPV >= R.chi2low && R.VtPV <= R.chi2upp ? 'PASSA' : 'FALHA'}`);
    console.log(`sigma_a                     ${fmt(Math.sqrt(R.SigmaXa[0][0]), 5)}  = ${fmt(Math.sqrt(R.SigmaXa[0][0]) * 100, 3)} pontos percentuais`);
    console.log(`sigma_b                     ${fmt(Math.sqrt(R.SigmaXa[1][1]), 5)} m`);
    console.log(`Sigma_Xa                    [${R.SigmaXa[0].map(v => v.toExponential(4)).join('  ')}]`);
    console.log(`                            [${R.SigmaXa[1].map(v => v.toExponential(4)).join('  ')}]`);
    const dif = (R.Xa[0] - PROJETO) / Math.sqrt(R.SigmaXa[0][0]);
    console.log(`contra o projeto de 60 %    ${fmt((R.Xa[0] - PROJETO) * 100, 3)} pp = ${fmt(dif, 2)} sigma  -> ${Math.abs(dif) < 2 ? 'compatível' : 'diferente'}`);
    console.log(`redundâncias r_i            ${R.obs.map(o => fmt(o.r, 3)).join('  ')}`);
    console.log(`   soma das redundâncias    ${fmt(R.obs.reduce((s, o) => s + o.r, 0), 6)}  (tem de dar ${R.dof})`);
    console.log(`testes w                    ${R.obs.map(o => fmt(o.w, 3)).join('  ')}   |crítico| = ${fmt(R.critW, 3)}`);
    const maus = R.obs.map((o, i) => [i, o.w]).filter(([, w]) => Math.abs(w) > R.critW);
    console.log(`   reprovados                ${maus.length ? maus.map(([i, w]) => `P${i + 1} (w = ${fmt(w, 2)})`).join(', ') : 'nenhum'}`);
}

function condSym2(N) {
    const tr = N[0][0] + N[1][1];
    const det = N[0][0] * N[1][1] - N[0][1] * N[1][0];
    const disc = Math.sqrt(tr * tr / 4 - det);
    return (tr / 2 + disc) / (tr / 2 - disc);
}

// ------------------------------------------------------------------ execução
const tl = trendline(x, z);
console.log('\nDADOS');
console.log(`x (m)     ${x.map(v => fmt(v, 2)).join('   ')}`);
console.log(`z (m)     ${z.map(v => fmt(v, 3)).join('  ')}`);
console.log(`sigma_x   ${sx.map(v => fmt(v * 1000, 1)).join('    ')} mm`);
console.log(`sigma_z   ${sz.map(v => fmt(v * 1000, 1)).join('    ')} mm`);
console.log(`\nTRENDLINE COMUM (sem pesos, só z culpado)   a = ${fmt(tl[0])} = ${fmt(tl[0] * 100, 3)} %`);

const R = ajustar(z);

// A primeira iteração é a que a aula percorre passo a passo
const p1 = R.primeira;
console.log('\n=== PRIMEIRA ITERAÇÃO, EM DETALHE ===');
console.log(`X0 = (a0, b0) = (${fmt(R.X0inicial[0])} , ${fmt(R.X0inicial[1], 6)})`);
console.log('A (6x2)      ' + p1.A.map(r => `[${fmt(r[0], 2)}  ${r[1]}]`).join(' '));
console.log('B (linha i)  ' + `[a0  -1] = [${fmt(R.X0inicial[0], 4)}  -1]`);
console.log('W (mm)       ' + p1.W.map(v => fmt(v * 1000, 2)).join('  '));
console.log('raiz(M_ii) mm' + p1.Mdiag.map(v => '  ' + fmt(Math.sqrt(v) * 1000, 2)).join(''));
console.log(`N            [${fmt(p1.N[0][0], 1)}  ${fmt(p1.N[0][1], 1)} ; ${fmt(p1.N[1][0], 1)}  ${fmt(p1.N[1][1], 1)}]`);
console.log(`u            [${fmt(p1.u[0], 3)}  ${fmt(p1.u[1], 3)}]`);
console.log(`X            [${p1.X[0].toExponential(4)}  ${p1.X[1].toExponential(4)}]`);

relatorio('AJUSTAMENTO COMBINADO', R);
console.log(`\ndiferença entre trendline e combinado: ${fmt((tl[0] - R.Xa[0]) * 100, 4)} pontos percentuais`);

// Mesma medição, mas alguém leu a régua 3 cm errada no ponto 4.
const zErro = z.slice();
zErro[3] += 0.030;
relatorio('COM UM ERRO GROSSEIRO DE 3 cm EM z NO PONTO 4', ajustar(zErro));
console.log('');
