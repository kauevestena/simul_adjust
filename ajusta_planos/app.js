// --- Orquestração da interface do simulador de ajustamento de planos ---
const app = {
    settings: Object.assign({}, PlanoIO.DEFAULT_SETTINGS),
    points: [],
    result: null,
    lastDetection: null,
    activeTab: 'view3d',
    activeMatrix: 'A',
    _loadSeq: 0,
    viewer: null,
    surface: null,

    // ---------------------------------------------------------------- inicialização
    init() {
        this.viewer = new PlaneViewer3D('viewer3d');
        this.surface = new PlaneSurface2D.ResidualSurface('surfaceCanvas', 'colorbarCanvas', 'surfaceTooltip');

        const scaleSel = document.getElementById('surfScale');
        Object.entries(PlaneSurface2D.SCALES).forEach(([k, v]) => {
            scaleSel.insertAdjacentHTML('beforeend', `<option value="${k}">${v.label}</option>`);
        });
        scaleSel.value = 'div_blue_red';

        document.getElementById('gaugeSelect').value = this.settings.gauge;
        document.getElementById('pinSelect').value = this.settings.pinParam;
        document.getElementById('pinWrap').style.display =
            this.settings.gauge === 'reduction' ? '' : 'none';
        this._renderGaugeHint();

        this._buildMatrixTabs();
        this.updateSettings(true);
        window.addEventListener('resize', () => {
            if (this.activeTab === 'surface') this.surface.render();
        });

        this.loadSample('parede_frontal.csv');
    },

    // ---------------------------------------------------------------- dados
    async loadSample(file) {
        // Uma carga mais recente (outro botão, CSV, gerador) invalida esta
        const seq = ++this._loadSeq;
        try {
            const resp = await fetch(`samples/${file}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            if (seq !== this._loadSeq) return;
            this._setRows(PlanoIO.parseCSV(text), `amostra ${file}`);
        } catch (e) {
            if (seq !== this._loadSeq) return;
            alert(`Não foi possível ler samples/${file}.\n\n${e.message}\n\n` +
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
            this._setRows(PlanoIO.parseCSV(reader.result), file.name);
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    generateSynthetic() {
        const rows = PlanoIO.generateSynthetic({
            tipo: document.getElementById('synthType').value,
            n: parseInt(document.getElementById('synthN').value) || 40,
            extent: parseFloat(document.getElementById('synthExtent').value) || 2.5,
            roughnessMm: parseFloat(document.getElementById('synthRough').value) || 0
        }, this.settings);
        this._setRows({ rows, errors: [] }, 'observações sintéticas');
    },

    _setRows(parsed, origin) {
        if (parsed.errors.length) {
            alert(`Problemas na leitura (${parsed.errors.length}):\n\n` +
                parsed.errors.slice(0, 10).join('\n') +
                (parsed.errors.length > 10 ? '\n...' : ''));
        }
        if (!parsed.rows.length) { alert('Nenhuma observação válida encontrada.'); return; }

        this._loadSeq++; // descarta qualquer carga assíncrona ainda em voo
        this.points = PlanoIO.buildPoints(parsed.rows, this.settings);
        this.result = null;
        this.lastDetection = null;
        this._origin = origin;
        this._refreshAll();
        this.viewer.fitView();
    },

    _refreshAll() {
        this.renderDataTable();
        this.renderGlobalTest();
        this.renderParams();
        this.renderReliability();
        this.renderMatrixTab();
        this.viewer.setData(this.points, this.result);
        this.surface.setResult(this.result);
        this.updateSurface(true);
        this._updateStatus();
        this._updateButtons();
    },

    _updateStatus() {
        const total = this.points.length;
        const active = this.points.filter(p => p.active).length;
        const flagged = this.points.filter(p => p.flagged).length;
        const el = document.getElementById('dataStatus');
        if (!total) { el.textContent = 'Nenhuma observação carregada.'; return; }
        el.innerHTML = `<strong>${total}</strong> observações (${this._origin || '—'}) · ` +
            `<strong>${active}</strong> ativas` +
            (flagged ? ` · <span class="text-rose-600 font-semibold">${flagged} marcadas</span>` : '');
    },

    _updateButtons() {
        const has = this.points.length >= 4;
        const adjusted = !!this.result;
        const flagged = this.points.some(p => p.flagged);
        document.getElementById('btnAdjust').disabled = !has;
        document.getElementById('btnBlunder').disabled = !this.points.length;
        document.getElementById('btnOutliers').disabled = !adjusted;
        document.getElementById('btnDeactivate').disabled = !flagged;
        document.getElementById('btnNormalize').disabled = !adjusted;
        document.getElementById('btnExportParams').disabled = !adjusted;
        document.getElementById('btnExportReport').disabled = !adjusted;
        document.getElementById('btnCompare').disabled = !has;

        const steps = {
            step1: has ? (adjusted ? 'done' : 'active') : '',
            step2: adjusted ? (this.lastDetection ? 'done' : 'active') : '',
            step3: flagged ? 'active' : (this.lastDetection ? 'done' : ''),
            step4: adjusted ? 'done' : '',
            step5: this.result && this.result.normalized ? 'done' : (adjusted ? 'active' : ''),
            step6: adjusted ? 'active' : ''
        };
        Object.entries(steps).forEach(([id, state]) => {
            const el = document.getElementById(id);
            el.classList.remove('step-done', 'step-active');
            if (state) el.classList.add(`step-${state}`);
        });

        const btnNorm = document.getElementById('btnNormalize');
        btnNorm.innerHTML = (this.result && this.result.normalized)
            ? '\u21BA Desfazer normalização' : '\u221A Normalizar Parâmetros';
    },

    // ---------------------------------------------------------------- ajustamento
    runAdjustment() {
        const active = this.points.filter(p => p.active).length;
        if (active < 4) { alert(`São necessários ao menos 4 pontos ativos (há ${active}).`); return; }
        try {
            this.result = PlaneAdjust.adjustPlane(this.points, this.settings);
        } catch (e) {
            alert(`Falha no ajustamento: ${e.message}`);
            return;
        }
        if (!this.result.converged) {
            alert(`O ajustamento não convergiu em ${this.settings.maxIter} iterações. ` +
                'Verifique as observações ou aumente o limite na aba Configurações.');
        }
        // Os elipsoides saem de cena após o ajustamento; os resíduos entram (specs, item 8)
        document.getElementById('chkEllipsoids').checked = false;
        document.getElementById('chkResiduals').checked = true;
        this.updateViewerOptions();
        this._refreshAll();
    },

    runOutlierDetection() {
        if (!this.result) return;
        const method = document.getElementById('outlierMethod').value;
        let det;
        try {
            det = PlaneAdjust.detectOutliers(this.points, this.result, method, this.settings);
        } catch (e) {
            alert(`Falha na detecção: ${e.message}`);
            return;
        }
        this.lastDetection = det;
        this.points.forEach(p => { p.flagged = false; });
        det.flagged.forEach(i => { if (this.points[i]) this.points[i].flagged = true; });

        this._refreshAll();
        this.switchTab('table');

        const names = det.flagged.map(i => this.points[i].id);
        alert(det.flagged.length
            ? `${det.flagged.length} ponto(s) marcado(s) — ${det.detail}\n\n${names.join(', ')}\n\n` +
            'Desative-os na tabela (ou use "Desativar marcados") e reexecute o ajustamento.'
            : `Nenhum outlier detectado — ${det.detail}.`);
    },

    deactivateFlagged() {
        let n = 0;
        this.points.forEach(p => { if (p.flagged && p.active) { p.active = false; n++; } });
        if (n) { this.result = null; this._refreshAll(); }
    },

    reactivateAll() {
        this.points.forEach(p => { p.active = true; p.flagged = false; });
        this.result = null;
        this.lastDetection = null;
        this._refreshAll();
    },

    toggleNormalization() {
        if (!this.result) return;
        if (this.result.normalized) this.result.normalized = null;
        else {
            try { this.result.normalized = PlaneAdjust.normalizeParameters(this.result); }
            catch (e) { alert(`Falha na normalização: ${e.message}`); return; }
        }
        this.renderParams();
        this.renderMatrixTab();
        this._buildMatrixTabs();
        this.viewer.setData(this.points, this.result);
        this.surface.setResult(this.result);
        this.updateSurface(true);
        this._updateButtons();
    },

    // ---------------------------------------------------------------- erro grosseiro
    openBlunderModal() {
        const list = document.getElementById('blunderList');
        list.innerHTML = '';
        const eligible = this.points.map((p, i) => i).filter(i => !this.points[i].hasBlunder);
        const pre = eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : -1;
        this.points.forEach((p, idx) => {
            list.insertAdjacentHTML('beforeend', `
                <label class="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                    <input type="checkbox" class="blunderCheck accent-rose-500" value="${idx}"
                        ${p.hasBlunder ? 'disabled' : (idx === pre ? 'checked' : '')}>
                    <span class="font-mono">${p.id}</span>
                    <span class="text-stone-400 text-xs">(DI ${p.sd.toFixed(4)} m${p.hasBlunder ? ' — já contém erro' : ''})</span>
                </label>`);
        });
        document.getElementById('blunderModal').style.display = 'flex';
    },

    closeBlunderModal() { document.getElementById('blunderModal').style.display = 'none'; },

    confirmBlunder() {
        const sel = Array.from(document.querySelectorAll('.blunderCheck:checked')).map(c => parseInt(c.value));
        if (!sel.length) { alert('Selecione ao menos uma observação.'); return; }
        const k = parseFloat(document.getElementById('blunderK').value);
        const injected = PlanoIO.injectBlunder(this.points, sel, k, this.settings);
        this.result = null;
        this.lastDetection = null;
        this._refreshAll();
        this.closeBlunderModal();
        alert(`Erros grosseiros injetados (${k}σ na distância inclinada):\n\n` +
            injected.map(i => `${i.id}: ${i.mm >= 0 ? '+' : ''}${i.mm.toFixed(2)} mm`).join('\n') +
            '\n\nExecute o ajustamento para detectá-los.');
    },

    // ---------------------------------------------------------------- abas
    switchTab(tab) {
        this.activeTab = tab;
        ['view3d', 'surface', 'table', 'matrices', 'gauges', 'settings'].forEach(t => {
            document.getElementById(`tab-${t}`).style.display = (t === tab) ? '' : 'none';
            const btn = document.getElementById(`tabBtn-${t}`);
            btn.className = 'tab-btn px-3 py-1.5 text-xs font-semibold rounded-md transition-all' +
                (t === tab ? ' tab-btn-active' : '');
        });
        if (tab === 'view3d') setTimeout(() => this.viewer.resize(), 30);
        if (tab === 'surface') setTimeout(() => this.surface.render(), 30);
    },

    // ---------------------------------------------------------------- tabela
    renderDataTable() {
        const tbody = document.querySelector('#tableData tbody');
        if (!this.points.length) {
            tbody.innerHTML = '<tr><td colspan="15" class="text-center text-stone-400 py-4">Carregue uma amostra ou um CSV.</td></tr>';
            return;
        }
        const byIdx = {};
        if (this.result) this.result.obsData.forEach(o => { byIdx[o.point.idx] = o; });

        tbody.innerHTML = this.points.map((p, i) => {
            const o = byIdx[i];
            const sx = Math.sqrt(p.sigXYZ[0][0]) * 1000;
            const sy = Math.sqrt(p.sigXYZ[1][1]) * 1000;
            const sz = Math.sqrt(p.sigXYZ[2][2]) * 1000;
            const cls = [!p.active ? 'row-inactive' : '', p.flagged ? 'row-outlier' : ''].filter(Boolean).join(' ');

            let badge;
            if (!p.active) badge = '<span class="badge badge-off">INATIVO</span>';
            else if (p.flagged) badge = '<span class="badge badge-out">OUTLIER</span>';
            else if (o) badge = '<span class="badge badge-ok">OK</span>';
            else badge = '<span class="text-stone-400 text-xs">—</span>';

            const num = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '—';
            const inp = (field, val, step) =>
                `<input type="number" class="field" step="${step}" value="${val}" data-i="${i}" data-f="${field}" oninput="app.updateCell(event)">`;

            return `<tr class="${cls}">
                <td><input type="checkbox" class="accent-teal-600" ${p.active ? 'checked' : ''} onchange="app.toggleActive(${i}, this.checked)"></td>
                <td class="font-mono text-xs">${p.id}${p.hasBlunder ? ' <span class="text-rose-500" title="Erro grosseiro injetado">&#9888;</span>' : ''}</td>
                <td><div class="flex gap-1">${inp('gAz', p.gAz, 1)}${inp('mAz', p.mAz, 1)}${inp('sAz', p.sAz, 0.1)}</div></td>
                <td><div class="flex gap-1">${inp('gZen', p.gZen, 1)}${inp('mZen', p.mZen, 1)}${inp('sZen', p.sZen, 0.1)}</div></td>
                <td>${inp('sd', p.sd, 0.001)}</td>
                <td class="font-mono text-xs">${p.xyz[0].toFixed(4)}</td>
                <td class="font-mono text-xs">${p.xyz[1].toFixed(4)}</td>
                <td class="font-mono text-xs">${p.xyz[2].toFixed(4)}</td>
                <td class="font-mono text-xs text-stone-500">${sx.toFixed(2)}, ${sy.toFixed(2)}, ${sz.toFixed(2)}</td>
                <td class="font-mono text-xs ${o && Math.abs(o.d) > 3 * o.sigmaD ? 'text-rose-600 font-bold' : ''}">${o ? num(o.d * 1000, 2) : '—'}</td>
                <td class="font-mono text-xs ${o && o.isOutlier ? 'text-rose-600 font-bold' : ''}">${o ? num(o.w, 2) : '—'}</td>
                <td class="font-mono text-xs">${o ? num(o.r, 3) : '—'}</td>
                <td class="font-mono text-xs">${o && o.mdb != null ? num(o.mdb * 1000, 2) : '—'}</td>
                <td>${badge}</td>
                <td><button onclick="app.removeRow(${i})" class="text-rose-500 hover:text-rose-700 text-sm" title="Remover">&times;</button></td>
            </tr>`;
        }).join('');
    },

    toggleActive(i, checked) {
        this.points[i].active = checked;
        this.result = null;
        this._refreshAll();
    },

    updateCell(event) {
        const i = parseInt(event.target.dataset.i);
        const f = event.target.dataset.f;
        const v = parseFloat(event.target.value);
        if (!Number.isFinite(v)) return;
        const p = this.points[i];
        p[f] = v;
        if (f === 'sd' && !(v > 0)) return;
        p.az = PlanoIO.gmsToRad(p.gAz, p.mAz, p.sAz);
        p.zen = PlanoIO.gmsToRad(p.gZen, p.mZen, p.sZen);
        p.xyz = PlanoIO.obsToXYZ(p.az, p.zen, p.sd);
        p.J = PlanoIO.jacobianGMStoXYZ(p.az, p.zen, p.sd);
        p.sigObs = PlanoIO.sigmaObs(p.sd, this.settings);
        p.sigXYZ = PlanoIO.sigmaXYZ(p.az, p.zen, p.sd, this.settings);
        this.result = null;
        clearTimeout(this._cellTimer);
        this._cellTimer = setTimeout(() => this._refreshAll(), 350);
    },

    addRow() {
        const last = this.points[this.points.length - 1];
        const row = last
            ? { gAz: last.gAz, mAz: last.mAz, sAz: last.sAz, gZen: last.gZen, mZen: last.mZen, sZen: last.sZen, sd: last.sd, id: null }
            : { gAz: 0, mAz: 0, sAz: 0, gZen: 90, mZen: 0, sZen: 0, sd: 5, id: null };
        const rows = this.points.map(p => ({
            gAz: p.gAz, mAz: p.mAz, sAz: p.sAz, gZen: p.gZen, mZen: p.mZen, sZen: p.sZen, sd: p.sd, id: p.id
        })).concat([row]);
        const prev = this.points.slice();
        this.points = PlanoIO.buildPoints(rows, this.settings, prev);
        this.result = null;
        this._refreshAll();
    },

    removeRow(i) {
        const prev = this.points.slice();
        prev.splice(i, 1);
        const rows = prev.map(p => ({
            gAz: p.gAz, mAz: p.mAz, sAz: p.sAz, gZen: p.gZen, mZen: p.mZen, sZen: p.sZen, sd: p.sd, id: p.id
        }));
        this.points = PlanoIO.buildPoints(rows, this.settings, prev);
        this.result = null;
        this._refreshAll();
    },

    // ---------------------------------------------------------------- painéis de resultado
    renderGlobalTest() {
        const panel = document.getElementById('panelGlobalTest');
        const head = '<h2 class="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4 border-b pb-2">Teste Global (&chi;&sup2;)</h2>';
        if (!this.result) {
            panel.innerHTML = head + '<div class="text-center py-4"><p class="text-xs text-stone-400">Aguardando ajustamento...</p></div>';
            return;
        }
        const r = this.result;
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
                <div class="flex justify-between"><span>Pontos ativos (m):</span><span>${r.m}</span></div>
                <div class="flex justify-between"><span>Iterações:</span><span>${r.iterations}</span></div>
            </div>
            ${!pass && r.VtPV > r.chi2upp
                ? '<p class="text-[11px] text-rose-600 mt-3 leading-tight">Resíduos maiores que o previsto: possível erro grosseiro ou superfície menos plana que o modelo. Prossiga para a detecção de outliers.</p>'
                : ''}
            ${!pass && r.VtPV < r.chi2low
                ? '<p class="text-[11px] text-amber-600 mt-3 leading-tight">Resíduos menores que o previsto: a precisão nominal informada está pessimista para estes dados. Ajuste-a na aba Configurações.</p>'
                : ''}`;
    },

    renderParams() {
        const el = document.getElementById('paramsPanel');
        const badge = document.getElementById('normBadge');
        if (!this.result) {
            el.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            badge.textContent = '';
            return;
        }
        const r = this.result;
        const norm = r.normalized;
        const X = norm ? norm.Xn : r.Xa;
        const S = norm ? norm.SigmaXn : r.SigmaXa;
        const names = ['A', 'B', 'C', 'D'];

        badge.innerHTML = `<span class="text-stone-500">${r.gaugeLabel}</span>` + (norm
            ? ` · <span class="text-indigo-600 font-semibold">normalizado · plano ${norm.classification.tipo} · sentido ${norm.classification.isHorizontal ? '+Z' : '+X'}</span>`
            : ' · <span class="text-stone-400">não normalizado</span>');

        const rows = names.map((n, i) => `
            <tr>
                <td class="font-mono font-bold">${n}</td>
                <td class="font-mono">${X[i].toFixed(9)}</td>
                <td class="font-mono">${Math.sqrt(Math.max(S[i][i], 0)).toExponential(3)}</td>
            </tr>`).join('');

        const mvc = S.map((row, i) => `<tr><td class="font-mono text-stone-500">${names[i]}</td>` +
            row.map(v => `<td class="font-mono text-xs">${v.toExponential(3)}</td>`).join('') + '</tr>').join('');

        const ev = PlaneAdjust.linalg.eigSym(S).values;
        const cls = PlaneAdjust.classifyPlane(r.Lb);

        // A direção nula de Σ_Xa depende da estratégia: é a escala nos dois gauges livres,
        // mas é o eixo do parâmetro congelado na redução.
        const nullDir = r.gauge === 'reduction'
            ? `eixo de ${r.pinName} (o parâmetro congelado)`
            : 'direção de escala';
        const gaugeLine = r.gauge === 'reduction'
            ? `${r.gaugeLabel} · fixado <strong>${r.pinName}</strong> ` +
              `(qualidade ${r.pinQuality.toFixed(3)}${r.pinQuality < 0.1 ? ' — baixa!' : ''})`
            : r.gaugeLabel;
        const gaugeWarn = (r.gauge === 'reduction' && r.pinQuality < 0.1)
            ? `<p class="text-amber-600">O parâmetro fixado é quase nulo, então o gauge quase
                 não controla a escala: cond(sistema) = ${r.condSystem.toExponential(1)} e a
                 convergência fica lenta. O plano estimado não muda — só o caminho numérico.</p>`
            : '';

        el.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
                <p class="text-xs text-stone-500 mb-2">Equação: <span class="font-mono text-stone-700">${X[0].toFixed(6)}·x ${X[1] >= 0 ? '+' : '−'} ${Math.abs(X[1]).toFixed(6)}·y ${X[2] >= 0 ? '+' : '−'} ${Math.abs(X[2]).toFixed(6)}·z ${X[3] >= 0 ? '+' : '−'} ${Math.abs(X[3]).toFixed(6)} = 0</span></p>
                <table>
                    <thead><tr><th>Parâmetro</th><th>Valor</th><th data-tooltip="Raiz da diagonal de Σ_Xa (a posteriori)">&sigma;</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="mt-3 text-[11px] text-stone-500 space-y-1 leading-snug">
                    <p>Estratégia: <strong class="text-stone-700">${gaugeLine}</strong>
                       · cond(sistema) = <span class="font-mono">${r.condSystem.toExponential(2)}</span>
                       · ${r.iterations} iteraç${r.iterations === 1 ? 'ão' : 'ões'}</p>
                    <p>&#8214;n&#8214; = <span class="font-mono">${PlaneAdjust.linalg.norm(X.slice(0, 3)).toFixed(12)}</span>
                       · dispersão interna (&sigma;X, &sigma;Y, &sigma;Z) = <span class="font-mono">${cls.spread.map(v => v.toFixed(3)).join(', ')}</span> m
                       → plano <strong>${cls.tipo}</strong></p>
                    <p>Autovalores de &Sigma;: <span class="font-mono">${ev.map(v => v.toExponential(2)).join(' · ')}</span>
                       — o primeiro é nulo por construção, aqui na <strong>${nullDir}</strong>.</p>
                    ${gaugeWarn}
                </div>
            </div>
            <div>
                <p class="text-xs font-semibold text-stone-600 mb-2">MVC dos parâmetros ${norm ? '(normalizados)' : ''}</p>
                <table>
                    <thead><tr><th></th>${names.map(n => `<th>${n}</th>`).join('')}</tr></thead>
                    <tbody>${mvc}</tbody>
                </table>
            </div>
        </div>`;
    },

    renderReliability() {
        const el = document.getElementById('reliabilityPanel');
        if (!this.result) {
            el.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            return;
        }
        const rows = this.result.obsData.map(o => {
            let color = 'text-teal-600', qual = 'Boa';
            if (o.r < 0.3) { color = 'text-amber-500'; qual = 'Média'; }
            if (o.r < 0.1) { color = 'text-rose-600 font-bold'; qual = 'Crítica (sem controle)'; }
            return `<tr class="${o.point.flagged ? 'row-outlier' : ''}">
                <td class="font-mono text-xs">${o.point.id}${o.point.hasBlunder ? ' <span class="text-rose-500">&#9888;</span>' : ''}</td>
                <td class="font-mono text-xs ${color}">${o.r.toFixed(3)}</td>
                <td class="font-mono text-xs">${o.mdb != null ? (o.mdb * 1000).toFixed(2) : '—'}</td>
                <td class="font-mono text-xs">${(o.sigmaD * 1000).toFixed(3)}</td>
                <td class="font-mono text-xs ${Math.abs(o.w) > this.result.critW ? 'text-rose-600 font-bold' : ''}">${o.w.toFixed(2)}</td>
                <td class="text-xs uppercase font-semibold ${color}">${qual}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div class="table-container" style="max-height:280px;overflow-y:auto">
                <table>
                    <thead><tr>
                        <th>Ponto</th>
                        <th data-tooltip="Número de redundância local">r</th>
                        <th data-tooltip="Erro mínimo detectável na direção normal">&nabla;<sub>0</sub> (mm)</th>
                        <th data-tooltip="Desvio padrão a priori da distância ao plano">&sigma;<sub>d</sub> (mm)</th>
                        <th data-tooltip="Resíduo padronizado de Baarda">w</th>
                        <th>Qualidade</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="text-[11px] text-stone-500 mt-2">Valor crítico |w| &gt; <span class="font-mono">${this.result.critW.toFixed(3)}</span>
               (&alpha;<sub>0</sub> = ${this.settings.alpha0Pct}%) · &Sigma;r = <span class="font-mono">${this.result.obsData.reduce((s, o) => s + o.r, 0).toFixed(3)}</span>
               = graus de liberdade (${this.result.dof}).</p>`;
    },

    // ---------------------------------------------------------------- visualizadores
    updateViewerOptions() {
        const g = id => document.getElementById(id);
        g('ellipsoidScaleVal').textContent = g('ellipsoidScale').value + '×';
        g('residualScaleVal').textContent = g('residualScale').value + '×';
        this.viewer.setOptions({
            showEllipsoids: g('chkEllipsoids').checked,
            showPlane: g('chkPlane').checked,
            showResiduals: g('chkResiduals').checked,
            showAxes: g('chkAxes').checked,
            ellipsoidScale: parseFloat(g('ellipsoidScale').value),
            residualScale: parseFloat(g('residualScale').value),
            colorPoint: g('colPoint').value,
            colorOutlier: g('colOutlier').value,
            colorEllipsoid: g('colEllipsoid').value,
            colorPlane: g('colPlane').value
        });
    },

    onSurfaceModeChange() {
        // Valores assinados pedem escala divergente; absolutos, sequencial
        const mode = document.getElementById('surfMode').value;
        const sel = document.getElementById('surfScale');
        const wanted = PlaneSurface2D.SCALES[sel.value];
        if (mode === 'signed' && wanted.type !== 'diverging') sel.value = 'div_blue_red';
        if (mode === 'abs' && wanted.type !== 'sequential') sel.value = 'seq_blue';
        this.updateSurface(true);
    },

    updateSurface(recompute) {
        const g = id => document.getElementById(id);
        const method = g('surfMethod').value;
        g('surfIdwOpts').style.display = method === 'idw' ? '' : 'none';
        g('surfKrigOpts').style.display = method === 'kriging' ? '' : 'none';

        const auto = g('surfAutoRange').checked;
        g('surfMin').disabled = auto;
        g('surfMax').disabled = auto;

        this.surface.setOptions({
            method,
            mode: g('surfMode').value,
            scale: g('surfScale').value,
            render: g('surfRender').value,
            resolution: parseInt(g('surfResolution').value) || 160,
            contourLevels: parseInt(g('surfLevels').value) || 10,
            idwPower: parseFloat(g('idwPower').value) || 2,
            idwK: parseInt(g('idwK').value) || 0,
            variogram: g('varioModel').value,
            variogramAuto: g('varioAuto').checked,
            nugget: parseFloat(g('varioNugget').value) || 0,
            sill: parseFloat(g('varioSill').value) || 0,
            range: parseFloat(g('varioRange').value) || 0,
            clipHull: g('surfClip').checked,
            showPoints: g('surfPoints').checked,
            autoRange: auto,
            rangeMin: auto ? null : parseFloat(g('surfMin').value),
            rangeMax: auto ? null : parseFloat(g('surfMax').value)
        });

        if (!this.result) {
            this.surface.grid = null;
            this.surface.render();
            g('surfaceInfo').textContent = '';
            return;
        }
        if (recompute !== false || !this.surface.grid) this.surface.compute();
        this.surface.render();

        const st = this.surface.stats;
        if (st) {
            if (g('surfAutoRange').checked) {
                g('surfMin').value = st.lo.toFixed(2);
                g('surfMax').value = st.hi.toFixed(2);
            }
            let txt = `Resíduos ortogonais: mín ${st.min.toFixed(2)} mm · máx ${st.max.toFixed(2)} mm · RMS ${st.rms.toFixed(2)} mm · ` +
                `${this.surface.samples.length} pontos · ${PlaneSurface2D.METHODS[this.surface.opts.method]}.`;
            if (st.variogram) {
                txt += ` Variograma ${PlaneSurface2D.VARIOGRAMS[this.surface.opts.variogram].toLowerCase()}: ` +
                    `pepita ${st.variogram.nugget.toFixed(2)}, patamar parcial ${st.variogram.psill.toFixed(2)}, alcance ${st.variogram.range.toFixed(3)} m.`;
                if (this.surface.opts.variogramAuto) {
                    g('varioNugget').value = st.variogram.nugget.toFixed(3);
                    g('varioSill').value = (st.variogram.nugget + st.variogram.psill).toFixed(3);
                    g('varioRange').value = st.variogram.range.toFixed(3);
                }
            }
            g('surfaceInfo').textContent = txt;
        }
    },

    // ---------------------------------------------------------------- matrizes
    MATRICES: [
        { key: 'J', label: 'J<sub>GMS→XYZ</sub>', tex: 'J_{GMS \\to XYZ}', perPoint: true, desc: '<strong>Jacobiana da transformação (J):</strong> derivadas parciais de (X, Y, Z) em relação ao azimute, ao ângulo zenital e à distância inclinada, avaliadas no ponto selecionado. É ela que propaga a MVC das observações brutas para as coordenadas: &Sigma;<sub>XYZ</sub> = J &Sigma;<sub>obs</sub> J<sup>T</sup>.' },
        { key: 'SigmaObs', label: '&Sigma;<sub>obs</sub>', tex: '\\Sigma_{obs}', desc: '<strong>MVC das observações brutas (&Sigma;<sub>obs</sub>):</strong> diagonal, com as variâncias do azimute, do ângulo zenital e da distância inclinada de cada ponto, obtidas da precisão nominal informada na aba Configurações.' },
        { key: 'SigmaXYZ', label: '&Sigma;<sub>XYZ</sub>', tex: '\\Sigma_{XYZ}', desc: '<strong>MVC das coordenadas (&Sigma;<sub>XYZ</sub>):</strong> bloco-diagonal, com um bloco 3×3 cheio por ponto. As correlações entre X, Y e Z aparecem porque as três coordenadas vêm das mesmas três observações — é o inverso da matriz dos pesos.' },
        { key: 'P', label: 'P', tex: 'P', desc: '<strong>Matriz dos pesos (P):</strong> inversa de &Sigma;<sub>XYZ</sub>. Observações mais precisas pesam mais na solução. Aqui ela não é diagonal: cada ponto contribui com um bloco 3×3.' },
        { key: 'A', label: 'A', tex: 'A', desc: '<strong>Jacobiana dos parâmetros (A):</strong> derivadas da equação de condição em relação a (A, B, C, D). Cada linha é [x, y, z, 1] do ponto, avaliada nas observações ajustadas.' },
        { key: 'B', label: 'B', tex: 'B', desc: '<strong>Jacobiana das observações (B):</strong> derivadas da equação de condição em relação a (x, y, z) de cada ponto — cada linha carrega o vetor normal (A, B, C) nas três colunas do seu ponto.' },
        { key: 'M', label: 'M', tex: 'M', desc: '<strong>Matriz M = B P<sup>-1</sup> B<sup>T</sup>:</strong> variância de cada equação de condição, ou seja, a variância da distância do ponto ao plano na direção da normal. Sai diagonal porque cada condição envolve um único ponto.' },
        { key: 'W', label: 'W', tex: 'W', desc: '<strong>Vetor de erro de fechamento (W):</strong> valor da equação de condição avaliada nos parâmetros aproximados e nas observações. Mede o quanto o plano atual ainda não passa pelos pontos.' },
        { key: 'N', label: 'N', tex: 'N', desc: '<strong>Equações normais (N = A<sup>T</sup> M<sup>-1</sup> A):</strong> matriz 4×4 do sistema. É <em>singular</em> — seu menor autovalor corresponde à liberdade de escala do plano, e é justamente ela que a estratégia escolhida no passo 1 remove. Nenhum dos três gauges inverte N diretamente.' },
        { key: 'eigN', label: 'λ(N)', tex: '\\lambda(N)', desc: '<strong>Autovalores de N:</strong> o menor é o que denuncia a liberdade de escala. Repare na distância até o segundo — é ela que mede o quanto o sistema é degenerado. A razão λ<sub>min</sub>/λ<sub>max</sub> encolhe de ~10<sup>-7</sup> na primeira iteração para ~10<sup>-17</sup> na convergência, o que é exatamente o motivo pelo qual a pseudo-inversa aqui não pode detectar o posto por limiar.' },
        { key: 'Cc', label: 'C', tex: 'C', gauges: ['constraint'], desc: '<strong>Gradiente da injunção (C = [2A, 2B, 2C, 0]):</strong> a direção, no espaço dos parâmetros, ao longo da qual a condição A²+B²+C²=1 atua. É ela que orla as equações normais.' },
        { key: 'KKT', label: 'KKT', tex: 'KKT', gauges: ['constraint'], desc: '<strong>Sistema aumentado (KKT):</strong> N orlada pelo gradiente da injunção C. É este sistema 5×5 — não N sozinha — que é invertido a cada iteração, e é o que torna a solução única. A última incógnita é o multiplicador de Lagrange λ.' },
        { key: 'KKTinv', label: 'KKT⁻¹', tex: 'KKT^{-1}', gauges: ['constraint'], desc: '<strong>Inversa do sistema aumentado:</strong> seu bloco 4×4 superior esquerdo é a inversa generalizada Q que fornece &Sigma;<sub>Xa</sub> = &sigma;&#x302;²<sub>0</sub>&middot;Q e o cofator dos correlatos.' },
        { key: 'Ared', label: 'A<sub>r</sub>', tex: 'A_r', gauges: ['reduction'], desc: '<strong>Jacobiana reduzida (A<sub>r</sub>):</strong> a matriz A sem a coluna do parâmetro congelado. Com um parâmetro a menos, o posto deixa de ser deficiente.' },
        { key: 'Nred', label: 'N<sub>r</sub>', tex: 'N_r', gauges: ['reduction'], desc: '<strong>Equações normais reduzidas (N<sub>r</sub> = A<sub>r</sub><sup>T</sup> M<sup>-1</sup> A<sub>r</sub>):</strong> 3×3 e <em>não-singular</em> — este sim é invertido diretamente. Compare seu número de condição com o de N: é a vantagem numérica da redução.' },
        { key: 'NredInv', label: 'N<sub>r</sub>⁻¹', tex: 'N_r^{-1}', gauges: ['reduction'], desc: '<strong>Inversa das equações normais reduzidas:</strong> espalhada de volta para 4×4 com linha e coluna nulas na posição do parâmetro fixado, vira a inversa generalizada Q. É por isso que, nesta estratégia, a direção nula de &Sigma;<sub>Xa</sub> é o eixo do parâmetro congelado — e não a direção de escala.' },
        { key: 'Xred', label: 'X<sub>r</sub>', tex: 'X_r', gauges: ['reduction'], desc: '<strong>Correções reduzidas:</strong> as três correções efetivamente estimadas. A quarta, a do parâmetro fixado, é identicamente zero por construção.' },
        { key: 'E', label: 'E', tex: 'E', gauges: ['pseudoinverse'], desc: '<strong>Espaço nulo (E = X<sub>0</sub>):</strong> a direção de escala, conhecida <em>analiticamente</em> — não estimada. A injunção mínima E<sup>T</sup>X = 0 impede que a correção caminhe ao longo dela, que é por onde a solução escaparia para o vetor nulo.' },
        { key: 'Unull', label: 'U', tex: 'U', gauges: ['pseudoinverse'], desc: '<strong>Base do complemento ortogonal (U, 4×3):</strong> base ortonormal de E<sup>⊥</sup>, obtida por refletor de Householder. As correções vivem no espaço gerado por suas colunas.' },
        { key: 'UNU', label: 'UᵀNU', tex: 'U^T N U', gauges: ['pseudoinverse'], desc: '<strong>Sistema projetado (U<sup>T</sup>NU):</strong> as equações normais restritas ao subespaço livre. 3×3 e não-singular — é ele que de fato se resolve.' },
        { key: 'Npinv', label: 'N⁺', tex: 'N^{+}', gauges: ['pseudoinverse'], desc: '<strong>Pseudo-inversa (N⁺ = U(U<sup>T</sup>NU)<sup>-1</sup>U<sup>T</sup>):</strong> a inversa generalizada de posto 3 de N, com espaço nulo exatamente na direção de escala. É a Q desta estratégia.' },
        { key: 'X', label: 'X (dx)', tex: 'X', desc: '<strong>Vetor das correções (X):</strong> correção aplicada aos parâmetros aproximados na última iteração. Na convergência, todos os seus elementos estão abaixo da tolerância.' },
        { key: 'K', label: 'K', tex: 'K', desc: '<strong>Vetor dos correlatos (K):</strong> multiplicadores de Lagrange das equações de condição. É a partir deles que os resíduos são obtidos: V = P<sup>-1</sup> B<sup>T</sup> K.' },
        { key: 'V', label: 'V', tex: 'V', desc: '<strong>Resíduos (V):</strong> correção de cada coordenada observada, em metros (uma linha por ponto, colunas X, Y e Z). As observações ajustadas são L<sub>a</sub> = L<sub>b</sub> + V, e satisfazem exatamente a equação do plano.' },
        { key: 'Lb', label: 'L<sub>b</sub>', tex: 'L_b', desc: '<strong>Observações (L<sub>b</sub>):</strong> coordenadas X, Y e Z calculadas diretamente das observações brutas de campo.' },
        { key: 'La', label: 'L<sub>a</sub>', tex: 'L_a', desc: '<strong>Observações ajustadas (L<sub>a</sub>):</strong> coordenadas corrigidas pelos resíduos; todos estes pontos caem exatamente sobre o plano estimado.' },
        { key: 'SigmaXa', label: '&Sigma;<sub>Xa</sub>', tex: '\\Sigma_{X_a}', desc: '<strong>MVC dos parâmetros ajustados (&Sigma;<sub>Xa</sub>):</strong> &sigma;&#x302;²<sub>0</sub> vezes o bloco 4×4 da inversa do sistema KKT. Tem <em>posto 3</em>: o autovalor nulo é a direção de escala, que a injunção fixou e sobre a qual, portanto, não há incerteza a estimar.' },
        { key: 'SigmaLa', label: '&Sigma;<sub>La</sub>', tex: '\\Sigma_{L_a}', desc: '<strong>MVC das observações ajustadas (&Sigma;<sub>La</sub>):</strong> incerteza das coordenadas depois do ajustamento. É sempre menor que &Sigma;<sub>XYZ</sub> na direção normal ao plano, que é onde o ajustamento traz informação.' },
        { key: 'SigmaV', label: '&Sigma;<sub>V</sub>', tex: '\\Sigma_{V}', desc: '<strong>MVC dos resíduos (&Sigma;<sub>V</sub>):</strong> satisfaz &Sigma;<sub>V</sub> + &Sigma;<sub>La</sub> = &sigma;&#x302;²<sub>0</sub> P<sup>-1</sup>. É a base do teste de Baarda: um resíduo só é grande se for grande em relação ao seu próprio desvio padrão.' },
        { key: 'SigmaW', label: '&Sigma;<sub>W</sub>', tex: '\\Sigma_{W}', desc: '<strong>MVC dos erros de fechamento (&Sigma;<sub>W</sub>):</strong> &sigma;&#x302;²<sub>0</sub> M.' },
        { key: 'Jnorm', label: 'J<sub>norm</sub>', tex: 'J_{norm}', onlyNormalized: true, desc: '<strong>Jacobiana da normalização (J<sub>norm</sub>):</strong> derivadas de X&#x302; = &plusmn;X/&#8214;n&#8214; em relação a X. É ela que propaga a MVC para os parâmetros normalizados.' },
        { key: 'SigmaXn', label: '&Sigma;<sub>X&#x302;</sub>', tex: '\\Sigma_{\\hat{X}}', onlyNormalized: true, desc: '<strong>MVC dos parâmetros normalizados (&Sigma;<sub>X&#x302;</sub>) = J<sub>norm</sub> &Sigma;<sub>Xa</sub> J<sub>norm</sub><sup>T</sup>:</strong> é esta a matriz a usar em análises posteriores quando os parâmetros forem reportados normalizados.' }
    ],

    _buildMatrixTabs() {
        const wrap = document.getElementById('matrixTabs');
        const normalized = !!(this.result && this.result.normalized);
        const gauge = this.result ? this.result.gauge : this.settings.gauge;
        const visible = this.MATRICES
            .filter(m => !m.onlyNormalized || normalized)
            .filter(m => !m.gauges || m.gauges.includes(gauge));
        // Ao trocar de gauge a matriz ativa pode não existir mais
        if (!visible.some(m => m.key === this.activeMatrix)) this.activeMatrix = 'A';
        wrap.innerHTML = visible
            .map(m => {
                const active = m.key === this.activeMatrix;

                return `<button onclick="app.switchMatrixTab('${m.key}')" id="matTab-${m.key}"
                    class="mat-tab-btn px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${active ? 'mat-tab-active' : 'text-stone-600 hover:bg-stone-200'}">${m.label}</button>`;
            }).join('');
    },

    switchMatrixTab(key) {
        this.activeMatrix = key;
        this._buildMatrixTabs();
        this.renderMatrixTab();
    },

    _matrixDef(key) { return this.MATRICES.find(m => m.key === key); },

    // Monta a matriz pedida; as de dimensão 3m são calculadas sob demanda
    getMatrix(key) {
        const r = this.result;
        if (!r) return null;
        const def = this._matrixDef(key);

        if (key === 'J') {
            const sel = document.getElementById('matPointSelect');
            const i = Math.max(0, Math.min(r.activePoints.length - 1, parseInt(sel.value) || 0));
            return r.activePoints[i].J;
        }
        if (key === 'SigmaObs') {
            const L = PlaneAdjust.linalg;
            const m = r.m;
            const S = L.zeros(3 * m, 3 * m);
            r.activePoints.forEach((p, i) => {
                for (let a = 0; a < 3; a++) S[3 * i + a][3 * i + a] = p.sigObs[a][a];
            });
            return S;
        }
        if (['B', 'P', 'SigmaXYZ', 'M', 'SigmaLa', 'SigmaV', 'SigmaW'].includes(key)) {
            if (!this._full || this._fullFor !== r) {
                this._full = PlaneAdjust.fullMatrices(r);
                this._fullFor = r;
            }
            if (key === 'SigmaXYZ') return this._full.SigLb;
            return this._full[key];
        }
        if (key === 'A') return r.Amat;
        if (key === 'N') return r.N;
        if (key === 'eigN') return r.eigN.map(v => [v]);

        const art = r.gaugeArtifacts || {};
        if (key === 'Cc') return art.Cc;
        if (key === 'KKT') return art.KKT;
        if (key === 'KKTinv') return art.KKTinv;
        if (key === 'Ared') return art.keep ? r.Amat.map(row => art.keep.map(j => row[j])) : null;
        if (key === 'Nred') return art.Nred;
        if (key === 'NredInv') return art.NredInv;
        if (key === 'Xred') return art.Xred;
        if (key === 'E') return art.E;
        if (key === 'Unull') return art.nullBasis;
        if (key === 'UNU') return art.UNU;
        if (key === 'Npinv') return r.gauge === 'pseudoinverse' ? r.Q : null;
        if (key === 'W') return r.W.map(v => [v]);
        if (key === 'X') return r.X.map(v => [v]);
        if (key === 'K') return r.K.map(v => [v]);
        if (key === 'V') return r.V;
        if (key === 'Lb') return r.Lb;
        if (key === 'La') return r.La;
        if (key === 'SigmaXa') return r.SigmaXa;
        if (key === 'Jnorm') return r.normalized ? r.normalized.J : null;
        if (key === 'SigmaXn') return r.normalized ? r.normalized.SigmaXn : null;
        return null;
    },

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
        const def = this._matrixDef(this.activeMatrix);
        const wrap = document.getElementById('matPointSelectWrap');

        wrap.style.display = (def && def.perPoint && this.result) ? '' : 'none';
        if (def && def.perPoint && this.result) {
            const sel = document.getElementById('matPointSelect');
            if (sel.options.length !== this.result.activePoints.length) {
                sel.innerHTML = this.result.activePoints
                    .map((p, i) => `<option value="${i}">${p.id}</option>`).join('');
            }
        }

        if (!this.result) {
            container.innerHTML = '<p class="text-xs text-stone-400">Aguardando ajustamento...</p>';
            desc.innerHTML = '';
            return;
        }

        const mat = this.getMatrix(this.activeMatrix);
        desc.innerHTML = def ? def.desc : '';
        if (!mat) {
            container.innerHTML = '<p class="text-xs text-stone-400">Matriz indisponível.</p>';
            return;
        }

        const latex = this.formatMatrixToLatex(def.tex, mat);
        const dims = `${mat.length} × ${mat[0].length}`;
        container.innerHTML = '';
        if (window.katex) {
            try {
                katex.render(latex, container, { displayMode: true, throwOnError: false });
            } catch (e) {
                container.innerHTML = '<p class="text-xs text-rose-500">Erro ao renderizar a matriz.</p>';
            }
        } else {
            container.innerHTML = '<p class="text-xs text-rose-500">KaTeX não carregado.</p>';
        }
        desc.innerHTML = `<span class="text-stone-400 font-mono text-[10px]">dimensão ${dims}</span><br>${def.desc}`;
    },

    // ---------------------------------------------------------------- comparação de gauges
    runGaugeComparison() {
        const el = document.getElementById('gaugeCompareContent');
        if (this.points.filter(p => p.active).length < 4) {
            alert('São necessários ao menos 4 pontos ativos.');
            return;
        }
        el.innerHTML = '<p class="text-xs text-stone-400">Calculando...</p>';

        let cmp;
        try {
            cmp = PlaneAdjust.compareGauges(this.points, this.settings);
        } catch (e) {
            el.innerHTML = `<p class="text-xs text-rose-600">Falha na comparação: ${e.message}</p>`;
            return;
        }

        const names = ['A', 'B', 'C', 'D'];
        const cols = cmp.runs;
        const head = `<tr><th></th>${cols.map(c =>
            `<th>${c.label}${c.res.pinName ? ` <span class="font-normal normal-case text-stone-400">(${c.res.pinName} fixo)</span>` : ''}</th>`
        ).join('')}</tr>`;

        const row = (label, fn, cls = '') =>
            `<tr><td class="text-stone-500 text-xs">${label}</td>${cols.map(c =>
                `<td class="font-mono text-xs ${cls}">${fn(c)}</td>`).join('')}</tr>`;

        const paramRows = names.map((n, i) => row(
            `${n} <span class="text-stone-400">(bruto)</span>`,
            c => c.res.Xa[i].toExponential(9))).join('');

        const sigmaRows = names.map((n, i) => row(
            `&sigma;<sub>${n}</sub> <span class="text-stone-400">(bruto)</span>`,
            c => Math.sqrt(Math.max(c.res.SigmaXa[i][i], 0)).toExponential(3))).join('');

        const normRows = names.map((n, i) => row(
            `${n}&#x302; <span class="text-stone-400">(normalizado)</span>`,
            c => c.norm.Xn[i].toExponential(9), 'text-teal-700')).join('');

        const normSigmaRows = names.map((n, i) => row(
            `&sigma;<sub>${n}&#x302;</sub> <span class="text-stone-400">(normalizado)</span>`,
            c => Math.sqrt(Math.max(c.norm.SigmaXn[i][i], 0)).toExponential(3), 'text-teal-700')).join('');

        const base = cols[0];
        const inv = (label, fn) =>
            `<tr><td class="text-stone-500 text-xs">${label}</td>${cols.map(c =>
                `<td class="font-mono text-xs">${fn(c)}</td>`).join('')}</tr>`;

        el.innerHTML = `
        <div class="table-container mb-4">
            <table>
                <thead>${head}</thead>
                <tbody>
                    ${row('iterações', c => c.res.iterations)}
                    ${row('convergiu', c => c.res.converged ? '✓' : '✗ NÃO')}
                    ${row('cond(sistema resolvido)', c => c.res.condSystem.toExponential(2))}
                    ${row('&#8214;n&#8214;', c => c.res.normaN.toFixed(12))}
                    ${row('direção nula de &Sigma;<sub>Xa</sub>', c => c.nullDirection)}
                    ${row('posto de &Sigma;<sub>Xa</sub>', () => '3')}
                    <tr><td colspan="${cols.length + 1}" class="bg-stone-50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Parâmetros como saem do ajustamento — dependem do gauge</td></tr>
                    ${paramRows}
                    ${sigmaRows}
                    <tr><td colspan="${cols.length + 1}" class="bg-teal-50 text-[10px] font-bold text-teal-700 uppercase tracking-wider">Depois de normalizar — iguais nos três</td></tr>
                    ${normRows}
                    ${normSigmaRows}
                </tbody>
            </table>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="p-3 bg-teal-50 border border-teal-200 rounded">
                <h3 class="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Invariantes</h3>
                <table>
                    <tbody>
                        ${inv('V<sup>T</sup>PV', c => c.res.VtPV.toFixed(9))}
                        ${inv('&sigma;&#x302;²<sub>0</sub>', c => c.res.sigma02.toFixed(9))}
                        ${inv('graus de liberdade', c => c.res.dof)}
                        ${inv('&Sigma;r<sub>i</sub>', c => c.res.obsData.reduce((a, o) => a + o.r, 0).toFixed(6))}
                    </tbody>
                </table>
            </div>
            <div class="p-3 bg-stone-50 border border-stone-200 rounded">
                <h3 class="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Divergência contra ${base.label}</h3>
                <table>
                    <tbody>
                        ${inv('max|&Delta;X&#x302;|', c => c === base ? '—' : c.dXn.toExponential(2))}
                        ${inv('max|&Delta;&Sigma;<sub>X&#x302;</sub>| relativo', c => c === base ? '—' : c.dSigmaXn.toExponential(2))}
                        ${inv('max|&Delta;r|', c => c === base ? '—' : c.dR.toExponential(2))}
                        ${inv('&Delta;V<sup>T</sup>PV relativo', c => c === base ? '—' : c.dVtPV.toExponential(2))}
                    </tbody>
                </table>
            </div>
        </div>

        <p class="text-[11px] text-stone-500 mt-3 leading-snug">
            As divergências estão na ordem da precisão de máquina (~10<sup>-15</sup>): as três
            estratégias estimam <strong>o mesmo plano</strong>, com os mesmos resíduos e a mesma
            MVC depois de normalizada. O gauge é convenção de representação — ele muda o tamanho
            e o condicionamento do sistema resolvido, a escala em que os parâmetros saem e qual
            direção fica sem incerteza, mas não muda a geometria estimada nem o controle de
            qualidade.
        </p>`;
    },

    // ---------------------------------------------------------------- configurações
    onGaugeChange() {
        this.settings.gauge = document.getElementById('gaugeSelect').value;
        this.settings.pinParam = document.getElementById('pinSelect').value;
        document.getElementById('pinWrap').style.display =
            this.settings.gauge === 'reduction' ? '' : 'none';
        this._renderGaugeHint();
        // Trocar de gauge invalida o ajustamento, como qualquer mudança de modelo
        this.result = null;
        this.lastDetection = null;
        this._refreshAll();
    },

    _renderGaugeHint() {
        const hints = {
            reduction: 'Congela um parâmetro: sistema 3×3 não-singular, o mais bem condicionado.',
            constraint: 'Equação de condição extra, resolvida por sistema aumentado 5×5. Sai com ‖n‖ = 1 exato.',
            pseudoinverse: 'Mantém os 4 livres com injunção mínima EᵀX = 0, E = X₀ (direção de escala).'
        };
        document.getElementById('gaugeHint').textContent = hints[this.settings.gauge] || '';
    },

    updateSettings(silent) {
        const g = id => parseFloat(document.getElementById(id).value);
        const s = this.settings;
        s.gauge = document.getElementById('gaugeSelect').value;
        s.pinParam = document.getElementById('pinSelect').value;
        s.sigAngSec = g('setSigAng');
        s.edmMm = g('setEdmMm');
        s.edmPpm = g('setEdmPpm');
        s.alphaPct = g('setAlpha');
        s.alpha0Pct = g('setAlpha0');
        s.sigmaRuleK = g('setSigmaK');
        s.nonCentrality = g('setDelta0');
        s.ransacIters = Math.round(g('setRansacIters'));
        s.ransacThreshMm = g('setRansacThresh');
        s.maxIter = Math.round(g('setMaxIter'));
        s.tol = g('setTol');

        if (silent === true) return;
        if (this.points.length) {
            PlanoIO.refreshStochastic(this.points, s);
            this.result = null;
            this._refreshAll();
        }
    },

    resetSettings() {
        const d = PlanoIO.DEFAULT_SETTINGS;
        const set = (id, v) => { document.getElementById(id).value = v; };
        set('setSigAng', d.sigAngSec); set('setEdmMm', d.edmMm); set('setEdmPpm', d.edmPpm);
        set('setAlpha', d.alphaPct); set('setAlpha0', d.alpha0Pct); set('setSigmaK', d.sigmaRuleK);
        set('setDelta0', d.nonCentrality); set('setRansacIters', d.ransacIters);
        set('setRansacThresh', d.ransacThreshMm); set('setMaxIter', d.maxIter); set('setTol', d.tol);
        this.updateSettings();
    },

    // ---------------------------------------------------------------- exportação
    exportObservations() {
        if (!this.points.length) return;
        PlanoIO.download('observacoes.csv', PlanoIO.rowsToCSV(this.points));
    },

    exportSurfaceGrid() {
        const csv = this.surface.exportCSV();
        if (!csv) { alert('Execute o ajustamento antes de exportar a grade.'); return; }
        PlanoIO.download(`residuos_grade_${this.surface.opts.method}.csv`, csv);
    },

    exportActiveMatrix() {
        const mat = this.getMatrix(this.activeMatrix);
        if (!mat) { alert('Matriz indisponível.'); return; }
        PlanoIO.download(`matriz_${this.activeMatrix}.csv`, PlanoIO.matrixToCSV(mat));
    },

    exportAllMatrices() {
        if (!this.result) return;
        const normalized = !!this.result.normalized;
        const keys = this.MATRICES.filter(m => !m.onlyNormalized || normalized).map(m => m.key);
        keys.forEach((k, i) => {
            const mat = this.getMatrix(k);
            if (!mat) return;
            // Downloads em sequência: alguns navegadores descartam disparos simultâneos
            setTimeout(() => PlanoIO.download(`matriz_${k}.csv`, PlanoIO.matrixToCSV(mat)), i * 250);
        });
    },

    exportParameters() {
        const r = this.result;
        if (!r) return;
        const norm = r.normalized;
        const X = norm ? norm.Xn : r.Xa;
        const S = norm ? norm.SigmaXn : r.SigmaXa;
        const names = ['A', 'B', 'C', 'D'];
        const out = [];
        out.push(`# Parâmetros do plano ${norm ? '(normalizados)' : '(não normalizados)'}`);
        out.push(`# Gauge: ${r.gaugeLabel}${r.pinName ? ` (parâmetro fixado: ${r.pinName})` : ''}`);
        out.push('parametro,valor,desvio_padrao');
        names.forEach((n, i) => out.push(`${n},${PlanoIO.fmt(X[i])},${PlanoIO.fmt(Math.sqrt(Math.max(S[i][i], 0)))}`));
        out.push('');
        out.push('# MVC dos parametros (ordem A,B,C,D)');
        out.push(PlanoIO.matrixToCSV(S).trimEnd());
        PlanoIO.download('parametros_plano.csv', out.join('\n') + '\n');
    },

    exportReport() {
        const r = this.result;
        if (!r) return;
        const norm = r.normalized;
        const X = norm ? norm.Xn : r.Xa;
        const L = [];
        L.push('RELATÓRIO DE AJUSTAMENTO DE PLANO — MÉTODO COMBINADO');
        L.push('='.repeat(62));
        L.push(`Data: ${new Date().toLocaleString('pt-BR')}`);
        L.push(`Origem dos dados: ${this._origin || '—'}`);
        L.push('');
        L.push('MODELO ESTOCÁSTICO (1σ nominal)');
        L.push(`  σ angular (azimute e zenital) : ${this.settings.sigAngSec} "`);
        L.push(`  MED                           : ${this.settings.edmMm} mm + ${this.settings.edmPpm} ppm`);
        L.push('');
        L.push('AJUSTAMENTO');
        L.push(`  Estratégia de gauge      : ${r.gaugeLabel}` +
            (r.pinName ? `  (parâmetro fixado: ${r.pinName}, qualidade ${r.pinQuality.toFixed(4)})` : ''));
        L.push(`  cond(sistema resolvido)  : ${r.condSystem.toExponential(3)}`);
        L.push(`  Pontos ativos (m)        : ${r.m} de ${this.points.length}`);
        L.push(`  Graus de liberdade       : ${r.dof}   (m - 4 incógnitas + 1 injunção)`);
        L.push(`  Iterações                : ${r.iterations}${r.converged ? ' (convergiu)' : ' (NÃO convergiu)'}`);
        L.push(`  V^T P V                  : ${r.VtPV.toFixed(6)}`);
        L.push(`  Variância a posteriori   : ${r.sigma02.toFixed(6)}`);
        L.push(`  Teste global (α = ${this.settings.alphaPct}%)  : ${r.globalPass ? 'APROVADO' : 'REPROVADO'}  [${r.chi2low.toFixed(3)} ; ${r.chi2upp.toFixed(3)}]`);
        L.push('');
        L.push(`PARÂMETROS DO PLANO ${norm ? '(NORMALIZADOS)' : '(NÃO NORMALIZADOS)'}`);
        ['A', 'B', 'C', 'D'].forEach((n, i) => {
            const S = norm ? norm.SigmaXn : r.SigmaXa;
            L.push(`  ${n} = ${X[i].toFixed(12)}   σ = ${Math.sqrt(Math.max(S[i][i], 0)).toExponential(4)}`);
        });
        if (norm) {
            L.push(`  Classificação: plano ${norm.classification.tipo}; sentido referido a ${norm.classification.isHorizontal ? '+Z' : '+X'}`);
            L.push(`  Escala removida: ${norm.scale.toFixed(12)}   sinal: ${norm.sign > 0 ? '+' : '-'}`);
        }
        L.push('');
        if (this.lastDetection) {
            L.push(`DETECÇÃO DE OUTLIERS (${this.lastDetection.method}) — ${this.lastDetection.detail}`);
            L.push(`  Marcados: ${this.lastDetection.flagged.length ? this.lastDetection.flagged.map(i => this.points[i].id).join(', ') : 'nenhum'}`);
            L.push('');
        }
        L.push('OBSERVAÇÕES');
        L.push('  id           d(mm)      w        r      ∇0(mm)   estado');
        r.obsData.forEach(o => {
            L.push(`  ${o.point.id.padEnd(12)} ${(o.d * 1000).toFixed(2).padStart(8)} ${o.w.toFixed(2).padStart(8)} ` +
                `${o.r.toFixed(3).padStart(7)} ${(o.mdb != null ? (o.mdb * 1000).toFixed(2) : '—').padStart(8)}   ` +
                `${o.point.flagged ? 'OUTLIER' : 'ok'}${o.point.hasBlunder ? ' (erro injetado)' : ''}`);
        });
        L.push('');
        L.push('Pontos desativados: ' +
            (this.points.filter(p => !p.active).map(p => p.id).join(', ') || 'nenhum'));
        PlanoIO.download('relatorio_ajustamento.txt', L.join('\n') + '\n', 'text/plain;charset=utf-8');
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
