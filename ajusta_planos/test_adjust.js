// Testes do simulador de ajustamento de planos.
// Execute com:  node ajusta_planos/test_adjust.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const io = require('./io.js');
const A = require('./adjustment.js');
const { linalg } = A;
const raw = require('./samples/raw_to_csv.js');
const Hist = require('./histogram1d.js');

const SAMPLES = path.join(__dirname, 'samples');
const S = Object.assign({}, io.DEFAULT_SETTINGS);

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }
function approx(actual, expected, tol, label) {
    assert.ok(Math.abs(actual - expected) <= tol,
        `${label}: esperado ${expected}, obtido ${actual} (tol ${tol})`);
    ok(label);
}

function loadSample(name) {
    const { rows, errors } = io.parseCSV(fs.readFileSync(path.join(SAMPLES, name), 'utf8'));
    assert.strictEqual(errors.length, 0, `${name}: ${errors.join(' | ')}`);
    return io.buildPoints(rows, S);
}

// Todas as amostras da pasta, para que um CSV novo entre nos testes sem editar nada aqui.
const ALL_SAMPLES = fs.readdirSync(SAMPLES).filter(f => f.endsWith('.csv')).sort();

// ---------------------------------------------------------------- conversões
console.log('\nGMS / XYZ');
approx(io.gmsToDeg(4, 17, 9), 4.285833333333, 1e-9, 'gmsToDeg');
{
    const g = io.degToGms(4.285833333333);
    assert.deepStrictEqual([g.g, g.m], [4, 17]);
    approx(g.s, 9, 1e-6, 'degToGms ida e volta');
}
{
    // XYZ -> observação -> XYZ deve fechar
    const p = [3.1, -2.4, 1.7];
    const o = io.xyzToObs(p[0], p[1], p[2]);
    const back = io.obsToXYZ(o.az, o.zen, o.sd);
    approx(linalg.norm([back[0] - p[0], back[1] - p[1], back[2] - p[2]]), 0, 1e-12,
        'xyzToObs / obsToXYZ são inversas');
}
{
    // Jacobiana GMS->XYZ contra diferenças finitas
    const az = 1.1, zen = 1.4, sd = 4.2;
    const J = io.jacobianGMStoXYZ(az, zen, sd);
    const h = 1e-7;
    const base = io.obsToXYZ(az, zen, sd);
    const pert = [
        io.obsToXYZ(az + h, zen, sd),
        io.obsToXYZ(az, zen + h, sd),
        io.obsToXYZ(az, zen, sd + h)
    ];
    let maxErr = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        maxErr = Math.max(maxErr, Math.abs(J[i][j] - (pert[j][i] - base[i]) / h));
    }
    approx(maxErr, 0, 1e-5, 'Jacobiana GMS->XYZ bate com diferenças finitas');
}
{
    // Propagação da MVC: simétrica e positiva definida
    const Sg = io.sigmaXYZ(1.1, 1.4, 4.2, S);
    approx(Sg[0][1] - Sg[1][0], 0, 1e-18, 'Sigma_XYZ é simétrica');
    const ev = linalg.eigSym(Sg).values;
    assert.ok(ev[0] > 0, `Sigma_XYZ deve ser positiva definida, autovalores ${ev}`);
    ok('Sigma_XYZ é positiva definida');
}

// ---------------------------------------------------------------- ajustamento
// Referências calculadas de forma independente (numpy) sobre os mesmos CSVs.
const REF = {
    'piso_7col.csv': {
        m: 50, dof: 47, VtPV: 723.286, sigma02: 15.3891,
        Xa: [5.55000229e-04, -5.64020766e-04, 9.99999687e-01, 1.60890582],
        chi2low: 29.956, chi2upp: 67.821, globalPass: false
    },
    // Esta referência foi calculada sobre os números que hoje estão em parede_esquerda_7col.csv
    // (o antigo parede_frontal.csv era uma cópia dela, ver readme).
    'parede_esquerda_7col.csv': {
        m: 51, dof: 48, VtPV: 20.686, sigma02: 0.4310,
        Xa: [9.99918489e-01, -1.27306307e-02, -9.72759912e-04, -3.85785009],
        chi2low: 30.755, chi2upp: 69.023, globalPass: false
    }
};

const GAUGES = ['constraint', 'reduction', 'pseudoinverse'];
const HORIZONTAL = { 'piso_7col.csv': true, 'parede_esquerda_7col.csv': false };

for (const [name, ref] of Object.entries(REF)) {
    for (const gauge of GAUGES) {
        console.log(`\nAjustamento — ${name} · ${gauge}`);
        const pts = loadSample(name);
        const res = A.adjustPlane(pts, Object.assign({}, S, { gauge }));

        assert.strictEqual(res.gauge, gauge);
        assert.ok(res.converged, 'o ajustamento deve convergir');
        assert.ok(res.iterations <= 6, `convergência rápida esperada, obtidas ${res.iterations} iterações`);
        ok(`convergiu em ${res.iterations} iterações`);

        assert.strictEqual(res.m, ref.m);
        assert.strictEqual(res.dof, ref.dof);
        ok(`m = ${res.m}, gl = ${res.dof} (m - 3 nos três gauges)`);

        // Grandezas invariantes ao gauge: valem para as três estratégias
        approx(res.VtPV, ref.VtPV, 1e-2, 'VtPV');
        approx(res.sigma02, ref.sigma02, 1e-3, 'sigma0²');
        approx(res.chi2low, ref.chi2low, 1e-2, 'χ² inferior');
        approx(res.chi2upp, ref.chi2upp, 1e-2, 'χ² superior');
        assert.strictEqual(res.globalPass, ref.globalPass);
        ok(`teste global ${res.globalPass ? 'aprovado' : 'reprovado'} (esperado)`);

        // Xa BRUTO só é comparável à referência na injunção unitária, que é o gauge em que ela
        // foi calculada; nos demais a escala é outra, então compara-se o vetor normalizado.
        if (gauge === 'constraint') {
            const flip = linalg.dot(res.Xa, ref.Xa) < 0 ? -1 : 1;
            let maxDiff = 0;
            for (let i = 0; i < 4; i++) maxDiff = Math.max(maxDiff, Math.abs(flip * res.Xa[i] - ref.Xa[i]));
            approx(maxDiff, 0, 1e-6, 'Xa bruto bate com a referência');
            approx(linalg.norm(res.Xa.slice(0, 3)), 1, 1e-12, 'injunção A²+B²+C² = 1 satisfeita');
        } else {
            const Xn = A.normalizeParameters(res).Xn;
            let maxDiff = 0;
            for (let i = 0; i < 4; i++) maxDiff = Math.max(maxDiff, Math.abs(Xn[i] - ref.Xa[i]));
            approx(maxDiff, 0, 1e-6, 'X̂ normalizado bate com a referência');
        }

        if (gauge === 'reduction') {
            assert.strictEqual(res.pinIndex !== null, true, 'a redução deve registrar o parâmetro fixado');
            approx(res.X[res.pinIndex], 0, 0, 'a correção do parâmetro fixado é exatamente zero');
        } else {
            assert.strictEqual(res.pinIndex, null, 'só a redução fixa parâmetro');
        }

        // Σ_Xa tem posto 3 nos três gauges — muda apenas QUAL direção é nula
        const ev = linalg.eigSym(res.SigmaXa).values;
        const scaleOf = Math.max(...ev.map(Math.abs));
        approx(Math.abs(ev[0]) / scaleOf, 0, 1e-10, 'Σ_Xa tem posto 3 (um autovalor nulo)');
        assert.ok(ev[1] > 0, 'os demais autovalores de Σ_Xa devem ser positivos');
        ok('Σ_Xa positiva semidefinida');

        const sumR = res.obsData.reduce((s, o) => s + o.r, 0);
        assert.ok(res.obsData.every(o => o.r >= 0 && o.r <= 1), 'r fora de [0,1]');
        approx(sumR, res.dof, 1e-6, 'Σ r_i = graus de liberdade');
    }
}

// ---------------------------------------------------------------- equivalência entre gauges
// O gauge é convenção de representação: tudo que não depende da escala tem de coincidir.
for (const [name, horiz] of Object.entries(HORIZONTAL)) {
    console.log(`\nEquivalência entre gauges — ${name}`);
    const pts = loadSample(name);
    const cmp = A.compareGauges(pts, S);

    assert.strictEqual(cmp.runs.length, 3);
    cmp.runs.slice(1).forEach(r => {
        approx(r.dXn, 0, 1e-12, `${r.gauge}: mesmo plano normalizado (max|ΔX̂|)`);
        approx(r.dSigmaXn, 0, 1e-10, `${r.gauge}: mesma Σ_X̂ (erro relativo)`);
        approx(r.dR, 0, 1e-10, `${r.gauge}: mesmas redundâncias locais`);
        approx(r.dVtPV, 0, 1e-10, `${r.gauge}: mesmo VᵀPV (erro relativo)`);
    });

    // ...mas as representações BRUTAS têm de ser de fato diferentes, senão o teste acima
    // estaria passando por acidente (os três caindo na mesma parametrização).
    const norms = cmp.runs.map(r => r.res.normaN);
    approx(norms[0], 1, 1e-12, 'injunção unitária sai com ‖n‖ = 1 exato');
    assert.ok(Math.abs(norms[2] - 1) > 1e-9,
        `a pseudo-inversa deveria manter ‖n‖ livre, obtido ${norms[2]}`);
    ok(`‖n‖ difere entre gauges: ${norms.map(v => v.toFixed(10)).join(' / ')}`);

    // A direção nula de Σ_Xa muda de natureza na redução
    assert.strictEqual(cmp.runs[1].nullDirection, `eixo de ${cmp.runs[1].res.pinName}`);
    assert.strictEqual(cmp.runs[2].nullDirection, 'escala');
    ok(`direção nula: ${cmp.runs.map(r => r.nullDirection).join(' / ')}`);

    // O sistema efetivamente resolvido é MUITO melhor condicionado nos gauges reduzidos
    const conds = cmp.runs.map(r => r.res.condSystem);
    assert.ok(conds[1] < conds[0] && conds[2] < conds[0],
        `redução e pseudo-inversa deveriam condicionar melhor: ${conds}`);
    ok(`cond(sistema): ${conds.map(c => c.toExponential(1)).join(' / ')}`);
}

// ---------------------------------------------------------------- mecânica do gauge
console.log('\nMecânica do gauge');
{
    // Base do complemento ortogonal: ortonormal e de fato ortogonal a E
    const e = [0.3, -0.5, 0.81, 1.7];
    const U = linalg.nullComplementBasis(e);
    assert.strictEqual(U.length, 4);
    assert.strictEqual(U[0].length, 3);
    let maxDot = 0, maxGram = 0;
    for (let j = 0; j < 3; j++) {
        const col = U.map(r => r[j]);
        maxDot = Math.max(maxDot, Math.abs(linalg.dot(e, col)));
        for (let k = 0; k < 3; k++) {
            const col2 = U.map(r => r[k]);
            maxGram = Math.max(maxGram, Math.abs(linalg.dot(col, col2) - (j === k ? 1 : 0)));
        }
    }
    approx(maxDot / linalg.norm(e), 0, 1e-15, 'nullComplementBasis: Eᵀ U = 0');
    approx(maxGram, 0, 1e-15, 'nullComplementBasis: colunas ortonormais');

    // Regra automática do parâmetro fixado: maior componente da normal, nunca D
    const pts = loadSample('piso_7col.csv');
    const X0piso = A.initialPlanePCA(pts.map(p => p.xyz));
    assert.strictEqual(A.resolvePinIndex(X0piso, { pinParam: 'auto' }), 2);
    ok('piso: automático fixa C (normal ≈ +Z)');
    const ptsW = loadSample('parede_esquerda_7col.csv');
    const X0par = A.initialPlanePCA(ptsW.map(p => p.xyz));
    assert.strictEqual(A.resolvePinIndex(X0par, { pinParam: 'auto' }), 0);
    ok('parede: automático fixa A (normal ≈ +X)');
    assert.strictEqual(A.resolvePinIndex(X0piso, { pinParam: 'D' }), 3);
    ok('escolha manual respeitada');

    // Fixar um parâmetro quase nulo é um gauge legítimo, porém quase ortogonal à direção de
    // escala: não muda a resposta, mas arruína o condicionamento e a velocidade de convergência.
    // O simulador precisa mostrar isso, então tem de sair medido — não escondido nem estourado.
    const good = A.adjustPlane(loadSample('piso_7col.csv'), Object.assign({}, S, { gauge: 'reduction', pinParam: 'C' }));
    const bad = A.adjustPlane(loadSample('piso_7col.csv'), Object.assign({}, S, { gauge: 'reduction', pinParam: 'B' }));

    assert.ok(good.pinQuality > 0.5, `fixar C deveria ser um bom gauge, qualidade ${good.pinQuality}`);
    assert.ok(bad.pinQuality < 1e-3, `fixar B deveria ser um gauge ruim, qualidade ${bad.pinQuality}`);
    ok(`qualidade do gauge: C = ${good.pinQuality.toFixed(3)}, B = ${bad.pinQuality.toExponential(1)}`);

    assert.ok(bad.condSystem > good.condSystem * 100,
        `fixar B deveria piorar muito o condicionamento: ${good.condSystem} -> ${bad.condSystem}`);
    ok(`cond(N_r) dispara: ${good.condSystem.toExponential(1)} -> ${bad.condSystem.toExponential(1)}`);

    // No limite padrão de iterações o gauge ruim PARA ANTES da convergência — e o resultado
    // truncado é de fato errado (VᵀPV muito acima do correto). Tem de ser reportado como
    // não convergido, nunca entregue em silêncio.
    assert.strictEqual(bad.converged, false, 'com maxIter padrão o gauge ruim não deve convergir');
    assert.ok(bad.VtPV > good.VtPV * 2, 'o resultado truncado é realmente ruim');
    ok(`gauge ruim não converge em ${S.maxIter} iterações (VᵀPV ${bad.VtPV.toFixed(0)} vs ${good.VtPV.toFixed(0)})`);

    // Com iterações suficientes chega exatamente no mesmo plano: o gauge é convenção, o que
    // ele muda é o caminho numérico.
    const fixed = A.adjustPlane(loadSample('piso_7col.csv'),
        Object.assign({}, S, { gauge: 'reduction', pinParam: 'B', maxIter: 200 }));
    assert.ok(fixed.converged, 'com mais iterações o gauge ruim deve convergir');
    assert.ok(fixed.iterations > good.iterations * 5,
        `deveria custar muito mais iterações: ${good.iterations} -> ${fixed.iterations}`);
    approx(fixed.VtPV, good.VtPV, 1e-6, 'mesmo VᵀPV após convergir');
    const dPlane = Math.max(...A.normalizeParameters(fixed).Xn
        .map((v, i) => Math.abs(v - A.normalizeParameters(good).Xn[i])));
    approx(dPlane, 0, 1e-9, 'mesmo plano, ao custo de ' + fixed.iterations + ' iterações');
}

// ---------------------------------------------------------------- normalização
console.log('\nNormalização dos parâmetros');
{
    const pts = loadSample('piso_7col.csv');
    const res = A.adjustPlane(pts, S);
    const nrm = A.normalizeParameters(res);
    assert.strictEqual(nrm.classification.tipo, 'horizontal');
    ok('piso classificado como horizontal');
    assert.ok(nrm.Xn[2] > 0, 'plano horizontal deve ter a normal apontando para +Z');
    ok('sentido escolhido próximo de +Z');
    approx(linalg.norm(nrm.Xn.slice(0, 3)), 1, 1e-12, '||n|| = 1 após normalizar');

    // Jacobiano da normalização contra diferenças finitas
    const h = 1e-7;
    const f = (X) => {
        const s = linalg.norm(X.slice(0, 3));
        return X.map(v => nrm.sign * v / s);
    };
    let maxErr = 0;
    for (let j = 0; j < 4; j++) {
        const Xp = res.Xa.slice(); Xp[j] += h;
        const Xm = res.Xa.slice(); Xm[j] -= h;
        const fp = f(Xp), fm = f(Xm);
        for (let i = 0; i < 4; i++) maxErr = Math.max(maxErr, Math.abs(nrm.J[i][j] - (fp[i] - fm[i]) / (2 * h)));
    }
    approx(maxErr, 0, 1e-5, 'Jacobiano da normalização bate com diferenças finitas');

    // Σ_X̂ continua simétrica e de posto 3
    let asym = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        asym = Math.max(asym, Math.abs(nrm.SigmaXn[i][j] - nrm.SigmaXn[j][i]));
    }
    let magn = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) magn = Math.max(magn, Math.abs(nrm.SigmaXn[i][j]));
    approx(asym / magn, 0, 1e-12, 'Σ_X̂ simétrica (erro relativo)');
}
{
    const pts = loadSample('parede_esquerda_7col.csv');
    const res = A.adjustPlane(pts, S);
    const nrm = A.normalizeParameters(res);
    assert.strictEqual(nrm.classification.tipo, 'vertical');
    ok('parede classificada como vertical');
    assert.ok(nrm.Xn[0] > 0, 'plano vertical deve ter a normal apontando para +X');
    ok('sentido escolhido próximo de +X');
}

{
    // A classificação olha a normal, não o espalhamento. A parede frontal foi medida numa
    // faixa larga e baixa (3,07 m em X contra 0,42 m em Z): a regra antiga, que comparava a
    // variação em Z com 20% do maior espalhamento horizontal, a chamava de horizontal.
    const pts = loadSample('parede_frontal.csv');
    const res = A.adjustPlane(pts, S);
    const nrm = A.normalizeParameters(res);
    const sp = nrm.classification.spread;
    assert.ok(sp[2] < 0.2 * Math.max(sp[0], sp[1]),
        'esta amostra precisa mesmo ser a faixa larga e baixa que enganava a regra antiga');
    assert.strictEqual(nrm.classification.tipo, 'vertical');
    ok('parede larga e baixa classificada como vertical (regra pela normal)');

    // classifyPlane sem a normal cai na PCA dos pontos e tem de concordar
    const semNormal = A.classifyPlane(res.Lb);
    assert.strictEqual(semNormal.tipo, 'vertical', 'PCA deve concordar com a normal ajustada');
    ok('classificação pela PCA concorda com a normal ajustada');

    // piso e teto continuam horizontais pelos dois caminhos
    ['piso_7col.csv', 'teto_7col.csv'].forEach(nome => {
        const r2 = A.adjustPlane(loadSample(nome), S);
        assert.strictEqual(A.normalizeParameters(r2).classification.tipo, 'horizontal');
        assert.strictEqual(A.classifyPlane(r2.Lb).tipo, 'horizontal');
    });
    ok('piso e teto continuam horizontais pelos dois caminhos');

    // A fronteira é 45°: normal a 40° de Z ainda é horizontal, a 50° já é vertical.
    // Pontos sobre um plano inclinado de theta, para exercitar também o caminho da PCA.
    function planoInclinado(thetaDeg) {
        const t = thetaDeg * Math.PI / 180;
        const n = [Math.sin(t), 0, Math.cos(t)];            // normal a theta do eixo Z
        const e1 = [0, 1, 0];                                // duas direções dentro do plano
        const e2 = linalg.cross(n, e1);
        const pts = [];
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
            pts.push([e1[0] * i + e2[0] * j, e1[1] * i + e2[1] * j, e1[2] * i + e2[2] * j]);
        }
        return { pts, n };
    }
    [[40, 'horizontal'], [50, 'vertical']].forEach(([deg, esperado]) => {
        const { pts, n } = planoInclinado(deg);
        assert.strictEqual(A.classifyPlane(pts, n).tipo, esperado, `normal a ${deg}° de Z`);
        assert.strictEqual(A.classifyPlane(pts).tipo, esperado, `normal a ${deg}° de Z, via PCA`);
    });
    ok('fronteira em 45°: 40° é horizontal, 50° é vertical (com normal e via PCA)');
}

// ---------------------------------------------------------------- outliers
console.log('\nDetecção de outliers');
{
    const pts = loadSample('piso_7col.csv');
    const res = A.adjustPlane(pts, S);
    const worst = res.obsData.reduce((a, b) => Math.abs(a.d) > Math.abs(b.d) ? a : b);

    const r3 = A.detectThreeSigma(res, S);
    assert.ok(r3.flagged.includes(worst.point.idx), 'regra 3σ deve marcar o maior resíduo');
    ok(`regra 3σ marcou ${r3.flagged.length} ponto(s), incluindo o extremo`);

    const rs = A.detectDataSnooping(pts, S);
    assert.ok(rs.flagged.includes(worst.point.idx), 'data snooping deve marcar o maior resíduo');
    assert.ok(pts.every(p => p.active), 'data snooping não pode alterar o estado dos pontos');
    ok(`data snooping marcou ${rs.flagged.length} ponto(s) em ${rs.history.length} rodada(s)`);

    const rr = A.detectRANSAC(pts, Object.assign({}, S, { ransacIters: 3000, ransacThreshMm: 8 }));
    assert.ok(rr.flagged.includes(worst.point.idx), 'RANSAC deve marcar o maior resíduo');
    ok(`RANSAC marcou ${rr.flagged.length} ponto(s)`);

    // Desativar os outliers deve reduzir a variância a posteriori
    rs.flagged.forEach(i => { pts[i].active = false; });
    const res2 = A.adjustPlane(pts, S);
    assert.ok(res2.sigma02 < res.sigma02,
        `σ₀² deveria cair: ${res.sigma02.toFixed(3)} -> ${res2.sigma02.toFixed(3)}`);
    ok(`σ₀² caiu de ${res.sigma02.toFixed(2)} para ${res2.sigma02.toFixed(2)} após remover outliers`);
}

// ---------------------------------------------------------------- dados sintéticos
console.log('\nGerador sintético e erro grosseiro');
{
    // Semente fixa: o bloco gera ruído aleatório e depois exige que o teste global a 5%
    // aprove. Sem semente ele reprova em cerca de 5% das execuções — por construção, não por
    // defeito — e um portão de testes que falha sozinho não serve para nada.
    const randomOriginal = Math.random;
    let semente = 0x9e3779b9;
    Math.random = function () {                      // mulberry32
        semente = (semente + 0x6d2b79f5) >>> 0;
        let t = semente;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const rows = io.generateSynthetic({ tipo: 'parede_frontal', n: 40, extent: 2.5 }, S);
    const pts = io.buildPoints(rows, S);
    const res = A.adjustPlane(pts, S);
    assert.ok(res.converged, 'ajustamento dos dados sintéticos deve convergir');
    assert.ok(res.sigma02 > 0.2 && res.sigma02 < 5,
        `σ₀² ≈ 1 esperado para ruído nominal, obtido ${res.sigma02}`);
    ok(`σ₀² = ${res.sigma02.toFixed(3)} coerente com o modelo estocástico`);
    assert.ok(res.globalPass, 'teste global deve aprovar dados gerados com o ruído nominal');
    ok('teste global aprovado sem erro grosseiro');

    io.injectBlunder(pts, [7], 15, S);
    const resB = A.adjustPlane(pts, S);
    assert.ok(!resB.globalPass, 'teste global deve reprovar após o erro grosseiro');
    ok('teste global reprovado após injetar 15σ');

    const snoop = A.detectDataSnooping(pts, S);
    assert.ok(snoop.flagged.includes(7), `data snooping deveria achar o ponto 7, achou ${snoop.flagged}`);
    ok('data snooping localizou o erro grosseiro injetado');

    snoop.flagged.forEach(i => { pts[i].active = false; });
    const resC = A.adjustPlane(pts, S);
    assert.ok(resC.globalPass, 'teste global deve aprovar após remover o erro grosseiro');
    ok('teste global aprovado após a remoção');

    Math.random = randomOriginal;
}

// ---------------------------------------------------------------- matrizes completas
console.log('\nMatrizes completas');
{
    const pts = loadSample('parede_frontal.csv');
    const res = A.adjustPlane(pts, S);
    const F = A.fullMatrices(res);
    assert.strictEqual(F.B.length, res.m);
    assert.strictEqual(F.B[0].length, 3 * res.m);
    assert.strictEqual(F.P.length, 3 * res.m);
    ok('dimensões de B (m×3m) e P (3m×3m)');

    // M = B P^-1 B^T deve reproduzir a diagonal usada no ajustamento
    const BPi = linalg.matmul(F.B, F.SigLb);
    const Mfull = linalg.matmul(BPi, linalg.transpose(F.B));
    let maxErr = 0;
    for (let i = 0; i < res.m; i++) {
        maxErr = Math.max(maxErr, Math.abs(Mfull[i][i] - res.Mdiag[i]) / res.Mdiag[i]);
    }
    approx(maxErr, 0, 1e-9, 'M = B P⁻¹ Bᵀ confere com a diagonal otimizada (erro relativo)');

    // Σ_V + Σ_La = σ₀² P⁻¹
    let maxErr2 = 0, scaleRef = 0;
    for (let i = 0; i < 3 * res.m; i++) for (let j = 0; j < 3 * res.m; j++) {
        maxErr2 = Math.max(maxErr2, Math.abs(F.SigmaV[i][j] + F.SigmaLa[i][j] - res.sigma02 * F.SigLb[i][j]));
        scaleRef = Math.max(scaleRef, Math.abs(res.sigma02 * F.SigLb[i][j]));
    }
    approx(maxErr2 / scaleRef, 0, 1e-9, 'Σ_V + Σ_La = σ₀² P⁻¹ (erro relativo)');
}

// ---------------------------------------------------------------- elipsoides de erro a priori
// A vista 3D monta a rotação de cada elipsoide com as colunas de eigSym(sigXYZ). A ordenação
// por autovalor pode deixar a base à esquerda, e THREE.Quaternion.setFromRotationMatrix exige
// determinante +1 — sem isso o elipsoide sai girado (chegou a 71° nas amostras).
console.log('\nElipsoides de erro a priori');
{
    function det3(M) {
        return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
            - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
            + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    }

    let worstDet = 0, worstOrtho = 0, worstRebuild = 0, worstLOS = 0, total = 0;
    ALL_SAMPLES.forEach(name => {
        loadSample(name).forEach(p => {
            total++;
            const { values, vectors } = linalg.eigSym(p.sigXYZ);
            const R = linalg.rightHanded(vectors);
            worstDet = Math.max(worstDet, Math.abs(det3(R) - 1));

            // colunas ortonormais
            const RtR = linalg.matmul(linalg.transpose(R), R);
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                worstOrtho = Math.max(worstOrtho, Math.abs(RtR[i][j] - (i === j ? 1 : 0)));
            }

            // R·diag(λ)·Rᵀ tem de reproduzir Sigma_XYZ: a troca de sinal não mexe no elipsoide
            const D = linalg.zeros(3, 3);
            for (let i = 0; i < 3; i++) D[i][i] = values[i];
            const reb = linalg.matmul(R, linalg.matmul(D, linalg.transpose(R)));
            let num = 0, den = 0;
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                num = Math.max(num, Math.abs(reb[i][j] - p.sigXYZ[i][j]));
                den = Math.max(den, Math.abs(p.sigXYZ[i][j]));
            }
            worstRebuild = Math.max(worstRebuild, num / den);

            // o eixo maior é a direção do MED: aponta para a estação, na origem
            const e = [R[0][2], R[1][2], R[2][2]];
            const u = p.xyz, un = linalg.norm(u);
            const cos = Math.abs(linalg.dot(e, u) / un);
            worstLOS = Math.max(worstLOS, 1 - Math.min(1, cos));
        });
    });

    assert.ok(total > 200, `poucos pontos varridos (${total}) — a pasta samples/ está completa?`);
    approx(worstDet, 0, 1e-12, 'base dos autovetores com determinante +1 (rotação própria)');
    approx(worstOrtho, 0, 1e-12, 'colunas continuam ortonormais após a correção de sinal');
    approx(worstRebuild, 0, 1e-12, 'R·diag(λ)·Rᵀ reproduz Σ_XYZ (erro relativo)');
    approx(worstLOS, 0, 1e-9, 'eixo maior alinhado à linha de visada (1 − |cos|)');

    // Razão de eixos: 2 mm do MED contra ~2" nos ângulos — a agulha é física, não artefato
    const piso = loadSample('piso_7col.csv');
    let minRatio = Infinity;
    piso.forEach(p => {
        const v = linalg.eigSym(p.sigXYZ).values.map(x => Math.sqrt(Math.max(x, 0)));
        minRatio = Math.min(minRatio, v[2] / v[0]);
    });
    assert.ok(minRatio > 10, `elipsoides deveriam ser muito alongados, razão mínima ${minRatio}`);
    ok(`elipsoides alongados ao longo da visada (razão mínima ${minRatio.toFixed(1)}:1)`);
}

// ---------------------------------------------------------------- amostras da pasta
// Cada CSV de samples/ é um botão da interface: tem de ser lido sem erro, ajustar e
// normalizar. Os seis planos são da mesma sala, medidos da mesma estação total.
console.log('\nAmostras de samples/');
{
    // Cada CSV tem de ser exatamente o que sai do bruto da estação total. Foi assim que se
    // descobriu que parede_frontal.csv era uma cópia da esquerda, com a frontal de verdade
    // (53 observações) nunca convertida.
    const divergentes = raw.conferir();
    assert.strictEqual(divergentes.length, 0,
        `CSV fora de sincronia com raw/: ${divergentes.map(d => d.csv).join(', ')}`);
    ok(`os ${Object.keys(raw.PARES).length} CSVs conferem byte a byte com raw/`);

    assert.ok(ALL_SAMPLES.length >= 6, `esperadas ao menos 6 amostras, achadas ${ALL_SAMPLES.length}`);

    // eixo = componente dominante da normal (0=X, 1=Y, 2=Z); lado = de que lado da estação.
    const GEOMETRIA = {
        'parede_frontal.csv':       { tipo: 'vertical',   eixo: 1, lado: -1 },
        'parede_traseira_7col.csv': { tipo: 'vertical',   eixo: 0, lado: -1 },
        'parede_esquerda_7col.csv': { tipo: 'vertical',   eixo: 0, lado: +1 },
        'parede_direita_7col.csv':  { tipo: 'vertical',   eixo: 1, lado: +1 },
        'piso_7col.csv':            { tipo: 'horizontal', eixo: 2, lado: -1 },
        'teto_7col.csv':            { tipo: 'horizontal', eixo: 2, lado: +1 }
    };

    ALL_SAMPLES.forEach(name => {
        const { rows, errors } = io.parseCSV(fs.readFileSync(path.join(SAMPLES, name), 'utf8'));
        assert.strictEqual(errors.length, 0, `${name}: ${errors.join(' | ')}`);
        assert.ok(rows.length >= 4, `${name}: ${rows.length} observações, mínimo 4`);

        const pts = io.buildPoints(rows, S);
        const res = A.adjustPlane(pts, S);
        assert.ok(res.converged, `${name}: não convergiu em ${res.iterations} iterações`);
        assert.strictEqual(res.dof, res.m - 3, `${name}: graus de liberdade`);

        const nrm = A.normalizeParameters(res);
        const n = nrm.Xn;
        assert.ok(Math.abs(linalg.norm(n.slice(0, 3)) - 1) < 1e-12, `${name}: ‖n‖ ≠ 1 após normalizar`);

        const g = GEOMETRIA[name];
        if (!g) return; // amostra nova ainda não catalogada: os testes acima já valem
        assert.strictEqual(nrm.classification.tipo, g.tipo,
            `${name}: classificado como ${nrm.classification.tipo}`);
        // a normal tem de ser dominada pelo eixo esperado, e o plano ficar do lado certo
        const dom = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
        assert.strictEqual(dom.indexOf(Math.max(...dom)), g.eixo, `${name}: normal não domina o eixo esperado`);
        // D = -n·P, então o plano está em -D ao longo da normal
        assert.ok(Math.sign(-n[3]) === g.lado, `${name}: plano do lado errado da estação (D = ${n[3]})`);
        ok(`${name}: ${g.tipo}, ${res.m} pts, |D| = ${Math.abs(n[3]).toFixed(3)} m`);
    });
}

// ---------------------------------------------------------------- histograma dos resíduos
// A vista 1D bina os resíduos e desenha uma normal de referência por cima. Toda contagem tem
// de fechar com o número de observações, e a curva tem de ter a mesma área das barras.
console.log('\nHistograma dos resíduos (vista 1D)');
{
    // clampBins prende nas duas pontas
    assert.strictEqual(Hist.clampBins(1), Hist.MIN_BINS);
    assert.strictEqual(Hist.clampBins(99), Hist.MAX_BINS);
    assert.strictEqual(Hist.clampBins(12), 12);
    assert.strictEqual(Hist.clampBins(NaN), Hist.DEFAULTS.bins);
    ok(`número de classes preso entre ${Hist.MIN_BINS} e ${Hist.MAX_BINS}`);

    // Momentos contra um vetor de valores conhecidos
    const v = [2, 4, 4, 4, 5, 5, 7, 9];
    const e = Hist.describe(v);
    assert.strictEqual(e.n, 8);
    approx(e.media, 5, 1e-12, 'média de um vetor conhecido');
    approx(e.dp, Math.sqrt(32 / 7), 1e-12, 'desvio amostral (n−1)');
    approx(e.min, 2, 1e-12, 'mínimo');
    approx(e.max, 9, 1e-12, 'máximo');
    // Simétrico em torno da média: assimetria nula
    const sim = Hist.describe([-2, -1, 0, 1, 2]);
    approx(sim.assimetria, 0, 1e-12, 'assimetria nula num vetor simétrico');
    // Curtose de Fisher: 0 na normal, negativa numa uniforme discreta
    assert.ok(sim.curtose < 0, `uniforme deveria ter curtose negativa, deu ${sim.curtose}`);
    ok('curtose em excesso negativa numa distribuição achatada');

    // Todos os valores iguais não podem quebrar a binagem
    const igual = Hist.binResiduals([3, 3, 3, 3], 8);
    assert.strictEqual(igual.bins.reduce((s, b) => s + b.n, 0), 4, 'valores iguais somem');
    assert.ok(igual.largura > 0, 'largura tem de ser positiva mesmo com valores iguais');
    ok('binagem sobrevive a valores todos iguais');

    // O máximo cai no ÚLTIMO bin, não fora dele
    const b10 = Hist.binResiduals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    assert.strictEqual(b10.bins[b10.bins.length - 1].idx.includes(10), true,
        'o valor máximo tem de cair no último bin');
    ok('o valor igual ao máximo cai no último bin');
}

{
    // Nos dados reais: contagens fecham para toda a faixa da barrinha, nas duas grandezas
    const amostras = ['piso_7col.csv', 'parede_frontal.csv', 'parede_direita_7col.csv', 'teto_7col.csv'];
    let combinacoes = 0;
    amostras.forEach(nome => {
        const pts = loadSample(nome);
        const res = A.adjustPlane(pts, S);
        // Marca alguns pontos, para exercitar o empilhamento
        const det = A.detectOutliers(pts, res, 'snooping', S);
        pts.forEach(p => { p.flagged = false; });
        det.flagged.forEach(i => { if (pts[i]) pts[i].flagged = true; });

        Object.values(Hist.QUANTIDADES).forEach(q => {
            const valores = res.obsData.map(q.valor);
            const flags = res.obsData.map(o => !!o.point.flagged);
            for (let k = Hist.MIN_BINS; k <= Hist.MAX_BINS; k++) {
                const h = Hist.binResiduals(valores, k, flags);
                combinacoes++;
                assert.strictEqual(h.bins.length, k, `${nome}/${q.key}: esperava ${k} classes`);
                assert.strictEqual(h.bins.reduce((s, b) => s + b.n, 0), res.m,
                    `${nome}/${q.key}/${k}: as contagens não somam ${res.m}`);
                h.bins.forEach(b => {
                    assert.ok(b.nOut <= b.n, 'marcadas não podem exceder o total da classe');
                    assert.strictEqual(b.idx.length, b.n, 'índices e contagem divergem');
                    assert.ok(b.hi > b.lo, 'classe de largura não positiva');
                });
                // As classes são contíguas e cobrem exatamente [min, max]
                assert.ok(Math.abs(h.bins[0].lo - h.min) < 1e-9, 'a primeira classe não começa no mínimo');
                assert.ok(Math.abs(h.bins[h.bins.length - 1].hi - h.max) < 1e-9, 'a última classe não fecha no máximo');
                for (let i = 1; i < h.bins.length; i++) {
                    assert.ok(Math.abs(h.bins[i].lo - h.bins[i - 1].hi) < 1e-9, 'classes não contíguas');
                }
            }
        });
    });
    ok(`contagens fecham em ${combinacoes} combinações de amostra, grandeza e nº de classes`);

    // A assimetria e a curtose reproduzem o que se mede fora do módulo
    const piso = A.adjustPlane(loadSample('piso_7col.csv'), S);
    const dPiso = Hist.describe(piso.obsData.map(o => o.d * 1000));
    approx(dPiso.assimetria, 1.49, 0.02, `piso: assimetria de d = ${dPiso.assimetria.toFixed(2)}`);
    approx(dPiso.curtose, 5.17, 0.02, `piso: curtose de d = ${dPiso.curtose.toFixed(2)}`);

    const frontal = A.adjustPlane(loadSample('parede_frontal.csv'), S);
    const dFrontal = Hist.describe(frontal.obsData.map(o => o.d * 1000));
    approx(dFrontal.assimetria, 0.32, 0.02, `parede frontal: assimetria = ${dFrontal.assimetria.toFixed(2)}`);
    assert.ok(Math.abs(dFrontal.assimetria) < Math.abs(dPiso.assimetria),
        'a parede frontal tem de ser mais simétrica que o piso');
    ok('o histograma distingue o piso assimétrico da parede quase normal');

    // Sob H0 o resíduo normalizado seria N(0,1); aqui é bem mais largo, e é por isso que o
    // teste global reprova
    const wPiso = Hist.describe(piso.obsData.map(o => o.w));
    assert.ok(wPiso.dp > 2, `desvio de w deveria exceder 1 com folga, deu ${wPiso.dp}`);
    assert.strictEqual(piso.globalPass, false);
    ok(`w do piso tem desvio ${wPiso.dp.toFixed(2)} contra o 1,00 de H0 — o teste global reprova`);
}

{
    // A curva normal é escalada à ÁREA DAS BARRAS: integrá-la tem de devolver n × largura,
    // senão ela não pousa sobre o histograma.
    const n = 50, largura = 0.8, mu = 1.5, sigma = 2.0;
    const x0 = mu - 12 * sigma, x1 = mu + 12 * sigma, passos = 20000;
    const pts = Hist.normalCurve(mu, sigma, n, largura, x0, x1, passos);
    assert.strictEqual(pts.length, passos + 1);
    const h = (x1 - x0) / passos;
    let area = 0;                                   // trapézios
    for (let i = 1; i < pts.length; i++) area += (pts[i].y + pts[i - 1].y) / 2 * h;
    approx(area / (n * largura), 1, 1e-6, 'a área sob a curva normal iguala a área das barras');

    // O pico fica na média e vale n·largura/(σ√2π)
    const pico = pts.reduce((m, p) => p.y > m.y ? p : m);
    approx(pico.x, mu, (x1 - x0) / passos * 2, 'o pico da curva cai na média');
    approx(pico.y, n * largura / (sigma * Math.sqrt(2 * Math.PI)), 1e-6, 'altura do pico');

    // Sigma zero ou n zero não podem gerar NaN na tela
    assert.deepStrictEqual(Hist.normalCurve(0, 0, 10, 1, -1, 1), []);
    assert.deepStrictEqual(Hist.normalCurve(0, 1, 0, 1, -1, 1), []);
    ok('curva normal degenerada devolve vazio em vez de NaN');
}

console.log(`\n${passed} verificações OK\n`);
