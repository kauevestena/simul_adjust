// --- Entrada/saída de dados: CSV, transformação GMS -> XYZ e propagação da MVC ---
// Observações brutas de estação total sem prisma: azimute (GMS), ângulo zenital (GMS) e
// distância inclinada (m). Ver ajusta_planos/about_samples.md.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.PlanoIO = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const ARCSEC = Math.PI / (180 * 3600);
    const DEG = Math.PI / 180;
    const TWO_PI = 2 * Math.PI;

    const DEFAULT_SETTINGS = {
        gauge: 'reduction', // remoção da liberdade de escala: reduction | constraint | pseudoinverse
        pinParam: 'auto',   // parâmetro fixado pela redução: auto | A | B | C | D
        sigAngSec: 2.0,     // sigma nominal dos ângulos (arcsec), para azimute e zenital
        edmMm: 2.0,         // parcela constante do MED (mm)
        edmPpm: 2.0,        // parcela proporcional do MED (ppm)
        alphaPct: 5.0,      // nível de significância do teste global (%)
        alpha0Pct: 0.1,     // nível de significância do data snooping (%)
        sigmaRuleK: 3.0,    // multiplicador da regra k-sigma
        ransacIters: 1000,  // número de tentativas do RANSAC
        ransacThreshMm: 6.0,// limiar de inlier do RANSAC (mm)
        maxIter: 20,        // máximo de iterações do ajustamento
        tol: 1e-10,         // critério de parada em max|X|
        nonCentrality: 2.8  // delta0 (alpha=0.1%, poder 80%) para o erro mínimo detectável
    };

    // --- Conversões angulares ---

    function gmsToDeg(g, m, s) {
        const sign = (g < 0 || Object.is(g, -0)) ? -1 : 1;
        return sign * (Math.abs(g) + Math.abs(m) / 60 + Math.abs(s) / 3600);
    }

    function gmsToRad(g, m, s) { return gmsToDeg(g, m, s) * DEG; }

    function degToGms(deg) {
        const sign = deg < 0 ? -1 : 1;
        let a = Math.abs(deg);
        let g = Math.floor(a);
        let m = Math.floor((a - g) * 60);
        let s = (a - g - m / 60) * 3600;
        // Reacomoda o arredondamento nos segundos (ex.: 59.9999" -> 60")
        if (s >= 59.99995) { s = 0; m += 1; }
        if (m >= 60) { m = 0; g += 1; }
        return { g: sign * g, m, s };
    }

    function radToGms(rad) { return degToGms(rad / DEG); }

    function formatGms(rad, decimals = 1) {
        const { g, m, s } = radToGms(rad);
        return `${g}° ${String(Math.abs(m)).padStart(2, '0')}' ${Math.abs(s).toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0')}"`;
    }

    function wrap2Pi(rad) { return ((rad % TWO_PI) + TWO_PI) % TWO_PI; }

    // --- Leitura de CSV ---

    // 7 colunas sem cabeçalho: G,M,S do azimute; G,M,S do zenital; distância inclinada (m).
    // Uma 8ª coluna opcional é usada como identificador do ponto.
    function parseCSV(text) {
        const rows = [];
        const errors = [];
        const lines = String(text).split(/\r?\n/);

        lines.forEach((rawLine, lineNo) => {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) return;

            const sep = (line.indexOf(';') >= 0 && line.indexOf(',') < 0) ? ';' : ',';
            const parts = line.split(sep).map(p => p.trim()).filter(p => p !== '');
            if (parts.length < 7) {
                errors.push(`Linha ${lineNo + 1}: esperadas 7 colunas, encontradas ${parts.length}.`);
                return;
            }

            const nums = parts.slice(0, 7).map(p => parseFloat(p.replace(',', '.')));
            if (nums.some(n => !Number.isFinite(n))) {
                // Provável cabeçalho na primeira linha útil: ignora silenciosamente
                if (rows.length === 0) return;
                errors.push(`Linha ${lineNo + 1}: valores numéricos inválidos.`);
                return;
            }
            if (!(nums[6] > 0)) {
                errors.push(`Linha ${lineNo + 1}: distância inclinada deve ser maior que zero.`);
                return;
            }

            rows.push({
                gAz: nums[0], mAz: nums[1], sAz: nums[2],
                gZen: nums[3], mZen: nums[4], sZen: nums[5],
                sd: nums[6],
                id: parts[7] || null
            });
        });

        return { rows, errors };
    }

    function rowsToCSV(rows) {
        return rows.map(r => [
            r.gAz, r.mAz, r.sAz, r.gZen, r.mZen, r.sZen, r.sd.toFixed(4)
        ].join(',')).join('\n') + '\n';
    }

    // --- Modelo geométrico e estocástico ---

    function obsToXYZ(azRad, zenRad, sd) {
        const sz = Math.sin(zenRad), cz = Math.cos(zenRad);
        return [sd * sz * Math.cos(azRad), sd * sz * Math.sin(azRad), sd * cz];
    }

    function xyzToObs(x, y, z) {
        const sd = Math.sqrt(x * x + y * y + z * z);
        return { az: wrap2Pi(Math.atan2(y, x)), zen: Math.acos(z / sd), sd };
    }

    // Jacobiana 3x3 de (X,Y,Z) em relação a (azimute, zenital, distância inclinada)
    function jacobianGMStoXYZ(azRad, zenRad, sd) {
        const sa = Math.sin(azRad), ca = Math.cos(azRad);
        const sz = Math.sin(zenRad), cz = Math.cos(zenRad);
        return [
            [-sd * sz * sa, sd * cz * ca, sz * ca],
            [sd * sz * ca, sd * cz * sa, sz * sa],
            [0, -sd * sz, cz]
        ];
    }

    // MVC das observações brutas: diagonal com as variâncias de azimute, zenital e distância
    function sigmaObs(sd, settings) {
        const sAng = settings.sigAngSec * ARCSEC;
        const sDist = settings.edmMm / 1000 + (settings.edmPpm * 1e-6) * sd;
        return [
            [sAng * sAng, 0, 0],
            [0, sAng * sAng, 0],
            [0, 0, sDist * sDist]
        ];
    }

    // Sigma_XYZ = J * Sigma_obs * J^T  (Sigma_obs diagonal)
    function sigmaXYZ(azRad, zenRad, sd, settings) {
        const J = jacobianGMStoXYZ(azRad, zenRad, sd);
        const S = sigmaObs(sd, settings);
        const d = [S[0][0], S[1][1], S[2][2]];
        const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j <= i; j++) {
                let acc = 0;
                for (let k = 0; k < 3; k++) acc += J[i][k] * d[k] * J[j][k];
                out[i][j] = acc;
                out[j][i] = acc;
            }
        }
        return out;
    }

    // Converte as linhas do CSV em pontos completos, com geometria e estocástica prontas
    function buildPoints(rows, settings, previous) {
        return rows.map((r, i) => {
            const az = gmsToRad(r.gAz, r.mAz, r.sAz);
            const zen = gmsToRad(r.gZen, r.mZen, r.sZen);
            const prev = previous && previous[i];
            return {
                idx: i,
                id: r.id || `P${String(i + 1).padStart(3, '0')}`,
                gAz: r.gAz, mAz: r.mAz, sAz: r.sAz,
                gZen: r.gZen, mZen: r.mZen, sZen: r.sZen,
                sd: r.sd,
                az, zen,
                xyz: obsToXYZ(az, zen, r.sd),
                J: jacobianGMStoXYZ(az, zen, r.sd),
                sigObs: sigmaObs(r.sd, settings),
                sigXYZ: sigmaXYZ(az, zen, r.sd, settings),
                active: prev ? prev.active !== false : true,
                hasBlunder: prev ? !!prev.hasBlunder : false,
                flagged: false
            };
        });
    }

    // Recalcula apenas o que depende das precisões nominais (aba Configurações)
    function refreshStochastic(points, settings) {
        points.forEach(p => {
            p.sigObs = sigmaObs(p.sd, settings);
            p.sigXYZ = sigmaXYZ(p.az, p.zen, p.sd, settings);
        });
        return points;
    }

    // --- Geração sintética ---

    function randn() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
    }

    // Planos didáticos, no referencial da estação total (origem no instrumento)
    const SYNTHETIC_PLANES = {
        parede_frontal: { normal: [1, 0, 0], dist: 4.0, label: 'Parede frontal' },
        parede_lateral: { normal: [0, 1, 0], dist: 3.5, label: 'Parede lateral' },
        piso: { normal: [0, 0, 1], dist: -1.6, label: 'Piso' },
        rampa: { normal: [0, -0.2, 1], dist: -1.6, label: 'Rampa (10%)' }
    };

    // Gera observações brutas: monta XYZ sobre o plano, converte para (Az, Zen, DI) e
    // adiciona ruído gaussiano com as precisões nominais — a entrada do app é sempre bruta.
    function generateSynthetic(opts, settings) {
        const cfg = Object.assign({ tipo: 'parede_frontal', n: 40, extent: 3.0, roughnessMm: 0 }, opts);
        const spec = SYNTHETIC_PLANES[cfg.tipo] || SYNTHETIC_PLANES.parede_frontal;

        const nv = spec.normal.slice();
        const nrm = Math.hypot(nv[0], nv[1], nv[2]);
        for (let i = 0; i < 3; i++) nv[i] /= nrm;
        // Ponto de apoio do plano e base ortonormal (e1, e2) sobre ele
        const origin = nv.map(c => c * spec.dist);
        const helper = Math.abs(nv[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        let e1 = [
            helper[1] * nv[2] - helper[2] * nv[1],
            helper[2] * nv[0] - helper[0] * nv[2],
            helper[0] * nv[1] - helper[1] * nv[0]
        ];
        const e1n = Math.hypot(e1[0], e1[1], e1[2]);
        e1 = e1.map(c => c / e1n);
        const e2 = [
            nv[1] * e1[2] - nv[2] * e1[1],
            nv[2] * e1[0] - nv[0] * e1[2],
            nv[0] * e1[1] - nv[1] * e1[0]
        ];

        const rows = [];
        for (let i = 0; i < cfg.n; i++) {
            const u = (Math.random() - 0.5) * 2 * cfg.extent;
            const v = (Math.random() - 0.5) * 2 * cfg.extent;
            // Rugosidade opcional da superfície (erro do modelo, não da medição)
            const w = cfg.roughnessMm > 0 ? randn() * cfg.roughnessMm / 1000 : 0;
            const P = [
                origin[0] + u * e1[0] + v * e2[0] + w * nv[0],
                origin[1] + u * e1[1] + v * e2[1] + w * nv[1],
                origin[2] + u * e1[2] + v * e2[2] + w * nv[2]
            ];
            const o = xyzToObs(P[0], P[1], P[2]);
            const sAng = settings.sigAngSec * ARCSEC;
            const sDist = settings.edmMm / 1000 + (settings.edmPpm * 1e-6) * o.sd;
            const az = wrap2Pi(o.az + randn() * sAng);
            const zen = o.zen + randn() * sAng;
            const sd = o.sd + randn() * sDist;

            const gAz = radToGms(az), gZen = radToGms(zen);
            rows.push({
                gAz: gAz.g, mAz: gAz.m, sAz: Math.round(gAz.s * 10) / 10,
                gZen: gZen.g, mZen: gZen.m, sZen: Math.round(gZen.s * 10) / 10,
                sd: Math.round(sd * 10000) / 10000,
                id: null
            });
        }
        return rows;
    }

    // Erro grosseiro de ±k sigma na distância inclinada das observações escolhidas
    function injectBlunder(points, indices, k, settings) {
        const injected = [];
        indices.forEach(i => {
            const p = points[i];
            if (!p) return;
            const sDist = settings.edmMm / 1000 + (settings.edmPpm * 1e-6) * p.sd;
            const offset = (Math.random() > 0.5 ? 1 : -1) * k * sDist;
            p.sd = Math.round((p.sd + offset) * 100000) / 100000;
            p.hasBlunder = true;
            p.xyz = obsToXYZ(p.az, p.zen, p.sd);
            p.J = jacobianGMStoXYZ(p.az, p.zen, p.sd);
            p.sigObs = sigmaObs(p.sd, settings);
            p.sigXYZ = sigmaXYZ(p.az, p.zen, p.sd, settings);
            injected.push({ id: p.id, mm: offset * 1000 });
        });
        return injected;
    }

    // --- Exportação ---

    function matrixToCSV(mat) {
        if (!mat || !mat.length) return '';
        if (!Array.isArray(mat[0])) return mat.map(v => fmt(v)).join('\n') + '\n';
        return mat.map(row => row.map(v => fmt(v)).join(',')).join('\n') + '\n';
    }

    function fmt(v) {
        if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
        if (v === 0) return '0';
        const a = Math.abs(v);
        if (a < 1e-4 || a >= 1e6) return v.toExponential(10);
        return v.toPrecision(12).replace(/0+$/, '').replace(/\.$/, '');
    }

    function download(filename, content, mime = 'text/csv;charset=utf-8') {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        ARCSEC, DEG, TWO_PI, DEFAULT_SETTINGS, SYNTHETIC_PLANES,
        gmsToDeg, gmsToRad, degToGms, radToGms, formatGms, wrap2Pi,
        parseCSV, rowsToCSV,
        obsToXYZ, xyzToObs, jacobianGMStoXYZ, sigmaObs, sigmaXYZ,
        buildPoints, refreshStochastic,
        randn, generateSynthetic, injectBlunder,
        matrixToCSV, fmt, download
    };
});
