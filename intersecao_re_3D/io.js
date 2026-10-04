// --- Entrada/saída de dados da interseção a ré 3D: CSV, configurações, rede sintética ---
// Cada linha do CSV é uma visada de estação total: leitura horizontal, ângulo zenital e
// distância inclinada, com seus desvios-padrão. Colunas X,Y,Z opcionais trazem as coordenadas
// dos pontos fixos; em branco, o ponto fixo é calculado por irradiação (ver adjustment.js).
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RedeIO = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);
    const termOf = k => (typeof NetAdjust !== 'undefined' ? NetAdjust.term(k) : (typeof require === 'function' ? require('./adjustment.js').term(k) : k));

    const ARCSEC = Math.PI / (180 * 3600);
    const DEG = Math.PI / 180;
    const TWO_PI = 2 * Math.PI;

    const DEFAULT_SETTINGS = {
        model: 'combinado',     // combinado (Gauss-Helmert) | parametrico (Gauss-Markov)
        datum: 'fixos',         // fixos (pontos fixos como constantes) | livre (injunções internas)
        sigmaSource: 'csv',     // csv | nominal | max — origem dos desvios-padrão das observações
        sigmaAngUnit: 'arcsec', // unidade dos desvios angulares no CSV: arcsec | deg
        sigAngSec: 2.0,         // sigma nominal dos ângulos (arcsec)
        edmMm: 2.0,             // parcela constante do MED (mm)
        edmPpm: 2.0,            // parcela proporcional do MED (ppm)
        datumX: 0, datumY: 0, datumZ: 0, // posição assumida da estação de origem (m)
        datumOmegaDeg: 0,       // orientação assumida da estação de origem (graus)
        alphaPct: 5.0,          // nível de significância do teste global (%)
        alpha0Pct: 0.1,         // nível de significância do data snooping e do teste tau (%)
        powerPct: 80,           // poder do teste, para o erro mínimo detectável (%)
        sigmaRuleK: 3.0,        // multiplicador da regra k-sigma
        maxIter: 25,            // máximo de iterações
        tolLinMm: 0.01,         // critério de parada nas coordenadas (mm)
        tolAngSec: 0.01,        // critério de parada nas orientações (arcsec)
        sigmaXaScale: 'posteriori', // posteriori: Sigma_Xa = sigma0_hat² N⁻¹ | priori: N⁻¹
        ellipsoidConf: '1sigma' // 1sigma | 95 | 99 — nível dos elipsoides/elipses
    };

    // Cabeçalhos aceitos, já normalizados (minúsculas, sem acento, só alfanuméricos).
    // "Distância Incinada" é a grafia do arquivo de exemplo; a correta também vale.
    const HEADER_KEYS = {
        estacao: 'station',
        pontovisado: 'target',
        leiturahorizontal: 'hz',
        desviopadraoh: 'sHz',
        angulozenital: 'zen',
        desviopadraov: 'sZen',
        distanciaincinada: 'dist',
        distanciainclinada: 'dist',
        desviopadraod: 'sDist',
        fixo: 'fixed',
        x: 'X', y: 'Y', z: 'Z'
    };
    const POSITIONAL = ['station', 'target', 'hz', 'sHz', 'zen', 'sZen', 'dist', 'sDist', 'fixed', 'X', 'Y', 'Z'];
    const CANONICAL_HEADER = 'Estacao,Ponto Visado,Leitura Horizontal,desvio padrão H,Ângulo Zenital,' +
        'desvio padrão V,Distância Incinada,desvio padrão D,Fixo,X,Y,Z';

    function normKey(s) {
        return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Divide uma linha respeitando aspas duplas
    function splitLine(line, sep) {
        const out = [];
        let cur = '', quoted = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
                else quoted = !quoted;
            } else if (c === sep && !quoted) {
                out.push(cur); cur = '';
            } else cur += c;
        }
        out.push(cur);
        return out.map(s => s.trim());
    }

    function parseNum(s, decimalComma) {
        if (s === undefined || s === null) return null;
        const t = String(s).trim();
        if (t === '') return null;
        const v = Number(decimalComma ? t.replace(',', '.') : t);
        return Number.isFinite(v) ? v : NaN;
    }

    const TRUE_WORDS = ['sim', 's', 'true', 't', '1', 'yes', 'y', 'x', 'fixo'];
    const FALSE_WORDS = ['nao', 'n', 'false', 'f', '0', 'no', 'livre', ''];

    function parseBool(s) {
        const k = normKey(s);
        if (TRUE_WORDS.includes(k)) return true;
        if (FALSE_WORDS.includes(k)) return false;
        return null;
    }

    // Lê o CSV de observações. Devolve linhas já com os ângulos em graus decimais, os
    // desvios como vieram (a unidade angular é aplicada depois, conforme as configurações)
    // e X,Y,Z = null quando em branco.
    function parseCSV(text) {
        const rows = [], errors = [], warnings = [];
        const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
        let map = null, sep = ',', decimalComma = false;

        lines.forEach((rawLine, lineNo) => {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) return;
            const ln = lineNo + 1;

            if (!map) {
                sep = (line.indexOf(';') >= 0) ? ';' : ',';
                decimalComma = sep === ';';
                const parts = splitLine(line, sep);
                const keys = parts.map(p => HEADER_KEYS[normKey(p)]);
                if (keys.filter(Boolean).length >= 3) {
                    map = keys;
                    const need = ['station', 'target', 'hz', 'zen', 'dist'];
                    const missing = need.filter(k => !map.includes(k));
                    if (missing.length) errors.push(tr(`Cabeçalho sem as colunas obrigatórias: ${missing.join(', ')}.`, `Header missing required columns: ${missing.join(', ')}.`));
                    return;
                }
                // Sem cabeçalho reconhecível: ordem posicional da especificação
                map = POSITIONAL.slice();
                warnings.push(tr('Cabeçalho não reconhecido; colunas lidas na ordem da especificação.', 'Header not recognised; columns read in the specified order.'));
            }

            const parts = splitLine(line, sep);
            const f = {};
            map.forEach((k, i) => { if (k && f[k] === undefined) f[k] = parts[i] !== undefined ? parts[i] : ''; });

            const station = (f.station || '').trim();
            const target = (f.target || '').trim();
            if (!station || !target) { errors.push(tr(`Linha ${ln}: estação e ponto visado são obrigatórios.`, `Line ${ln}: station and sighted point are required.`)); return; }
            if (station === target) { errors.push(tr(`Linha ${ln}: a estação ${station} visa a si mesma.`, `Line ${ln}: station ${station} sights itself.`)); return; }

            const hz = parseNum(f.hz, decimalComma), zen = parseNum(f.zen, decimalComma);
            const dist = parseNum(f.dist, decimalComma);
            if (![hz, zen, dist].every(v => v !== null && Number.isFinite(v))) {
                errors.push(tr(`Linha ${ln}: leitura horizontal, zenital e distância precisam ser numéricas.`, `Line ${ln}: horizontal reading, zenith angle and distance must be numeric.`));
                return;
            }
            if (!(dist > 0)) { errors.push(tr(`Linha ${ln}: distância inclinada deve ser maior que zero.`, `Line ${ln}: slope distance must be greater than zero.`)); return; }
            if (!(zen > 0 && zen < 180)) { errors.push(tr(`Linha ${ln}: ângulo zenital fora de (0°, 180°).`, `Line ${ln}: zenith angle outside (0°, 180°).`)); return; }

            const sig = ['sHz', 'sZen', 'sDist'].map(k => parseNum(f[k], decimalComma));
            if (sig.some(v => Number.isNaN(v))) { errors.push(tr(`Linha ${ln}: desvio-padrão não numérico.`, `Line ${ln}: non-numeric standard deviation.`)); return; }

            let fixed = false;
            if (f.fixed !== undefined) {
                fixed = parseBool(f.fixed);
                if (fixed === null) {
                    errors.push(tr(`Linha ${ln}: valor "${f.fixed}" inválido na coluna Fixo (use sim/não).`, `Line ${ln}: invalid value "${f.fixed}" in the Fixo column (use sim/não or yes/no).`));
                    return;
                }
            }

            const xyzRaw = ['X', 'Y', 'Z'].map(k => parseNum(f[k], decimalComma));
            if (xyzRaw.some(v => Number.isNaN(v))) { errors.push(tr(`Linha ${ln}: coordenada X,Y,Z não numérica.`, `Line ${ln}: non-numeric X,Y,Z coordinate.`)); return; }
            const given = xyzRaw.filter(v => v !== null).length;
            if (given !== 0 && given !== 3) {
                errors.push(tr(`Linha ${ln}: informe X, Y e Z juntos ou deixe os três em branco.`, `Line ${ln}: give X, Y and Z together or leave all three blank.`));
                return;
            }
            let xyz = given === 3 ? xyzRaw : null;
            if (xyz && !fixed) {
                warnings.push(tr(`Linha ${ln}: coordenadas de ${target} ignoradas (ponto não é fixo).`, `Line ${ln}: coordinates of ${target} ignored (point is not a control point).`));
                xyz = null;
            }

            rows.push({
                station, target,
                hzDeg: ((hz % 360) + 360) % 360, zenDeg: zen, dist,
                sHz: sig[0], sZen: sig[1], sDist: sig[2],
                fixed, xyz,
                line: ln
            });
        });

        if (!map) errors.push(tr('Arquivo vazio.', 'Empty file.'));
        return { rows, errors, warnings };
    }

    // Linhas prontas para o app: identificador, estado e cópia dos valores originais
    function buildRows(parsed, previous) {
        return parsed.map((r, i) => {
            const prev = previous && previous[i];
            return Object.assign({}, r, {
                idx: i,
                id: `${r.station}→${r.target}`,
                active: prev ? prev.active !== false : true,
                hasBlunder: prev ? !!prev.hasBlunder : false,
                blunder: prev ? prev.blunder || null : null,
                flagged: false,
                orig: { hzDeg: r.hzDeg, zenDeg: r.zenDeg, dist: r.dist }
            });
        });
    }

    function rowsToCSV(rows) {
        const out = [CANONICAL_HEADER];
        rows.forEach(r => {
            const xyz = r.xyz ? r.xyz.map(v => fmt(v)) : ['', '', ''];
            const s = v => (v === null || v === undefined) ? '' : fmt(v);
            out.push([
                csvCell(r.station), csvCell(r.target),
                fmt(r.hzDeg), s(r.sHz), fmt(r.zenDeg), s(r.sZen), fmt(r.dist), s(r.sDist),
                r.fixed ? 'sim' : 'não', ...xyz
            ].join(','));
        });
        return out.join('\n') + '\n';
    }

    function csvCell(s) {
        const t = String(s);
        return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    }

    // --- Rede sintética ---

    // Gerador congruencial com semente (mulberry32), para testes reprodutíveis
    function seededRandom(seed) {
        let a = (seed >>> 0) || 0x9e3779b9;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function gaussFrom(rand) {
        let u = 0, v = 0;
        while (u === 0) u = rand();
        while (v === 0) v = rand();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
    }

    function wrap2Pi(rad) { return ((rad % TWO_PI) + TWO_PI) % TWO_PI; }

    // Observação exata de `st` (orientação omega) para `p`, na convenção do ajusta_planos:
    // ΔX = S sinZ cos(Hz+ω), ΔY = S sinZ sin(Hz+ω), ΔZ = S cosZ.
    function exactObservation(st, omega, p) {
        const dx = p[0] - st[0], dy = p[1] - st[1], dz = p[2] - st[2];
        const s = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return { hz: wrap2Pi(Math.atan2(dy, dx) - omega), zen: Math.acos(dz / s), dist: s };
    }

    // Uma estação de origem que vê três pontos fixos, e estações encadeadas por pontos de
    // ligação comuns — a mesma topologia da amostra. Os pontos de detalhe são irradiados da
    // estação mais próxima e, às vezes, também da segunda.
    function generateSyntheticNetwork(opts, settings) {
        const cfg = Object.assign({
            nStations: 3, nDetail: 8, linksPerPair: 3, spacing: 8,
            noise: true, withCoords: true, seed: null
        }, opts);
        const rand = cfg.seed === null ? Math.random : seededRandom(cfg.seed);
        const S = Object.assign({}, DEFAULT_SETTINGS, settings);
        const U = (a, b) => a + (b - a) * rand();

        const truth = { points: {}, stations: {} };
        const stations = [];
        for (let i = 0; i < cfg.nStations; i++) {
            const name = `E${i + 1}`;
            const xyz = [100 + i * cfg.spacing + U(-1, 1), 200 + U(-2, 2), 50 + U(-0.3, 0.3)];
            const omega = U(0, TWO_PI);
            truth.stations[name] = { xyz, omega };
            stations.push(name);
        }

        const seen = {}; // estação -> [pontos]
        stations.forEach(s => { seen[s] = []; });
        const st0 = truth.stations[stations[0]].xyz;

        const fixedNames = [];
        for (let k = 0; k < 3; k++) {
            const name = `M${String(k + 1).padStart(2, '0')}`;
            const ang = k * TWO_PI / 3 + U(-0.4, 0.4);
            const r = U(10, 15);
            truth.points[name] = [st0[0] + r * Math.cos(ang), st0[1] + r * Math.sin(ang), st0[2] + U(-1.6, -1.2)];
            fixedNames.push(name);
            seen[stations[0]].push(name);
        }

        let n = 0;
        const newPoint = (center, spread) => {
            n++;
            const name = `P${String(n).padStart(2, '0')}`;
            truth.points[name] = [center[0] + U(-spread, spread), center[1] + U(-spread, spread), center[2] + U(-1.2, 1.2)];
            return name;
        };

        for (let i = 0; i + 1 < stations.length; i++) {
            const a = truth.stations[stations[i]].xyz, b = truth.stations[stations[i + 1]].xyz;
            const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            for (let k = 0; k < cfg.linksPerPair; k++) {
                const p = newPoint(mid, cfg.spacing / 3);
                seen[stations[i]].push(p);
                seen[stations[i + 1]].push(p);
            }
        }
        for (let k = 0; k < cfg.nDetail; k++) {
            const host = stations[Math.floor(rand() * stations.length)];
            const p = newPoint(truth.stations[host].xyz, cfg.spacing * 0.6);
            seen[host].push(p);
            const others = stations.filter(s => s !== host);
            if (others.length && rand() < 0.4) seen[others[Math.floor(rand() * others.length)]].push(p);
        }

        const sAng = S.sigAngSec;
        const rows = [];
        stations.forEach(sName => {
            const st = truth.stations[sName];
            seen[sName].forEach(pName => {
                const o = exactObservation(st.xyz, st.omega, truth.points[pName]);
                const sDist = S.edmMm / 1000 + S.edmPpm * 1e-6 * o.dist;
                const nz = cfg.noise ? 1 : 0;
                const hz = wrap2Pi(o.hz + nz * gaussFrom(rand) * sAng * ARCSEC);
                const zen = o.zen + nz * gaussFrom(rand) * sAng * ARCSEC;
                const dist = o.dist + nz * gaussFrom(rand) * sDist;
                const isFixed = fixedNames.includes(pName);
                rows.push({
                    station: sName, target: pName,
                    hzDeg: hz / DEG, zenDeg: zen / DEG, dist,
                    sHz: sAng, sZen: sAng, sDist,
                    fixed: isFixed,
                    xyz: isFixed && cfg.withCoords ? truth.points[pName].slice() : null,
                    line: rows.length + 2
                });
            });
        });
        return { rows, truth, fixedNames };
    }

    // Erro grosseiro de ±k sigma numa componente (hz | zen | dist) de uma linha.
    // `sigma` é o desvio efetivo da componente (rad ou m), vindo do modelo estocástico.
    function injectBlunder(row, component, k, sigma, sign) {
        const sgn = sign || (Math.random() > 0.5 ? 1 : -1);
        const off = sgn * k * sigma;
        if (component === 'hz') row.hzDeg = (((row.hzDeg + off / DEG) % 360) + 360) % 360;
        else if (component === 'zen') row.zenDeg += off / DEG;
        else row.dist += off;
        row.hasBlunder = true;
        row.blunder = { component, k, offset: off };
        return row.blunder;
    }

    // --- Exportação ---

    function matrixToCSV(mat, colNames) {
        if (!mat || !mat.length) return '';
        const head = colNames ? colNames.map(csvCell).join(',') + '\n' : '';
        if (!Array.isArray(mat[0])) return head + mat.map(v => fmt(v)).join('\n') + '\n';
        return head + mat.map(row => row.map(v => fmt(v)).join(',')).join('\n') + '\n';
    }

    function fmt(v) {
        if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
        if (v === 0) return '0';
        const a = Math.abs(v);
        if (a < 1e-4 || a >= 1e6) return v.toExponential(10);
        return v.toPrecision(12).replace(/0+$/, '').replace(/\.$/, '');
    }

    // toFixed sem o "-0.000" de resíduos que arredondam a zero
    function fixedDec(v, d) {
        if (v === null || v === undefined || !Number.isFinite(v)) return '';
        const s = v.toFixed(d);
        return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
    }

    // Coordenadas ajustadas: uma linha por ponto (estações, pontos fixos e livres)
    function coordinatesToCSV(result) {
        const out = [tr('Ponto,Tipo,X,Y,Z,sigma_X,sigma_Y,sigma_Z,omega_graus,sigma_omega_seg,' +
            'semieixo_a_mm,semieixo_b_mm,semieixo_c_mm,nivel_confianca',
            'Point,Type,X,Y,Z,sigma_X,sigma_Y,sigma_Z,omega_deg,sigma_omega_arcsec,' +
            'semiaxis_a_mm,semiaxis_b_mm,semiaxis_c_mm,confidence_level')];
        result.pointResults.forEach(p => {
            const ax = p.ellipsoid ? p.ellipsoid.axes.map(a => fixedDec(a * 1000, 4)) : ['', '', ''];
            out.push([
                csvCell(p.name), termOf(p.tipo),
                fixedDec(p.xyz[0], 5), fixedDec(p.xyz[1], 5), fixedDec(p.xyz[2], 5),
                fixedDec(p.sigma[0], 6), fixedDec(p.sigma[1], 6), fixedDec(p.sigma[2], 6),
                p.omega !== null ? fixedDec(p.omega / DEG, 9) : '',
                p.sigmaOmega !== null ? fixedDec(p.sigmaOmega / ARCSEC, 3) : '',
                ...ax, p.ellipsoid ? result.confLabel : ''
            ].join(','));
        });
        return out.join('\n') + '\n';
    }

    // Resíduos: uma linha por visada, com as três componentes
    function residualsToCSV(result, rows) {
        // Unidades no nome da coluna: ângulos ajustados em graus, resíduos angulares em
        // segundos, distância ajustada em m e resíduo/MDB da distância em mm
        const comp = [['Hz', 'graus', 'seg'], ['Zen', 'graus', 'seg'], ['D', 'm', 'mm']];
        const head = tr(['Estacao', 'Ponto Visado', 'ativa', 'outlier'], ['Station', 'Sighted Point', 'active', 'outlier']);
        comp.forEach(([c, uL, uV]) => head.push(`${c}_${tr('ajustado', 'adjusted')}_${uL}`, `v_${c}_${uV}`, `w_${c}`, `r_${c}`, `MDB_${c}_${uV}`));
        const out = [head.join(',')];
        const byRow = new Map(result.obsData.map(o => [o.row.idx, o]));
        rows.forEach(r => {
            const o = byRow.get(r.idx);
            const cells = [csvCell(r.station), csvCell(r.target), r.active ? tr('sim', 'yes') : tr('não', 'no'), r.flagged ? tr('sim', 'yes') : tr('não', 'no')];
            if (!o) { comp.forEach(() => cells.push('', '', '', '', '')); out.push(cells.join(',')); return; }
            for (let c = 0; c < 3; c++) {
                const ang = c < 2;
                cells.push(
                    ang ? fixedDec(o.La[c] / DEG, 9) : fixedDec(o.La[c], 5),
                    ang ? fixedDec(o.v[c] / ARCSEC, 3) : fixedDec(o.v[c] * 1000, 3),
                    fixedDec(o.w[c], 3), fixedDec(o.r[c], 4),
                    o.mdb[c] === null ? '' : (ang ? fixedDec(o.mdb[c] / ARCSEC, 2) : fixedDec(o.mdb[c] * 1000, 2))
                );
            }
            out.push(cells.join(','));
        });
        return out.join('\n') + '\n';
    }

    function download(filename, content, mime = 'text/csv;charset=utf-8') {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
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
        ARCSEC, DEG, TWO_PI, DEFAULT_SETTINGS, CANONICAL_HEADER,
        normKey, splitLine, parseBool, parseCSV, buildRows, rowsToCSV,
        seededRandom, gaussFrom, wrap2Pi, exactObservation, generateSyntheticNetwork, injectBlunder,
        matrixToCSV, fmt, coordinatesToCSV, residualsToCSV, download
    };
});
