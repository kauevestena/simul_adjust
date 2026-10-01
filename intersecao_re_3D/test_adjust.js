// Testes do simulador de interseção a ré 3D (modelo combinado).
// Execute com:  node intersecao_re_3D/test_adjust.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const io = require('./io.js');
const NA = require('./adjustment.js');
const Report = require('./report.js');
const { linalg, ARCSEC, DEG } = NA;

const SAMPLE = path.join(__dirname, 'inputs', 'observations.csv');
const S = Object.assign({}, io.DEFAULT_SETTINGS);

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }
function approx(actual, expected, tol, label) {
    assert.ok(Math.abs(actual - expected) <= tol,
        `${label}: esperado ${expected}, obtido ${actual} (tol ${tol})`);
    ok(label);
}
function maxAbsDiff(a, b) {
    let m = 0;
    a.forEach((v, i) => {
        if (Array.isArray(v)) m = Math.max(m, maxAbsDiff(v, b[i]));
        else m = Math.max(m, Math.abs(v - b[i]));
    });
    return m;
}

function loadSample() {
    const p = io.parseCSV(fs.readFileSync(SAMPLE, 'utf8'));
    assert.deepStrictEqual(p.errors, []);
    return io.buildRows(p.rows);
}

function synthetic(opts, settings) {
    const g = io.generateSyntheticNetwork(Object.assign({ seed: 42 }, opts), settings || S);
    return Object.assign(g, { rows: io.buildRows(g.rows) });
}

// ---------------------------------------------------------------- leitura do CSV
console.log('\nLeitura do CSV');
{
    const p = io.parseCSV(fs.readFileSync(SAMPLE, 'utf8'));
    assert.deepStrictEqual(p.errors, []);
    assert.strictEqual(p.rows.length, 24);
    ok('amostra: 24 visadas, sem erros');
    const r = p.rows.find(x => x.station === 'B' && x.target === '17');
    assert.ok(r && typeof r.target === 'string', 'nome numérico continua texto');
    ok('nomes numéricos ("17") preservados como texto');
    assert.deepStrictEqual(p.rows.filter(x => x.fixed).map(x => x.target), ['M01', 'M02']);
    assert.ok(p.rows.every(x => x.xyz === null));
    ok('"sim" lido como fixo (M01, M02; M03 é livre); X,Y,Z em branco ficam nulos');
    approx(p.rows.find(x => x.target === '00f' && x.station === 'A').hzDeg, 47.578240740741, 1e-12,
        'leitura A→00f corrigida (face II reduzida)');
}
{
    const txt = 'Estação;Ponto Visado;Leitura Horizontal;Desvio Padrão H;Ângulo Zenital;Desvio Padrão V;' +
        'Distância Inclinada;Desvio Padrão D;Fixo;X;Y;Z\n' +
        'E1;P1;10,5;2;90,1;2;12,345;0,002;True;100,0;200,0;50,0\n' +
        'E1;P2;20,5;;91;;10;;false;;;\n';
    const p = io.parseCSV(txt);
    assert.deepStrictEqual(p.errors, []);
    assert.deepStrictEqual(p.rows[0].xyz, [100, 200, 50]);
    approx(p.rows[0].hzDeg, 10.5, 1e-12, 'separador ";" com vírgula decimal e "Inclinada" com acento');
    assert.strictEqual(p.rows[1].sHz, null);
    assert.strictEqual(p.rows[1].fixed, false);
    ok('desvios em branco ficam nulos; True/false aceitos');
}
{
    const bad = io.parseCSV(io.CANONICAL_HEADER + '\nA,B,1,1,90,1,10,0.001,talvez,,,\nA,C,1,1,90,1,10,0.001,sim,1,2,\n');
    assert.strictEqual(bad.errors.length, 2);
    ok('valor inválido em Fixo e X,Y,Z incompleto são rejeitados');
}

// ---------------------------------------------------------------- jacobianas
console.log('\nJacobianas do modelo combinado (diferenças finitas)');
{
    const L = [1.234, 1.45, 17.3], om = 0.77, st = [1, 2, 3], tg = [9, -4, 2];
    const B = NA.jacobianB(L, om);
    const h = 1e-7;
    let err = 0;
    for (let c = 0; c < 3; c++) {
        const Lp = L.slice(), Lm = L.slice();
        Lp[c] += h; Lm[c] -= h;
        const Fp = NA.conditionF(Lp, st, om, tg), Fm = NA.conditionF(Lm, st, om, tg);
        for (let i = 0; i < 3; i++) err = Math.max(err, Math.abs((Fp[i] - Fm[i]) / (2 * h) - B[i][c]));
    }
    assert.ok(err < 1e-6, `B: erro ${err}`);
    ok(`B = ∂F/∂L confere (erro máx ${err.toExponential(1)})`);
    const wc = NA.omegaColumn(L, om);
    const Fp = NA.conditionF(L, st, om + h, tg), Fm = NA.conditionF(L, st, om - h, tg);
    const e2 = Math.max(...[0, 1, 2].map(i => Math.abs((Fp[i] - Fm[i]) / (2 * h) - wc[i])));
    assert.ok(e2 < 1e-6, `∂F/∂ω: erro ${e2}`);
    ok('∂F/∂ω confere');
}

// ---------------------------------------------------------------- rede sem ruído
console.log('\nRede sintética sem ruído');
{
    const g = synthetic({ noise: false, nStations: 4, nDetail: 10 });
    const res = NA.adjustNetwork(g.rows, Object.assign({}, S, { tolLinMm: 1e-7, tolAngSec: 1e-6 }));
    assert.ok(res.converged);
    let err = 0;
    res.pointResults.forEach(p => {
        const t = p.isStation ? g.truth.stations[p.name].xyz : g.truth.points[p.name];
        err = Math.max(err, Math.hypot(p.xyz[0] - t[0], p.xyz[1] - t[1], p.xyz[2] - t[2]));
        if (p.isStation) {
            const dw = Math.abs(NA.wrapPi(p.omega - g.truth.stations[p.name].omega));
            assert.ok(dw < 1e-10, `ω ${p.name}: ${dw}`);
        }
    });
    assert.ok(err < 1e-8, `erro máximo ${err}`);
    ok(`recupera a verdade (erro máx ${err.toExponential(1)} m) e as orientações`);
    assert.ok(res.VtPV < 1e-12);
    ok(`VᵀPV ≈ 0 (${res.VtPV.toExponential(1)})`);
}

// ---------------------------------------------------------------- oráculo paramétrico
// Gauss-Markov com as equações de observação explícitas Hz = atan2(ΔY,ΔX) - ω, Z = acos(ΔZ/S),
// S = |Δ|. Convergido, o modelo combinado tem de dar exatamente a mesma solução: as duas
// formulações descrevem as mesmas observações e a mesma geometria.
function gaussMarkov(res) {
    const net = res.net;
    const X = res.Xinit.slice();
    const u = net.u;
    const coord = (name, Xv) => {
        const e = net.index.get(name);
        return (e && e.x !== null) ? [Xv[e.x], Xv[e.y], Xv[e.z]] : net.fixedCoords.get(name);
    };
    let A, l, P;
    for (let it = 0; it < 50; it++) {
        A = []; l = []; P = [];
        net.rows.forEach((r, k) => {
            const st = coord(r.station, X), tg = coord(r.target, X);
            const es = net.index.get(r.station), et = net.index.get(r.target);
            const dx = tg[0] - st[0], dy = tg[1] - st[1], dz = tg[2] - st[2];
            const h2 = dx * dx + dy * dy, h = Math.sqrt(h2), s2 = h2 + dz * dz, s = Math.sqrt(s2);
            const om = X[es.w];
            const calc = [Math.atan2(dy, dx) - om, Math.acos(dz / s), s];
            const obs = res.Lb[k];
            const dHz = [-dy / h2, dx / h2, 0];
            const dZen = [dx * dz / (s2 * h), dy * dz / (s2 * h), -h / s2];
            const dS = [dx / s, dy / s, dz / s];
            [dHz, dZen, dS].forEach((d, c) => {
                const row = new Array(u).fill(0);
                if (et && et.x !== null) { row[et.x] += d[0]; row[et.y] += d[1]; row[et.z] += d[2]; }
                if (es.x !== null) { row[es.x] -= d[0]; row[es.y] -= d[1]; row[es.z] -= d[2]; }
                if (c === 0) row[es.w] = -1;
                A.push(row);
                l.push(c === 0 ? NA.wrapPi(obs[c] - calc[c]) : obs[c] - calc[c]);
                P.push(1 / (res.sig[k][c] * res.sig[k][c]));
            });
        });
        const N = linalg.zeros(u, u), U = new Array(u).fill(0);
        A.forEach((row, i) => {
            for (let a = 0; a < u; a++) {
                if (row[a] === 0) continue;
                U[a] += row[a] * P[i] * l[i];
                for (let b = 0; b < u; b++) N[a][b] += row[a] * P[i] * row[b];
            }
        });
        const Ninv = linalg.inv(N);
        const dX = linalg.matvec(Ninv, U);
        dX.forEach((v, i) => { X[i] += v; });
        if (Math.max(...dX.map(Math.abs)) < 1e-13) {
            // resíduos v = f(X) - L no ponto convergido
            const V = l.map(v => -v);
            const VtPV = V.reduce((a, v, i) => a + v * v * P[i], 0);
            return { X, V, VtPV, Q: Ninv };
        }
    }
    throw new Error('Gauss-Markov não convergiu');
}

console.log('\nModelo combinado × paramétrico (rede com ruído)');
{
    const g = synthetic({ noise: true, nStations: 3, nDetail: 8, seed: 7 });
    const res = NA.adjustNetwork(g.rows, Object.assign({}, S, { tolLinMm: 1e-9, tolAngSec: 1e-7 }));
    const gm = gaussMarkov(res);
    const dX = maxAbsDiff(res.Xa.map((v, i) => res.unknowns[i].kind === 'w' ? NA.wrapPi(v) : v),
        gm.X.map((v, i) => res.unknowns[i].kind === 'w' ? NA.wrapPi(v) : v));
    assert.ok(dX < 1e-9, `ΔX = ${dX}`);
    ok(`Xa idêntico (max|ΔX| = ${dX.toExponential(1)})`);
    approx(res.VtPV, gm.VtPV, 1e-9 * Math.max(1, gm.VtPV), `VᵀPV idêntico (${res.VtPV.toFixed(6)})`);
    const vComb = [];
    res.V.forEach(v => vComb.push(...v));
    const dV = maxAbsDiff(vComb, gm.V);
    assert.ok(dV < 1e-10, `ΔV = ${dV}`);
    ok(`resíduos idênticos (max|ΔV| = ${dV.toExponential(1)})`);
    const dQ = maxAbsDiff(res.Ninv, gm.Q) / Math.max(...gm.Q.map(r => Math.max(...r.map(Math.abs))));
    assert.ok(dQ < 1e-7, `ΔQ relativo = ${dQ}`);
    ok(`N⁻¹ idêntica (Δ relativo ${dQ.toExponential(1)})`);
    approx(res.redundancySum, res.dof, 1e-8, `Σr = graus de liberdade (${res.dof})`);
    assert.ok(res.sigma02 > 0.2 && res.sigma02 < 3, `σ̂₀² = ${res.sigma02}`);
    ok(`σ̂₀² compatível com o ruído simulado (${res.sigma02.toFixed(3)})`);

    const F = NA.fullMatrices(res);
    let worst = 0;
    for (let i = 0; i < F.W.length; i++) {
        let s = F.W[i];
        for (let j = 0; j < res.u; j++) s += F.A[i][j] * res.X[j];
        for (let j = 0; j < F.W.length; j++) s += F.B[i][j] * F.V[j];
        worst = Math.max(worst, Math.abs(s));
    }
    assert.ok(worst < 1e-12, `AX + BV + W = ${worst}`);
    ok('equação linearizada AX + BV + W = 0 satisfeita');
    const dqv = Math.max(...res.obsData.map((o, k) => Math.max(...[0, 1, 2].map(c => Math.abs(F.QV[3 * k + c][3 * k + c] - o.qv[c]) / o.sigma[c] ** 2))));
    assert.ok(dqv < 1e-9, `diag Q_V: ${dqv}`);
    ok('diagonal de Q_V da matriz completa = a calculada por visada');
}

// ---------------------------------------------------------------- amostra e datum
console.log('\nAmostra e datum');
{
    const rows = loadSample();
    const res = NA.adjustNetwork(rows, S);
    assert.ok(res.converged);
    assert.strictEqual(res.u, 57);
    assert.strictEqual(res.nEq, 72);
    assert.strictEqual(res.dof, 15);
    ok(`dois fixos bastam: converge em ${res.iterations} iterações; u = 57, 72 equações, 15 graus de liberdade`);
    const A = res.pointResults.find(p => p.name === 'A');
    assert.ok(Math.hypot(...A.xyz) < 1e-6 && Math.abs(NA.wrapPi(A.omega)) < 1e-9);
    ok('estação A no datum assumido (0, 0, 0; ω = 0)');
    const free = res.obsData.filter(o => o.r.every(x => x <= 1e-6)).map(o => o.row.target).sort();
    assert.deepStrictEqual(free, ['00c', '03a', '30', '33', '34', '36', '39', 'M03']);
    ok('pontos irradiados de uma só estação têm r = 0 e são avisados');
    assert.ok(res.log.some(l => l.msg.includes('irradiados de A')));
    ok('aplicação do datum registrada no log');

    const moved = NA.adjustNetwork(rows, Object.assign({}, S, { datumX: 1000, datumY: 2000, datumZ: 100 }));
    const dxB = moved.pointResults.find(p => p.name === 'B').xyz.map((v, i) => v - res.pointResults.find(p => p.name === 'B').xyz[i]);
    assert.ok(Math.abs(dxB[0] - 1000) < 1e-6 && Math.abs(dxB[1] - 2000) < 1e-6 && Math.abs(dxB[2] - 100) < 1e-6);
    approx(moved.VtPV, res.VtPV, 1e-6, 'trocar o datum translada a rede e não muda VᵀPV');
}
{
    const g = synthetic({ noise: true, seed: 3 });
    const rows = g.rows;
    // M01 sem coordenadas, visado só de E1: E1 é posicionada por resseção em M02, M03
    rows.filter(r => r.target === 'M01').forEach(r => { r.xyz = null; });
    const res = NA.adjustNetwork(rows, S);
    const m01 = res.pointResults.find(p => p.name === 'M01');
    const t = g.truth.points.M01;
    const d = Math.hypot(m01.xyz[0] - t[0], m01.xyz[1] - t[1], m01.xyz[2] - t[2]);
    assert.ok(d < 0.01, `M01 a ${d} m da verdade`);
    assert.ok(res.net.datum.origins[0].method === 'resseção');
    ok(`fixo sem X,Y,Z irradiado de E1 posicionada por resseção (${(d * 1000).toFixed(2)} mm da verdade)`);

    // Agora visado também de E2: não há como escolher a origem
    const st2 = rows.find(r => r.station === 'E2');
    const extra = Object.assign({}, rows.find(r => r.target === 'M01'), { station: 'E2', idx: rows.length, id: 'E2→M01' });
    extra.hzDeg = st2.hzDeg;
    assert.throws(() => NA.adjustNetwork(rows.concat([extra]), S), /mais de uma estação/);
    ok('fixo sem coordenadas visado de duas estações é rejeitado');
}
{
    const g = synthetic({ noise: false, withCoords: false, seed: 11 });
    const res = NA.adjustNetwork(g.rows, S);
    assert.ok(res.converged && res.net.datum.origins[0].method === 'datum assumido');
    ok('rede sintética sem coordenadas: datum assumido na estação de origem');
}
{
    const rows = loadSample();
    rows.find(r => r.id === 'A→00f').hzDeg = 227.578240740741;
    const res = NA.adjustNetwork(rows, S);
    assert.ok(res.log.some(l => l.level === 'aviso' && l.msg.includes('180°') && l.msg.includes('A→00f')));
    ok('leitura com 180° de erro é apontada já nas aproximações');
}
{
    const rows = loadSample();
    // B passa a ver só um ponto conhecido (00f): sem resseção possível, embora gl > 0
    rows.filter(r => r.station === 'B' && ['00d', '00e'].includes(r.target)).forEach(r => { r.active = false; });
    assert.throws(() => NA.adjustNetwork(rows, S), /aproximações para as estações B/);
    ok('estação sem pontos conhecidos suficientes gera erro explicativo');
}

// ---------------------------------------------------------------- outliers
console.log('\nDetecção de outliers');
{
    const g = synthetic({ noise: true, nStations: 3, nDetail: 4, linksPerPair: 4, seed: 5 });
    const rows = g.rows;
    const base = NA.adjustNetwork(rows, S);
    // Erro de 40σ na distância de uma visada bem controlada
    const target = base.obsData.slice().sort((a, b) => b.r[2] - a.r[2])[0];
    const row = rows[target.row.idx];
    io.injectBlunder(row, 'dist', 40, target.sigma[2], 1);
    const res = NA.adjustNetwork(rows, S);
    assert.ok(!res.globalPass);
    ok('teste global reprova com o erro injetado');
    const sn = NA.detectDataSnooping(rows, S);
    assert.strictEqual(sn.flagged[0], row.idx);
    assert.ok(rows.every(r => r.active), 'estado das linhas restaurado');
    ok(`data snooping aponta ${row.id} primeiro e restaura as linhas`);
    const ks = NA.detectSigmaRule(res, S);
    assert.ok(ks.flagged.includes(row.idx));
    ok('regra kσ marca a visada');
    const tau = NA.detectPope(res, S);
    assert.ok(tau.flagged.includes(row.idx));
    ok('teste τ de Pope marca a visada');
}

{
    // Na amostra o snooping chega a uma visada essencial (sem ela C perde a resseção):
    // ela não pode ser marcada, senão "desativar marcadas" deixaria a rede sem solução
    const rows = loadSample();
    const sn = NA.detectDataSnooping(rows, S);
    assert.ok(sn.essential.length >= 1 && /visada essencial/.test(sn.detail), sn.detail);
    sn.flagged.forEach(i => { rows[i].active = false; });
    const res = NA.adjustNetwork(rows, S);
    assert.ok(res.converged);
    ok(`snooping na amostra marca ${sn.flagged.map(i => rows[i].id).join(', ')} e poupa a essencial ${sn.essential.map(c => c.id).join(', ')}`);
}

// ---------------------------------------------------------------- elipsoides
console.log('\nElipsoides e elipses');
{
    const R = io.seededRandom(9);
    for (let trial = 0; trial < 20; trial++) {
        const G = [0, 1, 2].map(() => [0, 1, 2].map(() => R() - 0.5));
        const Sig = linalg.matmul(G, linalg.transpose(G));
        for (let i = 0; i < 3; i++) Sig[i][i] += 0.01;
        const k = 2.5;
        const el3 = NA.ellipsoid3D(Sig, k);
        // Q = R diag(axes²) Rᵀ deve reconstruir k² Σ
        const D = el3.axesAsc.map(a => a * a);
        const back = linalg.matmul(linalg.matmul(el3.R, [[D[0], 0, 0], [0, D[1], 0], [0, 0, D[2]]]), linalg.transpose(el3.R));
        assert.ok(maxAbsDiff(back, linalg.scale(Sig, k * k)) < 1e-10);
        // Sombra no plano XZ = elipse do bloco marginal
        const pair = [0, 2];
        const S2 = pair.map(a => pair.map(b => Sig[a][b]));
        const el2 = NA.ellipse2D(S2, k);
        for (let t = 0; t < 12; t++) {
            const ang = t * Math.PI / 6;
            const d3 = [Math.cos(ang), 0, Math.sin(ang)];
            const sup3 = k * Math.sqrt(linalg.dot(d3, linalg.matvec(Sig, d3)));
            const c = Math.cos(ang - el2.theta), s = Math.sin(ang - el2.theta);
            const sup2 = Math.sqrt(el2.a * el2.a * c * c + el2.b * el2.b * s * s);
            assert.ok(Math.abs(sup3 - sup2) < 1e-10, `suporte ${sup3} × ${sup2}`);
        }
        assert.ok(Math.abs(linalg.rightHanded(el3.R)[0][0] - el3.R[0][0]) < 1e-15);
    }
    ok('elipsoide reconstrói k²Σ com rotação de mão direita');
    ok('elipse marginal = contorno da sombra do elipsoide (função suporte)');
    approx(NA.confidenceK('95', 3), 2.7955, 1e-3, 'k(95%, 3D) = 2,796');
    approx(NA.confidenceK('95', 2), 2.4477, 1e-3, 'k(95%, 2D) = 2,448');
}

// ---------------------------------------------------------------- saídas
console.log('\nSaídas');
{
    const rows = loadSample();
    const res = NA.adjustNetwork(rows, S);
    const coords = io.coordinatesToCSV(res).trim().split('\n');
    assert.strictEqual(coords.length, 1 + res.pointResults.length);
    assert.ok(coords.some(l => l.startsWith('B,estação,')));
    ok(`CSV de coordenadas: ${res.pointResults.length} pontos`);
    const resid = io.residualsToCSV(res, rows).trim().split('\n');
    assert.strictEqual(resid.length, 1 + rows.length);
    assert.strictEqual(resid[0].split(',').length, 4 + 15);
    ok('CSV de resíduos: uma linha por visada, 19 colunas');
    const parsedBack = io.parseCSV(io.rowsToCSV(rows));
    assert.deepStrictEqual(parsedBack.errors, []);
    approx(maxAbsDiff(parsedBack.rows.map(r => [r.hzDeg, r.zenDeg, r.dist]), rows.map(r => [r.hzDeg, r.zenDeg, r.dist])), 0, 1e-9,
        'exportar e reler as observações preserva os valores');

    const model = Report.buildReportModel(res, { rows, origin: 'observations.csv', detection: null, settings: S });
    assert.strictEqual(model.iterations.rows.length, res.iterations);
    assert.ok(model.summary.some(([k, v]) => k.includes('Convergência') && v.includes('sim')));
    assert.ok(model.warnings.length === res.log.length);
    assert.strictEqual(model.coordinates.rows.length, res.pointResults.length);
    ok('modelo do relatório: iterações, convergência, avisos e coordenadas');
    const txt = Report.renderText(model);
    assert.ok(txt.includes('ITERAÇÕES') && txt.includes('AVISOS'));
    ok('relatório em texto (alternativa sem jsPDF) gerado');
}

console.log(`\n${passed} verificações aprovadas.\n`);
