// --- Pré-processamento das observações brutas da estação total (interseção a ré 3D) ---
// Entrada: cadernetas com várias séries de pontarias em posição direta (PD, Z < 180°) e
// inversa (PI, Z > 180°) por visada. Saída: uma linha por visada no formato de
// inputs/observations.csv, com valor e desvio-padrão escolhidos por uma política de
// exportação independente para cada observável (leitura horizontal, zenital, distância).
// Também estima os erros de índice vertical e de colimação globais e marca leituras
// individuais que discordam das demais do mesmo grupo.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Preproc = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);
    const IO = typeof RedeIO !== 'undefined' ? RedeIO : require('./io.js');
    const NA = typeof NetAdjust !== 'undefined' ? NetAdjust : require('./adjustment.js');

    const DEG = Math.PI / 180;
    const OBS = ['hz', 'z', 'd'];

    const DEFAULT_SETTINGS = {
        angleFormat: 'gmmss',   // gmmss (g.mmss compactado) | deg (graus decimais) | dms3 (G, M, S em 3 colunas)
        stdConv: 'sample',      // sample (n − 1) | population (n)
        sigAngSec: 2.0,         // σ nominal de UMA leitura angular (pontaria + leitura), ″
        edmMm: 2.0,             // σ nominal da distância: parcela constante (mm)
        edmPpm: 2.0,            // e proporcional (ppm), somadas como no gerador sintético de io.js
        floorAngSec: 0.5,       // piso dos desvios exportados (evita σ = 0 → peso infinito)
        floorDistMm: 0.1,
        hz: { value: 'series', sigma: 'empirical', series: 1, face: 'PD' },
        z: { value: 'series', sigma: 'empirical', series: 1, face: 'PD' },
        d: { value: 'all', sigma: 'empirical', n: 4 },
        trim: 'ksigma',         // eliminação de extremos nos erros globais: none | ksigma | pct
        trimK: 2.5,
        trimPct: 10,
        flagMethod: 'pooled',   // pooled (k·σ da rede) | nominal (k·σ nominal) | mad (escore robusto) | grubbs
        flagK: 3.0,
        flagAlphaPct: 5.0,
        groupK: 2.5             // razão σ do grupo / σ de referência acima da qual o grupo é marcado
    };

    const PRESETS = {
        default: {
            stdConv: 'sample', floorAngSec: 0.5, floorDistMm: 0.1,
            hz: { value: 'series', sigma: 'empirical' }, z: { value: 'series', sigma: 'empirical' },
            d: { value: 'all', sigma: 'empirical' }
        },
        reference: {
            stdConv: 'population', floorAngSec: 0.1, floorDistMm: 0.01,
            hz: { value: 'reduced', sigma: 'empirical' }, z: { value: 'reduced', sigma: 'empirical' },
            d: { value: 'all', sigma: 'empirical' }
        },
        oneSeries: {
            hz: { value: 'oneSeries', sigma: 'nominal', series: 1 }, z: { value: 'oneSeries', sigma: 'nominal', series: 1 },
            d: { value: 'one', sigma: 'nominal' }
        },
        oneFace: {
            hz: { value: 'oneFace', sigma: 'nominal', series: 1, face: 'PD' }, z: { value: 'oneFace', sigma: 'nominal', series: 1, face: 'PD' },
            d: { value: 'one', sigma: 'nominal' }
        },
        nominal: {
            hz: { value: 'series', sigma: 'nominal' }, z: { value: 'series', sigma: 'nominal' },
            d: { value: 'all', sigma: 'nominal' }
        },
        index: {
            hz: { value: 'series', sigma: 'empirical' }, z: { value: 'facePlusCorr', sigma: 'empirical', face: 'PD' },
            d: { value: 'all', sigma: 'empirical' }
        }
    };

    function mergeSettings(base, over) {
        const out = Object.assign({}, base, over);
        OBS.forEach(o => { out[o] = Object.assign({}, base[o], over && over[o]); });
        return out;
    }

    function applyPreset(settings, name) {
        return mergeSettings(settings, PRESETS[name] || {});
    }

    // ------------------------------------------------------------------ ângulos

    // g.mmss compactado: 134.1704 = 134°17′04″. O CSV costuma perder os zeros à direita
    // (163.033 = 163°03′30″), por isso a parte fracionária é completada até 4 dígitos;
    // dígitos além do quarto são frações de segundo (134.17045 = 134°17′04,5″).
    function gmmssToDeg(text) {
        const t = String(text).trim().replace(',', '.');
        if (!/^[-+]?\d*(\.\d*)?$/.test(t) || !/\d/.test(t)) return { error: 'num' };
        const neg = t.startsWith('-');
        const [ip, fp = ''] = t.replace(/^[-+]/, '').split('.');
        const f = (fp + '0000');
        const d = Number(ip || '0'), m = Number(f.slice(0, 2));
        const s = Number(f.slice(2, 4) + '.' + (f.slice(4) || '0'));
        if (m >= 60 || s >= 60) return { error: 'range' };
        const v = d + m / 60 + s / 3600;
        return { value: neg ? -v : v };
    }

    function dmsToDeg(dText, mText, sText) {
        const p = x => Number(String(x).trim().replace(',', '.'));
        const d = p(dText), m = p(mText || 0), s = p(sText || 0);
        if (![d, m, s].every(Number.isFinite)) return { error: 'num' };
        if (m < 0 || m >= 60 || s < 0 || s >= 60) return { error: 'range' };
        const neg = String(dText).trim().startsWith('-');
        const v = Math.abs(d) + m / 60 + s / 3600;
        return { value: neg ? -v : v };
    }

    function degToDms(deg, decimals = 1) {
        const neg = deg < 0;
        let a = Math.abs(deg);
        let d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf);
        let s = Number(((mf - m) * 60).toFixed(decimals));
        if (s >= 60) { s -= 60; m += 1; }
        if (m >= 60) { m -= 60; d += 1; }
        const ss = s.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, '0');
        return `${neg ? '-' : ''}${d}°${String(m).padStart(2, '0')}′${ss}″`;
    }

    const wrap360 = a => ((a % 360) + 360) % 360;
    const wrapPM180 = a => wrap360(a + 180) - 180;

    // ------------------------------------------------------------------ estatística

    function mean(v) { return v.reduce((a, b) => a + b, 0) / v.length; }
    function median(v) {
        const s = v.slice().sort((a, b) => a - b), n = s.length;
        return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    }
    // Desvio-padrão: amostral (n − 1) ou populacional (n); null se não houver graus de liberdade
    function stdDev(v, conv) {
        const n = v.length, den = conv === 'population' ? n : n - 1;
        if (n < 2 || den < 1) return null;
        const m = mean(v);
        return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / den);
    }

    function grubbsCritical(n, alpha) {
        const t = NA.tInv(1 - alpha / (2 * n), n - 2);
        return (n - 1) / Math.sqrt(n) * Math.sqrt(t * t / (n - 2 + t * t));
    }

    // Eliminação de extremos de uma amostra { key, val }: devolve a média, o desvio de uma
    // observação, o desvio da média e quais valores ficaram de fora
    function trimmedStats(items, S) {
        let kept = items.slice();
        const removed = new Set();
        if (S.trim === 'ksigma') {
            while (kept.length > 3) {
                const vals = kept.map(i => i.val), m = mean(vals), s = stdDev(vals, 'sample');
                if (!s) break;
                let worst = null;
                kept.forEach(i => { if (!worst || Math.abs(i.val - m) > Math.abs(worst.val - m)) worst = i; });
                if (Math.abs(worst.val - m) <= S.trimK * s) break;
                removed.add(worst); kept = kept.filter(i => i !== worst);
            }
        } else if (S.trim === 'pct') {
            const q = Math.floor(kept.length * Math.max(0, Math.min(45, S.trimPct)) / 100);
            if (q > 0 && kept.length - 2 * q >= 2) {
                const sorted = kept.slice().sort((a, b) => a.val - b.val);
                sorted.slice(0, q).concat(sorted.slice(-q)).forEach(i => removed.add(i));
                kept = kept.filter(i => !removed.has(i));
            }
        }
        const vals = kept.map(i => i.val);
        const s = vals.length ? stdDev(vals, S.stdConv) : null;
        return {
            mean: vals.length ? mean(vals) : null,
            s, sMean: s === null ? null : s / Math.sqrt(vals.length),
            m: vals.length, mTotal: items.length,
            values: items.map(i => Object.assign({}, i, { trimmed: removed.has(i) }))
        };
    }

    // ------------------------------------------------------------------ leitura

    // Classificação dos cabeçalhos pelas palavras-chave (minúsculas, sem acento)
    function classifyHeader(key) {
        if (/zenit|vertical|^zen$|^z$|^v$/.test(key)) return 'z';
        if (/horizont|externo|interno|^hz|direc|^h$|leitura/.test(key)) return 'hz';
        if (/distan|^dist|slope|^sd$|^d$|inclin/.test(key)) return 'd';
        if (/estac|station|^est$|ocupad/.test(key)) return 'station';
        if (/visad|ponto|marco|target|alvo|^pv$/.test(key)) return 'target';
        return null;
    }

    // Sugere o formato angular a partir do cabeçalho e da quantidade de colunas
    function detectFormat(text) {
        const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
        if (!lines.length) return null;
        const head = lines[0], sep = head.indexOf(';') >= 0 ? ';' : ',';
        const n = IO.splitLine(head, sep).length;
        if (/mmss/i.test(head)) return 'gmmss';
        if (n >= 9) return 'dms3';
        if (/graus|decimal|degree|\(°\)/i.test(head)) return 'deg';
        const second = lines[1] ? IO.splitLine(lines[1], sep) : [];
        // Leituras com 4 casas e minutos/segundos < 60 sugerem g.mmss
        const angs = second.slice(2, 4).map(s => s.replace(',', '.'));
        if (angs.length === 2 && angs.every(a => /^\d+\.\d{3,5}$/.test(a) && gmmssToDeg(a).value !== undefined)) return 'gmmss';
        return 'deg';
    }

    // Lê a caderneta bruta. Devolve leituras em graus decimais, na ordem do arquivo.
    function parseRaw(text, opts) {
        const fmtA = (opts && opts.angleFormat) || 'gmmss';
        const readings = [], errors = [], warnings = [];
        const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
        let map = null, sep = ',';
        lines.forEach((rawLine, i) => {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) return;
            const ln = i + 1;
            if (!map) {
                sep = line.indexOf(';') >= 0 ? ';' : ',';
                const parts = IO.splitLine(line, sep);
                const numeric = parts.slice(2).every(p => p === '' || Number.isFinite(Number(p.replace(',', '.'))));
                map = buildMap(parts, fmtA, !numeric);
                if (map.error) { errors.push(map.error); map = { dead: true }; return; }
                if (!map.header) warnings.push(tr('Cabeçalho não reconhecido; colunas lidas na ordem: estação, ponto, ângulos, distância.',
                    'Header not recognised; columns read in the order: station, point, angles, distance.'));
                if (!numeric) return; // linha de cabeçalho (reconhecido ou não) não é dado
            }
            if (map.dead) return;
            const parts = IO.splitLine(line, sep);
            const cell = k => (map[k] !== undefined && parts[map[k]] !== undefined) ? parts[map[k]] : '';
            const station = cell('station').trim(), target = cell('target').trim();
            if (!station || !target) { errors.push(tr(`Linha ${ln}: estação e ponto visado são obrigatórios.`, `Line ${ln}: station and sighted point are required.`)); return; }

            const ang = which => {
                if (fmtA === 'dms3') return dmsToDeg(cell(which + '_d'), cell(which + '_m'), cell(which + '_s'));
                const t = cell(which);
                if (fmtA === 'gmmss') return gmmssToDeg(t);
                const v = Number(String(t).trim().replace(',', '.'));
                return String(t).trim() !== '' && Number.isFinite(v) ? { value: v } : { error: 'num' };
            };
            const hz = ang('hz'), z = ang('z');
            const dText = cell('d').trim().replace(',', '.');
            const d = Number(dText);
            const bad = [];
            [[hz, tr('leitura horizontal', 'horizontal reading')], [z, tr('ângulo zenital', 'zenith angle')]].forEach(([a, name]) => {
                if (a.error === 'range') bad.push(tr(`${name} com minutos ou segundos ≥ 60`, `${name} with minutes or seconds ≥ 60`));
                else if (a.error) bad.push(tr(`${name} não numérico`, `non-numeric ${name}`));
            });
            if (dText === '' || !Number.isFinite(d)) bad.push(tr('distância não numérica', 'non-numeric distance'));
            else if (!(d > 0)) bad.push(tr('distância deve ser maior que zero', 'distance must be greater than zero'));
            if (!bad.length && !(z.value > 0 && z.value < 360 && Math.abs(z.value - 180) > 1e-9))
                bad.push(tr('ângulo zenital fora de (0°, 360°) ou igual a 180°', 'zenith angle outside (0°, 360°) or equal to 180°'));
            if (bad.length) { errors.push(tr(`Linha ${ln}: `, `Line ${ln}: `) + bad.join('; ') + '.'); return; }
            readings.push({ line: ln, station, target, hz: wrap360(hz.value), z: z.value, d });
        });
        if (!map) errors.push(tr('Arquivo vazio.', 'Empty file.'));
        return { readings, errors, warnings };
    }

    function buildMap(parts, fmtA, hasHeader) {
        const keys = parts.map(p => IO.normKey(p));
        const map = { header: false };
        if (hasHeader) {
            const cls = keys.map(classifyHeader);
            ['station', 'target', 'd'].forEach(k => { const i = cls.indexOf(k); if (i >= 0) map[k] = i; });
            // Nomes não reconhecidos nas duas primeiras colunas: estação e ponto, nessa ordem
            if (map.station === undefined && !cls[0]) map.station = 0;
            if (map.target === undefined && !cls[1] && map.station !== 1) map.target = 1;
            if (fmtA === 'dms3') {
                // As seis colunas angulares restantes, na ordem: Hz (G, M, S) e Z (G, M, S)
                const rest = parts.map((_, i) => i).filter(i => ![map.station, map.target, map.d].includes(i));
                if (rest.length < 6) return { error: tr('Formato G/M/S em 3 colunas exige 6 colunas angulares (Hz G, M, S e Z G, M, S).', 'D/M/S in 3 columns needs 6 angle columns (Hz D, M, S and Z D, M, S).') };
                ['hz_d', 'hz_m', 'hz_s', 'z_d', 'z_m', 'z_s'].forEach((k, j) => { map[k] = rest[j]; });
            } else {
                ['hz', 'z'].forEach(k => { const i = cls.indexOf(k); if (i >= 0) map[k] = i; });
            }
            const need = fmtA === 'dms3' ? ['station', 'target', 'd'] : ['station', 'target', 'hz', 'z', 'd'];
            const missing = need.filter(k => map[k] === undefined);
            if (!missing.length) { map.header = true; return map; }
            if (keys.filter(k => classifyHeader(k)).length >= 3)
                return { error: tr(`Cabeçalho sem as colunas: ${missing.join(', ')}.`, `Header missing columns: ${missing.join(', ')}.`) };
        }
        const order = fmtA === 'dms3'
            ? ['station', 'target', 'hz_d', 'hz_m', 'hz_s', 'z_d', 'z_m', 'z_s', 'd']
            : ['station', 'target', 'hz', 'z', 'd'];
        const m = { header: false };
        order.forEach((k, i) => { m[k] = i; });
        return m;
    }

    // ------------------------------------------------------------------ estrutura

    // Agrupa por (estação, ponto) na ordem do arquivo; face pela leitura zenital; a k-ésima
    // PD forma a série k com a k-ésima PI
    function buildGroups(readings) {
        const groups = [], byKey = new Map();
        readings.forEach((r, idx) => {
            const key = r.station + '\u0000' + r.target;
            let g = byKey.get(key);
            if (!g) {
                g = { key, idx: groups.length, station: r.station, target: r.target, readings: [], pairs: [] };
                byKey.set(key, g); groups.push(g);
            }
            const face = r.z < 180 ? 'PD' : 'PI';
            const k = g.readings.filter(x => x.face === face).length + 1;
            g.readings.push(Object.assign({}, r, {
                idx, face, k, gIdx: g.idx,
                use: { hz: true, z: true, d: true },
                res: { hz: null, z: null, d: null },
                flags: { hz: [], z: [], d: [] }
            }));
        });
        const warnings = [];
        groups.forEach(g => {
            const pd = g.readings.filter(r => r.face === 'PD'), pi = g.readings.filter(r => r.face === 'PI');
            for (let k = 0; k < Math.min(pd.length, pi.length); k++) g.pairs.push({ k: k + 1, pd: pd[k], pi: pi[k] });
            if (pd.length !== pi.length) warnings.push(tr(
                `${g.station}→${g.target}: ${pd.length} leitura(s) em PD e ${pi.length} em PI; as sobras não formam série.`,
                `${g.station}→${g.target}: ${pd.length} face-left (PD) and ${pi.length} face-right (PI) reading(s); the leftovers form no series.`));
        });
        warnings.push(...duplicateStationWarnings(groups));
        return { groups, warnings };
    }

    // Leituras idênticas em estações diferentes são cópia e cola na caderneta: duas
    // estações não medem o mesmo ponto com os mesmos Hz, Z e S. Se o bloco inteiro de uma
    // estação repete o de outra, um único aviso; senão, um por visada copiada.
    function duplicateStationWarnings(groups) {
        const sigOf = g => g.readings.map(r => [r.hz, r.z, r.d].join('|')).join(';');
        const byStation = new Map();
        groups.forEach(g => {
            if (!byStation.has(g.station)) byStation.set(g.station, []);
            byStation.get(g.station).push(g);
        });
        const st = [...byStation.keys()], out = [], wholeCopy = new Set();
        const block = s => byStation.get(s).map(g => g.target + '@' + sigOf(g)).sort().join('#');
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
            if (block(st[i]) !== block(st[j])) continue;
            wholeCopy.add(st[j]);
            out.push(tr(
                `As leituras da estação ${st[j]} são idênticas às da estação ${st[i]} — provável cópia na caderneta.`,
                `Station ${st[j]} readings are identical to station ${st[i]} — probably copied in the field book.`));
        }
        const first = new Map(); // assinatura -> primeira visada com ela
        groups.forEach(g => {
            const s = sigOf(g), prev = first.get(s);
            if (!prev) { first.set(s, g); return; }
            if (prev.station === g.station || wholeCopy.has(g.station)) return;
            out.push(tr(
                `${g.station}→${g.target}: leituras idênticas às de ${prev.station}→${prev.target} — provável cópia na caderneta.`,
                `${g.station}→${g.target}: readings identical to ${prev.station}→${prev.target} — probably copied in the field book.`));
        });
        return out;
    }

    // ------------------------------------------------------------------ reduções

    // Leitura reduzida à PD: Hz_PI − 180° e 360° − Z_PI
    const redHz = r => wrap360(r.face === 'PD' ? r.hz : r.hz - 180);
    const redZ = r => r.face === 'PD' ? r.z : 360 - r.z;
    const sgn = r => r.face === 'PD' ? 1 : -1;

    // Referência angular do grupo (evita a descontinuidade 0°/360° nas médias)
    function hzRef(g) { return g.readings.length ? redHz(g.readings[0]) : 0; }
    const hzOff = (g, r) => wrapPM180(redHz(r) - g.ref) * 3600; // ″

    function pairsUsing(g, obs) { return g.pairs.filter(p => p.pd.use[obs] && p.pi.use[obs]); }

    // Valores por série (″): Hz_k = (Hz_PD + Hz_PI ∓ 180)/2 (relativo à referência);
    // Z_k = (Z_PD − Z_PI + 360)/2; c_k = (Hz_PD − (Hz_PI ∓ 180))/2; ε_k = (Z_PD + Z_PI − 360)/2
    function seriesValues(g, obs) {
        return pairsUsing(g, obs).map(p => {
            if (obs === 'hz') {
                const a = hzOff(g, p.pd), b = hzOff(g, p.pi);
                return { k: p.k, val: (a + b) / 2, half: (a - b) / 2, pair: p };
            }
            return { k: p.k, val: (redZ(p.pd) + redZ(p.pi)) / 2 * 3600, half: (p.pd.z + p.pi.z - 360) / 2 * 3600, pair: p };
        });
    }

    function groupZenithDeg(g) {
        const s = seriesValues(g, 'z');
        if (s.length) return mean(s.map(x => x.val)) / 3600;
        const r = g.readings.filter(x => x.use.z);
        return r.length ? mean(r.map(redZ)) : 90;
    }

    // Erro de índice vertical global (ε) e de colimação global (c, na forma constante
    // c = c_k·sen Z) a partir de todas as séries completas de todas as visadas
    function globalErrors(groups, S) {
        const eps = [], col = [];
        groups.forEach(g => {
            seriesValues(g, 'z').forEach(s => eps.push({ key: `${g.station}→${g.target} #${s.k}`, g: g.idx, k: s.k, val: s.half }));
            seriesValues(g, 'hz').forEach(s => {
                const zk = (redZ(s.pair.pd) + redZ(s.pair.pi)) / 2;
                col.push({ key: `${g.station}→${g.target} #${s.k}`, g: g.idx, k: s.k, val: s.half * Math.sin(zk * DEG) });
            });
        });
        const nominal = m => S.sigAngSec / Math.sqrt(2) / Math.sqrt(Math.max(1, m));
        const index = trimmedStats(eps, S), coll = trimmedStats(col, S);
        index.sMeanNom = nominal(index.m); coll.sMeanNom = nominal(coll.m);
        return { index, coll };
    }

    // ------------------------------------------------------------------ políticas

    // Combina valores (″ ou m) com σ nominal por valor e, opcionalmente, a variância de
    // uma correção estimada (erro de índice/colimação global)
    function combine(values, conv, nomEach, extra, useMedian) {
        const n = values.length;
        const center = useMedian ? median(values) : mean(values);
        const eff = useMedian && n > 2 ? Math.sqrt(Math.PI / 2) : 1; // eficiência assintótica da mediana
        const s = stdDev(values, conv);
        const emp = s === null ? null : eff * s / Math.sqrt(n);
        const nom = eff * nomEach / Math.sqrt(n);
        const ex = extra || { emp: 0, nom: 0 };
        return {
            value: center, n,
            sigmaEmp: emp === null ? null : Math.hypot(emp, ex.emp || 0),
            sigmaNom: Math.hypot(nom, ex.nom || 0)
        };
    }

    function pickSigma(c, rule, notes) {
        if (rule === 'nominal') return c.sigmaNom;
        if (c.sigmaEmp === null) { notes.push({ code: 'fallbackNominal', n: c.n }); return c.sigmaNom; }
        return rule === 'max' ? Math.max(c.sigmaEmp, c.sigmaNom) : c.sigmaEmp;
    }

    function pickSeries(list, k, notes) {
        const hit = list.find(s => s.k === k);
        if (hit) return hit;
        if (list.length) { notes.push({ code: 'seriesMissing', k, used: list[0].k }); return list[0]; }
        return null;
    }

    function angleOutput(g, obs, S, glob) {
        const P = S[obs], notes = [];
        const sig0 = S.sigAngSec;
        const used = g.readings.filter(r => r.use[obs]);
        const red = r => obs === 'hz' ? hzOff(g, r) : redZ(r) * 3600;
        let c = null, value = P.value;
        const series = seriesValues(g, obs);

        if (value === 'series' && !series.length) { notes.push({ code: 'noPairs' }); value = 'reduced'; }
        if (value === 'oneSeries' && !series.length) { notes.push({ code: 'noPairs' }); value = 'oneFace'; }

        if (value === 'series') {
            c = combine(series.map(s => s.val), S.stdConv, sig0 / Math.SQRT2);
        } else if (value === 'reduced') {
            if (!used.length) return { valid: false, notes: [{ code: 'noReadings' }] };
            c = combine(used.map(red), S.stdConv, sig0);
        } else if (value === 'oneSeries') {
            const s = pickSeries(series, P.series, notes);
            c = combine([s.val], S.stdConv, sig0 / Math.SQRT2);
        } else if (value === 'oneFace') {
            const face = used.filter(r => r.face === P.face);
            const list = face.map(r => ({ k: r.k, val: red(r) }));
            if (!list.length) return { valid: false, notes: [{ code: 'noFace', face: P.face }] };
            const s = pickSeries(list, P.series, notes);
            c = combine([s.val], S.stdConv, sig0);
            if (obs === 'z') notes.push({ code: 'uncorrectedIndex' });
            else notes.push({ code: 'uncorrectedColl' });
        } else if (value === 'facePlusCorr') {
            const face = used.filter(r => r.face === P.face);
            const G = obs === 'z' ? glob.index : glob.coll;
            if (!face.length) return { valid: false, notes: [{ code: 'noFace', face: P.face }] };
            if (G.mean === null) return { valid: false, notes: [{ code: 'noGlobal' }] };
            // PD = verdadeiro + e, PI reduzida = verdadeiro − e  →  corrige com ∓ e
            let scale = 1;
            if (obs === 'hz') scale = 1 / Math.sin(groupZenithDeg(g) * DEG); // efeito da colimação na direção: c / sen Z
            const vals = face.map(r => red(r) - sgn(r) * G.mean * scale);
            const extra = { emp: (G.sMean === null ? G.sMeanNom : G.sMean) * scale, nom: G.sMeanNom * scale };
            if (G.sMean === null) notes.push({ code: 'globalNominal' });
            c = combine(vals, S.stdConv, sig0, extra);
        }
        if (!c) return { valid: false, notes: [{ code: 'noReadings' }] };

        let sigma = pickSigma(c, P.sigma, notes);
        if (sigma < S.floorAngSec) { notes.push({ code: 'floor', from: sigma }); sigma = S.floorAngSec; }
        const valueDeg = obs === 'hz' ? wrap360(g.ref + c.value / 3600) : c.value / 3600;
        return { valid: true, value: valueDeg, sigma, n: c.n, sigmaEmp: c.sigmaEmp, sigmaNom: c.sigmaNom, notes };
    }

    function distNominal(S, d) { return S.edmMm / 1000 + S.edmPpm * 1e-6 * d; }

    function distOutput(g, S) {
        const P = S.d, notes = [];
        let used = g.readings.filter(r => r.use.d);
        if (!used.length) return { valid: false, notes: [{ code: 'noReadings' }] };
        if (P.value === 'firstN') {
            const n = Math.max(1, Math.round(P.n || 1));
            if (used.length < n) notes.push({ code: 'fewerThanN', n, have: used.length });
            used = used.slice(0, n);
        } else if (P.value === 'one') used = used.slice(0, 1);
        const vals = used.map(r => r.d);
        const c = combine(vals, S.stdConv, distNominal(S, mean(vals)), null, P.value === 'median');
        let sigma = pickSigma(c, P.sigma, notes);
        const floor = S.floorDistMm / 1000;
        if (sigma < floor) { notes.push({ code: 'floor', from: sigma }); sigma = floor; }
        return { valid: true, value: c.value, sigma, n: c.n, sigmaEmp: c.sigmaEmp, sigmaNom: c.sigmaNom, notes, readings: used.map(r => r.idx) };
    }

    // ------------------------------------------------------------------ triagem

    // Erro de colimação/índice removido das leituras na triagem: o global (constante do
    // instrumento, robusto) quando há ao menos 3 séries; senão a mediana das séries do grupo
    function screenCorrection(g, obs, glob) {
        const G = glob && (obs === 'z' ? glob.index : glob.coll);
        if (G && G.m >= 3 && G.mean !== null)
            return { e: obs === 'hz' ? G.mean / Math.sin(groupZenithDeg(g) * DEG) : G.mean, params: 0 };
        const series = seriesValues(g, obs);
        return series.length ? { e: median(series.map(s => s.half)), params: 1 } : { e: 0, params: 0 };
    }

    // Valores de teste por leitura: ângulos reduzidos à PD e livres do erro de colimação/
    // índice (cada leitura isolada tem σ ≈ σ de uma leitura); distâncias brutas em mm
    function testValues(g, obs, glob) {
        if (obs === 'd') return g.readings.map(r => ({ r, val: r.d * 1000 }));
        const { e } = screenCorrection(g, obs, glob);
        return g.readings.map(r => ({ r, val: (obs === 'hz' ? hzOff(g, r) : redZ(r) * 3600) - sgn(r) * e }));
    }

    // σ de UMA leitura estimado com todas as visadas da rede (variância combinada dos
    // desvios em relação à média de cada grupo; se o erro de colimação/índice vier do
    // próprio grupo, consome mais um grau de liberdade). Duas passagens descartam desvios > 3σ.
    function pooledSigma(groups, obs, glob) {
        const sets = groups.map(g => {
            const vals = testValues(g, obs, glob).filter(t => t.r.use[obs]).map(t => t.val);
            const params = 1 + (obs !== 'd' ? screenCorrection(g, obs, glob).params : 0);
            return { vals, params };
        });
        let sigma = null, dof = 0;
        for (let pass = 0; pass < 3; pass++) {
            let ss = 0; dof = 0;
            sets.forEach(({ vals, params }) => {
                let v = vals;
                if (sigma) {
                    const m0 = mean(vals);
                    v = vals.filter(x => Math.abs(x - m0) <= 3 * sigma);
                }
                if (v.length <= params) return;
                const m = mean(v);
                ss += v.reduce((a, x) => a + (x - m) * (x - m), 0);
                dof += v.length - params;
            });
            if (!dof) return { sigma: null, dof: 0 };
            sigma = Math.sqrt(ss / dof);
        }
        return { sigma, dof };
    }

    // σ de uma leitura usado na triagem: nominal, ou o estimado da rede (pooled)
    function refSigma(S, glob, obs, nominal) {
        if (S.flagMethod === 'nominal') return nominal;
        const p = glob.pooled && glob.pooled[obs];
        return p && p.sigma ? p.sigma : nominal;
    }

    function screenGroup(g, S, glob) {
        const flagsOut = [];
        OBS.forEach(obs => {
            g.readings.forEach(r => { r.flags[obs] = []; r.res[obs] = null; });
            const tv = testValues(g, obs, glob);
            const inc = tv.filter(t => t.r.use[obs]);
            const nominal = obs === 'd' ? distNominal(S, g.readings[0].d) * 1000 : S.sigAngSec;
            const sigma = refSigma(S, glob, obs, nominal);
            // Resíduo em relação à média das DEMAIS leituras incluídas (e ainda não marcadas)
            const residuals = pool => tv.forEach(t => {
                const others = pool.filter(o => o !== t);
                t.r.res[obs] = others.length ? t.val - mean(others.map(o => o.val)) : null;
            });
            residuals(inc);
            if (inc.length >= 3) {
                if (S.flagMethod === 'nominal' || S.flagMethod === 'pooled') {
                    // Uma leitura por vez: marca a pior e a retira da referência das demais,
                    // para que um erro grosseiro não contamine os resíduos das vizinhas
                    let pool = inc.slice();
                    while (pool.length >= 3) {
                        const m = pool.length, lim = S.flagK * sigma * Math.sqrt(m / (m - 1));
                        residuals(pool);
                        let worst = null;
                        pool.forEach(t => { if (!worst || Math.abs(t.r.res[obs]) > Math.abs(worst.r.res[obs])) worst = t; });
                        if (Math.abs(worst.r.res[obs]) <= lim) break;
                        worst.r.flags[obs].push({ code: S.flagMethod, ratio: Math.abs(worst.r.res[obs]) / lim * S.flagK });
                        pool = pool.filter(t => t !== worst);
                    }
                    residuals(pool);
                } else if (S.flagMethod === 'mad') {
                    const vals = inc.map(t => t.val), med = median(vals);
                    let scale = 1.4826 * median(vals.map(v => Math.abs(v - med)));
                    if (!(scale > 0)) scale = sigma;
                    inc.forEach(t => { const zs = Math.abs(t.val - med) / scale; if (zs > S.flagK) t.r.flags[obs].push({ code: 'mad', ratio: zs }); });
                } else if (S.flagMethod === 'grubbs') {
                    let pool = inc.slice();
                    while (pool.length >= 3) {
                        const vals = pool.map(t => t.val), mu = mean(vals), s = stdDev(vals, 'sample');
                        if (!s) break;
                        let worst = pool[0];
                        pool.forEach(t => { if (Math.abs(t.val - mu) > Math.abs(worst.val - mu)) worst = t; });
                        const G = Math.abs(worst.val - mu) / s, Gc = grubbsCritical(pool.length, S.flagAlphaPct / 100);
                        if (G <= Gc) break;
                        worst.r.flags[obs].push({ code: 'grubbs', ratio: G / Gc * S.flagK });
                        pool = pool.filter(t => t !== worst);
                    }
                }
            }
        });

        // Séries cujo erro de índice/colimação destoa do global: pontaria ruim numa das faces
        [['z', glob.index], ['hz', glob.coll]].forEach(([obs, G]) => {
            if (G.m < 3 || !G.s) return;
            G.values.filter(v => v.g === g.idx).forEach(v => {
                const dev = Math.abs(v.val - G.mean);
                if (dev > S.flagK * G.s) {
                    const p = g.pairs.find(q => q.k === v.k);
                    [p.pd, p.pi].forEach(r => r.flags[obs].push({ code: obs === 'z' ? 'indexPair' : 'collPair', k: v.k, ratio: dev / G.s }));
                }
            });
        });

        // Dispersão do grupo muito acima da referência (σ da rede ou nominal)
        const ratios = {};
        ['hz', 'z'].forEach(obs => {
            const s = seriesValues(g, obs);
            const sd = s.length >= 2 ? stdDev(s.map(x => x.val), 'sample') : null;
            ratios[obs] = sd === null ? null : sd / (refSigma(S, glob, obs, S.sigAngSec) / Math.SQRT2);
        });
        const ds = g.readings.filter(r => r.use.d).map(r => r.d * 1000);
        const sdD = ds.length >= 2 ? stdDev(ds, 'sample') : null;
        ratios.d = sdD === null ? null : sdD / refSigma(S, glob, 'd', distNominal(S, mean(ds) / 1000) * 1000);
        OBS.forEach(obs => { if (ratios[obs] !== null && ratios[obs] > S.groupK) flagsOut.push({ obs, code: 'dispersion', ratio: ratios[obs] }); });
        return { ratios, groupFlags: flagsOut };
    }

    // ------------------------------------------------------------------ cálculo completo

    function compute(groups, settings) {
        const S = mergeSettings(DEFAULT_SETTINGS, settings);
        groups.forEach(g => { g.ref = hzRef(g); });
        const glob = globalErrors(groups, S);
        glob.pooled = {};
        OBS.forEach(o => { glob.pooled[o] = pooledSigma(groups, o, glob); }); // ″ (ângulos) e mm (distância)
        groups.forEach(g => {
            const scr = screenGroup(g, S, glob);
            g.ratios = scr.ratios;
            g.groupFlags = scr.groupFlags;
            g.out = { hz: angleOutput(g, 'hz', S, glob), z: angleOutput(g, 'z', S, glob), d: distOutput(g, S) };
            g.valid = g.out.hz.valid && g.out.z.valid && g.out.d.valid;
            g.nFlags = g.readings.reduce((a, r) => a + OBS.reduce((b, o) => b + (r.use[o] && r.flags[o].length ? 1 : 0), 0), 0);
        });
        return { groups, global: glob, settings: S };
    }

    // Exclui (use = false) as leituras marcadas; devolve quantas foram excluídas
    function excludeFlagged(groups) {
        let n = 0;
        groups.forEach(g => g.readings.forEach(r => OBS.forEach(o => {
            if (r.use[o] && r.flags[o].length) { r.use[o] = false; n++; }
        })));
        return n;
    }

    function includeAll(groups) {
        groups.forEach(g => g.readings.forEach(r => OBS.forEach(o => { r.use[o] = true; })));
    }

    // ------------------------------------------------------------------ textos

    function noteText(n) {
        switch (n.code) {
            case 'fallbackNominal': return tr(`σ nominal (n = ${n.n}, sem graus de liberdade)`, `nominal σ (n = ${n.n}, no degrees of freedom)`);
            case 'seriesMissing': return tr(`série ${n.k} indisponível; usada a série ${n.used}`, `series ${n.k} unavailable; series ${n.used} used`);
            case 'noPairs': return tr('sem série completa (PD + PI); usadas leituras isoladas', 'no complete series (PD + PI); single readings used');
            case 'noReadings': return tr('nenhuma leitura incluída', 'no reading included');
            case 'noFace': return tr(`nenhuma leitura incluída em ${n.face}`, `no ${n.face} reading included`);
            case 'noGlobal': return tr('erro global indisponível (nenhuma série completa)', 'global error unavailable (no complete series)');
            case 'globalNominal': return tr('σ do erro global nominal (poucas séries)', 'nominal σ for the global error (few series)');
            case 'uncorrectedIndex': return tr('sem correção do erro de índice', 'index error not corrected');
            case 'uncorrectedColl': return tr('sem correção do erro de colimação', 'collimation error not corrected');
            case 'fewerThanN': return tr(`só ${n.have} leitura(s) incluída(s) de ${n.n} pedidas`, `only ${n.have} of ${n.n} requested reading(s) included`);
            case 'floor': return tr('σ elevado ao piso mínimo', 'σ raised to the minimum floor');
            default: return n.code;
        }
    }

    function flagText(f) {
        const r = f.ratio !== undefined ? ` (${f.ratio.toFixed(1)})` : '';
        switch (f.code) {
            case 'nominal': return tr(`resíduo > k·σ nominal${r}`, `residual > k·nominal σ${r}`);
            case 'pooled': return tr(`resíduo > k·σ da rede${r}`, `residual > k·network σ${r}`);
            case 'mad': return tr(`escore robusto (MAD) > k${r}`, `robust score (MAD) > k${r}`);
            case 'grubbs': return tr('extremo pelo teste de Grubbs', 'outlier by Grubbs test');
            case 'indexPair': return tr(`série ${f.k}: erro de índice destoa do global${r}`, `series ${f.k}: index error departs from the global one${r}`);
            case 'collPair': return tr(`série ${f.k}: colimação destoa da global${r}`, `series ${f.k}: collimation departs from the global one${r}`);
            case 'dispersion': return tr(`dispersão ${f.ratio.toFixed(1)}× a de referência`, `scatter ${f.ratio.toFixed(1)}× the reference`);
            default: return f.code;
        }
    }

    // ------------------------------------------------------------------ exportação

    // Linhas no formato de inputs/observations.csv (ângulos em graus, σ angulares em ″,
    // σ da distância em m). `fixed`: Map ponto -> { fixed, xyz|null }
    function toObservationRows(groups, fixed) {
        const rows = [], skipped = [];
        groups.forEach(g => {
            if (!g.valid) { skipped.push(`${g.station}→${g.target}`); return; }
            const f = fixed && fixed.get(g.target);
            rows.push({
                station: g.station, target: g.target,
                hzDeg: g.out.hz.value, sHz: g.out.hz.sigma,
                zenDeg: g.out.z.value, sZen: g.out.z.sigma,
                dist: g.out.d.value, sDist: g.out.d.sigma,
                fixed: !!(f && f.fixed), xyz: f && f.fixed && f.xyz ? f.xyz.slice() : null
            });
        });
        return { rows, skipped };
    }

    function toObservationsCSV(groups, fixed) {
        const { rows, skipped } = toObservationRows(groups, fixed);
        return { csv: IO.rowsToCSV(rows), skipped, n: rows.length };
    }

    // Relatório por leitura bruta: valores, reduções, resíduos, inclusão e marcas
    function toReportCSV(result) {
        const f = v => (v === null || v === undefined || !Number.isFinite(v)) ? '' : IO.fmt(v);
        const yn = b => b ? tr('sim', 'yes') : tr('não', 'no');
        const G = result.global;
        const out = [
            `# ${tr('Erro de índice vertical global', 'Global vertical index error')} (″): ${f(G.index.mean)} ± ${f(G.index.sMean)} (m = ${G.index.m}/${G.index.mTotal})`,
            `# ${tr('Erro de colimação global', 'Global collimation error')} (″): ${f(G.coll.mean)} ± ${f(G.coll.sMean)} (m = ${G.coll.m}/${G.coll.mTotal})`,
            tr('Estacao,Ponto Visado,linha,face,serie,Hz_lido_graus,Z_lido_graus,D_m,Hz_reduzido_graus,Z_reduzido_graus,v_Hz_seg,v_Z_seg,v_D_mm,usa_Hz,usa_Z,usa_D,marcas',
                'Station,Sighted Point,line,face,series,Hz_read_deg,Z_read_deg,D_m,Hz_reduced_deg,Z_reduced_deg,v_Hz_arcsec,v_Z_arcsec,v_D_mm,use_Hz,use_Z,use_D,flags')
        ];
        result.groups.forEach(g => g.readings.forEach(r => {
            const marks = OBS.flatMap(o => r.flags[o].map(fl => `${o}: ${flagText(fl)}`)).join(' | ');
            out.push([
                IO.csvCell(g.station), IO.csvCell(g.target), r.line, r.face, r.k,
                f(r.hz), f(r.z), f(r.d), f(redHz(r)), f(redZ(r)),
                f(r.res.hz), f(r.res.z), f(r.res.d),
                yn(r.use.hz), yn(r.use.z), yn(r.use.d),
                marks ? `"${marks.replace(/"/g, '""')}"` : ''
            ].join(','));
        }));
        return out.join('\n') + '\n';
    }

    return {
        DEFAULT_SETTINGS, PRESETS, OBS, mergeSettings, applyPreset,
        gmmssToDeg, dmsToDeg, degToDms, wrap360, wrapPM180,
        mean, median, stdDev, grubbsCritical, trimmedStats,
        detectFormat, parseRaw, buildGroups, redHz, redZ, seriesValues, globalErrors,
        compute, excludeFlagged, includeAll, distNominal,
        noteText, flagText, toObservationRows, toObservationsCSV, toReportCSV
    };
});
