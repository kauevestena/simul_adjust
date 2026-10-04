// --- Relatório do ajustamento: modelo de dados (testável no node), texto e PDF (jsPDF) ---
// buildReportModel reúne tudo o que o relatório diz; renderText e renderPDF só o formatam.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RedeReport = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const tr = (pt, en) => (globalThis.APP_LANG === 'en' ? en : pt);
    // Rótulos de tipo de ponto: vêm de NetAdjust (global no navegador, módulo no node)
    const term = k => (typeof NetAdjust !== 'undefined' ? NetAdjust.term(k) : (typeof require === 'function' ? require('./adjustment.js').term(k) : k));
    const ARCSEC = Math.PI / (180 * 3600);
    const DEG = Math.PI / 180;

    const f = (v, d) => (v === null || v === undefined || !Number.isFinite(v)) ? '—' : (Object.is(+v.toFixed(d), -0) ? (0).toFixed(d) : v.toFixed(d));

    function formatDMS(rad, dec = 2) {
        let deg = ((rad / DEG) % 360 + 360) % 360;
        let g = Math.floor(deg), m = Math.floor((deg - g) * 60);
        let s = (deg - g - m / 60) * 3600;
        if (+s.toFixed(dec) >= 60) { s = 0; m += 1; }
        if (m >= 60) { m = 0; g = (g + 1) % 360; }
        return `${g}° ${String(m).padStart(2, '0')}′ ${s.toFixed(dec).padStart(3 + dec, '0')}″`;
    }

    const SOURCES = {
        get csv() { return tr('desvios do CSV (nominal onde faltarem)', 'CSV deviations (nominal where missing)'); },
        get nominal() { return tr('desvios nominais', 'nominal deviations'); },
        get max() { return tr('maior entre o desvio do CSV e o nominal', 'larger of the CSV and the nominal deviation'); }
    };

    // ctx: { rows, origin, detection, settings }
    function buildReportModel(res, ctx) {
        const S = ctx.settings || res.settings;
        const rows = ctx.rows || [];
        const net = res.net;
        const free = res.datum === 'livre';
        const minimal = res.datum === 'minimo';
        const loose = free || minimal; // pontos de apoio são incógnitas
        const supportNames = res.pointResults.filter(p => (p.fixed || p.support) && !p.isStation).map(p => p.name);
        const otherNames = res.pointResults.filter(p => !p.fixed && !p.support && !p.isStation).map(p => p.name);
        const nStXYZ = res.unknowns.filter(u => u.kind !== 'w' && net.stations.includes(u.point)).length;
        const nPtXYZ = res.unknowns.filter(u => u.kind !== 'w' && !net.stations.includes(u.point)).length;
        const nOmega = res.unknowns.filter(u => u.kind === 'w').length;

        let datumText;
        if (minimal) {
            const o = (net.seedPoses || [])[0];
            datumText = tr(`injunções mínimas: estação ${net.origin} fixada em X=${o.xyz[0]}, Y=${o.xyz[1]}, Z=${o.xyz[2]} m e ` +
                `ω=${(o.omega / DEG).toFixed(4)}° (4 injunções = defeito de posto 4); os demais pontos, inclusive os de apoio, são incógnitas`,
                `minimal constraints: station ${net.origin} fixed at X=${o.xyz[0]}, Y=${o.xyz[1]}, Z=${o.xyz[2]} m and ` +
                `ω=${(o.omega / DEG).toFixed(4)}° (4 constraints = rank defect 4); all other points, support points included, are unknowns`);
        } else if (free) {
            const nPts = res.unknowns.filter(u => u.kind === 'X').length;
            const seed = (net.seedPoses || [])[0];
            datumText = tr(`rede livre: injunções internas sobre as coordenadas dos ${nPts} pontos (defeito de posto ${res.d}, ` +
                'traço mínimo); a rede conserva o centróide e a orientação média das coordenadas aproximadas',
                `free network: inner constraints on the coordinates of the ${nPts} points (rank defect ${res.d}, ` +
                'minimum trace); the network keeps the centroid and mean orientation of the approximate coordinates') +
                (seed ? tr(`, que partem de ${seed.station} no datum local assumido`, `, which start from ${seed.station} at the assumed local datum`)
                    : (net.datum.computed.length ? tr(', com os pontos de apoio irradiados pela regra do datum', ', with the support points radiated by the datum rule')
                        : tr(', a partir dos pontos de apoio', ', from the support points')));
        } else if (net.datum.computed.length) {
            datumText = net.datum.origins.map(o => o.method === 'datum assumido'
                ? tr(`${net.datum.computed.join(', ')} irradiados de ${o.station}, com ${o.station} assumida em `, `${net.datum.computed.join(', ')} radiated from ${o.station}, with ${o.station} assumed at `) +
                  `X=${o.xyz[0]}, Y=${o.xyz[1]}, Z=${o.xyz[2]} m ${tr('e', 'and')} ω=${(o.omega / DEG).toFixed(4)}°`
                : tr(`fixos sem coordenadas irradiados de ${o.station}, posicionada por resseção`, `control points without coordinates radiated from ${o.station}, positioned by resection`)).join('; ');
        } else {
            datumText = tr('coordenadas dos pontos fixos informadas no CSV', 'control point coordinates given in the CSV');
        }

        const summary = [
            [tr('Modelo', 'Model'), res.model === 'parametrico'
                ? tr('Paramétrico (Gauss–Markov): La = F(Xa), três equações de observação por visada', 'Parametric (Gauss–Markov): La = F(Xa), three observation equations per sighting')
                : tr('Combinado (Gauss–Helmert): F(La, Xa) = 0, três equações de condição por visada', 'Combined (Gauss–Helmert): F(La, Xa) = 0, three condition equations per sighting')],
            [tr('Dados', 'Data'), ctx.origin || '—'],
            [tr('Visadas ativas / total', 'Active / total sightings'), `${res.m} / ${rows.length || res.m}`],
            [tr('Estações livres', 'Free stations'), net.stations.join(', ')],
            [loose ? tr('Pontos de apoio (livres nesta solução)', 'Support points (free in this solution)') : tr('Pontos fixos', 'Control points'), supportNames.join(', ') || '—'],
            [tr('Pontos livres', 'Free points'), `${otherNames.length}`],
            [tr('Equações (3 por visada)', 'Equations (3 per sighting)'), `${res.nEq}`],
            [tr('Incógnitas', 'Unknowns'), tr(`${res.u} = ${nStXYZ} coordenadas de estação + ${nOmega} orientações + ${nPtXYZ} coordenadas de pontos`, `${res.u} = ${nStXYZ} station coordinates + ${nOmega} orientations + ${nPtXYZ} point coordinates`)],
            [tr('Graus de liberdade', 'Degrees of freedom'), free ? tr(`${res.dof} = ${res.nEq} − ${res.u} + ${res.d} (defeito de posto)`, `${res.dof} = ${res.nEq} − ${res.u} + ${res.d} (rank defect)`) : `${res.dof} = ${res.nEq} − ${res.u}`],
            ['Datum', datumText],
            [tr('Iterações', 'Iterations'), tr(`${res.iterations} (máximo ${S.maxIter})`, `${res.iterations} (maximum ${S.maxIter})`)],
            [tr('Convergência', 'Convergence'), tr(`${res.converged ? 'sim' : 'NÃO'} — critério max|Δcoord| < ${S.tolLinMm} mm e max|Δω| < ${S.tolAngSec}″`, `${res.converged ? 'yes' : 'NO'} — criterion max|Δcoord| < ${S.tolLinMm} mm and max|Δω| < ${S.tolAngSec}″`)],
            ['VᵀPV', f(res.VtPV, 4)],
            ['σ̂₀² (a posteriori)', f(res.sigma02, 4)],
            [tr('Teste global (χ²)', 'Global test (χ²)'), res.globalPass === null ? tr('sem redundância', 'no redundancy')
                : tr(`${res.globalPass ? 'APROVADO' : 'REPROVADO'} — α = ${S.alphaPct}%, intervalo [${f(res.chi2low, 3)}; ${f(res.chi2upp, 3)}]`,
                    `${res.globalPass ? 'PASSED' : 'FAILED'} — α = ${S.alphaPct}%, interval [${f(res.chi2low, 3)}; ${f(res.chi2upp, 3)}]`)],
            [tr('MVC das incógnitas', 'Unknowns’ covariance'), (res.varScale === 1 && S.sigmaXaScale === 'priori' ? 'Σ_Xa = Q (σ₀² a priori = 1)' : 'Σ_Xa = σ̂₀² Q') +
                (free ? tr(', Q = inversa generalizada do sistema orlado [N G; Gᵀ 0]', ', Q = generalized inverse of the bordered system [N G; Gᵀ 0]') : ', Q = N⁻¹')],
            ['cond(N)', res.condN === null ? '—' : res.condN.toExponential(2) + (free ? tr(` (sem os ${res.d} autovalores nulos)`, ` (without the ${res.d} null eigenvalues)`) : '')]
        ];

        const stochastic = [
            [tr('Origem dos desvios', 'Source of deviations'), SOURCES[S.sigmaSource] || S.sigmaSource],
            [tr('Unidade dos desvios angulares no CSV', 'Unit of angular deviations in the CSV'), S.sigmaAngUnit === 'deg' ? tr('graus', 'degrees') : tr('segundos de arco', 'arcseconds')],
            ['Nominal angular', `${S.sigAngSec}″`],
            [tr('Nominal MED', 'Nominal EDM'), `${S.edmMm} mm + ${S.edmPpm} ppm`],
            ['Data snooping', tr(`α₀ = ${S.alpha0Pct}%, |w| crítico = ${f(res.critW, 3)}, poder ${S.powerPct}% (δ₀ = ${f(res.delta0, 3)})`, `α₀ = ${S.alpha0Pct}%, critical |w| = ${f(res.critW, 3)}, power ${S.powerPct}% (δ₀ = ${f(res.delta0, 3)})`)],
            [tr('Elipsoides', 'Ellipsoids'), tr(`${res.confLabel} (k = ${f(res.confK3, 4)}, χ² com 3 graus); as elipses 2D são suas projeções`, `${res.confLabel} (k = ${f(res.confK3, 4)}, χ² with 3 degrees); the 2D ellipses are their projections`)]
        ];

        const approximations = {
            head: tr(['Ordem', 'Estação', 'Pontos conhecidos', 'Desajuste máx. (mm)', 'Excluídos'], ['Order', 'Station', 'Known points', 'Max misfit (mm)', 'Excluded']),
            rows: res.approx.steps.map((s, i) => [
                `${i + 1}`, s.station, s.seed ? tr('semente (datum local assumido)', 'seed (assumed local datum)') : `${s.nKnown}${s.own ? tr(' (posição conhecida)', ' (known position)') : ''}`,
                f(s.misfit * 1000, 2),
                s.excluded.length ? s.excluded.map(e => `${e.target} (${f(e.misfit, 3)} m)`).join(', ') : '—'
            ])
        };

        const iterations = {
            head: [tr('Iteração', 'Iteration'), 'max|Δcoord| (mm)', 'max|Δω| (″)', 'VᵀPV', '√(WᵀM⁻¹W)'],
            rows: res.history.map(h => [
                `${h.iter}`, h.maxLin * 1000 < 1e-3 ? (h.maxLin * 1000).toExponential(2) : f(h.maxLin * 1000, 4),
                h.maxAng / ARCSEC < 1e-3 ? (h.maxAng / ARCSEC).toExponential(2) : f(h.maxAng / ARCSEC, 4),
                f(h.VtPV, 4), f(h.normW, 3)
            ])
        };

        const coordinates = {
            head: [tr('Ponto', 'Point'), tr('Tipo', 'Type'), 'X (m)', 'Y (m)', 'Z (m)', 'σX (mm)', 'σY (mm)', 'σZ (mm)',
                `a (mm)`, `b (mm)`, `c (mm)`],
            rows: res.pointResults.map(p => [
                p.name, term(p.tipo), f(p.xyz[0], 4), f(p.xyz[1], 4), f(p.xyz[2], 4),
                p.fixed ? '—' : f(p.sigma[0] * 1000, 2), p.fixed ? '—' : f(p.sigma[1] * 1000, 2), p.fixed ? '—' : f(p.sigma[2] * 1000, 2),
                ...(p.ellipsoid ? p.ellipsoid.axes.map(a => f(a * 1000, 2)) : ['—', '—', '—'])
            ])
        };

        const orientations = {
            head: [tr('Estação', 'Station'), 'ω', 'σω (″)'],
            rows: res.pointResults.filter(p => p.isStation).map(p => [p.name, formatDMS(p.omega), f(p.sigmaOmega / ARCSEC, 2)])
        };

        const flaggedIdx = new Set(ctx.detection ? ctx.detection.flagged : []);
        const residuals = {
            head: [tr('Visada', 'Sighting'), 'vHz (″)', 'wHz', 'rHz', 'vZ (″)', 'wZ', 'rZ', 'vD (mm)', 'wD', 'rD', tr('Estado', 'Status')],
            rows: res.obsData.map(o => {
                const st = flaggedIdx.has(o.row.idx) ? tr('MARCADA', 'FLAGGED') : (o.controlled.some(Boolean) ? (o.isOutlier ? tr('|w| > crít.', '|w| > crit.') : 'ok') : tr('sem controle', 'no control'));
                return [
                    o.row.id,
                    f(o.v[0] / ARCSEC, 2), f(o.w[0], 2), f(o.r[0], 3),
                    f(o.v[1] / ARCSEC, 2), f(o.w[1], 2), f(o.r[1], 3),
                    f(o.v[2] * 1000, 2), f(o.w[2], 2), f(o.r[2], 3),
                    st + (o.row.hasBlunder ? tr(' (erro injetado)', ' (injected error)') : '')
                ];
            })
        };

        let detection = null;
        if (ctx.detection) {
            const d = ctx.detection;
            detection = {
                label: d.label, detail: d.detail,
                flagged: d.comps.map(c => `${c.id} [${c.comp}: ${Number.isFinite(c.value) ? c.value.toFixed(2) : '—'}]`)
            };
        }

        return {
            title: tr('Relatório de Ajustamento — Interseção a Ré 3D', 'Adjustment Report — 3D Resection Network'),
            subtitle: tr('Rede de estações livres pelo Método Combinado (MMQ)', 'Free station network by the Combined Method (least squares)'),
            date: new Date().toLocaleString(tr('pt-BR', 'en-GB')),
            summary, stochastic, approximations, iterations,
            coordinates, orientations, residuals, detection,
            inactive: rows.filter(r => !r.active).map(r => r.id),
            warnings: res.log.slice(),
            runs: (ctx.runs || []).slice()
        };
    }

    // ---------------------------------------------------------------- texto
    function textTable(t) {
        const w = t.head.map((h, i) => Math.max(h.length, ...t.rows.map(r => String(r[i]).length)));
        const line = r => '  ' + r.map((c, i) => String(c).padEnd(w[i])).join('  ');
        return [line(t.head), '  ' + w.map(n => '-'.repeat(n)).join('  '), ...t.rows.map(line)].join('\n');
    }

    function renderText(model) {
        const L = [];
        const sec = t => { L.push(''); L.push(t.toUpperCase()); L.push('='.repeat(t.length)); };
        L.push(model.title.toUpperCase());
        L.push(model.subtitle);
        L.push(`${tr('Gerado em', 'Generated on')} ${model.date}`);
        sec(tr('Resumo', 'Summary'));
        model.summary.forEach(([k, v]) => L.push(`  ${k.padEnd(28)} ${v}`));
        sec(tr('Modelo estocástico', 'Stochastic model'));
        model.stochastic.forEach(([k, v]) => L.push(`  ${k.padEnd(38)} ${v}`));
        sec(tr('Aproximações iniciais', 'Initial approximations'));
        L.push(textTable(model.approximations));
        sec(tr('Iterações', 'Iterations'));
        L.push(textTable(model.iterations));
        sec(tr('Coordenadas ajustadas', 'Adjusted coordinates'));
        L.push(textTable(model.coordinates));
        sec(tr('Orientações das estações', 'Station orientations'));
        L.push(textTable(model.orientations));
        sec(tr('Resíduos das observações', 'Observation residuals'));
        L.push(textTable(model.residuals));
        if (model.detection) {
            sec(tr('Detecção de outliers', 'Outlier detection'));
            L.push(`  ${model.detection.label} — ${model.detection.detail}`);
            L.push(`  ${tr('Marcadas', 'Flagged')}: ${model.detection.flagged.join('; ') || tr('nenhuma', 'none')}`);
        }
        sec(tr('Visadas desativadas', 'Deactivated sightings'));
        L.push(`  ${model.inactive.join(', ') || tr('nenhuma', 'none')}`);
        sec(tr('Avisos e erros', 'Warnings and errors'));
        if (!model.warnings.length) L.push(`  ${tr('nenhum', 'none')}`);
        model.warnings.forEach(w => L.push(`  [${w.level}] ${w.msg}`));
        if (model.runs && model.runs.length) {
            sec(tr('Execuções nesta sessão', 'Runs in this session'));
            model.runs.forEach(r => L.push(`  ${r.when}  ${r.ok ? 'ok    ' : tr('FALHOU', 'FAILED')}  ${r.msg}`));
        }
        return L.join('\n') + '\n';
    }

    // ---------------------------------------------------------------- PDF
    // As fontes padrão do jsPDF só cobrem Latin-1: σ, ω, χ², ″ e → sairiam corrompidos.
    // Carrega a DejaVu Sans do CDN (uma vez por sessão); sem ela, translitera para ASCII.
    const FONT_BASE = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/';
    const FONT_FILES = [['DejaVuSans.ttf', 'normal'], ['DejaVuSans-Bold.ttf', 'bold']];
    let fontCache = null;

    function toBase64(buf) {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }

    async function loadFonts() {
        if (fontCache) return fontCache;
        const out = [];
        for (const [file, style] of FONT_FILES) {
            const resp = await fetch(FONT_BASE + file);
            if (!resp.ok) throw new Error(`fonte ${file}: HTTP ${resp.status}`);
            out.push({ file, style, data: toBase64(await resp.arrayBuffer()) });
        }
        fontCache = out;
        return out;
    }

    const ASCII = [
        [/σ̂₀²/g, 's0^2'], [/σ̂₀/g, 's0'], [/σ₀²/g, 's0^2'], [/σ/g, 'sigma'], [/ω/g, 'omega'], [/χ²/g, 'chi2'],
        [/α₀/g, 'alpha0'], [/α/g, 'alpha'], [/δ₀/g, 'delta0'], [/Σ/g, 'Sigma'], [/τ/g, 'tau'], [/Δ/g, 'd'],
        [/ᵀ/g, 'T'], [/⁻¹/g, '^-1'], [/″/g, '"'], [/′/g, "'"], [/→/g, '->'], [/≈/g, '~'], [/—/g, '-'],
        [/–/g, '-'], [/‖/g, '||'], [/≥/g, '>='], [/≤/g, '<='], [/…/g, '...'], [/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080)]
    ];
    function asciiOnly(s) {
        let t = String(s);
        ASCII.forEach(([re, rep]) => { t = t.replace(re, rep); });
        return t.replace(/[^\x00-\xff]/g, '?');
    }

    // images: [{ title, dataURL, width, height }]
    async function renderPDF(model, images) {
        const jsPDF = root_jsPDF();
        if (!jsPDF) throw new Error(tr('jsPDF não carregou (sem conexão com a CDN?).', 'jsPDF failed to load (no CDN connection?).'));
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        if (typeof doc.autoTable !== 'function') throw new Error(tr('jspdf-autotable não carregou.', 'jspdf-autotable failed to load.'));

        let font = 'helvetica', tx = s => asciiOnly(s);
        try {
            const fonts = await loadFonts();
            fonts.forEach(ft => { doc.addFileToVFS(ft.file, ft.data); doc.addFont(ft.file, 'DejaVu', ft.style); });
            font = 'DejaVu';
            tx = s => String(s);
        } catch (e) {
            console.warn(tr('Relatório sem fonte Unicode:', 'Report without Unicode font:'), e);
        }

        const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
        const MX = 14;
        let y = 16;
        const ensure = h => { if (y + h > H - 14) { doc.addPage(); y = 16; } };
        const heading = t => {
            ensure(14);
            y += 3;
            doc.setFont(font, 'bold'); doc.setFontSize(11); doc.setTextColor(15, 118, 110);
            doc.text(tx(t), MX, y);
            doc.setDrawColor(231, 229, 228); doc.line(MX, y + 1.5, W - MX, y + 1.5);
            y += 6;
            doc.setTextColor(41, 37, 36);
        };
        const tableStyles = {
            styles: { font, fontSize: 7, cellPadding: 1.1, textColor: [41, 37, 36], lineColor: [231, 229, 228], lineWidth: 0.1 },
            headStyles: { fillColor: [245, 245, 244], textColor: [87, 83, 78], fontStyle: 'bold' },
            margin: { left: MX, right: MX }
        };
        const table = (t, extra) => {
            doc.autoTable(Object.assign({
                startY: y, head: [t.head.map(tx)], body: t.rows.map(r => r.map(tx))
            }, tableStyles, extra || {}));
            y = doc.lastAutoTable.finalY + 4;
        };
        const keyValue = pairs => table({ head: [tr('Item', 'Item'), tr('Valor', 'Value')], rows: pairs },
            { columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } }, theme: 'plain' });

        doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(28, 25, 23);
        doc.text(tx(model.title), MX, y); y += 6;
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(120, 113, 108);
        doc.text(tx(`${model.subtitle} · ${tr('gerado em', 'generated on')} ${model.date}`), MX, y); y += 5;

        heading(tr('Resumo do ajustamento', 'Adjustment summary'));
        keyValue(model.summary);
        heading(tr('Modelo estocástico', 'Stochastic model'));
        keyValue(model.stochastic);
        heading(tr('Aproximações iniciais', 'Initial approximations'));
        table(model.approximations);
        heading(tr('Iterações', 'Iterations'));
        table(model.iterations);

        heading(tr('Avisos e erros', 'Warnings and errors'));
        if (!model.warnings.length) {
            doc.setFont(font, 'normal'); doc.setFontSize(8); doc.text(tx(tr('Nenhum.', 'None.')), MX, y); y += 5;
        } else {
            table({ head: [tr('Nível', 'Level'), tr('Mensagem', 'Message')], rows: model.warnings.map(w => [w.level, w.msg]) }, {
                columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold' } },
                didParseCell: d => {
                    if (d.section !== 'body' || d.column.index !== 0) return;
                    const lv = d.cell.raw;
                    d.cell.styles.textColor = lv === 'erro' ? [190, 18, 60] : (lv === 'aviso' ? [180, 83, 9] : [87, 83, 78]);
                }
            });
        }

        if (model.runs && model.runs.length) {
            heading(tr('Execuções nesta sessão', 'Runs in this session'));
            table({ head: [tr('Hora', 'Time'), tr('Resultado', 'Result'), tr('Detalhe', 'Detail')], rows: model.runs.map(r => [r.when, r.ok ? 'ok' : tr('FALHOU', 'FAILED'), r.msg]) }, {
                columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 16, fontStyle: 'bold' } }
            });
        }

        heading(tr('Coordenadas ajustadas', 'Adjusted coordinates'));
        table(model.coordinates, { styles: Object.assign({}, tableStyles.styles, { fontSize: 6.5 }) });
        heading(tr('Orientações das estações', 'Station orientations'));
        table(model.orientations, { tableWidth: 90 });
        heading(tr('Resíduos das observações', 'Observation residuals'));
        table(model.residuals, {
            styles: Object.assign({}, tableStyles.styles, { fontSize: 6.3 }),
            didParseCell: d => {
                if (d.section !== 'body' || d.column.index !== 10) return;
                if (/MARCADA|FLAGGED|crít|crit\./.test(d.cell.raw)) d.cell.styles.textColor = [190, 18, 60];
            }
        });
        if (model.detection) {
            heading(tr('Detecção de outliers', 'Outlier detection'));
            keyValue([
                [tr('Método', 'Method'), model.detection.label],
                [tr('Critério', 'Criterion'), model.detection.detail],
                [tr('Marcadas', 'Flagged'), model.detection.flagged.join('; ') || tr('nenhuma', 'none')]
            ]);
        }
        heading(tr('Visadas desativadas', 'Deactivated sightings'));
        doc.setFont(font, 'normal'); doc.setFontSize(8);
        doc.text(doc.splitTextToSize(tx(model.inactive.join(', ') || tr('Nenhuma.', 'None.')), W - 2 * MX), MX, y);
        y += 6;

        (images || []).forEach(img => {
            if (!img || !img.dataURL) return;
            const maxW = W - 2 * MX, maxH = 120;
            const r = Math.min(maxW / img.width, maxH / img.height);
            const w = img.width * r, h = img.height * r;
            ensure(h + 12);
            heading(img.title);
            const fmt = img.dataURL.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(img.dataURL, fmt, MX + (maxW - w) / 2, y, w, h, undefined, 'FAST');
            y += h + 4;
            if (img.caption) {
                doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(120, 113, 108);
                const lines = doc.splitTextToSize(tx(img.caption), maxW);
                doc.text(lines, MX, y); y += lines.length * 3 + 2;
                doc.setTextColor(41, 37, 36);
            }
        });

        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(168, 162, 158);
            doc.text(tx(tr(`Interseção a Ré 3D · página ${i} de ${pages}`, `3D Resection Network · page ${i} of ${pages}`)), W - MX, H - 7, { align: 'right' });
        }
        return doc;
    }

    function root_jsPDF() {
        const g = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
        return g.jspdf && g.jspdf.jsPDF ? g.jspdf.jsPDF : null;
    }

    return { buildReportModel, renderText, renderPDF, formatDMS, asciiOnly, loadFonts };
});
