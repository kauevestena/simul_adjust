// Testes do pré-processamento das cadernetas (preproc.js).
// Execute com:  node intersecao_re_3D/test_preproc.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const P = require('./preproc.js');
const io = require('./io.js');

const RAW = fs.readFileSync(path.join(__dirname, 'inputs', 'raw_obs', 'raw_observations.csv'), 'utf8');
const REF = io.parseCSV(fs.readFileSync(path.join(__dirname, 'inputs', 'observations.csv'), 'utf8')).rows;

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }
function approx(actual, expected, tol, label) {
    assert.ok(Math.abs(actual - expected) <= tol, `${label}: esperado ${expected}, obtido ${actual} (tol ${tol})`);
    ok(label);
}

function groupsOf(text, fmt) {
    const p = P.parseRaw(text, { angleFormat: fmt || 'gmmss' });
    assert.deepStrictEqual(p.errors, []);
    return P.buildGroups(p.readings);
}

// Monta uma caderneta sintética a partir de valores verdadeiros e erros conhecidos
function fieldBook(targets, eps, cSec, noise) {
    const lines = ['Estacao,Ponto,Hz,Z,D'];
    targets.forEach(([st, pt, H, Z, D], ti) => {
        for (let k = 0; k < 3; k++) {
            const n = noise ? noise(ti, k) : [0, 0, 0, 0, 0];
            const sz = Math.sin(Z * Math.PI / 180);
            lines.push([st, pt, (H + cSec / 3600 / sz + n[0] / 3600).toFixed(10), (Z + eps / 3600 + n[1] / 3600).toFixed(10), (D + n[4]).toFixed(6)].join(','));
            lines.push([st, pt, ((H + 180 - cSec / 3600 / sz + n[2] / 3600) % 360).toFixed(10), (360 - Z + eps / 3600 + n[3] / 3600).toFixed(10), (D - n[4]).toFixed(6)].join(','));
        }
    });
    return lines.join('\n');
}

console.log('Leitura');
(() => {
    approx(P.gmmssToDeg('134.1704').value, 134 + 17 / 60 + 4 / 3600, 1e-12, 'g.mmss 134.1704');
    approx(P.gmmssToDeg('163.033').value, 163 + 3 / 60 + 30 / 3600, 1e-12, 'g.mmss sem zeros à direita: 163.033 = 163°03′30″');
    approx(P.gmmssToDeg('95.392').value, 95 + 39 / 60 + 20 / 3600, 1e-12, 'g.mmss 95.392 = 95°39′20″');
    approx(P.gmmssToDeg('48.541').value, 48 + 54 / 60 + 10 / 3600, 1e-12, 'g.mmss 48.541 = 48°54′10″');
    approx(P.gmmssToDeg('134.17045').value, 134 + 17 / 60 + 4.5 / 3600, 1e-12, 'g.mmss com décimo de segundo');
    approx(P.gmmssToDeg('50').value, 50, 1e-12, 'g.mmss inteiro');
    assert.strictEqual(P.gmmssToDeg('10.6000').error, 'range'); ok('g.mmss com 60 minutos é rejeitado');
    assert.strictEqual(P.detectFormat(RAW), 'gmmss'); ok('formato detectado: g.mmss');

    const g = groupsOf(RAW).groups;
    assert.strictEqual(g.length, 24); ok('24 visadas na caderneta de exemplo');
    assert.ok(g.every(x => x.pairs.length === 3)); ok('3 séries PD/PI em cada visada');

    // Mesmos dados em graus decimais e em G, M, S (3 colunas) dão os mesmos grupos
    const rows = P.parseRaw(RAW, { angleFormat: 'gmmss' }).readings;
    const dec = ['Estacao,Ponto,Hz,Z,D'].concat(rows.map(r => [r.station, r.target, r.hz.toFixed(12), r.z.toFixed(12), r.d].join(','))).join('\n');
    const split = d => { const a = Math.floor(d), m = Math.floor((d - a) * 60 + 1e-9); return [a, m, +(((d - a) * 60 - m) * 60).toFixed(6)]; };
    const dms = ['Estação;Ponto;Hz G;Hz M;Hz S;Z G;Z M;Z S;Distância'].concat(rows.map(r =>
        [r.station, r.target, ...split(r.hz), ...split(r.z), String(r.d).replace('.', ',')].join(';'))).join('\n');
    assert.strictEqual(P.detectFormat(dms), 'dms3'); ok('formato detectado: G, M, S em 3 colunas');
    [['deg', dec], ['dms3', dms]].forEach(([fmt, text]) => {
        const other = P.parseRaw(text, { angleFormat: fmt });
        assert.deepStrictEqual(other.errors, []);
        const md = Math.max(...other.readings.map((r, i) => Math.max(Math.abs(r.hz - rows[i].hz), Math.abs(r.z - rows[i].z), Math.abs(r.d - rows[i].d))));
        assert.ok(md < 1e-8, `${fmt}: diferença ${md}`);
        ok(`formato ${fmt} lê as mesmas leituras`);
    });

    const bad = P.parseRaw('Estacao,Ponto,Hz,Z,D\nA,P1,10.7000,90.0000,5', { angleFormat: 'gmmss' });
    assert.strictEqual(bad.errors.length, 1); ok('linha com minutos ≥ 60 vira erro com número da linha');
})();

console.log('Estrutura');
(() => {
    const b = groupsOf(RAW);
    assert.ok(b.warnings.some(w => /C/.test(w) && /B/.test(w))); ok('aviso: estação C é cópia da estação B');
    const odd = P.buildGroups(P.parseRaw('E,P,Hz,Z,D\nA,P1,10,90,5\nA,P1,190,270,5\nA,P1,10,90,5', { angleFormat: 'deg' }).readings);
    assert.strictEqual(odd.groups[0].pairs.length, 1);
    assert.ok(odd.warnings.length === 1); ok('PD sem PI correspondente gera aviso e não forma série');
})();

console.log('Arquivo de referência');
(() => {
    const { groups } = groupsOf(RAW);
    const S = P.applyPreset(P.DEFAULT_SETTINGS, 'reference');
    P.compute(groups, S);
    // As estações A e B da caderneta correspondem às 15 primeiras linhas de observations.csv
    let m = { hz: 0, sHz: 0, z: 0, sZ: 0, d: 0, sD: 0 };
    groups.slice(0, 15).forEach((g, i) => {
        const r = REF[i];
        assert.strictEqual(`${g.station}→${g.target}`, `${r.station}→${r.target}`);
        m.hz = Math.max(m.hz, Math.abs(P.wrapPM180(g.out.hz.value - r.hzDeg)));
        m.sHz = Math.max(m.sHz, Math.abs(g.out.hz.sigma - r.sHz));
        m.z = Math.max(m.z, Math.abs(g.out.z.value - r.zenDeg));
        m.sZ = Math.max(m.sZ, Math.abs(g.out.z.sigma - r.sZen));
        m.d = Math.max(m.d, Math.abs(g.out.d.value - r.dist));
        m.sD = Math.max(m.sD, Math.abs(g.out.d.sigma - r.sDist));
    });
    assert.ok(m.hz < 1e-9 && m.z < 1e-9 && m.d < 1e-9, JSON.stringify(m)); ok('médias de Hz, Z e S iguais às de observations.csv');
    assert.ok(m.sHz < 1e-8 && m.sZ < 1e-8 && m.sD < 1e-10, JSON.stringify(m)); ok('σ iguais às de observations.csv (2n leituras, s populacional)');

    P.compute(groups, P.DEFAULT_SETTINGS);
    approx(groups[0].out.hz.sigma, 2.619372274, 1e-6, 'padrão (3 séries, n − 1): σHz de A→M01');
    approx(groups[0].out.z.sigma, 3.086709863, 1e-6, 'padrão (3 séries, n − 1): σZ de A→M01');
    approx(groups[0].out.hz.value, REF[0].hzDeg, 1e-9, 'padrão: mesmo Hz médio');
})();

console.log('Erro de índice global e políticas');
(() => {
    const T = [['A', 'P1', 30, 85, 10], ['A', 'P2', 120, 95, 20], ['A', 'P3', 250, 100, 15], ['A', 'P4', 340, 88, 12]];
    const { groups } = groupsOf(fieldBook(T, 12, 6), 'deg');
    let R = P.compute(groups, Object.assign({}, P.DEFAULT_SETTINGS, { trim: 'none' }));
    approx(R.global.index.mean, 12, 1e-6, 'ε global recuperado (12″)');
    approx(R.global.coll.mean, 6, 1e-6, 'c global recuperado (6″)');
    approx(groups[0].out.z.value, 85, 1e-9, 'média das séries elimina ε');
    approx(groups[0].out.hz.value, 30, 1e-9, 'média das séries elimina c');

    const S1 = P.mergeSettings(P.DEFAULT_SETTINGS, { trim: 'none', hz: { value: 'oneFace', face: 'PD', series: 1 }, z: { value: 'oneFace', face: 'PD', series: 1 } });
    P.compute(groups, S1);
    approx((groups[0].out.z.value - 85) * 3600, 12, 1e-6, 'uma leitura PD carrega ε');
    approx((groups[0].out.hz.value - 30) * 3600, 6 / Math.sin(85 * Math.PI / 180), 1e-6, 'uma leitura PD carrega c/sen Z');

    const S2 = P.mergeSettings(P.DEFAULT_SETTINGS, { trim: 'none', hz: { value: 'facePlusCorr', face: 'PD' }, z: { value: 'facePlusCorr', face: 'PI', sigma: 'nominal' } });
    R = P.compute(groups, S2);
    approx(groups[1].out.z.value, 95, 1e-9, 'PI + ε global = Z verdadeiro');
    approx(groups[1].out.hz.value, 120, 1e-9, 'PD + c global = Hz verdadeiro');
    const sig0 = P.DEFAULT_SETTINGS.sigAngSec;
    approx(groups[1].out.z.sigma, Math.hypot(sig0 / Math.sqrt(3), R.global.index.sMeanNom), 1e-9, 'σ nominal propaga σ da média e σ de ε̄');

    // Eliminação de extremos: uma série com ε deslocado de 60″
    const noisy = groupsOf(fieldBook(T.concat([['B', 'P1', 10, 90, 8], ['B', 'P5', 200, 92, 9]]), 12, 0,
        (ti, k) => (ti === 0 && k === 1 ? [0, 60, 0, 60, 0] : [0, (k - 1) * 0.5, 0, (1 - k) * 0.3, 0])), 'deg').groups;
    const Rn = P.compute(noisy, Object.assign({}, P.DEFAULT_SETTINGS, { trim: 'ksigma', trimK: 2.5 }));
    const trimmed = Rn.global.index.values.filter(v => v.trimmed);
    assert.strictEqual(trimmed.length, 1); assert.strictEqual(trimmed[0].key, 'A→P1 #2'); ok('k·s elimina a série com ε discrepante');
    approx(Rn.global.index.mean, 12, 0.5, 'ε̄ após eliminação ≈ 12″');
    assert.ok(noisy[0].readings.some(r => r.flags.z.some(f => f.code === 'indexPair'))); ok('série discrepante marcada nas leituras de Z');
})();

console.log('Distâncias e triagem');
(() => {
    const { groups } = groupsOf(RAW);
    const g = groups[0]; // A→M01: 14.428 14.426 14.428 14.424 14.433 14.425
    const S = P.mergeSettings(P.DEFAULT_SETTINGS, { d: { value: 'firstN', n: 4 } });
    P.compute(groups, S);
    approx(g.out.d.value, (14.428 + 14.426 + 14.428 + 14.424) / 4, 1e-12, 'S: média das 4 primeiras');
    g.readings[0].use.d = false;
    P.compute(groups, S);
    approx(g.out.d.value, (14.426 + 14.428 + 14.424 + 14.433) / 4, 1e-12, 'S: excluída a 1ª, entram as 4 seguintes');
    assert.strictEqual(g.out.hz.n, 3); assert.strictEqual(g.out.z.n, 3); ok('excluir uma distância não remove os ângulos');
    g.readings[0].use.d = true;
    P.compute(groups, P.mergeSettings(P.DEFAULT_SETTINGS, { d: { value: 'median' } }));
    approx(g.out.d.value, 14.427, 1e-12, 'S: mediana');

    // Leitura com +30″ é marcada (σ nominal 2″; rede com 8 visadas para o σ da rede)
    const T = [30, 75, 120, 165, 210, 255, 300, 345].map((h, i) => ['A', `P${i + 1}`, h, 85 + i * 2, 10 + i]);
    const bad = groupsOf(fieldBook(T, 0, 0, (ti, k) => (ti === 0 && k === 1 ? [30, 0, 0, 0, 0] : [(k - 1) * (ti % 3 - 1) * 1.5, -k * 0.3, (1 - k) * (ti % 2 - 0.5) * 2, 0.1 * k, 0])), 'deg').groups;
    ['nominal', 'pooled', 'mad', 'grubbs'].forEach(method => {
        P.compute(bad, Object.assign({}, P.DEFAULT_SETTINGS, { flagMethod: method }));
        const flagged = bad[0].readings.filter(r => r.flags.hz.some(f => f.code === method));
        assert.ok(flagged.length >= 1 && flagged.every(r => r.face === 'PD' && r.k === 2), `${method}: ${flagged.map(r => r.face + r.k)}`);
        ok(`triagem ${method} marca a leitura PD da série 2`);
    });
    P.compute(bad, Object.assign({}, P.DEFAULT_SETTINGS, { flagMethod: 'nominal' }));
    const n = P.excludeFlagged(bad);
    P.compute(bad, P.DEFAULT_SETTINGS);
    assert.ok(n >= 1 && !bad[0].readings[2].use.hz && bad[0].readings[2].use.z && bad[0].readings[2].use.d); ok('excluir marcadas atua só no observável marcado');
    approx(bad[0].out.hz.n, 2, 0, 'Hz fica com 2 séries completas');
})();

console.log('Exportação');
(() => {
    const { groups } = groupsOf(RAW);
    P.compute(groups, P.DEFAULT_SETTINGS);
    const fixed = new Map([['M01', { fixed: true, xyz: null }], ['M02', { fixed: true, xyz: [10, 20, 30] }]]);
    const out = P.toObservationsCSV(groups, fixed);
    assert.strictEqual(out.n, 24); assert.deepStrictEqual(out.skipped, []);
    const back = io.parseCSV(out.csv);
    assert.deepStrictEqual(back.errors, []);
    assert.strictEqual(back.rows.length, 24); ok('observations.csv exportado é lido pelo simulador sem erros');
    assert.ok(back.rows[0].fixed && back.rows[1].fixed && !back.rows[2].fixed); ok('coluna Fixo segue os pontos marcados');
    assert.deepStrictEqual(back.rows[1].xyz, [10, 20, 30]); ok('X, Y, Z dos fixos exportados');
    approx(back.rows[0].sHz, groups[0].out.hz.sigma, 1e-9, 'σ em segundos no arquivo');
    const rep = P.toReportCSV(P.compute(groups, P.DEFAULT_SETTINGS));
    assert.strictEqual(rep.trim().split('\n').length, 3 + 144); ok('relatório com uma linha por leitura');

    // Visada sem nenhuma distância incluída fica fora do arquivo
    groups[3].readings.forEach(r => { r.use.d = false; });
    P.compute(groups, P.DEFAULT_SETTINGS);
    const out2 = P.toObservationsCSV(groups, fixed);
    assert.strictEqual(out2.n, 23); assert.deepStrictEqual(out2.skipped, ['A→00d']); ok('visada sem distância incluída não é exportada');
})();

console.log(`\n${passed} verificações passaram.`);
