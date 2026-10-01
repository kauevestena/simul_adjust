// --- Orquestração da interface do simulador de interseção a ré 3D ---
const app = {
    settings: Object.assign({}, RedeIO.DEFAULT_SETTINGS),
    rows: [],
    result: null,
    preview: null,        // { net, approx, log } antes do ajustamento, ou { error, log }
    lastDetection: null,
    flagComps: new Map(), // idx da visada -> componentes marcadas
    runs: [],             // execuções desta sessão (sucesso ou falha), para o relatório
    truth: null,          // verdade da rede sintética
    origin: '',
    parseWarnings: [],
    activeTab: 'view3d',
    activeMatrix: 'A',
    _loadSeq: 0,
    viewer: null,
    views: null,

    // ---------------------------------------------------------------- inicialização
    init() {
        this.viewer = new NetworkViewer3D('viewer3d');
        this.views = new NetworkViews2D({ xy: 'canvasXY', xz: 'canvasXZ', yz: 'canvasYZ' });
        this._writeSettingsForm(this.settings);
        this.updateSettings(true);
        this.updateViewOptions();
        this._buildMatrixTabs();
        window.addEventListener('resize', () => { if (this.activeTab === 'views2d') this.views.render(); });
        this.loadSample();
    },

    esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // ---------------------------------------------------------------- dados
    async loadSample() {
        const seq = ++this._loadSeq;
        try {
            const resp = await fetch('inputs/observations.csv');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            if (seq !== this._loadSeq) return;
            this._setRows(RedeIO.parseCSV(text), 'amostra inputs/observations.csv');
        } catch (e) {
            if (seq !== this._loadSeq) return;
            alert(`Não foi possível ler inputs/observations.csv.\n\n${e.message}\n\n` +
                'Abra a página por um servidor HTTP (ex.: python3 -m http.server) — o navegador ' +
                'bloqueia a leitura de arquivos locais via file://.');
        }
    },

    loadUserCSV(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const seq = ++this._loadSeq;
        const reader = new FileReader();
        reader.onload = () => {
            if (seq !== this._loadSeq) return;
            this._setRows(RedeIO.parseCSV(reader.result), file.name);
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    generateSynthetic() {
        const nSt = Math.max(2, Math.min(8, parseInt(document.getElementById('synthStations').value) || 3));
        const g = RedeIO.generateSyntheticNetwork({
            nStations: nSt,
            nDetail: Math.max(0, parseInt(document.getElementById('synthDetail').value) || 0),
            noise: document.getElementById('synthNoise').checked,
            withCoords: document.getElementById('synthCoords').checked
        }, this.settings);
        this._setRows({ rows: g.rows, errors: [], warnings: [] }, `rede sintética (${nSt} estações)`, g.truth);
    },

    _setRows(parsed, origin, truth) {
        if (parsed.errors.length) {
            alert(`Problemas na leitura (${parsed.errors.length}):\n\n` +
                parsed.errors.slice(0, 10).join('\n') + (parsed.errors.length > 10 ? '\n...' : ''));
        }
        if (!parsed.rows.length) { alert('Nenhuma visada válida encontrada.'); return; }
        this._loadSeq++; // descarta qualquer carga assíncrona ainda em voo
        this.rows = RedeIO.buildRows(parsed.rows);
        this.parseWarnings = parsed.warnings || [];
        this.truth = truth || null;
        this.origin = origin;
        this.result = null;
        this.lastDetection = null;
        this.flagComps = new Map();
        this.runs = [];
        this._autoScaled = false;
        this._invalidate(true);
        const vex = NetworkViews2D.autoVertExag(this._scene().points);
        document.getElementById('vertExag2d').value = vex;
        this.updateViewOptions();
    },

    // Exagero que leva o maior elipsoide a ~5% da extensão da rede, arredondado (1-2-5)
    _autoEllipseScale() {
        const r = this.result;
        const pts = r.pointResults;
        const maxAxis = Math.max(...pts.filter(p => p.ellipsoid).map(p => p.ellipsoid.axes[0]), 0);
        if (!(maxAxis > 0)) return;
        const span = i => Math.max(...pts.map(p => p.xyz[i])) - Math.min(...pts.map(p => p.xyz[i]));
        const extent = Math.hypot(span(0), span(1), span(2));
        let s = 0.05 * extent / maxAxis;
        const e = Math.pow(10, Math.floor(Math.log10(s))), m = s / e;
        s = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
        const v = Math.log10(Math.max(1, Math.min(10000, s)));
        document.getElementById('ellipsoidScale').value = v;
        document.getElementById('ellipseScale2d').value = v;
        this.updateViewOptions();
    },

    // Qualquer mudança nos dados ou no modelo: descarta o ajustamento e refaz as aproximações
    _invalidate(refit) {
        this.result = null;
        if (this.lastComparison) {
            this.lastComparison = null;
            document.getElementById('compareContent').innerHTML =
                '<p class="text-xs text-amber-600">Os dados ou o modelo mudaram: clique em <strong>Comparar os quatro</strong> de novo.</p>';
        }
        this._computePreview();
        this._refreshAll(refit);
    },

    _computePreview() {
        if (!this.rows.length) { this.preview = null; return; }
        try {
            const net = NetAdjust.buildNetwork(this.rows, this.settings);
            const approx = NetAdjust.approximate(net, this.settings);
            this.preview = { net, approx, log: net.log.items };
        } catch (e) {
            this.preview = { error: e.message, log: e.log || [] };
        }
    },

    // Pontos e visadas para as vistas: ajustados, ou as aproximações iniciais
    _scene() {
        const points = [], lines = [];
        let coords = null;
        const r = this.result;
        if (r) {
            coords = new Map(r.pointResults.map(p => [p.name, p.xyz]));
            r.pointResults.forEach(p => points.push({
                name: p.name, xyz: p.xyz, Sigma: p.fixed ? null : p.Sigma,
                kind: p.isStation ? 'station' : ((p.fixed || p.support) ? 'fixed' : 'free')
            }));
        } else if (this.preview && this.preview.approx) {
            const { net, approx } = this.preview;
            coords = approx.coords;
            approx.coords.forEach((xyz, name) => points.push({
                name, xyz, Sigma: null,
                kind: net.stations.includes(name) ? 'station'
                    : ((net.fixedCoords.has(name) || (net.supportNames || []).includes(name)) ? 'fixed' : 'free')
            }));
        }
        if (coords) {
            this.rows.forEach(row => {
                const a = coords.get(row.station), b = coords.get(row.target);
                if (!a || !b) return;
                lines.push({ a, b, state: !row.active ? 'inactive' : (row.flagged ? 'flagged' : 'active') });
            });
        }
        return { points, lines };
    },

    _refreshAll(refit) {
        this.renderDataTable();
        this.renderGlobalTest();
        this.renderCoordinates();
        this.renderSummary();
        this.renderLog();
        this.renderReport();
        this._buildMatrixTabs();
        this.renderMatrixTab();
        const sc = this._scene();
        this.viewer.setScene(sc, refit);
        this.views.setScene(sc, refit);
        document.getElementById('view3dMode').textContent = this._modeText();
        this._updateStatus();
        this._updateButtons();
    },

    _modeText() {
        const r = this.result;
        if (r) return `rede ajustada — ${r.modelLabel}, ${r.datumLabel.toLowerCase()} · elipsoides ${r.confLabel}`;
        return this.preview && this.preview.approx ? 'aproximações iniciais (antes do ajustamento) — sem elipsoides' : '';
    },

    _updateStatus() {
        const el = document.getElementById('dataStatus');
        if (!this.rows.length) { el.textContent = 'Nenhuma observação carregada.'; return; }
        const active = this.rows.filter(r => r.active).length;
        const flagged = this.rows.filter(r => r.flagged).length;
        const st = new Set(this.rows.map(r => r.station)).size;
        const pts = new Set(this.rows.map(r => r.target)).size;
        el.innerHTML = `<strong>${this.rows.length}</strong> visadas (${this.esc(this.origin || '—')}) · ` +
            `<strong>${active}</strong> ativas · ${st} estações · ${pts} pontos visados` +
            (flagged ? ` · <span class="text-rose-600 font-semibold">${flagged} marcadas</span>` : '');
    },

    _updateButtons() {
        const has = this.rows.length > 0;
        const adjusted = !!this.result;
        const flagged = this.rows.some(r => r.flagged && r.active);
        document.getElementById('btnAdjust').disabled = !has;
        document.getElementById('btnBlunder').disabled = !has;
        document.getElementById('btnCompare').disabled = !has;
        document.getElementById('btnOutliers').disabled = !adjusted;
        document.getElementById('btnDeactivate').disabled = !flagged;
        ['btnExportPDF', 'btnExportCoords', 'btnExportResid'].forEach(id => {
            document.getElementById(id).disabled = !adjusted;
        });
        const steps = {
            step1: has ? (adjusted ? 'done' : 'active') : '',
            step2: adjusted ? (this.lastDetection ? 'done' : 'active') : '',
            step3: flagged ? 'active' : (this.lastDetection ? 'done' : ''),
            step4: adjusted ? 'done' : '',
            step5: adjusted ? 'active' : ''
        };
        Object.entries(steps).forEach(([id, state]) => {
            const el = document.getElementById(id);
            el.classList.remove('step-done', 'step-active');
            if (state) el.classList.add(`step-${state}`);
        });
    },

    // ---------------------------------------------------------------- ajustamento
    runAdjustment() {
        if (!this.rows.length) return;
        const when = new Date().toLocaleTimeString('pt-BR');
        try {
            this.result = NetAdjust.adjustNetwork(this.rows, this.settings);
        } catch (e) {
            this.result = null;
            const lbl = `${NetAdjust.MODEL_LABELS[this.settings.model] || ''} · ${NetAdjust.DATUM_LABELS[this.settings.datum] || ''}`;
            this.runs.push({ when, ok: false, msg: `${lbl}: ${e.message}` });
            this._computePreview();
            this._refreshAll(false);
            alert(`Falha no ajustamento:\n\n${e.message}`);
            return;
        }
        const r = this.result;
        this.runs.push({
            when, ok: true,
            msg: `${r.modelLabel} · ${r.datumLabel}: ${r.m} visadas, gl ${r.dof}, ${r.iterations} iterações, ${r.converged ? 'convergiu' : 'NÃO convergiu'}, ` +
                `σ̂₀² = ${Number.isFinite(r.sigma02) ? r.sigma02.toFixed(3) : '—'}, teste global ${r.globalPass === null ? '—' : (r.globalPass ? 'aprovado' : 'reprovado')}`
        });
        if (!this._autoScaled) { this._autoEllipseScale(); this._autoScaled = true; }
        if (!r.converged) {
            alert(`O ajustamento não convergiu em ${this.settings.maxIter} iterações. ` +
                'Veja os avisos e o histórico na aba Relatório.');
        }
        this._refreshAll(false);
    },

    runOutlierDetection() {
        if (!this.result) return;
        const method = document.getElementById('outlierMethod').value;
        let det;
        try {
            det = NetAdjust.detectOutliers(this.rows, this.result, method, this.settings);
        } catch (e) {
            alert(`Falha na detecção: ${e.message}`);
            return;
        }
        this.lastDetection = det;
        this.rows.forEach(r => { r.flagged = false; });
        this.flagComps = new Map();
        det.comps.forEach(c => {
            if (!this.flagComps.has(c.idx)) this.flagComps.set(c.idx, new Set());
            this.flagComps.get(c.idx).add(c.comp);
        });
        det.flagged.forEach(i => { if (this.rows[i]) this.rows[i].flagged = true; });
        this._refreshAll(false);
        this.switchTab('table');

        const lines = det.comps.map(c => `${c.id} [${c.comp}: ${Number.isFinite(c.value) ? c.value.toFixed(2) : '—'}]`);
        alert(det.flagged.length
            ? `${det.label}: ${det.flagged.length} visada(s) marcada(s) — ${det.detail}\n\n${lines.join('\n')}\n\n` +
            'Desative-as na tabela (ou use "Desativar marcadas") e reexecute o ajustamento.'
            : `${det.label}: nenhum outlier detectado — ${det.detail}.`);
    },

    deactivateFlagged() {
        let n = 0;
        this.rows.forEach(r => { if (r.flagged && r.active) { r.active = false; n++; } });
        if (n) this._invalidate(false);
    },

    reactivateAll() {
        this.rows.forEach(r => { r.active = true; r.flagged = false; });
        this.lastDetection = null;
        this.flagComps = new Map();
        this._invalidate(false);
    },

    // ---------------------------------------------------------------- erro grosseiro
    openBlunderModal() {
        const list = document.getElementById('blunderList');
        const comp = document.getElementById('blunderComp').value;
        const c = { hz: 0, zen: 1, dist: 2 }[comp];
        const byIdx = new Map(this.result ? this.result.obsData.map(o => [o.row.idx, o]) : []);
        const eligible = this.rows.filter(r => r.active && !r.hasBlunder);
        const pre = eligible.length ? eligible[Math.floor(Math.random() * eligible.length)].idx : -1;
        list.innerHTML = this.rows.map(r => {
            const o = byIdx.get(r.idx);
            const red = o ? ` · r = ${o.r[c].toFixed(2)}` : '';
            return `<label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                <input type="checkbox" class="blunderCheck accent-rose-500" value="${r.idx}"
                    ${r.hasBlunder || !r.active ? 'disabled' : (r.idx === pre ? 'checked' : '')}>
                <span class="font-mono">${this.esc(r.id)}</span>
                <span class="text-stone-400 text-xs">${r.hasBlunder ? 'já contém erro' : (!r.active ? 'inativa' : '')}${red}</span>
            </label>`;
        }).join('');
        document.getElementById('blunderComp').onchange = () => this.openBlunderModal();
        document.getElementById('blunderModal').style.display = 'flex';
    },

    closeBlunderModal() { document.getElementById('blunderModal').style.display = 'none'; },

    confirmBlunder() {
        const sel = Array.from(document.querySelectorAll('.blunderCheck:checked')).map(c => parseInt(c.value));
        if (!sel.length) { alert('Selecione ao menos uma visada.'); return; }
        const k = parseFloat(document.getElementById('blunderK').value);
        const comp = document.getElementById('blunderComp').value;
        const c = { hz: 0, zen: 1, dist: 2 }[comp];
        const out = sel.map(i => {
            const row = this.rows[i];
            const sigma = NetAdjust.obsSigmas(row, this.settings).sig[c];
            const b = RedeIO.injectBlunder(row, comp, k, sigma);
            const txt = comp === 'dist' ? `${(b.offset * 1000).toFixed(2)} mm` : `${(b.offset / NetAdjust.ARCSEC).toFixed(2)}″`;
            return `${row.id}: ${b.offset >= 0 ? '+' : ''}${txt}`;
        });
        this.lastDetection = null;
        this.closeBlunderModal();
        this._invalidate(false);
        const label = { hz: 'leitura horizontal', zen: 'ângulo zenital', dist: 'distância inclinada' }[comp];
        alert(`Erros grosseiros injetados (${k}σ na ${label}):\n\n${out.join('\n')}\n\n` +
            'Execute o ajustamento para detectá-los. Em visadas com r ≈ 0 (pontos irradiados) o erro passa despercebido.');
    },

    // ---------------------------------------------------------------- abas
    switchTab(tab) {
        this.activeTab = tab;
        ['view3d', 'views2d', 'table', 'coords', 'compare', 'matrices', 'report', 'settings'].forEach(t => {
            document.getElementById(`tab-${t}`).style.display = (t === tab) ? '' : 'none';
            document.getElementById(`tabBtn-${t}`).className = 'tab-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-all' +
                (t === tab ? ' tab-btn-active' : '');
        });
        if (tab === 'view3d') setTimeout(() => this.viewer.resize(), 30);
        if (tab === 'views2d') setTimeout(() => {
            Object.values(this.views.panels).forEach(p => { if (!p.view) p.fit(); });
            this.views.render();
        }, 30);
    },

    updateViewOptions() {
        const g = id => document.getElementById(id);
        const s3 = Math.pow(10, parseFloat(g('ellipsoidScale').value));
        const s2 = Math.pow(10, parseFloat(g('ellipseScale2d').value));
        const fmtScale = s => s >= 100 ? `${Math.round(s / 10) * 10}×` : `${s.toFixed(s < 10 ? 1 : 0)}×`;
        const ve = parseFloat(g('vertExag2d').value);
        g('ellipsoidScaleVal').textContent = fmtScale(s3);
        g('ellipseScale2dVal').textContent = fmtScale(s2);
        g('vertExag2dVal').textContent = `${ve}×`;
        g('pointScaleVal').textContent = `${parseFloat(g('pointScale').value).toFixed(2)}×`;
        const confK = NetAdjust.confidenceK(this.settings.ellipsoidConf, 3);
        const colors = {
            colorStation: g('colStation').value, colorFixed: g('colFixed').value, colorFree: g('colFree').value,
            colorLine: g('colLine').value
        };
        this.viewer.setOptions(Object.assign({
            showEllipsoids: g('chkEllipsoids').checked, showLines: g('chkLines').checked,
            showLabels: g('chkLabels').checked, showAxes: g('chkAxes').checked,
            pointScale: parseFloat(g('pointScale').value),
            ellipsoidScale: s3, confK, colorEllipsoid: g('colEllipsoid').value
        }, colors));
        this.views.setOptions(Object.assign({
            showEllipses: g('chkEllipses2d').checked, showLines: g('chkLines2d').checked,
            showLabels: g('chkLabels2d').checked, ellipseScale: s2, confK, colorEllipse: g('colEllipsoid').value,
            vertExag: ve
        }, colors));
    },

    // Nível dos elipsoides: é só apresentação, não exige reajustar
    setConfidence(conf) {
        this.settings.ellipsoidConf = conf;
        document.getElementById('confSelect3d').value = conf;
        document.getElementById('setConf').value = conf;
        if (this.result) {
            const k = NetAdjust.confidenceK(conf, 3);
            this.result.settings.ellipsoidConf = conf;
            this.result.confK3 = k;
            this.result.confLabel = NetAdjust.CONF_LABELS[conf];
            this.result.pointResults.forEach(p => { if (p.ellipsoid) p.ellipsoid = NetAdjust.ellipsoid3D(p.Sigma, k); });
        }
        this.updateViewOptions();
        this.renderCoordinates();
        this.renderReport();
        document.getElementById('view3dMode').textContent = this._modeText();
    },

    // ---------------------------------------------------------------- tabela de observações
    renderDataTable() {
        const tbody = document.querySelector('#tableData tbody');
        if (!this.rows.length) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center text-stone-400 py-4">Carregue a amostra ou um CSV.</td></tr>';
            return;
        }
        const r = this.result;
        const byIdx = new Map(r ? r.obsData.map(o => [o.row.idx, o]) : []);
        const AS = NetAdjust.ARCSEC;
        const num = (v, d) => {
            if (!Number.isFinite(v)) return '—';
            const s = v.toFixed(d);
            return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
        };
        const trio = (vals, hot) => `<div class="trio">${vals.map((v, c) =>
            `<span class="${hot && hot[c] ? 'hot' : ''}">${v}</span>`).join('')}</div>`;

        tbody.innerHTML = this.rows.map((row, i) => {
            const o = byIdx.get(i);
            const sig = NetAdjust.obsSigmas(row, this.settings);
            const flagged = this.flagComps.get(i);
            const cls = [!row.active ? 'row-inactive' : '', row.flagged ? 'row-outlier' : ''].filter(Boolean).join(' ');
            const inp = (field, val, step) =>
                `<input type="number" class="field" step="${step}" value="${val}" data-i="${i}" data-f="${field}" oninput="app.updateCell(event)">`;

            let badge;
            if (!row.active) badge = '<span class="badge badge-off">INATIVA</span>';
            else if (row.flagged) badge = '<span class="badge badge-out">OUTLIER</span>';
            else if (o && !o.controlled.some(Boolean)) badge = '<span class="badge badge-free" title="Ponto irradiado de uma só estação: r = 0">SEM CONTROLE</span>';
            else if (o) badge = o.isOutlier ? '<span class="badge badge-out">|w| ALTO</span>' : '<span class="badge badge-ok">OK</span>';
            else badge = '<span class="text-stone-400 text-xs">—</span>';

            const sigTxt = [sig.sig[0] / AS, sig.sig[1] / AS, sig.sig[2] * 1000].map((v, c) =>
                sig.nominalUsed[c] ? `${v.toFixed(2)}*` : v.toFixed(2));
            let vCell = '—', wCell = '—', rCell = '—', mCell = '—';
            if (o) {
                vCell = trio([o.v[0] / AS, o.v[1] / AS, o.v[2] * 1000].map(v => num(v, 2)));
                const hot = o.w.map((w, c) => (Number.isFinite(w) && Math.abs(w) > r.critW) ||
                    (flagged && flagged.has(NetAdjust.COMP[c])));
                wCell = trio(o.w.map(w => num(w, 2)), hot);
                rCell = trio(o.r.map(x => x.toFixed(2)));
                mCell = trio(o.mdb.map((m, c) => m === null ? '—' : (c < 2 ? (m / AS).toFixed(1) : (m * 1000).toFixed(2))));
            }
            const fixedTxt = row.fixed ? (row.xyz ? 'sim (XYZ)' : 'sim') : 'não';
            return `<tr class="${cls}">
                <td><input type="checkbox" class="accent-teal-600" ${row.active ? 'checked' : ''} onchange="app.toggleActive(${i}, this.checked)"></td>
                <td class="font-mono text-xs">${this.esc(row.id)}${row.hasBlunder ? ' <span class="text-rose-500" title="Erro grosseiro injetado">&#9888;</span>' : ''}</td>
                <td>${inp('hzDeg', +row.hzDeg.toFixed(10), 0.0001)}</td>
                <td>${inp('zenDeg', +row.zenDeg.toFixed(10), 0.0001)}</td>
                <td>${inp('dist', +row.dist.toFixed(6), 0.0001)}</td>
                <td>${trio(sigTxt)}</td>
                <td class="text-xs"><label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="accent-rose-600" ${row.fixed ? 'checked' : ''} onchange="app.toggleFixed(${i}, this.checked)"> ${fixedTxt}</label></td>
                <td>${vCell}</td>
                <td>${wCell}</td>
                <td>${rCell}</td>
                <td>${mCell}</td>
                <td>${badge}</td>
            </tr>`;
        }).join('');
    },

    toggleActive(i, checked) {
        this.rows[i].active = checked;
        this._invalidate(false);
    },

    // "Fixo" é propriedade do ponto: vale para todas as visadas a ele
    toggleFixed(i, checked) {
        const name = this.rows[i].target;
        this.rows.forEach(r => { if (r.target === name) { r.fixed = checked; if (!checked) r.xyz = null; } });
        this._invalidate(false);
    },

    updateCell(event) {
        const i = parseInt(event.target.dataset.i);
        const f = event.target.dataset.f;
        const v = parseFloat(event.target.value);
        if (!Number.isFinite(v)) return;
        if (f === 'dist' && !(v > 0)) return;
        if (f === 'zenDeg' && !(v > 0 && v < 180)) return;
        this.rows[i][f] = f === 'hzDeg' ? ((v % 360) + 360) % 360 : v;
        this.result = null;
        clearTimeout(this._cellTimer);
        this._cellTimer = setTimeout(() => this._invalidate(false), 400);
    },

    // ---------------------------------------------------------------- painéis
    renderGlobalTest() {
        const panel = document.getElementById('panelGlobalTest');
        const head = '<h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>';
        const r = this.result;
        if (!r) {
            panel.innerHTML = head + '<div class="text-center py-4"><p class="text-xs text-stone-400">Aguardando ajustamento...</p></div>';
            return;
        }
        if (r.globalPass === null) {
            panel.innerHTML = head + '<p class="text-xs text-amber-600">Sem redundância: o teste global não se aplica.</p>';
            return;
        }
        const pass = r.globalPass;
        const side = r.VtPV > r.chi2upp ? 'acima' : 'abaixo';
        const color = pass ? 'text-teal-600' : 'text-rose-600';
        const bg = pass ? 'bg-teal-50 border-teal-200' : 'bg-rose-50 border-rose-200';
        const a2 = this.settings.alphaPct / 2;
        panel.innerHTML = head + `
            <div class="p-3 rounded-lg border ${bg} text-center mb-3">
                <span class="font-bold ${color}">${pass ? '&#10003; Aprovado' : '&#10007; Reprovado (' + side + ')'}</span>
            </div>
            <div class="space-y-1 text-xs text-stone-600 font-mono">
                <div class="flex justify-between"><span>&chi;&sup2; calc. (V<sup>T</sup>PV):</span><span class="font-bold">${r.VtPV.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&chi;&sup2; inf (${a2}%):</span><span>${r.chi2low.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&chi;&sup2; sup (${100 - a2}%):</span><span>${r.chi2upp.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>&sigma;&#x302;&sup2;<sub>0</sub>:</span><span>${r.sigma02.toFixed(4)}</span></div>
                <div class="flex justify-between"><span>Graus de liberdade:</span><span>${r.dof}</span></div>
                <div class="flex justify-between"><span>Iterações:</span><span>${r.iterations}${r.converged ? '' : ' (não convergiu)'}</span></div>
            </div>
            ${!pass && r.VtPV > r.chi2upp
                ? '<p class="text-[11px] text-rose-600 mt-3 leading-tight">As visadas discordam mais do que os desvios informados preveem: erro grosseiro ou desvios otimistas. Prossiga para a detecção de outliers ou revise o modelo estocástico (Configurações).</p>'
                : ''}
            ${!pass && r.VtPV < r.chi2low
                ? '<p class="text-[11px] text-amber-600 mt-3 leading-tight">Resíduos menores que o previsto: os desvios informados estão pessimistas para estes dados.</p>'
                : ''}`;
    },

    _currentLog() {
        const items = this.parseWarnings.map(msg => ({ level: 'aviso', msg: `Leitura do CSV: ${msg}` }));
        const lastRun = this.runs[this.runs.length - 1];
        if (this.result) return items.concat(this.result.log);
        if (lastRun && !lastRun.ok) items.push({ level: 'erro', msg: `Ajustamento: ${lastRun.msg}` });
        if (this.preview) {
            if (this.preview.error && !(lastRun && !lastRun.ok && lastRun.msg === this.preview.error)) {
                items.push({ level: 'erro', msg: this.preview.error });
            }
            return items.concat(this.preview.log || []);
        }
        return items;
    },

    renderLog() {
        const el = document.getElementById('logPanel');
        const items = this._currentLog();
        if (!items.length) { el.innerHTML = '<p class="text-xs text-stone-400">Nenhum.</p>'; return; }
        const order = { erro: 0, aviso: 1, info: 2 };
        el.innerHTML = items.slice().sort((a, b) => order[a.level] - order[b.level])
            .map(it => `<div class="log-item log-${it.level}"><strong class="uppercase text-[9px] tracking-wider">${it.level}</strong> ${this.esc(it.msg)}</div>`)
            .join('');
    },

    renderSummary() {
        const el = document.getElementById('summaryPanel');
        const r = this.result;
        if (!r) {
            const p = this.preview;
            el.innerHTML = p && p.net
                ? `<p class="text-xs text-stone-500">${p.net.rows.length} visadas ativas → ${p.net.nEq} equações de condição, ` +
                  `${p.net.u} incógnitas, <strong>${p.net.dof} graus de liberdade</strong>. Aproximações iniciais prontas; execute o ajustamento.</p>`
                : '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            return;
        }
        const free = r.pointResults.filter(p => !p.fixed);
        const worst = free.reduce((a, p) => {
            const s = Math.max(...p.sigma);
            return s > a.s ? { s, name: p.name } : a;
        }, { s: 0, name: '—' });
        let wmax = { w: 0, id: '—' };
        r.obsData.forEach(o => o.w.forEach(w => { if (Number.isFinite(w) && Math.abs(w) > Math.abs(wmax.w)) wmax = { w, id: o.row.id }; }));
        const tile = (label, value, sub, tone) => `<div class="p-2.5 rounded-lg border ${tone || 'border-stone-200 bg-stone-50'}">
            <div class="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">${label}</div>
            <div class="text-base font-bold text-stone-800 font-mono">${value}</div>
            <div class="text-[10px] text-stone-400">${sub || ''}</div></div>`;
        const glTxt = r.d ? `gl = n − u + d = ${r.nEq} − ${r.u} + ${r.d}` : `gl = n − u = ${r.nEq} − ${r.u}`;
        el.innerHTML = `<p class="text-[11px] text-stone-500 mb-2"><strong class="text-stone-700">${r.modelLabel}</strong> · ${r.datumLabel} · ${glTxt}</p>
            <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            ${tile('Visadas', r.m, `${r.nEq} equações`)}
            ${tile('Incógnitas', r.u, `${r.net.stations.length} estações`)}
            ${tile('Graus de lib.', r.dof, `Σr = ${r.redundancySum.toFixed(3)}`)}
            ${tile('Iterações', r.iterations, r.converged ? 'convergiu' : 'NÃO convergiu', r.converged ? '' : 'border-rose-200 bg-rose-50')}
            ${tile('<span class="nc">σ̂₀</span>', Number.isFinite(r.sigma0) ? r.sigma0.toFixed(3) : '—', 'a posteriori / a priori')}
            ${tile('Pior <span class="nc">σ</span>', (worst.s * 1000).toFixed(2) + ' mm', this.esc(worst.name))}
            ${tile('Maior |w|', Math.abs(wmax.w).toFixed(2), this.esc(wmax.id), Math.abs(wmax.w) > r.critW ? 'border-rose-200 bg-rose-50' : '')}
            ${tile('cond(N)', r.condN === null ? '—' : r.condN.toExponential(1), '')}
        </div>`;
    },

    renderCoordinates() {
        const thead = document.querySelector('#tableCoords thead');
        const tbody = document.querySelector('#tableCoords tbody');
        const hint = document.getElementById('coordsHint');
        const r = this.result;
        const AS = NetAdjust.ARCSEC;
        const tipoBadge = t => `<span class="badge ${t.startsWith('estação') ? 'badge-free' : ((t === 'fixo' || t.startsWith('apoio')) ? 'badge-out' : 'badge-ok')}">${t}</span>`;
        if (r) {
            const truth = this.truth;
            hint.innerHTML = `Coordenadas ajustadas (m), desvios-padrão e semieixos do elipsoide ${r.confLabel} em mm` +
                (truth ? '. <strong>Δ verdade</strong>: distância à posição simulada.' : '.') +
                ' Δ aprox.: quanto o ajustamento moveu o ponto em relação à aproximação inicial.';
            const g = s => `<span class="nc">${s}</span>`;
            thead.innerHTML = `<tr><th>Ponto</th><th>Tipo</th><th>X</th><th>Y</th><th>Z</th><th>${g('σ')}X</th><th>${g('σ')}Y</th><th>${g('σ')}Z</th>
                <th data-tooltip="Semieixos do elipsoide (maior, médio, menor)">a, b, c (${g(r.confLabel)})</th><th>${g('ω')}</th><th>${g('σω')} (″)</th>
                <th>Visadas</th><th>&Delta; aprox. (mm)</th>${truth ? '<th>&Delta; verdade (mm)</th>' : ''}</tr>`;
            tbody.innerHTML = r.pointResults.map(p => {
                const d0 = p.initial ? Math.hypot(...p.xyz.map((v, i) => v - p.initial[i])) * 1000 : NaN;
                let dt = '';
                if (truth) {
                    const t = p.isStation ? (truth.stations[p.name] || {}).xyz : truth.points[p.name];
                    dt = `<td class="font-mono text-xs">${t ? (Math.hypot(...p.xyz.map((v, i) => v - t[i])) * 1000).toFixed(2) : '—'}</td>`;
                }
                const s = v => p.fixed ? '—' : (v * 1000).toFixed(2);
                return `<tr>
                    <td class="font-mono text-xs font-semibold">${this.esc(p.name)}</td>
                    <td>${tipoBadge(p.tipo)}${p.origem === 'irradiado (datum)' ? ' <span class="text-[10px] text-stone-400">datum</span>' : ''}</td>
                    ${p.xyz.map(v => `<td class="font-mono text-xs">${v.toFixed(4)}</td>`).join('')}
                    <td class="font-mono text-xs">${s(p.sigma[0])}</td><td class="font-mono text-xs">${s(p.sigma[1])}</td><td class="font-mono text-xs">${s(p.sigma[2])}</td>
                    <td class="font-mono text-xs">${p.ellipsoid ? p.ellipsoid.axes.map(a => (a * 1000).toFixed(2)).join(', ') : '—'}</td>
                    <td class="font-mono text-xs">${p.isStation ? RedeReport.formatDMS(p.omega) : ''}</td>
                    <td class="font-mono text-xs">${p.isStation ? (p.sigmaOmega / AS).toFixed(2) : ''}</td>
                    <td class="font-mono text-xs">${p.isStation ? '' : p.nObs}</td>
                    <td class="font-mono text-xs">${Number.isFinite(d0) && !p.fixed ? d0.toFixed(2) : '—'}</td>
                    ${dt}
                </tr>`;
            }).join('');
            return;
        }
        const pv = this.preview;
        if (!pv) { thead.innerHTML = ''; tbody.innerHTML = '<tr><td class="text-stone-400 text-xs py-4">Carregue observações.</td></tr>'; return; }
        if (pv.error) {
            hint.textContent = 'Não foi possível montar a rede com as visadas ativas.';
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td class="text-rose-600 text-xs py-3 whitespace-normal">${this.esc(pv.error)}</td></tr>`;
            return;
        }
        hint.innerHTML = 'Coordenadas <strong>aproximadas</strong> (antes do ajustamento): fixos, resseção das estações e irradiação dos pontos.';
        thead.innerHTML = '<tr><th>Ponto</th><th>Tipo</th><th>X</th><th>Y</th><th>Z</th><th>Origem da aproximação</th></tr>';
        const rows = [];
        pv.approx.coords.forEach((xyz, name) => {
            const src = pv.approx.source.get(name) || {};
            const isSt = pv.net.stations.includes(name);
            const support = (pv.net.supportNames || []).includes(name);
            const tipo = isSt ? 'estação' : (pv.net.fixedCoords.has(name) ? 'fixo' : (support ? 'apoio (livre)' : 'livre'));
            const fixoTxt = pv.net.free ? 'aproximação do apoio' : 'fixo';
            const origem = src.kind === 'irradiado' ? `irradiado de ${src.origin.station}`
                : (src.kind === 'fixo' ? (pv.net.datum.computed.includes(name) ? `${fixoTxt} irradiado (datum)` : `${fixoTxt} (CSV)`)
                    : (src.kind === 'datum assumido' ? 'semente: datum local assumido' : (src.kind || '')));
            rows.push(`<tr><td class="font-mono text-xs font-semibold">${this.esc(name)}</td><td>${tipoBadge(tipo)}</td>
                ${xyz.map(v => `<td class="font-mono text-xs">${v.toFixed(4)}</td>`).join('')}
                <td class="text-xs text-stone-500">${this.esc(origem)}</td></tr>`);
        });
        tbody.innerHTML = rows.join('');
    },

    _reportModel() {
        return RedeReport.buildReportModel(this.result, {
            rows: this.rows, origin: this.origin, detection: this.lastDetection, settings: this.settings, runs: this.runs
        });
    },

    renderReport() {
        const el = document.getElementById('reportContent');
        const runs = this.runs.length
            ? `<h3 class="report-h">Execuções nesta sessão</h3><div class="space-y-1">${this.runs.map(x =>
                `<div class="log-item ${x.ok ? 'log-info' : 'log-erro'}"><strong>${x.when}</strong> ${x.ok ? '' : 'FALHOU — '}${this.esc(x.msg)}</div>`).join('')}</div>`
            : '';
        if (!this.result) {
            el.innerHTML = '<p class="text-xs text-stone-400 mb-3">Aguardando ajustamento...</p>' + runs;
            return;
        }
        const m = this._reportModel();
        const kv = pairs => `<table class="mb-4"><tbody>${pairs.map(([k, v]) =>
            `<tr><td class="text-stone-500 text-xs font-semibold" style="width:30%">${this.esc(k)}</td><td class="text-xs whitespace-normal">${this.esc(v)}</td></tr>`).join('')}</tbody></table>`;
        const tbl = t => `<div class="table-container mb-4"><table><thead><tr>${t.head.map(h => `<th>${this.esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td class="font-mono text-xs">${this.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        el.innerHTML = `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div>
                    <h3 class="report-h">Resumo</h3>${kv(m.summary)}
                    <h3 class="report-h">Modelo estocástico</h3>${kv(m.stochastic)}
                </div>
                <div>
                    <h3 class="report-h">Iterações</h3>${tbl(m.iterations)}
                    <h3 class="report-h">Aproximações iniciais</h3>${tbl(m.approximations)}
                    <h3 class="report-h">Avisos e erros</h3>
                    <div class="space-y-1 mb-4">${m.warnings.map(w => `<div class="log-item log-${w.level}"><strong class="uppercase text-[9px] tracking-wider">${w.level}</strong> ${this.esc(w.msg)}</div>`).join('') || '<p class="text-xs text-stone-400">Nenhum.</p>'}</div>
                    ${m.detection ? `<h3 class="report-h">Detecção de outliers</h3>${kv([['Método', m.detection.label], ['Critério', m.detection.detail], ['Marcadas', m.detection.flagged.join('; ') || 'nenhuma']])}` : ''}
                    ${runs}
                </div>
            </div>
            <p class="text-[11px] text-stone-400">Coordenadas e resíduos completos nas abas <strong>Coordenadas</strong> e <strong>Observações</strong>; no PDF entram também as vistas 3D e 2D.</p>`;
    },

    // ---------------------------------------------------------------- comparação de modelos
    runComparison() {
        if (!this.rows.length) return;
        const el = document.getElementById('compareContent');
        el.innerHTML = '<p class="text-xs text-stone-400">Calculando os quatro ajustamentos...</p>';
        setTimeout(() => {
            try { this.lastComparison = NetAdjust.compareModels(this.rows, this.settings); }
            catch (e) { el.innerHTML = `<p class="text-xs text-rose-600">Falha na comparação: ${this.esc(e.message)}</p>`; return; }
            this.renderComparison(this.lastComparison);
        }, 20);
    },

    renderComparison(cmp) {
        const el = document.getElementById('compareContent');
        const AS = NetAdjust.ARCSEC;
        const cols = cmp.runs;
        const exp = (v, d = 1) => (v === undefined || v === null || !Number.isFinite(v)) ? '—' : (v === 0 ? '0' : v.toExponential(d));
        const head = `<tr><th></th>${cols.map(c => `<th class="whitespace-normal">${c.model === 'parametrico' ? 'Paramétrico' : 'Combinado'}` +
            `<br><span class="font-normal normal-case text-stone-400">${c.datum === 'livre' ? 'rede livre' : 'pontos fixos'}</span></th>`).join('')}</tr>`;
        const cell = (c, fn) => c.res ? fn(c) : `<span class="text-rose-600 text-[10px] whitespace-normal">falhou: ${this.esc(c.error || '')}</span>`;
        const row = (label, fn) => `<tr><td class="text-stone-500 text-xs whitespace-normal">${label}</td>` +
            cols.map(c => `<td class="font-mono text-xs whitespace-normal">${cell(c, fn)}</td>`).join('') + '</tr>';
        const sec = (t, tone) => `<tr><td colspan="${cols.length + 1}" class="${tone || 'bg-stone-50 text-stone-500'} text-[10px] font-bold uppercase tracking-wider">${t}</td></tr>`;
        const ref = cols.find(c => c.res);

        const table = `<div class="table-container mb-4"><table><thead>${head}</thead><tbody>
            ${sec('Dimensões')}
            ${row('iterações', c => `${c.res.iterations}${c.res.converged ? '' : ' <span class="hot">(não convergiu)</span>'}`)}
            ${row('equações n', c => c.res.nEq)}
            ${row('incógnitas u', c => c.res.u)}
            ${row('defeito de posto d', c => c.res.d)}
            ${row('graus de liberdade n − u + d', c => c.res.dof)}
            ${sec('Qualidade')}
            ${row('V<sup>T</sup>PV', c => c.res.VtPV.toFixed(4))}
            ${row('&sigma;&#x302;²<sub>0</sub>', c => Number.isFinite(c.res.sigma02) ? c.res.sigma02.toFixed(4) : '—')}
            ${row('teste global', c => c.res.globalPass === null ? '—' : (c.res.globalPass ? '<span class="text-teal-700">aprovado</span>' : '<span class="hot">reprovado</span>'))}
            ${row('&Sigma;r', c => c.res.redundancySum.toFixed(4))}
            ${row('traço de &Sigma;<sub>Xa</sub> nas coordenadas (mm²)', c => (c.traceCoord * 1e6).toFixed(2))}
            ${row('cond(N) (sem os nulos)', c => exp(c.res.condN, 2))}
            ${sec('O que não pode mudar', 'bg-teal-50 text-teal-700')}
            ${row('max|&Delta;X<sub>a</sub>| para o outro modelo, mesmo datum (m / ″)', c => c.dModel ? `${exp(c.dModel.lin)} / ${exp(c.dModel.ang / AS)}` : '—')}
            ${row(`max|&Delta;V| contra ${ref ? this.esc(ref.label) : '—'} (″ / mm)`, c => c === ref ? 'referência' : (c.dV ? `${exp(c.dV.ang / AS)} / ${exp(c.dV.lin * 1000)}` : '—'))}
            ${row('max|&Delta;| das distâncias entre pontos (mm)', c => c === ref ? 'referência' : exp(c.dDist * 1000))}
        </tbody></table></div>`;

        // Teste de compatibilidade dos pontos fixos
        const compat = cmp.compat.map(c => {
            const name = c.model === 'parametrico' ? 'Paramétrico' : 'Combinado';
            if (!c.available) return `<p><strong>${name}:</strong> indisponível (uma das variantes falhou).</p>`;
            if (!c.applicable) return `<p><strong>${name}:</strong> não se aplica — os pontos fixos não impõem injunções além do datum mínimo (gl iguais).</p>`;
            const dv = Math.abs(c.dV) < 1e-6 ? 0 : c.dV;
            return `<p><strong>${name}:</strong> &Delta;V<sup>T</sup>PV = ${dv.toFixed(4)} com ${c.ddof} graus; &chi;² crítico (${this.settings.alphaPct}%) = ${c.crit.toFixed(3)} → ` +
                (c.pass ? '<span class="text-teal-700 font-semibold">compatíveis</span>' : '<span class="hot">INCOMPATÍVEIS</span>') + '</p>';
        }).join('');

        // σ por ponto: pontos fixos × rede livre (os dois modelos são idênticos)
        const fx = cols.find(c => c.res && c.datum === 'fixos'), lv = cols.find(c => c.res && c.datum === 'livre');
        let sigTable = '';
        if (fx && lv) {
            const byName = res => new Map(res.pointResults.map(p => [p.name, p]));
            const a = byName(fx.res), b = byName(lv.res);
            const names = lv.res.pointResults.map(p => p.name);
            const trio = p => p ? (p.fixed ? '<span class="text-stone-400">fixo (0)</span>' : p.sigma.map(v => (v * 1000).toFixed(2)).join(' / ')) : '—';
            sigTable = `<h3 class="report-h mt-4"><span class="nc">σ</span>X / <span class="nc">σ</span>Y / <span class="nc">σ</span>Z por ponto (mm, ${this.settings.sigmaXaScale === 'priori' ? 'a priori' : 'a posteriori'})</h3>
            <div class="table-container mb-2" style="max-height:340px;overflow-y:auto"><table>
                <thead><tr><th>Ponto</th><th>Pontos fixos</th><th>Rede livre</th></tr></thead>
                <tbody>${names.map(n => `<tr><td class="font-mono text-xs font-semibold">${this.esc(n)}</td>
                    <td class="font-mono text-xs">${trio(a.get(n))}</td><td class="font-mono text-xs">${trio(b.get(n))}</td></tr>`).join('')}</tbody>
            </table></div>`;
        }

        el.innerHTML = table + `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="p-3 bg-stone-50 border border-stone-200 rounded text-[11px] text-stone-600 leading-snug space-y-1.5">
                    <h3 class="text-xs font-bold text-stone-600 uppercase tracking-wider">Compatibilidade dos pontos fixos</h3>
                    <p>Os pontos fixos impõem 3 injunções cada; o datum só precisa de 4. As que sobram só aumentam
                        V<sup>T</sup>PV se as coordenadas fixas discordarem das observações:
                        &Delta;V<sup>T</sup>PV = V<sup>T</sup>PV(fixos) − V<sup>T</sup>PV(livre) ~ &chi;² com gl(fixos) − gl(livre) graus.</p>
                    ${compat}
                </div>
                <div class="p-3 bg-teal-50 border border-teal-200 rounded text-[11px] text-stone-600 leading-snug space-y-1.5">
                    <h3 class="text-xs font-bold text-teal-800 uppercase tracking-wider">Como ler</h3>
                    <p><strong>Combinado × paramétrico</strong> com o mesmo datum: diferenças na ordem da precisão de
                        máquina — são o mesmo problema de mínimos quadrados escrito de duas formas.</p>
                    <p><strong>Pontos fixos × rede livre</strong>: resíduos e forma da rede (distâncias) não mudam
                        enquanto os fixos não tensionarem as observações. Mudam as coordenadas, os &sigma;, os
                        elipsoides e os graus de liberdade. Na rede livre o traço de &Sigma;<sub>Xa</sub> é o menor
                        possível, e nenhum ponto tem &sigma; nulo.</p>
                </div>
            </div>` + sigTable;
    },

    // ---------------------------------------------------------------- matrizes
    // desc: texto, ou função (resultado) => texto quando depende do modelo/datum.
    // models / datum: em quais variantes a matriz existe.
    MATRICES: [
        { key: 'A', label: 'A', tex: 'A', rows: 'obs', cols: 'unk', desc: r => r.model === 'parametrico'
            ? '<strong>Jacobiana das equações de observação (A = &part;F/&part;X<sub>a</sub>):</strong> três linhas (Hz, Z, S) por visada — derivadas de atan2 e da norma, com sinais opostos na estação e no ponto visado e −1 na coluna de &omega; (linha de Hz).'
            : '<strong>Jacobiana das equações de condição em relação às incógnitas (A = &part;F/&part;X<sub>a</sub>):</strong> três linhas por visada, +I no ponto visado, −I na estação e a coluna de &omega;, igual à coluna de Hz de B.' },
        { key: 'B', label: 'B', tex: 'B', rows: 'obs', cols: 'obs', models: ['combinado'], desc: '<strong>Jacobiana em relação às observações (B = &part;F/&part;L<sub>a</sub>):</strong> bloco-diagonal 3×3 por visada — a jacobiana da irradiação (Hz, Z, S) → (X, Y, Z), a mesma do ajustamento de planos. No paramétrico, B = −I.' },
        { key: 'SigLb', label: '&Sigma;<sub>Lb</sub>', tex: '\\Sigma_{L_b}', rows: 'obs', cols: 'obs', desc: '<strong>MVC das observações:</strong> diagonal com &sigma;² de Hz, Z (rad²) e S (m²), conforme a origem escolhida nas Configurações.' },
        { key: 'P', label: 'P', tex: 'P', rows: 'obs', cols: 'obs', desc: '<strong>Matriz dos pesos:</strong> P = &Sigma;<sub>Lb</sub>⁻¹, com &sigma;²<sub>0</sub> a priori = 1.' },
        { key: 'M', label: 'M', tex: 'M', rows: 'obs', cols: 'obs', models: ['combinado'], desc: '<strong>M = B P⁻¹ B<sup>T</sup>:</strong> bloco 3×3 por visada — a MVC cartesiana do vetor irradiado. No paramétrico, M = P⁻¹.' },
        { key: 'W', label: 'W', tex: 'W', rows: 'obs', vec: true, models: ['combinado'], desc: '<strong>Erro de fechamento</strong> da última iteração, na forma iterada de Gemael: W = F(L<sub>0</sub>, X<sub>0</sub>) + B(L<sub>b</sub> − L<sub>0</sub>) (m).' },
        { key: 'L', label: 'L', tex: 'L', rows: 'obs', vec: true, models: ['parametrico'], desc: '<strong>Vetor L = L<sub>0</sub> − L<sub>b</sub></strong> (calculado menos observado, Hz reduzido a (−&pi;, &pi;]) da última iteração (rad, rad, m).' },
        { key: 'N', label: 'N', tex: 'N', rows: 'unk', cols: 'unk', desc: r => (r.model === 'parametrico'
            ? '<strong>Matriz normal:</strong> N = A<sup>T</sup> P A.' : '<strong>Matriz normal:</strong> N = A<sup>T</sup> M⁻¹ A.') +
            (r.d ? ` Na rede livre ela é <strong>singular</strong>: posto u − ${r.d} (veja λ(N)).` : '') },
        { key: 'eigN', label: '&lambda;(N)', tex: '\\lambda(N)', rows: 'eig', vec: true, desc: r => '<strong>Autovalores de N</strong> em ordem crescente. ' + (r.d
            ? `Os ${r.d} primeiros são nulos (à precisão numérica): o defeito de posto — translações em X, Y, Z e rotação em torno da vertical, direções que as observações não enxergam.`
            : 'Com pontos fixos, todos são positivos: o datum está definido.') },
        { key: 'G', label: 'G', tex: 'G', rows: 'unk', cols: 'g4', datum: ['livre'], desc: '<strong>Matriz das injunções internas (u × 4):</strong> o espaço nulo de N restrito às coordenadas — colunas de translação em X, Y, Z (1 nas respectivas coordenadas) e de rotação em torno da vertical (−(Y − Ȳ) em X, X − X̄ em Y), com zeros nas linhas de &omega;. A injunção G<sup>T</sup>X = 0 dá a solução de norma mínima.' },
        { key: 'Nb', label: 'N<sub>orlada</sub>', tex: '\\begin{bmatrix} N & G \\\\ G^T & 0 \\end{bmatrix}', rows: 'unkb', cols: 'unkb', datum: ['livre'], desc: '<strong>Sistema orlado [N G; G<sup>T</sup> 0]:</strong> não singular mesmo com N singular. O bloco u×u da sua inversa é Q, a inversa generalizada usada em X = −QU e em &Sigma;<sub>Xa</sub> = &sigma;&#x302;²<sub>0</sub>Q. (No cálculo, as colunas de G são escaladas ao porte de N, o que não muda a injunção.)' },
        { key: 'U', label: 'U', tex: 'U', rows: 'unk', vec: true, desc: r => r.model === 'parametrico'
            ? '<strong>Vetor dos termos independentes:</strong> U = A<sup>T</sup> P L.' : '<strong>Vetor dos termos independentes:</strong> U = A<sup>T</sup> M⁻¹ W.' },
        { key: 'X', label: 'X', tex: 'X', rows: 'unk', vec: true, desc: r => r.d
            ? '<strong>Correção da última iteração:</strong> X = −Q U, com Q do sistema orlado; cumpre G<sup>T</sup>X = 0.'
            : '<strong>Correção da última iteração:</strong> X = −N⁻¹ U. Abaixo do critério de convergência.' },
        { key: 'Xa', label: 'X<sub>a</sub>', tex: 'X_a', rows: 'unk', vec: true, desc: '<strong>Incógnitas ajustadas:</strong> coordenadas (m) e orientações &omega; (rad).' },
        { key: 'K', label: 'K', tex: 'K', rows: 'obs', vec: true, models: ['combinado'], desc: '<strong>Correlatos:</strong> K = −M⁻¹(AX + W).' },
        { key: 'V', label: 'V', tex: 'V', rows: 'obs', vec: true, desc: r => r.model === 'parametrico'
            ? '<strong>Resíduos:</strong> V = AX + L (rad, rad, m por visada).' : '<strong>Resíduos:</strong> V = P⁻¹ B<sup>T</sup> K (rad, rad, m por visada).' },
        { key: 'Lb', label: 'L<sub>b</sub>', tex: 'L_b', rows: 'obs', vec: true, desc: '<strong>Observações brutas</strong> (rad, rad, m).' },
        { key: 'La', label: 'L<sub>a</sub>', tex: 'L_a', rows: 'obs', vec: true, desc: '<strong>Observações ajustadas:</strong> L<sub>a</sub> = L<sub>b</sub> + V.' },
        { key: 'SigmaXa', label: '&Sigma;<sub>Xa</sub>', tex: '\\Sigma_{X_a}', rows: 'unk', cols: 'unk', desc: r => '<strong>MVC das incógnitas:</strong> &sigma;&#x302;²<sub>0</sub> Q (ou Q com a escala a priori), ' +
            (r.d ? 'Q do sistema orlado — posto u − 4, traço mínimo nas coordenadas.' : 'Q = N⁻¹.') + ' Os blocos 3×3 dão os elipsoides de erro.' },
        { key: 'SigmaLa', label: '&Sigma;<sub>La</sub>', tex: '\\Sigma_{L_a}', rows: 'obs', cols: 'obs', desc: r => r.model === 'parametrico'
            ? '<strong>MVC das observações ajustadas:</strong> &sigma;&#x302;²<sub>0</sub> A Q A<sup>T</sup>.'
            : '<strong>MVC das observações ajustadas:</strong> &sigma;&#x302;²<sub>0</sub>(P⁻¹ − Q<sub>V</sub>).' },
        { key: 'SigmaV', label: '&Sigma;<sub>V</sub>', tex: '\\Sigma_{V}', rows: 'obs', cols: 'obs', desc: r => '<strong>MVC dos resíduos:</strong> &sigma;&#x302;²<sub>0</sub> Q<sub>V</sub>, ' + (r.model === 'parametrico'
            ? 'Q<sub>V</sub> = P⁻¹ − A Q A<sup>T</sup>.' : 'Q<sub>V</sub> = P⁻¹B<sup>T</sup>(M⁻¹ − M⁻¹AQA<sup>T</sup>M⁻¹)BP⁻¹.') + ' Sua diagonal, vezes P, dá os números de redundância — iguais em qualquer datum.' }
    ],

    _visibleMatrices() {
        const model = this.result ? this.result.model : this.settings.model;
        const datum = this.result ? this.result.datum : this.settings.datum;
        return this.MATRICES.filter(m => (!m.models || m.models.includes(model)) && (!m.datum || m.datum.includes(datum)));
    },

    _buildMatrixTabs() {
        const wrap = document.getElementById('matrixTabs');
        const visible = this._visibleMatrices();
        if (!visible.some(m => m.key === this.activeMatrix)) this.activeMatrix = 'A';
        wrap.innerHTML = visible.map(m => {
            const active = m.key === this.activeMatrix;
            return `<button onclick="app.switchMatrixTab('${m.key}')"
                class="mat-tab-btn px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${active ? 'mat-tab-active' : 'text-stone-600 hover:bg-stone-200'}">${m.label}</button>`;
        }).join('');
    },

    switchMatrixTab(key) {
        this.activeMatrix = key;
        this._buildMatrixTabs();
        this.renderMatrixTab();
    },

    _full() {
        if (!this._fullCache || this._fullFor !== this.result) {
            this._fullCache = NetAdjust.fullMatrices(this.result);
            this._fullFor = this.result;
        }
        return this._fullCache;
    },

    getMatrix(key) {
        const r = this.result;
        if (!r) return null;
        const col = v => v.map(x => [x]);
        if (key === 'N') return r.N;
        if (key === 'U') return col(r.U);
        if (key === 'X') return col(r.X);
        if (key === 'Xa') return col(r.Xa);
        if (key === 'SigmaXa') return r.SigmaXa;
        if (key === 'eigN') return r.eigN ? col(r.eigN) : col(NetAdjust.linalg.eigSym(r.N).values);
        const F = this._full();
        if (key === 'L') return col(F.W);
        if (['W', 'K', 'V', 'Lb', 'La'].includes(key)) return col(F[key]);
        return F[key] || null;
    },

    _labels(kind) {
        const unk = () => this.result.unknowns.map(u => u.name);
        if (kind === 'unk') return unk();
        if (kind === 'obs') return NetAdjust.observationLabels(this.result);
        if (kind === 'g4') return ['tX', 'tY', 'tZ', 'rotZ'];
        if (kind === 'unkb') return unk().concat(['k_tX', 'k_tY', 'k_tZ', 'k_rotZ']);
        if (kind === 'eig') return this.result.unknowns.map((_, i) => `λ${i + 1}`);
        return null;
    },

    _matDesc(def) { return typeof def.desc === 'function' ? def.desc(this.result) : def.desc; },

    formatMatrixToLatex(tex, mat) {
        const MAX = 20;
        const truncated = mat.length > MAX || (mat[0] && mat[0].length > MAX);
        const disp = truncated ? mat.slice(0, MAX).map(r => r.slice(0, MAX)) : mat;
        const num = v => {
            if (v === null || v === undefined || Number.isNaN(v)) return '\\text{NaN}';
            if (Math.abs(v) < 1e-15) return '0';
            if (Number.isInteger(v) && Math.abs(v) < 1e5) return String(v);
            const a = Math.abs(v);
            if (a < 1e-3 || a > 1e5) {
                const [mant, exp] = v.toExponential(3).split('e');
                return `${mant} \\times 10^{${parseInt(exp)}}`;
            }
            return v.toFixed(4);
        };
        let rows = disp.map(r => r.map(num).join(' & ')).join(' \\\\ \n');
        if (truncated) rows += ' \\\\ \n \\vdots & \\ddots';
        return `${tex} = \\begin{bmatrix}\n${rows}\n\\end{bmatrix}`;
    },

    renderMatrixTab() {
        const container = document.getElementById('matrixContent');
        const desc = document.getElementById('matDesc');
        const legend = document.getElementById('matLegend');
        const def = this.MATRICES.find(m => m.key === this.activeMatrix);
        if (!this.result) {
            container.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            desc.innerHTML = '';
            legend.innerHTML = '';
            return;
        }
        let mat;
        try { mat = this.getMatrix(this.activeMatrix); }
        catch (e) { container.innerHTML = `<p class="text-xs text-rose-500">${this.esc(e.message)}</p>`; return; }
        if (!mat) { container.innerHTML = '<p class="text-xs text-stone-400">Matriz indisponível.</p>'; return; }
        container.innerHTML = '';
        if (window.katex) {
            try { katex.render(this.formatMatrixToLatex(def.tex, mat), container, { displayMode: true, throwOnError: false }); }
            catch (e) { container.innerHTML = '<p class="text-xs text-rose-500">Erro ao renderizar a matriz.</p>'; }
        } else {
            container.innerHTML = '<p class="text-xs text-rose-500">KaTeX não carregado.</p>';
        }
        desc.innerHTML = `<span class="text-stone-400 font-mono text-[10px]">dimensão ${mat.length} × ${mat[0].length}</span><br>${this._matDesc(def)}`;
        const unk = this._labels('unk'), obs = this._labels('obs');
        legend.innerHTML = `<p class="mb-1"><strong>Incógnitas (${unk.length}):</strong> ${unk.map((n, i) => `${i + 1}:${this.esc(n)}`).join(' · ')}</p>` +
            `<p><strong>Observações (${obs.length}):</strong> ${obs.map((n, i) => `${i + 1}:${this.esc(n)}`).join(' · ')}</p>`;
    },

    _matrixCSV(key) {
        const def = this.MATRICES.find(m => m.key === key);
        const mat = this.getMatrix(key);
        if (!mat) return null;
        const rowL = this._labels(def.rows);
        const colL = def.vec ? ['valor'] : this._labels(def.cols);
        const cell = s => /[",;\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s;
        const out = [['', ...colL].map(cell).join(',')];
        mat.forEach((row, i) => out.push([cell(rowL ? rowL[i] : String(i + 1)), ...row.map(v => RedeIO.fmt(v))].join(',')));
        return out.join('\n') + '\n';
    },

    exportActiveMatrix() {
        if (!this.result) return;
        const csv = this._matrixCSV(this.activeMatrix);
        if (!csv) { alert('Matriz indisponível.'); return; }
        RedeIO.download(`matriz_${this.activeMatrix}.csv`, csv);
    },

    exportAllMatrices() {
        if (!this.result) return;
        this._visibleMatrices().forEach((m, i) => {
            const csv = this._matrixCSV(m.key);
            // Downloads em sequência: alguns navegadores descartam disparos simultâneos
            if (csv) setTimeout(() => RedeIO.download(`matriz_${m.key}.csv`, csv), i * 250);
        });
    },

    // ---------------------------------------------------------------- configurações
    _settingsFields: [
        ['selModel', 'model', 'str'], ['selDatum', 'datum', 'str'],
        ['setSigmaSource', 'sigmaSource', 'str'], ['setSigmaUnit', 'sigmaAngUnit', 'str'],
        ['setSigAng', 'sigAngSec'], ['setEdmMm', 'edmMm'], ['setEdmPpm', 'edmPpm'],
        ['setDatumX', 'datumX'], ['setDatumY', 'datumY'], ['setDatumZ', 'datumZ'], ['setDatumW', 'datumOmegaDeg'],
        ['setMaxIter', 'maxIter', 'int'], ['setTolLin', 'tolLinMm'], ['setTolAng', 'tolAngSec'],
        ['setAlpha', 'alphaPct'], ['setAlpha0', 'alpha0Pct'], ['setPower', 'powerPct'], ['setSigmaK', 'sigmaRuleK'],
        ['setSigmaXa', 'sigmaXaScale', 'str'], ['setConf', 'ellipsoidConf', 'str']
    ],

    _writeSettingsForm(s) {
        this._settingsFields.forEach(([id, key]) => { document.getElementById(id).value = s[key]; });
        document.getElementById('confSelect3d').value = s.ellipsoidConf;
    },

    updateSettings(silent) {
        const s = this.settings;
        this._settingsFields.forEach(([id, key, type]) => {
            const raw = document.getElementById(id).value;
            if (type === 'str') { s[key] = raw; return; }
            const v = type === 'int' ? parseInt(raw) : parseFloat(raw);
            if (Number.isFinite(v)) s[key] = v;
        });
        const a0 = s.alpha0Pct / 100;
        const critW = NetAdjust.normInv(1 - a0 / 2), d0 = critW + NetAdjust.normInv(s.powerPct / 100);
        document.getElementById('delta0Info').textContent =
            `|w| crítico = ${critW.toFixed(3)}; δ₀ = ${d0.toFixed(3)} (erro mínimo detectável ∇₀ = δ₀ σ / √r).`;
        this._renderModelHint();
        if (silent === true) return;
        this.lastDetection = null;
        this._invalidate(false);
    },

    _renderModelHint() {
        const s = this.settings;
        const eq = s.model === 'parametrico' ? 'La = F(Xa): Hz, Z e S como funções das coordenadas'
            : 'F(La, Xa) = 0: três equações de condição por visada';
        const dt = s.datum === 'livre' ? 'todos os pontos incógnitos, defeito de posto 4 removido por injunções internas; gl = n − u + 4'
            : 'pontos fixos como constantes; gl = n − u';
        document.getElementById('modelHint').textContent = `${eq} · ${dt}.`;
    },

    resetSettings() {
        this.settings = Object.assign({}, RedeIO.DEFAULT_SETTINGS);
        this._writeSettingsForm(this.settings);
        this.updateSettings();
        this.setConfidence(this.settings.ellipsoidConf);
    },

    // ---------------------------------------------------------------- exportação
    exportObservations() {
        if (!this.rows.length) return;
        RedeIO.download('observacoes.csv', RedeIO.rowsToCSV(this.rows));
    },

    exportCoordinates() {
        if (!this.result) { alert('Execute o ajustamento antes de exportar.'); return; }
        RedeIO.download('coordenadas_ajustadas.csv', RedeIO.coordinatesToCSV(this.result));
    },

    exportResiduals() {
        if (!this.result) { alert('Execute o ajustamento antes de exportar.'); return; }
        RedeIO.download('residuos_observacoes.csv', RedeIO.residualsToCSV(this.result, this.rows));
    },

    exportReportText() {
        if (!this.result) { alert('Execute o ajustamento antes de gerar o relatório.'); return; }
        RedeIO.download('relatorio_ajustamento.txt', RedeReport.renderText(this._reportModel()), 'text/plain;charset=utf-8');
    },

    _reportImages() {
        const images = [];
        const g = id => document.getElementById(id);
        const s3 = this.viewer.opts.ellipsoidScale, s2 = this.views.opts.ellipseScale;
        const conf = this.result.confLabel;
        // O 3D só renderiza com tamanho se a aba já foi exibida; garante uma vez
        const shot = this.viewer.snapshot();
        if (shot) images.push(Object.assign(shot, {
            title: 'Vista 3D da rede ajustada',
            caption: `Estações (laranja), fixos (vermelho), livres (verde-azulado) e visadas. ` +
                (g('chkEllipsoids').checked ? `Elipsoides ${conf} exagerados ${Math.round(s3)}×.` : 'Elipsoides ocultos.')
        }));
        const sizes = { xy: [900, 640], xz: [900, 360], yz: [900, 360] };
        Object.entries(this.views.panels).forEach(([key, p]) => {
            const img = p.image(sizes[key][0], sizes[key][1]);
            images.push(Object.assign(img, {
                title: `Vista 2D — ${NetworkViews2D.PANELS[key].title}`,
                caption: `Elipses: projeções dos elipsoides ${conf} (bloco 2×2 marginal de Σ, mesmo k), exageradas ${Math.round(s2)}×.`
            }));
        });
        return images;
    },

    async exportReportPDF() {
        if (!this.result) { alert('Execute o ajustamento antes de gerar o relatório.'); return; }
        const btns = ['btnExportPDF'].map(id => document.getElementById(id));
        btns.forEach(b => { b.disabled = true; b.dataset.label = b.innerHTML; b.innerHTML = 'Gerando PDF...'; });
        try {
            if (this.activeTab !== 'view3d') { this.viewer.resize(); }
            const doc = await RedeReport.renderPDF(this._reportModel(), this._reportImages());
            doc.save('relatorio_ajustamento.pdf');
        } catch (e) {
            console.error(e);
            if (confirm(`Não foi possível gerar o PDF: ${e.message}\n\nBaixar o relatório em texto?`)) this.exportReportText();
        } finally {
            btns.forEach(b => { b.innerHTML = b.dataset.label; b.disabled = !this.result; });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
