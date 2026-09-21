// Testes da estimativa de volume a partir das seis faces.
// Execute com:  node ajusta_planos/test_volume.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const io = require('./io.js');
const A = require('./adjustment.js');
const Vol = require('./volume.js');
const { linalg } = A;

const SAMPLES = path.join(__dirname, 'samples');
const S = Object.assign({}, io.DEFAULT_SETTINGS, { gauge: 'constraint' });

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }
function approx(actual, expected, tol, label) {
    assert.ok(Math.abs(actual - expected) <= tol,
        `${label}: esperado ${expected}, obtido ${actual} (tol ${tol})`);
    ok(label);
}

// Volume a partir de uma lista de planos, refazendo o pareamento
function volumeDe(planos) {
    const { pairs } = Vol.pairFaces(planos);
    return Vol.buildRoom(planos, pairs).volume;
}

// Jacobiana por diferenças finitas, para conferir a analítica
function jacobianaNumerica(planos) {
    const { pairs } = Vol.pairFaces(planos);
    const J = [];
    for (let p = 0; p < planos.length; p++) {
        for (let c = 0; c < 4; c++) {
            const h = 1e-7 * Math.max(1, Math.abs(planos[p][c]));
            const mais = planos.map(r => r.slice()), menos = planos.map(r => r.slice());
            mais[p][c] += h; menos[p][c] -= h;
            J.push((Vol.buildRoom(mais, pairs).volume - Vol.buildRoom(menos, pairs).volume) / (2 * h));
        }
    }
    return J;
}

function erroRelativoMax(a, b) {
    let num = 0, den = 0;
    for (let i = 0; i < a.length; i++) {
        num = Math.max(num, Math.abs(a[i] - b[i]));
        den = Math.max(den, Math.abs(b[i]));
    }
    return den > 0 ? num / den : num;
}

// ---------------------------------------------------------------- distribuição t
console.log('\nDistribuição t de Student');
{
    // Quantis publicados em tábuas
    [[0.975, 10, 2.228139], [0.975, 30, 2.042272], [0.995, 10, 3.169273],
     [0.95, 5, 2.015048], [0.975, 1, 12.706205], [0.975, 100, 1.983972]]
        .forEach(([p, dof, esperado]) => {
            approx(A.tInv(p, dof), esperado, 1e-5, `t(${p}, ${dof}) = ${esperado}`);
        });

    // Com muitos graus de liberdade a t vira a normal
    approx(A.tInv(0.975, 1e8), A.normInv(0.975), 1e-6, 't converge para z quando dof → ∞');

    // CDF e quantil são inversas
    approx(A.tCDF(A.tInv(0.83, 17), 17), 0.83, 1e-9, 'tCDF e tInv são inversas');
    approx(A.tCDF(0, 7), 0.5, 1e-12, 'tCDF(0) = 0,5 (simetria)');
}

// ---------------------------------------------------------------- geometria exata
console.log('\nGeometria: caixas de volume conhecido');
{
    // Cubo unitário: seis planos analíticos
    const cubo = [[1, 0, 0, 0], [1, 0, 0, -1], [0, 1, 0, 0], [0, 1, 0, -1], [0, 0, 1, 0], [0, 0, 1, -1]];
    approx(volumeDe(cubo), 1, 1e-12, 'cubo unitário: V = 1');

    const { pairs } = Vol.pairFaces(cubo);
    const chaves = pairs.map(p => p.slice().sort((a, b) => a - b).join(''))
        .sort().join(' ');
    assert.strictEqual(chaves, '01 23 45', `pares do cubo: ${chaves}`);
    ok('pareamento do cubo acha as faces opostas');

    // Caixa a×b×c girada e transladada: o volume não pode depender da pose
    const [a, b, c] = [2.5, 4.0, 3.25];
    const ang = [0.4, -0.7, 1.1];
    const Rx = [[1, 0, 0], [0, Math.cos(ang[0]), -Math.sin(ang[0])], [0, Math.sin(ang[0]), Math.cos(ang[0])]];
    const Ry = [[Math.cos(ang[1]), 0, Math.sin(ang[1])], [0, 1, 0], [-Math.sin(ang[1]), 0, Math.cos(ang[1])]];
    const Rz = [[Math.cos(ang[2]), -Math.sin(ang[2]), 0], [Math.sin(ang[2]), Math.cos(ang[2]), 0], [0, 0, 1]];
    const R = linalg.matmul(Rz, linalg.matmul(Ry, Rx));
    const t = [3.7, -2.1, 0.9];
    // n·x + d = 0 vira (Rn)·x' + (d - (Rn)·t) = 0
    const caixa = [[1, 0, 0, 0], [1, 0, 0, -a], [0, 1, 0, 0], [0, 1, 0, -b], [0, 0, 1, 0], [0, 0, 1, -c]]
        .map(p => {
            const n = linalg.matvec(R, [p[0], p[1], p[2]]);
            return [n[0], n[1], n[2], p[3] - linalg.dot(n, t)];
        });
    approx(volumeDe(caixa), a * b * c, 1e-10, `caixa girada ${a}×${b}×${c}: V = ${(a * b * c).toFixed(3)}`);

    // O produto das três separações é exato quando a caixa é perfeita
    const pc = Vol.pairFaces(caixa);
    approx(Vol.naiveBox(caixa, pc.pairs), a * b * c, 1e-10, 'caixa perfeita: produto das separações = V');

    // Paralelismo e ortogonalidade perfeitos
    pc.paralelismo.forEach(p => assert.ok(p.graus < 1e-9, `paralelismo ${p.graus}`));
    pc.ortogonalidade.forEach(o => assert.ok(Math.abs(o.graus) < 1e-9, `ortogonalidade ${o.graus}`));
    ok('caixa girada: paralelismo e ortogonalidade exatos');
}

// ---------------------------------------------------------------- invariâncias
console.log('\nInvariâncias da fórmula');
{
    const cubo = [[1, 0, 0, 0], [1, 0, 0, -1], [0, 1, 0, 0], [0, 1, 0, -1], [0, 0, 1, 0], [0, 0, 1, -1]];
    const base = volumeDe(cubo);

    // Multiplicar os parâmetros de uma face por k não move o plano: o volume é o mesmo.
    // Vale inclusive para k < 0, que inverte o sentido da normal.
    [2, -3, 0.25, -0.5].forEach(k => {
        const mexido = cubo.map((p, i) => i === 3 ? p.map(v => v * k) : p.slice());
        approx(volumeDe(mexido), base, 1e-12, `volume invariante a escalar uma face por ${k}`);
    });

    // A ordem em que as seis faces são entregues não pode importar
    const perm = [4, 0, 5, 2, 3, 1];
    approx(volumeDe(perm.map(i => cubo[i])), base, 1e-12, 'volume invariante à ordem das faces');
}

// ---------------------------------------------------------------- jacobiana
console.log('\nJacobiana analítica');
{
    // Caixa irregular: nenhuma face exatamente paralela, para não cair num caso fácil
    const irregular = [
        [1, 0.02, -0.01, 0], [0.99, -0.03, 0.02, -2.4],
        [0.01, 1, 0.03, 0.2], [-0.02, 0.98, -0.01, -3.1],
        [0.03, -0.01, 1, 0.1], [-0.01, 0.02, 1.01, -2.8]
    ];
    const { pairs } = Vol.pairFaces(irregular);
    const { J } = Vol.jacobian(irregular, pairs);
    const Jn = jacobianaNumerica(irregular);
    approx(erroRelativoMax(J, Jn), 0, 1e-6, 'caixa irregular: analítica bate com diferenças finitas');

    // Invariância de gauge: a derivada ao longo da direção de escala de cada face é nula,
    // porque esticar os parâmetros não move o plano. É o que torna inofensivo o posto 3 de Σ.
    let pior = 0, escala = Math.max(...J.map(Math.abs));
    for (let p = 0; p < 6; p++) {
        let s = 0;
        for (let c = 0; c < 4; c++) s += J[4 * p + c] * irregular[p][c];
        pior = Math.max(pior, Math.abs(s));
    }
    approx(pior / escala, 0, 1e-12, 'J·X = 0 em cada face (direção de escala no núcleo)');
}

// ---------------------------------------------------------------- dados reais
console.log('\nAs seis amostras reais');
{
    const faces = Vol.SLOTS.map(slot => {
        const { rows, errors } = io.parseCSV(fs.readFileSync(path.join(SAMPLES, slot.sample), 'utf8'));
        assert.strictEqual(errors.length, 0, `${slot.sample}: ${errors.join(' | ')}`);
        const pts = io.buildPoints(rows, S);
        const res = A.adjustPlane(pts, S);
        assert.strictEqual(res.gauge, 'constraint', 'a página de volume fixa a injunção unitária');
        const nrm = A.normalizeParameters(res);
        return { pts, X: nrm.Xn, Sigma: nrm.SigmaXn, dof: res.dof, m: res.m, sigma02: res.sigma02 };
    });

    // Pareamento: os nomes enganam — a frontal (−Y) opõe a direita (+Y)
    const par = Vol.pairFaces(faces.map(f => f.X));
    const nomes = par.pairs.map(([i, j]) => [Vol.SLOTS[i].key, Vol.SLOTS[j].key].sort().join('+')).sort();
    assert.deepStrictEqual(nomes, ['direita+frontal', 'esquerda+traseira', 'piso+teto'], nomes.join(' '));
    ok('pares achados pelas normais: frontal↔direita, traseira↔esquerda, piso↔teto');
    par.paralelismo.forEach(p => assert.ok(p.graus < 1,
        `faces opostas deveriam ser quase paralelas, obtido ${p.graus}°`));
    ok(`paralelismo das opostas dentro de 1° (máx ${Math.max(...par.paralelismo.map(p => p.graus)).toFixed(3)}°)`);

    const est = Vol.estimate(faces);
    approx(est.volume, 271.3049, 1e-3, `volume = ${est.volume.toFixed(4)} m³`);
    approx(est.propagacao.sigma, 0.0849, 1e-3, `σ_V = ${est.propagacao.sigma.toFixed(4)} m³`);
    approx(est.caixaIngenua, 271.3384, 1e-3, 'produto ingênuo das três separações');
    assert.ok(Math.abs(est.volume - est.caixaIngenua) > 0.01,
        'o poliedro exato deve diferir do produto ingênuo — a sala não é uma caixa perfeita');
    ok(`poliedro difere do produto ingênuo em ${(est.caixaIngenua - est.volume).toFixed(4)} m³`);

    // A jacobiana nos dados reais também tem de bater com diferenças finitas
    approx(erroRelativoMax(est.J, jacobianaNumerica(faces.map(f => f.X))), 0, 1e-6,
        'dados reais: jacobiana analítica bate com diferenças finitas');

    // Graus de liberdade efetivos: somar os seis seria errado
    const somaGl = faces.reduce((s, f) => s + f.dof, 0);
    assert.strictEqual(somaGl, 227, `soma dos gl = ${somaGl}`);
    approx(est.propagacao.nuEf, 81.7, 0.5, `gl efetivo (Welch-Satterthwaite) = ${est.propagacao.nuEf.toFixed(1)}`);
    assert.ok(est.propagacao.nuEf < somaGl / 2,
        'o gl efetivo tem de ficar bem abaixo da soma: uma face domina a variância');
    ok('gl efetivo bem abaixo da soma ingênua, como manda o peso desigual das faces');

    // O teto é a pior superfície e por isso domina a variância
    const iTeto = Vol.SLOTS.findIndex(s => s.key === 'teto');
    const maior = est.propagacao.fracoes.indexOf(Math.max(...est.propagacao.fracoes));
    assert.strictEqual(maior, iTeto, 'a maior contribuição deveria vir do teto');
    approx(est.propagacao.fracoes[iTeto], 0.538, 0.02, 'teto responde por ~54% da variância');
    approx(est.propagacao.fracoes.reduce((s, f) => s + f, 0), 1, 1e-12, 'as frações somam 1');

    // Intervalos: t sempre mais largo que z, e ambos crescendo com a confiança
    est.intervalos.forEach(iv => {
        assert.ok(iv.t > iv.z, `t deveria exceder z em α=${iv.alpha}%`);
        approx(iv.z_hi - iv.z_lo, 2 * iv.z * est.propagacao.sigma, 1e-12,
            `α=${iv.alpha}% → confiança ${iv.confianca}%: largura do intervalo normal`);
    });
    const margens = est.intervalos.map(iv => iv.margemZ);
    assert.ok(margens[0] > margens[1] && margens[1] > margens[2],
        'margem tem de encolher de 99% para 90%');
    ok(`margens z: ±${margens.map(m => m.toFixed(4)).join(' / ±')} m³ (99/95/90%)`);

    // O volume verdadeiro tem de cair dentro de todos os intervalos por construção
    est.intervalos.forEach(iv => {
        assert.ok(est.volume > iv.t_lo && est.volume < iv.t_hi, 'volume dentro do intervalo t');
    });
    ok('o volume estimado fica no centro dos seis intervalos');

    // Conferências geométricas sobre as nuvens: todas devem passar nas amostras
    const chk = Vol.geometryChecks(faces.map(f => f.pts.map(p => p.xyz)));
    const falhas = chk.itens.filter(i => !i.ok);
    assert.strictEqual(falhas.length, 0,
        'conferências que falharam: ' + falhas.map(f => f.titulo).join(', '));
    ok(`as ${chk.itens.length} conferências geométricas passam nas amostras`);

    // Trocar piso por teto NÃO dispara aviso, e não deveria mesmo: os dois são horizontais e
    // formam o mesmo par, então a troca é indetectável — e inofensiva, o volume não muda.
    const pisoTeto = [0, 1, 2, 3, 5, 4];
    const chkPT = Vol.geometryChecks(pisoTeto.map(i => faces[i].pts.map(p => p.xyz)));
    assert.ok(chkPT.itens.every(i => i.ok), 'trocar piso por teto não deveria acusar nada');
    approx(volumeDe(pisoTeto.map(i => faces[i].X)), est.volume, 1e-9,
        'trocar piso por teto não muda o volume');

    // Já pôr uma parede no slot do piso tem de ser acusado
    const paredeNoPiso = [4, 1, 2, 3, 0, 5];
    const chkPP = Vol.geometryChecks(paredeNoPiso.map(i => faces[i].pts.map(p => p.xyz)));
    const acusados = chkPP.itens.filter(i => !i.ok);
    assert.ok(acusados.length >= 2,
        `trocar uma parede com o piso deveria acusar, acusou ${acusados.length}`);
    ok(`parede no slot do piso: ${acusados.length} conferências acusam a troca`);
}

console.log(`\n${passed} verificações OK\n`);
