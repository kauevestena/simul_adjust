// Testes do simulador de ajustamento de planos.
// Execute com:  node ajusta_planos/test_adjust.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const io = require('./io.js');
const A = require('./adjustment.js');
const { linalg } = A;

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
    'parede_frontal.csv': {
        m: 51, dof: 48, VtPV: 20.686, sigma02: 0.4310,
        Xa: [9.99918489e-01, -1.27306307e-02, -9.72759912e-04, -3.85785009],
        chi2low: 30.755, chi2upp: 69.023, globalPass: false
    }
};

const GAUGES = ['constraint', 'reduction', 'pseudoinverse'];
const HORIZONTAL = { 'piso_7col.csv': true, 'parede_frontal.csv': false };

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
    const ptsW = loadSample('parede_frontal.csv');
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
    const pts = loadSample('parede_frontal.csv');
    const res = A.adjustPlane(pts, S);
    const nrm = A.normalizeParameters(res);
    assert.strictEqual(nrm.classification.tipo, 'vertical');
    ok('parede classificada como vertical');
    assert.ok(nrm.Xn[0] > 0, 'plano vertical deve ter a normal apontando para +X');
    ok('sentido escolhido próximo de +X');
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

console.log(`\n${passed} verificações OK\n`);
