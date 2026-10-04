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

// ---------------------------------------------------------------- modelos e datum
console.log('\nModelos (combinado × paramétrico) e datum (fixos × livre)');
const TIGHT = { tolLinMm: 1e-9, tolAngSec: 1e-7 };
const withModel = (model, datum, extra) => Object.assign({}, S, TIGHT, { model, datum }, extra || {});
function maxUnknownDiff(a, b) {
    let m = 0;
    a.Xa.forEach((v, i) => {
        const dv = v - b.Xa[i];
        m = Math.max(m, Math.abs(a.unknowns[i].kind === 'w' ? NA.wrapPi(dv) : dv));
    });
    return m;
}
function flatV(res) { const out = []; res.V.forEach(v => out.push(...v)); return out; }
{
    const g = synthetic({ noise: true, nStations: 3, nDetail: 8, seed: 21 });
    ['fixos', 'livre', 'minimo'].forEach(datum => {
        const c = NA.adjustNetwork(g.rows, withModel('combinado', datum));
        const p = NA.adjustNetwork(g.rows, withModel('parametrico', datum));
        assert.strictEqual(c.u, p.u);
        const dX = maxUnknownDiff(c, p);
        assert.ok(dX < 1e-9, `${datum}: ΔX ${dX}`);
        const dV = maxAbsDiff(flatV(c), flatV(p));
        assert.ok(dV < 1e-10, `${datum}: ΔV ${dV}`);
        const qMax = Math.max(...c.Ninv.map(r => Math.max(...r.map(Math.abs))));
        const dQ = maxAbsDiff(c.Ninv, p.Ninv) / qMax;
        assert.ok(dQ < 1e-7, `${datum}: ΔQ ${dQ}`);
        approx(c.VtPV, p.VtPV, 1e-9 * Math.max(1, c.VtPV), `${datum}: paramétrico ≡ combinado (ΔX ${dX.toExponential(1)}, ΔV ${dV.toExponential(1)}, ΔQ ${dQ.toExponential(1)})`);
    });

    const pl = NA.adjustNetwork(g.rows, withModel('parametrico', 'livre'));
    const pf = NA.adjustNetwork(g.rows, withModel('parametrico', 'fixos'));
    assert.strictEqual(pl.d, 4);
    assert.strictEqual(pl.u, pf.u + 3 * g.fixedNames.length);
    assert.strictEqual(pl.dof, pl.nEq - pl.u + 4);
    approx(pl.redundancySum, pl.dof, 1e-6, `rede livre: gl = n − u + 4 = ${pl.dof} = Σr`);

    // Q é a inversa generalizada das injunções: GᵀQ = 0 e QNQ = Q
    const G = pl.G, Q = pl.Ninv;
    const qMax = Math.max(...Q.map(r => Math.max(...r.map(Math.abs))));
    let gq = 0;
    for (let k = 0; k < 4; k++) for (let j = 0; j < pl.u; j++) {
        let s = 0;
        for (let i = 0; i < pl.u; i++) s += G[i][k] * Q[i][j];
        gq = Math.max(gq, Math.abs(s));
    }
    assert.ok(gq / qMax < 1e-9, `GᵀQ ${gq / qMax}`);
    const QNQ = linalg.matmul(linalg.matmul(Q, pl.N), Q);
    assert.ok(maxAbsDiff(QNQ, Q) / qMax < 1e-8);
    ok('GᵀQ = 0 e QNQ = Q (inversa generalizada pelo sistema orlado)');

    const ev = pl.eigN.map(Math.abs).sort((a, b) => a - b);
    assert.ok(ev[3] < 1e-12 * ev[ev.length - 1] && ev[4] > 1e-9 * ev[ev.length - 1], `autovalores ${ev.slice(0, 6)}`);
    ok('N do paramétrico livre tem exatamente 4 autovalores nulos (defeito de posto)');

    // Traço mínimo: qualquer outro datum (transformação S) tem traço maior nas coordenadas,
    // com a mesma NQN = N
    const H = NA.nullSpace(pl.net, pl.Xa, true);
    const Gp = H.map((row, i) => {
        const un = pl.unknowns[i];
        return ['E1', 'E2', 'M01'].includes(un.point) && un.kind !== 'w' ? row.slice() : [0, 0, 0, 0];
    });
    const GtH = linalg.matmul(linalg.transpose(Gp), H);
    const Ssh = linalg.identity(pl.u).map((row, i) => row.map((v, j) => {
        let s = 0;
        const T = linalg.matmul(H, linalg.inv(GtH));
        for (let k = 0; k < 4; k++) s += T[i][k] * Gp[j][k];
        return v - s;
    }));
    const Qp = linalg.matmul(linalg.matmul(Ssh, Q), linalg.transpose(Ssh));
    const trace = M => pl.unknowns.reduce((a, un, i) => a + (un.kind === 'w' ? 0 : M[i][i]), 0);
    assert.ok(trace(Q) < trace(Qp), `traço ${trace(Q)} × ${trace(Qp)}`);
    const NQN = linalg.matmul(linalg.matmul(pl.N, Qp), pl.N);
    const nMax = Math.max(...pl.N.map(r => Math.max(...r.map(Math.abs))));
    assert.ok(maxAbsDiff(NQN, pl.N) / nMax < 1e-6);
    ok(`traço mínimo: ${(trace(Q) * 1e6).toFixed(2)} mm² contra ${(trace(Qp) * 1e6).toFixed(2)} mm² com datum em E1, E2, M01`);
}
{
    const g = synthetic({ noise: false, nStations: 4, nDetail: 10, seed: 4 });
    const res = NA.adjustNetwork(g.rows, withModel('combinado', 'livre'));
    const truthOf = p => p.isStation ? g.truth.stations[p.name].xyz : g.truth.points[p.name];
    let err = 0;
    const P = res.pointResults;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i].xyz, b = P[j].xyz, ta = truthOf(P[i]), tb = truthOf(P[j]);
        err = Math.max(err, Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - Math.hypot(ta[0] - tb[0], ta[1] - tb[1], ta[2] - tb[2])));
    }
    assert.ok(err < 1e-8, `distâncias: ${err}`);
    ok(`rede livre sem ruído recupera a forma: todas as distâncias entre pontos (erro máx ${err.toExponential(1)} m)`);
}
{
    // Sem nenhum ponto fixo: só a rede livre resolve
    const rows = loadSample();
    rows.forEach(r => { r.fixed = false; });
    assert.throws(() => NA.adjustNetwork(rows, S), /Nenhum ponto fixo/);
    const res = NA.adjustNetwork(rows, Object.assign({}, S, { datum: 'livre' }));
    assert.ok(res.converged && res.net.seedPoses.length === 1 && res.log.some(l => /partem de A/.test(l.msg)));
    ok('sem pontos fixos: datum por pontos fixos recusa, rede livre resolve a partir de A');
    const one = loadSample();
    one.filter(r => r.target === 'M02').forEach(r => { r.fixed = false; });
    assert.throws(() => NA.adjustNetwork(one, S), /Só um ponto fixo/);
    ok('um único ponto fixo é recusado (falta a rotação em torno da vertical)');
}
{
    // Amostra: os fixos vêm das próprias visadas de A, então não tensionam a rede
    const fx = NA.adjustNetwork(loadSample(), S);
    const lv = NA.adjustNetwork(loadSample(), Object.assign({}, S, { datum: 'livre' }));
    assert.strictEqual(fx.dof, 15);
    assert.strictEqual(lv.dof, 13);
    approx(lv.VtPV, fx.VtPV, 1e-6, `amostra: VᵀPV igual nos dois datums (${fx.VtPV.toFixed(3)}), gl 15 × 13`);
    const m01 = lv.pointResults.find(p => p.name === 'M01');
    assert.ok(m01.support && m01.tipo === 'apoio (livre)' && m01.sigma[0] > 0 && m01.ellipsoid);
    ok('na rede livre M01 é ponto de apoio com σ e elipsoide');
    const cmp = NA.compareModels(loadSample(), S);
    assert.ok(cmp.runs.every(r => r.res), cmp.runs.map(r => r.error).join(' | '));
    assert.ok(cmp.runs.every(r => !r.dModel || (r.dModel.lin < 1e-8 && r.dModel.ang < 1e-9)));
    assert.ok(cmp.runs.slice(1).every(r => r.dV.lin < 1e-7 && r.dDist < 1e-7));
    assert.ok(cmp.compat.every(c => c.applicable && Math.abs(c.dV) < 1e-6 && c.pass && c.ddof === 2));
    ok('compareModels: 4 variantes, modelos iguais, resíduos e forma invariantes, ΔVᵀPV = 0 com 2 graus');
}
{
    // Fixo deslocado 3 cm: a compatibilidade dos pontos fixos reprova
    const g = synthetic({ noise: true, seed: 8 });
    const ok0 = NA.compareModels(g.rows, S).compat[0];
    assert.ok(ok0.applicable && ok0.pass, JSON.stringify(ok0));
    g.rows.filter(r => r.target === 'M02').forEach(r => { r.xyz[0] += 0.03; });
    const bad = NA.compareModels(g.rows, S).compat[0];
    assert.ok(bad.applicable && !bad.pass && bad.dV > bad.crit, JSON.stringify(bad));
    ok(`teste de compatibilidade dos fixos: aprova os verdadeiros (ΔVᵀPV ${ok0.dV.toFixed(2)}) e reprova M02 deslocado 3 cm (${bad.dV.toFixed(0)} > ${bad.crit.toFixed(2)})`);
}
{
    const rows = loadSample();
    const model = Report.buildReportModel(NA.adjustNetwork(rows, Object.assign({}, S, { model: 'parametrico', datum: 'livre' })),
        { rows, origin: 'x', detection: null, settings: S });
    const kv = new Map(model.summary);
    assert.ok(/Paramétrico/.test(kv.get('Modelo')) && /rede livre/.test(kv.get('Datum')) && /\+ 4/.test(kv.get('Graus de liberdade')));
    ok('relatório: modelo, datum e gl = n − u + d');
}

// ---------------------------------------------------------------- injunções mínimas
console.log('\nInjunções mínimas (estação de origem: X, Y, Z e ω constantes)');
// tolerâncias apertadas: os datums só concordam em r, V e σ de grandezas estimáveis no mesmo ponto de linearização
const MIN = Object.assign({}, S, TIGHT, { datum: 'minimo' });
const LIVRE = Object.assign({}, S, TIGHT, { datum: 'livre' });
{
    const rows = loadSample();
    const res = NA.adjustNetwork(rows, MIN);
    assert.ok(res.converged);
    assert.strictEqual(res.datum, 'minimo');
    assert.strictEqual(res.d, 0);
    assert.strictEqual(res.nEq, 72);
    assert.strictEqual(res.u, 59);
    assert.strictEqual(res.dof, 13);
    ok('amostra: u = 57 − 4 + 6 = 59, 72 equações, defeito de posto 0, 13 graus de liberdade');

    const A = res.pointResults.find(p => p.name === 'A');
    assert.ok(Math.hypot(...A.xyz) === 0 && A.omega === 0 && A.sigmaOmega === 0 && A.fixed && A.ellipsoid === null);
    assert.ok(A.sigma.every(v => v === 0) && A.tipo === 'estação (origem)' && A.origem === 'datum assumido');
    assert.ok(!res.unknowns.some(un => un.point === 'A'));
    ok('estação A (origem) é constante: (0, 0, 0), ω = 0, sem incógnitas, σ = 0 e sem elipsoide');
    const m01 = res.pointResults.find(p => p.name === 'M01');
    assert.ok(!m01.fixed && m01.support && m01.tipo === 'apoio (livre)' && m01.sigma[0] > 0 && m01.ellipsoid);
    ok('M01 e M02 viram incógnitas comuns (apoio livre), com σ e elipsoide');

    // N de posto completo: nenhum autovalor nulo
    const ev = res.eigN.map(Math.abs).sort((a, b) => a - b);
    assert.ok(ev[0] > 1e-9 * ev[ev.length - 1], `λmin ${ev[0]}`);
    ok(`N tem posto completo (λmin/λmax = ${(ev[0] / ev[ev.length - 1]).toExponential(1)}): 4 injunções bastam`);
    approx(res.redundancySum, res.dof, 1e-6, 'Σr = gl = 13');

    // Mesmos resíduos, VᵀPV, redundâncias e forma da rede que a rede livre e os pontos fixos
    const lv = NA.adjustNetwork(rows, LIVRE);
    const fx = NA.adjustNetwork(rows, Object.assign({}, S, TIGHT));
    approx(res.VtPV, lv.VtPV, 1e-6, `VᵀPV igual à da rede livre (${res.VtPV.toFixed(3)})`);
    approx(res.VtPV, fx.VtPV, 1e-6, 'VᵀPV igual à dos pontos fixos (os fixos vêm das visadas de A: ΔVᵀPV = 0)');
    const dV = maxAbsDiff(flatV(res), flatV(lv));
    assert.ok(dV < 1e-9, `ΔV ${dV}`);
    const dr = Math.max(...res.obsData.map((o, i) => Math.max(...o.r.map((r, c) => Math.abs(r - lv.obsData[i].r[c])))));
    assert.ok(dr < 1e-9, `Δr ${dr}`);
    ok(`resíduos e números de redundância iguais aos da rede livre (ΔV ${dV.toExponential(1)}, Δr ${dr.toExponential(1)})`);

    const P = res.pointResults, Pl = new Map(lv.pointResults.map(p => [p.name, p]));
    let dd = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i].xyz, b = P[j].xyz, a2 = Pl.get(P[i].name).xyz, b2 = Pl.get(P[j].name).xyz;
        dd = Math.max(dd, Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - Math.hypot(a2[0] - b2[0], a2[1] - b2[1], a2[2] - b2[2])));
    }
    assert.ok(dd < 1e-8, `Δdistâncias ${dd}`);
    const st = P.filter(p => p.isStation);
    const dw = Math.max(...st.map(p => Math.abs(NA.wrapPi((p.omega - st[0].omega) - (Pl.get(p.name).omega - Pl.get(st[0].name).omega)))));
    assert.ok(dw < 1e-9, `Δω relativo ${dw}`);
    ok(`mesma forma: distâncias entre pontos (${dd.toExponential(1)} m) e diferenças de ω entre estações (${dw.toExponential(1)} rad)`);

    // Quantidades estimáveis têm a mesma precisão em qualquer datum: σ da distância B–C
    const sigDist = (r, n1, n2) => {
        const a = r.pointResults.find(p => p.name === n1), b = r.pointResults.find(p => p.name === n2);
        const d = a.xyz.map((v, i) => v - b.xyz[i]), L = Math.hypot(...d), g = d.map(v => v / L);
        let v2 = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            v2 += g[i] * g[j] * (a.Sigma[i][j] + b.Sigma[i][j]);
        }
        // covariância cruzada a–b
        const ea = r.net.index.get(n1), eb = r.net.index.get(n2);
        const ia = [ea.x, ea.y, ea.z], ib = [eb.x, eb.y, eb.z];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v2 -= 2 * g[i] * g[j] * r.SigmaXa[ia[i]][ib[j]];
        return Math.sqrt(v2);
    };
    const sM = sigDist(res, 'B', 'C'), sL = sigDist(lv, 'B', 'C');
    assert.ok(Math.abs(sM - sL) < 1e-9 * Math.max(1, sL) + 1e-12, `σ(B–C): ${sM} × ${sL}`);
    ok(`σ da distância B–C (estimável) igual nos dois datums: ${(sM * 1000).toFixed(3)} mm`);

    // Os σ das coordenadas, não: crescem com a distância à origem e são nulos nela
    const traceOf = r => r.unknowns.reduce((a, un, i) => a + (un.kind === 'w' ? 0 : r.SigmaXa[i][i]), 0);
    assert.ok(traceOf(lv) < traceOf(res));
    ok(`traço de Σ_Xa: ${(traceOf(lv) * 1e6).toFixed(1)} mm² na rede livre (mínimo) < ${(traceOf(res) * 1e6).toFixed(1)} mm² nas injunções mínimas`);
}
{
    // Mover o datum assumido move a rede rigidamente: translação (X, Y, Z) e rotação (ω)
    const rows = loadSample();
    const base = NA.adjustNetwork(rows, MIN);
    const th = 30 * DEG, T = [1000, 2000, 100];
    const moved = NA.adjustNetwork(rows, Object.assign({}, MIN, { datumX: T[0], datumY: T[1], datumZ: T[2], datumOmegaDeg: 30 }));
    let err = 0;
    base.pointResults.forEach(p => {
        const q = moved.pointResults.find(o => o.name === p.name).xyz;
        const e = [T[0] + Math.cos(th) * p.xyz[0] - Math.sin(th) * p.xyz[1], T[1] + Math.sin(th) * p.xyz[0] + Math.cos(th) * p.xyz[1], T[2] + p.xyz[2]];
        err = Math.max(err, Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]));
    });
    assert.ok(err < 1e-6, `movimento rígido ${err}`);
    approx(moved.VtPV, base.VtPV, 1e-6, `datum (X, Y, Z, ω) = (${T}, 30°): rede se move rigidamente (erro ${err.toExponential(1)} m) e VᵀPV não muda`);
}
{
    // Sem nenhum ponto fixo e com um só: o datum por pontos fixos recusa, o mínimo resolve
    const none = loadSample();
    none.forEach(r => { r.fixed = false; });
    assert.throws(() => NA.adjustNetwork(none, S), /Nenhum ponto fixo/);
    const a = NA.adjustNetwork(none, MIN);
    assert.ok(a.converged && a.dof === 13);
    const one = loadSample();
    one.filter(r => r.target === 'M02').forEach(r => { r.fixed = false; });
    assert.throws(() => NA.adjustNetwork(one, S), /Só um ponto fixo/);
    const b = NA.adjustNetwork(one, MIN);
    assert.ok(b.converged && b.dof === 13);
    ok('sem ponto fixo e com um só: o datum por pontos fixos recusa; as injunções mínimas resolvem (gl 13)');
}
{
    // Coordenadas dos fixos no CSV não entram: o datum é a estação de origem
    const g = synthetic({ noise: true, nStations: 3, nDetail: 6, seed: 33 });
    const res = NA.adjustNetwork(g.rows, MIN);
    assert.ok(res.converged && res.log.some(l => /não são usadas/.test(l.msg)));
    const o = res.pointResults.find(p => p.isStation && p.fixed);
    assert.strictEqual(o.name, res.net.stations[0]);
    assert.ok(Math.hypot(...o.xyz) === 0 && o.omega === 0);
    // A forma (distâncias) é a da rede livre
    const lv = NA.adjustNetwork(g.rows, LIVRE);
    approx(res.VtPV, lv.VtPV, 1e-6 * Math.max(1, lv.VtPV), 'rede sintética com fixos no CSV: VᵀPV igual à da rede livre');
    ok(`origem do datum = primeira estação (${o.name}); coordenadas dos fixos no CSV ignoradas e registradas no log`);
}
{
    const rows = loadSample();
    const res = NA.adjustNetwork(rows, Object.assign({}, MIN, { model: 'parametrico' }));
    const model = Report.buildReportModel(res, { rows, origin: 'x', detection: null, settings: S });
    const kv = new Map(model.summary);
    assert.ok(/injunções mínimas/.test(kv.get('Datum')) && /estação A/.test(kv.get('Datum')));
    assert.ok(/13 = 72 − 59/.test(kv.get('Graus de liberdade')), kv.get('Graus de liberdade'));
    assert.ok(/59 = 6 coordenadas de estação \+ 2 orientações \+ 51/.test(kv.get('Incógnitas')), kv.get('Incógnitas'));
    const coords = io.coordinatesToCSV(res).trim().split('\n');
    assert.ok(coords.some(l => l.startsWith('A,estação (origem),')));
    assert.ok(Report.renderText(model).includes('injunções mínimas'));
    ok('relatório e CSV com as injunções mínimas: datum, gl = 72 − 59, incógnitas e estação de origem');
}

// ---------------------------------------------------------------- idioma
console.log('\nIdioma (PT-BR / EN)');
{
    const rows = loadSample();
    const pt = NA.adjustNetwork(rows, MIN);
    globalThis.APP_LANG = 'en';
    try {
        const en = NA.adjustNetwork(rows, MIN);
        assert.strictEqual(en.VtPV, pt.VtPV);
        assert.ok(en.log.some(l => /Minimal constraints: station A is the datum origin/.test(l.msg)));
        assert.ok(!en.log.some(l => /Injunções mínimas/.test(l.msg)));
        assert.strictEqual(en.datumLabel, 'Minimal constraints (origin station)');
        assert.throws(() => NA.adjustNetwork(rows.map(r => Object.assign({}, r, { active: false })), S), /No active sightings/);
        const m = Report.buildReportModel(en, { rows, origin: 'x', detection: null, settings: S });
        const keys = m.summary.map(([k]) => k);
        assert.ok(keys.includes('Degrees of freedom') && keys.includes('Convergence'));
        assert.ok(Report.renderText(m).includes('ITERATIONS') && Report.renderText(m).includes('WARNINGS AND ERRORS'));
        assert.ok(io.coordinatesToCSV(en).startsWith('Point,Type,X,Y,Z'));
        assert.ok(io.coordinatesToCSV(en).includes('A,station (origin),'));
        const bad = io.parseCSV('Estacao,Ponto Visado\nA,A\n');
        assert.ok(bad.errors.length && bad.errors.every(e => !/Linha|Cabeçalho/.test(e)), bad.errors.join('|'));
    } finally { delete globalThis.APP_LANG; }
    // sem APP_LANG, tudo volta ao português
    assert.ok(NA.adjustNetwork(rows, MIN).log.some(l => /Injunções mínimas: a estação A/.test(l.msg)));
    ok('mensagens, rótulos, relatório e CSV saem em inglês com APP_LANG = "en" e em português por padrão');
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

{
    // O snooping herda modelo e datum das configurações
    const g = synthetic({ noise: true, nStations: 3, nDetail: 4, linksPerPair: 4, seed: 5 });
    const SL = Object.assign({}, S, { model: 'parametrico', datum: 'livre' });
    const base = NA.adjustNetwork(g.rows, SL);
    const target = base.obsData.slice().sort((a, b) => b.r[2] - a.r[2])[0];
    io.injectBlunder(g.rows[target.row.idx], 'dist', 40, target.sigma[2], 1);
    const sn = NA.detectDataSnooping(g.rows, SL);
    assert.strictEqual(sn.flagged[0], target.row.idx);
    ok(`data snooping no paramétrico livre aponta ${target.row.id}`);
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
