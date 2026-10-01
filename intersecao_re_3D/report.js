// --- Relatório do ajustamento: modelo de dados (testável no node), texto e PDF (jsPDF) ---
// buildReportModel reúne tudo o que o relatório diz; renderText e renderPDF só o formatam.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.RedeReport = api;
})(typeof self !== 'undefined' ? self : this, function () {

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
        csv: 'desvios do CSV (nominal onde faltarem)',
        nominal: 'desvios nominais',
        max: 'maior entre o desvio do CSV e o nominal'
    };

    // ctx: { rows, origin, detection, settings }
    function buildReportModel(res, ctx) {
        const S = ctx.settings || res.settings;
        const rows = ctx.rows || [];
        const net = res.net;
        const nSt = net.stations.length;
        const fixedNames = res.pointResults.filter(p => p.fixed && !p.isStation).map(p => p.name);
        const freeNames = res.pointResults.filter(p => !p.fixed && !p.isStation).map(p => p.name);
        const nStXYZ = res.unknowns.filter(u => u.kind !== 'w' && net.stations.includes(u.point)).length;

        let datumText;
        if (net.datum.computed.length) {
            datumText = net.datum.origins.map(o => o.method === 'datum assumido'
                ? `${net.datum.computed.join(', ')} irradiados de ${o.station}, com ${o.station} assumida em ` +
                  `X=${o.xyz[0]}, Y=${o.xyz[1]}, Z=${o.xyz[2]} m e ω=${(o.omega / DEG).toFixed(4)}°`
                : `fixos sem coordenadas irradiados de ${o.station}, posicionada por resseção`).join('; ');
        } else {
            datumText = 'coordenadas dos pontos fixos informadas no CSV';
        }

        const summary = [
            ['Modelo', 'Combinado (Gauss–Helmert): F(La, Xa) = 0, três equações de condição por visada'],
            ['Dados', ctx.origin || '—'],
            ['Visadas ativas / total', `${res.m} / ${rows.length || res.m}`],
            ['Estações livres', net.stations.join(', ')],
            ['Pontos fixos', fixedNames.join(', ') || '—'],
            ['Pontos livres', `${freeNames.length}`],
            ['Equações (3 por visada)', `${res.nEq}`],
            ['Incógnitas', `${res.u} = ${nStXYZ} coordenadas de estação + ${nSt} orientações + ${3 * freeNames.length} coordenadas de pontos livres`],
            ['Graus de liberdade', `${res.dof}`],
            ['Datum', datumText],
            ['Iterações', `${res.iterations} (máximo ${S.maxIter})`],
            ['Convergência', `${res.converged ? 'sim' : 'NÃO'} — critério max|Δcoord| < ${S.tolLinMm} mm e max|Δω| < ${S.tolAngSec}″`],
            ['VᵀPV', f(res.VtPV, 4)],
            ['σ̂₀² (a posteriori)', f(res.sigma02, 4)],
            ['Teste global (χ²)', res.globalPass === null ? 'sem redundância'
                : `${res.globalPass ? 'APROVADO' : 'REPROVADO'} — α = ${S.alphaPct}%, intervalo [${f(res.chi2low, 3)}; ${f(res.chi2upp, 3)}]`],
            ['MVC das incógnitas', res.varScale === 1 && S.sigmaXaScale === 'priori' ? 'Σ_Xa = N⁻¹ (σ₀² a priori = 1)' : 'Σ_Xa = σ̂₀² N⁻¹'],
            ['cond(N)', res.condN === null ? '—' : res.condN.toExponential(2)]
        ];

        const stochastic = [
            ['Origem dos desvios', SOURCES[S.sigmaSource] || S.sigmaSource],
            ['Unidade dos desvios angulares no CSV', S.sigmaAngUnit === 'deg' ? 'graus' : 'segundos de arco'],
            ['Nominal angular', `${S.sigAngSec}″`],
            ['Nominal MED', `${S.edmMm} mm + ${S.edmPpm} ppm`],
            ['Data snooping', `α₀ = ${S.alpha0Pct}%, |w| crítico = ${f(res.critW, 3)}, poder ${S.powerPct}% (δ₀ = ${f(res.delta0, 3)})`],
            ['Elipsoides', `${res.confLabel} (k = ${f(res.confK3, 4)}, χ² com 3 graus); as elipses 2D são suas projeções`]
        ];

        const approximations = {
            head: ['Ordem', 'Estação', 'Pontos conhecidos', 'Desajuste máx. (mm)', 'Excluídos'],
            rows: res.approx.steps.map((s, i) => [
                `${i + 1}`, s.station, `${s.nKnown}${s.own ? ' (posição conhecida)' : ''}`,
                f(s.misfit * 1000, 2),
                s.excluded.length ? s.excluded.map(e => `${e.target} (${f(e.misfit, 3)} m)`).join(', ') : '—'
            ])
        };

        const iterations = {
            head: ['Iteração', 'max|Δcoord| (mm)', 'max|Δω| (″)', 'VᵀPV', '‖W‖ (mm)'],
            rows: res.history.map(h => [
                `${h.iter}`, h.maxLin * 1000 < 1e-3 ? (h.maxLin * 1000).toExponential(2) : f(h.maxLin * 1000, 4),
                h.maxAng / ARCSEC < 1e-3 ? (h.maxAng / ARCSEC).toExponential(2) : f(h.maxAng / ARCSEC, 4),
                f(h.VtPV, 4), f(h.normW * 1000, 3)
            ])
        };

        const coordinates = {
            head: ['Ponto', 'Tipo', 'X (m)', 'Y (m)', 'Z (m)', 'σX (mm)', 'σY (mm)', 'σZ (mm)',
                `a (mm)`, `b (mm)`, `c (mm)`],
            rows: res.pointResults.map(p => [
                p.name, p.tipo, f(p.xyz[0], 4), f(p.xyz[1], 4), f(p.xyz[2], 4),
                p.fixed ? '—' : f(p.sigma[0] * 1000, 2), p.fixed ? '—' : f(p.sigma[1] * 1000, 2), p.fixed ? '—' : f(p.sigma[2] * 1000, 2),
                ...(p.ellipsoid ? p.ellipsoid.axes.map(a => f(a * 1000, 2)) : ['—', '—', '—'])
            ])
        };

        const orientations = {
            head: ['Estação', 'ω', 'σω (″)'],
            rows: res.pointResults.filter(p => p.isStation).map(p => [p.name, formatDMS(p.omega), f(p.sigmaOmega / ARCSEC, 2)])
        };

        const flaggedIdx = new Set(ctx.detection ? ctx.detection.flagged : []);
        const residuals = {
            head: ['Visada', 'vHz (″)', 'wHz', 'rHz', 'vZ (″)', 'wZ', 'rZ', 'vD (mm)', 'wD', 'rD', 'Estado'],
            rows: res.obsData.map(o => {
                const st = flaggedIdx.has(o.row.idx) ? 'MARCADA' : (o.controlled.some(Boolean) ? (o.isOutlier ? '|w| > crít.' : 'ok') : 'sem controle');
                return [
                    o.row.id,
                    f(o.v[0] / ARCSEC, 2), f(o.w[0], 2), f(o.r[0], 3),
                    f(o.v[1] / ARCSEC, 2), f(o.w[1], 2), f(o.r[1], 3),
                    f(o.v[2] * 1000, 2), f(o.w[2], 2), f(o.r[2], 3),
                    st + (o.row.hasBlunder ? ' (erro injetado)' : '')
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
            title: 'Relatório de Ajustamento — Interseção a Ré 3D',
            subtitle: 'Rede de estações livres pelo Método Combinado (MMQ)',
            date: new Date().toLocaleString('pt-BR'),
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
        L.push(`Gerado em ${model.date}`);
        sec('Resumo');
        model.summary.forEach(([k, v]) => L.push(`  ${k.padEnd(28)} ${v}`));
        sec('Modelo estocástico');
        model.stochastic.forEach(([k, v]) => L.push(`  ${k.padEnd(38)} ${v}`));
        sec('Aproximações iniciais');
        L.push(textTable(model.approximations));
        sec('Iterações');
        L.push(textTable(model.iterations));
        sec('Coordenadas ajustadas');
        L.push(textTable(model.coordinates));
        sec('Orientações das estações');
        L.push(textTable(model.orientations));
        sec('Resíduos das observações');
        L.push(textTable(model.residuals));
        if (model.detection) {
            sec('Detecção de outliers');
            L.push(`  ${model.detection.label} — ${model.detection.detail}`);
            L.push(`  Marcadas: ${model.detection.flagged.join('; ') || 'nenhuma'}`);
        }
        sec('Visadas desativadas');
        L.push(`  ${model.inactive.join(', ') || 'nenhuma'}`);
        sec('Avisos e erros');
        if (!model.warnings.length) L.push('  nenhum');
        model.warnings.forEach(w => L.push(`  [${w.level}] ${w.msg}`));
        if (model.runs && model.runs.length) {
            sec('Execuções nesta sessão');
            model.runs.forEach(r => L.push(`  ${r.when}  ${r.ok ? 'ok    ' : 'FALHOU'}  ${r.msg}`));
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
        if (!jsPDF) throw new Error('jsPDF não carregou (sem conexão com a CDN?).');
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        if (typeof doc.autoTable !== 'function') throw new Error('jspdf-autotable não carregou.');

        let font = 'helvetica', tx = s => asciiOnly(s);
        try {
            const fonts = await loadFonts();
            fonts.forEach(ft => { doc.addFileToVFS(ft.file, ft.data); doc.addFont(ft.file, 'DejaVu', ft.style); });
            font = 'DejaVu';
            tx = s => String(s);
        } catch (e) {
            console.warn('Relatório sem fonte Unicode:', e);
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
        const keyValue = pairs => table({ head: ['Item', 'Valor'], rows: pairs },
            { columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } }, theme: 'plain' });

        doc.setFont(font, 'bold'); doc.setFontSize(15); doc.setTextColor(28, 25, 23);
        doc.text(tx(model.title), MX, y); y += 6;
        doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(120, 113, 108);
        doc.text(tx(`${model.subtitle} · gerado em ${model.date}`), MX, y); y += 5;

        heading('Resumo do ajustamento');
        keyValue(model.summary);
        heading('Modelo estocástico');
        keyValue(model.stochastic);
        heading('Aproximações iniciais');
        table(model.approximations);
        heading('Iterações');
        table(model.iterations);

        heading('Avisos e erros');
        if (!model.warnings.length) {
            doc.setFont(font, 'normal'); doc.setFontSize(8); doc.text(tx('Nenhum.'), MX, y); y += 5;
        } else {
            table({ head: ['Nível', 'Mensagem'], rows: model.warnings.map(w => [w.level, w.msg]) }, {
                columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold' } },
                didParseCell: d => {
                    if (d.section !== 'body' || d.column.index !== 0) return;
                    const lv = d.cell.raw;
                    d.cell.styles.textColor = lv === 'erro' ? [190, 18, 60] : (lv === 'aviso' ? [180, 83, 9] : [87, 83, 78]);
                }
            });
        }

        if (model.runs && model.runs.length) {
            heading('Execuções nesta sessão');
            table({ head: ['Hora', 'Resultado', 'Detalhe'], rows: model.runs.map(r => [r.when, r.ok ? 'ok' : 'FALHOU', r.msg]) }, {
                columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 16, fontStyle: 'bold' } }
            });
        }

        heading('Coordenadas ajustadas');
        table(model.coordinates, { styles: Object.assign({}, tableStyles.styles, { fontSize: 6.5 }) });
        heading('Orientações das estações');
        table(model.orientations, { tableWidth: 90 });
        heading('Resíduos das observações');
        table(model.residuals, {
            styles: Object.assign({}, tableStyles.styles, { fontSize: 6.3 }),
            didParseCell: d => {
                if (d.section !== 'body' || d.column.index !== 10) return;
                if (/MARCADA|crít/.test(d.cell.raw)) d.cell.styles.textColor = [190, 18, 60];
            }
        });
        if (model.detection) {
            heading('Detecção de outliers');
            keyValue([
                ['Método', model.detection.label],
                ['Critério', model.detection.detail],
                ['Marcadas', model.detection.flagged.join('; ') || 'nenhuma']
            ]);
        }
        heading('Visadas desativadas');
        doc.setFont(font, 'normal'); doc.setFontSize(8);
        doc.text(doc.splitTextToSize(tx(model.inactive.join(', ') || 'Nenhuma.'), W - 2 * MX), MX, y);
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
            doc.text(tx(`Interseção a Ré 3D · página ${i} de ${pages}`), W - MX, H - 7, { align: 'right' });
        }
        return doc;
    }

    function root_jsPDF() {
        const g = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
        return g.jspdf && g.jspdf.jsPDF ? g.jspdf.jsPDF : null;
    }

    return { buildReportModel, renderText, renderPDF, formatDMS, asciiOnly, loadFonts };
});
