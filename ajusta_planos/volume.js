// --- Estimativa do volume de uma sala a partir das seis faces ajustadas ---
//
// Cada face é um plano A·x + B·y + C·z + D = 0 vindo do Modelo Combinado (adjustment.js),
// com a injunção ‖n‖ = 1. O volume sai de uma fórmula ALGÉBRICA nos 24 parâmetros, o que
// permite obter a incerteza por propagação de covariâncias em vez de simulação:
//
//   vértice   M·v = -d,  M = [n_i; n_j; n_k],  d = (D_i, D_j, D_k)      (um plano de cada par)
//   volume    V = (1/6) |Σ_{t=1..12} det[p_t1, p_t2, p_t3]|             (fronteira orientada)
//   jacobiana ∂v/∂(A_i,B_i,C_i,D_i) = -M⁻¹ e_r [v_x, v_y, v_z, 1]
//   variância σ²_V = J Σ Jᵀ,  Σ = blockdiag(Σ_1..Σ_6)
//
// As seis faces são planas por construção, então o teorema da divergência sobre a fronteira
// triangulada é exato. Σ_Xa tem posto 3 (a direção nula é a escala dos parâmetros), mas isso é
// inofensivo: esticar os parâmetros de um plano não move o plano, logo essa direção cai no
// núcleo de J — o que é verificado em test_volume.js.
(function (root, factory) {
    const api = factory(typeof require === 'function' ? require('./adjustment.js') : root.PlaneAdjust);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PlanoVolume = api;
})(typeof self !== 'undefined' ? self : this, function (PlaneAdjust) {

    const L = PlaneAdjust.linalg;

    // Rótulos dos seis slots, na ordem em que a interface os pede
    const SLOTS = [
        { key: 'frontal', label: 'Parede frontal', tipo: 'vertical', sample: 'parede_frontal.csv' },
        { key: 'traseira', label: 'Parede traseira', tipo: 'vertical', sample: 'parede_traseira_7col.csv' },
        { key: 'esquerda', label: 'Parede esquerda', tipo: 'vertical', sample: 'parede_esquerda_7col.csv' },
        { key: 'direita', label: 'Parede direita', tipo: 'vertical', sample: 'parede_direita_7col.csv' },
        { key: 'piso', label: 'Piso', tipo: 'horizontal', sample: 'piso_7col.csv' },
        { key: 'teto', label: 'Teto', tipo: 'horizontal', sample: 'teto_7col.csv' }
    ];

    function unit(p) {
        const n = Math.hypot(p[0], p[1], p[2]);
        if (n < 1e-12) throw new Error('Plano com normal degenerada.');
        return [p[0] / n, p[1] / n, p[2] / n, p[3] / n];
    }

    // --- pareamento das faces opostas ---------------------------------------------------

    // Todos os emparelhamentos perfeitos de {0..n-1}: são 15 para n = 6, então vale enumerar
    // todos e escolher o melhor em vez de usar uma regra gulosa.
    function allMatchings(items) {
        if (!items.length) return [[]];
        const [first, ...rest] = items;
        const out = [];
        rest.forEach((p, i) => {
            const restantes = rest.filter((_, j) => j !== i);
            allMatchings(restantes).forEach(m => out.push([[first, p]].concat(m)));
        });
        return out;
    }

    // Faces opostas são as de normais paralelas. Escolhe o emparelhamento que maximiza a soma
    // dos |n_i·n_j| — os nomes dos arquivos não servem de guia: nas amostras a "frontal" (-Y)
    // opõe a "direita" (+Y), e a "esquerda" (+X) opõe a "traseira" (-X).
    function pairFaces(planes) {
        const n = planes.map(unit);
        const cos = (i, j) => Math.abs(n[i][0] * n[j][0] + n[i][1] * n[j][1] + n[i][2] * n[j][2]);
        let melhor = null;
        allMatchings(planes.map((_, i) => i)).forEach(m => {
            const soma = m.reduce((s, [i, j]) => s + cos(i, j), 0);
            if (!melhor || soma > melhor.soma) melhor = { soma, pairs: m };
        });
        const pairs = melhor.pairs;
        return {
            pairs,
            // |cos| dentro de cada par (1 = perfeitamente paralelas) e desvio em graus
            paralelismo: pairs.map(([i, j]) => {
                const c = Math.min(1, cos(i, j));
                return { i, j, cos: c, graus: Math.acos(c) * 180 / Math.PI };
            }),
            // |cos| entre os eixos dos três pares (0 = perfeitamente ortogonais)
            ortogonalidade: [[0, 1], [0, 2], [1, 2]].map(([a, b]) => {
                const c = Math.min(1, cos(pairs[a][0], pairs[b][0]));
                return { a, b, cos: c, graus: 90 - Math.acos(c) * 180 / Math.PI };
            })
        };
    }

    // Distância entre as duas faces de um par, medida ao longo da normal
    function separation(planes, par) {
        const a = unit(planes[par[0]]), b = unit(planes[par[1]]);
        const mesmoSentido = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) > 0;
        return Math.abs(mesmoSentido ? a[3] - b[3] : a[3] + b[3]);
    }

    // --- geometria do poliedro ----------------------------------------------------------

    // Os 8 vértices, indexados por (a,b,c) ∈ {0,1}³ — um plano de cada par.
    // Devolve também, por vértice, quais três planos o produziram (necessário na jacobiana).
    function buildRoom(planes, pairs) {
        const X = planes.map(unit);
        const V = [], tri = [];
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
            const t = [pairs[0][a], pairs[1][b], pairs[2][c]];
            const M = t.map(i => [X[i][0], X[i][1], X[i][2]]);
            V[a * 4 + b * 2 + c] = L.solve(M, t.map(i => -X[i][3]));
            tri[a * 4 + b * 2 + c] = t;
        }

        const g = [0, 1, 2].map(k => V.reduce((s, v) => s + v[k], 0) / 8);

        // Cada face vira 2 triângulos, com a normal apontando para FORA da sala
        const tris = [], faces = [];
        pairs.forEach((par, eixo) => {
            for (let lado = 0; lado < 2; lado++) {
                const quad = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, w]) => {
                    const t = [0, 0, 0];
                    t[eixo] = lado;
                    const outros = [0, 1, 2].filter(x => x !== eixo);
                    t[outros[0]] = u; t[outros[1]] = w;
                    return t[0] * 4 + t[1] * 2 + t[2];
                });
                const pl = X[par[lado]];
                const dentro = pl[0] * g[0] + pl[1] * g[1] + pl[2] * g[2] + pl[3];
                const s = dentro < 0 ? 1 : -1;                       // leva a normal para fora
                const nOut = [s * pl[0], s * pl[1], s * pl[2]];
                const d1 = [0, 1, 2].map(i => V[quad[2]][i] - V[quad[0]][i]);
                const d2 = [0, 1, 2].map(i => V[quad[3]][i] - V[quad[1]][i]);
                const q = L.dot(L.cross(d1, d2), nOut) >= 0
                    ? quad : [quad[0], quad[3], quad[2], quad[1]];
                faces.push({ plano: par[lado], quad: q, nOut });
                tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
            }
        });

        let vol = 0;
        tris.forEach(([p, q, r]) => { vol += L.dot(V[p], L.cross(V[q], V[r])); });
        vol /= 6;

        return {
            vertices: V, triPlanos: tri, tris, faces, centroide: g,
            volumeAssinado: vol, volume: Math.abs(vol),
            separacoes: pairs.map(par => separation(planes, par))
        };
    }

    // Produto das três separações: a estimativa ingênua, só para comparação
    function naiveBox(planes, pairs) {
        return pairs.reduce((p, par) => p * separation(planes, par), 1);
    }

    // --- jacobiana ----------------------------------------------------------------------

    // ∂V/∂(24 parâmetros), analítica. A ordem é [A0,B0,C0,D0, A1,...], seguindo `planes`.
    function jacobian(planes, pairs) {
        const X = planes.map(unit);
        const sala = buildRoom(planes, pairs);
        const sg = Math.sign(sala.volumeAssinado) || 1;

        // ∂V/∂vértice: cada triângulo contribui com o produto vetorial dos outros dois cantos
        const dV = sala.vertices.map(() => [0, 0, 0]);
        sala.tris.forEach(([a, b, c]) => {
            const acc = (k, v) => { for (let i = 0; i < 3; i++) dV[k][i] += v[i] / 6; };
            acc(a, L.cross(sala.vertices[b], sala.vertices[c]));
            acc(b, L.cross(sala.vertices[c], sala.vertices[a]));
            acc(c, L.cross(sala.vertices[a], sala.vertices[b]));
        });

        const J = new Array(4 * planes.length).fill(0);
        sala.vertices.forEach((v, k) => {
            const t = sala.triPlanos[k];
            const Minv = L.inv(t.map(i => [X[i][0], X[i][1], X[i][2]]));
            t.forEach((p, r) => {
                // ∂v/∂(params do plano p) = -Minv[:,r] ⊗ [v_x, v_y, v_z, 1]
                const col = [Minv[0][r], Minv[1][r], Minv[2][r]];
                const fator = [v[0], v[1], v[2], 1];
                for (let c = 0; c < 4; c++) {
                    let s = 0;
                    for (let i = 0; i < 3; i++) s += dV[k][i] * (-col[i] * fator[c]);
                    J[4 * p + c] += s;
                }
            });
        });

        // Até aqui J é a derivada em relação aos parâmetros JÁ normalizados. A entrada pode não
        // ter ‖n‖ = 1, e V(p) = V(p/‖n‖), então pela regra da cadeia falta multiplicar pela
        // jacobiana da normalização, (1/‖n‖)(I - X⊗ñ). Como ∂V/∂X · X = 0 (invariância de
        // gauge), o segundo termo morre e sobra a divisão por ‖n‖.
        planes.forEach((p, i) => {
            const s = Math.hypot(p[0], p[1], p[2]);
            for (let c = 0; c < 4; c++) J[4 * i + c] /= s;
        });

        return { J: J.map(x => x * sg), volume: sala.volume, sala };
    }

    // --- propagação ---------------------------------------------------------------------

    // σ²_V = J Σ Jᵀ com Σ bloco-diagonal: as seis faces vêm de levantamentos independentes,
    // então não há covariância cruzada entre elas.
    function propagate(J, covs, dofs) {
        const contribuicoes = covs.map((S, p) => {
            let v = 0;
            for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) v += J[4 * p + a] * S[a][b] * J[4 * p + b];
            return v;
        });
        const variancia = contribuicoes.reduce((s, v) => s + v, 0);

        // Graus de liberdade efetivos (Welch-Satterthwaite). Somar os gl das seis faces seria
        // errado: elas têm σ̂₀ muito diferentes, e quem domina a variância domina o gl.
        let nuEf = null;
        if (dofs && dofs.every(d => d > 0) && variancia > 0) {
            const den = contribuicoes.reduce((s, c, i) => s + c * c / dofs[i], 0);
            nuEf = den > 0 ? variancia * variancia / den : null;
        }

        return {
            variancia, sigma: Math.sqrt(variancia), contribuicoes,
            fracoes: contribuicoes.map(c => variancia > 0 ? c / variancia : 0),
            nuEf
        };
    }

    // Intervalos nas duas distribuições. `alphas` em porcentagem: 1 significa 99% de confiança.
    function intervals(volume, sigma, nuEf, alphas = [1, 5, 10]) {
        return alphas.map(alpha => {
            const p = 1 - alpha / 200;
            const z = PlaneAdjust.normInv(p);
            const t = (nuEf && nuEf > 0) ? PlaneAdjust.tInv(p, nuEf) : null;
            return {
                alpha, confianca: 100 - alpha, z, t,
                margemZ: z * sigma, margemT: t === null ? null : t * sigma,
                z_lo: volume - z * sigma, z_hi: volume + z * sigma,
                t_lo: t === null ? null : volume - t * sigma,
                t_hi: t === null ? null : volume + t * sigma
            };
        });
    }

    // --- conferências geométricas (opcionais, antes de ajustar) --------------------------

    const TOL = { paralelismo: 5, ortogonalidade: 5, separacaoMin: 0.3 };

    // Roda sobre as normais da PCA das nuvens, sem precisar de ajustamento: serve para avisar
    // que os seis arquivos podem ter sido postos em slots trocados.
    function geometryChecks(nuvens, opts) {
        const tol = Object.assign({}, TOL, opts);
        const planos = nuvens.map(pts => PlaneAdjust.initialPlanePCA(pts));
        const par = pairFaces(planos);
        const itens = [];

        // 1) cada face é do tipo que o slot promete
        nuvens.forEach((pts, i) => {
            const cls = PlaneAdjust.classifyPlane(pts, planos[i]);
            const esperado = SLOTS[i].tipo;
            itens.push({
                ok: cls.tipo === esperado,
                titulo: `${SLOTS[i].label}: ${cls.tipo}`,
                detalhe: cls.tipo === esperado
                    ? `como esperado para este slot (|cos z| = ${cls.cosZ.toFixed(4)})`
                    : `o slot espera um plano ${esperado} — o arquivo pode estar na posição errada`
            });
        });

        // 2) as faces opostas são paralelas
        par.paralelismo.forEach(p => {
            itens.push({
                ok: p.graus <= tol.paralelismo,
                titulo: `${SLOTS[p.i].label} ↔ ${SLOTS[p.j].label}`,
                detalhe: `opostas, fora do paralelismo por ${p.graus.toFixed(3)}°` +
                    (p.graus <= tol.paralelismo ? '' : ` (tolerância ${tol.paralelismo}°)`)
            });
        });

        // 3) os três eixos são mutuamente ortogonais
        par.ortogonalidade.forEach(o => {
            itens.push({
                ok: Math.abs(o.graus) <= tol.ortogonalidade,
                titulo: `eixo ${o.a + 1} ⊥ eixo ${o.b + 1}`,
                detalhe: `fora da ortogonalidade por ${Math.abs(o.graus).toFixed(3)}°`
            });
        });

        // 4) as separações são positivas e plausíveis
        par.pairs.forEach((p, k) => {
            const s = separation(planos, p);
            itens.push({
                ok: s >= tol.separacaoMin,
                titulo: `separação do eixo ${k + 1}`,
                detalhe: `${s.toFixed(4)} m entre ${SLOTS[p[0]].label} e ${SLOTS[p[1]].label}`
            });
        });

        return { itens, pares: par, planos };
    }

    // --- conveniência: o cálculo inteiro de uma vez -------------------------------------

    // `faces` = [{ X: [A,B,C,D], Sigma: 4x4, dof }] na ordem dos slots
    function estimate(faces, alphas) {
        const planes = faces.map(f => f.X);
        const { pairs } = pairFaces(planes);
        const { J, volume, sala } = jacobian(planes, pairs);
        const prop = propagate(J, faces.map(f => f.Sigma), faces.map(f => f.dof));
        return {
            pairs, sala, volume, J, propagacao: prop,
            caixaIngenua: naiveBox(planes, pairs),
            intervalos: intervals(volume, prop.sigma, prop.nuEf, alphas)
        };
    }

    return {
        SLOTS, TOL, unit, pairFaces, separation, buildRoom, naiveBox,
        jacobian, propagate, intervals, geometryChecks, estimate
    };
});
